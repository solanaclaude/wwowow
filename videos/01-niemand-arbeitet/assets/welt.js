// 3D-Welt: eine Straßenkreuzung, die sich über die Zeit verändert.
// Alles, was man sieht, wird nur aus der Zeit t berechnet (render(t)),
// damit HyperFrames jeden Frame einzeln und in beliebiger Reihenfolge rendern kann.
import * as THREE from "./vendor/three.module.min.js";

// ---------- Zeitplan (Sekunden im Video) ----------
const T = {
  leaveStart: 5.4, // Menschen und Autos verschwinden
  leaveEnd: 8.0,
  tag1: 8.5, // Laden-Rollo runter, Ampel blinkt
  tag3: 11.5, // Müll
  tag7: 14.5, // Regale leer
  tag12: 17.5, // Nacht, dann Stromausfall
  blackout: 19.0,
  tag60: 20.5, // Natur wächst
  tag61: 23.5, // Abend
  heroLight: 24.4, // ein Fenster geht an
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
const rnd = mulberry32(20261025);
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
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, 40, 140);
const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 400);

// Himmel als Farbverlauf-Kugel
const skyU = { top: { value: col("#8fb3e0") }, bottom: { value: col("#ffd9a8") } };
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(300, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyU,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = smoothstep(-0.05, 0.45, vP.y); gl_FragColor = vec4(mix(bottom, top, h), 1.0);
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
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ---------- Materialien ----------
const std = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...extra });
const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });

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
  t.anisotropy = 4;
  return t;
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
// Seitenstraße nach hinten
const side = new THREE.Mesh(new THREE.PlaneGeometry(5, 80), asphalt);
side.rotation.x = -Math.PI / 2;
side.position.set(9.75, 0.011, -44);
side.receiveShadow = true;
scene.add(side);

const curbMat = std("#b9b4aa");
const walkMat = std("#c9c2b5");
box(120, 0.18, 3.6, walkMat, 0, 0.09, -6.2).castShadow = false; // hinterer Gehweg
box(120, 0.18, 12, walkMat, 0, 0.09, 10.4).castShadow = false; // vorderer Gehweg/Platz
box(120, 0.22, 0.25, curbMat, 0, 0.11, -4.45).castShadow = false;
box(120, 0.22, 0.25, curbMat, 0, 0.11, 4.45).castShadow = false;
// Gehweg-Platten-Fugen vorne
{
  const tex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#cfc8bb";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(90,80,70,0.25)";
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
// Fahrbahnmarkierungen
const markMat = basic("#e9e6dc");
for (let x = -60; x < 60; x += 4) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.14), markMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.02, 0.15);
  scene.add(m);
}
// Zebrastreifen
for (let i = 0; i < 8; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), markMat);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = Math.PI / 2;
  m.position.set(-2.4, 0.02, -3.5 + i * 1.0);
  m.rotation.set(-Math.PI / 2, 0, 0);
  m.scale.set(1, 1, 1);
  scene.add(m);
}

// ---------- Gebäude ----------
const winDefs = []; // {x,y,z,w,h,group,seed}
const facadeColors = ["#d9c3a5", "#c97b5d", "#9fb19a", "#b0563f", "#e3d6bf", "#8aa0b4", "#d7a77a"];

function building({ x0, x1, z, depth = 10, floors, floorH = 3.1, color, groundH = 4, groundShop = false, cornice = "#efe7d8" }) {
  const w = x1 - x0, cx = (x0 + x1) / 2;
  const h = groundH + floors * floorH;
  const mat = std(color);
  box(w, h, depth, mat, cx, h / 2, z - depth / 2);
  // Gesims und Etagenleisten
  const cm = std(cornice);
  box(w + 0.3, 0.45, 0.5, cm, cx, h + 0.1, z + 0.05);
  for (let f = 0; f <= floors; f++) box(w + 0.05, 0.12, 0.18, cm, cx, groundH + f * floorH - 0.05, z + 0.05, false);
  // Fenster
  const cols = Math.max(2, Math.floor(w / 2.1));
  const step = w / cols;
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      winDefs.push({
        x: x0 + step * (c + 0.5),
        y: groundH + f * floorH + floorH * 0.52,
        z: z + 0.02,
        w: Math.min(1.15, step * 0.55),
        h: floorH * 0.55,
        seed: rnd(),
      });
    }
  }
  return { cx, w, h };
}

// hintere Häuserzeile (Fassaden bei z = -8)
const ZF = -8;
building({ x0: -26, x1: -12.5, z: ZF, floors: 4, color: "#b0563f" });
const bCafe = building({ x0: -12.5, x1: -0.2, z: ZF, floors: 3, color: "#e3d6bf", cornice: "#f5efe3" });
const bMarkt = building({ x0: -0.2, x1: 7.3, z: ZF, floors: 2, color: "#c97b5d" });
building({ x0: 12.2, x1: 22, z: ZF, floors: 4, color: "#9fb19a" });
building({ x0: 22, x1: 32, z: ZF, floors: 3, color: "#d7a77a" });
// an der Seitenstraße entlang (Seitenwände)
box(10, 10.2, 30, std("#c97b5d"), 2.3, 5.1, -23);
box(10, 16.4, 30, std("#8aa0b4"), 17.2, 8.2, -23);

