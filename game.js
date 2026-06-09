const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const WORLD_WIDTH = 390;
const WORLD_HEIGHT = 640;
let viewport = { scale: 1, offsetX: 0, offsetY: 0, ratio: 1 };

const ui = {
  credit: document.getElementById("credit"),
  bet: document.getElementById("bet"),
  win: document.getElementById("win"),
  collect: document.getElementById("collect"),
  mode: document.getElementById("mode"),
  freeShots: document.getElementById("freeShots"),
  winDetail: document.getElementById("winDetail"),
  bonusStrip: document.getElementById("bonusStrip"),
  log: document.getElementById("log"),
  shoot: document.getElementById("shoot"),
  betDown: document.getElementById("betDown"),
  betUp: document.getElementById("betUp"),
  menuButton: document.getElementById("menuButton"),
  gameMenu: document.getElementById("gameMenu"),
  forceCollect: document.getElementById("forceCollect"),
  bgmToggle: document.getElementById("bgmToggle"),
  sfxToggle: document.getElementById("sfxToggle"),
  legend: {
    pay1: document.getElementById("legend-pay-1"),
    pay3: document.getElementById("legend-pay-3"),
    pay5: document.getElementById("legend-pay-5"),
    pay10: document.getElementById("legend-pay-10"),
    pay20: document.getElementById("legend-pay-20")
  }
};

const colors = [
  { key: "red", fill: "#ff4f7d", shade: "#b91e52" },
  { key: "blue", fill: "#4cc9f0", shade: "#167eab" },
  { key: "yellow", fill: "#ffd166", shade: "#c88619" },
  { key: "green", fill: "#61d394", shade: "#238b5c" },
  { key: "purple", fill: "#b46cff", shade: "#6a30bd" }
];
const candyImages = {};
colors.forEach((color) => {
  const img = new Image();
  img.src = `assets/candies/candy-${color.key}.png`;
  candyImages[color.key] = img;
});
const specialImages = {};
["score", "collect", "mult"].forEach((type) => {
  const img = new Image();
  img.src = `assets/specials/special-${type}.png`;
  specialImages[type] = img;
});
const launcherImage = new Image();
launcherImage.src = "assets/cannon-launcher.png";
const boardFrameImage = new Image();
boardFrameImage.src = "assets/backgrounds/candy-board-frame.png";

const scoreValues = [1, 1, 2, 3, 5, 10];
const bonusMultipliers = [1, 1, 2, 2, 3, 5, 8];
const bonusScoreValues = [3, 5, 8, 10, 12, 20];
const bonusBigMultipliers = [1, 1, 2, 2, 3, 3, 5, 8, 10];
const collectTarget = 3;
const rows = 13;
const cols = 9;
const radius = 18;
const rowGap = 31;
const colGap = 39;
const topPad = 26;

let state;
let pointer = { x: WORLD_WIDTH / 2, y: 490 };
let shot = null;
let particles = [];
let fallingBubbles = [];
let awardShows = [];
let coinBursts = [];
let collectShows = [];
let multShows = [];
let payoutShows = [];
let shockwaves = [];
let boardPushes = [];
let settling = false;
let audioCtx = null;
let bgmTimer = null;
let bgmStep = 0;
let bgmMode = "base";
let bgmGain = null;
let audioSettings = { bgm: true, sfx: true };

function rnd(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function chance(v) {
  return Math.random() < v;
}

function audio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq, duration = 0.08, type = "sine", gain = 0.08, delay = 0) {
  const ac = audio();
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  const start = ac.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(duration = 0.08, gain = 0.05, delay = 0) {
  const ac = audio();
  const buffer = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  const amp = ac.createGain();
  src.buffer = buffer;
  amp.gain.value = gain;
  src.connect(amp).connect(ac.destination);
  src.start(ac.currentTime + delay);
}

function ensureBgmGain() {
  const ac = audio();
  if (!bgmGain) {
    bgmGain = ac.createGain();
    bgmGain.gain.value = audioSettings.bgm ? 0.04 : 0.0001;
    bgmGain.connect(ac.destination);
  }
  return bgmGain;
}

function bgmTone(freq, duration = 0.18, type = "triangle", gain = 0.045, delay = 0) {
  const ac = audio();
  const out = ensureBgmGain();
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  const start = ac.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.018);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(out);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function playBgmStep() {
  if (!audioSettings.bgm) return;
  const base = [392, 523, 587, 659, 587, 523, 440, 523];
  const bonus = [784, 988, 1175, 1318, 1568, 1318, 1175, 1760];
  const notes = bgmMode === "bonus" ? bonus : base;
  const idx = bgmStep % notes.length;
  bgmTone(notes[idx], bgmMode === "bonus" ? 0.19 : 0.18, "triangle", bgmMode === "bonus" ? 0.09 : 0.062);
  if (idx % 2 === 0) bgmTone(notes[idx] / 2, 0.28, "sine", bgmMode === "bonus" ? 0.052 : 0.038, 0.02);
  if (bgmMode === "bonus") {
    bgmTone(notes[(idx + 2) % notes.length], 0.1, "sine", 0.055, 0.09);
    if (idx % 4 === 3) bgmTone(notes[idx] * 1.5, 0.14, "sine", 0.05, 0.06);
  }
  bgmStep += 1;
}

function startBgm() {
  if (bgmTimer || !audioSettings.bgm) return;
  ensureBgmGain().gain.setTargetAtTime(bgmMode === "bonus" ? 0.075 : 0.06, audio().currentTime, 0.08);
  playBgmStep();
  bgmTimer = setInterval(playBgmStep, bgmMode === "bonus" ? 220 : 285);
}

function stopBgm() {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
  if (bgmGain) bgmGain.gain.setTargetAtTime(0.0001, audio().currentTime, 0.05);
}

function setBgmMode(mode) {
  bgmMode = mode;
  bgmStep = 0;
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
  if (audioSettings.bgm) startBgm();
}

function playSound(name, delay = 0, amount = 0) {
  if (!audioSettings.sfx) return;
  try {
    if (name === "shoot") {
      tone(420, 0.07, "triangle", 0.07, delay);
      tone(690, 0.08, "sine", 0.04, delay + 0.035);
    } else if (name === "pop") {
      tone(820, 0.055, "square", 0.035, delay);
      noise(0.06, 0.025, delay);
    } else if (name === "win") {
      noise(0.18, 0.035, delay);
      [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.14, "sine", 0.07, delay + i * 0.055));
      [988, 1318, 1975].forEach((f, i) => tone(f, 0.22, "triangle", 0.045, delay + 0.12 + i * 0.07));
    } else if (name === "event") {
      [330, 520, 780, 1040].forEach((f, i) => tone(f, 0.12, "triangle", 0.06, delay + i * 0.045));
    } else if (name === "bonus") {
      [440, 660, 880, 1320, 1760].forEach((f, i) => tone(f, 0.16, "sine", 0.075, delay + i * 0.055));
    } else if (name === "score") {
      const lift = Math.min(680, Math.max(0, amount) * 30);
      [760 + lift, 960 + lift, 1220 + lift].forEach((f, i) => tone(f, 0.1, "sine", 0.055, delay + i * 0.04));
    } else if (name === "collect") {
      [880, 1175, 1568].forEach((f, i) => tone(f, 0.12, "sine", 0.06, delay + i * 0.05));
    } else if (name === "mult") {
      [520, 780, 1170, 1560].forEach((f, i) => tone(f, 0.09, "square", 0.04, delay + i * 0.045));
    } else if (name === "dropChain") {
      const step = Math.min(10, Math.max(0, Math.round(delay * 12)));
      const root = 540 + step * 54;
      tone(root, 0.08, "triangle", 0.045, delay);
      tone(root * 1.5, 0.09, "sine", 0.035, delay + 0.03);
      if (step > 5) noise(0.06, 0.018, delay);
    }
  } catch {}
}

