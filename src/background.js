import { badgeForTarget, isStaleTarget } from './lib/badge.js';

const ALARM = 'adp-hours-tick';
const TARGET_KEY = 'targetMs';

async function render() {
  const { [TARGET_KEY]: targetMs = null } = await chrome.storage.local.get(TARGET_KEY);
  const now = Date.now();
  if (targetMs != null && isStaleTarget(targetMs, now)) {
    await chrome.storage.local.remove(TARGET_KEY);
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const badge = badgeForTarget(targetMs, now);
  if (!badge) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
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
    : chrome.storage.local.set({ [TARGET_KEY]: msg.atMs });
  write.then(render);
});
