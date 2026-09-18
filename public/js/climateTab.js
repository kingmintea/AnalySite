import { generateInsights } from './climateInsights.js';

const METRICS = [
  { key: 'temperature', label: '기온', unit: '℃', decimals: 1 },
  { key: 'humidity', label: '습도', unit: '%', decimals: 0 },
  { key: 'precipitation', label: '강수량', unit: 'mm', decimals: 1 },
];

const SEASONS = ['봄', '여름', '가을', '겨울'];
const SEASONAL_METRICS = [
  { key: 'temperature', label: '기온', unit: '℃', decimals: 1 },
  { key: 'precipitation', label: '강수량', unit: 'mm', decimals: 0 },
  { key: 'humidity', label: '습도', unit: '%', decimals: 0 },
  { key: 'windSpeed', label: '풍속', unit: 'm/s', decimals: 1 },
  { key: 'sunshine', label: '일조시간', unit: 'hr', decimals: 0 },
];

function fmt(value, decimals) {
  return value === null || value === undefined ? '정보 없음' : value.toFixed(decimals);
}

function heatIndex(temperature, humidity) {
  return 0.81 * temperature + 0.01 * humidity * (0.99 * temperature - 14.3) + 46.3;
}

function interpretMetric(key, value, humidity) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  if (key === 'temperature') {
    if (value >= 35) return '폭염경보 수준을 참고하세요';
    if (value >= 33) return '폭염주의보 수준을 참고하세요';
    if (value >= 30) return '햇볕과 더위가 강한 날이에요';
    if (value <= 0) return '추위 대비가 필요한 날이에요';
    return '활동하기 무난한 기온이에요';
  }
  if (key === 'precipitation') {
    if (value >= 80) return '호우 특보 수준을 확인하세요';
    if (value >= 30) return '비가 매우 많이 오는 편이에요';
    if (value > 0) return '우산이 필요한 비가 있어요';
    return '현재 강수는 거의 없어요';
  }
  if (key === 'humidity') {
    const index = humidity === undefined ? null : heatIndex(humidity, value);
    if (index >= 80) return `짜증수치 매우 높음 (불쾌지수 ${index.toFixed(0)})`;
    if (index >= 75) return `짜증수치 높음 (불쾌지수 ${index.toFixed(0)})`;
    if (index >= 68) return `조금 끈적할 수 있어요 (불쾌지수 ${index.toFixed(0)})`;
    if (value >= 80) return '공기가 축축하게 느껴질 수 있어요';
    return '습도가 쾌적한 편이에요';
  }
  if (key === 'windSpeed') {
    if (value >= 14) return '강풍에 주의하세요';
    if (value >= 8) return '바람이 꽤 강하게 불어요';
    if (value >= 3) return '산책하기 좋은 바람이에요';
    return '바람이 잔잔해요';
  }
  if (key === 'sunshine') {
    if (value >= 600) return '햇살이 풍부한 계절이에요';
    if (value >= 400) return '일조량이 보통인 계절이에요';
    return '햇빛이 적은 계절이에요';
  }
  return '';
}

function renderRangeBar(container, value, national, decimals) {
  container.innerHTML = '';
  if (value === null || value === undefined || !national) {
    container.textContent = '전국 비교 데이터가 없습니다.';
    return;
  }

  const { min, max, avg } = national;
  const span = max - min || 1; // 전국 표본 값이 모두 같을 때 0 나눗셈 방지
  const clamp = (v) => Math.min(100, Math.max(0, ((v - min) / span) * 100));

  const track = document.createElement('div');
  track.className = 'range-track';

  const avgTick = document.createElement('div');
  avgTick.className = 'range-avg-tick';
  avgTick.style.left = `${clamp(avg)}%`;
  track.appendChild(avgTick);

  const marker = document.createElement('div');
  marker.className = 'range-marker';
  marker.style.left = `${clamp(value)}%`;
  track.appendChild(marker);

  const labels = document.createElement('div');
  labels.className = 'range-labels';
  labels.innerHTML = `<span>${min.toFixed(decimals)}</span><span>${max.toFixed(decimals)}</span>`;

  const delta = value - avg;
  const deltaText = document.createElement('p');
  deltaText.className = 'range-delta';
  if (Math.abs(delta) < 0.5 * Math.pow(10, -decimals)) {
    deltaText.textContent = '전국 평균(비교 도시 15곳)과 비슷함';
  } else {
    const dir = delta > 0 ? '높음' : '낮음';
    deltaText.textContent = `전국 평균보다 ${Math.abs(delta).toFixed(decimals)} ${dir}`;
  }

  container.append(track, labels, deltaText);
}

