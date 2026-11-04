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

// Union of several row sources, deduplicated by minute. The "Últimas Batidas"
// table only lists the 4 latest punches, so callers merge in punches
// remembered from earlier renders.
export function mergeRows(primary = [], ...secondaries) {
  const counts = new Map();
  for (const row of primary) {
    const key = Math.floor(row.time.getTime() / 60000);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const out = [...primary];
  for (const list of secondaries) {
    const listCounts = new Map();
    for (const row of list) {
      const key = Math.floor(row.time.getTime() / 60000);
      const inPrimary = counts.get(key) || 0;
      const inThisList = (listCounts.get(key) || 0) + 1;
      listCounts.set(key, inThisList);
      if (inThisList > inPrimary) {
        out.push(row);
      }
    }
  }
  return out;
}
