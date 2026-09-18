const env = require('../config/env');
const httpClient = require('./httpClient');
const { toGrid } = require('../utils/kmaGrid');

const BASE_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst';

// 전국 대비 비교용 표본 도시(주요 도시 좌표). 기상청 격자 자체가 아니라
// 잘 알려진 도시 위경도를 기준으로 매 요청 시 toGrid()로 변환한다
// (격자번호를 직접 암기해 옮기면 오기 위험이 있어, 신뢰도가 높은 위경도만 사용).
const REFERENCE_CITIES = [
  { name: '서울', lat: 37.5665, lon: 126.978 },
  { name: '인천', lat: 37.4563, lon: 126.7052 },
  { name: '수원', lat: 37.2636, lon: 127.0286 },
  { name: '춘천', lat: 37.8813, lon: 127.7298 },
  { name: '강릉', lat: 37.7519, lon: 128.8761 },
  { name: '청주', lat: 36.6424, lon: 127.489 },
  { name: '대전', lat: 36.3504, lon: 127.3845 },
  { name: '전주', lat: 35.8242, lon: 127.148 },
  { name: '광주', lat: 35.1595, lon: 126.8526 },
  { name: '목포', lat: 34.8118, lon: 126.3922 },
  { name: '여수', lat: 34.7604, lon: 127.6622 },
  { name: '대구', lat: 35.8714, lon: 128.6014 },
  { name: '부산', lat: 35.1796, lon: 129.0756 },
  { name: '울산', lat: 35.5384, lon: 129.3114 },
  { name: '제주', lat: 33.4996, lon: 126.5312 },
];

const pad2 = (n) => String(n).padStart(2, '0');

// getUltraSrtNcst는 매시 정각 자료를 40분경 발표한다. 40분 이전에는 아직 최신 자료가
// 없으므로 한 시간 전 자료를 요청해야 한다(공식 활용가이드에서 안내하는 표준 패턴).
function baseDateTime() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  let hour = kst.getUTCHours();
  const date = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
  if (kst.getUTCMinutes() < 40) {
    hour -= 1;
    if (hour < 0) {
      hour = 23;
      date.setUTCDate(date.getUTCDate() - 1);
    }
  }
  const baseDate = `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`;
  return { baseDate, baseTime: `${pad2(hour)}00` };
}

function parseRn1(value) {
  const num = parseFloat(value);
  return Number.isNaN(num) ? 0 : num;
}

async function fetchNcst(nx, ny) {
  const { baseDate, baseTime } = baseDateTime();
  const data = await httpClient.request('기상청 초단기실황', {
    method: 'get',
    url: BASE_URL,
    params: {
      serviceKey: env.dataGoKrWeatherKey,
      numOfRows: 10,
      pageNo: 1,
      dataType: 'JSON',
      base_date: baseDate,
      base_time: baseTime,
      nx,
      ny,
    },
  });

  const response = data?.response;
  if (!response) {
    throw new Error('기상청 API 응답이 비어 있습니다.');
  }

  const header = response.header;
  if (header?.resultCode !== '00') {
    throw new Error(`기상청 API 오류: ${header?.resultMsg || '알 수 없는 오류'}`);
  }
  
  const items = response.body?.items?.item || [];
  const byCategory = Object.fromEntries(items.map((item) => [item.category, item.obsrValue]));

  return {
    temperature: byCategory.T1H !== undefined ? Number(byCategory.T1H) : null,
    humidity: byCategory.REH !== undefined ? Number(byCategory.REH) : null,
    precipitation: byCategory.RN1 !== undefined ? parseRn1(byCategory.RN1) : null,
  };
}

async function getCurrentWeather(lat, lon) {
  const { nx, ny } = toGrid(lat, lon);
  return fetchNcst(nx, ny);
}

let nationalCache = null; // { fetchedAt, data }
const NATIONAL_CACHE_TTL_MS = 20 * 60 * 1000;

function summarize(values) {
  const nums = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (nums.length === 0) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return {
    avg: Math.round(avg * 10) / 10,
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}

async function getNationalComparison() {
  if (nationalCache && Date.now() - nationalCache.fetchedAt < NATIONAL_CACHE_TTL_MS) {
    return nationalCache.data;
  }

  const results = await Promise.allSettled(
    REFERENCE_CITIES.map((city) => {
      const { nx, ny } = toGrid(city.lat, city.lon);
      return fetchNcst(nx, ny);
    })
  );
  
  const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const data = {
    temperature: summarize(ok.map((r) => r.temperature)),
    humidity: summarize(ok.map((r) => r.humidity)),
    precipitation: summarize(ok.map((r) => r.precipitation)),
    sampleSize: ok.length,
  };

  nationalCache = { fetchedAt: Date.now(), data };
  return data;
}

module.exports = { getCurrentWeather, getNationalComparison };
