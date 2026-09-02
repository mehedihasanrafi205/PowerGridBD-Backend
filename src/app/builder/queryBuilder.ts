import type { Prisma } from "../../generated/prisma/client";
import type { IQueryOptions, TSortOrder } from "../interfaces";

/**
 * Parses raw query params into a normalized options object with sane defaults.
 */
export const parseQueryOptions = (
	query: Record<string, unknown>,
	defaultSortBy = "createdAt",
): Required<IQueryOptions> => {
	const page = Math.max(Number(query.page) || 1, 1);
	const limit = Math.max(Number(query.limit) || 10, 1);
	const sortBy = (query.sortBy as string) || defaultSortBy;
	const sortOrder: TSortOrder = query.sortOrder === "asc" ? "asc" : "desc";
	const searchTerm = (query.searchTerm as string) || "";

	return { page, limit, sortBy, sortOrder, searchTerm };
};

/**
 * Builds the pagination args (skip/take + orderBy) for a Prisma findMany call.
 */
export const paginationArgs = (options: Required<IQueryOptions>) => {
	const skip = (options.page - 1) * options.limit;
	return {
		skip,
		take: options.limit,
		orderBy: { [options.sortBy]: options.sortOrder } as Prisma.UserOrderByWithRelationInput,
	};
};

/**
 * Wraps a findMany result, computing the meta envelope.
 */
export const withMeta = <T>(data: T[], total: number, options: Required<IQueryOptions>) => ({
	meta: {
		page: options.page,
		limit: options.limit,
		total,
		totalPages: Math.ceil(total / options.limit),
	},
	data,
});
