# Interaction performance check — 2 November 2026

The ready introduction now pauses Spline with its public `stop()` API. Entry resumes it with `play()` and applies the current sky lighting before revealing the room. Before entry, the application skips room updates and material writes while retaining the visible sky cycle. Cloud animation reads all SVG rectangles before changing any row text.

## Measurements

Measured locally in the Codex in-app browser on this Mac. A temporary Vite plugin outside the repository added a six-second frame counter; it is not included in the production build. The final interaction samples served the built production assets. Fixed viewports used a device pixel ratio of 1.

“Browser FPS” measures `requestAnimationFrame` cadence, not proof that every frame reached the display. Spline measurements count the canvas's `rendered` events, not GPU completion. The 95th percentile means 95% of measured frame intervals were no longer than that value.

| Production sample | Viewport | Browser FPS | Browser interval, 95th percentile | Longest browser interval | Longest Spline interval |
| --- | --- | ---: | ---: | ---: | ---: |
| First desktop entry sample | 1280 × 720 | 55.3 | 17.4 ms | 283.3 ms | 294.8 ms |
| Repeated desktop entry | 1280 × 720 | 60.0 | 16.8 ms | 17.7 ms | 34.1 ms |
| Chair, camera, watering, and lighting | 1280 × 720 | 60.0 | 16.8 ms | 17.7 ms | 34.8 ms |
| Cloud ripples | 1280 × 720 | 60.0 | 16.8 ms | 17.7 ms | 24.6 ms |
| Phone-size entry | 390 × 844 | 60.0 | 16.8 ms | 17.7 ms | 27.6 ms |
| Phone-size chair, camera, watering, and lighting | 390 × 844 | 60.0 | 16.8 ms | 17.7 ms | 31.1 ms |
| Phone-size cloud ripples | 390 × 844 | 60.0 | 17.1 ms | 17.7 ms | 26.7 ms |

The first desktop entry sample included two browser intervals above 50 ms. The roughly 280 ms gap did not recur on the repeated desktop or phone-size entry samples; its cause was not identified. Keep it visible when assessing the results. No long tasks were reported in these production samples.

During active interaction samples, Spline rendered about 59.9 frames per second. Entry averages include the paused time between starting the measurement and pressing Enter the studio, so they are not useful as active-rendering FPS.

The before/after introduction check used development assets at 1280 × 720 and device pixel ratio 2: Spline went from 59.9 renders/second to **zero**, while browser animation stayed at 60 FPS with no intervals above 33.4 ms.

## Validation and limits

- All 92 automated checks passed, including pause/resume, sky updates without hidden room rendering, and cloud read-before-write ordering.
- Production build and `git diff --check` passed. The existing large-chunk advisory remains.
- Browser checks covered readiness, explicit entry, all camera selections, chair, watering, lamp, lighting, cloud glyph changes, project opening, and Escape dismissal at phone size.
- No physical low-end device, CPU/GPU throttling, high-DPI phone viewport, sustained battery/thermal test, or physical touch/pinch test was available. Phone-size tests used this Mac's processor. These results do not certify low-end-device performance.
