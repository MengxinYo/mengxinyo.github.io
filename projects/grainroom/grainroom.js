(function () {
  'use strict';

  var palettes = [
    { name: 'Silver', bg: '#0a0a0a', fg: '#ffffff', fg2: '#ffffff' },
    { name: 'Indigo', bg: '#111111', fg: '#5b7fff', fg2: '#5b7fff' },
    { name: 'Sunset', bg: '#000000', fg: '#ffb03a', fg2: '#ff5e3a' },
    { name: 'Paper', bg: '#efebe1', fg: '#15151c', fg2: '#3b3550' }
  ];

  var state = {
    mode: 'dither', algorithm: 'atkinson', size: 3, contrast: 1.3,
    exposure: 0, invert: false, palette: 0, equalize: 0.3,
    gap: 0.88, floor: 0, stars: true, zoom: 1, compare: false
  };
  var source = null;
  var sourceUrl = '';
  var fileName = '';
  var renderTimer = 0;

  var one = function (selector) { return document.querySelector(selector); };
  var all = function (selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); };
  var canvas = one('[data-canvas]');
  var original = one('[data-original]');
  var stage = one('[data-stage]');
  var empty = one('[data-empty]');
  var imageScroll = one('[data-image-scroll]');
  var imageWrap = one('[data-image-wrap]');
  var fileInput = one('[data-file-input]');
  var error = one('[data-error]');
  var processing = one('[data-processing]');

  function clamp(value) { return Math.min(1, Math.max(0, value)); }
  function hexRgb(value) {
    var h = value.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function diffuse(input, width, height, algorithm) {
    var values = new Float32Array(input);
    var result = new Uint8Array(values.length);
    var offsets = algorithm === 'atkinson'
      ? [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]]
      : [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]];
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var index = y * width + x;
        var next = values[index] > 0.5 ? 1 : 0;
        var err = values[index] - next;
        result[index] = next;
        offsets.forEach(function (offset) {
          var xx = x + offset[0], yy = y + offset[1];
          if (xx >= 0 && xx < width && yy < height) {
            values[yy * width + xx] = clamp(values[yy * width + xx] + err * offset[2]);
          }
        });
      }
    }
    return result;
  }

  function render() {
    if (!source) return;
    processing.hidden = false;
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(function () {
      try {
        var scale = Math.min(1, 4096 / Math.max(source.naturalWidth, source.naturalHeight));
        var width = Math.max(1, Math.round(source.naturalWidth * scale));
        var height = Math.max(1, Math.round(source.naturalHeight * scale));
        canvas.width = width;
        canvas.height = height;
        var context = canvas.getContext('2d');
        var palette = palettes[state.palette];
        context.fillStyle = palette.bg;
        context.fillRect(0, 0, width, height);

        var cellHeight = state.mode === 'ascii' ? state.size * 1.9 : state.size;
        var cols = Math.max(1, Math.floor(width / state.size));
        var rows = Math.max(1, Math.floor(height / cellHeight));
        var sample = document.createElement('canvas');
        sample.width = cols;
        sample.height = rows;
        var sampleContext = sample.getContext('2d', { willReadFrequently: true });
        sampleContext.drawImage(source, 0, 0, cols, rows);
        var pixels = sampleContext.getImageData(0, 0, cols, rows).data;
        var tones = new Float32Array(cols * rows);
        var histogram = new Uint32Array(256);
        var i;
        for (i = 0; i < tones.length; i++) {
          tones[i] = (0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2]) / 255;
          histogram[Math.round(tones[i] * 255)]++;
        }
        var total = 0, low = 0, high = 255;
        for (i = 0; i < 256; i++) {
          total += histogram[i];
          if (total < tones.length * 0.01) low = i;
          if (total < tones.length * 0.99) high = i;
        }
        for (i = 0; i < tones.length; i++) {
          var tone = high > low ? clamp((tones[i] * 255 - low) / (high - low)) : tones[i];
          tone = clamp((tone - 0.5) * state.contrast + 0.5 + state.exposure / 100);
          tones[i] = state.invert ? 1 - tone : tone;
        }

        var gradient = context.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, palette.fg);
        gradient.addColorStop(1, palette.fg2);
        context.fillStyle = gradient;

        if (state.mode === 'dither') {
          var bits = diffuse(tones, cols, rows, state.algorithm);
          for (var dy = 0; dy < rows; dy++) {
            for (var dx = 0; dx < cols; dx++) {
              if (bits[dy * cols + dx]) {
                context.fillRect(Math.floor(dx * width / cols), Math.floor(dy * height / rows), Math.ceil(width / cols), Math.ceil(height / rows));
              }
            }
          }
        } else if (state.mode === 'ascii') {
          var ramp = ' .`^,:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';
          context.font = 'bold ' + (height / rows * 0.92) + 'px monospace';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          for (var ay = 0; ay < rows; ay++) {
            for (var ax = 0; ax < cols; ax++) {
              var character = ramp[Math.floor(tones[ay * cols + ax] * (ramp.length - 1))];
              if (character !== ' ') context.fillText(character, (ax + 0.5) * width / cols, (ay + 0.5) * height / rows, width / cols);
            }
          }
        } else {
          renderMoons(context, tones, cols, rows, width, height, palette);
        }

        one('[data-dimensions]').textContent = width + ' × ' + height + ' px';
        one('[data-canvas-label]').textContent = (state.compare ? 'ORIGINAL' : state.mode.toUpperCase()) + ' / ' + palette.name.toUpperCase();
        showError('');
      } catch (renderError) {
        showError('Processing failed. Try a smaller image.');
      } finally {
        processing.hidden = true;
      }
    }, 55);
  }

  function renderMoons(context, tones, cols, rows, width, height, palette) {
    var counts = new Uint32Array(256);
    var i;
    for (i = 0; i < tones.length; i++) counts[Math.round(tones[i] * 255)]++;
    var cdf = new Float32Array(256), total = 0;
    var first = 0;
    for (i = 0; i < 256; i++) if (counts[i]) { first = counts[i]; break; }
    for (i = 0; i < 256; i++) {
      total += counts[i];
      cdf[i] = tones.length === first ? i / 255 : clamp((total - first) / (tones.length - first));
    }
    var radius = Math.min(width / cols, height / rows) * state.gap / 2;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var value = tones[y * cols + x];
        value = value * (1 - state.equalize) + cdf[Math.round(value * 255)] * state.equalize;
        value = clamp((value - state.floor) / (1 - state.floor));
        var level = Math.round(value * 13);
        if (!level) continue;
        context.save();
        context.translate((x + 0.5) * width / cols, (y + 0.5) * height / rows);
        context.beginPath();
        if (state.stars && level <= 3) {
          var starRadius = radius * (0.35 + level * 0.17);
          for (var point = 0; point < 64; point++) {
            var angle = point * Math.PI * 2 / 64;
            var sx = Math.sign(Math.cos(angle)) * Math.pow(Math.abs(Math.cos(angle)), 6) * starRadius;
            var sy = Math.sign(Math.sin(angle)) * Math.pow(Math.abs(Math.sin(angle)), 6) * starRadius;
            if (point) context.lineTo(sx, sy); else context.moveTo(sx, sy);
          }
          context.closePath();
        } else {
          var phase = Math.pow(clamp((level - (state.stars ? 3 : 0)) / (13 - (state.stars ? 3 : 0))), 1.12);
          context.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
          for (var step = 0; step <= 40; step++) {
            var theta = Math.PI / 2 - step * Math.PI / 40;
            context.lineTo((1 - 2 * phase) * radius * Math.cos(theta), radius * Math.sin(theta));
          }
          context.closePath();
        }
        context.fill();
        context.restore();
      }
    }
  }

  function showError(message) {
    error.textContent = message;
    error.hidden = !message;
  }

  function loadFile(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.type)) return showError('Choose a JPG, PNG, WebP, AVIF, or GIF image.');
    if (file.size > 30 * 1024 * 1024) return showError('Images must be 30 MB or smaller.');
    var url = URL.createObjectURL(file);
    var image = new Image();
    processing.hidden = false;
    image.onload = function () {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      source = image;
      sourceUrl = url;
      fileName = file.name;
      original.src = url;
      one('[data-file-name]').textContent = fileName;
      empty.hidden = true;
      imageScroll.hidden = false;
      one('[data-canvas-label]').hidden = false;
      all('[data-download], [data-compare], [data-zoom-out], [data-zoom-in]').forEach(function (button) { button.disabled = false; });
      state.zoom = 1;
      state.compare = false;
      syncPreview();
      render();
    };
    image.onerror = function () {
      URL.revokeObjectURL(url);
      processing.hidden = true;
      showError('This image could not be opened. Try converting it to JPG or PNG.');
    };
    image.src = url;
  }

  function syncPreview() {
    canvas.hidden = state.compare;
    original.hidden = !state.compare;
    imageWrap.style.width = (state.zoom * 100) + '%';
    one('[data-zoom-value]').textContent = Math.round(state.zoom * 100) + '%';
    one('[data-compare]').textContent = state.compare ? '⇆ Back to effect' : '⇆ Compare original';
    one('[data-canvas-label]').textContent = (state.compare ? 'ORIGINAL' : state.mode.toUpperCase()) + ' / ' + palettes[state.palette].name.toUpperCase();
  }

  function bindRange(selector, key, outputSelector, formatter) {
    var input = one(selector), output = one(outputSelector);
    function update() {
      state[key] = Number(input.value);
      output.textContent = formatter ? formatter(state[key]) : String(Number(state[key].toFixed(2)));
      input.style.setProperty('--range-fill', ((input.value - input.min) / (input.max - input.min) * 100) + '%');
      render();
    }
    input.addEventListener('input', update);
    update();
  }

  all('[data-pick]').forEach(function (button) { button.addEventListener('click', function () { fileInput.click(); }); });
  fileInput.addEventListener('change', function () { loadFile(fileInput.files[0]); fileInput.value = ''; });
  stage.addEventListener('dragover', function (event) { event.preventDefault(); stage.classList.add('is-dragging'); });
  stage.addEventListener('dragleave', function () { stage.classList.remove('is-dragging'); });
  stage.addEventListener('drop', function (event) { event.preventDefault(); stage.classList.remove('is-dragging'); loadFile(event.dataTransfer.files[0]); });

  all('[data-mode]').forEach(function (button) {
    button.addEventListener('click', function () {
      state.mode = button.dataset.mode;
      state.size = state.mode === 'dither' ? 3 : 12;
      one('[data-size]').min = state.mode === 'dither' ? 1 : 6;
      one('[data-size]').max = state.mode === 'dither' ? 12 : 30;
      one('[data-size]').value = state.size;
      one('[data-size-label]').textContent = state.mode === 'dither' ? 'Grain size' : 'Grid size';
      one('[data-size-output]').textContent = state.size + ' px';
      one('[data-algorithm-row]').hidden = state.mode !== 'dither';
      one('[data-moon-controls]').hidden = state.mode !== 'moon';
      all('[data-mode]').forEach(function (item) { var active = item === button; item.classList.toggle('is-active', active); item.setAttribute('aria-pressed', String(active)); });
      render();
    });
  });

  all('[data-palette]').forEach(function (button) {
    button.addEventListener('click', function () {
      state.palette = Number(button.dataset.palette);
      if (state.palette === 3) { state.invert = true; state.floor = 0.16; state.equalize = 0.3; }
      else { state.invert = false; state.floor = 0; }
      one('[data-invert]').checked = state.invert;
      one('[data-floor]').value = state.floor;
      one('[data-floor-output]').textContent = state.floor;
      all('[data-palette]').forEach(function (item) { var active = item === button; item.classList.toggle('is-active', active); item.setAttribute('aria-pressed', String(active)); });
      render();
    });
  });

  one('[data-algorithm]').addEventListener('change', function (event) { state.algorithm = event.target.value; render(); });
  one('[data-invert]').addEventListener('change', function (event) { state.invert = event.target.checked; render(); });
  one('[data-stars]').addEventListener('change', function (event) { state.stars = event.target.checked; render(); });
  bindRange('[data-size]', 'size', '[data-size-output]', function (value) { return value + ' px'; });
  bindRange('[data-contrast]', 'contrast', '[data-contrast-output]');
  bindRange('[data-exposure]', 'exposure', '[data-exposure-output]');
  bindRange('[data-equalize]', 'equalize', '[data-equalize-output]');
  bindRange('[data-gap]', 'gap', '[data-gap-output]');
  bindRange('[data-floor]', 'floor', '[data-floor-output]');

  one('.reset').addEventListener('click', function () { window.location.reload(); });
  one('[data-zoom-out]').addEventListener('click', function () { state.zoom = Math.max(0.5, state.zoom - 0.25); syncPreview(); });
  one('[data-zoom-in]').addEventListener('click', function () { state.zoom = Math.min(3, state.zoom + 0.25); syncPreview(); });
  one('[data-compare]').addEventListener('click', function () { state.compare = !state.compare; syncPreview(); });
  one('[data-download]').addEventListener('click', function () {
    if (!source) return;
    canvas.toBlob(function (blob) {
      if (!blob) return showError('Export failed. Please try again.');
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName.replace(/\.[^.]+$/, '') + '-' + state.mode + '.png';
      link.click();
      window.setTimeout(function () { URL.revokeObjectURL(link.href); }, 2000);
    }, 'image/png');
  });
})();
