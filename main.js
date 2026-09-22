// ============================================================
// 中國象棋 3D —— Three.js 呈現 + 互動
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  ROWS, COLS, RED, BLACK,
  initialBoard, legalMoves, applyMove, inCheck,
  hasAnyLegalMove, name, notation, hashBoard, repetitionVerdict,
  toFEN, loadFEN,
} from './game.js?v=b511c30f1f';
import { LANG_HANT, LANG_HANS, I18N } from './i18n.js?v=b511c30f1f';
import {
  generateCommentary,
  getGuidance,
  speakCommentary,
  isVoiceEnabled,
  setVoiceEnabled,
  formatScore,
  waitUntilSpeechFinished,
  cancelSpeech,
  isSpeaking,
} from './commentary.js?v=b511c30f1f';

function loadLangPref() {
  try {
    const saved = localStorage.getItem('xiangqi.lang');
    if (saved === LANG_HANT || saved === LANG_HANS) return saved;
    if (navigator.language && (navigator.language.startsWith('zh-TW') || navigator.language.startsWith('zh-HK') || navigator.language.startsWith('zh-Hant'))) {
      return LANG_HANT;
    }
  } catch {}
  return LANG_HANS; // 默認語言為簡體中文
}
let currentLang = loadLangPref();
const t = (k) => (I18N[currentLang] || I18N[LANG_HANS])[k] ?? k;

// ---------------- 常數 ----------------
const CELL = 1;
const PAD = 0.6;
const BOARD_W = (COLS - 1) * CELL + PAD * 2;
const BOARD_H = (ROWS - 1) * CELL + PAD * 2;
const PIECE_H = 0.36;
const Y0 = PIECE_H / 2; // 棋子中心高度（貼著盤面）

const to3D = (r, c) =>
  new THREE.Vector3((c - (COLS - 1) / 2) * CELL, 0, ((ROWS - 1) / 2 - r) * CELL);

// ---------------- 场景 / 相机 / 渲染 ----------------
const container = document.getElementById('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171310);
scene.fog = new THREE.Fog(0x171310, 20, 46);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

// 預設機位：以注視點為圓心，向左旋轉 90°（方位角 -90°）、向下翻轉 45°（極角 45°）
const HOME_DIST = 14.8;
const HOME_AZIMUTH = -90;
const HOME_POLAR = 45;
const HOME_TGT = new THREE.Vector3(0, -0.1, 0.2);
const HOME = {
  tgt: HOME_TGT,
  pos: new THREE.Vector3()
    .setFromSphericalCoords(
      HOME_DIST,
      THREE.MathUtils.degToRad(HOME_POLAR),
      THREE.MathUtils.degToRad(HOME_AZIMUTH),
    )
    .add(HOME_TGT),
};
camera.position.copy(HOME.pos);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.tgt);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 22;
controls.minPolarAngle = 0.25;
controls.maxPolarAngle = 1.38;
controls.enablePan = false;
controls.update();

// ---------------- 灯光 ----------------
scene.add(new THREE.HemisphereLight(0xfff1dd, 0x241b12, 0.85));
const sun = new THREE.DirectionalLight(0xffe7c2, 1.9);
sun.position.set(6, 12, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
sun.shadow.camera.near = 2; sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0006;
scene.add(sun);
const rim = new THREE.DirectionalLight(0x8fb7ff, 0.25);
rim.position.set(-8, 4, -6);
scene.add(rim);

// ---------------- 棋盘 ----------------
function makeBoardTexture(lang = currentLang) {
  const cell = 100, pad = 60;
  const W = (COLS - 1) * cell + pad * 2, H = (ROWS - 1) * cell + pad * 2;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  // 木紋底
  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#e0b884');
  grd.addColorStop(0.5, '#d5a971');
  grd.addColorStop(1, '#c99c64');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) {
    g.strokeStyle = `rgba(118,78,38,${0.03 + Math.random() * 0.05})`;
    g.lineWidth = 0.6 + Math.random() * 2.2;
    const y = Math.random() * H;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(W * 0.3, y + (Math.random() * 16 - 8), W * 0.65, y + (Math.random() * 16 - 8), W, y + (Math.random() * 10 - 5));
    g.stroke();
  }

  const P = (r, c) => ({ x: pad + c * cell, y: pad + r * cell });
  const line = (a, b) => { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };

  // 外框
  g.strokeStyle = '#4a3320';
  g.lineWidth = 5;
  g.strokeRect(pad * 0.42, pad * 0.42, W - pad * 0.84, H - pad * 0.84);
  g.lineWidth = 3;
  g.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

  // 橫線
  for (let r = 0; r < ROWS; r++) line(P(r, 0), P(r, COLS - 1));
  // 縱線（中間被楚河漢界斷開，兩邊界線貫穿）
  for (let c = 0; c < COLS; c++) {
    if (c === 0 || c === COLS - 1) line(P(0, c), P(ROWS - 1, c));
    else { line(P(0, c), P(4, c)); line(P(5, c), P(9, c)); }
  }
  // 九宮斜線
  line(P(0, 3), P(2, 5)); line(P(0, 5), P(2, 3));
  line(P(7, 3), P(9, 5)); line(P(7, 5), P(9, 3));

  // 星位（炮位、兵位）
  g.lineWidth = 2.5;
  const star = (r, c) => {
    const p = P(r, c), d = 12, o = 8;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x0 = p.x + sx * o, y0 = p.y + sy * o;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + sx * d, y0); g.stroke();
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0, y0 + sy * d); g.stroke();
    }
  };
  for (const [r, c] of [
    [2, 1], [2, 7], [7, 1], [7, 7],
    [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
    [6, 0], [6, 2], [6, 4], [6, 6], [6, 8],
  ]) star(r, c);

  // 楚河 / 漢界 —— 直書：字沿河界縱向排列，且在預設視角下正立
  // （貼圖相對於畫面旋轉了 90°：畫面上方 = 貼圖 +x，故字需旋轉 90° 並沿 x 排列）
  g.fillStyle = 'rgba(74,51,32,0.8)';
  g.font = '56px "Kaiti SC","STKaiti","KaiTi","Noto Serif TC",serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const ry = (4 + 5) / 2 * cell + pad;
  const vChar = (ch, x) => {
    g.save();
    g.translate(x, ry);
    g.rotate(Math.PI / 2);
    g.fillText(ch, 0, 3);
    g.restore();
  };
  const dict = I18N[lang] || I18N[LANG_HANT];
  vChar(dict.riverChu, 264); vChar(dict.riverHe, 196);          // 畫面下方直書「楚河」
  vChar(dict.riverHan, W - 196); vChar(dict.riverJie, W - 264);  // 畫面上方直書「漢界」或「汉界」

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const boardMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD_W, BOARD_H),
  new THREE.MeshStandardMaterial({ map: makeBoardTexture(), roughness: 0.72, metalness: 0.02 })
);
boardMesh.rotation.x = -Math.PI / 2;
boardMesh.receiveShadow = true;
scene.add(boardMesh);

// 盤底座
const slab = new THREE.Mesh(
  new THREE.BoxGeometry(BOARD_W + 0.55, 0.34, BOARD_H + 0.55),
  new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.55, metalness: 0.12 })
);
slab.position.y = -0.18;
slab.castShadow = true;
slab.receiveShadow = true;
scene.add(slab);

// 地面
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(30, 48),
  new THREE.MeshStandardMaterial({ color: 0x141009, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.45;
ground.receiveShadow = true;
scene.add(ground);

// ---------------- 棋子 ----------------
let sideMat = null, botMat = null;
function sharedPieceMats() {
  if (sideMat) return;
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#cf9f66');
  grd.addColorStop(0.55, '#c2914f');
  grd.addColorStop(1, '#a97a42');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(90,58,26,0.25)';
  for (let i = 0; i < 7; i++) {
    g.lineWidth = 1 + Math.random() * 2;
    const y = Math.random() * 128;
    g.beginPath(); g.moveTo(0, y); g.lineTo(128, y + (Math.random() * 8 - 4)); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  sideMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05 });
  botMat = new THREE.MeshStandardMaterial({ color: 0x6b5133, roughness: 0.9 });
}
sharedPieceMats();

const PIECE_GEO = new THREE.CylinderGeometry(0.4, 0.46, PIECE_H, 48);

function makeTopTexture(side, type, lang = currentLang) {
  const s = 256;
  const cv = document.createElement('canvas');
  cv.width = s; cv.height = s;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2 - 22, 12, s / 2, s / 2, s / 2);
  grd.addColorStop(0, '#eed6a8');
  grd.addColorStop(0.72, '#dcb27a');
  grd.addColorStop(1, '#c08f52');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(118,78,38,0.16)';
  for (let i = 0; i < 6; i++) {
    g.lineWidth = 0.8 + Math.random() * 1.4;
    g.beginPath();
    g.arc(s / 2, s / 2, 26 + i * 13 + Math.random() * 5, 0, Math.PI * 2);
    g.stroke();
  }
  const col = side === RED ? 'rgba(173,42,32,0.96)' : 'rgba(36,33,29,0.96)';
  g.strokeStyle = col;
  g.lineWidth = 9;
  g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 15, 0, Math.PI * 2); g.stroke();
  g.fillStyle = col;
  g.font = '900 118px "Kaiti SC","STKaiti","KaiTi","Noto Serif TC",serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // 所有棋子字樣均正向繪製，旋轉棋盤時由 3D 旋轉實時對齊相機，始終朝向自己
  g.fillText(name(side, type, lang), s / 2, s / 2 + 8);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const topMatCache = new Map();
