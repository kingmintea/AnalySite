const env = require('../config/env');
const httpClient = require('./httpClient');

// 2024년 국가공간정보포털(NSDI) 서비스 통합으로, 용도지역 레이어는 레거시
// api.vworld.kr/req/data 가 아니라 신규 게이트웨이(apis.vworld.kr/2ddata/{layerId}/data)
// 에서만 제공된다. 이 게이트웨이는 domain 파라미터를 실제 V-World에 등록한 도메인과
// 엄격히 대조하므로(레거시보다 까다로움), env.vworldGatewayDomain이 정확해야 동작한다.
const GATEWAY_BASE = 'https://apis.vworld.kr/2ddata';

// 4대 용도지역(국토계획법) — 전국 필지는 이 중 하나에만 속한다.
const ZONE_LAYERS = [
  { id: 'uq111', category: '용도지역(도시지역)' },
  { id: 'uq112', category: '용도지역(관리지역)' },
  { id: 'uq113', category: '용도지역(농림지역)' },
  { id: 'uq114', category: '용도지역(자연환경보전지역)' },
];

async function queryLayer(layer, x, y) {
  const data = await httpClient.request('V-World 용도지역 API', {
    method: 'get',
    url: `${GATEWAY_BASE}/${layer.id}/data`,
    params: {
      apiKey: env.vworldApiKey,
      geometry: `POINT(${x} ${y})`,
      output: 'json',
      domain: env.vworldGatewayDomain,
    },
  });

  // 성공 시 { header: { resultCode: "200", resultMsg: "OK" }, featureCollection: { features: [...] } }.
  // 실키 테스트로 확인함 (properties: uname, dyear, dnum, sido_name, sigg_name).
  if (data.header?.resultCode !== '200') {
    throw new Error(`${layer.category} 조회 실패: ${data.header?.resultMsg || '알 수 없는 오류'}`);
  }

  const features = data.featureCollection?.features || [];
  // POINT 필터가 겹치는 인접 행정구역 경계 등 uname이 빈 feature도 함께 내려올 수 있어
  // 실제 지정명이 있는 feature만 사용한다.
  return features
    .filter((f) => f.properties?.uname)
    .map((f) => ({
      category: layer.category,
      name: f.properties.uname,
      noticeYear: f.properties.dyear || null,
      noticeNumber: f.properties.dnum || null,
    }));
}

async function getLandUse(x, y) {
  const results = await Promise.all(ZONE_LAYERS.map((layer) => queryLayer(layer, x, y)));
  return results.flat();
}

module.exports = { getLandUse };
