const REPOSITORY = 'RodrigoRosaDantas/sedes-tdas-dashboard';
const WORKFLOW_URL = `https://github.com/${REPOSITORY}/actions/workflows/notion-sync.yml`;

function installUpdateButtonFix() {
  const current = document.querySelector('[data-pro26-sync-open]');
  if (!current || current.dataset.mobileNavigationFix === '1') return Boolean(current);

  // The original handler awaits a network check before window.open(). On mobile
  // browsers that can consume the transient user activation and the new tab is
  // blocked as a popup. Replacing the node removes that fragile handler and
  // performs a synchronous, same-tab navigation instead.
  const button = current.cloneNode(true);
  button.dataset.mobileNavigationFix = '1';
  button.setAttribute('aria-label', 'Abrir atualização de dados no GitHub Actions');
  current.replaceWith(button);

  button.addEventListener('click', () => {
    window.location.assign(WORKFLOW_URL);
  });

  return true;
}

if (!installUpdateButtonFix()) {
  const observer = new MutationObserver(() => {
    if (installUpdateButtonFix()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
