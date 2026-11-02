# Rebuilding the deck

`deck.js` (Arabic, RTL) and `deck_en.js` (English, LTR) generate the .pptx files with pptxgenjs. The capability scores (slide 23) sit in the
`SCORES` object at the top of each file. They are empty on purpose because the source report
file was not available when this was built. Paste the report's 0–5 values there exactly,
keeping `"N/A"` and `"U"`, then rebuild:

```bash
npm i pptxgenjs sharp
node logo.js
NODE_PATH=./node_modules PPTX_SKILL=<path-to-pptx-skill> node deck.js ADA2AI_Executive_Benchmark_2026-11-02.pptx
```

Fonts: Cairo (Arabic) and Orbitron (Latin numerics/headlines), both from Google Fonts.
Install them on the presenting machine, or PowerPoint will substitute.
