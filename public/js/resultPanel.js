import * as massingCalculator from './massingCalculator.js';
import { CATEGORY_DESCRIPTIONS, NAME_DESCRIPTIONS, NOTICE_EXPLANATION } from './zoningDescriptions.js';

const els = {
  address: document.getElementById('infoAddress'),
  area: document.getElementById('infoArea'),
  jimok: document.getElementById('infoJimok'),
  pnu: document.getElementById('infoPnu'),
  landPrice: document.getElementById('landPriceInfo'),
  landUseBody: document.querySelector('#landUseTable tbody'),
  warnings: document.getElementById('warnings'),
  zoningLimitList: document.getElementById('zoningLimitList'),
  zoningDisclaimer: document.getElementById('zoningDisclaimer'),
  legalBasisText: document.getElementById('legalBasisText'),
  landUseMoreBtn: document.getElementById('landUseMoreBtn'),
  landUseMoreInfo: document.getElementById('landUseMoreInfo'),
  dongPriceCompare: document.getElementById('dongPriceCompare'),
};

els.landUseMoreBtn.addEventListener('click', () => {
  const expanded = !els.landUseMoreInfo.hidden;
  els.landUseMoreInfo.hidden = expanded;
  els.landUseMoreBtn.textContent = expanded ? '더보기' : '접기';
});

function landUseTone(text) {
  const value = text || '';
  if (/상업/.test(value)) return 'commercial';
  if (/공업/.test(value)) return 'industrial';
  if (/주거/.test(value)) return 'residential';
  if (/녹지|자연환경|보전/.test(value)) return 'green';
  if (/농림|농업/.test(value)) return 'agriculture';
  if (/문화재|경관/.test(value)) return 'heritage';
  if (/학교|교육/.test(value)) return 'education';
  if (/도로|교통/.test(value)) return 'transport';
  return 'other';
}

function landUseBadge(text, kind) {
  const label = text || '-';
  return `<span class="land-use-badge ${kind} tone-${landUseTone(label)}"><i></i>${label}</span>`;
}

function renderDongPriceCompare(landPrice, dongAvg) {
  if (!landPrice?.pricePerSqm || !dongAvg?.average) {
    els.dongPriceCompare.innerHTML = '';
    return;
  }

  const pct = (landPrice.pricePerSqm / dongAvg.average) * 100;
  const AXIS_MAX_PCT = 200; // 막대 축의 최댓값(%). 이보다 크면 막대는 꽉 채우고 숫자만 표시.
  const fillPct = Math.min(100, (pct / AXIS_MAX_PCT) * 100);
  const avgTickPct = (100 / AXIS_MAX_PCT) * 100;

  els.dongPriceCompare.innerHTML = `
    <p class="price-compare-label">${dongAvg.dongName || '해당 동'} 평균 대비 <strong class="price-compare-pct">${pct.toFixed(0)}%</strong></p>
    <div class="price-bar-track">
      <div class="price-bar-fill" style="width:${fillPct}%"></div>
      <div class="price-bar-avg-tick" style="left:${avgTickPct}%"></div>
    </div>
    <p class="card-sub price-compare-caption">
      기준선(|) = 동 평균 100% · ${dongAvg.dongName || '해당 동'} 평균(표본 ${dongAvg.sampleSize.toLocaleString()}필지) ${dongAvg.average.toLocaleString()}원/㎡
    </p>
  `;
}

function renderLandUseMoreInfo(landUse) {
  const categories = [...new Set(landUse.map((item) => item.category).filter(Boolean))];
  const names = [...new Set(landUse.map((item) => item.name).filter(Boolean))];

  const categoryItems = categories
    .map((c) => `<li>${landUseBadge(c, 'category-badge')}: ${CATEGORY_DESCRIPTIONS[c] || '설명 정보가 없습니다.'}</li>`)
    .join('');
  const nameItems = names
    .map((n) => `<li>${landUseBadge(n, 'name-badge')}: ${NAME_DESCRIPTIONS[n] || '설명 정보가 없습니다.'}</li>`)
    .join('');

  els.landUseMoreInfo.innerHTML = `
    ${categories.length ? `<p class="card-sub"><strong>구분 설명</strong></p><ul>${categoryItems}</ul>` : ''}
    ${names.length ? `<p class="card-sub"><strong>지정 명칭 설명</strong></p><ul>${nameItems}</ul>` : ''}
    <p class="card-sub">${NOTICE_EXPLANATION}</p>
  `;
}

export function render(data) {
  els.address.textContent = data.address.road || data.address.parcel || data.address.input;
  els.area.textContent = data.area ? `${Number(data.area).toLocaleString()} ㎡` : '정보 없음';
  els.jimok.textContent = data.jimok || '정보 없음';
  els.pnu.textContent = data.pnu || '-';

  if (data.landPrice && data.landPrice.pricePerSqm) {
    els.landPrice.textContent = `${data.landPrice.pricePerSqm.toLocaleString()} 원/㎡ (기준연도 ${data.landPrice.year})`;
  } else {
    els.landPrice.textContent = '정보 없음';
  }
  renderDongPriceCompare(data.landPrice, data.dongLandPriceAvg);

  els.landUseBody.innerHTML = '';
  if (data.landUse && data.landUse.length > 0) {
    data.landUse.forEach((item) => {
      const tr = document.createElement('tr');
      const notice = [item.noticeYear, item.noticeNumber].filter(Boolean).join(' ');
      tr.innerHTML = `<td>${landUseBadge(item.category, 'category-badge')}</td><td>${landUseBadge(item.name, 'name-badge')}</td><td>${notice || '-'}</td>`;
      els.landUseBody.appendChild(tr);
    });
  } else {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="3">지정된 용도지역/지구 정보 없음</td>';
    els.landUseBody.appendChild(tr);
  }

  renderLandUseMoreInfo(data.landUse || []);

  els.zoningLimitList.innerHTML = '';
  const withLimit = (data.landUse || []).filter((item) => item.zoningLimit);
  if (withLimit.length > 0) {
    withLimit.forEach((item) => {
      const { buildingCoverageMax, floorAreaRatioMin, floorAreaRatioMax } = item.zoningLimit;
      const row = document.createElement('p');
      row.innerHTML = `<strong>${item.name}</strong>: 건폐율 ${buildingCoverageMax}% 이하, 용적률 ${floorAreaRatioMin}~${floorAreaRatioMax}%`;
      els.zoningLimitList.appendChild(row);
    });
  } else {
    els.zoningLimitList.innerHTML = '<p>법정 상한이 정의된 용도지역 지정 정보가 없습니다(용도지구/구역은 별도 기준 적용).</p>';
  }
  els.zoningDisclaimer.textContent = data.zoningDisclaimer || '';
  els.legalBasisText.textContent = data.zoningLegalBasis || '관련 법령 정보가 없습니다.';

  massingCalculator.setContext({ area: data.area, zoningLimit: withLimit[0]?.zoningLimit || null });

  if (data.warnings && data.warnings.length > 0) {
    els.warnings.hidden = false;
    els.warnings.innerHTML = data.warnings.map((w) => `<div>${w}</div>`).join('');
  } else {
    els.warnings.hidden = true;
    els.warnings.innerHTML = '';
  }
}