function getTopMaterial(side, type, lang = currentLang) {
  const key = `${lang}_${side}_${type}`;
  let mat = topMatCache.get(key);
  if (!mat) {
    const tex = makeTopTexture(side, type, lang);
    mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.05 });
    topMatCache.set(key, mat);
  }
  return mat;
}

function makePiece(piece, r, c) {
  const m = new THREE.Mesh(
    PIECE_GEO,
    [
      sideMat,
      getTopMaterial(piece.side, piece.type, currentLang),
      botMat,
    ]
  );
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData = { piece, r, c };
  const p = to3D(r, c);
  m.position.set(p.x, Y0, p.z);
  m.rotation.y = Math.atan2(camera.position.z - controls.target.z, controls.target.x - camera.position.x);
  return m;
}

// ---------------- 高亮 ----------------
const selRing = new THREE.Mesh(
  new THREE.RingGeometry(0.5, 0.64, 48),
  new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
);
selRing.rotation.x = -Math.PI / 2;
selRing.visible = false;
scene.add(selRing);

// AI 大師指導提示標記 (Hint Markers)
const hintFromRing = new THREE.Mesh(
  new THREE.RingGeometry(0.46, 0.62, 48),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })
);
hintFromRing.rotation.x = -Math.PI / 2;
hintFromRing.position.y = 0.022;
hintFromRing.renderOrder = 6;
hintFromRing.visible = false;
scene.add(hintFromRing);

const hintToRing = new THREE.Mesh(
  new THREE.RingGeometry(0.2, 0.58, 48),
  new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
);
hintToRing.rotation.x = -Math.PI / 2;
hintToRing.position.y = 0.022;
hintToRing.renderOrder = 6;
hintToRing.visible = false;
scene.add(hintToRing);

function showHintMarkers(from, to) {
  const p1 = to3D(from.r, from.c);
  const p2 = to3D(to.r, to.c);
  hintFromRing.position.set(p1.x, 0.022, p1.z);
  hintToRing.position.set(p2.x, 0.022, p2.z);
  hintFromRing.visible = true;
  hintToRing.visible = true;
}

function hideHintMarkers() {
  hintFromRing.visible = false;
  hintToRing.visible = false;
}

// 最後一步標記（起點淡、終點深）
function mkLastMark(opacity) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.92),
    new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.renderOrder = 3;
  m.visible = false;
  scene.add(m);
  return m;
}
const lastFromMark = mkLastMark(0.13);
const lastToMark = mkLastMark(0.26);
function syncLastMoveMark() {
  const h = history[history.length - 1];
  lastFromMark.visible = lastToMark.visible = !!h;
  if (!h) return;
  const a = to3D(h.from.r, h.from.c);
  const b = to3D(h.to.r, h.to.c);
  lastFromMark.position.set(a.x, 0.012, a.z);
  lastToMark.position.set(b.x, 0.012, b.z);
}

const fx = new THREE.Group();
scene.add(fx);
function clearFX() {
  for (const c of [...fx.children]) {
    fx.remove(c);
    c.geometry.dispose();
    c.material.dispose();
  }
}
function addFX(mesh) {
  mesh.renderOrder = 5;
  mesh.position.y = 0.02;
  fx.add(mesh);
}
function showMoveDots(moves) {
  clearFX();
  for (const m of moves) {
    const p = to3D(m.r, m.c);
    if (board[m.r][m.c]) {
      // 可吃敵子：紅圈包圍
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.64, 48),
        new THREE.MeshBasicMaterial({ color: 0xe2736a, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      addFX(ring);
      ring.position.x = p.x; ring.position.z = p.z;
    } else {
      // 可走空位：綠點
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.28, 32),
        new THREE.MeshBasicMaterial({ color: 0x9fd68f, transparent: true, opacity: 0.85 })
      );
      dot.rotation.x = -Math.PI / 2;
      addFX(dot);
      dot.position.x = p.x; dot.position.z = p.z;
    }
  }
  showSelectRingAt(selected);
}

// ---------------- 声音 ----------------
let audio = null, muted = false;
function beep(freq, dur = 0.08, type = 'sine', gain = 0.12) {
  if (muted) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(audio.destination);
    const t = audio.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur);
  } catch { /* 無音訊環境則忽略 */ }
}
const sfx = {
  select: () => beep(680, 0.05, 'triangle'),
  move: () => beep(420, 0.08, 'sine'),
  capture: () => { beep(210, 0.14, 'square', 0.1); setTimeout(() => beep(330, 0.1, 'sine'), 60); },
  check: () => { beep(660, 0.1); setTimeout(() => beep(880, 0.16), 90); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'triangle', 0.12), i * 110)); },
  lose: () => { [392, 311, 262].forEach((f, i) => setTimeout(() => beep(f, 0.2, 'sine', 0.09), i * 170)); },
};

// ---------------- tween ----------------
const tweens = [];
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function tween(dur, fn, done, delay = 0, tag = null) {
  tweens.push({ t0: performance.now() + delay, dur, fn, done, tag });
}
// 分頁隱藏時 rAF 會暫停；用計時器低頻補跑主迴圈，避免棋局卡在動畫中
setInterval(() => { if (document.hidden) tick(performance.now()); }, 500);

function stepTweens(now) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (now < tw.t0) continue;
    let k = (now - tw.t0) / tw.dur;
    if (k > 1) k = 1;
    tw.fn(ease(k));
    if (k === 1) {
      tweens.splice(i, 1);
      if (tw.done) tw.done();
    }
  }
}

// ---------------- 遊戲状态 ----------------
let board = null;
let turn = RED;
let selected = null;   // {r,c}
let legal = [];        // 選中子的合法著法
let pieces = [];       // 所有棋子 mesh
let history = [];      // {from,to,captured,nota}
let posHistory = [];   // 每步之後的局面雜湊，供 AI 避免重複局面
let repHistory = [];   // {key,mover,check}：三次重複局面／長將判決用
let capturedBy = { [RED]: [], [BLACK]: [] };
let over = false, winner = null, busy = false;
let gameStartTime = Date.now();
let undoCount = 0;     // 本局悔棋次數（人機模式一次連退兩著仍計 1 次）

// ---------------- 對弈模式 / AI ----------------
let mode = 'medium';   // 'pvp' | 'easy' | 'medium' | 'hard'
const AI_SIDE = BLACK; // 人機模式：玩家執紅，AI 執黑
const isAI = () => mode !== 'pvp';
let aiThinking = false;
let aiToken = 0;       // 用於作廢過期的 AI 計算（開新局、悔棋後）
let aiMoveStart = 0;

let aiWorker = null;
let aiModule = null;   // Worker 不可用時的主執行緒後備
try {
  aiWorker = new Worker(new URL('./ai-worker.js?v=b511c30f1f', import.meta.url), { type: 'module' });
  aiWorker.onmessage = (e) => onAIResult(e.data);
  aiWorker.onerror = () => {
    aiWorker = null;
    if (aiThinking) requestAIMove();
  };
} catch {
  aiWorker = null;
}

function requestAIMove() {
  const token = ++aiToken;
  const payload = {
    board: board.map((row) => row.map((p) => (p ? { ...p } : null))),
    side: turn,
    level: mode,
    recent: posHistory.slice(-16),
    token,
  };
  if (aiWorker) {
    aiWorker.postMessage(payload);
  } else {
    (aiModule ??= import('./ai.js?v=b511c30f1f')).then(({ findBestMove }) => {
      setTimeout(() => {
        if (token !== aiToken) return;
        onAIResult({ token, result: findBestMove(payload.board, payload.side, payload.level, payload.recent) });
      }, 30);
    });
  }
}

function maybeAIMove() {
  if (!isAI() || over || busy || turn !== AI_SIDE || aiThinking) return;
  aiThinking = true;
  aiMoveStart = performance.now();
  requestAIMove();
  refreshHUD();
}

function onAIResult({ token, result, error }) {
  if (token !== aiToken) return;
  if (error || !result) { aiThinking = false; refreshHUD(); return; }

  const executeAIMove = () => {
    if (token !== aiToken) return;
    aiThinking = false;
    if (over || busy || turn !== AI_SIDE) { refreshHUD(); return; }
    const { from, to } = result;
    const p = board[from.r] && board[from.r][from.c];
    const ok = p && p.side === turn &&
      legalMoves(board, from.r, from.c).some((m) => m.r === to.r && m.c === to.c);
    if (!ok) { refreshHUD(); return; }
    doMove(from, to);
  };

  // 至少顯示一小段「思考中」，節奏比較自然
  const wait = Math.max(0, 500 - (performance.now() - aiMoveStart));
  setTimeout(async () => {
    if (token !== aiToken) return;
    if (isVoiceEnabled()) {
      // 若開啟語音解說：等待玩家走法語音完全播報完畢，避免 AI 瞬間落子打斷語音
      await waitUntilSpeechFinished();
      if (token !== aiToken) return;
      // 語音結束後留白 350ms，讓棋評聽完後再看見 AI 從容落子
      setTimeout(executeAIMove, 350);
    } else {
      executeAIMove();
    }
  }, wait);
}

