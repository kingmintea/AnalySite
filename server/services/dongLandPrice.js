const env = require('../config/env');
const httpClient = require('./httpClient');

const BASE_URL = 'https://api.vworld.kr/req/data';
const CADASTRE_LAYER = 'LP_PA_CBND_BUBUN';
const PAGE_SIZE = 100;
const MAX_PARCELS = 300; // 필지가 아주 많은 동은 표본만으로 평균 근사 (전수조사 아님)
const CACHE_TTL_MS = 30 * 60 * 1000;

const cache = new Map(); // dongCode -> { fetchedAt, data }

async function fetchPage(dongCode, page) {
  const data = await httpClient.request('V-World 연속지적도(동 평균)', {
    method: 'get',
    url: BASE_URL,
    params: {
      service: 'data',
      request: 'GetFeature',
      data: CADASTRE_LAYER,
      // 법정동코드(10자리) 접두사로 같은 동(법정리 포함)의 필지를 모두 검색.
      attrFilter: `pnu:like:${dongCode}%`,
      format: 'json',
      crs: 'EPSG:4326',
      size: PAGE_SIZE,
      page,
      key: env.vworldApiKey,
      domain: env.vworldDomain,
    },
  });

  const status = data?.response?.status;
  if (status !== 'OK') return { features: [], total: 0 };

  const features = data.response.result?.featureCollection?.features || [];
  const total = Number(data.response.record?.total) || features.length;
  return { features, total };
}

// PNU 앞 10자리(법정동코드)가 같은 필지들의 개별공시지가 평균을 구한다.
// 필지가 매우 많은 동은 최대 300필지까지만 표본으로 사용한다.
async function getDongAverage(pnu, dongName) {
  const dongCode = pnu.slice(0, 10);
  const cached = cache.get(dongCode);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const first = await fetchPage(dongCode, 1);
  const totalPages = Math.min(Math.ceil(first.total / PAGE_SIZE), Math.ceil(MAX_PARCELS / PAGE_SIZE));

  const restPages = await Promise.all(
    Array.from({ length: Math.max(totalPages - 1, 0) }, (_, i) => fetchPage(dongCode, i + 2))
  );

  const allFeatures = [first, ...restPages].flatMap((p) => p.features);
  const prices = allFeatures.map((f) => Number(f.properties?.jiga)).filter((v) => Number.isFinite(v) && v > 0);

  const data =
    prices.length > 0
      ? {
          dongName,
          average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
          sampleSize: prices.length,
          totalParcels: first.total,
        }
      : null;

  cache.set(dongCode, { fetchedAt: Date.now(), data });
  return data;
}

module.exports = { getDongAverage };
