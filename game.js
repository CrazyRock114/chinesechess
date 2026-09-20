// ============================================================
// 中國象棋規則引擎（純邏輯，不依賴 three.js）
// 棋盘坐标：row 0 = 紅方底线（下方），row 9 = 黑方底线（上方）
// col 0..8 从左到右
// ============================================================

export const ROWS = 10;
export const COLS = 9;
export const RED = 'red';
export const BLACK = 'black';

const RED_NAMES_HANT =   { K: '帥', A: '仕', B: '相', N: '傌', R: '俥', C: '炮', P: '兵' };
const BLACK_NAMES_HANT = { K: '將', A: '士', B: '象', N: '馬', R: '車', C: '砲', P: '卒' };

const RED_NAMES_HANS =   { K: '帅', A: '仕', B: '相', N: '马', R: '车', C: '炮', P: '兵' };
const BLACK_NAMES_HANS = { K: '将', A: '士', B: '象', N: '马', R: '车', C: '炮', P: '卒' };

export function name(side, type, lang = 'zh-Hant') {
  const isHans = lang === 'zh-Hans';
  const map = isHans
    ? (side === RED ? RED_NAMES_HANS : BLACK_NAMES_HANS)
    : (side === RED ? RED_NAMES_HANT : BLACK_NAMES_HANT);
  return map[type];
}

export function initialBoard() {
  const b = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const back = ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R'];
  for (let c = 0; c < COLS; c++) {
    b[0][c] = { type: back[c], side: RED };
    b[9][c] = { type: back[c], side: BLACK };
  }
  b[2][1] = { type: 'C', side: RED };
  b[2][7] = { type: 'C', side: RED };
  b[7][1] = { type: 'C', side: BLACK };
  b[7][7] = { type: 'C', side: BLACK };
  for (const c of [0, 2, 4, 6, 8]) {
    b[3][c] = { type: 'P', side: RED };
    b[6][c] = { type: 'P', side: BLACK };
  }
  return b;
}

const inb = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

/** 某棋子所有“伪合法”走法（含吃子，未过滤送将/对脸） */
export function getMoves(b, r, c) {
  const p = b[r][c];
  if (!p) return [];
  const out = [];
  const side = p.side;
  const foe = side === RED ? BLACK : RED;
  const add = (r, c) => out.push({ r, c });
  const target = (r, c) => {
    if (!inb(r, c)) return false;
    const t = b[r][c];
    if (t === null) { add(r, c); return true; }
    if (t.side === foe) add(r, c);
    return false;
  };

  switch (p.type) {
    case 'K': {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (!inb(nr, nc)) continue;
        if (nc < 3 || nc > 5) continue;
        const inPalace = side === RED ? (nr >= 0 && nr <= 2) : (nr >= 7 && nr <= 9);
        if (!inPalace) continue;
        target(nr, nc);
      }
      break;
    }
    case 'A': {
      const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (!inb(nr, nc)) continue;
        if (nc < 3 || nc > 5) continue;
        const inPalace = side === RED ? (nr >= 0 && nr <= 2) : (nr >= 7 && nr <= 9);
        if (!inPalace) continue;
        target(nr, nc);
      }
      break;
    }
    case 'B': {
      const dirs = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (!inb(nr, nc)) continue;
        const onOwnSide = side === RED ? nr <= 4 : nr >= 5;
        if (!onOwnSide) continue;
        if (b[r + dr / 2][c + dc / 2]) continue; // 塞象眼
        target(nr, nc);
      }
      break;
    }
    case 'N': {
      const steps = [
        [-2, -1, [-1, 0]], [-2, 1, [-1, 0]],
        [-1, 2, [0, 1]],   [-1, -2, [0, -1]],
        [1, 2, [0, 1]],    [1, -2, [0, -1]],
        [2, 1, [1, 0]],    [2, -1, [1, 0]],
      ];
      for (const [dr, dc, leg] of steps) {
        const nr = r + dr, nc = c + dc;
        if (!inb(nr, nc)) continue;
        if (b[r + leg[0]][c + leg[1]]) continue; // 蹩馬腿
        target(nr, nc);
      }
      break;
    }
    case 'R': {
      slideMoves(b, r, c, out, side, foe, false);
      break;
    }
    case 'C': {
      slideMoves(b, r, c, out, side, foe, true);
      break;
    }
    case 'P': {
      const dir = side === RED ? 1 : -1; // 紅向上（row 增大），黑向下
      if (inb(r + dir, c)) target(r + dir, c);
      const crossed = side === RED ? r >= 5 : r <= 4; // 过河后可横走
      if (crossed) {
        if (inb(r, c - 1)) target(r, c - 1);
        if (inb(r, c + 1)) target(r, c + 1);
      }
      break;
    }
  }
  return out;
}

