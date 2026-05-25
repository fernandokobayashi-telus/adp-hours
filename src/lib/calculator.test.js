import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeState, TARGET_MS, LUNCH_MS } from './calculator.js';

function d(dateStr, hh, mm) {
  const [day, mo, yyyy] = dateStr.split('/').map(Number);
  return new Date(yyyy, mo - 1, day, hh, mm, 0, 0);
}
function row(dateStr, hh, mm) {
  return { time: d(dateStr, hh, mm), dateStr };
}
const TODAY = '25/05/2026';
const NOW = (hh, mm) => d(TODAY, hh, mm);

test('0 punches today → zero state', () => {
  const state = computeState([], NOW(10, 0));
  assert.equal(state.workedMs, 0);
  assert.equal(state.punchCount, 0);
  assert.equal(state.isOverTarget, false);
  assert.deepEqual(state.suggestions, {});
});

test('1 punch → open shift, workedMs = now − p1, punchOutAt = p1 + 8h', () => {
  const state = computeState([row(TODAY, 9, 0)], NOW(11, 30));
  assert.equal(state.workedMs, 2.5 * 60 * 60 * 1000);
  assert.equal(state.punchCount, 1);
  assert.equal(state.isOverTarget, false);
  assert.deepEqual(state.suggestions.returnAt, undefined);
  assert.deepEqual(state.suggestions.punchOutAt, d(TODAY, 17, 0));
});

test('2 punches (on lunch) → returnAt = p2 + 1h, punchOutAt = returnAt + (8h − morning)', () => {
  const state = computeState(
    [row(TODAY, 7, 56), row(TODAY, 12, 42)],
    NOW(13, 0),
  );
  const morning = (12 * 60 + 42 - 7 * 60 - 56) * 60 * 1000; // 4h46m
  assert.equal(state.workedMs, morning);
  assert.equal(state.punchCount, 2);
  assert.deepEqual(state.suggestions.returnAt, d(TODAY, 13, 42));
  assert.deepEqual(state.suggestions.punchOutAt, d(TODAY, 16, 56));
});

test('3 punches (afternoon open) → punchOutAt = p3 + (8h − morning)', () => {
  const state = computeState(
    [row(TODAY, 7, 56), row(TODAY, 12, 42), row(TODAY, 13, 53)],
    NOW(16, 0),
  );
  const morning = (12 * 60 + 42 - 7 * 60 - 56) * 60 * 1000;
  const afternoonSoFar = (16 * 60 - 13 * 60 - 53) * 60 * 1000;
  assert.equal(state.workedMs, morning + afternoonSoFar);
  assert.equal(state.punchCount, 3);
  assert.equal(state.suggestions.returnAt, undefined);
  assert.deepEqual(state.suggestions.punchOutAt, d(TODAY, 17, 7));
});

test('4 punches (done) → no suggestions, isOverTarget if ≥ 8h', () => {
  const state = computeState(
    [row(TODAY, 7, 56), row(TODAY, 12, 42), row(TODAY, 13, 53), row(TODAY, 17, 38)],
    NOW(17, 40),
  );
  assert.equal(state.workedMs, (8 * 60 + 31) * 60 * 1000);
  assert.equal(state.punchCount, 4);
  assert.equal(state.isOverTarget, true);
  assert.deepEqual(state.suggestions, {});
});

test('4 punches under target (left-early) → no suggestion, not over', () => {
  const state = computeState(
    [row(TODAY, 9, 0), row(TODAY, 12, 0), row(TODAY, 13, 0), row(TODAY, 16, 20)],
    NOW(17, 0),
  );
  assert.equal(state.workedMs, (6 * 60 + 20) * 60 * 1000);
  assert.equal(state.isOverTarget, false);
  assert.deepEqual(state.suggestions, {});
});

test('open shift already past 8h → no punchOutAt', () => {
  const state = computeState(
    [row(TODAY, 7, 0), row(TODAY, 12, 0), row(TODAY, 13, 0)],
    NOW(18, 30),
  );
  assert.equal(state.isOverTarget, true);
  assert.equal(state.suggestions.punchOutAt, undefined);
});

test('multi-date rows → only today counted', () => {
  const state = computeState(
    [
      row('24/05/2026', 9, 0),
      row('24/05/2026', 17, 0),
      row(TODAY, 9, 0),
      row(TODAY, 12, 0),
    ],
    NOW(13, 0),
  );
  assert.equal(state.punchCount, 2);
  assert.equal(state.workedMs, 3 * 60 * 60 * 1000);
});

test('5+ punches, second open shift → punchOutAt = pn + (8h − completed)', () => {
  const state = computeState(
    [
      row(TODAY, 8, 0),
      row(TODAY, 10, 0),
      row(TODAY, 10, 30),
      row(TODAY, 12, 0),
      row(TODAY, 13, 0),
    ],
    NOW(14, 0),
  );
  const completed = (3 * 60 + 30) * 60 * 1000;
  assert.equal(state.workedMs, completed + 60 * 60 * 1000);
  assert.deepEqual(state.suggestions.punchOutAt, d(TODAY, 17, 30));
});

test('TARGET_MS and LUNCH_MS are exported as expected', () => {
  assert.equal(TARGET_MS, 8 * 3_600_000);
  assert.equal(LUNCH_MS, 3_600_000);
});
