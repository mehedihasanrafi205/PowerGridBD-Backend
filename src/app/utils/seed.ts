import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";

export const seedTesterAdmin = async () => {
	if (!config.tester_admin_email) return;

	const email = config.tester_admin_email.toLowerCase();
	const exists = await prisma.user.findUnique({ where: { email } });
	if (exists) return;

	const hashedPassword = await bcrypt.hash(
		config.tester_admin_password || "Change@12345",
		config.bcrypt_salt_rounds,
	);

	await prisma.user.create({
		data: {
			name: config.tester_admin_name || "Tester Admin",
			email,
			password: hashedPassword,
			role: UserRole.ADMIN,
			status: UserStatus.ACTIVE,
			emailVerified: true,
		},
	});

	console.log("Seeded tester admin:", email);
};

export const seedAll = async () => {
	await seedTesterAdmin();
};
