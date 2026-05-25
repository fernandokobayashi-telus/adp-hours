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
