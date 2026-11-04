import { badgeForTarget, isStaleTarget } from './lib/badge.js';
import { shouldNotify, notificationFor } from './lib/notify.js';
import {
  MANIFEST_URL,
  RELEASE_URL,
  parseVersion,
  shouldCheckToday,
  shouldAnnounce,
} from './lib/update.js';

const ALARM = 'adp-hours-tick';
const TARGET_KEY = 'target';
const NOTIFIED_KEY = 'notifiedFor';
const UPDATE_NOTIFICATION = 'adp-hours-update';

let checkingForUpdate = false;

// Runs at most once a day, piggybacking on the first message from the ADP page.
async function checkForUpdate() {
  if (checkingForUpdate) return;
  checkingForUpdate = true;
  try {
    const { lastUpdateCheck = null, announcedVersion = null } =
      await chrome.storage.local.get(['lastUpdateCheck', 'announcedVersion']);
    const now = Date.now();
    if (!shouldCheckToday(lastUpdateCheck, now)) return;

    const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) return;
    const remote = parseVersion(await response.json());
    if (!remote) return;

    const current = chrome.runtime.getManifest().version;
    await chrome.storage.local.set({
      lastUpdateCheck: new Date(now).toDateString(),
      latestVersion: remote,
    });

    if (shouldAnnounce(remote, current, announcedVersion)) {
      await chrome.storage.local.set({ announcedVersion: remote });
      chrome.notifications.create(UPDATE_NOTIFICATION, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Nova versão do ADP Hours',
        message: `A versão ${remote} está disponível (você tem a ${current}). Clique para baixar.`,
      });
    }
  } catch {
    // Offline or blocked: try again on the next message.
  } finally {
    checkingForUpdate = false;
  }
}

chrome.notifications.onClicked.addListener((id) => {
  if (id !== UPDATE_NOTIFICATION) return;
  chrome.tabs.create({ url: RELEASE_URL });
  chrome.notifications.clear(id);
});

async function render() {
  const { [TARGET_KEY]: target = null, [NOTIFIED_KEY]: notifiedFor = null } =
    await chrome.storage.local.get([TARGET_KEY, NOTIFIED_KEY]);
  const now = Date.now();

  if (target && isStaleTarget(target.atMs, now)) {
    await chrome.storage.local.remove(TARGET_KEY);
    await chrome.action.setBadgeText({ text: '' });
    return;
  }

  const badge = badgeForTarget(target ? target.atMs : null, now);
  if (!badge) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });

  if (shouldNotify(target, notifiedFor, now)) {
    await chrome.storage.local.set({ [NOTIFIED_KEY]: target.atMs });
    const content = notificationFor(target.kind);
    if (content) {
      chrome.notifications.create(`adp-hours-${target.atMs}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: content.title,
        message: content.message,
        requireInteraction: true,
      });
    }
  }
}

function startTicking() {
  chrome.alarms.create(ALARM, { periodInMinutes: 1 });
  render();
}

chrome.runtime.onInstalled.addListener(startTicking);
chrome.runtime.onStartup.addListener(startTicking);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) render();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== 'TARGET_UPDATE') return;
  checkForUpdate();
  const write = msg.atMs == null
    ? chrome.storage.local.remove(TARGET_KEY)
    : chrome.storage.local.set({ [TARGET_KEY]: { atMs: msg.atMs, kind: msg.kind } });
  write.then(render);
});
