// 3D-Welt: Einkaufsstraße, an der für einen Tag alles gratis ist.
// Alles wird nur aus der Zeit t berechnet (render(t)) – HyperFrames rendert Frames einzeln.
import * as THREE from "./vendor/three.module.min.js";

// ---------- Zeitplan (Video-Sekunden) ----------
const T = {
  mitternacht: 5.5, // 00:00 – Preise fallen auf 0 €
  morgen: 8.5, // 06:00 – Schlangen
  vormittag: 11.5, // 10:00 – alle tragen Kisten raus
  mittag: 14.5, // 14:00 – ausverkauft
  abend: 17.5, // 18:00 – Stau
  nacht: 20.5, // 23:00 – leergeräumt
  ende: 23.5, // 00:00 – Preise zurück
  end: 26.5,
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
const rnd = mulberry32(20261026);
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

// ---------- Renderer, Szene, Kamera ----------
const W = 1080, H = 1920;
const canvas = document.getElementById("welt-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
// Supersampling: intern doppelte Auflösung, der Browser verkleinert – weniger Flimmern auf TikTok.
const SS = 2;
renderer.setPixelRatio(SS);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, 40, 140);
const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 400);

const skyU = { top: { value: col("#101a36") }, bottom: { value: col("#4b5d8c") } };
const sky = new THREE.Mesh(
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
        vec3 c = mix(bottom, top, h) + (hash(gl_FragCoord.xy) - 0.5) / 128.0; // Dithering gegen Streifen
        gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  }),
);
scene.add(sky);

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ---------- Materialien und Bausteine ----------
const std = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...extra });
const glow = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...extra });

function box(w, h, d, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  scene.add(m);
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
    if (opts.border) {
      g.strokeStyle = opts.border;
      g.lineWidth = opts.borderW || 10;
      g.strokeRect(6, 6, w - 12, h - 12);
    }
    g.fillStyle = fg;
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const lines = text.split("\n");
    const lh = h / (lines.length + 0.6);
    lines.forEach((l, i) => g.fillText(l, w / 2, lh * (i + 0.8) + (opts.dy || 0)));
  });
}

// ---------- Boden, Straße, Gehwege ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), std("#8d8a84"));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const asphalt = std("#4a4c52", { roughness: 0.95 });
const road = new THREE.Mesh(new THREE.PlaneGeometry(120, 8.8), asphalt);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.01, 0);
road.receiveShadow = true;
scene.add(road);
const side = new THREE.Mesh(new THREE.PlaneGeometry(5, 80), asphalt);
side.rotation.x = -Math.PI / 2;
side.position.set(9.75, 0.011, -44);
side.receiveShadow = true;
scene.add(side);
const walkMat = std("#c9c2b5");
const curbMat = std("#b9b4aa");
box(120, 0.18, 3.6, walkMat, 0, 0.09, -6.2).castShadow = false;
box(120, 0.18, 12, walkMat, 0, 0.09, 10.4).castShadow = false;
box(120, 0.22, 0.25, curbMat, 0, 0.11, -4.45).castShadow = false;
box(120, 0.22, 0.25, curbMat, 0, 0.11, 4.45).castShadow = false;
{
  const tex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#cfc8bb";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(90,80,70,0.22)";
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 6);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(120, 11.6), std("#ffffff", { map: tex }));
  p.rotation.x = -Math.PI / 2;
  p.position.set(0, 0.185, 10.6);
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

// ---------- Gebäude mit Fenstern ----------
const winDefs = [];
const ZF = -8;
function building({ x0, x1, z = ZF, depth = 10, floors, floorH = 3.1, color, groundH = 4, cornice = "#efe7d8" }) {
  const w = x1 - x0, cx = (x0 + x1) / 2, h = groundH + floors * floorH;
  box(w, h, depth, std(color), cx, h / 2, z - depth / 2);
  const cm = std(cornice);
  box(w + 0.3, 0.45, 0.5, cm, cx, h + 0.1, z + 0.05);
  for (let f = 0; f <= floors; f++) box(w + 0.05, 0.12, 0.18, cm, cx, groundH + f * floorH - 0.05, z + 0.05, false);
  const cols = Math.max(2, Math.floor(w / 2.1));
  const step = w / cols;
  for (let f = 0; f < floors; f++)
    for (let c = 0; c < cols; c++)
      winDefs.push({ x: x0 + step * (c + 0.5), y: groundH + f * floorH + floorH * 0.52, z: z + 0.02, w: Math.min(1.15, step * 0.55), h: floorH * 0.55, seed: rnd() });
  return { cx, w, h };
}
building({ x0: -26, x1: -12.5, floors: 4, color: "#9fb19a" });
building({ x0: -12.5, x1: -2.6, floors: 3, color: "#e3d6bf", cornice: "#f5efe3" });
const bElektro = building({ x0: -2.6, x1: 7.3, floors: 2, color: "#8aa0b4", cornice: "#dfe6ec" });
building({ x0: 12.2, x1: 22, floors: 4, color: "#c97b5d" });
building({ x0: 22, x1: 32, floors: 3, color: "#d7a77a" });
box(10, 10.2, 30, std("#d7a77a"), 2.3, 5.1, -23);
box(10, 16.4, 30, std("#b0563f"), 17.2, 8.2, -23);

