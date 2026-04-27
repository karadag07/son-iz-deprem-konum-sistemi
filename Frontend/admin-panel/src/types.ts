export type Role = "SUPER_ADMIN" | "OPERATION_ADMIN" | "VIEWER";
export type AnalysisMode = "PRE_DISASTER_ONLY_ANALYSIS" | "PARTIAL_NETWORK_ANALYSIS" | "STRONG_POST_DISASTER_ANALYSIS";
export type NetworkStatus = "UNKNOWN" | "LIKELY_UNAVAILABLE" | "PARTIAL" | "AVAILABLE";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  assignedRegions: string[];
  isActive: boolean;
  createdAt: string;
}

export interface DisasterEvent {
  id: string;
  title: string;
  disasterType: string;
  eventTime: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  status: "ACTIVE" | "CLOSED";
  networkStatus: NetworkStatus;
  analysisMode: AnalysisMode;
  createdAt: string;
}

export interface NetworkResult {
  totalDevicesInDisasterArea: number;
  postDisasterUpdatedDevices: number;
  notUpdatedDevices: number;
  updateRate: number;
  updateRatePercent: number;
  networkStatus: NetworkStatus;
  analysisMode: AnalysisMode;
  notice: string;
}

export interface PriorityArea {
  id: string;
  disasterEventId: string;
  debrisReportId?: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  preDisasterSignalCount: number;
  postDisasterUpdatedCount: number;
  notUpdatedCount: number;
  averageAccuracy: number;
  averageLastSeenMinutesBeforeDisaster: number;
  priorityScore: number;
  priorityLevel: "Düşük" | "Orta" | "Yüksek" | "Kritik";
  analysisMode: AnalysisMode;
  addressText: string;
  buildingName: string;
  street: string;
  neighborhood: string;
  damageLevel: "LOW" | "MEDIUM" | "HIGH" | "COLLAPSED" | "UNKNOWN";
  suggestedAreaText: string;
  createdAt: string;
}

export interface DebrisReport {
  id: string;
  disasterEventId: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  buildingName: string;
  street: string;
  neighborhood: string;
  damageLevel: "LOW" | "MEDIUM" | "HIGH" | "COLLAPSED" | "UNKNOWN";
  createdAt: string;
}

export interface MapDevice {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  batteryLevel: number;
  networkType: string;
  lastLocationTime: string;
  status: "POST_DISASTER_UPDATED" | "NOT_UPDATED" | "OUTSIDE_AREA";
}

export interface AuditLog {
  id: string;
  adminUserId?: string;
  adminEmail?: string;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}


export interface LocationSyncStatus {
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
