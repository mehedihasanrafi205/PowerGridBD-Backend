import httpStatus from "http-status";
import { differenceInMinutes, format, isValid, parseISO } from "date-fns";
import { AppError } from "./AppError";

/**
 * Timezone policy: all business-time bucketing, truncation, and display
 * use SERVER-LOCAL time. Deploy the server in the business timezone
 * (Asia/Dhaka) so day/hour groupings match wall-clock expectations.
 */

/** Strictly parse user-supplied date input. Throws 400 on invalid dates. */
export const parseDateTime = (value: unknown, field = "date"): Date => {
  const date =
    value instanceof Date ? value : parseISO(String(value ?? "").trim());

  if (!isValid(date)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invalid ${field}: must be a valid ISO-8601 date-time`,
    );
  }

  return date;
};

/** Parse optional from/to query filters into a Prisma date range. */
export const parseDateRangeFilter = (
  from: unknown,
  to: unknown,
): { gte?: Date; lte?: Date } => {
  const range: { gte?: Date; lte?: Date } = {};

  if (from !== undefined && from !== "") {
    range.gte = parseDateTime(from, "from");
  }
  if (to !== undefined && to !== "") {
    range.lte = parseDateTime(to, "to");
  }

  if (range.gte && range.lte && range.gte > range.lte) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid date range: 'from' must not be after 'to'",
    );
  }

  return range;
};

/** Half-open interval overlap: [aStart, aEnd) vs [bStart, bEnd). */
export const rangesOverlap = (
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean => {
  return aStart < bEnd && bStart < aEnd;
};

export const minutesBetween = (from: Date, to: Date): number => {
  return differenceInMinutes(to, from);
};

/** Stable `YYYY-MM-DD` day key in server-local time for trend bucketing. */
export const toDayKey = (date: Date): string => format(date, "yyyy-MM-dd");

/** Locale-independent display format for emails and responses. */
export const formatDateTime = (date: Date): string =>
  format(date, "yyyy-MM-dd HH:mm");
