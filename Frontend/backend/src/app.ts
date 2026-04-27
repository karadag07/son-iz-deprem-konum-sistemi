import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { store } from "./data/demoData.js";
import { authRequired, auditAction, requireRoles, signAdminToken, AuthRequest } from "./middleware/auth.js";
import { calculateNetworkStatus, dashboardFor, networkNotice, runAnalysis } from "./services/analysis.js";
import { haversineMeters } from "./services/geo.js";
import { getDatabaseStatus, getLastExternalLocationSync, refreshExternalLocations } from "./services/locationSource.js";
import { DamageLevel, DisasterEvent } from "./types.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.RATE_LIMIT_MAX ?? 300)
}));

async function refreshLocationsOrFail(res: express.Response): Promise<boolean> {
  const sync = await refreshExternalLocations(store);
  if (!sync.ok) {
    res.status(503).json({
      message: "PostgreSQL konum verisi okunamadı. app.zip içindeki Spring Boot veritabanı ayarlarını ve device_locations tablosunu kontrol edin.",
      sync
    });
    return false;
  }
  return true;
}

app.get("/health", async (_req, res) => {
  const database = await getDatabaseStatus();
  res.status(database.ok ? 200 : 503).json({
    ok: database.ok,
    service: "afet-konum-kasasi-panel-backend",
    mode: "panel-postgres-source",
    database
  });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
app.post("/api/admin/auth/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Geçersiz giriş verisi.", errors: parsed.error.flatten() });
  const admin = store.admins.find((item) => item.email.toLowerCase() === parsed.data.email.toLowerCase() && item.isActive);
  if (!admin || !bcrypt.compareSync(parsed.data.password, admin.passwordHash)) {
    store.auditLogs.unshift({
      id: randomUUID(),
      adminEmail: parsed.data.email,
      actionType: "LOGIN_FAILED",
      resourceType: "AUTH",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { reason: "invalid_credentials" },
      createdAt: new Date().toISOString()
    });
    return res.status(401).json({ message: "E-posta veya şifre hatalı." });
  }
  const token = signAdminToken(admin);
  const { passwordHash, ...safeAdmin } = admin;
  store.auditLogs.unshift({
    id: randomUUID(),
    adminUserId: admin.id,
    adminEmail: admin.email,
    actionType: "LOGIN_SUCCESS",
    resourceType: "AUTH",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    createdAt: new Date().toISOString()
  });
  return res.json({ token, admin: safeAdmin });
});

app.get("/api/admin/auth/me", authRequired, (req: AuthRequest, res) => {
  res.json({ admin: req.admin });
});

app.use("/api/admin", authRequired);

app.get("/api/admin/database/status", async (req: AuthRequest, res) => {
  const database = await getDatabaseStatus();
  auditAction("DATABASE_STATUS_VIEW", "DATABASE")(req);
  res.status(database.ok ? 200 : 503).json(database);
});

app.post("/api/admin/database/refresh", requireRoles(["SUPER_ADMIN", "OPERATION_ADMIN"]), async (req: AuthRequest, res) => {
  const sync = await refreshExternalLocations(store);
  auditAction("DATABASE_REFRESH", "DATABASE", undefined, sync)(req);
  res.status(sync.ok ? 200 : 503).json({ sync });
});

app.get("/api/admin/disasters", (req: AuthRequest, res) => {
  auditAction("DISASTER_LIST_VIEW", "DISASTER")(req);
  res.json({ disasters: store.disasterEvents });
});

const createDisasterSchema = z.object({
  title: z.string().min(3),
  disasterType: z.string().default("EARTHQUAKE"),
  eventTime: z.string().datetime(),
  centerLatitude: z.number(),
  centerLongitude: z.number(),
  radiusMeters: z.number().min(100).max(100_000)
});

app.post("/api/admin/disasters", requireRoles(["SUPER_ADMIN", "OPERATION_ADMIN"]), (req: AuthRequest, res) => {
  const parsed = createDisasterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Geçersiz afet olayı verisi.", errors: parsed.error.flatten() });
  const event: DisasterEvent = {
    id: randomUUID(),
    title: parsed.data.title,
    disasterType: parsed.data.disasterType,
    eventTime: parsed.data.eventTime,
    centerLatitude: parsed.data.centerLatitude,
    centerLongitude: parsed.data.centerLongitude,
    radiusMeters: parsed.data.radiusMeters,
    status: "ACTIVE",
    networkStatus: "UNKNOWN",
    analysisMode: "PRE_DISASTER_ONLY_ANALYSIS",
    createdBy: req.admin?.id ?? "unknown",
    createdAt: new Date().toISOString()
  };
  store.disasterEvents.unshift(event);
  auditAction("DISASTER_CREATED", "DISASTER", event.id)(req);
  res.status(201).json({ disaster: event });
});

