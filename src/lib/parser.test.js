import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parseRows } from './parser.js';

function tableFrom(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`);
  return dom.window.document.querySelector('table');
}

const SAMPLE_4_PUNCHES = `
<table data-testid="ctn_table-punchin">
  <tbody>
    <tr><td></td><td><b>17:38 h</b></td><td class="text-right">25/05/2026</td></tr>
    <tr><td></td><td><b>13:53 h</b></td><td class="text-right">25/05/2026</td></tr>
    <tr><td></td><td><b>12:42 h</b></td><td class="text-right">25/05/2026</td></tr>
    <tr><td></td><td><b>07:56 h</b></td><td class="text-right">25/05/2026</td></tr>
  </tbody>
</table>`;

test('parseRows extracts time and dateStr for each row', () => {
  const rows = parseRows(tableFrom(SAMPLE_4_PUNCHES));
  assert.equal(rows.length, 4);
  assert.equal(rows[0].dateStr, '25/05/2026');
  assert.equal(rows[0].time.getHours(), 17);
  assert.equal(rows[0].time.getMinutes(), 38);
  assert.equal(rows[3].time.getHours(), 7);
  assert.equal(rows[3].time.getMinutes(), 56);
});

test('parseRows returns empty array for empty tbody', () => {
  const rows = parseRows(tableFrom('<table><tbody></tbody></table>'));
  assert.deepEqual(rows, []);
});

test('parseRows skips malformed rows silently', () => {
  const html = `
  <table><tbody>
    <tr><td></td><td><b>not a time</b></td><td>25/05/2026</td></tr>
    <tr><td></td><td><b>09:00 h</b></td><td>oops</td></tr>
    <tr><td></td><td><b>10:30 h</b></td><td>25/05/2026</td></tr>
  </tbody></table>`;
  const rows = parseRows(tableFrom(html));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].time.getHours(), 10);
  assert.equal(rows[0].time.getMinutes(), 30);
});

test('parseRows handles multi-date table', () => {
  const html = `
  <table><tbody>
    <tr><td></td><td><b>09:00 h</b></td><td>24/05/2026</td></tr>
    <tr><td></td><td><b>10:00 h</b></td><td>25/05/2026</td></tr>
  </tbody></table>`;
  const rows = parseRows(tableFrom(html));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].dateStr, '24/05/2026');
  assert.equal(rows[1].dateStr, '25/05/2026');
});

test('mergeRows keeps remembered punches the 4-row table cut off', async () => {
  const { mergeRows } = await import('./parser.js');
  const { computeState } = await import('./calculator.js');
  const at = (h, m) => new Date(2026, 9, 30, h, m);
  const row = (h, m) => ({ time: at(h, m), dateStr: '30/10/2026' });
  const table = [row(16, 24), row(15, 13), row(12, 44), row(11, 44)];
  const remembered = [row(7, 2), row(11, 44), row(12, 44)];
  const rows = mergeRows(table, remembered);
  assert.equal(rows.length, 5);
  const state = computeState(rows, at(16, 47));
  assert.equal(state.punchCount, 5);
  assert.equal(Math.round(state.workedMs / 60000), 7 * 60 + 11 + 23);
  assert.equal(state.next.kind, 'out');
});

test('mergeRows preserves duplicate same-minute punches from primary source', async () => {
  const { mergeRows } = await import('./parser.js');
  const at = (h, m) => new Date(2026, 9, 30, h, m);
  const row = (h, m) => ({ time: at(h, m), dateStr: '30/10/2026' });
  const table = [row(12, 0), row(12, 0)];
  const remembered = [row(12, 0)];
  const rows = mergeRows(table, remembered);
  assert.equal(rows.length, 2);
});