const skylineWins = [];
for (let i = 0; i < 26; i++) {
  const x = R(-45, 45), z = R(-40, -85), w = R(5, 11), d = R(5, 11), h = R(14, 46);
  if (Math.abs(x - 9.75) < 4 && z > -60) continue;
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
{
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), std("#4b4038"), winDefs.length);
  const m4 = new THREE.Matrix4();
  winDefs.forEach((d, i) => {
    m4.compose(new THREE.Vector3(d.x, d.y, d.z - 0.01), new THREE.Quaternion(), new THREE.Vector3(d.w + 0.16, d.h + 0.16, 1));
    im.setMatrixAt(i, m4);
  });
  im.receiveShadow = true;
  scene.add(im);
}

// ---------- Bäckerei ----------
const bkX0 = -10.4, bkX1 = -4.4;
const bakeryBack = box(bkX1 - bkX0, 2.6, 0.05, glow("#ffe9c4"), (bkX0 + bkX1) / 2, 1.6, ZF + 0.03, false);
box(bkX1 - bkX0 - 0.4, 0.9, 0.7, std("#6b4a35"), (bkX0 + bkX1) / 2, 0.65, ZF + 0.45); // Theke
const breads = [];
for (let i = 0; i < 16; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), std(pick(["#c98a45", "#b8742f", "#d9a35e"])));
  m.scale.set(1.4, 0.7, 0.9);
  m.position.set(bkX0 + 0.6 + (i % 8) * 0.68, i < 8 ? 1.2 : 1.75, ZF + 0.4);
  m.userData.gone = R(T.morgen + 0.2, T.morgen + 2.4);
  scene.add(m);
  breads.push(m);
}
box(bkX1 - bkX0 - 0.4, 0.06, 0.5, std("#8a6a4a"), (bkX0 + bkX1) / 2, 1.55, ZF + 0.35, false);
const awnTex = canvasTex(256, 64, (g, w, h) => {
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? "#f4efe6" : "#b8462f";
    g.fillRect(i * 16, 0, 16, h);
  }
});
const awning = new THREE.Mesh(new THREE.BoxGeometry(bkX1 - bkX0 + 0.4, 0.08, 1.6), std("#ffffff", { map: awnTex }));
awning.position.set((bkX0 + bkX1) / 2, 3.25, ZF + 0.75);
awning.rotation.x = 0.28;
awning.castShadow = true;
scene.add(awning);
box(3.8, 0.7, 0.1, std("#ffffff", { map: textTex(320, 64, "#4a2e1c", "#f6e3c0", "Bäckerei Korn", "italic 700 40px Georgia, serif") }), (bkX0 + bkX1) / 2, 3.75, ZF + 0.08, false);
// Preisschilder im Fenster (Normalpreis, gratis, ausverkauft)
const bakeryTags = [
  textTex(256, 128, "#fff2a8", "#1a1a1a", "Brötchen\n0,45 €", "900 40px Arial", { border: "#1a1a1a", borderW: 6 }),
  textTex(256, 128, "#e8202a", "#ffffff", "GRATIS", "900 64px Arial Black, Arial", { dy: 20 }),
  textTex(256, 128, "#1a1a1a", "#ffffff", "AUS-\nVERKAUFT", "900 44px Arial Black, Arial"),
];
const bakeryTagMat = glow("#ffffff", { map: bakeryTags[0] });
const bakeryTag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), bakeryTagMat);
bakeryTag.position.set(bkX1 - 1.2, 2.3, ZF + 0.9);
scene.add(bakeryTag);

