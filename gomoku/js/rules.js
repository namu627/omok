import { N, EMPTY, BLACK } from './constants.js';

export function runLen(b, r, c, dr, dc) {
  const col = b[r][c]; let len = 1;
  for (let d=1;d<N;d++){const nr=r+dr*d,nc=c+dc*d;if(nr<0||nr>=N||nc<0||nc>=N||b[nr][nc]!==col)break;len++;}
  for (let d=1;d<N;d++){const nr=r-dr*d,nc=c-dc*d;if(nr<0||nr>=N||nc<0||nc>=N||b[nr][nc]!==col)break;len++;}
  return len;
}

export function countFours(b, r, c) {
  let cnt = 0; const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) {
    let found = false;
    for (let k=0;k<=4&&!found;k++) {
      const sr=r-k*dr,sc=c-k*dc; let bl=0,em=0,ok=true;
      for (let i=0;i<5;i++) {
        const nr=sr+i*dr,nc=sc+i*dc;
        if(nr<0||nr>=N||nc<0||nc>=N){ok=false;break;}
        const v=b[nr][nc];
        if(v===BLACK)bl++;else if(v===EMPTY)em++;else{ok=false;break;}
      }
      if(ok&&bl===4&&em===1)found=true;
    }
    if(found)cnt++;
  }
  return cnt;
}

export function countOpenThrees(b, r, c) {
  let cnt = 0; const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) {
    let found = false;
    for (let k=0;k<=5&&!found;k++) {
      const sr=r-k*dr,sc=c-k*dc; const cells=[]; let ok=true;
      for (let i=0;i<6;i++) {
        const nr=sr+i*dr,nc=sc+i*dc;
        if(nr<0||nr>=N||nc<0||nc>=N){ok=false;break;}
        cells.push(b[nr][nc]);
      }
      if(!ok)continue;
      let bl=0,em=0,ho=false;
      for (const v of cells){if(v===BLACK)bl++;else if(v===EMPTY)em++;else{ho=true;break;}}
      if(ho||bl!==3||em!==3)continue;
      for (let i=0;i<6&&!found;i++) {
        if(cells[i]!==EMPTY)continue;
        const t=cells.slice(); t[i]=BLACK;
        if(t[0]===EMPTY&&t[1]===BLACK&&t[2]===BLACK&&t[3]===BLACK&&t[4]===BLACK&&t[5]===EMPTY)found=true;
      }
    }
    if(found)cnt++;
  }
  return cnt;
}

export function isForbiddenPlaced(b, r, c) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) if(runLen(b,r,c,dr,dc)===5) return false;
  for (const [dr,dc] of dirs) if(runLen(b,r,c,dr,dc)>=6)  return true;
  if (countFours(b,r,c) >= 2)      return true;
  if (countOpenThrees(b,r,c) >= 2) return true;
  return false;
}

export function isForbidden(b, r, c) {
  b[r][c] = BLACK;
  const f = isForbiddenPlaced(b, r, c);
  b[r][c] = EMPTY;
  return f;
}

export function filterForbidden(b, moves) {
  return moves.filter(([r,c]) => !isForbidden(b, r, c));
}

export function winFast(b, r, c) {
  const col = b[r][c]; const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) {
    let n=1;
    for(let d=1;d<=9;d++){const nr=r+dr*d,nc=c+dc*d;if(nr<0||nr>=N||nc<0||nc>=N||b[nr][nc]!==col)break;n++;}
    for(let d=1;d<=9;d++){const nr=r-dr*d,nc=c-dc*d;if(nr<0||nr>=N||nc<0||nc>=N||b[nr][nc]!==col)break;n++;}
    if(col===BLACK?n===5:n>=5)return true;
  }
  return false;
}

export function checkWin(b, r, c) {
  const col = b[r][c]; if(col===EMPTY) return null;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) {
    const line = [[r,c]];
    for(let d=1;d<=9;d++){const nr=r+dr*d,nc=c+dc*d;if(nr<0||nr>=N||nc<0||nc>=N||b[nr][nc]!==col)break;line.push([nr,nc]);}
    for(let d=1;d<=9;d++){const nr=r-dr*d,nc=c-dc*d;if(nr<0||nr>=N||nc<0||nc>=N||b[nr][nc]!==col)break;line.push([nr,nc]);}
    if(col===BLACK&&line.length===5) return line;
    if(col!==BLACK&&line.length>=5)  return line.slice(0,5);
  }
  return null;
}

export function computeForbiddenSet(board, turn, over) {
  const set = new Set();
  if (turn !== BLACK || over) return set;
  for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
    if (board[r][c] !== EMPTY) continue;
    if (isForbidden(board, r, c)) set.add(r*N+c);
  }
  return set;
}
