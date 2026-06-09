const CONFIG = {
  boardCols: 5,
  boardRows: 4,
  initialBalance: 1000,
  betAmounts: [10, 20, 50],
  baseCandies: [
    { type: "level", level: 1, label: "L1" },
    { type: "level", level: 2, label: "L2" },
    { type: "level", level: 3, label: "L3" },
    { type: "level", level: 4, label: "L4" },
    { type: "level", level: 5, label: "L5" },
    { type: "level", level: 6, label: "L6" },
    { type: "level", level: 7, label: "L7" }
  ],
  probabilities: {
    10: [
      ["level:1", 68],
      ["level:2", 23],
      ["level:3", 7],
      ["level:4", 1.7],
      ["level:5", 0.3]
    ],
    20: [
      ["level:1", 63],
      ["level:2", 25],
      ["level:3", 9],
      ["level:4", 2.4],
      ["level:5", 0.6]
    ],
    50: [
      ["level:1", 56],
      ["level:2", 27],
      ["level:3", 12],
      ["level:4", 4],
      ["level:5", 1]
    ]
  },
  specialChance: 0.045,
  specialWeights: [
    ["bomb", 78],
    ["wild", 22]
  ],
  payout: {
    1: 0,
    2: 1,
    3: 1.7,
    4: 4,
    5: 12,
    6: 80,
    7: 420
  },
  comboMultiplier(combo) {
    if (combo >= 4) return 1.6;
    if (combo === 3) return 1.35;
    if (combo === 2) return 1.12;
    return 1;
  },
  jackpotTiers: [
    { label: "Mini Jackpot", shout: "MINI JACKPOT", max: 16, multiplier: 50 },
    { label: "Major Jackpot", shout: "MAJOR JACKPOT", max: 24, multiplier: 200 },
    { label: "Mega Jackpot", shout: "MEGA JACKPOT", max: 34, multiplier: 1000 }
  ],
  jackpotCharge: {
    4: 1,
    5: 2,
    6: 4,
    7: 7
  }
};

const ASSETS = {
  level: {
    1: "assets/candies/level-1.png",
    2: "assets/candies/level-2.png",
    3: "assets/candies/level-3.png",
    4: "assets/candies/level-4.png",
    5: "assets/candies/level-5.png",
    6: "assets/candies/level-6.png",
    7: "assets/candies/level-7.png"
  },
  bomb: "assets/candies/bomb.png",
  wild: "assets/candies/wild.png"
};

const state = {
  balance: CONFIG.initialBalance,
  core: 0,
  currentBet: 10,
  board: [],
  candidates: [],
  selectedCandidate: null,
  lastCoreWin: 0,
  lastCashOut: 0,
  maxCore: 0,
  jackpotEnergy: 0,
  jackpotTier: 0,
  combo: 1,
  gameOver: false,
  hasBetPending: false,
  isResolving: false,
  status: "Pick BET to start."
};

const els = {
  board: document.getElementById("board"),
  candidates: document.getElementById("candidates"),
  balance: document.getElementById("balance"),
  core: document.getElementById("core"),
  coreStat: document.getElementById("coreStat"),
  currentBet: document.getElementById("currentBet"),
  lastCoreWin: document.getElementById("lastCoreWin"),
  lastCashOut: document.getElementById("lastCashOut"),
  maxCore: document.getElementById("maxCore"),
  boardSpace: document.getElementById("boardSpace"),
  jackpotReactor: document.getElementById("jackpotReactor"),
  jackpotTier: document.getElementById("jackpotTier"),
  jackpotEnergy: document.getElementById("jackpotEnergy"),
  jackpotReward: document.getElementById("jackpotReward"),
  jackpotFill: document.getElementById("jackpotFill"),
  gameStatus: document.getElementById("gameStatus"),
  comboLabel: document.getElementById("comboLabel"),
  betButton: document.getElementById("betButton"),
  cashOutButton: document.getElementById("cashOutButton"),
  restartButton: document.getElementById("restartButton"),
  betOptions: Array.from(document.querySelectorAll(".bet-option")),
  introModal: document.getElementById("introModal"),
  introOk: document.getElementById("introOk"),
  paytableButton: document.getElementById("paytableButton"),
  paytableModal: document.getElementById("paytableModal"),
  closePaytable: document.getElementById("closePaytable"),
  paytableGrid: document.getElementById("paytableGrid"),
  messageModal: document.getElementById("messageModal"),
  messageTitle: document.getElementById("messageTitle"),
  messageBody: document.getElementById("messageBody"),
  messageOk: document.getElementById("messageOk")
};

