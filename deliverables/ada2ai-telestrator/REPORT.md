# ADA2AI — Telestrator experience · report (STOP after Preview QA)

## Identifiers (record these)
| | |
|---|---|
| **Original base SHA** | `570f14036efa4f6f65d3ce1c2d0bd574e3728bb8` (head of `design/floodlight-d2` = head of PR #3) |
| **Experiment branch** | `experiment/ada2ai-telestrator` (new; did not exist before) |
| **Experiment commit (the only one)** | `b23caf0ad5ad7b3ecd040b949cb9965100d59893` |
| **Vercel Preview deployment ID** | **none** — see "Preview" |
| `main` | unchanged `31a060bcbc204aa26f0bf953d051a3a087baea4d` |
| `design/floodlight-d2` / PR #3 | unchanged `570f140…`; PR #3 not touched |
| Pre-existing uncommitted work | untouched: 6 modified files in `/home/user/ada2ai` (brightness WIP) still identical to `polish/WIP-A-brightness.patch`; no stash was used |

## What was built
One experience inside the existing homepage "footage → intelligence" section:
**scene → freeze → tracking IDs → tactical drawing → observations → flattened tactical board**, in TV-telestrator grammar.
It is an interactive component (autoplay once when scrolled into view, 6 step buttons, play/pause/replay), not a separate demo.

* **Honest by construction.** ADA2AI has no real match footage or tracker output, so the frame is the project's AI-generated still and *everything drawn on it is illustration*, permanently badged «توضيحي — ليس تحليلاً آلياً», with an explicit note under the panel and on the board. No speeds, distances, times, counts or identities. The reference's real beIN SPORTS footage (CC BY, third-party broadcast logo, unclear rights chain) was deliberately **not** used.
* **Palette:** teal = team/ball/main lines, scout-blue = opponents, ice-white hatched = open space, navy ground. No other colours.
* **RTL / type:** Arabic RTL kept; Cairo / Orbitron / Space Grotesk only.
* **Motion:** transform / opacity / SVG-mask stroke reveals only; no layout movement. Autoplay starts only in view. `prefers-reduced-motion` → starts on the annotated freeze, no autoplay, buttons switch instantly. Buttons are keyboard-operable (`aria-pressed`, labelled).
* **Loading:** the section is its own lazy chunk (`FootageIntel` 26.0 kB, 6.9 kB gzip) behind a fixed-height `Suspense` placeholder; the image is `loading="lazy"`; no video, so nothing to transcode.

## Changed files (3 — +513 / −158)
| File | Change |
|---|---|
| `src/components/cinema/TelestratorSequence.tsx` | **new**, 496 lines |
| `src/components/cinema/FootageIntel.tsx` | keeps heading, ghost "02", original copy; hosts the sequence; old box/panel code removed |
| `src/pages/LandingPage.tsx` | `FootageIntel` now `React.lazy` + `Suspense` (10 lines) |

No backend, Supabase, auth, RLS, route, dependency or other-page changes.

## Verification (all actually run)
| Check | Result |
|---|---|
| `npx tsc -b` / `npx tsc --noEmit` | ✅ 0 errors |
| `npx vite build` | ✅ main bundle 1,051.05 kB (base 1,051.04); Landing 23.0 kB (was 30.8); new lazy chunk 26.0 kB |
| `eslint` on the 3 changed files | ✅ clean. Repo-wide 19 problems = identical to base `570f140` (a first draft introduced 1 `setState`-in-effect error; fixed before commit) |
| Hard load **and** reload, 20 routes (prod build) | ✅ 20/20, 0 asset 404s, 0 JS errors |
| Landing links | ✅ «استكشف المنصة» → `/sport-id`, «شاهد كيف تعمل» → `/video-analysis` |
| Keyboard | ✅ Tab/focus + Enter on a step button sets `aria-pressed` |
| Horizontal overflow at 1440 / 768 / 390 (before, after, reduced-motion) | ✅ 0 px in all 9 runs |
| Page errors (console / uncaught) | ✅ none |
| Lab perf, prod build, base → experiment | desktop LCP 628→648 ms, CLS 0.0108→0.0108, long tasks 118→117 ms; mobile (4× CPU) LCP 1216→1064 ms, CLS 0.0051→0.0051, long tasks 1005→804 ms; scroll p95 ≤ 18.2 ms, 0 frames > 50 ms |

Lab/headless numbers, not a real device.

## Screenshots (`deliverables/ada2ai-telestrator/`)
* `compare/w1440-before-after.jpg`, `w768-…`, `w390-…` — same section, base `570f140` vs experiment (after shows the resting board).
* `compare/w{1440,768,390}-six-steps.jpg` — the six steps.
* `after/w*-auto-t*.jpg` — real autoplay timeline (1.5 / 4 / 7 / 11 / 14 s). `after/w*-step1..6.jpg`. `reduced/` — reduced-motion states.
* `before/` — the section on the base.

## Preview
**No Preview was produced and none exists.** Checked on the pushed commit: GitHub deployments for `b23caf0` = `[]`, combined status = `pending` with 0 statuses, and the repo's only recorded deployment is a Railway *production* one from April. There is no visible Vercel Git integration, and `CLAUDE.md` says deploys are manual `vercel deploy --prebuilt`; I have no Vercel credentials and a CLI deploy would be outside the permission you gave. To QA locally:
```bash
git fetch origin experiment/ada2ai-telestrator && git checkout experiment/ada2ai-telestrator
npm install --no-package-lock   # the lockfile points one dev dep at a blocked mirror
npm run dev                     # then open / and scroll to "من اللقطة إلى المعلومة"
```
If you connect Vercel to the repo, the branch push will build a Preview by itself.

## Rollback (mandatory)
Nothing was merged, deployed or opened as a PR; the original experience is live and unchanged on `design/floodlight-d2` and `main`.
1. **Rejected, never merged:** do nothing to PR #3 or `main`. Optionally delete the experiment: `git push origin --delete experiment/ada2ai-telestrator` (needs your OK) and, in the container only, `git worktree remove /home/user/ada2ai-telestrator`.
2. **An experiment PR, if you open one, and it is rejected:** close it.
3. **If it is ever merged and then rejected:** `git revert b23caf0ad5ad7b3ecd040b949cb9965100d59893` (single commit → one clean revert commit, no history rewrite).
4. **If it is ever deployed:** promote the previous Vercel deployment (`vercel rollback`).
5. **Never** reset or force-push `main`.

## Remaining shortcomings / not done
* **Not real analysis.** Still image + illustration. The "motion" of the opening is a push-in on a still, not live footage.
* **Telestrator elements deliberately not implemented** because they need real material: rewind with tracking bars, frame-blended slow motion, the source clock / stopwatch (needs real frame counts), score bar, dual-angle split screen, a fitted perspective transform (the board is a hand-placed sketch, labelled as such), sound.
* **Mobile (390 px):** the three in-frame label cards are hidden (they would clutter a 342 px frame); the same three observations show in the reading panel below. Board IDs/caption are ≈ 8–9 px.
* The experiment is based on `570f140`, so it does **not** include the uncommitted brightness WIP; the frame is brightened locally in the component only.
* Existing copy in the section that describes the workspace is unchanged; the AI-generated frame is captioned as such.
