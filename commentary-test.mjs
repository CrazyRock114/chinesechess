import { initialBoard, RED, BLACK, applyMove, notation } from './game.js';
import { identifyOpening, formatScore, generateCommentary, getGuidance } from './commentary.js';
import { LANG_HANT, LANG_HANS } from './i18n.js';

console.log('--- 測試 commentary.js ---');

// 1. 測試開局識別
let board = initialBoard();
const h = [];

// 紅 炮二平五
const m1 = { from: { r: 2, c: 7 }, to: { r: 2, c: 4 }, side: RED };
h.push(m1);
applyMove(board, m1.from, m1.to);

let op = identifyOpening(h, LANG_HANT);
if (!op || !op.name.includes('當頭炮')) {
  throw new Error(`開局識別失敗: ${JSON.stringify(op)}`);
}
console.log('✓ 識別當頭炮 (繁體):', op.name);

op = identifyOpening(h, LANG_HANS);
if (!op || !op.name.includes('当头炮')) {
  throw new Error(`開局識別失敗: ${JSON.stringify(op)}`);
}
console.log('✓ 識別当头炮 (簡體):', op.name);

// 測試對稱開局：炮八平五
const opLeftCannon = identifyOpening([{ from: { r: 2, c: 1 }, to: { r: 2, c: 4 }, side: RED }], LANG_HANS);
if (!opLeftCannon || !opLeftCannon.name.includes('当头炮')) {
  throw new Error(`炮八平五對稱識別失敗: ${JSON.stringify(opLeftCannon)}`);
}
console.log('✓ 識別對稱開局 炮八平五:', opLeftCannon.name);

// 測試對稱開局：進七兵（仙人指路）
const opSevenPawn = identifyOpening([{ from: { r: 3, c: 6 }, to: { r: 4, c: 6 }, side: RED }], LANG_HANS);
if (!opSevenPawn || !opSevenPawn.name.includes('仙人指路')) {
  throw new Error(`仙人指路進七兵識別失敗: ${JSON.stringify(opSevenPawn)}`);
}
console.log('✓ 識別仙人指路進七兵:', opSevenPawn.name);

// 測試對稱開局：過宮炮 (炮二平六 vs 炮八平四)
const opGuoGong1 = identifyOpening([{ from: { r: 2, c: 7 }, to: { r: 2, c: 3 }, side: RED }], LANG_HANS);
const opGuoGong2 = identifyOpening([{ from: { r: 2, c: 1 }, to: { r: 2, c: 5 }, side: RED }], LANG_HANS);
if (!opGuoGong1 || !opGuoGong1.name.includes('过宫炮') || !opGuoGong2 || !opGuoGong2.name.includes('过宫炮')) {
  throw new Error(`過宮炮識別失敗: ${JSON.stringify({ opGuoGong1, opGuoGong2 })}`);
}
console.log('✓ 識別雙向過宮炮:', opGuoGong1.name, opGuoGong2.name);

// 測試對稱開局：士角炮 (炮二平四 vs 炮八平六)
const opShiJiao1 = identifyOpening([{ from: { r: 2, c: 7 }, to: { r: 2, c: 5 }, side: RED }], LANG_HANS);
const opShiJiao2 = identifyOpening([{ from: { r: 2, c: 1 }, to: { r: 2, c: 3 }, side: RED }], LANG_HANS);
if (!opShiJiao1 || !opShiJiao1.name.includes('士角炮') || !opShiJiao2 || !opShiJiao2.name.includes('士角炮')) {
  throw new Error(`士角炮識別失敗: ${JSON.stringify({ opShiJiao1, opShiJiao2 })}`);
}
console.log('✓ 識別雙向士角炮:', opShiJiao1.name, opShiJiao2.name);

// 黑 馬8進7
const m2 = { from: { r: 9, c: 1 }, to: { r: 7, c: 2 }, side: BLACK };
h.push(m2);
applyMove(board, m2.from, m2.to);

// 關鍵驗證：步2 黑方走馬8進7 時，絕不能誤判為「當頭炮」！
const op2 = identifyOpening(h, LANG_HANS);
if (op2 && op2.name.includes('当头炮')) {
  throw new Error(`第2步誤將走馬判為當頭炮: ${JSON.stringify(op2)}`);
}
console.log('✓ 第2步黑走馬不重複觸發當頭炮定式');

// 紅 傌八進七
const m3 = { from: { r: 0, c: 1 }, to: { r: 2, c: 2 }, side: RED };
h.push(m3);
applyMove(board, m3.from, m3.to);

// 黑 馬2進3
const m4 = { from: { r: 9, c: 7 }, to: { r: 7, c: 6 }, side: BLACK };
h.push(m4);
applyMove(board, m4.from, m4.to);

