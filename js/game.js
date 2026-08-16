/* ============================================================
   Space Wars — web edition
   A faithful (and enhanced) remake of the original Pygame game.
   Plain HTML/CSS/JS — no build step. Open index.html and play.
   Logical playfield: 900x500, scaled responsively to any screen.
   ============================================================ */
'use strict';

/* ---------------- constants (logical units) ---------------- */
const W = 900, H = 500;
const SHIP_W = 50, SHIP_H = 67;          // sprite draw size
const HIT_W = 42, HIT_H = 46;            // ship collision box (centered)
const BASE_VEL = 144;                    // px/s (1 px/frame @ 144fps in the original)
const BULLET_VEL = BASE_VEL * 3;
const DODGE_DIST = 55;                   // blink distance per axis
const DODGE_COST = 45;
const DODGE_IMMUNE = 0.5;                // seconds of immunity
const STAM_DRAIN = 28.8;                 // gas per second while boosting
const STAM_REGEN = 28.8;
const BULLET_HIT_W = 16, BULLET_HIT_H = 10;

const DIFFICULTIES = {
  easy:       { label: 'Easy',       reward: 2.5, dodges: false, dodgeEz: false, evades: true,  seeks: false, botMods: {} },
  medium:     { label: 'Medium',     reward: 5,   dodges: true,  dodgeEz: true,  evades: false, seeks: true,  botMods: {} },
  hard:       { label: 'Hard',       reward: 10,  dodges: true,  dodgeEz: false, evades: true,  seeks: true,  botMods: {} },
  impossible: {
    label: 'Impossible', reward: 60, dodges: true, dodgeEz: false, evades: true, seeks: true,
    botMods: { health: 5, maxBullets: 10, aimbot: 2, infinity: true, velMult: 1.5 },
  },
};

/* win streaks (legacy modes): each consecutive win raises the reward
   multiplier, capped at x2 */
const STREAK_STEP = 0.25, STREAK_CAP = 4;
function streakMult(streak) {
  return 1 + STREAK_STEP * Math.max(0, Math.min(streak - 1, STREAK_CAP));
}

/* ---------------- campaign (roguelike run) ----------------
   15 levels on one continuous difficulty curve. Anchors: level 5 plays
   like the old "hard", level 15 like the old "impossible". Bot skills
   unlock one by one (evade → dodge → power-up hunting), then the bot
   trades health for speed, aim, and firepower — a glass cannon by 15.
   Your HP carries between levels; dying ends the run. */
const CAMPAIGN_MAX = 15;
function levelReward(lv) {
  return Math.round(1.5 * lv * (1 + lv / 10) * 2) / 2; // 1.5 → 11.5 → 56.5
}
function levelConfig(lv) {
  const post5 = Math.max(0, (lv - 5) / 10); // 0 at level 5 → 1 at level 15
  return {
    mode: 'campaign', level: lv,
    label: 'Level ' + lv,
    reward: levelReward(lv),
    evades: lv >= 2,
    dodges: lv >= 3,
    dodgeEz: lv >= 3 && lv < 5,
    seeks: lv >= 4,
    aggro: lv < 5 ? 0.6 + 0.1 * (lv - 1) : 1 + 0.35 * post5,
    botMods: {
      health: lv < 5 ? 6 + lv : Math.round(10 - 5 * post5),
      maxBullets: lv < 5 ? 1 + Math.floor(lv / 2) : Math.round(3 + 7 * post5),
      aimbot: lv < 5 ? 0.5 + 0.125 * (lv - 1) : 1 + post5,
      infinity: lv >= 13,
      velMult: lv < 5 ? 0.85 + 0.0375 * (lv - 1) : 1 + 0.5 * post5,
    },
  };
}
function legacyConfig(key) {
  const diff = DIFFICULTIES[key] || DIFFICULTIES.easy;
  return {
    mode: 'legacy',
    label: diff.label,
    reward: diff.reward,
    evades: diff.evades, dodges: diff.dodges, dodgeEz: diff.dodgeEz,
    seeks: diff.seeks, aggro: 1,
    botMods: diff.botMods,
  };
}

const UPGRADES = [
  { key: 'maxHealth',       name: 'Max Health',       cost: 10,  step: 1,   min: 1,  max: 99 },
  { key: 'maxStamina',      name: 'Max Gas',          cost: 10,  step: 10,  min: 10, max: 990 },
  { key: 'maxBullets',      name: 'Max Bullets',      cost: 25,  step: 1,   min: 1,  max: 50 },
  { key: 'aimbot',          name: 'Homing Power',     cost: 50,  step: 0.5, min: 0,  max: 20 },
  { key: 'infinityBullets', name: 'Infinite Bullets', cost: 150, toggle: true },
];

const DEFAULT_SAVE = {
  maxHealth: 10, maxStamina: 100, speedMulti: 1, maxBullets: 3,
  infinityBullets: false, aimbot: 1, money: 0,
  difficulty: 'easy', muted: false,
  streak: 0, bestStreak: 0,
  bestLevel: 0, run: null, // campaign: furthest level cleared + run in progress
};

function fmtMoney(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
}

/* ---------------- save / load (localStorage, lightly obfuscated
   in the spirit of the original Encryptor.py) ---------------- */
const SAVE_KEY = 'spacewars_save';
const XOR_KEY = 'E-10';

function xorStr(str) {
  let out = '';
  for (let i = 0; i < str.length; i++)
    out += String.fromCharCode(str.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
  return out;
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return Object.assign({}, DEFAULT_SAVE);
    const data = JSON.parse(xorStr(atob(raw)));
    return Object.assign({}, DEFAULT_SAVE, data);
  } catch (e) {
    return Object.assign({}, DEFAULT_SAVE);
  }
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, btoa(xorStr(JSON.stringify(save)))); }
  catch (e) { /* storage unavailable (private mode) — play without saving */ }
}
let save = loadSave();

/* ---------------- assets ---------------- */
const IMAGES = {};
const IMAGE_FILES = {
  yellowOn: 'spaceship_yellow.png', yellowHalf: 'spaceship_yellow_half.png', yellowOff: 'spaceship_yellow_off.png',
  redOn: 'spaceship_red.png', redHalf: 'spaceship_red_half.png', redOff: 'spaceship_red_off.png',
  yellowBullet: 'yellow_pixel.png', yellowBulletOff: 'yellow_pixel_off.png',
  redBullet: 'red_pixel.png', redBulletOff: 'red_pixel_off.png',
  bg1: 'space1.jpg', bg2: 'space2.jpg',
};
function loadImages() {
  const promises = Object.keys(IMAGE_FILES).map((key) => new Promise((resolve) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve; // fall back to vector shapes at draw time
    img.src = 'Assets/' + IMAGE_FILES[key];
    IMAGES[key] = img;
  }));
  return Promise.all(promises);
}
function imgReady(img) { return img && img.complete && img.naturalWidth > 0; }