// 除錯／自動測試掛鉤
window.__chess = {
  get pieces() { return pieces; },
  get board() { return board; },
  get turn() { return turn; },
  get selected() { return selected; },
  get history() { return history; },
  get busy() { return busy; },
  get mode() { return mode; },
  get aiThinking() { return aiThinking; },
  setMode(m) { mode = m; const el = document.getElementById('modeSel'); if (el) el.value = m; },
  get lastResult() { return lastResult; },
  buildShareCard: (r) => buildShareCard(r || lastResult),
  resetTo,
  newGame,
  undo,
  doMove,
  camera, renderer, scene, controls,
  get currentLang() { return currentLang; },
  setLanguage,
  updateUIStrings,
};

const turnText = document.getElementById('turnText');
const turnDot = document.getElementById('turnDot');
const turnBox = document.getElementById('turn');
const logEl = document.getElementById('log');
const logEmpty = document.getElementById('logEmpty');
const capRedEl = document.getElementById('capRed');
const capBlackEl = document.getElementById('capBlack');
const banner = document.getElementById('checkBanner');
const overlay = document.getElementById('overlay');
const btnUndo = document.getElementById('btnUndo');

const tabCommBtn = document.getElementById('tabCommBtn');
const tabLogBtn = document.getElementById('tabLogBtn');
const panelComm = document.getElementById('panelComm');
const panelLog = document.getElementById('panelLog');
const commEvalBadge = document.getElementById('commEvalBadge');
const btnVoiceRight = document.getElementById('btnVoiceRight');
const btnVoice = document.getElementById('btnVoice');
const commFeed = document.getElementById('commFeed');
const commEmpty = document.getElementById('commEmpty');
const btnMobileComm = document.getElementById('btnMobileComm');

const btnHint = document.getElementById('btnHint');
const hintModal = document.getElementById('hintModal');
const btnHintClose = document.getElementById('btnHintClose');
const btnHintDismiss = document.getElementById('btnHintDismiss');
const btnHintPlay = document.getElementById('btnHintPlay');
const hintLoading = document.getElementById('hintLoading');
const hintLoadingTitle = document.getElementById('hintLoadingTitle');
const hintLoadingSub = document.getElementById('hintLoadingSub');
const hintBody = document.getElementById('hintBody');
const hintActions = document.getElementById('hintActions');
const hintMoveText = document.getElementById('hintMoveText');
const hintTacticTitle = document.getElementById('hintTacticTitle');
const hintRationale = document.getElementById('hintRationale');
const hintScoreText = document.getElementById('hintScoreText');

let moveLogs = []; // { side, textHant, textHans }
let commentaryLogs = []; // { moveNum, side, notaHant, notaHans, titleHant, titleHans, commHant, commHans, tag, scoreTextHant, scoreTextHans }

function addCommentaryEntry(entry) {
  commentaryLogs.push(entry);
  if (commentaryLogs.length > 200) commentaryLogs.shift();
  rebuildCommentary();
  const isHans = currentLang === LANG_HANS;
  speakCommentary(isHans ? entry.commHans : entry.commHant, currentLang);
}

function rebuildCommentary() {
  if (!commFeed) return;
  const cards = commFeed.querySelectorAll('.comm-card');
  cards.forEach((c) => c.remove());
  if (!commentaryLogs.length) {
    if (commEmpty) {
      commEmpty.style.display = '';
      commEmpty.textContent = t('commEmpty');
      if (!commEmpty.parentNode) commFeed.appendChild(commEmpty);
    }
    if (commEvalBadge) {
      commEvalBadge.textContent = currentLang === LANG_HANS ? '势均力敌' : '勢均力敵';
    }
    return;
  }
  if (commEmpty) commEmpty.style.display = 'none';
  const isHans = currentLang === LANG_HANS;
  for (const item of commentaryLogs) {
    const card = document.createElement('div');
    card.className = 'comm-card';

    const head = document.createElement('div');
    head.className = 'comm-card-head';

    const meta = document.createElement('div');
    meta.className = 'comm-card-meta';

    const num = document.createElement('span');
    num.className = 'comm-card-num';
    num.textContent = `#${item.moveNum}`;

    const sideBadge = document.createElement('span');
    sideBadge.className = 'side ' + item.side;
    sideBadge.textContent = item.side === RED ? t('sideRed') : t('sideBlack');

    const nota = document.createElement('b');
    nota.textContent = isHans ? item.notaHans : item.notaHant;

    meta.appendChild(num);
    meta.appendChild(sideBadge);
    meta.appendChild(nota);

    const tag = document.createElement('span');
    tag.className = 'comm-card-tag tag-' + (item.tag || 'TACTIC');
    tag.textContent = isHans ? item.titleHans : item.titleHant;

    head.appendChild(meta);
    head.appendChild(tag);

    const body = document.createElement('div');
    body.className = 'comm-card-body';
    body.textContent = isHans ? item.commHans : item.commHant;

    card.appendChild(head);
    card.appendChild(body);
    commFeed.appendChild(card);
  }

  const last = commentaryLogs[commentaryLogs.length - 1];
  if (last && commEvalBadge) {
    commEvalBadge.textContent = isHans ? last.scoreTextHans : last.scoreTextHant;
  }
  commFeed.scrollTop = commFeed.scrollHeight;
}

function switchRightTab(tab) {
  if (!tabCommBtn || !tabLogBtn) return;
  if (tab === 'comm') {
    tabCommBtn.classList.add('active');
    tabLogBtn.classList.remove('active');
    panelComm?.classList.add('active');
    panelLog?.classList.remove('active');
  } else {
    tabCommBtn.classList.remove('active');
    tabLogBtn.classList.add('active');
    panelComm?.classList.remove('active');
    panelLog?.classList.add('active');
  }
}
tabCommBtn?.addEventListener('click', () => switchRightTab('comm'));
tabLogBtn?.addEventListener('click', () => switchRightTab('log'));

function toggleVoice() {
  setVoiceEnabled(!isVoiceEnabled());
  const on = isVoiceEnabled();
  btnVoiceRight?.classList.toggle('on', on);
  if (btnVoiceRight) btnVoiceRight.textContent = (on ? '🔊 ' : '🔇 ') + t(on ? 'voiceOn' : 'voiceOff');
  if (btnVoice) btnVoice.textContent = t(on ? 'voiceOn' : 'voiceOff');
  showToast(on ? (currentLang === LANG_HANS ? '语音解说：已开启 🔊' : '語音解說：已開啟 🔊') : (currentLang === LANG_HANS ? '语音解说：已关闭 🔇' : '語音解說：已關閉 🔇'));
}
btnVoiceRight?.addEventListener('click', toggleVoice);
btnVoice?.addEventListener('click', () => { toggleVoice(); closeHudMenu(); });

btnMobileComm?.addEventListener('click', () => {
  const rightEl = document.getElementById('right');
  rightEl?.classList.toggle('show-comm');
  closeHudMenu();
});

let currentHint = null;
function openHint() {
  if (over) {
    showToast(t('hintGameOver'));
    return;
  }
  if (busy || aiThinking) {
    showToast(t('hintWaitingAI'));
    return;
  }
  if (isAI() && turn === AI_SIDE) {
    showToast(t('hintWaitingAI'));
    return;
  }
  if (btnHint?.classList.contains('calculating')) return;

  // 1. 立即進入推演計算狀態，按鈕展示呼吸效果，彈窗展示旋轉光環動畫
  btnHint?.classList.add('calculating');
  const origBtnText = btnHint ? btnHint.textContent : '';
  if (btnHint) btnHint.textContent = t('hintCalculating');

  if (hintLoadingTitle) hintLoadingTitle.textContent = t('hintLoadingTitle');
  if (hintLoadingSub) hintLoadingSub.textContent = t('hintLoadingSub');

  if (hintLoading) hintLoading.classList.remove('hidden');
  if (hintBody) hintBody.classList.add('hidden');
  if (hintActions) hintActions.classList.add('hidden');
  if (hintModal) hintModal.classList.remove('hidden');

  // 2. 透過微延遲讓瀏覽器先繪製彈窗旋轉動畫，再調用引擎深度推演
  setTimeout(() => {
    try {
      const hint = getGuidance(board, turn, currentLang, history, posHistory);
      btnHint?.classList.remove('calculating');
      if (btnHint) btnHint.textContent = origBtnText;

      if (!hint) {
        closeHint();
        showToast(t('hintNoMove'));
        return;
      }

      currentHint = hint;
      if (hintMoveText) hintMoveText.textContent = hint.nota;
      if (hintTacticTitle) hintTacticTitle.textContent = hint.title;
      if (hintRationale) hintRationale.textContent = hint.rationale;
      if (hintScoreText) hintScoreText.textContent = hint.scoreText;

      if (hintLoading) hintLoading.classList.add('hidden');
      if (hintBody) hintBody.classList.remove('hidden');
      if (hintActions) hintActions.classList.remove('hidden');

      showHintMarkers(hint.from, hint.to);
    } catch (err) {
      console.error('Hint calculation failed:', err);
      btnHint?.classList.remove('calculating');
      if (btnHint) btnHint.textContent = origBtnText;
      closeHint();
      showToast(t('hintNoMove'));
    }
  }, 60);
}

