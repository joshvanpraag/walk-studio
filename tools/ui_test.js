// Drives Walk Studio in headless Chrome over the DevTools protocol (Node 22+, no dependencies).
// Usage: node tools/ui_test.js <chrome.exe> <base_url> <out_dir>
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const [chrome, base, outDir] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'walkui-'));
  const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9333', '--user-data-dir=' + prof, '--window-size=1366,768', 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9333/json')).json(); if (targets.length) break; } catch (e) {} await sleep(250); }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = {}, errors = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
  });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(expr + '\n' + JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
  const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, 'base64')); };
  const results = [];
  const check = (name, ok, info) => { results.push((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : '')); };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: new URL(base).origin }).catch(() => {});
  await send('Page.navigate', { url: base + '/index.html?test' });
  await sleep(1500);
  check('gallery shows students', await ev("document.querySelectorAll('#grid button').length") === 6);
  await ev("document.querySelectorAll('#grid button')[1].click()");
  await sleep(300);
  check('confirm dialog appears', await ev("!document.getElementById('confirm').hidden"));
  await ev("document.getElementById('confirmYes').click()");
  await sleep(1500);
  check('editor opens S02', await ev("__walk.state.student") === 'S02');
  await ev("localStorage.clear(); document.getElementById('resetBtn'); true");

  await ev("document.querySelectorAll('#tabs button')[1].click()");
  await sleep(200);
  check('Body & Arms tab shows 16 sliders', await ev("document.querySelectorAll('#controls .ctl').length") === 16);
  await shot('ui_body_768.png');
  check('no vertical scroll needed at 1366x768', await ev("(function(){var c=document.getElementById('controls');return c.scrollHeight<=c.clientHeight+2;})()"), await ev("document.getElementById('controls').scrollHeight+'/'+document.getElementById('controls').clientHeight"));

  const setSlider = (label, v) => ev(`(function(){var rows=document.querySelectorAll('#controls .ctl');for(var i=0;i<rows.length;i++){if(rows[i].querySelector('.name').firstChild.textContent==='${label}'){var s=rows[i].querySelector('input');s.value=${v};s.dispatchEvent(new Event('input'));return true;}}return false;})()`);
  check('drag Swagger slider', await setSlider('Swagger', 9));
  check('Swagger stored as static 9', await ev("__walk.state.controls['Swagger']") === 9);
  check('kid range clamps Bounciness to 60', (await setSlider('Bounciness', 999)) && await ev("__walk.state.controls['Bounce']") === 60);

  await ev("__walk.state.playing=false; __walk.state.frame=10; true");
  await ev(`(function(){var rows=document.querySelectorAll('#controls .ctl');for(var i=0;i<rows.length;i++){if(rows[i].querySelector('.name').firstChild.textContent==='Lean'){rows[i].querySelector('.kbtn').click();return;}}})()`);
  check('key added on Lean at frame 10', JSON.stringify(await ev("__walk.state.controls['Lean']")) === JSON.stringify({ k: [[10, 4]], loop: true }));
  await ev("__walk.state.frame=50; true");
  await setSlider('Lean', -12);
  check('auto-key at frame 50 when slider moved', JSON.stringify(await ev("__walk.state.controls['Lean'].k")) === JSON.stringify([[10, 4], [50, -12]]));
  await ev("__walk.state.frame=30; document.getElementById('track'); true");
  const mid = await ev("__walk.core().valueAt(__walk.state.controls['Lean'], 30, 4)");
  check('eased value between keys', Math.abs(mid - (4 + (-16) * 0.5)) < 1e-9, 'f30 = ' + mid);
  await shot('ui_keys_768.png');
  check('timeline shows 2 keys + loop marker', await ev("document.querySelectorAll('#keys .key').length") === 3);
  await ev("document.querySelectorAll('#keys .key')[0].dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))");
  check('double-click deletes a key', JSON.stringify(await ev("__walk.state.controls['Lean'].k")) === JSON.stringify([[50, -12]]));

  await ev("document.querySelectorAll('#tabs button')[2].click()");
  await sleep(200);
  await ev("Array.prototype.find.call(document.querySelectorAll('.speed button'),function(b){return b.textContent==='Fast';}).click()");
  check('Speed set to Fast (16 frames)', await ev("__walk.state.controls['Cycle Frames']") === 16);
  check('teacher-only controls hidden', await ev("document.body.innerText.indexOf('Ground Y')<0 && document.body.innerText.indexOf('Reach')<0"));

  await sleep(600);
  const ls = await ev("localStorage.getItem('walkrig:S02')");
  check('autosaved to this Chromebook', !!ls && JSON.parse(ls).controls.Swagger === 9);

  await ev("document.getElementById('codeBtn').click()");
  await sleep(800);
  const code = await ev("document.getElementById('codeText').value");
  check('copy code produced WR1 code', /^WR1-[A-Za-z0-9_-]+$/.test(code), code.length + ' chars');
  fs.writeFileSync(path.join(outDir, 'ui_code.txt'), code);
  await shot('ui_code_768.png');
  await ev("document.getElementById('codeClose').click()");

  await send('Page.navigate', { url: base + '/index.html?test#S02' });
  await sleep(2000);
  check('reload restores saved work', await ev("__walk.state.controls['Swagger']") === 9 && await ev("__walk.state.controls['Cycle Frames']") === 16);

  await send('Page.navigate', { url: base + '/index.html?test&teacher#S01' });
  await sleep(2000);
  await ev("document.querySelectorAll('#tabs button')[0].click()");
  check('teacher mode shows Ground Y and Reach', await ev("document.body.innerText.indexOf('Ground Y')>=0 && document.body.innerText.indexOf('Reach')>=0"));
  await shot('ui_teacher_768.png');

  const fpsMeasured = await ev("new Promise(function(r){var n=0,t0=performance.now();function f(){n++;if(performance.now()-t0<2000)requestAnimationFrame(f);else r(n/2);}requestAnimationFrame(f);})");
  check('render loop running', fpsMeasured > 20, Math.round(fpsMeasured) + ' fps in headless');

  check('no JavaScript errors', errors.length === 0, errors.join(' | '));
  console.log(results.join('\n'));
  ws.close(); proc.kill();
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
