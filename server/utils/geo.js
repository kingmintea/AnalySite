const DEG_TO_M_LAT = 110574; // 위도 1도당 미터 (근사)

function metersPerLngDegree(latDeg) {
  return 111320 * Math.cos((latDeg * Math.PI) / 180);
}

// 단일 링(경도/위도 좌표 배열)의 면적(㎡)을 평면 근사(로컬 ENU 투영)로 계산.
// 필지 규모(수백~수만 ㎡)에서는 오차가 무시할 수준이라 별도 라이브러리 없이 처리.
function ringAreaSqm(ring) {
  if (!ring || ring.length < 3) return 0;
  const lat0 = ring[0][1];
  const mPerLng = metersPerLngDegree(lat0);
  const points = ring.map(([lng, lat]) => [lng * mPerLng, lat * DEG_TO_M_LAT]);

  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

// GeoJSON Polygon/MultiPolygon geometry에서 전체 면적(㎡)을 계산 (내부 구멍은 제외).
function geometryAreaSqm(geometry) {
  if (!geometry) return 0;
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

  return polygons.reduce((total, rings) => {
    const [outer, ...holes] = rings;
    const outerArea = ringAreaSqm(outer);
    const holesArea = holes.reduce((s, h) => s + ringAreaSqm(h), 0);
    return total + Math.max(outerArea - holesArea, 0);
  }, 0);
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { geometryAreaSqm, haversineMeters };
