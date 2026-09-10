# Mengxin Yu — Portfolio

Static site. No build step, no dependencies to install — open `index.html`
in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Structure

```
index.html              Work grid (home)
about.html              About me — photography and side projects
resume.html             Resume — EN/中文 PDF preview + download
vibe-coding.html        Interactive experiments gallery
projects/
  grainroom/            Self-contained Grainroom image editor
work/
  tal.html              Case study — TAL Assessment Ecosystem
  houyi.html            Case study — Hou Yi and Ten Suns
assets/
  css/
    site-nav.css        ← Sidebar + mobile menu for index / artwork
    project-nav.css     ← Header for both case studies
    home.css            index.html only
    about.css           about.html only
    resume.css          resume.html only
    tal.css             work/tal.html only
    houyi.css           work/houyi.html only
    houyi-base.css      Layout/grid framework for the Hou Yi page
    houyi-fonts.css     @font-face declarations (Metropolis, Domine)
    animations.css      The 4 keyframes the reveal-on-scroll effect uses
    grid.css            Minimal 12-col grid (replaces Bootstrap)
  js/
    site.js             index / artwork behaviour (no dependencies)
    project-nav.js      Shared case-study nav behaviour (no dependencies)
    houyi.js            work/houyi.html behaviour (needs jQuery)
    vendor/             jQuery, pace, Hou Yi plugins — Hou Yi page only
  images/
    site/               Logo + work-grid thumbnails
    tal/  houyi/        Case-study assets
    photo/              (unused — legacy photo gallery)
  cv/                   CV_En.pdf, CV_Ch.pdf (resume PDFs)
  fonts/                metropolis/, domine/
```

## Conventions

**One file per page, one file per shared component.** If a rule is used by
more than one page it belongs in a `*-nav.css`; otherwise it lives in that
page's own stylesheet. Nothing is duplicated across files.

**Two navigations, deliberately.** The top-level pages use a left sidebar
(`site-nav.css`); the case studies use a top bar (`project-nav.css`).
They're different layouts but share the same hamburger, breakpoint,
easing curve and drop-down motion, so they read as one site.

**`js-` prefixed classes are JavaScript hooks only** — never styled.
`is-` prefixed classes are runtime state (`is-open`, `is-hidden`).

**index.html and about.html ship no libraries.** They were pulling in
Bootstrap (131KB) for eight grid classes and jQuery + Easing + Waypoints
(99KB) for a fade-in and a menu toggle. `grid.css` and native
IntersectionObserver replace all of it — 272KB down to 47KB. Only the
Hou Yi case study still needs jQuery, for its parallax hero and preloader
plugins.

**Nothing render-blocks the loader.** Each page inlines the loader's
resting styles in a `<style>` block in `<head>` and loads every stylesheet
non-blocking (`media="print"` + an onload that promotes it to `all`, with
a `<noscript>` fallback). This is deliberate and worth preserving: when
the loader was styled by an ordinary `<link>`, the curtain could not paint
until the resources it exists to cover had already downloaded — a slow
connection showed a long blank screen and *then* a loading animation.
`preloader.js` counts those stylesheets as load progress, so the curtain
still never lifts onto unstyled content.

**One loading animation, site-wide.** `preloader.css` + `preloader.js`
run on all four pages. Three separate mechanisms used to: Hou Yi had a
black curtain and a spinning ring plus the Pace.js library, the home page
had a bespoke card reveal, and the other two had nothing. The bar tracks
real image progress rather than a timer, and eases toward its target so
discrete steps read as continuous motion. Two failure paths matter: a
pure-CSS rule hides the curtain after 6s if the script never runs, and a
404 or stalled asset completes the bar instead of stranding the page.

**The work grid loads as one piece.** Card artwork is a CSS background,
so browsers paint each card as its own image lands. An inline script in
`<head>` sets `js-loading` before first paint and `preloader.js` swaps it
to `js-loaded` once the artwork is paintable, so the cards rise into
place as the curtain lifts. Since the hiding class is only ever added by
JS, a JS-off browser renders the grid normally.

**Breakpoint is 768px** everywhere. It's declared in both nav stylesheets
and in `site.js` / `project-nav.js`; changing it means changing all four.

## Known gaps

These reference files that aren't in the project — they were already
missing before the reorganisation, and the markup has been left in place
so it works as soon as the files are added:

- `assets/images/photo/t21.jpeg` is now unreferenced. The old photo grid
  that used it has been replaced by the project block, which resolved the
  20 broken thumbnails it sat alongside. Delete it if it isn't coming back.
- `about.html`'s project block uses generated placeholders in
  `assets/images/artwork/`. Swap them for real artwork by replacing the
  files (or repointing the `<img src>`); the tiles are a fixed square so
  any aspect ratio will sit correctly inside them.
- `work/houyi.html` expects `assets/images/houyi/visual1.png`.
- `houyi.css` references `images/icons/icon-arrow-down.svg` and
  `images/stats-bg.jpg` in rules whose markup no longer exists — harmless
  dead CSS, safe to delete.
