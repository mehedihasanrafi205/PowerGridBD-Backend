import type { ApplicationStatus } from "../../../generated/prisma/enums";

export interface IApplyTechnicianPayload {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  experience?: string;
  bio?: string;
}

export interface IVerifyApplicationEmailPayload {
  email: string;
  otp: string;
}

export interface IReviewApplicationPayload {
  applicationId: string;
  status: ApplicationStatus;
  rejectionReason?: string;
}
