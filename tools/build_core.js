const fs = require('fs'), path = require('path');
const solver = fs.readFileSync(path.join(__dirname, '..', '..', 'scratch', 'solver.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '').trim();
const tpl = fs.readFileSync(path.join(__dirname, 'walkcore.template.js'), 'utf8');
fs.mkdirSync(path.join(__dirname, '..', 'js'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'js', 'walkcore.js'), tpl.replace('/*__SOLVER__*/', solver.split('\n').join('\n  ')));
console.log('js/walkcore.js written');
