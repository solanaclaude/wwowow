"""Erzeugt alle Geräusche für dieses Video nach assets/audio/.

Ausführen aus dem Repo-Root:  python3 videos/01-niemand-arbeitet/ton.py
Die Zeiten passen zu assets/welt.js (Video-Sekunden in den Kommentaren).
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
    """points: [(sekunde, gain), ...] -> lineare Hüllkurve als Stereo-Faktor."""
    t = t_axis(dur)
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)[:, None]


# 0–9,5 s: Berufsverkehr und Menschen, ab 5,4 s wird es still
D = 9.5
passes = [0.4, 1.1, 1.9, 2.6, 3.2, 3.9, 4.6, 5.2, 5.9, 6.6, 7.3]
city = mix(traffic(D, passes) * 0.9, crowd(D) * 0.7)
city = place(city, horn() * 0.5, 1.3)
city = place(city, horn((392, 494)) * 0.35, 4.2)
city *= gain_curve(D, [(0, 1), (5.3, 1), (6.6, 0.45), (8.0, 0.08), (9.5, 0)])
write(p("stadt.wav"), fade(city, 0.05, 0.4))

# 8,0–17,8 s: leere Straße – Wind
write(p("leer.wav"), fade(wind(9.8, 1.0, seed=33), 1.2, 1.0))

# 8,5–19,6 s: Ampel blinkt gelb (Relais-Klicken, an und aus)
D = 11.1
amp = silence(D)
k = 7  # erste Gelbphase bei 8,75 s (k * 1,25)
while k * 1.25 < 19.6:
    at = k * 1.25 - 8.5
    amp = place(amp, relay_tick(), at)
    amp = place(amp, relay_tick(f=1300) * 0.5, at + 0.625)
    k += 1
write(p("ampel.wav"), amp)

# 8,55 s: Rollladen fährt herunter
write(p("rollladen.wav"), shutter(0.75))

# 11,5–17,8 s: Fliegen um den Müll
write(p("fliegen.wav"), fade(flies(6.3), 1.0, 1.2))

# 11,5 s: Müllsäcke plumpsen
D = 6.0
bags = silence(D)
for i, (at, g) in enumerate([(0.2, 1.0), (0.62, 0.8), (1.0, 0.9), (1.45, 0.7), (1.95, 0.75), (2.6, 0.6), (3.3, 0.55), (4.1, 0.45), (5.0, 0.4)]):
    bags = place(bags, thud(i) * g, at)
write(p("muell.wav"), bags)

# 8,5–19,1 s: Neonröhren-Summen aus dem Supermarkt, dann Stromausfall
write(p("summen.wav"), fade(hum(10.6), 1.5, 0.05))
write(p("strom-aus.wav"), power_down())

# 17,4–20,8 s: Nacht – Grillen
write(p("nacht.wav"), fade(mix(crickets(3.4), wind(3.4, 0.35, seed=35)), 0.6, 0.5))

# 20,3–23,9 s: Natur – Vögel und Blätter
write(p("natur.wav"), fade(mix(birds(3.6), leaves(3.6) * 0.8, wind(3.6, 0.3, seed=39)), 0.4, 0.5))

# 23,3–26,7 s: Abend – leise Grillen
write(p("abend.wav"), fade(mix(crickets(3.4, n=3, seed=45) * 0.7, wind(3.4, 0.3, seed=47)), 0.5, 0.6))

# 0–30 s: ruhiger Klangteppich, der die Stimmung jeder Phase trägt
chords = [
    (0.0, 5.4, ["A2", "E3", "B3", "C4"]),
    (5.4, 8.5, ["F2", "C3", "A3", "E4"]),
    (8.5, 14.5, ["A2", "E3", "C4"]),
    (14.5, 17.5, ["D2", "A2", "F3", "C4"]),
    (17.5, 20.5, ["E2", "B2", "D3", "F3"]),
    (20.5, 23.5, ["C3", "G3", "D4", "E4"]),
    (23.5, 24.4, ["A2", "E3", "C4"]),
    (24.4, 26.5, ["F2", "C3", "A3", "E4"]),
    (26.5, 30.0, ["C3", "G3", "E4"]),
]
music = pad(chords, 30.0, bright=1100)
write(p("musik.wav"), fade(music, 0.8, 2.0))
print("fertig:", sorted(os.listdir(OUT)))
