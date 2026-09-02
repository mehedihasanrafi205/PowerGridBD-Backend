import type { Request, Response, NextFunction } from "express";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toLocaleTimeString();
  const method = req.method;
  const path = req.originalUrl || req.url;

  let methodColor = colors.green;
  if (method === "POST") methodColor = colors.yellow;
  if (method === "PUT" || method === "PATCH") methodColor = colors.cyan;
  if (method === "DELETE") methodColor = "\x1b[31m"; // Red

  console.log(
    `${colors.magenta}[${timestamp}]${colors.reset} ${methodColor}${method}${colors.reset} --> ${colors.cyan}${path}${colors.reset}`
  );

  next();
};