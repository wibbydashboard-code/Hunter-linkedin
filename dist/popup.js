document.getElementById('open').addEventListener('click', (event) => {
  event.preventDefault();
  if (globalThis.chrome?.runtime?.openOptionsPage) chrome.runtime.openOptionsPage();
  else window.open('index.html', '_blank', 'noopener');
  window.close();
});
