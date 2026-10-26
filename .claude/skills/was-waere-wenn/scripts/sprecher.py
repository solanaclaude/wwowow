"""Sprecherstimme für "Was wäre, wenn"-Videos (offline, deutsch, ruhig).

Nutzt Piper-TTS mit den deutschen Stimmen aus den Piper-Releases auf GitHub
(Hugging Face ist in dieser Umgebung gesperrt). Jeder Satz wird einzeln erzeugt und
an seine Startzeit gelegt, so passt die Stimme genau zu Bild und Untertitel.

Einmalig:
    pip install piper-tts
    mkdir -p ~/.cache/was-waere-wenn/voices/thorsten-low && curl -L https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-de-thorsten-low.tar.gz | tar xz -C ~/.cache/was-waere-wenn/voices/thorsten-low
    (Standard: ruhige Männerstimme "thorsten" mit langsam=1.32; Frauenstimmen: voice-de-kerstin-low, voice-de-ramona-low, voice-de-eva_k-x-low)

Benutzung:
    from sprecher import sprich
    sprich([(0.4, "Was wäre, wenn ..."), (3.2, "Ein ganz normaler ...")], gesamt=63.0,
           modell=".../de-kerstin-low.onnx", ziel="assets/audio/stimme.wav")
Zahlen als Wörter schreiben ("neunzig Prozent"), dann spricht Piper sie sicher richtig aus.
"""
import os
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000


def _tts(text, modell, langsam=1.18, pause=0.25):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        out = f.name
    subprocess.run(
        [sys.executable, "-m", "piper", "-m", modell, "-f", out, "--length-scale", str(langsam), "--sentence-silence", str(pause)],
        input=text.encode("utf-8"), check=True, capture_output=True,
    )
    sr, x = wavfile.read(out)
    os.unlink(out)
    x = x.astype(np.float64) / 32768.0
    if x.ndim == 2:
        x = x.mean(axis=1)
    # Stille am Anfang/Ende abschneiden
    idx = np.where(np.abs(x) > 0.01)[0]
    if len(idx):
        x = x[max(0, idx[0] - int(0.02 * sr)) : idx[-1] + int(0.08 * sr)]
    # auf 48 kHz hochrechnen
    x = signal.resample_poly(x, SR, sr)
    return x


def _warm(x):
    """Ruhiger, warmer Klang: tiefes Rumpeln weg, etwas Präsenz, sanfter Raum, leichte Kompression."""
    x = signal.sosfilt(signal.butter(2, 90, "hp", fs=SR, output="sos"), x)
    pres = signal.sosfilt(signal.butter(2, [2500, 5000], "bp", fs=SR, output="sos"), x)
    x = x + 0.25 * pres
    # Kompression (weich)
    env = np.abs(signal.hilbert(x))
    env = signal.sosfilt(signal.butter(1, 20, "lp", fs=SR, output="sos"), env)
    gain = 1 / (1 + 2.0 * np.clip(env - 0.15, 0, None))
    x = x * gain
    # kleiner, warmer Raum
    n = int(0.45 * SR)
    r = np.random.default_rng(3)
    ir = r.standard_normal(n) * np.exp(-np.linspace(0, 9, n))
    ir = signal.sosfilt(signal.butter(2, 4000, "lp", fs=SR, output="sos"), ir)
    ir /= np.sqrt(np.sum(ir**2))
    wet = signal.fftconvolve(x, ir)[: len(x)]
    return x * 0.88 + wet * 0.12


def sprich(zeilen, gesamt, modell, ziel, langsam=1.18):
    """zeilen: [(startzeit_s, text), ...]. Gibt die Dauer jeder Zeile zurück und warnt bei Überlappung."""
    buf = np.zeros(int(gesamt * SR))
    info = []
    for i, (at, text) in enumerate(zeilen):
        x = _warm(_tts(text, modell, langsam))
        dur = len(x) / SR
        nxt = zeilen[i + 1][0] if i + 1 < len(zeilen) else gesamt
        if at + dur > nxt - 0.1:
            print(f"WARNUNG: Zeile {i + 1} ({dur:.2f} s) überlappt die nächste bei {nxt} s: {text}")
        a = int(at * SR)
        n = min(len(x), len(buf) - a)
        buf[a : a + n] += x[:n]
        info.append((at, round(dur, 2), text))
    buf = buf / (np.max(np.abs(buf)) + 1e-9) * 0.89
    stereo = np.stack([buf, buf], axis=1)
    wavfile.write(ziel, SR, (stereo * 32767).astype(np.int16))
    return info
