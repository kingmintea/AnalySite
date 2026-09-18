const env = require('../config/env');
const httpClient = require('./httpClient');
const { Errors } = require('../utils/errors');
const { geometryAreaSqm } = require('../utils/geo');

const BASE_URL = 'https://api.vworld.kr/req/data';
const CADASTRE_LAYER = 'LP_PA_CBND_BUBUN';

// 지번(jibun) 필드는 "40대"처럼 번지+지목 약칭이 붙어 내려온다(실키 응답으로 확인).
// 숫자/하이픈 뒤에 남는 문자열을 지목으로 추출한다.
function extractJimok(jibun) {
  if (!jibun) return null;
  const match = jibun.match(/^[\d-]+(.*)$/);
  const jimok = match && match[1] ? match[1].trim() : '';
  return jimok || null;
}

// "서울특별시 성북구 안암동2가 41" -> "안암동2가" (마지막 지번 토큰을 제외한 나머지의 마지막 단어).
function extractDongName(addr) {
  if (!addr) return null;
  const parts = addr.trim().split(/\s+/);
  if (parts.length < 2) return null;
  return parts[parts.length - 2];
}

// 좌표(경위도) 기준으로 해당 필지의 연속지적도 속성을 조회한다.
// 응답에는 PNU/지번/면적(도형 기반 계산)/지목(추정)뿐 아니라
// 개별공시지가(jiga)와 공시연월(gosi_year/gosi_month)도 함께 내려온다 —
// 별도의 공시지가 API 호출이 필요 없다(실키 테스트로 확인).
async function findParcelByCoord(x, y) {
  const data = await httpClient.request('V-World 연속지적도', {
    method: 'get',
    url: BASE_URL,
    params: {
      service: 'data',
      request: 'GetFeature',
      data: CADASTRE_LAYER,
      geomFilter: `POINT(${x} ${y})`,
      geometry: true,
      crs: 'EPSG:4326',
      size: 1,
      format: 'json',
      key: env.vworldApiKey,
      domain: env.vworldDomain,
    },
  });

  const status = data && data.response && data.response.status;
  if (status !== 'OK') {
    throw Errors.parcelNotFound();
  }

  const features = data.response.result?.featureCollection?.features;
  if (!features || features.length === 0) {
    throw Errors.parcelNotFound();
  }

  const feature = features[0];
  const props = feature.properties;
  const area = geometryAreaSqm(feature.geometry);
  const pricePerSqm = Number(props.jiga);

  return {
    pnu: props.pnu,
    jibun: props.jibun,
    dongName: extractDongName(props.addr),
    area: area > 0 ? Math.round(area * 10) / 10 : null,
    jimok: extractJimok(props.jibun),
    landPrice:
      props.jiga && !Number.isNaN(pricePerSqm)
        ? {
            year: Number(props.gosi_year),
            pricePerSqm,
            baseDate: `${props.gosi_year}-${props.gosi_month}-01`,
          }
        : null,
  };
}

module.exports = { findParcelByCoord };
