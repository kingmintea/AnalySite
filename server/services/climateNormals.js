const fs = require('fs');
const path = require('path');

// 기상청 기상자료개방포털(data.kma.go.kr) "우리나라 기후평년값(1991-2020) 계절별평년값"에서
// 1회 수집해 저장한 정적 데이터. 평년값은 세계기상기구 권고로 10년 주기로만 갱신되므로
// 매 요청마다 외부 API를 호출하지 않고 정적 파일로 관리한다 (§server/data/climateNormals.json).
const DATA_PATH = path.join(__dirname, '..', 'data', 'climateNormals.json');
const { stations: allStations } = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

const SEASONS = ['봄', '여름', '가을', '겨울'];
const METRICS = ['temperature', 'precipitation', 'humidity', 'windSpeed', 'sunshine'];

// 일부 관측소(방재용 간이 장비 등)는 습도/풍속 센서가 없어 평년값이 비어 있다.
// 4개 지표가 모두 존재하는 관측소만 "가장 가까운 관측소"/전국 평균 계산에 사용한다.
const stations = allStations.filter((s) =>
  SEASONS.every((season) => METRICS.every((metric) => typeof s.seasons[season][metric] === 'number'))
);

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestStation(lat, lon) {
  let best = null;
  let bestDist = Infinity;
  for (const station of stations) {
    const dist = haversineKm(lat, lon, station.lat, station.lon);
    if (dist < bestDist) {
      bestDist = dist;
      best = station;
    }
  }
  return { station: best, distanceKm: Math.round(bestDist * 10) / 10 };
}

let nationalCache = null;
function getNationalAverages() {
  if (nationalCache) return nationalCache;

  const result = {};
  for (const season of SEASONS) {
    result[season] = {};
    for (const metric of METRICS) {
      const values = stations.map((s) => s.seasons[season][metric]).filter((v) => typeof v === 'number');
      result[season][metric] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    }
  }
  nationalCache = result;
  return result;
}

function getSeasonalComparison(lat, lon) {
  const { station, distanceKm } = findNearestStation(lat, lon);
  return {
    station: { name: station.name, distanceKm },
    site: station.seasons,
    national: getNationalAverages(),
  };
}

module.exports = { getSeasonalComparison };
