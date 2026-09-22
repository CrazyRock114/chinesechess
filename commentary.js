// ============================================================
// 中國象棋 AI 實時解說與大師指導引擎 (AI Commentary & Coach)
// 包含：開局定式識別、實時招法戰術解說、優勢評估、語音播報、大師指導推薦
// 支援繁體中文 (zh-Hant) 與簡體中文 (zh-Hans)
// ============================================================

import { RED, BLACK, inCheck, legalMoves, notation } from './game.js?v=cb26dc068c';
import { evaluate, findBestMove } from './ai.js?v=cb26dc068c';
import { getOpeningMove } from './opening-book.js?v=cb26dc068c';
import { LANG_HANT, LANG_HANS } from './i18n.js?v=cb26dc068c';

// ---------------- 開局定式名庫 ----------------
const OPENINGS = [
  {
    length: 4,
    nameHant: '中炮對屏風馬',
    nameHans: '中炮对屏风马',
    descHant: '象棋最經典的攻守大局，紅方中炮攻勢剛猛，黑方雙馬盤護中卒固若金湯。',
    descHans: '象棋最经典的攻守大局，红方中炮攻势刚猛，黑方双马盘护中卒固若金汤。',
    check: (h) => {
      if (h.length !== 4) return false;
      // 步1: 紅中炮
      if (h[0].side !== RED || h[0].to.r !== 2 || h[0].to.c !== 4) return false;
      // 步2: 黑馬進3或7
      if (h[1].side !== BLACK || h[1].to.r !== 7 || (h[1].to.c !== 2 && h[1].to.c !== 6)) return false;
      // 步3: 紅正馬
      if (h[2].side !== RED || h[2].to.r !== 2 || (h[2].to.c !== 2 && h[2].to.c !== 6)) return false;
      // 步4: 黑另一馬進（與步2不同列）
      if (h[3].side !== BLACK || h[3].to.r !== 7 || (h[3].to.c !== 2 && h[3].to.c !== 6)) return false;
      return h[3].to.c !== h[1].to.c;
    },
  },
  {
    length: 2,
    nameHant: '順手炮局',
    nameHans: '顺手炮局',
    descHant: '鬥炮局的激烈開篇，雙方中炮針鋒相對，短兵相接，對攻節奏極快。',
    descHans: '斗炮局的激烈开篇，双方中炮针锋相对，短兵相接，对攻节奏极快。',
    check: (h) => {
      if (h.length !== 2) return false;
      return (
        h[0].side === RED && h[0].to.r === 2 && h[0].to.c === 4 &&
        h[1].side === BLACK && h[1].to.r === 7 && h[1].to.c === 4
      );
    },
  },
  {
    length: 2,
    nameHant: '中炮對反宮馬',
    nameHans: '中炮对反宫马',
    descHant: '黑方士角置炮、雙馬夾士，兼具反擊與柔韌防守，招法靈活多變。',
    descHans: '黑方士角置炮、双马夹士，兼具反击与柔韧防守，招法灵活多变。',
    check: (h) => {
      if (h.length !== 2) return false;
      return (
        h[0].side === RED && h[0].to.r === 2 && h[0].to.c === 4 &&
        h[1].side === BLACK && h[1].to.r === 7 && (h[1].to.c === 3 || h[1].to.c === 5)
      );
    },
  },
  {
    length: 2,
    nameHant: '中炮對單提馬',
    nameHans: '中炮对单提马',
    descHant: '黑方單馬起於肋線，另一馬保留邊路或隨機應變，暗藏反擊奇招。',
    descHans: '黑方单马起于肋线，另一马保留边路或随机应变，暗藏反击奇招。',
    check: (h) => {
      if (h.length !== 2) return false;
      return (
        h[0].side === RED && h[0].to.r === 2 && h[0].to.c === 4 &&
        h[1].side === BLACK && h[1].to.r === 7 && (h[1].to.c === 2 || h[1].to.c === 6)
      );
    },
  },
  {
    length: 2,
    nameHant: '仙人指路對卒底炮',
    nameHans: '仙人指路对卒底炮',
    descHant: '紅挺兵投石問路，黑方架卒底炮後發制人，剛柔並濟。',
    descHans: '红挺兵投石问路，黑方架卒底炮后发制人，刚柔并济。',
    check: (h) => {
      if (h.length !== 2) return false;
      const redPawn = h[0].side === RED && h[0].to.r === 4 && (h[0].to.c === 2 || h[0].to.c === 6);
      const blackCannon = h[1].side === BLACK && h[1].to.r === 7 && (h[1].to.c === 2 || h[1].to.c === 4 || h[1].to.c === 6);
      return redPawn && blackCannon;
    },
  },
  {
    length: 2,
    nameHant: '仙人指路對兵局',
    nameHans: '仙人指路对兵局',
    descHant: '雙方互挺三／七兵，爭奪開局主動權，考驗基本功與中局功力。',
    descHans: '双方互挺三／七兵，争夺开局主动权，考验基本功与中局功力。',
    check: (h) => {
      if (h.length !== 2) return false;
      const redPawn = h[0].side === RED && h[0].to.r === 4 && (h[0].to.c === 2 || h[0].to.c === 6);
      const blackPawn = h[1].side === BLACK && h[1].to.r === 5 && (h[1].to.c === 2 || h[1].to.c === 6);
      return redPawn && blackPawn;
    },
  },
  {
    length: 1,
    nameHant: '當頭炮（中炮局）',
    nameHans: '当头炮（中炮局）',
    descHant: '起手當頭炮，直逼黑方中卒與將門，鐵血進攻的主流定式。',
    descHans: '起手当头炮，直逼黑方中卒与将门，铁血进攻的主流定式。',
    check: (h) => {
      if (h.length !== 1) return false;
      return h[0].side === RED && h[0].to.r === 2 && h[0].to.c === 4;
    },
  },
  {
    length: 1,
    nameHant: '仙人指路（進兵局）',
    nameHans: '仙人指路（进兵局）',
    descHant: '挺兵投石問路，意圖活己方馬路、制約敵馬，戰術彈性極大。',
    descHans: '挺兵投石问路，意图活己方马路、制约敌马，战术弹性极大。',
    check: (h) => {
      if (h.length !== 1) return false;
      return h[0].side === RED && h[0].to.r === 4 && (h[0].to.c === 2 || h[0].to.c === 6);
    },
  },
  {
    length: 1,
    nameHant: '飛相局',
    nameHans: '飞相局',
    descHant: '起手飛相加厚中防，以靜制動，後發制人，防守森嚴。',
    descHans: '起手飞相加厚中防，以静制动，后发制人，防守森严。',
    check: (h) => {
      if (h.length !== 1) return false;
      return h[0].side === RED && h[0].to.r === 2 && h[0].to.c === 4 && (h[0].from ? (h[0].from.c === 2 || h[0].from.c === 6) : false);
    },
  },
  {
    length: 1,
    nameHant: '起馬局',
    nameHans: '起马局',
    descHant: '正馬先發制人，利於快速出車，不露聲色而暗蓄殺機。',
    descHans: '正马先发制人，利于快速出车，不露声色而暗蓄杀机。',
    check: (h) => {
      if (h.length !== 1) return false;
      return h[0].side === RED && h[0].to.r === 2 && (h[0].to.c === 2 || h[0].to.c === 6) && (h[0].from ? (h[0].from.c === 1 || h[0].from.c === 7) : true);
    },
  },
  {
    length: 1,
    nameHant: '過宮炮',
    nameHans: '过宫炮',
    descHant: '炮過九宮集結兵力於一翼，攻守兼備，極具戰術變數。',
    descHans: '炮过九宫集结兵力于一翼，攻守兼备，极具战术变数。',
    check: (h) => {
      if (h.length !== 1) return false;
      if (h[0].side !== RED || h[0].to.r !== 2) return false;
      const fc = h[0].from ? h[0].from.c : (h[0].to.c === 3 ? 7 : 1);
      return (fc === 7 && h[0].to.c === 3) || (fc === 1 && h[0].to.c === 5);
    },
  },
  {
    length: 1,
    nameHant: '士角炮',
    nameHans: '士角炮',
    descHant: '炮置士角，護衛中營同時遙控對角，冷箭暗藏。',
    descHans: '炮置士角，护卫中营同时遥控对角，冷箭暗藏。',
    check: (h) => {
      if (h.length !== 1) return false;
      if (h[0].side !== RED || h[0].to.r !== 2) return false;
      const fc = h[0].from ? h[0].from.c : (h[0].to.c === 5 ? 7 : 1);
      return (fc === 7 && h[0].to.c === 5) || (fc === 1 && h[0].to.c === 3);
    },
  },
];

