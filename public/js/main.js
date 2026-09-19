import { fetchParcelInfo } from './api.js';
import * as mapView from './map.js';
import * as resultPanel from './resultPanel.js';
import * as naverMap from './naverMap.js';
import * as climateTab from './climateTab.js';
import * as massingCalculator from './massingCalculator.js';
import * as promptTab from './promptTab.js';
import { initSplitSearch } from './splitSearch.js';
import { populateSidoSelect, bindAddressSearchButton } from './addressSearch.js';
import { bindAddressSuggestions } from './addressSuggestions.js';

const themeToggleBtn = document.getElementById('themeToggleBtn');
const savedTheme = window.localStorage.getItem('analysite-theme');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === 'dark';
  themeToggleBtn.textContent = isDark ? 'Bright' : 'Dark';
  themeToggleBtn.setAttribute('aria-label', isDark ? '라이트모드로 전환' : '다크모드로 전환');
  themeToggleBtn.title = isDark ? '라이트모드로 전환' : '다크모드로 전환';
}

applyTheme(savedTheme || 'dark');
themeToggleBtn.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  window.localStorage.setItem('analysite-theme', nextTheme);
  applyTheme(nextTheme);
});

massingCalculator.init();
promptTab.init();

populateSidoSelect(document.getElementById('landingSi'));
populateSidoSelect(document.getElementById('resultsSi'));
bindAddressSearchButton('landingAddressSearchBtn', ['landingSi', 'landingGu', 'landingDong', 'landingBunji']);
bindAddressSearchButton('resultsAddressSearchBtn', ['resultsSi', 'resultsGu', 'resultsDong', 'resultsBunji']);
bindAddressSuggestions('landingAddressInput', 'landingAddressSuggestions');
bindAddressSuggestions('resultsAddressInput', 'resultsAddressSuggestions');

const landingView = document.getElementById('landingView');
const resultsView = document.getElementById('resultsView');
const landingForm = document.getElementById('landingSearchForm');
const landingInput = document.getElementById('landingAddressInput');
const resultsForm = document.getElementById('resultsSearchForm');
const resultsInput = document.getElementById('resultsAddressInput');
const resultAddressTitle = document.getElementById('resultAddressTitle');
const statusMessage = document.getElementById('statusMessage');
const tabNav = document.getElementById('tabNav');
const toggleLandUse = document.getElementById('toggleLandUse');
const toggleCadastre = document.getElementById('toggleCadastre');
const mapTypeTabs = document.getElementById('mapTypeTabs');
const trafficToggleBtn = document.getElementById('trafficToggleBtn');
const streetLayerToggleBtn = document.getElementById('streetLayerToggleBtn');
const markerLegendToggleBtn = document.getElementById('markerLegendToggleBtn');
const markerLegend = document.getElementById('markerLegend');
const nearbyPlacesContent = document.getElementById('nearbyPlacesContent');
const nearbyPlacesStatus = document.getElementById('nearbyPlacesStatus');
const nearbyDataSourceNotice = document.getElementById('nearbyDataSourceNotice');
const nearbyGroupTabs = document.getElementById('nearbyGroupTabs');

const NEARBY_GROUPS = {
  traffic: { label: '교통', categories: ['지하철역', '버스정류장'] },
  life: { label: '생활', categories: ['편의점', '카페', '공원', '다이소', '올리브영', '헬스장', '도서관'] },
  education: { label: '교육', categories: ['학교'] },
};

const NEARBY_DISPLAY_CAP = 3;
const WALK_METERS_PER_MIN = 70; // 도보 약 4.2km/h 기준(부동산 정보 표기 관행치)

function walkMinutes(distanceM) {
  if (distanceM === null || distanceM === undefined) return null;
  return Math.max(1, Math.round(distanceM / WALK_METERS_PER_MIN));
}

// 분야별로 기본은 최대 3곳까지만 보여주되, 1km 이내에 3곳을 초과하는 결과가 있으면
// (도보로 충분히 갈 만한 거리이므로) 개수 제한 없이 전부 보여준다.
function selectForDisplay(items) {
  const within1km = items.filter((p) => p.distanceM !== null && p.distanceM !== undefined && p.distanceM <= 1000);
  if (within1km.length > NEARBY_DISPLAY_CAP) return within1km;
  return items.slice(0, NEARBY_DISPLAY_CAP);
}
let nearbyPlaces = [];
let activeNearbyGroup = 'traffic';

const VALID_TABS = ['land', 'climate', 'naver', 'prompt'];
let lastCoord = null;
let lastAreaHint = null;

