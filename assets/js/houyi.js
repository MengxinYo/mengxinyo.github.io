/* ===================================================================
 * houyi.js — page behaviour for work/houyi.html
 *
 * Slimmed down from the original "Transcend" template main.js. That file
 * initialised thirteen widgets on load, but this page only ever contained
 * markup for two of them. The other eleven (PhotoSwipe, Masonry, Slick,
 * AOS, a stat counter, a MailChimp form, a placeholder polyfill, alert
 * boxes, a back-to-top button…) each queried for elements that don't
 * exist here, and several threw on load because their plugins were never
 * bundled. Removing them cuts the page's JS work and clears the console.
 *
 * The off-canvas menu code that used to live here is gone too: the header
 * is now the shared component in assets/js/project-nav.js, so this case
 * study navigates identically to work/tal.html. The page's black-curtain
 * preloader has likewise moved to the site-wide assets/js/preloader.js.
 *
 * What's left is what the page actually uses.
 * ------------------------------------------------------------------- */
(function ($) {

    'use strict';

    /* Parallax hero
     * The #home section carries data-parallax="scroll", which the parallax
     * plugin bundled in vendor/houyi-plugins.js picks up automatically on
     * DOM ready. Nothing to initialise by hand — this note exists so the
     * dependency isn't mistaken for dead weight and dropped later.
     * -------------------------------------------------- */

    /* Nothing left to initialise on DOM ready — the parallax plugin
       self-starts and the preloader is handled site-wide. The IIFE is
       kept so the file has an obvious home if page-specific behaviour is
       needed again. */

})(jQuery);