// Skyline im Hintergrund
const skylineWins = [];
for (let i = 0; i < 26; i++) {
  const x = R(-45, 45), z = R(-40, -85), w = R(5, 11), d = R(5, 11), h = R(14, 46);
  if (Math.abs(x - 9.75) < 4 && z > -60) continue;
  const c = col(pick(["#9aa3ad", "#a8adb3", "#8d97a3", "#b3b0a8", "#7f8c99"]));
  box(w, h, d, std(c), x, h / 2, z, false);
  for (let yy = 3; yy < h - 1; yy += 2.2)
    for (let xx = -w / 2 + 0.8; xx < w / 2 - 0.5; xx += 1.4)
      if (rnd() < 0.55) skylineWins.push({ x: x + xx, y: yy, z: z + d / 2 + 0.03, w: 0.7, h: 1.1, seed: rnd() });
}

// Fenster als Instanzen (Farbe pro Fenster wird jeden Frame berechnet)
function makeWindows(defs) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: true });
  const im = new THREE.InstancedMesh(geo, mat, defs.length);
  const m4 = new THREE.Matrix4();
  defs.forEach((d, i) => {
    m4.compose(new THREE.Vector3(d.x, d.y, d.z), new THREE.Quaternion(), new THREE.Vector3(d.w, d.h, 1));
    im.setMatrixAt(i, m4);
    im.setColorAt(i, new THREE.Color(0, 0, 0));
    d.litNight = d.seed < 0.72; // nachts an?
    d.warm = col(pick(["#ffd27a", "#ffc864", "#ffe2a6", "#ffb85c", "#fff0c8"]));
    d.day = col(pick(["#8fa6b8", "#9db0bf", "#7f95a8", "#a9b9c4", "#e8e2d4"]));
  });
  scene.add(im);
  return im;
}
// Das Fenster, das am Ende angeht (Café-Haus, 3. Stock, rechts)
const heroDef = winDefs.reduce((best, d) =>
  Math.abs(d.x - -3.6) + Math.abs(d.y - (4 + 2 * 3.1 + 1.6)) < Math.abs(best.x - -3.6) + Math.abs(best.y - (4 + 2 * 3.1 + 1.6)) ? d : best,
);
heroDef.hero = true;
heroDef.warm = col("#ffc45e");
const winMesh = makeWindows(winDefs);
const skyWinMesh = makeWindows(skylineWins);
// Fensterrahmen-Kanten (dunkle Rahmen hinter jedem Fenster)
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
// Warmes Leuchten um das Heldenfenster
const heroGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(4.5, 4.5),
  new THREE.MeshBasicMaterial({
    map: canvasTex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,210,130,0.9)");
      gr.addColorStop(1, "rgba(255,180,90,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }),
);
heroGlow.position.set(heroDef.x, heroDef.y, heroDef.z + 0.05);
scene.add(heroGlow);

// ---------- Erdgeschoss: Café ----------
const cafeX0 = -5.6, cafeX1 = -0.6;
const shopGlassMat = new THREE.MeshBasicMaterial({ color: "#fff1d6", toneMapped: false });
const cafeInterior = box(cafeX1 - cafeX0, 2.6, 0.05, shopGlassMat, (cafeX0 + cafeX1) / 2, 1.6, ZF + 0.03, false);
// Café-Tische drinnen (Silhouetten)
for (let i = 0; i < 3; i++) box(0.7, 0.9, 0.05, std("#6b4a35"), cafeX0 + 0.9 + i * 1.6, 0.75, ZF + 0.06, false);
const awningTex = canvasTex(256, 64, (g, w, h) => {
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? "#f4efe6" : "#2f6b52";
    g.fillRect(i * 16, 0, 16, h);
  }
});
const awning = new THREE.Mesh(new THREE.BoxGeometry(cafeX1 - cafeX0 + 0.4, 0.08, 1.6), std("#ffffff", { map: awningTex }));
awning.position.set((cafeX0 + cafeX1) / 2, 3.25, ZF + 0.75);
awning.rotation.x = 0.28;
awning.castShadow = true;
scene.add(awning);
const cafeSignTex = canvasTex(256, 64, (g, w, h) => {
  g.fillStyle = "#1f3b2f";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#f6edd8";
  g.font = "italic 700 40px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("Café Morgen", w / 2, h / 2 + 2);
});
box(3.4, 0.7, 0.1, std("#ffffff", { map: cafeSignTex }), (cafeX0 + cafeX1) / 2, 3.75, ZF + 0.08, false);
// Rollladen (fährt an Tag 1 herunter)
const shutterTex = canvasTex(64, 256, (g, w, h) => {
  g.fillStyle = "#9a9ea3";
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 8) {
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.fillRect(0, y, w, 2);
  }
});
shutterTex.wrapS = shutterTex.wrapT = THREE.RepeatWrapping;
shutterTex.repeat.set(1, 3);
const shutter = new THREE.Mesh(new THREE.PlaneGeometry(cafeX1 - cafeX0 + 0.1, 2.9), std("#ffffff", { map: shutterTex }));
shutter.geometry.translate(0, -1.45, 0); // oben verankert
shutter.position.set((cafeX0 + cafeX1) / 2, 3.0, ZF + 0.12);
scene.add(shutter);
// Graffiti auf dem Rollladen (erscheint später)
const graffiti = new THREE.Mesh(
  new THREE.PlaneGeometry(4.0, 0.96),
  new THREE.MeshBasicMaterial({
    transparent: true,
    map: canvasTex(400, 96, (g, w, h) => {
      g.font = "900 46px Impact, Arial Black, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 8;
      g.strokeStyle = "#1b1b1b";
      g.strokeText("GESCHLOSSEN", w / 2, h / 2);
      g.fillStyle = "#e0463a";
      g.fillText("GESCHLOSSEN", w / 2, h / 2);
    }),
  }),
);
graffiti.position.set((cafeX0 + cafeX1) / 2, 1.5, ZF + 0.14);
scene.add(graffiti);

