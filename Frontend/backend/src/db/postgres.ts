import { Pool } from "pg";

export const databaseConfig = {
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? "postgres",
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD ?? "1",
  tableName: process.env.LOCATION_TABLE ?? "device_locations",
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false
};

export const pool = new Pool({
  host: databaseConfig.host,
  port: databaseConfig.port,
  database: databaseConfig.database,
  user: databaseConfig.user,
  password: databaseConfig.password,
  ssl: databaseConfig.ssl,
  max: Number(process.env.PGPOOL_MAX ?? 8),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

export async function checkDatabaseConnection() {
  const started = Date.now();
  const result = await pool.query("select now() as now");
  return {
    ok: true,
    latencyMs: Date.now() - started,
    now: result.rows[0]?.now,
    host: databaseConfig.host,
    port: databaseConfig.port,
    database: databaseConfig.database,
    tableName: databaseConfig.tableName
  };
}
