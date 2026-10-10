import { randomUUID } from "crypto";
import { addDays } from "date-fns";
import { PaymentStatus, PaymentType } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import {
  initiatePayment as sslInitiatePayment,
  validateOrder as sslValidateOrder,
  validateBySessionKey as sslValidateBySessionKey,
  queryByTranId as sslQueryByTranId,
  refundTransaction as sslRefund,
  type SSLCommerzValidationResponse,
} from "../../lib/sslcommerz";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { sendTemplatedEmail } from "../../utils/notify";
import type { IIPNPayload, IPaymentInitPayload } from "./payment.interface";

function generateTranId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 30);
}

const initiatePayment = async (
  userId: string,
  payload: IPaymentInitPayload,
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Prices are server-authoritative: the client-sent amount must match
  // the configured product price to prevent underpayment.
  const expectedAmount =
    payload.paymentType === PaymentType.PRIORITY_RESTORATION
      ? config.priority_restoration_price
      : config.sla_subscription_price;
  if (Number(payload.amount) !== expectedAmount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invalid amount for ${payload.paymentType}. Expected BDT ${expectedAmount}.`,
    );
  }

  if (payload.paymentType === PaymentType.PRIORITY_RESTORATION) {
    const report = await prisma.outageReport.findUnique({
      where: { id: payload.outageReportId! },
    });
    if (!report) {
      throw new AppError(httpStatus.NOT_FOUND, "Outage report not found");
    }
    if (report.customerId !== userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only purchase priority for your own outage reports",
      );
    }
    if (report.isPriority) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This outage report already has priority status",
      );
    }
  }

  if (payload.paymentType === PaymentType.SLA_SUBSCRIPTION) {
    if (user.slaActive && user.slaExpiryDate && user.slaExpiryDate > new Date()) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You already have an active SLA subscription",
      );
    }
  }

  const tranId = generateTranId();
  const frontendUrl = config.frontend_url;
  const backendUrl = config.bak_url;
  
  if (!frontendUrl) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "FRONTEND_URL must be set in environment variables",
    );
  }
  if (!backendUrl) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "BACKEND_URL must be set in environment variables",
    );
  }
  const payment = await prisma.payment.create({
    data: {
      amount: payload.amount,
      transactionId: tranId,
      gateway: "sslcommerz",
      type: payload.paymentType,
      status: PaymentStatus.PENDING,
      userId,
      outageReportId: payload.outageReportId,
      planId: payload.planId,
    },
  });

  const sslResponse = await sslInitiatePayment({
    total_amount: payload.amount,
    currency: payload.currency ?? "BDT",
    tran_id: tranId,
    success_url: `${frontendUrl}/payment/success?tran_id=${tranId}`,
    fail_url: `${frontendUrl}/payment/fail?tran_id=${tranId}`,
    cancel_url: `${frontendUrl}/payment/cancel?tran_id=${tranId}`,
    ipn_url: `${backendUrl}/api/v1/payment/ipn`,
    cus_name: user.name,
    cus_email: user.email,
    cus_phone: user.phone ?? "N/A",
    cus_add1: user.address ?? "N/A",
    cus_city: "Dhaka",
    cus_country: "Bangladesh",
    product_name:
      payload.paymentType === PaymentType.PRIORITY_RESTORATION
        ? "Priority Restoration Pass"
        : "SLA Subscription",
    product_category: "service",
    product_profile: "general",
  });

  const sslDetails = sslResponse as Record<string, string>;

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      paymentDetails: {
        sessionkey: sslDetails.sessionkey,
        status: sslDetails.status,
        store_id: sslDetails.store_id,
        failedreason: sslDetails.failedreason,
      },
    },
  });

  return {
    transactionId: tranId,
    gatewayUrl: sslResponse.GatewayPageURL!,
  };
};

const handleIPN = async (ipnData: IIPNPayload) => {
  const payment = await prisma.payment.findUnique({
    where: { transactionId: ipnData.tran_id },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  const validation = await sslValidateOrder(ipnData.val_id);

  if (
    validation.amount !== undefined &&
    Number(validation.amount) !== payment.amount
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment amount mismatch — possible tampering detected",
    );
  }

  let newStatus: PaymentStatus;
  switch (ipnData.status?.toUpperCase()) {
    case "VALID":
    case "VALIDATED":
      newStatus = PaymentStatus.COMPLETED;
      break;
    case "FAILED":
      newStatus = PaymentStatus.FAILED;
      break;
    case "CANCELLED":
    case "EXPIRED":
    case "UNATTEMPTED":
      newStatus = PaymentStatus.FAILED;
      break;
    default:
      newStatus = PaymentStatus.PENDING;
  }

  if (newStatus === PaymentStatus.COMPLETED) {
    const completedPayment = await prisma.$transaction(async (tx) => {
      const completed = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          paymentDetails: {
            ...((payment.paymentDetails as Record<string, unknown>) ?? {}),
            ipn: ipnData as Record<string, unknown>,
            validation: {
              status: validation.status,
              bank_tran_id: validation.bank_tran_id,
              risk_level: validation.risk_level,
              risk_title: validation.risk_title,
              confirmedVia: "ipn",
              confirmedAt: new Date().toISOString(),
            },
          } as any,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          outageReport: true,
        },
      });

      await applyCompletedSideEffects({
        ...payment,
        planId: payment.planId,
      },
      tx
    );

      await tx.auditLog.create({
        data: {
          action: "PAYMENT_COMPLETED",
          entity: "Payment",
          entityId: payment.id,
          actorId: payment.userId,
          metadata: {
            transactionId: payment.transactionId,
            amount: payment.amount,
            type: payment.type,
            confirmedVia: "ipn",
          } as any,
        },
      });

      return completed;
    });

    await notifyPaymentCompleted(payment);

    return completedPayment;
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: newStatus,
      paymentDetails: {
        ...((payment.paymentDetails as Record<string, unknown>) ?? {}),
        ipn: ipnData as Record<string, unknown>,
        validation: {
          status: validation.status,
          bank_tran_id: validation.bank_tran_id,
          risk_level: validation.risk_level,
          risk_title: validation.risk_title,
        },
      } as any,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      outageReport: true,
    },
  });

  return updatedPayment;
};

const validateTransaction = async (
  valId: string,
): Promise<SSLCommerzValidationResponse> => {
  return sslValidateOrder(valId);
};

type SideEffectDb = Pick<typeof prisma, "outageReport" | "user" | "slaPlan">;

async function applyCompletedSideEffects(
  payment: {
    id: string;
    type: PaymentType;
    outageReportId: string | null;
    userId: string;
    amount: number;
    planId: string | null;
  },
  db: SideEffectDb = prisma,
) {
  if (payment.type === PaymentType.PRIORITY_RESTORATION && payment.outageReportId) {
    await db.outageReport.update({
      where: { id: payment.outageReportId },
      data: { isPriority: true },
    });
  }

  if (payment.type === PaymentType.SLA_SUBSCRIPTION && payment.planId) {
    const plan = await db.slaPlan.findUnique({
      where: { id: payment.planId },
    });
    const durationDays = plan?.durationDays ?? 30;
    const expiryDate = addDays(new Date(), durationDays);
    await db.user.update({
      where: { id: payment.userId },
      data: {
        slaActive: true,
        slaExpiryDate: expiryDate,
      },
    });
  }
}

function paymentPurpose(type: PaymentType): string {
  return type === PaymentType.PRIORITY_RESTORATION
    ? "Priority Restoration Pass"
    : "SLA Subscription";
}

async function notifyPaymentCompleted(payment: {
  userId: string;
  transactionId: string;
  amount: number;
  type: PaymentType;
}) {
  const user = await prisma.user.findUnique({
    where: { id: payment.userId },
    select: { name: true, email: true, slaExpiryDate: true },
  });
  if (!user) return;

  await sendTemplatedEmail(
    user.email,
    "Payment Receipt - PowerGridBD",
    "payment-receipt.ejs",
    {
      name: user.name,
      success: true,
      amount: payment.amount,
      transactionId: payment.transactionId,
      purpose: paymentPurpose(payment.type),
    },
  );

  if (
    payment.type === PaymentType.SLA_SUBSCRIPTION &&
    user.slaExpiryDate
  ) {
    await sendTemplatedEmail(
      user.email,
      "SLA Subscription Activated - PowerGridBD",
      "sla-status.ejs",
      {
        name: user.name,
        kind: "activated",
        expiryDate: user.slaExpiryDate.toLocaleString(),
      },
    );
  }
}

async function markPaymentCompleted(
  payment: {
    id: string;
    amount: number;
    type: PaymentType;
    transactionId: string;
    outageReportId: string | null;
    userId: string;
    planId: string | null;
    paymentDetails: unknown;
  },
  validation: SSLCommerzValidationResponse,
  confirmedVia: string,
) {
  const details = (payment.paymentDetails as Record<string, unknown>) ?? {};

  const updatedPayment = await prisma.$transaction(async (tx) => {
    const completed = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.COMPLETED,
        paymentDetails: {
          ...details,
          validation: {
            status: validation.status,
            bank_tran_id: validation.bank_tran_id,
            risk_level: validation.risk_level,
            risk_title: validation.risk_title,
            confirmedVia,
            confirmedAt: new Date().toISOString(),
          },
        } as any,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        outageReport: true,
      },
    });

    await applyCompletedSideEffects({
        ...payment,
        planId: payment.planId,
      },
      tx
    );

    await tx.auditLog.create({
      data: {
        action: "PAYMENT_COMPLETED",
        entity: "Payment",
        entityId: payment.id,
        actorId: payment.userId,
        metadata: {
          transactionId: completed.transactionId,
          amount: completed.amount,
          type: completed.type,
          confirmedVia,
        } as any,
      },
    });

    return completed;
  });

  await notifyPaymentCompleted(payment);

  return updatedPayment;
}

const confirmPaymentByTransactionId = async (
  tranId: string,
  postBody?: Record<string, string>,
) => {
  const payment = await prisma.payment.findUnique({
    where: { transactionId: tranId },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  if (payment.status !== PaymentStatus.PENDING) {
    return payment;
  }

  const details = (payment.paymentDetails as Record<string, unknown>) ?? {};

  // Strategy 1: Use val_id from SSLCommerz POST body → validateOrder API
  const valId = postBody?.val_id;
  if (valId) {
    try {
      console.log(`[payment] trying validateOrder with val_id=${valId}`);
      const validation = await sslValidateOrder(valId);
      console.log(`[payment] validateOrder returned status=${validation.status}`);

      if (validation.status?.toUpperCase() === "VALID" || validation.status?.toUpperCase() === "VALIDATED") {
        if (validation.amount !== undefined && Number(validation.amount) !== payment.amount) {
          throw new AppError(httpStatus.BAD_REQUEST, "Payment amount mismatch");
        }
        return await markPaymentCompleted(payment, validation, "val_id_validation");
      }
    } catch (err) {
      console.error(`[payment] validateOrder failed for val_id=${valId}:`, err);
    }
  }

  // Strategy 2: Trust POST body status field (SSLCommerz signs it)
  if (postBody?.status?.toUpperCase() === "VALID" || postBody?.status?.toUpperCase() === "VALIDATED") {
    console.log(`[payment] trusting POST body status=VALID for tran_id=${tranId}`);
    const postValidation: SSLCommerzValidationResponse = {
      status: postBody.status,
      tran_id: postBody.tran_id,
      amount: postBody.amount ? Number(postBody.amount) : undefined,
      bank_tran_id: postBody.bank_tran_id,
      card_type: postBody.card_type,
      currency_type: postBody.currency_type,
      risk_level: postBody.risk_level ? Number(postBody.risk_level) : undefined,
      risk_title: postBody.risk_title,
    };
    return await markPaymentCompleted(payment, postValidation, "post_body_direct");
  }

  // Strategy 3: sessionkey → validationserverAPI
  const sessionKey = details.sessionkey as string | undefined;
  if (sessionKey) {
    try {
      console.log(`[payment] trying validateBySessionKey sessionkey=${sessionKey}`);
      const validation = await sslValidateBySessionKey(sessionKey);
      console.log(`[payment] validateBySessionKey returned status=${validation.status}`);

      if (validation.status?.toUpperCase() === "VALID" || validation.status?.toUpperCase() === "VALIDATED") {
        if (validation.amount !== undefined && Number(validation.amount) !== payment.amount) {
          throw new AppError(httpStatus.BAD_REQUEST, "Payment amount mismatch");
        }
        return await markPaymentCompleted(payment, validation, "sessionkey_validation");
      }
    } catch (err) {
      console.error(`[payment] validateBySessionKey failed:`, err);
    }
  }

  // Strategy 4: Fallback to queryByTranId
  try {
    console.log(`[payment] trying queryByTranId for tran_id=${tranId}`);
    const queryResult = await sslQueryByTranId(tranId);
    console.log(`[payment] queryByTranId returned status=${queryResult.status}`);

    if (queryResult.status?.toUpperCase() === "VALID" || queryResult.status?.toUpperCase() === "VALIDATED") {
      if (queryResult.amount !== undefined && Number(queryResult.amount) !== payment.amount) {
        throw new AppError(httpStatus.BAD_REQUEST, "Payment amount mismatch");
      }
      return await markPaymentCompleted(payment, queryResult, "queryByTranId");
    }
  } catch (err) {
    console.error(`[payment] queryByTranId failed for tran_id=${tranId}:`, err);
  }

  console.error(`[payment] ALL validation strategies failed for tran_id=${tranId}`);
  throw new AppError(
    httpStatus.BAD_REQUEST,
    "Could not validate payment with SSLCommerz",
  );
};

const handleCallbackStatus = async (
  tranId: string,
  callbackType: "FAILED" | "CANCELLED",
) => {
  const payment = await prisma.payment.findUnique({
    where: { transactionId: tranId },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  if (payment.status !== PaymentStatus.PENDING) {
    return payment;
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.FAILED,
      paymentDetails: {
        ...((payment.paymentDetails as Record<string, unknown>) ?? {}),
        [callbackType === "FAILED" ? "failCallback" : "cancelCallback"]: true,
        [callbackType === "FAILED" ? "failedAt" : "cancelledAt"]:
          new Date().toISOString(),
      } as any,
    },
  });

  const payer = await prisma.user.findUnique({
    where: { id: payment.userId },
    select: { name: true, email: true },
  });
  if (payer) {
    await sendTemplatedEmail(
      payer.email,
      "Payment Not Completed - PowerGridBD",
      "payment-receipt.ejs",
      {
        name: payer.name,
        success: false,
        amount: payment.amount,
        transactionId: payment.transactionId,
        purpose: paymentPurpose(payment.type),
      },
    );
  }

  return updatedPayment;
};

const getPaymentByTransactionId = async (tranId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { transactionId: tranId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      outageReport: true,
    },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  return payment;
};

const getUserPayments = async (
  userId: string,
  page = 1,
  limit = 10,
  filters: { status?: PaymentStatus; type?: PaymentType } = {},
) => {
  const pageNumber = Number(page) > 0 ? Math.floor(Number(page)) : 1;
  const limitNumber =
    Number(limit) > 0 ? Math.min(Math.floor(Number(limit)), 100) : 10;
  const skip = (pageNumber - 1) * limitNumber;

  const where: { userId: string; status?: PaymentStatus; type?: PaymentType } =
    { userId };
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        outageReport: { select: { id: true, description: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limitNumber,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber) || 0,
    },
    data: payments,
  };
};

const initiateRefund = async (
  paymentId: string,
  refundAmount: number,
  refundRemarks: string,
  userId: string,
) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      outageReport: true,
    },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  if (payment.userId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only refund your own payments",
    );
  }

  if (payment.status !== PaymentStatus.COMPLETED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only completed payments can be refunded",
    );
  }

  if (refundAmount > payment.amount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Refund amount cannot exceed the original payment amount",
    );
  }

  const paymentDetails = payment.paymentDetails as Record<string, unknown>;
  const validation = paymentDetails?.validation as
    | { bank_tran_id?: string }
    | undefined;
  const bankTranId = validation?.bank_tran_id;

  if (!bankTranId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Bank transaction ID not found in payment details",
    );
  }

  const refundTransId = `REF-${generateTranId()}`;

  const refundResult = await sslRefund({
    bank_tranId: bankTranId as string,
    refundTransId,
    refundAmount,
    refundRemarks,
    refeId: paymentId,
  });

  const updatedPayment = await prisma.$transaction(async (tx) => {
    const refunded = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REFUNDED,
        paymentDetails: {
          ...paymentDetails,
          refund: {
            refund_trans_id: refundResult.refund_trans_id,
            refund_amount: refundResult.refund_amount,
            bank_tran_id: refundResult.bank_tran_id,
            remarks: refundRemarks,
            refundedAt: new Date().toISOString(),
          },
        } as any,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        outageReport: true,
      },
    });

    if (payment.type === PaymentType.PRIORITY_RESTORATION && payment.outageReportId) {
      await tx.outageReport.update({
        where: { id: payment.outageReportId },
        data: { isPriority: false },
      });
    }

    if (payment.type === PaymentType.SLA_SUBSCRIPTION) {
      await tx.user.update({
        where: { id: payment.userId },
        data: {
          slaActive: false,
          slaExpiryDate: null,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: "PAYMENT_REFUNDED",
        entity: "Payment",
        entityId: paymentId,
        actorId: userId,
        metadata: {
          refund_trans_id: refundResult.refund_trans_id,
          refund_amount: refundResult.refund_amount,
          remarks: refundRemarks,
        } as any,
      },
    });

    return refunded;
  });

  await sendTemplatedEmail(
    updatedPayment.user.email,
    "Refund Issued - PowerGridBD",
    "payment-refund.ejs",
    {
      name: updatedPayment.user.name,
      refundAmount,
      transactionId: updatedPayment.transactionId,
      refundTransId,
      remarks: refundRemarks,
    },
  );

  return updatedPayment;
};

export const paymentService = {
  initiatePayment,
  handleIPN,
  validateTransaction,
  confirmPaymentByTransactionId,
  handleCallbackStatus,
  getPaymentByTransactionId,
  getUserPayments,
  initiateRefund,
};
