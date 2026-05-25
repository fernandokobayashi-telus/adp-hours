# ADP Hours Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Manifest V3 Chrome extension that reads the ADP punch-in table and tells the user the running worked-hours total plus the exact time to punch out for an 8h day, displayed both as a banner injected on the page and via a toolbar popup.

**Architecture:** Pure-function lib modules (`parser`, `calculator`, `formatter`, `render`) live under `src/lib/` as ES modules so they can be unit-tested directly with Node's built-in test runner. A single content script (`src/content.js`) dynamically imports those modules at runtime via `chrome.runtime.getURL`, runs a `MutationObserver` to find the ADP table even after SPA re-renders, computes state every 60 seconds, and inserts/updates the banner. A popup page (`src/popup.html` + `src/popup.js`) imports the same libs as ESM and asks the active tab for the current state via `chrome.tabs.sendMessage`. No service worker.

**Tech Stack:** Plain JavaScript (ES modules), Chrome Manifest V3, `node --test` for unit tests, `jsdom` for DOM-touching tests.

**Spec:** [docs/superpowers/specs/2026-05-25-adp-hours-extension-design.md](../specs/2026-05-25-adp-hours-extension-design.md)

---

## File Structure

```
adp-hours/
├── package.json              # ESM, test scripts, jsdom devDep
├── .gitignore
├── manifest.json             # MV3 manifest
├── README.md                 # How to load and use
├── src/
│   ├── content.js            # Content-script entry: observer + tick + message handler
│   ├── popup.html
│   ├── popup.js              # Popup entry: query tab, render state
│   └── lib/
│       ├── parser.js         # parseRows(tableEl) → rows[]
│       ├── parser.test.js
│       ├── calculator.js     # computeState(rows, now) → state, plus TARGET_MS / LUNCH_MS
│       ├── calculator.test.js
│       ├── formatter.js      # formatDuration / formatTime / formatDateBR
│       ├── formatter.test.js
│       ├── render.js         # renderBanner(state, doc) → HTMLElement
│       └── render.test.js
└── icons/
    └── icon128.png           # Single icon, Chrome scales as needed
```

The lib modules are pure and have zero `chrome.*` references — that boundary is what makes them testable in plain Node.

---

### Task 1: Scaffold project

**Files:**
- Create: `adp-hours/package.json`
- Create: `adp-hours/.gitignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "adp-hours",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test src/lib/*.test.js"
  },
  "devDependencies": {
    "jsdom": "^24.0.0"
  }
}
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
.DS_Store
*.log
```

- [ ] **Step 3: Install dev dependency**

Run: `cd adp-hours && npm install`
Expected: creates `node_modules/` and `package-lock.json`, no errors.

- [ ] **Step 4: Smoke-test the test runner**

Run: `cd adp-hours && npm test`
Expected: exits 0 (no test files match the glob yet, runner reports zero tests). If Node complains about the glob being literal on your shell, the next task creates the first test file and it'll resolve.

- [ ] **Step 5: Commit**

```bash
cd adp-hours
git add package.json package-lock.json .gitignore
git commit -m "chore: scaffold node project with jsdom for tests"
```

---

### Task 2: Implement `parser.js` (TDD)

**Files:**
- Create: `adp-hours/src/lib/parser.js`
- Create: `adp-hours/src/lib/parser.test.js`

The parser converts a `<table data-testid="ctn_table-punchin">` element into a sorted-by-insertion-order array of `{ time: Date, dateStr: 'DD/MM/YYYY' }`. It is pure (no globals, no `document` — the element is passed in). Rows that don't match the expected shape are skipped silently.

- [ ] **Step 1: Write the failing test file**

```javascript
// src/lib/parser.test.js
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
```

- [ ] **Step 2: Run test, verify failure**

Run: `cd adp-hours && npm test`
Expected: FAIL — `Cannot find module './parser.js'`.

- [ ] **Step 3: Implement `parser.js`**

