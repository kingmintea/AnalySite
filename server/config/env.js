const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const vworldApiKey = process.env.VWORLD_API_KEY || '';
const requestedMock = process.env.USE_MOCK === 'true';

function decodeServiceKey(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

if (!vworldApiKey && !requestedMock) {
  console.warn(
    '[env] VWORLD_API_KEY 가 설정되지 않아 MOCK 모드로 자동 전환합니다. ' +
      '.env 파일에 키를 입력하면 실제 API를 호출합니다.'
  );
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  vworldApiKey,
  // 지오코더/연속지적도(레거시 api.vworld.kr) 호출 시 함께 보내는 domain 값.
  vworldDomain: process.env.VWORLD_DOMAIN || 'localhost',
  // 용도지역 등 신규 게이트웨이(apis.vworld.kr)는 V-World에 실제 등록한 도메인과
  // 정확히 일치해야 통과하는 별도의 referer 검증을 사용한다 (레거시와 다를 수 있음).
  vworldGatewayDomain: process.env.VWORLD_GATEWAY_DOMAIN || process.env.VWORLD_DOMAIN || 'localhost',
  useMock: requestedMock || !vworldApiKey,
  // 네이버 지도 클라이언트 ID는 브라우저에 노출되는 값(스크립트 태그용)이라
  // 서버는 .env에서 읽어 /api/config로 그대로 전달하기만 한다.
  naverMapClientId: process.env.NAVER_MAP_CLIENT_ID || '',
  // 기상청 단기예보(초단기실황) 조회서비스 — data.go.kr에서 직접 발급(V-World와 무관).
  dataGoKrWeatherKey: decodeServiceKey(process.env.DATA_GO_KR_WEATHER_KEY || ''),
  // NAVER API HUB 지역검색(주변 시설 검색) — 네이버 지도 클라이언트 ID와는 별개 키.
  naverSearchClientId: process.env.NAVER_SEARCH_CLIENT_ID || '',
  naverSearchClientSecret: process.env.NAVER_SEARCH_CLIENT_SECRET || '',
  jusoApiKey: process.env.JUSO_API_KEY || '',
};
