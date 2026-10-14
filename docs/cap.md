# CAP — interactive case study

CAP is part of this portfolio repository. Its editable website files live in `public/projects/cap/`; that folder is the source of truth, even though it was originally named `dist` in the standalone CAP project.

## Editing and deployment

Run `npm run dev` from the portfolio root and open `/projects/cap/index.html`. Edit the HTML, CSS, JavaScript, or assets in `public/projects/cap/`, then refresh the case study. The portfolio card’s title, description, and tags live in `src/data.js`.

Run `node --test tests/cap.test.mjs` for CAP’s simulation and local-link checks. These checks resolve files relative to the test, so they do not depend on the current working directory.

Run `npm run build` to include the latest case study in the portfolio’s generated `dist/projects/cap/`. Deploy the complete portfolio `dist/` directory. With Git-connected hosting, commit and push the source changes to trigger the configured build and deployment.

The portfolio no longer needs the external `CAP Case study` folder. That original folder has been left intact as a backup; edits there will not update this portfolio. CAP’s old Git repository, hosting metadata, archive, and research folder are not part of the served website.

## Source and editorial notes

The supplied `Moulik_Nanda_Final_Submission.pdf`, `Cap enclosed.glb`, `main.cpp`, `glasses_database.h`, and `platformio.ini` informed the case study. Source originals in the Cap Resources folder were not edited. The PDF download retains all 26 pages and text; repeated identical image objects have been consolidated for delivery. The 3D presentation recolours the two shells orange and overlays procedural eyes on the blank CAD display. The screen overlay is aligned to the front circular surface rather than the LCD connector bounds. The housing is rotated with the ports on the right and the eyes counter-rotated upright. Unfocused parts and the eyes fade together. Its exploded layout is illustrative, not an assembly instruction.

The browser demo is not compiled firmware and does not scan Bluetooth or access hardware. The drag demo maps an illustrative distance to Cappy’s proximity tiers and uses immediate input so gestures remain legible. The displayed metres are not a physical calibration. The core firmware interpretation retains its filtering and timing; sleep and wake still follow the supplied firmware. Releasing the glasses returns them to their starting point with speed and bounce based on how far they were pulled. Visual haptic pulses represent motor patterns. The project’s test-device demonstration is kept distinct from unvalidated detection of actual smart glasses.

## Verification

- Unit checks for threshold boundaries, hysteresis, debounce, signal timeout, sleep/wake timing, emulated distance endpoints, spring speed/bounce, immediate drag response, and circular screen alignment.
- Local-file and page-anchor checks; JavaScript syntax checks.
- Browser inspection at desktop and 390px mobile widths; verified 3D loading, component selection, component fading, glasses dragging and spring return, sleep and wake, and journal navigation. Latest interaction checked at 1280px and 390px widths.
- Source PDF page count and extracted text verified after lossless deduplication; representative rendered page unchanged.

No physical ESP32 flashing, electrical validation, real Bluetooth detection tests, or full cross-browser/device test matrix was performed.
