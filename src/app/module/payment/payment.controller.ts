import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppError } from "../../utils/AppError";
import { paymentService } from "./payment.service";
import config from "../../config";

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
  const { val_id, tran_id } = req.body;

  if (val_id) {
    try {
      await paymentService.validateTransaction(val_id);
    } catch {
      // Validation failed — still redirect user, they can retry later
    }
  }

  const frontendUrl = config.frontend_url;
  res.redirect(
    `${frontendUrl}/payment/success?tran_id=${(tran_id as string) ?? ""}`,
  );
});

const failCallback = catchAsync(async (req: Request, res: Response) => {
  const { tran_id } = req.body;
  const frontendUrl = config.frontend_url;
  res.redirect(
    `${frontendUrl}/payment/fail?tran_id=${(tran_id as string) ?? ""}`,
  );
});

const cancelCallback = catchAsync(async (req: Request, res: Response) => {
  const { tran_id } = req.body;
  const frontendUrl = config.frontend_url;
  res.redirect(
    `${frontendUrl}/payment/cancel?tran_id=${(tran_id as string) ?? ""}`,
  );
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
