---
name: was-waere-wenn
description: Erstellt TikTok-Videos im Stil "Was wäre, wenn …?" (wie @meanwhileanimations) komplett im Code mit HyperFrames + Three.js – immer auf Deutsch, hochkant 9:16. Verwenden, sobald der Creator ein neues Video, ein neues "Was wäre wenn"-Thema, eine Szene, ein Skript oder eine Änderung an einem bestehenden Video in diesem Repo will.
---

# „Was wäre, wenn …?“ – TikTok-Videos im Code

Der Creator macht TikToks in der Nische **„Was wäre, wenn …?“**. Vorbild sind die Videos von
@meanwhileanimations („What if every woman disappeared?“, „What if Earth got colder every day?“).
Jedes Video wird **vollständig im Code** gebaut: HyperFrames (HTML → MP4) für Zeitachse und Text,
Three.js für die stilisierte 3D-Welt. **Alle Texte immer auf Deutsch.**

Referenz-Umsetzung, an der du dich orientierst und die du als Vorlage kopierst:
`videos/03-maenner-weg/` (63 s, Sprecherin, große Welt, Nachbearbeitung). Ältere, einfachere
Beispiele: `videos/01-niemand-arbeitet/`, `videos/02-alles-gratis/`.
Den genauen Look beschreibt [references/stil.md](references/stil.md). Lies die Datei vor jedem neuen Video.

## Ablauf für ein neues Video

1. **Thema und Länge klären.** Fehlt die Länge, nimm 30 s. Lang darf es bis ca. 120 s sein.
2. **Beats schreiben** (siehe Dramaturgie unten): Hook-Frage, Normalzustand, 5–7 Eskalationsstufen mit
   Zeitsprung und je einem kurzen, möglichst echten Fakt, Wendepunkt/emotionaler Schluss, Abspann.
   Zahlen und Fakten plausibel halten; im Abspann steht ein echter, überprüfbarer Fakt.
3. **Einen Ort wählen**, der das ganze Video trägt (Straßenkreuzung, Park, Wohnzimmer, Strand …).
   Die Kamera bleibt dort; nur der **Zustand der Welt** ändert sich mit der Zeit.
4. **Projekt anlegen:** `videos/<NN>-<kurzname>/` als Kopie der Referenz anlegen (index.html,
   compositions/, assets/vendor/, package.json, hyperframes.json, meta.json), dann `assets/welt.js`
   für den neuen Ort umbauen und die Texte ersetzen.
5. **Prüfen:** `hyperframes lint`, dann `hyperframes snapshot --at …` an jedem Beat und das
   Kontaktbild ansehen. Erst rendern, wenn jeder Beat stimmt. Danach `hyperframes check` (Kontrast!).
6. **Rendern:** erst eine fast verlustfreie Vorlage `hyperframes render --crf 10 -o <scratchpad>/master.mp4`
   (30 s ≈ 20 min mit Supersampling, im Hintergrund laufen lassen), dann den TikTok-Export (Abschnitt unten).
   Fertiges MP4 per Kontaktbild (`ffmpeg … fps=1/2.5,tile=6x2`) kontrollieren und dem Creator schicken.
7. Committen und auf den Arbeits-Branch pushen.

## Dramaturgie (immer gleich)

