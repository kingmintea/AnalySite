// 시/도 셀렉트 채움 + 다음(카카오) 우편번호 서비스로 주소를 검색해 시/군/구·동·번지를 자동
// 채우는 헬퍼. 다음 우편번호 서비스는 별도 API 키 없이 클라이언트에서 바로 쓸 수 있는 공개 위젯이다.

export const SIDO_LIST = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시',
  '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도',
  '경상북도', '경상남도', '제주특별자치도',
];

// 다음 우편번호 서비스가 반환하는 축약형 시/도 이름을 위 목록의 정식 명칭으로 맞춘다.
const SIDO_ALIASES = {
  서울: '서울특별시', 부산: '부산광역시', 대구: '대구광역시', 인천: '인천광역시',
  광주: '광주광역시', 대전: '대전광역시', 울산: '울산광역시', 세종: '세종특별자치시',
  경기: '경기도', 강원: '강원특별자치도', 충북: '충청북도', 충남: '충청남도',
  전북: '전북특별자치도', 전남: '전라남도', 경북: '경상북도', 경남: '경상남도', 제주: '제주특별자치도',
};

function normalizeSido(rawSido) {
  if (SIDO_LIST.includes(rawSido)) return rawSido;
  return SIDO_ALIASES[rawSido] || rawSido;
}

// 지번주소 전체 문자열에서 시/도·시군구·법정동을 제거하고 남는 번지만 뽑아낸다.
// 예: "서울 성북구 안암동2가 40" -> "40". 건물명이 괄호로 붙는 경우("... 40 (안암빌라)")도 있어
// 먼저 떼어낸다.
function extractBunji(jibunAddress, rawSido, sigungu, bname) {
  if (!jibunAddress) return '';
  let rest = jibunAddress.replace(/\s*\([^)]*\)\s*$/, '');
  [rawSido, sigungu, bname].forEach((part) => {
    if (part) rest = rest.replace(part, '');
  });
  return rest.trim().split(/\s+/).pop() || '';
}

export function populateSidoSelect(selectEl) {
  selectEl.innerHTML = [
    '<option value="">시/도 선택</option>',
    ...SIDO_LIST.map((s) => `<option value="${s}">${s}</option>`),
  ].join('');
}

// 다음 우편번호 검색을 새 팝업 창(window.open)으로 여는 daum.Postcode의 기본 .open() 모드는
// 브라우저 팝업 차단기에 막히기 쉬워, 대신 직접 만든 모달 안에 iframe을 끼워넣는 .embed() 모드를
// 쓴다.
let modalEl = null;
let embedEl = null;

function closeModal() {
  if (modalEl) modalEl.hidden = true;
}

function ensureModal() {
  if (modalEl) return;
  modalEl = document.createElement('div');
  modalEl.className = 'address-search-modal';
  modalEl.hidden = true;
  modalEl.innerHTML = `
    <div class="address-search-modal-backdrop"></div>
    <div class="address-search-modal-box">
      <button type="button" class="address-search-modal-close" aria-label="닫기">×</button>
      <div class="address-search-embed"></div>
    </div>
  `;
  document.body.appendChild(modalEl);
  embedEl = modalEl.querySelector('.address-search-embed');
  modalEl.querySelector('.address-search-modal-close').addEventListener('click', closeModal);
  modalEl.querySelector('.address-search-modal-backdrop').addEventListener('click', closeModal);
}

// 다음 우편번호 검색 모달을 열고, 선택 결과를 { sido, sigungu, bname, bunji, roadAddress } 형태로
// 콜백에 전달한다.
export function openAddressSearch(onResult) {
  if (typeof window.daum === 'undefined' || !window.daum.Postcode) {
    alert('주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    return;
  }
  ensureModal();
  embedEl.innerHTML = '';
  modalEl.hidden = false;

  new window.daum.Postcode({
    oncomplete(data) {
      closeModal();
      const sido = normalizeSido(data.sido);
      const sigungu = data.sigungu || '';
      const bname = data.bname || '';
      const bunji = extractBunji(data.jibunAddress, data.sido, sigungu, bname);
      onResult({ sido, sigungu, bname, bunji, roadAddress: data.roadAddress, jibunAddress: data.jibunAddress });
    },
    width: '100%',
    height: '100%',
  }).embed(embedEl);
}

// 시/도 select + 구/동/번지 input 4개를 다음 주소 검색 결과로 채워주는 버튼을 연결한다.
export function bindAddressSearchButton(buttonId, [siId, guId, dongId, bunjiId]) {
  document.getElementById(buttonId).addEventListener('click', () => {
    openAddressSearch(({ sido, sigungu, bname, bunji }) => {
      document.getElementById(siId).value = sido;
      document.getElementById(guId).value = sigungu;
      document.getElementById(dongId).value = bname;
      document.getElementById(bunjiId).value = bunji;
    });
  });
}
