/* =========================================================================
   Shopify Editions — shelf scene
   Horizontal rack: wheel / drag (with inertia) / keyboard.
   Hover: lift + deepen shadow (CSS) and a pointer-tracked cover parallax.
   ========================================================================= */
(function () {
	"use strict";

	var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	var finePointer  = window.matchMedia("(hover: hover) and (pointer: fine)");

	var viewport = document.querySelector("[data-viewport]");
	var rack     = document.querySelector("[data-rack]");
	var hint     = document.querySelector("[data-hint]");
	var albums   = Array.prototype.slice.call(document.querySelectorAll("[data-album]"));
	if (!viewport || !rack) return;

	/* ---- state ---- */
	var scrollX = 0, targetX = 0, velX = 0, minX = 0, maxX = 0;
	var tilt = 0, tiltTarget = 0;
	var dragging = false, moved = 0, lastX = 0, lastT = 0;
	var running = false, hintGone = false;
	var current = null;
	var MOBILE_BREAKPOINT = 768;

	function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
	function isMobileRack() { return window.innerWidth <= MOBILE_BREAKPOINT; }

	/* ---- render + animation loop ---- */
	function render() {
		if (!isMobileRack()) {
			rack.style.transform = "none";
			return;
		}
		rack.style.transform =
			"translate3d(" + scrollX.toFixed(2) + "px,0,0) rotateY(" + tilt.toFixed(3) + "deg)";
	}
	function tick() {
		var f = reduceMotion.matches ? 1 : 0.14;
		scrollX += (targetX - scrollX) * f;
		tilt    += (tiltTarget - tilt) * 0.06;
		if (Math.abs(targetX - scrollX) < 0.08 && Math.abs(tiltTarget - tilt) < 0.004) {
			scrollX = targetX; tilt = tiltTarget;
			render();
			running = false;
			return;
		}
		render();
		requestAnimationFrame(tick);
	}
	function wake() { if (!running) { running = true; requestAnimationFrame(tick); } }

	/* ---- measure scroll bounds: any album can reach dead-centre ---- */
	function measure() {
		if (!isMobileRack()) {
			minX = maxX = targetX = scrollX = 0;
			tilt = tiltTarget = 0;
			render();
			return;
		}
		var half = viewport.clientWidth / 2;
		var visibleAlbums = albums.filter(function (album) { return album.offsetWidth > 0; });
		var first = visibleAlbums[0], last = visibleAlbums[visibleAlbums.length - 1];
		if (!first) return;
		maxX = half - (first.offsetLeft + first.offsetWidth / 2);
		minX = half - (last.offsetLeft + last.offsetWidth / 2);
		if (minX > maxX) minX = maxX;
		targetX = clamp(targetX, minX, maxX);
		scrollX = clamp(scrollX, minX, maxX);
		render();
	}

	function centerOn(el, immediate) {
		if (!isMobileRack()) return;
		var vp = viewport.getBoundingClientRect();
		var r  = el.getBoundingClientRect();
		var delta = vp.width / 2 - (r.left + r.width / 2 - vp.left);
		targetX = clamp(scrollX + delta, minX, maxX);
		if (immediate) { scrollX = targetX; render(); } else wake();
	}

	function killHint() {
		if (hintGone || !hint) return;
		hintGone = true;
		hint.classList.add("is-hidden");
	}

	/* ---- active (hovered / focused / tapped) album ---- */
	function activate(album) {
		if (album.hasAttribute("data-coming-soon")) return;
		if (current === album) return;
		if (current) deactivate(current);
		current = album;
		album.classList.add("is-active");
		album.querySelector(".ed-album__cover").setAttribute("aria-expanded", "true");
		rack.classList.add("has-active");
	}
	function deactivate(album) {
		album.classList.remove("is-active");
		var c = album.querySelector(".ed-album__cover");
		c.setAttribute("aria-expanded", "false");
		c.style.setProperty("--px", "0");
		c.style.setProperty("--py", "0");
		c.parentElement.style.setProperty("--px", "0");
		c.parentElement.style.setProperty("--py", "0");
		if (current === album) current = null;
		if (!current) rack.classList.remove("has-active");
	}

	/* ---- wheel ---- */
	viewport.addEventListener("wheel", function (e) {
		if (!isMobileRack()) return;
		var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
		if (e.deltaMode === 1) d *= 16;
		else if (e.deltaMode === 2) d *= viewport.clientWidth;
		if (!d) return;
		e.preventDefault();
		targetX = clamp(targetX - d, minX, maxX);
		killHint();
		wake();
	}, { passive: false });

	/* ---- pointer drag ---- */
	viewport.addEventListener("pointerdown", function (e) {
		if (!isMobileRack()) return;
		if (e.pointerType === "mouse" && e.button !== 0) return;
		dragging = true;
		moved = 0;
		velX = 0;
		lastX = e.clientX;
		lastT = e.timeStamp;
		try { viewport.setPointerCapture(e.pointerId); } catch (x) {}
		viewport.classList.add("is-dragging");
	});

	/* geometric hit test — the covers carry 3D transforms, which make
	   e.target / elementFromPoint unreliable, so match on rects instead */
	function albumAtPoint(x, y) {
		for (var i = 0; i < albums.length; i++) {
			var r = albums[i].getBoundingClientRect();
			if (albums[i] === current) {
				var raised = albums[i].querySelector('.ed-album__floater').getBoundingClientRect();
				if (x >= raised.left && x <= raised.right && y >= raised.top && y <= raised.bottom) return albums[i];
			}
			if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return albums[i];
		}
		return null;
	}

	var parO = { queued: false, x: 0, y: 0, cover: null };
	function flushParallax() {
		parO.queued = false;
		if (!parO.cover) return;
		var r = parO.cover.getBoundingClientRect();
		var nx = clamp((parO.x - r.left) / r.width  - 0.5, -0.5, 0.5) * 1.7;
		var ny = clamp((parO.y - r.top)  / r.height - 0.5, -0.5, 0.5) * 1.7;
		parO.cover.style.setProperty("--px", nx.toFixed(4));
		parO.cover.style.setProperty("--py", ny.toFixed(4));
		parO.cover.parentElement.style.setProperty("--px", nx.toFixed(4));
		parO.cover.parentElement.style.setProperty("--py", ny.toFixed(4));
	}

	viewport.addEventListener("pointermove", function (e) {
		if (!dragging) {
			if (isMobileRack() && finePointer.matches && !reduceMotion.matches) {
				tiltTarget = (e.clientX / window.innerWidth - 0.5) * -4;
				wake();
			}
			if (finePointer.matches) hoverAt(e);
			return;
		}
		var dx = e.clientX - lastX;
		lastX = e.clientX;
		var dt = Math.max(1, e.timeStamp - lastT);
		lastT = e.timeStamp;
		velX = clamp((dx / dt) * 16, -46, 46);
		moved += Math.abs(dx);

		var n = targetX + dx;
		if (n > maxX)      n = maxX + (n - maxX) * 0.35;   /* rubber-band */
		else if (n < minX) n = minX + (n - minX) * 0.35;
		targetX = n;
		scrollX = n;
		render();
		if (moved > 6) killHint();
	});

	/* pointer-driven hover + cover parallax (delegated from the viewport) */
	function hoverAt(e) {
		var album = albumAtPoint(e.clientX, e.clientY);
		if (album !== current) {
			if (current && document.activeElement !== current.querySelector(".ed-album__cover")) {
				deactivate(current);
			}
			if (album) { activate(album); killHint(); }
		}
		if (album && !album.hasAttribute("data-coming-soon") && !reduceMotion.matches) {
			parO.x = e.clientX; parO.y = e.clientY;
			parO.cover = album.querySelector(".ed-album__cover");
			if (!parO.queued) { parO.queued = true; requestAnimationFrame(flushParallax); }
		} else {
			parO.cover = null;
		}
	}
	viewport.addEventListener("pointerleave", function () {
		if (dragging) return;
		if (current && document.activeElement !== current.querySelector(".ed-album__cover")) {
			deactivate(current);
		}
	});

	function endDrag(e) {
		if (!dragging) return;
		dragging = false;
		viewport.classList.remove("is-dragging");
		try { viewport.releasePointerCapture(e.pointerId); } catch (x) {}

		if (moved <= 6) {
			handleTap(e);
		} else if (!reduceMotion.matches && Math.abs(velX) > 0.5) {
			targetX = clamp(targetX + velX * 9, minX, maxX);   /* fling */
		} else {
			targetX = clamp(targetX, minX, maxX);
		}
		wake();
	}
	viewport.addEventListener("pointerup", endDrag);
	viewport.addEventListener("pointercancel", endDrag);

	/* swallow the click that a real drag would otherwise fire */
	viewport.addEventListener("click", function (e) {
		if (moved > 8) { e.preventDefault(); e.stopPropagation(); }
	}, true);
	viewport.addEventListener('click', function (e) {
		if (e.defaultPrevented || e.detail === 0) return;
		var album = albumAtPoint(e.clientX, e.clientY);
		if (album && !album.hasAttribute("data-coming-soon")) document.dispatchEvent(new CustomEvent('edition:open', {detail:album}));
	});

	/* ---- tap (coarse pointer / touch) ---- */
	function handleTap(e) {
		if (finePointer.matches) return;
		var album = albumAtPoint(e.clientX, e.clientY);
		if (album && !album.hasAttribute("data-coming-soon")) document.dispatchEvent(new CustomEvent('edition:open', {detail:album}));
		else if (current) deactivate(current);
		killHint();
	}

	/* ---- keyboard focus reveals the same state on every device ---- */
	albums.forEach(function (album) {
		var cover = album.querySelector(".ed-album__cover");
		cover.addEventListener("focus", function () {
			activate(album);
			if (cover.matches(":focus-visible")) centerOn(album);
		});
		cover.addEventListener("blur", function () { deactivate(album); });
	});

	/* ---- keyboard on the shelf itself ---- */
	viewport.addEventListener("keydown", function (e) {
		var step = (albums[0] ? albums[0].offsetWidth : 260) + 60;
		switch (e.key) {
			case "ArrowRight": targetX = clamp(targetX - step, minX, maxX); break;
			case "ArrowLeft":  targetX = clamp(targetX + step, minX, maxX); break;
			case "Home":       targetX = maxX; break;
			case "End":        targetX = minX; break;
			case "PageDown":   targetX = clamp(targetX - viewport.clientWidth, minX, maxX); break;
			case "PageUp":     targetX = clamp(targetX + viewport.clientWidth, minX, maxX); break;
			default: return;
		}
		e.preventDefault();
		killHint();
		wake();
	});

	/* ---- init ---- */
	var didInit = false;
	function init() {
		measure();
		if (!didInit) {
			didInit = true;
			if (hint && !finePointer.matches) {
				hint.textContent = "Tap an album to open it — swipe to browse the shelf";
			}
			var focus = albums[1] || albums[0];
			if (focus) centerOn(focus, true);
		}
	}
	init();
	window.addEventListener("load", init);
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(init);

	if (window.ResizeObserver) {
		new ResizeObserver(measure).observe(viewport);
	}
	window.addEventListener("resize", measure);

	if (reduceMotion.addEventListener) {
		reduceMotion.addEventListener("change", function () { tiltTarget = 0; wake(); });
	}
})();
