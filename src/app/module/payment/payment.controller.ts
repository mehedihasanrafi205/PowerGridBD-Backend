import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppError } from "../../utils/AppError";
import { paymentService } from "./payment.service";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { PaymentStatus } from "../../../generated/prisma/enums";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authenticated");
  }

  const result = await paymentService.initiatePayment(req.user.userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment session created successfully",
    data: result,
  });
});

const handleIPN = catchAsync(async (req: Request, res: Response) => {
  const ipnData = req.body;
  await paymentService.handleIPN(ipnData);

  res.status(httpStatus.OK).json({ status: "ok" });
});

const successCallback = catchAsync(async (req: Request, res: Response) => {
  const tranId = (req.query.tran_id as string) || (req.body.tran_id as string);
  const valId = (req.query.val_id as string) || (req.body.val_id as string);

  if (valId && tranId) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { transactionId: tranId },
      });

      if (payment && payment.status === PaymentStatus.PENDING) {
        await paymentService.handleIPN({
          status: "VALID",
          tran_id: tranId,
          val_id: valId,
          amount: payment.amount,
        });
      }
    } catch {
      // Validation failed — still redirect user
    }
  }

  const frontendUrl = config.frontend_url;
  res.redirect(`${frontendUrl}/payment/success?tran_id=${tranId ?? ""}`);
});

const failCallback = catchAsync(async (req: Request, res: Response) => {
  const tranId = (req.query.tran_id as string) || (req.body.tran_id as string);

  if (tranId) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { transactionId: tranId },
      });

      if (payment && payment.status === PaymentStatus.PENDING) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            paymentDetails: {
              ...((payment.paymentDetails as Record<string, unknown>) ?? {}),
              failCallback: true,
              failedAt: new Date().toISOString(),
            },
          },
        });
      }
    } catch {
      // Best effort — redirect user regardless
    }
  }

  const frontendUrl = config.frontend_url;
  res.redirect(`${frontendUrl}/payment/fail?tran_id=${tranId ?? ""}`);
});

const cancelCallback = catchAsync(async (req: Request, res: Response) => {
  const tranId = (req.query.tran_id as string) || (req.body.tran_id as string);

  if (tranId) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { transactionId: tranId },
      });

      if (payment && payment.status === PaymentStatus.PENDING) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            paymentDetails: {
              ...((payment.paymentDetails as Record<string, unknown>) ?? {}),
              cancelCallback: true,
              cancelledAt: new Date().toISOString(),
            },
          },
        });
      }
    } catch {
      // Best effort — redirect user regardless
    }
  }

  const frontendUrl = config.frontend_url;
  res.redirect(`${frontendUrl}/payment/cancel?tran_id=${tranId ?? ""}`);
});

const getPaymentByTransactionId = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const payment = await paymentService.getPaymentByTransactionId(id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Payment retrieved successfully",
      data: payment,
    });
  },
);

const getUserPayments = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authenticated");
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await paymentService.getUserPayments(
    req.user.userId,
    page,
    limit,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const initiateRefund = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authenticated");
  }

  const result = await paymentService.initiateRefund(
    req.body.paymentId,
    req.body.refundAmount,
    req.body.refundRemarks,
    req.user.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Refund initiated successfully",
    data: result,
  });
});

export const paymentController = {
  initiatePayment,
  handleIPN,
  successCallback,
  failCallback,
  cancelCallback,
  getPaymentByTransactionId,
  getUserPayments,
  initiateRefund,
};