function makeBubble(row, col, special = null, color = rnd(colors).key) {
  return { row, col, color, special };
}

function makeSpecial(type) {
  if (type === "score") return { type, value: rnd(scoreValues) };
  if (type === "bonusScore") return { type: "score", value: rnd(bonusScoreValues) };
  if (type === "collect") return { type };
  if (type === "mult") return { type, value: rnd([2, 3, 5]) };
  return null;
}

function hasGeneratedSupport(board, row, col) {
  if (row === 0) return true;
  const parents = row % 2
    ? [[row - 1, col], [row - 1, col + 1]]
    : [[row - 1, col - 1], [row - 1, col]];
  return parents.some(([r, c]) => c >= 0 && c < cols && board[r][c]);
}

function clusteredColor(board, row, col) {
  const nearby = [];
  const left = board[row]?.[col - 1];
  const up = board[row - 1]?.[col];
  const upLeft = board[row - 1]?.[col - 1];
  const upRight = board[row - 1]?.[col + 1];
  [left, up, upLeft, upRight].forEach((bubble) => {
    if (bubble && !bubble.special) nearby.push(bubble.color);
  });
  if (nearby.length && chance(0.68)) return rnd(nearby);
  return rnd(colors).key;
}

function makeBonusSupportBoard() {
  const board = Array.from({ length: rows }, () => Array(cols).fill(null));
  const pillars = [
    { col: 2, color: "red" },
    { col: 4, color: "blue" },
    { col: 6, color: "green" }
  ];
  const put = (row, col, color, special = null, support = false) => {
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    const bubble = makeBubble(row, col, special, color);
    bubble.support = support;
    board[row][col] = bubble;
  };

  pillars.forEach((pillar, index) => {
    for (let r = 0; r <= 3; r += 1) {
      put(r, pillar.col, pillar.color, null, true);
      if (r === 2) put(r, pillar.col - 1, pillar.color, null, true);
      if (r === 2) put(r, pillar.col + 1, pillar.color, null, true);
    }
    put(4, pillar.col, pillar.color, null, true);

    const rewards = index === 1
      ? ["bonusScore", "bonusScore", "bonusScore", "bonusScore"]
      : ["bonusScore", "bonusScore", "bonusScore"];
    const spots = [
      [3, pillar.col - 1],
      [3, pillar.col + 1],
      [4, pillar.col - 1],
      [4, pillar.col + 1]
    ];
    spots.forEach(([r, c], i) => {
      if (i < rewards.length) put(r, c, rnd(colors).key, makeSpecial(rewards[i]));
    });
  });

  for (let c = 0; c < cols; c += 1) {
    if (!board[0][c] && chance(0.58)) put(0, c, clusteredColor(board, 0, c));
  }

  return board;
}

function resetBoard(forBonus = false) {
  if (forBonus) return makeBonusSupportBoard();
  const board = Array.from({ length: rows }, () => Array(cols).fill(null));
  const fillRows = forBonus ? 7 : 7;
  for (let r = 0; r < fillRows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const holeRate = forBonus
        ? Math.min(0.24, Math.max(0, (r - 1) * 0.034))
        : Math.min(0.52, Math.max(0, (r - 1) * 0.072));
      const groupGap = r > 2 && ((c + Math.floor(r / 2)) % 4 === 0) && chance(forBonus ? 0.12 : 0.34);
      if (groupGap) continue;
      if (r > 0 && chance(holeRate)) continue;
      if (!hasGeneratedSupport(board, r, c)) continue;
      let special = null;
      const roll = Math.random();
      if (forBonus && r >= 3 && roll < 0.07) special = makeSpecial("bonusScore");
      else if (!forBonus && roll < 0.018) special = makeSpecial("score");
      else if (!forBonus && roll < 0.026) special = makeSpecial("collect");
      board[r][c] = makeBubble(r, c, special, clusteredColor(board, r, c));
    }
  }
  seedPocketSpecials(board, forBonus);
  return board;
}

function seedPocketSpecials(board, forBonus) {
  const candidates = [];
  for (let r = 3; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const bubble = board[r][c];
      if (bubble && !bubble.special) candidates.push(bubble);
    }
  }
  const target = forBonus ? 6 : 3;
  for (let i = 0; i < target && candidates.length; i += 1) {
    const pick = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
    if (forBonus) pick.special = makeSpecial("bonusScore");
    else pick.special = makeSpecial(rnd(["score", "score", "collect"]));
  }
}

function newState() {
  return {
    credit: 10000,
    bet: 100,
    lastWin: 0,
    collect: 0,
    mode: "base",
    freeShots: 0,
    bonusTotal: 0,
    lastDetail: "No win yet",
    nextSpecialBall: null,
    currentBall: randomBall(),
    nextBall: randomBall(),
    board: resetBoard(false)
  };
}

