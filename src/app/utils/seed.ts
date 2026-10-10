import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { UserRole, UserStatus, OutageStatus, SlaPlanTier } from "../../generated/prisma/enums";
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

export const seedSlaPlans = async () => {
  try {
    // Check if SLA plans already exist
    const existingPlans = await prisma.slaPlan.count();
    if (existingPlans > 0) {
      console.log("⚡ SLA plans already exist, skipping seed");
      return;
    }

    const plans = [
      {
        name: "Basic SLA",
        description: "Essential SLA coverage for residential customers",
        tier: SlaPlanTier.BASIC,
        price: 2000.00,
        durationDays: 30,
        features: [
          "Priority outage restoration (8-hour SLA)",
          "Email notifications for outages",
          "Monthly outage summary report",
          "Standard support line (9 AM - 6 PM)",
        ],
        isActive: true,
      },
      {
        name: "Standard SLA",
        description: "Comprehensive SLA for small businesses",
        tier: SlaPlanTier.STANDARD,
        price: 5000.00,
        durationDays: 30,
        features: [
          "Priority outage restoration (4-hour SLA)",
          "SMS + Email notifications for outages",
          "Weekly outage summary report",
          "Priority support line (24/7)",
          "Monthly grid health report",
          "1 priority restoration credit/month",
        ],
        isActive: true,
      },
      {
        name: "Premium SLA",
        description: "Premium SLA for businesses with critical power needs",
        tier: SlaPlanTier.PREMIUM,
        price: 12000.00,
        durationDays: 30,
        features: [
          "Priority outage restoration (2-hour SLA)",
          "SMS + Email + Push notifications",
          "Real-time outage dashboard access",
          "Dedicated 24/7 support engineer",
          "Weekly grid health report",
          "3 priority restoration credits/month",
          "Quarterly grid resilience assessment",
          "Discounted emergency services (20% off)",
        ],
        isActive: true,
      },
      {
        name: "Enterprise SLA",
        description: "Mission-critical SLA for industrial and enterprise customers",
        tier: SlaPlanTier.ENTERPRISE,
        price: 25000.00,
        durationDays: 30,
        features: [
          "Priority outage restoration (1-hour SLA)",
          "Multi-channel notifications (SMS, Email, Push, Call)",
          "Real-time outage dashboard with API access",
          "Dedicated account manager + 24/7 support team",
          "Daily grid health & predictive analytics",
          "Unlimited priority restoration credits",
          "Monthly grid resilience & capacity planning",
          "Emergency services included",
          "Custom escalation matrix",
          "Quarterly business review with grid engineers",
        ],
        isActive: true,
      },
    ];

    for (const plan of plans) {
      await prisma.slaPlan.create({ data: plan });
    }

    console.log(`✔ Created ${plans.length} SLA plans`);
  } catch (error) {
    console.error("✖ Error Seeding SLA Plans:", error);
  }
};

export const seedOutageReports = async () => {
  try {
    // Get technician and areas
    const technician = await prisma.user.findUnique({
      where: { email: config.tester_technician_email },
    });
    const areas = await prisma.area.findMany({ take: 3 });

    if (!technician) {
      console.log("⚠ Technician not found, skipping outage reports seed");
      return;
    }

    if (areas.length === 0) {
      console.log("⚠ No areas found, skipping outage reports seed");
      return;
    }

    // Check if outage reports already exist for this technician
    const existingReports = await prisma.outageReport.count({
      where: { technicianId: technician.id },
    });

    if (existingReports > 0) {
      console.log("⚡ Outage reports already exist for technician");
      return;
    }

    const statuses = [
      "ASSIGNED",
      "IN_PROGRESS",
      "RESOLVED",
      "PENDING",
    ] as const;

    const descriptions = [
      "Power outage in residential area due to transformer failure",
      "Scheduled maintenance outage for feeder upgrade",
      "Emergency outage due to storm damage on feeder line",
      "Planned outage for substation maintenance",
      "Cable fault causing outage in commercial district",
      "Transformer overload causing intermittent outages",
      "Vegetation contact causing line fault",
      "Equipment failure at distribution substation",
    ];

    const now = new Date();
    const reportsToCreate = [];

    for (let i = 0; i < 8; i++) {
      const status = statuses[i % 4];
      const area = areas[i % areas.length];

      const baseReportedAt = new Date(Date.now() - (7 - i) * 24 * 60 * 60 * 1000);

      const reportData: any = {
        description: [
          "Power outage in residential area due to transformer failure",
          "Scheduled maintenance outage for feeder upgrade",
          "Emergency outage due to storm damage on feeder line",
          "Planned outage for substation maintenance",
          "Cable fault causing outage in commercial district",
          "Transformer overload causing intermittent outages",
          "Vegetation contact causing line fault",
          "Equipment failure at distribution substation",
        ][i],
        areaId: areas[i % areas.length].id,
        technicianId: technician.id,
        status,
        reportedAt: new Date(Date.now() - (7 - i) * 24 * 60 * 60 * 1000),
        isPriority: i % 3 === 0,
      };

      if (status === "ASSIGNED") {
        reportData.assignedAt = new Date(reportData.reportedAt.getTime() + 2 * 60 * 60 * 1000);
      } else if (status === "IN_PROGRESS") {
        reportData.assignedAt = new Date(reportData.reportedAt.getTime() + 2 * 60 * 60 * 1000);
        reportData.inProgressAt = new Date(reportData.reportedAt.getTime() + 4 * 60 * 60 * 1000);
      } else if (status === "RESOLVED") {
        reportData.assignedAt = new Date(reportData.reportedAt.getTime() + 2 * 60 * 60 * 1000);
        reportData.inProgressAt = new Date(reportData.reportedAt.getTime() + 4 * 60 * 60 * 1000);
        reportData.resolvedAt = new Date(reportData.reportedAt.getTime() + 8 * 60 * 60 * 1000);
      }

      reportsToCreate.push(reportData);
    }

    // Get a customer for the reports
    const customer = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
    if (!customer) {
      console.log("⚠ No customer found, skipping outage reports seed");
      return;
    }

    for (const report of reportsToCreate) {
      await prisma.outageReport.create({
        data: { ...report, customerId: customer.id },
      });
    }

    console.log(`✔ Created ${reportsToCreate.length} sample outage reports for technician`);
  } catch (error) {
    console.error("✖ Error Seeding Outage Reports:", error);
  }
};

const main = async () => {
  console.log("🌱 Starting Database Seeding for PowerGridBD...\n");
  await seedSuperAdmin();
  await seedPowerOperator();
  await seedTechnician();
  await seedSlaPlans();
  await seedOutageReports();
  console.log("\n✨ Database Seeding Completed Successfully!");
};

main()
  .catch((e) => {
    console.error("✖ Critical Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });