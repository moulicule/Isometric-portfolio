# CAP — interactive case study

CAP is part of this portfolio repository. Its editable website files live in `public/projects/cap/`; that folder is the source of truth, even though it was originally named `dist` in the standalone CAP project.

## Editing and deployment

Run `npm run dev` from the portfolio root and open `/projects/cap/index.html`. Edit the HTML, CSS, JavaScript, or assets in `public/projects/cap/`, then refresh the case study. The portfolio card’s title, description, and tags live in `src/data.js`.

Run `node --test tests/cap*.test.mjs` for CAP’s simulation, local-link, and CAD inspection-layout checks. These checks resolve files relative to the test, so they do not depend on the current working directory.

Run `npm run build` to include the latest case study in the portfolio’s generated `dist/projects/cap/`. Deploy the complete portfolio `dist/` directory. With Git-connected hosting, commit and push the source changes to trigger the configured build and deployment.

The portfolio no longer needs the external `CAP Case study` folder. That original folder has been left intact as a backup; edits there will not update this portfolio. CAP’s old Git repository, hosting metadata, archive, and research folder are not part of the served website.

## Source and editorial notes

CAP is the project and wearable device; Cappy is the expressive companion with eyes who lives on its screen. Hardware, enclosure, CAD, firmware, and prototype labels use CAP. Character expressions, personality, and the playground use Cappy.

The supplied `Moulik_Nanda_Final_Submission.pdf`, `Cap enclosed.glb`, `main.cpp`, `glasses_database.h`, and `platformio.ini` informed the case study. Source originals in the Cap Resources folder were not edited. The PDF download retains all 26 pages and text; repeated identical image objects have been consolidated for delivery. The 3D presentation recolours the two shells orange and overlays procedural eyes on the blank CAD display. The screen overlay is aligned to the front circular surface rather than the LCD connector bounds. The housing is rotated with the ports on the right and the eyes counter-rotated upright. Closed assemblies keep every material opaque. During inspection, unfocused parts and their eyes fade together. `assembly-layout.js` sets nine separate world-space slots and fits the shell overview to the complete spread and zooms later chapter cameras toward their active components; contextual parts may leave the frame during closeups; the battery pivots to show its broad face. GSAP moves the camera and orbit target from their current positions alongside the parts, and manual orbit/zoom interrupts that camera movement. Its exploded layout is illustrative, not an assembly instruction.

The browser demo is not compiled firmware and does not scan Bluetooth or access hardware. The drag demo maps an illustrative distance to Cappy’s proximity tiers and uses immediate input so gestures remain legible. The displayed metres are not a physical calibration. The core firmware interpretation retains its filtering and timing; sleep and wake still follow the supplied firmware. Releasing the glasses returns them to their starting point with speed and bounce based on how far they were pulled. Visual haptic pulses and floating Bzz labels represent motor patterns. The playground’s awake eyes smoothly follow mouse movement within a bounded range; resting eyes, emotion-guide icons, and 3D model faces retain their authored poses. The project’s test-device demonstration is kept distinct from unvalidated detection of actual smart glasses.

The workbench follows the scroll chapters: its title, description, and camera focus stay synchronized. Descriptions cross-fade from the current text, with immediate updates for reduced motion. A static footer divider stays outside the text animation, and one 44px button beside the description switches between assembled and exploded views; that choice persists as the description continues following the story. There is no part dropdown or visible instruction footer. Rotation and zoom shortcuts remain in the viewer's accessible description.

## Verification

- Unit checks for threshold boundaries, hysteresis, debounce, signal timeout, sleep/wake timing, emulated distance endpoints, spring speed/bounce, immediate drag response, circular screen alignment, and upright normal/resting eye poses with unchanged alert expressions, and the firmware’s three staggered vector Zs with rise/fade timing and a reduced-motion freeze.
- Local-file and page-anchor checks; JavaScript syntax checks.
- Real GLB geometry projected through every inspection camera at mobile and desktop aspect ratios: no overlapping part bounds; the overview fits all parts and closeups fit every active component.
- Browser inspection at desktop and mobile widths; verified 3D loading, scroll chapters, component fading, glasses dragging and spring return, sleep and wake, and journal navigation. The current workbench uses a scroll description and an adjacent view toggle. The page order is hero, project details, concept, hardware, reactions, then field documentation; emotion cards and the simulation note precede the playground, and chapter badges use centered tabular numerals. Each emotion card has a static icon painted by the shared playground face renderer; Sleepy and Sleeping have separate cards. Field photos include Happy, Angry, Sleepy, and Sleeping; no Curious photograph was supplied. Shirt and waistband photos stay together, with complete images visible at every width. The restored ways-to-wear cards emphasize user freedom beyond these two examples. The class demo stays on the case-study page; the full poster and its explanation live in the journal’s demo-day chapter.
- Source PDF page count and extracted text verified after lossless deduplication; representative rendered page unchanged.

No physical ESP32 flashing, electrical validation, real Bluetooth detection tests, or full cross-browser/device test matrix was performed.
