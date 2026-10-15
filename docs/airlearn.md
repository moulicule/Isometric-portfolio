# Airlearn internship project

The portfolio entry is in `src/data.js`. The static case study lives in `public/projects/airlearn/index.html` with its styles in `style.css`. The small `navigation.js` module tracks the active chapter and the fixed reading-progress bar, keeping the active link visible in the horizontal navigation on phones. The lesson content and links remain usable without JavaScript.

Run `npm run dev` and open `/projects/airlearn/index.html`. Rebuild and redeploy the portfolio for hosted updates; never edit `dist/` manually.

## Content and attribution

Moulik supplied the account of a two-month summer UI design internship at Unacademy, working on Airlearn:

- Lesson screens in Greek, Finnish, Tagalog, Italian, and Korean; most work was in Finnish and Korean.
- Phone-call lessons in Russian, Mandarin, and Korean, using a newer company format.
- Educators wrote scripts. Moulik used and modified company Figma templates and generated supporting images in Midjourney.
- A typical workload of 7–10 lessons per day, submitted to senior designers and educators for approval.

No internship year, total lesson count, product metrics, or ownership of the base UI is inferred. Moulik confirmed that the archive contains 1,111 images generated in Midjourney 6.1 and used in lessons over the two months. The team standardised on this model; the case study explains prompt iteration, rerolling, and Figma cropping around its difficulties with hands, signage, and specific multi-character or multi-object scenes.

Role, workflow, production metrics, and attribution are combined in `#contribution`. The standalone process section has been removed. The hero headline uses Moulik’s wording, “Shipping 7–10 lessons a day across multiple different languages and scripts,” without asserting a script count. Standard lessons covered five languages; phone-call work added Russian and Mandarin, alongside Korean. The Mandarin examples and Spanish team reference remain explicitly distinguished.

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

The Finnish exports include dark pixels outside their rounded screen edges. Their hero and gallery CSS uses proportional corner clipping (`12% / 5.625%`) to match the native 405 × 864 exports at every rendered size. The cover's Finnish clipping path uses the same proportions; keep these aligned if replacing the exports.

## Selected Midjourney imagery

The case study shows two source renders with notes about their lesson crops, plus eight selected visuals in their native proportions. The eight thumbnails link directly to larger WebP images in a new tab. Only the images used by the case study are included in `assets/thumbs/` and `assets/visuals/`.

The full archive page, search/preview script, image index, bulk preparation script, and unused web derivatives have been removed. Original source images in `/Volumes/moulik/ai 4 airlearn` are unchanged.

Rebuild with `npm run build` after editing. Changes are local; deployment is a separate step.

## Visual style

The case study uses Airlearn-inspired sky blue, navy, rounded headings, raised buttons, and soft cards, referencing https://airlearn.com/. Nunito is bundled locally in `assets/fonts/` under the included SIL Open Font License; it is a rounded alternative to the brand site's Gotham Rounded. The four supplied Air mascot SVGs are local files in `assets/air/`, placed in the hero, Finnish chapter, role/workflow credit, and footer. Decorative poses have empty alt text; the introductory waving pose has a description. The hero screens use a restrained 2° stagger with unrotated greeting pills, and the imagery grid preserves the original square, 4:3, and 16:9 ratios.
