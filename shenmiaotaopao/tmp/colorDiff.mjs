// src/game/colorDiff.ts
var BEST_KEY = "cd_best";
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
var ColorDiffGame = class {
  cols = 3;
  rows = 3;
  level = 1;
  score = 0;
  best = 0;
  lives = 3;
  combo = 0;
  state = "ready";
  lastResult = null;
  resultAt = -1;
  // 颜色参数
  baseH = 0;
  baseS = 70;
  baseL = 50;
  delta = 40;
  oddLighter = true;
  oddIndex = 0;
  wrongIdx = -1;
  // 计时
  timeTotal = 3;
  timeLeft = 3;
  // 动画时间戳（performance.now()）
  correctAt = -1;
  wrongAt = -1;
  shakeAt = -1;
  constructor() {
    const b = Number(localStorage.getItem(BEST_KEY) || 0);
    this.best = Number.isFinite(b) ? b : 0;
    this.generate();
  }
  start() {
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.lastResult = null;
    this.resultAt = -1;
    this.state = "playing";
    this.generate();
  }
  generate() {
    this.cols = this.rows = Math.min(3 + Math.floor((this.level - 1) / 3), 7);
    this.baseH = Math.floor(Math.random() * 360);
    this.baseS = 58 + Math.floor(Math.random() * 18);
    this.baseL = 44 + Math.floor(Math.random() * 12);
    this.delta = Math.max(6, 46 - (this.level - 1) * 2);
    this.oddLighter = Math.random() > 0.5;
    const total = this.cols * this.rows;
    this.oddIndex = Math.floor(Math.random() * total);
    this.timeTotal = Math.max(1.1, 3 - (this.level - 1) * 0.13);
    this.timeLeft = this.timeTotal;
    this.wrongIdx = -1;
  }
  baseColor() {
    return `hsl(${this.baseH} ${this.baseS}% ${this.baseL}%)`;
  }
  oddColor() {
    const l = this.oddLighter ? this.baseL + this.delta : this.baseL - this.delta;
    return `hsl(${this.baseH} ${this.baseS}% ${clamp(l, 0, 100)}%)`;
  }
  tap(index) {
    if (this.state !== "playing" || index < 0) return;
    if (index === this.oddIndex) {
      this.combo++;
      const timeBonus = Math.round(this.timeLeft * 5);
      this.score += this.level * 10 + timeBonus + this.combo * 2;
      this.level++;
      this.correctAt = performance.now();
      this.lastResult = "correct";
      this.resultAt = performance.now();
      this.generate();
    } else {
      this.onWrong(index);
    }
  }
  tick(dt) {
    if (this.state !== "playing") return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.onWrong(-1);
    }
  }
  onWrong(index) {
    this.wrongIdx = index;
    this.wrongAt = performance.now();
    this.shakeAt = performance.now();
    this.combo = 0;
    this.lives--;
    this.lastResult = "wrong";
    this.resultAt = performance.now();
    if (this.lives <= 0) {
      this.gameOver();
    } else {
      this.generate();
    }
  }
  gameOver() {
    this.state = "over";
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
    }
  }
  layout(size) {
    const barH = Math.max(4, size * 0.014);
    const top = barH + size * 0.03;
    const pad = size * 0.04;
    const inner = size - pad * 2;
    const gap = size * 0.025;
    const cell = (inner - gap * (this.cols - 1)) / this.cols;
    return { pad, gap, cell, barH, top };
  }
  // 将画布逻辑坐标映射为格子索引，未命中返回 -1
  hitTest(lx, ly, size) {
    const { pad, gap, cell, top } = this.layout(size);
    const c = Math.floor((lx - pad) / (cell + gap));
    const r = Math.floor((ly - top) / (cell + gap));
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return -1;
    const cx = pad + c * (cell + gap);
    const cy = top + r * (cell + gap);
    if (lx < cx || lx > cx + cell || ly < cy || ly > cy + cell) return -1;
    return r * this.cols + c;
  }
};
export {
  ColorDiffGame
};
