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

  // The punch table only lists the 4 latest punches and ADP no longer exposes
  // the full day (time-card API returns 403). Remember every punch seen today
  // and merge it back, so punches that scroll out of the table are kept.
  const STORE_KEY = 'punches';
  const pad = (n) => String(n).padStart(2, '0');
  const dayStr = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

  try {
    localStorage.removeItem('adp-hours:punches');
  } catch {
    // ignore if localStorage is blocked
  }

  async function loadRemembered(now) {
    try {
      const data = await chrome.storage.local.get(STORE_KEY);
      const saved = data?.[STORE_KEY];
      if (saved?.day !== dayStr(now) || !Array.isArray(saved?.times)) return [];
      return saved.times.map((t) => ({ time: new Date(t), dateStr: saved.day }));
    } catch {
      return [];
    }
  }

  async function remember(rows, now) {
    const day = dayStr(now);
    const times = rows.filter((r) => r.dateStr === day).map((r) => r.time.getTime());
    try {
      await chrome.storage.local.set({ [STORE_KEY]: { day, times } });
    } catch {
      // storage full or blocked: fall back to table-only data
    }
  }
  async function update() {
    // After the extension is reloaded, this orphaned script keeps running but
    // every chrome.runtime call throws "Extension context invalidated".
    if (!chrome.runtime?.id) {
      shutdown();
      return;
    }
    const table = document.querySelector(TABLE_SELECTOR);
    if (!table) return;
    injectStyleOnce();

    const now = new Date();
    const tableRows = parser.parseRows(table);
    const remembered = await loadRemembered(now);
    const rows = parser.mergeRows(tableRows, remembered);
    await remember(rows, now);
    const state = calculator.computeState(rows, now);
    lastState = state;

    try {
      chrome.runtime
        .sendMessage({
          type: 'TARGET_UPDATE',
          atMs: state.next ? state.next.at.getTime() : null,
          kind: state.next ? state.next.kind : null,
        })
        .catch(() => {});
    } catch {
      shutdown();
      return;
    }

    if (tableRows.length === 0) {
      console.warn('[adp-hours] punch table found but no rows parsed');
    }

    const existing = document.getElementById(BANNER_ID);
    const banner = render.renderBanner(state, document, existing);
    if (!existing) {
      table.parentNode.insertBefore(banner, table);
    }
  }

  let knownTable = null;
  const observer = new MutationObserver(() => {
    const table = document.querySelector(TABLE_SELECTOR);
    if (table && table !== knownTable) {
      knownTable = table;
      update();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  knownTable = document.querySelector(TABLE_SELECTOR);

  const timer = setInterval(update, 60_000);

  function onVisible() {
    if (document.visibilityState === 'visible') update();
  }
  document.addEventListener('visibilitychange', onVisible);

  function shutdown() {
    observer.disconnect();
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  }

  update();

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'GET_STATE') {
      update()
        .then(() => sendResponse({ ok: true, state: serializeState(lastState) }))
        .catch((err) => {
          console.error('[adp-hours] update failed', err);
          sendResponse({ ok: false, state: serializeState(lastState) });
        });
      return true;
    }
  });

  function serializeState(s) {
    if (!s) return null;
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
