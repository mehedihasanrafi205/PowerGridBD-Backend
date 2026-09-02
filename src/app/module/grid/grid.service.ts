import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";

// *zone
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
const updateZone = async (
  id: string,
  payload: { name?: string; description?: string },
) => {
  const isZoneExist = await prisma.zone.findUnique({
    where: { id },
  });

  if (!isZoneExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Zone not found");
  }

  const updatedZone = await prisma.zone.update({
    where: { id },
    data: payload,
  });

  return updatedZone;
};
const deleteZone = async (id: string) => {
  const isExist = await prisma.zone.findUnique({ where: { id } });
  if (!isExist) throw new AppError(httpStatus.NOT_FOUND, "Zone not found");

  return await prisma.zone.delete({ where: { id } });
};

// * Substation

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

const updateSubstation = async (
  id: string,
  payload: { name?: string; zoneId?: string },
) => {
  const isExist = await prisma.substation.findUnique({ where: { id } });
  if (!isExist)
    throw new AppError(httpStatus.NOT_FOUND, "Substation not found");

  if (payload.zoneId) {
    const zoneExist = await prisma.zone.findUnique({
      where: { id: payload.zoneId },
    });
    if (!zoneExist) throw new AppError(httpStatus.NOT_FOUND, "Zone not found");
  }

  return await prisma.substation.update({
    where: { id },
    data: payload,
  });
};

const deleteSubstation = async (id: string) => {
  const isExist = await prisma.substation.findUnique({ where: { id } });
  if (!isExist)
    throw new AppError(httpStatus.NOT_FOUND, "Substation not found");

  return await prisma.substation.delete({ where: { id } });
};

// * Feeder

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
      substation: {
        include: {
          zone: true,
        },
      },
      areas: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return feeders;
};

const updateFeeder = async (
  id: string,
  payload: { name?: string; substationId?: string },
) => {
  const isExist = await prisma.feeder.findUnique({ where: { id } });
  if (!isExist) throw new AppError(httpStatus.NOT_FOUND, "Feeder not found");

  if (payload.substationId) {
    const subExist = await prisma.substation.findUnique({
      where: { id: payload.substationId },
    });
    if (!subExist)
      throw new AppError(httpStatus.NOT_FOUND, "Substation not found");
  }

  return await prisma.feeder.update({
    where: { id },
    data: payload,
  });
};

const deleteFeeder = async (id: string) => {
  const isExist = await prisma.feeder.findUnique({ where: { id } });
  if (!isExist) throw new AppError(httpStatus.NOT_FOUND, "Feeder not found");

  return await prisma.feeder.delete({ where: { id } });
};

// * Area
const createArea = async (payload: { name: string; feederId: string }) => {
  const isFeederExist = await prisma.feeder.findUnique({
    where: { id: payload.feederId },
  });

  if (!isFeederExist) {
    throw new AppError(httpStatus.NOT_FOUND, "Feeder not found");
  }

  const area = await prisma.area.create({
    data: payload,
    include: {
      feeder: {
        include: {
          substation: {
            include: {
              zone: true,
            },
          },
        },
      },
    },
  });

  return area;
};

const getAllAreas = async () => {
  const areas = await prisma.area.findMany({
    include: {
      feeder: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return areas;
};

const updateArea = async (
  id: string,
  payload: { name?: string; feederId?: string },
) => {
  const isExist = await prisma.area.findUnique({ where: { id } });
  if (!isExist) throw new AppError(httpStatus.NOT_FOUND, "Area not found");

  if (payload.feederId) {
    const feederExist = await prisma.feeder.findUnique({
      where: { id: payload.feederId },
    });
    if (!feederExist)
      throw new AppError(httpStatus.NOT_FOUND, "Feeder not found");
  }

  return await prisma.area.update({
    where: { id },
    data: payload,
  });
};

const deleteArea = async (id: string) => {
  const isExist = await prisma.area.findUnique({ where: { id } });
  if (!isExist) throw new AppError(httpStatus.NOT_FOUND, "Area not found");

  return await prisma.area.delete({ where: { id } });
};

export const gridService = {
  createZone,
  getAllZones,
  updateZone,
  deleteZone,
  createSubstation,
  getAllSubstations,
  updateSubstation,
  deleteSubstation,
  createFeeder,
  getAllFeeders,
  updateFeeder,
  deleteFeeder,
  createArea,
  getAllAreas,
  updateArea,
  deleteArea,
};
