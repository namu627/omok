import { N, CENTER, EMPTY, BLACK, WHITE, S, CFG } from './constants.js';
import { winFast, filterForbidden } from './rules.js';

// ── Regular AI helpers ──────────────────────────────────────────────────────

function evalBoard(b, ai, hu) {
  let sc = 0; const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
    const col=b[r][c]; if(col===EMPTY)continue;
    for (const [dr,dc] of dirs) {
      const pr=r-dr,pc=c-dc; if(pr>=0&&pr<N&&pc>=0&&pc<N&&b[pr][pc]===col)continue;
      let len=0,nr=r,nc=c; while(nr>=0&&nr<N&&nc>=0&&nc<N&&b[nr][nc]===col){len++;nr+=dr;nc+=dc;}
      const op=(pr>=0&&pr<N&&pc>=0&&pc<N&&b[pr][pc]===EMPTY)?1:0;
      const on=(nr>=0&&nr<N&&nc>=0&&nc<N&&b[nr][nc]===EMPTY)?1:0; const oe=op+on;
      let ps=0;
      if(len>=5)ps=S.WIN;
      else if(len===4)ps=oe>=2?S.OPEN4:oe===1?S.CLOSE4:0;
      else if(len===3)ps=oe>=2?S.OPEN3:oe===1?S.CLOSE3:0;
      else if(len===2)ps=oe>=2?S.OPEN2:oe===1?S.CLOSE2:0;
      sc += col===ai ? ps : -ps*1.05;
    }
  }
  return sc;
}

function cellThreat(b, r, c, col) {
  b[r][c]=col; let sc=0; const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) {
    let len=1,fw=0,bw=0;
    for(let d=1;d<=4;d++){const nr=r+dr*d,nc=c+dc*d;if(nr<0||nr>=N||nc<0||nc>=N)break;if(b[nr][nc]===col)len++;else{if(b[nr][nc]===EMPTY)fw=1;break;}}
    for(let d=1;d<=4;d++){const nr=r-dr*d,nc=c-dc*d;if(nr<0||nr>=N||nc<0||nc>=N)break;if(b[nr][nc]===col)len++;else{if(b[nr][nc]===EMPTY)bw=1;break;}}
    const oe=fw+bw;
    if(len>=5)sc+=S.WIN;
    else if(len===4)sc+=oe>=2?S.OPEN4:oe===1?S.CLOSE4:0;
    else if(len===3)sc+=oe>=2?S.OPEN3:oe===1?S.CLOSE3:0;
    else if(len===2)sc+=oe>=2?S.OPEN2:oe===1?S.CLOSE2:0;
  }
  b[r][c]=EMPTY; return sc;
}

function quickSc(b, r, c) {
  let s=0;
  for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
    if(!dr&&!dc)continue;
    const nr=r+dr,nc=c+dc; if(nr>=0&&nr<N&&nc>=0&&nc<N&&b[nr][nc]!==EMPTY)s++;
  }
  return s;
}

export function cands(b, maxN, aiCol, humCol, useAdvSort=false) {
  const seen=new Set(), res=[];
  for(let r=0;r<N;r++) for(let c=0;c<N;c++){
    if(b[r][c]===EMPTY)continue;
    for(let dr=-2;dr<=2;dr++) for(let dc=-2;dc<=2;dc++){
      const nr=r+dr,nc=c+dc;
      if(nr<0||nr>=N||nc<0||nc>=N||b[nr][nc]!==EMPTY)continue;
      const k=nr*N+nc; if(!seen.has(k)){seen.add(k);res.push([nr,nc]);}
    }
  }
  if(!res.length) return [[CENTER,CENTER]];
  if(useAdvSort){
    res.sort((p,q)=>{
      const sp=cellThreat(b,p[0],p[1],aiCol)+cellThreat(b,p[0],p[1],humCol);
      const sq=cellThreat(b,q[0],q[1],aiCol)+cellThreat(b,q[0],q[1],humCol);
      return sq-sp;
    });
  } else {
    res.sort((p,q)=>quickSc(b,q[0],q[1])-quickSc(b,p[0],p[1]));
  }
  return maxN&&res.length>maxN ? res.slice(0,maxN) : res;
}