/* sounds — small round-robin pools so overlapping shots all play */
function makeSound(file, volume, poolSize) {
  const pool = [];
  for (let i = 0; i < (poolSize || 6); i++) {
    const a = new Audio('Assets/' + file);
    a.volume = volume;
    a.preload = 'auto';
    pool.push(a);
  }
  let idx = 0;
  return {
    play() {
      if (save.muted) return;
      const a = pool[idx];
      idx = (idx + 1) % pool.length;
      try { a.currentTime = 0; a.play().catch(() => {}); } catch (e) {}
    }
  };
}
const SND = {
  fire: makeSound('Gun+Silencer.mp3', 0.25),
  hit: makeSound('Grenade+1.mp3', 0.25),
  dodge: makeSound('dodge.wav', 0.5, 3),
  pickup: makeSound('dodge.wav', 0.28, 3),
};

/* ---------------- canvas ---------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.min(vw / W, vh / H);
  const cssW = Math.floor(W * scale), cssH = Math.floor(H * scale);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);

  const portrait = vh > vw && vw < 700;
  document.getElementById('rotate-hint').classList.toggle('hidden', !portrait);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));

/* ---------------- input ---------------- */
const input = {
  up: false, down: false, left: false, right: false,
  boostKey: false, boostTouch: false, boostPad: false,
  fireQueued: false, dodgeQueued: false, multiQueued: false,
  joyX: 0, joyY: 0, padX: 0, padY: 0,
};
function clearQueued() {
  input.fireQueued = input.dodgeQueued = input.multiQueued = false;
}

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'boostKey', ShiftRight: 'boostKey',
};

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const dir = KEYMAP[e.code];
  if (dir) { input[dir] = true; e.preventDefault(); return; }
  if (state === 'playing') {
    if (e.code === 'Space') { input.dodgeQueued = true; e.preventDefault(); }
    else if (e.code === 'Enter' || e.code === 'KeyJ') input.fireQueued = true;
    else if (e.code === 'KeyB') input.multiQueued = true;
    else if (e.code === 'Escape') pauseGame();
  } else if (state === 'paused' && e.code === 'Escape') {
    resumeGame();
  }
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyF') toggleFullscreen();
});
window.addEventListener('keyup', (e) => {
  const dir = KEYMAP[e.code];
  if (dir) input[dir] = false;
});

canvas.addEventListener('mousedown', (e) => {
  if (state !== 'playing') return;
  if (e.button === 0) input.fireQueued = true;
  if (e.button === 2) input.multiQueued = true;
});
// right-click is a game action (barrage) — never show the context menu
window.addEventListener('contextmenu', (e) => e.preventDefault());

/* gamepad (the original supported joysticks — so do we) */
let padBtnPrev = [];
function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null;
  for (let i = 0; i < pads.length; i++) {
    if (pads[i] && pads[i].connected) { pad = pads[i]; break; }
  }
  if (!pad) return;

  const dead = 0.2;
  const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
  input.padX = Math.abs(ax) > dead ? ax : 0;
  input.padY = Math.abs(ay) > dead ? ay : 0;
  const pressed = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
  if (pressed(14)) input.padX = -1;
  if (pressed(15)) input.padX = 1;
  if (pressed(12)) input.padY = -1;
  if (pressed(13)) input.padY = 1;

  const justPressed = (i) => pressed(i) && !padBtnPrev[i];
  if (state === 'playing') {
    if (justPressed(0)) input.dodgeQueued = true;                  // A
    if (justPressed(2) || justPressed(1)) input.fireQueued = true; // X / B
    if (justPressed(3)) input.multiQueued = true;                  // Y
    input.boostPad = pressed(7) || pressed(6);                     // RT / LT
    if (justPressed(9)) pauseGame();                               // Start
  } else {
    input.boostPad = false;
    if (state === 'paused' && justPressed(9)) resumeGame();
  }
  padBtnPrev = pad.buttons.map((b) => b.pressed);
}

/* touch: floating joystick + action buttons */
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const joyZone = document.getElementById('joy-zone');
const joyBase = document.getElementById('joy-base');
const joyKnob = document.getElementById('joy-knob');
let joyPointer = null, joyCenter = { x: 0, y: 0 };

function setJoy(dx, dy) {
  const R = joyBase.offsetWidth / 2;
  const len = Math.hypot(dx, dy);
  const clamped = Math.min(len, R);
  const nx = len > 0 ? dx / len : 0, ny = len > 0 ? dy / len : 0;
  joyKnob.style.transform =
    'translate(calc(-50% + ' + nx * clamped + 'px), calc(-50% + ' + ny * clamped + 'px))';
  const mag = clamped / R;
  input.joyX = mag > 0.25 ? nx * mag : 0;
  input.joyY = mag > 0.25 ? ny * mag : 0;
}
joyZone.addEventListener('pointerdown', (e) => {
  joyPointer = e.pointerId;
  joyZone.setPointerCapture(e.pointerId);
  // re-anchor the stick wherever the finger lands (comfier than a fixed spot)
  const zr = joyZone.getBoundingClientRect();
  const half = joyBase.offsetWidth / 2;
  const bx = Math.min(Math.max(e.clientX - zr.left, half + 10), zr.width - half - 10);
  const by = Math.min(Math.max(e.clientY - zr.top, half + 10), zr.height - half - 10);
  joyBase.style.left = (bx - half) + 'px';
  joyBase.style.bottom = 'auto';
  joyBase.style.top = (by - half) + 'px';
  joyCenter = { x: e.clientX, y: e.clientY };
  setJoy(0, 0);
});
joyZone.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joyPointer) return;
  setJoy(e.clientX - joyCenter.x, e.clientY - joyCenter.y);
});
function joyEnd(e) {
  if (e.pointerId !== joyPointer) return;
  joyPointer = null;
  input.joyX = 0; input.joyY = 0;
  joyKnob.style.transform = 'translate(-50%, -50%)';
}
joyZone.addEventListener('pointerup', joyEnd);
joyZone.addEventListener('pointercancel', joyEnd);

document.querySelectorAll('.t-btn').forEach((btn) => {
  const action = btn.dataset.action;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (action === 'fire') input.fireQueued = true;
    else if (action === 'dodge') input.dodgeQueued = true;
    else if (action === 'multi') input.multiQueued = true;
    else if (action === 'boost') input.boostTouch = true;
  });
  const release = () => { if (action === 'boost') input.boostTouch = false; };
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);
});

/* ---------------- effects: particles + screen shake ---------------- */
let particles = [];
function spawnExplosion(x, y, color) {
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 240;
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.35 + Math.random() * 0.4, maxLife: 0.75,
      size: 2 + Math.random() * 3.5, color,
    });
  }
}
function spawnDodgeTrail(cx, cy, color) {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x: cx + (Math.random() - 0.5) * SHIP_W,
      y: cy + (Math.random() - 0.5) * SHIP_H,
      vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80,
      life: 0.3 + Math.random() * 0.25, maxLife: 0.55,
      size: 2 + Math.random() * 2, color,
    });
  }
}
function spawnEngineTrail(cx, cy, mx, my, color) {
  if (Math.random() > 0.6) return;
  particles.push({
    x: cx + (Math.random() - 0.5) * 14,
    y: cy + (Math.random() - 0.5) * 14,
    vx: (Math.random() - 0.5) * 30 - mx * 20,
    vy: (Math.random() - 0.5) * 30 - my * 20,
    life: 0.25 + Math.random() * 0.2, maxLife: 0.45,
    size: 1.5 + Math.random() * 2, color,
  });
}
function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
  if (particles.length > 400) particles.splice(0, particles.length - 400);
}