function renderClimateInsights(data) {
  const el = document.getElementById('climateInsights');
  const { summary, considerations } = generateInsights(data);

  el.innerHTML = `
    <p class="climate-insight-summary">${summary}</p>
    ${
      considerations.length > 0
        ? `<ul class="climate-insight-list">${considerations.map((c) => `<li>${c}</li>`).join('')}</ul>`
        : ''
    }
  `;
}

function renderSeasonalCharts(data) {
  const container = document.getElementById('seasonalCharts');
  const stationInfo = document.getElementById('climateStationInfo');
  container.innerHTML = '';

  stationInfo.textContent = `가장 가까운 관측소: ${data.station.name} (약 ${data.station.distanceKm}km) · 전국 ${SEASONS.length}계절 평년값 비교`;
  renderClimateInsights(data);

  SEASONAL_METRICS.forEach(({ key, label, unit, decimals }) => {
    const values = SEASONS.flatMap((season) => [data.site[season][key], data.national[season][key]]);
    const min = Math.min(...values, 0);
    const max = Math.max(...values);
    const range = max - min || 1;
    const heightPct = (v) => Math.max(2, ((v - min) / range) * 100);

    const chart = document.createElement('div');
    chart.className = 'season-chart';

    const title = document.createElement('h3');
    title.textContent = `${label} (${unit})`;
    chart.appendChild(title);

    const insight = document.createElement('p');
    insight.className = 'season-chart-insight';
    const siteSeasonValues = SEASONS.map((season) => data.site[season][key]);
    const representative = siteSeasonValues.reduce((best, value) => (Math.abs(value) > Math.abs(best) ? value : best), siteSeasonValues[0]);
    insight.textContent = interpretMetric(key, representative, key === 'humidity' ? data.site.여름.temperature : undefined);
    chart.appendChild(insight);

    const bars = document.createElement('div');
    bars.className = 'season-chart-bars';

    SEASONS.forEach((season) => {
      const siteVal = data.site[season][key];
      const natVal = data.national[season][key];

      const col = document.createElement('div');
      col.className = 'season-col';
      col.innerHTML = `
        <div class="bar-pair">
          <div class="bar bar-site" style="height:${heightPct(siteVal)}%"><span>${siteVal.toFixed(decimals)}</span></div>
          <div class="bar bar-national" style="height:${heightPct(natVal)}%"><span>${natVal.toFixed(decimals)}</span></div>
        </div>
        <div class="season-label">${season}</div>
      `;
      bars.appendChild(col);
    });

    chart.appendChild(bars);
    container.appendChild(chart);
  });

  const legend = document.createElement('div');
  legend.className = 'season-legend';
  legend.innerHTML = '<span class="dot bar-site"></span>이 지점 <span class="dot bar-national"></span>전국 평균';
  container.appendChild(legend);
}

export async function showAt(x, y) {
  const statusEl = document.getElementById('weatherStatus');
  const sourceNoticeEl = document.getElementById('weatherDataSourceNotice');
  statusEl.hidden = false;
  statusEl.textContent = '기후정보 조회 중...';
  statusEl.classList.remove('error');

  try {
    const [weatherRes, normalsRes] = await Promise.all([
      fetch(`/api/weather?x=${x}&y=${y}`),
      fetch(`/api/climate-normals?x=${x}&y=${y}`),
    ]);
    const data = await weatherRes.json();
    if (!weatherRes.ok) {
      throw new Error(data?.error?.message || '기후정보를 불러오지 못했습니다.');
    }
    sourceNoticeEl.hidden = !['mock', 'mock-fallback'].includes(weatherRes.headers.get('X-Data-Source'));

    METRICS.forEach(({ key, unit, decimals }) => {
      const valueEl = document.getElementById(`weather${capitalize(key)}`);
      const compareEl = document.getElementById(`weather${capitalize(key)}Compare`);
      const value = data[key];
      valueEl.textContent = value === null || value === undefined ? '정보 없음' : `${fmt(value, decimals)}${unit}`;
      const insightEl = document.getElementById(`weather${capitalize(key)}Insight`);
      insightEl.textContent = interpretMetric(key, value, data.temperature);
      renderRangeBar(compareEl, value, data.national?.[key], decimals);
    });

    if (normalsRes.ok) {
      renderSeasonalCharts(await normalsRes.json());
    } else {
      throw new Error('기후 평년값을 불러오지 못했습니다.');
    }

    statusEl.hidden = true;
  } catch (err) {
    statusEl.hidden = false;
    statusEl.textContent = err.message;
    statusEl.classList.add('error');
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