function orderMoves(b, mv, cur, opp) {
  const wins=[], blocks=[], rest=[];
  for (const [r,c] of mv) {
    b[r][c]=cur; if(winFast(b,r,c)){b[r][c]=EMPTY;wins.push([r,c]);continue;} b[r][c]=EMPTY;
    b[r][c]=opp; if(winFast(b,r,c)){b[r][c]=EMPTY;blocks.push([r,c]);continue;} b[r][c]=EMPTY;
    rest.push([r,c]);
  }
  return [...wins,...blocks,...rest];
}

function mm(b, depth, alpha, beta, isMax, ai, hu, lr, lc, maxC) {
  if(lr!==undefined&&winFast(b,lr,lc)){const w=b[lr][lc];return w===ai?S.WIN+depth:-(S.WIN+depth);}
  if(depth===0) return evalBoard(b,ai,hu);
  const cur=isMax?ai:hu, opp=isMax?hu:ai;
  let mv = cands(b, maxC, ai, hu, true);
  if(cur===BLACK){mv=filterForbidden(b,mv);if(!mv.length)return isMax?-S.WIN:S.WIN;}
  const ord=orderMoves(b,mv,cur,opp); if(!ord.length)return 0;
  if(isMax){
    let val=-Infinity;
    for(const[r,c]of ord){b[r][c]=cur;val=Math.max(val,mm(b,depth-1,alpha,beta,false,ai,hu,r,c,maxC));b[r][c]=EMPTY;alpha=Math.max(alpha,val);if(alpha>=beta)break;}
    return val;
  } else {
    let val=Infinity;
    for(const[r,c]of ord){b[r][c]=cur;val=Math.min(val,mm(b,depth-1,alpha,beta,true,ai,hu,r,c,maxC));b[r][c]=EMPTY;beta=Math.min(beta,val);if(alpha>=beta)break;}
    return val;
  }
}

export function getBest(board, aiCol, humCol, diff_) {
  const {depth, cands:maxC, noise} = CFG[diff_];
  const useAdv = diff_==='hard'||diff_==='expert';
  let mv = cands(board, maxC, aiCol, humCol, useAdv);
  if(aiCol===BLACK){mv=filterForbidden(board,mv);if(!mv.length)return[CENTER,CENTER];}
  for(const[r,c]of mv){board[r][c]=aiCol;if(winFast(board,r,c)){board[r][c]=EMPTY;return[r,c];}board[r][c]=EMPTY;}
  for(const[r,c]of mv){board[r][c]=humCol;if(winFast(board,r,c)){board[r][c]=EMPTY;if(diff_==='easy'&&Math.random()<noise)continue;return[r,c];}board[r][c]=EMPTY;}
  if(diff_==='easy'&&Math.random()<noise*.6)return mv[Math.floor(Math.random()*Math.min(mv.length,5))];
  const ord=orderMoves(board,mv,aiCol,humCol);
  let best=-Infinity, bestM=ord[0]||mv[0];
  for(const[r,c]of ord){
    board[r][c]=aiCol;
    let sc=mm(board,depth-1,-Infinity,Infinity,false,aiCol,humCol,r,c,maxC);
    board[r][c]=EMPTY;
    if(diff_==='easy')sc+=(Math.random()-.5)*S.OPEN3*.8;
    if(sc>best){best=sc;bestM=[r,c];}
  }
  return bestM;
}

// ── God / SuperGod Worker ───────────────────────────────────────────────────

let godWorker = null;

export function ensureGodWorker(msgHandler, errHandler) {
  if (!godWorker) {
    const blob = new Blob([GOD_WORKER_SRC], { type:'application/javascript' });
    godWorker = new Worker(URL.createObjectURL(blob));
    godWorker.onmessage = msgHandler;
    godWorker.onerror   = errHandler;
  }
}

export function destroyGodWorker() {
  if (godWorker) { godWorker.terminate(); godWorker = null; }
}

export function sendToGodWorker(data) {
  if (godWorker) godWorker.postMessage(data);
}