let shake = 0;
function addShake(amount) { shake = Math.min(1, shake + amount); }

/* ---------------- Ship ---------------- */
class Ship {
  constructor(side, opts) {
    this.side = side;                       // 'yellow' | 'red'
    this.x = 0; this.y = 0;                 // top-left of sprite box
    this.maxHealth = opts.maxHealth;
    this.health = opts.maxHealth;
    this.maxStamina = opts.maxStamina;
    this.stamina = opts.maxStamina;
    this.maxBullets = opts.maxBullets;
    this.aimbot = opts.aimbot;
    this.infinity = opts.infinity;
    this.normalVel = BASE_VEL * (opts.velMult || 1);
    this.vel = this.normalVel;
    this.bullets = [];
    this.boosting = false;
    this.moveX = 0; this.moveY = 0;         // last frame's movement in px
    this.immuneTimer = 0;
    this.runTimer = 0;                      // bot evasive-boost window
    this.fireCooldown = 0;                  // bot aimed-fire cooldown
    this.hitFlash = 0;
    this.rapidTimer = 0;                    // ammo-surge power-up window
  }
  get cx() { return this.x + SHIP_W / 2; }
  get cy() { return this.y + SHIP_H / 2; }
  get immune() { return this.immuneTimer > 0; }
  /* max bullets in flight, counting an active ammo surge */
  get effMaxBullets() { return this.maxBullets + (this.rapidTimer > 0 ? 3 : 0); }

  tickTimers(dt) {
    this.immuneTimer = Math.max(0, this.immuneTimer - dt);
    this.runTimer = Math.max(0, this.runTimer - dt);
    this.fireCooldown -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.rapidTimer = Math.max(0, this.rapidTimer - dt);
  }

  applyBoost(wantBoost, dt) {
    if (wantBoost && this.stamina > 1) {
      this.stamina = Math.max(0, this.stamina - STAM_DRAIN * dt);
      this.boosting = this.stamina > 10;
      this.vel = this.boosting ? this.normalVel * 2 : this.normalVel;
    } else {
      this.vel = this.normalVel;
      this.boosting = false;
      this.stamina = Math.min(this.maxStamina, this.stamina + STAM_REGEN * dt);
    }
  }

  /* keep each ship on its own half; wrap vertically like the original */
  clampAndWrap() {
    if (this.side === 'yellow') {
      this.x = Math.max(0, Math.min(this.x, W / 2 - SHIP_W - 8));
    } else {
      this.x = Math.max(W / 2 + 8, Math.min(this.x, W - SHIP_W));
    }
    if (this.y + SHIP_H < -10) this.y = H - 10;
    if (this.y > H + 10) this.y = -SHIP_H + 10;
  }

  dodge(ezRefund) {
    if (this.stamina <= DODGE_COST) return false;
    if (this.moveX === 0 && this.moveY === 0) return false; // must be moving
    this.stamina -= DODGE_COST;
    if (ezRefund) this.stamina += 15;
    if (this.moveX < 0) this.x -= DODGE_DIST;
    if (this.moveX > 0) this.x += DODGE_DIST;
    if (this.moveY < 0) this.y -= DODGE_DIST;
    if (this.moveY > 0) this.y += DODGE_DIST;
    this.immuneTimer = DODGE_IMMUNE;
    this.clampAndWrap();
    SND.dodge.play();
    spawnDodgeTrail(this.cx, this.cy, this.side === 'yellow' ? '#aab4ff' : '#ffb08a');
    if (!botBattle && this === yellow) matchStats.dodges++;
    return true;
  }

  fire(opts) {
    opts = opts || {};
    if (this.bullets.length >= this.effMaxBullets) return false;
    const dir = this.side === 'yellow' ? 1 : -1;
    this.bullets.push({
      x: this.side === 'yellow' ? this.x + SHIP_W : this.x,
      y: opts.y !== undefined ? opts.y : this.cy,
      dir,
      speed: opts.speed || BULLET_VEL,
      aimbot: opts.aimbot !== undefined ? opts.aimbot : this.aimbot,
      lastDx: dir, lastDy: 0,
      passed: false, // true once past the target: stops homing, dims the sprite
    });
    if (!opts.silent) SND.fire.play();
    if (!botBattle && this === yellow) matchStats.shots++;
    return true;
  }

  /* barrage: a vertical spread of fast, non-homing rockets */
  multiFire() {
    const splits = this.effMaxBullets - this.bullets.length - 1;
    if (splits <= 0) return false;
    const count = Math.min(splits + 1, 5);
    let played = false;
    for (let i = 0; i < count; i++) {
      const y = (H / (count + 1)) * (i + 1);
      if (this.fire({ y, speed: BULLET_VEL * 1.75, aimbot: 0, silent: played })) played = true;
    }
    return played;
  }
}

/* ---------------- game state ---------------- */
let state = 'menu';        // menu | playing | paused | gameover
let now = 0;               // in-game seconds (excludes pauses)
let yellow = null, red = null;
let battle = null;         // active battle config (campaign level or legacy)
let botBattle = false;
let started = false;       // intro fly-in finished
let winner = null;         // 'yellow' | 'red'
let winnerTimer = 0;
let lastReward = 0;
let lastBreakdown = null;  // reward rows for the game-over screen
let lostStreak = 0;        // streak size lost on the last defeat
let runOutcome = null;     // 'advance' | 'complete' | 'over' (campaign only)
let runTotal = 0;          // credits earned across the whole run
let bgScroll1 = 0, bgScroll2 = 0;
let hitStop = 0;           // brief freeze-frame on every hit (real seconds)
let slowMo = 0;            // slow-motion window after the killing blow
let matchStats = { shots: 0, hits: 0, dodges: 0, dmgTaken: 0 };

/* floating combat text (damage numbers, pickups, bonuses) */
let floaters = [];
function spawnFloater(x, y, text, color, size) {
  floaters.push({
    x: Math.max(50, Math.min(W - 50, x)), y,
    text, color: color || '#ffffff', size: size || 13,
    life: 1, vy: -36,
  });
}
function updateFloaters(dt) {
  for (const f of floaters) {
    f.y += f.vy * dt;
    f.vy *= Math.max(0, 1 - 1.6 * dt);
    f.life -= dt;
  }
  floaters = floaters.filter((f) => f.life > 0);
}
function drawFloaters() {
  for (const f of floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.45));
    ctx.fillStyle = f.color;
    ctx.font = '500 ' + f.size + 'px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

/* supply drops: spawn on the divider and drift into the player's half —
   they're a reward for the player, never a gift to the enemy. In bot
   battles they drift to either side and smarter bots hunt them down. */