/**
 * 識別當前著法所剛達成的開局陣型
 */
export function identifyOpening(history, lang = LANG_HANS) {
  if (!history || history.length === 0) return null;
  const h = history.slice(0, 8);

  for (const op of OPENINGS) {
    if (op.length === h.length && op.check(h)) {
      return {
        name: lang === LANG_HANS ? op.nameHans : op.nameHant,
        desc: lang === LANG_HANS ? op.descHans : op.descHant,
      };
    }
  }
  return null;
}

/**
 * 評估局勢優勢文字
 */
export function formatScore(score, lang = LANG_HANS) {
  // score 為紅方視角，以 20 分 ≈ 1 兵為單位基準
  const pawns = score / 20;
  const isHans = lang === LANG_HANS;

  if (Math.abs(score) > 50000) {
    if (score > 0) return isHans ? '红方胜势（绝杀在即）' : '紅方勝勢（絕殺在即）';
    return isHans ? '黑方胜势（绝杀在即）' : '黑方勝勢（絕殺在即）';
  }

  if (Math.abs(pawns) < 0.6) {
    return isHans ? '势均力敌（均势）' : '勢均力敵（均勢）';
  }
  if (pawns >= 0.6 && pawns < 2.0) {
    return isHans ? `红方微优 (+${pawns.toFixed(1)})` : `紅方微優 (+${pawns.toFixed(1)})`;
  }
  if (pawns >= 2.0 && pawns < 5.0) {
    return isHans ? `红方占优 (+${pawns.toFixed(1)})` : `紅方佔優 (+${pawns.toFixed(1)})`;
  }
  if (pawns >= 5.0) {
    return isHans ? `红方大优 (+${pawns.toFixed(1)})` : `紅方大優 (+${pawns.toFixed(1)})`;
  }
  if (pawns <= -0.6 && pawns > -2.0) {
    return isHans ? `黑方微优 (${pawns.toFixed(1)})` : `黑方微優 (${pawns.toFixed(1)})`;
  }
  if (pawns <= -2.0 && pawns > -5.0) {
    return isHans ? `黑方占优 (${pawns.toFixed(1)})` : `黑方佔優 (${pawns.toFixed(1)})`;
  }
  return isHans ? `黑方大优 (${pawns.toFixed(1)})` : `黑方大優 (${pawns.toFixed(1)})`;
}

