export const UPCOMING_COLOR = '#16a34a';
export const LATE_COLOR = '#dc2626';

const MIN_MS = 60 * 1000;

export function formatRemaining(ms) {
  if (ms >= 0) {
    const min = Math.ceil(ms / MIN_MS);
    if (min < 60) return `${min}m`;
    return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
  }
  const lateMin = Math.ceil(-ms / MIN_MS);
  if (lateMin <= 99) return `-${lateMin}m`;
  return `-${Math.floor(lateMin / 60)}h`;
}

export function badgeForTarget(atMs, nowMs) {
  if (atMs == null) return null;
  const remaining = atMs - nowMs;
  return {
    text: formatRemaining(remaining),
    color: remaining >= 0 ? UPCOMING_COLOR : LATE_COLOR,
  };
}

export function isStaleTarget(atMs, nowMs) {
  return new Date(atMs).toDateString() !== new Date(nowMs).toDateString();
}
