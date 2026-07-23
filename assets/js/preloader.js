/* =========================================================================
 * preloader.js
 *
 * Drives the site-wide loading animation (see preloader.css).
 *
 * Runs on every page, dependency-free and deferred.
 *
 * The curtain itself is plain HTML + CSS, so it paints immediately and
 * needs no JavaScript to appear — this file only measures and dismisses
 * it. Elapsed time is read from `performance.now()`, which counts from
 * navigation start, so deferring the script costs nothing in accuracy:
 * the minimum-display window is still measured from when the page
 * actually started loading, not from when this code happened to run.
 *
 * How progress is measured
 *   The bar reflects real work, not a timer. It counts the images the
 *   page needs for its first screen — both <img> elements and CSS
 *   background images declared inline — and advances as each one becomes
 *   paintable. A timed fake bar is easier to write but lies: it hits 100%
 *   while the page is still blank, which is precisely the problem this
 *   is meant to solve.
 *
 * Why the displayed value is eased rather than set directly
 *   Loading three images means progress arrives as 0 -> 33 -> 66 -> 100.
 *   Rendering that literally gives three visible jumps. The displayed
 *   value instead chases the real one a fraction of the remaining
 *   distance each frame, which turns the steps into continuous movement
 *   without ever showing more progress than has actually happened.
 * ========================================================================= */
(function () {
  'use strict';

  var MIN_VISIBLE  = 550;   // ms the loader is shown even on a warm cache
  var MAX_WAIT     = 5000;  // ms before we give up waiting on assets
  var EASE_RATE    = 0.12;  // how fast the bar chases its target, per frame

  var root = document.documentElement;
  var el   = document.querySelector('.preloader');

  // No markup on this page: make sure nothing is left in a loading state.
  if (!el) {
    root.classList.remove('js-loading');
    root.classList.add('js-loaded');
    return;
  }

  var bar    = el.querySelector('.preloader__bar');
  var target = 0;   // real progress, 0..1
  var shown  = 0;   // eased progress, 0..1
  var ended  = false;

  // Milliseconds since navigation started, not since this script ran.
  var elapsed = function () {
    return (window.performance && performance.now) ? performance.now() : 0;
  };

  /* ---------------------------------------------------------------------
   * Stylesheets
   *
   * Page CSS is loaded non-blocking (media="print" + an onload that
   * promotes it to "all"), which is what lets the loader paint instantly
   * instead of queueing behind it. The trade is that the curtain must not
   * lift before that CSS has applied, or it would reveal a moment of
   * unstyled content. So pending stylesheets are counted as load progress
   * alongside the images.
   * ------------------------------------------------------------------ */
  function collectStylesheets() {
    return Array.prototype.filter.call(
      document.querySelectorAll('link[rel="stylesheet"]'),
      function (link) {
        // `sheet` is populated once the file has parsed, whether or not
        // its media query currently applies — so this is true for sheets
        // still sitting at media="print".
        return !link.sheet;
      }
    );
  }

  /* ---------------------------------------------------------------------
   * Collect what we're waiting for
   * ------------------------------------------------------------------ */
  function collectSources() {
    var urls = [];

    // <img> elements, excluding anything explicitly deferred to a scroll.
    Array.prototype.forEach.call(document.images, function (img) {
      if (img.closest && img.closest('.preloader')) return;
      if (img.getAttribute('loading') === 'lazy') return;
      if (img.currentSrc || img.src) urls.push(img.currentSrc || img.src);
    });

    // Inline CSS background images — the work-grid cards and the About
    // page's intro photo are declared this way, and they're the largest
    // thing on their pages, so leaving them out would make the bar
    // finish well before the page looked ready.
    Array.prototype.forEach.call(
      document.querySelectorAll('[style*="background-image"]'),
      function (node) {
        var m = (node.style.backgroundImage || '').match(/url\(["']?([^"')]+)["']?\)/);
        if (m) urls.push(m[1]);
      }
    );

    // De-duplicate: the same file requested twice is one download.
    return urls.filter(function (u, i) { return urls.indexOf(u) === i; });
  }

  /* ---------------------------------------------------------------------
   * Watch them
   * ------------------------------------------------------------------ */
  function watch() {
    var urls   = collectSources();
    var sheets = collectStylesheets();
    var total  = urls.length + sheets.length;

    if (!total) { target = 1; return; }

    var loaded = 0;
    var advance = function () {
      loaded += 1;
      target = loaded / total;
    };

    sheets.forEach(function (link) {
      var settled = false;
      var done = function () {
        if (settled) return;
        settled = true;
        advance();
      };
      link.addEventListener('load', done);
      // A stylesheet that 404s must not hold the page behind the curtain.
      link.addEventListener('error', done);
      // It may have finished between collection and this line.
      if (link.sheet) done();
    });

    urls.forEach(function (url) {
      var settled = false;
      var done = function () {
        // Each source counts exactly once. A cached image reports
        // `complete` synchronously *and* still fires onload, which would
        // otherwise let one file consume two slots and push the bar past
        // where it should be.
        if (settled) return;
        settled = true;
        advance();
      };

      var probe = new Image();
      probe.onload = done;
      probe.onerror = done;  // a 404 must not stall the whole page
      probe.src = url;
      if (probe.complete) done();
    });
  }

  /* ---------------------------------------------------------------------
   * Render
   * ------------------------------------------------------------------ */
  function frame() {
    shown += (target - shown) * EASE_RATE;

    // Snap once we're within half a percent, otherwise the asymptote
    // means the bar never quite arrives.
    if (target - shown < 0.005) shown = target;

    if (bar) bar.style.transform = 'scaleX(' + shown.toFixed(4) + ')';

    var t = elapsed();

    if (!ended && shown >= 0.999 && t >= MIN_VISIBLE) {
      finish();
      return;
    }

    if (!ended && t >= MAX_WAIT) {
      // Something is not resolving. Complete the bar honestly rather than
      // holding the page hostage to one slow asset.
      target = 1;
      if (shown > 0.98) { finish(); return; }
    }

    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------------
   * Hand over to the page
   * ------------------------------------------------------------------ */
  function finish() {
    if (ended) return;
    ended = true;

    if (bar) bar.style.transform = 'scaleX(1)';
    el.classList.add('is-done');
    el.setAttribute('aria-hidden', 'true');

    root.classList.remove('js-loading');
    root.classList.add('js-loaded');

    /* Other scripts hook their entrance animations to this rather than to
       DOMContentLoaded, so content starts moving as the curtain lifts
       instead of having already finished behind it. */
    try {
      window.dispatchEvent(new CustomEvent('page:ready'));
    } catch (e) {
      // Older browsers without the CustomEvent constructor: the class on
      // <html> is the real contract, the event is a convenience.
    }

    // Drop the node once the exit transition has played, so it can't
    // intercept clicks or sit in the accessibility tree.
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1100);
  }

  watch();
  requestAnimationFrame(frame);

  // Backstop: if the ordinary path somehow hasn't completed by the time
  // every subresource has loaded, close it out.
  window.addEventListener('load', function () {
    target = 1;
    window.setTimeout(finish, MIN_VISIBLE);
  });
}());
