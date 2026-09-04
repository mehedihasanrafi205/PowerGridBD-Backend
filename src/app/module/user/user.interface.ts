import type { UserRole, UserStatus } from "../../../generated/prisma/enums";

export interface IUpdateProfilePayload {
  name?: string;
  phone?: string;
  address?: string;
}

export interface IUpdateUserStatusPayload {
  status: UserStatus;
}

export interface IUpdateUserRolePayload {
  role: UserRole;
}
