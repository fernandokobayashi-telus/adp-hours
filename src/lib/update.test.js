import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewerVersion, parseVersion, shouldCheckToday, shouldAnnounce } from './update.js';

const NOW = new Date(2026, 10, 4, 9, 0, 0).getTime();
const TOMORROW = new Date(2026, 10, 5, 9, 0, 0).getTime();

test('isNewerVersion: higher patch/minor/major → true', () => {
  assert.equal(isNewerVersion('0.3.2', '0.3.1'), true);
  assert.equal(isNewerVersion('0.4.0', '0.3.9'), true);
  assert.equal(isNewerVersion('1.0.0', '0.9.9'), true);
});

test('isNewerVersion: compares numerically, not as strings', () => {
  assert.equal(isNewerVersion('0.10.0', '0.9.0'), true);
  assert.equal(isNewerVersion('0.9.0', '0.10.0'), false);
});

test('isNewerVersion: equal or older → false', () => {
  assert.equal(isNewerVersion('0.3.1', '0.3.1'), false);
  assert.equal(isNewerVersion('0.3.0', '0.3.1'), false);
});

test('isNewerVersion: missing segments count as zero', () => {
  assert.equal(isNewerVersion('1.0', '1.0.0'), false);
  assert.equal(isNewerVersion('1.0.1', '1.0'), true);
});

test('isNewerVersion: malformed input → false', () => {
  assert.equal(isNewerVersion('abc', '0.3.1'), false);
  assert.equal(isNewerVersion(undefined, '0.3.1'), false);
  assert.equal(isNewerVersion('0.4.0', null), false);
});

test('parseVersion: reads version from a manifest object', () => {
  assert.equal(parseVersion({ version: '0.4.0' }), '0.4.0');
});

test('parseVersion: rejects missing or malformed versions', () => {
  assert.equal(parseVersion(null), null);
  assert.equal(parseVersion({}), null);
  assert.equal(parseVersion({ version: '0.4.0-beta' }), null);
  assert.equal(parseVersion({ version: 4 }), null);
});

test('shouldCheckToday: never checked → true', () => {
  assert.equal(shouldCheckToday(null, NOW), true);
});

test('shouldCheckToday: already checked today → false', () => {
  assert.equal(shouldCheckToday(new Date(2026, 10, 4, 8, 0).toDateString(), NOW), false);
});

test('shouldCheckToday: last checked yesterday → true', () => {
  assert.equal(shouldCheckToday(new Date(NOW).toDateString(), TOMORROW), true);
});

test('shouldAnnounce: newer and not yet announced → true', () => {
  assert.equal(shouldAnnounce('0.4.0', '0.3.1', null), true);
});

test('shouldAnnounce: same version already announced → false', () => {
  assert.equal(shouldAnnounce('0.4.0', '0.3.1', '0.4.0'), false);
});

test('shouldAnnounce: newer than the one announced before → true', () => {
  assert.equal(shouldAnnounce('0.5.0', '0.3.1', '0.4.0'), true);
});

test('shouldAnnounce: not newer than installed → false', () => {
  assert.equal(shouldAnnounce('0.3.1', '0.3.1', null), false);
});
