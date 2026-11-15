//  暗闇と光、キャラや罠の描画、ステータス表示、タイトル・結果画面
//  関数：drawDarkness / updateLight / draw / updateHud

const canvas = document.getElementById('game'); // HTMLの<canvas id="game">を取得（画面に見えるキャンバス）
const ctx = canvas.getContext('2d'); // 2Dで絵を描くための道具（ペン）を取り出す

// 暗闇を描く、画面と同じ大きさのキャンバス
const darkCanvas = document.createElement('canvas'); // 画面には出さない作業用キャンバスをJSで作る
const darkCtx = darkCanvas.getContext('2d'); // 暗闇キャンバス用のペン

// 迷路の床と壁（動かない）
const mazeCanvas = document.createElement('canvas');            // 迷路を1回だけ描いておく下書き用キャンバス
const mazeCtx = mazeCanvas.getContext('2d');                    // 迷路キャンバス用のペン

const COLORS = {              // ゲーム内で使う色まとめ
  floor: '#3b3440',        // 床
  floorDot: '#463e4c',   // 床の石畳
  wall: '#1b1720',       // 壁
  wallTop: '#2c2633',     // 壁の手前の面（立体感用）
  wallEdge: '#120f15',         // 壁のふちの線
  spike: '#c9c3cf',            // トゲの明るい面
  spikeShade: '#7a7280',        // トゲの影
  usedTrap: '#4a1d22',         // 踏んだあとのトゲ
  goal: '#6ff0d8',            // ゴールの青緑（CSSの--goalと同じ）
  player: '#f4e1c1',          // プレイヤーの体
  playerOutline: '#3a2a18',     // プレイヤーのふち
  lantern: '#ffcf6a',           // ランタン
  enemy: '#2a1238',      // 敵の体
  enemyEdge: '#5a2a78',     // 敵のふち
  enemyEye: '#ff4a4a',         // 敵の目
};                               

// キャンバスの大きさを迷路に合わせる
function resizeCanvases(grid) {            // grid＝迷路の2次元配列
  const w = grid[0].length * CONFIG.TILE;     // 横幅＝横のマス数 × 1マスの大きさ
  const h = grid.length * CONFIG.TILE;        // 高さ＝縦のマス数 × 1マスの大きさ
  for (const c of [canvas, darkCanvas, mazeCanvas]) {    // 3枚のキャンバスそれぞれについて、横幅と高さをそろえる
    c.width = w;                
    c.height = h;     
  }
}

// 迷路（床・壁）を mazeCanvas に描いておく
function buildMazeImage(grid) {       // ゲーム開始時に1回だけ呼ばれる
  const T = CONFIG.TILE;              // 1マスの大きさをTとする
  mazeCtx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height); // 前の迷路を消して真っさらにする

  for (let y = 0; y < grid.length; y++) {       // 上の行から順に
    for (let x = 0; x < grid[0].length; x++) {       // 左の列から順に、全マスを見る
      const px = x * T;      // マス番号を画面上のx座標（ピクセル）に変換
      const py = y * T;        // マス番号を画面上のy座標（ピクセル）に変換
      if (grid[y][x] === WALL) {        // そのマスが壁なら
        mazeCtx.fillStyle = COLORS.wall;      // 塗る色を壁の色に
        mazeCtx.fillRect(px, py, T, T);       // 1マス分の四角を塗る
        // 下が床なら、壁の手前の面を明るくして立体感を出す
        if (!isWall(grid, x, y + 1)) {             
          mazeCtx.fillStyle = COLORS.wallTop; 　 // 少し明るい色にして
          mazeCtx.fillRect(px, py + T - 8, T, 8);     // マスの下側8pxに帯を描く
        }                                             
        mazeCtx.strokeStyle = COLORS.wallEdge;       // 線の色をふちの色に
        mazeCtx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);   // 壁のふちに線を引く（0.5ずらすと線がくっきり）
      } else {      // 壁じゃない（床）なら
        mazeCtx.fillStyle = COLORS.floor;    // 塗る色を床の色に
        mazeCtx.fillRect(px, py, T, T);     // 1マス分の床を塗る
        // 石畳っぽい点々
        mazeCtx.fillStyle = COLORS.floorDot;      // 点の色に変える
        for (let i = 0; i < 3; i++) {        // 1マスに3個ずつ
          mazeCtx.fillRect(px + randInt(T - 3), py + randInt(T - 3), 2, 2); // ランダムな位置に2×2の点を打つ
        }
      }
    }
  }
}