// ---------- Elektromarkt ----------
const eX0 = -1.8, eX1 = 6.6, FRONT = ZF + 1.3;
const elektroBack = box(eX1 - eX0, 3.0, 0.05, glow("#eef4ff"), (eX0 + eX1) / 2, 1.7, ZF + 0.03, false);
box(eX1 - eX0 + 0.3, 0.3, 1.4, std("#2d3a4a"), (eX0 + eX1) / 2, 3.35, ZF + 0.65);
box(eX1 - eX0, 0.05, 1.3, std("#d8d4cc"), (eX0 + eX1) / 2, 0.2, ZF + 0.65, false);
box(0.2, 3.1, 1.4, std("#2d3a4a"), eX0 - 0.05, 1.7, ZF + 0.65, false);
box(0.2, 3.1, 1.4, std("#2d3a4a"), eX1 + 0.05, 1.7, ZF + 0.65, false);
// Fernseher in Regalen
const tvs = [];
const screenCols = ["#3aa0ff", "#ff5a8a", "#46d39a", "#ffb547", "#9a7bff", "#38d0ff"];
for (let r = 0; r < 3; r++)
  for (let c = 0; c < 6; c++) {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.7, 0.08), std("#141414", { roughness: 0.4 }));
    g.add(frame);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.6), glow(pick(screenCols)));
    scr.position.z = 0.045;
    g.add(scr);
    g.position.set(eX0 + 0.75 + c * 1.38, 0.75 + r * 0.92, ZF + 0.35);
    g.userData = { gone: R(T.vormittag - 0.3, T.vormittag + 2.6), scr };
    scene.add(g);
    tvs.push(g);
  }
for (let r = 0; r < 3; r++) box(eX1 - eX0 - 0.2, 0.06, 0.6, std("#cfd6de"), (eX0 + eX1) / 2, 0.36 + r * 0.92, ZF + 0.35, false);
const glass = new THREE.Mesh(new THREE.PlaneGeometry(eX1 - eX0, 3.0), new THREE.MeshStandardMaterial({ color: "#cfe3ee", transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.3 }));
glass.position.set((eX0 + eX1) / 2, 1.7, FRONT);
scene.add(glass);
box(eX1 - eX0 + 0.3, 0.25, 0.2, std("#2d3a4a"), (eX0 + eX1) / 2, 3.25, FRONT, false);
const elektroSignMat = glow("#ffffff", { map: textTex(512, 96, "#1d4fd8", "#ffffff", "ELEKTROMARKT", "900 60px Arial Black, Arial", { dy: 4 }) });
box(6.2, 0.95, 0.15, elektroSignMat, (eX0 + eX1) / 2, 4.0, FRONT - 0.5, false);
const elektroTags = [
  textTex(256, 160, "#ffe14a", "#c8102e", "4K-TV\n899 €", "900 50px Arial Black, Arial", { border: "#c8102e", borderW: 8 }),
  textTex(256, 160, "#e8202a", "#ffffff", "0 €", "900 96px Arial Black, Arial", { dy: 22 }),
  textTex(256, 160, "#1a1a1a", "#ffffff", "AUS-\nVERKAUFT", "900 50px Arial Black, Arial"),
];
const elektroTagMat = glow("#ffffff", { map: elektroTags[0] });
const elektroTag = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.06), elektroTagMat);
elektroTag.position.set(eX0 + 1.4, 2.6, FRONT + 0.03);
scene.add(elektroTag);

// ---------- Werbetafel auf dem Dach ----------
const bbTex = [
  textTex(640, 360, "#0d1b3d", "#ffffff", "FERNSEHER\n899 €", "900 92px Arial Black, Arial"),
  textTex(640, 360, "#e8202a", "#fff36b", "ALLES\n0 €", "900 120px Arial Black, Arial"),
  textTex(640, 360, "#ffde2e", "#e8202a", "HEUTE\nGRATIS", "900 110px Arial Black, Arial"),
  textTex(640, 360, "#1a1a1a", "#ffffff", "AUS-\nVERKAUFT", "900 110px Arial Black, Arial"),
];
const bbMat = glow("#ffffff", { map: bbTex[0] });
const bbY = bElektro.h + 3.4;
const billboard = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.05), bbMat);
billboard.position.set(bElektro.cx, bbY, ZF - 1.0);
scene.add(billboard);
box(7.6, 4.45, 0.3, std("#262a30"), bElektro.cx, bbY, ZF - 1.2);
for (const dx of [-2.6, 2.6]) box(0.25, 3.2, 0.25, std("#262a30"), bElektro.cx + dx, bElektro.h + 0.4, ZF - 1.3);

// ---------- Straßenlaternen ----------
const lampHeads = [];
const pools = [];
const poolTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,200,120,0.75)");
  gr.addColorStop(1, "rgba(255,190,110,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
});
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
streetLamp(-3.2, -5.0, 1);
streetLamp(11.4, -5.0, 1);
streetLamp(-7.5, 5.0, -1);
streetLamp(5.5, 5.0, -1);

// ---------- Bäume ----------
function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.4, 8), std("#6b4a35"));
  trunk.position.y = 1.2;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = std("#5f8f4e");
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(R(0.9, 1.25), 0), leafMat);
    c.position.set(R(-0.4, 0.4), 2.7 + i * 0.45, R(-0.4, 0.4));
    c.castShadow = true;
    g.add(c);
  }
  g.position.set(x, 0.18, z);
  g.scale.setScalar(s);
  scene.add(g);
}
tree(-14.5, -5.6);
tree(8.6, -5.6, 1.05);
tree(-15, 6.0, 1.1);
tree(13, 6.2);

