import { N, EMPTY, BLACK } from './constants.js';

export let canvas, ctx;
export let cs = 28, mg = 28;

export const cx = c => mg + c * cs;
export const cy = r => mg + r * cs;

export function getCanvasEl() { return canvas; }

export function pixelToCell(px, py) {
  return [Math.round((py - mg) / cs), Math.round((px - mg) / cs)];
}

export function initCanvas(tapHandler) {
  canvas = document.getElementById('board');
  ctx = canvas.getContext('2d');
  canvas.addEventListener('click', tapHandler);
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    tapHandler({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: false });
}

export function resize() {
  const maxW = window.innerWidth - 32;
  const maxH = window.innerHeight - 200;
  const maxS = Math.min(maxW, maxH, 600);
  cs = Math.max(Math.floor(maxS / (N + 1)), 18);
  mg = cs;
  const sz = cs * (N - 1) + mg * 2;
  canvas.width = sz; canvas.height = sz;
}

export function render(state) {
  if (!ctx) return;
  const { board, turn, over, forbiddenSet, lastMove, winLine, flashMsg, humCol, pendingMove } = state;
  const sz = canvas.width;

  const bg = ctx.createLinearGradient(0, 0, sz, sz);
  bg.addColorStop(0,'#EEC060'); bg.addColorStop(.5,'#DCA850'); bg.addColorStop(1,'#C89040');
  ctx.fillStyle = bg;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0,0,sz,sz,6); else ctx.rect(0,0,sz,sz);
  ctx.fill();

  ctx.save(); ctx.globalAlpha = .03;
  for (let y=-sz;y<sz*2;y+=9){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(sz,y+18);ctx.strokeStyle='#5A3800';ctx.lineWidth=2;ctx.stroke();}
  ctx.restore();

  ctx.strokeStyle = '#8B5A00'; ctx.lineWidth = .8;
  for (let i=0;i<N;i++) {
    ctx.beginPath();ctx.moveTo(cx(i),cy(0));ctx.lineTo(cx(i),cy(N-1));ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx(0),cy(i));ctx.lineTo(cx(N-1),cy(i));ctx.stroke();
  }
  ctx.lineWidth = 1.6; ctx.strokeRect(cx(0),cy(0),cs*(N-1),cs*(N-1));

  ctx.fillStyle = '#5A3800';
  for (const r of [3,9,15]) for (const c of [3,9,15]) {
    ctx.beginPath(); ctx.arc(cx(c),cy(r),Math.max(cs*.09,2.5),0,Math.PI*2); ctx.fill();
  }

  if (winLine && winLine.length >= 2) {
    ctx.save(); ctx.strokeStyle='rgba(255,50,50,.65)'; ctx.lineWidth=cs*.22; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(cx(winLine[0][1]),cy(winLine[0][0]));
    for (const [r,c] of winLine) ctx.lineTo(cx(c),cy(r));
    ctx.stroke(); ctx.restore();
  }

  if (turn === BLACK && !over) {
    for (const k of forbiddenSet) { const r=Math.floor(k/N),c=k%N; drawX(r,c); }
  }

  if (pendingMove && !over) {
    const [pr,pc] = pendingMove;
    ctx.save(); ctx.globalAlpha = 0.45; drawStone(pr, pc, humCol); ctx.restore();
    // Highlight ring on preview
    ctx.save();
    ctx.strokeStyle = humCol === BLACK ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
    ctx.lineWidth = Math.max(cs * .07, 1.5);
    ctx.beginPath(); ctx.arc(cx(pc), cy(pr), cs * .44, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  for (let r=0;r<N;r++) for (let c=0;c<N;c++) if (board[r][c]!==EMPTY) drawStone(r,c,board[r][c]);

  if (lastMove) {
    const [lr,lc] = lastMove; const x=cx(lc),y=cy(lr); const dr=Math.max(cs*.13,3.5);
    ctx.beginPath(); ctx.arc(x,y,dr,0,Math.PI*2);
    ctx.fillStyle = board[lr][lc]===BLACK?'rgba(255,255,255,.85)':'rgba(0,0,0,.65)'; ctx.fill();
  }

  if (flashMsg) {
    ctx.save();
    ctx.font=`bold ${Math.max(cs*1.1,22)}px 'Noto Sans KR',sans-serif`;
    ctx.fillStyle='rgba(220,40,40,.92)'; ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=3;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.strokeText(flashMsg,sz/2,sz/2); ctx.fillText(flashMsg,sz/2,sz/2);
    ctx.restore();
  }
}

export function drawX(r, c) {
  const x=cx(c),y=cy(r),s=Math.max(cs*.19,4);
  ctx.save(); ctx.strokeStyle='rgba(210,50,50,.55)'; ctx.lineWidth=Math.max(cs*.08,1.2); ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(x-s,y-s); ctx.lineTo(x+s,y+s); ctx.moveTo(x+s,y-s); ctx.lineTo(x-s,y+s);
  ctx.stroke(); ctx.restore();
}

export function drawStone(r, c, col) {
  const x=cx(c),y=cy(r),rad=cs*.44;
  ctx.save(); ctx.shadowColor='rgba(0,0,0,.55)'; ctx.shadowBlur=rad*.7; ctx.shadowOffsetX=rad*.1; ctx.shadowOffsetY=rad*.15;
  ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2);
  if (col===BLACK) {
    const g=ctx.createRadialGradient(x-rad*.3,y-rad*.3,0,x,y,rad);
    g.addColorStop(0,'#3a2a1c');g.addColorStop(.5,'#1a1008');g.addColorStop(1,'#0a0604');ctx.fillStyle=g;
  } else {
    const g=ctx.createRadialGradient(x-rad*.3,y-rad*.3,0,x,y,rad);
    g.addColorStop(0,'#ffffff');g.addColorStop(.6,'#f5f0e8');g.addColorStop(1,'#c8bfb0');ctx.fillStyle=g;
  }
  ctx.fill(); ctx.restore();
  const sg=ctx.createRadialGradient(x-rad*.42,y-rad*.46,0,x-rad*.1,y-rad*.1,rad*.78);
  sg.addColorStop(0,col===BLACK?'rgba(255,255,255,.28)':'rgba(255,255,255,.88)');
  sg.addColorStop(1,'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.fillStyle=sg; ctx.fill();
}
