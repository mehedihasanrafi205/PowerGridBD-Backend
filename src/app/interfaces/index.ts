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
