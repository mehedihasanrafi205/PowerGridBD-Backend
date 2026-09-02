import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";

const createZone = async (payload: { name: string; description?: string }) => {
  const isZoneExists = await prisma.zone.findUnique({
    where: { name: payload.name },
  });

  if (isZoneExists) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Zone with this name already exists",
    );
  }

  const zone = await prisma.zone.create({
    data: payload,
  });

  return zone;
};

const getAllZones = async () => {
  const zones = await prisma.zone.findMany({
    include: {
      substations: {
        include: {
          feeders: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return zones;
};

export const gridService = {
  createZone,
  getAllZones,
};