//  光の範囲：速度に応じて線形補間でなめらかに変える
function updateLight(dt) {       // dt＝前のフレームからの経過秒数
  const ratio = clamp(game.player.speed / CONFIG.MAX_SPEED, 0, 1); // 今の速さが最高速の何割か（0〜1に収める）
  const target = lerp(CONFIG.LIGHT_MIN, CONFIG.LIGHT_MAX, ratio); // その割合から、目指す光の半径を決める
  game.lightRadius = lerp(game.lightRadius, target, Math.min(1, CONFIG.LIGHT_LERP * dt)); // 今の半径を目標に少しずつ近づける（急に変わらない）
}                                                             

//  暗闇：黒で塗りつぶし、destination-out で光の穴を開ける
function drawDarkness(now) {         // now＝ゲーム開始からの時間（ミリ秒）。ゆらぎ等に使う
  const p = game.player;              // プレイヤー = p

  darkCtx.globalCompositeOperation = 'source-over';     // 普通の塗りモードに戻す
  darkCtx.fillStyle = '#000';           // 色を黒に
  darkCtx.fillRect(0, 0, darkCanvas.width, darkCanvas.height);  // 暗闇キャンバス全体を真っ黒に塗る

  // destination-out：描いた部分の黒が消える（=透明になる）
  darkCtx.globalCompositeOperation = 'destination-out'; // ここから先は消しゴムモード

  // ランタンのゆらぎ
  const flicker = 1 + Math.sin(now * 0.012) * 0.015 + (Math.random() - 0.5) * 0.02; // sin波＋ランダムで波を作る
  punchLight(darkCtx, p.x, p.y, game.lightRadius * flicker, 1); // プレイヤーの位置に光の穴を開ける

  // ゴールはかすかに光って見える
  const gx = centerOf(game.goal.x);      // ゴールのマスの中心x座標
  const gy = centerOf(game.goal.y);     // ゴールのマスの中心y座標
  punchLight(darkCtx, gx, gy, 26 + Math.sin(now * 0.003) * 5, 0.55); // ゴールに小さめ・弱めの穴。半径がゆっくり脈打つ

  // 鍵は光る（約3秒ごと）
  const kx = centerOf(game.key.x);    // 鍵のマスの中心x座標
  const ky = centerOf(game.key.y);     // 鍵のマスの中心y座標
  const sparkle = game.hasKey ? 0 : Math.pow(Math.max(0, Math.sin(now * 0.002)), 12); // 鍵を持ってなければ、sin波を12乗して「一瞬だけ強い」光り方にする
  if (sparkle > 0.01) punchLight(darkCtx, kx, ky, 20, 0.8 * sparkle); // 光っている瞬間だけ鍵の位置に穴を開ける

  ctx.drawImage(darkCanvas, 0, 0);     // 穴あきの暗闇を本番の画面に重ねる

  // ランタン色を足す
  ctx.save();       // 今のペンの設定を保存（あとで元に戻すため）
  ctx.globalCompositeOperation = 'lighter';        // 「光を足す」モード（色が明るくなる方向に重なる）
  const warm = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, game.lightRadius); // プレイヤー中心の円形グラデーションを作る
  warm.addColorStop(0, 'rgba(255, 160, 60, 0.22)');       // 中心はオレンジ
  warm.addColorStop(1, 'rgba(255, 160, 60, 0)');      // 外側は透明
  ctx.fillStyle = warm;             // 塗りをこのグラデーションに
  ctx.beginPath();                // 新しい図形を描く
  ctx.arc(p.x, p.y, game.lightRadius, 0, Math.PI * 2);       // 光の大きさの円
  ctx.fill();        // 塗る

  // ゴールの光：鍵がないうちは赤っぽく、鍵を拾うと青緑に変わる
  const gc = game.hasKey ? '111, 240, 216' : '255, 110, 80';    // 鍵の有無で光の色（RGB）を切り替える
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 30);    // ゴール中心の円形グラデーション
  g.addColorStop(0, `rgba(${gc}, 0.35)`);    // 中心は少し濃く
  g.addColorStop(1, `rgba(${gc}, 0)`);      // 外側は透明
  ctx.fillStyle = g;          // 塗りをこのグラデーションに
  ctx.beginPath();          // 新しい図形を描き始める
  ctx.arc(gx, gy, 30, 0, Math.PI * 2);        // 半径30の円
  ctx.fill();     // 塗る

  // 鍵のきらめき（金色）
  if (sparkle > 0.01) {            // 鍵が光っている瞬間だけ
    const kg = ctx.createRadialGradient(kx, ky, 0, kx, ky, 22); // 鍵中心の円形グラデーション
    kg.addColorStop(0, `rgba(255, 215, 90, ${0.6 * sparkle})`); // 中心は金色（光の強さに合わせて濃さが変わる）
    kg.addColorStop(1, 'rgba(255, 215, 90, 0)');     // 外側は透明
    ctx.fillStyle = kg;          // 塗りをこのグラデーションに
    ctx.beginPath();           // 新しい図形を描き始める
    ctx.arc(kx, ky, 22, 0, Math.PI * 2);       // 半径22の円
    ctx.fill();       // 塗る
  }
  ctx.restore();       // 保存したペンの設定に戻す（lighterモードを解除）
}                                                         

