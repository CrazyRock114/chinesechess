// 引擎邏輯自測
import {
  initialBoard, legalMoves, inCheck, kingsFacing,
  applyMove, hasAnyLegalMove, name, notation, hashBoard, repetitionVerdict,
  toFEN, loadFEN, RED, BLACK,
} from './game.js';

let failed = 0;
function ok(cond, msg) {
  if (cond) { console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}
const fmt = (list) => list.map((m) => m.r + ',' + m.c).sort().join(' | ');
const emptyBoard = () => Array.from({ length: 10 }, () => Array(9).fill(null));

// ---------- 初始棋盤 ----------
let b = initialBoard();
let red = 0, blk = 0;
for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
  if (b[r][c] && b[r][c].side === RED) red++;
  if (b[r][c] && b[r][c].side === BLACK) blk++;
}
ok(red === 16 && blk === 16, `雙方各 16 子（紅 ${red} / 黑 ${blk}）`);

// ---------- 傌（馬）：蹩腿 ----------
let moves = legalMoves(b, 0, 1);
// (0,1)→(1,3) 的馬腿(0,2) 被己方相塞住，故只剩 (2,0) 與 (2,2)
ok(fmt(moves) === '2,0 | 2,2', `初始紅傌(0,1) 走法  →  ${fmt(moves)}`);

// ---------- 俥（車）：直線滑行 ----------
moves = legalMoves(b, 0, 0);
ok(fmt(moves) === '1,0 | 2,0', `初始紅俥(0,0) 走法  →  ${fmt(moves)}`);

// ---------- 炮：平走 + 翻山 ----------
moves = legalMoves(b, 2, 1);
ok(
  fmt(moves) === '1,1 | 2,0 | 2,2 | 2,3 | 2,4 | 2,5 | 2,6 | 3,1 | 4,1 | 5,1 | 6,1 | 9,1',
  `紅炮(2,1)：平走至(2,6)、垂直平走、翻炮架(7,1)吃黑傌(9,1)  →  ${fmt(moves)}`
);

// ---------- 兵 ----------
moves = legalMoves(b, 3, 4);
ok(fmt(moves) === '4,4', `紅中兵過河前只可直進  →  ${fmt(moves)}`);

let b3 = initialBoard();
b3[5][4] = b3[3][4]; b3[3][4] = null; // 中兵推進到第 5 列（已過河）
moves = legalMoves(b3, 5, 4);
ok(fmt(moves) === '5,3 | 5,5 | 6,4', `過河紅兵可直進、橫走  →  ${fmt(moves)}`);

// ---------- 象：塞象眼 ----------
let b4 = initialBoard();
b4[1][3] = { type: 'P', side: RED }; // 塞住 (0,2) 跳 (2,4) 的象眼
moves = legalMoves(b4, 0, 2);
ok(!moves.some((m) => m.r === 2 && m.c === 4), `塞象眼後 (0,2) 不能跳 (2,4)（剩: ${fmt(moves)}）`);

// ---------- 白臉將（飛將） ----------
let bFace = emptyBoard();
bFace[0][4] = { type: 'K', side: RED };
bFace[9][4] = { type: 'K', side: BLACK };
ok(kingsFacing(bFace) === true, '同列無遮擋 → 對臉');
bFace[5][4] = { type: 'R', side: RED };
ok(kingsFacing(bFace) === false, '同列有遮擋 → 非對臉');
ok(inCheck(bFace, RED) === false, '有遮擋時不將');

bFace = bFace.map((row) => row.slice());
bFace[5][4] = null;
ok(inCheck(bFace, RED) === true, '對臉視同被將');

// 對臉時走開即解將
bFace[0][4] = null; bFace[0][3] = { type: 'K', side: RED };
ok(!inCheck(bFace, RED), '將走開後對臉解除');

// ---------- 被將 ----------
let bChk = emptyBoard();
bChk[0][4] = { type: 'K', side: RED };
bChk[9][4] = { type: 'K', side: BLACK };
bChk[8][4] = { type: 'R', side: BLACK };
ok(inCheck(bChk, RED) === true, '黑車(8,4) 同列壓頂 → 紅方被將');

// ---------- 合法走法過濾送將（仕被鎮壓） ----------
let bPin = emptyBoard();
bPin[0][4] = { type: 'K', side: RED };
bPin[0][3] = { type: 'A', side: RED };
bPin[0][0] = { type: 'R', side: BLACK };
bPin[9][4] = { type: 'K', side: BLACK };
bPin[5][4] = { type: 'N', side: BLACK }; // 遮擋對臉
ok(inCheck(bPin, RED) === false, '仕擋砲口時紅方未被將');
let advisorMoves = legalMoves(bPin, 0, 3);
ok(advisorMoves.length === 0, `離位即送將 → 仕無合法走法（剩: ${fmt(advisorMoves)}）`);