// ---------- Erdgeschoss: Supermarkt ----------
const mX0 = 0.4, mX1 = 7.0;
const FRONT = ZF + 1.3; // Glasfront des Ladens (Anbau vor der Fassade)
const marketBack = box(mX1 - mX0, 3.0, 0.05, new THREE.MeshBasicMaterial({ color: "#fff8e6", toneMapped: false }), (mX0 + mX1) / 2, 1.7, ZF + 0.03, false);
box(mX1 - mX0 + 0.3, 0.3, 1.4, std("#3a3a3a"), (mX0 + mX1) / 2, 3.35, ZF + 0.65); // Dach des Anbaus
box(mX1 - mX0, 0.05, 1.3, std("#d8d4cc"), (mX0 + mX1) / 2, 0.2, ZF + 0.65, false);
// Regale mit Produkten
const shelfMat = std("#e9e6e0");
const products = [];
for (let r = 0; r < 3; r++) {
  const sx = mX0 + 1.0 + r * 2.2;
  box(1.5, 2.1, 0.4, shelfMat, sx, 1.25, ZF + 0.3, false);
  for (let lvl = 0; lvl < 4; lvl++)
    for (let k = 0; k < 6; k++)
      products.push({ x: sx - 0.62 + k * 0.25, y: 0.55 + lvl * 0.5, z: ZF + 0.6, gone: R(T.tag7 - 0.6, T.tag7 + 2.6), c: pick(["#e04f3c", "#f2c230", "#3b82c4", "#57a85a", "#f08a2c", "#ffffff", "#8a4fc0"]) });
}
const prodMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.32, 0.2), std("#ffffff"), products.length);
products.forEach((p, i) => prodMesh.setColorAt(i, col(p.c)));
scene.add(prodMesh);
// Glasfront (leicht spiegelnd)
const glass = new THREE.Mesh(new THREE.PlaneGeometry(mX1 - mX0, 3.0), new THREE.MeshStandardMaterial({ color: "#cfe3ee", transparent: true, opacity: 0.18, roughness: 0.1, metalness: 0.3 }));
glass.position.set((mX0 + mX1) / 2, 1.7, FRONT);
scene.add(glass);
// Rahmen um die Glasfront
box(mX1 - mX0 + 0.3, 0.25, 0.2, std("#3a3a3a"), (mX0 + mX1) / 2, 3.25, FRONT, false);
box(0.2, 3.1, 1.4, std("#3a3a3a"), mX0 - 0.05, 1.7, ZF + 0.65, false);
box(0.2, 3.1, 1.4, std("#3a3a3a"), mX1 + 0.05, 1.7, ZF + 0.65, false);
// Leuchtschild
const marketSignMat = new THREE.MeshBasicMaterial({
  toneMapped: false,
  map: canvasTex(512, 96, (g, w, h) => {
    g.fillStyle = "#c8202a";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    g.font = "900 64px Arial Black, Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("SUPERMARKT", w / 2, h / 2 + 3);
  }),
});
box(5.4, 0.95, 0.15, marketSignMat, (mX0 + mX1) / 2, 4.0, FRONT - 0.5, false);

// ---------- Bushaltestelle und Bus ----------
const stopX = -9.2;
box(3.2, 0.08, 1.4, std("#3c4a57"), stopX, 2.6, -6.6); // Dach
box(0.08, 2.5, 1.4, std("#cfe3ee", { transparent: true, opacity: 0.35 }), stopX - 1.55, 1.35, -6.6, false);
box(3.1, 1.2, 0.05, std("#cfe3ee", { transparent: true, opacity: 0.3 }), stopX, 1.6, -7.25, false);
box(0.12, 2.8, 0.12, std("#2b2b2b"), stopX + 2.0, 1.4, -4.9);
const busSign = box(0.6, 0.6, 0.06, basic("#f3c400"), stopX + 2.0, 2.7, -4.88, false);
{
  const t = canvasTex(64, 64, (g) => {
    g.fillStyle = "#f3c400";
    g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
    g.fillStyle = "#1a7a3a";
    g.font = "900 40px Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("H", 32, 34);
  });
  busSign.material = new THREE.MeshBasicMaterial({ map: t, transparent: true });
}
// Bus (steht die ganze Zeit an der Haltestelle)
const bus = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(8.5, 2.7, 2.4), std("#f2c230", { roughness: 0.6 }));
  body.position.y = 1.75;
  body.castShadow = body.receiveShadow = true;
  bus.add(body);
  const win = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.95, 2.42), std("#23313d", { roughness: 0.3 }));
  win.position.set(0.2, 2.25, 0);
  bus.add(win);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.52, 0.2, 2.42), std("#2a6fb0"));
  stripe.position.y = 1.35;
  bus.add(stripe);
  for (const wx of [-2.9, 2.9])
    for (const wz of [-1.2, 1.2]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), std("#1b1b1b"));
      wh.rotation.x = Math.PI / 2;
      wh.position.set(wx, 0.5, wz);
      bus.add(wh);
    }
}
bus.position.set(stopX - 1.5, 0, -3.15);
scene.add(bus);