function closeHint() {
  btnHint?.classList.remove('calculating');
  const btnHintEl = document.getElementById('btnHint');
  if (btnHintEl) btnHintEl.textContent = t('hintBtn');
  if (hintModal) hintModal.classList.add('hidden');
  hideHintMarkers();
}

btnHint?.addEventListener('click', openHint);
btnHintClose?.addEventListener('click', closeHint);
btnHintDismiss?.addEventListener('click', closeHint);
hintModal?.addEventListener('click', (e) => {
  if (e.target === hintModal) closeHint();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && hintModal && !hintModal.classList.contains('hidden')) closeHint();
});
btnHintPlay?.addEventListener('click', () => {
  const h = currentHint;
  closeHint();
  if (h) {
    const { from, to } = h;
    currentHint = null;
    doMove(from, to);
  }
});

function refreshHUD() {
  const showSide = over && winner ? winner : turn;
  const isRed = showSide === RED;
  if (over) {
    turnText.textContent = winner == null ? t('turnDraw') : winner === RED ? t('turnRedWin') : t('turnBlackWin');
  } else if (aiThinking) {
    turnText.textContent = t('turnThinking');
  } else if (isAI()) {
    turnText.textContent = isRed ? t('turnYou') : t('turnAI');
  } else {
    turnText.textContent = isRed ? t('turnRed') : t('turnBlack');
  }
  const col = isRed ? '#c05345' : '#8b93a1';
  turnDot.style.background = col;
  turnDot.style.boxShadow = `0 0 10px ${col}`;
  turnBox.classList.toggle('thinking', aiThinking && !over);
  capRedEl.innerHTML = capturedBy[RED].map((p) => `<span class="chip ${p.side}">${name(p.side, p.type, currentLang)}</span>`).join('') || '<em>—</em>';
  capBlackEl.innerHTML = capturedBy[BLACK].map((p) => `<span class="chip ${p.side}">${name(p.side, p.type, currentLang)}</span>`).join('') || '<em>—</em>';
  btnUndo.disabled = history.length === 0 || busy || aiThinking;
}

function addLog(textHant, textHans, side) {
  moveLogs.push({ side, textHant, textHans });
  if (moveLogs.length > 200) moveLogs.shift();
  rebuildLog();
}

function rebuildLog() {
  logEl.innerHTML = '';
  if (!moveLogs.length) {
    logEmpty.style.display = '';
    return;
  }
  logEmpty.style.display = 'none';
  for (const entry of moveLogs) {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'side ' + entry.side;
    dot.textContent = entry.side === RED ? t('sideRed') : t('sideBlack');
    li.appendChild(dot);
    const txt = currentLang === LANG_HANS ? entry.textHans : entry.textHant;
    li.appendChild(document.createTextNode(' ' + txt));
    logEl.appendChild(li);
  }
  logEl.scrollTop = logEl.scrollHeight;
}

function clearSelection() {
  selected = null;
  legal = [];
  clearFX();
  selRing.visible = false;
}

function showSelectRingAt(pos) {
  if (!pos) { selRing.visible = false; return; }
  const p = to3D(pos.r, pos.c);
  selRing.position.set(p.x, 0.02, p.z);
  selRing.visible = true;
}

function select(r, c) {
  clearSelection();
  selected = { r, c };
  legal = legalMoves(board, r, c);
  showSelectRingAt(selected);
  if (legal.length) showMoveDots(legal);
  sfx.select();
  refreshHUD();
}

function pieceAt(r, c) {
  return pieces.find((o) => o.userData.r === r && o.userData.c === c);
}

function buildScene() {
  clearSelection();
  for (const m of [...pieces]) scene.remove(m);
  pieces = [];
  let i = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      const m = makePiece(p, r, c);
      pieces.push(m);
      scene.add(m);
      m.position.y = 3.4;
      tween(420 + (i % 9) * 26, (k) => { m.position.y = 3.4 + (Y0 - 3.4) * k; }, null, (i >> 3) * 55);
      i++;
    }
}

function newGame() {
  cancelSpeech();
  tweens.length = 0;
  aiToken++;
  aiThinking = false;
  history = [];
  capturedBy = { [RED]: [], [BLACK]: [] };
  over = false;
  winner = null;
  busy = false;
  board = initialBoard();
  turn = RED;
  posHistory = [hashBoard(board)];
  repHistory = [{ key: hashBoard(board) + '|' + turn, mover: null, check: false }];
  gameStartTime = Date.now();
  undoCount = 0;
  stopConfetti();
  overlay.classList.add('hidden');
  banner.classList.add('hidden');
  moveLogs = [];
  commentaryLogs = [];
  rebuildLog();
  rebuildCommentary();
  hideHintMarkers();
  if (hintModal) hintModal.classList.add('hidden');
  syncLastMoveMark();
  buildScene();
  refreshHUD();
}

/** 測試用：直接佈局 */
function resetTo(customBoard, turnSide) {
  cancelSpeech();
  tweens.length = 0;
  aiToken++;
  aiThinking = false;
  board = customBoard;
  if (turnSide) turn = turnSide;
  posHistory = [hashBoard(board)];
  repHistory = [{ key: hashBoard(board) + '|' + turn, mover: null, check: false }];
  history = [];
  capturedBy = { [RED]: [], [BLACK]: [] };
  over = false;
  winner = null;
  busy = false;
  gameStartTime = Date.now();
  undoCount = 0;
  stopConfetti();
  overlay.classList.add('hidden');
  banner.classList.add('hidden');
  moveLogs = [];
  commentaryLogs = [];
  rebuildLog();
  rebuildCommentary();
  hideHintMarkers();
  if (hintModal) hintModal.classList.add('hidden');
  syncLastMoveMark();
  buildScene();
  refreshHUD();
}

function animateCapture(m, done) {
  m.userData.capturing = true;
  const y0 = m.position.y;
  const s0 = m.scale.x;
  const rotY0 = m.rotation.y;
  tween(280, (k) => {
    const s = Math.max(0.06, s0 * (1 - 0.92 * k));
    m.scale.set(s, s, s);
    m.position.y = y0 * (1 - k) + 0.02;
    m.rotation.y = rotY0 + k * 1.1;
  }, done);
}

function doMove(from, to) {
  hideHintMarkers();
  const p = pieceAt(from.r, from.c);
  const cap = pieceAt(to.r, to.c);
  const captured = board[to.r][to.c];
  const prevBoard = board.map((row) => row.map((c) => (c ? { ...c } : null)));
  const notaHant = notation(board, from, to, LANG_HANT);
  const notaHans = notation(board, from, to, LANG_HANS);
  applyMove(board, from, to);
  p.userData.r = to.r;
  p.userData.c = to.c;
  history.push({ from, to, captured, notaHant, notaHans, side: turn });
  posHistory.push(hashBoard(board));
  syncLastMoveMark();
  clearSelection();
  busy = true;
  refreshHUD();

  sfx.move();
  const from3 = p.position.clone();
  const to3 = to3D(to.r, to.c);
  tween(340, (k) => {
    p.position.lerpVectors(from3, to3, k);
    p.position.y = Y0 + Math.sin(Math.PI * k) * 0.55;
  }, () => {
    if (cap) {
      sfx.capture();
      animateCapture(cap, () => {
        scene.remove(cap);
        const i = pieces.indexOf(cap);
        if (i >= 0) pieces.splice(i, 1);
        finishMove(notaHant, notaHans, captured, prevBoard, from, to);
      });
    } else {
      finishMove(notaHant, notaHans, captured, prevBoard, from, to);
    }
  });
}

function finishMove(notaHant, notaHans, captured, prevBoard, from, to) {
  if (captured) capturedBy[turn].push(captured);
  addLog(notaHant, notaHans, turn);

  if (prevBoard && from && to) {
    const commHant = generateCommentary({
      prevBoard,
      currBoard: board,
      from,
      to,
      side: turn,
      captured,
      history,
      lang: LANG_HANT,
    });
    const commHans = generateCommentary({
      prevBoard,
      currBoard: board,
      from,
      to,
      side: turn,
      captured,
      history,
      lang: LANG_HANS,
    });
    addCommentaryEntry({
      moveNum: history.length,
      side: turn,
      notaHant,
      notaHans,
      titleHant: commHant.title,
      titleHans: commHans.title,
      commHant: commHant.comment,
      commHans: commHans.comment,
      tag: commHant.tag,
      scoreTextHant: commHant.scoreText,
      scoreTextHans: commHans.scoreText,
    });
  }

  const mover = turn;
  turn = turn === RED ? BLACK : RED;
  busy = false;

  const checked = inCheck(board, turn);
  const has = hasAnyLegalMove(board, turn);
  repHistory.push({ key: hashBoard(board) + '|' + turn, mover, check: checked });

  let endReason = null; // '將死' | '困斃' | '長將' | '三次重複局面' | '雙方長將'
  if (!has) {
    over = true;
    winner = turn === RED ? BLACK : RED;
    endReason = checked ? '將死' : '困斃';
  } else {
    // 長將判負／三次重複局面判和
    const verdict = repetitionVerdict(repHistory, repHistory[repHistory.length - 1].key);
    if (verdict) {
      over = true;
      if (verdict.result === 'loss') {
        winner = verdict.loser === RED ? BLACK : RED;
        endReason = '長將';
      } else {
        winner = null;
        endReason = verdict.reason;
      }
    }
  }
  if (checked) {
    sfx.check();
    showBanner();
  }
  if (over) {
    refreshHUD();
    setTimeout(() => showGameOver(endReason), endReason === '將死' ? 900 : 300);
  }
  refreshHUD();
  maybeAIMove();
}