app.get("/api/admin/disasters/:id", (req: AuthRequest, res) => {
  const disaster = store.disasterEvents.find((event) => event.id === req.params.id);
  if (!disaster) return res.status(404).json({ message: "Afet olayı bulunamadı." });
  auditAction("DISASTER_VIEW", "DISASTER", disaster.id)(req);
  res.json({ disaster });
});

app.post("/api/admin/disasters/:id/analyze", requireRoles(["SUPER_ADMIN", "OPERATION_ADMIN"]), async (req: AuthRequest, res) => {
  try {
    if (!(await refreshLocationsOrFail(res))) return;
    const result = runAnalysis(store, req.params.id);
    auditAction("DISASTER_ANALYZED", "DISASTER", req.params.id, result)(req);
    res.json({ result });
  } catch (error) {
    res.status(404).json({ message: error instanceof Error ? error.message : "Analiz çalıştırılamadı." });
  }
});

app.get("/api/admin/disasters/:id/dashboard", async (req: AuthRequest, res) => {
  try {
    if (!(await refreshLocationsOrFail(res))) return;
    auditAction("DASHBOARD_VIEW", "DISASTER", req.params.id)(req);
    res.json({ ...dashboardFor(store, req.params.id), locationSync: getLastExternalLocationSync() });
  } catch (error) {
    res.status(404).json({ message: error instanceof Error ? error.message : "Dashboard oluşturulamadı." });
  }
});

app.get("/api/admin/disasters/:id/network-status", async (req: AuthRequest, res) => {
  if (!(await refreshLocationsOrFail(res))) return;
  const disaster = store.disasterEvents.find((event) => event.id === req.params.id);
  if (!disaster) return res.status(404).json({ message: "Afet olayı bulunamadı." });
  auditAction("NETWORK_STATUS_VIEW", "DISASTER", disaster.id)(req);
  res.json({ network: calculateNetworkStatus(store, disaster), notice: networkNotice });
});

app.get("/api/admin/disasters/:id/priority-areas", (req: AuthRequest, res) => {
  const areas = store.searchPriorityAreas.filter((area) => area.disasterEventId === req.params.id).sort((a, b) => b.priorityScore - a.priorityScore);
  auditAction("PRIORITY_AREAS_VIEW", "DISASTER", req.params.id)(req);
  res.json({ priorityAreas: areas });
});

app.get("/api/admin/disasters/:id/map-data", async (req: AuthRequest, res) => {
  if (!(await refreshLocationsOrFail(res))) return;
  const disaster = store.disasterEvents.find((event) => event.id === req.params.id);
  if (!disaster) return res.status(404).json({ message: "Afet olayı bulunamadı." });
  const includeOutside = req.query.includeOutside === "true";
  const eventTime = new Date(disaster.eventTime);
  const devices = store.latestLocations
    .map((location) => {
      const insideArea = haversineMeters(disaster.centerLatitude, disaster.centerLongitude, location.latitude, location.longitude) <= disaster.radiusMeters;
      const postUpdated = insideArea && new Date(location.locationTimestamp) > eventTime;
      return {
        id: location.deviceId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        batteryLevel: location.batteryLevel,
        networkType: location.networkType,
        lastLocationTime: location.locationTimestamp,
        status: !insideArea ? "OUTSIDE_AREA" : postUpdated ? "POST_DISASTER_UPDATED" : "NOT_UPDATED"
      };
    })
    .filter((device) => includeOutside || device.status !== "OUTSIDE_AREA");
  const debrisReports = store.debrisReports.filter((report) => report.disasterEventId === disaster.id);
  const priorityAreas = store.searchPriorityAreas.filter((area) => area.disasterEventId === disaster.id);
  auditAction("MAP_DATA_VIEW", "DISASTER", disaster.id)(req);
  res.json({ disasterArea: disaster, devices, debrisReports, priorityAreas, locationSync: getLastExternalLocationSync() });
});