| Teil | Dauer (30 s) | Inhalt |
| --- | --- | --- |
| Hook | 0–2,5 s | Frage mittig in Serifenschrift, schon in Frame 0 sichtbar (= Thumbnail). Lebendige Weitwinkel-Szene. |
| Normalzustand | ~3 s | Zähler blendet ein, Zahl tickt live. Untertitel stellt die Welt vor („Montag, 8 Uhr. …“). |
| Auslöser | ~3 s | Das Was-wäre-wenn passiert. Zähler stürzt ab / springt. |
| Eskalation | 4–6 × ~3 s | Je Stufe ein Zeitsprung (Tag 1 → Tag 3 → Tag 7 → Tag 12 → Tag 60 …), ein sichtbarer Zustandswechsel in der Welt und ein kurzer Untertitel. Lichtstimmung kippt (warm → grau → Nacht/Rot → …). |
| Schluss | ~3 s | Emotionaler oder überraschender Moment (letzter Mensch, ein Licht geht an, ein Foto …). Kamera fährt langsam darauf zu. |
| Abspann | 3,5 s | Schwarz (#131313): Frage in Serifenschrift, darunter echter Fakt in Mono-Großbuchstaben, Teilen-Pfeil, unterstrichener Aufruf „Teile das mit jemandem, der …“. |

Bei längeren Videos (60–120 s): mehr Eskalationsstufen, gelegentlich einen zweiten Zähler oder eine
Tafel in der Szene (Börsenkurs, „VERSUCH 12.045: FEHLGESCHLAGEN“), aber dieselbe Struktur.

## Texte auf Deutsch

- Hook und Abspann-Frage: „Was wäre, wenn …?“ – kurz, umgangssprachlich, max. 2 Zeilen.
- Untertitel: 1–2 kurze Sätze, max. ca. 6 Wörter pro Zeile, Präsens, nüchtern-dramatisch.
  Gut: „Niemand holt den Müll ab.“ „Der Strom fällt aus.“ Schlecht: lange Erklärsätze.
- Zähler-Label in Großbuchstaben („MENSCHEN BEI DER ARBEIT“, „TEMPERATUR“, „WELTBEVÖLKERUNG“),
  Zahl mit deutschem Tausenderpunkt (`toLocaleString("de-DE")`), darunter Zeitangabe („TAG 7“).
- Umlaute und ß korrekt schreiben, keine Anglizismen, wenn es ein gutes deutsches Wort gibt.

## Technik (HyperFrames + Three.js) – was sich bewährt hat

- Format 1080×1920, 30 fps. CLI: `npx hyperframes@0.8.197 …` (oder lokal installiert).
  Einmalig: `npx hyperframes browser ensure` lädt den Render-Browser.
- **Keine CDNs:** `gsap.min.js` und `three.module.min.js` liegen in `assets/vendor/`
  (das CDN ist in dieser Umgebung teilweise gesperrt).
- Die 3D-Welt ist ein `<canvas>` im Root (`#welt`, Clip über die Szenendauer), geladen als
  `<script type="module" src="assets/welt.js">`. Im `<head>` wird
  `window.__hf.buildReady.welt` als Promise angelegt; `welt.js` löst es nach dem ersten Render auf.
- `welt.js` zeichnet **nur aus der Zeit**: `window.addEventListener("hf-seek", e => render(e.detail.time))`.
  Kein `Math.random()` (geseedeter mulberry32), kein `requestAnimationFrame`, keine Uhrzeit.
  Muster für Abläufe: jedes Objekt bekommt beim Aufbau eine feste Startzeit (`userData.t`) und ist ab
  dann sichtbar/wächst (`smooth(t0, t0+0.9, t)`). Lichtstimmungen als Keyframe-Liste, dazwischen
  weich überblenden. Kamera als Keyframes mit linearer, langsamer Fahrt.
- **Zähler:** Zahl und Tag werden von einem Skript in `index.html` aus `hf-seek` gesetzt
  (`#zaehler-uhr`). GSAP-`onUpdate` und `hf-seek`-Listener **in** Sub-Kompositionen haben beim
  Rendern nicht zuverlässig gefeuert.
- Texte als Sub-Kompositionen in `compositions/` (`hook`, `zaehler`, `untertitel`, `abspann`);
  Host-ID = `data-composition-id` = Timeline-Key. Ein- und Ausblenden per GSAP auf dem inneren Element.
- Lesbarkeit: Die Vignette in `index.html` hat ein dunkles Band hinter Zähler und Untertiteln, damit
  `hyperframes check` den Kontrast besteht, ohne dass Kästen nötig sind.
- **Ton ist Pflicht.** Jedes Video bekommt Geräusche (siehe Abschnitt „Ton“ unten).
- Keinen TikTok-Wasserzeichen-Text einbauen – das setzt TikTok selbst.

## Optik wie bei den Vorbildern (Pflicht)

Der Creator will die Qualität der Referenzvideos. Das heißt (siehe `videos/03-maenner-weg/assets/welt.js`):

- **Große Welt, hohe Kamera:** Kamera ca. 25–30 m hoch, 45–55 m entfernt, FOV 50, Blick so weit nach
  hinten, dass der Schauplatz im mittleren/unteren Drittel liegt und oben Park, See, Hügel und
  Skyline im Dunst zu sehen sind. Figuren sind klein, aber durch Menge lesbar.
- **Viel Detail drumherum:** Stadtviertel aus Gebäuden mit Fenster-Textur (nachts leuchtende
  `emissiveMap`), Straßenraster, Park mit See (glatt, spiegelnd über `scene.environment`),
  Hunderte Bäume als `InstancedMesh`, Grünstreifen/Hecken/Blumen im Vordergrund – keine leeren Flächen.
- **Nachbearbeitung** über `EffectComposer` (Addons in `assets/vendor/addons/`, eingebunden per
  Import-Map in `index.html`): `RenderPass` → `GTAOPass` (Umgebungsverdeckung) → `UnrealBloomPass`
  (nachts stärker) → `OutputPass`. Umgebungslicht aus einem eigenen Himmels-PMREM.
  Dunst: `THREE.Fog(…, 90, 420)`. Supersampling `SS = 1.5`.
- Rendern dauert so deutlich länger (63 s ≈ 1–2 h). Immer im Hintergrund rendern.

## Sprecherin (Pflicht)

Jedes Video bekommt eine **beruhigende Männerstimme** (Wunsch des Creators) – offline mit Piper, siehe
`scripts/sprecher.py` (Einrichtung im Kopf der Datei; Stimmen liegen in
`~/.cache/was-waere-wenn/voices/`). Standard: **„thorsten“** mit `langsam=1.32`
(Download: `voice-de-thorsten-low.tar.gz` aus den Piper-Releases v0.0.2 auf GitHub).

- Pro Video ein `stimme.py` (Vorlage: `videos/03-maenner-weg/stimme.py`): Liste aus
  (Startzeit, Satz). Der Text entspricht den Untertiteln; Zahlen als Wörter schreiben.
- `sprich()` warnt, wenn ein Satz in den nächsten hineinläuft → Satz kürzen, Untertitel angleichen.
  Pro 4-Sekunden-Beat höchstens ca. 8–9 Wörter (Sprechtempo `langsam=1.32`).
- Einbinden als `<audio id="ton-stimme" … data-volume="1">`; Musik dann ca. 0,14, Umgebungen
  ca. 0,3–0,5, damit die Stimme klar vorne steht.

## Ton

Der Creator will **immer Geräusche im Video**. Netz-Quellen für Sounds (Openverse, Freesound) sind in
dieser Umgebung gesperrt, deshalb:

- **Umgebung und Effekte per Code** mit `scripts/geraeusche.py` (numpy/scipy, geseedet):
  `traffic`, `crowd`, `horn`, `wind`, `leaves`, `crickets`, `birds`, `flies`, `hum`, `power_down`,
  `relay_tick`, `shutter`, `thud` und `pad` (ruhiger Klangteppich aus Akkorden, ein Akkord pro Phase).
  Pro Video ein `ton.py` im Projekt (Vorlage: `videos/01-niemand-arbeitet/ton.py`), das je Ebene eine
  Datei nach `assets/audio/` schreibt; danach mit ffmpeg nach MP3 wandeln.
- **Fertige Effekte** aus der HyperFrames-Bibliothek (Pixabay-Lizenz, frei):
  `node_modules/hyperframes/dist/skills/media-use/audio/assets/sfx/` – whoosh, whoosh-cinematic,
  impact-bass-1/2, riser, click(-soft), pop, glitch … Den Peak mit `hyperframes audio <datei>` messen und
  so platzieren, dass er einen Frame nach dem Bild-Ereignis liegt.
- Aufbau: Klangteppich über alles (Lautstärke ~0,4) + eine Umgebungs-Ebene pro Phase
  (Stadt, Stille/Wind, Nacht, Natur …) + Effekte nur auf sichtbaren Aktionen (Rollladen, Müllsack,
  Stromausfall, Lichtschalter, Abspann-Whoosh). Jede Ebene ist ein eigenes `<audio id=… class="clip">`
  in `index.html` mit `data-start`, `data-duration`, `data-volume`.
- **Handy-Lautsprecher geben unter ~150 Hz fast nichts wieder.** Umgebungen mit `phone()` (Hochpass)
  schreiben, Klangteppich in Oktave 3–5, kein reines Bass-Grollen. `whoosh-cinematic` und
  `impact-bass-*` sind fast nur Bass: höchstens als einzelner Akzent. Nach dem Rendern den Bassanteil
  messen (FFT): unter 150 Hz sollten höchstens ~30 % der Energie liegen.
- Nach dem Rendern: `hyperframes audio renders/<name>.mp4` prüfen, dann die Lautheit für TikTok anheben:
  `ffmpeg -i in.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.2:LRA=11" -c:a aac -b:a 192k -movflags +faststart out.mp4`
  (Ziel: -16 bis -14 LUFS, True Peak ≤ -1 dBTP).

## TikTok-Qualität

TikTok komprimiert jedes Video neu. Feine, flimmernde Details und Farbverläufe leiden am meisten. Deshalb:

- **Supersampling:** `welt.js` rendert mit `renderer.setPixelRatio(2)` (intern 2160×3840) und der
  Browser verkleinert auf 1080×1920. So gibt es keine Treppenkanten und kein Flimmern.
  Schattenkarte 4096.
- **Dithering** im Himmels-Shader (±1/128) gegen Farbstreifen in dunklen Verläufen.
- Keine winzigen, kontrastreichen Details, die sich bewegen. Schrift nicht unter ~24 px.
- **Export aus der Vorlage** (eine Datei, Ton gleich mit normalisiert):
  `ffmpeg -i master.mp4 -c:v libx264 -preset slow -tune animation -crf 14 -maxrate 16M -bufsize 32M
  -profile:v high -level 4.2 -pix_fmt yuv420p -r 30 -g 60 -colorspace bt709 -color_primaries bt709
  -color_trc bt709 -af "loudnorm=I=-14:TP=-1.2:LRA=11" -c:a aac -b:a 192k -ar 48000
  -movflags +faststart renders/<name>.mp4`
- **Tipps zum Hochladen für den Creator:** Originaldatei hochladen (nicht über WhatsApp oder
  Telegram schicken, nicht per Bildschirmaufnahme). In TikTok „Hochladen in hoher Qualität“
  einschalten (beim Posten unter „Mehr Optionen“) und „Datensparmodus“ ausschalten. Über WLAN
  hochladen, alternativ über tiktok.com/upload am Computer. Direkt nach dem Posten ist die Qualität
  oft schlechter. TikTok liefert die HD-Fassung nach einigen Minuten nach.

## Checkliste vor dem Abgeben

- [ ] Frame 0 zeigt die Hook-Frage über einer lebendigen Szene.
- [ ] Jeder Beat hat einen **sichtbaren** Zustandswechsel in der Welt, nicht nur neuen Text.
- [ ] Zähler läuft (Snapshot an zwei Zeiten vergleichen) und springt passend zur Geschichte.
- [ ] Alle Texte deutsch, keine Tippfehler, in der Zone 168–1330 px (TikTok-UI unten/rechts frei).
- [ ] `hyperframes check`: 0 Fehler, Kontrast bestanden.
- [ ] MP4: 1080×1920, 30 fps, richtige Länge; Kontaktbild angesehen.
- [ ] Ton vorhanden, Lautheit -16 bis -14 LUFS, Effekte liegen auf den Bild-Ereignissen.