function showBanner() {
  banner.classList.remove('hidden');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(() => banner.classList.add('hidden'), 1500);
}

function undoPly() {
  const h = history.pop();
  posHistory.pop();
  repHistory.pop();
  const p = pieceAt(h.to.r, h.to.c);
  applyMove(board, h.to, h.from);
  p.userData.r = h.from.r;
  p.userData.c = h.from.c;
  const pos = to3D(h.from.r, h.from.c);
  p.position.set(pos.x, Y0, pos.z);
  if (h.captured) {
    board[h.to.r][h.to.c] = h.captured; // 被吃的子也要放回邏輯棋盤，不能只復原 mesh
    const cm = makePiece(h.captured, h.to.r, h.to.c);
    pieces.push(cm);
    scene.add(cm);
    capturedBy[turn === RED ? BLACK : RED].pop();
  }
  commentaryLogs.pop();
  turn = turn === RED ? BLACK : RED;
}

function undo() {
  if (!history.length || busy || aiThinking) return;
  cancelSpeech();
  undoCount++;
  aiToken++; // 作廢進行中的 AI 計算
  undoPly();
  // 人機模式：連 AI 那一步一起退，回到玩家回合
  if (isAI() && turn === AI_SIDE && history.length) undoPly();
  addLog('悔棋', '悔棋', turn);
  rebuildCommentary();
  hideHintMarkers();
  if (hintModal) hintModal.classList.add('hidden');
  if (over) { over = false; winner = null; }
  stopConfetti();
  overlay.classList.add('hidden');
  clearSelection();
  syncLastMoveMark();
  refreshHUD();
}

// ---------------- 輸入 ----------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // 1) 先找棋子
  const hits = ray.intersectObjects(pieces, false);
  const obj = hits.length ? hits[0].object : null;
  if (obj && obj.userData.piece) return obj;
  // 2) 再找盤面，吸附到最近的交叉點
  const bh = ray.intersectObject(boardMesh, false);
  if (bh.length) {
    const p = bh[0].point;
    let best = null, bestD = 0.5 * 0.5;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const q = to3D(r, c);
        const dx = p.x - q.x, dz = p.z - q.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestD) { bestD = d2; best = { r, c }; }
      }
    if (best) return best;
  }
  return null;
}

renderer.domElement.addEventListener('pointermove', (e) => {
  const hit = pick(e);
  renderer.domElement.style.cursor = hit ? 'pointer' : (viewLocked ? 'default' : 'grab');
});

let downXY = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downXY = [e.clientX, e.clientY]; });
// 拖曳／滾輪結束後記住視角（個人化，存瀏覽器）
renderer.domElement.addEventListener('pointerup', queueSaveViewPrefs);
renderer.domElement.addEventListener('wheel', queueSaveViewPrefs, { passive: true });

renderer.domElement.addEventListener('click', (e) => {
  if (downXY && Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 8) {
    downXY = null; // 拖曳旋轉視角後產生的 click，忽略
    return;
  }
  downXY = null;
  if (busy || over || aiThinking || (isAI() && turn === AI_SIDE)) return;
  const hit = pick(e);
  if (!hit) { clearSelection(); refreshHUD(); return; }

  // 點到棋子
  if (hit.userData && hit.userData.piece) {
    const { r, c, piece } = hit.userData;
    if (piece.side !== turn) {
      // 敵子：若為合法目標則執行
      if (selected && legal.some((m) => m.r === r && m.c === c)) doMove(selected, { r, c });
      return;
    }
    if (selected && selected.r === r && selected.c === c) { clearSelection(); refreshHUD(); return; }
    select(r, c);
    return;
  }

  // 點到空交叉點：合法則走，否則取消選中
  const { r, c } = hit;
  if (selected && legal.some((m) => m.r === r && m.c === c)) {
    doMove(selected, { r, c });
  } else {
    clearSelection();
  }
  refreshHUD();
});

// ---------------- 終局畫面 / 彩帶 / 分享 ----------------
const SITE_URL = 'https://chinese-chess.gh.miniasp.com/';
const DIFF = {
  easy:   { label: '簡單', stars: 1, winTitle: '旗開得勝！', winSub: '小試身手就拿下 AI，好的開始！' },
  medium: { label: '中等', stars: 2, winTitle: '運籌帷幄！', winSub: '攻守有度，中等 AI 也不是你的對手！' },
  hard:   { label: '困難', stars: 3, winTitle: '棋壇霸主！', winSub: '深算遠謀，最強 AI 也俯首稱臣！' },
};

const ovCard = document.getElementById('ovCard');
const ovBadge = document.getElementById('ovBadge');
const ovTitle = document.getElementById('ovTitle');
const ovStars = document.getElementById('ovStars');
const ovSub = document.getElementById('ovSub');
const ovReason = document.getElementById('ovReason');
const stRounds = document.getElementById('stRounds');
const stTime = document.getElementById('stTime');
const stCaps = document.getElementById('stCaps');
const stUndo = document.getElementById('stUndo');
const btnShare = document.getElementById('btnShare');
const toastEl = document.getElementById('toast');
let lastResult = null;

const fmtTime = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 3600);
}

function showGameOver(endReason) {
  const pvp = !isAI();
  const draw = winner == null;
  const playerWin = !pvp && !draw && winner !== AI_SIDE;
  const diffKey = mode;
  const dLabel = (t('diffLabels') || {})[diffKey] || '';
  const d = pvp ? null : DIFF[mode];
  const plies = Math.max(1, history.length); // 棋譜著法數
  const secs = Math.max(1, Math.round((Date.now() - gameStartTime) / 1000));
  const caps = pvp ? capturedBy[winner ?? RED].length : capturedBy[RED].length;
  const pure = undoCount === 0; // 全程零悔棋：純度勳章
  const isZhHans = currentLang === LANG_HANS;

  const reasonMap = {
    '將死': t('reasonCheckmate'),
    '困斃': t('reasonStalemate'),
    '長將': t('reasonPerpetual'),
    '三次重複局面': t('reasonRepetition'),
    '雙方長將': t('reasonBothPerp'),
  };
  const reasonChars = draw ? (isZhHans ? '和棋' : '和棋') : (reasonMap[endReason] || endReason);
  const winSideLabel = winner === RED ? t('sideRed') : t('sideBlack');
  const winLabel = `${winSideLabel}方`;
  const celebrate = !draw && (pvp || playerWin);

  let title, sub, badge, cardTitle, cardSub, shareText;
  if (draw) {
    title = t('ovDraw');
    sub = pvp ? t('ovDrawSubPvP') : t('ovDrawSubAI');
    badge = pvp ? t('ovPvPBadge') : `${isZhHans ? '人机对弈' : '人機對弈'} ・ ${dLabel}`;
    cardTitle = t('ovDraw');
    cardSub = pvp ? t('ovPvPSub')(plies, pure) : t('ovAISub')(dLabel, plies, pure);
    shareText = isZhHans
      ? `我们在 3D 中国象棋鏖战 ${plies} 着，弈和不分胜负！来对弈一局：${SITE_URL}`
      : `我們在 3D 中國象棋鏖戰 ${plies} 著，弈和不分勝負！來對弈一局：${SITE_URL}`;
  } else if (pvp) {
    title = `${winLabel}${t('ovWinPvP')}`;
    sub = isZhHans ? '棋逢敌手，精彩对弈！' : '棋逢敵手，精彩對弈！';
    badge = t('ovPvPBadge');
    cardTitle = `${winLabel}${t('ovWinPvP')}`;
    cardSub = t('ovPvPSub')(plies, pure);
    shareText = isZhHans
      ? `我们在 3D 中国象棋鏖战 ${plies} 着，${winLabel}获胜！来对弈一局：${SITE_URL}`
      : `我們在 3D 中國象棋鏖戰 ${plies} 著，${winLabel}獲勝！來對弈一局：${SITE_URL}`;
  } else if (playerWin) {
    title = t('ovWinTitle')(diffKey);
    sub = t('ovWinSub')(diffKey);
    badge = `${isZhHans ? '人机对弈' : '人機對弈'} ・ ${dLabel}`;
    cardTitle = title.replace('！', '');
    cardSub = isZhHans
      ? `战胜“${dLabel}”AI ・ ${plies} 着${pure ? ' ・ 零悔棋' : ''}`
      : `戰勝「${dLabel}」AI ・ ${plies} 著${pure ? ' ・ 零悔棋' : ''}`;
    shareText = pure
      ? (isZhHans
          ? `我在 3D 中国象棋全程零悔棋、${plies} 着战胜“${dLabel}”AI 🏆 不服来战：${SITE_URL}`
          : `我在 3D 中國象棋全程零悔棋、${plies} 著戰勝「${dLabel}」AI 🏆 不服來戰：${SITE_URL}`)
      : (isZhHans
          ? `我在 3D 中国象棋以 ${plies} 着战胜“${dLabel}”AI 🏆 不服来战：${SITE_URL}`
          : `我在 3D 中國象棋以 ${plies} 著戰勝「${dLabel}」AI 🏆 不服來戰：${SITE_URL}`);
  } else {
    title = t('ovLoseTitle');
    sub = t('ovLoseSub');
    badge = `${isZhHans ? '人机对弈' : '人機對弈'} ・ ${dLabel}`;
  }

  lastResult = { pvp, playerWin, draw, d, plies, secs, caps, undoCount, pure, reasonChars, cardTitle, cardSub, shareText };

  ovBadge.textContent = badge;
  ovTitle.textContent = title;
  ovSub.textContent = sub;
  if (d && !draw) {
    ovStars.innerHTML = [1, 2, 3].map((i) =>
      `<span class="${i <= d.stars ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.14}s">★</span>`
    ).join('');
    ovStars.style.display = '';
  } else {
    ovStars.style.display = 'none';
  }
  stRounds.textContent = plies;
  stTime.textContent = fmtTime(secs);
  stCaps.textContent = caps;
  stUndo.textContent = undoCount;
  stUndo.classList.toggle('pure', pure);
  const perpReason = celebrate
    ? (isZhHans ? '对方“长将”判负' : '對方「長將」判負')
    : (isZhHans ? '“长将”判负' : '「長將」判負');
  const winReason = isZhHans ? `以“${reasonChars}”取胜` : `以「${reasonChars}」取勝`;
  const loseReason = isZhHans ? `遭“${reasonChars}”落败` : `遭「${reasonChars}」落敗`;
  ovReason.textContent = draw
    ? `${reasonChars}，判和`
    : endReason === '長將'
      ? perpReason
      : (celebrate ? winReason : loseReason);
  ovCard.classList.toggle('win', celebrate);
  ovCard.classList.toggle('lose', !celebrate && !draw);
  btnShare.style.display = celebrate ? '' : 'none';
  overlay.classList.remove('hidden');
  if (celebrate) {
    sfx.win();
    startConfetti();
  } else {
    stopConfetti();
    if (!draw) sfx.lose();
  }
}

