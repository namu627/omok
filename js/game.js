import { N, EMPTY, BLACK, WHITE, DNAME } from './constants.js';
import { checkWin, computeForbiddenSet } from './rules.js';
import { initCanvas, resize, render, getCanvasEl, pixelToCell } from './board.js';
import { getBest, ensureGodWorker, destroyGodWorker, sendToGodWorker } from './ai.js';

// ── State ───────────────────────────────────────────────────────────────────
let board, turn, aiCol, humCol, over, lastMove, winLine, diff, aiBusy;
let forbiddenSet = new Set();
let flashMsg = '', flashTimer = null;
let learnMode = false;
let history = [];
let pendingMove = null;

function getState() {
  return { board, turn, over, forbiddenSet, lastMove, winLine, flashMsg, humCol, pendingMove };
}

// ── Worker message handler ───────────────────────────────────────────────────
function workerMsg(e) {
  if (!aiBusy || over) return;
  if (e.data.elapsed != null) console.log(`[AI] 계산 시간: ${e.data.elapsed}ms (${diff})`);
  finishAITurn(e.data.move[0], e.data.move[1]);
}
function workerErr() {
  if (aiBusy) {
    const [r,c] = getBest(board, aiCol, humCol, 'expert');
    finishAITurn(r, c);
  }
}

// ── History / Undo ────────────────────────────────────────────────────────────
// Snapshots are pushed only when it becomes the human's turn.
// Each snapshot represents a "ready for human input" state.
// Undo pops one snapshot = goes back one full round (human+AI pair).
function pushSnapshot() {
  history.push({
    board: board.map(r => [...r]),
    turn,       // always humCol at push time
    humCol, aiCol,
    lastMove: lastMove ? [...lastMove] : null
  });
}

function undoMove() {
  if (!learnMode || aiBusy || history.length <= 1) return;
  history.pop();
  const snap = history[history.length - 1];
  board = snap.board.map(r => [...r]);
  turn = snap.turn;   // always humCol — never triggers scheduleAI
  humCol = snap.humCol; aiCol = snap.aiCol;
  lastMove = snap.lastMove ? [...snap.lastMove] : null;
  winLine = null; over = false; aiBusy = false; pendingMove = null;
  flashMsg = ''; clearTimeout(flashTimer);
  hideOverlay(); updateConfirmBtn(); updateForbidden();
  updateUndoBtn(); updateStatus(); render(getState());
  // intentionally no scheduleAI — it's always humCol's turn after undo
}

