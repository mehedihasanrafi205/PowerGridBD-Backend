import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import type { IQuery } from "../../interfaces";
import { calculatePagination, buildMeta } from "../../utils/pagination";
import type {
  ICreateAreaPayload,
  ICreateFeederPayload,
  ICreateSubstationPayload,
  ICreateZonePayload,
  IUpdateAreaPayload,
  IUpdateFeederPayload,
  IUpdateSubstationPayload,
  IUpdateZonePayload,
} from "./grid.interface";

// *zone
const createZone = async (payload: ICreateZonePayload) => {
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

const getAllZones = async (query: IQuery = {}) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query);

  const where =
    query.searchTerm && String(query.searchTerm).length > 0
      ? { name: { contains: String(query.searchTerm), mode: "insensitive" as const } }
      : {};

  const [zones, total] = await Promise.all([
    prisma.zone.findMany({
      where,
      include: {
        substations: {
          include: {
            feeders: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.zone.count({ where }),
  ]);

  return { data: zones, meta: buildMeta(total, page, limit) };
};
const updateZone = async (id: string, payload: IUpdateZonePayload) => {
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

const createSubstation = async (payload: ICreateSubstationPayload) => {
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
const getAllSubstations = async (query: IQuery = {}) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query);

  const andConditions: any[] = [];
  if (query.searchTerm && String(query.searchTerm).length > 0) {
    andConditions.push({
      name: { contains: String(query.searchTerm), mode: "insensitive" },
    });
  }
  if (query.zoneId) {
    andConditions.push({ zoneId: String(query.zoneId) });
  }
  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  const [substations, total] = await Promise.all([
    prisma.substation.findMany({
      where,
      include: {
        zone: true,
        feeders: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.substation.count({ where }),
  ]);

  return { data: substations, meta: buildMeta(total, page, limit) };
};

const updateSubstation = async (
  id: string,
  payload: IUpdateSubstationPayload,
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

const createFeeder = async (payload: ICreateFeederPayload) => {
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

const getAllFeeders = async (query: IQuery = {}) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query);

  const andConditions: any[] = [];
  if (query.searchTerm && String(query.searchTerm).length > 0) {
    andConditions.push({
      name: { contains: String(query.searchTerm), mode: "insensitive" },
    });
  }
  if (query.substationId) {
    andConditions.push({ substationId: String(query.substationId) });
  }
  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  const [feeders, total] = await Promise.all([
    prisma.feeder.findMany({
      where,
      include: {
        substation: {
          include: {
            zone: true,
          },
        },
        areas: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.feeder.count({ where }),
  ]);

  return { data: feeders, meta: buildMeta(total, page, limit) };
};

const updateFeeder = async (id: string, payload: IUpdateFeederPayload) => {
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
const createArea = async (payload: ICreateAreaPayload) => {
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

const getAllAreas = async (query: IQuery = {}) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query);

  const andConditions: any[] = [];
  if (query.searchTerm && String(query.searchTerm).length > 0) {
    andConditions.push({
      name: { contains: String(query.searchTerm), mode: "insensitive" },
    });
  }
  if (query.feederId) {
    andConditions.push({ feederId: String(query.feederId) });
  }
  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  const [areas, total] = await Promise.all([
    prisma.area.findMany({
      where,
      include: {
        feeder: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.area.count({ where }),
  ]);

  return { data: areas, meta: buildMeta(total, page, limit) };
};

const updateArea = async (id: string, payload: IUpdateAreaPayload) => {
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
