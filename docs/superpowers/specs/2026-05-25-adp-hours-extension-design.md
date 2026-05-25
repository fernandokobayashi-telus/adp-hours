# ADP Hours — Chrome Extension Design

**Date:** 2026-05-25
**Status:** Approved for implementation planning

## Goal

A personal-use Chrome extension that reads the punch-in table on the ADP timesheet page and answers the question *"when should I punch out today to hit 8 hours?"* — surfacing the answer both as a banner injected next to the table and via a toolbar popup.

## Scope

- **Host restriction:** `https://expert.cloud.brasil.adp.com/expert/v5/*` (host permission and content script match pattern; the extension is inert elsewhere).
- **Source of truth:** the DOM table `table[data-testid="ctn_table-punchin"]` on that page.
- **Day filter:** only rows whose date matches today (the local calendar day of the browser).
- **Daily target:** 8 hours, hardcoded as `TARGET_MS = 8 * 60 * 60 * 1000`.
- **Lunch assumption:** when only two punches exist (on lunch), assume a 1-hour break, hardcoded as `LUNCH_MS = 60 * 60 * 1000`.

Out of scope: options page, multi-day rollups, exporting, badge text on the extension icon, telemetry.

## Data model

Each parsed row:

```js
{ time: Date, dateStr: 'DD/MM/YYYY' }
```

Computed state returned by the calculator:

```js
{
  workedMs: number,            // total worked time so far today
  punchCount: number,          // count of today's punches (0..n)
  isOverTarget: boolean,       // workedMs >= TARGET_MS
  suggestions: {
    returnAt?: Date,           // when to come back from lunch (only when punchCount===2 and under target)
    punchOutAt?: Date          // when to punch out to hit 8h (only when under target and day isn't done)
  }
}
```

## Computation rules

Inputs: today's rows (sorted ascending by `time`) and a `now: Date`. Let `n = rows.length`, `p1..pn` be the punch times.

| `n` | Meaning | `workedMs` | `returnAt` | `punchOutAt` |
|---|---|---|---|---|
| 0 | Haven't started | `0` | — | — |
| 1 | Open shift (morning) | `now − p1` | — | `p1 + 8h` |
| 2 | On lunch break | `p2 − p1` | `p2 + 1h` | `p2 + 1h + (8h − morningShift)` |
| 3 | Open shift (afternoon) | `(p2 − p1) + (now − p3)` | — | `p3 + (8h − morningShift)` |
| 4 | Day complete | `(p2 − p1) + (p4 − p3)` | — | — |
| 5+ | Open, multi-break | sum of `(p2k − p2k−1)` pairs plus `(now − pn)` if `n` is odd | — | `pn + (8h − completedSoFar)` if open and under target |

Notes:
- `morningShift = p2 − p1`.
- `completedSoFar` = sum of completed pairs (excludes the currently-open shift).
- `punchOutAt` is omitted when `isOverTarget` is true or when the day is structurally complete (even `n ≥ 4` with no further punches expected — i.e., not on a lunch break).
- The "on lunch" branch only applies when `n === 2`. For `n ≥ 4` even, the day is treated as done; if the user is actually on a second lunch, they can ignore the banner until the third punch lands.
- Negative diffs are clamped to zero defensively.

## Architecture

Manifest V3 extension. Two runtime pieces only; no service worker.

```
adp-hours/
├── manifest.json
├── src/
│   ├── content.js          # DOM observer, banner injection, minute tick, popup message handler
│   ├── popup.html
│   ├── popup.js            # Asks active tab for state, renders
│   └── lib/
│       ├── parser.js       # parseRows(tableEl) → rows
│       └── calculator.js   # computeState(rows, now) → state
└── icons/                  # 16/32/48/128
```

### `parser.js`

Pure function `parseRows(tableEl) → Array<{ time: Date, dateStr: string }>`.

- Selects `tbody tr` of the supplied table element.
- For each row:
  - Time cell: the `<b>` inside the second `<td>`. Match `/^(\d{2}):(\d{2})\s*h$/`.
  - Date cell: the third `<td>`. Match `/^(\d{2})\/(\d{2})\/(\d{4})$/`.
  - Build a JS `Date` in local time from the date and time parts.
- Rows that fail either regex are skipped silently.
- Returns rows unsorted; sorting is the calculator's job.

### `calculator.js`

Pure function `computeState(rows, now) → state` implementing the table above.

- Filters to today: `dateStr` equal to `formatDate(now)` where `formatDate` produces `DD/MM/YYYY` in local time.
- Sorts ascending by `time`.
- Applies the count-based rules.
- Constants `TARGET_MS` and `LUNCH_MS` are defined at the top of the file.

### `content.js`

- On load, install a `MutationObserver` rooted at `document.body` watching for `table[data-testid="ctn_table-punchin"]`. The ADP page is SPA-like, so the table can appear after initial DOM and can be re-rendered.
- When the table mounts, run `update()`:
  1. Parse rows with `parser.parseRows`.
  2. Compute state with `calculator.computeState(rows, new Date())`.
  3. Insert/update a banner element `<div id="adp-hours-banner">` immediately before the table as a previous sibling.
