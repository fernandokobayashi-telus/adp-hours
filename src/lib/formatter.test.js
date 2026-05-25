import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, formatTime, formatDateBR } from './formatter.js';

test('formatDuration zero', () => {
  assert.equal(formatDuration(0), '0m');
});
test('formatDuration only minutes', () => {
  assert.equal(formatDuration(45 * 60 * 1000), '45m');
});
test('formatDuration only hours', () => {
  assert.equal(formatDuration(8 * 60 * 60 * 1000), '8h');
});
test('formatDuration hours and minutes', () => {
  assert.equal(formatDuration((8 * 60 + 31) * 60 * 1000), '8h 31m');
});
test('formatDuration rounds down sub-minute remainders', () => {
  assert.equal(formatDuration(59 * 1000), '0m');
  assert.equal(formatDuration((60 + 30) * 1000), '1m');
});
test('formatDuration negative clamped to zero', () => {
  assert.equal(formatDuration(-5000), '0m');
});

test('formatTime HH:MM 24h', () => {
  assert.equal(formatTime(new Date(2026, 4, 25, 7, 5)), '07:05');
  assert.equal(formatTime(new Date(2026, 4, 25, 17, 38)), '17:38');
});

test('formatDateBR DD/MM/YYYY', () => {
  assert.equal(formatDateBR(new Date(2026, 4, 25)), '25/05/2026');
  assert.equal(formatDateBR(new Date(2026, 0, 3)), '03/01/2026');
});