function slideMoves(b, r, c, out, side, foe, isCannon) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc;
    let mounted = false; // 炮是否已翻过炮架
    while (inb(nr, nc)) {
      const t = b[nr][nc];
      if (t === null) {
        if (!isCannon || !mounted) out.push({ r: nr, c: nc });
      } else if (!mounted) {
        if (isCannon) {
          mounted = true; // 炮：記下砲架繼續向前
        } else {
          if (t.side === foe) out.push({ r: nr, c: nc }); // 車：吃掉第一個敵子
          break;
        }
      } else {
        if (t.side === foe) out.push({ r: nr, c: nc }); // 炮翻山吃子
        break;
      }
      nr += dr; nc += dc;
    }
  }
}

/** 雙方將/帥同一列且中間無子（對臉/飛將） */
export function kingsFacing(b) {
  const rk = kingPos(b, RED), bk = kingPos(b, BLACK);
  if (!rk || !bk) return false;
  if (rk.c !== bk.c) return false;
  const lo = Math.min(rk.r, bk.r), hi = Math.max(rk.r, bk.r);
  for (let r = lo + 1; r < hi; r++) if (b[r][rk.c]) return false;
  return true;
}

export function kingPos(b, side) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const p = b[r][c];
      if (p && p.type === 'K' && p.side === side) return { r, c };
    }
  return null;
}

/** 局面雜湊字串（用於重複局面偵測） */
export function hashBoard(b) {
  let s = '';
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const p = b[r][c];
      s += p ? p.type + (p.side === RED ? 'r' : 'b') : '.';
    }
  return s;
}

/** 某一方是否被將（含白臉將：將帥同列相照） */
export function inCheck(b, side) {
  if (kingsFacing(b)) return true;
  const k = kingPos(b, side);
  if (!k) return true;
  const foe = side === RED ? BLACK : RED;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const p = b[r][c];
      if (!p || p.side !== foe) continue;
      for (const m of getMoves(b, r, c))
        if (m.r === k.r && m.c === k.c) return true;
    }
  return false;
}

/** 過濾後真正合法的走法（不送將、不對臉） */
export function legalMoves(b, r, c) {
  const p = b[r][c];
  if (!p) return [];
  return getMoves(b, r, c).filter((m) => {
    const nb = b.map((row) => row.slice());
    nb[m.r][m.c] = p;
    nb[r][c] = null;
    return !inCheck(nb, p.side) && !kingsFacing(nb);
  });
}

/** 執行一步棋，回被吃的子（null 表示沒吃到） */
export function applyMove(b, from, to) {
  const captured = b[to.r][to.c];
  b[to.r][to.c] = b[from.r][from.c];
  b[from.r][from.c] = null;
  return captured;
}

export function hasAnyLegalMove(b, side) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const p = b[r][c];
      if (p && p.side === side && legalMoves(b, r, c).length > 0) return true;
    }
  return false;
}

// ---------------- 三次重複局面／長將 ----------------
/**
 * 三次重複局面判決（長將判負）：同一局面（含輪走方）出現第三次時——
 *   · 其間某一方每步都照將（長將）→ 該方判負
 *   · 雙方皆長將或皆非長將 → 判和
 * @param {Array<{key:string, mover:(string|null), check:boolean}>} records
 *   每步之後的局面記錄；[0] 為起始局面（mover=null）。
 *   key＝hashBoard(盤面)+'|'+輪走方（不含輪走方不算「同一局面」）。
 * @param {string} key 目前（剛形成）的局面鍵
 * @returns {null|{result:'loss', loser:string, reason:'長將'}|{result:'draw', reason:string}}
 *   null＝未構成三次重複
 */
export function repetitionVerdict(records, key) {
  const idxs = [];
  for (let i = 0; i < records.length; i++) if (records[i].key === key) idxs.push(i);
  if (idxs.length < 3) return null;
  const perpetual = { [RED]: true, [BLACK]: true };
  const hasMoved = { [RED]: false, [BLACK]: false };
  for (let i = idxs[0] + 1; i < records.length; i++) {
    const rec = records[i];
    if (rec.mover == null) continue;
    hasMoved[rec.mover] = true;
    if (!rec.check) perpetual[rec.mover] = false;
  }
  const redPerp = hasMoved[RED] && perpetual[RED];
  const blackPerp = hasMoved[BLACK] && perpetual[BLACK];
  if (redPerp && !blackPerp) return { result: 'loss', loser: RED, reason: '長將' };
  if (blackPerp && !redPerp) return { result: 'loss', loser: BLACK, reason: '長將' };
  return { result: 'draw', reason: redPerp && blackPerp ? '雙方長將' : '三次重複局面' };
}

