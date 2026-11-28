// Deja el guion de la prueba apuntando al video de esta máquina
const fs = require('fs'), path = require('path');
const [src, clip, min, out] = process.argv.slice(2);
const p = path.resolve(clip);
fs.writeFileSync(out, fs.readFileSync(src, 'utf8').replace("'__CLIP__'", JSON.stringify(p)).replace('__MAXMIN__', String(min)));
console.log('video:', p, fs.statSync(p).size, 'bytes');
