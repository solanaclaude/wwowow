// 3D-Welt: Rathausplatz. Alle Männer verschwinden – und die Frauen bauen die Welt weiter.
// Alles wird nur aus der Zeit t berechnet (render(t)) – HyperFrames rendert Frames einzeln.
import * as THREE from "./vendor/three.module.min.js";

// ---------- Zeitplan (Video-Sekunden) ----------
const T = {
  verschwinden: 8.5, // 09:14 – alle Männer verschwinden
  schock: 11, // Frauen bleiben stehen
  trauer: 15, // Abend, Lichter am Brunnen
  weiter: 19, // Tag 3 – Autos weg, Bus fährt wieder
  bau: 23, // Woche 2 – Baustelle läuft
  nacht: 27, // Monat 1 – nachts sicher
  parlament: 31, // Monat 3 – 100 % Frauen
  stadt: 35, // Jahr 1 – grüne Stadt
  lohn: 39, // Jahr 3 – Kita, gleicher Lohn
  labor: 43, // Jahr 5 – Forschung
  maus: 47, // Jahr 8
  kind: 51, // Jahr 12 – das erste Kind
  zukunft: 55,
  end: 59,
};

// ---------- Helfer ----------
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261027);
const R = (a, b) => a + (b - a) * rnd();
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
const lerp = (a, b, u) => a + (b - a) * u;
const backOut = (u) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
};
const col = (h) => new THREE.Color(h);
const inWin = (t, a, b) => t >= a && t < b;

// ---------- Renderer, Szene, Kamera ----------
const W = 1080, H = 1920;
const canvas = document.getElementById("welt-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
const SS = 2; // Supersampling gegen Flimmern auf TikTok
renderer.setPixelRatio(SS);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, 40, 140);
const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 400);

