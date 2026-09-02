export type TSortOrder = "asc" | "desc";

export interface IQueryOptions {
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: TSortOrder;
	searchTerm?: string;
}

export interface IQueryResult<T> {
	meta: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
	data: T[];
}