// 画面中央の上にお知らせを出す（鍵を拾った、扉が閉まっている など）
function showMessage(text) {        // text＝表示したい文
  if (game.message === text && game.messageTime > 0.3) return;  // 同じ文を連続で出し直さない
  game.message = text;          // 表示する文を記録
  game.messageTime = 2.0;         // 2秒間表示
} 

function drawMessage() {        // お知らせを毎フレーム描く
  if (game.messageTime <= 0) return;        // 表示時間が終わっていたら何もしない
  const alpha = Math.min(1, game.messageTime / 0.4);      // 最後の0.4秒でフェードアウト
  ctx.save();     // ペンの設定を保存
  ctx.font = 'bold 18px "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Meiryo", sans-serif'; // 文字のフォントと大きさ
  ctx.textAlign = 'center';        // 文字を横方向の中央そろえ
  ctx.textBaseline = 'middle';       // 文字を縦方向の中央そろえ
  const w = ctx.measureText(game.message).width + 40;           // 文字の幅を測って、左右に余白20pxずつ足した枠の幅
  const cx = canvas.width / 2;          // 画面の横の中央
  const cy = 40;           // 上から40pxの位置
  ctx.fillStyle = `rgba(10, 8, 14, ${0.85 * alpha})`;        // 枠の背景色（暗い半透明）
  ctx.strokeStyle = `rgba(255, 181, 74, ${0.6 * alpha})`;       // 枠線の色（オレンジ）
  ctx.lineWidth = 1;               // 枠線の太さ
  ctx.beginPath();                // 新しい図形を描き始める
  ctx.roundRect(cx - w / 2, cy - 18, w, 36, 18);        // 角の丸い四角（カプセル形）
  ctx.fill();           // 背景を塗る
  ctx.stroke();         // 枠線を引く
  ctx.fillStyle = `rgba(255, 236, 200, ${alpha})`;         // 文字の色
  ctx.fillText(game.message, cx, cy + 1);         // 文字を描く
  ctx.restore();             // ペンの設定を元に戻す
}                                      

