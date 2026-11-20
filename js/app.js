(function () {
  'use strict';
  var CFG = window.WALK_CONFIG || {};
  var TEACHER = /[?&]teacher\b/.test(location.search);
  var $ = function (id) { return document.getElementById(id); };
  var manifest, core, students = [], pieces = null, images = {};
  var state = { student: null, controls: {}, loop: true, tab: 0, sel: null, frame: 0, playing: true };
  var ctlByName = {}, rowEls = {};

  var PRESETS = [
    { name: 'Proud March', v: {} },
    { name: 'Sneaky', v: { 'Stride': 700, 'Step Height': 120, 'Hip Drop': 50, 'Lean': 12, 'Bounce': 8, 'Arm Swing': 50, 'Elbow Drag': 60, 'Step Hold': 0.5, 'Cycle Frames': 32, 'Head Bob': 1, 'Stomp Nod': 3, 'Chin Up': -6, 'Swagger': 0 } },
    { name: 'Bouncy', v: { 'Bounce': 58, 'Step Height': 170, 'Step Hold': 0.1, 'Stomp Nod': 16, 'Hand Flop': 35, 'Arm Swing': 140, 'Peck': 5, 'Bounce Delay': -3 } },
    { name: 'Robot', v: { 'Bounce': 0, 'Hand Flop': 0, 'Head Stabilize': 100, 'Stomp Nod': 0, 'Swagger': 0, 'Peck': 0, 'Elbow Drag': 0, 'Arm Swing': 70, 'Step Hold': 0.55, 'Hip Rock': 0, 'Torso Rock': 0, 'Hip Push': 0, 'Head Bob': 0, 'Toe Flick': 0, 'Arm Delay': 0, 'Nod Delay': 0 } },
    { name: 'Sleepy', v: { 'Lean': 10, 'Chin Up': -10, 'Head Tilt': 12, 'Cycle Frames': 48, 'Bounce': 6, 'Step Height': 60, 'Arm Swing': 30, 'Hip Drop': 25, 'Hand Flop': 30, 'Stomp Nod': 4, 'Step Hold': 0 } },
    { name: 'Show-off', v: { 'Swagger': 10, 'Chin Up': 9, 'Lean': -8, 'Arm Swing': 160, 'Step Height': 240, 'Hip Rock': 8, 'Hip Push': 12, 'Peck': 15 } }
  ];

  function fetchJSON(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  function visible(c) { return TEACHER || c.kid; }
  function lo(c) { return TEACHER || c.kidMin === undefined ? c.min : c.kidMin; }
  function hi(c) { return TEACHER || c.kidMax === undefined ? c.max : c.kidMax; }
  function step(c) { var r = hi(c) - lo(c); return r <= 1 ? 0.01 : r <= 20 ? 0.1 : 1; }
  function clampC(c, v) { return Math.min(hi(c), Math.max(lo(c), v)); }
  function fmt(c, v) { var s = step(c); return s < 0.1 ? v.toFixed(2) : s < 1 ? v.toFixed(1) : Math.round(v).toString(); }
  function isAnim(spec) { return spec && typeof spec === 'object'; }
  function valueNow(name) { return core.valueAt(state.controls[name], state.frame, ctlByName[name]['default']); }
  function setStatus(msg, kind) { var s = $('status'); s.textContent = msg; s.className = 'status' + (kind ? ' ' + kind : ''); }

  if (/[?&]test\b/.test(location.search)) window.__walk = { state: state, payload: function () { return payload(); }, makeCode: function (o) { return makeCode(o); }, core: function () { return core; } };

  // ---------- boot ----------
  Promise.all([fetchJSON('manifest.json'), fetchJSON('students/index.json')]).then(function (r) {
    manifest = r[0]; students = r[1].students || [];
    core = WalkCore.create(manifest);
    manifest.controls.forEach(function (c) { ctlByName[c.name] = c; });
    buildPresets(); buildTabs(); bindUI();
    if (TEACHER) $('teacherNav').hidden = false;
    $('saveSheetBtn').hidden = !CFG.sheetUrl;
    $('loading').hidden = true;
    var want = (location.hash || '').replace('#', '').toUpperCase();
    if (students.indexOf(want) >= 0) openStudent(want); else showGallery();
    requestAnimationFrame(tick);
  }).catch(function (e) { $('loading').textContent = 'Could not load Walk Studio. Ask your teacher. (' + e.message + ')'; });

  // ---------- gallery ----------
  function showGallery() {
    state.student = null; history.replaceState(null, '', location.pathname + location.search);
    $('editor').hidden = true; $('who').hidden = true; $('gallery').hidden = false;
    var g = $('grid'); g.innerHTML = '';
    students.forEach(function (sid) {
      var b = document.createElement('button');
      var saved = localStorage.getItem('walkrig:' + sid) ? '✓ has saved work' : '';
      b.innerHTML = '<img loading="lazy" src="students/' + sid + '/thumb.jpg" alt=""><b>' + sid + '</b><span class="saved">' + saved + '</span>';
      b.onclick = function () { askConfirm(sid); };
      g.appendChild(b);
    });
  }
  function askConfirm(sid) {
    if (TEACHER) { openStudent(sid); return; }
    $('confirmImg').src = 'students/' + sid + '/thumb.jpg';
    $('confirmTitle').textContent = 'Is this your drawing? (' + sid + ')';
    $('confirm').hidden = false;
    $('confirmYes').onclick = function () { $('confirm').hidden = true; openStudent(sid); };
    $('confirmNo').onclick = function () { $('confirm').hidden = true; };
  }

  // ---------- student ----------
  function openStudent(sid) {
    $('loading').hidden = false; $('loading').textContent = 'Getting your character ready…';
    fetchJSON('students/' + sid + '/pieces.json').then(function (info) {
      pieces = info; images = {};
      var names = Object.keys(info.parts);
      return Promise.all(names.map(function (n) {
        return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { images[n] = im; res(); }; im.onerror = rej; im.src = 'students/' + sid + '/' + n + '.png'; });
      }));
    }).then(function () {
      state.student = sid; state.frame = 0; state.playing = true; state.sel = null;
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem('walkrig:' + sid) || 'null'); } catch (e) { saved = null; }
      state.controls = (saved && saved.controls) || {};
      state.loop = !saved || saved.loop !== false;
      $('loopToggle').checked = state.loop;
      history.replaceState(null, '', location.pathname + location.search + '#' + sid);
      $('gallery').hidden = true; $('editor').hidden = false; $('who').hidden = false;
      $('whoThumb').src = 'students/' + sid + '/thumb.jpg'; $('whoName').textContent = sid;
      $('loading').hidden = true;
      setStatus(saved ? 'Welcome back! We kept your work from last time.' : 'Your work is saved on this Chromebook automatically.');
      fitCanvas(); buildControls(); refreshAll();
    }).catch(function (e) { $('loading').textContent = 'Could not load ' + sid + ' (' + e.message + ')'; });
  }

  // ---------- controls UI ----------
  function buildPresets() {
    var box = $('presetBtns');
    PRESETS.forEach(function (p) {
      var b = document.createElement('button'); b.className = 'chip'; b.textContent = p.name;
      b.onclick = function () { applyValues(p.v); setStatus('Started from "' + p.name + '". Now make it yours!'); };
      box.appendChild(b);
    });
  }
  function applyValues(v) {
    state.controls = {};
    Object.keys(v).forEach(function (n) { if (ctlByName[n]) state.controls[n] = v[n]; });
    changed(true);
  }
  function buildTabs() {
    var t = $('tabs');
    manifest.groups.forEach(function (g, i) {
      var b = document.createElement('button'); b.textContent = g;
      b.onclick = function () { state.tab = i; buildControls(); refreshAll(); };
      t.appendChild(b);
    });
  }
  function buildControls() {
    var tabs = $('tabs').children;
    for (var i = 0; i < tabs.length; i++) tabs[i].className = i === state.tab ? 'on' : '';
    var box = $('controls'); box.innerHTML = ''; rowEls = {};
    var group = manifest.groups[state.tab];
    manifest.controls.filter(function (c) { return c.group === group && visible(c); }).forEach(function (c) {
      if (c.type === 'choice') { box.appendChild(speedRow(c)); return; }
      var row = document.createElement('div'); row.className = 'ctl';
      row.innerHTML = '<div class="name">' + c.label + (TEACHER && c.label !== c.name ? '<small>' + c.name + '</small>' : '') + (!c.kid ? '<small>teacher only</small>' : '') + '</div>' +
        '<input type="range" min="' + lo(c) + '" max="' + hi(c) + '" step="' + step(c) + '" aria-label="' + c.label + '">' +
        '<div class="val"></div><button class="kbtn" title="Add or remove a key at this frame (K)"><i></i></button>';
      var input = row.querySelector('input'), kb = row.querySelector('.kbtn');
      row.querySelector('.name').onclick = function () { state.sel = c.name; refreshAll(); };
      input.addEventListener('input', function () { state.sel = c.name; setValue(c.name, parseFloat(input.value)); });
      input.addEventListener('pointerdown', function () { state.sel = c.name; });
      kb.onclick = function () { state.sel = c.name; toggleKey(c.name); };
      kb.disabled = !c.keyframeable;
      box.appendChild(row);
      rowEls[c.name] = { row: row, input: input, val: row.querySelector('.val'), kb: kb };
    });
  }
  function speedRow(c) {
    var row = document.createElement('div'); row.className = 'speed';
    row.innerHTML = '<span class="name">' + c.label + '</span>';
    c.choices.forEach(function (ch) {
      var b = document.createElement('button'); b.textContent = ch.label; b.dataset.v = ch.value;
      b.onclick = function () { state.controls[c.name] = ch.value; changed(); };
      row.appendChild(b);
    });
    rowEls[c.name] = { speed: row };
    return row;
  }

  // ---------- value & key editing ----------
  function setValue(name, v) {
    var c = ctlByName[name], spec = state.controls[name];
    v = clampC(c, v);
    if (isAnim(spec)) {
      var k = spec.k, f = state.frame, found = false;
      for (var i = 0; i < k.length; i++) if (k[i][0] === f) { k[i][1] = v; found = true; }
      if (!found) { k.push([f, v]); k.sort(function (a, b) { return a[0] - b[0]; }); }
    } else state.controls[name] = v;
    changed();
  }
  function toggleKey(name) {
    var c = ctlByName[name]; if (!c.keyframeable) return;
    var spec = state.controls[name], f = state.frame, v = valueNow(name);
    if (!isAnim(spec)) { state.controls[name] = { k: [[f, v]], loop: state.loop }; state.playing = false; }
    else {
      var idx = -1;
      spec.k.forEach(function (kk, i) { if (kk[0] === f) idx = i; });
      if (idx >= 0) { spec.k.splice(idx, 1); if (!spec.k.length) state.controls[name] = v; }
      else { spec.k.push([f, v]); spec.k.sort(function (a, b) { return a[0] - b[0]; }); }
    }
    changed();
  }
  var saveTimer = null;
  function changed(rebuild) {
    Object.keys(state.controls).forEach(function (n) { if (isAnim(state.controls[n])) state.controls[n].loop = state.loop; });
    refreshAll();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { localStorage.setItem('walkrig:' + state.student, JSON.stringify({ controls: state.controls, loop: state.loop, at: Date.now() })); }, 400);
  }
  function refreshAll() {
    Object.keys(rowEls).forEach(function (n) {
      var e = rowEls[n], c = ctlByName[n], spec = state.controls[n];
      if (e.speed) {
        var cur = core.valueAt(spec, 0, c['default']);
        Array.prototype.forEach.call(e.speed.querySelectorAll('button'), function (b) { b.className = (+b.dataset.v === cur) ? 'on' : ''; });
        return;
      }
      var v = valueNow(n);
      if (document.activeElement !== e.input) e.input.value = v;
      e.val.textContent = fmt(c, v);
      var anim = isAnim(spec), onKey = anim && spec.k.some(function (k) { return k[0] === state.frame; });
      e.kb.className = 'kbtn' + (anim ? ' anim' : '') + (onKey ? ' on' : '');
      e.row.className = 'ctl' + (state.sel === n ? ' sel' : '');
    });
    drawTimeline();
  }

  // ---------- timeline ----------
  function drawTimeline() {
    var frames = core.frames, keys = $('keys'); keys.innerHTML = '';
    $('playhead').style.left = (state.frame / (frames - 1) * 100) + '%';
    $('frameNum').textContent = state.frame;
    $('playBtn').textContent = state.playing ? '❚❚' : '▶';
    var n = state.sel, spec = n && state.controls[n];
    if (!n) { $('tlLabel').innerHTML = 'Tap a slider name, then ◆ to animate it'; return; }
    var c = ctlByName[n];
    if (!isAnim(spec)) { $('tlLabel').innerHTML = '<b>' + c.label + '</b> is not animated. Press ◆ to add a key here.'; return; }
    $('tlLabel').innerHTML = '<b>' + c.label + '</b>: drag ◆ to move, double-click to delete' + (state.loop ? ' · loops back at the end' : '');
    spec.k.forEach(function (k, i) {
      var d = document.createElement('div'); d.className = 'key';
      d.style.left = (k[0] / (frames - 1) * 100) + '%';
      d.title = 'Frame ' + k[0] + ': ' + fmt(c, k[1]);
      d.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); dragKey(ev, spec, i); });
      d.addEventListener('dblclick', function (ev) { ev.stopPropagation(); spec.k.splice(i, 1); if (!spec.k.length) state.controls[n] = k[1]; changed(); });
      keys.appendChild(d);
    });
    if (state.loop && spec.k[spec.k.length - 1][0] < frames - 1) {
      var g = document.createElement('div'); g.className = 'key loop'; g.style.left = '100%'; g.title = 'Loops back to the first key';
      keys.appendChild(g);
    }
  }
  function frameFromEvent(ev) {
    var r = $('track').getBoundingClientRect();
    return Math.max(0, Math.min(core.frames - 1, Math.round((ev.clientX - r.left) / r.width * (core.frames - 1))));
  }
  function dragKey(ev, spec, i) {
    state.playing = false;
    var key = spec.k[i];
    function mv(e) {
      var f = frameFromEvent(e);
      if (!spec.k.some(function (k) { return k !== key && k[0] === f; })) { key[0] = f; state.frame = f; }
      spec.k.sort(function (a, b) { return a[0] - b[0]; }); refreshAll();
    }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); changed(); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  // ---------- canvas ----------
  var canvas, ctx, view = { s: 1, ox: 0, oy: 0 };
  function fitCanvas() {
    canvas = $('view'); ctx = canvas.getContext('2d');
    var wrap = $('canvasWrap'), W = wrap.clientWidth, H = wrap.clientHeight;
    var cw = manifest.comp.width, ch = manifest.comp.height;
    var s = Math.min(W / cw, H / ch) * 0.98;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.style.width = Math.round(cw * s) + 'px'; canvas.style.height = Math.round(ch * s) + 'px';
    canvas.width = Math.round(cw * s * dpr); canvas.height = Math.round(ch * s * dpr);
    view.s = s * dpr;
  }
  var order = null;
  function draw() {
    if (!ctx || !pieces) return;
    if (!order) order = manifest.parts.map(function (p) { return p.name; }).reverse();
    var pose = core.pose(state.frame, state.controls);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var s = view.s, gy = (manifest.rootOffset[1] + valueNow('Ground Y')) * s;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(canvas.width * 0.5, gy + 6 * s, canvas.width * 0.32, 18 * s, 0, 0, Math.PI * 2); ctx.fill();
    for (var i = 0; i < order.length; i++) {
      var n = order[i], p = pieces.parts[n], im = images[n]; if (!p || !im) continue;
      var m = pose.world[n];
      ctx.setTransform(m[0] * s, m[1] * s, m[2] * s, m[3] * s, m[4] * s, m[5] * s);
      ctx.drawImage(im, p.x, p.y, p.w, p.h);
    }
  }
  var last = 0, acc = 0;
  function tick(t) {
    if (state.student && state.playing) {
      acc += Math.min(200, t - (last || t));
      var adv = Math.floor(acc / (1000 / core.fps));
      if (adv > 0) { acc -= adv * 1000 / core.fps; state.frame = (state.frame + adv) % core.frames; refreshAll(); }
    }
    last = t; draw();
    requestAnimationFrame(tick);
  }

  // ---------- saving ----------
  function payload() {
    var c = {};
    Object.keys(state.controls).forEach(function (n) {
      var s = state.controls[n];
      c[n] = isAnim(s) ? { k: s.k.map(function (k) { return [k[0], +k[1].toFixed(3)]; }), loop: state.loop } : +(+s).toFixed(3);
    });
    return { format: 'walkrig-save', v: 1, rigVersion: manifest.rigVersion, student: state.student, savedAt: new Date().toISOString(), controls: c };
  }
  function b64url(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function makeCode(obj) {
    var raw = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof CompressionStream === 'undefined') return Promise.resolve('WR0-' + b64url(raw));
    var cs = new CompressionStream('deflate-raw');
    var out = new Response(new Blob([raw]).stream().pipeThrough(cs)).arrayBuffer();
    return out.then(function (buf) { return 'WR1-' + b64url(new Uint8Array(buf)); });
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return legacyCopy(t); });
    return Promise.resolve(legacyCopy(t));
  }
  function legacyCopy(t) { var a = $('codeText'); a.value = t; a.select(); try { return document.execCommand('copy'); } catch (e) { return false; } }

  function bindUI() {
    $('switchBtn').onclick = showGallery;
    $('prevStudent').onclick = function () { var i = students.indexOf(state.student); openStudent(students[(i - 1 + students.length) % students.length]); };
    $('nextStudent').onclick = function () { var i = students.indexOf(state.student); openStudent(students[(i + 1) % students.length]); };
    $('playBtn').onclick = function () { state.playing = !state.playing; refreshAll(); };
    $('track').addEventListener('pointerdown', function (ev) {
      state.playing = false; state.frame = frameFromEvent(ev); refreshAll();
      function mv(e) { state.frame = frameFromEvent(e); refreshAll(); }
      function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    $('loopToggle').onchange = function () { state.loop = this.checked; changed(); };
    $('resetBtn').onclick = function () { if (confirm('Start over with the original walk?')) { applyValues({}); setStatus('Back to the original walk.'); } };
    $('surpriseBtn').onclick = function () {
      var v = {};
      manifest.controls.forEach(function (c) {
        if (!c.kid) return;
        if (c.type === 'choice') { v[c.name] = c.choices[Math.floor(Math.random() * c.choices.length)].value; return; }
        var t = Math.random(), mid = c['default'];
        var r = t < 0.5 ? mid + (lo(c) - mid) * (Math.random() * 0.8) : mid + (hi(c) - mid) * (Math.random() * 0.8);
        v[c.name] = +r.toFixed(2);
      });
      applyValues(v); setStatus('🎲 Surprise! Keep what you like and change the rest.');
    };
    $('downloadBtn').onclick = function () {
      var blob = new Blob([JSON.stringify(payload(), null, 1)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = state.student + '-walk.walk';
      document.body.appendChild(a); a.click(); a.remove();
      setStatus('⬇️ Downloaded "' + state.student + '-walk.walk". Turn it in on Google Classroom.', 'good');
    };
    $('codeBtn').onclick = function () {
      makeCode(payload()).then(function (code) {
        $('codeText').value = code; $('codeModal').hidden = false;
        return copyText(code).then(function (ok) {
          setStatus(ok ? '📋 Code copied! Paste it into Google Classroom.' : 'Select the code and copy it.', ok ? 'good' : '');
          $('codeText').select();
        });
      });
    };
    $('codeClose').onclick = function () { $('codeModal').hidden = true; };
    $('saveSheetBtn').onclick = function () {
      var body = JSON.stringify(payload());
      setStatus('Saving to class…');
      fetch(CFG.sheetUrl, { method: 'POST', body: body })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.ok) setStatus('☁️ Saved to class at ' + new Date().toLocaleTimeString() + '!', 'good'); else throw new Error('not ok'); })
        .catch(function () {
          fetch(CFG.sheetUrl, { method: 'POST', mode: 'no-cors', body: body })
            .then(function () { setStatus('☁️ Sent to class. If your teacher can\'t find it, use Download or Copy code too.', 'good'); })
            .catch(function () { setStatus('Couldn\'t reach the class sheet. Use Download or Copy my code instead.', 'bad'); });
        });
    };
    window.addEventListener('resize', function () { if (state.student) fitCanvas(); });
    window.addEventListener('keydown', function (e) {
      if (!state.student || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' && e.target.tagName !== 'BUTTON') { e.preventDefault(); state.playing = !state.playing; refreshAll(); }
      else if (e.key === 'ArrowRight' && e.target.type !== 'range') { state.playing = false; state.frame = (state.frame + 1) % core.frames; refreshAll(); }
      else if (e.key === 'ArrowLeft' && e.target.type !== 'range') { state.playing = false; state.frame = (state.frame - 1 + core.frames) % core.frames; refreshAll(); }
      else if ((e.key === 'k' || e.key === 'K') && state.sel) toggleKey(state.sel);
    });
  }
})();