```javascript
// src/lib/parser.js

const TIME_RE = /^(\d{2}):(\d{2})\s*h$/;
const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function parseRows(tableEl) {
  if (!tableEl) return [];
  const out = [];
  for (const tr of tableEl.querySelectorAll('tbody tr')) {
    const cells = tr.querySelectorAll('td');
    if (cells.length < 3) continue;
    const timeText = (cells[1].querySelector('b')?.textContent ?? '').trim();
    const dateText = (cells[2].textContent ?? '').trim();
    const timeMatch = timeText.match(TIME_RE);
    const dateMatch = dateText.match(DATE_RE);
    if (!timeMatch || !dateMatch) continue;
    const [, hh, mm] = timeMatch;
    const [, dd, mo, yyyy] = dateMatch;
    const time = new Date(
      Number(yyyy),
      Number(mo) - 1,
      Number(dd),
      Number(hh),
      Number(mm),
      0,
      0,
    );
    out.push({ time, dateStr: dateText });
  }
  return out;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd adp-hours && npm test`
Expected: all 4 parser tests pass.

- [ ] **Step 5: Commit**

```bash
cd adp-hours
git add src/lib/parser.js src/lib/parser.test.js
git commit -m "feat(parser): extract punch times and dates from ADP table rows"
```

---

### Task 3: Implement `calculator.js` (TDD, multi-cycle)

**Files:**
- Create: `adp-hours/src/lib/calculator.js`
- Create: `adp-hours/src/lib/calculator.test.js`

The calculator takes `(rows, now)` and returns `{ workedMs, punchCount, isOverTarget, suggestions: { returnAt?, punchOutAt? } }` per the spec's rules table. Work TDD case-by-case: write each test, watch it fail, add the code to make it pass.

Helpers used in tests:

```javascript
function d(dateStr, hh, mm) {
  const [day, mo, yyyy] = dateStr.split('/').map(Number);
  return new Date(yyyy, mo - 1, day, hh, mm, 0, 0);
}
function row(dateStr, hh, mm) {
  return { time: d(dateStr, hh, mm), dateStr };
}
const TODAY = '25/05/2026';
const NOW = (hh, mm) => d(TODAY, hh, mm);
```

- [ ] **Step 1: Write the first failing test (zero-punch case)**

```javascript
// src/lib/calculator.test.js
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
```

- [ ] **Step 2: Run test, verify failure**

Run: `cd adp-hours && npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement minimal `calculator.js` to pass step-2 test**

```javascript
// src/lib/calculator.js

export const TARGET_MS = 8 * 60 * 60 * 1000;
export const LUNCH_MS = 60 * 60 * 1000;

function pad2(n) { return String(n).padStart(2, '0'); }