// 円形グラデーションで「中心ほどはっきり消える」穴を開ける
function punchLight(c, x, y, r, strength) {          // c＝描くペン、x,y＝中心、r＝半径、strength＝消す強さ(0〜1)
  const grad = c.createRadialGradient(x, y, 0, x, y, r);        // 中心から半径rまでの円形グラデーション
  grad.addColorStop(0, `rgba(0,0,0,${strength})`);          // 中心は強く消す
  grad.addColorStop(0.55, `rgba(0,0,0,${strength * 0.85})`);   // 半分くらいまではほぼ同じ強さ
  grad.addColorStop(1, 'rgba(0,0,0,0)');         // ふちは消さない（ぼんやり境目になる）
  c.fillStyle = grad;            // 塗りをこのグラデーションに
  c.beginPath();              // 新しい図形を描き始める
  c.arc(x, y, r, 0, Math.PI * 2);        // 半径rの円
  c.fill();         // 塗る（消しゴムモードなので、透明になる）
}

//  1フレーム分の描画
function draw(now) {          // 1秒に約60回呼ばれる。後に描いたものほど上に重なる
  ctx.globalCompositeOperation = 'source-over';        // 普通の「上に塗る」モードにしておく
  ctx.drawImage(mazeCanvas, 0, 0);         // 用意しておいた迷路の絵を貼る

  drawGoal(now);            // ゴール（扉 or 階段）
  if (!game.hasKey) drawKey(now);         // まだ拾っていなければ鍵
  for (const trap of game.traps) drawTrap(trap);            // トゲを全部
  for (const e of game.enemies) drawEnemy(e, now);            // 敵を全部
  drawPlayer(now);           // プレイヤー

  drawDarkness(now);        // 全部の上に暗闇をかぶせる
  drawFlashEffect();        // 閃光の演出（暗闇より上）

  // トゲを踏んだときの赤いフラッシュ
  if (game.hitFlash > 0) {         // ダメージ直後
    ctx.fillStyle = `rgba(255, 40, 40, ${game.hitFlash * 0.8})`; // 赤の半透明（時間とともに薄くなる）
    ctx.fillRect(0, 0, canvas.width, canvas.height);            // 画面全体に重ねる
  }                                             

  drawMessage();         // 一番上にお知らせ
}

// 閃光の演出：画面が白く光り、光の輪が広がる
function drawFlashEffect() {            // 閃光を使った直後
  if (game.flashTime <= 0) return;              // 閃光中でなければ何もしない
  const t = game.flashTime / CONFIG.FLASH_DURATION; // 1 → 0 残り時間の割合（使った瞬間1、終わると0）
  const p = game.player;       // プレイヤーを短い名前で使う

  ctx.fillStyle = `rgba(255, 246, 225, ${t * 0.45})`;       // 白っぽい色。時間とともに薄くなる
  ctx.fillRect(0, 0, canvas.width, canvas.height);       // 画面全体を白く光らせる

  ctx.strokeStyle = `rgba(255, 220, 140, ${t})`;          // 光の輪の色
  ctx.lineWidth = 4;              // 輪の太さ
  ctx.beginPath();              // 新しい図形を描き始める
  ctx.arc(p.x, p.y, CONFIG.FLASH_RADIUS * (1 - t * 0.8), 0, Math.PI * 2); // tが減るほど半径が大きくなる＝輪が広がる
  ctx.stroke();                // 輪を描く
} 