// ---------- Ampel ----------
function trafficLight(x, z, rotY) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), std("#2b2b2b"));
  pole.position.y = 1.6;
  pole.castShadow = true;
  g.add(pole);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.0, 0.3), std("#1f1f1f"));
  housing.position.set(0, 3.4, 0);
  housing.castShadow = true;
  g.add(housing);
  const lamps = ["#ff3b30", "#ffb000", "#30d158"].map((c, i) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    m.position.set(0, 3.72 - i * 0.32, 0.16);
    g.add(m);
    return m;
  });
  g.position.set(x, 0.18, z);
  g.rotation.y = rotY;
  scene.add(g);
  return lamps;
}
const lightsA = trafficLight(-4.0, 4.9, 0);
const lightsB = trafficLight(-0.9, -4.9, 0);
const lampCols = { r: col("#ff3b30"), y: col("#ffb000"), g: col("#30d158"), off: col("#262626") };

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
  const pole = box(0.12, 5.2, 0.12, std("#2f3439"), x, 2.6, z);
  const arm = box(0.08, 0.08, 1.1, std("#2f3439"), x, 5.15, z + dir * 0.5);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.7), new THREE.MeshBasicMaterial({ color: "#3a3a3a", toneMapped: false }));
  head.position.set(x, 5.05, z + dir * 1.0);
  scene.add(head);
  lampHeads.push(head);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(x, 0.22, z + dir * 1.3);
  scene.add(pool);
  pools.push(pool);
}
streetLamp(-14, -5.0, 1);
streetLamp(-1.7, -5.0, 1);
streetLamp(11.4, -5.0, 1);
streetLamp(-7.5, 5.0, -1);
streetLamp(5.5, 5.0, -1);

// ---------- Bäume ----------
const trees = [];
function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.4, 8), std("#6b4a35"));
  trunk.position.y = 1.2;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = std("#5f8f4e");
  const crowns = [];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(R(0.9, 1.25), 0), leafMat);
    c.position.set(R(-0.4, 0.4), 2.7 + i * 0.45, R(-0.4, 0.4));
    c.castShadow = true;
    g.add(c);
    crowns.push(c);
  }
  // Baumscheibe
  const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 16), std("#5a4636"));
  pit.position.y = 0.19;
  g.add(pit);
  g.position.set(x, 0.18, z);
  g.scale.setScalar(s);
  scene.add(g);
  trees.push({ g, leafMat, s });
}
tree(-12.2, -5.6);
tree(8.2, -5.6, 1.05);
tree(-15, 6.0, 1.1);
tree(13, 6.2);

// ---------- Vorne: Tisch mit Kaffeebecher ----------
const fg = new THREE.Group();
{
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 32), std("#2c2f33", { roughness: 0.5 }));
  top.position.y = 1.02;
  top.castShadow = top.receiveShadow = true;
  fg.add(top);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 12), std("#2c2f33"));
  pole.position.y = 0.5;
  pole.castShadow = true;
  fg.add(pole);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24), std("#2c2f33"));
  foot.position.y = 0.2;
  fg.add(foot);
}
const cup = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.2, 24), std("#f4f1ea", { roughness: 0.4 }));
  body.position.y = 0.1;
  body.castShadow = true;
  cup.add(body);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.07, 0.08, 24), std("#a5714b"));
  sleeve.position.y = 0.09;
  cup.add(sleeve);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 24), std("#ffffff"));
  lid.position.y = 0.21;
  cup.add(lid);
  cup.position.set(0.12, 1.045, 0.05);
}
fg.add(cup);
// Dampf
const steam = [];
const steamMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.0, depthWrite: false });
for (let i = 0; i < 7; i++) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), steamMat.clone());
  fg.add(s);
  steam.push({ m: s, o: i / 7, sx: R(-0.03, 0.03) });
}
// Pflanze, die später aus dem Becher wächst
const sprout = new THREE.Group();
{
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.22, 6), std("#3f7a36"));
  stem.position.y = 0.11;
  sprout.add(stem);
  for (const [a, y] of [[0.6, 0.16], [-2.4, 0.2], [1.8, 0.23]]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6), std("#5aa84a"));
    leaf.scale.set(1, 0.25, 0.55);
    leaf.position.set(Math.cos(a) * 0.045, y, Math.sin(a) * 0.045);
    leaf.rotation.y = -a;
    sprout.add(leaf);
  }
  sprout.position.set(0.12, 1.27, 0.05);
}
fg.add(sprout);
// zweiter Stuhl
{
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 20), std("#2c2f33"));
  seat.position.set(-0.85, 0.62, 0.35);
  seat.castShadow = true;
  fg.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.04), std("#2c2f33"));
  back.position.set(-1.05, 0.88, 0.45);
  back.rotation.y = 0.9;
  back.castShadow = true;
  fg.add(back);
}
fg.position.set(-0.4, 0.18, 11.0);
scene.add(fg);
// Blätter, die mit der Zeit auf den Tisch fallen
const tableLeaves = [];
for (let i = 0; i < 9; i++) {
  const l = new THREE.Mesh(new THREE.CircleGeometry(0.05, 6), std(pick(["#b5822f", "#9a5b2a", "#c9a14a"])));
  l.rotation.x = -Math.PI / 2;
  l.rotation.z = R(0, 6);
  l.position.set(R(-0.45, 0.45), 1.05, R(-0.4, 0.4));
  l.scale.set(1, 0.6, 1);
  l.userData.t = R(T.tag3, T.tag60 + 1.5);
  fg.add(l);
  tableLeaves.push(l);
}