// ── Game flow ────────────────────────────────────────────────────────────────
function startGame(d, learnDiff) {
  learnMode = (d === 'learn');
  diff = learnMode ? (learnDiff || 'god') : d;
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'flex';

  const badge = document.getElementById('diffBadge');
  if (learnMode) {
    const levelName = DNAME[diff] || diff;
    badge.textContent = `학습 · ${levelName}`;
    badge.className = 'diff-badge learn-badge';
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

  requestAnimationFrame(() => { resize(); newGame(); });
}

function newGame() {
  destroyGodWorker();
  board = Array.from({length:N}, () => new Array(N).fill(EMPTY));
  over = false; lastMove = null; winLine = null; aiBusy = false;
  forbiddenSet.clear(); history = [];
  flashMsg = ''; clearTimeout(flashTimer);
  pendingMove = null;
  if (Math.random() < .5) { humCol = BLACK; aiCol = WHITE; }
  else                    { humCol = WHITE; aiCol = BLACK; }
  turn = BLACK;
  hideOverlay(); updateConfirmBtn(); updateForbidden();
  updateUndoBtn(); updateStatus(); render(getState());
  if (aiCol === BLACK) {
    scheduleAI();           // AI goes first — snapshot pushed in finishAITurn
  } else {
    pushSnapshot();         // Human goes first — push initial state now
  }
}

function showStart() {
  destroyGodWorker();
  hideOverlay();
  pendingMove = null;
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('startScreen').style.display = 'flex';
  const sub = document.getElementById('learnSubmenu');
  if (sub) sub.style.display = 'none';
  const btnLearn = document.getElementById('btn-learn');
  if (btnLearn) btnLearn.textContent = '학습하기 ▼';
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

  if (pendingMove && pendingMove[0] === r && pendingMove[1] === c) {
    pendingMove = null;
    updateConfirmBtn();
    render(getState());
    return;
  }

  pendingMove = [r, c];
  updateConfirmBtn();
  render(getState());
}

function confirmMove() {
  if (!pendingMove || over || aiBusy || turn !== humCol) return;
  const [r, c] = pendingMove;
  pendingMove = null;
  place(r, c, humCol);
  // snapshot is NOT pushed here; it will be pushed in finishAITurn
  updateConfirmBtn(); updateUndoBtn();
  render(getState());
  const wl = checkWin(board, r, c);
  if (wl) { endGame(wl, true); return; }
  if (full()) { endGame(null, null); return; }
  turn = aiCol; updateForbidden(); updateStatus(); scheduleAI();
}

// ── Board helpers ─────────────────────────────────────────────────────────────
function place(r, c, col) { board[r][c] = col; lastMove = [r, c]; }
function full() {
  for (let r=0;r<N;r++) for (let c=0;c<N;c++) if (board[r][c]===EMPTY) return false;
  return true;
}

// ── Confirm button ────────────────────────────────────────────────────────────
function updateConfirmBtn() {
  const btn = document.getElementById('confirmBtn');
  if (btn) btn.disabled = !pendingMove;
}

// ── Undo button ───────────────────────────────────────────────────────────────
function updateUndoBtn() {
  const btn = document.getElementById('undoBtn');
  const overlayBtn = document.getElementById('undoOverlayBtn');
  if (btn) {
    btn.style.display = learnMode ? '' : 'none';
    btn.disabled = history.length <= 1 || aiBusy;
  }
  if (overlayBtn) overlayBtn.style.display = learnMode ? '' : 'none';
}

// ── AI ────────────────────────────────────────────────────────────────────────
function scheduleAI() {
  aiBusy = true;
  updateUndoBtn();
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
  sendToGodWorker({ board: board.map(r => [...r]), aiCol, humCol, superGod: diff === 'superGod' });
}

function finishAITurn(r, c) {
  place(r, c, aiCol);
  aiBusy = false; turn = humCol;
  pushSnapshot();   // human's turn now — capture this state for undo
  render(getState());
  const wl = checkWin(board, r, c);
  if (wl) { endGame(wl, false); return; }
  if (full()) { endGame(null, null); return; }
  updateForbidden(); updateUndoBtn(); updateStatus();
}

// ── End game ──────────────────────────────────────────────────────────────────
function endGame(wl, humanWon) {
  winLine = wl; over = true;
  render(getState());
  setTimeout(() => { showResult(humanWon); updateUndoBtn(); }, 450);
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
  render({
    board: Array.from({length: N}, () => new Array(N).fill(EMPTY)),
    turn: BLACK, over: false, forbiddenSet: new Set(),
    lastMove: null, winLine: null, flashMsg: '', humCol: BLACK, pendingMove: null
  });

  const diffs = ['easy', 'medium', 'hard', 'expert', 'god', 'superGod'];
  for (const d of diffs) {
    document.getElementById('btn-' + d)?.addEventListener('click', () => startGame(d));
  }

  document.getElementById('btn-learn').addEventListener('click', () => {
    const sub = document.getElementById('learnSubmenu');
    const opening = sub.style.display === 'none';
    sub.style.display = opening ? 'flex' : 'none';
    document.getElementById('btn-learn').textContent = opening ? '학습하기 ▲' : '학습하기 ▼';
  });

  document.querySelectorAll('.learn-sub').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('learnSubmenu').style.display = 'none';
      document.getElementById('btn-learn').textContent = '학습하기 ▼';
      startGame('learn', btn.dataset.diff);
    });
  });

  document.getElementById('menuBtn').addEventListener('click', showStart);
  document.getElementById('restartBtn').addEventListener('click', newGame);
  document.getElementById('confirmBtn').addEventListener('click', confirmMove);
  document.getElementById('undoBtn').addEventListener('click', undoMove);
  document.getElementById('undoOverlayBtn').addEventListener('click', () => { hideOverlay(); undoMove(); });
  document.getElementById('playAgainBtn').addEventListener('click', newGame);
  document.getElementById('changeDiffBtn').addEventListener('click', showStart);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}
