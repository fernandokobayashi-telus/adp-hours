import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRemaining,
  badgeForTarget,
  isStaleTarget,
  UPCOMING_COLOR,
  LATE_COLOR,
} from './badge.js';

const MIN = 60 * 1000;
const at = (hh, mm, day = 25) => new Date(2026, 4, day, hh, mm, 0, 0).getTime();

test('formatRemaining: ≥ 1h → XhMM', () => {
  assert.equal(formatRemaining(2 * 60 * MIN + 15 * MIN), '2h15');
  assert.equal(formatRemaining(60 * MIN), '1h00');
  assert.equal(formatRemaining(9 * 60 * MIN + 5 * MIN), '9h05');
});

test('formatRemaining: < 1h → Nm', () => {
  assert.equal(formatRemaining(45 * MIN), '45m');
  assert.equal(formatRemaining(1 * MIN), '1m');
});

test('formatRemaining: rounds a partial minute up, so it never reads 0m early', () => {
  assert.equal(formatRemaining(20 * 1000), '1m');
  assert.equal(formatRemaining(0), '0m');
});

test('formatRemaining: late → -Nm up to 99m', () => {
  assert.equal(formatRemaining(-5 * MIN), '-5m');
  assert.equal(formatRemaining(-99 * MIN), '-99m');
  assert.equal(formatRemaining(-1), '-1m');
});

test('formatRemaining: late beyond 99m → -Nh', () => {
  assert.equal(formatRemaining(-100 * MIN), '-1h');
  assert.equal(formatRemaining(-125 * MIN), '-2h');
});

test('formatRemaining: never exceeds 4 characters', () => {
  for (const min of [-600, -125, -100, -99, -1, 0, 1, 59, 60, 125, 599]) {
    assert.ok(formatRemaining(min * MIN).length <= 4, `${min}m too long`);
  }
});

test('badgeForTarget: no target → null', () => {
  assert.equal(badgeForTarget(null, at(10, 0)), null);
});

test('badgeForTarget: upcoming → remaining text in upcoming color', () => {
  assert.deepEqual(badgeForTarget(at(18, 0), at(15, 45)), {
    text: '2h15',
    color: UPCOMING_COLOR,
  });
});

test('badgeForTarget: exactly on time → upcoming color', () => {
  assert.deepEqual(badgeForTarget(at(18, 0), at(18, 0)), {
    text: '0m',
    color: UPCOMING_COLOR,
  });
});

test('badgeForTarget: already late → negative text in late color', () => {
  assert.deepEqual(badgeForTarget(at(18, 0), at(18, 7)), {
    text: '-7m',
    color: LATE_COLOR,
  });
});

test('badgeForTarget: upcoming and late colors differ', () => {
  assert.notEqual(UPCOMING_COLOR, LATE_COLOR);
});

test('isStaleTarget: same day → not stale', () => {
  assert.equal(isStaleTarget(at(18, 0), at(9, 0)), false);
  assert.equal(isStaleTarget(at(18, 0), at(23, 59)), false);
});

test('isStaleTarget: target from a previous day → stale', () => {
  assert.equal(isStaleTarget(at(18, 0, 24), at(7, 0, 25)), true);
});
