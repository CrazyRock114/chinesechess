// ============================================================
// 中國象棋經典開局庫 (Opening Book)
// 包含中炮對屏風馬、順手炮、反宮馬、仙人指路、飛相局、起馬局等大師定式
// ============================================================
import { initialBoard, applyMove, hashBoard, RED, BLACK } from './game.js?v=82d4648f05';

// 著法輔助工具：(r, c)
const P = (r, c) => ({ r, c });

// 經典開局譜系分支定義（每條分支包含一系列著法序列與權重）
const LINES = [
  // --- 1. 中炮（炮二平五）體系 ---
  // 1.1 中炮對屏風馬（紅進左馬，黑進右馬）
  {
    weight: 45,
    moves: [
      { from: P(2, 7), to: P(2, 4) }, // 1. 紅：炮二平五
      { from: P(9, 1), to: P(7, 2) }, // 1. 黑：馬8進7
      { from: P(0, 1), to: P(2, 2) }, // 2. 紅：傌八進七
      { from: P(9, 0), to: P(9, 1) }, // 2. 黑：車9平8
      { from: P(0, 0), to: P(0, 1) }, // 3. 紅：俥九平八
      { from: P(9, 7), to: P(7, 6) }, // 3. 黑：馬2進3
      { from: P(0, 7), to: P(2, 6) }, // 4. 紅：傌二進三
      { from: P(6, 2), to: P(5, 2) }, // 4. 黑：卒7進1
    ],
  },
  // 1.2 中炮對屏風馬（黑馬2進3，互挺兵）
  {
    weight: 35,
    moves: [
      { from: P(2, 7), to: P(2, 4) }, // 1. 紅：炮二平五
      { from: P(9, 7), to: P(7, 6) }, // 1. 黑：馬2進3
      { from: P(0, 7), to: P(2, 6) }, // 2. 紅：傌二進三
      { from: P(9, 1), to: P(7, 2) }, // 2. 黑：馬8進7
      { from: P(0, 8), to: P(0, 7) }, // 3. 紅：俥一平二
      { from: P(9, 8), to: P(9, 7) }, // 3. 黑：車1平2
      { from: P(3, 6), to: P(4, 6) }, // 4. 紅：兵三進一
      { from: P(6, 6), to: P(5, 6) }, // 4. 黑：卒3進1
    ],
  },
  // 1.3 順手炮（紅炮二平五，黑炮8平5）
  {
    weight: 25,
    moves: [
      { from: P(2, 7), to: P(2, 4) }, // 1. 紅：炮二平五
      { from: P(7, 1), to: P(7, 4) }, // 1. 黑：炮8平5
      { from: P(0, 7), to: P(2, 6) }, // 2. 紅：傌二進三
      { from: P(9, 7), to: P(7, 6) }, // 2. 黑：馬2進3
      { from: P(0, 8), to: P(0, 7) }, // 3. 紅：俥一平二
      { from: P(9, 8), to: P(9, 7) }, // 3. 黑：車1平2
      { from: P(3, 6), to: P(4, 6) }, // 4. 紅：兵三進一
      { from: P(9, 1), to: P(7, 2) }, // 4. 黑：馬8進7
    ],
  },
  // 1.4 中炮對反宮馬
  {
    weight: 20,
    moves: [
      { from: P(2, 7), to: P(2, 4) }, // 1. 紅：炮二平五
      { from: P(9, 7), to: P(7, 6) }, // 1. 黑：馬2進3
      { from: P(0, 7), to: P(2, 6) }, // 2. 紅：傌二進三
      { from: P(7, 1), to: P(7, 3) }, // 2. 黑：炮8平6（反宮馬特色）
      { from: P(0, 8), to: P(0, 7) }, // 3. 紅：俥一平二
      { from: P(9, 1), to: P(7, 2) }, // 3. 黑：馬8進7
    ],
  },

  // --- 2. 仙人指路（兵七進一）體系 ---
  // 2.1 卒底炮（黑炮2平5應之）
  {
    weight: 30,
    moves: [
      { from: P(3, 2), to: P(4, 2) }, // 1. 紅：兵七進一
      { from: P(7, 7), to: P(7, 4) }, // 1. 黑：炮2平5
      { from: P(2, 7), to: P(2, 4) }, // 2. 紅：炮二平五
      { from: P(9, 7), to: P(7, 6) }, // 2. 黑：馬2進3
      { from: P(0, 7), to: P(2, 6) }, // 3. 紅：傌二進三
      { from: P(9, 8), to: P(9, 7) }, // 3. 黑：車1平2
    ],
  },
  // 2.2 對兵局（黑卒7進1）
  {
    weight: 25,
    moves: [
      { from: P(3, 2), to: P(4, 2) }, // 1. 紅：兵七進一
      { from: P(6, 2), to: P(5, 2) }, // 1. 黑：卒7進1
      { from: P(2, 7), to: P(2, 4) }, // 2. 紅：炮二平五
      { from: P(9, 1), to: P(7, 2) }, // 2. 黑：馬8進7
      { from: P(0, 1), to: P(2, 2) }, // 3. 紅：傌八進七
      { from: P(9, 7), to: P(7, 6) }, // 3. 黑：馬2進3
    ],
  },

  // --- 3. 飛相局（相七進五）體系 ---
  {
    weight: 25,
    moves: [
      { from: P(0, 2), to: P(2, 4) }, // 1. 紅：相七進五
      { from: P(7, 1), to: P(7, 4) }, // 1. 黑：炮8平5（左中炮應之）
      { from: P(0, 1), to: P(2, 2) }, // 2. 紅：傌八進七
      { from: P(9, 1), to: P(7, 2) }, // 2. 黑：馬8進7
      { from: P(0, 0), to: P(0, 1) }, // 3. 紅：俥九平八
      { from: P(9, 0), to: P(9, 1) }, // 3. 黑：車9平8
    ],
  },

  // --- 4. 起馬局（傌二進三）體系 ---
  {
    weight: 20,
    moves: [
      { from: P(0, 7), to: P(2, 6) }, // 1. 紅：傌二進三
      { from: P(6, 2), to: P(5, 2) }, // 1. 黑：卒7進1
      { from: P(2, 7), to: P(2, 4) }, // 2. 紅：炮二平五
      { from: P(9, 1), to: P(7, 2) }, // 2. 黑：馬8進7
      { from: P(0, 8), to: P(0, 7) }, // 3. 紅：俥一平二
      { from: P(9, 0), to: P(9, 1) }, // 3. 黑：車9平8
    ],
  },

  // --- 5. 過宮炮（炮二平六）體系 ---
  {
    weight: 15,
    moves: [
      { from: P(2, 7), to: P(2, 3) }, // 1. 紅：炮二平六
      { from: P(9, 1), to: P(7, 2) }, // 1. 黑：馬8進7
      { from: P(0, 1), to: P(2, 2) }, // 2. 紅：傌八進七
      { from: P(9, 0), to: P(9, 1) }, // 2. 黑：車9平8
      { from: P(0, 0), to: P(0, 1) }, // 3. 紅：俥九平八
      { from: P(6, 6), to: P(5, 6) }, // 3. 黑：卒3進1
    ],
  },
];

