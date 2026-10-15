# Urban Death Care

The case study lives in `public/projects/urban-death-care/`. Run `npm run dev` and open `/projects/urban-death-care/index.html`; build the portfolio to copy the page and local assets into `dist/`.

It is static HTML and CSS with native chapter links and full-size image/PDF links. No JavaScript, new dependencies, or room-controller changes are required. The portfolio project card remains in `src/data.js`.

## Review of the change brief

The existing page omitted the four personas, most current-state maps, the literature synthesis, idea inventories, and original future-scope items. It repeated the same two-column introduction and hid four of the five service concepts in disclosures. The revision restores the documented process and varies the presentation by content.

The original submissions take precedence where the brief differs:

- **Feasibility:** the actual dots in A3 p. 13's implementation map are **3, 4, 3, 5**, not the brief's 2, 4, 2, 5. The page's scores and visible dots match the original map. The source scale describes 3 as long-term implementation and 5 as implementable currently; its 4-point caption repeats an uncertainty label, so the page does not turn 4 into a validated near-term promise.
- **Champion ideas:** there are 11 numbered ideas, with three Funeral Buddy variants (4a/4b/4c), making 13 matrix options. The page preserves that distinction and lists all 16 subsidiary ideas.
- **Asset resolution:** all seven formerly small figures now use high-resolution renders and link to original working PDFs. Five were supplied in the A1–A3 folders; the initial cluster map was found in `Downloads/Maps/Idea cluster initial.pdf`, and the current-state blueprints in `Downloads/Service design/Week 6/Service blueprint.pdf`. These additional originals date from February–March 2026 and match the figures in the studio submissions.
- **Claims:** the population, market-share, environmental, timing, and experimental disposition figures come from the original research, and the narrative uses the team's direct voice. These copy edits are not a new validation of the source statistics or proposed services. The 150-person literature study is separate from the team's approximately 35 survey responses.
- **HCI attribution:** the CHI 2023 paper is coauthored by Ruben Albers, Shadan Sadeghian, Matthias Laschke, and Marc Hassenzahl. The page credits all four and links to the University of Siegen record: https://dspace.ub.uni-siegen.de/entities/publication/3b92c6d9-9c23-4b69-8eb6-01f928ac01e6.

## Implementation plan and result

1. Extract authentic notes, persona sheets and portraits, stakeholder map, journey maps, current-state blueprints, analogy/Crazy 8s sheets, clusters, additional connections, and mind map from the PDFs. Retain all five existing WebP assets and all original PDFs.
2. Rewrite the seven sections using the collaborative “we” voice, descriptive headings, four literature themes, complete personas and idea lists, five visible concept cards, four implementation phases, and the original future scope and two limitations quotes. State the project boundary once in the framing section.
3. Replace the repeated editorial grid with a text-based hero, context callout bar, literature grid, persona cards, paired maps, ideation gallery, expanded concept cards, feasibility cards, and a future-scope/limitations layout. Use the source maps' route and matrix colours with text labels.
4. Validate local paths, anchors, image dimensions and alt text, accessible keyboard navigation, small-screen layouts at the requested breakpoints, source-to-build parity, and the Vite production build. Browser checks cover widths from 320px to 1440px.

## Source and asset inventory

The supplied A1, A2, and A3 PDFs remain unchanged. They credit Moulik Nanda and Sudarsinii Mazumdar; the site does not infer a division of individual responsibilities, a project year, or a duration beyond the documented semester context.

| Source | Assets |
| --- | --- |
| A1 p. 2 | `topic-notes.webp` (retained asset; removed from the hero after review) |
| A2 p. 5 | `persona-kalpan.webp`, `persona-rahul.webp`, `persona-sneha.webp`; corresponding `portrait-*.webp` crops |
| A2 p. 6 | `persona-maddy.webp`, `portrait-maddy.webp` |
| A2 pp. 7–8 | `stakeholder-map.webp`, existing `ecosystem.webp` |
| A2 working PDFs: `Customer journey map PREVIOUS VERSION.pdf`, `Customer journey map V2.pdf` | `journey-map-v1.webp` (4800 × 1743), `journey-map-v2.webp` (4800 × 2643), plus original `journey-map-v1.pdf` and `journey-map-v2.pdf` |
| `Service design/Week 6/Service blueprint.pdf` | `current-state-blueprints.webp` (5400 × 2326), original `current-state-blueprints.pdf`; both complete blueprints |
| A3 p. 2 | Existing `ideation-board.webp` |
| A3 p. 3 | `bizarro-analogy.webp`, `ideation-sketches.webp` (fantasy notes) |
| A3 p. 5 | `crazy-8s.webp`, `crazy-8s-analogies.webp` |
| A3 p. 7 | Existing `idea-matrix.webp` |
| `Maps/Idea cluster initial.pdf` | `idea-clusters.webp` (4800 × 3265), original `idea-clusters.pdf` |
| A3 working PDF: `clusters combined.pdf` | `idea-clusters-refined.webp` (5530 × 3759), `idea-connections.webp` (2246 × 2190), original `idea-clusters-and-connections.pdf` |
| A3 working PDF: `Mind map.pdf` | `mind-map.webp` (4800 × 3930), original `mind-map.pdf` |
| A3 pp. 13–14 | Existing `implementation-map.webp`, `service-blueprint.webp` |

The original persona sheets are linked from readable HTML persona cards; the cards use portrait crops from those sheets. Maps preserve their aspect ratios. All seven upgraded figures link to original working PDFs for zooming. The combined cluster PDF supplies the complete upper five-cluster diagram and lower additional-connections diagram, extracted separately without altering their content. All six added working PDFs are copied byte-for-byte from the supplied originals. The former editorial `cover.svg` is retained for the existing portfolio thumbnail and favicon, and is no longer used in the case-study hero.

## Validation

- Static asset, anchor, image metadata, and external-link checks pass.
- Four personas, five visible concepts, and four phases are present; visible scores match A3.
- No collapsed concept disclosures, repeated `.source-note` disclaimers, or `.editorial-grid` remain.
- Responsive layout checks at 320, 390, 700, 768, 1000, and 1440 pixels find no page overflow or clipped body text/images.
- Keyboard Skip to content focuses `main`; chapter navigation reaches the matching sections.
- All 21 inline images have valid dimensions and alt text. Dense persona, concept, and phase layouts stack into one column on phones.
- Portfolio integration smoke checks cover scene readiness, all three camera presets, orbit/zoom input, a lamp hotspot, all three themes, and the Projects dialog's case-study link. Physical-device touch gestures were not tested.
- The 17 existing readiness, scene-motion, and day/night-cycle regression tests passed during the initial redesign. The case study now contains 38 source files and assets, including six added working PDFs.
- `npm run build` passes with the existing large-chunk advisory.

Rebuild and redeploy the portfolio for hosted updates. Never hand-edit `dist/`.

The follow-up browser review changed the badge to “Studio project” and the Context entry to “Core studio project / Systems and Service Design”, and removed the hero notebook image, its label, and its caption. The hero now uses a single content column.

The next copy pass removes narration about the PDFs and persona sheets, deletes the extra academic-proposal disclaimer, and uses “Can be implemented currently” for the 5/5 feasibility rating. Original working files replace all seven low-resolution previews; each has an “Open PDF” link.
