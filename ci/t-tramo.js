// Prueba de punta a punta: clip de presentación que se alarga después de trackeado → el tramo agregado se trackea solo.
// 5 rondas con casos distintos. Corre dentro de la app (VA_SMOKE_EXTRA). No guarda nada en los datos del usuario.
(async function () {
  const VIDEO = '__CLIP__', MAX = __MAXMIN__ * 60000;
  const out = { plat: navigator.platform, rondas: [], errores: [], carpetas: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.addEventListener('error', (e) => out.errores.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => out.errores.push('promesa: ' + String((e.reason && e.reason.message) || e.reason)));
  try {
    Store.savePresentations = () => Promise.resolve(); Store.saveProjects = () => Promise.resolve(); Store.saveConfig = () => Promise.resolve();
    Store.config.prepCuts = true; window.__PPTEST = true;
    const chk = await window.va.visionCheck(); out.motor = !!(chk && chk.ok);
    const vm = await window.va.mediaAnalyze(VIDEO); out.video = vm && { w: vm.width, h: vm.height, dur: +Number(vm.duration).toFixed(2) };
    if (!out.motor || !vm || !vm.duration) { out.fatal = 'sin motor o sin video'; return 'TRAMO ' + JSON.stringify(out); }
    const DUR = vm.duration;
    const live = (id) => { const f = PreTrack.find(id); return f && f.c; };
    const idle = async (id, max) => { const t = Date.now(); await sleep(1500); while (Date.now() - t < max) { if (!PreTrack.active(id)) { await sleep(1500); if (!PreTrack.active(id)) return true; } await sleep(1000); } return false; };
    const btn = async (title, n) => { for (let i = 0; i < n; i++) { const b = [...document.querySelectorAll('.adj-b')].find((x) => x.title === title); if (!b) throw new Error('falta el botón ' + title); b.click(); await sleep(70); } await sleep(250); };
    const mouse = (type, x, y, tg) => (tg || window).dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
    let n = 0;
    async function ronda(nombre, s, e, opts, accion) {
      n++; const R = { n, nombre }, t00 = Date.now(), id = 'smk' + n + '_' + Date.now(), prId = 'smkpr' + n + '_' + Date.now();
      try {
        Store.config.prepCal = !!opts.cancha;
        const pr = { id: prId, title: 'Prueba ' + nombre, createdAt: Date.now(), videoPath: VIDEO, cover: { type: 'none' }, clips: [{ id, num: 1, label: nombre, note: '', color: '#0a84ff', descriptors: [], players: [], hit: (s + e) / 2, start: s, end: e, animation: 'none', drawings: [] }] };
        Store.presentations.push(pr); Router.go('presentation', { id: prId }); await sleep(2500);
        const tI = Date.now(); R.inicialOk = await idle(id, MAX); R.inicial_s = Math.round((Date.now() - tI) / 1000);
        let c = live(id); if (!c || !c.trackDir) throw new Error('el clip no se trackeó al entrar' + (c && c.pre && c.pre.err ? ': ' + c.pre.err : ''));
        out.carpetas.push(c.trackDir); await sleep(2000);
        R.tramo0 = c.trkSpan ? [+c.trkSpan.t0.toFixed(2), +c.trkSpan.t1.toFixed(2)] : null; R.faltaba0 = PreTrack.stale(c);
        // Un dibujo enganchado a una persona, para comprobar que se pasa al análisis nuevo
        const ix0 = window.__pp.trackIdx(), tD = s + (e - s) / 2;
        const tid = ix0 ? Object.keys(ix0.byId).map(Number).find((k) => { const q = TS.posAt(ix0, k, tD + 0.04); return q && q.fade > 0.9 && TS.posAt(ix0, k, tD + 0.5); }) : null;
        const p0 = tid != null ? TS.posAt(ix0, tid, tD + 0.04) : null;
        if (tid != null) c.drawings.push({ id: 'd1', type: 'track', style: 'focus', tid, t0: tD, t1: e, color: '#ff3b30', vs: 1 });
        const dir0 = c.trackDir, cal0 = (c.calib || []).length; R.cancha0 = cal0;
        const tA = Date.now();
        const extra = await accion({ id, prId, c: () => live(id), R });
        R.terminoOk = await idle(id, MAX); R.retracking_s = Math.round((Date.now() - tA) / 1000);
        c = live(id); if (c.trackDir !== dir0) out.carpetas.push(c.trackDir);
        R.clip = [+c.start.toFixed(2), +c.end.toFixed(2)];
        R.analisisNuevo = c.trackDir !== dir0; R.falta = PreTrack.stale(c); R.fallo = c.trkFail || null;
        R.tramo1 = c.trkSpan ? [+c.trkSpan.t0.toFixed(2), +c.trkSpan.t1.toFixed(2)] : null;
        const r1 = await window.va.visionTracks(c.trackDir), ix1 = r1 && r1.ok ? TS.indexTracks(r1, null) : null;
        if (ix1) {
          const ts = r1.frames.map((f) => f.t); R.datos = [+ts[0].toFixed(2), +ts[ts.length - 1].toFixed(2)];
          R.cubre = ts[0] <= c.start + 0.4 && ts[ts.length - 1] >= Math.min(c.end, DUR - 0.2) - 0.4;
          const cuenta = (t) => Object.keys(ix1.byId).filter((k) => TS.posAt(ix1, Number(k), t)).length;
          R.personasInicio = cuenta(c.start + 0.25); R.personasFinal = cuenta(Math.min(c.end, DUR - 0.3) - 0.25);
          if (tid != null) { const d = c.drawings.find((x) => x.id === 'd1'), p1 = d ? TS.posAt(ix1, d.tid, tD + 0.04) : null; R.dibujo = p0 && p1 ? +Math.hypot(p0.x - p1.x, p0.y - p1.y).toFixed(4) : 'perdido'; } else R.dibujo = 'sin persona para enganchar';
        }
        R.cancha1 = (c.calib || []).length;
        if (R.cancha1) { const cal = await window.va.visionCalibLoad(c.calib[0]); if (cal && cal.t && cal.t.length) R.canchaTramo = [+cal.t[0].toFixed(2), +cal.t[cal.t.length - 1].toFixed(2)]; }
        if (!opts.fueraDeVista) { await sleep(1500); const ix = window.__pp.trackIdx(); R.vistaAlDia = !!(ix && ix.dir === c.trackDir); } else R.vistaAlDia = true;
        Object.assign(R, extra || {});
        const st = await window.va.visionBgState(); R.frenoSuelto = !st.held || st.busy;
        R.ok = !!(R.inicialOk && !R.faltaba0 && R.terminoOk && R.analisisNuevo && !R.falta && !R.fallo && R.cubre && R.personasInicio > 0 && R.personasFinal > 0 && (typeof R.dibujo !== 'number' || R.dibujo < 0.03) && R.dibujo !== 'perdido' && R.vistaAlDia && R.frenoSuelto && (extra ? extra.extraOk !== false : true) && (!cal0 || R.cancha1 > 0));
      } catch (err) { R.ok = false; R.error = String(err.message || err) + ' @ ' + ((err.stack || '').split('\n')[1] || '').trim(); }
      R.total_s = Math.round((Date.now() - t00) / 1000);
      try { PreTrack.stopAll(); Router.go('home'); await sleep(400); Store.presentations = Store.presentations.filter((x) => x.id !== prId); } catch {}
      out.rondas.push(R);
    }
    // 1 · Alargar el final con los botones (con la cancha automática prendida)
    await ronda('final con botones + cancha', 4, 7, { cancha: true }, async () => { await btn('Terminar después', 6); });
    // 2 · Alargar el inicio con los botones
    await ronda('inicio con botones', 7, 10, {}, async () => { await btn('Empezar antes', 6); });
    // 3 · Arrastrar los dos bordes en la línea de tiempo (el camino real del mouse, con el freno del análisis)
    await ronda('arrastrando los dos bordes', 5.5, 8, {}, async ({ c }) => {
      const arrastre = async (cual, listo) => {
        const hs = document.querySelectorAll('.segbar .sb-handle'), h = hs[cual === 'R' ? 1 : 0], bar = document.querySelector('.segbar').getBoundingClientRect(), hb = h.getBoundingClientRect();
        const y = hb.top + hb.height / 2, x1 = cual === 'R' ? bar.right - 2 : bar.left + 2;
        mouse('mousedown', hb.left + hb.width / 2, y, h); await sleep(60);
        mouse('mousemove', (hb.left + x1) / 2, y); await sleep(60); mouse('mousemove', x1, y);
        const t = Date.now(); while (Date.now() - t < 4000 && !listo()) await sleep(60);
        const st = await window.va.visionBgState();
        mouse('mouseup', x1, y); await sleep(350);
        return st.held;
      };
      const f1 = await arrastre('R', () => c().end >= 11.5), f2 = await arrastre('L', () => c().start <= 2);
      return { frenoAlArrastrar: f1 && f2, extraOk: c().end >= 10.2 && c().start <= 3.3 };
    });
    // 4 · Volver a ajustar mientras se está analizando; y después recortar (no tiene que pedir nada)
    await ronda('ajustar durante el análisis', 5, 8, {}, async ({ id, c }) => {
      await btn('Terminar después', 6);
      const t = Date.now(); while (Date.now() - t < MAX && !(PreTrack.running && PreTrack.running.id === id && (PreTrack.running.pct || 0) > 0.03)) await sleep(300);
      const j0 = PreTrack.running && PreTrack.running.jobId;
      await btn('Empezar antes', 7);
      await idle(id, MAX);
      const d1 = c().trackDir; await btn('Terminar antes', 2); await sleep(4000);
      return { reinicio: !!j0, recortarNoPide: !PreTrack.active(id) && c().trackDir === d1, extraOk: !PreTrack.active(id) && c().trackDir === d1 };
    });
    // 5 · Alargar y salir de la presentación: termina igual de fondo; al volver está todo, y deshacer conserva el análisis
    await ronda('saliendo de la presentación + deshacer', 5, 8, { fueraDeVista: true }, async ({ id, prId, c }) => {
      const d0 = c().trackDir; await btn('Terminar después', 6); await sleep(300); Router.go('home');
      await idle(id, MAX);
      const cambioFuera = c().trackDir !== d0, d1 = c().trackDir, fin = c().end;
      Router.go('presentation', { id: prId }); await sleep(3500);
      const ix = window.__pp.trackIdx(), alVolver = !!(ix && ix.dir === d1);
      // Un cambio en la pantalla recién abierta (recortar) y deshacerlo: vuelve el largo y se conserva el análisis nuevo
      await btn('Terminar antes', 2); const corto = c().end;
      const z = [...document.querySelectorAll('button')].find((b) => /^Deshacer \(/.test(b.title || '')); if (z) { z.click(); await sleep(400); z.click(); } await sleep(2500);
      const deshacerOk = !!z && corto < fin && Math.abs(c().end - fin) < 0.01 && c().trackDir === d1 && !PreTrack.stale(c()) && !PreTrack.active(id);
      return { cambioFuera, alVolver, deshacerOk, extraOk: cambioFuera && alVolver && deshacerOk };
    });
    // Cartel flotante: se mueve, recuerda el lugar y vuelve con doble clic
    try {
      const guardado = localStorage.getItem('va.bgjobs.pos'); localStorage.removeItem('va.bgjobs.pos'); BgJobs.place(BgJobs.root());
      BgJobs.start('smk-job', 'Prueba', () => {}); await sleep(120);
      const node = document.querySelector('[data-job="smk-job"]'), root = document.getElementById('bgjobs'), b0 = root.getBoundingClientRect();
      mouse('mousedown', b0.left + 40, b0.top + 20, node); mouse('mousemove', b0.left - 200, b0.top - 150); mouse('mousemove', b0.left - 260, b0.top - 200); mouse('mouseup', b0.left - 260, b0.top - 200);
      const b1 = root.getBoundingClientRect(), mov = Math.round(b1.left - b0.left) === -300 && Math.round(b1.top - b0.top) === -220, rec = !!localStorage.getItem('va.bgjobs.pos');
      node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); const b2 = root.getBoundingClientRect();
      out.cartel = { seMueve: mov, recuerda: rec, vuelve: Math.abs(b2.left - b0.left) < 2 && Math.abs(b2.top - b0.top) < 2 };
      if (guardado) localStorage.setItem('va.bgjobs.pos', guardado); else localStorage.removeItem('va.bgjobs.pos');
      BgJobs.remove('smk-job');
    } catch (err) { out.cartel = { error: String(err.message || err) }; }
  } catch (err) { out.fatal = String(err.message || err); }
  const okN = out.rondas.filter((r) => r.ok).length, cart = out.cartel && out.cartel.seMueve && out.cartel.recuerda && out.cartel.vuelve;
  return 'TRAMO_' + (okN === 5 && cart && !out.errores.length && !out.fatal ? 'OK' : 'FALLA') + ' ' + okN + '/5 ' + JSON.stringify(out);
})()
