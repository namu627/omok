import { N, EMPTY, BLACK, WHITE, DNAME } from './constants.js';
import { checkWin, computeForbiddenSet } from './rules.js';
import { initCanvas, resize, render, getCanvasEl, pixelToCell } from './board.js';
import { getBest, ensureGodWorker, destroyGodWorker, sendToGodWorker } from './ai.js';

// ── State ───────────────────────────────────────────────────────────────────
let board, turn, aiCol, humCol, over, lastMove, winLine, diff, aiBusy;
let forbiddenSet = new Set();
let flashMsg = '', flashTimer = null;
let practiceMode = false;
let practiceHints = [];
let pendingMove = null;

function getState() {
  return { board, turn, over, forbiddenSet, lastMove, winLine, practiceHints, flashMsg, humCol, pendingMove };
}

// ── Worker message handler ───────────────────────────────────────────────────
function workerMsg(e) {
  if (e.data.hints) {
    if (practiceMode && !over) applyHints(e.data.hints);
    return;
  }
  if (!aiBusy || over) return;
  finishAITurn(e.data.move[0], e.data.move[1]);
}
function workerErr() {
  if (aiBusy) {
    const [r,c] = getBest(board, aiCol, humCol, 'expert');
    finishAITurn(r, c);
  }
}

// ── Game flow ────────────────────────────────────────────────────────────────
function startGame(d) {
  practiceMode = (d === 'practice');
  diff = practiceMode ? 'god' : d;
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'flex';

  const badge = document.getElementById('diffBadge');
  if (practiceMode) {
    badge.textContent = '연습 모드'; badge.className = 'diff-badge practice-badge';
  } else {
    badge.textContent = DNAME[d] || d;
    badge.className = 'diff-badge'
      + (d === 'god' ? ' god-badge' : '')
      + (d === 'superGod' ? ' superGod-badge' : '');
  }

  const tw = document.getElementById('thinkWrap');
  tw.className = 'thinking-wrap'
    + (diff === 'god' ? ' god-think' : '')
    + (diff === 'superGod' ? ' superGod-think' : '');
  document.getElementById('thinkLabel').textContent =
    diff === 'superGod' ? '절대신 계산 중' : diff === 'god' ? '신 계산 중' : 'AI 생각 중';

  requestAnimationFrame(() => {
    resize();
    newGame();
  });
}

function newGame() {
  destroyGodWorker();
  board = Array.from({length:N}, () => new Array(N).fill(EMPTY));
  over = false; lastMove = null; winLine = null; aiBusy = false;
  forbiddenSet.clear(); practiceHints = [];
  flashMsg = ''; clearTimeout(flashTimer);
  pendingMove = null; hideMoveButtons();
  if (Math.random() < .5) { humCol = BLACK; aiCol = WHITE; }
  else                    { humCol = WHITE; aiCol = BLACK; }
  turn = BLACK;
  hideOverlay(); updateForbidden(); updateStatus(); render(getState());
  if (aiCol === BLACK) scheduleAI();
  else if (practiceMode) { getTop3Hints(); render(getState()); }
}

function showStart() {
  destroyGodWorker();
  hideOverlay();
  pendingMove = null; hideMoveButtons();
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('startScreen').style.display  = 'flex';
}

// ── Input ────────────────────────────────────────────────────────────────────
function onTap(e) {
  if (over || aiBusy || turn !== humCol) return;
  const el = getCanvasEl();
  const rect = el.getBoundingClientRect();
  const sx = el.width / rect.width, sy = el.height / rect.height;
  const px = (e.clientX - rect.left) * sx;
  const py = (e.clientY - rect.top)  * sy;
  const [r, c] = pixelToCell(px, py);
  if (r < 0 || r >= N || c < 0 || c >= N || board[r][c] !== EMPTY) return;
  if (turn === BLACK && forbiddenSet.has(r * N + c)) { showFlash('금수!'); return; }

  pendingMove = [r, c];
  render(getState());
  showMoveButtons();
}

function confirmMove() {
  if (!pendingMove || over || aiBusy || turn !== humCol) return;
  const [r, c] = pendingMove;
  pendingMove = null; hideMoveButtons();
  practiceHints = [];
  place(r, c, humCol); render(getState());
  const wl = checkWin(board, r, c);
  if (wl) { endGame(wl, true); return; }
  if (full()) { endGame(null, null); return; }
  turn = aiCol; updateForbidden(); updateStatus(); scheduleAI();
}

function cancelMove() {
  pendingMove = null; hideMoveButtons();
  render(getState());
}

function showMoveButtons() {
  document.getElementById('confirmBtn').style.display = '';
  document.getElementById('cancelBtn').style.display  = '';
}
function hideMoveButtons() {
  document.getElementById('confirmBtn').style.display = 'none';
  document.getElementById('cancelBtn').style.display  = 'none';
}

// ── Board helpers ─────────────────────────────────────────────────────────────
function place(r, c, col) { board[r][c] = col; lastMove = [r, c]; }
function full() {
  for (let r=0;r<N;r++) for (let c=0;c<N;c++) if (board[r][c]===EMPTY) return false;
  return true;
}

