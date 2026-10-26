# ヤミメイロ（プロトタイプ）

`index.html` をブラウザで開くだけで遊べます（サーバー不要）。

## ファイル構成
| ファイル | 担当 | 中身 |
|---|---|---|
| `index.html` | 共通 | 画面の骨組み（HUD・キャンバス・タイトル/結果画面） |
| `style.css` | 表現 | 見た目 |
| `js/config.js` | 共通 | **バランス調整用の数値**（光の範囲・敵の速さ・罠の数など）と共通の小関数 |
| `js/logic.js` | ロジック | `generateMaze` `bfsNextStep` `updatePlayer` `updateEnemies` |
| `js/render.js` | 表現 | `drawDarkness` `updateLight` `draw` `updateHud`、タイトル・結果画面 |
| `js/main.js` | 共通 | キー入力、ゲーム開始/終了、ゲームループ（`requestAnimationFrame`） |

## 1フレームの流れ（main.js の `loop`）
1. 経過時間 `dt` を計算
2. `updatePlayer(dt)` … 加速度→速度→摩擦→位置、壁の当たり判定、罠・ゴール判定
3. `updateLight(dt)` … 速度に応じた目標の光の範囲へ線形補間で近づける
4. `updateEnemies(dt)` … 光に入ったら追跡（BFS）、見失っても3秒追う、捕まったら終了
5. `updateHud()` → `draw()`（最後に `drawDarkness()` で暗闇に光の穴を開ける）

## メモ
- 一本道だと逃げ場がないため、`EXTRA_PATHS` の数だけ壁を壊して回り道を作っています（0にすれば純粋な穴掘り法の迷路）。
- 踏んだトゲはつぶれて、2回目は反応しません（連続ダメージ防止）。
- 敵への対抗手段として「閃光」（Space）を追加：範囲内の敵が3秒ひるむ。1ゲーム2回まで（`useFlash`、数値は `config.js` の FLASH_〜）。
- 発展案（燃料・スイッチ・難易度選択・ベストタイム保存・効果音）はまだ入れていません。
