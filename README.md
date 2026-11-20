# Walk Studio

A browser tool for students to animate their own colored character with a walk-cycle rig.
Runs on Chromebooks; no login, no install.

- Students: open the site, tap your drawing, play with the sliders, then save (Save to class / Download / Copy my code).
- Teacher mode: add `?teacher` to the address (previous/next student and all controls).

## How it fits together
- `manifest.json` describes the rig (parts, pivots, controls). Exported from the After Effects project.
- `js/walkcore.js` is the walk engine. It reproduces the After Effects rig expressions exactly
  (`tools/parity_test.js` checks it against frames sampled from After Effects).
- `students/Sxx/` holds each student's pre-cut sticker pieces, made by `pipeline/cut_pieces.py`.
- Saves are plain JSON (`walkrig-save` v1) and are rebuilt in After Effects by `pipeline/ingest_saves.jsx`.
- `apps_script/` has the optional Google Sheet receiver for "Save to class" (see `apps_script/SETUP.md`),
  and `config.js` holds its URL.

## Developing
- `node tools/build_core.js` regenerates `js/walkcore.js` from the template and the shared solver.
- `node tools/parity_test.js` checks the engine against After Effects ground truth.
- `node tools/ui_test.js <chrome.exe> <url> <out_dir>` drives the UI in headless Chrome.
