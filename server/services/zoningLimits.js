const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'zoningLimits.json');
const { limits, note } = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

const LEGAL_BASIS = '국토의 계획 및 이용에 관한 법률 시행령 제84조(건폐율)·제85조(용적률)';

// 용도지역 명칭(예: "제2종일반주거지역")으로 법정 건폐율 상한·용적률 범위를 조회한다.
// 용도지역이 아닌 용도지구/구역(지구단위계획구역 등)은 전국 공통 수치가 없어 null을 반환한다.
function getZoningLimit(landUseName) {
  const limit = limits[landUseName];
  if (!limit) return null;
  return { ...limit, legalBasis: LEGAL_BASIS };
}

module.exports = { getZoningLimit, disclaimer: note, legalBasis: LEGAL_BASIS };