app.post("/api/admin/disasters/:id/request-device-update", requireRoles(["SUPER_ADMIN", "OPERATION_ADMIN"]), async (req: AuthRequest, res) => {
  if (!(await refreshLocationsOrFail(res))) return;
  const disaster = store.disasterEvents.find((event) => event.id === req.params.id);
  if (!disaster) return res.status(404).json({ message: "Afet olayı bulunamadı." });

  const now = new Date();
  const targetLocations = store.latestLocations.filter((location) =>
    haversineMeters(disaster.centerLatitude, disaster.centerLongitude, location.latitude, location.longitude) <= disaster.radiusMeters
  );

  // Gerçek mobil push altyapısı henüz yoktur.
  // Bu endpoint sadece seçili afet bölgesindeki cihazlara yönelik operasyon talebini kaydeder.
  // PostgreSQL verisi değiştirilmez; yeni veri gelirse Spring Boot uygulamasının device_locations tablosuna yazması beklenir.

  const request = {
    id: randomUUID(),
    disasterEventId: disaster.id,
    requestedBy: req.admin?.id ?? "unknown",
    requestedAt: now.toISOString(),
    targetDeviceCount: targetLocations.length,
    responseCount: 0,
    noResponseCount: targetLocations.length,
    note: "Mobil push altyapısı henüz olmadığı için panel yeni veri üretmedi. Yeni cevaplar ancak mobil/Spring Boot uygulaması PostgreSQL device_locations tablosunu güncellerse görünür."
  };

  store.deviceUpdateRequests.unshift(request);
  const network = calculateNetworkStatus(store, disaster);
  auditAction("DEVICE_UPDATE_REQUESTED", "DISASTER", disaster.id, request)(req);

  res.json({
    request,
    network,
    message: `${targetLocations.length} cihazdan anlık durum güncellemesi istendi. Mobil push henüz olmadığı için panel yeni veri üretmedi; yeni cevaplar device_locations tablosu güncellenirse görünür.`
  });
});

app.post("/api/admin/disasters/:id/close", requireRoles(["SUPER_ADMIN", "OPERATION_ADMIN"]), (req: AuthRequest, res) => {
  const disaster = store.disasterEvents.find((event) => event.id === req.params.id);
  if (!disaster) return res.status(404).json({ message: "Afet olayı bulunamadı." });
  disaster.status = "CLOSED";
  disaster.closedAt = new Date().toISOString();
  auditAction("DISASTER_CLOSED", "DISASTER", disaster.id)(req);
  res.json({ disaster });
});

const debrisSchema = z.object({
  title: z.string().min(2),
  description: z.string().default(""),
  latitude: z.number(),
  longitude: z.number(),
  radiusMeters: z.number().min(20).max(1000),
  buildingName: z.string().default(""),
  street: z.string().default(""),
  neighborhood: z.string().default(""),
  damageLevel: z.enum(["LOW", "MEDIUM", "HIGH", "COLLAPSED", "UNKNOWN"])
});

app.get("/api/admin/disasters/:id/debris-reports", (req: AuthRequest, res) => {
  const debrisReports = store.debrisReports.filter((report) => report.disasterEventId === req.params.id);
  auditAction("DEBRIS_REPORTS_VIEW", "DISASTER", req.params.id)(req);
  res.json({ debrisReports });
});

app.post("/api/admin/disasters/:id/debris-reports", requireRoles(["SUPER_ADMIN", "OPERATION_ADMIN"]), (req: AuthRequest, res) => {
  const disaster = store.disasterEvents.find((event) => event.id === req.params.id);
  if (!disaster) return res.status(404).json({ message: "Afet olayı bulunamadı." });
  const parsed = debrisSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Geçersiz enkaz/hasar verisi.", errors: parsed.error.flatten() });
  const report = {
    id: randomUUID(),
    disasterEventId: disaster.id,
    title: parsed.data.title,
    description: parsed.data.description,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    radiusMeters: parsed.data.radiusMeters,
    buildingName: parsed.data.buildingName,
    street: parsed.data.street,
    neighborhood: parsed.data.neighborhood,
    damageLevel: parsed.data.damageLevel as DamageLevel,
    reportedBy: req.admin?.id ?? "unknown",
    createdAt: new Date().toISOString()
  };
  store.debrisReports.unshift(report);
  auditAction("DEBRIS_REPORT_CREATED", "DEBRIS_REPORT", report.id)(req);
  res.status(201).json({ debrisReport: report });
});

app.get("/api/admin/audit-logs", requireRoles(["SUPER_ADMIN", "OPERATION_ADMIN", "VIEWER"]), (req: AuthRequest, res) => {
  auditAction("AUDIT_LOGS_VIEW", "AUDIT_LOG")(req);
  res.json({ auditLogs: store.auditLogs.slice(0, 300) });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Beklenmeyen sunucu hatası." });
});

export default app;
