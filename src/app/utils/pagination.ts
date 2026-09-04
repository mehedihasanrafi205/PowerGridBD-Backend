import type { IQuery } from "../interfaces";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export interface IParsedQuery {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export const calculatePagination = (
  query: IQuery,
  defaults: { page?: number; limit?: number; sortBy?: string } = {},
): IParsedQuery => {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);

  const page =
    Number.isFinite(rawPage) && rawPage > 0
      ? Math.floor(rawPage)
      : (defaults.page ?? DEFAULT_PAGE);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
    : (defaults.limit ?? DEFAULT_LIMIT);

  const sortBy =
    typeof query.sortBy === "string" && query.sortBy.length > 0
      ? query.sortBy
      : (defaults.sortBy ?? "createdAt");
  const sortOrder =
    String(query.sortOrder ?? "").toLowerCase() === "asc" ? "asc" : "desc";

  return { page, limit, skip: (page - 1) * limit, sortBy, sortOrder };
};

export const buildMeta = (total: number, page: number, limit: number) => {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 0,
  };
};
