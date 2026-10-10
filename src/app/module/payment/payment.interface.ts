import { PaymentType } from "../../../generated/prisma/enums";

export interface IPaymentInitPayload {
  amount: number;
  currency?: string;
  outageReportId?: string;
  planId?: string;
  paymentType: PaymentType;
}

export interface IInitiatePaymentResult {
  transactionId: string;
  gatewayUrl: string;
}

export interface IIPNPayload {
  status: string;
  tran_date?: string;
  tran_id: string;
  val_id: string;
  amount: number;
  store_amount?: number;
  currency_type?: string;
  currency_amount?: number;
  bank_tran_id?: string;
  card_type?: string;
  card_no?: string;
  value_a?: string;
  value_b?: string;
  value_c?: string;
  value_d?: string;
  verify_sign?: string;
  verify_key?: string;
  risk_level?: number;
  risk_title?: string;
  [key: string]: string | number | undefined;
}

export interface IRefundPayload {
  paymentId: string;
  refundAmount: number;
  refundRemarks: string;
}