const POWERUP_TYPES = {
  repair: { color: '#33d17a' },
  gas:    { color: '#ffffff' },
  ammo:   { color: '#ffd23f' },
};
let powerups = [], powerupTimer = 0;
function spawnPowerup() {
  const keys = Object.keys(POWERUP_TYPES);
  powerups.push({
    type: keys[Math.floor(Math.random() * keys.length)],
    x: W / 2,
    baseY: 70 + Math.random() * (H - 140), y: 0,
    phase: Math.random() * Math.PI * 2,
    vx: (botBattle ? (Math.random() < 0.5 ? -1 : 1) : -1) * (28 + Math.random() * 26),
    life: 14,
  });
}
function applyPowerup(ship, pu) {
  if (pu.type === 'repair') {
    ship.health = Math.min(ship.maxHealth, ship.health + 2);
    spawnFloater(pu.x, pu.y - 16, '+2 HP', '#33d17a');
  } else if (pu.type === 'gas') {
    ship.stamina = ship.maxStamina;
    spawnFloater(pu.x, pu.y - 16, 'GAS 100%', '#ffffff');
  } else {
    ship.rapidTimer = 8;
    spawnFloater(pu.x, pu.y - 16, 'AMMO +3', '#ffd23f');
  }
  SND.pickup.play();
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 30 + Math.random() * 70;
    particles.push({
      x: pu.x, y: pu.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.25 + Math.random() * 0.2, maxLife: 0.45,
      size: 1.5 + Math.random() * 2, color: POWERUP_TYPES[pu.type].color,
    });
  }
}
function updatePowerups(dt) {
  powerupTimer -= dt;
  if (powerupTimer <= 0) {
    if (powerups.length < 2) spawnPowerup();
    powerupTimer = 7 + Math.random() * 5;
  }
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pu = powerups[i];
    pu.x += pu.vx * dt;
    pu.y = pu.baseY + Math.sin(now * 2 + pu.phase) * 10;
    pu.life -= dt;
    if (pu.life <= 0 || pu.x < -20 || pu.x > W + 20) { powerups.splice(i, 1); continue; }
    for (const ship of [yellow, red]) {
      if (rectsOverlap(pu.x - 14, pu.y - 14, 28, 28,
                       ship.cx - HIT_W / 2, ship.cy - HIT_H / 2, HIT_W, HIT_H)) {
        applyPowerup(ship, pu);
        powerups.splice(i, 1);
        break;
      }
    }
  }
}
function drawPowerups() {
  for (const pu of powerups) {
    const c = POWERUP_TYPES[pu.type].color;
    ctx.save();
    ctx.translate(pu.x, pu.y);
    // blink when about to expire
    ctx.globalAlpha = pu.life < 3 && Math.sin(now * 12) > 0 ? 0.35 : 1;
    ctx.fillStyle = 'rgba(15,15,15,0.75)';
    ctx.beginPath(); ctx.arc(0, 0, 12.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = c;
    if (pu.type === 'repair') {
      ctx.fillRect(-1.5, -6, 3, 12);
      ctx.fillRect(-6, -1.5, 12, 3);
    } else if (pu.type === 'gas') {
      ctx.beginPath();
      ctx.moveTo(2, -7); ctx.lineTo(-4, 1); ctx.lineTo(-1, 1);
      ctx.lineTo(-2, 7); ctx.lineTo(4, -1); ctx.lineTo(1, -1);
      ctx.closePath(); ctx.fill();
    } else {
      for (let i = 0; i < 3; i++) ctx.fillRect(-6.5 + i * 5, -5, 2.5, 10);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* extra deep-space star layer (enhancement) */
const stars = [];
for (let i = 0; i < 60; i++) {
  stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.6 + 0.4, v: 8 + Math.random() * 24 });
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function beginBattle(cfg, opts) {
  opts = opts || {};
  battle = cfg;
  botBattle = !!opts.botBattle;

  yellow = new Ship('yellow', {
    maxHealth: save.maxHealth,
    maxStamina: save.maxStamina,
    maxBullets: save.maxBullets,
    aimbot: save.aimbot,
    infinity: save.infinityBullets,
    velMult: save.speedMulti,
  });
  if (opts.hp !== undefined) {
    yellow.health = Math.max(1, Math.min(opts.hp, yellow.maxHealth));
  }
  const mods = cfg.botMods;
  red = new Ship('red', {
    maxHealth: mods.health || 10,
    maxStamina: 100,
    maxBullets: mods.maxBullets || 3,
    aimbot: mods.aimbot !== undefined ? mods.aimbot : 1,
    infinity: !!mods.infinity,
    velMult: mods.velMult || 1,
  });

  yellow.x = -SHIP_H - 50; yellow.y = H / 2 - SHIP_H / 2;
  red.x = W + 50;          red.y = H / 2 - SHIP_H / 2;

  started = false;
  winner = null;
  now = 0;
  particles = [];
  floaters = [];
  powerups = [];
  powerupTimer = 5;
  hitStop = 0;
  slowMo = 0;
  matchStats = { shots: 0, hits: 0, dodges: 0, dmgTaken: 0 };
  shake = 0;
  clearQueued();

  showOnly(null);
  document.getElementById('gamebar').classList.remove('hidden');
  if (isTouchDevice) document.getElementById('touch').classList.remove('hidden');
  lastTime = performance.now();
  state = 'playing';
}

function startGame(asBotBattle) {
  beginBattle(legacyConfig(save.difficulty), { botBattle: asBotBattle });
}

/* start or continue a campaign run (survives page reloads via the save) */
function startRun() {
  if (!save.run) {
    save.run = { level: 1, hp: save.maxHealth, earned: 0 };
    persist();
  }
  beginBattle(levelConfig(save.run.level), { hp: save.run.hp });
}

function endToMenu() {
  state = 'menu';
  document.getElementById('gamebar').classList.add('hidden');
  document.getElementById('touch').classList.add('hidden');
  renderMenu();
  showOnly('menu');
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  showOnly('pause');
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  showOnly(null);
  lastTime = performance.now(); // paused time doesn't count as dt
}

function onWin(who) {
  winner = who;
  winnerTimer = 1.4;
  slowMo = 0.7; // savor the killing blow
  lastReward = 0;
  lastBreakdown = null;
  lostStreak = 0;
  runOutcome = null;

  /* skill bonuses shared by both modes */
  function bonusRows(rows) {
    let pct = 0;
    if (matchStats.dmgTaken === 0) { rows.push({ label: 'Flawless', value: '+50%' }); pct += 0.5; }
    if (now <= 30) { rows.push({ label: 'Quick win · under 30s', value: '+25%' }); pct += 0.25; }
    const acc = matchStats.shots > 0 ? matchStats.hits / matchStats.shots : 0;
    if (matchStats.shots >= 5 && acc >= 0.6) { rows.push({ label: 'Sharpshooter · ' + Math.round(acc * 100) + '%', value: '+25%' }); pct += 0.25; }
    return pct;
  }

  if (battle.mode === 'campaign') {
    if (who === 'yellow') {
      const lv = battle.level;
      save.bestLevel = Math.max(save.bestLevel, lv);
      const rows = [{ label: 'Level ' + lv + ' clear', value: '+' + fmtMoney(battle.reward) }];
      const bonusPct = bonusRows(rows);
      // round to the nearest 0.5 credit so totals stay tidy
      lastReward = Math.round(battle.reward * (1 + bonusPct) * 2) / 2;
      rows.push({ label: 'Total', value: '+' + fmtMoney(lastReward), total: true });
      lastBreakdown = rows;
      save.money = Math.round((save.money + lastReward) * 100) / 100;
      runTotal = (save.run ? save.run.earned : 0) + lastReward;
      if (lv >= CAMPAIGN_MAX) {
        runOutcome = 'complete';
        save.run = null;
      } else {
        runOutcome = 'advance';
        // small patch-up between levels — the rest of your HP carries over
        save.run = {
          level: lv + 1,
          hp: Math.min(yellow.maxHealth, yellow.health + 3),
          earned: runTotal,
        };
      }
    } else {
      runOutcome = 'over';
      runTotal = save.run ? save.run.earned : 0;
      save.run = null;
    }
    persist();
  } else if (!botBattle) {
    if (who === 'yellow') {
      save.streak += 1;
      save.bestStreak = Math.max(save.bestStreak, save.streak);
      const mult = streakMult(save.streak);
      const rows = [{ label: battle.label + ' win', value: '+' + fmtMoney(battle.reward) }];
      if (mult > 1) rows.push({ label: 'Win streak · ' + save.streak, value: 'x' + mult });
      const bonusPct = bonusRows(rows);
      lastReward = Math.round(battle.reward * mult * (1 + bonusPct) * 2) / 2;
      rows.push({ label: 'Total', value: '+' + fmtMoney(lastReward), total: true });
      lastBreakdown = rows;
      save.money = Math.round((save.money + lastReward) * 100) / 100;
    } else {
      lostStreak = save.streak;
      save.streak = 0;
    }
    persist();
  }
  addShake(1);
  const loser = who === 'yellow' ? red : yellow;
  spawnExplosion(loser.cx, loser.cy, who === 'yellow' ? '#ff5a5a' : '#ffd23f');
  spawnExplosion(loser.cx, loser.cy, '#ffffff');
}

/* ---------------- bot AI (ported from the Pygame version) ----------------
   behavior flags and aggression come from the active battle config, so the
   campaign can dial the bot up level by level */
function runBot(bot, target, dt) {
  const diff = battle;
  const prevX = bot.x, prevY = bot.y;

  // 1) evasive boost when a bullet is closing in
  if (diff.evades && bot.runTimer <= 0) {
    for (const b of target.bullets) {
      if (Math.abs(b.y - bot.cy) < H / 10 && Math.abs(b.x - bot.cx) < W / 6) {
        bot.runTimer = 0.25;
        break;
      }
    }
  }
  const running = bot.runTimer > 0;
  bot.applyBoost(running, dt);

  // 2) movement: track the player's height; hug own wall unless evading.
  //    smarter bots break formation to grab supply drops in their half
  const step = bot.vel * dt;
  const chaseY = bot.cy >= target.cy ? -1 : 1;
  let seek = null;
  if (diff.seeks && !running) {
    for (const pu of powerups) {
      const inMyHalf = bot.side === 'red' ? pu.x > W / 2 + 30 : pu.x < W / 2 - 30;
      if (inMyHalf && (!seek || Math.abs(pu.x - bot.cx) < Math.abs(seek.x - bot.cx))) seek = pu;
    }
  }
  if (seek) {
    bot.y += Math.sign(seek.y - bot.cy) * step;
    bot.x += Math.sign(seek.x - bot.cx) * step;
  } else {
    bot.y += (running ? -chaseY : chaseY) * step;
    const retreatX = bot.side === 'red' ? 1 : -1;
    bot.x += (running ? -retreatX : retreatX) * step;
  }

  // 3) dodge blink when a bullet is about to hit (medium/hard/impossible)
  if (diff.dodges) {
    const yWin = diff.dodgeEz ? H / 14 : H / 16.66;
    for (const b of target.bullets) {
      if (Math.abs(b.y - bot.cy) < yWin && Math.abs(b.x - bot.cx) < W / 12.85) {
        bot.moveX = bot.x - prevX;
        bot.moveY = bot.y - prevY;
        if (bot.moveX === 0 && bot.moveY === 0) bot.moveY = chaseY * step;
        bot.dodge(diff.dodgeEz);
        break;
      }
    }
  }

  // 4) shooting: aimed shots when lined up, plus random pot-shots and barrages
  //    (aggro scales fire rates across the campaign)
  if (Math.abs(target.cy - bot.cy) < H / 5 && bot.fireCooldown <= 0) {
    bot.fire();
    bot.fireCooldown = (0.1 + Math.random() * 0.4) / diff.aggro;
  }
  if (Math.random() < 0.57 * diff.aggro * dt) bot.fire();
  if (Math.random() < 0.9 * diff.aggro * dt && bot.bullets.length <= bot.maxBullets - 2) bot.multiFire();

  bot.clampAndWrap();
  bot.moveX = bot.x - prevX;
  bot.moveY = bot.y - prevY;
  if (Math.abs(bot.moveX) > 0.01 || Math.abs(bot.moveY) > 0.01) {
    spawnEngineTrail(bot.cx, bot.cy, bot.moveX, bot.moveY,
      bot.side === 'yellow' ? 'rgba(255,190,60,0.9)' : 'rgba(255,110,80,0.9)');
  }
}

/* ---------------- player movement ---------------- */
function handlePlayer(dt) {
  const p = yellow;
  const prevX = p.x, prevY = p.y;

  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.joyX + input.padX;
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0) + input.joyY + input.padY;
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }

  p.applyBoost((input.boostKey || input.boostTouch || input.boostPad) && len > 0.01, dt);
  p.x += dx * p.vel * dt;
  p.y += dy * p.vel * dt;
  p.clampAndWrap();
  p.moveX = p.x - prevX;
  p.moveY = p.y - prevY;

  if (input.dodgeQueued) { input.dodgeQueued = false; p.dodge(); }
  if (input.fireQueued) { input.fireQueued = false; p.fire(); }
  if (input.multiQueued) { input.multiQueued = false; p.multiFire(); }

  if (Math.abs(p.moveX) > 0.01 || Math.abs(p.moveY) > 0.01) {
    spawnEngineTrail(p.cx, p.cy, p.moveX, p.moveY, 'rgba(255,190,60,0.9)');
  }
}

/* ---------------- bullets ---------------- */
function updateBullets(shooter, target, dt) {
  const bullets = shooter.bullets;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const px = b.x, py = b.y;
    b.x += b.dir * b.speed * dt;

    // homing: steer toward the target while still in front of it
    const inFront = b.dir === 1 ? b.x < target.cx : b.x > target.cx;
    b.passed = !inFront;
    if (inFront && b.aimbot > 0) {
      const wanted = target.cy - b.y;
      const maxStep = BASE_VEL * b.aimbot * dt;
      b.y += Math.max(-maxStep, Math.min(maxStep, wanted));
    }
    b.lastDx = b.x - px; b.lastDy = b.y - py;

    // collision
    if (!target.immune && !winner &&
        rectsOverlap(b.x - BULLET_HIT_W / 2, b.y - BULLET_HIT_H / 2, BULLET_HIT_W, BULLET_HIT_H,
                     target.cx - HIT_W / 2, target.cy - HIT_H / 2, HIT_W, HIT_H)) {
      bullets.splice(i, 1);
      target.health -= 1;
      target.hitFlash = 0.18;
      hitStop = Math.max(hitStop, 0.045); // freeze-frame: makes hits feel weighty
      if (!botBattle) {
        if (shooter === yellow) matchStats.hits++;
        else matchStats.dmgTaken++;
      }
      spawnFloater(b.x, b.y - 12, '-1', target.side === 'yellow' ? '#ff4d4d' : '#ffffff', 12);
      SND.hit.play();
      addShake(target.side === 'yellow' ? 0.5 : 0.3);
      spawnExplosion(b.x, b.y, target.side === 'yellow' ? '#ffd23f' : '#ff5a5a');
      continue;
    }

    // off-screen: recycle (infinite bullets) or remove
    if (b.dir === 1 && b.x > W + 20) {
      if (shooter.infinity) b.x = -30 - Math.random() * 20;
      else bullets.splice(i, 1);
    } else if (b.dir === -1 && b.x < -20) {
      if (shooter.infinity) b.x = W + 5 + Math.random() * 20;
      else bullets.splice(i, 1);
    }
  }
}

