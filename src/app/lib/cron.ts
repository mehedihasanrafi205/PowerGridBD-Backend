import { prisma } from "./prisma";
import { sendTemplatedEmail } from "../utils/notify";
import { logAudit } from "../utils/audit";
import { applicationService } from "../module/application/application.service";

const HOUR_MS = 60 * 60 * 1000;
const WARNING_WINDOW_MS = 7 * 24 * HOUR_MS;

const warnExpiringSlaSubscriptions = async () => {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + WARNING_WINDOW_MS);

  const expiring = await prisma.user.findMany({
    where: {
      slaActive: true,
      slaExpiryDate: { gt: now, lte: windowEnd },
      OR: [
        { slaWarningSentAt: null },
        { slaWarningSentAt: { lt: new Date(now.getTime() - WARNING_WINDOW_MS) } },
      ],
    },
    select: { id: true, name: true, email: true, slaExpiryDate: true },
  });

  for (const user of expiring) {
    if (!user.slaExpiryDate) continue;
    await sendTemplatedEmail(
      user.email,
      "Your SLA Subscription Expires Soon - PowerGridBD",
      "sla-status.ejs",
      {
        name: user.name,
        kind: "expiring",
        expiryDate: user.slaExpiryDate.toLocaleString(),
      },
    );
    await prisma.user.update({
      where: { id: user.id },
      data: { slaWarningSentAt: new Date() },
    });
  }

  if (expiring.length > 0) {
    console.log(`[cron] sent ${expiring.length} SLA expiry warning(s)`);
  }
};

const deactivateExpiredSlaSubscriptions = async () => {
  const now = new Date();

  const expired = await prisma.user.findMany({
    where: { slaActive: true, slaExpiryDate: { lte: now } },
    select: { id: true },
  });

  for (const user of expired) {
    await prisma.user.update({
      where: { id: user.id },
      data: { slaActive: false },
    });
    await logAudit({
      action: "SLA_EXPIRED",
      entity: "User",
      entityId: user.id,
      metadata: { expiredAt: now.toISOString() },
    });
  }

  if (expired.length > 0) {
    console.log(`[cron] deactivated ${expired.length} expired SLA subscription(s)`);
  }
};

export const startCronJobs = () => {
  const run = async () => {
    try {
      await warnExpiringSlaSubscriptions();
      await deactivateExpiredSlaSubscriptions();
      await applicationService.purgeUnverifiedApplications(1);
    } catch (error) {
      console.error("[cron] scheduled job failed:", error);
    }
  };

  // Run once shortly after boot, then hourly.
  setTimeout(run, 60 * 1000);
  setInterval(run, HOUR_MS);
};
