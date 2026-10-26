// =====================================================
//  ゲームバランスの設定（2人で調整する数値はここに集める）
// =====================================================
const CONFIG = {
  // 迷路
  TILE: 32,            // 1マスの大きさ(px)
  MAZE_W: 13,          // 横の部屋数（実際のマス数は 13*2+1 = 27）
  MAZE_H: 8,           // 縦の部屋数（実際のマス数は 8*2+1 = 17）
  EXTRA_PATHS: 30,     // 分かれ道を増やすために追加で壊す壁の数（0なら一本道の迷路）

  // プレイヤーの動き（慣性）
  PLAYER_RADIUS: 9,
  ACCEL: 1500,         // 加速度(px/秒^2)
  FRICTION: 6,         // 摩擦（大きいほどすぐ止まる）
  MAX_SPEED: 200,      // 通常の最高速度(px/秒)
  SNEAK_SPEED: 70,     // しのび足の最高速度(px/秒)
  CORNER_ASSIST: 160,  // 曲がり角で通路の中央に寄せる強さ(px/秒)

  // 光
  LIGHT_MIN: 40,       // 止まっているときの光の半径(px)
  LIGHT_MAX: 170,      // 最高速度のときの光の半径(px)
  LIGHT_LERP: 4,       // 光が目標の大きさに近づく速さ（線形補間の係数）

  // 敵
  ENEMY_COUNT: 3,
  ENEMY_RADIUS: 11,
  ENEMY_WANDER_SPEED: 40,  // うろつくときの速さ(px/秒)
  ENEMY_CHASE_SPEED: 90,   // 追いかけるときの速さ(px/秒)
  ENEMY_MEMORY: 3.0,       // 見失ってから追い続ける時間(秒)
  ENEMY_SPAWN_MIN_DIST: 14, // スタートから何マス以上離れた所に出すか

  // 閃光（敵への対抗手段）
  FLASH_CHARGES: 2,    // 1回のゲームで使える回数
  FLASH_RADIUS: 220,   // ひるませる範囲(px)
  FLASH_STUN: 3.0,     // 敵がひるんで動けない時間(秒)
  FLASH_DURATION: 0.5, // 画面が白く光る演出の長さ(秒)

  // 罠・ライフ
  TRAP_COUNT: 10,
  TRAP_STUN: 0.5,      // トゲを踏んだあと動けない時間(秒)
  LIFE: 3,
};

// ---- 共通で使う小さな関数 ----

// 線形補間：a から b へ t(0〜1) の割合だけ近づけた値
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randInt(n) {
  return Math.floor(Math.random() * n);
}

// px座標 → マス番号
function tileOf(px) {
  return Math.floor(px / CONFIG.TILE);
}

// マス番号 → そのマスの中心のpx座標
function centerOf(tile) {
  return (tile + 0.5) * CONFIG.TILE;
}