// ----- 彩帶 -----
const confettiCv = document.getElementById('confettiCv');
const CONF_COLORS = ['#f2c14e', '#e2736a', '#e9decb', '#d9a441', '#c05345', '#9fd68f'];
let confettiRAF = 0;

// rAF 在分頁進背景時會暫停，不能靠迴圈自己收尾；關閉 overlay 時須主動停止並清空
function stopConfetti() {
  cancelAnimationFrame(confettiRAF);
  confettiCv.getContext('2d').clearRect(0, 0, confettiCv.width, confettiCv.height);
}

function startConfetti() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = confettiCv.width = confettiCv.clientWidth * dpr;
  const h = confettiCv.height = confettiCv.clientHeight * dpr;
  const g = confettiCv.getContext('2d');
  const spawn = (initial) => ({
    x: Math.random() * w,
    y: initial ? Math.random() * h * 2 - h : -20 * dpr, // 開場一半灑在畫面內、一半自上方落下
    w: (5 + Math.random() * 6) * dpr,
    h: (8 + Math.random() * 9) * dpr,
    vx: (-0.6 + Math.random() * 1.2) * dpr,
    vy: (1.4 + Math.random() * 2.4) * dpr,
    rot: Math.random() * Math.PI,
    vr: -0.12 + Math.random() * 0.24,
    sway: Math.random() * Math.PI * 2,
    color: CONF_COLORS[(Math.random() * CONF_COLORS.length) | 0],
  });
  const parts = Array.from({ length: 130 }, () => spawn(true));
  cancelAnimationFrame(confettiRAF);
  const step = () => {
    if (overlay.classList.contains('hidden')) { g.clearRect(0, 0, w, h); return; }
    g.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.sway += 0.05;
      p.x += p.vx + Math.sin(p.sway) * 0.9 * dpr;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > h + 24 * dpr) Object.assign(p, spawn(false));
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      g.globalAlpha = 0.6 + Math.abs(Math.sin(p.sway)) * 0.4; // 翻面時明暗變化
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    confettiRAF = requestAnimationFrame(step);
  };
  confettiRAF = requestAnimationFrame(step);
}

// ----- 戰績卡（分享圖）-----
function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

async function buildShareCard(res) {
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const serif = '"Kaiti SC","STKaiti","KaiTi","Noto Serif TC",serif';
  const sans = '"PingFang SC","PingFang TC","Microsoft YaHei","Microsoft JhengHei","Noto Sans SC","Noto Sans TC",sans-serif';
  const isZhHans = currentLang === LANG_HANS;

  // 底色 + 雙線描金外框
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#261c12');
  bg.addColorStop(1, '#120e09');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(217,164,65,0.4)';
  g.lineWidth = 3;
  g.strokeRect(30, 30, W - 60, H - 60);
  g.strokeStyle = 'rgba(217,164,65,0.16)';
  g.lineWidth = 1;
  g.strokeRect(44, 44, W - 88, H - 88);

  g.textAlign = 'center';
  g.fillStyle = '#9a8a74';
  g.font = `600 30px ${sans}`;
  g.fillText(isZhHans ? '中 国 象 棋 ・ 3 D 对 弈' : '中 國 象 棋 ・ 3 D 對 弈', W / 2, 118);

  g.fillStyle = '#f2c14e';
  g.shadowColor = 'rgba(242,193,78,0.45)';
  g.shadowBlur = 28;
  g.font = `900 96px ${serif}`;
  g.fillText(res.cardTitle, W / 2, 236);
  g.shadowBlur = 0;

  const starStr = res.d ? '★'.repeat(res.d.stars) + '☆'.repeat(3 - res.d.stars) + '　' : '';
  g.fillStyle = '#d9a441';
  g.font = `700 40px ${sans}`;
  g.fillText(`${starStr}${res.cardSub}`, W / 2, 306);

  // 終局棋盤：WebGL 緩衝在 present 後即失效，須重繪後立即 drawImage
  const bx = 90, by = 344, bw = 900, bh = 656;
  g.save();
  roundRectPath(g, bx, by, bw, bh, 22);
  g.clip();
  renderer.render(scene, camera);
  const shot = renderer.domElement;
  const sc = Math.max(bw / shot.width, bh / shot.height);
  const sw = bw / sc, sh = bh / sc;
  g.drawImage(shot, (shot.width - sw) / 2, (shot.height - sh) / 2, sw, sh, bx, by, bw, bh);
  g.restore();
  roundRectPath(g, bx, by, bw, bh, 22);
  g.strokeStyle = 'rgba(217,164,65,0.5)';
  g.lineWidth = 3;
  g.stroke();

  // 紅印：將死 / 困斃
  g.save();
  g.translate(bx + bw - 92, by + bh - 92);
  g.rotate(-0.1);
  const ss = 150;
  g.fillStyle = 'rgba(179,44,32,0.94)';
  roundRectPath(g, -ss / 2, -ss / 2, ss, ss, 14);
  g.fill();
  g.strokeStyle = 'rgba(245,233,214,0.85)';
  g.lineWidth = 4;
  roundRectPath(g, -ss / 2 + 9, -ss / 2 + 9, ss - 18, ss - 18, 8);
  g.stroke();
  g.fillStyle = '#f5e9d6';
  g.font = `900 56px ${serif}`;
  g.textBaseline = 'middle';
  g.fillText(res.reasonChars[0], 0, -33);
  g.fillText(res.reasonChars[1], 0, 35);
  g.restore();
  g.textBaseline = 'alphabetic';

  // 戰績統計
  g.strokeStyle = 'rgba(217,164,65,0.25)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(120, 1052);
  g.lineTo(W - 120, 1052);
  g.stroke();
  const stats = [
    [String(res.plies), t('statRounds'), false],
    [fmtTime(res.secs), t('statTime'), false],
    [String(res.caps), t('statCaps'), false],
    [String(res.undoCount), t('statUndo'), res.pure], // 零悔棋以金色高亮
  ];
  stats.forEach(([v, l, hi], i) => {
    const x = W / 2 + (i - 1.5) * 236;
    g.fillStyle = hi ? '#f2c14e' : '#e9decb';
    g.font = `800 64px ${sans}`;
    g.fillText(v, x, 1148);
    g.fillStyle = '#9a8a74';
    g.font = `600 26px ${sans}`;
    g.fillText(l, x, 1194);
  });

  g.fillStyle = '#d9a441';
  g.font = `700 34px ${sans}`;
  g.fillText(isZhHans ? '不 服 来 战' : '不 服 來 戰', W / 2, 1262);
  g.fillStyle = '#9a8a74';
  g.font = `500 28px ${sans}`;
  g.fillText('chinese-chess.gh.miniasp.com', W / 2, 1306);

  return cv;
}

