// 계절별 기후평년값(이 지점 vs 전국 평균)을 바탕으로 규칙 기반 한 줄 요약과
// 건물 설계 시 고려할 점을 생성한다. 실제 LLM을 호출하지 않고, 이미 계산된
// 수치 차이를 임계값에 따라 문장으로 조합하는 방식이다.

const SEASONS = ['봄', '여름', '가을', '겨울'];
const METRIC_LABEL = { temperature: '기온', precipitation: '강수량', humidity: '습도', windSpeed: '풍속', sunshine: '일조시간' };

function significance(metric, delta, pct) {
  return metric === 'temperature' ? Math.abs(delta) : Math.abs(pct);
}

function meetsThreshold(metric, value) {
  return metric === 'temperature' ? value >= 0.5 : value >= 8;
}

// 받침 유무에 따라 "이/가" 조사를 골라 붙인다 (예: "기온" -> "기온이", "습도" -> "습도가").
function withJosa(word, withBatchim, withoutBatchim) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasBatchim = code >= 0 && code <= 11171 && code % 28 !== 0;
  return word + (hasBatchim ? withBatchim : withoutBatchim);
}

function buildSummary(site, national) {
  const deltas = [];
  SEASONS.forEach((season) => {
    Object.keys(METRIC_LABEL).forEach((metric) => {
      const s = site[season]?.[metric];
      const n = national[season]?.[metric];
      if (typeof s !== 'number' || typeof n !== 'number' || n === 0) return;
      const delta = s - n;
      const pct = (delta / n) * 100;
      const score = significance(metric, delta, pct);
      if (!meetsThreshold(metric, score)) return;
      deltas.push({ season, metric, delta, pct, score });
    });
  });

  if (deltas.length === 0) {
    return '이 지점의 계절별 기후는 전국 평균과 뚜렷한 차이가 없습니다.';
  }

  deltas.sort((a, b) => b.score - a.score);
  const picked = [];
  const usedMetrics = new Set();
  for (const d of deltas) {
    if (usedMetrics.has(d.metric)) continue;
    usedMetrics.add(d.metric);
    picked.push(d);
    if (picked.length === 2) break;
  }

  const phrase = (d) => `${d.season} ${withJosa(METRIC_LABEL[d.metric], '이', '가')} 전국 평균보다 ${d.delta > 0 ? '높은' : '낮은'} 편`;
  return picked.length === 1
    ? `이 지점은 ${phrase(picked[0])}입니다.`
    : `이 지점은 ${phrase(picked[0])}이고, ${phrase(picked[1])}입니다.`;
}

function buildConsiderations(site) {
  const rules = [
    {
      test: () => site.겨울?.temperature <= 0,
      text: () => `겨울철 평균기온이 영하(${site.겨울.temperature}℃)라 단열·기밀 성능을 강화한 외피 설계가 필요합니다.`,
    },
    {
      test: () => site.여름?.humidity >= 75,
      text: () => `여름철 습도가 높아(${site.여름.humidity}%) 통풍·제습을 고려한 평면·창호 계획이 필요합니다.`,
    },
    {
      test: () => site.여름?.precipitation >= 800,
      text: () => `여름철 강수량이 많아(${Math.round(site.여름.precipitation)}mm) 배수·방수 계획을 강화해야 합니다.`,
    },
    {
      test: () => Math.max(...SEASONS.map((s) => site[s]?.windSpeed || 0)) >= 3.5,
      text: () => `평균풍속이 높은 편이라 내풍 구조와 외장재 고정 방식을 검토해야 합니다.`,
    },
    {
      test: () => site.여름?.temperature >= 26,
      text: () => `여름철 평균기온이 높아(${site.여름.temperature}℃) 차양·자연환기 등 냉방부하 저감 계획이 필요합니다.`,
    },
    {
      test: () => site.겨울?.humidity > 0 && site.겨울.humidity <= 45,
      text: () => `겨울철 공기가 건조한 편(${site.겨울.humidity}%)이라 가습이나 마감재 수축 대비가 필요합니다.`,
    },
  ];

  return rules
    .filter((r) => r.test())
    .slice(0, 3)
    .map((r) => r.text());
}

export function generateInsights({ site, national }) {
  return {
    summary: buildSummary(site, national),
    considerations: buildConsiderations(site),
  };
}