// 動態構建局面哈希索引庫
const BOOK = new Map();

function buildBook() {
  for (const line of LINES) {
    const b = initialBoard();
    let turn = RED;
    for (const move of line.moves) {
      const key = hashBoard(b) + '|' + turn;
      let cands = BOOK.get(key);
      if (!cands) {
        cands = [];
        BOOK.set(key, cands);
      }
      const existing = cands.find(
        (c) => c.from.r === move.from.r && c.from.c === move.from.c &&
               c.to.r === move.to.r && c.to.c === move.to.c
      );
      if (existing) {
        existing.weight += line.weight;
      } else {
        cands.push({ from: move.from, to: move.to, weight: line.weight });
      }
      applyMove(b, move.from, move.to);
      turn = turn === RED ? BLACK : RED;
    }
  }
}
buildBook();

/**
 * 查詢當前局面在開局庫中的候選著法
 * @param {Array<Array<object|null>>} board
 * @param {string} side
 * @param {string} level 'easy' | 'medium' | 'hard'
 * @returns {{from:{r:number, c:number}, to:{r:number, c:number}, isBook:boolean}|null}
 */
export function getOpeningMove(board, side, level = 'hard') {
  // 簡單模式 50% 機率不看譜（走隨機搜索），中等 85%，困難 100%
  const useRate = level === 'easy' ? 0.5 : level === 'medium' ? 0.85 : 1.0;
  if (Math.random() > useRate) return null;

  const key = hashBoard(board) + '|' + side;
  const cands = BOOK.get(key);
  if (!cands || cands.length === 0) return null;

  // 依權重輪盤隨機選取，兼顧招法多樣性與大師勝率
  const totalWeight = cands.reduce((sum, c) => sum + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (const cand of cands) {
    r -= cand.weight;
    if (r <= 0) {
      return { from: cand.from, to: cand.to, isBook: true };
    }
  }
  const last = cands[cands.length - 1];
  return { from: last.from, to: last.to, isBook: true };
}
