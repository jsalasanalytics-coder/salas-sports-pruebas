// Prueba en Windows: ¿la app encuentra el archivo bajado cuando el título tiene ñ o tildes? (antes vs ahora)
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const [ytdlp, dir, url, mode] = process.argv.slice(2);
fs.mkdirSync(dir, { recursive: true });
const nuevo = mode === 'nuevo';
const args = ['--no-playlist', '--no-update', ...(nuevo ? ['--encoding', 'utf-8'] : []), '-f', 'b[ext=mp4]/b', '--newline', '--progress', '--no-simulate', '--print', 'after_move:filepath', '-o', path.join(dir, '%(title).100s [%(id)s].%(ext)s'), url];
const ps = spawn(ytdlp, args, { windowsHide: true, env: Object.assign({}, process.env, nuevo ? { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } : {}) });
let out = '', err = '';
if (nuevo) { ps.stdout.setEncoding('utf8'); ps.stderr.setEncoding('utf8'); }
ps.stdout.on('data', (d) => { out += d.toString(); }); ps.stderr.on('data', (d) => { err += d.toString(); });
ps.on('close', (code) => {
  const file = out.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('[')).reverse().find((l) => fs.existsSync(l));
  console.log(`[${mode}] código ${code} · archivo encontrado por la app: ${file ? 'SÍ' : 'NO'}`);
  console.log(`[${mode}] lo que imprimió yt-dlp:`, JSON.stringify(out.split('\n').filter((l) => l.trim() && !l.startsWith('[')).slice(-1)));
  console.log(`[${mode}] archivos en disco:`, JSON.stringify(fs.readdirSync(dir)));
  if (code) console.log(err.slice(-1000));
});
