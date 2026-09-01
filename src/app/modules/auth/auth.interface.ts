import { UserRole } from "../../../generated/prisma/enums"


export interface ILoginUserPayload {
    email: string
    password: string
}

export interface IRegisterPatientPayload {
    name: string
    email: string
    password: string
}

export interface IRequestUser {
    userId: string
    email: string
    name: string
    role: UserRole
}