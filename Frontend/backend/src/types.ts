export type Role = "SUPER_ADMIN" | "OPERATION_ADMIN" | "VIEWER";
export type DisasterStatus = "ACTIVE" | "CLOSED";
export type NetworkStatus = "UNKNOWN" | "LIKELY_UNAVAILABLE" | "PARTIAL" | "AVAILABLE";
export type AnalysisMode = "PRE_DISASTER_ONLY_ANALYSIS" | "PARTIAL_NETWORK_ANALYSIS" | "STRONG_POST_DISASTER_ANALYSIS";
export type DeviceStatus = "PRE_DISASTER_SIGNAL" | "POST_DISASTER_UPDATED" | "NOT_UPDATED" | "OUTSIDE_AREA" | "INSIDE_DEBRIS_AREA" | "PRIORITY_CONTROL_AREA";
export type DamageLevel = "LOW" | "MEDIUM" | "HIGH" | "COLLAPSED" | "UNKNOWN";
export type PriorityLevel = "Düşük" | "Orta" | "Yüksek" | "Kritik";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  assignedRegions: string[];
  isActive: boolean;
  createdAt: string;
}

export interface Device {
  id: string;
  anonymousDeviceId: string;
  platform: "ios" | "android";
  appVersion: string;
  createdAt: string;
  lastSeenAt: string;
  isActive: boolean;
}

export interface LatestLocation {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  batteryLevel: number;
  networkType: "wifi" | "cellular" | "offline" | "unknown";
  locationTimestamp: string;
  updatedAt: string;
  postDisasterUpdated: boolean;
}

export interface DisasterEvent {
  id: string;
  title: string;
  disasterType: string;
  eventTime: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  polygonGeojson?: unknown;
  status: DisasterStatus;
  networkStatus: NetworkStatus;
  analysisMode: AnalysisMode;
  createdBy: string;
  createdAt: string;
  closedAt?: string;
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
  damageLevel: DamageLevel;
  reportedBy: string;
  createdAt: string;
}

export interface DisasterDeviceStatus {
  id: string;
  disasterEventId: string;
  deviceId: string;
  lastLatitude: number;
  lastLongitude: number;
  lastAccuracy: number;
  lastLocationTime: string;
  postDisasterUpdated: boolean;
  postDisasterUpdateTime?: string;
  status: DeviceStatus;
  confidenceLevel: "Düşük" | "Orta" | "Yüksek";
  createdAt: string;
  updatedAt: string;
}

export interface SearchPriorityArea {
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
  priorityLevel: PriorityLevel;
  analysisMode: AnalysisMode;
  addressText: string;
  buildingName: string;
  street: string;
  neighborhood: string;
  damageLevel: DamageLevel;
  suggestedAreaText: string;
  createdAt: string;
}

export interface DeviceUpdateRequest {
  id: string;
  disasterEventId: string;
  requestedBy: string;
  requestedAt: string;
  targetDeviceCount: number;
  responseCount: number;
  noResponseCount: number;
  note: string;
}

export interface AuditLog {
  id: string;
  adminUserId?: string;
  adminEmail?: string;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string | string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface DataStore {
  admins: AdminUser[];
  devices: Device[];
  latestLocations: LatestLocation[];
  disasterEvents: DisasterEvent[];
  debrisReports: DebrisReport[];
  disasterDeviceStatuses: DisasterDeviceStatus[];
  searchPriorityAreas: SearchPriorityArea[];
  auditLogs: AuditLog[];
  deviceUpdateRequests: DeviceUpdateRequest[];
}