async function shareResult() {
  if (!lastResult) return;
  btnShare.disabled = true;
  const orig = btnShare.textContent;
  btnShare.textContent = t('btnShareGen');
  try {
    const cv = await buildShareCard(lastResult);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    const file = new File([blob], 'chinese-chess-victory.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: lastResult.shareText });
        toast(t('toastShared'));
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // 使用者取消分享
        // 其餘錯誤改走下載後備方案
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chinese-chess-victory.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    try {
      await navigator.clipboard.writeText(lastResult.shareText);
      toast(t('toastCardCopied'));
    } catch {
      toast(t('toastCardDownloaded'));
    }
  } catch {
    toast(t('toastShareFail'));
  } finally {
    btnShare.disabled = false;
    btnShare.textContent = orig;
  }
}
btnShare.addEventListener('click', shareResult);

// ---------------- 按鈕 ----------------
const modeSel = document.getElementById('modeSel');
mode = modeSel.value;
modeSel.addEventListener('change', () => {
  mode = modeSel.value;
  newGame(); // 換對手就開新局，避免局中切換造成混亂
});
document.getElementById('btnNew').addEventListener('click', newGame);
btnUndo.addEventListener('click', undo);
document.getElementById('btnSound').addEventListener('click', (e) => {
  muted = !muted;
  e.currentTarget.textContent = muted ? t('soundOff') : t('soundOn');
  e.currentTarget.setAttribute('aria-pressed', String(!muted));
});
// 「⋯」更多選單（小螢幕）：開合、點外處／Esc 關閉、玩法說明開關
const hudMore = document.getElementById('hudMore');
const btnMore = document.getElementById('btnMore');
const btnHelp = document.getElementById('btnHelp');
function closeHudMenu() {
  hudMore.classList.remove('open');
  btnMore.setAttribute('aria-expanded', 'false');
}
btnMore.addEventListener('click', () => {
  const open = hudMore.classList.toggle('open');
  btnMore.setAttribute('aria-expanded', String(open));
});
document.addEventListener('pointerdown', (e) => {
  if (hudMore.classList.contains('open') && !hudMore.contains(e.target) && !btnMore.contains(e.target)) closeHudMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeHudMenu(); });
btnHelp.addEventListener('click', () => {
  const on = document.getElementById('left').classList.toggle('show-help');
  btnHelp.setAttribute('aria-pressed', String(on));
  closeHudMenu();
});

// FEN 局面匯出 / 載入
const fenModal = document.getElementById('fenModal');
const fenInput = document.getElementById('fenInput');
const btnFEN = document.getElementById('btnFEN');
const btnFenClose = document.getElementById('btnFenClose');
const btnFenCopy = document.getElementById('btnFenCopy');
const btnFenLoad = document.getElementById('btnFenLoad');

function openFenModal() {
  fenInput.value = toFEN(board, turn);
  fenModal.classList.remove('hidden');
  fenInput.focus();
  fenInput.select();
  closeHudMenu();
}

function closeFenModal() {
  fenModal.classList.add('hidden');
}

btnFEN.addEventListener('click', openFenModal);
btnFenClose.addEventListener('click', closeFenModal);
fenModal.addEventListener('click', (e) => {
  if (e.target === fenModal) closeFenModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !fenModal.classList.contains('hidden')) closeFenModal();
});

btnFenCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(fenInput.value);
    toast(t('fenCopiedToast'));
  } catch {
    toast(t('fenCopyManual'));
  }
});

btnFenLoad.addEventListener('click', () => {
  const raw = fenInput.value.trim();
  if (!raw) return;
  try {
    const { board: newB, turn: newTurn } = loadFEN(raw);
    resetTo(newB, newTurn);
    closeFenModal();
    toast(t('fenLoadedToast'));
  } catch (err) {
    toast(t('fenFailedToast')(err.message || (currentLang === LANG_HANS ? 'FEN 格式无效' : 'FEN 格式無效')));
  }
});
function flyTo(pos, tgt, done) {
  cancelCameraTween();
  const tgtFrom = controls.target.clone();
  // 以「球座標」補間（繞著目標水平環繞），直線 lerp 在 180° 換邊時
  // 相機會橫越棋盤正上方，畫面劇烈甩動、體感很差
  const sphFrom = new THREE.Spherical().setFromVector3(camera.position.clone().sub(tgtFrom));
  const sphTo = new THREE.Spherical().setFromVector3(pos.clone().sub(tgt));
  let dTheta = sphTo.theta - sphFrom.theta;
  // 取最短角距離；剛好半圈時固定逆時針，方向不會忽左忽右
  while (dTheta > Math.PI) dTheta -= Math.PI * 2;
  while (dTheta < -Math.PI) dTheta += Math.PI * 2;
  if (dTheta === -Math.PI) dTheta = Math.PI;
  // 旋轉角度越大、補間越久，讓換邊時節奏依然從容
  const dur = 480 + (Math.abs(dTheta) / Math.PI) * 480;
  tween(dur, (k) => {
    const tgtNow = tgtFrom.clone().lerp(tgt, k);
    const sph = new THREE.Spherical(
      sphFrom.radius + (sphTo.radius - sphFrom.radius) * k,
      sphFrom.phi + (sphTo.phi - sphFrom.phi) * k,
      sphFrom.theta + dTheta * k,
    );
    camera.position.setFromSpherical(sph).add(tgtNow);
    // 補間途中需自行更新相機朝向（tick 可能正跳過 controls.update()），
    // 否則抵達後視線方向是舊的
    camera.lookAt(tgtNow);
  }, () => { saveViewPrefs(); if (done) done(); }, 0, 'camera');
}
function cancelCameraTween() {
  for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].tag === 'camera') tweens.splice(i, 1);
}

// 「視角」按鈕：在多個預設機位之間循環切換
const CAMERA_VIEWS = [
  { labelHant: '紅方', labelHans: '红方', dist: 14.8, polar: 45, azimuth: -90, tgt: HOME_TGT },
  { labelHant: '黑方', labelHans: '黑方', dist: 14.8, polar: 45, azimuth: 90, tgt: new THREE.Vector3(0, -0.1, -0.2) },
  { labelHant: '側面', labelHans: '侧面', dist: 14.8, polar: 55, azimuth: 0, tgt: new THREE.Vector3(0, -0.1, 0.2) },
  { labelHant: '俯視', labelHans: '俯视', dist: 14.2, polar: 8, azimuth: -90, tgt: new THREE.Vector3(0, 0, 0.2) },
];
let viewIdx = 0;
document.getElementById('btnView').addEventListener('click', () => {
  viewIdx = (viewIdx + 1) % CAMERA_VIEWS.length;
  const v = CAMERA_VIEWS[viewIdx];
  const pos = new THREE.Vector3()
    .setFromSphericalCoords(v.dist, THREE.MathUtils.degToRad(v.polar), THREE.MathUtils.degToRad(v.azimuth))
    .add(v.tgt);
  flyTo(pos, v.tgt);
  const lbl = currentLang === LANG_HANS ? v.labelHans : v.labelHant;
  toast(t('viewToast')(lbl));
});

// 固定視角：鎖定鏡頭後拖曳／滾輪都不再改變視角（Issue #2）
let viewLocked = false;
const btnLock = document.getElementById('btnLock');
function syncLockUI() {
  controls.enabled = !viewLocked;
  document.getElementById('btnLockText').textContent = viewLocked ? t('lockOn') : t('lockOff');
  btnLock.setAttribute('aria-pressed', String(viewLocked));
  btnLock.classList.toggle('on', viewLocked);
}
btnLock.addEventListener('click', () => {
  viewLocked = !viewLocked;
  syncLockUI();
  saveViewPrefs();
  // 以「現狀」固定：凍結當下視角與進行中的相機補間，不做歸位
  if (viewLocked) cancelCameraTween();
});
syncLockUI();

// ---------------- 個人化：記住 3D 視角與固定視角設定（localStorage） ----------------
const VIEW_PREF_KEY = 'xiangqi.viewPrefs.v1';
let saveViewTimer = 0;
function saveViewPrefs() {
  try {
    localStorage.setItem(VIEW_PREF_KEY, JSON.stringify({
      pos: camera.position.toArray(),
      tgt: controls.target.toArray(),
      locked: viewLocked,
      viewIdx,
    }));
  } catch { /* 無法寫入（如隱私模式）時靜默略過 */ }
}
function queueSaveViewPrefs() {
  clearTimeout(saveViewTimer);
  saveViewTimer = setTimeout(saveViewPrefs, 600); // 等慣性減速大致停止再存
}
function loadViewPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(VIEW_PREF_KEY) || 'null');
    const okVec = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
    if (!p || !okVec(p.pos) || !okVec(p.tgt)) return null;
    return p;
  } catch { return null; }
}
// 啟動時還原個人化設定
const savedPrefs = loadViewPrefs();
if (savedPrefs) {
  camera.position.fromArray(savedPrefs.pos);
  controls.target.fromArray(savedPrefs.tgt);
  camera.lookAt(controls.target);
  if (savedPrefs.locked) {
    viewLocked = true;
    syncLockUI();
  }
  if (Number.isInteger(savedPrefs.viewIdx)) {
    viewIdx = ((savedPrefs.viewIdx % CAMERA_VIEWS.length) + CAMERA_VIEWS.length) % CAMERA_VIEWS.length;
  }
}
window.addEventListener('pagehide', saveViewPrefs);
document.getElementById('btnAgain').addEventListener('click', newGame);

