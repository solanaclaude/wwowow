"""Geräusch-Baukasten für "Was wäre, wenn"-Videos.

Erzeugt Umgebungsgeräusche und Effekte per Code (numpy/scipy), weil in der
Cloud-Umgebung keine Sound-Bibliotheken aus dem Netz erreichbar sind.
Alles ist geseedet, also bei jedem Lauf identisch.

Benutzung in einem Projekt-Skript:
    import sys; sys.path.insert(0, ".claude/skills/was-waere-wenn/scripts")
    from geraeusche import *
    write("assets/audio/stadt.wav", mix(traffic(9), crowd(9) * 0.6))
"""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
_rng = np.random.default_rng(20261025)


def rng(seed=None):
    return np.random.default_rng(seed) if seed is not None else _rng


# ---------- Grundbausteine ----------
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def white(dur, seed=None):
    return rng(seed).standard_normal(int(dur * SR))


def brown(dur, seed=None):
    x = np.cumsum(white(dur, seed))
    x = signal.sosfilt(signal.butter(2, 20, "hp", fs=SR, output="sos"), x)
    return x / (np.max(np.abs(x)) + 1e-9)


def lp(x, f, order=4):
    return signal.sosfilt(signal.butter(order, f, "lp", fs=SR, output="sos"), x, axis=0)


def hp(x, f, order=4):
    return signal.sosfilt(signal.butter(order, f, "hp", fs=SR, output="sos"), x, axis=0)


def bp(x, f1, f2, order=3):
    return signal.sosfilt(signal.butter(order, [f1, f2], "bp", fs=SR, output="sos"), x, axis=0)


def norm(x, peak=0.9):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def smooth_rand(dur, rate, seed=None):
    """Langsam schwankende Zufallskurve 0..1 (rate = Änderungen pro Sekunde)."""
    n = max(4, int(dur * rate) + 4)
    pts = rng(seed).random(n)
    xs = np.linspace(0, dur, n)
    return np.interp(t_axis(dur), xs, pts)


def env_ar(n, a, r):
    """Attack/Release-Hüllkurve über n Samples (a, r in Sekunden)."""
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def fade(x, fi=0.0, fo=0.0):
    n = len(x)
    e = env_ar(n, fi, fo)
    return x * (e[:, None] if x.ndim == 2 else e)


def stereo(x, pan=0.0):
    """pan -1 (links) .. 1 (rechts); pan darf auch ein Array sein."""
    p = (np.asarray(pan) + 1) * np.pi / 4
    return np.stack([x * np.cos(p), x * np.sin(p)], axis=1)


def place(buf, x, at):
    """Legt Stereo-Signal x ab Sekunde 'at' in buf (Stereo) – schneidet am Ende ab."""
    i = int(at * SR)
    if i < 0:  # beginnt vor dem Puffer: Anfang abschneiden
        x, i = x[-i:], 0
    if i >= len(buf) or len(x) == 0:
        return buf
    n = min(len(x), len(buf) - i)
    buf[i : i + n] += x[:n]
    return buf


def silence(dur):
    return np.zeros((int(dur * SR), 2))


_ir_cache = {}


def reverb(x, size=1.6, wet=0.35, seed=7):
    """Einfacher Hall: Faltung mit abklingendem Rauschen."""
    key = (size, seed)
    if key not in _ir_cache:
        n = int(size * SR)
        r = np.random.default_rng(seed)
        decay = np.exp(-np.linspace(0, 7, n))
        ir = np.stack([r.standard_normal(n) * decay, r.standard_normal(n) * decay], axis=1)
        ir = lp(ir, 5000, 2)
        ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
        _ir_cache[key] = ir / np.sqrt(np.sum(ir**2, axis=0))
    ir = _ir_cache[key]
    if x.ndim == 1:
        x = stereo(x)
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return x * (1 - wet) + y * wet


def mix(*layers):
    n = max(len(l) for l in layers)
    out = np.zeros((n, 2))
    for l in layers:
        if l.ndim == 1:
            l = stereo(l)
        out[: len(l)] += l
    return out


def phone(x, cut=140):
    """Entfernt Tiefbass, den Handy-Lautsprecher nicht wiedergeben (spart Lautheit für Hörbares)."""
    return hp(x, cut, 2)


def write(path, x, peak=0.89):
    if x.ndim == 1:
        x = stereo(x)
    x = norm(x, peak)
    wavfile.write(path, SR, (x * 32767).astype(np.int16))