// ---------- 困斃（無子可動、未被將） ----------
let bStale = emptyBoard();
bStale[9][5] = { type: 'K', side: BLACK };          // 黑將
bStale[0][5] = { type: 'K', side: RED };            // 紅帥（同列，需遮擋）
bStale[4][5] = { type: 'P', side: RED };            // 紅兵遮擋對臉，並壓住(5,5)
bStale[7][5] = { type: 'N', side: RED };            // 紅傌看住 (9,4) 與 (9,6)
bStale[8][0] = { type: 'R', side: RED };            // 紅俥看住 (8,5)
ok(inCheck(bStale, BLACK) === false, '困斃局面下黑方未被將');
ok(hasAnyLegalMove(bStale, BLACK) === false, '黑方困斃（(8,5)/(9,4)/(9,6) 全被看住，無子可動）');

// ---------- 將死（被將且無解）：雙俥鎖底線 ----------
b = emptyBoard();
b[9][4] = { type: 'K', side: BLACK };   // 黑將
b[0][4] = { type: 'K', side: RED };     // 紅帥（同列）
b[2][4] = { type: 'R', side: RED };     // 俥(2,4) 垂直壓頂＝將（同時遮擋對臉）
b[9][0] = { type: 'R', side: RED };     // 看住 (9,1)(9,2)(9,3)
b[9][8] = { type: 'R', side: RED };     // 看住 (9,5)(9,6)(9,7)
ok(inCheck(b, BLACK) === true, '紅俥(2,4) 壓頂 → 黑方被將');
ok(hasAnyLegalMove(b, BLACK) === false, '黑將 (8,4)/(9,3)/(9,5) 均被看住 → 將死');

// ---------- 棋譜 notation ----------
b = initialBoard();
ok(notation(b, { r: 0, c: 1 }, { r: 2, c: 2 }) === '傌八進七', `傌八進七（實際: ${notation(b, { r: 0, c: 1 }, { r: 2, c: 2 })}）`);
b = initialBoard();
ok(notation(b, { r: 2, c: 7 }, { r: 2, c: 4 }) === '炮二平五', `炮二平五（實際: ${notation(b, { r: 2, c: 7 }, { r: 2, c: 4 })}）`);
b = initialBoard();
ok(notation(b, { r: 3, c: 4 }, { r: 4, c: 4 }) === '兵五進一', `兵五進一（實際: ${notation(b, { r: 3, c: 4 }, { r: 4, c: 4 })}）`);
b = initialBoard();
ok(notation(b, { r: 9, c: 1 }, { r: 7, c: 2 }) === '馬二進三', `黑馬二進三（實際: ${notation(b, { r: 9, c: 1 }, { r: 7, c: 2 })}）`);
b = initialBoard();
ok(notation(b, { r: 0, c: 7 }, { r: 2, c: 6 }) === '傌二進三', `紅傌二進三（實際: ${notation(b, { r: 0, c: 7 }, { r: 2, c: 6 })}）`);
b = initialBoard();
const n7 = notation(b, { r: 0, c: 2 }, { r: 2, c: 4 });
ok(n7 === '相七進五', `相七進五（實際: ${n7}）`);
b = emptyBoard();
b[9][7] = { type: 'R', side: BLACK };
ok(notation(b, { r: 9, c: 7 }, { r: 7, c: 7 }) === '車八進二', `黑車八進二（朝紅方方向＝進，實際: ${notation(b, { r: 9, c: 7 }, { r: 7, c: 7 })}）`);
b = emptyBoard();
b[0][0] = { type: 'R', side: RED };
ok(notation(b, { r: 0, c: 0 }, { r: 9, c: 0 }) === '俥九進九', `紅俥九進九（實際: ${notation(b, { r: 0, c: 0 }, { r: 9, c: 0 })}）`);

// ---------- applyMove 吃子回傳 ----------
b = initialBoard();
b[2][6] = { type: 'P', side: RED }; // 在(2,6)放個紅兵
const cap = applyMove(b, { r: 2, c: 7 }, { r: 2, c: 6 });
ok(!!cap && cap.side === RED && cap.type === 'P', `炮(2,7)平(2,6) 吃紅兵（實為 ${cap ? name(cap.side, cap.type) : '無'}）`);
b = initialBoard();
ok(applyMove(b, { r: 2, c: 1 }, { r: 1, c: 1 }) === null, '空位走子不回傳被吃子');