function drawGoal(now) {      // ゴールを描く
  const T = CONFIG.TILE;       // 1マスの大きさ
  const x = game.goal.x * T;             // ゴールのマスの左上x座標
  const y = game.goal.y * T;            // ゴールのマスの左上y座標

  if (!game.hasKey) {      // まだ鍵を持っていなければ
    // 閉じた扉（木の扉＋錠前）
    ctx.fillStyle = '#5a3a22';           // 木の茶色
    ctx.fillRect(x + 4, y + 3, T - 8, T - 5);         // 扉の板
    ctx.strokeStyle = '#2e1d10';               // こげ茶の線
    ctx.lineWidth = 2;                  // 線の太さ
    ctx.strokeRect(x + 4, y + 3, T - 8, T - 5);           // 扉のふち
    ctx.beginPath();                // 新しい線を描き始める
    ctx.moveTo(x + T / 2, y + 4);            // 扉の上の真ん中から
    ctx.lineTo(x + T / 2, y + T - 3);            // 下の真ん中まで
    ctx.stroke();              // 縦線を引く（両開きの扉に見える）
    // 錠前
    ctx.fillStyle = '#e0b84a';         // 金色
    ctx.fillRect(x + T / 2 - 4, y + T / 2, 8, 7);          // 錠前の本体（四角）
    ctx.strokeStyle = '#e0b84a';            // 線も金色
    ctx.lineWidth = 1.5;                   // 線の太さ
    ctx.beginPath();             // 新しい線を描き始める
    ctx.arc(x + T / 2, y + T / 2, 3, Math.PI, 0);         // 上半分の半円（錠前の輪っか）
    ctx.stroke();           // 線を引く
    return;          // 扉を描いたらここで終わり（階段は描かない）

  // 鍵を開けたあと：下り階段
  ctx.fillStyle = '#0d2a27';            // 暗い青緑
  ctx.fillRect(x + 3, y + 3, T - 6, T - 6);          // 階段の穴の背景
  ctx.fillStyle = COLORS.goal;           // 段の色を青緑に
  for (let i = 0; i < 4; i++) {           // 4段描く
    ctx.globalAlpha = 0.9 - i * 0.2;            // 下の段ほど薄く（奥に下りていく感じ）
    ctx.fillRect(x + 6 + i * 2, y + 7 + i * 5, T - 12 - i * 4, 3); // 下の段ほど短く、下にずらした横線
  }       
  ctx.globalAlpha = 1;                                          // 透明度を元に戻す
}  

// 金色の鍵（ふわふわ上下に揺れる）
function drawKey(now) {            // 鍵を描く
  const x = centerOf(game.key.x);                // 鍵のマスの中心x
  const y = centerOf(game.key.y) + Math.sin(now * 0.004) * 2;   // 中心y。sin波で上下に2pxずつ揺らす
  ctx.save();             // ペンの設定を保存
  ctx.translate(x, y);             // 描く基準点（原点）を鍵の位置に移動
  ctx.rotate(-Math.PI / 4);             // 45度傾ける（斜めの鍵に見せる）
  ctx.strokeStyle = '#ffd75a';          // 線を金色に
  ctx.fillStyle = '#ffd75a';          // 塗りも金色に
  ctx.lineWidth = 3;          // 線の太さ
  // 持ち手の輪
  ctx.beginPath();            // 新しい図形を描き始める
  ctx.arc(-7, 0, 5, 0, Math.PI * 2);         // 左側に小さな輪
  ctx.stroke();             // 輪を描く
  // 軸と歯
  ctx.fillRect(-2, -1.5, 14, 3);           // 横に伸びる軸
  ctx.fillRect(7, 1, 2.5, 4);            // 歯その1
  ctx.fillRect(11, 1, 2.5, 3);              // 歯その2（少し短い）
  ctx.restore();              // 移動と回転を元に戻す
}

function drawTrap(trap) {         // トゲを1つ描く
  const T = CONFIG.TILE;      // 1マスの大きさ
  const x = trap.x * T;       // トゲのマスの左上x
  const y = trap.y * T;       // トゲのマスの左上y
  if (trap.used) {          // すでに踏まれたトゲなら
    // 踏んだあとのトゲ（つぶれた跡）
    ctx.fillStyle = COLORS.usedTrap;              // 赤黒い色
    ctx.beginPath();            // 新しい図形を描き始める
    ctx.ellipse(x + T / 2, y + T / 2, 10, 6, 0, 0, Math.PI * 2); // マスの中心に横長の楕円
    ctx.fill();                     // 塗る
    return;                                                   
  }                                                     
  // 3×3本のトゲ
  for (let i = 0; i < 3; i++) {          // 横に3本
    for (let j = 0; j < 3; j++) {       // 縦に3本
      const sx = x + 6 + i * 10;       // トゲ1本の中心x（10pxずつ右へ）
      const sy = y + 8 + j * 9;     // トゲ1本の中心y（9pxずつ下へ）
      ctx.fillStyle = COLORS.spikeShade;            // まず影の色で
      ctx.beginPath();              // 新しい図形を描き始める
      ctx.moveTo(sx - 4, sy + 5);               // 左下の点
      ctx.lineTo(sx + 4, sy + 5);            // 右下の点
      ctx.lineTo(sx, sy - 4);            // てっぺんの点
      ctx.fill();                 // 三角形を塗る
      ctx.fillStyle = COLORS.spike;          // 次に明るい色で
      ctx.beginPath();             // 新しい図形を描き始める
      ctx.moveTo(sx - 1.5, sy + 5);       // 下の少し左
      ctx.lineTo(sx, sy - 4);              // てっぺん
      ctx.lineTo(sx - 4, sy + 5);          // 左下
      ctx.fill();            // 左側だけ明るい細い三角形＝光が当たった面
    }
  }
}

function drawEnemy(e, now) {               // 敵を1体描く
  const r = CONFIG.ENEMY_RADIUS;             // 敵の大きさ（半径）
  const bob = Math.sin(e.wobble) * 1.5;       // 上下にふわふわ揺れる量
  const x = e.x;                // 敵のx座標
  const y = e.y + bob;             // 揺れを足したy座標

  // おばけのような影
  ctx.fillStyle = COLORS.enemy;             // 体の色
  ctx.strokeStyle = COLORS.enemyEdge;         // ふちの色
  ctx.lineWidth = 1.5;            // ふちの太さ
  ctx.beginPath();               // 新しい図形を描き始める
  ctx.arc(x, y - 2, r, Math.PI, 0);                 // 頭の部分＝上半分の半円
  const waves = 4;              // 裾のギザギザの数
  for (let i = 0; i <= waves; i++) {            // 右から左へ点をつないでいく
    const wx = x + r - (i * 2 * r) / waves;         // ギザギザの点のx（右端から左端へ等間隔）
    const wy = y + r - 2 + (i % 2 === 0 ? 0 : -4) + Math.sin(e.wobble * 2 + i) * 1; // 点のy。交互に上下させ、さらに少し揺らす
    ctx.lineTo(wx, wy);          // その点まで線をつなぐ
  }                    
  ctx.closePath();           // 最初の点まで線を閉じる
  ctx.fill();               // 体を塗る
  ctx.stroke();             // ふちを描く

  // ひるんでいるとき：目が「×」になり、頭の上で星が回る
  if (e.stunned > 0) {               // 閃光でひるんでいる間
    ctx.strokeStyle = '#d9c9e6';             // ×目の色
    ctx.lineWidth = 1.5;              // 線の太さ
    ctx.beginPath();               // 新しい線を描き始める
    for (const ex of [x - 4, x + 4]) {  // 左目と右目の位置それぞれに
      ctx.moveTo(ex - 2, y - 5); ctx.lineTo(ex + 2, y - 1);     // 「＼」の線
      ctx.moveTo(ex + 2, y - 5); ctx.lineTo(ex - 2, y - 1);     // 「／」の線
    }                                                     
    ctx.stroke();        // ×を描く
    ctx.fillStyle = '#ffe08a';         // 星の色（黄色）
    ctx.font = '9px sans-serif';       // 星の大きさ
    ctx.textAlign = 'center';          // 中央そろえ
    for (let i = 0; i < 3; i++) {      // 星を3つ
      const a = now * 0.006 + (i * Math.PI * 2) / 3;       // 時間で回る角度。3つを120度ずつずらす
      ctx.fillText('✦', x + Math.cos(a) * 10, y - r - 4 + Math.sin(a) * 3); // 頭の上で楕円を描くように回す
    }                   
    return;   
  } 

  // 目（追跡中は大きく光る）
  ctx.fillStyle = COLORS.enemyEye;   // 目の色（赤）
  const eye = e.chasing ? 3 : 2;        // 追跡中なら目を大きく
  ctx.beginPath();                   // 新しい図形を描き始める
  ctx.arc(x - 4, y - 3, eye, 0, Math.PI * 2);    // 左目
  ctx.arc(x + 4, y - 3, eye, 0, Math.PI * 2);      // 右目
  ctx.fill();            // 両目を塗る

  if (e.chasing) {           // 追跡中なら
    ctx.fillStyle = COLORS.enemyEye;          // 赤色で
    ctx.font = 'bold 14px sans-serif';     // 太字14px
    ctx.textAlign = 'center';          // 中央そろえ
    ctx.fillText('!', x, y - r - 6);        // 頭の上に「!」を出す
  }                                                            
} 

function drawPlayer(now) {               // プレイヤーを描く
  const p = game.player;             // プレイヤー名 = p
  const r = CONFIG.PLAYER_RADIUS;           // プレイヤーの大きさ（半径）

  // 動けない間は点滅
  if (p.stun > 0 && Math.floor(now / 60) % 2 === 0) return;     // ダメージ中は60msごとに描く・描かないを切り替える

  ctx.fillStyle = COLORS.player;           // 体の色
  ctx.strokeStyle = COLORS.playerOutline;       // ふちの色
  ctx.lineWidth = 2;            // ふちの太さ
  ctx.beginPath();             // 新しい図形を描き始める
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);          // 丸い体
  ctx.fill();   // 塗る
  ctx.stroke();        // ふちを描く

  // 進む向きに持ったランタン
  const lx = p.x + Math.cos(p.facing) * (r + 2);      // 向いている方向に、体の少し外側のx
  const ly = p.y + Math.sin(p.facing) * (r + 2);      // 同じくy
  ctx.fillStyle = COLORS.lantern;           // ランタンの色
  ctx.beginPath();             // 新しい図形を描き始める
  ctx.arc(lx, ly, 4, 0, Math.PI * 2);           // 小さな丸
  ctx.fill();            // 塗る
}

