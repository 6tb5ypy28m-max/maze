// =====================================================
//  【ロジック担当】
//  迷路生成・移動と当たり判定・敵の追跡・罠とゴールの判定
//  主な関数：generateMaze / bfsNextStep / updatePlayer / updateEnemies
// =====================================================

const WALL = 1;
const FLOOR = 0;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]; // 右・左・下・上

// そのマスが壁か（迷路の外も壁あつかい）
function isWall(grid, tx, ty) {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return true;
  return grid[ty][tx] === WALL;
}

// -----------------------------------------------------
//  迷路の自動生成：穴掘り法（深さ優先探索）
//  部屋 w×h 個 → マスは (2w+1)×(2h+1)。奇数マスが部屋、間が壁。
// -----------------------------------------------------
function generateMaze(w, h) {
  const cols = w * 2 + 1;
  const rows = h * 2 + 1;
  const grid = [];
  for (let y = 0; y < rows; y++) grid.push(new Array(cols).fill(WALL));

  const visited = [];
  for (let y = 0; y < h; y++) visited.push(new Array(w).fill(false));

  // スタート（左上の部屋）から掘り始める
  const stack = [[0, 0]];
  visited[0][0] = true;
  grid[1][1] = FLOOR;

  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];

    // まだ行っていない隣の部屋を集める
    const options = [];
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && !visited[ny][nx]) {
        options.push([nx, ny, dx, dy]);
      }
    }

    if (options.length === 0) {
      stack.pop(); // 行き止まり → 1つ戻る
      continue;
    }

    // ランダムに1つ選んで、間の壁と次の部屋を掘る
    const [nx, ny, dx, dy] = options[randInt(options.length)];
    grid[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = FLOOR;
    grid[ny * 2 + 1][nx * 2 + 1] = FLOOR;
    visited[ny][nx] = true;
    stack.push([nx, ny]);
  }

  // 一本道だと敵から逃げられないので、いくつか壁を壊して回り道を作る
  let removed = 0;
  let tries = 0;
  while (removed < CONFIG.EXTRA_PATHS && tries < 2000) {
    tries++;
    const x = 1 + randInt(cols - 2);
    const y = 1 + randInt(rows - 2);
    if (grid[y][x] !== WALL) continue;
    const horizontal = grid[y][x - 1] === FLOOR && grid[y][x + 1] === FLOOR &&
                       grid[y - 1][x] === WALL && grid[y + 1][x] === WALL;
    const vertical = grid[y - 1][x] === FLOOR && grid[y + 1][x] === FLOOR &&
                     grid[y][x - 1] === WALL && grid[y][x + 1] === WALL;
    if (horizontal || vertical) {
      grid[y][x] = FLOOR;
      removed++;
    }
  }

  return grid;
}

// -----------------------------------------------------
//  経路探索：幅優先探索（BFS）
// -----------------------------------------------------

// from から to へ最短で向かうとき「次に進むマス」を返す
function bfsNextStep(grid, from, to) {
  if (from.x === to.x && from.y === to.y) return { x: from.x, y: from.y };

  const cols = grid[0].length;
  const prev = new Array(grid.length * cols).fill(-1); // どのマスから来たか
  const startKey = from.y * cols + from.x;
  const goalKey = to.y * cols + to.x;
  prev[startKey] = startKey;

  const queue = [startKey];
  let head = 0;
  while (head < queue.length) {
    const key = queue[head++];
    if (key === goalKey) break;
    const x = key % cols;
    const y = (key - x) / cols;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (isWall(grid, nx, ny)) continue;
      const nk = ny * cols + nx;
      if (prev[nk] !== -1) continue;
      prev[nk] = key;
      queue.push(nk);
    }
  }

  if (prev[goalKey] === -1) return { x: from.x, y: from.y }; // たどり着けない

  // ゴールからスタートへさかのぼり、スタートの隣のマスを見つける
  let key = goalKey;
  while (prev[key] !== startKey) key = prev[key];
  return { x: key % cols, y: Math.floor(key / cols) };
}

// start から各マスまでの歩数を調べる（敵や罠の配置に使う）
function bfsDistances(grid, start) {
  const dist = grid.map(row => row.map(() => -1));
  dist[start.y][start.x] = 0;
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const { x, y } = queue[head++];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (isWall(grid, nx, ny) || dist[ny][nx] !== -1) continue;
      dist[ny][nx] = dist[y][x] + 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return dist;
}

