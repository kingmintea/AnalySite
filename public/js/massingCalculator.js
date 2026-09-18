import { renderIsometricSvg } from './isometricViz.js';

const UNIT_TO_M = { mm: 0.001, cm: 0.01, m: 1 };
const SCALE_OPTIONS = [1, 5, 10, 20, 25, 50, 100, 200];

let context = { area: null, zoningLimit: null };
let mode = 'concept'; // 'concept' | 'model'
let unit = 'mm';
let scale = 100;
let floors = [];
let nextFloorId = 1;
let expanded = false;

let container = null;
let toggleBtn = null;

function dimToMeters(value) {
  return (Number(value) || 0) * UNIT_TO_M[unit];
}

// 층 하나의 실제 면적(㎡). 직접 면적 입력값은 현재 선택된 치수 단위의 제곱(mm²/cm²/m²)으로
// 해석하고, 가로×세로와 동일하게 모형 단계에서는 축척의 제곱을 적용한다.
function computeFloorArea(floor) {
  const scaleFactor = mode === 'model' ? scale : 1;
  if (floor.inputMode === 'area') {
    const rawAreaInUnit2 = Number(floor.area) || 0;
    return rawAreaInUnit2 * UNIT_TO_M[unit] ** 2 * scaleFactor ** 2;
  }
  const w = dimToMeters(floor.width) * scaleFactor;
  const d = dimToMeters(floor.depth) * scaleFactor;
  return w * d;
}

function fmt(n) {
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '-';
}

function computeResults() {
  const { buildingCoverageMax, floorAreaRatioMin, floorAreaRatioMax } = context.zoningLimit;
  const maxBuildingArea = (context.area * buildingCoverageMax) / 100;
  const minFloorArea = (context.area * floorAreaRatioMin) / 100;
  const maxFloorArea = (context.area * floorAreaRatioMax) / 100;

  const computedFloors = floors.map((f) => ({ ...f, computed: computeFloorArea(f) }));
  const buildingArea = computedFloors.length ? Math.max(...computedFloors.map((f) => f.computed)) : 0;
  const totalFloorArea = computedFloors.reduce((sum, f) => sum + f.computed, 0);

  return {
    computedFloors,
    buildingArea,
    totalFloorArea,
    maxBuildingArea,
    minFloorArea,
    maxFloorArea,
    buildingCoveragePct: context.area > 0 ? (buildingArea / context.area) * 100 : 0,
    floorAreaRatioPct: context.area > 0 ? (totalFloorArea / context.area) * 100 : 0,
    buildingCoverageMax,
    floorAreaRatioMin,
    floorAreaRatioMax,
  };
}

function addFloor() {
  floors.push({ id: nextFloorId++, inputMode: 'area', width: '', depth: '', area: '' });
  render();
}

function removeFloor(id) {
  floors = floors.filter((f) => f.id !== id);
  render();
}

function pctFmt(n) {
  return Number.isFinite(n) ? n.toFixed(1) : '-';
}

// 건축면적(건폐율)은 법정 상한이 하나뿐이라 2단계(충족/초과)로 판정한다.
function renderCoverageBar(current, max, sitePct, maxPct) {
  const exceeded = current > max;
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;

  return `
    <p class="mass-pct-label">대지면적 대비 <strong class="mass-pct-value ${exceeded ? 'exceed' : 'ok'}">${pctFmt(sitePct)}%</strong> (허용 ${pctFmt(maxPct)}% 이하)</p>
    <div class="mass-bar-track">
      <div class="mass-bar-fill ${exceeded ? 'exceed' : 'ok'}" style="width:${pct}%"></div>
    </div>
    <p class="mass-bar-text ${exceeded ? 'exceed' : 'ok'}">
      ${fmt(current)}㎡ / 허용 ${fmt(max)}㎡ ${exceeded ? ' — 법정 상한 초과' : ' — 기준 충족'}
    </p>
  `;
}

