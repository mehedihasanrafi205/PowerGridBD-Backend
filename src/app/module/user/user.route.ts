import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { getAllUsersValidation } from "./user.validation";

const router = Router();

router.patch(
	"/profile-image",
	auth(UserRole.ADMIN, UserRole.POWER_OPERATOR, UserRole.TECHNICIAN, UserRole.CUSTOMER),
	upload.single("profileImage"),
	UserController.updateProfileImage,
);

router.get(
	"/",
	auth(UserRole.ADMIN),
	validateRequest(getAllUsersValidation),
	UserController.getAllUsers,
);

router.get("/:userId", auth(UserRole.ADMIN), UserController.getSingleUser);

export const UserRoutes = router;