// -----------------------------------------------------
//  敵と罠の配置
// -----------------------------------------------------
function createEnemies(grid, start) {
  const dist = bfsDistances(grid, start);
  const candidates = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (dist[y][x] >= CONFIG.ENEMY_SPAWN_MIN_DIST) candidates.push({ x, y });
    }
  }

  const enemies = [];
  for (let i = 0; i < CONFIG.ENEMY_COUNT && candidates.length > 0; i++) {
    const tile = candidates.splice(randInt(candidates.length), 1)[0];
    enemies.push({
      x: centerOf(tile.x),
      y: centerOf(tile.y),
      tile: tile,       // 今いるマス
      next: tile,       // 向かっているマス
      prev: null,       // 1つ前のマス（うろつくとき引き返さないため）
      chasing: false,   // 追跡中か
      memory: 0,        // 見失ってからの残り追跡時間
      stunned: 0,       // 閃光でひるんでいる残り時間
      wobble: Math.random() * Math.PI * 2, // 見た目のゆらゆら用
    });
  }
  return enemies;
}

function placeTraps(grid, start, goal) {
  const dist = bfsDistances(grid, start);
  const candidates = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (dist[y][x] < 3) continue;                    // スタート付近には置かない
      if (x === goal.x && y === goal.y) continue;      // ゴールには置かない
      candidates.push({ x, y });
    }
  }

  const traps = [];
  while (traps.length < CONFIG.TRAP_COUNT && candidates.length > 0) {
    const t = candidates.splice(randInt(candidates.length), 1)[0];
    // 罠どうしが隣り合わないようにする
    const tooClose = traps.some(o => Math.abs(o.x - t.x) + Math.abs(o.y - t.y) < 2);
    if (tooClose) continue;
    // ここに置いても「トゲを踏まずにゴールへ行ける道」が残るときだけ置く
    const trial = traps.concat([t]);
    if (canReachWithoutTraps(grid, start, goal, trial)) {
      traps.push({ x: t.x, y: t.y, used: false });
    }
  }
  return traps;
}

// トゲのマスを壁とみなして、start から goal へ行けるか調べる
function canReachWithoutTraps(grid, start, goal, traps) {
  const blocked = grid.map(row => row.slice());
  for (const t of traps) blocked[t.y][t.x] = WALL;
  return bfsDistances(blocked, start)[goal.y][goal.x] !== -1;
}

// -----------------------------------------------------
//  プレイヤーの移動（加速度・速度・摩擦）と当たり判定
// -----------------------------------------------------
function updatePlayer(dt) {
  const p = game.player;

  // 入力の向き
  let ix = 0;
  let iy = 0;
  if (keys.left) ix -= 1;
  if (keys.right) ix += 1;
  if (keys.up) iy -= 1;
  if (keys.down) iy += 1;

  // トゲを踏んだ直後は動けない
  if (p.stun > 0) {
    p.stun -= dt;
    ix = 0;
    iy = 0;
    p.vx = 0;
    p.vy = 0;
  }

  // 斜め移動が速くならないように長さを1にそろえる
  if (ix !== 0 && iy !== 0) {
    ix *= Math.SQRT1_2;
    iy *= Math.SQRT1_2;
  }

  // 加速度 → 速度
  p.vx += ix * CONFIG.ACCEL * dt;
  p.vy += iy * CONFIG.ACCEL * dt;

  // 摩擦で減速
  const keep = Math.max(0, 1 - CONFIG.FRICTION * dt);
  p.vx *= keep;
  p.vy *= keep;

  // 最高速度を超えないようにする（Shiftでしのび足）
  p.sneaking = keys.sneak;
  const maxSpeed = p.sneaking ? CONFIG.SNEAK_SPEED : CONFIG.MAX_SPEED;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > maxSpeed) {
    p.vx = (p.vx / speed) * maxSpeed;
    p.vy = (p.vy / speed) * maxSpeed;
  }

  // 細い通路で曲がりやすくするため、通路の中央に少し寄せる
  cornerAssist(p, Math.sign(ix), Math.sign(iy), dt);

  // 速度 → 位置（x と y を別々に動かして壁で止める）
  moveAndCollide(p, p.vx * dt, 0);
  moveAndCollide(p, 0, p.vy * dt);
  p.speed = Math.hypot(p.vx, p.vy);
  if (p.speed > 5) p.facing = Math.atan2(p.vy, p.vx);

  // 罠とゴールの判定（プレイヤーの中心がどのマスにいるか）
  const tx = tileOf(p.x);
  const ty = tileOf(p.y);

  for (const trap of game.traps) {
    if (!trap.used && trap.x === tx && trap.y === ty) {
      trap.used = true;
      game.life -= 1;
      p.stun = CONFIG.TRAP_STUN;
      p.vx = 0;
      p.vy = 0;
      game.hitFlash = 0.35;
      if (game.life <= 0) {
        endGame(false, 'トゲを踏みすぎてライフがなくなった…');
        return;
      }
    }
  }

  if (tx === game.goal.x && ty === game.goal.y) {
    endGame(true);
  }
}