- Set a `setInterval(update, 60_000)` so the open-shift number ticks forward each minute.
- Also call `update()` on `document.visibilitychange` → visible, to recover from background-tab interval drift.
- Listen on `chrome.runtime.onMessage` for `{ type: 'GET_STATE' }` and reply with the current state object plus a `renderedAt` timestamp.
- If the observer sees the table get removed (route change), it re-attaches and re-runs on next mount.

### Banner UI

A self-contained pill rendered with a single scoped `<style>` block injected once. All class names prefixed with `adp-hours-` to avoid colliding with site CSS. Layout:

- Line 1 (bold): `Trabalhado hoje: <duration>`
- Line 2 (conditional, selected from state — see mapping below)

The Line 2 mapping is driven purely by fields on the state object so the banner and popup share one render function:

| Condition | Line 2 |
|---|---|
| `punchCount === 0` | `Sem batidas hoje` |
| `suggestions.returnAt` present | `Volte às HH:MM · Saia às HH:MM para 8h` (uses both `returnAt` and `punchOutAt`) |
| `suggestions.punchOutAt` present (no `returnAt`) | `Saia às HH:MM para 8h` |
| `isOverTarget` | `✓ extras: <duration>` where duration = `workedMs − TARGET_MS` |
| else (left-early case: even punchCount ≥ 4, under target) | `Faltam <duration>` where duration = `TARGET_MS − workedMs` |

Formatting rules:
- Times: 24-hour `HH:MM`.
- Durations: `<H>h <M>m` when `H > 0` (e.g. `8h 31m`, `1h 0m` → render as `1h`), `<M>m` when `H === 0` and `M > 0`, `0m` when zero. Trailing ` 0m` is dropped.

### `popup.html` / `popup.js`

- Compact popup (~260×120 px) with a small header `ADP Hours` and the same two-line content as the banner.
- On open, `popup.js`:
  - Queries the active tab via `chrome.tabs.query({ active: true, currentWindow: true })`.
  - If URL matches `https://expert.cloud.brasil.adp.com/expert/v5/*`, sends `{ type: 'GET_STATE' }` to the content script.
  - Renders the response. On no response or wrong host, shows `Abra a página de ponto da ADP`.

## Manifest

Manifest V3 with:

- `host_permissions: ["https://expert.cloud.brasil.adp.com/expert/v5/*"]`
- `content_scripts`: matches the same pattern, runs `content.js` at `document_idle`, includes `lib/parser.js` and `lib/calculator.js` (or content.js imports them via a single bundled file).
- `action`: popup pointing at `popup.html`.
- `icons`: 16/32/48/128.

No background service worker.

## Testing

Unit tests using `node --test` (no test framework dependency). One dev dependency: `jsdom` for parser tests.

Test files alongside the modules:

- `src/lib/parser.test.js` — fixture HTML strings (including the example from the brief, an empty table, malformed rows, and a multi-date table) parsed via `jsdom`, asserting the returned row array.
- `src/lib/calculator.test.js` — pure data tests covering every row in the rules table above:
  - 0 punches → zero state.
  - 1 punch at 09:00, `now` 11:30 → `workedMs` 2h30m, `punchOutAt` 17:00.
  - 2 punches 07:56/12:42, under target → `returnAt` 13:42, `punchOutAt` 18:38.
  - 3 punches 07:56/12:42/13:53, `now` 16:00 → `workedMs` = morningShift + 2h07m, `punchOutAt` 17:08 (`13:53 + (8h − 4h46m)`).
  - 4 punches 07:56/12:42/13:53/17:38 → `workedMs` 8h31m, `isOverTarget` true.
  - Multi-date table with yesterday's rows interleaved → only today counted.
  - Open shift already past 8h → no `punchOutAt`.

Manual verification: load the unpacked extension in Chrome, navigate to the ADP page, confirm the banner appears and ticks each minute, confirm popup matches.

## Risks / open questions

- **ADP DOM changes.** The selector `data-testid="ctn_table-punchin"` and the `<b>HH:MM h</b>` shape are load-bearing. If ADP changes them, both injection and parsing break silently (no rows match → zero state). Acceptable for a personal tool; the parser logs a `console.warn` from the content script when the table mounts but no rows parse.
- **Time zone.** All times are interpreted in the browser's local zone. The user is expected to be in Brazil viewing Brazil data — no UTC conversion needed.
- **2-punch ambiguity.** A user with a non-standard schedule (e.g., 30-min lunch, or a long break that isn't lunch) will get a wrong `punchOutAt` after the second punch. The third punch corrects it. Acceptable.
- **Multiple ADP tabs.** Each tab runs its own content script independently; the popup talks only to the active tab. No coordination needed.
