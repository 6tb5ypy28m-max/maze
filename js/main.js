// =====================================================
//  全体の進行（2人の共通部分）
//  キー入力・ゲーム開始と終了・ゲームループ
// =====================================================

// 押されているキー
const keys = { up: false, down: false, left: false, right: false, sneak: false };

const KEY_MAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'sneak', ShiftRight: 'sneak',
};

let game = null;       // 今のゲームの状態をまとめたもの
let state = 'title';   // 'title' / 'playing' / 'result'
let lastTime = 0;

// ---- ゲーム開始 ----
function startGame() {
  const grid = generateMaze(CONFIG.MAZE_W, CONFIG.MAZE_H);
  const start = { x: 1, y: 1 };                                   // 左上
  const goal = { x: grid[0].length - 2, y: grid.length - 2 };     // 右下

  game = {
    grid,
    goal,
    player: {
      x: centerOf(start.x),
      y: centerOf(start.y),
      vx: 0, vy: 0,
      speed: 0,
      facing: 0,
      stun: 0,
      sneaking: false,
    },
    enemies: createEnemies(grid, start),
    traps: placeTraps(grid, start, goal),
    life: CONFIG.LIFE,
    time: 0,
    lightRadius: CONFIG.LIGHT_MIN,
    hitFlash: 0,
    flashes: CONFIG.FLASH_CHARGES, // 閃光の残り回数
    flashTime: 0,                  // 閃光の演出の残り時間
  };

  resizeCanvases(grid);
  buildMazeImage(grid);
  hideScreens();
  state = 'playing';
}

// ---- ゲーム終了（クリア or ゲームオーバー）----
function endGame(cleared, reason) {
  if (state !== 'playing') return;
  state = 'result';
  game.player.vx = 0;
  game.player.vy = 0;
  showResult(cleared, reason, game.time);
}

// ---- ゲームループ：requestAnimationFrame で毎秒約60回 ----
function loop(now) {
  // 前のフレームからの経過時間(秒)。タブ切り替え後などに飛びすぎないよう上限をつける
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (state === 'playing') {
    game.time += dt;
    updatePlayer(dt);
    updateLight(dt);
    if (state === 'playing') updateEnemies(dt);
    if (game.hitFlash > 0) game.hitFlash -= dt;
    if (game.flashTime > 0) game.flashTime -= dt;
    updateHud();
  }

  if (game) draw(now);
  requestAnimationFrame(loop);
}

// ---- キー入力 ----
window.addEventListener('keydown', (ev) => {
  const k = KEY_MAP[ev.code];
  if (k) {
    keys[k] = true;
    ev.preventDefault(); // 矢印キーで画面がスクロールしないように
  }
  if (ev.code === 'Space') {
    ev.preventDefault();
    if (state === 'playing' && !ev.repeat) useFlash();
  }
  // Spaceは閃光に使うので、スタートはEnterだけにする（連打で結果画面が飛ばないように）
  if (ev.code === 'Enter' && state !== 'playing') {
    ev.preventDefault();
    startGame();
  }
});

window.addEventListener('keyup', (ev) => {
  const k = KEY_MAP[ev.code];
  if (k) keys[k] = false;
});

// ウィンドウからフォーカスが外れたらキーを離したことにする
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
});

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);

// ---- 最初の画面：タイトルの後ろに迷路をうっすら表示しておく ----
(function init() {
  startGame();
  state = 'title';
  showTitle();
  updateHud();
  requestAnimationFrame((t) => { lastTime = t; loop(t); });
})();
