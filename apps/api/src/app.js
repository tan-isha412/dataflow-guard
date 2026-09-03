import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import orgsRoutes from "./modules/orgs/orgs.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import inspectionRoutes from "./modules/inspection/inspection.routes.js";
import policyRoutes from "./modules/policy/policy.routes.js";
export const app = express();
import inspectRoutes from "./modules/inspect/inspect.routes.js";
import destinationsRoutes from "./modules/destinations/destinations.routes.js";
import approvalsRoutes from "./modules/approvals/approvals.routes.js";
import auditRoutes from "./modules/audit/audit.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";

// These four MUST run before any route is mounted — a router mounted
// before express.json() sees req.body as undefined for every POST/PATCH,
// which is silent (falls through to "Required" validation errors, not an
// obvious crash) and previously left approvals/audit/destinations/inspect
// with broken write endpoints.
app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGINS.split(",") }));
app.use(express.json());
app.use(requestId);
app.use(requestLogger);

app.use(`${env.API_PREFIX}/approvals`, approvalsRoutes);
app.use(`${env.API_PREFIX}/audit`, auditRoutes);
app.use(`${env.API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${env.API_PREFIX}/destinations`, destinationsRoutes);
app.use(`${env.API_PREFIX}/inspect`, inspectRoutes);
app.use(`${env.API_PREFIX}/orgs`, orgsRoutes);
app.use(`${env.API_PREFIX}/users`, usersRoutes);
app.use(`${env.API_PREFIX}/inspection`, inspectionRoutes);
app.use(`${env.API_PREFIX}/policy`, policyRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(`${env.API_PREFIX}/auth`, authRoutes);

// Must be the LAST app.use() call — see errorHandler.js for why.
app.use(errorHandler);