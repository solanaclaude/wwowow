"""Erzeugt alle Geräusche für "Was wäre, wenn alles für einen Tag gratis wäre?" nach assets/audio/.

Ausführen aus dem Repo-Root:  python3 videos/02-alles-gratis/ton.py
Zeiten passen zu assets/welt.js (Video-Sekunden in den Kommentaren).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", ".claude", "skills", "was-waere-wenn", "scripts"))
from geraeusche import *  # noqa: E402,F403

OUT = os.path.join(HERE, "assets", "audio")
os.makedirs(OUT, exist_ok=True)
p = lambda name: os.path.join(OUT, name)

# 0–6 s: späte Nacht – Grillen, ein paar Autos
D = 6.0
night = mix(crickets(D, n=4, seed=201) * 0.6, traffic(D, [0.8, 2.4, 3.9, 5.2], seed=203) * 0.5, wind(D, 0.3, seed=205))
write(p("nacht1.wav"), fade(phone(night), 0.05, 0.6))

# 5,5 s: Glocke schlägt Mitternacht (3 Schläge, leiser werdend)
D = 5.0
bells = silence(D)
for i, at in enumerate([0.05, 1.15, 2.25]):
    bells = place(bells, bell(3.0, 392, seed=i) * (1.0 - i * 0.25), at)
write(p("glocke.wav"), phone(bells, 150))

# 5,5 s und 23,5 s: Anzeigen klappen um
write(p("klappen.wav"), mix(flip(0), place(silence(0.5), flip(1) * 0.7, 0.08)))

# 5,8–8,8 s: Jubel, alle rennen los
write(p("jubel.wav"), fade(phone(cheer(3.0)), 0.4, 0.6))

# 8,3–14,8 s: dichte Menge, morgens Vögel
D = 6.5
crowd_big = crowd(D, voices=18, seed=211) * 1.2
crowd_big = mix(crowd_big, place(silence(D), birds(3.2, n=3, seed=213) * 0.5, 0.2))
write(p("menge.wav"), fade(phone(crowd_big), 0.4, 0.8))

# 11,6–17 s: Kartons fallen/werden abgestellt
D = 5.4
boxes = silence(D)
for i, (at, g) in enumerate([(0.2, 0.9), (0.7, 0.7), (1.1, 0.8), (1.6, 0.6), (2.2, 0.7), (2.9, 0.5), (3.6, 0.55), (4.4, 0.4)]):
    boxes = place(boxes, thud(i + 20) * g, at)
write(p("kisten.wav"), phone(boxes, 100))

# 14,5–17,8 s: Nachmittag – weniger Leute, Wind
write(p("nachmittag.wav"), fade(phone(mix(crowd(3.3, voices=6, seed=221) * 0.6, wind(3.3, 0.5, seed=223))), 0.4, 0.5))

# 17,4–20,7 s: Stau – Motoren und Hupen
D = 3.3
jam = mix(engines(D) * 0.7, honks(D, n=9) * 0.9)
write(p("stau.wav"), fade(phone(jam), 0.15, 0.4))

# 20,4–23,7 s: Nacht – leere Stadt
write(p("nacht2.wav"), fade(phone(mix(crickets(3.3, n=5, seed=231) * 0.8, wind(3.3, 0.45, seed=233))), 0.4, 0.5))

# 23,4–26,7 s: Mitternacht – ein Glockenschlag, leise Grillen
D = 3.3
end = mix(crickets(D, n=3, seed=241) * 0.5, wind(D, 0.3, seed=243))
end = place(end, bell(3.0, 392, seed=7) * 0.8, 0.1)
write(p("ende.wav"), fade(phone(end, 150), 0.3, 0.6))

# 0–30 s: Klangteppich, ein Akkord pro Phase
chords = [
    (0.0, 5.5, ["A3", "E4", "C5"]),
    (5.5, 8.5, ["C4", "G4", "E5"]),
    (8.5, 11.5, ["F3", "C4", "A4", "E5"]),
    (11.5, 14.5, ["G3", "D4", "B4"]),
    (14.5, 17.5, ["E3", "B3", "G4"]),
    (17.5, 20.5, ["D3", "A3", "F4", "C5"]),
    (20.5, 23.5, ["A3", "E4", "C5"]),
    (23.5, 26.5, ["F3", "C4", "A4"]),
    (26.5, 30.0, ["A3", "E4", "B4", "C5"]),
]
write(p("musik.wav"), fade(pad(chords, 30.0, bright=2400), 0.8, 2.0))
print("fertig:", sorted(os.listdir(OUT)))
