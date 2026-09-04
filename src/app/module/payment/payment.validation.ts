import { z } from "zod";
import { PaymentType } from "../../../generated/prisma/enums";

export const initiatePaymentSchema = z
  .object({
    amount: z
      .number()
      .min(10, "Minimum payment amount is 10 BDT")
      .max(500000, "Maximum payment amount is 500,000 BDT"),
    currency: z.string().default("BDT"),
    outageReportId: z.string().optional(),
    paymentType: z.nativeEnum(PaymentType),
  })
  .superRefine((data, ctx) => {
    if (data.paymentType === PaymentType.PRIORITY_RESTORATION) {
      if (!data.outageReportId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "outageReportId is required for PRIORITY_RESTORATION payments",
          path: ["outageReportId"],
        });
      }
    }
    if (data.paymentType === PaymentType.SLA_SUBSCRIPTION) {
      if (data.outageReportId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "outageReportId must not be provided for SLA_SUBSCRIPTION payments",
          path: ["outageReportId"],
        });
      }
    }
  });

export const refundPaymentSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  refundAmount: z
    .number()
    .min(1, "Refund amount must be greater than 0"),
  refundRemarks: z.string().min(1, "Refund remarks are required"),
});

export const paymentValidation = {
  initiatePaymentSchema,
  refundPaymentSchema,
};
