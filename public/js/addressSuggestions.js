export function bindAddressSuggestions(inputId, suggestionsId) {
  const input = document.getElementById(inputId);
  const suggestions = document.getElementById(suggestionsId);
  if (!input || !suggestions) return;
  let timer = null;

  function closeSuggestions() {
    suggestions.hidden = true;
    suggestions.replaceChildren();
  }

  function showSuggestions(addresses) {
      const topAddresses = addresses.slice(0, 3);
    suggestions.replaceChildren(
        ...topAddresses.map((address) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'address-suggestion';
        button.innerHTML = `<strong>${address.roadAddress}</strong><small>${address.jibunAddress || ''}</small>`;
        button.addEventListener('click', () => {
          input.value = address.roadAddress;
          closeSuggestions();
          input.focus();
        });
        return button;
      })
    );
    suggestions.hidden = topAddresses.length === 0;
  }

  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    const keyword = input.value.trim();
    if (keyword.length < 2) {
      closeSuggestions();
      return;
    }

    timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/address-search?keyword=${encodeURIComponent(keyword)}`);
        if (!res.ok) {
          closeSuggestions();
          return;
        }
        const addresses = await res.json();
        showSuggestions(addresses);
      } catch {
        closeSuggestions();
      }
    }, 250);
  });

  document.addEventListener('click', (event) => {
    if (!suggestions.parentElement.contains(event.target)) closeSuggestions();
  });
}