function todayStr(now) {
  return `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;
}

export function computeState(rows, now) {
  const today = todayStr(now);
  const todays = rows
    .filter((r) => r.dateStr === today)
    .map((r) => r.time.getTime())
    .sort((a, b) => a - b);
  const n = todays.length;
  return {
    workedMs: 0,
    punchCount: n,
    isOverTarget: false,
    suggestions: {},
  };
}
```

- [ ] **Step 4: Verify the zero-punch test passes**

Run: `cd adp-hours && npm test`
Expected: PASS for the zero-punch test.

- [ ] **Step 5: Add the 1-punch (open shift) test**

Append to `calculator.test.js`:

```javascript
test('1 punch → open shift, workedMs = now − p1, punchOutAt = p1 + 8h', () => {
  const state = computeState([row(TODAY, 9, 0)], NOW(11, 30));
  assert.equal(state.workedMs, 2.5 * 60 * 60 * 1000);
  assert.equal(state.punchCount, 1);
  assert.equal(state.isOverTarget, false);
  assert.deepEqual(state.suggestions.returnAt, undefined);
  assert.deepEqual(state.suggestions.punchOutAt, d(TODAY, 17, 0));
});
```

- [ ] **Step 6: Run, verify failure**

Run: `cd adp-hours && npm test`
Expected: FAIL on the 1-punch test (workedMs is still 0).

- [ ] **Step 7: Extend `computeState` to handle the open-shift + suggestion logic**

Replace the body of `computeState` in `calculator.js`:

```javascript
export function computeState(rows, now) {
  const today = todayStr(now);
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
      // Open shift → punchOutAt = last punch + remaining
      const remaining = TARGET_MS - completedMs;
      suggestions.punchOutAt = new Date(todays[n - 1] + remaining);
    } else if (n === 2) {
      // On lunch → assume 1h, predict return and final out
      const returnMs = todays[1] + LUNCH_MS;
      suggestions.returnAt = new Date(returnMs);
      suggestions.punchOutAt = new Date(returnMs + (TARGET_MS - completedMs));
    }
    // Even n ≥ 4 under target: deliberately no suggestion (left-early case)
  }

  return { workedMs, punchCount: n, isOverTarget, suggestions };
}
```

- [ ] **Step 8: Verify 0- and 1-punch tests both pass**

Run: `cd adp-hours && npm test`
Expected: both pass.

- [ ] **Step 9: Add the remaining rule-table tests**

Append to `calculator.test.js`:

```javascript
test('2 punches (on lunch) → returnAt = p2 + 1h, punchOutAt = returnAt + (8h − morning)', () => {
  const state = computeState(
    [row(TODAY, 7, 56), row(TODAY, 12, 42)],
    NOW(13, 0),
  );
  const morning = (12 * 60 + 42 - 7 * 60 - 56) * 60 * 1000; // 4h46m
  assert.equal(state.workedMs, morning);
  assert.equal(state.punchCount, 2);
  assert.deepEqual(state.suggestions.returnAt, d(TODAY, 13, 42));
  assert.deepEqual(state.suggestions.punchOutAt, d(TODAY, 18, 38));
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
  // p3 13:53 + (8h − 4h46m) = 13:53 + 3h14m = 17:07
  assert.deepEqual(state.suggestions.punchOutAt, d(TODAY, 17, 7));
});

test('4 punches (done) → no suggestions, isOverTarget if ≥ 8h', () => {
  const state = computeState(
    [row(TODAY, 7, 56), row(TODAY, 12, 42), row(TODAY, 13, 53), row(TODAY, 17, 38)],
    NOW(17, 40),
  );
  // morning 4h46m + afternoon 3h45m = 8h31m
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
  // 3h + 3h20m = 6h20m
  assert.equal(state.workedMs, (6 * 60 + 20) * 60 * 1000);
  assert.equal(state.isOverTarget, false);
  assert.deepEqual(state.suggestions, {});
});

test('open shift already past 8h → no punchOutAt', () => {
  const state = computeState(
    [row(TODAY, 7, 0), row(TODAY, 12, 0), row(TODAY, 13, 0)],
    NOW(18, 30),
  );
  // morning 5h + afternoon 5h30m = 10h30m
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
  // simulating two breaks: in, out, in, out, in (still working)
  const state = computeState(
    [
      row(TODAY, 8, 0),
      row(TODAY, 10, 0),  // 2h
      row(TODAY, 10, 30),
      row(TODAY, 12, 0),  // +1h30m = 3h30m
      row(TODAY, 13, 0),  // open
    ],
    NOW(14, 0),
  );
  const completed = (3 * 60 + 30) * 60 * 1000;
  assert.equal(state.workedMs, completed + 60 * 60 * 1000); // +1h open
  // punchOutAt = 13:00 + (8h − 3h30m) = 13:00 + 4h30m = 17:30
  assert.deepEqual(state.suggestions.punchOutAt, d(TODAY, 17, 30));
});

test('TARGET_MS and LUNCH_MS are exported as expected', () => {
  assert.equal(TARGET_MS, 8 * 3_600_000);
  assert.equal(LUNCH_MS, 3_600_000);
});
```

- [ ] **Step 10: Run all calculator tests**

Run: `cd adp-hours && npm test`
Expected: all calculator tests pass. If any fail, the calculator logic — not the test — likely has a bug; fix the implementation.

- [ ] **Step 11: Commit**

```bash
cd adp-hours
git add src/lib/calculator.js src/lib/calculator.test.js
git commit -m "feat(calculator): compute worked time and punch-out suggestions"
```

---

### Task 4: Implement `formatter.js` (TDD)

**Files:**
- Create: `adp-hours/src/lib/formatter.js`
- Create: `adp-hours/src/lib/formatter.test.js`

Formatter holds the three display helpers used by `render.js`. Per spec:
- `formatDuration(ms)`: zero → `0m`; minutes-only when hours zero (`45m`); hours-only when minutes zero (`8h`); both when non-zero (`8h 31m`).
- `formatTime(date)`: 24h `HH:MM`.
- `formatDateBR(date)`: `DD/MM/YYYY` in local time (used by the calculator's today filter — but the calculator already has its own internal helper; we keep one canonical version here for tests and reuse later).

- [ ] **Step 1: Write the failing tests**

```javascript
// src/lib/formatter.test.js
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
```

- [ ] **Step 2: Run, verify failure**

Run: `cd adp-hours && npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `formatter.js`**

```javascript
// src/lib/formatter.js

function pad2(n) { return String(n).padStart(2, '0'); }

export function formatDuration(ms) {
  const clamped = Math.max(0, ms);
  const totalMin = Math.floor(clamped / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0 && m === 0) return '0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatDateBR(date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd adp-hours && npm test`
Expected: all formatter tests pass.

- [ ] **Step 5: Refactor the calculator to use the shared `formatDateBR`** (DRY)

In `src/lib/calculator.js`, replace the local `todayStr` helper with an import:

```javascript
// at the top of calculator.js, after the constants
import { formatDateBR } from './formatter.js';
```

Then delete the local `pad2` and `todayStr` functions, and replace `todayStr(now)` calls with `formatDateBR(now)`.

- [ ] **Step 6: Verify calculator tests still pass after the refactor**

Run: `cd adp-hours && npm test`
Expected: all tests still pass.

- [ ] **Step 7: Commit**

```bash
cd adp-hours
git add src/lib/formatter.js src/lib/formatter.test.js src/lib/calculator.js
git commit -m "feat(formatter): add duration/time/date formatters and reuse in calculator"
```

---

### Task 5: Implement `render.js` (TDD)

**Files:**
- Create: `adp-hours/src/lib/render.js`
- Create: `adp-hours/src/lib/render.test.js`

`render.js` builds the banner DOM from a state object. It uses the document passed in (so it works in both the content-script and popup contexts). It returns the root element, ready for the caller to insert.

The Line 2 mapping follows the spec exactly:

| Condition | Line 2 |
|---|---|
| `punchCount === 0` | `Sem batidas hoje` |
| `suggestions.returnAt` present | `Volte às HH:MM · Saia às HH:MM para 8h` |
| `suggestions.punchOutAt` present | `Saia às HH:MM para 8h` |
| `isOverTarget` | `✓ extras: <duration>` |
| else (left-early) | `Faltam <duration>` |

- [ ] **Step 1: Write the failing tests**

```javascript
// src/lib/render.test.js
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
        punchOutAt: new Date(2026, 4, 25, 18, 38),
      },
    },
    doc,
  );
  assert.equal(
    el.querySelector('.adp-hours-line2').textContent,
    'Volte às 13:42 · Saia às 18:38 para 8h',
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
  // Passing an existing root should update it in-place rather than appending.
  const doc = newDoc();
  doc.body.appendChild(doc.createElement('table')); // sibling so the banner has somewhere to be inserted
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
```

- [ ] **Step 2: Run, verify failure**

Run: `cd adp-hours && npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `render.js`**

```javascript
// src/lib/render.js
import { formatDuration, formatTime } from './formatter.js';
import { TARGET_MS } from './calculator.js';

export function renderBanner(state, doc, existing) {
  const root = existing ?? doc.createElement('div');
  root.id = 'adp-hours-banner';
  root.className = 'adp-hours-banner';
  root.innerHTML = '';

  const line1 = doc.createElement('div');
  line1.className = 'adp-hours-line1';
  line1.textContent = `Trabalhado hoje: ${formatDuration(state.workedMs)}`;
  root.appendChild(line1);

  const line2 = doc.createElement('div');
  line2.className = 'adp-hours-line2';
  line2.textContent = line2Text(state);
  root.appendChild(line2);

  return root;
}

function line2Text(state) {
  if (state.punchCount === 0) return 'Sem batidas hoje';
  if (state.suggestions.returnAt) {
    return `Volte às ${formatTime(state.suggestions.returnAt)} · Saia às ${formatTime(state.suggestions.punchOutAt)} para 8h`;
  }
  if (state.suggestions.punchOutAt) {
    return `Saia às ${formatTime(state.suggestions.punchOutAt)} para 8h`;
  }
  if (state.isOverTarget) {
    return `✓ extras: ${formatDuration(state.workedMs - TARGET_MS)}`;
  }
  return `Faltam ${formatDuration(TARGET_MS - state.workedMs)}`;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd adp-hours && npm test`
Expected: all render tests pass.

- [ ] **Step 5: Commit**

```bash
cd adp-hours
git add src/lib/render.js src/lib/render.test.js
git commit -m "feat(render): build banner DOM from state, idempotent on re-render"
```

---

### Task 6: Write the manifest

**Files:**
- Create: `adp-hours/manifest.json`

- [ ] **Step 1: Write `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "ADP Hours",
  "description": "Calculate worked hours and predict punch-out time from the ADP timesheet page.",
  "version": "0.1.0",
  "host_permissions": [
    "https://expert.cloud.brasil.adp.com/expert/v5/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://expert.cloud.brasil.adp.com/expert/v5/*"],
      "js": ["src/content.js"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["src/lib/*.js"],
      "matches": ["https://expert.cloud.brasil.adp.com/*"]
    }
  ],
  "action": {
    "default_popup": "src/popup.html",
    "default_title": "ADP Hours"
  },
  "icons": {
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd adp-hours
git add manifest.json
git commit -m "chore: add MV3 manifest scoped to ADP expert domain"
```

---

### Task 7: Implement the content script

**Files:**
- Create: `adp-hours/src/content.js`

The content script is the only file that talks to `chrome.*`. It dynamically imports the lib modules (so they can stay ESM), waits for the punch table to mount via `MutationObserver`, renders the banner, ticks every 60 seconds, and answers `GET_STATE` messages from the popup.

This file is not unit-tested. It is exercised by manual verification (Task 9).

- [ ] **Step 1: Write `content.js`**

```javascript
// src/content.js
// Content script entry. Dynamically imports lib modules so they can remain
// pure ES modules and reusable in the popup.

const TABLE_SELECTOR = 'table[data-testid="ctn_table-punchin"]';
const STYLE_ID = 'adp-hours-style';
const BANNER_ID = 'adp-hours-banner';

const CSS = `
.adp-hours-banner {
  display: inline-block;
  padding: 8px 14px;
  margin: 8px 0;
  border-radius: 8px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  font-family: -apple-system, system-ui, sans-serif;
  font-size: 13px;
  color: #0f172a;
  line-height: 1.4;
}
.adp-hours-line1 { font-weight: 600; }
.adp-hours-line2 { opacity: 0.85; }
`;

(async () => {
  const [parser, calculator, render] = await Promise.all([
    import(chrome.runtime.getURL('src/lib/parser.js')),
    import(chrome.runtime.getURL('src/lib/calculator.js')),
    import(chrome.runtime.getURL('src/lib/render.js')),
  ]);

  let lastState = null;

  function injectStyleOnce() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function update() {
    const table = document.querySelector(TABLE_SELECTOR);
    if (!table) return;
    injectStyleOnce();

    const rows = parser.parseRows(table);
    const state = calculator.computeState(rows, new Date());
    lastState = state;

    if (rows.length === 0) {
      console.warn('[adp-hours] punch table found but no rows parsed');
    }

    const existing = document.getElementById(BANNER_ID);
    const banner = render.renderBanner(state, document, existing);
    if (!existing) {
      table.parentNode.insertBefore(banner, table);
    }
  }

  // Observe DOM for table mounts (SPA re-renders) and run an immediate update if it's already there.
  const observer = new MutationObserver(() => {
    if (document.querySelector(TABLE_SELECTOR)) update();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  update();

  // Minute tick so the open-shift number advances.
  setInterval(update, 60_000);

  // Recover from background-tab interval drift.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') update();
  });

  // Popup asks for the latest state via chrome.tabs.sendMessage.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'GET_STATE') {
      update(); // recompute so the popup gets a fresh value
      sendResponse({ ok: true, state: serializeState(lastState) });
      return true;
    }
  });

  function serializeState(s) {
    if (!s) return null;
    // Dates don't survive structured-clone over messaging in older Chrome; convert to ISO strings.
    return {
      workedMs: s.workedMs,
      punchCount: s.punchCount,
      isOverTarget: s.isOverTarget,
      suggestions: {
        returnAt: s.suggestions.returnAt ? s.suggestions.returnAt.toISOString() : undefined,
        punchOutAt: s.suggestions.punchOutAt ? s.suggestions.punchOutAt.toISOString() : undefined,
      },
    };
  }
})();
```

- [ ] **Step 2: Commit**

```bash
cd adp-hours
git add src/content.js
git commit -m "feat(content): observe ADP table, inject banner, tick, answer popup"
```

---

### Task 8: Implement the popup

**Files:**
- Create: `adp-hours/src/popup.html`
- Create: `adp-hours/src/popup.js`

- [ ] **Step 1: Write `popup.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>ADP Hours</title>
<style>
  body {
    width: 260px;
    margin: 0;
    padding: 12px 14px;
    font-family: -apple-system, system-ui, sans-serif;
    font-size: 13px;
    color: #0f172a;
    background: #ffffff;
  }
  h1 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #475569;
  }
  .adp-hours-banner { display: block; padding: 0; margin: 0; background: none; border: none; }
  .adp-hours-line1 { font-weight: 600; font-size: 14px; }
  .adp-hours-line2 { opacity: 0.85; margin-top: 2px; }
  .adp-hours-empty { color: #64748b; }
</style>
</head>
<body>
  <h1>ADP Hours</h1>
  <div id="root" class="adp-hours-empty">Carregando…</div>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `popup.js`**

```javascript
// src/popup.js
import { renderBanner } from './lib/render.js';

const HOST_PATTERN = /^https:\/\/expert\.cloud\.brasil\.adp\.com\/expert\/v5\//;

function reviveState(raw) {
  return {
    workedMs: raw.workedMs,
    punchCount: raw.punchCount,
    isOverTarget: raw.isOverTarget,
    suggestions: {
      returnAt: raw.suggestions.returnAt ? new Date(raw.suggestions.returnAt) : undefined,
      punchOutAt: raw.suggestions.punchOutAt ? new Date(raw.suggestions.punchOutAt) : undefined,
    },
  };
}

function showMessage(text) {
  const root = document.getElementById('root');
  root.textContent = text;
  root.className = 'adp-hours-empty';
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !HOST_PATTERN.test(tab.url)) {
    showMessage('Abra a página de ponto da ADP.');
    return;
  }
  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
  } catch (e) {
    showMessage('Página ainda carregando. Recarregue e tente de novo.');
    return;
  }
  if (!response || !response.ok || !response.state) {
    showMessage('Sem dados de ponto encontrados.');
    return;
  }
  const state = reviveState(response.state);
  const root = document.getElementById('root');
  root.textContent = '';
  root.className = '';
  root.appendChild(renderBanner(state, document));
}

main();
```

- [ ] **Step 3: Commit**

```bash
cd adp-hours
git add src/popup.html src/popup.js
git commit -m "feat(popup): show current state via active-tab message"
```

---

### Task 9: Add icon and README, then manually verify

**Files:**
- Create: `adp-hours/icons/icon128.png`
- Create: `adp-hours/README.md`

- [ ] **Step 1: Create a simple 128×128 icon**

Run from inside `adp-hours/`:

```bash
mkdir -p icons
python3 -c "
import struct, zlib, base64
W = H = 128
# solid slate-blue square
px = bytes([71, 85, 154, 255]) * W
raw = b''
for _ in range(H):
    raw += b'\x00' + px
def chunk(t, d):
    return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
ihdr = struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)
idat = zlib.compress(raw)
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
open('icons/icon128.png','wb').write(png)
print('wrote', len(png), 'bytes')
"
```

Expected: `wrote NNNN bytes` and `icons/icon128.png` exists.

- [ ] **Step 2: Write `README.md`**

```markdown
# ADP Hours

Personal Chrome extension that reads the ADP punch-in table and shows worked hours plus the time to punch out for an 8h day.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this directory.
4. Navigate to https://expert.cloud.brasil.adp.com/expert/v5/ and open the timesheet page.

The banner appears above the punch table. Click the toolbar icon for the same info in a popup.

## Develop

```bash
npm install
npm test
```

## Files

- `src/lib/` — pure modules (parser, calculator, formatter, render)
- `src/content.js` — observes ADP page and injects banner
- `src/popup.html` / `src/popup.js` — toolbar popup
```

- [ ] **Step 3: Manual verification on real ADP page**

1. Run `cd adp-hours && npm test` — all tests pass.
2. Open `chrome://extensions`, enable Developer mode, click "Load unpacked", pick the `adp-hours/` directory.
3. Navigate to the ADP timesheet page (logged in).
4. Confirm the banner appears immediately above the punch table.
5. Confirm Line 1 shows `Trabalhado hoje: …` matching your eyeballed sum of punch pairs.
6. With an open shift (odd punch count): wait one minute, confirm the worked total ticks up.
7. Click the toolbar icon — popup shows the same content.
8. Open Chrome DevTools console on the ADP tab and confirm no errors (a single `[adp-hours]` warn if the table is present but empty is fine).

If any step fails, open the issue, fix the root cause (don't paper over), and re-verify.

- [ ] **Step 4: Commit**

```bash
cd adp-hours
git add icons/icon128.png README.md
git commit -m "docs: add README and placeholder icon"
```
