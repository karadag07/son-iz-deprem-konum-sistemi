import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { DataStore, Device, DisasterEvent, LatestLocation } from "../types.js";

const now = () => new Date().toISOString();
export const demoEventTime = new Date("2026-04-25T08:00:00+03:00");

let seed = 42;
function seededRandom(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function pointAround(lat: number, lng: number, radiusMeters: number): { latitude: number; longitude: number } {
  const angle = seededRandom() * Math.PI * 2;
  const distance = Math.sqrt(seededRandom()) * radiusMeters;
  const dx = distance * Math.cos(angle);
  const dy = distance * Math.sin(angle);
  const metersPerDegLat = 111_320;
  const metersPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  return {
    latitude: lat + dy / metersPerDegLat,
    longitude: lng + dx / metersPerDegLng
  };
}

function dateMinutesBeforeEvent(minutes: number): string {
  return new Date(demoEventTime.getTime() - minutes * 60_000).toISOString();
}

function dateMinutesAfterEvent(minutes: number): string {
  return new Date(demoEventTime.getTime() + minutes * 60_000).toISOString();
}

function createAdmins() {
  const passwordHash = bcrypt.hashSync("Demo123!", 10);
  return [
    { id: "00000000-0000-4000-8000-000000000001", name: "Süper Admin", email: "super@demo.com", passwordHash, role: "SUPER_ADMIN" as const, assignedRegions: ["Tüm Bölgeler"], isActive: true, createdAt: now() },
    { id: "00000000-0000-4000-8000-000000000002", name: "Operasyon Admin", email: "operation@demo.com", passwordHash, role: "OPERATION_ADMIN" as const, assignedRegions: ["Dünya Demo"], isActive: true, createdAt: now() },
    { id: "00000000-0000-4000-8000-000000000003", name: "Viewer", email: "viewer@demo.com", passwordHash, role: "VIEWER" as const, assignedRegions: ["Dünya Demo"], isActive: true, createdAt: now() }
  ];
}

interface WorldCluster {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  deviceCount: number;
  spreadMeters: number;
  postUpdateRate: number;
}

const worldClusters: WorldCluster[] = [
  { city: "İstanbul", country: "Türkiye", latitude: 41.0082, longitude: 28.9784, deviceCount: 120, spreadMeters: 9500, postUpdateRate: 0.34 },
  { city: "Ankara", country: "Türkiye", latitude: 39.9334, longitude: 32.8597, deviceCount: 65, spreadMeters: 7500, postUpdateRate: 0.22 },
  { city: "İzmir", country: "Türkiye", latitude: 38.4237, longitude: 27.1428, deviceCount: 60, spreadMeters: 7200, postUpdateRate: 0.27 },
  { city: "Kahramanmaraş", country: "Türkiye", latitude: 37.5753, longitude: 36.9228, deviceCount: 90, spreadMeters: 7800, postUpdateRate: 0.18 },
  { city: "Hatay", country: "Türkiye", latitude: 36.2021, longitude: 36.1602, deviceCount: 80, spreadMeters: 7600, postUpdateRate: 0.14 },
  { city: "Niğde", country: "Türkiye", latitude: 37.9698, longitude: 34.6766, deviceCount: 45, spreadMeters: 5200, postUpdateRate: 0.30 },

  { city: "Tokyo", country: "Japonya", latitude: 35.6762, longitude: 139.6503, deviceCount: 110, spreadMeters: 10500, postUpdateRate: 0.42 },
  { city: "Osaka", country: "Japonya", latitude: 34.6937, longitude: 135.5023, deviceCount: 55, spreadMeters: 6800, postUpdateRate: 0.36 },
  { city: "Jakarta", country: "Endonezya", latitude: -6.2088, longitude: 106.8456, deviceCount: 70, spreadMeters: 9000, postUpdateRate: 0.24 },
  { city: "Kathmandu", country: "Nepal", latitude: 27.7172, longitude: 85.3240, deviceCount: 45, spreadMeters: 5200, postUpdateRate: 0.16 },
  { city: "Tehran", country: "İran", latitude: 35.6892, longitude: 51.3890, deviceCount: 60, spreadMeters: 8000, postUpdateRate: 0.20 },
  { city: "Athens", country: "Yunanistan", latitude: 37.9838, longitude: 23.7275, deviceCount: 45, spreadMeters: 5400, postUpdateRate: 0.31 },
  { city: "Rome", country: "İtalya", latitude: 41.9028, longitude: 12.4964, deviceCount: 50, spreadMeters: 6100, postUpdateRate: 0.33 },
  { city: "Naples", country: "İtalya", latitude: 40.8518, longitude: 14.2681, deviceCount: 40, spreadMeters: 4800, postUpdateRate: 0.28 },

  { city: "Los Angeles", country: "ABD", latitude: 34.0522, longitude: -118.2437, deviceCount: 95, spreadMeters: 11500, postUpdateRate: 0.38 },
  { city: "San Francisco", country: "ABD", latitude: 37.7749, longitude: -122.4194, deviceCount: 65, spreadMeters: 7200, postUpdateRate: 0.35 },
  { city: "Seattle", country: "ABD", latitude: 47.6062, longitude: -122.3321, deviceCount: 40, spreadMeters: 6200, postUpdateRate: 0.30 },
  { city: "Mexico City", country: "Meksika", latitude: 19.4326, longitude: -99.1332, deviceCount: 80, spreadMeters: 9200, postUpdateRate: 0.26 },
  { city: "Lima", country: "Peru", latitude: -12.0464, longitude: -77.0428, deviceCount: 55, spreadMeters: 7200, postUpdateRate: 0.19 },
  { city: "Santiago", country: "Şili", latitude: -33.4489, longitude: -70.6693, deviceCount: 60, spreadMeters: 7600, postUpdateRate: 0.32 },
  { city: "Quito", country: "Ekvador", latitude: -0.1807, longitude: -78.4678, deviceCount: 35, spreadMeters: 4500, postUpdateRate: 0.21 },

  { city: "Wellington", country: "Yeni Zelanda", latitude: -41.2865, longitude: 174.7762, deviceCount: 35, spreadMeters: 4200, postUpdateRate: 0.37 },
  { city: "Christchurch", country: "Yeni Zelanda", latitude: -43.5321, longitude: 172.6362, deviceCount: 35, spreadMeters: 4200, postUpdateRate: 0.29 },
  { city: "Manila", country: "Filipinler", latitude: 14.5995, longitude: 120.9842, deviceCount: 60, spreadMeters: 7800, postUpdateRate: 0.23 },
  { city: "Taipei", country: "Tayvan", latitude: 25.0330, longitude: 121.5654, deviceCount: 50, spreadMeters: 6200, postUpdateRate: 0.39 },
  { city: "Marrakesh", country: "Fas", latitude: 31.6295, longitude: -7.9811, deviceCount: 35, spreadMeters: 4700, postUpdateRate: 0.18 },
  { city: "Reykjavik", country: "İzlanda", latitude: 64.1466, longitude: -21.9426, deviceCount: 25, spreadMeters: 3600, postUpdateRate: 0.41 },
  { city: "Auckland", country: "Yeni Zelanda", latitude: -36.8485, longitude: 174.7633, deviceCount: 35, spreadMeters: 5200, postUpdateRate: 0.34 }
];

const denseOffsets = [
  { lat: 0.006, lng: 0.004 },
  { lat: -0.005, lng: -0.006 },
  { lat: 0.003, lng: -0.007 },
  { lat: -0.006, lng: 0.005 }
];

export function createDemoStore(): DataStore {
  seed = 42;
  const admins = createAdmins();

  const disaster: DisasterEvent = {
    id: "00000000-0000-4000-9000-000000000001",
    title: "Demo Deprem Bölgesi - İstanbul",
    disasterType: "EARTHQUAKE",
    eventTime: demoEventTime.toISOString(),
    centerLatitude: 41.0082,
    centerLongitude: 28.9784,
    radiusMeters: 6000,
    status: "ACTIVE",
    networkStatus: "UNKNOWN",
    analysisMode: "PRE_DISASTER_ONLY_ANALYSIS",
    createdBy: admins[0].id,
    createdAt: now()
  };

  const devices: Device[] = [];
  const locations: LatestLocation[] = [];

  let index = 0;
  for (const cluster of worldClusters) {
    for (let i = 0; i < cluster.deviceCount; i += 1) {
      const id = randomUUID();
      const platform = index % 2 === 0 ? "android" : "ios";
      const isDense = i < Math.round(cluster.deviceCount * 0.6);
      const dense = denseOffsets[i % denseOffsets.length];
      const baseLat = isDense ? cluster.latitude + dense.lat : cluster.latitude;
      const baseLng = isDense ? cluster.longitude + dense.lng : cluster.longitude;
      const radius = isDense ? Math.min(1100, cluster.spreadMeters * 0.22) : cluster.spreadMeters;
      const point = pointAround(baseLat, baseLng, radius);

      const updatedAfter = seededRandom() < cluster.postUpdateRate;
      const lastSeenBefore = i % 5 === 0 ? 30 + (i % 40) : i % 7 === 0 ? 360 + (i % 180) : 90 + (i % 220);
      const accuracy = i % 9 === 0 ? 110 + (i % 80) : i % 4 === 0 ? 35 + (i % 45) : 8 + (i % 22);
      const timestamp = updatedAfter ? dateMinutesAfterEvent(15 + (i % 120)) : dateMinutesBeforeEvent(lastSeenBefore);

      devices.push({
        id,
        anonymousDeviceId: `world-demo-${String(index + 1).padStart(5, "0")}`,
        platform,
        appVersion: "0.6.0-world-panel-demo",
        createdAt: dateMinutesBeforeEvent(60 * 24 * 14),
        lastSeenAt: timestamp,
        isActive: true
      });

      locations.push({
        id: randomUUID(),
        deviceId: id,
        latitude: point.latitude,
        longitude: point.longitude,
        accuracy,
        batteryLevel: 12 + (index % 88),
        networkType: updatedAfter ? (index % 3 === 0 ? "wifi" : "cellular") : "unknown",
        locationTimestamp: timestamp,
        updatedAt: timestamp,
        postDisasterUpdated: updatedAfter
      });

      index += 1;
    }
  }

  return {
    admins,
    devices,
    latestLocations: locations,
    disasterEvents: [disaster],
    debrisReports: [],
    disasterDeviceStatuses: [],
    searchPriorityAreas: [],
    auditLogs: [],
    deviceUpdateRequests: []
  };
}

export const store = createDemoStore();