//  ステータス表示（HUD）
const hud = {      // HUDの各表示場所をまとめて取得しておく
  life: document.getElementById('hud-life'),      // ライフ
  time: document.getElementById('hud-time'),        // タイム
  light: document.getElementById('hud-light'),        // 光の大きさ（数字）
  lightBar: document.getElementById('hud-light-bar'),       // 光メーターのバー
  mode: document.getElementById('hud-mode'),       // しのび足／追われている表示
  flash: document.getElementById('hud-flash'),        // 閃光の残り
  key: document.getElementById('hud-key'),         // 鍵の状態
};                                                         

function updateHud() {             // HUDの中身を毎フレーム書き換える
  hud.life.textContent = '♥'.repeat(Math.max(0, game.life)) + '♡'.repeat(CONFIG.LIFE - Math.max(0, game.life)); // 残りライフ分の♥と、減った分の♡を並べる
  hud.time.textContent = formatTime(game.time);        // 経過時間を表示
  hud.key.textContent = game.hasKey ? '入手済み' : '未入手';     // 鍵の状態を文字で表示
  hud.key.className = game.hasKey ? 'hud-key got' : 'hud-key';  // 鍵を持っていればgotクラスを付けて金色に
  hud.flash.textContent = '✦'.repeat(game.flashes) + '✧'.repeat(CONFIG.FLASH_CHARGES - game.flashes); // 残りの閃光✦と使った分✧
  hud.light.textContent = Math.round(game.lightRadius) + 'px';  // 光の半径を整数にして表示
  const ratio = (game.lightRadius - CONFIG.LIGHT_MIN) / (CONFIG.LIGHT_MAX - CONFIG.LIGHT_MIN); // 最小〜最大の間で今どのくらいか（0〜1）
  hud.lightBar.style.width = (clamp(ratio, 0, 1) * 100).toFixed(1) + '%'; // メーターのバーの長さを%で変える

 const chased = game.enemies.some(e => e.chasing);    // 追跡中の敵が1体でもいるか
  if (chased) {                  // 追われていたら
    hud.mode.textContent = '⚠ 追われている！';       // 警告を表示
    hud.mode.style.color = 'var(--danger)';           // 赤色に
  } else if (game.player.sneaking) {                 // しのび足中なら
    hud.mode.textContent = 'しのび足';            // しのび足と表示
    hud.mode.style.color = 'var(--goal)';           // 青緑に
  } else {               // どちらでもなければ
    hud.mode.textContent = '';              // 何も表示しない
  }         
}            