/* ---------------- update ---------------- */
let lastTime = performance.now();
function update(dt) {
  now += dt;
  pollGamepad();

  // parallax scrolling (bottom strip scrolls faster, like the original)
  if (!winner) {
    bgScroll2 = (bgScroll2 + BASE_VEL / 2 * dt) % W;
    bgScroll1 = (bgScroll1 + BASE_VEL * dt) % W;
    for (const s of stars) {
      s.x -= s.v * dt;
      if (s.x < -2) { s.x = W + 2; s.y = Math.random() * H; }
    }
  }

  if (!started) {
    // intro fly-in
    yellow.x += BASE_VEL * dt;
    red.x -= BASE_VEL * dt;
    if (yellow.x >= 100 || red.x <= W - 100) started = true;
    clearQueued();
    updateParticles(dt);
    return;
  }

  yellow.tickTimers(dt);
  red.tickTimers(dt);

  if (!winner) {
    if (botBattle) {
      runBot(yellow, red, dt);
      runBot(red, yellow, dt);
      clearQueued(); // ignore stray taps while bots fight
    } else {
      handlePlayer(dt);
      runBot(red, yellow, dt);
    }

    updateBullets(yellow, red, dt);
    updateBullets(red, yellow, dt);
    updatePowerups(dt);

    if (red.health <= 0) onWin('yellow');
    else if (yellow.health <= 0) onWin('red');
  } else {
    winnerTimer -= dt;
    if (winnerTimer <= 0) {
      state = 'gameover';
      renderGameOver(winner === 'yellow');
      showOnly('gameover');
    }
  }

  shake = Math.max(0, shake - dt * 2.2);
  updateParticles(dt);
  updateFloaters(dt);
}