// 연면적(용적률)은 시행령이 "OO% 이상 XX% 이하"의 범위로 규정하는데, 실제로는 이 범위 안에서
// 지자체 도시·군계획조례가 특정 수치(기준 용적률)를 정하고, 조례상 완화·인센티브 조항을 충족하면
// 그 조례 기준치를 넘어 시행령의 절대 상한까지 늘어날 수 있는 구조다(사용자 확인).
// 따라서 3단계로 판정한다: 기준 이내(문제없음) / 기준 초과~절대상한 이내(조례 조건 충족 시 가능,
// 지자체 확인 필요) / 절대상한 초과(불가).
// 주의: 이 계산기는 국토계획법 시행령의 전국 공통 범위만 알고 있고, 개별 지자체 조례가 실제로
// 정한 기준 용적률 수치는 지자체마다 달라 정적 데이터로 보유하고 있지 않다 — 아래 "기준"은
// 시행령상 하한을 대략적인 참고치로 쓴 것이며, 정확한 조례 기준치는 별도 확인이 필요하다.
function renderFarBar(current, min, max, sitePct, minPct, maxPct) {
  const axisMax = Math.max(max, current) * 1.05 || 1;
  const fillPct = Math.min(100, (current / axisMax) * 100);
  const minTickPct = (min / axisMax) * 100;
  const maxTickPct = (max / axisMax) * 100;

  let status;
  let label;
  if (current <= min) {
    status = 'ok';
    label = '조례 기준 이내로 추정 — 문제없음';
  } else if (current <= max) {
    status = 'caution';
    label = '시행령상 절대상한 이내 — 조례상 완화·인센티브 조건을 충족해야 가능(지자체 확인 필요)';
  } else {
    status = 'exceed';
    label = '시행령상 절대상한 초과';
  }

  return `
    <p class="mass-pct-label">대지면적 대비 <strong class="mass-pct-value ${status}">${pctFmt(sitePct)}%</strong> (조례 기준 참고치 ${pctFmt(minPct)}% · 시행령 절대상한 ${pctFmt(maxPct)}%)</p>
    <div class="mass-bar-track">
      <div class="mass-bar-min-tick" style="left:${minTickPct}%" title="조례 기준 참고치"></div>
      <div class="mass-bar-max-tick" style="left:${maxTickPct}%" title="시행령 절대상한"></div>
      <div class="mass-bar-fill ${status}" style="width:${fillPct}%"></div>
    </div>
    <p class="mass-bar-text ${status}">
      ${fmt(current)}㎡ (기준 ${fmt(min)}㎡ · 절대상한 ${fmt(max)}㎡) — ${label}
    </p>
  `;
}

function renderResultsHtml() {
  const {
    buildingArea, totalFloorArea, maxBuildingArea, minFloorArea, maxFloorArea,
    buildingCoveragePct, floorAreaRatioPct, buildingCoverageMax, floorAreaRatioMin, floorAreaRatioMax,
  } = computeResults();
  return `
    <div>
      <h3>건축면적 (가장 넓은 층 기준)</h3>
      ${renderCoverageBar(buildingArea, maxBuildingArea, buildingCoveragePct, buildingCoverageMax)}
    </div>
    <div>
      <h3>연면적 (전 층 합)</h3>
      ${renderFarBar(totalFloorArea, minFloorArea, maxFloorArea, floorAreaRatioPct, floorAreaRatioMin, floorAreaRatioMax)}
      <p class="card-sub mass-zoning-notice">지자체 조례가 정한 실제 기준 용적률은 시·군·구마다 달라 이 계산기에는 없습니다 — 위 "조례 기준 참고치"는 시행령상 하한을 대신 표시한 값이며, 정확한 수치는 토지이음 등에서 확인하세요.</p>
    </div>
  `;
}

function renderMassViz() {
  const vizEl = container.querySelector('#massViz');
  if (!vizEl) return;
  const { computedFloors } = computeResults();
  vizEl.innerHTML = renderIsometricSvg(context.area, computedFloors.map((f) => f.computed));
}

// 입력 중(타이핑 중)에는 이 함수만 호출해 계산값·결과·시각화만 갱신한다. input 엘리먼트 자체를
// 다시 그리면 포커스/커서 위치가 매 글자마다 끊겨 소수점 입력이 어려워지므로,
// 구조(행 추가/삭제, 모드·단위 전환)가 바뀌지 않는 한 render() 전체 재렌더는 피한다.
function updateValues() {
  const { computedFloors } = computeResults();
  computedFloors.forEach((f) => {
    const cell = container.querySelector(`tr[data-floor-id="${f.id}"] .mass-computed-area`);
    if (cell) cell.textContent = fmt(f.computed);
  });
  const resultsEl = container.querySelector('#massResults');
  if (resultsEl) resultsEl.innerHTML = renderResultsHtml();
  renderMassViz();
}

