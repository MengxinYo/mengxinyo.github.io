(function () {
	'use strict';
	var dialog = document.querySelector('.edition-detail');
	var target = dialog.querySelector('.edition-detail__cover');
	var text = dialog.querySelector('.edition-detail__text');
	var back = dialog.querySelector('.edition-detail__back');
	var reduced = matchMedia('(prefers-reduced-motion: reduce)');
	var source = null, busy = false;
	var descriptions = [
		'OnTop is a Mac menu bar app for taking a screenshot, marking it up, and handing it off without leaving the window you’re working in.',
		'A study in craft, creativity, and thoughtful digital experiences.',
		'An exploration of new possibilities through design and technology.',
		'Finding clarity and delight in the things we use every day.'
	];
	var stories = [
		[
			{ h: 'The problem', p: [
				'Vibe coding runs on visual references. But Mac’s screenshot flow fights that rhythm: hit the shortcut, and a few seconds later it’s buried on your desktop. Three or four references in, you’re alt-tabbing out just to find them.',
				'And once the image reaches your agent, “the button in the top right” only gets you so far — you need to point, not describe.'
			] },
			{ h: 'What OnTop does', p: [
				'A tray of your captures floats above every window, so screenshots never leave your workflow. Mark up a shot with boxes and pins, drop a comment right where the change belongs — “make this bigger,” “wrong color here” — and drag it straight to your agent. The fix you meant is the fix it sees.'
			] }
		]
	];
	var repos = [
		'https://github.com/MengxinYo/OnTop'
	];
	var repoEl = dialog.querySelector('[data-detail-repo]');
	var repoPathEl = dialog.querySelector('[data-detail-repo-path]');
	function renderRepo(index) {
		var url = repos[index];
		if (!url) { repoEl.hidden = true; return; }
		repoEl.href = url;
		try { repoPathEl.textContent = new URL(url).pathname.replace(/^\/|\/$/g, ''); }
		catch (e) { repoPathEl.textContent = url.replace(/^https?:\/\/(www\.)?/, ''); }
		repoEl.hidden = false;
	}
	var sectionsHost = dialog.querySelector('.edition-detail__sections');
	var placeholderSections = sectionsHost.innerHTML;
	function renderSections(index) {
		var story = stories[index];
		if (!story) { sectionsHost.innerHTML = placeholderSections; return; }
		sectionsHost.replaceChildren();
		story.forEach(function (block) {
			var section = document.createElement('section');
			var heading = document.createElement('h2');
			heading.textContent = block.h;
			section.appendChild(heading);
			block.p.forEach(function (copy) {
				var para = document.createElement('p');
				para.textContent = copy;
				section.appendChild(para);
			});
			sectionsHost.appendChild(section);
		});
	}
	function copyArt(album, container) {
		var style = getComputedStyle(album);
		['--tint-a','--tint-b','--orb','--orb-x','--orb-y','--grain'].forEach(function (key) {
			container.style.setProperty(key, style.getPropertyValue(key));
		});
		container.dataset.text = album.dataset.text || 'light';
		container.replaceChildren(album.querySelector('.ed-album__art').cloneNode(true));
	}
	async function fly(from, to) {
		if (reduced.matches || !from.width || !to.width) return;
		var flight = document.createElement('div');
		flight.className = 'edition-detail__flight';
		flight.setAttribute('aria-hidden', 'true');
		copyArt(source, flight);
		Object.assign(flight.style, {left:to.left+'px', top:to.top+'px', width:to.width+'px', height:to.height+'px'});
		dialog.appendChild(flight);
		try {
			await flight.animate([
				{transform:'translate('+(from.left-to.left)+'px,'+(from.top-to.top)+'px) scale('+(from.width/to.width)+','+(from.height/to.height)+')', boxShadow:'0 8px 18px -10px #0003'},
				{transform:'translate(0,0) scale(1)', boxShadow:'0 22px 40px -24px #0005'}
			], {duration:720, easing:'cubic-bezier(.22,1,.36,1)', fill:'both'}).finished;
		} finally { flight.remove(); }
	}
	async function open(album) {
		if (album.hasAttribute('data-coming-soon')) return;
		if (busy || dialog.open) return;
		busy = true; source = album;
		var index = Array.from(document.querySelectorAll('[data-album]')).indexOf(album);
		var embedded = index === 1;
		var from = album.querySelector('.ed-album__cover').getBoundingClientRect();
		dialog.classList.toggle('edition-detail--embedded', embedded);
		if (!embedded) copyArt(album, target);
		var title = album.querySelector('.ed-album__name').innerText.replace(/\n/g, ' ');
		dialog.querySelector('[data-detail-kicker]').textContent = title;
		dialog.querySelector('[data-detail-season]').textContent = album.querySelector('.ed-album__season').textContent;
		dialog.querySelector('[data-detail-intro]').textContent = descriptions[index] || 'An experiment in design, interaction, and creative coding.';
		renderSections(index);
		renderRepo(index);
		if (!embedded) target.style.visibility = 'hidden';
		dialog.showModal(); dialog.scrollTop = 0; text.scrollTop = 0;
		album.style.visibility = 'hidden';
		if (!reduced.matches) {
			dialog.animate([{backgroundColor:'#ffffff00'},{backgroundColor:'#ffffffff'}],{duration:350,fill:'both'});
			if (!embedded) text.animate([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'none'}],{duration:580,delay:160,fill:'both',easing:'cubic-bezier(.22,1,.36,1)'});
		}
		try { if (!embedded) await fly(from,target.getBoundingClientRect()); }
		finally { target.style.visibility = ''; busy = false; back.focus({preventScroll:true}); }
	}
	async function close() {
		if (busy || !dialog.open) return;
		busy = true;
		var embedded = dialog.classList.contains('edition-detail--embedded');
		var from = target.getBoundingClientRect();
		if (!embedded) target.style.visibility = 'hidden';
		if (!reduced.matches) {
			if (!embedded) text.animate([{opacity:1},{opacity:0}],{duration:180,fill:'forwards'});
			dialog.animate([{backgroundColor:'#ffffffff'},{backgroundColor:'#ffffff00'}],{duration:560,fill:'forwards'});
		}
		try { if (!embedded) await fly(from,source.querySelector('.ed-album__cover').getBoundingClientRect()); }
		finally {
			source.style.visibility = ''; dialog.close(); target.style.visibility = ''; dialog.classList.remove('edition-detail--embedded');
			dialog.getAnimations({subtree:true}).forEach(function (animation) { animation.cancel(); });
			source.querySelector('.ed-album__cover').focus({preventScroll:true});
			busy = false;
		}
	}
	document.querySelectorAll('[data-album]:not([data-coming-soon])').forEach(function (album) {
		album.querySelector('.ed-album__cover').addEventListener('click',function (e) {
			if (!e.defaultPrevented) open(album);
		});
	});
	// Touch uses the shelf's drag threshold before opening a project.
	document.addEventListener('edition:open',function (e) { open(e.detail); });
	back.addEventListener('click',close);
	dialog.addEventListener('cancel',function (e) { e.preventDefault(); close(); });
})();
