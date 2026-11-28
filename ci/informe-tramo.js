// Lee la salida de la app y muestra el resultado de cada ronda. Sale con error si no pasaron las 5.
const fs = require('fs');
const log = fs.readFileSync(process.argv[2], 'utf8'), m = log.match(/TRAMO_(OK|FALLA) (\d)\/5 (\{.*\})/);
if (!m) { console.log('La prueba no llegó a informar nada. Últimas líneas:\n' + log.split('\n').slice(-40).join('\n')); process.exit(1); }
const o = JSON.parse(m[3]);
console.log('RESULTADO:', m[1], m[2] + '/5', '·', o.plat, JSON.stringify(o.video), 'motor', o.motor);
o.rondas.forEach((r) => console.log((r.ok ? '  OK    ' : '  FALLA ') + r.n + ' · ' + r.nombre + ' · inicial ' + r.inicial_s + ' s · re-tracking ' + r.retracking_s + ' s · ' + (r.sumado ? 'sumó solo lo agregado' : 'analizó entero') + '\n         ' + JSON.stringify(r)));
console.log('cartel:', JSON.stringify(o.cartel), '· errores:', JSON.stringify(o.errores), o.fatal ? '· FATAL ' + o.fatal : '');
process.exit(m[1] === 'OK' ? 0 : 1);
