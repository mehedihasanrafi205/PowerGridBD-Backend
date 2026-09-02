import type { UserRole } from "../../../generated/prisma/enums";

export interface IQueryUserFilters {
	searchTerm?: string;
	role?: UserRole;
	status?: string;
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}
