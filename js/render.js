// =====================================================
//  【表現・画面担当】
//  暗闇と光、キャラや罠の描画、ステータス表示、タイトル・結果画面
//  主な関数：drawDarkness / updateLight / draw / updateHud
// =====================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// 暗闇を描くための、画面と同じ大きさの見えないキャンバス
const darkCanvas = document.createElement('canvas');
const darkCtx = darkCanvas.getContext('2d');

// 迷路の床と壁は動かないので、ゲーム開始時に1回だけ描いておく
const mazeCanvas = document.createElement('canvas');
const mazeCtx = mazeCanvas.getContext('2d');

const COLORS = {
  floor: '#3b3440',
  floorDot: '#463e4c',
  wall: '#1b1720',
  wallTop: '#2c2633',
  wallEdge: '#120f15',
  spike: '#c9c3cf',
  spikeShade: '#7a7280',
  usedTrap: '#4a1d22',
  goal: '#6ff0d8',
  player: '#f4e1c1',
  playerOutline: '#3a2a18',
  lantern: '#ffcf6a',
  enemy: '#2a1238',
  enemyEdge: '#5a2a78',
  enemyEye: '#ff4a4a',
};

// キャンバスの大きさを迷路に合わせる
function resizeCanvases(grid) {
  const w = grid[0].length * CONFIG.TILE;
  const h = grid.length * CONFIG.TILE;
  for (const c of [canvas, darkCanvas, mazeCanvas]) {
    c.width = w;
    c.height = h;
  }
}

// 迷路（床・壁）を mazeCanvas に描いておく
function buildMazeImage(grid) {
  const T = CONFIG.TILE;
  mazeCtx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      const px = x * T;
      const py = y * T;
      if (grid[y][x] === WALL) {
        mazeCtx.fillStyle = COLORS.wall;
        mazeCtx.fillRect(px, py, T, T);
        // 下が床なら、壁の手前の面を明るくして立体感を出す
        if (!isWall(grid, x, y + 1)) {
          mazeCtx.fillStyle = COLORS.wallTop;
          mazeCtx.fillRect(px, py + T - 8, T, 8);
        }
        mazeCtx.strokeStyle = COLORS.wallEdge;
        mazeCtx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      } else {
        mazeCtx.fillStyle = COLORS.floor;
        mazeCtx.fillRect(px, py, T, T);
        // 石畳っぽい点々
        mazeCtx.fillStyle = COLORS.floorDot;
        for (let i = 0; i < 3; i++) {
          mazeCtx.fillRect(px + randInt(T - 3), py + randInt(T - 3), 2, 2);
        }
      }
    }
  }
}

// -----------------------------------------------------
//  光の範囲：速度に応じて線形補間でなめらかに変える
// -----------------------------------------------------
function updateLight(dt) {
  const ratio = clamp(game.player.speed / CONFIG.MAX_SPEED, 0, 1);
  const target = lerp(CONFIG.LIGHT_MIN, CONFIG.LIGHT_MAX, ratio);
  game.lightRadius = lerp(game.lightRadius, target, Math.min(1, CONFIG.LIGHT_LERP * dt));
}

