/* =======================================================
 * site.js — behaviour for index.html and about.html
 *
 * Vanilla JS. This file used to depend on jQuery (84KB), jQuery Easing
 * (7KB, never actually called) and Waypoints (8KB) to do two things:
 * fade elements in on scroll, and toggle a menu. IntersectionObserver
 * and classList do both natively, so all three libraries are gone —
 * about 99KB less to download, parse and execute before the page is
 * interactive.
 *
 * Contents
 *   1. Coordinated first-paint  — cards appear together, never piecemeal
 *   2. Reveal on scroll         — for anything below the fold
 *   3. Mobile menu
 *   4. Full-height sidebar
 * ======================================================= */
(function () {
  'use strict';

  var MOBILE_BREAKPOINT = 768; // must match site-nav.css
  var LOAD_TIMEOUT = 2500;     // ms: never let a slow image hold the page

  /* -------------------------------------------------------------------
   * Wait for an element's images to be ready to paint
   *
   * Used before revealing anything that contains artwork. Without it a
   * container fades in the instant it's scrolled into view and its images
   * arrive some time afterwards — on the About page that showed up as the
   * grey tile appearing first and the screenshot popping in later.
   *
   * Two details matter:
   *   - `decode()` rather than the `load` event. `load` fires when the
   *     bytes have arrived, but the browser still has to decode them into
   *     a bitmap; revealing in between can still flash an empty frame.
   *     decode() resolves only once the image can actually be painted.
   *   - Lazy images are promoted to eager first. A `loading="lazy"` image
   *     may not have started downloading yet, and we're about to show it,
   *     so waiting on it without kicking off the fetch would stall until
   *     the timeout.
   * ---------------------------------------------------------------- */
  var whenImagesReady = function (el, cb) {
    var imgs = Array.prototype.slice.call(el.querySelectorAll('img'));
    if (el.tagName === 'IMG') imgs.push(el);

    /* CSS background images count too. The intro photo on the About page
       is a `background-image` on a div rather than an <img>, so querying
       for <img> alone would report "ready" while that artwork was still
       downloading — the same first-the-box-then-the-picture problem. */
    var bgUrls = [];
    var collectBg = function (node) {
      var bg = node.style && node.style.backgroundImage;
      if (!bg || bg === 'none') return;
      var m = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (m) bgUrls.push(m[1]);
    };
    collectBg(el);
    Array.prototype.forEach.call(el.querySelectorAll('[style*="background-image"]'), collectBg);

    if (!imgs.length && !bgUrls.length) { cb(); return; }

    var pending = imgs.length + bgUrls.length;
    var finished = false;

    var finish = function () {
      if (finished) return;
      finished = true;
      cb();
    };

    var settle = function () {
      var settled = false;
      return function () {
        if (settled) return;
        settled = true;
        pending -= 1;
        if (pending <= 0) finish();
      };
    };

    var decodeThen = function (img, once) {
      if (!img.decode) { once(); return; }
      // A decode failure (broken file) must still count, or one bad image
      // would hold the container back until the timeout.
      img.decode().then(once, once);
    };

    imgs.forEach(function (img) {
      var once = settle();

      if (img.loading === 'lazy') img.loading = 'eager';

      if (img.complete && img.naturalWidth > 0) {
        decodeThen(img, once);
        return;
      }

      img.addEventListener('load', function () { decodeThen(img, once); }, { once: true });
      img.addEventListener('error', once, { once: true });
    });

    bgUrls.forEach(function (url) {
      var once = settle();
      var probe = new Image();
      probe.onload = once;
      probe.onerror = once;
      probe.src = url;
      // Cached backgrounds are complete straight away and fire no event.
      if (probe.complete) once();
    });

    // Never let a slow or missing image hide content indefinitely.
    window.setTimeout(finish, LOAD_TIMEOUT);
  };

  /* -------------------------------------------------------------------
   * 1. Reveal on scroll
   *
   * IntersectionObserver replaces Waypoints. It runs off the main
   * thread, so it doesn't fire a JS callback on every scroll frame the
   * way the old scroll-handler approach did.
   * ------------------------------------------------------------------ */
  var revealOnScroll = function () {
    /* Everything except the work grid.
     *
     * Cards live inside `.animate-box` wrappers, so observing them meant
     * the wrapper faded in on intersection while the card faded in again
     * on image load — two overlapping animations on nested elements,
     * which is what read as a flicker. The grid's reveal is owned solely
     * by the site-wide preloader. */
    var boxes = Array.prototype.filter.call(
      document.querySelectorAll('.animate-box'),
      function (el) { return !el.closest('.colorlib-work'); }
    );
    if (!boxes.length) return;

    // No IntersectionObserver (very old browser): show everything rather
    // than leaving the page blank.
    if (!('IntersectionObserver' in window)) {
      boxes.forEach(function (el) {
        el.classList.add('animated', 'fadeInUp');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        var el = entry.target;

        observer.unobserve(el); // one-shot

        // Hold the reveal until this element's own images can be painted,
        // so a container and its artwork always arrive together.
        whenImagesReady(el, function () {
          // Stagger elements that came into view at the same moment.
          window.setTimeout(function () {
            var effect = el.getAttribute('data-animate-effect') || 'fadeInUp';
            el.classList.add('animated', effect);
          }, i * 120);
        });
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });

    boxes.forEach(function (el) {
      observer.observe(el);
    });
  };

  /* -------------------------------------------------------------------
   * 2. Mobile menu
   * ------------------------------------------------------------------ */
  var burgerMenu = function () {
    var toggle = document.querySelector('.js-colorlib-nav-toggle');
    var aside = document.getElementById('colorlib-aside');
    if (!toggle || !aside) return;

    var close = function () {
      if (!document.body.classList.contains('offcanvas')) return;
      document.body.classList.remove('offcanvas');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
    };

    var open = function () {
      document.body.classList.add('offcanvas');
      toggle.classList.add('active');
      toggle.setAttribute('aria-expanded', 'true');
    };

    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (document.body.classList.contains('offcanvas')) { close(); } else { open(); }
    });

    document.addEventListener('click', function (e) {
      if (!aside.contains(e.target) && !toggle.contains(e.target)) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); toggle.focus(); }
    });

    aside.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > MOBILE_BREAKPOINT) close();
    });
  };

  /* -------------------------------------------------------------------
   * 3. Full-height sidebar (desktop only)
   *
   * Below the breakpoint the sidebar is a drop-down panel whose height
   * CSS animates, so an inline pixel height would fight the transition.
   * ------------------------------------------------------------------ */
  var fullHeight = function () {
    var els = document.querySelectorAll('.js-fullheight');
    if (!els.length) return;

    var apply = function () {
      var h = window.innerWidth > MOBILE_BREAKPOINT ? window.innerHeight + 'px' : '';
      Array.prototype.forEach.call(els, function (el) { el.style.height = h; });
    };

    apply();
    window.addEventListener('resize', apply);
  };

  var init = function () {
    fullHeight();
    burgerMenu();
    revealOnScroll();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