function randomBall() {
  if (state && state.nextSpecialBall) {
    const forced = state.nextSpecialBall;
    state.nextSpecialBall = null;
    return { kind: forced, color: forced === "rainbow" ? "rainbow" : rnd(colors).key };
  }
  const roll = Math.random();
  if (state && state.mode === "bonus") {
    if (roll < 0.18) return { kind: "rainbow", color: "rainbow" };
    if (roll < 0.34) return { kind: "bomb", color: rnd(colors).key };
    if (roll < 0.48) return { kind: "color", color: rnd(colors).key };
    return { kind: "normal", color: rnd(colors).key };
  }
  if (roll < 0.08) return { kind: "rainbow", color: "rainbow" };
  if (roll < 0.14) return { kind: "bomb", color: rnd(colors).key };
  if (roll < 0.20) return { kind: "color", color: rnd(colors).key };
  return { kind: "normal", color: rnd(colors).key };
}

function cellToXY(row, col) {
  const offset = row % 2 ? colGap / 2 : 0;
  return {
    x: 20 + offset + col * colGap + radius,
    y: topPad + row * rowGap
  };
}

function xyToCell(x, y) {
  let best = null;
  let dist = Infinity;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const p = cellToXY(r, c);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < dist) {
        best = { row: r, col: c };
        dist = d;
      }
    }
  }
  return best;
}

function neighbors(row, col) {
  const odd = row % 2 === 1;
  const deltas = odd
    ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
    : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
  return deltas
    .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
    .filter((p) => p.row >= 0 && p.row < rows && p.col >= 0 && p.col < cols);
}

function getBubble(row, col) {
  return state.board[row]?.[col] || null;
}

function setBubble(row, col, bubble) {
  if (!state.board[row]) return;
  state.board[row][col] = bubble;
  if (bubble) {
    bubble.row = row;
    bubble.col = col;
  }
}

function markPushAnimation(bubble, fromRow, fromCol, duration = 22) {
  if (!bubble) return;
  const from = cellToXY(fromRow, fromCol);
  bubble.pushAnim = {
    fromX: from.x,
    fromY: from.y,
    life: duration,
    duration
  };
}

function markSpawnAnimation(bubble, rowsAbove = 1, duration = 24) {
  if (!bubble) return;
  const to = cellToXY(bubble.row, bubble.col);
  bubble.pushAnim = {
    fromX: to.x,
    fromY: to.y - rowGap * rowsAbove,
    life: duration,
    duration
  };
}

function bubbleDrawXY(bubble) {
  const to = cellToXY(bubble.row, bubble.col);
  const anim = bubble.pushAnim;
  if (!anim) return to;
  const t = 1 - Math.max(0, anim.life) / anim.duration;
  const eased = 1 - Math.pow(1 - t, 3);
  return {
    x: anim.fromX + (to.x - anim.fromX) * eased,
    y: anim.fromY + (to.y - anim.fromY) * eased
  };
}

