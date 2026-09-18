const env = require('../config/env');
const httpClient = require('./httpClient');
const { haversineMeters } = require('../utils/geo');

// NAVER API HUB 지역검색 — 실키로 검증 완료(2026-09-19).
// 엔드포인트/인증 헤더/응답 필드(mapx·mapy = WGS84 경위도 × 10^7)를 실제 호출로 확인했다.
const BASE_URL = 'https://naverapihub.apigw.ntruss.com/search/v1/local';

const DEFAULT_CATEGORIES = ['지하철역', '버스정류장', '편의점', '카페', '공원', '다이소', '올리브영', '학교', '헬스장', '도서관'];
const RESULTS_PER_CATEGORY = 5; // API 허용 최대. 1km 이내 전체 표현을 위해 후보를 넉넉히 확보한다.
const SEOUL_SUBWAY_LINE_COLORS = {
  '1호선': '#0052a4', '2호선': '#00a84f', '3호선': '#ef7c1c', '4호선': '#00a5de',
  '5호선': '#996cac', '6호선': '#cd7c2f', '7호선': '#747f00', '8호선': '#e6186c', '9호선': '#bdb092',
  우이신설선: '#b7c452', 신분당선: '#d4003b', 경의중앙선: '#77c4a3', 수인분당선: '#f5a200',
  경춘선: '#178c72', 공항철도: '#0090d2', 의정부경전철: '#ffcd00', 용인경전철: '#56ab2f',
  경강선: '#003da5', 서해선: '#8fc31f', 인천1호선: '#7ca8d5', 인천2호선: '#ed8b00',
};
const SEOUL_SUBWAY_STATIONS = {
  안암역: ['6호선'], 고려대역: ['6호선'], 월곡역: ['6호선'], 상월곡역: ['6호선'],
  보문역: ['6호선', '우이신설선'], 성신여대입구역: ['4호선'], 신설동역: ['1호선', '2호선', '우이신설선'], 제기동역: ['1호선'],
  종로3가역: ['1호선', '3호선', '5호선'], 서울역: ['1호선', '4호선'], 시청역: ['1호선', '2호선'],
  을지로입구역: ['2호선'], 강남역: ['2호선'], 잠실역: ['2호선', '8호선'], 홍대입구역: ['2호선'],
};

function stripTags(html) {
  return (html || '').replace(/<[^>]*>/g, '');
}

function getSubwayLines(name) {
  const normalizedName = name.replace(/\s+/g, '');
  const linePattern = /(1호선|2호선|3호선|4호선|5호선|6호선|7호선|8호선|9호선|우이신설선|신분당선|경의중앙선|수인분당선|경춘선|공항철도|의정부경전철|용인경전철|경강선|서해선|인천1호선|인천2호선)/;
  const stationName = normalizedName.replace(linePattern, '');
  const knownLines = SEOUL_SUBWAY_STATIONS[stationName] || [];
  const lineFromName = normalizedName.match(linePattern)?.[1];
  const lineNames = lineFromName ? [lineFromName] : knownLines;
  return lineNames.map((lineName) => ({
    name: lineName,
    color: SEOUL_SUBWAY_LINE_COLORS[lineName] || '#475467',
  }));
}

// 지역검색은 좌표 반경 검색이 아니라 키워드 검색이라, 동/지역명을 함께 넣어야 해당 부지
// 인근 결과가 상위로 잡힌다(실키 테스트로 확인). areaHint가 없으면 카테고리어만 검색한다.
async function searchCategory(category, x, y, areaHint) {
  const query = areaHint ? `${areaHint} ${category}` : category;

  const data = await httpClient.request('NAVER 지역검색', {
    method: 'get',
    url: BASE_URL,
    headers: {
      'X-NCP-APIGW-API-KEY-ID': env.naverSearchClientId,
      'X-NCP-APIGW-API-KEY': env.naverSearchClientSecret,
    },
    params: {
      query,
      display: RESULTS_PER_CATEGORY,
      // 후보는 검색어 관련도가 높은 순으로 받고, 최종 순서는 아래에서 실제 좌표 거리로 정렬한다.
      sort: 'comment',
    },
  });

  const items = data?.items || [];
  return items
    .filter((item) => {
      if (category !== '지하철역') return true;
      const title = stripTags(item.title);
      return title.includes('역') && !/(대피소|승강장|대합실|출구|자전거)/.test(title);
    })
    .map((item) => {
    const mapx = Number(item.mapx);
    const mapy = Number(item.mapy);
    const hasCoord = Number.isFinite(mapx) && Number.isFinite(mapy) && mapx !== 0 && mapy !== 0;
    const name = stripTags(item.title);
    const subwayLines = category === '지하철역' ? getSubwayLines(name) : [];
    const busType = category === '버스정류장'
      ? (/마을/.test(name) ? 'village' : 'regular')
      : null;
    return {
      name,
      category,
      address: item.roadAddress || item.address,
      x: hasCoord ? mapx / 1e7 : null,
      y: hasCoord ? mapy / 1e7 : null,
      distanceM: hasCoord ? Math.round(haversineMeters(y, x, mapy / 1e7, mapx / 1e7)) : null,
      subwayLines,
      busType,
    };
  });
}

async function getNearbyPlaces(x, y, categories = DEFAULT_CATEGORIES, areaHint) {
  const results = await Promise.allSettled(categories.map((c) => searchCategory(c, x, y, areaHint)));
  return results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .filter((p) => p.distanceM === null || p.distanceM <= 2000) // 지나치게 먼 동명이인 결과 제외
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
}

module.exports = { getNearbyPlaces, DEFAULT_CATEGORIES };