/* ---------------- drawing ---------------- */
function shipSprite(ship) {
  const moving = Math.abs(ship.moveX) > 0.01 || Math.abs(ship.moveY) > 0.01;
  const set = ship.side === 'yellow'
    ? [IMAGES.yellowOff, IMAGES.yellowHalf, IMAGES.yellowOn]
    : [IMAGES.redOff, IMAGES.redHalf, IMAGES.redOn];
  return ship.boosting && moving ? set[2] : moving ? set[1] : set[0];
}

function drawShip(ship, other) {
  const angle = Math.atan2(other.cy - ship.cy, other.cx - ship.cx);
  const img = shipSprite(ship);
  ctx.save();
  ctx.translate(ship.cx, ship.cy);
  ctx.rotate(angle - Math.PI / 2); // sprites point "down" in the source art
  if (ship.immune) ctx.globalAlpha = 0.45 + 0.25 * Math.sin(now * 40);
  if (ship.hitFlash > 0) ctx.globalAlpha = 0.55;
  if (imgReady(img)) {
    ctx.drawImage(img, -SHIP_W / 2, -SHIP_H / 2, SHIP_W, SHIP_H);
  } else {
    ctx.fillStyle = ship.side === 'yellow' ? '#ffd23f' : '#ff5a5a';
    ctx.fillRect(-SHIP_W / 2, -SHIP_H / 2, SHIP_W, SHIP_H);
  }
  ctx.restore();
}

function drawBullets(shooter) {
  const BW = 13, BH = 26;
  for (const b of shooter.bullets) {
    const img = shooter.side === 'yellow'
      ? (b.passed ? IMAGES.yellowBulletOff : IMAGES.yellowBullet)
      : (b.passed ? IMAGES.redBulletOff : IMAGES.redBullet);
    const rot = Math.atan2(b.lastDy, b.lastDx) + Math.PI / 2; // sprite points up
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(rot);
    if (imgReady(img)) {
      ctx.drawImage(img, -BW / 2, -BH / 2, BW, BH);
    } else {
      ctx.fillStyle = shooter.side === 'yellow' ? '#ffd23f' : '#ff5a5a';
      ctx.fillRect(-3, -8, 6, 16);
    }
    ctx.restore();
  }
}

function drawBar(x, y, w, h, pct, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, pct)), h);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '600 10px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 4, y + h / 2 + 0.5);
}

function drawHUD() {
  const barW = 190, barH = 13;

  // player (left)
  const hpPct = yellow.health / yellow.maxHealth;
  const hpColor = hpPct > 0.25 ? '#33d17a' : '#ff4d4d';
  drawBar(12, 12, barW, barH, hpPct, hpColor,
    'HP ' + Math.max(0, Math.ceil(yellow.health)) + '/' + yellow.maxHealth);
  drawBar(12, 30, barW, barH, yellow.stamina / yellow.maxStamina, 'rgba(255,255,255,0.55)',
    'GAS ' + Math.round(yellow.stamina / yellow.maxStamina * 100) + '%');

  // ammo pips (surge pips from the AMMO power-up show in amber)
  const pips = Math.min(yellow.effMaxBullets, 18);
  const avail = yellow.effMaxBullets - yellow.bullets.length;
  for (let i = 0; i < pips; i++) {
    const surge = i >= yellow.maxBullets;
    ctx.fillStyle = i < avail
      ? (surge ? '#ffd23f' : 'rgba(255,255,255,0.9)')
      : 'rgba(255,255,255,0.15)';
    ctx.fillRect(12 + i * 9, 48, 6, 6);
  }
  if (yellow.infinity) {
    ctx.fillStyle = '#888888';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('∞', 14 + pips * 9, 54);
  }
  if (yellow.rapidTimer > 0) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('AMMO +3 · ' + Math.ceil(yellow.rapidTimer) + 's', 12, 66);
  }

  // enemy (right)
  const ex = W - 12 - barW;
  const ePct = red.health / red.maxHealth;
  const eColor = ePct > 0.25 ? '#33d17a' : '#ff4d4d';
  drawBar(ex, 12, barW, barH, ePct, eColor,
    'HP ' + Math.max(0, Math.ceil(red.health)) + '/' + red.maxHealth);
  drawBar(ex, 30, barW, barH, red.stamina / red.maxStamina, 'rgba(255,255,255,0.55)',
    'GAS ' + Math.round(red.stamina / red.maxStamina * 100) + '%');

  // difficulty tag (+ live streak)
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '600 10px Inter, sans-serif';
  ctx.textAlign = 'center';
  let tag;
  if (battle.mode === 'campaign') {
    tag = 'LEVEL ' + battle.level + ' / ' + CAMPAIGN_MAX;
  } else {
    tag = (botBattle ? 'BOT BATTLE — ' : '') + battle.label.toUpperCase();
    if (!botBattle && save.streak > 0) tag += ' · STREAK ' + save.streak;
  }
  ctx.fillText(tag, W / 2, H - 12);
}