/**
 * 棋子名稱對照
 */
const PIECE_NAMES = {
  [LANG_HANT]: {
    red: { K: '帥', R: '俥', N: '傌', C: '炮', B: '相', A: '仕', P: '兵' },
    black: { K: '將', R: '車', N: '馬', C: '砲', B: '象', A: '士', P: '卒' },
  },
  [LANG_HANS]: {
    red: { K: '帅', R: '车', N: '马', C: '炮', B: '相', A: '仕', P: '兵' },
    black: { K: '将', R: '车', N: '马', C: '炮', B: '象', A: '士', P: '卒' },
  },
};

/**
 * 生成單步棋的戰術解說
 * @param {object} params
 * @returns {{ title: string, comment: string, tag: string, scoreText: string }}
 */
export function generateCommentary({
  prevBoard,
  currBoard,
  from,
  to,
  side,
  captured,
  history = [],
  lang = LANG_HANS,
}) {
  const isHans = lang === LANG_HANS;
  const sideName = side === RED ? (isHans ? '红方' : '紅方') : (isHans ? '黑方' : '黑方');
  const enemySide = side === RED ? BLACK : RED;
  const enemyName = side === RED ? (isHans ? '黑方' : '黑方') : (isHans ? '红方' : '紅方');

  const piece = currBoard[to.r][to.c];
  if (!piece) return { title: '', comment: '', tag: '', scoreText: '' };

  const pType = piece.type;
  const pName = PIECE_NAMES[lang][side][pType] || pType;
  const isChecked = inCheck(currBoard, enemySide);
  const currentScore = evaluate(currBoard);
  const scoreText = formatScore(currentScore, lang);

  const nota = notation(prevBoard, from, to, lang);

  let title = '';
  let comment = '';
  let tag = 'TACTIC'; // 'OPENING' | 'CHECK' | 'CAPTURE' | 'DEFENSE' | 'ATTACK' | 'TACTIC'

  // 0. 被將應將判定（此步前己方正處於被將狀態）
  const wasChecked = inCheck(prevBoard, side);
  if (wasChecked) {
    tag = 'DEFENSE';
    if (captured) {
      const capName = PIECE_NAMES[lang][captured.side][captured.type] || captured.type;
      title = isHans ? '【斩将解危】' : '【斬將解危】';
      comment = isHans
        ? `${sideName}${pName}果断斩落照将之${capName}，反戈一击化解将门危机！`
        : `${sideName}${pName}果斷斬落照將之${capName}，反戈一擊化解將門危機！`;
    } else if (pType === 'K') {
      title = isHans ? '【将帅移驾】' : '【將帥移駕】';
      comment = isHans
        ? `${sideName}临危不乱，${pName}移步避开锋芒，沉着化解险情。`
        : `${sideName}臨危不亂，${pName}移步避開鋒芒，沉著化解險情。`;
    } else {
      title = isHans ? '【垫子护驾】' : '【墊子護駕】';
      comment = isHans
        ? `${sideName}走出 ${nota} 挺身垫子，铜墙铁壁化解攻势！`
        : `${sideName}走出 ${nota} 挺身墊子，銅牆鐵壁化解攻勢！`;
    }
    return { title, comment, tag, scoreText };
  }

  // 1. 開局識別（前 6 回合）
  if (history.length <= 8) {
    const op = identifyOpening(history, lang);
    if (op && history.length <= 4) {
      tag = 'OPENING';
      title = `【${op.name}】`;
      comment = `${sideName}走出 ${nota}。${op.desc}`;
      return { title, comment, tag, scoreText };
    }
  }

  // 2. 將軍（Check）
  if (isChecked) {
    tag = 'CHECK';
    if (pType === 'C') {
      title = isHans ? '【当头将/翻炮将军】' : '【當頭將/翻炮將軍】';
      comment = isHans
        ? `${sideName}${pName}铁炮发威直逼九宫！${enemyName}必须立即应将！`
        : `${sideName}${pName}鐵炮發威直逼九宮！${enemyName}必須立即應將！`;
    } else if (pType === 'N') {
      const isAngle = (to.r === 1 || to.r === 8) && (to.c === 2 || to.c === 6);
      title = isAngle ? (isHans ? '【挂角马将军】' : '【掛角馬將軍】') : (isHans ? '【卧槽马将军】' : '【臥槽馬將軍】');
      comment = isHans
        ? `${sideName}骏马踏入险地，暗伏卧槽绝杀之势，杀机四伏！`
        : `${sideName}駿馬踏入險地，暗伏臥槽絕殺之勢，殺機四伏！`;
    } else if (pType === 'R') {
      title = isHans ? '【霸王车巡宫将军】' : '【霸王車巡宮將軍】';
      comment = isHans
        ? `${sideName}强车直贯九宫，以万夫不当之勇直接照将！`
        : `${sideName}強車直貫九宮，以萬夫不當之勇直接照將！`;
    } else {
      title = isHans ? '【提子将军】' : '【提子將軍】';
      comment = isHans
        ? `${sideName}走出 ${nota} 发动将军，局势陡然紧迫！`
        : `${sideName}走出 ${nota} 發動將軍，局勢陡然緊迫！`;
    }
    return { title, comment, tag, scoreText };
  }

  // 3. 吃子戰術
  if (captured) {
    tag = 'CAPTURE';
    const capName = PIECE_NAMES[lang][captured.side][captured.type] || captured.type;
    if (captured.type === 'R') {
      title = isHans ? '【斩落强车】' : '【斬落強車】';
      comment = isHans
        ? `${sideName}${pName}果断吃掉对方大车！重创${enemyName}主力阵脚。`
        : `${sideName}${pName}果斷吃掉對方大車！重創${enemyName}主力陣腳。`;
    } else if (captured.type === 'C' || captured.type === 'N') {
      title = isHans ? '【得子取势】' : '【得子取勢】';
      comment = isHans
        ? `${sideName}吃去${enemyName}${capName}，在子力交换中斩获实质优势。`
        : `${sideName}吃去${enemyName}${capName}，在子力交換中斬獲實質優勢。`;
    } else if (captured.type === 'B' || captured.type === 'A') {
      title = isHans ? '【摧毁防线】' : '【摧毀防線】';
      comment = isHans
        ? `${sideName}强硬破除敌方${capName}，撕裂九宫外围防守屏障！`
        : `${sideName}強硬破除敵方${capName}，撕裂九宮外圍防守屏障！`;
    } else {
      title = isHans ? '【消灭过河子】' : '【消滅過河子】';
      comment = isHans
        ? `${sideName}顺手扫落${capName}，清理战场外围障碍。`
        : `${sideName}順手掃落${capName}，清理戰場外圍障礙。`;
    }
    return { title, comment, tag, scoreText };
  }

  // 4. 大子戰略走位
  if (pType === 'R') {
    tag = 'ATTACK';
    const isRiver = (side === RED && to.r === 4) || (side === BLACK && to.r === 5); // 巡河
    const isOverRiver = (side === RED && to.r === 5) || (side === BLACK && to.r === 4); // 骑河
    const isBottom = (side === RED && to.r >= 8) || (side === BLACK && to.r <= 1); // 沉底
    const isRib = to.c === 3 || to.c === 5; // 占肋

    if (isBottom) {
      title = isHans ? '【车沉底线】' : '【車沉底線】';
      comment = isHans
        ? `${sideName}大车深入敌方九宫底部，封死将门退路，伺机形成下二路重杀！`
        : `${sideName}大車深入敵方九宮底部，封死將門退路，伺機形成下二路重殺！`;
    } else if (isRib) {
      title = isHans ? '【车占肋道】' : '【車佔肋道】';
      comment = isHans
        ? `${sideName}进车牢牢扼守四/六肋道要津，压迫九宫，蓄势待发！`
        : `${sideName}進車牢牢扼守四/六肋道要津，壓迫九宮，蓄勢待發！`;
    } else if (isRiver) {
      title = isHans ? '【巡河据守】' : '【巡河據守】';
      comment = isHans
        ? `${sideName}车占巡河要道，横扫兵线，攻守从容自如。`
        : `${sideName}車佔巡河要道，橫掃兵線，攻守從容自如。`;
    } else if (isOverRiver) {
      title = isHans ? '【骑河压制】' : '【騎河壓制】';
      comment = isHans
        ? `${sideName}车进骑河，直接锁死敌方卒林，限制敌军子力跃出。`
        : `${sideName}車進騎河，直接鎖死敵方卒林，限制敵軍子力躍出。`;
    } else {
      title = isHans ? '【车争要道】' : '【車爭要道】';
      comment = isHans
        ? `${sideName}调遣强车，快速展开子力，争夺中盘通畅线路。`
        : `${sideName}調遣強車，快速展開子力，爭奪中盤通暢線路。`;
    }
    return { title, comment, tag, scoreText };
  }

  if (pType === 'N') {
    tag = 'ATTACK';
    const isOverRiver = (side === RED && to.r >= 5) || (side === BLACK && to.r <= 4);
    const isCenter = to.c === 4;

    if (isCenter) {
      title = isHans ? '【盘头马出击】' : '【盤頭馬出擊】';
      comment = isHans
        ? `${sideName}马跃中路，配合中炮形成铁甲中门之势，杀气腾腾！`
        : `${sideName}馬躍中路，配合中炮形成鐵甲中門之勢，殺氣騰騰！`;
    } else if (isOverRiver) {
      title = isHans ? '【跃马过河】' : '【躍馬過河】';
      comment = isHans
        ? `${sideName}骏马奔腾过河，直指敌方侧翼防线，暗伏卧槽与挂角杀招！`
        : `${sideName}駿馬奔騰過河，直指敵方側翼防線，暗伏臥槽與掛角殺招！`;
    } else {
      title = isHans ? '【正马挺进】' : '【正馬挺進】';
      comment = isHans
        ? `${sideName}跃马踏实阵地，护卫中卒并随时准备越界反扑。`
        : `${sideName}躍馬踏實陣地，護衛中卒並隨時準備越界反撲。`;
    }
    return { title, comment, tag, scoreText };
  }

  if (pType === 'C') {
    tag = 'TACTIC';
    const isCenter = to.c === 4;
    const isBottom = (side === RED && to.r >= 8) || (side === BLACK && to.r <= 1);
    if (isCenter) {
      title = isHans ? '【当头重炮】' : '【當頭重炮】';
      comment = isHans
        ? `${sideName}炮镇中营，直接压迫黑方将门，牵制全局！`
        : `${sideName}炮鎮中營，直接壓迫黑方將門，牽制全局！`;
    } else if (isBottom) {
      title = isHans ? '【沉底铁炮】' : '【沉底鐵炮】';
      comment = isHans
        ? `${sideName}底炮架设完毕，随时配合车马形成闷宫或双杯绝杀！`
        : `${sideName}底炮架設完畢，隨時配合車馬形成悶宮或雙杯絕殺！`;
    } else {
      title = isHans ? '【运炮锁线】' : '【運炮鎖線】';
      comment = isHans
        ? `${sideName}巧妙挪动炮位，调整火力纵深，威胁敌方关键子力。`
        : `${sideName}巧妙挪動炮位，調整火力縱深，威脅敵方關鍵子力。`;
    }
    return { title, comment, tag, scoreText };
  }

  if (pType === 'B' || pType === 'A') {
    tag = 'DEFENSE';
    title = isHans ? '【巩固后防】' : '【鞏固後防】';
    comment = isHans
      ? `${sideName}调动士相补厚中路，阵型森严无懈可击。`
      : `${sideName}調動士相補厚中路，陣型森嚴無懈可擊。`;
    return { title, comment, tag, scoreText };
  }

  if (pType === 'P') {
    tag = 'TACTIC';
    const isOverRiver = (side === RED && to.r >= 5) || (side === BLACK && to.r <= 4);
    if (isOverRiver) {
      title = isHans ? '【小卒过河】' : '【小卒過河】';
      comment = isHans
        ? `${sideName}卒过楚河汉界，步步为营，横直皆可行，威力堪比大子！`
        : `${sideName}卒過楚河漢界，步步為營，橫直皆可行，威力堪比大子！`;
    } else {
      title = isHans ? '【挺兵开道】' : '【挺兵開道】';
      comment = isHans
        ? `${sideName}挺起活兵，疏通马路同时遏制敌方出子节奏。`
        : `${sideName}挺起活兵，疏通馬路同時遏制敵方出子節奏。`;
    }
    return { title, comment, tag, scoreText };
  }

  if (pType === 'K') {
    tag = 'DEFENSE';
    title = isHans ? '【将帅巡宫】' : '【將帥巡宮】';
    comment = isHans
      ? `${sideName}${pName}平稳挪步，调配九宫防守站位，伺机助攻！`
      : `${sideName}${pName}平穩挪步，調配九宮防守站位，伺機助攻！`;
    return { title, comment, tag, scoreText };
  }

  return {
    title: isHans ? '【平稳行棋】' : '【平穩行棋】',
    comment: isHans ? `${sideName}走出 ${nota}，调配阵型，稳扎稳打。` : `${sideName}走出 ${nota}，調配陣型，穩紮穩打。`,
    tag: 'TACTIC',
    scoreText,
  };
}

