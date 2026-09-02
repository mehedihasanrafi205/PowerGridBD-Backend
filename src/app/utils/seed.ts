import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { UserRole, UserStatus } from "../../generated/prisma/enums";
import config from "../config";

export const seedSuperAdmin = async () => {
  try {
    const isSuperAdminExists = await prisma.user.findFirst({
      where: {
        role: UserRole.ADMIN,
      },
    });

    if (isSuperAdminExists) {
      console.log("⚡ Super Admin already exists.");
      return;
    }

    const name = config.tester_admin_name || "System Super Admin";
    const password = config.tester_admin_password || "Admin@12345";
    const email = config.tester_admin_email || "superadmin@powergrid.bd";

    if (!name || !email || !password) {
      throw new Error(
        "Super Admin Name, Email, or Password missing in Env file!",
      );
    }

    const hashedPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds || 10),
    );

    const superAdmin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        needPasswordChange: false,
        emailVerified: true,
      },
    });

    console.log("✔ Super Admin Created Successfully:", superAdmin.email);
  } catch (error) {
    console.error("✖ Error Seeding Super Admin:", error);
  }
};

export const seedPowerOperator = async () => {
  try {
    const operatorEmail = config.tester_power_operator_email;
    const isOperatorExist = await prisma.user.findUnique({
      where: { email: operatorEmail },
    });

    if (isOperatorExist) {
      console.log("⚡ Power Operator already exists!");
      return;
    }

    const hashedPassword = await bcrypt.hash(
      config.tester_power_operator_password,
      Number(config.bcrypt_salt_rounds || 10),
    );

    const powerOperator = await prisma.user.create({
      data: {
        name: config.tester_power_operator_name,
        email: operatorEmail,
        password: hashedPassword,
        role: UserRole.POWER_OPERATOR,
        status: UserStatus.ACTIVE,
        needPasswordChange: false,
        emailVerified: true,
        phone: "+8801800000001",
        address: "Load Dispatch Center, Dhaka",
      },
    });

    console.log("✔ Power Operator Created Successfully:", powerOperator.email);
  } catch (error) {
    console.error("✖ Error Seeding Power Operator:", error);
  }
};

export const seedTechnician = async () => {
  try {
    const techEmail = config.tester_technician_email;
    const isTechExist = await prisma.user.findUnique({
      where: { email: techEmail },
    });

    if (isTechExist) {
      console.log("⚡ Field Technician already exists!");
      return;
    }

    const hashedPassword = await bcrypt.hash(
      config.tester_technician_password,
      Number(config.bcrypt_salt_rounds || 10),
    );

    const technician = await prisma.user.create({
      data: {
        name: config.tester_technician_name,
        email: techEmail,
        password: hashedPassword,
        role: UserRole.TECHNICIAN,
        status: UserStatus.ACTIVE,
        needPasswordChange: false,
        emailVerified: true,
        phone: "+8801900000002",
        address: "Gulshan Substation Yard, Dhaka",
      },
    });

    console.log("✔ Field Technician Created Successfully:", technician.email);
  } catch (error) {
    console.error("✖ Error Seeding Field Technician:", error);
  }
};

// const main = async () => {
//   console.log("🌱 Starting Database Seeding for PowerGridBD...\n");
//   await seedSuperAdmin();
//   await seedPowerOperator();
//   await seedTechnician();
//   console.log("\n✨ Database Seeding Completed Successfully!");
// };

// main()
//   .catch((e) => {
//     console.error("✖ Critical Seeding Error:", e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