// 移動したあと壁にめり込んでいたら押し戻す
function moveAndCollide(p, dx, dy) {
  const r = CONFIG.PLAYER_RADIUS;
  const T = CONFIG.TILE;
  p.x += dx;
  p.y += dy;

  const left = tileOf(p.x - r);
  const right = tileOf(p.x + r - 0.001);
  const top = tileOf(p.y - r);
  const bottom = tileOf(p.y + r - 0.001);

  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (!isWall(game.grid, tx, ty)) continue;
      if (dx > 0) { p.x = tx * T - r; p.vx = 0; }
      if (dx < 0) { p.x = (tx + 1) * T + r; p.vx = 0; }
      if (dy > 0) { p.y = ty * T - r; p.vy = 0; }
      if (dy < 0) { p.y = (ty + 1) * T + r; p.vy = 0; }
    }
  }
}

function cornerAssist(p, ix, iy, dt) {
  const tx = tileOf(p.x);
  const ty = tileOf(p.y);
  const pull = CONFIG.CORNER_ASSIST * dt;
  if (ix !== 0 && iy === 0 && !isWall(game.grid, tx + ix, ty)) {
    p.y += clamp(centerOf(ty) - p.y, -pull, pull);
  }
  if (iy !== 0 && ix === 0 && !isWall(game.grid, tx, ty + iy)) {
    p.x += clamp(centerOf(tx) - p.x, -pull, pull);
  }
}

// -----------------------------------------------------
//  敵の動き：普段はうろつき、光に入ると追跡（見失っても3秒は追う）
// -----------------------------------------------------
function updateEnemies(dt) {
  const p = game.player;
  const playerTile = { x: tileOf(p.x), y: tileOf(p.y) };

  for (const e of game.enemies) {
    e.wobble += dt * 4;

    // ひるんでいる間は動かず、触れても捕まらない
    if (e.stunned > 0) {
      e.stunned -= dt;
      continue;
    }

    // 光の範囲に入ったら追跡開始。外に出たら追跡時間を減らす
    const distToPlayer = Math.hypot(e.x - p.x, e.y - p.y);
    if (distToPlayer < game.lightRadius) {
      e.chasing = true;
      e.memory = CONFIG.ENEMY_MEMORY;
    } else if (e.chasing) {
      e.memory -= dt;
      if (e.memory <= 0) e.chasing = false;
    }

    // 向かっているマスの中心へ進む
    const speed = e.chasing ? CONFIG.ENEMY_CHASE_SPEED : CONFIG.ENEMY_WANDER_SPEED;
    const targetX = centerOf(e.next.x);
    const targetY = centerOf(e.next.y);
    const dx = targetX - e.x;
    const dy = targetY - e.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;

    if (d <= step) {
      // マスに着いたので次のマスを決める
      e.x = targetX;
      e.y = targetY;
      e.prev = e.tile;
      e.tile = e.next;
      e.next = chooseEnemyNext(e, playerTile);
    } else {
      e.x += (dx / d) * step;
      e.y += (dy / d) * step;
    }

    // 捕まったらゲームオーバー
    if (distToPlayer < CONFIG.ENEMY_RADIUS + CONFIG.PLAYER_RADIUS - 2) {
      endGame(false, '敵に捕まってしまった…');
      return;
    }
  }
}

// -----------------------------------------------------
//  閃光：Spaceで使う。範囲内の敵をひるませ、追跡もやめさせる
// -----------------------------------------------------
function useFlash() {
  if (game.flashes <= 0 || game.flashTime > 0) return;
  game.flashes -= 1;
  game.flashTime = CONFIG.FLASH_DURATION;
  game.lightRadius = CONFIG.FLASH_RADIUS; // 一瞬だけ光が大きくなる

  const p = game.player;
  for (const e of game.enemies) {
    if (Math.hypot(e.x - p.x, e.y - p.y) < CONFIG.FLASH_RADIUS) {
      e.stunned = CONFIG.FLASH_STUN;
      e.chasing = false;
      e.memory = 0;
    }
  }
}

function chooseEnemyNext(e, playerTile) {
  // 追跡中：BFSでプレイヤーへの最短ルートの次のマス
  if (e.chasing) return bfsNextStep(game.grid, e.tile, playerTile);

  // うろつき中：来た道以外の通路からランダムに選ぶ
  const options = [];
  for (const [dx, dy] of DIRS) {
    const nx = e.tile.x + dx;
    const ny = e.tile.y + dy;
    if (isWall(game.grid, nx, ny)) continue;
    if (e.prev && e.prev.x === nx && e.prev.y === ny) continue;
    options.push({ x: nx, y: ny });
  }
  if (options.length === 0) return e.prev || e.tile; // 行き止まりなら引き返す
  return options[randInt(options.length)];
}