// ---------------- 棋譜 notation ----------------
// 普通記錄法：
//   平（橫走）/ 斜走（傌象仕）：第四字＝到達的線路號
//   直線進退（車炮將兵）：第四字＝進退的格數
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** 生成傳統棋譜，例如「傌八進七」「炮二平五」「兵五進一」「前俥進二」 */
export function notation(b, from, to, lang = 'zh-Hant') {
  const p = b[from.r][from.c];
  if (!p) return '?';
  const side = p.side;
  const isHans = lang === 'zh-Hans';
  const fileOf = (c) => (side === RED ? 9 - c : c + 1);
  const head = name(side, p.type, lang);
  const f1 = CN[fileOf(from.c)];

  // 檢查同縱列是否有相同兵種（如雙車、雙炮、雙馬、多兵）
  const sameColRows = [];
  for (let r = 0; r < ROWS; r++) {
    const cp = b[r][from.c];
    if (cp && cp.side === side && cp.type === p.type) {
      sameColRows.push(r);
    }
  }

  let tag1 = head;
  let tag2 = f1;

  if (sameColRows.length > 1) {
    // 依朝向對方底線的先後排序：紅方 r 大者為前，黑方 r 小者為前
    if (side === RED) {
      sameColRows.sort((a, b2) => b2 - a);
    } else {
      sameColRows.sort((a, b2) => a - b2);
    }
    const idx = sameColRows.indexOf(from.r);
    const backChar = isHans ? '后' : '後';
    let prefix = '前';
    if (sameColRows.length === 2) {
      prefix = idx === 0 ? '前' : backChar;
    } else if (sameColRows.length === 3) {
      prefix = idx === 0 ? '前' : (idx === 1 ? '中' : backChar);
    } else {
      const prefixes = isHans ? ['前', '二', '三', '四', backChar] : ['前', '二', '三', '四', '後'];
      prefix = idx === sameColRows.length - 1 ? backChar : (prefixes[idx] || '前');
    }
    tag1 = prefix;
    tag2 = head;
  }

  const advancing = (side === RED) ? to.r > from.r : to.r < from.r;
  const advAction = isHans ? '进' : '進';
  const act = advancing ? advAction : '退';

  if (from.c === to.c) {
    // 直線進退：格數
    const steps = Math.abs(to.r - from.r);
    return `${tag1}${tag2}${act}${CN[steps]}`;
  }
  if (to.r === from.r) {
    // 橫走：到達線路號
    return `${tag1}${tag2}平${CN[fileOf(to.c)]}`;
  }
  // 斜走（傌象仕）：到達線路號
  return `${tag1}${tag2}${act}${CN[fileOf(to.c)]}`;
}

// ---------------- FEN (Forsyth-Edwards Notation) ----------------
/**
 * 將棋盤局面序列化為標準象棋 FEN 字串（X-FEN / UCCI 格式）
 * 例：rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1
 */
export function toFEN(b, activeSide = RED, halfmove = 0, fullmove = 1) {
  const rows = [];
  for (let r = ROWS - 1; r >= 0; r--) {
    let rowStr = '';
    let empty = 0;
    for (let c = 0; c < COLS; c++) {
      const p = b[r][c];
      if (!p) {
        empty++;
      } else {
        if (empty > 0) {
          rowStr += empty;
          empty = 0;
        }
        rowStr += p.side === RED ? p.type : p.type.toLowerCase();
      }
    }
    if (empty > 0) rowStr += empty;
    rows.push(rowStr);
  }
  const color = activeSide === RED ? 'w' : 'b';
  return `${rows.join('/')} ${color} - - ${halfmove} ${fullmove}`;
}

/**
 * 解析標準象棋 FEN 字串為棋盤局面與輪走方
 * @param {string} fen
 * @returns {{board: Array<Array<object|null>>, turn: string}}
 */
export function loadFEN(fen) {
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0].split('/');
  if (rows.length !== ROWS) throw new Error(`FEN 行數無效，需 10 行，實際為 ${rows.length} 行`);
  const b = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  for (let i = 0; i < ROWS; i++) {
    const r = ROWS - 1 - i;
    const rowStr = rows[i];
    let c = 0;
    for (const ch of rowStr) {
      if (ch >= '1' && ch <= '9') {
        c += parseInt(ch, 10);
      } else {
        const isUpper = ch >= 'A' && ch <= 'Z';
        const type = ch.toUpperCase();
        const side = isUpper ? RED : BLACK;
        if (c >= COLS) throw new Error(`FEN 格式錯誤：第 ${r} 行列數超出 9 列`);
        b[r][c] = { type, side };
        c++;
      }
    }
    if (c !== COLS) throw new Error(`FEN 格式錯誤：第 ${r} 行列數不足 9 列（實際 ${c} 列）`);
  }
  let turn = RED;
  if (parts.length > 1) {
    const t = parts[1].toLowerCase();
    turn = (t === 'b' || t === 'black') ? BLACK : RED;
  }
  return { board: b, turn };
}

