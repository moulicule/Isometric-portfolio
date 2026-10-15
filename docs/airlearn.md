# Airlearn internship project

The portfolio entry is in `src/data.js`. The static case study lives in `public/projects/airlearn/index.html`; `images.html` contains the complete image archive. Both share `style.css`. Only the archive uses JavaScript (`gallery.js`), for filename search, prompt-family filtering, incremental image loading, and a native image-preview dialog.

Run `npm run dev` and open `/projects/airlearn/index.html`. Rebuild and redeploy the portfolio for hosted updates; never edit `dist/` manually.

## Content and attribution

Moulik supplied the account of a two-month summer UI design internship at Unacademy, working on Airlearn:

- Lesson screens in Greek, Finnish, Tagalog, Italian, and Korean; most work was in Finnish and Korean.
- Phone-call lessons in Russian, Mandarin, and Korean, using a newer company format.
- Educators wrote scripts. Moulik used and modified company Figma templates and generated supporting images in Midjourney.
- A typical workload of 7–10 lessons per day, submitted to senior designers and educators for approval.

No internship year, total lesson count, product metrics, or ownership of the base UI is inferred. The 1,111 figure counts image files in the supplied archive, not approved lessons or unique concepts.

## Figma sources

The supplied file is [airlearn](https://www.figma.com/design/dRf6MEUD0QRJimYOsy5YI3/airlearn?node-id=0-1), key `dRf6MEUD0QRJimYOsy5YI3`. All four pages were inspected. Each case-study chapter links directly to its source page.

| Page | Node | Use |
| --- | --- | --- |
| finnish lessons | `3:19509` | Market vocabulary, image recognition, and cultural context |
| korean lessons | `3:28589` | Animal hospital, pet carrier, and word explanations |
| phone call lesson sample | `3:129500` | Mandarin conversations and a comprehension exercise |
| phone call lessons project flow | `0:1` | Company format reference, in an expandable subsection |

| Local WebP in `assets/screens/` | Figma node |
| --- | --- |
| `finnish-vocabulary` | `3:19516` |
| `finnish-recognition` | `3:19952` |
| `finnish-context` | `3:20812` |
| `korean-vocabulary` | `3:33698` |
| `korean-carrier` | `3:33816` |
| `korean-word-building` | `3:34291` |
| `mandarin-conversation` | `3:129937` |
| `mandarin-sport` | `3:130412` |
| `mandarin-comprehension` | `3:131446` |

The existing `calling.png`, `conversation.png`, `comprehension.png`, and `response.png` come from `1:13349`, `1:10725`, `1:11404`, and `1:11740`. These contain Spanish sample copy and are explicitly presented as company format references. The additional phone-call samples are Mandarin; they are not labelled as Russian or Korean.

The Finnish market image matches source archive item `e7fe7a78f8e5` (visual 0868), used in both the vocabulary and recognition exports. `assets/korean-clinic.webp` is the source fill exported from the Korean animal-hospital frame. The cover embeds the actual Finnish and Korean screen exports inside a self-contained SVG; the site does not depend on expiring Figma asset URLs.

## Complete Midjourney archive

Source: `/Volumes/moulik/ai 4 airlearn` (read only). All 1,111 image files are represented: 1,110 PNGs and one WebP. Originals total approximately 1.31 GB. The site contains browser-friendly WebP derivatives rather than original-size files:

- `assets/thumbs/`: 360px maximum edge, lazy-loaded in batches of 24.
- `assets/visuals/`: 1280px maximum edge, loaded on preview.
- `assets/gallery.json`: stable filename-derived IDs, sequential labels, original filenames, prompt-family labels, and original dimensions.

The two derivative sets total approximately 100 MB. `Vector prompts`, `Realism prompts`, and `Other prompts` are filename-based groups, not claims about image formats. Search matches preserved filename fragments and image numbers. Selected case-study thumbnails link directly to their archive preview by hash.

To regenerate, use Python with Pillow installed:

```sh
python3 scripts/prepare-airlearn-images.py '/Volumes/moulik/ai 4 airlearn'
```

Keep the original folder unchanged. The script writes only into `public/projects/airlearn/assets` by default. It does not invent full prompts from truncated filenames.

## Validation

- The production build and all 30 existing tests pass. The build retains the existing large-chunk advisory.
- All 1,111 source filenames are present exactly once in the index; all 2,222 archive derivatives decode correctly and respect their size limits. Local links, anchors, image dimensions, alt text, and the cover SVG pass static checks.
- Case-study layout checks at 320, 390, 700, 1000, and 1440 pixels show no horizontal page overflow or out-of-bounds headings and figures.
- Browser checks confirm filename search (Finnish returns eight matches), the Vector prompts filter (652 matches), reset, the empty state, pagination from 24 to 48 images, modal next navigation, Escape and focus restoration, and an image deep link. Mobile preview and lesson layouts were inspected.
- The room controller and scene code are unchanged. Initial room smoke checks covered readiness, the Projects dialog, lamp, all camera presets, lighting themes, and drag/wheel input. Physical-device touch gestures were not retested.

Changes are local; deployment is a separate step.