// -----------------------------------------------------
//  暗闇：黒で塗りつぶし、destination-out で光の穴を開ける
// -----------------------------------------------------
function drawDarkness(now) {
  const p = game.player;

  darkCtx.globalCompositeOperation = 'source-over';
  darkCtx.fillStyle = '#000';
  darkCtx.fillRect(0, 0, darkCanvas.width, darkCanvas.height);

  // destination-out：描いた部分の黒が消える（=透明になる）
  darkCtx.globalCompositeOperation = 'destination-out';

  // ランタンのゆらぎ
  const flicker = 1 + Math.sin(now * 0.012) * 0.015 + (Math.random() - 0.5) * 0.02;
  punchLight(darkCtx, p.x, p.y, game.lightRadius * flicker, 1);

  // ゴールはかすかに光って見える
  const gx = centerOf(game.goal.x);
  const gy = centerOf(game.goal.y);
  punchLight(darkCtx, gx, gy, 26 + Math.sin(now * 0.003) * 5, 0.55);

  ctx.drawImage(darkCanvas, 0, 0);

  // ランタンのあたたかい色味を足す
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const warm = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, game.lightRadius);
  warm.addColorStop(0, 'rgba(255, 160, 60, 0.22)');
  warm.addColorStop(1, 'rgba(255, 160, 60, 0)');
  ctx.fillStyle = warm;
  ctx.beginPath();
  ctx.arc(p.x, p.y, game.lightRadius, 0, Math.PI * 2);
  ctx.fill();

  // ゴールの青緑の光
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 30);
  g.addColorStop(0, 'rgba(111, 240, 216, 0.35)');
  g.addColorStop(1, 'rgba(111, 240, 216, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(gx, gy, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 円形グラデーションで「中心ほどはっきり消える」穴を開ける
function punchLight(c, x, y, r, strength) {
  const grad = c.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(0,0,0,${strength})`);
  grad.addColorStop(0.55, `rgba(0,0,0,${strength * 0.85})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = grad;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

// -----------------------------------------------------
//  1フレーム分の描画
// -----------------------------------------------------
function draw(now) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(mazeCanvas, 0, 0);

  drawGoal(now);
  for (const trap of game.traps) drawTrap(trap);
  for (const e of game.enemies) drawEnemy(e, now);
  drawPlayer(now);

  drawDarkness(now);
  drawFlashEffect();

  // トゲを踏んだときの赤いフラッシュ
  if (game.hitFlash > 0) {
    ctx.fillStyle = `rgba(255, 40, 40, ${game.hitFlash * 0.8})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// 閃光の演出：画面が白く光り、光の輪が広がる
function drawFlashEffect() {
  if (game.flashTime <= 0) return;
  const t = game.flashTime / CONFIG.FLASH_DURATION; // 1 → 0
  const p = game.player;

  ctx.fillStyle = `rgba(255, 246, 225, ${t * 0.45})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = `rgba(255, 220, 140, ${t})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(p.x, p.y, CONFIG.FLASH_RADIUS * (1 - t * 0.8), 0, Math.PI * 2);
  ctx.stroke();
}

function drawGoal(now) {
  const T = CONFIG.TILE;
  const x = game.goal.x * T;
  const y = game.goal.y * T;
  // 下り階段
  ctx.fillStyle = '#0d2a27';
  ctx.fillRect(x + 3, y + 3, T - 6, T - 6);
  ctx.fillStyle = COLORS.goal;
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = 0.9 - i * 0.2;
    ctx.fillRect(x + 6 + i * 2, y + 7 + i * 5, T - 12 - i * 4, 3);
  }
  ctx.globalAlpha = 1;
}

function drawTrap(trap) {
  const T = CONFIG.TILE;
  const x = trap.x * T;
  const y = trap.y * T;
  if (trap.used) {
    // 踏んだあとのトゲ（つぶれた跡）
    ctx.fillStyle = COLORS.usedTrap;
    ctx.beginPath();
    ctx.ellipse(x + T / 2, y + T / 2, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // 3×3本のトゲ
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const sx = x + 6 + i * 10;
      const sy = y + 8 + j * 9;
      ctx.fillStyle = COLORS.spikeShade;
      ctx.beginPath();
      ctx.moveTo(sx - 4, sy + 5);
      ctx.lineTo(sx + 4, sy + 5);
      ctx.lineTo(sx, sy - 4);
      ctx.fill();
      ctx.fillStyle = COLORS.spike;
      ctx.beginPath();
      ctx.moveTo(sx - 1.5, sy + 5);
      ctx.lineTo(sx, sy - 4);
      ctx.lineTo(sx - 4, sy + 5);
      ctx.fill();
    }
  }
}

function drawEnemy(e, now) {
  const r = CONFIG.ENEMY_RADIUS;
  const bob = Math.sin(e.wobble) * 1.5;
  const x = e.x;
  const y = e.y + bob;

  // おばけのような影
  ctx.fillStyle = COLORS.enemy;
  ctx.strokeStyle = COLORS.enemyEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y - 2, r, Math.PI, 0);
  const waves = 4;
  for (let i = 0; i <= waves; i++) {
    const wx = x + r - (i * 2 * r) / waves;
    const wy = y + r - 2 + (i % 2 === 0 ? 0 : -4) + Math.sin(e.wobble * 2 + i) * 1;
    ctx.lineTo(wx, wy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ひるんでいるとき：目が「×」になり、頭の上で星が回る
  if (e.stunned > 0) {
    ctx.strokeStyle = '#d9c9e6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const ex of [x - 4, x + 4]) {
      ctx.moveTo(ex - 2, y - 5); ctx.lineTo(ex + 2, y - 1);
      ctx.moveTo(ex + 2, y - 5); ctx.lineTo(ex - 2, y - 1);
    }
    ctx.stroke();
    ctx.fillStyle = '#ffe08a';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const a = now * 0.006 + (i * Math.PI * 2) / 3;
      ctx.fillText('✦', x + Math.cos(a) * 10, y - r - 4 + Math.sin(a) * 3);
    }
    return;
  }

  // 目（追跡中は大きく光る）
  ctx.fillStyle = COLORS.enemyEye;
  const eye = e.chasing ? 3 : 2;
  ctx.beginPath();
  ctx.arc(x - 4, y - 3, eye, 0, Math.PI * 2);
  ctx.arc(x + 4, y - 3, eye, 0, Math.PI * 2);
  ctx.fill();

  if (e.chasing) {
    ctx.fillStyle = COLORS.enemyEye;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', x, y - r - 6);
  }
}

function drawPlayer(now) {
  const p = game.player;
  const r = CONFIG.PLAYER_RADIUS;

  // 動けない間は点滅
  if (p.stun > 0 && Math.floor(now / 60) % 2 === 0) return;

  ctx.fillStyle = COLORS.player;
  ctx.strokeStyle = COLORS.playerOutline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 進む向きに持ったランタン
  const lx = p.x + Math.cos(p.facing) * (r + 2);
  const ly = p.y + Math.sin(p.facing) * (r + 2);
  ctx.fillStyle = COLORS.lantern;
  ctx.beginPath();
  ctx.arc(lx, ly, 4, 0, Math.PI * 2);
  ctx.fill();
}

// -----------------------------------------------------
//  ステータス表示（HUD）
// -----------------------------------------------------
const hud = {
  life: document.getElementById('hud-life'),
  time: document.getElementById('hud-time'),
  light: document.getElementById('hud-light'),
  lightBar: document.getElementById('hud-light-bar'),
  mode: document.getElementById('hud-mode'),
  flash: document.getElementById('hud-flash'),
};

function updateHud() {
  hud.life.textContent = '♥'.repeat(Math.max(0, game.life)) + '♡'.repeat(CONFIG.LIFE - Math.max(0, game.life));
  hud.time.textContent = formatTime(game.time);
  hud.flash.textContent = '✦'.repeat(game.flashes) + '✧'.repeat(CONFIG.FLASH_CHARGES - game.flashes);
  hud.light.textContent = Math.round(game.lightRadius) + 'px';
  const ratio = (game.lightRadius - CONFIG.LIGHT_MIN) / (CONFIG.LIGHT_MAX - CONFIG.LIGHT_MIN);
  hud.lightBar.style.width = (clamp(ratio, 0, 1) * 100).toFixed(1) + '%';

  const chased = game.enemies.some(e => e.chasing);
  if (chased) {
    hud.mode.textContent = '⚠ 追われている！';
    hud.mode.style.color = 'var(--danger)';
  } else if (game.player.sneaking) {
    hud.mode.textContent = 'しのび足';
    hud.mode.style.color = 'var(--goal)';
  } else {
    hud.mode.textContent = '';
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return m > 0 ? `${m}:${s}` : `${(sec % 60).toFixed(1)}`;
}

// -----------------------------------------------------
//  タイトル・結果画面
// -----------------------------------------------------
const titleScreen = document.getElementById('title-screen');
const resultScreen = document.getElementById('result-screen');
const resultTitle = document.getElementById('result-title');
const resultText = document.getElementById('result-text');

function showTitle() {
  titleScreen.classList.remove('hidden');
  resultScreen.classList.add('hidden');
}

function hideScreens() {
  titleScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
}

function showResult(cleared, reason, time) {
  resultScreen.classList.remove('hidden');
  if (cleared) {
    resultTitle.textContent = 'ESCAPED';
    resultTitle.className = 'result-title clear';
    resultText.innerHTML = `脱出成功！<br>タイム <b>${formatTime(time)}</b> 秒`;
  } else {
    resultTitle.textContent = 'GAME OVER';
    resultTitle.className = 'result-title over';
    resultText.innerHTML = `${reason}<br><span style="color:var(--muted);font-size:14px">タイム ${formatTime(time)} 秒</span>`;
  }
}