op = identifyOpening(h, LANG_HANT);
if (!op || !op.name.includes('中炮對屏風馬')) {
  throw new Error(`中炮對屏風馬識別失敗: ${JSON.stringify(op)}`);
}
console.log('✓ 識別中炮對屏風馬 (繁體):', op.name);

op = identifyOpening(h, LANG_HANS);
if (!op || !op.name.includes('中炮对屏风马')) {
  throw new Error(`中炮对屏风马識別失敗: ${JSON.stringify(op)}`);
}
console.log('✓ 識別中炮对屏风马 (簡體):', op.name);

// 2. 測試優勢評估字串
const s0 = formatScore(0, LANG_HANT);
if (!s0.includes('勢均力敵')) throw new Error('評分 0 應為勢均力敵');
console.log('✓ 評估均勢:', s0);

const sRed = formatScore(45, LANG_HANS);
if (!sRed.includes('红方占优')) throw new Error('評分 45 應為红方占优');
console.log('✓ 評估紅優 (簡體):', sRed);

// 3. 測試解說生成 (generateCommentary)
const prev = initialBoard();
const curr = initialBoard();
applyMove(curr, { r: 2, c: 7 }, { r: 2, c: 4 });
const comm = generateCommentary({
  prevBoard: prev,
  currBoard: curr,
  from: { r: 2, c: 7 },
  to: { r: 2, c: 4 },
  side: RED,
  captured: null,
  history: [{ from: { r: 2, c: 7 }, to: { r: 2, c: 4 }, side: RED }],
  lang: LANG_HANS,
});
if (!comm.title || !comm.comment) {
  throw new Error('解說未生成內容: ' + JSON.stringify(comm));
}
console.log('✓ 生成單步解說 (簡體):', comm.title, comm.comment);

// 4. 測試被將應將解說 (Check Evasion)
// 場景：黑車(8,4)照將紅帥(0,4)，紅帥(0,4)平移至(0,5)避將
const bUnderCheck = initialBoard();
bUnderCheck[3][4] = null; // 移開中兵，使縱列貫通
bUnderCheck[6][4] = null; // 移開中卒
bUnderCheck[8][4] = { type: 'R', side: BLACK }; // 黑車照將
const bEvasion = initialBoard();
bEvasion[3][4] = null;
bEvasion[6][4] = null;
bEvasion[8][4] = { type: 'R', side: BLACK };
bEvasion[0][4] = null;
bEvasion[0][5] = { type: 'K', side: RED }; // 帥走開避將

const commEvasion = generateCommentary({
  prevBoard: bUnderCheck,
  currBoard: bEvasion,
  from: { r: 0, c: 4 },
  to: { r: 0, c: 5 },
  side: RED,
  captured: null,
  history: [],
  lang: LANG_HANS,
});
if (!commEvasion.title.includes('将帅移驾') && !commEvasion.title.includes('避')) {
  throw new Error(`應將避險解說錯誤: ${JSON.stringify(commEvasion)}`);
}
console.log('✓ 被將應將避險解說:', commEvasion.title, commEvasion.comment);

// 場景：被照將時吃掉照將子 (斬將解危)
const bCapCheck = initialBoard();
bCapCheck[1][4] = { type: 'R', side: BLACK }; // 黑車在九宮口照將
const bCapDone = initialBoard();
bCapDone[1][4] = { type: 'K', side: RED }; // 紅帥直接吃掉黑車
bCapDone[0][4] = null;

const commCapCheck = generateCommentary({
  prevBoard: bCapCheck,
  currBoard: bCapDone,
  from: { r: 0, c: 4 },
  to: { r: 1, c: 4 },
  side: RED,
  captured: { type: 'R', side: BLACK },
  history: [],
  lang: LANG_HANS,
});
if (!commCapCheck.title.includes('斩将解危')) {
  throw new Error(`斬將解危解說錯誤: ${JSON.stringify(commCapCheck)}`);
}
console.log('✓ 斬將解危解說:', commCapCheck.title, commCapCheck.comment);

// 5. 測試大師指導 (getGuidance)
const hint = getGuidance(initialBoard(), RED, LANG_HANS);
if (!hint || !hint.from || !hint.to || !hint.title || !hint.rationale) {
  throw new Error('指導未生成完整結構: ' + JSON.stringify(hint));
}
console.log('✓ 大師指導推薦 (簡體):', hint.nota, hint.title, hint.rationale);

const hintHant = getGuidance(initialBoard(), RED, LANG_HANT);
if (!hintHant || !hintHant.title || !hintHant.rationale) {
  throw new Error('繁體指導未生成完整結構: ' + JSON.stringify(hintHant));
}
console.log('✓ 大師指導推薦 (繁體):', hintHant.nota, hintHant.title, hintHant.rationale);

console.log('\n全部 commentary 測試通過 ✔');