function init() {
  els.board.style.setProperty("--board-cols", CONFIG.boardCols);
  els.board.style.setProperty("--board-rows", CONFIG.boardRows);
  startNewRound();
  bindEvents();
  renderPaytable();
  render();
  setTimeout(() => els.introModal.classList.remove("hidden"), 250);
}

function bindEvents() {
  els.betButton.addEventListener("click", startBetFlow);
  els.cashOutButton.addEventListener("click", cashOut);
  els.restartButton.addEventListener("click", restartDemo);
  els.introOk.addEventListener("click", () => els.introModal.classList.add("hidden"));
  els.paytableButton.addEventListener("click", () => els.paytableModal.classList.remove("hidden"));
  els.closePaytable.addEventListener("click", () => els.paytableModal.classList.add("hidden"));
  els.messageOk.addEventListener("click", () => els.messageModal.classList.add("hidden"));

  els.betOptions.forEach((button) => {
    button.addEventListener("click", () => {
      if (state.hasBetPending || state.gameOver) return;
      state.currentBet = Number(button.dataset.bet);
      state.status = `Bet changed to ${state.currentBet}.`;
      render();
    });
  });
}

function startBetFlow() {
  if (state.gameOver || state.hasBetPending || state.isResolving) return;
  if (state.balance < state.currentBet) {
    setGameOver("Balance is below Bet 10.");
    return;
  }
  state.balance -= state.currentBet;
  if (emptyIndexes().length === 0) {
    state.balance += state.currentBet;
    setGameOver("Board is full.");
    return;
  }

  state.lastCoreWin = 0;
  state.combo = 1;
  state.candidates = generateCandidates();
  state.selectedCandidate = null;
  state.hasBetPending = true;
  state.status = "Choose one candy, then place it on an empty tile.";
  playSound("bet");
  render();
}

function generateCandidates() {
  return Array.from({ length: 3 }, () => generateCandy());
}

function generateCandy() {
  if (Math.random() < CONFIG.specialChance) {
    return candyFromKey(weightedPick(CONFIG.specialWeights));
  }
  return candyFromKey(weightedPick(CONFIG.probabilities[state.currentBet]));
}

function candyFromKey(key) {
  if (key.startsWith("level:")) {
    const level = Number(key.split(":")[1]);
    return { type: "level", level, label: `L${level}` };
  }
  if (key === "bomb") return { type: "bomb", label: "B" };
  if (key === "wild") return { type: "wild", label: "W" };
  return { type: "level", level: 1, label: "L1" };
}

