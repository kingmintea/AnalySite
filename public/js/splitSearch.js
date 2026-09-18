// 시/구/동/번지로 나눠 입력하는 폼 ↔ 단일 주소 입력 폼을 토글하고,
// 나눠 입력한 값을 하나의 주소 문자열로 합쳐 지오코딩에 그대로 넘긴다.
export function initSplitSearch({ toggleId, singleFormId, splitFormId, fieldIds, onSubmit }) {
  const toggleBtn = document.getElementById(toggleId);
  const singleForm = document.getElementById(singleFormId);
  const splitForm = document.getElementById(splitFormId);

  let showingSplit = false;

  toggleBtn.addEventListener('click', () => {
    showingSplit = !showingSplit;
    singleForm.hidden = showingSplit;
    splitForm.hidden = !showingSplit;
    toggleBtn.textContent = showingSplit ? '주소 한 번에 검색' : '시/구/동/번지로 나눠 검색';
  });

  splitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const address = fieldIds
      .map((id) => document.getElementById(id).value.trim())
      .filter(Boolean)
      .join(' ');
    if (!address) return;
    onSubmit(address);
  });
}