function draw() {
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 12 * shake);
  }

  // background: two-layer parallax from the original assets
  const h1 = Math.round(H * 0.849), h2 = H - h1;
  if (imgReady(IMAGES.bg1)) {
    ctx.drawImage(IMAGES.bg1, -bgScroll2, 0, W, h1);
    ctx.drawImage(IMAGES.bg1, W - bgScroll2, 0, W, h1);
  } else { ctx.fillStyle = '#050914'; ctx.fillRect(0, 0, W, h1); }
  if (imgReady(IMAGES.bg2)) {
    ctx.drawImage(IMAGES.bg2, -bgScroll1, h1, W, h2);
    ctx.drawImage(IMAGES.bg2, W - bgScroll1, h1, W, h2);
  } else { ctx.fillStyle = '#0a1024'; ctx.fillRect(0, h1, W, h2); }

  // extra deep-space star layer
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (const s of stars) ctx.fillRect(s.x, s.y, s.s, s.s);

  // center divider: a faint energy field instead of the original black bar
  const grad = ctx.createLinearGradient(W / 2 - 4, 0, W / 2 + 4, 0);
  grad.addColorStop(0, 'rgba(26,38,255,0)');
  grad.addColorStop(0.5, 'rgba(26,38,255,0.3)');
  grad.addColorStop(1, 'rgba(26,38,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(W / 2 - 4, 0, 8, H);

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  if (yellow && red) {
    drawPowerups();
    if (!winner || winner === 'yellow') drawShip(red, yellow);
    if (!winner || winner === 'red') drawShip(yellow, red);
    drawBullets(yellow);
    drawBullets(red);
    drawFloaters();
    if (started) drawHUD();

    // danger vignette: subtle pulsing red edge when the player is nearly dead
    if (started && !winner && !botBattle && yellow.health / yellow.maxHealth <= 0.25) {
      const a = 0.10 + 0.05 * Math.sin(now * 5);
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.78);
      g.addColorStop(0, 'rgba(255,77,77,0)');
      g.addColorStop(1, 'rgba(255,77,77,' + a.toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    if (!started) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '500 22px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(battle.mode === 'campaign' ? battle.label : 'Get ready', W / 2, H / 2 - 10);
      if (battle.mode === 'campaign') {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '500 12px "JetBrains Mono", ui-monospace, monospace';
        ctx.fillText('reward +' + fmtMoney(battle.reward), W / 2, H / 2 + 16);
      }
    }
    if (winner) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '500 52px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 16;
      ctx.fillText(winner === 'yellow' ? 'Yellow wins' : 'Red wins', W / 2, H / 2);
      ctx.shadowBlur = 0;
    }
  }
  ctx.restore();
}

/* ---------------- game-over screen ---------------- */
function renderGameOver(win) {
  const campaign = battle.mode === 'campaign';
  const title = document.getElementById('go-title');
  const again = document.getElementById('btn-again');

  if (campaign) {
    if (win && runOutcome === 'complete') {
      title.textContent = 'Run complete';
      title.style.color = 'var(--success)';
      again.textContent = 'New run';
    } else if (win) {
      title.textContent = 'Level ' + battle.level + ' cleared';
      title.style.color = 'var(--ink)';
      again.textContent = 'Next level';
    } else {
      title.textContent = 'Run over';
      title.style.color = 'var(--error)';
      again.textContent = 'New run';
    }
  } else {
    title.textContent = botBattle
      ? (win ? 'Yellow bot wins' : 'Red bot wins')
      : (win ? 'You win' : 'You lose');
    title.style.color = win ? 'var(--ink)' : 'var(--error)';
    again.textContent = 'Play again';
  }

  const bd = document.getElementById('go-breakdown');
  bd.innerHTML = '';
  if (lastBreakdown) {
    for (const r of lastBreakdown) {
      const row = document.createElement('div');
      row.className = 'bd-row' + (r.total ? ' bd-total' : '');
      row.innerHTML = '<span>' + r.label + '</span><span class="bd-val">' + r.value + '</span>';
      bd.appendChild(row);
    }
    bd.classList.remove('hidden');
  } else {
    bd.classList.add('hidden');
  }

  const rewardEl = document.getElementById('go-reward');
  if (lastReward > 0) animateReward(rewardEl, lastReward);
  else rewardEl.textContent = '';

  const statsEl = document.getElementById('go-stats');
  if (!botBattle) {
    const acc = matchStats.shots > 0
      ? Math.round(100 * matchStats.hits / matchStats.shots) + '%' : '—';
    let s = Math.round(now) + 's · accuracy ' + acc + ' · ' +
      matchStats.dodges + (matchStats.dodges === 1 ? ' dodge' : ' dodges');
    if (campaign) {
      if (runOutcome === 'advance') {
        s = 'HP ' + Math.ceil(save.run.hp) + '/' + save.maxHealth + ' carries over · ' +
          'level ' + save.run.level + ' pays +' + fmtMoney(levelReward(save.run.level)) + ' · ' + s;
      } else {
        const reached = runOutcome === 'complete'
          ? 'All ' + CAMPAIGN_MAX + ' levels cleared'
          : 'Reached level ' + battle.level;
        s = reached + ' · run total +' + fmtMoney(runTotal) + ' credits · ' + s;
      }
    } else {
      if (win && save.streak > 1) s = 'Win streak ' + save.streak + ' · ' + s;
      if (!win && lostStreak > 1) s = 'Win streak of ' + lostStreak + ' lost · ' + s;
    }
    statsEl.textContent = s;
  } else {
    statsEl.textContent = '';
  }
}

