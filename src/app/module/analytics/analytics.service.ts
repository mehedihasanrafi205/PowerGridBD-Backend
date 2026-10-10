import {
  OutageStatus,
  PaymentStatus,
  PaymentType,
  ScheduleStatus,
  UserRole,
  UserStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import type { IQuery } from "../../interfaces";
import { calculatePagination, buildMeta } from "../../utils/pagination";
import { minutesBetween, toDayKey } from "../../utils/datetime";
import { addDays, getHours, startOfDay, subDays } from "date-fns";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";

const ACTIVE_OUTAGE_STATUSES: OutageStatus[] = [
  OutageStatus.PENDING,
  OutageStatus.ASSIGNED,
  OutageStatus.IN_PROGRESS,
];

const ACTIVE_SCHEDULE_STATUSES: ScheduleStatus[] = [
  ScheduleStatus.SCHEDULED,
  ScheduleStatus.ONGOING,
];

// ─── 1. Real-time operational metrics ─────────────────────────────────

const getOperationalMetrics = async () => {
  const now = new Date();

  const [
    activeOutages,
    priorityOutages,
    technicians,
    busyTechnicianIds,
    activeSchedules,
    upcomingSchedules,
    activeOutageAreas,
  ] = await Promise.all([
    prisma.outageReport.count({
      where: { status: { in: ACTIVE_OUTAGE_STATUSES } },
    }),
    prisma.outageReport.count({
      where: { status: { in: ACTIVE_OUTAGE_STATUSES }, isPriority: true },
    }),
    prisma.user.findMany({
      where: {
        role: UserRole.TECHNICIAN,
        status: UserStatus.ACTIVE,
        isDeleted: false,
      },
      select: { id: true, name: true },
    }),
    prisma.outageReport.findMany({
      where: {
        status: { in: [OutageStatus.ASSIGNED, OutageStatus.IN_PROGRESS] },
        technicianId: { not: null },
      },
      select: { technicianId: true },
      distinct: ["technicianId"],
    }),
    prisma.schedule.count({
      where: {
        status: { in: ACTIVE_SCHEDULE_STATUSES },
        startTime: { lte: now },
        endTime: { gte: now },
      },
    }),
    prisma.schedule.count({
      where: {
        status: { in: ACTIVE_SCHEDULE_STATUSES },
        startTime: { gt: now },
      },
    }),
    // Areas with at least one active outage → critical feeders
    prisma.outageReport.findMany({
      where: { status: { in: ACTIVE_OUTAGE_STATUSES } },
      select: {
        area: {
          select: {
            id: true,
            name: true,
            feeder: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  const busyIds = new Set(
    busyTechnicianIds.map((r) => r.technicianId as string),
  );
  const availableTechnicians = technicians.filter((t) => !busyIds.has(t.id));

  const feederMap = new Map<string, { feederId: string; feederName: string }>();
  for (const report of activeOutageAreas) {
    const feeder = report.area?.feeder;
    if (feeder && !feederMap.has(feeder.id)) {
      feederMap.set(feeder.id, {
        feederId: feeder.id,
        feederName: feeder.name,
      });
    }
  }

  return {
    activeOutages,
    priorityOutages,
    availableTechnicians: {
      count: availableTechnicians.length,
      technicians: availableTechnicians,
    },
    totalTechnicians: technicians.length,
    activeSchedules,
    upcomingSchedules,
    criticalFeedersDown: {
      count: feederMap.size,
      feeders: [...feederMap.values()],
    },
  };
};

// ─── 2. Performance & efficiency KPIs ─────────────────────────────────

const getPerformanceMetrics = async () => {
  const [resolved, assigned, workloadActive, workloadTotal, techUsers] =
    await Promise.all([
      prisma.outageReport.findMany({
        where: {
          status: OutageStatus.RESOLVED,
          resolvedAt: { not: null },
        },
        select: { reportedAt: true, resolvedAt: true },
      }),
      prisma.outageReport.findMany({
        where: { assignedAt: { not: null } },
        select: { createdAt: true, assignedAt: true },
      }),
      prisma.outageReport.groupBy({
        by: ["technicianId"],
        where: {
          technicianId: { not: null },
          status: { in: [OutageStatus.ASSIGNED, OutageStatus.IN_PROGRESS] },
        },
        _count: { _all: true },
      }),
      prisma.outageReport.groupBy({
        by: ["technicianId"],
        where: { technicianId: { not: null } },
        _count: { _all: true },
      }),
      prisma.user.findMany({
        where: { role: UserRole.TECHNICIAN, isDeleted: false },
        select: { id: true, name: true },
      }),
    ]);

  const mttrMinutes =
    resolved.length > 0
      ? resolved.reduce(
          (sum, r) => sum + minutesBetween(r.reportedAt, r.resolvedAt!),
          0,
        ) / resolved.length
      : 0;

  const avgAssignmentMinutes =
    assigned.length > 0
      ? assigned.reduce(
          (sum, r) => sum + minutesBetween(r.createdAt, r.assignedAt!),
          0,
        ) / assigned.length
      : 0;

  const activeByTech = new Map(
    workloadActive.map((g) => [g.technicianId as string, g._count._all]),
  );
  const totalByTech = new Map(
    workloadTotal.map((g) => [g.technicianId as string, g._count._all]),
  );
  const nameById = new Map(techUsers.map((u) => [u.id, u.name]));

  const workloadDistribution = [...totalByTech.entries()].map(
    ([technicianId, totalTasks]) => ({
      technicianId,
      technicianName: nameById.get(technicianId) ?? "Unknown",
      activeTasks: activeByTech.get(technicianId) ?? 0,
      totalTasks,
    }),
  );

  const [resolvedCount, cancelledCount] = await Promise.all([
    prisma.outageReport.count({ where: { status: OutageStatus.RESOLVED } }),
    prisma.outageReport.count({ where: { status: OutageStatus.CANCELLED } }),
  ]);
  const decided = resolvedCount + cancelledCount;
  // First-time fix rate approximated as RESOLVED / (RESOLVED + CANCELLED)
  // since reassignment history is not tracked.
  const firstTimeFixRate = decided > 0 ? resolvedCount / decided : 0;

  return {
    mttrMinutes: Math.round(mttrMinutes * 100) / 100,
    resolvedReports: resolved.length,
    avgAssignmentMinutes: Math.round(avgAssignmentMinutes * 100) / 100,
    assignedReports: assigned.length,
    workloadDistribution,
    firstTimeFixRate: Math.round(firstTimeFixRate * 10000) / 10000,
  };
};

const getTechnicianWorkload = async () => {
  const [workloadActive, workloadTotal, techUsers] = await Promise.all([
    prisma.outageReport.groupBy({
      by: ["technicianId"],
      where: {
        technicianId: { not: null },
        status: { in: [OutageStatus.ASSIGNED, OutageStatus.IN_PROGRESS] },
      },
      _count: { _all: true },
    }),
    prisma.outageReport.groupBy({
      by: ["technicianId"],
      where: { technicianId: { not: null } },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { role: UserRole.TECHNICIAN, isDeleted: false, status: UserStatus.ACTIVE },
      select: { id: true, name: true },
    }),
  ]);

  const activeByTech = new Map(
    workloadActive.map((g) => [g.technicianId as string, g._count._all]),
  );
  const totalByTech = new Map(
    workloadTotal.map((g) => [g.technicianId as string, g._count._all]),
  );
  const nameById = new Map(techUsers.map((u) => [u.id, u.name]));

  // Get resolved and cancelled counts per technician for fix rate
  const resolvedByTech = await prisma.outageReport.groupBy({
    by: ["technicianId"],
    where: { technicianId: { not: null }, status: OutageStatus.RESOLVED },
    _count: { _all: true },
  });
  const cancelledByTech = await prisma.outageReport.groupBy({
    by: ["technicianId"],
    where: { technicianId: { not: null }, status: OutageStatus.CANCELLED },
    _count: { _all: true },
  });
  const resolvedMap = new Map(resolvedByTech.map((g) => [g.technicianId as string, g._count._all]));
  const cancelledMap = new Map(cancelledByTech.map((g) => [g.technicianId as string, g._count._all]));

  // Get average resolution time per technician
  const resolvedReports = await prisma.outageReport.findMany({
    where: {
      technicianId: { not: null },
      status: OutageStatus.RESOLVED,
      resolvedAt: { not: null },
      assignedAt: { not: null },
    },
    select: { technicianId: true, assignedAt: true, resolvedAt: true },
  });
  const resolutionMinutesByTech = new Map<string, number[]>();
  for (const r of resolvedReports) {
    if (r.technicianId && r.assignedAt && r.resolvedAt) {
      const minutes = minutesBetween(r.assignedAt, r.resolvedAt);
      const arr = resolutionMinutesByTech.get(r.technicianId) ?? [];
      arr.push(minutes);
      resolutionMinutesByTech.set(r.technicianId, arr);
    }
  }

  const technicianWorkload = techUsers.map((tech) => {
    const assignedCount = totalByTech.get(tech.id) ?? 0;
    const activeCount = activeByTech.get(tech.id) ?? 0;
    const resolvedCount = resolvedMap.get(tech.id) ?? 0;
    const cancelledCount = cancelledMap.get(tech.id) ?? 0;
    const decided = resolvedCount + cancelledCount;
    const firstTimeFixRate = decided > 0 ? resolvedCount / decided : 0;

    const resolutionMinutes = resolutionMinutesByTech.get(tech.id) ?? [];
    const avgResolutionMinutes =
      resolutionMinutes.length > 0
        ? resolutionMinutes.reduce((sum, m) => sum + m, 0) / resolutionMinutes.length
        : 0;

    return {
      technicianId: tech.id,
      technicianName: tech.name,
      assignedCount,
      resolvedCount,
      avgResolutionTime: Math.round((avgResolutionMinutes / 60) * 100) / 100,
      firstTimeFixRate: Math.round(firstTimeFixRate * 10000) / 10000,
    };
  });

  return { technicianWorkload };
};

// ─── 3. Geographical & zonal analytics ────────────────────────────────

const getGeographicalAnalytics = async () => {
  const areas = await prisma.area.findMany({
    select: {
      id: true,
      name: true,
      feeder: {
        select: {
          id: true,
          name: true,
          substation: { select: { id: true, name: true, zone: true } },
        },
      },
      _count: {
        select: {
          outageReports: true,
        },
      },
    },
  });

  const [activeByArea, worstFeeders] = await Promise.all([
    prisma.outageReport.groupBy({
      by: ["areaId"],
      where: { status: { in: ACTIVE_OUTAGE_STATUSES } },
      _count: { _all: true },
    }),
    prisma.area.findMany({
      select: {
        id: true,
        name: true,
        feeder: { select: { id: true, name: true } },
        _count: { select: { outageReports: true } },
      },
      orderBy: { outageReports: { _count: "desc" } },
      take: 10,
    }),
  ]);

  const activeByAreaId = new Map(
    activeByArea.map((g) => [g.areaId, g._count._all]),
  );

  const byArea = areas.map((a) => ({
    areaId: a.id,
    areaName: a.name,
    feederId: a.feeder.id,
    feederName: a.feeder.name,
    totalOutages: a._count.outageReports,
    activeOutages: activeByAreaId.get(a.id) ?? 0,
  }));

  const zoneMap = new Map<
    string,
    { zoneId: string; zoneName: string; totalOutages: number }
  >();
  for (const a of areas) {
    const zone = a.feeder.substation.zone;
    const entry = zoneMap.get(zone.id) ?? {
      zoneId: zone.id,
      zoneName: zone.name,
      totalOutages: 0,
    };
    entry.totalOutages += a._count.outageReports;
    zoneMap.set(zone.id, entry);
  }

  return {
    byArea,
    byZone: [...zoneMap.values()].sort(
      (x, y) => y.totalOutages - x.totalOutages,
    ),
    worstFeeders: worstFeeders.map((a) => ({
      feederId: a.feeder.id,
      feederName: a.feeder.name,
      areaId: a.id,
      areaName: a.name,
      outageCount: a._count.outageReports,
    })),
  };
};

// ─── 4. Financial & payment analytics ─────────────────────────────────

const getFinancialAnalytics = async () => {
  const [revenue, revenueByType, statusGroups, activeSubscriptions] =
    await Promise.all([
      prisma.payment.aggregate({
        where: { status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      }),
      prisma.payment.groupBy({
        by: ["type"],
        where: { status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.user.count({
        where: {
          slaActive: true,
          slaExpiryDate: { gt: new Date() },
        },
      }),
    ]);

  const countsByStatus: Record<string, number> = {};
  let totalPayments = 0;
  for (const g of statusGroups) {
    countsByStatus[g.status] = g._count._all;
    totalPayments += g._count._all;
  }
  const completed = countsByStatus[PaymentStatus.COMPLETED] ?? 0;

  return {
    totalRevenue: revenue._sum.amount ?? 0,
    revenueByType: revenueByType.map((g) => ({
      type: g.type as PaymentType,
      revenue: g._sum.amount ?? 0,
      payments: g._count._all,
    })),
    paymentSuccessRate:
      totalPayments > 0
        ? Math.round((completed / totalPayments) * 10000) / 10000
        : 0,
    paymentsByStatus: countsByStatus,
    totalPayments,
    activeSubscriptions,
  };
};

// ─── 5. Historical trends & reporting ─────────────────────────────────

const getTrendsAnalytics = async (days = 30) => {
  // Server-local day boundaries (see timezone policy in utils/datetime.ts).
  const since = startOfDay(subDays(new Date(), days - 1));

  const [reports, schedules] = await Promise.all([
    prisma.outageReport.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.schedule.findMany({
      where: { startTime: { gte: since } },
      select: { startTime: true },
    }),
  ]);

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    buckets.set(toDayKey(addDays(since, i)), 0);
  }
  for (const r of reports) {
    const key = toDayKey(r.createdAt);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const hourly = new Array<number>(24).fill(0);
  for (const s of schedules) {
    hourly[getHours(s.startTime)] += 1;
  }

  return {
    days,
    outageTrend: [...buckets.entries()].map(([date, count]) => ({
      date,
      count,
    })),
    complaintVolume: [...buckets.entries()].map(([date, count]) => ({
      date,
      count,
    })),
    peakSheddingHours: hourly.map((count, hour) => ({ hour, count })),
  };
};

// ─── Role-scoped summaries ────────────────────────────────────────────

const getCustomerSummary = async (userId: string) => {
  const [byStatus, priorityCount, paid] = await Promise.all([
    prisma.outageReport.groupBy({
      by: ["status"],
      where: { customerId: userId },
      _count: { _all: true },
    }),
    prisma.outageReport.count({
      where: { customerId: userId, isPriority: true },
    }),
    prisma.payment.aggregate({
      where: { userId, status: PaymentStatus.COMPLETED },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const reportsByStatus: Record<string, number> = {};
  let totalReports = 0;
  for (const g of byStatus) {
    reportsByStatus[g.status] = g._count._all;
    totalReports += g._count._all;
  }

  return {
    totalReports,
    reportsByStatus,
    priorityReports: priorityCount,
    totalPaid: paid._sum.amount ?? 0,
    completedPayments: paid._count._all,
  };
};

const getTechnicianSummary = async (userId: string) => {
  const [counts, resolved] = await Promise.all([
    prisma.outageReport.groupBy({
      by: ["status"],
      where: { technicianId: userId },
      _count: { _all: true },
    }),
    prisma.outageReport.findMany({
      where: {
        technicianId: userId,
        status: OutageStatus.RESOLVED,
        resolvedAt: { not: null },
        assignedAt: { not: null },
      },
      select: { assignedAt: true, resolvedAt: true },
    }),
  ]);

  const tasksByStatus: Record<string, number> = {};
  let totalTasks = 0;
  for (const g of counts) {
    tasksByStatus[g.status] = g._count._all;
    totalTasks += g._count._all;
  }

  const avgResolutionMinutes =
    resolved.length > 0
      ? resolved.reduce(
          (sum, r) => sum + minutesBetween(r.assignedAt!, r.resolvedAt!),
          0,
        ) / resolved.length
      : 0;

  // Calculate first-time fix rate
  const [resolvedCount, cancelledCount] = await Promise.all([
    prisma.outageReport.count({
      where: { technicianId: userId, status: OutageStatus.RESOLVED },
    }),
    prisma.outageReport.count({
      where: { technicianId: userId, status: OutageStatus.CANCELLED },
    }),
  ]);
  const decided = resolvedCount + cancelledCount;
  const firstTimeFixRate = decided > 0 ? resolvedCount / decided : 0;

  // Map backend statuses to frontend expected fields
  const assignedCount = tasksByStatus[OutageStatus.ASSIGNED] ?? 0;
  const ongoingCount = tasksByStatus[OutageStatus.IN_PROGRESS] ?? 0;
  const resolvedCountFromStatus = tasksByStatus[OutageStatus.RESOLVED] ?? 0;

  return {
    assignedCount,
    ongoingCount,
    resolvedCount: resolvedCountFromStatus,
    avgResolutionTime: Math.round((avgResolutionMinutes / 60) * 100) / 100,
    firstTimeFixRate: Math.round(firstTimeFixRate * 10000) / 10000,
  };
};

// ─── 6. Audit & compliance logs ───────────────────────────────────────

const getAuditLogs = async (query: IQuery = {}) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query, {
    sortBy: "createdAt",
  });

  const andConditions: any[] = [];
  if (query.entity) {
    andConditions.push({ entity: String(query.entity) });
  }
  if (query.action) {
    andConditions.push({
      action: { contains: String(query.action), mode: "insensitive" },
    });
  }
  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data: logs, meta: buildMeta(total, page, limit) };
};

  const getSlaPlans = async () => {
  const plans = await prisma.slaPlan.findMany({
    where: { isActive: true },
    orderBy: { tier: "asc" },
  });

  return plans.map((plan) => {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      tier: plan.tier,
      price: Number(plan.price),
      durationDays: plan.durationDays,
      features: plan.features,
      isActive: plan.isActive,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  });
};

const getSlaPlanById = async (planId: string) => {
  const plan = await prisma.slaPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new AppError(httpStatus.NOT_FOUND, "SLA plan not found");
  }

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    tier: plan.tier,
    price: Number(plan.price),
    durationDays: plan.durationDays,
    features: plan.features,
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
};

const subscribeToSla = async (
  userId: string,
  planId: string,
) => {
  const plan = await prisma.slaPlan.findUnique({
    where: { id: planId, isActive: true },
  });

  if (!plan) {
    throw new AppError(httpStatus.NOT_FOUND, "SLA plan not found or inactive");
  }

  // Check if user already has an active subscription
  const existingSubscription = await prisma.slaSubscription.findUnique({
    where: { userId },
  });

  if (existingSubscription?.isActive) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You already have an active SLA subscription. Please wait for it to expire or contact support.",
    );
  }

  // Import payment service to avoid circular dependency
  const { paymentService } = await import("../payment/payment.service.js");
  const { PaymentType } = await import("../../../generated/prisma/enums.js");

  // Initiate payment via SSLCommerz
  const paymentResult = await paymentService.initiatePayment(userId, {
    amount: Number(plan.price),
    currency: "BDT",
    paymentType: PaymentType.SLA_SUBSCRIPTION,
    planId: plan.id,
  });

  return {
    paymentUrl: paymentResult.gatewayUrl,
    transactionId: paymentResult.transactionId,
    plan: {
      id: plan.id,
      name: plan.name,
      tier: plan.tier,
      price: Number(plan.price),
      durationDays: plan.durationDays,
    },
  };
};

const getMySlaSubscription = async (userId: string) => {
  const subscription = await prisma.slaSubscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (!subscription || !subscription.isActive) {
    return null;
  }

  return {
    id: subscription.id,
    userId: subscription.userId,
    planId: subscription.planId,
    startDate: subscription.startDate.toISOString(),
    endDate: subscription.endDate.toISOString(),
    isActive: subscription.isActive,
    paymentId: subscription.paymentId,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
    plan: {
      id: subscription.plan.id,
      name: subscription.plan.name,
      tier: subscription.plan.tier,
      price: Number(subscription.plan.price),
      durationDays: subscription.plan.durationDays,
    },
  };
};

export const analyticsService = {
  getOperationalMetrics,
  getPerformanceMetrics,
  getTechnicianWorkload,
  getGeographicalAnalytics,
  getFinancialAnalytics,
  getTrendsAnalytics,
  getCustomerSummary,
  getTechnicianSummary,
  getSlaPlans,
  getSlaPlanById,
  subscribeToSla,
  getMySlaSubscription,
  getAuditLogs,
}
