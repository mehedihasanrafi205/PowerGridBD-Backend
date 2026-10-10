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
import { ScheduleRoutes } from "./app/module/schedule/schedule.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { AnalyticsRoutes } from "./app/module/analytics/analytics.route";
import { ApplicationRoutes } from "./app/module/application/application.route";

const app: Application = express();

// CORS configuration with support for multiple origins
const allowedOrigins = [
  config.frontend_url, // Production frontend (e.g., https://powergridbd.vercel.app)
  "http://localhost:3000", // Local development
  "http://localhost:3001", // Alternative local port
].filter(Boolean);

// Regex to match Vercel preview deployments (e.g., powergridbd-git-main-username.vercel.app)
const vercelPreviewRegex = /^https:\/\/powergridbd-.*\.vercel\.app$/;

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check exact matches
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check Vercel preview deployments
    if (vercelPreviewRegex.test(origin)) {
      return callback(null, true);
    }
    
    // Reject other origins
    callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

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
app.use("/api/v1/schedule", ScheduleRoutes);
app.use("/api/v1/payment", PaymentRoutes);
app.use("/api/v1/analytics", AnalyticsRoutes);
app.use("/api/v1/applications", ApplicationRoutes);

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
