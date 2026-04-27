import { randomUUID } from "node:crypto";
import { DataStore, AnalysisMode, DisasterDeviceStatus, DisasterEvent, NetworkStatus, PriorityLevel, SearchPriorityArea } from "../types.js";
import { haversineMeters } from "./geo.js";

export const networkNotice = "Afet sonrası şebeke erişilebilirliği kesin olarak bilinemez. Bu değerlendirme yalnızca cihaz güncelleme oranına göre tahminidir.";

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function priorityLevel(score: number): PriorityLevel {
  if (score >= 90) return "Kritik";
  if (score >= 70) return "Yüksek";
  if (score >= 40) return "Orta";
  return "Düşük";
}

export function calculateNetworkStatus(store: DataStore, disaster: DisasterEvent) {
  const devicesInArea = store.latestLocations.filter((location) =>
    haversineMeters(disaster.centerLatitude, disaster.centerLongitude, location.latitude, location.longitude) <= disaster.radiusMeters
  );
  const postDisasterUpdatedDevices = devicesInArea.filter((location) => new Date(location.locationTimestamp) > new Date(disaster.eventTime)).length;
  const totalDevicesInDisasterArea = devicesInArea.length;
  const updateRate = totalDevicesInDisasterArea === 0 ? 0 : postDisasterUpdatedDevices / totalDevicesInDisasterArea;

  let networkStatus: NetworkStatus = "LIKELY_UNAVAILABLE";
  let analysisMode: AnalysisMode = "PRE_DISASTER_ONLY_ANALYSIS";

  if (updateRate > 0.3) {
    networkStatus = "AVAILABLE";
    analysisMode = "STRONG_POST_DISASTER_ANALYSIS";
  } else if (updateRate > 0.05) {
    networkStatus = "PARTIAL";
    analysisMode = "PARTIAL_NETWORK_ANALYSIS";
  }

  return {
    totalDevicesInDisasterArea,
    postDisasterUpdatedDevices,
    notUpdatedDevices: Math.max(0, totalDevicesInDisasterArea - postDisasterUpdatedDevices),
    updateRate,
    updateRatePercent: Math.round(updateRate * 1000) / 10,
    networkStatus,
    analysisMode,
    notice: networkNotice
  };
}

function confidenceFromAccuracy(accuracy: number): "Düşük" | "Orta" | "Yüksek" {
  if (accuracy <= 30) return "Yüksek";
  if (accuracy <= 100) return "Orta";
  return "Düşük";
}

