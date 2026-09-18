// 기상청 단기예보(동네예보) 격자 변환 — Lambert Conformal Conic 투영.
// 상수/공식은 기상청이 공개한 표준 변환식(기상청 디지털예보 웹페이지 내 스크립트)을 그대로 따른다.
const RE = 6371.00877; // 지구 반경(km)
const GRID = 5.0; // 격자 간격(km)
const SLAT1 = (30.0 * Math.PI) / 180.0;
const SLAT2 = (60.0 * Math.PI) / 180.0;
const OLON = (126.0 * Math.PI) / 180.0;
const OLAT = (38.0 * Math.PI) / 180.0;
const XO = 43;
const YO = 136;

const sn =
  Math.log(Math.cos(SLAT1) / Math.cos(SLAT2)) /
  Math.log(Math.tan(Math.PI * 0.25 + SLAT2 * 0.5) / Math.tan(Math.PI * 0.25 + SLAT1 * 0.5));
const sf = (Math.pow(Math.tan(Math.PI * 0.25 + SLAT1 * 0.5), sn) * Math.cos(SLAT1)) / sn;
const ro = (RE / GRID) * sf / Math.pow(Math.tan(Math.PI * 0.25 + OLAT * 0.5), sn);

// 위도(lat)/경도(lon, 십진수) -> 기상청 격자 좌표(nx, ny)
function toGrid(lat, lon) {
  const ra = (RE / GRID) * sf / Math.pow(Math.tan(Math.PI * 0.25 + (lat * Math.PI) / 180.0 / 2.0), sn);
  let theta = (lon * Math.PI) / 180.0 - OLON;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

module.exports = { toGrid };