# ---------- Umgebungen ----------
def traffic(dur, passes=None, seed=11):
    """Stadtverkehr: tiefes Grollen + vorbeifahrende Autos (mit Doppler-Gefühl)."""
    r = rng(seed)
    base = bp(brown(dur, seed), 120, 400) * 0.5 + bp(white(dur, seed + 1), 400, 3000) * 0.12
    out = stereo(base * (0.75 + 0.25 * smooth_rand(dur, 0.5, seed)))
    if passes is None:
        passes = sorted(r.uniform(0, dur, int(dur * 1.1)))
    for p in passes:
        L = 2.4
        tt = np.linspace(-L / 2, L / 2, int(L * SR))
        e = np.exp(-(tt / 0.42) ** 2)
        nz = white(L, int(p * 1000) + 3)
        hi, lo = bp(nz, 500, 3500), bp(nz, 250, 1600)
        k = 1 / (1 + np.exp(-tt * 8))  # vorher heller, nachher dunkler
        eng = signal.sawtooth(2 * np.pi * np.cumsum(np.where(tt < 0, 184, 148)) / SR)
        car = (hi * (1 - k) + lo * k) * 0.8 + bp(eng, 150, 900) * 0.3
        d = 1 if r.random() < 0.5 else -1
        out = place(out, stereo(car * e * r.uniform(0.5, 1.0), np.clip(tt * 0.8 * d, -0.9, 0.9)), p - L / 2)
    return out


def crowd(dur, voices=10, seed=21):
    """Gemurmel vieler Menschen in der Ferne."""
    r = rng(seed)
    out = np.zeros((int(dur * SR), 2))
    for v in range(voices):
        nz = white(dur, seed + v)
        f1, f2 = r.uniform(400, 800), r.uniform(1100, 2200)
        voice = bp(nz, f1 * 0.8, f1 * 1.2, 2) + 0.6 * bp(nz, f2 * 0.85, f2 * 1.15, 2)
        syll = smooth_rand(dur, r.uniform(7, 10), seed + 100 + v) ** 2
        phrase = (smooth_rand(dur, 0.6, seed + 200 + v) > 0.45).astype(float)
        phrase = lp(phrase, 6, 2)
        out += stereo(voice * syll * phrase, r.uniform(-0.8, 0.8))
    return reverb(lp(out, 2800), 1.4, 0.45)


def horn(f=(349, 440), dur=0.35):
    t = t_axis(dur)
    x = sum(signal.square(2 * np.pi * fr * t, 0.4) for fr in f)
    x = lp(x, 1600) * env_ar(len(t), 0.02, 0.08)
    return reverb(stereo(x * 0.5, 0.3), 1.8, 0.5)


def wind(dur, strength=1.0, seed=31):
    nz = white(dur, seed)
    g = 0.35 + 0.65 * smooth_rand(dur, 0.35, seed) ** 1.5
    low = bp(nz, 180, 900) * g
    whistle = bp(nz, 700, 1400, 2) * (g**3) * 0.25
    return stereo((low + whistle) * strength, 0.15 * np.sin(t_axis(dur) * 0.3))


def leaves(dur, seed=37):
    nz = white(dur, seed)
    g = 0.3 + 0.7 * smooth_rand(dur, 0.8, seed) ** 2
    return stereo(bp(nz, 2500, 9000, 2) * g * 0.35)


def crickets(dur, n=6, seed=41):
    r = rng(seed)
    out = np.zeros((int(dur * SR), 2))
    for c in range(n):
        f = r.uniform(3900, 5200)
        period = r.uniform(0.45, 0.8)
        pulses = r.integers(2, 5)
        pan = r.uniform(-0.9, 0.9)
        amp = r.uniform(0.3, 1.0)
        tp = np.arange(int(0.028 * SR)) / SR
        pulse = np.sin(2 * np.pi * f * tp) * np.sin(np.pi * tp / tp[-1])
        t0 = r.uniform(0, period)
        while t0 < dur:
            for k in range(pulses):
                out = place(out, stereo(pulse * amp, pan), t0 + k * 0.045)
            t0 += period * r.uniform(0.9, 1.1)
    return reverb(lp(out, 7000), 1.2, 0.4)


def birds(dur, n=5, seed=51):
    r = rng(seed)
    out = np.zeros((int(dur * SR), 2))
    for b in range(n):
        pan = r.uniform(-0.9, 0.9)
        base = r.uniform(2200, 4200)
        t0 = r.uniform(0, 0.8)
        while t0 < dur:
            for k in range(r.integers(2, 7)):
                L = r.uniform(0.05, 0.14)
                tt = np.arange(int(L * SR)) / SR
                shape = r.integers(0, 3)
                if shape == 0:
                    f = base * (1 + 0.6 * tt / L)
                elif shape == 1:
                    f = base * (1.5 - 0.6 * tt / L)
                else:
                    f = base * (1 + 0.25 * np.sin(2 * np.pi * tt / L * 2))
                ph = 2 * np.pi * np.cumsum(f) / SR
                chirp = np.sin(ph + 0.8 * np.sin(ph * 2)) * np.sin(np.pi * tt / L) ** 2
                out = place(out, stereo(chirp * r.uniform(0.3, 0.8), pan), t0)
                t0 += L + r.uniform(0.02, 0.09)
            t0 += r.uniform(0.6, 2.2)
    return reverb(out, 1.6, 0.35)


def flies(dur, n=2, seed=61):
    r = rng(seed)
    out = np.zeros((int(dur * SR), 2))
    t = t_axis(dur)
    for i in range(n):
        f0 = r.uniform(190, 240)
        f = f0 + 18 * np.sin(2 * np.pi * r.uniform(5, 9) * t) + 25 * (smooth_rand(dur, 1.5, seed + i) - 0.5)
        x = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR)
        x = bp(x, 150, 2000, 2)
        g = np.clip(smooth_rand(dur, 0.9, seed + 10 + i) * 1.6 - 0.4, 0, 1)
        out += stereo(x * g * 0.5, np.sin(t * r.uniform(0.6, 1.2) + i * 2) * 0.8)
    return out


