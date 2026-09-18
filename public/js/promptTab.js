import { generateInsights } from './climateInsights.js';

const QUESTIONS = [
  {
    id: 'terrain',
    label: '1. 대지의 지형·자연 조건',
    placeholder: '대지의 경사, 기존 건물/수목/연못 등 자연조건, 도로 접함 상태를 적어주세요.',
  },
  {
    id: 'orientation',
    label: '2. 향·조망·바람',
    placeholder: '좋은 조망이 보이는 방향, 여름/겨울 주풍향, 가리고 싶은 방향(인접 건물, 사생활 노출 등)을 적어주세요.',
  },
  {
    id: 'noise',
    label: '3. 소음원·오염원 및 대지 이력',
    placeholder: '주변 소음/오염원의 방향과 이 대지에 얽힌 특이사항(과거 용도 등)이 있다면 적어주세요.',
  },
  {
    id: 'family',
    label: '4. 가족 구성과 전체적 요구',
    placeholder: '함께 거주할 가족 구성원 수/관계와, 주택 전체 분위기나 외부공간과의 관계에 대한 바람을 적어주세요.',
  },
  {
    id: 'individual',
    label: '5. 개인별 요구와 필요한 실',
    placeholder: '구성원 개인이 요구하는 특별한 공간(취미실, 서재 등)과 꼭 필요한 방의 목록을 적어주세요.',
  },
  {
    id: 'layout',
    label: '6. 선호하는 공간 배치 방식',
    placeholder: '복도형/분리형/개방형/실 안의 실/수직 적층형 중 선호 방식이나, 프라이버시·공간효율 우선순위를 적어주세요.',
  },
];

let els = {};
let siteData = null;
let nearbySummary = '';
let climateSummary = null; // { summary, considerations } | null

function fmtNum(n) {
  return Number.isFinite(n) ? Number(n).toLocaleString() : null;
}

function buildSiteSummaryRows() {
  if (!siteData) return [['주소', '먼저 토지정보 탭에서 주소를 조회해 주세요.']];

  const rows = [];
  rows.push(['주소', siteData.address?.road || siteData.address?.parcel || siteData.address?.input || '정보 없음']);
  rows.push(['대지면적', fmtNum(siteData.area) ? `${fmtNum(siteData.area)} ㎡` : '정보 없음']);
  rows.push(['지목', siteData.jimok || '정보 없음']);

  const landUseNames = (siteData.landUse || []).map((item) => item.name).filter(Boolean);
  rows.push(['용도지역/지구', landUseNames.length ? landUseNames.join(', ') : '정보 없음']);

  const withLimit = (siteData.landUse || []).filter((item) => item.zoningLimit);
  if (withLimit.length > 0) {
    const { buildingCoverageMax, floorAreaRatioMin, floorAreaRatioMax } = withLimit[0].zoningLimit;
    rows.push(['건폐율·용적률', `건폐율 ${buildingCoverageMax}% 이하, 용적률 ${floorAreaRatioMin}~${floorAreaRatioMax}%`]);
  } else {
    rows.push(['건폐율·용적률', '법정 상한 정보 없음']);
  }

  if (siteData.landPrice?.pricePerSqm) {
    let text = `${siteData.landPrice.pricePerSqm.toLocaleString()} 원/㎡ (${siteData.landPrice.year}년)`;
    const avg = siteData.dongLandPriceAvg?.average;
    if (avg) {
      const pct = Math.round(((siteData.landPrice.pricePerSqm - avg) / avg) * 100);
      text += ` · 동 평균 대비 ${pct >= 0 ? '+' : ''}${pct}%`;
    }
    rows.push(['개별공시지가', text]);
  } else {
    rows.push(['개별공시지가', '정보 없음']);
  }

  rows.push(['기후 특성', climateSummary ? climateSummary.summary : '분석 프롬프트 탭 진입 시 자동 조회됩니다.']);
  rows.push(['주변 시설', nearbySummary || '토지정보 조회 후 네이버 지도 탭에서 자동 조회됩니다.']);

  return rows;
}

function renderSiteSummary() {
  els.summary.innerHTML = buildSiteSummaryRows()
    .map(([dt, dd]) => `<dt>${dt}</dt><dd>${dd}</dd>`)
    .join('');
}