function formatTime(sec) {            // 秒数を見やすい文字に変える
  const m = Math.floor(sec / 60);             // 分（小数点以下切り捨て）
  const s = (sec % 60).toFixed(1).padStart(4, '0');      // 残りの秒を小数1桁にして、4文字になるよう頭に0を足す（5.3→05.3）
  return m > 0 ? `${m}:${s}` : `${(sec % 60).toFixed(1)}`;      // 1分以上なら「1:05.3」、未満なら「5.3」
}

//  タイトル・結果画面
const titleScreen = document.getElementById('title-screen');   // タイトル画面
const resultScreen = document.getElementById('result-screen');  // 結果画面
const resultTitle = document.getElementById('result-title');   // 結果の見出し（ESCAPED / GAME OVER）
const resultText = document.getElementById('result-text');    // 結果の説明文
const resultRank = document.getElementById('result-rank');    // ランク評価の箱

function showTitle() {             // タイトル画面を出す
  titleScreen.classList.remove('hidden');        // タイトルのhiddenを外して表示
  resultScreen.classList.add('hidden');          // 結果画面は隠す
}                                              

function hideScreens() {           // ゲーム中は両方隠す
  titleScreen.classList.add('hidden');       // タイトルを隠す
  resultScreen.classList.add('hidden');       // 結果画面を隠す
}                                            

