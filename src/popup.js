import { renderBanner, lunchReminder } from './lib/render.js';
import { isNewerVersion, RELEASE_URL } from './lib/update.js';

const HOST_PATTERN = /^https:\/\/expert\.hcm\.adp\.com\/expert\/v5\//;

function reviveState(raw) {
  return {
    workedMs: raw.workedMs,
    punchCount: raw.punchCount,
    isOverTarget: raw.isOverTarget,
    suggestions: {
      returnAt: raw.suggestions.returnAt ? new Date(raw.suggestions.returnAt) : undefined,
      punchOutAt: raw.suggestions.punchOutAt ? new Date(raw.suggestions.punchOutAt) : undefined,
    },
  };
}

function showMessage(text) {
  const root = document.getElementById('root');
  root.textContent = text;
  root.className = 'adp-hours-empty';
}

async function showUpdateNotice() {
  const { latestVersion } = await chrome.storage.local.get('latestVersion');
  const current = chrome.runtime.getManifest().version;
  if (!isNewerVersion(latestVersion, current)) return;
  const link = document.getElementById('update');
  link.href = RELEASE_URL;
  link.target = '_blank';
  link.textContent = `Nova versão ${latestVersion} disponível`;
  link.hidden = false;
}

async function main() {
  showUpdateNotice();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !HOST_PATTERN.test(tab.url)) {
    showMessage('Abra a página de ponto da ADP.');
    return;
  }
  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
  } catch (e) {
    showMessage('Página ainda carregando. Recarregue e tente de novo.');
    return;
  }
  if (!response || !response.ok || !response.state) {
    showMessage('Sem dados de ponto encontrados.');
    return;
  }
  const state = reviveState(response.state);
  const root = document.getElementById('root');
  root.textContent = '';
  root.className = '';
  root.appendChild(renderBanner(state, document));

  const reminder = lunchReminder(state);
  if (reminder) {
    const el = document.createElement('div');
    el.className = 'adp-hours-reminder';
    el.textContent = reminder;
    root.appendChild(el);
  }
}

main();