// ── AI ────────────────────────────────────────────────────────────────────────
function scheduleAI() {
  aiBusy = true;
  updateStatus();
  const isGodMode = diff === 'god' || diff === 'superGod';
  const base = isGodMode || diff === 'expert' ? 300 : 200;
  setTimeout(doAI, base + Math.random() * 150);
}

function doAI() {
  if (over) return;
  if (diff === 'god' || diff === 'superGod') { doGodAI(); return; }
  const [r, c] = getBest(board, aiCol, humCol, diff);
  finishAITurn(r, c);
}

function doGodAI() {
  ensureGodWorker(workerMsg, workerErr);
  sendToGodWorker({
    board: board.map(r => [...r]),
    aiCol,
    humCol,
    superGod: diff === 'superGod',
  });
}

function finishAITurn(r, c) {
  place(r, c, aiCol);
  aiBusy = false; turn = humCol;
  render(getState());
  const wl = checkWin(board, r, c);
  if (wl) { endGame(wl, false); return; }
  if (full()) { endGame(null, null); return; }
  updateForbidden(); updateStatus();
  if (practiceMode) { getTop3Hints(); render(getState()); }
}

// ── End game ──────────────────────────────────────────────────────────────────
function endGame(wl, humanWon) {
  winLine = wl; over = true;
  render(getState());
  setTimeout(() => showResult(humanWon), 450);
}

// ── Practice hints ────────────────────────────────────────────────────────────
function getTop3Hints() {
  if (!practiceMode || over || turn !== humCol) { practiceHints = []; return; }
  ensureGodWorker(workerMsg, workerErr);
  sendToGodWorker({ board: board.map(r => [...r]), aiCol: humCol, humCol: aiCol, getHints: true });
}

function applyHints(hints) {
  if (!hints || !hints.length) { practiceHints = []; render(getState()); return; }
  const top = hints.slice(0, 3);
  const scores = top.map(h => h.score);
  const maxS = Math.max(...scores);
  const SCALE = 1e6;
  const exps = scores.map(s => Math.exp((s - maxS) / SCALE));
  const sum  = exps.reduce((a,b) => a+b, 0);
  let pcts = exps.map(e => Math.round(e / sum * 100));
  pcts[0] += 100 - pcts.reduce((a,b) => a+b, 0);
  practiceHints = top.map((h,i) => ({r:h.r, c:h.c, pct:pcts[i]}));
  render(getState());
}

// ── Forbidden ─────────────────────────────────────────────────────────────────
function updateForbidden() {
  forbiddenSet = computeForbiddenSet(board, turn, over);
}

// ── Status / UI ───────────────────────────────────────────────────────────────
function updateStatus() {
  const dot = document.getElementById('turnDot');
  const txt = document.getElementById('statusText');
  const tw  = document.getElementById('thinkWrap');
  if (over) return;
  if (aiBusy) {
    tw.style.display = 'flex';
    txt.textContent = ''; dot.className = 'stone-dot'; dot.style.display = 'none';
  } else {
    tw.style.display = 'none'; dot.style.display = '';
    dot.className = 'stone-dot ' + (turn===BLACK ? 'black' : 'white');
    const cname = turn===BLACK ? '흑' : '백';
    txt.textContent = turn===humCol ? `당신 (${cname}) 차례` : `AI (${cname}) 차례`;
  }
}

function showResult(humanWon) {
  document.getElementById('overlay').style.display = 'flex';
  const e=document.getElementById('resEmoji'), t=document.getElementById('resTitle'), s=document.getElementById('resSub');
  if (humanWon===null)  { e.textContent='🤝'; t.textContent='무승부!'; s.textContent='바둑판이 가득 찼습니다'; }
  else if (humanWon)    { e.textContent='🏆'; t.textContent='승리!';   s.textContent='5목을 완성했습니다!'; }
  else                  { e.textContent='😔'; t.textContent='패배...'; s.textContent='AI가 5목을 완성했습니다'; }
}
function hideOverlay()  { document.getElementById('overlay').style.display = 'none'; }
function showFlash(msg) { flashMsg=msg; render(getState()); clearTimeout(flashTimer); flashTimer=setTimeout(clearFlash,700); }
function clearFlash()   { flashMsg=''; render(getState()); }

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => { resize(); if (board) render(getState()); });

function _init() {
  initCanvas(onTap);
  resize();
  const emptyState = {
    board: Array.from({length: N}, () => new Array(N).fill(EMPTY)),
    turn: BLACK,
    over: false,
    forbiddenSet: new Set(),
    lastMove: null,
    winLine: null,
    practiceHints: [],
    flashMsg: '',
    humCol: BLACK,
    pendingMove: null
  };
  render(emptyState);

  const diffs = ['easy', 'medium', 'hard', 'expert', 'god', 'superGod', 'practice'];
  for (const d of diffs) {
    document.getElementById('btn-' + d)?.addEventListener('click', () => startGame(d));
  }
  document.getElementById('menuBtn').addEventListener('click', showStart);
  document.getElementById('restartBtn').addEventListener('click', newGame);
  document.getElementById('confirmBtn').addEventListener('click', confirmMove);
  document.getElementById('cancelBtn').addEventListener('click', cancelMove);
  document.getElementById('playAgainBtn').addEventListener('click', newGame);
  document.getElementById('changeDiffBtn').addEventListener('click', showStart);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}