function weightedPick(entries) {
  const total = entries.reduce((sum, item) => sum + item[1], 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function placeCandy(index) {
  if (!state.hasBetPending || state.selectedCandidate === null || state.board[index] || state.gameOver) return;
  const candy = { ...state.candidates[state.selectedCandidate] };
  state.board[index] = candy;
  state.hasBetPending = false;
  state.isResolving = true;
  state.candidates = [];
  state.selectedCandidate = null;
  state.status = "Resolving board...";
  render();

  setTimeout(() => {
    const result = resolvePlacement(index, candy);
    finishTurn(result);
  }, 180);
}

function resolvePlacement(index, candy) {
  if (candy.type === "bomb") return resolveBomb(index);
  if (candy.type === "wild") return resolveWild(index);

  return resolveLevelMerges(index);
}

function resolveBomb(index) {
  const targets = [index, ...adjacentIndexes(index)].filter((tileIndex) => {
    const item = state.board[tileIndex];
    return Boolean(item);
  });
  targets.forEach((tileIndex) => {
    state.board[tileIndex] = null;
  });
  const win = Math.max(state.currentBet, targets.length * state.currentBet);
  playSound("merge");
  return { totalWin: win, merged: true, note: `Bomb cleared ${targets.length} tiles.` };
}

function resolveWild(index) {
  const neighbors = adjacentIndexes(index)
    .map((tileIndex) => ({ tileIndex, item: state.board[tileIndex] }))
    .filter(({ item }) => item && item.type === "level");

  if (!neighbors.length) {
    state.status = "Wild needs a neighboring level candy.";
    return { totalWin: 0, merged: false, note: "" };
  }

  const best = neighbors.sort((a, b) => b.item.level - a.item.level)[0];
  const newLevel = Math.min(best.item.level + 1, 7);
  state.board[best.tileIndex] = null;
  state.board[index] = { type: "level", level: newLevel, label: `L${newLevel}` };
  const win = Math.round(CONFIG.payout[newLevel] * state.currentBet * CONFIG.comboMultiplier(2));
  playSound(newLevel >= 5 ? "bigWin" : "merge");
  const jackpotResult = chargeJackpot(newLevel, 1);
  const chain = resolveLevelMerges(index);
  return { totalWin: win + jackpotResult.amount + chain.totalWin, merged: true, note: chain.note || jackpotResult.note || "Wild upgraded a neighbor." };
}

function resolveLevelMerges(startIndex) {
  let totalWin = 0;
  let merged = false;
  let note = "";
  let focusIndexes = [startIndex];

  for (let safety = 0; safety < 24; safety += 1) {
    const groups = findMergeGroups(focusIndexes);
    if (!groups.length) break;

    const created = [];
    groups.forEach((group) => {
      const upgrades = Math.floor(group.indexes.length / 3);
      const nextLevel = Math.min(group.level + 1, 7);
      const sorted = group.indexes.slice().sort((a, b) => distance(a, startIndex) - distance(b, startIndex));
      const upgradeTiles = sorted.slice(0, upgrades);

      group.indexes.forEach((tileIndex) => {
        state.board[tileIndex] = null;
      });
      upgradeTiles.forEach((tileIndex) => {
        state.board[tileIndex] = { type: "level", level: nextLevel, label: `L${nextLevel}` };
        created.push(tileIndex);
      });

      const extraCandyBonus = 1 + Math.max(0, group.indexes.length - upgrades * 3) * 0.35;
      const multiUpgradeBonus = 1 + Math.max(0, upgrades - 1) * 0.5;
      const quantityBonus = extraCandyBonus * multiUpgradeBonus;
      const win = Math.round(CONFIG.payout[nextLevel] * state.currentBet * upgrades * quantityBonus * CONFIG.comboMultiplier(state.combo));
      totalWin += win;
      state.combo += 1;
      merged = true;
      note = `${group.indexes.length} L${group.level} merged into ${upgrades} L${nextLevel}.`;
      const jackpotResult = chargeJackpot(nextLevel, upgrades);
      if (jackpotResult.amount) {
        totalWin += jackpotResult.amount;
        note = jackpotResult.note;
      } else if (jackpotResult.energyAdded) {
        note = `${note} Jackpot Energy +${jackpotResult.energyAdded}.`;
      }
      playSound(nextLevel >= 5 ? "bigWin" : "merge");
    });
    focusIndexes = created.filter((tileIndex) => state.board[tileIndex]?.type === "level");
    if (!focusIndexes.length) break;
  }

  return { totalWin, merged, note };
}

function findMergeGroups(focusIndexes) {
  const visited = new Set();
  const groups = [];
  const focusSet = new Set(focusIndexes);

  state.board.forEach((item, index) => {
    if (!item || item.type !== "level" || item.level >= 7 || visited.has(index)) return;
    const group = connectedSameLevel(index, item.level, visited);
    const touchesFocus = group.some((tileIndex) => focusSet.has(tileIndex) || adjacentIndexes(tileIndex).some((neighbor) => focusSet.has(neighbor)));
    if (group.length >= 3 && touchesFocus) {
      groups.push({ level: item.level, indexes: group });
    }
  });

  return groups;
}

function connectedSameLevel(startIndex, level, visited) {
  const stack = [startIndex];
  const group = [];
  visited.add(startIndex);

  while (stack.length) {
    const index = stack.pop();
    group.push(index);
    adjacentIndexes(index).forEach((neighbor) => {
      const item = state.board[neighbor];
      if (!visited.has(neighbor) && item && item.type === "level" && item.level === level) {
        visited.add(neighbor);
        stack.push(neighbor);
      }
    });
  }

  return group;
}

function distance(a, b) {
  const ar = Math.floor(a / CONFIG.boardCols);
  const ac = a % CONFIG.boardCols;
  const br = Math.floor(b / CONFIG.boardCols);
  const bc = b % CONFIG.boardCols;
  return Math.abs(ar - br) + Math.abs(ac - bc);
}

function chargeJackpot(level, count) {
  const energyAdded = (CONFIG.jackpotCharge[level] || 0) * count;
  if (!energyAdded) return { amount: 0, note: "", energyAdded: 0 };

  state.jackpotEnergy += energyAdded;
  animateJackpotCharge();
  let amount = 0;
  const triggered = [];

  while (state.jackpotEnergy >= currentJackpotTier().max) {
    const tier = currentJackpotTier();
    state.jackpotEnergy -= tier.max;
    const reward = tier.multiplier * state.currentBet;
    amount += reward;
    triggered.push(`${tier.shout} CORE +${reward}`);
    state.jackpotTier = (state.jackpotTier + 1) % CONFIG.jackpotTiers.length;
  }

  if (triggered.length) {
    playSound("jackpot");
    animateJackpotBurst(triggered[triggered.length - 1]);
  }

  return {
    amount,
    note: triggered.length ? triggered.join(" / ") : "",
    energyAdded
  };
}

function currentJackpotTier() {
  return CONFIG.jackpotTiers[state.jackpotTier];
}

function finishTurn(result) {
  state.isResolving = false;
  state.lastCoreWin = result.totalWin;
  if (result.totalWin > 0) {
    state.core += result.totalWin;
    state.maxCore = Math.max(state.maxCore, state.core);
    animateCore();
  }

  if (result.totalWin > 0 && result.note.includes("JACKPOT")) showMessage("JACKPOT CORE", result.note);
  else if (result.totalWin > 0) showMessage("Core Win", `+${result.totalWin} CORE`);

  const empty = emptyIndexes().length;
  if (empty <= 0) setGameOver("Board is full.");
  else if (state.balance < Math.min(...CONFIG.betAmounts)) setGameOver("Balance is below Bet 10.");
  else state.status = statusForIdle(result.merged);

  render();
}

function setGameOver(reason) {
  const lostCore = state.core;
  state.gameOver = true;
  state.hasBetPending = false;
  state.isResolving = false;
  state.candidates = [];
  state.core = 0;
  state.lastCoreWin = 0;
  state.maxCore = 0;
  state.status = `REACTOR BURST / GAME OVER. Lost Core: ${lostCore}. ${reason}`;
  playSound("gameOver");
  showMessage("REACTOR BURST / GAME OVER", `Lost Core: ${lostCore}. ${reason}`);
  render();
}

function restartDemo() {
  state.balance = CONFIG.initialBalance;
  state.core = 0;
  state.currentBet = 10;
  state.jackpotEnergy = 0;
  state.jackpotTier = 0;
  startNewRound();
  state.candidates = [];
  state.selectedCandidate = null;
  state.lastCoreWin = 0;
  state.lastCashOut = 0;
  state.maxCore = 0;
  state.combo = 1;
  state.gameOver = false;
  state.hasBetPending = false;
  state.isResolving = false;
  state.status = "Demo restarted. Pick BET to start.";
  render();
}

function cashOut() {
  if (!canCashOut()) return;
  const amount = state.core;
  state.balance += amount;
  state.lastCashOut = amount;
  state.core = 0;
  state.lastCoreWin = 0;
  state.maxCore = 0;
  state.combo = 1;
  startNewRound();
  state.status = `CASH OUT +${amount}. New round started.`;
  showMessage("CASH OUT", `+${amount}`);
  playSound("bigWin");
  render();
}

function canCashOut() {
  return state.core > 0 && !state.gameOver && !state.hasBetPending && !state.isResolving;
}

function startNewRound() {
  state.board = Array.from({ length: CONFIG.boardCols * CONFIG.boardRows }, () => null);
  state.candidates = [];
  state.selectedCandidate = null;
  seedLowCandies(6);
}

function seedLowCandies(count) {
  const open = emptyIndexes();
  for (let placed = 0; placed < count && open.length; placed += 1) {
    const pick = Math.floor(Math.random() * open.length);
    const index = open.splice(pick, 1)[0];
    const level = Math.random() < 0.78 ? 1 : 2;
    state.board[index] = { type: "level", level, label: `L${level}` };
  }
}

function render() {
  renderStats();
  renderBoard();
  renderCandidates();
  renderControls();
}

function renderStats() {
  const filled = state.board.filter(Boolean).length;
  els.balance.textContent = state.balance;
  els.core.textContent = state.core;
  els.currentBet.textContent = state.currentBet;
  els.lastCoreWin.textContent = state.lastCoreWin;
  els.lastCashOut.textContent = state.lastCashOut;
  els.maxCore.textContent = state.maxCore;
  els.boardSpace.textContent = `${filled} / ${state.board.length}`;
  els.gameStatus.textContent = state.status;
  els.comboLabel.textContent = `Combo x${state.combo}`;
  renderJackpotReactor();
  const glow = Math.min(30, 8 + Math.floor(state.core / 80));
  const alpha = Math.min(0.82, 0.18 + state.core / 2500);
  els.coreStat.style.setProperty("--core-glow", `${glow}px`);
  els.coreStat.style.setProperty("--core-alpha", alpha.toFixed(2));
}

function renderJackpotReactor() {
  const tier = currentJackpotTier();
  const percent = Math.min(100, Math.round((state.jackpotEnergy / tier.max) * 100));
  els.jackpotTier.textContent = tier.label;
  els.jackpotEnergy.textContent = `Energy: ${state.jackpotEnergy} / ${tier.max}`;
  els.jackpotReward.textContent = `${tier.multiplier}x Bet`;
  els.jackpotFill.style.width = `${percent}%`;
  const hot = percent >= 75;
  els.jackpotReactor.classList.toggle("reactor-hot", hot);
  els.jackpotReactor.style.setProperty("--jackpot-glow", `${hot ? 22 : 6}px`);
  els.jackpotReactor.style.setProperty("--jackpot-alpha", hot ? "0.62" : "0.18");
}

function renderBoard() {
  els.board.innerHTML = "";
  state.board.forEach((candy, index) => {
    const tile = document.createElement("button");
    tile.className = "tile";
    tile.type = "button";
    tile.setAttribute("aria-label", candy ? `${candy.label} candy` : `Empty tile ${index + 1}`);
    if (!candy && state.hasBetPending && state.selectedCandidate !== null) {
      tile.classList.add("selectable");
    }
    tile.disabled = Boolean(candy) || !state.hasBetPending || state.selectedCandidate === null;
    tile.addEventListener("click", () => placeCandy(index));
    if (candy) tile.append(createCandyElement(candy));
    els.board.append(tile);
  });
}

function renderCandidates() {
  els.candidates.innerHTML = "";
  if (!state.candidates.length) {
    for (let index = 0; index < 3; index += 1) {
      const placeholder = document.createElement("div");
      placeholder.className = "candidate";
      placeholder.textContent = "-";
      els.candidates.append(placeholder);
    }
    return;
  }

  state.candidates.forEach((candy, index) => {
    const button = document.createElement("button");
    button.className = "candidate";
    button.type = "button";
    button.setAttribute("aria-label", `Pick ${candy.label}`);
    if (state.selectedCandidate === index) button.classList.add("selected");
    button.append(createCandyElement(candy));
    button.addEventListener("click", () => {
      state.selectedCandidate = index;
      state.status = "Now place the selected candy on an empty tile.";
      render();
    });
    els.candidates.append(button);
  });
}

function renderControls() {
  els.betButton.disabled = state.gameOver || state.hasBetPending || state.isResolving || state.balance < state.currentBet;
  els.cashOutButton.disabled = !canCashOut();
  els.betOptions.forEach((button) => {
    const active = Number(button.dataset.bet) === state.currentBet;
    button.classList.toggle("active", active);
    button.disabled = state.hasBetPending || state.isResolving || state.gameOver;
  });
}

function renderPaytable() {
  const rows = [
    ["3 Same Level", "Merge into 1 next level"],
    ["6 / 9 Same Level", "Bonus chain upgrades"],
    ["L2", "1x Bet"],
    ["L3", "1.7x Bet"],
    ["L4", "4x Bet"],
    ["L5", "12x Bet"],
    ["L6", "80x Bet"],
    ["L7", "420x Bet"],
    ["Jackpot Reactor", "L4+ charges slower Energy"],
    ["Mini / Major / Mega", "16 / 24 / 34 Energy"],
    ["Bomb", "Clears nearby tiles"],
    ["Wild", "Rarely upgrades a neighbor"],
    ["Cash Out", "Moves Core to Balance"]
  ];
  els.paytableGrid.innerHTML = "";
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "pay-row";
    row.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
    els.paytableGrid.append(row);
  });
}