function renderQuestions() {
  els.questions.innerHTML = QUESTIONS.map(
    (q) => `
      <div class="prompt-question">
        <label for="promptAnswer-${q.id}">${q.label}</label>
        <textarea id="promptAnswer-${q.id}" rows="3" placeholder="${q.placeholder}"></textarea>
      </div>
    `
  ).join('');

  QUESTIONS.forEach((q) => {
    document.getElementById(`promptAnswer-${q.id}`).addEventListener('input', updateGenerateButtonState);
  });
  updateGenerateButtonState();
}

function getAnswers() {
  const answers = {};
  QUESTIONS.forEach((q) => {
    answers[q.id] = document.getElementById(`promptAnswer-${q.id}`).value.trim();
  });
  return answers;
}

function updateGenerateButtonState() {
  const answers = getAnswers();
  const missing = QUESTIONS.filter((q) => !answers[q.id]).length;
  els.generateBtn.disabled = missing > 0;
  els.generateHint.textContent = missing > 0 ? `${missing}개 질문에 아직 답변하지 않았습니다.` : '';
}

function buildPrompt() {
  const answers = getAnswers();
  const summaryLines = buildSiteSummaryRows()
    .map(([dt, dd]) => `- ${dt}: ${dd}`)
    .join('\n');

  const considerationLines =
    climateSummary && climateSummary.considerations.length > 0
      ? climateSummary.considerations.map((c) => `- ${c}`).join('\n')
      : '- 정보 없음';

  const answerLines = QUESTIONS.map((q) => `${q.label}: ${answers[q.id]}`).join('\n');

  return [
    '[대지분석 기반 단독주택 설계 요청]',
    '',
    '■ 대지 개요 및 자동 수집 정보',
    summaryLines,
    '',
    '■ 기후 설계 고려사항',
    considerationLines,
    '',
    '■ 설계 질문 답변',
    answerLines,
    '',
    '위 정보를 바탕으로 이 대지에 적합한 단독주택의 공간 구성(버블 다이어그램 수준)과 배치 방향을 제안해주세요.',
  ].join('\n');
}

async function handleGenerate() {
  els.output.value = buildPrompt();
  els.outputCard.hidden = false;
  els.copyStatus.textContent = '';
  els.outputCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(els.output.value);
    els.copyStatus.textContent = '클립보드에 복사되었습니다.';
  } catch (err) {
    els.copyStatus.textContent = '복사에 실패했습니다. 직접 선택해 복사해주세요.';
  }
}

export function init() {
  els = {
    summary: document.getElementById('promptSiteSummary'),
    questions: document.getElementById('promptQuestions'),
    generateBtn: document.getElementById('promptGenerateBtn'),
    generateHint: document.getElementById('promptGenerateHint'),
    outputCard: document.getElementById('promptOutputCard'),
    output: document.getElementById('promptOutput'),
    copyBtn: document.getElementById('promptCopyBtn'),
    copyStatus: document.getElementById('promptCopyStatus'),
  };

  renderQuestions();
  renderSiteSummary();

  els.generateBtn.addEventListener('click', handleGenerate);
  els.copyBtn.addEventListener('click', handleCopy);
}

export function setSiteData(data) {
  siteData = data;
  climateSummary = null;
  renderSiteSummary();
}

export function setNearbyPlaces(places) {
  const counts = {};
  (places || []).forEach((p) => {
    counts[p.category] = (counts[p.category] || 0) + 1;
  });
  nearbySummary = Object.entries(counts)
    .map(([category, count]) => `${category} ${count}곳`)
    .join(', ');
  renderSiteSummary();
}

export async function showSummary() {
  if (!siteData?.coord || climateSummary) return;
  try {
    const res = await fetch(`/api/climate-normals?x=${siteData.coord.x}&y=${siteData.coord.y}`);
    if (!res.ok) return;
    const data = await res.json();
    climateSummary = generateInsights(data);
    renderSiteSummary();
  } catch (err) {
    // 기후 섹션만 생략하고 나머지 요약은 그대로 유지한다.
  }
}
