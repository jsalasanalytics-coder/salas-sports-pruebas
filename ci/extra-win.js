(async () => {
  const out = {};
  const run = async (k, url) => {
    const log = [];
    const h = (o) => { const m = (o.msg || '').replace(/\d+%.*/, ''); if (m && log[log.length - 1] !== m) log.push(m); };
    window.va.onDownloadProgress(h);
    const t = Date.now();
    const r = await window.va.downloadUrl({ url });
    out[k] = { ok: r.ok, nombre: r.name, error: r.error, s: Math.round((Date.now() - t) / 1000), pasos: log.slice() };
  };
  await run('pagina_con_tildes', 'http://127.0.0.1:8765/index.html');
  await run('segunda_vez', 'http://127.0.0.1:8765/index.html');
  await run('youtube', 'https://youtu.be/o20PtgrTlHA');
  return JSON.stringify(out);
})()