// ---------- Autos ----------
const carColors = ["#d94a3d", "#2f6fb5", "#f2c230", "#e8e4dc", "#3a3f45", "#5aa36a", "#8a4fc0", "#f08a2c", "#a7c4d6"];
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
  scene.add(g);
  return g;
}
const PERIOD = 80; // Strecke x von -40 bis 40
const cars = [];
for (let i = 0; i < 12; i++) {
  const lane = i % 2; // 0: vorne nach rechts, 1: hinten nach links
  cars.push({
    g: makeCar(pick(carColors)),
    lane,
    z: lane === 0 ? 1.9 : -1.15,
    dir: lane === 0 ? 1 : -1,
    speed: lane === 0 ? 7.6 : 7.0, // gleiche Geschwindigkeit pro Spur, damit sich niemand überholt
    phase: (Math.floor(i / 2) * PERIOD) / 6 + lane * 6 + R(-2.5, 2.5),
    cutoff: R(T.leaveStart, T.leaveEnd - 0.6),
  });
}
// zwei geparkte Autos (bleiben und verwittern)
const parked = [makeCar("#d94a3d"), makeCar("#a7c4d6")];
parked[0].position.set(6.0, 0, 3.4);
parked[1].position.set(-14.5, 0, 3.4);
parked[1].rotation.y = Math.PI;
const parkedBodies = parked.map((g) => g.children[0].material);
const parkedBase = parkedBodies.map((m) => m.color.clone());

// ---------- Menschen ----------
const skin = ["#f1c7a5", "#d9a37e", "#a86f4c", "#6e4630", "#e8b896"];
const cloth = ["#d94a3d", "#2f6fb5", "#f2c230", "#3a3f45", "#5aa36a", "#8a4fc0", "#f08a2c", "#e8e4dc", "#1f2f4a", "#9b2f45"];
const people = [];
const WALK = 56;
for (let i = 0; i < 46; i++) {
  const g = new THREE.Group();
  const s = R(0.9, 1.05);
  const bodyM = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.75, 4, 10), std(pick(cloth)));
  bodyM.position.y = 0.72;
  bodyM.castShadow = true;
  g.add(bodyM);
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 4, 8), std(pick(["#2a2f3a", "#3d4a5c", "#4a3a2e", "#1c1c1c"])));
  legs.position.y = 0.36;
  legs.castShadow = true;
  g.add(legs);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), std(pick(skin)));
  head.position.y = 1.42;
  head.castShadow = true;
  g.add(head);
  if (rnd() < 0.5) {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(pick(["#2b1d14", "#5a3b22", "#c99a5b", "#1a1a1a"])));
    hair.position.y = 1.45;
    g.add(hair);
  }
  if (rnd() < 0.35) {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.12), std(pick(["#3a2a1e", "#202020", "#7a5a3a"])));
    bag.position.set(0, 0.85, -0.25);
    g.add(bag);
  }
  g.scale.setScalar(s);
  scene.add(g);
  const near = i % 2 === 0;
  people.push({
    g,
    s,
    z: near ? R(5.2, 8.2) : R(-7.4, -5.1),
    dir: rnd() < 0.5 ? 1 : -1,
    speed: R(1.1, 1.7),
    phase: R(0, WALK),
    step: R(0, 6),
    cutoff: R(T.leaveStart - 0.3, T.leaveEnd - 0.4),
  });
}

// ---------- Müll ----------
const bags = [];
const bagMats = ["#1d1f22", "#2b2f2a", "#3a3d38", "#1f2a1f", "#4a4f55"].map((c) => std(c, { roughness: 0.35 }));
function bagAt(x, z, t) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), pick(bagMats));
  b.scale.set(1, 0.85, 0.9);
  b.position.y = 0.36;
  b.castShadow = b.receiveShadow = true;
  g.add(b);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 8), b.material);
  knot.position.y = 0.78;
  g.add(knot);
  g.position.set(x, 0.18, z);
  g.rotation.y = R(0, 6);
  g.userData = { t, s: R(0.8, 1.25) };
  scene.add(g);
  bags.push(g);
}
// Müllhaufen an Laternen, Bäumen und Bordsteinen
const heaps = [[-1.2, -5.2], [3.5, -5.4], [-6.2, -5.3], [9.5, -5.5], [-3.5, 5.3], [2.2, 5.4], [-9.5, 5.3], [8.8, 5.4], [-0.4, 9.0]];
heaps.forEach(([hx, hz], k) => {
  const n = 4 + Math.floor(rnd() * 5);
  for (let j = 0; j < n; j++) {
    const t = T.tag3 + 0.15 + (k * 0.11 + j * 0.42) + rnd() * 1.2;
    bagAt(hx + R(-0.9, 0.9), hz + R(-0.45, 0.45), t);
  }
});
// Papier/Abfall auf dem Boden
const litter = [];
const litterMat = [std("#f2efe6"), std("#d9cfb5"), std("#c94a3a"), std("#3b82c4")];
for (let i = 0; i < 120; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(R(0.15, 0.35), R(0.12, 0.28)), pick(litterMat));
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = R(0, 6);
  const onRoad = rnd() < 0.5;
  m.position.set(R(-18, 18), onRoad ? 0.025 : 0.2, onRoad ? R(-4.2, 4.2) : rnd() < 0.5 ? R(-7.6, -4.6) : R(4.6, 12));
  m.userData.t = R(T.tag3, T.tag12 + 1);
  scene.add(m);
  litter.push(m);
}