function buildDeviceStatuses(store: DataStore, disaster: DisasterEvent): DisasterDeviceStatus[] {
  const eventTime = new Date(disaster.eventTime);
  return store.latestLocations.map((location) => {
    const inside = haversineMeters(disaster.centerLatitude, disaster.centerLongitude, location.latitude, location.longitude) <= disaster.radiusMeters;
    const postUpdated = inside && new Date(location.locationTimestamp) > eventTime;
    return {
      id: randomUUID(),
      disasterEventId: disaster.id,
      deviceId: location.deviceId,
      lastLatitude: location.latitude,
      lastLongitude: location.longitude,
      lastAccuracy: location.accuracy,
      lastLocationTime: location.locationTimestamp,
      postDisasterUpdated: postUpdated,
      postDisasterUpdateTime: postUpdated ? location.locationTimestamp : undefined,
      status: !inside ? "OUTSIDE_AREA" : postUpdated ? "POST_DISASTER_UPDATED" : "NOT_UPDATED",
      confidenceLevel: confidenceFromAccuracy(location.accuracy),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function damageWeight(damageLevel: string, hasSignals: boolean): number {
  if (damageLevel === "COLLAPSED") return hasSignals ? 18 : 18;
  if (damageLevel === "HIGH") return hasSignals ? 12 : 12;
  if (damageLevel === "MEDIUM") return 6;
  if (damageLevel === "LOW") return 3;
  return 0;
}

function calculateAreaScore(params: {
  analysisMode: AnalysisMode;
  globalUpdateRate: number;
  totalCount: number;
  updatedCount: number;
  notUpdatedCount: number;
  avgAccuracy: number;
  avgLastSeenMinutesBefore: number;
  damageLevel: string;
}): number {
  const { analysisMode, globalUpdateRate, totalCount, updatedCount, notUpdatedCount, avgAccuracy, avgLastSeenMinutesBefore, damageLevel } = params;

  if (totalCount === 0) {
    return clampScore(damageWeight(damageLevel, false));
  }

  let score = 0;

  // Elle girilen hasar/yıkım tek başına yüksek skor üretmez.
  // Skorun ana ağırlığı, seçili afet alanı içinde manuel hasar çevresinde yoğunlaşan son konum kayıtlarından gelir.
  score += damageWeight(damageLevel, true);

  if (totalCount > 0) score += 18;
  if (totalCount >= 15) score += 25;
  else if (totalCount >= 5) score += 14;
  else if (totalCount >= 2) score += 6;

  if (notUpdatedCount > 0) score += 12;

  if (avgLastSeenMinutesBefore <= 120) score += 12;
  else if (avgLastSeenMinutesBefore > 360) score -= 15;

  if (avgAccuracy > 0 && avgAccuracy <= 30) score += 12;
  else if (avgAccuracy > 30 && avgAccuracy <= 100) score += 6;
  else if (avgAccuracy > 100) score -= 8;

  if (analysisMode === "PARTIAL_NETWORK_ANALYSIS") {
    if (updatedCount > 0) score += 4;
    if (notUpdatedCount >= 8) score += 14;
    if (notUpdatedCount / totalCount > 0.7) score += 14;
    if (globalUpdateRate > 0.05 && updatedCount === 0 && notUpdatedCount >= 3) score += 12;
  }

  if (analysisMode === "STRONG_POST_DISASTER_ANALYSIS") {
    if (globalUpdateRate > 0.3) score += 8;
    if (notUpdatedCount / totalCount > 0.8) score += 18;
    if (notUpdatedCount >= 10) score += 18;
  }

  return clampScore(score);
}

function buildAddressText(params: { buildingName: string; street: string; neighborhood: string; latitude: number; longitude: number }): string {
  const parts = [params.buildingName, params.street, params.neighborhood].map((item) => item.trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(" / ");
  return `Adres girilmedi (${params.latitude.toFixed(5)}, ${params.longitude.toFixed(5)})`;
}

export function runAnalysis(store: DataStore, disasterId: string) {
  const disaster = store.disasterEvents.find((event) => event.id === disasterId);
  if (!disaster) throw new Error("Afet olayı bulunamadı.");

  const network = calculateNetworkStatus(store, disaster);
  disaster.networkStatus = network.networkStatus;
  disaster.analysisMode = network.analysisMode;

  store.disasterDeviceStatuses = store.disasterDeviceStatuses.filter((status) => status.disasterEventId !== disaster.id);
  store.searchPriorityAreas = store.searchPriorityAreas.filter((area) => area.disasterEventId !== disaster.id);

  const statuses = buildDeviceStatuses(store, disaster);
  store.disasterDeviceStatuses.push(...statuses);

  const eventTime = new Date(disaster.eventTime).getTime();
  const debrisReports = store.debrisReports.filter((report) => report.disasterEventId === disaster.id);
  const priorityAreas: SearchPriorityArea[] = debrisReports.map((debris) => {
    const nearby = statuses.filter((status) =>
      status.status !== "OUTSIDE_AREA" &&
      haversineMeters(debris.latitude, debris.longitude, status.lastLatitude, status.lastLongitude) <= debris.radiusMeters
    );
    const updated = nearby.filter((status) => status.postDisasterUpdated);
    const notUpdated = nearby.filter((status) => !status.postDisasterUpdated);
    const avgAccuracy = average(nearby.map((status) => status.lastAccuracy));
    const avgLastSeenMinutesBefore = average(
      nearby.map((status) => Math.max(0, Math.round((eventTime - new Date(status.lastLocationTime).getTime()) / 60_000)))
    );
    const score = calculateAreaScore({
      analysisMode: network.analysisMode,
      globalUpdateRate: network.updateRate,
      totalCount: nearby.length,
      updatedCount: updated.length,
      notUpdatedCount: notUpdated.length,
      avgAccuracy,
      avgLastSeenMinutesBefore,
      damageLevel: debris.damageLevel
    });
    const addressText = buildAddressText({
      buildingName: debris.buildingName,
      street: debris.street,
      neighborhood: debris.neighborhood,
      latitude: debris.latitude,
      longitude: debris.longitude
    });

    return {
      id: randomUUID(),
      disasterEventId: disaster.id,
      debrisReportId: debris.id,
      centerLatitude: debris.latitude,
      centerLongitude: debris.longitude,
      radiusMeters: debris.radiusMeters,
      preDisasterSignalCount: nearby.length,
      postDisasterUpdatedCount: updated.length,
      notUpdatedCount: notUpdated.length,
      averageAccuracy: Math.round(avgAccuracy * 10) / 10,
      averageLastSeenMinutesBeforeDisaster: Math.round(avgLastSeenMinutesBefore),
      priorityScore: score,
      priorityLevel: priorityLevel(score),
      analysisMode: network.analysisMode,
      addressText,
      buildingName: debris.buildingName,
      street: debris.street,
      neighborhood: debris.neighborhood,
      damageLevel: debris.damageLevel,
      suggestedAreaText: `${addressText} çevresinde bina/sokak bazlı kontrol önerisi. Kesin kişi durumu üretilmez.`,
      createdAt: new Date().toISOString()
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);

  store.searchPriorityAreas.push(...priorityAreas);
  return { network, statusesCreated: statuses.length, priorityAreasCreated: priorityAreas.length };
}

export function dashboardFor(store: DataStore, disasterId: string) {
  const disaster = store.disasterEvents.find((event) => event.id === disasterId);
  if (!disaster) throw new Error("Afet olayı bulunamadı.");
  const network = calculateNetworkStatus(store, disaster);
  const statuses = store.disasterDeviceStatuses.filter((status) => status.disasterEventId === disasterId);
  const areas = store.searchPriorityAreas.filter((area) => area.disasterEventId === disasterId).sort((a, b) => b.priorityScore - a.priorityScore);
  const debrisReports = store.debrisReports.filter((report) => report.disasterEventId === disasterId);
  const requests = store.deviceUpdateRequests.filter((request) => request.disasterEventId === disasterId);
  const levelCounts = areas.reduce<Record<string, number>>((acc, area) => {
    acc[area.priorityLevel] = (acc[area.priorityLevel] ?? 0) + 1;
    return acc;
  }, {});

  return {
    disaster,
    network,
    counts: {
      totalDevicesInArea: network.totalDevicesInDisasterArea,
      postDisasterUpdated: network.postDisasterUpdatedDevices,
      notUpdated: network.notUpdatedDevices,
      debrisReports: debrisReports.length,
      priorityAreas: areas.length,
      deviceStatuses: statuses.length,
      updateRequests: requests.length
    },
    lastUpdateRequest: requests[0] ?? null,
    priorityLevelCounts: levelCounts,
    topPriorityAreas: areas.slice(0, 5)
  };
}