// ── Worker source — self-contained, no DOM/import ──────────────────────────
export const GOD_WORKER_SRC = `
'use strict';
const N=19, CENTER=9, EMPTY=0, BLACK=1, WHITE=2;

// Standard scoring
const S={WIN:100000000,OPEN4:2000000,CLOSE4:1000000,OPEN3:100000,CLOSE3:10000,OPEN2:1000,CLOSE2:100};
// SuperGod enhanced scoring
const S_SG={WIN:100000000,OPEN4:6000000,CLOSE4:1200000,OPEN3:150000,CLOSE3:12000,OPEN2:1000,CLOSE2:100};

let AI_COL, HU_COL, SUPER_GOD=false;
function gs(){return SUPER_GOD?S_SG:S;}
function getMaxC(){return SUPER_GOD?12:15;}
function getTimeLimit(){return SUPER_GOD?3200:2800;}
function defWeight(){return SUPER_GOD?1.1:1.05;}
function centerBonus(r,c){
  if(!SUPER_GOD)return 0;
  const d=Math.max(Math.abs(r-CENTER),Math.abs(c-CENTER));
  return Math.max(0,(8-d)*8);
}

// Zobrist hash
const ZT=new Int32Array(N*N*2);
for(let i=0;i<ZT.length;i++)ZT[i]=(Math.random()*0x100000000)|0;
let curHash=0;
function zh(r,c,col){return ZT[((r*N+c)<<1)+col-1];}
function hToggle(r,c,col){curHash^=zh(r,c,col);}

// Transposition table
const TT_BITS=18,TT_SIZE=1<<TT_BITS,TT_MASK=TT_SIZE-1;
const EXACT=0,LOWER=1,UPPER=2;
const tt_h=new Int32Array(TT_SIZE).fill(0x7fffffff);
const tt_s=new Int32Array(TT_SIZE);
const tt_d=new Int8Array(TT_SIZE);
const tt_f=new Uint8Array(TT_SIZE);
const tt_r=new Int8Array(TT_SIZE);
const tt_c=new Int8Array(TT_SIZE);

function ttProbe(depth,alpha,beta){
  const i=curHash&TT_MASK;
  if(tt_h[i]!==curHash||tt_d[i]<depth)return undefined;
  const sc=tt_s[i],fl=tt_f[i];
  if(fl===EXACT)return sc;
  if(fl===LOWER&&sc>=beta)return sc;
  if(fl===UPPER&&sc<=alpha)return sc;
  return undefined;
}
function ttMove(){const i=curHash&TT_MASK;if(tt_h[i]!==curHash)return null;return[tt_r[i],tt_c[i]];}
function ttStore(depth,score,flag,r,c){
  const i=curHash&TT_MASK;
  if(tt_h[i]===curHash&&tt_d[i]>depth)return;
  tt_h[i]=curHash;tt_s[i]=score;tt_d[i]=depth;tt_f[i]=flag;tt_r[i]=r;tt_c[i]=c;
}

function pS(b,r,c,col){b[r][c]=col;hToggle(r,c,col);}
function rS(b,r,c,col){b[r][c]=EMPTY;hToggle(r,c,col);}

function runLen(b,r,c,dr,dc){
  const col=b[r][c];let len=1;
  for(let d=1;d<N;d++){const nr=r+dr*d,nc=c+dc*d;if(nr<0||nr>=N||nc<0||nc>=N||b[nr][nc]!==col)break;len++;}
  for(let d=1;d<N;d++){const nr=r-dr*d,nc=c-dc*d;if(nr<0||nr>=N||nc<0||nc>=N||b[nr][nc]!==col)break;len++;}
  return len;
}
function countFours(b,r,c){
  let cnt=0;const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(const[dr,dc]of dirs){
    let found=false;
    for(let k=0;k<=4&&!found;k++){
      const sr=r-k*dr,sc=c-k*dc;let bl=0,em=0,ok=true;
      for(let i=0;i<5;i++){const nr=sr+i*dr,nc=sc+i*dc;if(nr<0||nr>=N||nc<0||nc>=N){ok=false;break;}const v=b[nr][nc];if(v===BLACK)bl++;else if(v===EMPTY)em++;else{ok=false;break;}}
      if(ok&&bl===4&&em===1)found=true;
    }
    if(found)cnt++;
  }
  return cnt;
}
function countOpenThrees(b,r,c){
  let cnt=0;const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(const[dr,dc]of dirs){
    let found=false;
    for(let k=0;k<=5&&!found;k++){
      const sr=r-k*dr,sc=c-k*dc;const cells=[];let ok=true;
      for(let i=0;i<6;i++){const nr=sr+i*dr,nc=sc+i*dc;if(nr<0||nr>=N||nc<0||nc>=N){ok=false;break;}cells.push(b[nr][nc]);}
      if(!ok)continue;
      let bl=0,em=0,ho=false;for(const v of cells){if(v===BLACK)bl++;else if(v===EMPTY)em++;else{ho=true;break;}}
      if(ho||bl!==3||em!==3)continue;
      for(let i=0;i<6&&!found;i++){if(cells[i]!==EMPTY)continue;const t=cells.slice();t[i]=BLACK;if(t[0]===EMPTY&&t[1]===BLACK&&t[2]===BLACK&&t[3]===BLACK&&t[4]===BLACK&&t[5]===EMPTY)found=true;}
    }
    if(found)cnt++;
  }
  return cnt;
}
function iFP(b,r,c){
  const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(const[dr,dc]of dirs)if(runLen(b,r,c,dr,dc)===5)return false;
  for(const[dr,dc]of dirs)if(runLen(b,r,c,dr,dc)>=6)return true;
  if(countFours(b,r,c)>=2)return true;
  if(countOpenThrees(b,r,c)>=2)return true;
  return false;
}
function iForbid(b,r,c){b[r][c]=BLACK;const f=iFP(b,r,c);b[r][c]=EMPTY;return f;}

function winFast(b,r,c){
  const col=b[r][c];const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(const[dr,dc]of dirs){
    let n=1;
    for(let d=1;d<=9;d++){const nr=r+dr*d,nc=c+dc*d;if(nr<0||nr>=N||nc<0||nc>=N||b[nr][nc]!==col)break;n++;}
    for(let d=1;d<=9;d++){const nr=r-dr*d,nc=c-dc*d;if(nr<0||nr>=N||nc<0||nc>=N||b[nr][nc]!==col)break;n++;}
    if(col===BLACK?n===5:n>=5)return true;
  }
  return false;
}

function evalBoard(b,ai,hu){
  const sc_t=gs(); let sc=0; const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    const col=b[r][c];if(col===EMPTY)continue;
    for(const[dr,dc]of dirs){
      const pr=r-dr,pc=c-dc;if(pr>=0&&pr<N&&pc>=0&&pc<N&&b[pr][pc]===col)continue;
      let len=0,nr=r,nc=c;while(nr>=0&&nr<N&&nc>=0&&nc<N&&b[nr][nc]===col){len++;nr+=dr;nc+=dc;}
      const op=(pr>=0&&pr<N&&pc>=0&&pc<N&&b[pr][pc]===EMPTY)?1:0;
      const on=(nr>=0&&nr<N&&nc>=0&&nc<N&&b[nr][nc]===EMPTY)?1:0;const oe=op+on;
      let ps=0;
      if(len>=5)ps=sc_t.WIN;
      else if(len===4)ps=oe>=2?sc_t.OPEN4:oe===1?sc_t.CLOSE4:0;
      else if(len===3)ps=oe>=2?sc_t.OPEN3:oe===1?sc_t.CLOSE3:0;
      else if(len===2)ps=oe>=2?sc_t.OPEN2:oe===1?sc_t.CLOSE2:0;
      sc+=col===ai?ps:-ps*defWeight();
    }
  }
  return sc;
}

function cellThreat(b,r,c,col){
  const sc_t=gs(); b[r][c]=col;let sc=0;const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(const[dr,dc]of dirs){
    let len=1,fw=0,bw=0;
    for(let d=1;d<=4;d++){const nr=r+dr*d,nc=c+dc*d;if(nr<0||nr>=N||nc<0||nc>=N)break;if(b[nr][nc]===col)len++;else{if(b[nr][nc]===EMPTY)fw=1;break;}}
    for(let d=1;d<=4;d++){const nr=r-dr*d,nc=c-dc*d;if(nr<0||nr>=N||nc<0||nc>=N)break;if(b[nr][nc]===col)len++;else{if(b[nr][nc]===EMPTY)bw=1;break;}}
    const oe=fw+bw;
    if(len>=5)sc+=sc_t.WIN;
    else if(len===4)sc+=oe>=2?sc_t.OPEN4:oe===1?sc_t.CLOSE4:0;
    else if(len===3)sc+=oe>=2?sc_t.OPEN3:oe===1?sc_t.CLOSE3:0;
    else if(len===2)sc+=oe>=2?sc_t.OPEN2:oe===1?sc_t.CLOSE2:0;
  }
  b[r][c]=EMPTY;
  sc+=centerBonus(r,c);
  return sc;
}

function cands(b,maxN){
  const seen=new Set(),res=[];
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    if(b[r][c]===EMPTY)continue;
    for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){const nr=r+dr,nc=c+dc;if(nr<0||nr>=N||nc<0||nc>=N||b[nr][nc]!==EMPTY)continue;const k=nr*N+nc;if(!seen.has(k)){seen.add(k);res.push([nr,nc]);}}
  }
  if(!res.length)return[[CENTER,CENTER]];
  res.sort((p,q)=>{
    const sp=cellThreat(b,p[0],p[1],AI_COL)+cellThreat(b,p[0],p[1],HU_COL);
    const sq=cellThreat(b,q[0],q[1],AI_COL)+cellThreat(b,q[0],q[1],HU_COL);
    return sq-sp;
  });
  return maxN&&res.length>maxN?res.slice(0,maxN):res;
}

function orderMoves(b,mv,cur,opp){
  const wins=[],blocks=[],rest=[];
  for(const[r,c]of mv){
    b[r][c]=cur;if(winFast(b,r,c)){b[r][c]=EMPTY;wins.push([r,c]);continue;}b[r][c]=EMPTY;
    b[r][c]=opp;if(winFast(b,r,c)){b[r][c]=EMPTY;blocks.push([r,c]);continue;}b[r][c]=EMPTY;
    rest.push([r,c]);
  }
  return[...wins,...blocks,...rest];
}

let timeUp=false,startTime=0;
function chkTime(){if(Date.now()-startTime>=getTimeLimit())timeUp=true;}

function mmGod(b,depth,alpha,beta,isMax,ai,hu,lr,lc,maxC){
  if(timeUp)return 0;
  if(lr!==undefined&&winFast(b,lr,lc)){const w=b[lr][lc];return w===ai?gs().WIN+depth:-(gs().WIN+depth);}
  const ttv=ttProbe(depth,alpha,beta);if(ttv!==undefined)return ttv;
  if(depth===0)return evalBoard(b,ai,hu);
  const cur=isMax?ai:hu,opp=isMax?hu:ai;
  let mv=cands(b,maxC);
  if(cur===BLACK){mv=mv.filter(([r,c])=>!iForbid(b,r,c));if(!mv.length)return isMax?-gs().WIN:gs().WIN;}
  const tm=ttMove();
  let ord=orderMoves(b,mv,cur,opp);
  if(tm){const idx=ord.findIndex(([r,c])=>r===tm[0]&&c===tm[1]);if(idx>0){const m=ord.splice(idx,1)[0];ord.unshift(m);}}
  const origA=alpha;let best=isMax?-Infinity:Infinity,br=-1,bc=-1;
  for(const[r,c]of ord){
    if(timeUp)break;
    pS(b,r,c,cur);
    const v=mmGod(b,depth-1,alpha,beta,!isMax,ai,hu,r,c,maxC);
    rS(b,r,c,cur);
    if(isMax){if(v>best){best=v;br=r;bc=c;}if(best>alpha)alpha=best;}
    else{if(v<best){best=v;br=r;bc=c;}if(best<beta)beta=best;}
    if(alpha>=beta)break;
  }
  if(!timeUp&&br>=0){const fl=best>=beta?LOWER:best>origA?EXACT:UPPER;ttStore(depth,best,fl,br,bc);}
  return best;
}

function searchGod(board,ai,hu){
  startTime=Date.now();timeUp=false;
  curHash=0;
  for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(board[r][c]!==EMPTY)hToggle(r,c,board[r][c]);
  tt_h.fill(0x7fffffff);
  const MAX_C=getMaxC();
  let mv=cands(board,MAX_C);
  if(ai===BLACK)mv=mv.filter(([r,c])=>!iForbid(board,r,c));
  if(!mv.length)return[CENTER,CENTER];
  for(const[r,c]of mv){pS(board,r,c,ai);if(winFast(board,r,c)){rS(board,r,c,ai);return[r,c];}rS(board,r,c,ai);}
  let bestMove=null;
  for(const[r,c]of mv){board[r][c]=hu;if(winFast(board,r,c)){board[r][c]=EMPTY;bestMove=[r,c];break;}board[r][c]=EMPTY;}
  if(bestMove){return bestMove;}
  for(let depth=1;depth<=8;depth++){
    chkTime();if(timeUp)break;
    mv=cands(board,MAX_C);
    if(ai===BLACK)mv=mv.filter(([r,c])=>!iForbid(board,r,c));
    if(!mv.length)break;
    const tm=ttMove();
    let ord=orderMoves(board,mv,ai,hu);
    if(tm){const idx=ord.findIndex(([r,c])=>r===tm[0]&&c===tm[1]);if(idx>0){const m=ord.splice(idx,1)[0];ord.unshift(m);}}
    let iterBest=-Infinity,iterMove=null,complete=true;
    for(const[r,c]of ord){
      chkTime();if(timeUp){complete=false;break;}
      pS(board,r,c,ai);
      const sc=mmGod(board,depth-1,-Infinity,Infinity,false,ai,hu,r,c,MAX_C);
      rS(board,r,c,ai);
      if(sc>iterBest){iterBest=sc;iterMove=[r,c];}
    }
    if(complete&&iterMove){bestMove=iterMove;if(iterBest>=gs().WIN)break;}
    else if(!bestMove&&iterMove)bestMove=iterMove;
  }
  return bestMove||mv[0]||[CENTER,CENTER];
}

function searchGodTop3(board,ai,hu){
  startTime=Date.now();timeUp=false;
  curHash=0;
  for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(board[r][c]!==EMPTY)hToggle(r,c,board[r][c]);
  tt_h.fill(0x7fffffff);
  const MAX_C=getMaxC();
  let mv=cands(board,MAX_C);
  if(ai===BLACK)mv=mv.filter(([r,c])=>!iForbid(board,r,c));
  if(!mv.length)return[{r:CENTER,c:CENTER,score:0}];
  let bestScores=mv.slice(0,3).map(([r,c])=>({r,c,score:0}));
  for(let depth=1;depth<=8;depth++){
    chkTime();if(timeUp)break;
    mv=cands(board,MAX_C);
    if(ai===BLACK)mv=mv.filter(([r,c])=>!iForbid(board,r,c));
    if(!mv.length)break;
    const tm=ttMove();
    let ord=orderMoves(board,mv,ai,hu);
    if(tm){const idx=ord.findIndex(([r,c])=>r===tm[0]&&c===tm[1]);if(idx>0){const m=ord.splice(idx,1)[0];ord.unshift(m);}}
    let iterScores=[],complete=true,foundWin=false;
    for(const[r,c]of ord){
      chkTime();if(timeUp){complete=false;break;}
      pS(board,r,c,ai);
      const sc=mmGod(board,depth-1,-Infinity,Infinity,false,ai,hu,r,c,MAX_C);
      rS(board,r,c,ai);
      iterScores.push({r,c,score:sc});
      if(sc>=gs().WIN)foundWin=true;
    }
    if(complete){iterScores.sort((a,b)=>b.score-a.score);bestScores=iterScores;if(foundWin)break;}
  }
  return bestScores.slice(0,3);
}

self.onmessage=function(e){
  AI_COL=e.data.aiCol; HU_COL=e.data.humCol; SUPER_GOD=!!e.data.superGod;
  if(e.data.getHints){
    const hints=searchGodTop3(e.data.board,AI_COL,HU_COL);
    self.postMessage({hints});
  }else{
    const move=searchGod(e.data.board,AI_COL,HU_COL);
    self.postMessage({move});
  }
};
`;