// ---------- Vorne: Einkaufswagen ----------
const cart = new THREE.Group();
{
  const wire = std("#b8bec6", { metalness: 0.6, roughness: 0.35, wireframe: true });
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.6, 9, 5, 6), wire);
  basket.position.y = 0.95;
  cart.add(basket);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.02, 0.58), std("#8e959e", { metalness: 0.5 }));
  bottom.position.y = 0.68;
  cart.add(bottom);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), std("#d33a2c"));
  handle.rotation.x = Math.PI / 2;
  handle.position.set(-0.55, 1.28, 0);
  cart.add(handle);
  for (const [x, z] of [[-0.38, -0.25], [-0.38, 0.25], [0.38, -0.25], [0.38, 0.25]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), std("#8e959e", { metalness: 0.5 }));
    leg.position.set(x, 0.38, z);
    cart.add(leg);
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), std("#1b1b1b"));
    wh.rotation.x = Math.PI / 2;
    wh.position.set(x, 0.07, z);
    cart.add(wh);
  }
  cart.position.set(-0.6, 0.18, 11.0);
  cart.rotation.y = 0.5;
  cart.traverse((o) => (o.castShadow = true));
  scene.add(cart);
}
// Kartons, die im Wagen landen
const cartItems = [];
[["#c49a6c", 0.36, 0.28, 0.3], ["#2f6fb5", 0.3, 0.22, 0.24], ["#d94a3d", 0.26, 0.3, 0.2], ["#c49a6c", 0.4, 0.2, 0.28], ["#f2c230", 0.2, 0.2, 0.2]].forEach(([c, w, h, d], i) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(c));
  m.position.set(-0.22 + (i % 3) * 0.22, 0.72 + h / 2 + (i > 2 ? 0.28 : 0), -0.12 + (i % 2) * 0.22);
  m.rotation.y = R(-0.3, 0.3);
  m.castShadow = true;
  m.userData.t = T.morgen + 1.0 + i * 0.35;
  cart.add(m);
  cartItems.push(m);
});

// ---------- Autos (nachts unterwegs, abends Stau) ----------
const carColors = ["#d94a3d", "#2f6fb5", "#f2c230", "#e8e4dc", "#3a3f45", "#5aa36a", "#8a4fc0", "#f08a2c", "#a7c4d6"];
const headMat = glow("#fff3cf");
const tailMat = glow("#ff2a2a");
function makeCar(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.75, 1.65), std(color, { roughness: 0.45 }));
  body.position.y = 0.65;
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 1.5), std("#2a3540", { roughness: 0.25 }));
  cab.position.set(-0.2, 1.3, 0);
  cab.castShadow = true;
  g.add(cab);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.52), std(color, { roughness: 0.45 }));
  roof.position.set(-0.2, 1.66, 0);
  g.add(roof);
  for (const wx of [-1.15, 1.15])
    for (const wz of [-0.8, 0.8]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14), std("#161616"));
      wh.rotation.x = Math.PI / 2;
      wh.position.set(wx, 0.34, wz);
      g.add(wh);
    }
  for (const wz of [-0.55, 0.55]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.34), headMat);
    hl.position.set(1.81, 0.75, wz);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.3), tailMat);
    tl.position.set(-1.81, 0.78, wz);
    g.add(tl);
  }
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.2), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(3.6, 0.03, 0);
  g.add(beam);
  g.userData.beam = beam;
  scene.add(g);
  return g;
}
const PERIOD = 80;
const nightCars = [];
for (let i = 0; i < 6; i++) {
  const lane = i % 2;
  nightCars.push({ g: makeCar(pick(carColors)), z: lane === 0 ? 1.9 : -1.15, dir: lane === 0 ? 1 : -1, speed: lane === 0 ? 8 : 7.4, phase: (Math.floor(i / 2) * PERIOD) / 3 + lane * 9 + R(-3, 3), cutoff: R(T.mitternacht - 0.3, T.mitternacht + 0.8) });
}
const jamCars = [];
for (let lane = 0; lane < 2; lane++)
  for (let k = 0; k < 9; k++) {
    jamCars.push({ g: makeCar(pick(carColors)), x0: -22 + k * 5.0 + R(-0.6, 0.6) + lane * 2.2, z: lane === 0 ? 1.9 : -1.15, dir: lane === 0 ? 1 : -1, creep: R(0.15, 0.4) });
  }

