---
name: RTL layout pitfalls
description: How flex/absolute positioning breaks under dir="rtl" and the safe pattern used across this Arabic-first project
---

# RTL layout pitfalls (Arabic-first UI)

**Rule:** Under `dir="rtl"`, flex order and `justify-end` flip horizontally. Never rely on flex order to pin an element to a side in RTL layouts — pin with absolute positioning and explicit `left: 0` / `right: 0` styles instead.

**Why:** Slide layouts broke twice (hero image invisible under a gradient after flipping sides; text/image overlap) because flex `justify-end` placed content on the mirrored side. Explicit `left`/`right` absolute positioning is direction-agnostic and fixed both.

**How to apply:** Any new slide or page section in this project that anchors an image/panel to one side must use `position: absolute` with explicit `left`/`right`, then verify with a screenshot — RTL bugs are invisible in code review.
