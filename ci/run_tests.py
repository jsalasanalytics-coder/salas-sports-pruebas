#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prueba REAL del motor de IA en esta máquina, igual que lo usa la app en la compu de un cliente:

  1. desarma el archivo del motor con el tar del sistema, en una carpeta con espacios, acentos y ñ
  2. prueba que el motor arranca (lo mismo que hace la app antes de cada análisis)
  3. detecta jugadoras en un cuadro (detect_frame.py)
  4. hace un tracking de punta a punta (pipeline_va.py) con el ffmpeg de la app y un video con acentos en el nombre
  5. en Windows repite el tracking forzando el procesador (el camino de las PC sin placa de video)
  6. carga el modelo de cancha

    python3 run_tests.py <motor.tar.gz> <carpeta assets/vision> <ffmpeg> <clip.mp4> [salida.json]

Termina con código 0 solo si TODO pasó.
"""
import csv, json, os, platform, shutil, subprocess, sys, tempfile, time
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

bundle, vision, ffmpeg, clip = [os.path.abspath(a) for a in sys.argv[1:5]]
INSTALLED = os.path.isdir(bundle)        # en vez del archivo, la carpeta del motor que YA instaló la app (prueba del instalador real)
report_path = sys.argv[5] if len(sys.argv) > 5 else None
WIN = sys.platform == "win32"
ARM_MAC = sys.platform == "darwin" and platform.machine() == "arm64" and not os.environ.get("VA_TEST_ONNX")      # VA_TEST_ONNX=1: en una Mac con chip Apple, probar el camino de Windows/Intel
log, fails = [], []


def ok(name, cond, extra=""):
    line = ("OK    " if cond else "FALLA ") + name + (" · " + str(extra) if extra != "" else "")
    print(line, flush=True); log.append(line)
    if not cond: fails.append(name)


def py_env(extra=None):
    e = dict(os.environ, PYTHONUTF8="1", PYTHONNOUSERSITE="1", PIP_USER="0")
    for k in ["PYTHONPATH", "PYTHONHOME", "VIRTUAL_ENV", "CONDA_PREFIX"]: e.pop(k, None)
    n = str(max(2, (os.cpu_count() or 4) // 2))
    for k in ["OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "VECLIB_MAXIMUM_THREADS", "NUMEXPR_NUM_THREADS"]: e[k] = n
    e.update(extra or {})
    return e


def run(args, timeout, env=None, cwd=None):
    t = time.time()
    try:
        r = subprocess.run(args, capture_output=True, timeout=timeout, env=env or py_env(), cwd=cwd)
        return r.returncode, r.stdout.decode("utf-8", "replace"), r.stderr.decode("utf-8", "replace"), time.time() - t
    except subprocess.TimeoutExpired as e:
        return -9, "", "se pasó de %d s: %s" % (timeout, (e.stderr or b"").decode("utf-8", "replace")[-600:]), time.time() - t


print("máquina:", platform.platform(), platform.machine(), os.cpu_count(), "núcleos", flush=True)
home = tempfile.mkdtemp(prefix="salas-")
# Igual que la carpeta de un cliente: «C:\Users\José Núñez\AppData\Roaming\boca-va\vision-engine»
engine = os.path.join(home, "José Núñez", "Application Support", "boca-va", "vision-engine"); os.makedirs(engine)
video = os.path.join(home, "José Núñez", "Partidos ñandú", "1ª fecha (Boca vs Ríver).mp4"); os.makedirs(os.path.dirname(video))
shutil.copy(clip, video)

if INSTALLED:
    engine = bundle; py = os.path.join(engine, "python", "python.exe") if WIN else os.path.join(engine, "python", "bin", "python3")
    ok("la app instaló el motor sola", os.path.exists(py) and os.path.exists(os.path.join(engine, "engine.json")), open(os.path.join(engine, "engine.json")).read() if os.path.exists(os.path.join(engine, "engine.json")) else "no hay engine.json")
else:
    # 1. desarmar como la app (engineTar en main.js): tar del sistema, ruta relativa, dentro de la carpeta
    tar = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32", "tar.exe") if WIN else "/usr/bin/tar"
    shutil.copy(bundle, os.path.join(engine, "engine-bundle.part"))
    code, out, err, dt = run([tar, "-xzf", "engine-bundle.part", "-C", "."], 600, cwd=engine)
    py = os.path.join(engine, "python", "python.exe") if WIN else os.path.join(engine, "python", "bin", "python3")
    ok("el motor se desarma", code == 0 and os.path.exists(py) and os.path.exists(os.path.join(engine, "engine.json")), "%.0f s %s" % (dt, err[-300:]))
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(os.path.join(engine, "python")) for f in fs if not os.path.islink(os.path.join(d, f)))
    log.append("motor: archivo %.0f MB, instalado %.0f MB" % (os.path.getsize(bundle) / 1e6, size / 1e6)); print(log[-1])

# 2. la prueba que hace la app (ENGINE_TEST_LITE en main.js)
probe = 'import numpy, cv2, onnxruntime; assert cv2.cvtColor(numpy.zeros((2, 2, 3), numpy.uint8), cv2.COLOR_BGR2GRAY).sum() == 0; print("okmotor", numpy.__version__, cv2.__version__, onnxruntime.__version__, onnxruntime.get_available_providers())'
code, out, err, dt = run([py, "-c", probe], 300)
ok("el motor arranca", "okmotor" in out, "%.1f s %s %s" % (dt, out.strip(), err.strip()[-400:]))

speed = {}
if ARM_MAC:
    speed = {"coreml": os.path.join(vision, "detector_1536.mlpackage"), "tracker_coreml": os.path.join(vision, "botsort_va_ml.yaml")}


def detect(tag, env=None):
    d = tempfile.mkdtemp(prefix="det-", dir=home); cfgp = os.path.join(d, "cfg.json"); outp = os.path.join(d, "out.json")
    json.dump(dict({"video": video, "t": 3, "model": None, "out": outp, "device": "cpu", "ffmpeg": ffmpeg}, **speed), open(cfgp, "w", encoding="utf-8"))
    code, out, err, dt = run([py, os.path.join(vision, "detect_frame.py"), cfgp], 600, env=py_env(env), cwd=engine)
    try: r = json.load(open(outp, encoding="utf-8"))
    except Exception: r = {"ok": False, "error": err[-500:]}
    n = len(r.get("boxes") or [])
    ok("detectar jugadoras en un cuadro" + tag, bool(r.get("ok")) and n >= 10, "%d personas en %.1f s %s" % (n, dt, r.get("error") or ""))


def track(tag, env=None):
    d = tempfile.mkdtemp(prefix="trk-", dir=home); cfgp = os.path.join(d, "cfg.json")
    cfg = {"video": video, "t0": 1, "t1": 11, "corners_img": None, "pitch": {"length": 105, "width": 68}, "model": None,
           "tracker_yaml": os.path.join(vision, "botsort_va.yaml"), "out_dir": d, "device": "mps" if ARM_MAC else "cpu", "imgsz": 1536,
           "ffmpeg": ffmpeg, "stride": 1, "hz": 10}
    cfg.update(speed if ARM_MAC else {"hz": 10, "imgsz": 1280})
    json.dump(cfg, open(cfgp, "w", encoding="utf-8"))
    code, out, err, dt = run([py, os.path.join(vision, "pipeline_va.py"), cfgp], 1500, env=py_env(env), cwd=engine)
    csvp = os.path.join(d, "tracking.csv"); rows = []; meta = {}
    if code == 0 and os.path.exists(csvp):
        rows = list(csv.DictReader(open(csvp, encoding="utf-8")))
        try: meta = json.load(open(os.path.join(d, "teams.json"), encoding="utf-8"))
        except Exception: pass
    spans = {}
    for r in rows:
        if r.get("team") == "ball": continue
        t = float(r["time_s"]); a = spans.setdefault(r["track_id"], [t, t]); a[0] = min(a[0], t); a[1] = max(a[1], t)
    long_ = sum(1 for a in spans.values() if a[1] - a[0] > 6)
    ok("tracking de punta a punta" + tag, code == 0 and len(rows) > 300, "%d filas, %d seguimientos en %.0f s · detector %s%s" % (len(rows), len(spans), dt, meta.get("engine"), "" if code == 0 else " · " + err[-700:]))
    ok("seguimientos largos" + tag, long_ >= 8, long_)
    for l in err.splitlines():
        if l.startswith(("detector:", "sin DirectML")): log.append("   " + l); print(log[-1])
    return dt


detect("")
t1 = track("")
if WIN:
    detect(" (solo procesador)", {"VA_NO_DML": "1"})
    track(" (solo procesador)", {"VA_NO_DML": "1"})

# 6. modelo de cancha: tiene que cargar y correr en esta máquina
kp = os.path.join(vision, "fieldkp.onnx")
if os.path.exists(kp):
    code_ = ("import onnxruntime as o, numpy as n, sys; s = o.InferenceSession(sys.argv[1], providers=['CPUExecutionProvider']); "
             "T = {'tensor(float)': n.float32, 'tensor(int64)': n.int64, 'tensor(int32)': n.int32, 'tensor(bool)': n.bool_, 'tensor(double)': n.float64}; "
             "f = {i.name: n.zeros([d if isinstance(d, int) else 1 for d in i.shape], T.get(i.type, n.float32)) for i in s.get_inputs()}; "
             "r = s.run(None, f); print('okcancha', {k: v.shape for k, v in f.items()}, r[0].shape)")
    code, out, err, dt = run([py, "-c", code_, kp], 600)
    ok("modelo de cancha", "okcancha" in out, "%.1f s %s %s" % (dt, out.strip(), err.strip()[-300:]))

# 7. ESTRÉS: varios análisis a la vez (lo que pasa cuando el analista pide tracking de varios clips), tres tandas seguidas
if not fails:
    from concurrent.futures import ThreadPoolExecutor
    # Con motor neuronal: 3 a la vez, 3 tandas. Solo procesador (máquinas de 2-4 núcleos): 2 a la vez, 2 tandas.
    PAR = 3 if ARM_MAC else 2
    for tanda in ((1, 2, 3) if ARM_MAC else (1, 2)):
        t = time.time()
        with ThreadPoolExecutor(PAR) as ex: list(ex.map(lambda i: track(" · estrés tanda %d análisis %d" % (tanda, i + 1), {"VA_NO_DML": "1"} if WIN and i == 0 else None), range(PAR)))
        log.append("   tanda %d: %d análisis a la vez en %.0f s" % (tanda, PAR, time.time() - t)); print(log[-1], flush=True)
    # un video roto no puede colgar el motor: tiene que fallar rápido y limpio
    bad = os.path.join(home, "roto.mp4"); open(bad, "wb").write(open(video, "rb").read(200000))
    d = tempfile.mkdtemp(prefix="bad-", dir=home); cfgp = os.path.join(d, "cfg.json")
    json.dump(dict({"video": bad, "t0": 0, "t1": 5, "corners_img": None, "model": None, "tracker_yaml": os.path.join(vision, "botsort_va.yaml"), "out_dir": d, "device": "cpu", "imgsz": 1280, "ffmpeg": ffmpeg, "hz": 10}, **speed), open(cfgp, "w", encoding="utf-8"))
    code, out, err, dt = run([py, os.path.join(vision, "pipeline_va.py"), cfgp], 300, cwd=engine)
    ok("un video dañado no cuelga el motor", code != -9, "terminó con código %d en %.0f s" % (code, dt))

res = "TODO OK" if not fails else "HAY FALLAS: " + ", ".join(fails)
print("\nRESULTADO:", res, flush=True)
if report_path:
    json.dump({"machine": platform.platform(), "arch": platform.machine(), "cores": os.cpu_count(), "ok": not fails, "fails": fails, "log": log, "track_s": round(t1, 1)}, open(report_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
shutil.rmtree(home, ignore_errors=True)
sys.exit(1 if fails else 0)
