// Compares the web engine against After Effects ground truth (pipeline/ae_truth.json).
const WC = require('../js/walkcore.js');
const manifest = require('../../pipeline/rig_manifest.json');
const truth = require('../../pipeline/ae_truth.json');
const saves = {
  template: {},
  S01: require('../../pipeline/test_saves/S01.json').controls,
  S02: require('../../pipeline/test_saves/S02.json').controls,
};
const core = WC.create(manifest);
const pivots = {};
manifest.parts.forEach(p => { pivots[p.name] = p.pivot; });
let worstAll = 0;
for (const name of Object.keys(truth)) {
  let wp = 0, wr = 0, where = '';
  for (let f = 0; f < manifest.comp.frames; f++) {
    const pose = core.pose(f, saves[name]);
    for (const part of Object.keys(truth[name])) {
      const t = truth[name][part][f], m = pose.world[part];
      const p = WC.apply(m, pivots[part]);
      const ep = Math.hypot(p[0] - t[0], p[1] - t[1]);
      let er = Math.abs(WC.wang(m) - t[2]);
      if (er > 180) er = 360 - er;
      if (ep > wp) { wp = ep; where = part + ' f' + f; }
      if (er > wr) wr = er;
    }
  }
  worstAll = Math.max(worstAll, wp);
  console.log(name.padEnd(9) + ' worst position error ' + wp.toFixed(4) + ' px (' + where + '), worst angle error ' + wr.toFixed(4) + ' deg');
}
console.log(worstAll < 0.05 ? 'PARITY OK' : 'PARITY FAILED');
process.exit(worstAll < 0.05 ? 0 : 1);
