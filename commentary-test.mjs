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

// 黑 馬8進7
const m2 = { from: { r: 9, c: 1 }, to: { r: 7, c: 2 }, side: BLACK };
h.push(m2);
applyMove(board, m2.from, m2.to);

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

// 4. 測試大師指導 (getGuidance)
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