// ---------- 三次重複局面：長將判負（紅俥沿列連照，黑將閃避） ----------
// 記錄格式：{ key: hashBoard+'|'+輪走方, mover: 走該步的一方, check: 該步是否照將 }
let bPerp = emptyBoard();
bPerp[0][0] = { type: 'K', side: RED };
bPerp[7][0] = { type: 'R', side: RED };
bPerp[7][4] = { type: 'K', side: BLACK };
const repRecs = [{ key: hashBoard(bPerp) + '|black', mover: null, check: false }];
const repCycle = [
  [{ r: 7, c: 4 }, { r: 8, c: 4 }, BLACK], // 將閃避
  [{ r: 7, c: 0 }, { r: 8, c: 0 }, RED],   // 俥照將
  [{ r: 8, c: 4 }, { r: 7, c: 4 }, BLACK], // 將閃避
  [{ r: 8, c: 0 }, { r: 7, c: 0 }, RED],   // 俥照將
];
for (let cyc = 0; cyc < 2; cyc++)
  for (const [from, to, side] of repCycle) {
    applyMove(bPerp, from, to);
    repRecs.push({
      key: hashBoard(bPerp) + '|' + (side === RED ? 'black' : 'red'),
      mover: side,
      check: inCheck(bPerp, side === RED ? BLACK : RED),
    });
  }
ok(repRecs.filter((x) => x.key === repRecs[0].key).length === 3, '同一局面（含輪走方）出現三次');
const perp = repetitionVerdict(repRecs, repRecs[repRecs.length - 1].key);
ok(!!perp && perp.result === 'loss' && perp.loser === RED, `紅方每步都照將 → 長將判負（實為 ${JSON.stringify(perp)}）`);

// ---------- 三次重複局面：無照將的循環 → 判和 ----------
let bRep = emptyBoard();
bRep[0][0] = { type: 'K', side: RED };
bRep[4][3] = { type: 'R', side: RED };
bRep[9][4] = { type: 'K', side: BLACK };
const drawRecs = [{ key: hashBoard(bRep) + '|black', mover: null, check: false }];
const drawCycle = [
  [{ r: 9, c: 4 }, { r: 9, c: 5 }, BLACK],
  [{ r: 4, c: 3 }, { r: 5, c: 3 }, RED],
  [{ r: 9, c: 5 }, { r: 9, c: 4 }, BLACK],
  [{ r: 5, c: 3 }, { r: 4, c: 3 }, RED],
];
for (let cyc = 0; cyc < 2; cyc++)
  for (const [from, to, side] of drawCycle) {
    applyMove(bRep, from, to);
    drawRecs.push({
      key: hashBoard(bRep) + '|' + (side === RED ? 'black' : 'red'),
      mover: side,
      check: inCheck(bRep, side === RED ? BLACK : RED),
    });
  }
const repDraw = repetitionVerdict(drawRecs, drawRecs[drawRecs.length - 1].key);
ok(!!repDraw && repDraw.result === 'draw' && repDraw.reason === '三次重複局面', `無照將的重複循環 → 判和（實為 ${JSON.stringify(repDraw)}）`);

// ---------- 雙方皆長將 → 判和；僅兩次重複 → 尚不判決 ----------
const bothRecs = [{ key: 'P|red', mover: null, check: false }];
for (let i = 0; i < 2; i++) {
  bothRecs.push({ key: 'Q|black', mover: RED, check: true });
  bothRecs.push({ key: 'P|red', mover: BLACK, check: true });
}
const both = repetitionVerdict(bothRecs, 'P|red');
ok(!!both && both.result === 'draw' && both.reason === '雙方長將', `雙方皆長將 → 判和（實為 ${JSON.stringify(both)}）`);

const twoRecs = [{ key: 'P|red', mover: null, check: false }];
twoRecs.push({ key: 'Q|black', mover: RED, check: true });
twoRecs.push({ key: 'P|red', mover: BLACK, check: false });
ok(repetitionVerdict(twoRecs, 'P|red') === null, '同一局面只出現兩次 → 尚不判決');

