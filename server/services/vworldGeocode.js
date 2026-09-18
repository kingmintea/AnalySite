const env = require('../config/env');
const httpClient = require('./httpClient');
const { Errors } = require('../utils/errors');

const BASE_URL = 'https://api.vworld.kr/req/address';

async function geocodeOnce(address, type) {
  const data = await httpClient.request('V-World Geocoder', {
    method: 'get',
    url: BASE_URL,
    params: {
      service: 'address',
      request: 'getCoord',
      version: '2.0',
      crs: 'epsg:4326',
      address,
      type,
      format: 'json',
      key: env.vworldApiKey,
    },
  });

  const status = data && data.response && data.response.status;
  if (status !== 'OK') {
    return null;
  }

  const result = data.response.result;
  const refined = data.response.refined;
  const structure = refined && refined.structure;
  const refinedText = refined && refined.text;
  // PARCEL 지오코딩 응답의 structure.level4LC 는 법정동코드(10)+산여부(1)+본번(4)+부번(4)
  // 19자리, 즉 PNU와 동일한 값으로 확인됨(연속지적도 API 응답의 pnu와 대조 검증함).
  // ROAD 지오코딩에서는 이 값이 비어 있어 PNU를 얻을 수 없다.
  const pnuFromStructure =
    type === 'PARCEL' && structure && structure.level4LC && structure.level4LC.length === 19
      ? structure.level4LC
      : null;

  return {
    x: Number(result.point.x),
    y: Number(result.point.y),
    roadAddr: type === 'ROAD' ? refinedText : null,
    parcelAddr: type === 'PARCEL' ? refinedText : null,
    pnu: pnuFromStructure,
  };
}

async function geocode(address) {
  const parcelResult = await geocodeOnce(address, 'PARCEL');
  if (parcelResult) return parcelResult;

  const roadResult = await geocodeOnce(address, 'ROAD');
  if (roadResult) return roadResult;

  throw Errors.addressNotFound();
}

module.exports = { geocode };
