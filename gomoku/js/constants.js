export const N = 19;
export const CENTER = Math.floor(N / 2);
export const EMPTY = 0, BLACK = 1, WHITE = 2;

export const S = {
  WIN:    100000000,
  OPEN4:    2000000,
  CLOSE4:   1000000,
  OPEN3:     100000,
  CLOSE3:     10000,
  OPEN2:       1000,
  CLOSE2:       100,
};

export const CFG = {
  easy:     { depth:1, cands:10, noise:.30 },
  medium:   { depth:2, cands:15, noise:0 },
  hard:     { depth:3, cands:20, noise:0 },
  expert:   { depth:4, cands:15, noise:0 },
  god:      { depth:0, cands:15, noise:0 },
  superGod: { depth:0, cands:12, noise:0 },
};

export const DNAME = {
  easy:'쉬움', medium:'보통', hard:'어려움', expert:'전문가', god:'신', superGod:'절대신'
};