const skyU = { top: { value: col("#7fa5d6") }, bottom: { value: col("#ffd2a1") } };
scene.add(
  new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: skyU,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ float h = smoothstep(-0.05, 0.45, vP.y);
        vec3 c = mix(bottom, top, h) + (hash(gl_FragCoord.xy) - 0.5) / 128.0;
        gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    }),
  ),
);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ---------- Bausteine ----------
const std = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...extra });
const glow = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...extra });
function box(w, h, d, mat, x, y, z, shadow = true, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function textTex(w, h, bg, fg, text, font, opts = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const lines = text.split("\n");
    const lh = h / (lines.length + 0.6);
    lines.forEach((l, i) => g.fillText(l, w / 2, lh * (i + 0.8) + (opts.dy || 0)));
  });
}
const glowTex = (rgb) =>
  canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, `rgba(${rgb},0.9)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
const poolTex = glowTex("255,200,120");

// ---------- Boden ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), std("#8d8a84"));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const road = new THREE.Mesh(new THREE.PlaneGeometry(120, 8.8), std("#4a4c52", { roughness: 0.95 }));
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.01, 0);
road.receiveShadow = true;
scene.add(road);
box(120, 0.18, 3.6, std("#c9c2b5"), 0, 0.09, -6.2).castShadow = false;
box(120, 0.22, 0.25, std("#b9b4aa"), 0, 0.11, -4.45).castShadow = false;
box(120, 0.22, 0.25, std("#b9b4aa"), 0, 0.11, 4.45).castShadow = false;
{
  // Platz mit Pflaster
  const tex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#d6cdbd";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(90,80,70,0.2)";
    g.lineWidth = 2;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) g.strokeRect(x * 32 + (y % 2) * 16, y * 32, 32, 32);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(40, 4);
  const p = new THREE.Mesh(new THREE.BoxGeometry(120, 0.18, 12), std("#ffffff", { map: tex }));
  p.position.set(0, 0.09, 10.4);
  p.receiveShadow = true;
  scene.add(p);
}
const markMat = glow("#d9d6cc");
for (let x = -60; x < 60; x += 4) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.14), markMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.02, 0.15);
  scene.add(m);
}
// Radweg (ab Jahr 1)
const bikeLane = new THREE.Mesh(new THREE.PlaneGeometry(120, 1.1), std("#4f9a5a"));
bikeLane.rotation.x = -Math.PI / 2;
bikeLane.position.set(0, 0.022, 3.6);
scene.add(bikeLane);

// ---------- Gebäude ----------
const winDefs = [];
const ZF = -8;
function building({ x0, x1, z = ZF, depth = 10, floors, floorH = 3.1, color, groundH = 4, cornice = "#efe7d8", wins = true }) {
  const w = x1 - x0, cx = (x0 + x1) / 2, h = groundH + floors * floorH;
  box(w, h, depth, std(color), cx, h / 2, z - depth / 2);
  const cm = std(cornice);
  box(w + 0.3, 0.45, 0.5, cm, cx, h + 0.1, z + 0.05);
  for (let f = 0; f <= floors; f++) box(w + 0.05, 0.12, 0.18, cm, cx, groundH + f * floorH - 0.05, z + 0.05, false);
  if (wins) {
    const cols = Math.max(2, Math.floor(w / 2.1));
    const step = w / cols;
    for (let f = 0; f < floors; f++)
      for (let c = 0; c < cols; c++)
        winDefs.push({ x: x0 + step * (c + 0.5), y: groundH + f * floorH + floorH * 0.52, z: z + 0.02, w: Math.min(1.15, step * 0.55), h: floorH * 0.55, seed: rnd() });
  }
  return { cx, w, h };
}
building({ x0: -28, x1: -15.2, floors: 4, color: "#c97b5d" });
const bLinks = building({ x0: -15.2, x1: -5.0, floors: 3, color: "#e3d6bf", cornice: "#f5efe3" });
building({ x0: 14.5, x1: 26, floors: 4, color: "#9fb19a" });

// Rathaus
const RH = { x0: -4.6, x1: 4.6 };
{
  const w = RH.x1 - RH.x0, h = 11.6;
  box(w, h, 12, std("#efe6d2"), 0, h / 2, ZF - 6);
  box(w + 0.6, 0.6, 0.8, std("#f7f1e3"), 0, h + 0.2, ZF + 0.1);
  // Giebel
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 3), std("#f7f1e3"));
  ped.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  ped.scale.set(2.0, 0.8, 4.4);
  ped.position.set(0, 4.75, ZF + 1.6);
  ped.castShadow = true;
  scene.add(ped);
  box(8.6, 0.35, 2.2, std("#f7f1e3"), 0, 4.55, ZF + 1.3);
  // Säulen
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 4.2, 14), std("#f7f1e3"));
    c.position.set(-3.6 + i * 1.44, 2.4, ZF + 1.9);
    c.castShadow = c.receiveShadow = true;
    scene.add(c);
  }
  // Treppe
  for (let s = 0; s < 4; s++) box(9.2 - s * 0.2, 0.15, 0.5, std("#e2dccd"), 0, 0.25 + s * 0.15, ZF + 3.0 - s * 0.45);
  box(9.2, 0.3, 2.6, std("#e2dccd"), 0, 0.15, ZF + 1.4);
  // Tür
  box(1.6, 2.6, 0.1, std("#5a3a28"), 0, 1.6, ZF + 0.05, false);
  // Fenster
  for (let f = 0; f < 2; f++)
    for (let c = 0; c < 4; c++) winDefs.push({ x: -3.3 + c * 2.2, y: 6.6 + f * 2.6, z: ZF + 0.02, w: 1.0, h: 1.7, seed: rnd() });
  // Uhrturm
  box(2.6, 6.5, 2.6, std("#efe6d2"), 0, h + 3.25, ZF - 3);
  box(3.0, 0.4, 3.0, std("#f7f1e3"), 0, h + 6.6, ZF - 3);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 3.0, 4), std("#5f7f75"));
  roof.position.set(0, h + 8.3, ZF - 3);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  scene.add(roof);
  const clock = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 32),
    std("#ffffff", {
      map: canvasTex(128, 128, (g) => {
        g.fillStyle = "#fbf6ea";
        g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
        g.strokeStyle = "#2b2b2b"; g.lineWidth = 5;
        g.beginPath(); g.arc(64, 64, 58, 0, 7); g.stroke();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          g.beginPath(); g.moveTo(64 + Math.sin(a) * 46, 64 - Math.cos(a) * 46); g.lineTo(64 + Math.sin(a) * 54, 64 - Math.cos(a) * 54); g.stroke();
        }
        g.lineWidth = 6;
        g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 30 * Math.sin(0.3), 64 - 30 * Math.cos(0.3)); g.stroke();
        g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 44 * Math.sin(1.47), 64 - 44 * Math.cos(1.47)); g.stroke();
      }),
    }),
  );
  clock.position.set(0, h + 4.2, ZF - 1.68);
  scene.add(clock);
  // Fahnen
  for (const dx of [-3.4, 3.4]) {
    box(0.08, 3.2, 0.08, std("#d9d9d9", { metalness: 0.5 }), dx, h + 1.9, ZF - 0.2);
    const fl = box(1.4, 0.8, 0.03, std("#2f6fb5"), dx + 0.72, h + 3.0, ZF - 0.2, false);
    fl.userData.flag = true;
  }
}
// Banner am Rathaus (Parlament 100 % Frauen)
const banner = new THREE.Mesh(
  new THREE.PlaneGeometry(7.6, 1.5),
  glow("#ffffff", { map: textTex(760, 150, "#8a3ffc", "#ffffff", "100 % FRAUEN IM PARLAMENT", "900 48px Arial Black, Arial", { dy: 2 }) }),
);
banner.position.set(0, 3.5, ZF + 2.75);
scene.add(banner);

// Linkes Haus: Erdgeschoss Café → später Kita
const cafeTex = textTex(400, 64, "#2f4a3c", "#f6edd8", "Café am Rathaus", "italic 700 40px Georgia, serif");
const kitaTex = canvasTex(400, 64, (g, w, h) => {
  const cs = ["#ff5a5a", "#ffb547", "#ffe14a", "#46d39a", "#3aa0ff", "#9a7bff"];
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, w, h);
  g.font = "900 44px Arial Black, Arial";
  g.textBaseline = "middle";
  const s = "KITA SONNENSCHEIN";
  let x = 14;
  for (let i = 0; i < s.length; i++) {
    g.fillStyle = cs[i % cs.length];
    g.fillText(s[i], x, h / 2 + 2);
    x += g.measureText(s[i]).width;
  }
});
const shopSignMat = std("#ffffff", { map: cafeTex });
box(5.2, 0.7, 0.1, shopSignMat, -10.1, 3.75, ZF + 0.08, false);
const shopBackMat = glow("#ffe9c4");
box(8.6, 2.6, 0.05, shopBackMat, -10.1, 1.6, ZF + 0.03, false);
const kitaPaint = new THREE.Mesh(
  new THREE.PlaneGeometry(10.2, 3.6),
  new THREE.MeshStandardMaterial({
    transparent: true,
    map: canvasTex(512, 180, (g, w, h) => {
      const cs = ["#ff5a5a", "#ffb547", "#ffe14a", "#46d39a", "#3aa0ff", "#9a7bff"];
      for (let i = 0; i < 9; i++) {
        g.fillStyle = cs[i % cs.length];
        g.beginPath();
        g.arc(30 + i * 58, 150 - (i % 2) * 20, 26, 0, 7);
        g.fill();
      }
      g.fillStyle = "#ffe14a";
      g.beginPath(); g.arc(460, 40, 26, 0, 7); g.fill();
    }),
  }),
);
kitaPaint.position.set(-10.1, 5.9, ZF + 0.04);
scene.add(kitaPaint);

// Baustelle → Forschungszentrum
const site = { x0: 5.4, x1: 13.8, z: ZF };
const slabs = [];
for (let f = 0; f < 6; f++) {
  const g = new THREE.Group();
  const slab = box(site.x1 - site.x0, 0.35, 9, std("#b9b6ae"), 0, 0, 0, true, g);
  for (const cx of [-3.6, -1.2, 1.2, 3.6]) box(0.4, 3.0, 0.4, std("#a8a59d"), cx, -1.6, -0.5 + 4, true, g);
  g.position.set((site.x0 + site.x1) / 2, 3.2 + f * 3.2, site.z - 4.5);
  g.userData.f = f;
  scene.add(g);
  slabs.push(g);
}
const scaffold = new THREE.Mesh(new THREE.BoxGeometry(site.x1 - site.x0 + 0.6, 20, 0.6, 8, 12, 1), std("#e0a43a", { wireframe: true }));
scaffold.position.set((site.x0 + site.x1) / 2, 10, site.z + 0.3);
scene.add(scaffold);
// fertige Glasfassade
const labFacade = box(site.x1 - site.x0, 19.4, 0.3, std("#7fa6c4", { roughness: 0.25, metalness: 0.4 }), (site.x0 + site.x1) / 2, 9.7, site.z, true);
const labWins = [];
for (let f = 0; f < 6; f++)
  for (let c = 0; c < 4; c++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), glow("#cfe8ff"));
    m.position.set(site.x0 + 1.1 + c * 2.07, 1.8 + f * 3.2, site.z + 0.17);
    scene.add(m);
    labWins.push(m);
  }
const labSign = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 0.95), glow("#ffffff", { map: textTex(740, 96, "#ffffff", "#1d4fd8", "FORSCHUNGSZENTRUM", "900 62px Arial Black, Arial", { dy: 3 }) }));
labSign.position.set((site.x0 + site.x1) / 2, 19.9, site.z + 0.2);
scene.add(labSign);
// Kran
const crane = new THREE.Group();
{
  const yellow = std("#f2b630");
  const mast = new THREE.Mesh(new THREE.BoxGeometry(1.0, 26, 1.0, 1, 26, 1), std("#f2b630", { wireframe: true }));
  mast.position.y = 13;
  crane.add(mast);
  box(1.0, 26, 1.0, std("#f2b630", { transparent: true, opacity: 0.25 }), 0, 13, 0, false, crane);
  const jibG = new THREE.Group();
  jibG.position.y = 26.2;
  box(18, 0.7, 0.7, yellow, -5, 0, 0, true, jibG);
  box(4, 1.4, 1.4, std("#555555"), 5.5, 0, 0, true, jibG); // Gegengewicht
  box(1.6, 1.6, 1.6, std("#e9e9e9"), 0, -1.0, 0, true, jibG); // Kabine
  const cable = box(0.05, 1, 0.05, std("#333333"), -11, 0, 0, false, jibG);
  const hook = box(0.5, 0.5, 0.5, std("#333333"), -11, -8, 0, true, jibG);
  const load = box(3.0, 0.6, 1.0, std("#9a6b3a"), -11, -8.6, 0, true, jibG);
  crane.add(jibG);
  crane.userData = { jibG, cable, hook, load };
}
crane.position.set(15.2, 0, -14);
scene.add(crane);

// Skyline
const skylineWins = [];
for (let i = 0; i < 24; i++) {
  const x = R(-45, 45), z = R(-42, -85), w = R(5, 11), d = R(5, 11), h = R(14, 44);
  box(w, h, d, std(pick(["#9aa3ad", "#a8adb3", "#8d97a3", "#b3b0a8", "#7f8c99"])), x, h / 2, z, false);
  for (let yy = 3; yy < h - 1; yy += 2.2)
    for (let xx = -w / 2 + 0.8; xx < w / 2 - 0.5; xx += 1.4)
      if (rnd() < 0.55) skylineWins.push({ x: x + xx, y: yy, z: z + d / 2 + 0.03, w: 0.7, h: 1.1, seed: rnd() });
}
function makeWindows(defs) {
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), defs.length);
  const m4 = new THREE.Matrix4();
  defs.forEach((d, i) => {
    m4.compose(new THREE.Vector3(d.x, d.y, d.z), new THREE.Quaternion(), new THREE.Vector3(d.w, d.h, 1));
    im.setMatrixAt(i, m4);
    im.setColorAt(i, new THREE.Color(0, 0, 0));
    d.warm = col(pick(["#ffd27a", "#ffc864", "#ffe2a6", "#ffb85c"]));
    d.day = col(pick(["#8fa6b8", "#9db0bf", "#7f95a8", "#a9b9c4", "#e8e2d4"]));
  });
  scene.add(im);
  return im;
}
const winMesh = makeWindows(winDefs);
const skyWinMesh = makeWindows(skylineWins);

// ---------- Laternen, Bäume ----------
const lampHeads = [], pools = [];
function streetLamp(x, z, dir) {
  box(0.12, 5.2, 0.12, std("#2f3439"), x, 2.6, z);
  box(0.08, 0.08, 1.1, std("#2f3439"), x, 5.15, z + dir * 0.5);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.7), glow("#3a3a3a"));
  head.position.set(x, 5.05, z + dir * 1.0);
  scene.add(head);
  lampHeads.push(head);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(x, 0.22, z + dir * 1.3);
  scene.add(pool);
  pools.push(pool);
}
streetLamp(-12, -5.0, 1);
streetLamp(6.8, -5.0, 1);
streetLamp(-7.5, 5.0, -1);
streetLamp(5.5, 5.0, -1);
streetLamp(-3, 13.5, -1);
function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.4, 8), std("#6b4a35"));
  trunk.position.y = 1.2;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = std(pick(["#5f8f4e", "#6aa047", "#4f8236"]));
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(R(0.9, 1.25), 0), leafMat);
    c.position.set(R(-0.4, 0.4), 2.7 + i * 0.45, R(-0.4, 0.4));
    c.castShadow = true;
    g.add(c);
  }
  g.position.set(x, 0.18, z);
  g.scale.setScalar(s);
  scene.add(g);
  return g;
}
tree(-16, -5.6);
tree(14, 6.2);
const newTrees = [];
for (let x = -13; x <= 13; x += 4.3) if (Math.abs(x) > 2) newTrees.push({ g: tree(x, 5.6, 0.001), t: T.stadt + 0.1 + Math.abs(x) * 0.04 });

// ---------- Brunnen ----------
const FOUNT = { x: 0, z: 9.2 };
{
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.9, 0.55, 32), std("#cfc7b6"));
  basin.position.set(FOUNT.x, 0.45, FOUNT.z);
  basin.castShadow = basin.receiveShadow = true;
  scene.add(basin);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), std("#5fa8d3", { roughness: 0.1, metalness: 0.2 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(FOUNT.x, 0.68, FOUNT.z);
  scene.add(water);
  const col1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.6, 12), std("#cfc7b6"));
  col1.position.set(FOUNT.x, 1.3, FOUNT.z);
  col1.castShadow = true;
  scene.add(col1);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.4, 0.25, 20), std("#cfc7b6"));
  bowl.position.set(FOUNT.x, 2.1, FOUNT.z);
  bowl.castShadow = true;
  scene.add(bowl);
}
const spray = [];
for (let i = 0; i < 18; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), std("#e6f4ff", { transparent: true, opacity: 0.8 }));
  scene.add(m);
  spray.push({ m, a: (i / 18) * Math.PI * 2, o: i / 18 });
}

// ---------- Spielplatz und Marktstände (ab Jahr 1) ----------
const playground = new THREE.Group();
{
  const red = std("#e04f3c"), blue = std("#2f6fb5"), yel = std("#f2c230");
  box(0.12, 2.2, 0.12, blue, -1.2, 1.1, -0.5, true, playground);
  box(0.12, 2.2, 0.12, blue, 1.2, 1.1, -0.5, true, playground);
  box(2.5, 0.12, 0.12, blue, 0, 2.2, -0.5, true, playground);
  box(0.5, 0.06, 0.25, red, -0.5, 0.7, -0.5, true, playground);
  box(0.5, 0.06, 0.25, yel, 0.5, 0.7, -0.5, true, playground);
  const slide = box(0.7, 0.08, 2.8, yel, 0, 0.9, 1.4, true, playground);
  slide.rotation.x = 0.55;
  box(0.9, 1.6, 0.9, red, 0, 0.8, 2.8, true, playground);
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.06, 28), std("#e8d29a"));
  sand.position.y = 0.0;
  playground.add(sand);
}
playground.position.set(-7.0, 0.2, 10.4);
scene.add(playground);
const stalls = new THREE.Group();
for (let i = 0; i < 3; i++) {
  const g = new THREE.Group();
  box(2.2, 0.9, 1.0, std("#8a6a4a"), 0, 0.45, 0, true, g);
  const tex = canvasTex(128, 32, (c, w, h) => {
    for (let k = 0; k < 8; k++) {
      c.fillStyle = k % 2 ? "#ffffff" : ["#e04f3c", "#2f6fb5", "#46a35a"][i];
      c.fillRect(k * 16, 0, 16, h);
    }
  });
  const roof = box(2.6, 0.08, 1.6, std("#ffffff", { map: tex }), 0, 2.2, 0, true, g);
  roof.rotation.x = 0.15;
  for (const dx of [-1.1, 1.1]) box(0.07, 2.2, 0.07, std("#555"), dx, 1.1, 0.6, true, g);
  for (let k = 0; k < 6; k++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), std(pick(["#e04f3c", "#f2c230", "#f08a2c", "#57a85a", "#9b2f45"])));
    f.position.set(-0.8 + k * 0.32, 0.98, 0);
    g.add(f);
  }
  g.position.set(5.6 + i * 2.9, 0.2, 11.5 - i * 0.4);
  g.rotation.y = -0.15;
  stalls.add(g);
}
scene.add(stalls);

// ---------- Fahrzeuge ----------
const carColors = ["#d94a3d", "#2f6fb5", "#f2c230", "#e8e4dc", "#3a3f45", "#5aa36a", "#8a4fc0", "#f08a2c", "#a7c4d6"];
const headMat = glow("#fff3cf"), tailMat = glow("#ff2a2a");
function makeCar(color, len = 3.6, height = 0.75) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, height, 1.65), std(color, { roughness: 0.45 }));
  body.position.y = 0.65;
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(len * 0.55, 0.65, 1.5), std("#2a3540", { roughness: 0.25 }));
  cab.position.set(-0.2, 1.3, 0);
  cab.castShadow = true;
  g.add(cab);
  for (const wx of [-len * 0.32, len * 0.32])
    for (const wz of [-0.8, 0.8]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14), std("#161616"));
      wh.rotation.x = Math.PI / 2;
      wh.position.set(wx, 0.34, wz);
      g.add(wh);
    }
  for (const wz of [-0.55, 0.55]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.34), headMat);
    hl.position.set(len / 2 + 0.01, 0.75, wz);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.3), tailMat);
    tl.position.set(-len / 2 - 0.01, 0.78, wz);
    g.add(tl);
  }
  scene.add(g);
  return g;
}
const PERIOD = 80;
const cars = [];
for (let i = 0; i < 10; i++) {
  const lane = i % 2;
  cars.push({ g: makeCar(pick(carColors)), z: lane === 0 ? 1.9 : -1.15, dir: lane === 0 ? 1 : -1, speed: lane === 0 ? 7.6 : 7.0, phase: (Math.floor(i / 2) * PERIOD) / 5 + lane * 7 + R(-2, 2), tow: R(T.weiter + 0.3, T.weiter + 3.4) });
}
const carX = (c, t) => {
  const x = -40 + ((c.phase + c.speed * t) % PERIOD);
  return c.dir > 0 ? x : -x;
};
// Bus
const bus = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(8.5, 2.7, 2.4), std("#f2c230", { roughness: 0.6 }));
  body.position.y = 1.75;
  body.castShadow = body.receiveShadow = true;
  bus.add(body);
  const win = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.95, 2.42), std("#23313d", { roughness: 0.3 }));
  win.position.set(0.2, 2.25, 0);
  bus.add(win);
  for (const wx of [-2.9, 2.9])
    for (const wz of [-1.2, 1.2]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), std("#1b1b1b"));
      wh.rotation.x = Math.PI / 2;
      wh.position.set(wx, 0.5, wz);
      bus.add(wh);
    }
  scene.add(bus);
}
const busX = (t) => {
  if (t < T.verschwinden + 0.4) return -26 + t * 2.4; // fährt langsam heran
  if (t < T.weiter + 1.0) return -26 + (T.verschwinden + 0.4) * 2.4; // steht ohne Fahrer
  const dt = t - (T.weiter + 1.0);
  return -26 + (T.verschwinden + 0.4) * 2.4 + 1.5 * dt * dt; // eine Fahrerin fährt ihn weiter
};

// ---------- Menschen (Instanzen) ----------
const skin = ["#f1c7a5", "#d9a37e", "#a86f4c", "#6e4630", "#e8b896"];
const clothW = ["#d94a3d", "#e86a9a", "#f2c230", "#8a4fc0", "#2a9d8f", "#f08a2c", "#e8e4dc", "#5aa36a", "#2f6fb5", "#c94f7c"];
const clothM = ["#2f6fb5", "#3a3f45", "#1f2f4a", "#5a6b7a", "#7a5a3a", "#3d6b4f", "#9b2f45", "#c0c4c8"];
const hairCols = ["#2b1d14", "#5a3b22", "#c99a5b", "#1a1a1a", "#8a3a22", "#d8c9a6"];
const N = 230;
const people = [];
for (let i = 0; i < N; i++) {
  const woman = i < 2 ? true : rnd() < 0.5;
  people.push({
    woman,
    skirt: woman && rnd() < 0.55,
    wz: pick([R(5.0, 7.6), R(12.2, 15), R(-7.4, -5.1)]),
    wdir: rnd() < 0.5 ? 1 : -1,
    wphase: R(0, 56),
    wspeed: R(1.0, 1.6),
    step: R(0, 6),
    scale: R(0.9, 1.05) * (woman ? 0.96 : 1.04),
    tv: R(T.verschwinden, T.verschwinden + 1.3), // Moment des Verschwindens (Männer)
  });
}
const women = people.map((p, i) => (p.woman ? i : -1)).filter((i) => i >= 0);
// Rollen: Indizes in der Liste der Frauen
const roleIdx = {};
women.forEach((pi, k) => (roleIdx[pi] = k));
const mk = (geo, mat, cols, n = N) => {
  const m = new THREE.InstancedMesh(geo, mat || std("#ffffff"), n);
  m.castShadow = true;
  m.receiveShadow = true;
  if (cols) for (let i = 0; i < n; i++) m.setColorAt(i, col(cols(i)));
  m.frustumCulled = false;
  scene.add(m);
  return m;
};
const bodyI = mk(new THREE.CapsuleGeometry(0.22, 0.75, 4, 10), null, (i) => pick(people[i].woman ? clothW : clothM));
const legI = mk(new THREE.CapsuleGeometry(0.17, 0.5, 4, 8), null, (i) => pick(["#2a2f3a", "#3d4a5c", "#4a3a2e", "#1c1c1c", "#6b5a8a"]));
const headI = mk(new THREE.SphereGeometry(0.17, 14, 10), null, () => pick(skin));
// die zwei Mütter am Ende: eigene, gut erkennbare Farben
bodyI.setColorAt(0, col("#e86a9a"));
bodyI.setColorAt(1, col("#2a9d8f"));
const hairI = mk(new THREE.SphereGeometry(0.2, 12, 10), null, () => pick(hairCols)); // lange Haare (Frauen)
const capI = mk(new THREE.SphereGeometry(0.178, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), null, () => pick(hairCols)); // kurze Haare (Männer)
const skirtI = mk(new THREE.ConeGeometry(0.36, 0.6, 12), null, (i) => pick(clothW));
const helmetI = mk(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std("#ffcc1a"), () => "#ffcc1a");
const candleI = mk(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), std("#f4efe6"), () => "#f4efe6");
const flameI = mk(new THREE.PlaneGeometry(0.45, 0.45), new THREE.MeshBasicMaterial({ map: glowTex("255,190,90"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), () => "#ffffff");
const puffI = mk(new THREE.SphereGeometry(0.5, 12, 10), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), () => "#000000");
puffI.castShadow = false;
flameI.castShadow = false;
const hidden = new THREE.Matrix4().compose(new THREE.Vector3(0, -50, 0), new THREE.Quaternion(), new THREE.Vector3(1e-4, 1e-4, 1e-4));
// Baby im Arm der Mutter
const baby = new THREE.Group();
{
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.2, 4, 10), std("#fde8ee"));
  b.rotation.z = Math.PI / 2;
  baby.add(b);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), std("#f1c7a5"));
  h.position.set(0.2, 0.03, 0.02);
  baby.add(h);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI), std("#fde8ee"));
  hood.position.set(0.21, 0.03, -0.02);
  hood.rotation.y = Math.PI;
  baby.add(hood);
  // Arme der Mutter, die das Kind halten
  for (const [x, z] of [[-0.12, 0.05], [0.12, 0.08]]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.28, 4, 8), std("#e86a9a"));
    arm.rotation.z = Math.PI / 2;
    arm.position.set(x, -0.09, z);
    baby.add(arm);
  }
  baby.scale.setScalar(1.25);
  scene.add(baby);
}

// Positionen für Gruppen-Szenen
const MOM = { x: 0.6, z: 12.2 };
const rng2 = mulberry32(99);
const ringPos = (k, n, cx, cz, r0, r1, a0 = 0, a1 = Math.PI * 2) => {
  const perRing = Math.ceil(n / 2);
  const ring = k < perRing ? 0 : 1;
  const j = ring ? k - perRing : k;
  const a = a0 + ((j + 0.5) / perRing) * (a1 - a0);
  const r = ring ? r1 : r0;
  return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, face: Math.atan2(cx - (cx + Math.cos(a) * r), cz - (cz + Math.sin(a) * r)) };
};
const cheerSlots = [];
for (let z = -7.2; z < 2.8; z += 0.75) for (let x = -6.5; x < 6.5; x += 0.75) cheerSlots.push({ x: x + (rng2() - 0.5) * 0.3, z: z + (rng2() - 0.5) * 0.3 });
cheerSlots.sort((a, b) => Math.hypot(a.x, a.z + 6) - Math.hypot(b.x, b.z + 6));
const workerSpots = [
  { x: 6.5, z: -5.6 }, { x: 8.2, z: -5.2 }, { x: 10.6, z: -5.8 }, { x: 12.4, z: -5.4 },
  { x: 7.4, z: -7.2, y: 3.4 }, { x: 11.0, z: -7.2, y: 3.4 }, { x: 9.2, z: -7.0, y: 6.6 }, { x: 12.6, z: -7.0, y: 6.6 },
];

function walkPos(p, t, speedMul = 1) {
  const travel = p.wphase + p.wspeed * speedMul * t;
  const x = -18 + (travel % 36); // kürzere Runde, damit mehr Menschen im Bild sind
  return { x: p.wdir > 0 ? x : -x, z: p.wz, rot: p.wdir > 0 ? Math.PI / 2 : -Math.PI / 2, moving: 1 };
}

// Zustand einer Person zur Zeit t
function personState(i, t) {
  const p = people[i];
  const k = roleIdx[i]; // Index unter den Frauen (undefined für Männer)
  if (t < T.schock) {
    if (!p.woman && t >= p.tv) return null;
    return { ...walkPos(p, t), y: 0 };
  }
  if (!p.woman) return null;
  if (t < T.trauer) {
    const s = walkPos(p, T.schock);
    s.x = ((((s.x + 8) % 16) + 16) % 16) - 8; // alle stehen im Bild
    return { x: s.x, z: s.z, y: 0, rot: s.rot + Math.sin(t * 0.9 + p.step) * 1.1, moving: 0 };
  }
  if (t < T.weiter) {
    if (k >= 64) return null;
    const r = ringPos(k, 64, FOUNT.x, FOUNT.z, 2.7, 3.6);
    return { x: r.x, z: r.z, y: 0, rot: r.face, moving: 0, candle: 1 };
  }
  if (t < T.bau) return k < 30 ? { ...walkPos(p, t), y: 0 } : null;
  if (t < T.nacht) {
    if (k < 8) {
      const w = workerSpots[k];
      return { x: w.x + Math.sin(t * 1.2 + k) * 0.25, z: w.z, y: w.y || 0, rot: Math.PI + Math.sin(t + k) * 0.6, moving: 0.4, helmet: 1 };
    }
    return k < 32 ? { ...walkPos(p, t), y: 0 } : null;
  }
  if (t < T.parlament) return k < 7 ? { ...walkPos(p, t, 0.8), y: 0 } : null;
  if (t < T.stadt) {
    if (k >= 130) return null;
    const s = cheerSlots[k];
    const jump = Math.max(0, Math.sin(t * 7 + p.step * 3)) * 0.28;
    return { x: s.x, z: s.z, y: jump, rot: Math.PI, moving: 0 };
  }
  if (t < T.labor) {
    if (k < 36) return { ...walkPos(p, t), y: 0 };
    if (k < 50) {
      // Kinder spielen im Sand
      const a = t * (0.9 + (k % 5) * 0.12) + k;
      const r = 1.4 + (k % 4) * 0.5;
      return { x: playground.position.x + Math.cos(a) * r, z: playground.position.z + Math.sin(a) * r, y: 0, rot: -a, moving: 2, kid: 1 };
    }
    return null;
  }
  if (t < T.kind) return k < 3 ? { ...walkPos(p, t, 0.8), y: 0 } : null;
  // Jahr 12: die zwei Mütter und eine feiernde Menge
  if (i === 0) return { x: MOM.x, z: MOM.z, y: 0, rot: 0.15, moving: 0, mom: 1 };
  if (i === 1) return { x: MOM.x + 0.75, z: MOM.z - 0.1, y: 0, rot: -0.6, moving: 0 };
  if (k >= 96) return null;
  const r = ringPos(k, 96, MOM.x, MOM.z, 3.0, 4.4, Math.PI * 1.05, Math.PI * 1.95);
  const jump = t > T.kind + 1.2 && t < T.zukunft ? Math.max(0, Math.sin(t * 6 + p.step * 3)) * 0.22 : 0;
  return { x: r.x, z: r.z, y: jump, rot: r.face, moving: 0 };
}

// ---------- Konfetti ----------
const NC = 360;
const confI = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), NC);
const conf = [];
for (let i = 0; i < NC; i++) {
  conf.push({ x: R(-9, 9), z: R(-7, 13), h: R(6, 14), sp: R(1.2, 2.2), o: R(0, 1), spin: R(2, 6) });
  confI.setColorAt(i, col(pick(["#ff5a8a", "#ffe14a", "#46d39a", "#3aa0ff", "#9a7bff", "#ff9a3a", "#ffffff"])));
}
confI.frustumCulled = false;
scene.add(confI);

// ---------- Lichtstimmungen ----------
const looks = {
  morning: { top: "#7fa5d6", bottom: "#ffd2a1", fog: "#f5cfa6", hemiSky: "#ffe9cf", hemiGround: "#6b5a4a", hemi: 1.1, sun: "#ffcf96", sunI: 2.6, sunPos: [-28, 22, 18] },
  pale: { top: "#9aa8b6", bottom: "#dde0e2", fog: "#d0d4d8", hemiSky: "#e8edf2", hemiGround: "#5a5a5a", hemi: 1.35, sun: "#eef2f6", sunI: 1.1, sunPos: [-12, 30, 12] },
  vigil: { top: "#141b3a", bottom: "#4a4f86", fog: "#2c3156", hemiSky: "#6874b0", hemiGround: "#1a1a26", hemi: 0.75, sun: "#8a90d0", sunI: 0.3, sunPos: [12, 26, -8] },
  grey: { top: "#8e9aa6", bottom: "#d3d6d8", fog: "#c9cdd0", hemiSky: "#e3e8ee", hemiGround: "#5a5a5a", hemi: 1.4, sun: "#e9edf2", sunI: 1.0, sunPos: [-10, 30, 12] },
  day: { top: "#6f9fe0", bottom: "#cfe2f5", fog: "#c8daec", hemiSky: "#ffffff", hemiGround: "#6b6656", hemi: 1.25, sun: "#fff4e0", sunI: 2.8, sunPos: [-14, 32, 16] },
  night: { top: "#16224a", bottom: "#56689e", fog: "#34406a", hemiSky: "#7486c0", hemiGround: "#1d2230", hemi: 0.85, sun: "#8090d0", sunI: 0.3, sunPos: [12, 26, -8] },
  spring: { top: "#7fb0e8", bottom: "#f4ecc8", fog: "#e2e6c8", hemiSky: "#fff8e0", hemiGround: "#5a6a3c", hemi: 1.25, sun: "#fff0c8", sunI: 2.6, sunPos: [-20, 28, 16] },
  sunrise: { top: "#6d8fd0", bottom: "#ffc48a", fog: "#f6c49a", hemiSky: "#ffe0c0", hemiGround: "#6a5040", hemi: 1.1, sun: "#ffc890", sunI: 2.4, sunPos: [-30, 12, 18] },
};
for (const k in looks) for (const pp of ["top", "bottom", "fog", "hemiSky", "hemiGround", "sun"]) looks[k][pp] = col(looks[k][pp]);
const NIGHT = { morning: 0, pale: 0, vigil: 1, grey: 0, day: 0, night: 1, spring: 0, sunrise: 0.15 };
const seq = [
  [0, "morning"], [T.schock, "pale"], [T.trauer, "vigil"], [T.weiter, "grey"], [T.bau, "day"], [T.nacht, "night"],
  [T.parlament, "day"], [T.stadt, "spring"], [T.labor, "night"], [T.kind, "sunrise"],
];
const lookKeys = [];
seq.forEach(([t0, name], i) => {
  lookKeys.push([i === 0 ? 0 : t0 + 0.35, name]);
  const next = seq[i + 1];
  lookKeys.push([next ? next[0] - 0.35 : 999, name]);
});
const tmpL = { top: new THREE.Color(), bottom: new THREE.Color(), fog: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), sun: new THREE.Color() };
function lookAt(t) {
  let i = 0;
  while (i < lookKeys.length - 2 && t >= lookKeys[i + 1][0]) i++;
  const [t0, a] = lookKeys[i], [t1, b] = lookKeys[i + 1];
  const u = a === b ? 0 : smooth(t0, t1, t);
  const A = looks[a], B = looks[b];
  for (const pp in tmpL) tmpL[pp].copy(A[pp]).lerp(B[pp], u);
  return { ...tmpL, hemi: lerp(A.hemi, B.hemi, u), sunI: lerp(A.sunI, B.sunI, u), sunPos: A.sunPos.map((v, k) => lerp(v, B.sunPos[k], u)), night: lerp(NIGHT[a], NIGHT[b], u) };
}

// ---------- Kamera ----------
const camKeys = [
  { t: 0, p: [1.6, 11.0, 24.0], l: [0.4, 5.0, -6] },
  { t: T.trauer, p: [1.0, 10.4, 22.4], l: [0.4, 4.4, -4] },
  { t: T.bau, p: [4.2, 10.4, 21.5], l: [6.0, 5.6, -6] },
  { t: T.parlament, p: [0.8, 10.6, 22.2], l: [0.4, 4.8, -6] },
  { t: T.labor, p: [1.6, 10.8, 22.6], l: [2.4, 6.4, -6] },
  { t: T.kind, p: [1.4, 9.8, 22.0], l: [0.8, 3.6, 2] },
  { t: T.end, p: [1.4, 4.4, 18.6], l: [0.9, 2.9, 11.8] },
];
const vA = new THREE.Vector3();
function cameraAt(t) {
  let i = 0;
  while (i < camKeys.length - 2 && t >= camKeys[i + 1].t) i++;
  const a = camKeys[i], b = camKeys[i + 1];
  let u = clamp01((t - a.t) / (b.t - a.t));
  u = u * u * (3 - 2 * u);
  camera.position.set(lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u), lerp(a.p[2], b.p[2], u));
  vA.set(lerp(a.l[0], b.l[0], u), lerp(a.l[1], b.l[1], u), lerp(a.l[2], b.l[2], u));
  camera.position.x += Math.sin(t * 0.7) * 0.05;
  camera.position.y += Math.sin(t * 0.53 + 1) * 0.04;
  camera.lookAt(vA);
}

// ---------- render(t) ----------
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const cTmp = new THREE.Color(), cDark = col("#151a26"), cLab = col("#7fd4ff");

function render(t) {
  const L = lookAt(t);
  skyU.top.value.copy(L.top);
  skyU.bottom.value.copy(L.bottom);
  scene.fog.color.copy(L.fog);
  hemi.color.copy(L.hemiSky);
  hemi.groundColor.copy(L.hemiGround);
  hemi.intensity = L.hemi;
  sun.color.copy(L.sun);
  sun.intensity = L.sunI;
  sun.position.set(L.sunPos[0], L.sunPos[1], L.sunPos[2]);
  sun.target.position.set(0, 0, 0);
  cameraAt(t);

  const share = L.night > 0.5 ? (inWin(t, T.labor, T.kind) ? 0.35 : 0.6) : 0;
  const winCol = (d) => {
    cTmp.copy(d.day).multiplyScalar((0.35 + 0.65 * (1 - L.night)) * (L.hemi * 0.55 + 0.25)).lerp(cDark, L.night * 0.85);
    if (d.seed < share) cTmp.lerp(d.warm, L.night);
    return cTmp;
  };
  winDefs.forEach((d, i) => winMesh.setColorAt(i, winCol(d)));
  winMesh.instanceColor.needsUpdate = true;
  skylineWins.forEach((d, i) => skyWinMesh.setColorAt(i, winCol(d)));
  skyWinMesh.instanceColor.needsUpdate = true;
  lampHeads.forEach((h) => h.material.color.set(L.night > 0.5 ? "#ffd59a" : "#3a3a3a"));
  pools.forEach((pl) => (pl.material.opacity = L.night * 0.8));

  // Rathaus-Banner, Kita, grüne Stadt
  banner.visible = inWin(t, T.parlament, T.labor);
  const kita = t >= T.lohn;
  shopSignMat.map = kita ? kitaTex : cafeTex;
  kitaPaint.visible = kita;
  kitaPaint.material.opacity = smooth(T.lohn, T.lohn + 0.6, t);
  bikeLane.visible = t >= T.stadt;
  playground.visible = t >= T.stadt;
  stalls.visible = inWin(t, T.stadt, T.labor) || t >= T.kind;
  newTrees.forEach((nt) => nt.g.scale.setScalar(Math.max(0.001, backOut(clamp01((t - nt.t) / 0.8)))));

  // Baustelle: wächst ab Woche 2, ab Jahr 1 fertiges Forschungszentrum
  const floors = t < T.bau ? 2 : t < T.nacht ? 2 + Math.floor(smooth(T.bau, T.nacht - 0.4, t) * 4.99) : 6;
  slabs.forEach((s) => (s.visible = s.userData.f < floors));
  const done = t >= T.stadt;
  scaffold.visible = !done;
  labFacade.visible = done;
  labSign.visible = done;
  labWins.forEach((w, k) => {
    w.visible = done;
    const night = L.night;
    w.material.color.copy(cLab).multiplyScalar(lerp(0.55, 1.15, night) * (inWin(t, T.labor, T.kind) ? 0.85 + 0.15 * Math.sin(t * 3 + k) : 1));
  });
  // Kran dreht sich, wenn gebaut wird
  const cu = crane.userData;
  const working = inWin(t, T.bau, T.nacht);
  const ang = working ? 0.35 + Math.sin((t - T.bau) * 0.9) * 0.5 : 0.35;
  cu.jibG.rotation.y = ang;
  const drop = working ? 8 + Math.sin((t - T.bau) * 1.7) * 4 : 8;
  cu.cable.scale.y = drop;
  cu.cable.position.y = -drop / 2;
  cu.hook.position.y = -drop;
  cu.load.position.y = -drop - 0.6;
  cu.load.visible = !done;
  crane.visible = t < T.stadt;

  // Brunnen-Fontäne
  spray.forEach((s, k) => {
    const u = (t * 0.7 + s.o) % 1;
    const r = 0.2 + u * 1.1;
    s.m.position.set(FOUNT.x + Math.cos(s.a) * r, 2.3 + Math.sin(u * Math.PI) * 0.9 - u * 1.4, FOUNT.z + Math.sin(s.a) * r);
    s.m.material.opacity = 0.8 * (1 - u);
  });

  // Autos: fahren, stehen ab dem Verschwinden still, werden an Tag 3 abgeschleppt, ab Jahr 1 wieder Verkehr
  cars.forEach((c, k) => {
    let x, vis = true;
    if (t < T.verschwinden + 0.6) x = carX(c, t);
    else if (t < T.bau) {
      x = carX(c, T.verschwinden + 0.6);
      vis = Math.abs(x) < 18 && t < c.tow;
    } else if (inWin(t, T.stadt, T.labor) || t >= T.kind) {
      x = carX(c, t);
      vis = k < 4;
    } else vis = false;
    c.g.visible = vis;
    c.g.position.set(x || 0, 0, c.z);
    c.g.rotation.y = c.dir > 0 ? 0 : Math.PI;
    // stehengebliebene Autos stehen leicht schräg
    if (t >= T.verschwinden + 0.6 && t < T.bau) c.g.rotation.y += Math.sin(k * 7) * 0.12;
  });
  bus.position.set(busX(t), 0, -3.1);
  bus.visible = t < T.bau && busX(t) < 40;

  // Menschen
  let puffCount = 0;
  people.forEach((p, i) => {
    const s = personState(i, t);
    // Lichtschimmer beim Verschwinden
    const dtv = t - p.tv;
    if (!p.woman && dtv >= 0 && dtv < 0.7) {
      const w = walkPos(p, p.tv);
      const u = dtv / 0.7;
      m4.compose(v3.set(w.x, 1.0, w.z), q.identity(), s3.set(0.4 + u * 1.2, 0.8 + u * 2.4, 0.4 + u * 1.2));
      puffI.setMatrixAt(i, m4);
      puffI.setColorAt(i, cTmp.set("#fff2c8").multiplyScalar((1 - u) * 1.2));
      puffCount++;
    } else puffI.setMatrixAt(i, hidden);
    const all = [bodyI, legI, headI, hairI, capI, skirtI, helmetI, candleI, flameI];
    if (!s) {
      for (const m of all) m.setMatrixAt(i, hidden);
      return;
    }
    const sc = p.scale * (s.kid ? 0.62 : 1);
    const rate = s.moving === 2 ? 10 : 6.5;
    const bob = s.moving ? Math.abs(Math.sin((t + p.step) * rate)) * 0.05 * s.moving : 0;
    const y0 = 0.18 + bob + (s.y || 0);
    q.setFromAxisAngle(up, s.rot);
    const fx = Math.sin(s.rot), fz = Math.cos(s.rot);
    m4.compose(v3.set(s.x, y0 + 0.72 * sc, s.z), q, s3.setScalar(sc));
    bodyI.setMatrixAt(i, m4);
    m4.compose(v3.set(s.x, y0 + 0.36 * sc, s.z), q, s3.setScalar(sc));
    legI.setMatrixAt(i, m4);
    m4.compose(v3.set(s.x, y0 + 1.42 * sc, s.z), q, s3.setScalar(sc));
    headI.setMatrixAt(i, m4);
    if (p.woman) {
      m4.compose(v3.set(s.x - fx * 0.06 * sc, y0 + 1.38 * sc, s.z - fz * 0.06 * sc), q, s3.set(sc, sc * 1.25, sc));
      hairI.setMatrixAt(i, m4);
      capI.setMatrixAt(i, hidden);
    } else {
      hairI.setMatrixAt(i, hidden);
      m4.compose(v3.set(s.x, y0 + 1.45 * sc, s.z), q, s3.setScalar(sc));
      capI.setMatrixAt(i, m4);
    }
    if (p.skirt) {
      m4.compose(v3.set(s.x, y0 + 0.52 * sc, s.z), q, s3.setScalar(sc));
      skirtI.setMatrixAt(i, m4);
    } else skirtI.setMatrixAt(i, hidden);
    if (s.helmet) {
      m4.compose(v3.set(s.x, y0 + 1.5 * sc, s.z), q, s3.setScalar(sc));
      helmetI.setMatrixAt(i, m4);
    } else helmetI.setMatrixAt(i, hidden);
    if (s.candle) {
      const cx = s.x + fx * 0.3 * sc, cz = s.z + fz * 0.3 * sc, cy = y0 + 1.0 * sc;
      m4.compose(v3.set(cx, cy, cz), q.identity(), s3.setScalar(1));
      candleI.setMatrixAt(i, m4);
      const fl = 0.9 + 0.15 * Math.sin(t * 11 + i);
      m4.compose(v3.set(cx, cy + 0.2, cz), camera.quaternion, s3.setScalar(fl));
      flameI.setMatrixAt(i, m4);
    } else {
      candleI.setMatrixAt(i, hidden);
      flameI.setMatrixAt(i, hidden);
    }
    if (s.mom) {
      baby.position.set(s.x + fx * 0.3, y0 + 1.0 * sc, s.z + fz * 0.3);
      baby.rotation.y = s.rot; // quer vor der Brust
    }
  });
  for (const m of [bodyI, legI, headI, hairI, capI, skirtI, helmetI, candleI, flameI, puffI]) m.instanceMatrix.needsUpdate = true;
  puffI.instanceColor.needsUpdate = true;
  baby.visible = t >= T.kind;

  // Konfetti (Parlament und Geburt)
  const confOn = inWin(t, T.parlament + 0.3, T.stadt) || inWin(t, T.kind + 1.2, T.end);
  const t0c = t >= T.kind ? T.kind + 1.2 : T.parlament + 0.3;
  conf.forEach((c, i) => {
    if (!confOn) return confI.setMatrixAt(i, hidden);
    const u = ((t - t0c) * c.sp / c.h + c.o) % 1;
    const y = c.h * (1 - u);
    q.setFromEuler(new THREE.Euler(t * c.spin, t * c.spin * 0.7, 0));
    const cx = t >= T.kind ? MOM.x + (c.x * 0.6) : c.x;
    const cz = t >= T.kind ? MOM.z - 2 + c.z * 0.3 : c.z;
    m4.compose(v3.set(cx + Math.sin(t * 2 + i) * 0.3, y, cz), q, s3.setScalar(1));
    confI.setMatrixAt(i, m4);
  });
  confI.instanceMatrix.needsUpdate = true;

  renderer.render(scene, camera);
}

// ---------- an HyperFrames anschließen ----------
let last = window.__weltLastSeek ?? 0;
window.addEventListener("hf-seek", (e) => {
  last = e.detail.time;
  render(last);
});
render(last);
window.__weltRender = render;
if (window.__weltReady) window.__weltReady();
