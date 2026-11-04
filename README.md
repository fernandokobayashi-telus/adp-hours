# ADP Hours

Personal Chrome extension that reads the ADP punch-in table and shows worked hours plus the time to punch out for an 8h day.

## Install (unpacked)

Download [adp-hours-latest.zip](https://github.com/fernandokobayashi-telus/adp-hours/releases/download/latest/adp-hours-latest.zip) and unzip it somewhere permanent (or clone this repo), then:

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

## Releases

Every push to `main` that touches the extension runs `.github/workflows/release.yml`: tests, build, then publish a `v<version>` release (once per version) and refresh the rolling `latest` release (`adp-hours-latest.zip`, stable URL above). If the `CONFLUENCE_*` secrets are set, it also updates the zip attached to the Confluence page.

To ship a new version, bump `version` in **both** `package.json` and `manifest.json`; the workflow fails if they differ.

## Update check

Once a day, on the first ADP page load, the background worker fetches `manifest.json` from `main` and compares versions. If a newer one exists it shows a notification and a popup link. The extension is loaded unpacked, so it can't update itself.

## Files

- `src/lib/` — pure, tested modules (parser, calculator, formatter, render, badge, notify, update)
- `src/content.js` — observes ADP page and injects banner
- `src/background.js` — service worker: icon badge, notifications, daily update check
- `src/popup.html` / `src/popup.js` — toolbar popup

Full user guide (pt-BR): `docs/adp-hours.pt-BR.md`
