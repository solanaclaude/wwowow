"""Erzeugt alle Geräusche für "Was wäre, wenn alle Männer verschwinden würden?" nach assets/audio/.

Ausführen aus dem Repo-Root:  python3 videos/03-maenner-weg/ton.py
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


def gain_curve(dur, points):
    xs, ys = zip(*points)
    return np.interp(t_axis(dur), xs, ys)[:, None]


# 0–10 s: belebte Stadt, ab 8,5 s wird es schlagartig leiser (die Männer sind weg)
D = 10.0
city = mix(traffic(D, [0.5, 1.4, 2.3, 3.1, 4.0, 4.9, 5.8, 6.7, 7.6], seed=401) * 0.8, crowd(D, voices=14, seed=403) * 0.8)
city *= gain_curve(D, [(0, 1), (8.5, 1), (9.4, 0.25), (10, 0.15)])
write(p("stadt.wav"), fade(phone(city), 0.05, 0.4))

# 9–15 s: Stille, Wind, leises Flüstern
write(p("stille.wav"), fade(phone(mix(wind(6, 0.8, seed=405), crowd(6, voices=5, seed=407) * 0.25)), 0.8, 0.5))

# 15–19 s: Trauer – Grillen, Wind
write(p("trauer.wav"), fade(phone(mix(crickets(4, n=5, seed=409) * 0.8, wind(4, 0.4, seed=411))), 0.4, 0.5))

# 19–23 s: es geht weiter – Busmotor, Vögel, Schritte
D = 4.0
weiter = mix(engines(D, n=1, seed=413) * 0.6, birds(D, n=3, seed=415) * 0.5, footsteps(D, 2.0, seed=417) * 0.4)
write(p("weiter.wav"), fade(phone(weiter), 0.3, 0.5))

# 23–27 s: Baustelle – Metall, Motor, Stimmen
D = 4.0
bau = mix(engines(D, n=2, seed=419) * 0.35, crowd(D, voices=4, seed=421) * 0.3)
for i, at in enumerate([0.3, 0.75, 1.2, 1.9, 2.35, 2.8, 3.4]):
    bau = place(bau, clank(i) * (0.7 + 0.3 * (i % 2)), at)
write(p("bau.wav"), fade(phone(bau), 0.2, 0.4))

# 27–31 s: Nacht – Grillen und ruhige Schritte
write(p("nacht.wav"), fade(phone(mix(crickets(4, n=4, seed=423) * 0.7, footsteps(4, 1.7, seed=425) * 0.6, wind(4, 0.25, seed=427))), 0.4, 0.5))

# 31–35 s: Parlament – Jubel
write(p("jubel.wav"), fade(phone(cheer(4.0, seed=429)), 0.2, 0.6))

# 35–43 s: grüne Stadt – Vögel, Kinder, Fahrradklingeln
D = 8.0
stadt2 = mix(birds(D, n=5, seed=431) * 0.6, kids(D) * 0.5, leaves(D, seed=433) * 0.4)
for at in [1.2, 3.9, 6.1]:
    stadt2 = place(stadt2, bike_bell(), at)
write(p("stadt2.wav"), fade(phone(stadt2), 0.4, 0.6))

# 43–51 s: Labor bei Nacht – leises Summen, Grillen
write(p("labor.wav"), fade(phone(mix(hum(8, f=120) * 0.25, crickets(8, n=3, seed=435) * 0.5)), 0.6, 0.6))

# 51–59 s: das erste Kind – Vögel, dann Jubel
D = 8.0
kind = mix(birds(D, n=4, seed=437) * 0.5, place(silence(D), cheer(4.0, seed=439) * 0.9, 1.2))
write(p("kind.wav"), fade(phone(kind), 0.4, 1.2))

# 0–63 s: Klangteppich – erst normal, kurz dunkel, dann immer heller und hoffnungsvoller
chords = [
    (0.0, 8.5, ["C4", "E4", "G4", "B4"]),
    (8.5, 15.0, ["A3", "E4", "C5"]),
    (15.0, 19.0, ["F3", "C4", "A4"]),
    (19.0, 23.0, ["C4", "G4", "E5"]),
    (23.0, 27.0, ["G3", "D4", "B4"]),
    (27.0, 31.0, ["E3", "B3", "G4"]),
    (31.0, 35.0, ["F3", "C4", "A4", "E5"]),
    (35.0, 39.0, ["C4", "G4", "E5"]),
    (39.0, 43.0, ["G3", "D4", "B4", "D5"]),
    (43.0, 47.0, ["A3", "E4", "C5"]),
    (47.0, 51.0, ["F3", "C4", "A4"]),
    (51.0, 55.0, ["C4", "G4", "E5", "G5"]),
    (55.0, 59.0, ["F3", "C4", "A4", "E5"]),
    (59.0, 63.0, ["C4", "G4", "E5"]),
]
write(p("musik.wav"), fade(pad(chords, 63.0, bright=2400), 0.8, 2.0))
print("fertig:", sorted(os.listdir(OUT)))