function render() {
  if (!container) return;

  if (!expanded) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  if (!context.area || !context.zoningLimit) {
    container.innerHTML = '<p class="card-sub">건폐율/용적률 정보가 있는 용도지역이 확인된 뒤에 계산할 수 있습니다.</p>';
    return;
  }

  const areaUnitLabel = `${unit}²`;

  container.innerHTML = `
    <div class="mass-mode-tabs">
      <button type="button" class="mode-tab ${mode === 'concept' ? 'active' : ''}" data-mode="concept">구상 단계</button>
      <button type="button" class="mode-tab ${mode === 'model' ? 'active' : ''}" data-mode="model">모형 단계</button>
    </div>
    <p class="mass-mode-description">
      ${mode === 'concept'
        ? '구상 단계에서는 1:1 실제 축척을 바탕으로 계산합니다.'
        : '모형 단계에서는 모형 축척비를 고려해 실제 대지와의 관계를 계산합니다.'}
    </p>

    <div class="mass-settings">
      ${mode === 'model' ? `
        <label>축척 1 :
          <select id="massScale">
            ${SCALE_OPTIONS.map((s) => `<option value="${s}" ${s === scale ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
      ` : ''}
      <label>치수 단위:
        <select id="massUnit">
          ${['mm', 'cm', 'm'].map((u) => `<option value="${u}" ${u === unit ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </label>
    </div>

    <div class="mass-viz-wrap">
      <div id="massViz" class="mass-viz"></div>
      <p class="card-sub mass-viz-caption">대지(점선 바닥면) 위로 층이 쌓이는 모습 — 모든 층은 면적을 정사각형으로 단순화해 표시합니다.</p>
    </div>

    <table class="mass-floor-table">
      <thead><tr><th>층</th><th>입력 방식</th><th>가로×세로 / 면적</th><th>면적(㎡)</th><th></th></tr></thead>
      <tbody>
        ${floors
          .map(
            (f, i) => `
          <tr data-floor-id="${f.id}">
            <td>${i + 1}층</td>
            <td>
              <select class="mass-input-mode">
                <option value="rect" ${f.inputMode === 'rect' ? 'selected' : ''}>가로×세로(${unit})</option>
                <option value="area" ${f.inputMode === 'area' ? 'selected' : ''}>면적 직접입력(${areaUnitLabel})</option>
              </select>
            </td>
            <td>
              ${
                f.inputMode === 'rect'
                  ? `<input type="number" inputmode="decimal" step="0.001" class="mass-width" placeholder="가로" value="${f.width}" min="0" />
                     <input type="number" inputmode="decimal" step="0.001" class="mass-depth" placeholder="세로" value="${f.depth}" min="0" />`
                  : `<input type="number" inputmode="decimal" step="0.001" class="mass-area" placeholder="면적(${areaUnitLabel})" value="${f.area}" min="0" />`
              }
            </td>
            <td class="mass-computed-area">${fmt(computeFloorArea(f))}</td>
            <td><button type="button" class="mass-remove-btn" title="층 삭제">삭제</button></td>
          </tr>
        `
          )
          .join('') || '<tr><td colspan="5">아직 추가된 층이 없습니다.</td></tr>'}
      </tbody>
    </table>
    <button type="button" id="massAddFloorBtn" class="secondary-btn">+ 층 추가</button>

    <div class="mass-results" id="massResults">
      ${renderResultsHtml()}
    </div>
  `;

  bindRowEvents();
  renderMassViz();
}

function bindRowEvents() {
  container.querySelectorAll('.mode-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      unit = mode === 'model' ? 'cm' : 'mm';
      render();
    });
  });

  const scaleSelect = container.querySelector('#massScale');
  if (scaleSelect) {
    scaleSelect.addEventListener('change', (e) => {
      scale = Number(e.target.value);
      render();
    });
  }

  container.querySelector('#massUnit').addEventListener('change', (e) => {
    unit = e.target.value;
    render();
  });

  container.querySelector('#massAddFloorBtn').addEventListener('click', addFloor);

  container.querySelectorAll('tr[data-floor-id]').forEach((row) => {
    const id = Number(row.dataset.floorId);
    const floor = floors.find((f) => f.id === id);

    row.querySelector('.mass-input-mode').addEventListener('change', (e) => {
      floor.inputMode = e.target.value;
      render();
    });
    row.querySelector('.mass-remove-btn').addEventListener('click', () => removeFloor(id));

    const widthInput = row.querySelector('.mass-width');
    const depthInput = row.querySelector('.mass-depth');
    const areaInput = row.querySelector('.mass-area');
    if (widthInput) widthInput.addEventListener('input', (e) => { floor.width = e.target.value; updateValues(); });
    if (depthInput) depthInput.addEventListener('input', (e) => { floor.depth = e.target.value; updateValues(); });
    if (areaInput) areaInput.addEventListener('input', (e) => { floor.area = e.target.value; updateValues(); });
  });
}

export function init() {
  container = document.getElementById('massingCalculator');
  toggleBtn = document.getElementById('massingToggleBtn');

  toggleBtn.addEventListener('click', () => {
    expanded = !expanded;
    toggleBtn.textContent = expanded ? '면적 계산기 닫기' : '면적 계산기 열기';
    render();
  });
}

export function setContext({ area, zoningLimit }) {
  context = { area, zoningLimit };
  floors = [];
  nextFloorId = 1;
  render();
}