// 全螢幕（含 Safari webkit 前綴）
const btnFull = document.getElementById('btnFull');
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
btnFull.addEventListener('click', async () => {
  try {
    if (fsElement()) {
      await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
    } else {
      const root = document.documentElement;
      await (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.());
    }
  } catch {
    /* 使用者拒絕或瀏覽器不支援時忽略 */
  }
});
function syncFullBtn() {
  const on = !!fsElement();
  btnFull.textContent = on ? t('fullOn') : t('fullOff');
  btnFull.setAttribute('aria-pressed', String(on));
}
document.addEventListener('fullscreenchange', syncFullBtn);
document.addEventListener('webkitfullscreenchange', syncFullBtn);
syncFullBtn();

// ---------------- 多語言切換 (i18n) ----------------
function updateUIStrings() {
  document.documentElement.lang = currentLang;
  const brandH1 = document.querySelector('.brand h1');
  if (brandH1) brandH1.textContent = t('brandTitle');
  const brandSub = document.querySelector('.brand .sub');
  if (brandSub) brandSub.textContent = t('brandSub');

  if (modeSel && modeSel.options.length >= 4) {
    modeSel.options[0].textContent = t('modeEasy');
    modeSel.options[1].textContent = t('modeMedium');
    modeSel.options[2].textContent = t('modeHard');
    modeSel.options[3].textContent = t('modePvP');
  }

  if (btnUndo) btnUndo.textContent = t('undo');
  const btnNewFull = document.querySelector('#btnNew .t-full');
  if (btnNewFull) btnNewFull.textContent = t('newGameFull');
  const btnNewShort = document.querySelector('#btnNew .t-short');
  if (btnNewShort) btnNewShort.textContent = t('newGameShort');

  const btnHelpEl = document.getElementById('btnHelp');
  if (btnHelpEl) btnHelpEl.textContent = t('help');
  const btnSoundEl = document.getElementById('btnSound');
  if (btnSoundEl) btnSoundEl.textContent = muted ? t('soundOff') : t('soundOn');
  const btnViewEl = document.getElementById('btnView');
  if (btnViewEl) btnViewEl.textContent = t('view');
  const btnFENEl = document.getElementById('btnFEN');
  if (btnFENEl) btnFENEl.textContent = t('fenBtn');
  const btnLangEl = document.getElementById('btnLang');
  if (btnLangEl) {
    btnLangEl.textContent = t('langBtn');
    btnLangEl.title = currentLang === LANG_HANT ? '切換至簡體中文' : '切换至繁体中文';
  }
  syncFullBtn();
  syncLockUI();

  const capTitles = document.querySelectorAll('#left .tray h3');
  if (capTitles[0]) capTitles[0].textContent = t('capRed');
  if (capTitles[1]) capTitles[1].textContent = t('capBlack');

  const helpPs = document.querySelectorAll('#left .help p');
  if (helpPs[0]) helpPs[0].textContent = t('helpP1');
  if (helpPs[1]) helpPs[1].textContent = t('helpP2');
  if (helpPs[2]) helpPs[2].textContent = t('helpP3');
  if (helpPs[3]) helpPs[3].textContent = t('helpP4');

  const logHeader = document.querySelector('#right h3');
  if (logHeader) logHeader.textContent = t('logTitle');
  if (logEmpty) logEmpty.textContent = t('logEmpty');
  if (banner) banner.textContent = t('checkBanner');

  const fenTitleEl = document.getElementById('fenTitle');
  if (fenTitleEl) fenTitleEl.textContent = t('fenTitle');
  const fenDescEl = document.querySelector('.fenDesc');
  if (fenDescEl) fenDescEl.textContent = t('fenDesc');
  const fenLabelEl = document.querySelector('.fenGroup label');
  if (fenLabelEl) fenLabelEl.textContent = t('fenLabel');
  if (btnFenCopy) btnFenCopy.textContent = t('fenCopyBtn');
  if (btnFenLoad) btnFenLoad.textContent = t('fenLoadBtn');

  const statLabels = document.querySelectorAll('#ovStats .stat span');
  if (statLabels[0]) statLabels[0].textContent = t('statRounds');
  if (statLabels[1]) statLabels[1].textContent = t('statTime');
  if (statLabels[2]) statLabels[2].textContent = t('statCaps');
  if (statLabels[3]) statLabels[3].textContent = t('statUndo');
  if (btnShare) btnShare.textContent = t('btnShare');
  const btnAgainEl = document.getElementById('btnAgain');
  if (btnAgainEl) btnAgainEl.textContent = t('btnAgain');

  const btnHintEl = document.getElementById('btnHint');
  if (btnHintEl) btnHintEl.textContent = t('hintBtn');
  const tabCommBtnEl = document.getElementById('tabCommBtn');
  if (tabCommBtnEl) tabCommBtnEl.textContent = t('tabCommentary');
  const tabLogBtnEl = document.getElementById('tabLogBtn');
  if (tabLogBtnEl) tabLogBtnEl.textContent = t('tabLog');
  const btnVoiceEl = document.getElementById('btnVoice');
  if (btnVoiceEl) btnVoiceEl.textContent = t(isVoiceEnabled() ? 'voiceOn' : 'voiceOff');
  const btnVoiceRightEl = document.getElementById('btnVoiceRight');
  if (btnVoiceRightEl) btnVoiceRightEl.textContent = (isVoiceEnabled() ? '🔊 ' : '🔇 ') + t(isVoiceEnabled() ? 'voiceOn' : 'voiceOff');
  const commEmptyEl = document.getElementById('commEmpty');
  if (commEmptyEl) commEmptyEl.textContent = t('commEmpty');
  const hintBadgeEl = document.getElementById('hintBadge');
  if (hintBadgeEl) hintBadgeEl.textContent = '🎯 ' + t('hintTitle');
  const hintMoveLabelEl = document.getElementById('hintMoveLabel');
  if (hintMoveLabelEl) hintMoveLabelEl.textContent = t('hintMoveLabel');
  const hintScoreLabelEl = document.getElementById('hintScoreLabel');
  if (hintScoreLabelEl) hintScoreLabelEl.textContent = t('evalLabel') + '：';
  const btnHintPlayEl = document.getElementById('btnHintPlay');
  if (btnHintPlayEl) btnHintPlayEl.textContent = t('hintPlayBtn') + ' ⚡';
  const btnHintDismissEl = document.getElementById('btnHintDismiss');
  if (btnHintDismissEl) btnHintDismissEl.textContent = t('hintCloseBtn');
  const footerCreditsEl = document.getElementById('footerCredits');
  if (footerCreditsEl) footerCreditsEl.textContent = t('credits');
}

function setLanguage(lang) {
  if (lang !== LANG_HANT && lang !== LANG_HANS) return;
  currentLang = lang;
  try {
    localStorage.setItem('xiangqi.lang', currentLang);
  } catch {}

  // 1. 更新 2D DOM 介面文字
  updateUIStrings();

  // 2. 更新棋盤楚河漢界貼圖
  const oldBoardMap = boardMesh.material.map;
  boardMesh.material.map = makeBoardTexture(currentLang);
  boardMesh.material.needsUpdate = true;
  if (oldBoardMap) oldBoardMap.dispose();

  // 3. 更新棋子貼圖（替換 top material）
  for (let i = 0; i < pieces.length; i++) {
    const m = pieces[i];
    const { side, type } = m.userData.piece;
    m.material[1] = getTopMaterial(side, type, currentLang);
    m.material[1].needsUpdate = true;
  }

  // 4. 重繪棋譜、解說與 HUD
  rebuildLog();
  rebuildCommentary();
  refreshHUD();
}

const btnLang = document.getElementById('btnLang');
if (btnLang) {
  btnLang.addEventListener('click', () => {
    setLanguage(currentLang === LANG_HANT ? LANG_HANS : LANG_HANT);
    closeHudMenu();
  });
}

// ---------------- resize / loop ----------------
function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
new ResizeObserver(resize).observe(container);
resize();

function tick(now) {
  stepTweens(now);
  if (selRing.visible) {
    const s = 1 + Math.sin(now * 0.006) * 0.05;
    selRing.scale.set(s, s, 1);
  }
  if (hintFromRing.visible) {
    const s = 1 + Math.sin(now * 0.008) * 0.08;
    hintFromRing.scale.set(s, s, 1);
    const s2 = 1 + Math.cos(now * 0.008) * 0.08;
    hintToRing.scale.set(s2, s2, 1);
  }
  if (!viewLocked) controls.update(); // 鎖定時不套用控制器更新，慣性晃動一併凍結

  // 實時更新棋子文字朝向：旋轉棋盤時所有棋子的字始終朝向鏡頭/玩家
  const targetRotY = Math.atan2(camera.position.z - controls.target.z, controls.target.x - camera.position.x);
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (!p.userData.capturing) {
      p.rotation.y = targetRotY;
    }
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(tick);

updateUIStrings();
newGame();
