import config from "../config";
import { AppError } from "../utils/AppError";
import httpStatus from "http-status";

const SANDBOX_BASE = "https://sandbox.sslcommerz.com";
const LIVE_BASE = "https://securepay.sslcommerz.com";

function getBaseUrl(): string {
  return config.sslc_is_live ? LIVE_BASE : SANDBOX_BASE;
}

function getStoreId(): string {
  return config.sslc_store_id;
}

function getStorePasswd(): string {
  return config.sslc_store_passwd;
}

// ─── Initiate Payment (POST, form-urlencoded) ───────────────────────────

export interface SSLCommerzInitRequest {
  store_id: string;
  store_passwd: string;
  total_amount: number;
  currency: string;
  tran_id: string;
  success_url: string;
  fail_url: string;
  cancel_url: string;
  ipn_url?: string;
  cus_name: string;
  cus_email: string;
  cus_phone: string;
  cus_add1?: string;
  cus_city?: string;
  cus_country?: string;
  product_name: string;
  product_category: string;
  product_profile: string;
  [key: string]: string | number | undefined;
}

export interface SSLCommerzInitResponse {
  status: string;
  failedreason?: string;
  sessionkey?: string;
  GatewayPageURL?: string;
  directPaymentURL?: string;
  redirectGatewayURL?: string;
  storeBanner?: string;
  storeLogo?: string;
  [key: string]: string | undefined | unknown;
}

export async function initiatePayment(
  data: Omit<SSLCommerzInitRequest, "store_id" | "store_passwd">,
): Promise<SSLCommerzInitResponse> {
  const payload = {
    ...data,
    store_id: getStoreId(),
    store_passwd: getStorePasswd(),
  } as SSLCommerzInitRequest;

  const body = new URLSearchParams(
    Object.entries(payload).reduce(
      (acc, [key, val]) => {
        if (val !== undefined && val !== null) {
          acc[key] = String(val);
        }
        return acc;
      },
      {} as Record<string, string>,
    ),
  );

  const res = await fetch(`${getBaseUrl()}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `SSLCommerz API error: ${res.status} ${res.statusText}`,
    );
  }

  const result = (await res.json()) as SSLCommerzInitResponse;

  if (result.status !== "SUCCESS") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `SSLCommerz session failed: ${result.failedreason ?? "Unknown error"}`,
    );
  }

  return result;
}

// ─── Validate Order (GET) ───────────────────────────────────────────────

export interface SSLCommerzValidationResponse {
  status: string;
  tran_date?: string;
  tran_id?: string;
  val_id?: string;
  amount?: number;
  store_amount?: number;
  currency_type?: string;
  currency_amount?: number;
  bank_tran_id?: string;
  card_type?: string;
  card_no?: string;
  card_issuer?: string;
  card_brand?: string;
  risk_level?: number;
  risk_title?: string;
  APIConnect?: string;
  gw?: string;
  [key: string]: string | number | undefined;
}

export async function validateOrder(
  valId: string,
): Promise<SSLCommerzValidationResponse> {
  const params = new URLSearchParams({
    val_id: valId,
    store_id: getStoreId(),
    store_passwd: getStorePasswd(),
    format: "json",
    v: "1",
  });

  const res = await fetch(
    `${getBaseUrl()}/validator/api/validationserverAPI.php?${params.toString()}`,
    { method: "GET" },
  );

  if (!res.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `SSLCommerz validation API error: ${res.status} ${res.statusText}`,
    );
  }

  const result = (await res.json()) as SSLCommerzValidationResponse;

  if (result.status === "INVALID_TRANSACTION") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "SSLCommerz: Invalid validation ID",
    );
  }

  return result;
}

// ─── Validate by Session Key (GET) ──────────────────────────────────────

export async function validateBySessionKey(
  sessionKey: string,
): Promise<SSLCommerzValidationResponse> {
  const params = new URLSearchParams({
    sessionkey: sessionKey,
    store_id: getStoreId(),
    store_passwd: getStorePasswd(),
    format: "json",
    v: "1",
  });

  const res = await fetch(
    `${getBaseUrl()}/validator/api/validationserverAPI.php?${params.toString()}`,
    { method: "GET" },
  );

  if (!res.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `SSLCommerz validation API error: ${res.status} ${res.statusText}`,
    );
  }

  const result = (await res.json()) as SSLCommerzValidationResponse;

  if (result.status === "INVALID_TRANSACTION") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "SSLCommerz: Invalid session key",
    );
  }

  return result;
}

// ─── Query by Transaction ID (GET, fallback) ────────────────────────────

export async function queryByTranId(
  tranId: string,
): Promise<SSLCommerzValidationResponse> {
  const params = new URLSearchParams({
    tran_id: tranId,
    store_id: getStoreId(),
    store_passwd: getStorePasswd(),
    format: "json",
    v: "1",
  });

  const res = await fetch(
    `${getBaseUrl()}/validator/api/merchantTransIDvalidationAPI.php?${params.toString()}`,
    { method: "GET" },
  );

  if (!res.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `SSLCommerz query API error: ${res.status} ${res.statusText}`,
    );
  }

  return (await res.json()) as SSLCommerzValidationResponse;
}

// ─── Refund Transaction (POST, form-urlencoded) ─────────────────────────

export interface SSLCommerzRefundRequest {
  bank_tran_id: string;
  refund_trans_id: string;
  store_id: string;
  store_passwd: string;
  refund_amount: number;
  refund_remarks: string;
  refe_id?: string;
  format?: string;
}

export interface SSLCommerzRefundResponse {
  status: string;
  error_reason?: string;
  refund_amount?: number;
  refund_trans_id?: string;
  bank_tran_id?: string;
  [key: string]: string | number | undefined;
}

export async function refundTransaction(data: {
  bank_tranId: string;
  refundTransId: string;
  refundAmount: number;
  refundRemarks: string;
  refeId?: string;
}): Promise<SSLCommerzRefundResponse> {
  const payload: SSLCommerzRefundRequest = {
    bank_tran_id: data.bank_tranId,
    refund_trans_id: data.refundTransId,
    store_id: getStoreId(),
    store_passwd: getStorePasswd(),
    refund_amount: data.refundAmount,
    refund_remarks: data.refundRemarks,
    refe_id: data.refeId,
    format: "json",
  };

  const body = new URLSearchParams(
    Object.entries(payload).reduce(
      (acc, [key, val]) => {
        if (val !== undefined && val !== null) {
          acc[key] = String(val);
        }
        return acc;
      },
      {} as Record<string, string>,
    ),
  );

  const res = await fetch(
    `${getBaseUrl()}/validator/api/merchantTransIDvalidationAPI.php`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    },
  );

  if (!res.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `SSLCommerz refund API error: ${res.status} ${res.statusText}`,
    );
  }

  const result = (await res.json()) as SSLCommerzRefundResponse;

  if (result.status !== "SUCCESS") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `SSLCommerz refund failed: ${result.error_reason ?? "Unknown error"}`,
    );
  }

  return result;
}
