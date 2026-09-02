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

const createSubstation = async (payload: { name: string; zoneId: string }) => {
  const isZoneExist = await prisma.zone.findUnique({
    where: { id: payload.zoneId },
  });

  if (!isZoneExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Zone not found");
  }

  const substation = await prisma.substation.create({
    data: payload,
    include: {
      zone: true,
    },
  });

  return substation;
};

const getAllSubstations = async () => {
  const substations = await prisma.substation.findMany({
    include: {
      zone: true,
      feeders: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return substations;
};

const createFeeder = async (payload: {
  name: string;
  substationId: string;
}) => {
  const isSubstationExist = await prisma.substation.findUnique({
    where: { id: payload.substationId },
  });

  if (!isSubstationExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Substation not found");
  }

  const feeder = await prisma.feeder.create({
    data: payload,
    include: {
      substation: {
        include: {
          zone: true,
        },
      },
    },
  });

  return feeder;
};

const getAllFeeders = async () => {
  const feeders = await prisma.feeder.findMany({
    include: {
      substation: true,
      areas: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return feeders;
};

export const gridService = {
  createZone,
  getAllZones,
  createSubstation,
  getAllSubstations,
  createFeeder,
  getAllFeeders,
};