function setStatus(message, isError) {
  if (!message) {
    statusMessage.hidden = true;
    return;
  }
  statusMessage.hidden = false;
  statusMessage.textContent = message;
  statusMessage.classList.toggle('error', Boolean(isError));
}

function switchTab(tab, { updateUrl = true } = {}) {
  const tabId = VALID_TABS.includes(tab) ? tab : 'naver';

  tabNav.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.hidden = panel.dataset.tab !== tabId;
  });

  if (tabId === 'land') {
    mapView.updateSize();
  }
  if (tabId === 'naver') {
    renderNaverTab();
  }
  if (tabId === 'climate') {
    renderClimateTab();
  }
  if (tabId === 'prompt') {
    promptTab.showSummary();
  }

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabId);
    window.history.pushState({ address: currentAddress(url), tab: tabId }, '', url);
  }
}

function currentAddress(url) {
  return url.searchParams.get('q') || '';
}

async function renderNaverTab() {
  if (!lastCoord) {
    document.getElementById('naverMap').textContent = '먼저 주소를 조회해 주세요.';
    return;
  }
  await naverMap.showAt(lastCoord.x, lastCoord.y);
  naverMap.showPanoramaAt(lastCoord.x, lastCoord.y);
  renderNearbyPlaces();
}

function renderNearbyGroup() {
  nearbyPlacesContent.innerHTML = '';
  const group = NEARBY_GROUPS[activeNearbyGroup];

  group.categories.forEach((category) => {
    const items = selectForDisplay(nearbyPlaces.filter((p) => p.category === category));
    if (items.length === 0) return;

    const section = document.createElement('div');
    section.className = 'nearby-category-group';

    const heading = document.createElement('h3');
    heading.className = 'nearby-category-heading';
    heading.textContent = category;
    section.appendChild(heading);

    const ul = document.createElement('ul');
    ul.className = 'nearby-places-list';
    items.forEach((p) => {
      const mins = walkMinutes(p.distanceM);
      const li = document.createElement('li');
      const hasSubwayLine = p.category === '지하철역' && p.subwayLines?.length;
      const hasBusType = p.category === '버스정류장' && p.busType;
      li.className = `nearby-place-item${hasSubwayLine ? ' subway-place-item' : ''}${hasBusType ? ` bus-place-item bus-${p.busType}` : ''}`;
      if (hasSubwayLine) li.style.setProperty('--subway-line-color', p.subwayLines[0].color);
      li.innerHTML = `
        <span>${p.name}</span>
        <span class="nearby-place-meta">
          ${p.subwayLines?.map((line) => `<span class="subway-line-chip" style="--subway-line-color: ${line.color}">${line.name}</span>`).join('') || ''}
          ${p.busType ? `<span class="bus-type-chip">${p.busType === 'village' ? '마을버스' : '일반버스'}</span>` : ''}
          <span class="nearby-place-distance">${p.distanceM !== null && p.distanceM !== undefined ? `${p.distanceM}m · 도보 ${mins}분` : ''}</span>
        </span>
      `;
      ul.appendChild(li);
    });
    section.appendChild(ul);
    nearbyPlacesContent.appendChild(section);
  });

  if (!nearbyPlacesContent.children.length) {
    nearbyPlacesContent.innerHTML = `<p class="card-sub">${group.label} 관련 주변 시설 정보가 없습니다.</p>`;
  }
}

async function renderNearbyPlaces() {
  if (!lastCoord) return;
  nearbyPlacesStatus.hidden = false;
  nearbyPlacesStatus.classList.remove('error');
  nearbyPlacesStatus.textContent = '주변 시설 조회 중...';
  nearbyPlacesContent.innerHTML = '';

  try {
    const hintParam = lastAreaHint ? `&address=${encodeURIComponent(lastAreaHint)}` : '';
    const res = await fetch(`/api/nearby-places?x=${lastCoord.x}&y=${lastCoord.y}${hintParam}`);
    const places = await res.json();
    if (!res.ok) throw new Error(places?.error?.message || '주변 시설 조회에 실패했습니다.');

    nearbyDataSourceNotice.hidden = res.headers.get('X-Data-Source') !== 'mock';
    nearbyPlaces = places;
    naverMap.setNearbyMarkers(places);
    promptTab.setNearbyPlaces(places);
    if (places.length === 0) {
      nearbyPlacesStatus.textContent = '주변 시설 정보가 없습니다.';
      return;
    }

    nearbyPlacesStatus.hidden = true;
    renderNearbyGroup();
  } catch (err) {
    nearbyPlacesStatus.hidden = false;
    nearbyPlacesStatus.classList.add('error');
    nearbyPlacesStatus.textContent = err.message;
  }
}