function findCluster(start, matchColor) {
  const seen = new Set();
  const stack = [start];
  const out = [];
  while (stack.length) {
    const p = stack.pop();
    const key = `${p.row},${p.col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const b = getBubble(p.row, p.col);
    if (!b) continue;
    if (b.special) continue;
    const ok = matchColor === "rainbow" || b.color === matchColor || b.color === "rainbow";
    if (!ok) continue;
    out.push(p);
    neighbors(p.row, p.col).forEach((n) => stack.push(n));
  }
  return out;
}

function bestMatchColor(row, col) {
  const counts = new Map();
  neighbors(row, col).forEach((p) => {
    const b = getBubble(p.row, p.col);
    if (!b || b.special) return;
    counts.set(b.color, (counts.get(b.color) || 0) + 1);
  });
  if (!counts.size) return rnd(colors).key;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function findFloating() {
  const connected = new Set();
  const stack = [];
  for (let c = 0; c < cols; c += 1) {
    if (getBubble(0, c)) stack.push({ row: 0, col: c });
  }
  while (stack.length) {
    const p = stack.pop();
    const key = `${p.row},${p.col}`;
    if (connected.has(key)) continue;
    if (!getBubble(p.row, p.col)) continue;
    connected.add(key);
    neighbors(p.row, p.col).forEach((n) => stack.push(n));
  }
  const floating = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (getBubble(r, c) && !connected.has(`${r},${c}`)) floating.push({ row: r, col: c });
    }
  }
  return floating;
}

function burstAt(x, y, color, count = 12) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.8) * 5,
      life: 28 + Math.random() * 18,
      color
    });
  }
}

function dropBubble(bubble, x, y, delay = 0) {
  fallingBubbles.push({
    bubble,
    x,
    y,
    vy: 2 + Math.random() * 2,
    spin: (Math.random() - 0.5) * 0.18,
    angle: 0,
    delay,
    life: 100
  });
}

function showAward(label, value, tone = "#ffd166") {
  awardShows.push({
    label,
    value,
    tone,
    life: 82,
    scale: 0.65
  });
}

function showShockwave(x, y, tone = "#ffd166") {
  shockwaves.push({ x, y, tone, radius: 12, life: 34 });
}

function showCoinBurst(amount = 10) {
  for (let i = 0; i < amount; i += 1) {
    coinBursts.push({
      x: WORLD_WIDTH / 2 + (Math.random() - 0.5) * 80,
      y: 210 + Math.random() * 30,
      vx: (Math.random() - 0.5) * 4.6,
      vy: -2.5 - Math.random() * 4.8,
      spin: (Math.random() - 0.5) * 0.3,
      angle: 0,
      life: 70 + Math.random() * 30
    });
  }
}

function showCollectProgress(value) {
  collectShows.push({
    value,
    target: collectTarget,
    life: 95,
    scale: 0.72
  });
}

function showMultEffect(value) {
  multShows.push({
    value,
    radius: 18,
    life: 78,
    angle: 0
  });
}

function showPayoutSequence(base, multiplier, total) {
  payoutShows.push({
    base,
    multiplier,
    total,
    life: 145,
    scale: 0.72,
    rollSeed: Math.floor(Math.random() * 7)
  });
}

function highlightLegend(type) {
  const el = ui.legend[type];
  if (!el) return;
  el.classList.remove("hit");
  void el.offsetWidth;
  el.classList.add("hit");
  setTimeout(() => el.classList.remove("hit"), 900);
}

function payLegendKey(value) {
  if (value >= 15) return "pay20";
  if (value >= 8) return "pay10";
  if (value >= 4) return "pay5";
  if (value >= 2) return "pay3";
  return "pay1";
}

function toast(text) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  ui.log.appendChild(el);
  setTimeout(() => el.remove(), 1650);
}

function triggerDropEvent(normalDropped) {
  if (normalDropped >= 15) {
    state.nextSpecialBall = "rainbow";
    showAward("DROP EVENT", "NEXT RAINBOW", "#b46cff");
    playSound("event");
    toast("DROP EVENT 15+: Next Rainbow Ball");
  } else if (normalDropped >= 10) {
    spawnSpecial("score");
    spawnSpecial("score");
    showAward("DROP EVENT", "SPAWN PAY x2", "#ffd166");
    playSound("event");
    toast("DROP EVENT 10+: Spawn 2 PAY");
  } else if (normalDropped >= 5) {
    spawnSpecial("score");
    showAward("DROP EVENT", "SPAWN PAY", "#ffd166");
    playSound("event");
    toast("DROP EVENT 5+: Spawn PAY");
  }
}

function spawnSpecial(type) {
  const candidates = [];
  for (let r = 2; r < Math.min(rows, 10); r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const b = getBubble(r, c);
      if (b && !b.special) candidates.push(b);
    }
  }
  if (!candidates.length) return;
  rnd(candidates).special = makeSpecial(type);
}

function boardCount() {
  return state.board.flat().filter(Boolean).length;
}

function makeRefillSpecial() {
  if (state.mode === "bonus") {
    if (chance(0.09)) return makeSpecial("bonusScore");
  } else if (chance(0.012)) {
    return makeSpecial(rnd(["score", "score", "collect"]));
  }
  return null;
}

function fillRefillCell(row, col, density = 0.72) {
  if (getBubble(row, col)) return false;
  if (!hasGeneratedSupport(state.board, row, col)) return false;
  if (row > 0 && !chance(density)) return false;
  const fresh = makeBubble(row, col, makeRefillSpecial(), clusteredColor(state.board, row, col));
  setBubble(row, col, fresh);
  markSpawnAnimation(fresh, 1, 22);
  return true;
}

function reinforceBoard(target) {
  let attempts = 0;
  while (boardCount() < target && attempts < 160) {
    const r = Math.floor(Math.random() * (state.mode === "bonus" ? 8 : 7));
    const c = Math.floor(Math.random() * cols);
    fillRefillCell(r, c, state.mode === "bonus" ? 0.82 : 0.74);
    attempts += 1;
  }
}

function resolveSpecials(dropped, shotMult = 1) {
  let scoreTotal = 0;
  let mult = shotMult;
  let collectGain = 0;
  const scoreHits = [];
  const multHits = [];

  if (shotMult > 1) {
    multHits.push(shotMult);
    showMultEffect(shotMult);
  }

  for (const [index, bubble] of dropped.entries()) {
    if (!bubble.special) continue;
    const s = bubble.special;
    const soundDelay = index * 0.075;
    playSound("dropChain", soundDelay);
    if (s.type === "score") {
      scoreTotal += s.value;
      scoreHits.push(s.value);
      showAward("PAY", `${s.value}x`, "#ffd166");
      showCoinBurst(14);
      highlightLegend(payLegendKey(s.value));
      playSound("score", soundDelay, s.value);
    }
    if (s.type === "mult") {
      mult *= s.value;
      multHits.push(s.value);
      showAward("MULTIPLIER", `TOTAL x${mult}`, "#54f2c8");
      showMultEffect(mult);
      playSound("mult", soundDelay);
    }
    if (s.type === "collect") {
      collectGain += 1;
      showAward("COLLECT", `${state.collect + collectGain}/${collectTarget}`, "#ffffff");
      showCollectProgress(state.collect + collectGain);
      playSound("collect", soundDelay);
    }
  }

  state.collect += collectGain;
  const base = scoreTotal;
  const win = base * mult * state.bet;

  if (state.mode === "bonus" && base > 0) {
    const bonusMult = rnd(bonusBigMultipliers);
    const finalMult = bonusMult * mult;
    const bonusWin = base * finalMult * state.bet;
    state.bonusTotal += bonusWin;
    state.lastDetail = `BONUS: PAY ${base} x ${finalMult} x BET ${state.bet} = ${bonusWin}`;
    showPayoutSequence(base * state.bet, finalMult, bonusWin);
    playSound("win");
    toast(state.lastDetail);
    return bonusWin;
  }

  if (win > 0) {
    const parts = [];
    if (scoreHits.length) parts.push(`PAY ${scoreHits.join("+")}`);
    const multText = multHits.length ? ` x ${multHits.join(" x ")}` : "";
    state.lastDetail = `${parts.join(" + ")}${multText} x BET ${state.bet} = ${win}`;
    playSound("win");
    toast(state.lastDetail);
  } else if (collectGain) {
    state.lastDetail = `COLLECT +${collectGain} (${state.collect}/${collectTarget})`;
    toast(state.lastDetail);
  } else {
    state.lastDetail = "No special candy dropped";
  }

  return win;
}

function enterBonus() {
  state.mode = "bonus";
  state.freeShots = 5;
  state.collect = 0;
  state.bonusTotal = 0;
  state.board = resetBoard(true);
  state.currentBall = { kind: "rainbow", color: "rainbow" };
  state.nextBall = { kind: "bomb", color: rnd(colors).key };
  state.lastDetail = "BONUS START: 5 Free Shots";
  document.body.classList.add("bonus-mode", "bonus-flash");
  setTimeout(() => document.body.classList.remove("bonus-flash"), 1400);
  setBgmMode("bonus");
  showAward("COLLECT BONUS", "5 FREE SHOTS", "#ffd166");
  playSound("bonus");
  toast(state.lastDetail);
}

function finishBonusIfNeeded() {
  if (state.mode === "bonus" && state.freeShots <= 0) {
    state.mode = "base";
    state.credit += state.bonusTotal;
    state.lastDetail = `BONUS END: Total ${state.bonusTotal}`;
    document.body.classList.remove("bonus-mode", "bonus-flash");
    setBgmMode("base");
    showAward("BONUS TOTAL", `${state.bonusTotal}`, "#ffd166");
    toast(state.lastDetail);
    state.bonusTotal = 0;
    state.board = resetBoard(false);
    state.currentBall = randomBall();
    state.nextBall = randomBall();
  }
}

function settlePlaced(cell, ball) {
  const placed = getBubble(cell.row, cell.col);
  let removed = [];

  if (ball.kind === "bomb") {
    removed = [cell, ...neighbors(cell.row, cell.col)].filter((p) => {
      const b = getBubble(p.row, p.col);
      return b && !b.special;
    });
    const xy = cellToXY(cell.row, cell.col);
    showShockwave(xy.x, xy.y, "#ff7a59");
    showAward("BOMB", "HIT + NEARBY", "#ff7a59");
  } else if (ball.kind === "color") {
    const convertTargets = [cell, ...neighbors(cell.row, cell.col)].filter((p) => {
      const b = getBubble(p.row, p.col);
      return b && !b.special;
    });
    convertTargets.forEach((p, index) => {
      const b = getBubble(p.row, p.col);
      if (!b) return;
      b.color = ball.color;
      const xy = cellToXY(p.row, p.col);
      burstAt(xy.x, xy.y, colorFor(ball.color).fill, 8);
      playSound("event", index * 0.025);
    });
    showAward("COLOR BALL", `${ball.color.toUpperCase()} CONVERT`, "#b46cff");
    const cluster = findCluster(cell, ball.color);
    if (cluster.length >= 3) removed = cluster;
  } else {
    const matchColor = ball.matchColor || ball.color;
    if (ball.kind === "rainbow") {
      showAward("RAINBOW", `${matchColor.toUpperCase()} COLOR`, "#b46cff");
    }
    const cluster = findCluster(cell, matchColor);
    if (cluster.length >= 3) removed = cluster;
  }

  const dropped = [];
  const animatedDrops = [];
  for (const p of removed) {
    const b = getBubble(p.row, p.col);
    if (!b) continue;
    const xy = cellToXY(p.row, p.col);
    burstAt(xy.x, xy.y, colorFor(b.color).fill, 10);
    if (b.special) dropped.push(b);
    setBubble(p.row, p.col, null);
  }
  if (removed.length) playSound("pop");

  const floating = findFloating();
  let normalDropped = 0;
  for (const p of floating) {
    const b = getBubble(p.row, p.col);
    if (!b) continue;
    if (b.special) dropped.push(b);
    else normalDropped += 1;
    const xy = cellToXY(p.row, p.col);
    animatedDrops.push({ bubble: b, x: xy.x, y: xy.y });
    setBubble(p.row, p.col, null);
  }

  const finishSettle = () => {
    triggerDropEvent(normalDropped);
    if (state.nextSpecialBall) state.currentBall = randomBall();
    const win = resolveSpecials(dropped, 1);
    state.lastWin = win;
    if (state.mode === "base") state.credit += win;
    refillTop();
    if (state.collect >= collectTarget && state.mode === "base") enterBonus();
    finishBonusIfNeeded();
    settling = false;
    updateUi();
  };

  if (animatedDrops.length) {
    settling = true;
    animatedDrops.forEach((item, index) => dropBubble(item.bubble, item.x, item.y, index * 2));
    toast(`DROP ${animatedDrops.length} candies`);
    setTimeout(finishSettle, 720);
  } else {
    finishSettle();
  }

  if (!removed.length && placed) {
    const xy = cellToXY(placed.row, placed.col);
    burstAt(xy.x, xy.y, "#ffffff", 4);
  }
}

function refillTop() {
  const minimum = state.mode === "bonus" ? 24 : 34;
  const refillTrigger = state.mode === "bonus" ? 28 : 42;
  const occupied = boardCount();
  if (state.mode === "bonus" && occupied < 18) {
    state.board = resetBoard(true);
    toast("NEW BONUS DROP SETUP");
    return;
  }
  if (occupied < refillTrigger) {
    const newRows = 2;
    for (let r = rows - 1; r >= newRows; r -= 1) {
      for (let c = 0; c < cols; c += 1) {
        const moved = getBubble(r - newRows, c);
        setBubble(r, c, moved);
        markPushAnimation(moved, r - newRows, c, 26);
      }
    }
    for (let r = 0; r < newRows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (r === 1 && chance(state.mode === "bonus" ? 0.12 : 0.28)) {
          setBubble(r, c, null);
          continue;
        }
        if (!hasGeneratedSupport(state.board, r, c)) {
          setBubble(r, c, null);
          continue;
        }
        const fresh = makeBubble(r, c, makeRefillSpecial(), clusteredColor(state.board, r, c));
        setBubble(r, c, fresh);
        markSpawnAnimation(fresh, newRows, 26);
      }
    }
    reinforceBoard(minimum);
  }

  const tooLow = state.board[rows - 1].some(Boolean) || state.board[rows - 2].some(Boolean);
  if (tooLow) {
    toast("Wall too low: board reset");
    state.board = resetBoard(state.mode === "bonus");
  }
}

function placeShot(x, y) {
  const nearby = xyToCell(x, y);
  const options = [nearby, ...neighbors(nearby.row, nearby.col)];
  let target = options.find((p) => !getBubble(p.row, p.col));
  if (!target) {
    target = { row: Math.min(rows - 1, nearby.row + 1), col: nearby.col };
  }
  if (getBubble(target.row, target.col)) return false;
  const ball = shot.ball;
  const color = shot.ball.kind === "rainbow" ? bestMatchColor(target.row, target.col) : shot.ball.color;
  if (ball.kind === "rainbow") ball.matchColor = color;
  setBubble(target.row, target.col, { row: target.row, col: target.col, color, special: null });
  settling = true;
  setTimeout(() => settlePlaced(target, ball), 220);
  return true;
}

function launch() {
  if (shot || settling) return;
  startBgm();
  playSound("shoot");
  if (state.mode === "base") {
    if (state.credit < state.bet) {
      toast("Not enough credit");
      return;
    }
    state.credit -= state.bet;
  } else {
    state.freeShots -= 1;
  }

  const origin = shooterPos();
  const dx = pointer.x - origin.x;
  const dy = Math.min(pointer.y - origin.y, -80);
  const len = Math.hypot(dx, dy) || 1;
  shot = {
    x: origin.x,
    y: origin.y,
    vx: (dx / len) * 12.2,
    vy: (dy / len) * 12.2,
    spin: (dx / len) * 0.18,
    angle: 0,
    ball: state.currentBall
  };
  state.currentBall = state.nextBall;
  state.nextBall = randomBall();
  updateUi();
}

function updateShot() {
  if (!shot) return;
  shot.x += shot.vx;
  shot.y += shot.vy;
  shot.angle += shot.spin || 0;
  if (shot.x < radius || shot.x > WORLD_WIDTH - radius) {
    shot.vx *= -0.98;
    shot.vy *= 0.995;
    shot.spin *= -1;
    shot.x = Math.max(radius, Math.min(WORLD_WIDTH - radius, shot.x));
  }
  if (shot.y < topPad) {
    placeShot(shot.x, topPad);
    shot = null;
    return;
  }

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const b = getBubble(r, c);
      if (!b) continue;
      const p = cellToXY(r, c);
      if (Math.hypot(shot.x - p.x, shot.y - p.y) < radius * 1.78) {
        if (shot.ball.kind === "bomb") {
          const target = xyToCell(shot.x, shot.y);
          if (!getBubble(target.row, target.col)) setBubble(target.row, target.col, { row: target.row, col: target.col, color: shot.ball.color, special: null });
          const ball = shot.ball;
          const settleTarget = getBubble(target.row, target.col) ? target : { row: r, col: c };
          settling = true;
          setTimeout(() => settlePlaced(settleTarget, ball), 220);
        } else {
          placeShot(shot.x, shot.y);
        }
        shot = null;
        return;
      }
    }
  }
}

function updateParticles() {
  state.board.flat().forEach((bubble) => {
    if (!bubble?.pushAnim) return;
    bubble.pushAnim.life -= 1;
    if (bubble.pushAnim.life <= 0) delete bubble.pushAnim;
  });

  particles = particles.filter((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= 1;
    return p.life > 0;
  });

  coinBursts = coinBursts.filter((coin) => {
    coin.x += coin.vx;
    coin.y += coin.vy;
    coin.vy += 0.18;
    coin.angle += coin.spin;
    coin.life -= 1;
    return coin.life > 0;
  });

  fallingBubbles = fallingBubbles.filter((item) => {
    if (item.delay > 0) {
      item.delay -= 1;
      return true;
    }
    item.y += item.vy;
    item.vy += 0.38;
    item.angle += item.spin;
    item.life -= 1;
    return item.y < WORLD_HEIGHT + radius * 3 && item.life > 0;
  });

  awardShows = awardShows.filter((item) => {
    item.life -= 1;
    item.scale += (1 - item.scale) * 0.15;
    return item.life > 0;
  });

  collectShows = collectShows.filter((item) => {
    item.life -= 1;
    item.scale += (1 - item.scale) * 0.16;
    return item.life > 0;
  });

  payoutShows = payoutShows.filter((item) => {
    item.life -= 1;
    item.scale += (1 - item.scale) * 0.14;
    return item.life > 0;
  });

  multShows = multShows.filter((item) => {
    item.radius += 5.4;
    item.angle += 0.16;
    item.life -= 1;
    return item.life > 0;
  });

  shockwaves = shockwaves.filter((item) => {
    item.radius += 4.8;
    item.life -= 1;
    return item.life > 0;
  });
}

function colorFor(key) {
  return colors.find((c) => c.key === key) || { fill: "#ffffff", shade: "#bdbdbd" };
}

function specialMeta(special) {
  if (special.type === "score") return { label: "PAY", sub: `${special.value}x`, fill: "#ffd166", ink: "#3b1b24" };
  if (special.type === "collect") return { label: "COL", sub: "+1", fill: "#ffffff", ink: "#3b1b65" };
  if (special.type === "mult") return { label: `x${special.value}`, sub: "MULT", fill: "#54f2c8", ink: "#12332d" };
  return { label: "?", sub: "", fill: "#ffffff", ink: "#2a1635" };
}

function drawSpecialCandy(x, y, r, special, scale = 1) {
  const rr = r * scale;
  const meta = specialMeta(special);
  const sprite = specialImages[special.type];
  if (sprite?.complete && sprite.naturalWidth) {
    const size = rr * 2.75;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    ctx.save();
    ctx.fillStyle = "rgba(32, 12, 42, 0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(x - rr * 0.72, y + rr * 0.34, rr * 1.44, rr * 0.52, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff7df";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.max(8, rr * 0.34)}px Arial`;
    ctx.fillText(meta.label, x, y + rr * 0.61);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.shadowColor = "rgba(255, 255, 255, 0.55)";
  ctx.shadowBlur = 9;
  ctx.fillStyle = meta.fill;
  ctx.strokeStyle = "rgba(58, 20, 70, 0.88)";
  ctx.lineWidth = 2.5;

  if (special.type === "collect") {
    ctx.beginPath();
    ctx.moveTo(x, y + rr * 0.78);
    ctx.bezierCurveTo(x - rr * 1.1, y + rr * 0.12, x - rr * 0.78, y - rr * 0.72, x, y - rr * 0.32);
    ctx.bezierCurveTo(x + rr * 0.78, y - rr * 0.72, x + rr * 1.1, y + rr * 0.12, x, y + rr * 0.78);
    ctx.fill();
    ctx.stroke();
  } else if (special.type === "mult") {
    ctx.beginPath();
    for (let i = 0; i < 12; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 12;
      const d = i % 2 ? rr * 0.66 : rr * 1.02;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, rr * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath();
    ctx.ellipse(x - rr * 0.3, y - rr * 0.38, rr * 0.32, rr * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = meta.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.max(10, rr * 0.46)}px Arial`;
  ctx.fillText(meta.label, x, y - rr * 0.08);
  ctx.font = `800 ${Math.max(8, rr * 0.3)}px Arial`;
  ctx.fillText(meta.sub, x, y + rr * 0.34);
  ctx.restore();
}

function drawCandy(x, y, r, colorKey, special, scale = 1) {
  const c = colorFor(colorKey);
  const rr = r * scale;
  if (special) {
    drawSpecialCandy(x, y, r, special, scale);
    return;
  }
  const sprite = candyImages[colorKey];
  if (sprite?.complete && sprite.naturalWidth) {
    const size = rr * 2.62;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
  } else {
    const grad = ctx.createRadialGradient(x - rr * 0.35, y - rr * 0.45, rr * 0.2, x, y, rr);
    grad.addColorStop(0, "#fff8");
    grad.addColorStop(0.25, c.fill);
    grad.addColorStop(1, c.shade);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.38)";
    ctx.beginPath();
    ctx.ellipse(x - rr * 0.28, y - rr * 0.35, rr * 0.23, rr * 0.12, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

}

function drawBall(ball, x, y, r) {
  if (ball.kind === "rainbow") {
    const slices = colors.map((c) => c.fill);
    slices.forEach((fill, i) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r, (i / slices.length) * Math.PI * 2, ((i + 1) / slices.length) * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    });
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }
  drawCandy(x, y, r, ball.color, null);
  if (ball.kind === "bomb") {
    ctx.fillStyle = "rgba(49, 14, 34, 0.86)";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.font = "900 17px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("B", x, y + 1);
  }
  if (ball.kind === "color") {
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(58, 20, 94, 0.86)";
    ctx.beginPath();
    ctx.roundRect(x - r * 0.62, y - r * 0.36, r * 1.24, r * 0.72, 7);
    ctx.fill();
    ctx.fillStyle = "#fff7df";
    ctx.font = `900 ${Math.max(11, r * 0.5)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("C", x, y + 1);
    ctx.restore();
  }
}

function shooterPos() {
  return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT - 42 };
}

function drawLauncher(origin) {
  ctx.save();
  ctx.fillStyle = "rgba(28, 9, 40, 0.45)";
  ctx.beginPath();
  ctx.ellipse(origin.x, WORLD_HEIGHT - 14, 92, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  if (launcherImage.complete && launcherImage.naturalWidth) {
    const w = 160;
    const h = 112;
    ctx.drawImage(launcherImage, origin.x - w / 2, WORLD_HEIGHT - h - 2, w, h);
  }
  ctx.fillStyle = "rgba(42, 14, 52, 0.82)";
  ctx.strokeStyle = "rgba(255,209,102,0.72)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y - 22, radius + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBoardFrame() {
  ctx.save();
  if (boardFrameImage.complete && boardFrameImage.naturalWidth) {
    ctx.drawImage(boardFrameImage, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.fillStyle = "rgba(28, 13, 42, 0.24)";
    ctx.fillRect(34, 20, WORLD_WIDTH - 68, WORLD_HEIGHT - 148);
    ctx.restore();
    return;
  }
  const top = 12;
  const bottom = WORLD_HEIGHT - 122;
  ctx.strokeStyle = "rgba(255, 209, 102, 0.46)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(11, top);
  ctx.lineTo(11, bottom);
  ctx.moveTo(WORLD_WIDTH - 11, top);
  ctx.lineTo(WORLD_WIDTH - 11, bottom);
  ctx.stroke();

  ctx.fillStyle = "rgba(37, 12, 48, 0.88)";
  ctx.strokeStyle = "rgba(255, 209, 102, 0.58)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(22, WORLD_HEIGHT - 118, WORLD_WIDTH - 44, 86, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 209, 102, 0.18)";
  ctx.beginPath();
  ctx.roundRect(38, WORLD_HEIGHT - 108, WORLD_WIDTH - 76, 12, 6);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  for (let x = 52; x < WORLD_WIDTH - 52; x += 34) {
    ctx.beginPath();
    ctx.arc(x, WORLD_HEIGHT - 102, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(
    viewport.ratio * viewport.scale,
    0,
    0,
    viewport.ratio * viewport.scale,
    viewport.ratio * viewport.offsetX,
    viewport.ratio * viewport.offsetY
  );
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.08)";
  for (let y = 88; y < WORLD_HEIGHT; y += 86) {
    ctx.fillRect(0, y, WORLD_WIDTH, 1);
  }
  ctx.restore();
  drawBoardFrame();

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const b = getBubble(r, c);
      if (!b) continue;
      const p = bubbleDrawXY(b);
      drawCandy(p.x, p.y, radius, b.color, b.special);
    }
  }

  fallingBubbles.forEach((item) => {
    if (item.delay > 0) return;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle);
    const alpha = Math.max(0, Math.min(1, item.life / 24));
    ctx.globalAlpha = alpha;
    drawCandy(0, 0, radius, item.bubble.color, item.bubble.special);
    ctx.restore();
  });

  const origin = shooterPos();
  if (!shot) {
    const dx = pointer.x - origin.x;
    const dy = Math.min(pointer.y - origin.y, -80);
    const len = Math.hypot(dx, dy) || 1;
    ctx.setLineDash([8, 9]);
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + (dx / len) * 155, origin.y + (dy / len) * 155);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawLauncher(origin);
  drawBall(state.currentBall, origin.x, origin.y - 24, radius);
  ctx.save();
  ctx.fillStyle = "rgba(44, 16, 55, 0.82)";
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(origin.x + 42, origin.y - 72, 58, 52, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffe4da";
  ctx.font = "800 9px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NEXT", origin.x + 71, origin.y - 62);
  drawBall(state.nextBall, origin.x + 71, origin.y - 43, radius * 0.62);
  ctx.restore();
  if (shot) {
    ctx.save();
    ctx.translate(shot.x, shot.y);
    ctx.rotate(shot.angle || 0);
    drawBall(shot.ball, 0, 0, radius);
    ctx.restore();
  }

  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life / 42);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  shockwaves.forEach((item) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, item.life / 34);
    ctx.strokeStyle = item.tone;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  coinBursts.forEach((coin) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, coin.life / 24));
    ctx.translate(coin.x, coin.y);
    ctx.rotate(coin.angle);
    ctx.fillStyle = "#ffd166";
    ctx.strokeStyle = "#fff7b0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8a4a14";
    ctx.font = "900 9px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 0, 0);
    ctx.restore();
  });

  multShows.forEach((item) => {
    const alpha = Math.max(0, Math.min(1, item.life / 24));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(WORLD_WIDTH / 2, 284);
    ctx.rotate(item.angle);
    ctx.strokeStyle = "#54f2c8";
    ctx.lineWidth = 5;
    ctx.setLineDash([16, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-item.angle);
    ctx.fillStyle = "rgba(18, 51, 45, 0.92)";
    ctx.strokeStyle = "#b8fff0";
    ctx.beginPath();
    ctx.roundRect(-72, -25, 144, 50, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 26px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`TOTAL x${item.value}`, 0, 2);
    ctx.restore();
  });

  if (state.mode === "bonus") {
    ctx.fillStyle = "rgba(255,209,102,.18)";
    ctx.fillRect(0, 0, WORLD_WIDTH, 7);
  }

  awardShows.forEach((item, index) => {
    const alpha = Math.min(1, item.life / 18);
    const y = 214 + index * 58;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(WORLD_WIDTH / 2, y);
    ctx.scale(item.scale, item.scale);
    ctx.fillStyle = "rgba(42, 14, 52, 0.92)";
    ctx.strokeStyle = item.tone;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-104, -28, 208, 56, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = item.tone;
    ctx.font = "900 15px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.label, 0, -8);
    ctx.fillStyle = "#fff";
    ctx.font = "900 24px Arial";
    ctx.fillText(item.value, 0, 14);
    ctx.restore();
  });

  collectShows.forEach((item, index) => {
    const alpha = Math.max(0, Math.min(1, item.life / 20));
    const progress = Math.min(1, item.value / item.target);
    const y = 146 + index * 46;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(WORLD_WIDTH / 2, y);
    ctx.scale(item.scale, item.scale);
    ctx.fillStyle = "rgba(42, 14, 52, 0.94)";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-118, -25, 236, 50, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "900 13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`COLLECT ${item.value}/${item.target}`, 0, -10);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.roundRect(-88, 3, 176, 12, 6);
    ctx.fill();
    ctx.fillStyle = progress >= 1 ? "#ffd166" : "#ffffff";
    ctx.beginPath();
    ctx.roundRect(-88, 3, 176 * progress, 12, 6);
    ctx.fill();
    ctx.restore();
  });

  payoutShows.forEach((item) => {
    const age = 145 - item.life;
    const alpha = Math.max(0, Math.min(1, item.life / 20, age / 10));
    const phase = age < 46 ? 0 : age < 92 ? 1 : 2;
    const title = phase === 0 ? "PAY TOTAL" : phase === 1 ? "RANDOM MULTIPLIER" : "BONUS WIN";
    const rollPool = [1, 2, 3, 5, 8, 10];
    const rollingMult = age < 84 ? rollPool[(Math.floor(age / 5) + item.rollSeed) % rollPool.length] : item.multiplier;
    const main = phase === 0 ? `${item.base}` : phase === 1 ? `x${rollingMult}` : `${item.total}`;
    const sub = phase === 0
      ? "Coins collected"
      : phase === 1
        ? `${item.base} x ${rollingMult}`
        : "Added to Bonus Total";
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(WORLD_WIDTH / 2, 358);
    ctx.scale(item.scale + (phase === 2 ? 0.08 : 0), item.scale + (phase === 2 ? 0.08 : 0));
    ctx.fillStyle = "rgba(42, 14, 52, 0.96)";
    ctx.strokeStyle = phase === 1 ? "#54f2c8" : "#ffd166";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-142, -52, 284, 104, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = phase === 1 ? "#b8fff0" : "#fff7c7";
    ctx.font = "900 15px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, 0, -27);
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${phase === 2 ? 34 : 30}px Arial`;
    ctx.fillText(main, 0, 4);
    ctx.fillStyle = "#ffe4da";
    ctx.font = "800 12px Arial";
    ctx.fillText(sub, 0, 32);
    if (phase === 1) {
      ctx.strokeStyle = "rgba(84, 242, 200, 0.5)";
      ctx.beginPath();
      ctx.arc(0, 4, 62 + Math.sin(age * 0.35) * 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function updateUi() {
  ui.credit.textContent = Math.floor(state.credit);
  ui.bet.textContent = state.bet;
  ui.win.textContent = `${state.lastWin}`;
  ui.winDetail.textContent = state.lastDetail;
  ui.collect.textContent = state.collect;
  ui.mode.textContent = state.mode === "bonus" ? "Bonus" : "Base";
  ui.freeShots.textContent = state.freeShots;
  ui.bonusStrip.classList.toggle("bonus", state.mode === "bonus");
  document.body.classList.toggle("bonus-mode", state.mode === "bonus");
  updateAudioButtons();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const scale = Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT);
  viewport = {
    scale,
    offsetX: (rect.width - WORLD_WIDTH * scale) / 2,
    offsetY: (rect.height - WORLD_HEIGHT * scale) / 2,
    ratio
  };
}

function pointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const touch = event.touches?.[0] || event;
  const x = (touch.clientX - rect.left - viewport.offsetX) / viewport.scale;
  const y = (touch.clientY - rect.top - viewport.offsetY) / viewport.scale;
  pointer = {
    x: Math.max(24, Math.min(WORLD_WIDTH - 24, x)),
    y: Math.max(40, Math.min(WORLD_HEIGHT - 110, y))
  };
}

function updateAudioButtons() {
  ui.bgmToggle.textContent = `BGM ${audioSettings.bgm ? "ON" : "OFF"}`;
  ui.sfxToggle.textContent = `SFX ${audioSettings.sfx ? "ON" : "OFF"}`;
}

function toggleMenu(force = null) {
  const open = force === null ? !ui.gameMenu.classList.contains("open") : force;
  ui.gameMenu.classList.toggle("open", open);
}

function forceCollectBonus() {
  if (shot || settling) return;
  if (state.mode === "bonus") {
    toast("Already in Free Game");
    return;
  }
  startBgm();
  settling = true;
  toggleMenu(false);
  const xs = [WORLD_WIDTH / 2 - 54, WORLD_WIDTH / 2, WORLD_WIDTH / 2 + 54];
  xs.forEach((x, index) => {
    const bubble = makeBubble(0, index, makeSpecial("collect"), "purple");
    dropBubble(bubble, x, 70 + index * 16, index * 8);
    showAward("COLLECT", `+${index + 1}/3`, "#ffffff");
    playSound("collect", index * 0.12);
  });
  state.collect = collectTarget;
  state.lastDetail = "TEST: 3 COL dropped -> Free Game";
  updateUi();
  toast(state.lastDetail);
  setTimeout(() => {
    enterBonus();
    settling = false;
    updateUi();
  }, 850);
}

canvas.addEventListener("pointermove", pointerFromEvent);
canvas.addEventListener("pointerdown", (event) => {
  pointerFromEvent(event);
});
canvas.addEventListener("pointerup", () => launch());
ui.shoot.addEventListener("click", launch);
ui.betDown.addEventListener("click", () => {
  state.bet = Math.max(100, state.bet - 100);
  updateUi();
});
ui.betUp.addEventListener("click", () => {
  state.bet = Math.min(10000, state.bet + 100);
  updateUi();
});
ui.menuButton.addEventListener("click", () => {
  startBgm();
  toggleMenu();
});
ui.forceCollect.addEventListener("click", forceCollectBonus);
ui.bgmToggle.addEventListener("click", () => {
  audioSettings.bgm = !audioSettings.bgm;
  if (audioSettings.bgm) startBgm();
  else stopBgm();
  updateAudioButtons();
});
ui.sfxToggle.addEventListener("click", () => {
  audioSettings.sfx = !audioSettings.sfx;
  if (audioSettings.sfx) playSound("event");
  updateAudioButtons();
});
document.addEventListener("pointerdown", (event) => {
  if (!ui.gameMenu.contains(event.target) && event.target !== ui.menuButton) toggleMenu(false);
});
window.addEventListener("resize", resizeCanvas);

function tick() {
  updateShot();
  updateParticles();
  draw();
  requestAnimationFrame(tick);
}

state = newState();
resizeCanvas();
updateUi();
toast("Drag to aim, release or tap SHOOT");
tick();
