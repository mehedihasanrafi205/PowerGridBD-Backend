import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { requestLogger } from "./app/middleware/requestLogger";
import { UserRoutes } from "./app/module/user/user.route";
import { GridRoutes } from "./app/module/grid/grid.route";
import { OutageRoutes } from "./app/module/outage/outage.route";

const app: Application = express();

app.use(
  cors({
    origin: config.frontend_url,
    credentials: true,
  }),
);

app.use(requestLogger);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UserRoutes);
app.use("/api/v1/grid", GridRoutes);
app.use("/api/v1/outage", OutageRoutes);

// Basic route
app.get("/", async (req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "Welcome to PowerGridBD Backend API Services",
  });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
