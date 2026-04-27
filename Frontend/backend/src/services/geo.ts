export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function randomPointAround(lat: number, lng: number, radiusMeters: number): { latitude: number; longitude: number } {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * radiusMeters;
  const dx = distance * Math.cos(angle);
  const dy = distance * Math.sin(angle);
  const metersPerDegLat = 111_320;
  const metersPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  return {
    latitude: lat + dy / metersPerDegLat,
    longitude: lng + dx / metersPerDegLng
  };
}