/**
 * 獲取大師級 AI 指導建議 (Guidance / Hint)
 * @param {Array<Array<object|null>>} board
 * @param {string} side RED | BLACK
 * @param {string} lang zh-Hant | zh-Hans
 * @param {Array} history
 * @param {Array} posHistory
 * @returns {{ from: object, to: object, nota: string, title: string, rationale: string, scoreText: string }}
 */
export function getGuidance(board, side, lang = LANG_HANS, history = [], posHistory = []) {
  const isHans = lang === LANG_HANS;
  const sideName = side === RED ? (isHans ? '红方' : '紅方') : (isHans ? '黑方' : '黑方');

  // 1. 若處於開局階段，優先查詢大師開局譜
  let move = getOpeningMove(board, side, 'hard');
  let isBook = false;

  if (move && move.from && move.to) {
    const pieceAtFrom = board[move.from.r]?.[move.from.c];
    if (pieceAtFrom && pieceAtFrom.side === side) {
      const legals = legalMoves(board, move.from.r, move.from.c);
      const isLegal = legals.some((m) => m.r === move.to.r && m.c === move.to.c);
      if (isLegal) {
        isBook = true;
      } else {
        move = null;
      }
    } else {
      move = null;
    }
  }

  if (!move) {
    // 2. 呼叫最強深度引擎搜尋最優著法
    const recent = (posHistory && posHistory.length)
      ? posHistory.slice(-16)
      : history.map((h) => h.posKey).filter(Boolean);
    const result = findBestMove(board, side, 'hard', recent);
    if (result && result.from && result.to) {
      move = { from: result.from, to: result.to };
    }
  }

  if (!move || !move.from || !move.to) {
    return null;
  }

  const { from, to } = move;
  const piece = board[from.r][from.c];
  if (!piece) return null;

  const nota = notation(board, from, to, lang);
  const targetPiece = board[to.r][to.c];

  // 模擬走子評估
  const nextBoard = board.map((row) => row.map((p) => (p ? { ...p } : null)));
  nextBoard[to.r][to.c] = nextBoard[from.r][from.c];
  nextBoard[from.r][from.c] = null;

  const evalScore = evaluate(nextBoard);
  const scoreText = formatScore(evalScore, lang);

  let title = '';
  let rationale = '';

  if (isBook) {
    title = isHans ? '【大师定式正着】' : '【大師定式正著】';
    rationale = isHans
      ? `走 ${nota} 符合经典棋谱定式。能够高效展开主力兵力，占据中心要道并制约对方阵型。`
      : `走 ${nota} 符合經典棋譜定式。能夠高效展開主力兵力，佔據中心要道並制約對方陣型。`;
  } else if (targetPiece) {
    const capName = PIECE_NAMES[lang][targetPiece.side][targetPiece.type] || targetPiece.type;
    title = isHans ? '【战术得子/换子】' : '【戰術得子/換子】';
    rationale = isHans
      ? `推荐走 ${nota} 吃掉对方${capName}。在子力兑换中不仅斩获实惠，更能打乱对方防线布局。`
      : `推薦走 ${nota} 吃掉對方${capName}。在子力兌換中不僅斬獲實惠，更能打亂對方防線布局。`;
  } else if (inCheck(nextBoard, side === RED ? BLACK : RED)) {
    title = isHans ? '【杀机突现·将军】' : '【殺機突現·將軍】';
    rationale = isHans
      ? `推荐走 ${nota} 直扑九宫将军！逼迫敌方应对，牢牢夺取场上绝对主动权。`
      : `推薦走 ${nota} 直撲九宮將軍！逼迫敵方應對，牢牢奪取場上絕對主動權。`;
  } else {
    const pType = piece.type;
    if (pType === 'R') {
      title = isHans ? '【大车出击·抢占要津】' : '【大車出擊·搶占要津】';
      rationale = isHans
        ? `推荐走 ${nota}。车是全盘威力最强之子，此步抢占通畅线与咽喉要道，威慑力巨大。`
        : `推薦走 ${nota}。車是全盤威力最強之子，此步搶占通暢線與咽喉要道，威懾力巨大。`;
    } else if (pType === 'N') {
      title = isHans ? '【跃马腾挪·寻觅良机】' : '【躍馬騰挪·尋覓良機】';
      rationale = isHans
        ? `推荐走 ${nota}。调整马位，封锁敌方行进通路，伺机越过楚河汉界扑杀关键要害。`
        : `推薦走 ${nota}。調整馬位，封鎖敵方行進通路，伺機越過楚河漢界撲殺關鍵要害。`;
    } else if (pType === 'C') {
      title = isHans ? '【遥制敌阵·隔山打牛】' : '【遙制敵陣·隔山打牛】';
      rationale = isHans
        ? `推荐走 ${nota}。巧妙借用炮架威慑对方将门或主力，掌控中盘节奏。`
        : `推薦走 ${nota}。巧妙借用炮架威懾對方將門或主力，掌控中盤節奏。`;
    } else {
      title = isHans ? '【运筹帷幄·稳中求胜】' : '【運籌帷幄·穩中求勝】';
      rationale = isHans
        ? `推荐走 ${nota}。调动阵型以巩固整体协调性，消除潜藏隐患，为下一步进攻铺平道路。`
        : `推薦走 ${nota}。調動陣型以鞏固整體協調性，消除潛藏隱患，為下一步進攻鋪平道路。`;
    }
  }

  return {
    from,
    to,
    nota,
    title,
    rationale,
    scoreText,
  };
}

