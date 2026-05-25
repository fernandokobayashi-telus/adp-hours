import { formatDateBR } from './formatter.js';

export const TARGET_MS = 8 * 60 * 60 * 1000;
export const LUNCH_MS = 60 * 60 * 1000;

export function computeState(rows, now) {
  const today = formatDateBR(now);
  const todays = rows
    .filter((r) => r.dateStr === today)
    .map((r) => r.time.getTime())
    .sort((a, b) => a - b);
  const n = todays.length;
  const nowMs = now.getTime();

  if (n === 0) {
    return { workedMs: 0, punchCount: 0, isOverTarget: false, suggestions: {} };
  }

  let completedMs = 0;
  for (let i = 0; i + 1 < n; i += 2) {
    completedMs += Math.max(0, todays[i + 1] - todays[i]);
  }

  const isOpen = n % 2 === 1;
  const openMs = isOpen ? Math.max(0, nowMs - todays[n - 1]) : 0;
  const workedMs = completedMs + openMs;
  const isOverTarget = workedMs >= TARGET_MS;

  const suggestions = {};

  if (!isOverTarget) {
    if (isOpen) {
      const remaining = TARGET_MS - completedMs;
      suggestions.punchOutAt = new Date(todays[n - 1] + remaining);
    } else if (n === 2) {
      const returnMs = todays[1] + LUNCH_MS;
      suggestions.returnAt = new Date(returnMs);
      suggestions.punchOutAt = new Date(returnMs + (TARGET_MS - completedMs));
    }
  }

  return { workedMs, punchCount: n, isOverTarget, suggestions };
}
