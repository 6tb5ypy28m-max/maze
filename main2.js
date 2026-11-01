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
};

let game = null;       // 今のゲームの状態をまとめたもの
let state = 'title';   // 'title' / 'playing' / 'result'
let lastTime = 0;

// ---- ゲーム開始 ----
function startGame() {
  const grid = generateMaze(CONFIG.MAZE_W, CONFIG.MAZE_H);
  const start = { x: 1, y: 1 };                                   // 左上
  const goal = { x: grid[0].length - 2, y: grid.length - 2 };     // 右下
  const key = placeKey(grid, start, goal);

  // 目標タイム：スタート→鍵→ゴールの最短ルートを最高速度で走った時間 × 倍率
  const route = bfsDistances(grid, start)[key.y][key.x] + bfsDistances(grid, key)[goal.y][goal.x];
  const parTime = (route * CONFIG.TILE / CONFIG.MAX_SPEED) * CONFIG.PAR_FACTOR;

  game = {
    grid,
    goal,
    key,
    hasKey: false,
    parTime,
    message: '',      // 画面に出すお知らせ
    messageTime: 0,
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
    traps: placeTraps(grid, start, goal, key),
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
  game.messageTime = 0;
  showResult(cleared, reason, game.time, cleared ? calcRank() : null);
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
    if (game.messageTime > 0) game.messageTime -= dt;
    updateHud();
  }

  if (game) draw(now);
  requestAnimationFrame(loop);
}

// ---- キー入力 ----
// しのび足：左右どちらのShiftでも反応するよう、キーの位置(code)ではなく
// 「今Shiftが押されているか」(shiftKey) で判定する。
// 環境によって右Shiftの code が正しく届かないことがあるための対策。
function updateSneak(ev) {
  keys.sneak = ev.shiftKey || (ev.type === 'keydown' && ev.key === 'Shift');
}

window.addEventListener('keydown', (ev) => {
  updateSneak(ev);
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
  updateSneak(ev);
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
