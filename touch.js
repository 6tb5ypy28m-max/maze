// =====================================================
//  スマホ（タッチ操作）
//  ・画面のどこでもドラッグすると、触った場所にスティックが出る
//    （縦向きなら迷路の下の空いている所、横向きなら左右の空いている所で操作できる）
//    小さく倒す → しのび足 / 大きく倒す → 走る
//  ・右下の「閃光」ボタンで閃光
// =====================================================

// スティックの状態（logic.js の updatePlayer が読む）
const touch = {
  active: false, // スティックを操作中か
  x: 0,          // 向き（-1〜1）
  y: 0,
  sneak: false,  // 小さく倒している＝しのび足
  id: null,      // 操作している指の番号
  ox: 0,         // スティックの中心（画面上の位置）
  oy: 0,
};

const JOY_RADIUS = 50;   // スティックを倒しきるまでの距離(px)
const JOY_DEAD = 0.15;   // これより小さい倒し方は「止まる」
const JOY_SNEAK = 0.55;  // これより小さい倒し方は「しのび足」

const joyBase = document.getElementById('joy-base');
const joyKnob = document.getElementById('joy-knob');
const flashBtn = document.getElementById('flash-btn');

function findTouch(list, id) {
  for (const t of list) if (t.identifier === id) return t;
  return null;
}

function resetStick() {
  touch.active = false;
  touch.id = null;
  touch.x = 0;
  touch.y = 0;
  touch.sneak = false;
  joyBase.classList.add('hidden');
  joyKnob.style.transform = 'translate(-50%, -50%)';
}

// 指を置いた場所にスティックを出す
document.addEventListener('touchstart', (ev) => {
  if (state !== 'playing') return; // タイトル・結果画面ではボタンを押せるようにする
  ev.preventDefault();             // スクロールや拡大を防ぐ
  if (touch.id !== null) return;   // すでにスティック操作中
  for (const t of ev.changedTouches) {
    if (t.target === flashBtn) continue;
    touch.id = t.identifier;
    touch.ox = t.clientX;
    touch.oy = t.clientY;
    touch.active = true;
    joyBase.style.left = touch.ox + 'px';
    joyBase.style.top = touch.oy + 'px';
    joyBase.classList.remove('hidden');
    break;
  }
}, { passive: false });

// 指を動かした方向と距離で、向きと速さを決める
document.addEventListener('touchmove', (ev) => {
  if (touch.id === null) return;
  ev.preventDefault();
  const t = findTouch(ev.changedTouches, touch.id);
  if (!t) return;

  let dx = t.clientX - touch.ox;
  let dy = t.clientY - touch.oy;
  const dist = Math.hypot(dx, dy);
  if (dist > JOY_RADIUS) {
    dx = (dx / dist) * JOY_RADIUS;
    dy = (dy / dist) * JOY_RADIUS;
  }
  joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

  const amount = Math.min(1, dist / JOY_RADIUS); // 倒した量 0〜1
  if (amount < JOY_DEAD) {
    touch.x = 0;
    touch.y = 0;
  } else {
    // 迷路は上下左右の通路なので、ほぼまっすぐなら上下左右にそろえる
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax > ay * 2) { touch.x = Math.sign(dx); touch.y = 0; }
    else if (ay > ax * 2) { touch.x = 0; touch.y = Math.sign(dy); }
    else { touch.x = dx / dist; touch.y = dy / dist; }
  }
  touch.sneak = amount < JOY_SNEAK;
}, { passive: false });

function endTouch(ev) {
  if (touch.id === null) return;
  if (findTouch(ev.changedTouches, touch.id)) resetStick();
}
document.addEventListener('touchend', endTouch);
document.addEventListener('touchcancel', endTouch);

// 閃光ボタン
flashBtn.addEventListener('touchstart', (ev) => {
  ev.preventDefault();
  ev.stopPropagation(); // スティックが出ないようにする
  if (state === 'playing') useFlash();
}, { passive: false });
flashBtn.addEventListener('click', () => {
  if (state === 'playing') useFlash();
});
