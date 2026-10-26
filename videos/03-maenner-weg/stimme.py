"""Sprecherin für "Was wäre, wenn alle Männer verschwinden würden?" → assets/audio/stimme.wav

Ausführen aus dem Repo-Root:  python3 videos/03-maenner-weg/stimme.py
Stimme: Piper "kerstin" (siehe .claude/skills/was-waere-wenn/scripts/sprecher.py für die Einrichtung).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", ".claude", "skills", "was-waere-wenn", "scripts"))
from sprecher import sprich  # noqa: E402

MODELL = os.path.expanduser(os.environ.get("STIMME", "~/.cache/was-waere-wenn/voices/kerstin-low/de-kerstin-low.onnx"))

zeilen = [
    (0.35, "Was wäre, wenn alle Männer verschwinden würden?"),
    (3.75, "Ein ganz normaler Dienstagmorgen."),
    (7.2, "Um neun Uhr vierzehn verschwinden alle Männer."),
    (11.2, "Über vier Milliarden Menschen. Einfach weg."),
    (15.2, "Sie verlieren Väter, Brüder, Söhne und Freunde."),
    (19.3, "Und dann machen sie weiter."),
    (23.2, "Sie übernehmen jeden Job, der fehlt."),
    (27.4, "Nachts allein nach Hause? Endlich ohne Angst."),
    (31.2, "Zum ersten Mal ist jedes Parlament zu hundert Prozent weiblich."),
    (35.2, "Sie bauen Städte, in denen man gern lebt."),
    (39.2, "Gleiche Arbeit, gleicher Lohn. Endlich."),
    (43.2, "Nur ein Problem bleibt: Es kommen keine Kinder mehr."),
    (47.2, "Japan, zweitausendvier: eine Maus mit zwei Müttern."),
    (51.2, "Im Jahr zwölf: das erste Kind mit zwei Müttern."),
    (55.2, "Die Zukunft liegt in ihren Händen."),
    (59.4, "Teile das mit einer Frau, die deine Welt bewegt."),
]
for at, dur, text in sprich(zeilen, 63.0, MODELL, os.path.join(HERE, "assets", "audio", "stimme.wav")):
    print(f"{at:6.2f}s  {dur:4.2f}s  {text}")