// ---------- Menschenmenge (Instanzen) ----------
const skin = ["#f1c7a5", "#d9a37e", "#a86f4c", "#6e4630", "#e8b896"];
const cloth = ["#d94a3d", "#2f6fb5", "#f2c230", "#3a3f45", "#5aa36a", "#8a4fc0", "#f08a2c", "#e8e4dc", "#1f2f4a", "#9b2f45", "#2a9d8f"];
const pants = ["#2a2f3a", "#3d4a5c", "#4a3a2e", "#1c1c1c"];
const boxCols = ["#c49a6c", "#b98a58", "#2f6fb5", "#d94a3d", "#e8e4dc"];
const N = 230;
// Warteplätze: dicht vor den Läden, später bis auf die Straße
const slots = [];
for (let z = -7.3; z < 2.6; z += 0.72)
  for (let x = -9.5; x < 8.5; x += 0.72) slots.push({ x: x + R(-0.18, 0.18), z: z + R(-0.15, 0.15) });
const door = { x: 2.4, z: -7.2 };
slots.sort((a, b) => Math.hypot(a.x - door.x, (a.z - door.z) * 1.6) - Math.hypot(b.x - door.x, (b.z - door.z) * 1.6));
function edgePoint() {
  const r = rnd();
  if (r < 0.35) return { x: -17, z: R(-6.5, 8) };
  if (r < 0.7) return { x: 17, z: R(-6.5, 8) };
  return { x: R(-6, 6), z: 16 }; // von vorne (hinter der Kamera)
}
const people = [];
for (let i = 0; i < N; i++) {
  const walker = i < 18; // nachts schon unterwegs
  const ta = walker ? T.mitternacht : lerp(T.mitternacht + 0.3, T.vormittag - 0.6, Math.pow(i / N, 0.8)) + R(-0.3, 0.3);
  const S = walker ? null : edgePoint();
  const Q = slots[i];
  // nach Hause: zum nächsten Rand
  const E = Q.z > 0.5 ? { x: Q.x * 1.5, z: 16 } : { x: Q.x < 0 ? -17 : 17, z: Q.z + R(-1, 1) };
  people.push({
    walker,
    ts: ta,
    S,
    E,
    v: R(3.2, 4.6), // laufen hin
    vOut: R(2.4, 3.2),
    slot: slots[i],
    tl: R(T.vormittag - 0.2, T.mittag + 1.0),
    carry: rnd() < 0.85,
    // nachts: einfache Spaziergänger
    wz: rnd() < 0.5 ? R(5.2, 8.2) : R(-7.4, -5.1),
    wdir: rnd() < 0.5 ? 1 : -1,
    wphase: R(0, 56),
    wspeed: R(1.1, 1.6),
    step: R(0, 6),
    scale: R(0.9, 1.05),
  });
}
const mkInst = (geo, cols) => {
  const m = new THREE.InstancedMesh(geo, std("#ffffff"), N);
  m.castShadow = true;
  m.receiveShadow = true;
  for (let i = 0; i < N; i++) m.setColorAt(i, col(pick(cols)));
  m.frustumCulled = false;
  scene.add(m);
  return m;
};
const bodyI = mkInst(new THREE.CapsuleGeometry(0.22, 0.75, 4, 10), cloth);
const legI = mkInst(new THREE.CapsuleGeometry(0.17, 0.5, 4, 8), pants);
const headI = mkInst(new THREE.SphereGeometry(0.17, 14, 10), skin);
const boxI = mkInst(new THREE.BoxGeometry(0.55, 0.42, 0.42), boxCols);

// ---------- Kartons und Müll auf dem Boden ----------
const litterBoxes = [];
for (let i = 0; i < 70; i++) {
  const w = R(0.35, 0.8), h = R(0.25, 0.55), d = R(0.3, 0.6);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(pick(["#c49a6c", "#b98a58", "#a87b4c", "#d4b083"])));
  const onRoad = rnd() < 0.45;
  m.position.set(R(-12, 12), (onRoad ? 0.01 : 0.18) + h / 2, onRoad ? R(-4, 4) : rnd() < 0.6 ? R(-7.6, -4.7) : R(4.7, 9));
  m.rotation.set(rnd() < 0.3 ? Math.PI / 2 : 0, R(0, 6), 0);
  m.castShadow = m.receiveShadow = true;
  m.userData = { t: R(T.vormittag + 0.4, T.mittag + 2.5), s: 1 };
  scene.add(m);
  litterBoxes.push(m);
}
const litter = [];
const litterMat = [std("#f2efe6"), std("#d9cfb5"), std("#c94a3a"), std("#3b82c4"), std("#ffe14a")];
for (let i = 0; i < 140; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(R(0.15, 0.4), R(0.12, 0.3)), pick(litterMat));
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = R(0, 6);
  const onRoad = rnd() < 0.5;
  m.position.set(R(-16, 16), onRoad ? 0.025 : 0.2, onRoad ? R(-4.2, 4.2) : rnd() < 0.5 ? R(-7.6, -4.6) : R(4.6, 12));
  m.userData.t = R(T.morgen + 0.5, T.nacht);
  scene.add(m);
  litter.push(m);
}

