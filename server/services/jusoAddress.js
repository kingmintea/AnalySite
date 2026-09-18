const env = require('../config/env');
const httpClient = require('./httpClient');

const BASE_URL = 'https://business.juso.go.kr/addrlink/addrLinkApi.do';

async function search(keyword) {
  if (!env.jusoApiKey) return [];

  const data = await httpClient.request('주소기반산업지원서비스 도로명주소 검색', {
    method: 'get',
    url: BASE_URL,
    params: {
      confmKey: env.jusoApiKey,
      currentPage: 1,
      countPerPage: 10,
      keyword,
      hstryYn: 'Y',
      resultType: 'json',
    },
  });

  const results = data?.results;
  if (!results || results.common?.errorCode !== '0') {
    throw new Error(results?.common?.errorMessage || '도로명주소 검색에 실패했습니다.');
  }

  return (results.juso || []).map((item) => ({
    roadAddress: item.roadAddr,
    jibunAddress: item.jibunAddr,
    zipNo: item.zipNo,
  }));
}

module.exports = { search };