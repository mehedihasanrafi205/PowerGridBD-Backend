import { z } from "zod";
import { UserRole, UserStatus } from "../../../generated/prisma/enums";

const updateProfileValidationSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
});

const updateStatusValidationSchema = z.object({
  body: z.object({
    status: z.nativeEnum(UserStatus, {
      message: "Invalid status value",
    }),
  }),
});

const updateRoleValidationSchema = z.object({
  body: z.object({
    role: z.nativeEnum(UserRole, {
      message: "Invalid role value",
    }),
  }),
});

export const userValidation = {
  updateProfileValidationSchema,
  updateStatusValidationSchema,
  updateRoleValidationSchema,
};