// ---------- Lichtstimmungen ----------
const looks = {
  night: { top: "#16224a", bottom: "#56689e", fog: "#34406a", hemiSky: "#7486c0", hemiGround: "#1d2230", hemi: 0.85, sun: "#8090d0", sunI: 0.3, sunPos: [12, 26, -8] },
  dawn: { top: "#6f86c4", bottom: "#ffb08a", fog: "#f0a888", hemiSky: "#ffd2b8", hemiGround: "#5a4a50", hemi: 0.95, sun: "#ffb080", sunI: 2.0, sunPos: [-30, 10, 14] },
  day: { top: "#6f9fe0", bottom: "#cfe2f5", fog: "#c8daec", hemiSky: "#ffffff", hemiGround: "#6b6656", hemi: 1.25, sun: "#fff4e0", sunI: 2.8, sunPos: [-14, 32, 16] },
  afternoon: { top: "#7da2d8", bottom: "#f3dcb4", fog: "#e9d6b6", hemiSky: "#fff0d8", hemiGround: "#6b5a4a", hemi: 1.1, sun: "#ffdcae", sunI: 2.4, sunPos: [20, 22, 16] },
  dusk: { top: "#2a2350", bottom: "#e0708a", fog: "#9a5a7a", hemiSky: "#c890b8", hemiGround: "#2a1f2a", hemi: 0.7, sun: "#ff9a80", sunI: 0.9, sunPos: [28, 8, 6] },
};
for (const k in looks) for (const p of ["top", "bottom", "fog", "hemiSky", "hemiGround", "sun"]) looks[k][p] = col(looks[k][p]);
const NIGHT = { night: 1, dawn: 0.35, day: 0, afternoon: 0, dusk: 0.6 };
const lookKeys = [
  [0, "night"], [T.morgen - 0.4, "night"], [T.morgen + 0.4, "dawn"], [T.vormittag - 0.4, "dawn"], [T.vormittag + 0.4, "day"],
  [T.mittag - 0.4, "day"], [T.mittag + 0.4, "afternoon"], [T.abend - 0.4, "afternoon"], [T.abend + 0.4, "dusk"],
  [T.nacht - 0.4, "dusk"], [T.nacht + 0.4, "night"], [99, "night"],
];
const tmpL = { top: new THREE.Color(), bottom: new THREE.Color(), fog: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), sun: new THREE.Color() };
function lookAt(t) {
  let i = 0;
  while (i < lookKeys.length - 2 && t >= lookKeys[i + 1][0]) i++;
  const [t0, a] = lookKeys[i], [t1, b] = lookKeys[i + 1];
  const u = smooth(t0, t1, t);
  const A = looks[a], B = looks[b];
  for (const p in tmpL) tmpL[p].copy(A[p]).lerp(B[p], u);
  return { ...tmpL, hemi: lerp(A.hemi, B.hemi, u), sunI: lerp(A.sunI, B.sunI, u), sunPos: A.sunPos.map((v, k) => lerp(v, B.sunPos[k], u)), night: lerp(NIGHT[a], NIGHT[b], u) };
}

// ---------- Kamera ----------
const camKeys = [
  { t: 0, p: [1.6, 10.5, 22.5], l: [-0.6, 4.6, -6] },
  { t: T.morgen, p: [1.0, 10.2, 21.0], l: [-0.6, 4.4, -6] },
  { t: T.abend, p: [0.4, 9.6, 19.4], l: [-0.8, 4.4, -6] },
  { t: T.ende, p: [0.2, 9.2, 18.6], l: [-0.6, 4.4, -6] },
  { t: T.end, p: [1.6, 5.6, 9.5], l: [1.8, 2.6, -7] },
];
const vA = new THREE.Vector3();
function cameraAt(t) {
  let i = 0;
  while (i < camKeys.length - 2 && t >= camKeys[i + 1].t) i++;
  const a = camKeys[i], b = camKeys[i + 1];
  let u = clamp01((t - a.t) / (b.t - a.t));
  if (i === camKeys.length - 2) u = u * u * (3 - 2 * u);
  camera.position.set(lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u), lerp(a.p[2], b.p[2], u));
  vA.set(lerp(a.l[0], b.l[0], u), lerp(a.l[1], b.l[1], u), lerp(a.l[2], b.l[2], u));
  camera.position.x += Math.sin(t * 0.7) * 0.05;
  camera.position.y += Math.sin(t * 0.53 + 1) * 0.04;
  camera.lookAt(vA);
}