function showResult(cleared, reason, time, score) {       // 結果画面を出す。cleared＝クリアしたか、reason＝負けた理由、score＝点数
  resultScreen.classList.remove('hidden');           // 結果画面を表示
  if (cleared) {        // クリアしたとき
    resultTitle.textContent = 'ESCAPED';            // 見出しを「ESCAPED」に
    resultTitle.className = 'result-title clear';      // clearクラスで青緑に光らせる
    resultText.innerHTML = `脱出成功！ タイム <b>${formatTime(time)}</b> 秒`; // タイムを太字で表示
    resultRank.classList.remove('hidden');          // ランク評価を表示
    resultRank.innerHTML = `
      <div class="rank-letter rank-${score.rank}">${score.rank}</div>
      <table class="rank-table">
        <tr><td>タイム（目標 ${formatTime(score.parTime)} 秒）</td><td>${score.timePts} / 50</td></tr>
        <tr><td>残りライフ ×10</td><td>${score.lifePts} / 30</td></tr>
        <tr><td>残りの閃光 ×10</td><td>${score.flashPts} / 20</td></tr>
        <tr class="rank-total"><td>合計</td><td>${score.total} 点</td></tr>
      </table>`;
  } else { // ゲームオーバーのとき
    resultRank.classList.add('hidden');      // ランク評価は隠す
    resultTitle.textContent = 'GAME OVER';             // 見出しを「GAME OVER」に
    resultTitle.className = 'result-title over';            // overクラスで赤く光らせる
    resultText.innerHTML = `${reason}<br><span style="color:var(--muted);font-size:14px">タイム ${formatTime(time)} 秒</span>`; // 負けた理由と、小さくタイムを表示
  }
}