// ---------- 傳統記譜：同列雙子（前／後） ----------
let bDup = emptyBoard();
// 紅方同列雙俥：(4,1) 與 (1,1)，均在第二路（fileOf = 9 - 1 = 8）
bDup[4][1] = { type: 'R', side: RED }; // 前俥
bDup[1][1] = { type: 'R', side: RED }; // 後俥
ok(notation(bDup, { r: 4, c: 1 }, { r: 6, c: 1 }) === '前俥進二', `紅方前俥進二（實際: ${notation(bDup, { r: 4, c: 1 }, { r: 6, c: 1 })}）`);
ok(notation(bDup, { r: 1, c: 1 }, { r: 3, c: 1 }) === '後俥進二', `紅方後俥進二（實際: ${notation(bDup, { r: 1, c: 1 }, { r: 3, c: 1 })}）`);
ok(notation(bDup, { r: 4, c: 1 }, { r: 4, c: 4 }) === '前俥平五', `紅方前俥平五（實際: ${notation(bDup, { r: 4, c: 1 }, { r: 4, c: 4 })}）`);
ok(notation(bDup, { r: 1, c: 1 }, { r: 1, c: 4 }) === '後俥平五', `紅方後俥平五（實際: ${notation(bDup, { r: 1, c: 1 }, { r: 1, c: 4 })}）`);

// 黑方同列雙車：(8,7) 與 (5,7)，黑方朝向紅方（row 減少為進）
let bBlkDup = emptyBoard();
bBlkDup[5][7] = { type: 'R', side: BLACK }; // 前車（距對方近，r 小）
bBlkDup[8][7] = { type: 'R', side: BLACK }; // 後車（距己方近，r 大）
ok(notation(bBlkDup, { r: 5, c: 7 }, { r: 3, c: 7 }) === '前車進二', `黑方前車進二（實際: ${notation(bBlkDup, { r: 5, c: 7 }, { r: 3, c: 7 })}）`);
ok(notation(bBlkDup, { r: 8, c: 7 }, { r: 6, c: 7 }) === '後車進二', `黑方後車進二（實際: ${notation(bBlkDup, { r: 8, c: 7 }, { r: 6, c: 7 })}）`);

// 紅方同列三兵：(5,4)、(4,4)、(3,4)（前、中、後）
let b3Pawns = emptyBoard();
b3Pawns[5][4] = { type: 'P', side: RED };
b3Pawns[4][4] = { type: 'P', side: RED };
b3Pawns[3][4] = { type: 'P', side: RED };
ok(notation(b3Pawns, { r: 5, c: 4 }, { r: 6, c: 4 }) === '前兵進一', `前兵進一（實際: ${notation(b3Pawns, { r: 5, c: 4 }, { r: 6, c: 4 })}）`);
ok(notation(b3Pawns, { r: 4, c: 4 }, { r: 4, c: 3 }) === '中兵平六', `中兵平六（實際: ${notation(b3Pawns, { r: 4, c: 4 }, { r: 4, c: 3 })}）`);
ok(notation(b3Pawns, { r: 3, c: 4 }, { r: 4, c: 4 }) === '後兵進一', `後兵進一（實際: ${notation(b3Pawns, { r: 3, c: 4 }, { r: 4, c: 4 })}）`);

// ---------- FEN 互轉 ----------
const initB = initialBoard();
const initFEN = toFEN(initB, RED);
const EXPECTED_INIT_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
ok(initFEN === EXPECTED_INIT_FEN, `初始局面 FEN 序列化（實際: ${initFEN}）`);

const loaded = loadFEN(EXPECTED_INIT_FEN);
ok(loaded.turn === RED, 'FEN 解析後先手為紅方');
ok(toFEN(loaded.board, loaded.turn) === EXPECTED_INIT_FEN, 'FEN 序列化 ⇄ 反序列化雙向一致');

// 殘局 FEN 載入測試
const endgameFEN = '4k4/9/9/9/9/9/9/9/4p4/4K4 b - - 0 1';
const loadedEndgame = loadFEN(endgameFEN);
ok(loadedEndgame.turn === BLACK, '殘局 FEN 輪走方為黑方');
ok(loadedEndgame.board[0][4].type === 'K' && loadedEndgame.board[0][4].side === RED, '殘局紅帥在(0,4)');
ok(loadedEndgame.board[9][4].type === 'K' && loadedEndgame.board[9][4].side === BLACK, '殘局黑將在(9,4)');
ok(loadedEndgame.board[1][4].type === 'P' && loadedEndgame.board[1][4].side === BLACK, '殘局黑卒在(1,4)');

console.log(failed === 0 ? '\n全部通過 ✔' : `\n${failed} 項失敗 ✘`);
process.exit(failed === 0 ? 0 : 1);
