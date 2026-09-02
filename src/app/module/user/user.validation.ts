import { z } from "zod";

export const getAllUsersValidation = z.object({
	query: z
		.object({
			searchTerm: z.string().optional(),
			role: z.string().optional(),
			status: z.string().optional(),
			page: z.string().optional(),
			limit: z.string().optional(),
			sortBy: z.string().optional(),
			sortOrder: z.enum(["asc", "desc"]).optional(),
		})
		.optional(),
});