function renderClimateTab() {
  if (!lastCoord) return;
  climateTab.showAt(lastCoord.x, lastCoord.y);
}

async function loadLandTab(address) {
  setStatus('조회 중...', false);
  try {
    const data = await fetchParcelInfo(address);
    resultPanel.render(data);
    mapView.moveTo(data.coord.x, data.coord.y);
    lastCoord = data.coord;
    lastAreaHint = data.dongLandPriceAvg?.dongName || address;
    promptTab.setSiteData(data);
    const active = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (active === 'naver') renderNaverTab();
    if (active === 'climate') renderClimateTab();
    if (active === 'prompt') promptTab.showSummary();
    setStatus(null);
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function showResults(address, { tab = 'naver', updateUrl = true } = {}) {
  landingView.hidden = true;
  resultsView.hidden = false;
  resultAddressTitle.textContent = address;
  resultsInput.value = address;

  switchTab(tab, { updateUrl: false });

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('q', address);
    url.searchParams.set('tab', tab);
    window.history.pushState({ address, tab }, '', url);
  }

  await loadLandTab(address);
}

function showLanding() {
  resultsView.hidden = true;
  landingView.hidden = false;
  setStatus(null);
}

landingForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const address = landingInput.value.trim();
  if (!address) return;
  showResults(address);
});

resultsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const address = resultsInput.value.trim();
  if (!address) return;
  const currentTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'land';
  showResults(address, { tab: currentTab });
});

initSplitSearch({
  toggleId: 'landingSplitToggle',
  singleFormId: 'landingSearchForm',
  splitFormId: 'landingSplitForm',
  fieldIds: ['landingSi', 'landingGu', 'landingDong', 'landingBunji'],
  onSubmit: (address) => showResults(address),
});

initSplitSearch({
  toggleId: 'resultsSplitToggle',
  singleFormId: 'resultsSearchForm',
  splitFormId: 'resultsSplitForm',
  fieldIds: ['resultsSi', 'resultsGu', 'resultsDong', 'resultsBunji'],
  onSubmit: (address) => {
    const currentTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'land';
    showResults(address, { tab: currentTab });
  },
});

tabNav.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

toggleLandUse.addEventListener('change', (e) => mapView.setLandUseVisible(e.target.checked));
toggleCadastre.addEventListener('change', (e) => mapView.setCadastreVisible(e.target.checked));

mapTypeTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-tab');
  if (!btn) return;
  mapTypeTabs.querySelectorAll('.mode-tab').forEach((b) => b.classList.toggle('active', b === btn));
  if (btn === trafficToggleBtn) {
    const enabled = trafficToggleBtn.getAttribute('aria-pressed') !== 'true';
    naverMap.setTrafficVisible(enabled);
    trafficToggleBtn.setAttribute('aria-pressed', String(enabled));
    trafficToggleBtn.classList.toggle('active', enabled);
    trafficToggleBtn.textContent = enabled ? '교통 OFF' : '교통 ON';
    return;
  }
  naverMap.setMapType(btn.dataset.maptype);
});

nearbyGroupTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-tab');
  if (!btn) return;
  nearbyGroupTabs.querySelectorAll('.mode-tab').forEach((b) => b.classList.toggle('active', b === btn));
  activeNearbyGroup = btn.dataset.group;
  renderNearbyGroup();
});

streetLayerToggleBtn.addEventListener('click', () => {
  const enabled = streetLayerToggleBtn.getAttribute('aria-pressed') !== 'true';
  naverMap.setStreetLayerVisible(enabled);
  streetLayerToggleBtn.setAttribute('aria-pressed', String(enabled));
  streetLayerToggleBtn.classList.toggle('active', enabled);
  streetLayerToggleBtn.textContent = enabled ? '거리뷰 레이어 OFF' : '거리뷰 레이어 ON';
});

markerLegendToggleBtn.addEventListener('click', () => {
  const opening = markerLegend.hidden;
  markerLegend.hidden = !opening;
  markerLegendToggleBtn.textContent = opening ? '마커 색상 닫기' : '마커 색상 더보기';
});

window.addEventListener('popstate', () => {
  const url = new URL(window.location.href);
  const address = currentAddress(url);
  if (address) {
    showResults(address, { tab: url.searchParams.get('tab') || 'naver', updateUrl: false });
  } else {
    showLanding();
  }
});

function init() {
  const url = new URL(window.location.href);
  const address = currentAddress(url);
  if (address) {
    showResults(address, { tab: url.searchParams.get('tab') || 'naver', updateUrl: false });
  } else {
    showLanding();
  }
}

init();
