/* =========================================================================
 * project-nav.js
 *
 * Behaviour for the shared case-study navigation (see project-nav.css).
 * Vanilla JS, no jQuery — this file is small and loads on every case-study
 * page, so it shouldn't depend on a 90KB library being parsed first.
 *
 * Two responsibilities:
 *   1. Hamburger  — toggle the drop-down panel on small screens.
 *   2. Auto-hide  — reveal the bar while the user scrolls, then fade it out
 *                   once scrolling has been idle for IDLE_HIDE_DELAY.
 *
 * Design notes on the auto-hide:
 *   - Scroll events fire far more often than the screen refreshes, so the
 *     handler does nothing but record state and schedule a rAF callback.
 *     All DOM writes happen inside that callback, which keeps the main
 *     thread free and the animation smooth.
 *   - The bar is pinned open in three situations where hiding it would be
 *     hostile: at the very top of the page, while the menu is open, and
 *     while the user is hovering/keyboard-focused inside it.
 * ========================================================================= */
(function () {
  'use strict';

  var IDLE_HIDE_DELAY = 1500; // ms of scroll silence before the bar fades
  var TOP_THRESHOLD   = 60;   // px from the top where the bar always stays

  var nav = document.querySelector('.proj-nav');
  if (!nav) return;

  var toggle = nav.querySelector('.proj-nav__toggle');
  var panel  = nav.querySelector('.proj-nav__links');

  var idleTimer   = null;
  var ticking     = false;
  var pointerIn   = false;

  /* ---------------------------------------------------------------------
   * Show / hide
   * ------------------------------------------------------------------ */
  function show() {
    nav.classList.remove('is-hidden');
  }

  /* The bar sits in one of two visual modes:
     - pinned  : at the top of the page. Flat, opaque, hairline border —
                 it reads as part of the page header.
     - floating: content has scrolled underneath. Frosted + shadowed, so
                 it reads as a layer above the page.
     Called on every scroll frame; classList writes are no-ops when the
     class is already in the right state, so this is cheap. */
  function syncPinned() {
    nav.classList.toggle('is-pinned', window.pageYOffset <= TOP_THRESHOLD);
  }

  function hide() {
    // Never hide the bar out from under someone who is using it.
    if (nav.classList.contains('is-open') || pointerIn) return;
    if (window.pageYOffset <= TOP_THRESHOLD) return;
    nav.classList.add('is-hidden');
  }

  function scheduleHide() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(hide, IDLE_HIDE_DELAY);
  }

  /* ---------------------------------------------------------------------
   * Scroll handling
   * ------------------------------------------------------------------ */
  function onScrollFrame() {
    ticking = false;
    syncPinned();
    show();

    // At the top of the page the bar is simply always visible, so there's
    // no pending hide to schedule.
    if (window.pageYOffset <= TOP_THRESHOLD) {
      window.clearTimeout(idleTimer);
      return;
    }
    scheduleHide();
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(onScrollFrame);
  }

  // `passive: true` tells the browser we'll never call preventDefault(),
  // so it can keep scrolling on the compositor instead of waiting on JS.
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------------------------------------------------------------
   * Hamburger
   * ------------------------------------------------------------------ */
  function closeMenu() {
    if (!nav.classList.contains('is-open')) return;
    nav.classList.remove('is-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    scheduleHide();
  }

  function openMenu() {
    nav.classList.remove('is-hidden');
    nav.classList.add('is-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    window.clearTimeout(idleTimer); // an open menu never auto-hides
  }

  if (toggle) {
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (nav.classList.contains('is-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });
  }

  // Tapping anywhere outside the nav closes the panel.
  document.addEventListener('click', function (e) {
    if (!nav.contains(e.target)) closeMenu();
  });

  // Escape closes it and returns focus to the button, so keyboard users
  // aren't stranded inside a collapsed panel.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      closeMenu();
      if (toggle) toggle.focus();
    }
  });

  // Following a link should collapse the panel too.
  if (panel) {
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu();
    });
  }

  // If the window is widened past the breakpoint while the panel is open,
  // drop the open state — the links are inline again and `is-open` would
  // otherwise leave the hamburger stuck as an X.
  window.addEventListener('resize', function () {
    if (window.innerWidth > 768) closeMenu();
  });

  /* ---------------------------------------------------------------------
   * Keep the bar alive while it's being used
   * ------------------------------------------------------------------ */
  nav.addEventListener('mouseenter', function () {
    pointerIn = true;
    show();
    window.clearTimeout(idleTimer);
  });

  nav.addEventListener('mouseleave', function () {
    pointerIn = false;
    scheduleHide();
  });

  nav.addEventListener('focusin', function () {
    show();
    window.clearTimeout(idleTimer);
  });

  nav.addEventListener('focusout', function () {
    if (!nav.contains(document.activeElement)) scheduleHide();
  });

  /* Set the initial mode. A page can load already scrolled (a refresh, or
     a back-navigation that restores scroll position), so this has to read
     the real offset rather than assuming zero. */
  syncPinned();
}());
