import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldNotify, notificationFor } from './notify.js';

const MIN = 60 * 1000;
const AT = new Date(2026, 4, 25, 18, 0, 0, 0).getTime();
const target = { atMs: AT, kind: 'out' };

test('shouldNotify: no target → false', () => {
  assert.equal(shouldNotify(null, null, AT), false);
});

test('shouldNotify: before the target time → false', () => {
  assert.equal(shouldNotify(target, null, AT - MIN), false);
});

test('shouldNotify: exactly at the target time → true', () => {
  assert.equal(shouldNotify(target, null, AT), true);
});

test('shouldNotify: noticed after the target time (opened late) → true', () => {
  assert.equal(shouldNotify(target, null, AT + 30 * MIN), true);
});

test('shouldNotify: already notified for this target → false', () => {
  assert.equal(shouldNotify(target, AT, AT + MIN), false);
});

test('shouldNotify: notified for an earlier target → true for the new one', () => {
  const earlier = AT - 4 * 60 * MIN;
  assert.equal(shouldNotify(target, earlier, AT), true);
});

test('notificationFor: return → lunch is over', () => {
  assert.deepEqual(notificationFor('return'), {
    title: 'Hora de voltar do almoço',
    message: 'Seu 1h de almoço acabou. Bata o ponto de volta.',
  });
});

test('notificationFor: out → 8h complete', () => {
  assert.deepEqual(notificationFor('out'), {
    title: '8h completas',
    message: 'Você já pode bater o ponto de saída.',
  });
});

test('notificationFor: unknown kind → null', () => {
  assert.equal(notificationFor(undefined), null);
  assert.equal(notificationFor('lunch'), null);
});
