import { badgeForTarget, isStaleTarget } from './lib/badge.js';
import { shouldNotify, notificationFor } from './lib/notify.js';

const ALARM = 'adp-hours-tick';
const TARGET_KEY = 'target';
const NOTIFIED_KEY = 'notifiedFor';

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
        iconUrl: 'icons/icon128.png',
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
  const write = msg.atMs == null
    ? chrome.storage.local.remove(TARGET_KEY)
    : chrome.storage.local.set({ [TARGET_KEY]: { atMs: msg.atMs, kind: msg.kind } });
  write.then(render);
});
