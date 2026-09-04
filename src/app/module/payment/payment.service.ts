import { randomUUID } from "crypto";
import { PaymentStatus, PaymentType } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import {
  initiatePayment as sslInitiatePayment,
  validateOrder as sslValidateOrder,
  queryByTranId as sslQueryByTranId,
  refundTransaction as sslRefund,
  type SSLCommerzValidationResponse,
} from "../../lib/sslcommerz";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
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
  const backendUrl = config.bak_url || config.frontend_url;
  if (!backendUrl) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "APP_URL or FRONTEND_URL must be set in environment variables",
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
    },
  });

  const sslResponse = await sslInitiatePayment({
    total_amount: payload.amount,
    currency: payload.currency ?? "BDT",
    tran_id: tranId,
    success_url: `${backendUrl}/api/v1/payment/success?tran_id=${tranId}`,
    fail_url: `${backendUrl}/api/v1/payment/fail?tran_id=${tranId}`,
    cancel_url: `${backendUrl}/api/v1/payment/cancel?tran_id=${tranId}`,
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

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      paymentDetails: JSON.parse(JSON.stringify(sslResponse)),
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

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: newStatus,
      paymentDetails: {
        ...((payment.paymentDetails as Record<string, unknown>) ?? {}),
        ipn: ipnData,
        validation: {
          status: validation.status,
          bank_tran_id: validation.bank_tran_id,
          risk_level: validation.risk_level,
          risk_title: validation.risk_title,
        },
      },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      outageReport: true,
    },
  });

  if (newStatus === PaymentStatus.COMPLETED) {
    await applyCompletedSideEffects(payment);
  }

  return updatedPayment;
};

const validateTransaction = async (
  valId: string,
): Promise<SSLCommerzValidationResponse> => {
  return sslValidateOrder(valId);
};

async function applyCompletedSideEffects(payment: {
  id: string;
  type: PaymentType;
  outageReportId: string | null;
  userId: string;
  amount: number;
}) {
  if (payment.type === PaymentType.PRIORITY_RESTORATION && payment.outageReportId) {
    await prisma.outageReport.update({
      where: { id: payment.outageReportId },
      data: { isPriority: true },
    });
  }

  if (payment.type === PaymentType.SLA_SUBSCRIPTION) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    await prisma.user.update({
      where: { id: payment.userId },
      data: {
        slaActive: true,
        slaExpiryDate: expiryDate,
      },
    });
  }
}

const confirmPaymentByTransactionId = async (tranId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { transactionId: tranId },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  if (payment.status !== PaymentStatus.PENDING) {
    return payment;
  }

  const queryResult = await sslQueryByTranId(tranId);

  const statusStr = (queryResult.status ?? "").toUpperCase();
  if (statusStr !== "VALID" && statusStr !== "VALIDATED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `SSLCommerz transaction not valid: ${statusStr}`,
    );
  }

  if (
    queryResult.amount !== undefined &&
    Number(queryResult.amount) !== payment.amount
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment amount mismatch — possible tampering detected",
    );
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.COMPLETED,
      paymentDetails: {
        ...((payment.paymentDetails as Record<string, unknown>) ?? {}),
        validation: {
          status: queryResult.status,
          bank_tran_id: queryResult.bank_tran_id,
          risk_level: queryResult.risk_level,
          risk_title: queryResult.risk_title,
          confirmedVia: "success_callback",
          confirmedAt: new Date().toISOString(),
        },
      },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      outageReport: true,
    },
  });

  await applyCompletedSideEffects(payment);

  return updatedPayment;
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
      },
    },
  });

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

const getUserPayments = async (userId: string, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { userId },
      include: {
        outageReport: { select: { id: true, description: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where: { userId } }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
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

  const updatedPayment = await prisma.payment.update({
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
      },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      outageReport: true,
    },
  });

  if (payment.type === PaymentType.PRIORITY_RESTORATION && payment.outageReportId) {
    await prisma.outageReport.update({
      where: { id: payment.outageReportId },
      data: { isPriority: false },
    });
  }

  if (payment.type === PaymentType.SLA_SUBSCRIPTION) {
    await prisma.user.update({
      where: { id: payment.userId },
      data: {
        slaActive: false,
        slaExpiryDate: null,
      },
    });
  }

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
