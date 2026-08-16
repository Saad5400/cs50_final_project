# Space Wars
#### Video Demo:  https://www.youtube.com/watch?v=wwgB3TmEGzo
#### Description: Python Pygame game — now also playable on the web!

"Space Wars" is a game written in Python using Pygame. Inspired by old spaceships fight games.

It's a challenging single-player game where you can play against 4 types of bots: Easy, Medium, Hard, and Impossible.

After defeating one of the bots, you earn money. Which can be used to buy upgrades.

main.py contains pretty much everything that makes the game run.
config.ini is just a save file to save player's data.
Encryptor.py contains some functions to encrypt and decypt text that I made myself. Just so players don't cheat :)
Assets folder contains all the assets such as images and audio files.

---

## 🌐 Web version

A full remake of the game for the browser — plain HTML, CSS, and JavaScript on the HTML5 Canvas. **No build step, no dependencies**: just open `index.html` in a browser, or serve the repo with any static server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

It also works out of the box on GitHub Pages (Settings → Pages → deploy from the `main` branch root).

- `index.html` — the page, menus, and overlays
- `css/style.css` — responsive styling
- `js/game.js` — the whole game engine
- `Assets/` — the same sprites and sounds the Pygame version uses

### What's the same

Everything that made the original the original:

- Duel a bot across a split arena — 4 difficulties (Easy / Medium / Hard / Impossible) with the same AI behaviors: bots track you, boost-evade incoming rockets, and dodge-blink out of danger.
- Homing rockets ("aimbot"), gas-powered **boost** (Shift) and **dodge blink** (Space) with brief immunity, **barrage** multi-fire, vertical screen wrap-around.
- Credits for every win (2.5 / 5 / 10 / 60) and the same upgrade shop: Max Health, Max Gas, Max Bullets, Homing Power, Infinite Bullets — upgrades can also be sold back.
- **Bot Battle** spectator mode, the original sprites, sounds, and two-layer parallax background.
- Saves that persist between sessions (localStorage, lightly obfuscated as a tribute to `Encryptor.py`).

### What's enhanced

- 📱 **Fully responsive** — the arena scales to any screen, sharp on high-DPI displays.
- 🕹 **Touch controls** — floating virtual joystick + FIRE / DODGE / BARRAGE / BOOST buttons on mobile, with a rotate-to-landscape hint in portrait.
- 🎮 **Gamepad support** — left stick / d-pad to move, A dodge, X fire, Y barrage, RT boost (the original supported joysticks too!).
- ✨ **Juice** — particle explosions, engine trails, dodge trails, screen shake, hit flashes, hit-stop freeze frames, slow-motion killing blows, floating damage numbers, a low-health warning vignette, immunity shimmer, an energy-field center divider, and an extra drifting starfield layer.
- 🚀 **Campaign mode** — a 15-level roguelike run on a continuous difficulty curve (level 5 ≈ the old Hard, level 15 ≈ the old Impossible). Bot skills unlock level by level, rewards grow with depth, your HP carries between levels, and dying restarts the run. The original four difficulties live on as legacy modes.
- 🔥 **Win streaks** — in legacy modes, every consecutive win raises your reward multiplier (up to x2); lose and the streak resets.
- 🎯 **Bonus objectives** — earn extra credits for a Flawless win (+50%), a Quick win under 30s (+25%), or Sharpshooter accuracy (+25%), with a full reward breakdown and match stats on the results screen.
- 📦 **Supply drops** — repair kits, gas refills, and ammo surges drift off the center line mid-fight. Smarter bots will race you for them.
- 📊 **Proper HUD** — health and gas bars with ammo pips instead of plain text.
- ⏸ **Pause menu**, game-over screen with rewards, mute toggle, and fullscreen mode.
- 🖥 **Modern menu** — difficulty picker, upgrade shop with buy *and* sell buttons (no more hidden right-click!), and a how-to-play screen.
