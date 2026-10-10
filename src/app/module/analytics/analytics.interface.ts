export interface IQuery {
  searchTerm?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: "asc" | "desc" | string;
  from?: string;
  to?: string;

  // any other filter fields can be added here
  [key: string]: unknown;
}

export interface IPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IPaginatedResult<T> {
  data: T;
  meta: IPaginationMeta;
}

export interface ISlaPlan {
  id: string;
  name: string;
  description: string;
  tier: "BASIC" | "STANDARD" | "PREMIUM" | "ENTERPRISE";
  price: number;
  durationDays: number;
  features: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ISlaPlanResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data: ISlaPlan[];
}

export interface ISlaPlanDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data: ISlaPlan;
}

export interface ISlaSubscription {
  id: string;
  userId: string;
  planId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ISlaSubscriptionResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data: ISlaSubscription;
}

export interface ISlaSubscribePayload {
  planId: string;
}