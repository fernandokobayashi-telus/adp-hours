# ADP Hours

Personal Chrome extension that reads the ADP punch-in table and shows worked hours plus the time to punch out for an 8h day.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this directory.
4. Navigate to https://expert.hcm.adp.com/expert/v5/ and open the timesheet page.

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