/**
 * 專業象棋 AI 語音解說播放
 * 專屬使用微軟雲揚（zh-CN-YunyangNeural）/ 雲哲（zh-TW-YunJheNeural）高保真廣播級神經網路男聲
 * 渾厚、沉穩、字正腔圓，宛如國家級象棋大師與體育解說員親臨現場解說。
 * 全面移除並杜絕任何本地人機女聲。
 */
let currentAudio = null;
let isAudioPlaying = false;
let voiceEnabled = false;
let speechResolvers = [];

function notifySpeechFinished() {
  const resolvers = speechResolvers.slice();
  speechResolvers = [];
  for (const resolve of resolvers) {
    try { resolve(); } catch {}
  }
}

export function isVoiceEnabled() {
  return voiceEnabled;
}

export function cancelSpeech() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.src = '';
    } catch {}
    currentAudio = null;
    isAudioPlaying = false;
  }
  // 安全清理瀏覽器可能殘留的任何本地女聲音訊
  if (typeof window !== 'undefined' && ('speechSynthesis' in window)) {
    try { window.speechSynthesis.cancel(); } catch {}
  }
  notifySpeechFinished();
}

export function setVoiceEnabled(enabled) {
  voiceEnabled = enabled;
  if (!enabled) {
    cancelSpeech();
  }
}

