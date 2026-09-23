# Optima Curriculum Studio (Uber Widget)

A token-free course builder for Optima Academy Online teachers. Pick one of the On-Demand courses the team already built, keep what works, mute or swap the rest, add your own pieces, and export a Canvas-ready course. Standards check themselves off as content lands in the plan.

**Live:** https://optimaondemand.github.io/Uber_Widget/

Everything runs in the browser. Plans autosave to the browser and can be downloaded as a `.ocs.json` file (reopen it anywhere, or hand it to Joseph for a Canvas port). No server, no login, no AI calls.

## The seven steps

| Step | What happens |
|---|---|
| 1 Course | Start from a built spine (3rd/4th ELA, Math, Social Studies), start blank, or import any Canvas `.imscc` export. Pick your state standards (FL default; TX, MS, PR available). |
| 2 Standards | Shopping cart of standards from the [Standards Browser](https://optimaondemand.github.io/optima-standards-browser/). Coverage updates live; gaps get lesson suggestions from every course in the catalog. "I can…" and essential-question suggestions are plug-and-chug from the standard's verb. |
| 3 Template | Module shapes (ELA weekly rhythm, Historian-Citizen unit, Dimensions Math unit, project-based, lab, Socratic seminar). All marked **Draft** until a subject lead approves. |
| 4 Build | Drag-and-drop spine. Mute (keep but never export), swap, duplicate, add placeholder slots, pull lessons from other courses, edit objectives, standards, submission settings, quiz questions. Video status comes live from each repo's `video-manifest.json`. |
| 5 Enrich | Cross-reference the Art, Music, and ELA Reference Libraries against a lesson's topic. Attach a card to the lesson page or add it as its own page. |
| 6 Style | Optima skins (or a custom background), teacher details, school calendar with a pacing strip. |
| 7 Export | Canvas cartridge (`.imscc`), Canvas-ready HTML fragments, standalone HTML pages, standards coverage report (HTML/CSV), scope-and-sequence view, plan file, hand-off note. |

## Repository layout

```
index.html                 the app shell
assets/css/studio.css      styles (Optima brand tokens)
assets/js/data.js          loads catalog, standards bundles, libraries; Bloom's helpers; library matching
assets/js/state.js         plan model, undo, autosave, coverage
assets/js/generate.js      Canvas-safe HTML (inline styles only), reports
assets/js/imscc.js         IMS Common Cartridge export + import (JSZip)
assets/js/ui-*.js          one file per screen
data/catalog.json          index of courses (built)
data/courses/*.json        deconstructed course spines (built)
data/libraries/*.json      slim snapshots of art / music / literature libraries (built)
data/standards/*.json      snapshot of the standards manifest + the six bundles used by the catalog
data/templates.json        module templates + component types (hand-authored)
data/blooms.json           Bloom's verbs, I-can frames, strands (hand-authored)
data/skins.json            brand palettes (hand-authored)
data/calendar.json         2026-27 school calendar (board approved 2/3/2026)
tools/build-catalog.pl     the data pipeline
tools/serve.ps1            tiny local preview server (Windows PowerShell)
```

## Rebuilding the catalog

The catalog is generated from three inputs that the team already produces:

1. Canvas course exports (`.imscc`), extracted one folder per course.
2. The live GitHub Pages lesson pages, downloaded one folder per repo (`optima-4th-social-studies/`, …).
3. A cache folder holding `art.json`, `music.json`, `literature.json` (from `optima-widgets`) and `vm_<repo>.json` (each repo's `video-manifest.json`).

```bash
OCS_EXPORTS=/path/to/extracted-exports \
OCS_PAGES=/path/to/downloaded-pages \
OCS_CACHE=/path/to/cache \
perl tools/build-catalog.pl
```

Requires perl 5.14+ and `unzip` on PATH (Git Bash on Windows has both). Course folder names and repo names are listed at the top of the script. Course exports are not committed to this repo (they are large and contain licensed content).

The script parses module structure, assignments (and the iframe to each lesson page), quizzes (QTI: multiple choice, matching, essay), wiki pages, the lesson pages themselves (objectives, standards chips, mission question, video slots, key concepts, virtue lens), the scope-and-sequence planning tables, and the video manifests. Anything it could not find is flagged in the data (for example `pageStatus: "missing"` when a lesson page 404s on GitHub).

## Local preview

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve.ps1 -Port 8765
```

Then open http://localhost:8765/. (Opening `index.html` straight from the file system will not load the JSON data; browsers block that.)

## Deploying

GitHub Pages serves the `main` branch root. Push, and the site updates at the URL above within a minute or two.

## Single-file preview

`perl tools/build-single-file.pl preview.html` writes one self-contained HTML file with every script, style, and data file inlined (about 6 MB). Use it for hosted previews where nothing can be fetched; add `--fragment` to omit the document wrapper. In that mode the app shows a banner, cannot frame live lesson pages, and can only save allow-listed file types (plan file, CSV, HTML); cartridges and zips need the published site.

## Adding content

- **A new course:** export it from Canvas, download its lesson pages, add one line to `@COURSES` in `tools/build-catalog.pl`, rebuild. Or teachers can import the `.imscc` directly in Step 1 without any rebuild.
- **A template from a subject lead:** add an entry to `data/templates.json` (name, subject, grades, ordered slots). Set `status` to `approved` once the lead signs off.
- **A skin:** add an entry to `data/skins.json`.
- **The school calendar:** replace `data/calendar.json` (see `importFormat` inside it), or import a JSON file from Step 6.

## Known gaps (September 2026)

- 30 grade-4 and 16 grade-3 math lesson pages referenced by the Canvas exports are not yet published on GitHub Pages (they 404). The studio flags them; they will light up once the repo catches up.
- Discussion topics export in Common Cartridge format but have not yet been verified against a Canvas import.
- Templates and skins are starters pending input from subject leads and Bethany. The calendar is the board-approved 2026-27 calendar; early-dismissal planning days appear only as shading on the printed version and are not listed yet.
- Video specs for Arthur/VR are pending from Porter.

## Pulling every course from Canvas

`tools/canvas-pull.ps1` exports every master course from the team Canvas (optimaoaoteam.instructure.com, where all K-12 masters live unpublished) as `.imscc` cartridges and unzips them into `exports/extracted/`, which is the `OCS_EXPORTS` folder the catalog builder reads. It needs a Canvas access token in `$env:CANVAS_TOKEN` (session only, never committed; `exports/` is ignored by git).

```powershell
$env:CANVAS_TOKEN = '<token>'
powershell -NoProfile -ExecutionPolicy Bypass -File tools\canvas-pull.ps1 -DryRun   # list what would be pulled
powershell -NoProfile -ExecutionPolicy Bypass -File tools\canvas-pull.ps1           # export, download, unzip
```

Test shells (ZZ kits, "delete me", import tests, Teacher Resources) are excluded by name; adjust with `-Exclude`. Narrow with `-SearchTerm Grade` or `-CourseIds 39,61`. `-Domain` switches Canvas instances. Then rebuild the catalog with `OCS_EXPORTS=exports/extracted`.