/* count the credits up — earning should feel like earning */
function animateReward(el, total) {
  const t0 = performance.now(), dur = 900;
  function tick(t) {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = '+' + fmtMoney(Math.round(total * eased * 2) / 2) + ' credits earned';
    if (p < 1 && state === 'gameover') requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ---------------- main loop ---------------- */
function loop(t) {
  requestAnimationFrame(loop);
  const raw = Math.min((t - lastTime) / 1000, 1 / 30);
  lastTime = t;
  if (state === 'playing') {
    if (hitStop > 0) {
      hitStop -= raw; // freeze-frame: draw, but don't simulate
    } else {
      let dt = raw;
      if (slowMo > 0) { slowMo -= raw; dt *= 0.3; }
      update(dt);
    }
  }
  if (state !== 'menu') draw();
}

/* ---------------- menu UI ---------------- */
function showOnly(id) {
  ['menu', 'howto', 'pause', 'gameover'].forEach((o) => {
    document.getElementById(o).classList.toggle('hidden', o !== id);
  });
}

function renderMenu() {
  document.getElementById('money').textContent = fmtMoney(save.money);

  // campaign card: run progress, carried HP, best level
  const run = save.run;
  document.getElementById('camp-level').textContent = String(run ? run.level : 1);
  const ticks = document.getElementById('camp-ticks');
  ticks.innerHTML = '';
  for (let i = 1; i <= CAMPAIGN_MAX; i++) {
    const t = document.createElement('span');
    t.className = 'camp-tick' +
      (run && i < run.level ? ' done' : '') +
      (i === save.bestLevel ? ' best' : '');
    ticks.appendChild(t);
  }
  const bits = [];
  if (run) bits.push('HP ' + Math.ceil(Math.min(run.hp, save.maxHealth)) + '/' + save.maxHealth,
                     'earned +' + fmtMoney(run.earned));
  if (save.bestLevel > 0) bits.push('best level ' + save.bestLevel);
  document.getElementById('camp-best').textContent = bits.join(' · ');
  document.getElementById('btn-run').textContent = run ? 'Continue run' : 'Start run';
  document.getElementById('btn-abandon').classList.toggle('hidden', !run);

  // win-streak strip (legacy modes): show the multiplier the next win will pay
  const streakRow = document.getElementById('streak-row');
  if (save.streak > 0 || save.bestStreak > 1) {
    streakRow.classList.remove('hidden');
    document.getElementById('streak-value').textContent = String(save.streak);
    document.getElementById('streak-next').textContent = save.streak > 0
      ? 'next win pays x' + streakMult(save.streak + 1)
      : 'best streak ' + save.bestStreak;
  } else {
    streakRow.classList.add('hidden');
  }

  // difficulty pills
  const diffRow = document.getElementById('diff-row');
  diffRow.innerHTML = '';
  for (const key of Object.keys(DIFFICULTIES)) {
    const diff = DIFFICULTIES[key];
    const btn = document.createElement('button');
    btn.className = 'diff-btn' + (key === 'impossible' ? ' diff-imp' : '') +
      (save.difficulty === key ? ' active' : '');
    btn.innerHTML = diff.label + '<small>+' + fmtMoney(diff.reward) + '</small>';
    btn.onclick = () => {
      save.difficulty = key;
      persist();
      renderMenu();
    };
    diffRow.appendChild(btn);
  }

  // upgrade shop
  const wrap = document.getElementById('upgrades');
  wrap.innerHTML = '';
  for (const up of UPGRADES) {
    const card = document.createElement('div');
    card.className = 'up-card';

    const value = up.toggle ? (save[up.key] ? 'ON' : 'OFF') : fmtMoney(save[up.key]);
    const costLabel = up.toggle && save[up.key] ? 'refunds' : 'cost';
    const info = document.createElement('div');
    info.className = 'up-info';
    info.innerHTML =
      '<div class="up-name">' + up.name + '</div>' +
      '<div class="up-value">' + value + '</div>' +
      '<div class="up-cost">' + costLabel + ' ' + up.cost + '</div>';

    const btns = document.createElement('div');
    btns.className = 'up-btns';

    if (up.toggle) {
      const owned = !!save[up.key];
      const b = document.createElement('button');
      b.className = 'up-btn toggle' + (owned ? ' owned' : '');
      b.textContent = owned ? 'SELL' : 'BUY';
      b.disabled = !owned && save.money < up.cost;
      b.onclick = () => {
        if (save[up.key]) { save[up.key] = false; save.money += up.cost; }
        else if (save.money >= up.cost) { save[up.key] = true; save.money -= up.cost; }
        persist();
        renderMenu();
      };
      btns.appendChild(b);
    } else {
      const buy = document.createElement('button');
      buy.className = 'up-btn';
      buy.textContent = '+';
      buy.title = 'Buy (+' + up.step + ') for ' + up.cost;
      buy.disabled = save.money < up.cost || save[up.key] >= up.max;
      buy.onclick = () => {
        if (save.money >= up.cost && save[up.key] < up.max) {
          save[up.key] = Math.round((save[up.key] + up.step) * 100) / 100;
          save.money -= up.cost;
          persist();
          renderMenu();
        }
      };
      const sell = document.createElement('button');
      sell.className = 'up-btn sell';
      sell.textContent = '−';
      sell.title = 'Sell (−' + up.step + ') for ' + up.cost;
      sell.disabled = save[up.key] - up.step < up.min;
      sell.onclick = () => {
        if (save[up.key] - up.step >= up.min) {
          save[up.key] = Math.round((save[up.key] - up.step) * 100) / 100;
          save.money += up.cost;
          persist();
          renderMenu();
        }
      };
      btns.appendChild(buy);
      btns.appendChild(sell);
    }

    card.appendChild(info);
    card.appendChild(btns);
    wrap.appendChild(card);
  }
}

function toggleMute() {
  save.muted = !save.muted;
  persist();
  document.getElementById('btn-mute').classList.toggle('muted', save.muted);
}
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    const el = document.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
  }
}

/* ---------------- wire up buttons ---------------- */
document.getElementById('btn-run').onclick = () => startRun();
document.getElementById('btn-abandon').onclick = () => {
  if (save.run && confirm('Abandon this run? You keep the credits you earned, but the next run starts at level 1.')) {
    save.run = null;
    persist();
    renderMenu();
  }
};
document.getElementById('btn-start').onclick = () => startGame(false);
document.getElementById('btn-botbattle').onclick = () => startGame(true);
document.getElementById('btn-reset').onclick = () => {
  if (confirm('Reset ALL progress (credits + upgrades)?')) {
    const muted = save.muted;
    save = Object.assign({}, DEFAULT_SAVE, { muted });
    persist();
    renderMenu();
  }
};
document.getElementById('btn-howto').onclick = () => showOnly('howto');
document.getElementById('btn-howto-close').onclick = () => showOnly('menu');
document.getElementById('btn-pause').onclick = pauseGame;
document.getElementById('btn-resume').onclick = resumeGame;
document.getElementById('btn-quit').onclick = endToMenu;
document.getElementById('btn-again').onclick = () => {
  if (battle && battle.mode === 'campaign') startRun(); // next level or a fresh run
  else startGame(botBattle);
};
document.getElementById('btn-menu').onclick = endToMenu;
document.getElementById('btn-mute').onclick = toggleMute;
document.getElementById('btn-fs').onclick = toggleFullscreen;
document.getElementById('btn-mute').classList.toggle('muted', save.muted);

/* ---------------- boot ---------------- */
resize();
loadImages().then(() => {
  renderMenu();
  showOnly('menu');
  requestAnimationFrame((t) => {
    lastTime = t;
    requestAnimationFrame(loop);
  });
});
