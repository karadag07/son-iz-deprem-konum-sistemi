import { randomUUID } from "node:crypto";
import { pool, databaseConfig, checkDatabaseConnection } from "../db/postgres.js";
import { DataStore, Device, LatestLocation } from "../types.js";

interface DeviceLocationRow {
  id: number | string;
  device_id: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  battery_level: number | string | null;
  timestamp: Date | string | null;
  received_at: Date | string | null;
}

export interface ExternalLocationSyncResult {
  source: "postgres" | "demo";
  enabled: boolean;
  ok: boolean;
  tableName?: string;
  rowCount?: number;
  loadedCount?: number;
  skippedCount?: number;
  refreshedAt?: string;
  error?: string;
}

export const locationSourceNotice =
  "Panel konum verisini app.zip içindeki Spring Boot projesinin kullandığı PostgreSQL device_locations tablosundan okur. Bu tabloda rota geçmişi değil, cihaz başına son konum kaydı beklenir.";

let lastSync: ExternalLocationSyncResult = {
  source: "postgres",
  enabled: true,
  ok: false,
  tableName: databaseConfig.tableName,
  rowCount: 0,
  loadedCount: 0,
  skippedCount: 0,
  error: "Henüz veritabanı senkronizasyonu yapılmadı."
};

function isPostgresSourceEnabled(): boolean {
  return (process.env.DATA_SOURCE ?? "postgres").toLowerCase() === "postgres";
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error("LOCATION_TABLE yalnızca harf, rakam ve alt çizgi içermelidir.");
  }
  return `"${identifier}"`;
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function toNumber(value: number | string | null | undefined, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBattery(value: number | string | null | undefined): number {
  const parsed = toNumber(value, 0);
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function safeDeviceId(row: DeviceLocationRow, index: number): string {
  const raw = row.device_id;
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  return `db-device-${String(row.id ?? index).padStart(6, "0")}`;
}

function mapRowsToStore(rows: DeviceLocationRow[]): { devices: Device[]; latestLocations: LatestLocation[]; skipped: number } {
  const devices: Device[] = [];
  const latestLocations: LatestLocation[] = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const latitude = toNumber(row.latitude, Number.NaN);
    const longitude = toNumber(row.longitude, Number.NaN);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      skipped += 1;
      return;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      skipped += 1;
      return;
    }

    const sourceDeviceId = safeDeviceId(row, index);
    const internalDeviceId = `pg-${sourceDeviceId}`;
    const timestamp = toIso(row.timestamp ?? row.received_at);
    const receivedAt = toIso(row.received_at ?? row.timestamp);

    devices.push({
      id: internalDeviceId,
      anonymousDeviceId: sourceDeviceId,
      platform: "android",
      appVersion: "spring-postgres-source",
      createdAt: receivedAt,
      lastSeenAt: timestamp,
      isActive: true
    });

    latestLocations.push({
      id: `pg-location-${String(row.id ?? randomUUID())}`,
      deviceId: internalDeviceId,
      latitude,
      longitude,
      accuracy: Number(process.env.DEFAULT_LOCATION_ACCURACY_METERS ?? 50),
      batteryLevel: toBattery(row.battery_level),
      networkType: "unknown",
      locationTimestamp: timestamp,
      updatedAt: receivedAt,
      postDisasterUpdated: false
    });
  });

  return { devices, latestLocations, skipped };
}

export async function refreshExternalLocations(store: DataStore): Promise<ExternalLocationSyncResult> {
  if (!isPostgresSourceEnabled()) {
    lastSync = {
      source: "demo",
      enabled: false,
      ok: true,
      tableName: databaseConfig.tableName,
      rowCount: store.latestLocations.length,
      loadedCount: store.latestLocations.length,
      skippedCount: 0,
      refreshedAt: new Date().toISOString()
    };
    return lastSync;
  }

  try {
    const table = quoteIdentifier(databaseConfig.tableName);
    const result = await pool.query<DeviceLocationRow>(`
      select
        id,
        device_id,
        latitude,
        longitude,
        battery_level,
        timestamp,
        received_at
      from ${table}
      where latitude is not null
        and longitude is not null
      order by received_at desc nulls last, timestamp desc nulls last, id desc
      limit $1
    `, [Number(process.env.MAX_LOCATION_ROWS ?? 50_000)]);

    const mapped = mapRowsToStore(result.rows);
    store.devices = mapped.devices;
    store.latestLocations = mapped.latestLocations;

    lastSync = {
      source: "postgres",
      enabled: true,
      ok: true,
      tableName: databaseConfig.tableName,
      rowCount: result.rowCount ?? result.rows.length,
      loadedCount: mapped.latestLocations.length,
      skippedCount: mapped.skipped,
      refreshedAt: new Date().toISOString()
    };
    return lastSync;
  } catch (error) {
    lastSync = {
      source: "postgres",
      enabled: true,
      ok: false,
      tableName: databaseConfig.tableName,
      rowCount: 0,
      loadedCount: 0,
      skippedCount: 0,
      refreshedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Veritabanı okunamadı."
    };
    return lastSync;
  }
}

export function getLastExternalLocationSync(): ExternalLocationSyncResult {
  return lastSync;
}

export async function getDatabaseStatus() {
  if (!isPostgresSourceEnabled()) {
    return { ok: true, source: "demo", enabled: false, notice: "DATA_SOURCE=demo olduğu için PostgreSQL kullanılmıyor." };
  }
  try {
    const connection = await checkDatabaseConnection();
    return { ok: true, source: "postgres", enabled: true, connection, lastSync, notice: locationSourceNotice };
  } catch (error) {
    return {
      ok: false,
      source: "postgres",
      enabled: true,
      connection: {
        host: databaseConfig.host,
        port: databaseConfig.port,
        database: databaseConfig.database,
        tableName: databaseConfig.tableName
      },
      lastSync,
      error: error instanceof Error ? error.message : "Veritabanı bağlantısı kurulamadı.",
      notice: locationSourceNotice
    };
  }
}
