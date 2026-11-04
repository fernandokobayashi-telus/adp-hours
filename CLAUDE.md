# ADP Hours

Chrome MV3 extension (no build step, plain ES modules). See README.md for layout.

- Test with `npm test`. Logic goes in `src/lib/` as pure functions with a `.test.js` next to them; `content.js`, `background.js` and `popup.js` are thin wiring around chrome APIs and are not unit tested.
- Versions live in both `package.json` and `manifest.json` and must match (CI enforces it). Bump both to ship.
- The update check (`src/lib/update.js`) fetches `manifest.json` from `main` on GitHub, so the repo must stay public and that file path must not move.
- Avoid adding `host_permissions` or `permissions`: the extension is loaded unpacked, and new permissions make Chrome re-prompt every user on update.
- User-facing docs are in Portuguese (`docs/adp-hours.pt-BR.md`) and are published on Confluence; keep that guide in sync with behavior changes, including the privacy section.
