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
  easy:       { label: 'Easy',       reward: 2.5, dodges: false, dodgeEz: false, evades: true,  botMods: {} },
  medium:     { label: 'Medium',     reward: 5,   dodges: true,  dodgeEz: true,  evades: false, botMods: {} },
  hard:       { label: 'Hard',       reward: 10,  dodges: true,  dodgeEz: false, evades: true,  botMods: {} },
  impossible: {
    label: 'Impossible', reward: 60, dodges: true, dodgeEz: false, evades: true,
    botMods: { health: 5, maxBullets: 10, aimbot: 2, infinity: true, velMult: 1.5 },
  },
};

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
  }
  get cx() { return this.x + SHIP_W / 2; }
  get cy() { return this.y + SHIP_H / 2; }
  get immune() { return this.immuneTimer > 0; }

  tickTimers(dt) {
    this.immuneTimer = Math.max(0, this.immuneTimer - dt);
    this.runTimer = Math.max(0, this.runTimer - dt);
    this.fireCooldown -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
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
    return true;
  }

  fire(opts) {
    opts = opts || {};
    if (this.bullets.length >= this.maxBullets) return false;
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
    return true;
  }

  /* barrage: a vertical spread of fast, non-homing rockets */
  multiFire() {
    const splits = this.maxBullets - this.bullets.length - 1;
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
let botBattle = false;
let started = false;       // intro fly-in finished
let winner = null;         // 'yellow' | 'red'
let winnerTimer = 0;
let lastReward = 0;
let bgScroll1 = 0, bgScroll2 = 0;

/* extra deep-space star layer (enhancement) */
const stars = [];
for (let i = 0; i < 60; i++) {
  stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.6 + 0.4, v: 8 + Math.random() * 24 });
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function startGame(asBotBattle) {
  botBattle = asBotBattle;
  const diff = DIFFICULTIES[save.difficulty] || DIFFICULTIES.easy;

  yellow = new Ship('yellow', {
    maxHealth: save.maxHealth,
    maxStamina: save.maxStamina,
    maxBullets: save.maxBullets,
    aimbot: save.aimbot,
    infinity: save.infinityBullets,
    velMult: save.speedMulti,
  });
  const mods = diff.botMods;
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
  shake = 0;
  clearQueued();

  showOnly(null);
  document.getElementById('gamebar').classList.remove('hidden');
  if (isTouchDevice) document.getElementById('touch').classList.remove('hidden');
  lastTime = performance.now();
  state = 'playing';
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
  lastReward = 0;
  if (who === 'yellow') {
    const diff = DIFFICULTIES[save.difficulty] || DIFFICULTIES.easy;
    lastReward = diff.reward;
    save.money = Math.round((save.money + lastReward) * 100) / 100;
    persist();
  }
  addShake(1);
  const loser = who === 'yellow' ? red : yellow;
  spawnExplosion(loser.cx, loser.cy, who === 'yellow' ? '#ff5a5a' : '#ffd23f');
  spawnExplosion(loser.cx, loser.cy, '#ffffff');
}

/* ---------------- bot AI (ported from the Pygame version) ---------------- */
function runBot(bot, target, dt) {
  const diff = DIFFICULTIES[save.difficulty] || DIFFICULTIES.easy;
  const prevX = bot.x, prevY = bot.y;

  // 1) evasive boost when a bullet is closing in (easy/hard/impossible)
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

  // 2) movement: track the player's height; hug own wall unless evading
  const step = bot.vel * dt;
  const chaseY = bot.cy >= target.cy ? -1 : 1;
  bot.y += (running ? -chaseY : chaseY) * step;
  const retreatX = bot.side === 'red' ? 1 : -1;
  bot.x += (running ? -retreatX : retreatX) * step;

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
  if (Math.abs(target.cy - bot.cy) < H / 5 && bot.fireCooldown <= 0) {
    bot.fire();
    bot.fireCooldown = 0.1 + Math.random() * 0.4;
  }
  if (Math.random() < 0.57 * dt) bot.fire();
  if (Math.random() < 0.9 * dt && bot.bullets.length <= bot.maxBullets - 2) bot.multiFire();

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

    if (red.health <= 0) onWin('yellow');
    else if (yellow.health <= 0) onWin('red');
  } else {
    winnerTimer -= dt;
    if (winnerTimer <= 0) {
      state = 'gameover';
      const win = winner === 'yellow';
      const title = document.getElementById('go-title');
      title.textContent = botBattle
        ? (win ? 'Yellow bot wins' : 'Red bot wins')
        : (win ? 'You win' : 'You lose');
      title.style.color = win ? 'var(--ink)' : 'var(--error)';
      document.getElementById('go-reward').textContent =
        lastReward > 0 ? '+' + fmtMoney(lastReward) + ' credits earned' : '';
      showOnly('gameover');
    }
  }

  shake = Math.max(0, shake - dt * 2.2);
  updateParticles(dt);
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

  // ammo pips
  const pips = Math.min(yellow.maxBullets, 15);
  for (let i = 0; i < pips; i++) {
    ctx.fillStyle = i < yellow.maxBullets - yellow.bullets.length
      ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)';
    ctx.fillRect(12 + i * 9, 48, 6, 6);
  }
  if (yellow.infinity) {
    ctx.fillStyle = '#888888';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('∞', 14 + pips * 9, 54);
  }

  // enemy (right)
  const ex = W - 12 - barW;
  const ePct = red.health / red.maxHealth;
  const eColor = ePct > 0.25 ? '#33d17a' : '#ff4d4d';
  drawBar(ex, 12, barW, barH, ePct, eColor,
    'HP ' + Math.max(0, Math.ceil(red.health)) + '/' + red.maxHealth);
  drawBar(ex, 30, barW, barH, red.stamina / red.maxStamina, 'rgba(255,255,255,0.55)',
    'GAS ' + Math.round(red.stamina / red.maxStamina * 100) + '%');

  // difficulty tag
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '600 10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((botBattle ? 'BOT BATTLE — ' : '') + save.difficulty.toUpperCase(), W / 2, H - 12);
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
    if (!winner || winner === 'yellow') drawShip(red, yellow);
    if (!winner || winner === 'red') drawShip(yellow, red);
    drawBullets(yellow);
    drawBullets(red);
    if (started) drawHUD();

    if (!started) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '500 22px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Get ready', W / 2, H / 2 - 10);
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

/* ---------------- main loop ---------------- */
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min((t - lastTime) / 1000, 1 / 30);
  lastTime = t;
  if (state === 'playing') update(dt);
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
document.getElementById('btn-again').onclick = () => startGame(botBattle);
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
