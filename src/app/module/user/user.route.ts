import { Router } from "express";
import { userController } from "./user.controller";
import { upload } from "../../lib/multer";

import { auth } from "../../middleware/checkAuth";
import { UserRole } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { userValidation } from "./user.validation";

const router = Router();

router.patch(
  "/profile-image",
  auth(
    UserRole.ADMIN,
    UserRole.POWER_OPERATOR,
    UserRole.TECHNICIAN,
    UserRole.CUSTOMER,
  ),
  upload.single("profileImage"),
  userController.uploadProfileImage,
);
router.patch(
  "/profile",
  auth(
    UserRole.ADMIN,
    UserRole.POWER_OPERATOR,
    UserRole.TECHNICIAN,
    UserRole.CUSTOMER,
  ),
  validateRequest(userValidation.updateProfileValidationSchema),
  userController.updateProfile,
);

// 1. Get all users (Admin only, with pagination/search/filter)
router.get("/", auth(UserRole.ADMIN), userController.getAllUsers);

// 2. Dispatchable technician options for admins and power operators
router.get(
  "/technicians",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  userController.getTechnicians,
);

// 3. Get single user by ID (Admin only)
router.get("/:id", auth(UserRole.ADMIN), userController.getUserById);

// 4. Update user status (Active/Blocked)
router.patch(
  "/:id/status",
  auth(UserRole.ADMIN),
  validateRequest(userValidation.updateStatusValidationSchema),
  userController.updateUserStatus,
);

// 5. Update user role (Admin: any role; Power Operator: technician grant/revoke only)
router.patch(
  "/:id/role",
  auth(UserRole.ADMIN, UserRole.POWER_OPERATOR),
  validateRequest(userValidation.updateRoleValidationSchema),
  userController.updateUserRole,
);

// 6. Soft delete user
router.delete("/:id", auth(UserRole.ADMIN), userController.softDeleteUser);

export const UserRoutes = router;