// ---------- render(t) ----------
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const cTmp = new THREE.Color(), cDark = col("#151a26");
const hidden = new THREE.Matrix4().compose(new THREE.Vector3(0, -50, 0), new THREE.Quaternion(), new THREE.Vector3(0.0001, 0.0001, 0.0001));

function litShare(t) {
  // Anteil erleuchteter Fenster: spät abends wenige, um Mitternacht gehen überall Lichter an
  if (t < T.mitternacht) return 0.3;
  if (t < T.morgen) return lerp(0.3, 0.9, smooth(T.mitternacht, T.mitternacht + 1.2, t));
  if (t < T.nacht) return 0.75;
  if (t < T.ende) return 0.45;
  return 0.25;
}
function windowColor(d, t, L, out) {
  out.copy(d.day).multiplyScalar((0.35 + 0.65 * (1 - L.night)) * (L.hemi * 0.55 + 0.25));
  out.lerp(cDark, L.night * 0.85);
  const on = d.seed < litShare(t) ? 1 : 0;
  if (on && L.night > 0.05) out.lerp(d.warm, L.night);
  return out;
}

const lone = { x: 3.0, z: -5.9 }; // die eine Person am Ende vor dem leeren Schaufenster
function personPos(p, t, i) {
  // gibt {x, z, rot, vis, carry, moving}
  if (i === N - 1 && t >= T.ende) return { x: lone.x, z: lone.z, rot: Math.PI, vis: 1, carry: 0, moving: 0 };
  if (t >= T.abend - 0.25) return { vis: 0 }; // um 18 Uhr sind alle zu Hause
  if (p.walker && t < p.ts) {
    const travel = p.wphase + p.wspeed * t;
    const x = -28 + (travel % 56);
    return { x: p.wdir > 0 ? x : -x, z: p.wz, rot: p.wdir > 0 ? Math.PI / 2 : -Math.PI / 2, vis: 1, carry: 0, moving: 1 };
  }
  let S = p.S;
  if (p.walker) {
    const travel = p.wphase + p.wspeed * p.ts;
    const x = -28 + (travel % 56);
    S = { x: p.wdir > 0 ? x : -x, z: p.wz };
  }
  if (t < p.ts) return { vis: 0 };
  const Q = p.slot;
  const dIn = Math.hypot(Q.x - S.x, Q.z - S.z);
  const tArr = p.ts + dIn / p.v;
  const leave = Math.max(p.tl, tArr + 0.5);
  if (t < tArr) {
    const u = (t - p.ts) / (tArr - p.ts);
    return { x: lerp(S.x, Q.x, u), z: lerp(S.z, Q.z, u), rot: Math.atan2(Q.x - S.x, Q.z - S.z), vis: 1, carry: 0, moving: 2 };
  }
  if (t < leave) {
    const sway = Math.sin(t * 1.3 + p.step) * 0.06;
    return { x: Q.x + sway, z: Q.z + Math.sin(t * 0.9 + p.step * 2) * 0.04, rot: Math.atan2(door.x - Q.x, door.z - Q.z), vis: 1, carry: 0, moving: 0 };
  }
  const E = p.E;
  const dOut = Math.hypot(E.x - Q.x, E.z - Q.z);
  const tGone = leave + dOut / p.vOut;
  if (t > tGone) return { vis: 0 };
  const u = (t - leave) / (tGone - leave);
  return { x: lerp(Q.x, E.x, u), z: lerp(Q.z, E.z, u), rot: Math.atan2(E.x - Q.x, E.z - Q.z), vis: 1, carry: p.carry ? 1 : 0, moving: 1 };
}

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

  winDefs.forEach((d, i) => winMesh.setColorAt(i, windowColor(d, t, L, cTmp)));
  winMesh.instanceColor.needsUpdate = true;
  skylineWins.forEach((d, i) => skyWinMesh.setColorAt(i, windowColor(d, t, L, cTmp)));
  skyWinMesh.instanceColor.needsUpdate = true;
  lampHeads.forEach((h) => h.material.color.set(L.night > 0.5 ? "#ffd59a" : "#3a3a3a"));
  pools.forEach((p) => (p.material.opacity = L.night * 0.8));

  // Werbetafel und Preisschilder
  const free = t >= T.mitternacht && t < T.ende;
  let bb = 0;
  if (t >= T.mitternacht) bb = Math.floor(t * 1.4) % 2 === 0 ? 1 : 2; // blinkt ALLES 0 € / HEUTE GRATIS
  if (t >= T.mittag) bb = 3;
  if (t >= T.ende) bb = 0;
  // kurzes Flackern beim Umschalten
  const flick = (Math.abs(t - T.mitternacht) < 0.25 || Math.abs(t - T.ende) < 0.25) && Math.floor(t * 30) % 2 === 0;
  bbMat.map = bbTex[bb];
  bbMat.color.setScalar(flick ? 0.2 : 1);
  const tagIdx = !free ? 0 : t >= T.mittag ? 2 : 1;
  elektroTagMat.map = elektroTags[tagIdx];
  elektroTagMat.color.setScalar(flick ? 0.2 : 1);
  bakeryTagMat.map = bakeryTags[!free ? 0 : t >= T.vormittag ? 2 : 1];
  bakeryTagMat.color.setScalar(flick ? 0.2 : 1);
  const shopDim = 1 - 0.25 * L.night;
  elektroBack.material.color.set("#eef4ff").multiplyScalar(shopDim);
  bakeryBack.material.color.set("#ffe9c4").multiplyScalar(shopDim);

  // Ware verschwindet
  tvs.forEach((tv) => (tv.visible = t < tv.userData.gone));
  breads.forEach((b) => (b.visible = t < b.userData.gone));
  cartItems.forEach((m) => {
    const u = clamp01((t - m.userData.t) / 0.3);
    m.visible = u > 0;
    m.scale.setScalar(Math.max(0.001, backOut(u)));
  });

  // Autos nachts: fahren weg, wenn die Menge kommt
  nightCars.forEach((c) => {
    const dt = Math.max(0, t - c.cutoff);
    const travel = c.phase + c.speed * t + 4 * dt * dt;
    const k = Math.floor(travel / PERIOD);
    const kc = Math.floor((c.phase + c.speed * c.cutoff) / PERIOD);
    const x = -40 + (travel - k * PERIOD);
    c.g.visible = t < c.cutoff || k === kc;
    c.g.position.set(c.dir > 0 ? x : -x, 0, c.z);
    c.g.rotation.y = c.dir > 0 ? 0 : Math.PI;
    c.g.userData.beam.material.opacity = L.night * 0.7;
  });
  // Stau am Abend
  const jam = t >= T.abend - 0.2 && t < T.nacht;
  jamCars.forEach((c) => {
    c.g.visible = jam;
    if (!jam) return;
    const creep = (t - T.abend) * c.creep;
    const x = c.x0 + creep;
    c.g.position.set(c.dir > 0 ? x : -x, 0, c.z);
    c.g.rotation.y = c.dir > 0 ? 0 : Math.PI;
    c.g.userData.beam.material.opacity = Math.max(0.35, L.night) * 0.75;
  });

  // Menschen
  people.forEach((p, i) => {
    const s = personPos(p, t, i);
    if (!s.vis) {
      bodyI.setMatrixAt(i, hidden);
      legI.setMatrixAt(i, hidden);
      headI.setMatrixAt(i, hidden);
      boxI.setMatrixAt(i, hidden);
      return;
    }
    const rate = s.moving === 2 ? 11 : 6.5;
    const bob = s.moving ? Math.abs(Math.sin((t + p.step) * rate)) * (s.moving === 2 ? 0.1 : 0.05) : 0;
    const sc = p.scale;
    q.setFromAxisAngle(up, s.rot);
    const y0 = 0.18 + bob;
    const lean = s.moving === 2 ? 0.12 : 0;
    const fx = Math.sin(s.rot), fz = Math.cos(s.rot);
    m4.compose(v3.set(s.x + fx * lean * 0.4, y0 + 0.72 * sc, s.z + fz * lean * 0.4), q, s3.setScalar(sc));
    bodyI.setMatrixAt(i, m4);
    m4.compose(v3.set(s.x, y0 + 0.36 * sc, s.z), q, s3.setScalar(sc));
    legI.setMatrixAt(i, m4);
    m4.compose(v3.set(s.x + fx * lean, y0 + 1.42 * sc, s.z + fz * lean), q, s3.setScalar(sc));
    headI.setMatrixAt(i, m4);
    if (s.carry) {
      m4.compose(v3.set(s.x + fx * 0.36 * sc, y0 + 1.0 * sc, s.z + fz * 0.36 * sc), q, s3.setScalar(sc));
      boxI.setMatrixAt(i, m4);
    } else boxI.setMatrixAt(i, hidden);
  });
  for (const m of [bodyI, legI, headI, boxI]) m.instanceMatrix.needsUpdate = true;

  litterBoxes.forEach((b) => {
    const u = clamp01((t - b.userData.t) / 0.3);
    b.visible = u > 0;
    b.scale.setScalar(Math.max(0.001, backOut(u)));
  });
  litter.forEach((l) => (l.visible = t > l.userData.t));

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