function createCandyElement(candy) {
  const element = document.createElement("img");
  const levelClass = candy.type === "level" ? `candy-level-${candy.level}` : "candy-special";
  element.className = `candy-img ${levelClass}`;
  element.alt = `${candy.label} candy`;
  element.draggable = false;
  element.src = getCandyAsset(candy);
  return element;
}

function getCandyAsset(candy) {
  if (candy.type === "level") return ASSETS.level[candy.level] || ASSETS.level[1];
  return ASSETS[candy.type] || ASSETS.level[1];
}

function adjacentIndexes(index) {
  const row = Math.floor(index / CONFIG.boardCols);
  const col = index % CONFIG.boardCols;
  const points = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1]
  ];
  return points
    .filter(([r, c]) => r >= 0 && c >= 0 && r < CONFIG.boardRows && c < CONFIG.boardCols)
    .map(([r, c]) => r * CONFIG.boardCols + c);
}

function emptyIndexes() {
  return state.board
    .map((item, index) => (item ? null : index))
    .filter((index) => index !== null);
}

function showMessage(title, body) {
  els.messageTitle.textContent = title;
  els.messageBody.textContent = body.trim() || "Keep going.";
  els.messageModal.classList.remove("hidden");
}

function statusForIdle(merged) {
  const empty = emptyIndexes().length;
  if (empty <= 5 && state.core > 0) return "Risk high! Cash Out or keep going?";
  if (state.core >= 5000) return "Mega Core. Cash Out or chase more?";
  if (state.core >= 1000) return "Huge Core. The reactor is glowing.";
  if (state.core >= 500) return "Big Core. Cash Out is available.";
  if (state.core >= 100) return "Nice Core. Cash Out is available.";
  if (merged) return "Core charged. Cash Out or press BET.";
  return "Candy placed. Cash Out or press BET.";
}

function animateCore() {
  els.coreStat.classList.remove("core-pop");
  void els.coreStat.offsetWidth;
  els.coreStat.classList.add("core-pop");
}

function animateJackpotCharge() {
  els.jackpotReactor.classList.remove("reactor-pop");
  void els.jackpotReactor.offsetWidth;
  els.jackpotReactor.classList.add("reactor-pop");
}

function animateJackpotBurst(note) {
  els.jackpotReactor.classList.remove("jackpot-burst");
  document.querySelector(".game-card").classList.remove("mega-shake");
  void els.jackpotReactor.offsetWidth;
  els.jackpotReactor.classList.add("jackpot-burst");
  if (note.includes("MEGA")) {
    document.querySelector(".game-card").classList.add("mega-shake");
  }
}

function playSound(type) {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const AudioApi = window.AudioContext || window.webkitAudioContext;
  const context = new AudioApi();
  const osc = context.createOscillator();
  const gain = context.createGain();
  const freqs = {
    bet: 300,
    merge: 520,
    bigWin: 720,
    jackpot: 980,
    gameOver: 150
  };
  osc.frequency.value = freqs[type] || 420;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.14);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start();
  osc.stop(context.currentTime + 0.16);
}

init();