// ---------- Natur (Tag 60) ----------
const grassDefs = [];
for (let i = 0; i < 700; i++) {
  const zone = rnd();
  let x = R(-20, 20), z;
  if (zone < 0.25) z = pick([-4.3, 4.3]) + R(-0.25, 0.25); // Bordstein-Ritzen
  else if (zone < 0.45) z = R(-4.2, 4.2); // Straße
  else if (zone < 0.7) z = R(-7.8, -4.6);
  else z = R(4.6, 13);
  grassDefs.push({ x, z, y: Math.abs(z) < 4.4 ? 0.02 : 0.19, s: R(0.5, 1.1), t: R(T.tag60 - 0.2, T.tag60 + 1.6), r: R(0, 6) });
}
const grassMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.2, 0.32, 5), std("#6e9b45"), grassDefs.length);
grassMesh.castShadow = false;
grassMesh.receiveShadow = true;
grassDefs.forEach((g, i) => grassMesh.setColorAt(i, col(pick(["#7fae4f", "#8fbf55", "#6ea044", "#9cc862"]))));
scene.add(grassMesh);
// Büsche
const bushDefs = [];
for (let i = 0; i < 70; i++)
  bushDefs.push({ x: R(-20, 20), z: rnd() < 0.5 ? R(-7.8, -4.7) : pick([R(4.7, 6), R(8, 14)]), s: R(0.4, 0.95), t: R(T.tag60, T.tag60 + 1.8) });
const bushMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), std("#4f7d3a"), bushDefs.length);
bushMesh.castShadow = true;
bushDefs.forEach((b, i) => bushMesh.setColorAt(i, col(pick(["#4f7d3a", "#5f8f45", "#426b30"]))));
scene.add(bushMesh);
// Efeu an den Fassaden
const ivyDefs = [];
for (let r = 0; r < 26; r++) {
  const x0 = R(-22, 26);
  if (x0 > 7.0 && x0 < 12.5) continue;
  const height = R(3, 11);
  for (let y = 0.4; y < height; y += R(0.3, 0.5)) {
    const x = x0 + Math.sin(y * 0.9 + r) * 0.6 + R(-0.35, 0.35);
    // jede Ranke wächst von unten nach oben
    ivyDefs.push({ x, y, z: ZF + 0.18, s: R(0.75, 1.25) * (1 - (y / height) * 0.35), t: T.tag60 + 0.1 + (y / 11) * 1.8 + R(0, 0.3) });
  }
}
const ivyMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8), std("#6aa047", { roughness: 0.9 }), ivyDefs.length);
ivyDefs.forEach((v, i) => ivyMesh.setColorAt(i, col(pick(["#5d8f3e", "#6aa047", "#4f8236", "#7ab04f"]))));
scene.add(ivyMesh);

// ---------- Lichtstimmungen ----------
const looks = {
  morning: { top: "#7fa5d6", bottom: "#ffd2a1", fog: "#f5cfa6", hemiSky: "#ffe9cf", hemiGround: "#6b5a4a", hemi: 1.1, sun: "#ffcf96", sunI: 2.6, sunPos: [-28, 22, 18], exposure: 1.0 },
  overcast: { top: "#8e9aa6", bottom: "#d3d6d8", fog: "#c9cdd0", hemiSky: "#e3e8ee", hemiGround: "#5a5a5a", hemi: 1.45, sun: "#e9edf2", sunI: 0.9, sunPos: [-10, 30, 12], exposure: 0.95 },
  night: { top: "#16132e", bottom: "#6a3f72", fog: "#3d2b4f", hemiSky: "#6a64a8", hemiGround: "#1f1a2a", hemi: 0.55, sun: "#9a8ad0", sunI: 0.25, sunPos: [10, 30, -10], exposure: 1.0 },
  blackout: { top: "#0c0b1c", bottom: "#3a2a4e", fog: "#231a33", hemiSky: "#4d4a80", hemiGround: "#141018", hemi: 0.42, sun: "#8a86c8", sunI: 0.35, sunPos: [10, 30, -10], exposure: 1.0 },
  wild: { top: "#9fb2aa", bottom: "#e6e6d2", fog: "#d5d8c4", hemiSky: "#f1f2df", hemiGround: "#4f5a3c", hemi: 1.25, sun: "#fff0d0", sunI: 1.8, sunPos: [-22, 26, 14], exposure: 1.0 },
  dusk: { top: "#18264a", bottom: "#6878a6", fog: "#3d4a70", hemiSky: "#7486c0", hemiGround: "#1d2230", hemi: 0.75, sun: "#7d8fd0", sunI: 0.3, sunPos: [12, 26, -8], exposure: 1.0 },
};
for (const k in looks) {
  const L = looks[k];
  for (const p of ["top", "bottom", "fog", "hemiSky", "hemiGround", "sun"]) L[p] = col(L[p]);
}
const lookKeys = [
  [0, "morning"],
  [T.tag1 - 0.35, "morning"],
  [T.tag1 + 0.35, "overcast"],
  [T.tag12 - 0.4, "overcast"],
  [T.tag12 + 0.4, "night"],
  [T.blackout + 0.2, "night"],
  [T.blackout + 1.2, "blackout"],
  [T.tag60 - 0.35, "blackout"],
  [T.tag60 + 0.35, "wild"],
  [T.tag61 - 0.4, "wild"],
  [T.tag61 + 0.4, "dusk"],
  [99, "dusk"],
];
const tmpL = { top: new THREE.Color(), bottom: new THREE.Color(), fog: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), sun: new THREE.Color() };
function lookAt(t) {
  let i = 0;
  while (i < lookKeys.length - 2 && t >= lookKeys[i + 1][0]) i++;
  const [t0, a] = lookKeys[i], [t1, b] = lookKeys[i + 1];
  const u = smooth(t0, t1, t);
  const A = looks[a], B = looks[b];
  for (const p in tmpL) tmpL[p].copy(A[p]).lerp(B[p], u);
  return {
    ...tmpL,
    hemi: lerp(A.hemi, B.hemi, u),
    sunI: lerp(A.sunI, B.sunI, u),
    sunPos: A.sunPos.map((v, k) => lerp(v, B.sunPos[k], u)),
    exposure: lerp(A.exposure, B.exposure, u),
    night: clamp01(lerp(a === "night" || a === "blackout" || a === "dusk" ? 1 : 0, b === "night" || b === "blackout" || b === "dusk" ? 1 : 0, u)),
  };
}

