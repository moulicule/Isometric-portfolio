# Portfolio image loading

The HTML head preloads the CAP cover, About portrait, and both Creative Playground covers with `fetchpriority="low"`. Keep these URLs identical to `src/data.js` so dialog images reuse the downloads. Other project covers remain deferred until Projects opens. Each grid's first cover and the About portrait use eager loading and high fetch priority on opening; remaining covers use native lazy loading.

| Image | Before | Delivery | Dimensions |
| --- | ---: | ---: | --- |
| CAP cover | 18,220 bytes | 8,356 bytes | 800 × 450 |
| About portrait (also used in the introduction) | 283,481 bytes | 94,234 bytes | 1200 × 900 |
| Timescape cover | 94,930 bytes | 43,812 bytes | 800 × 450 |

The Film, Motion & Video Editing cover remains its existing 1.1 KB SVG. The four preloads total about 148 KB, less than the previous introduction portrait alone. Preloading starts requests early; an immediate click on a very slow connection can still precede completion.

Delivery WebPs use Pillow quality 75, method 6, with Lanczos resizing. CAP is a centered 16:9 crop of `public/projects/cap/assets/p19-1.webp`. The portrait comes from `public/images/moulik-nanda.jpg`, resized without cropping. Timescape comes from `public/projects/timescape/exhibition.jpg`, cropped to `(0, 462, 1200, 1137)` before resizing to match the existing cover. Preserve these originals when regenerating delivery assets. No image tooling is required at runtime or added to the project dependencies.

The main-controller tests check matching preload URLs, priorities, reuse of the portrait, deferred dialog markup, and delivery-size budgets. Build with `npm run build` to include updated assets in `dist/`.

## Verification — 3 November 2026

All 93 automated checks, the production build, and `git diff --check` passed. The existing Vite large-chunk advisory remains. Browser checks covered the production build at 1280 × 900 and 390 × 844, including all three dialogs and room entry, camera presets, orbit/zoom, lamp, and lighting.

A temporary server outside the repository simulated image responses with 200 ms latency and 50 KB/s per response. It did not throttle JavaScript, 3D assets, or the whole connection. Resource Timing showed all four image preloads starting around 110 ms after navigation; CAP completed at 452 ms, Timescape at 1,194 ms, and the portrait at 2,176 ms. All requested images were complete in the first post-click sample when their dialogs opened (the first dialog opened about five seconds after navigation). Each preload had one resource entry; About reused the introduction portrait without another request. No physical-device, real mobile-network, or cross-browser matrix was tested.
