export const MANIFEST_URL =
  'https://raw.githubusercontent.com/fernandokobayashi-telus/adp-hours/main/manifest.json';
export const RELEASE_URL =
  'https://github.com/fernandokobayashi-telus/adp-hours/releases/tag/latest';

const VERSION_PATTERN = /^\d+(\.\d+)*$/;

export function parseVersion(manifest) {
  const version = manifest?.version;
  return typeof version === 'string' && VERSION_PATTERN.test(version) ? version : null;
}

export function isNewerVersion(candidate, current) {
  if (!parseVersion({ version: candidate }) || !parseVersion({ version: current })) return false;
  const a = candidate.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

export function shouldCheckToday(lastCheckedDay, nowMs) {
  return lastCheckedDay !== new Date(nowMs).toDateString();
}

export function shouldAnnounce(remote, current, announced) {
  return isNewerVersion(remote, current) && announced !== remote;
}