// ---------- Kamera-Fahrt ----------
const camKeys = [
  { t: 0, p: [1.6, 10.5, 22.5], l: [-0.6, 4.6, -6] },
  { t: T.tag1, p: [1.0, 9.8, 20.6], l: [-0.8, 4.3, -6] },
  { t: T.tag12, p: [0.4, 9.4, 19.4], l: [-1.0, 4.3, -6] },
  { t: T.tag61, p: [-0.4, 9.2, 18.6], l: [-1.6, 4.6, -6] },
  { t: T.end, p: [-2.4, 9.6, 13.5], l: [-3.4, 8.6, -8] },
];
const vA = new THREE.Vector3(), vB = new THREE.Vector3();
function cameraAt(t) {
  let i = 0;
  while (i < camKeys.length - 2 && t >= camKeys[i + 1].t) i++;
  const a = camKeys[i], b = camKeys[i + 1];
  let u = clamp01((t - a.t) / (b.t - a.t));
  // weiche, gleichmäßige Fahrt; die letzte Etappe beschleunigt sanft
  u = i === camKeys.length - 2 ? u * u * (3 - 2 * u) : u;
  camera.position.set(lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u), lerp(a.p[2], b.p[2], u));
  vA.set(lerp(a.l[0], b.l[0], u), lerp(a.l[1], b.l[1], u), lerp(a.l[2], b.l[2], u));
  // leichtes Handkamera-Atmen
  camera.position.x += Math.sin(t * 0.7) * 0.05;
  camera.position.y += Math.sin(t * 0.53 + 1) * 0.04;
  camera.lookAt(vA);
}

// ---------- render(t) ----------
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
const cTmp = new THREE.Color(), cDark = col("#151a26"), cDirty = col("#6f7a74");
const up = new THREE.Vector3(0, 1, 0);