def hum(dur, f=100):
    t = t_axis(dur)
    x = 0.3 * np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2 * f * t) + 0.4 * np.sin(2 * np.pi * 3 * f * t) + 0.25 * np.sin(2 * np.pi * 5 * f * t)
    buzz = bp(white(dur, 71), 2000, 6000, 2) * 0.04 * (1 + np.sin(2 * np.pi * f * t))
    return stereo(x * 0.5 + buzz)


def power_down(dur=2.2, f=100):
    """Brummen sackt ab + dumpfer Schlag (Stromausfall)."""
    t = t_axis(dur)
    fr = f * np.exp(-t * 2.2) + 12
    ph = 2 * np.pi * np.cumsum(fr) / SR
    x = (np.sin(ph) + 0.6 * np.sin(2 * ph) + 0.5 * np.sin(3 * ph) + 0.35 * np.sin(5 * ph)) * np.exp(-t * 1.6)
    thump = np.sin(2 * np.pi * 55 * t) * np.exp(-t * 9) * 0.6 + bp(white(dur, 75), 200, 1200) * np.exp(-t * 14) * 1.2
    click = hp(white(dur, 73), 1500) * np.exp(-t * 60) * 0.6
    return reverb(stereo(x * 0.6 + thump + click), 2.2, 0.4)


def relay_tick(dur=0.06, f=1700):
    t = t_axis(dur)
    x = (np.sin(2 * np.pi * f * t) * 0.6 + hp(white(dur, 81), 3000) * 0.4) * np.exp(-t * 120)
    return stereo(x, -0.35)


def shutter(dur=0.95):
    """Metall-Rollladen fährt herunter und schlägt unten auf."""
    out = np.zeros((int((dur + 0.6) * SR), 2))
    rumble = bp(white(dur + 0.6, 91), 180, 900) * 0.35 * env_ar(int((dur + 0.6) * SR), 0.05, 0.7)
    out += stereo(rumble)
    t0, rate = 0.0, 24.0
    r = rng(93)
    while t0 < dur:
        L = 0.03
        tt = t_axis(L)
        c = bp(white(L, int(t0 * 1e4)), 900, 4500) * np.exp(-tt * 140)
        out = place(out, stereo(c * r.uniform(0.5, 1.0)), t0)
        t0 += 1 / rate
        rate *= 0.985
    tt = t_axis(0.6)
    slam = (np.sin(2 * np.pi * 85 * tt) * np.exp(-tt * 12) + bp(white(0.6, 97), 300, 3000) * np.exp(-tt * 25) * 0.8)
    out = place(out, stereo(slam * 1.4), dur)
    return reverb(out, 1.3, 0.3)


def thud(seed=0):
    """Müllsack fällt auf den Boden."""
    tt = t_axis(0.5)
    r = rng(500 + seed)
    body = np.sin(2 * np.pi * r.uniform(65, 90) * tt) * np.exp(-tt * 18) * 0.5 + bp(white(0.5, 800 + seed), 250, 1400) * np.exp(-tt * 22) * 1.3
    knock = bp(white(0.5, 600 + seed), 300, 2500) * np.exp(-tt * 30) * 0.9
    crinkle = hp(white(0.5, 700 + seed), 3000) * np.exp(-tt * 10) * (r.random(len(tt)) > 0.97) * 0.8
    return reverb(stereo(body + knock + crinkle, r.uniform(-0.6, 0.6)), 0.9, 0.25)


# ---------- Musik-Teppich ----------
NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def hz(name):
    n, o = name[:-1], int(name[-1])
    return 440 * 2 ** ((NOTE[n] + 12 * (o - 4) - 9) / 12)


def pad_note(f, dur, bright=900, seed=0):
    t = t_axis(dur)
    x = np.zeros_like(t)
    for det in (-0.12, 0.0, 0.11):
        ff = f * 2 ** (det / 12)
        for h in range(1, 10):
            x += np.sin(2 * np.pi * ff * h * t + seed * h) / h
    x = lp(x, bright, 2)
    return x * (0.85 + 0.15 * np.sin(2 * np.pi * 0.2 * t + seed))


def pad(chords, total, bright=900, xf=1.2, cut=170):
    """chords: Liste von (start, ende, [Noten]) – weich übergeblendet, mit viel Hall."""
    out = np.zeros(int(total * SR))
    for i, (a, b, notes) in enumerate(chords):
        dur = b - a + xf
        seg = sum(pad_note(hz(n), dur, bright, seed=i * 3 + k) for k, n in enumerate(notes)) / len(notes)
        seg *= env_ar(len(seg), xf, xf)
        i0 = int(a * SR)
        n = min(len(seg), len(out) - i0)
        out[i0 : i0 + n] += seg[:n]
    return reverb(stereo(hp(out, cut, 2)), 3.0, 0.55)