export function isSpeaking() {
  return isAudioPlaying || !!currentAudio;
}

/**
 * 當開啟語音解說時，供 AI 落子前非同步等待語音解說結束
 * 避免 AI 瞬間走子打斷玩家走法的語音播報
 */
export function waitUntilSpeechFinished() {
  if (!voiceEnabled) return Promise.resolve();
  if (!isSpeaking()) return Promise.resolve();

  return new Promise((resolve) => {
    speechResolvers.push(resolve);
    // 8 秒安全防呆超時，防止音訊遺失事件造成死等
    setTimeout(() => {
      const idx = speechResolvers.indexOf(resolve);
      if (idx >= 0) {
        speechResolvers.splice(idx, 1);
        resolve();
      }
    }, 8000);
  });
}

/**
 * 播報象棋棋評：純男性專業廣播級音色
 */
export function speakCommentary(text, lang = LANG_HANS) {
  if (!voiceEnabled || !text) {
    notifySpeechFinished();
    return;
  }

  cancelSpeech();

  // 清洗棋評文本中的特殊標記符號，使語音播報純粹自然
  const cleanText = text
    .replace(/【(.*?)】/g, '$1。')
    .replace(/[⚡🎯✕🔊🔇📋]/g, '')
    .replace(/（.*?）/g, '')
    .trim();

  if (!cleanText) {
    notifySpeechFinished();
    return;
  }

  if (typeof window === 'undefined' || typeof window.Audio === 'undefined') {
    notifySpeechFinished();
    return;
  }

  // 唯一使用高保真神經網路專業男聲 (/api/tts)，徹底杜絕人機女聲
  const ttsUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&lang=${lang}`;
  const audio = new Audio(ttsUrl);
  currentAudio = audio;
  isAudioPlaying = true;

  audio.onended = () => {
    if (currentAudio === audio) {
      currentAudio = null;
      isAudioPlaying = false;
    }
    notifySpeechFinished();
  };

  audio.onerror = (e) => {
    console.warn('TTS playback error:', e);
    if (currentAudio === audio) {
      currentAudio = null;
      isAudioPlaying = false;
    }
    notifySpeechFinished();
  };

  audio.play().catch((err) => {
    console.warn('Audio play failed:', err);
    if (currentAudio === audio) {
      currentAudio = null;
      isAudioPlaying = false;
    }
    notifySpeechFinished();
  });
}