function windowColor(d, t, L, out) {
  // Tag: Glas, Nacht: dunkel oder warm erleuchtet
  const dayLight = 0.35 + 0.65 * (1 - L.night);
  out.copy(d.day).multiplyScalar(dayLight * (L.hemi * 0.55 + 0.25));
  if (t > T.tag60 - 0.35) out.lerp(cDirty, 0.5 * smooth(T.tag60 - 0.35, T.tag60 + 0.35, t)).multiplyScalar(1 - 0.75 * L.night);
  else out.lerp(cDark, L.night * 0.85);
  let lit = 0;
  if (d.litNight && t > T.tag12 - 0.6 && t < T.tag60) {
    const on = smooth(T.tag12 - 0.6 + d.seed * 0.6, T.tag12 + d.seed * 0.8, t);
    const offAt = T.blackout + clamp01((d.x + 40) / 85) * 1.1 + d.seed * 0.25;
    let off = t > offAt ? 0 : 1;
    if (t > offAt - 0.15 && t <= offAt) off = Math.floor(t * 40) % 2; // kurzes Flackern
    lit = on * off;
  }
  if (d.hero && t > T.heroLight) {
    const u = t - T.heroLight;
    lit = u < 0.35 ? (Math.floor(u * 30) % 3 === 0 ? 0.25 : 1) * smooth(0, 0.35, u) : 1;
  }
  if (lit > 0) out.lerp(d.warm, lit);
  return out;
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
  renderer.toneMappingExposure = L.exposure;
  cameraAt(t);

  const powerOn = t < T.blackout + 0.6 || t >= T.tag60 ? 1 : 0;
  const nightLamps = L.night * (t < T.blackout + 0.4 ? 1 : 0);

  // Fenster
  winDefs.forEach((d, i) => winMesh.setColorAt(i, windowColor(d, t, L, cTmp)));
  winMesh.instanceColor.needsUpdate = true;
  skylineWins.forEach((d, i) => skyWinMesh.setColorAt(i, windowColor(d, t, L, cTmp)));
  skyWinMesh.instanceColor.needsUpdate = true;
  const heroU = t > T.heroLight ? smooth(T.heroLight + 0.1, T.heroLight + 0.6, t) : 0;
  heroGlow.material.opacity = heroU * 0.6;
  heroGlow.visible = heroU > 0;

  // Läden
  const shopLight = t < T.blackout + 0.5 ? 1 - 0.35 * L.night : 0.06;
  shopGlassMat.color.set("#fff1d6").multiplyScalar(Math.max(0.08, shopLight * (t < T.tag1 ? 1 : 0.5)));
  const shutterU = smooth(T.tag1 + 0.05, T.tag1 + 0.8, t);
  shutter.scale.y = Math.max(0.001, shutterU);
  shutter.visible = shutterU > 0.001;
  graffiti.visible = t > T.tag7 + 0.4;
  graffiti.material.opacity = smooth(T.tag7 + 0.4, T.tag7 + 1.2, t);
  let marketLight = t < T.blackout + 0.45 ? 1 : 0;
  if (t > T.blackout + 0.15 && t < T.blackout + 0.45) marketLight = Math.floor(t * 25) % 2;
  marketBack.material.color.set("#fff8e6").multiplyScalar(lerp(0.07, 1, marketLight) * (t > T.tag7 ? 0.85 : 1));
  marketSignMat.color.setScalar(lerp(0.18, 1, marketLight) * (t >= T.tag60 ? 0.6 : 1));
  products.forEach((p, i) => {
    const vis = t < p.gone ? 1 : 0;
    m4.compose(v3.set(p.x, p.y, p.z), q.identity(), s3.setScalar(vis ? 1 : 0.0001));
    prodMesh.setMatrixAt(i, m4);
  });
  prodMesh.instanceMatrix.needsUpdate = true;

  // Ampel: normal, dann Gelb blinkend, dann aus
  for (const set of [lightsA, lightsB]) {
    let state;
    if (t < T.tag1) state = Math.floor(t / 3.5) % 2 === 0 ? (set === lightsA ? "g" : "r") : set === lightsA ? "r" : "g";
    else if (powerOn && t < T.tag60) state = Math.floor(t * 1.6) % 2 === 0 ? "y" : "off";
    else state = "off";
    set[0].material.color.copy(state === "r" ? lampCols.r : lampCols.off);
    set[1].material.color.copy(state === "y" ? lampCols.y : lampCols.off);
    set[2].material.color.copy(state === "g" ? lampCols.g : lampCols.off);
  }

  // Laternen
  lampHeads.forEach((h, i) => {
    h.material.color.set(nightLamps > 0.5 ? "#ffd59a" : "#3a3a3a");
  });
  pools.forEach((p) => (p.material.opacity = nightLamps * 0.8));

  // Dampf über dem Becher
  const steamOn = 1 - smooth(T.tag1 - 1.5, T.tag1 - 0.2, t);
  steam.forEach((s, i) => {
    const u = (t * 0.45 + s.o) % 1;
    s.m.position.set(0.12 + s.sx + Math.sin(u * 6 + i) * 0.03, 1.28 + u * 0.55, 0.05);
    s.m.scale.setScalar(0.6 + u * 1.6);
    s.m.material.opacity = steamOn * 0.35 * Math.sin(u * Math.PI);
    s.m.visible = steamOn > 0.01;
  });
  const sp = smooth(T.tag60 + 0.2, T.tag60 + 1.6, t);
  sprout.scale.setScalar(Math.max(0.001, sp));
  sprout.visible = sp > 0.001;
  tableLeaves.forEach((l) => (l.visible = t > l.userData.t));

  // Autos
  cars.forEach((c) => {
    // nach seiner Uhrzeit gibt das Auto Gas, fährt aus dem Bild und kommt nicht wieder
    const dt = Math.max(0, t - c.cutoff);
    const travel = c.phase + c.speed * t + 4 * dt * dt;
    const k = Math.floor(travel / PERIOD);
    const kc = Math.floor((c.phase + c.speed * c.cutoff) / PERIOD);
    const x = -40 + (travel - k * PERIOD);
    c.g.visible = t < c.cutoff || k === kc;
    c.g.position.set(c.dir > 0 ? x : -x, 0, c.z);
    c.g.rotation.y = c.dir > 0 ? 0 : Math.PI;
  });
  // geparkte Autos verstauben und verwildern
  const age = smooth(T.tag3, T.tag60 + 1, t);
  parkedBodies.forEach((m, i) => m.color.copy(parkedBase[i]).lerp(col("#8a8a7a"), age * 0.55));

  // Menschen
  people.forEach((p) => {
    const travel = p.phase + p.speed * t;
    const k = Math.floor(travel / WALK);
    const gone = smooth(p.cutoff, p.cutoff + 0.3, t);
    p.g.visible = gone < 1;
    p.g.scale.setScalar(p.s * (1 - gone));
    const x = -28 + (travel - k * WALK);
    const wx = p.dir > 0 ? x : -x;
    const bob = Math.abs(Math.sin((t + p.step) * 6.5)) * 0.05;
    p.g.position.set(wx, 0.18 + bob, p.z);
    p.g.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    p.g.rotation.z = Math.sin((t + p.step) * 6.5) * 0.04;
  });

  // Müll
  bags.forEach((b) => {
    const u = clamp01((t - b.userData.t) / 0.35);
    b.visible = u > 0;
    b.scale.setScalar(Math.max(0.001, backOut(u) * b.userData.s));
  });
  litter.forEach((l) => (l.visible = t > l.userData.t));

  // Natur
  grassDefs.forEach((g, i) => {
    const u = smooth(g.t, g.t + 0.9, t);
    m4.compose(v3.set(g.x, g.y + 0.08 * g.s * u, g.z), q.setFromAxisAngle(up, g.r), s3.set(g.s * u + 1e-4, 0.55 * g.s * u + 1e-4, g.s * u + 1e-4));
    grassMesh.setMatrixAt(i, m4);
  });
  grassMesh.instanceMatrix.needsUpdate = true;
  bushDefs.forEach((b, i) => {
    const u = smooth(b.t, b.t + 1.0, t) * b.s;
    m4.compose(v3.set(b.x, 0.18 + u * 0.55, b.z), q.identity(), s3.set(u + 1e-4, u * 0.8 + 1e-4, u + 1e-4));
    bushMesh.setMatrixAt(i, m4);
  });
  bushMesh.instanceMatrix.needsUpdate = true;
  ivyDefs.forEach((v, i) => {
    const u = smooth(v.t, v.t + 1.0, t) * v.s;
    m4.compose(v3.set(v.x, v.y, v.z), q.identity(), s3.set(u + 1e-4, u + 1e-4, 0.35 * u + 1e-4));
    ivyMesh.setMatrixAt(i, m4);
  });
  ivyMesh.instanceMatrix.needsUpdate = true;
  const grow = smooth(T.tag60, T.tag60 + 1.6, t);
  trees.forEach((tr) => {
    tr.g.scale.setScalar(tr.s * (1 + 0.45 * grow));
    tr.leafMat.color.set("#5f8f4e").lerp(col("#3f7a2e"), grow);
  });

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
