import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderBanner } from './render.js';
import { TARGET_MS } from './calculator.js';

function newDoc() {
  return new JSDOM('<!DOCTYPE html><body></body>').window.document;
}

test('renders zero state with "Sem batidas hoje"', () => {
  const doc = newDoc();
  const el = renderBanner(
    { workedMs: 0, punchCount: 0, isOverTarget: false, suggestions: {} },
    doc,
  );
  assert.equal(el.querySelector('.adp-hours-line1').textContent, 'Trabalhado hoje: 0m');
  assert.equal(el.querySelector('.adp-hours-line2').textContent, 'Sem batidas hoje');
});

test('renders open-shift state with punch-out suggestion', () => {
  const doc = newDoc();
  const punchOutAt = new Date(2026, 4, 25, 17, 7);
  const el = renderBanner(
    {
      workedMs: (6 * 60 + 53) * 60 * 1000,
      punchCount: 3,
      isOverTarget: false,
      suggestions: { punchOutAt },
    },
    doc,
  );
  assert.equal(el.querySelector('.adp-hours-line1').textContent, 'Trabalhado hoje: 6h 53m');
  assert.equal(el.querySelector('.adp-hours-line2').textContent, 'Saia às 17:07 para 8h');
});

test('renders lunch state with return + punch-out', () => {
  const doc = newDoc();
  const el = renderBanner(
    {
      workedMs: (4 * 60 + 46) * 60 * 1000,
      punchCount: 2,
      isOverTarget: false,
      suggestions: {
        returnAt: new Date(2026, 4, 25, 13, 42),
        punchOutAt: new Date(2026, 4, 25, 16, 56),
      },
    },
    doc,
  );
  assert.equal(
    el.querySelector('.adp-hours-line2').textContent,
    'Volte às 13:42 · Saia às 16:56 para 8h',
  );
});

test('renders over-target state with extras', () => {
  const doc = newDoc();
  const el = renderBanner(
    {
      workedMs: TARGET_MS + 31 * 60 * 1000,
      punchCount: 4,
      isOverTarget: true,
      suggestions: {},
    },
    doc,
  );
  assert.equal(el.querySelector('.adp-hours-line2').textContent, '✓ extras: 31m');
});

test('renders left-early state with deficit', () => {
  const doc = newDoc();
  const el = renderBanner(
    {
      workedMs: (6 * 60 + 20) * 60 * 1000,
      punchCount: 4,
      isOverTarget: false,
      suggestions: {},
    },
    doc,
  );
  assert.equal(el.querySelector('.adp-hours-line2').textContent, 'Faltam 1h 40m');
});

test('renderBanner is idempotent when given the same root element', () => {
  const doc = newDoc();
  doc.body.appendChild(doc.createElement('table'));
  const first = renderBanner(
    { workedMs: 0, punchCount: 0, isOverTarget: false, suggestions: {} },
    doc,
  );
  doc.body.appendChild(first);
  const second = renderBanner(
    { workedMs: 60 * 60 * 1000, punchCount: 1, isOverTarget: false, suggestions: { punchOutAt: new Date(2026,4,25,17,0) } },
    doc,
    first,
  );
  assert.strictEqual(first, second);
  assert.equal(first.querySelector('.adp-hours-line1').textContent, 'Trabalhado hoje: 1h');
});
