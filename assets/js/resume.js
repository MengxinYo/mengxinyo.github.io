/* =========================================================================
 * resume.js — behaviour for resume.html
 *
 * Switches the previewed CV between the English and Chinese versions and
 * keeps the download button and fallback link pointing at whichever is
 * showing. English is the default (set in the markup), so if this script
 * never runs the page still previews and downloads a valid resume.
 *
 * The preview is a rendered page IMAGE; the download is the source PDF.
 * (Why not embed the PDF directly: the browser's native PDF viewer forces
 * its own dark background and toolbar and signals "loaded" unreliably over
 * file://, which produced both the dark partial render and the page
 * appearing before the CV had.)
 *
 * The sliding highlight is pure CSS, driven by one `data-lang` attribute.
 * ========================================================================= */
(function () {
  'use strict';

  var FILES = {
    en: { img: 'assets/cv/CV_En.png', pdf: 'assets/cv/CV_En.pdf', name: 'Mengxin-Yu-CV.pdf' },
    ch: { img: 'assets/cv/CV_Ch.png', pdf: 'assets/cv/CV_Ch.pdf', name: 'Mengxin-Yu-CV-CN.pdf' }
  };

  var toggle   = document.querySelector('.resume-toggle');
  var img      = document.getElementById('resumeImg');
  var download = document.getElementById('resumeDownload');
  var fallback = document.getElementById('resumeFallbackLink');
  var viewer   = document.querySelector('.resume-viewer');
  if (!toggle || !img) return;

  var buttons = toggle.querySelectorAll('.resume-toggle__btn');
  var current = 'en';

  function markReady() {
    if (viewer) viewer.classList.add('is-ready');
  }

  function show(lang) {
    var file = FILES[lang];
    if (!file || lang === current) return;
    current = lang;

    // Hide the freshly-swapped image until it has decoded, so the switch
    // cross-fades over the hint rather than flashing a half-painted page.
    if (viewer) viewer.classList.remove('is-ready');
    img.src = file.img;

    if (download) {
      download.href = file.pdf;
      download.setAttribute('download', file.name);
    }
    if (fallback) fallback.href = file.pdf;

    toggle.setAttribute('data-lang', lang);
    Array.prototype.forEach.call(buttons, function (btn) {
      var on = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  img.addEventListener('load', markReady);
  // If the first image was already cached and painted before this listener
  // attached, `complete` is true and no load event is coming.
  if (img.complete && img.naturalWidth > 0) markReady();

  toggle.addEventListener('click', function (e) {
    var btn = e.target.closest('.resume-toggle__btn');
    if (btn) show(btn.getAttribute('data-lang'));
  });

  // Left/right arrows switch tabs.
  toggle.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    show(current === 'en' ? 'ch' : 'en');
    var active = toggle.querySelector('.resume-toggle__btn.is-active');
    if (active) active.focus();
  });
}());
