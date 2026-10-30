/* 交互演示：贝叶斯与基率。1000 人的自然频数方格对照贝叶斯公式。纯原生 JS，挂到 window.KGDemos['foundation-bayes']。 */
(function () {
  'use strict';
  var ID = 'foundation-bayes', P = 'dm-' + ID + '-', N = 1000, COLS = 40, LAST = 5;
  function X(s) { return s.replace(/\bx-/g, P); }

  /* 两套说法：医学检测和垃圾邮件过滤，公式完全一样 */
  var MED = {
    D: '病', H: '健康', Dn: '病人', Hn: '健康人', cl: '个', all: '1000 个人', one: '一个人（还不知道有没有病）',
    pos: '阳性', neg: '阴性', hit: '检出阳性', miss: '漏检', fa: '会误报阳性', prior: '患病率', test: '检测',
    isD: '有病', isD2: '有没有病', pp: '两次都阳性', pp2: '两次+', rn: '复检转阴', skip: '第一次就阴性，不复检',
    re: '把第一次阳性的人再独立检测一次', dep: '同一个人的体质让检测反复误报',
    guess: '一个人检测阳性，他真有病的概率大概是多少？',
    steps: ['开始前', '基率：1000 人里有几个病人', '病人里多少检出阳性', '健康人里多少误报', '阳性的人里有多少真病', '独立复检：第一次的后验变成新的先验']
  };
  var SPAM = {
    D: '垃圾', H: '正常', Dn: '垃圾邮件', Hn: '正常邮件', cl: '封', all: '1000 封邮件', one: '一封邮件（还不知道是不是垃圾）',
    pos: '含「中奖」', neg: '不含「中奖」', hit: '含「中奖」', miss: '不含这个词', fa: '也含「中奖」', prior: '垃圾邮件比例', test: '看词',
    isD: '是垃圾邮件', isD2: '是不是垃圾邮件', pp: '两个词都有', pp2: '两词都有', rn: '第二个词没有', skip: '不含「中奖」，不再看',
    re: '对含「中奖」的邮件再看第二个词「免费」（假设它的两个比例和「中奖」一样）', dep: '两个词总是一起出现',
    guess: '一封邮件含「中奖」，它是垃圾邮件的概率大概是多少？',
    steps: ['开始前', '基率：1000 封邮件里有几封垃圾邮件', '垃圾邮件里多少含这个词', '正常邮件里多少也含这个词（误报）', '含这个词的邮件里有多少真是垃圾', '再看一个独立的词：后验变成新的先验']
  };
  var PRESETS = {
    screen: { p: 1, s: 90, t: 91, T: MED, name: '罕见病筛查：患病率 1%，灵敏度 90%，特异度 91%',
      note: 'Gigerenzer 讲自然频数时常用的乳腺癌筛查数字：患病率 1%，灵敏度 90%，假阳性率 9%。很多人直觉以为阳性就有九成可能患病。' },
    rare: { p: 0.1, s: 99, t: 99, T: MED, name: '更罕见的病：患病率 0.1%，灵敏度、特异度都是 99%',
      note: '检测准到 99%，病却更罕见：阳性后真有病的概率还不到一成。注意第 5 步，人数少时取整误差会很大。' },
    spam: { p: 20, s: 40, t: 98, T: SPAM, name: '垃圾邮件里的词「中奖」：比例 20%，40%，98%',
      note: '把「有病」换成「是垃圾邮件」，把「阳性」换成「含『中奖』」，同一个公式就是朴素贝叶斯过滤器的一步。数字是示意。' },
    half: { p: 50, s: 90, t: 91, T: MED, name: '先验 50%：同一个检测，基率不再低',
      note: '和第一个场景检测完全一样，只把先验提到 50%：误报不再淹没真阳性。' }
  };
  var SL = [
    { k: 'p', min: 0.1, max: 50, lab: function (T) { return T.prior + ' p（基率，也就是先验）'; } },
    { k: 's', min: 1, max: 100, lab: function (T) { return '灵敏度 s = P(+|' + T.D + ')'; } },
    { k: 't', min: 50, max: 100, lab: function (T) { return '特异度 t = P(−|' + T.H + ')'; } }
  ];

  /* ---------- 核心计算（不碰 DOM） ---------- */
  function bayes(p, s, t) { var a = s * p, b = (1 - t) * (1 - p); return a + b > 0 ? a / (a + b) : NaN; }
  function negPost(p, s, t) { var a = t * (1 - p), b = (1 - s) * p; return a + b > 0 ? a / (a + b) : NaN; }   // P(健康|−)
  function isInt(x) { return Math.abs(x - Math.round(x)) < 1e-7; }
  // 自然频数一律四舍五入到整数（.5 进位）；复检只对第一次阳性的那些人做，用取整后的人数
  function rnd(x) { return Math.floor(x + 0.5 + 1e-9); }
  function freq(p, s, t) {
    var D = rnd(N * p), H = N - D, TP = rnd(D * s), FP = rnd(H * (1 - t)), TP2 = rnd(TP * s), FP2 = rnd(FP * (1 - t));
    return { D: D, H: H, TP: TP, FN: D - TP, FP: FP, TN: H - FP, TP2: TP2, FP2: FP2,
      raw: { D: N * p, TP: D * s, FP: H * (1 - t), TP2: TP * s, FP2: FP * (1 - t) } };
  }
  function model(p, s, t) {
    var p1 = bayes(p, s, t);
    return { p: p, s: s, t: t, a: s * p, b: (1 - t) * (1 - p), p1: p1, p2: bayes(p1, s, t), neg: negPost(p, s, t), F: freq(p, s, t) };
  }
  function ratio(a, b) { return a + b > 0 ? a / (a + b) : NaN; }

  /* ---------- 格式 ---------- */
  function g(x) { return String(+x.toPrecision(4)); }
  function num(x) { return String(+x.toFixed(2)); }
  function pc(x, d) { return isFinite(x) ? +(x * 100).toFixed(d == null ? 2 : d) + '%' : '—'; }
  function eq(raw, n) { return isInt(raw) ? String(n) : num(raw) + ' ≈ ' + n; }
  function fr(a, b) { return a + b ? ' = ' + a + '/' + (a + b) + ' ≈ ' + pc(a / (a + b)) : '：取整后一个也没有，算不出比例'; }

  /* ---------- 方格 ---------- */
  // 排列顺序：假阴性 | 复检转阴的真阳性 | 两次阳性的病人 | 两次阳性的健康人 | 复检转阴的假阳性 | 真阴性。病人连成一片，阳性的人也连成一片
  function cls(grp, k) {
    var sick = grp === 'fn' || grp === 'tpn' || grp === 'tp2';
    if (k === 0) return 'u';
    if (k === 1) return sick ? 'sk' : 'h0';
    if (k === 2) return sick ? (grp === 'fn' ? 'fn' : 'tp') : 'h0';
    if (k < 5) {
      var d = k === 4 ? ' x-dim' : '';
      return grp === 'fn' ? 'fn' + d : sick ? 'tp' : grp === 'tn' ? 'tn' + d : 'fp';
    }
    return { fn: 'off', tn: 'off', tpn: 'fn x-half', fpn: 'tn x-half', tp2: 'tp', fp2: 'fp' }[grp];
  }
  // 方块 = 病人，圆点 = 健康人；实心 = 阳性，空心 = 阴性；小点 = 第 5 步不再复检的人
  function shape(x, y, c) {
    var k = c.split(' ')[0], a = ' class="x-' + c + '" ';
    if (k === 'tp' || k === 'sk') return '<rect' + a + 'x="' + (x + 1) + '" y="' + (y + 1) + '" width="8" height="8" rx="1"/>';
    if (k === 'fn') return '<rect' + a + 'x="' + (x + 1.75) + '" y="' + (y + 1.75) + '" width="6.5" height="6.5" rx="1"/>';
    return '<circle' + a + 'cx="' + (x + 5) + '" cy="' + (y + 5) + '" r="' + (k === 'fp' ? 4 : k === 'off' ? 1.4 : 3.2) + '"/>';
  }
  function legendItems(F, k, T) {
    var tp = ['tp', '真阳性：' + T.Dn + '，' + T.hit, F.TP], fn = ['fn', '假阴性：' + T.Dn + '，' + T.miss, F.FN],
      fp = ['fp', '假阳性：' + T.Hn + '，' + T.fa, F.FP], tn = ['tn', '真阴性：' + T.Hn + '，' + T.neg, F.TN];
    if (k === 0) return [['u', T.one, N]];
    if (k === 1) return [['sk', T.Dn, F.D], ['h0', T.Hn, F.H]];
    if (k === 2) return [tp, fn, ['h0', T.Hn + '（下一步再看）', F.H]];
    if (k === 3) return [tp, fn, fp, tn];
    if (k === 4) return [tp, fp, ['fn x-dim', fn[1], F.FN], ['tn x-dim', tn[1], F.TN]];
    return [['tp', T.pp + '的' + T.Dn, F.TP2], ['fp', T.pp + '的' + T.Hn, F.FP2], ['fn x-half', T.rn + '的' + T.Dn, F.TP - F.TP2],
      ['tn x-half', T.rn + '的' + T.Hn, F.FP - F.FP2], ['off', T.skip, F.FN + F.TN]];
  }
  function gridHTML(F, k, T) {
    var order = [['fn', F.FN], ['tpn', F.TP - F.TP2], ['tp2', F.TP2], ['fp2', F.FP2], ['fpn', F.FP - F.FP2], ['tn', F.TN]];
    var h = '', i = 0, items = legendItems(F, k, T);
    order.forEach(function (o) {
      var c = cls(o[0], k);
      for (var j = 0; j < o[1]; j++, i++) h += shape((i % COLS) * 10, Math.floor(i / COLS) * 10, c);
    });
    var label = T.all + '的方格，每格一' + T.cl + '：' + items.map(function (it) { return it[1] + ' ' + it[2]; }).join('；');
    return '<svg class="x-svg" viewBox="0 0 400 250" role="img" aria-label="' + label + '">' + h + '</svg>' +
      '<ul class="x-leg">' + items.map(function (it) {
        return '<li><svg viewBox="0 0 10 10" width="16" height="16" aria-hidden="true">' + shape(0, 0, it[0]) + '</svg><span>' + it[1] + '</span><b>' + it[2] + '</b></li>';
      }).join('') + '</ul>';
  }

  /* ---------- 文字 ---------- */
  function say(M, k, T) {
    var F = M.F, n1 = F.TP + F.FP, s;
    if (k === 0) return '方格里是 ' + T.all + '。先猜一猜：' + T.guess + '想好了按「下一步」。';
    if (k === 1) return T.prior + '（基率，也就是' + T.test + '之前的先验）p = ' + pc(M.p) + '：' + T.all + '里约有 ' + F.D + ' ' + T.cl + T.Dn + '（方块），' +
      F.H + ' ' + T.cl + T.Hn + '（圆点）。这一步还没' + T.test + '，用的只是基率。';
    if (k === 2) return '灵敏度 s = P(+|' + T.D + ') = ' + pc(M.s) + '：' + F.D + ' ' + T.cl + T.Dn + '里有 ' + F.TP + ' ' + T.cl + T.hit + '，叫真阳性（实心方块）；' +
      F.FN + ' ' + T.cl + T.miss + '，叫假阴性（空心方块）。';
    if (k === 3) return '特异度 t = P(−|' + T.H + ') = ' + pc(M.t) + '，也就是' + T.Hn + '里有 ' + pc(1 - M.t) + ' ' + T.fa + '：' + F.H + ' ' + T.cl + T.Hn + '里约 ' +
      F.FP + ' ' + T.cl + '假阳性（实心圆点），' + F.TN + ' ' + T.cl + '真阴性（空心圆点）。' +
      (F.FP > F.TP ? T.Hn + '基数大，误报的 ' + F.FP + ' ' + T.cl + '比真阳性的 ' + F.TP + ' ' + T.cl + '还多。' : '');
    if (k === 4) {
      s = '只看' + T.pos + '的 ' + n1 + ' ' + T.cl + '（实心的）：真' + T.isD + '的 ' + F.TP + ' ' + T.cl + '，比例' + fr(F.TP, F.FP) + '；精确值 P(' + T.D + '|+) = ' + pc(M.p1) + '。';
      if (M.p1 < M.s - 0.15) s += '灵敏度 ' + pc(M.s) + ' 是 P(+|' + T.D + ')，这里问的是反过来的 P(' + T.D + '|+)。差这么多是因为基率低：' + T.Hn + '多，误报的绝对数量就多。';
      else if (M.p1 > M.s + 0.15) s += '这里 P(' + T.D + '|+) 比灵敏度还高：基率不低，误报又少。';
      else s += '基率够高时，误报不再淹没真阳性，P(' + T.D + '|+) 和灵敏度差不多。';
      return s + '反过来，' + T.neg + '的 ' + (F.FN + F.TN) + ' ' + T.cl + '里 P(' + T.H + '|−) ≈ ' + pc(M.neg) + '。';
    }
    return T.re + '。这 ' + n1 + ' ' + T.cl + '里' + T.isD + '的概率已经是 ' + pc(M.p1) + '，它就是新的先验 p′：公式和第 4 步一样，只把 p 换成 p′。' +
      T.pp + '的有 ' + F.TP2 + ' ' + T.cl + T.Dn + '、' + F.FP2 + ' ' + T.cl + T.Hn + '，精确值 P(' + T.D + '|' + T.pp2 + ') = ' + pc(M.p2) + '。前提是两次' + T.test +
      '在给定' + T.isD2 + '时相互独立；如果' + T.dep + '，第二次的证据就没这么强。';
  }
  function rows(M, T) {
    var F = M.F, R = F.raw, D = T.D, H = T.H, ta = M.t * (1 - M.p), fb = (1 - M.s) * M.p, a2 = M.s * M.p1, b2 = (1 - M.t) * (1 - M.p1);
    return [null,
      ['1000 × ' + pc(M.p) + ' = ' + eq(R.D, F.D) + ' ' + T.cl + T.Dn + '，其余 ' + F.H + ' ' + T.cl + T.Hn,
        'P(' + D + ') = p = ' + g(M.p) + '，P(' + H + ') = 1 − p = ' + g(1 - M.p)],
      [F.D + ' × ' + pc(M.s) + ' = ' + eq(R.TP, F.TP) + ' ' + T.cl + '真阳性（TP），' + F.D + ' − ' + F.TP + ' = ' + F.FN + ' ' + T.cl + '假阴性（FN）',
        'P(' + D + ' 且 +) = s·p = ' + g(M.s) + ' × ' + g(M.p) + ' = ' + g(M.a)],
      [F.H + ' × ' + pc(1 - M.t) + ' = ' + eq(R.FP, F.FP) + ' ' + T.cl + '假阳性（FP），' + F.H + ' − ' + F.FP + ' = ' + F.TN + ' ' + T.cl + '真阴性（TN）',
        'P(' + H + ' 且 +) = (1 − t)(1 − p) = ' + g(1 - M.t) + ' × ' + g(1 - M.p) + ' = ' + g(M.b)],
      ['P(' + D + '|+) ≈ TP/(TP + FP) = ' + F.TP + '/(' + F.TP + ' + ' + F.FP + ')' + fr(F.TP, F.FP) +
        '<br>P(' + H + '|−) ≈ TN/(TN + FN) = ' + F.TN + '/(' + F.TN + ' + ' + F.FN + ')' + fr(F.TN, F.FN),
        'P(' + D + '|+) = s·p / (s·p + (1 − t)(1 − p)) = ' + g(M.a) + ' / (' + g(M.a) + ' + ' + g(M.b) + ') ≈ ' + pc(M.p1) +
        '<br>P(' + H + '|−) = t(1 − p) / (t(1 − p) + (1 − s)p) = ' + g(ta) + ' / (' + g(ta) + ' + ' + g(fb) + ') ≈ ' + pc(M.neg)],
      ['第一次' + T.pos + '的 ' + (F.TP + F.FP) + ' ' + T.cl + '再看一次：' + F.TP + ' × ' + pc(M.s) + ' = ' + eq(R.TP2, F.TP2) + '，' + F.FP + ' × ' + pc(1 - M.t) + ' = ' + eq(R.FP2, F.FP2) +
        '<br>P(' + D + '|' + T.pp2 + ') ≈ ' + F.TP2 + '/(' + F.TP2 + ' + ' + F.FP2 + ')' + fr(F.TP2, F.FP2),
        '新先验 p′ = P(' + D + '|+) ≈ ' + pc(M.p1) + '<br>P(' + D + '|' + T.pp2 + ') = s·p′ / (s·p′ + (1 − t)(1 − p′)) = ' + g(a2) + ' / (' + g(a2) + ' + ' + g(b2) + ') ≈ ' + pc(M.p2)]
    ];
  }
  function roundNote(M, k, T) {
    var F = M.F, R = F.raw, list = [], s, d1, d2;
    if (!isInt(R.D)) list.push('1000 × p = ' + num(R.D));
    if (k >= 2 && !isInt(R.TP)) list.push(F.D + ' × s = ' + num(R.TP));
    if (k >= 3 && !isInt(R.FP)) list.push(F.H + ' × (1 − t) = ' + num(R.FP));
    if (k >= 5 && !isInt(R.TP2)) list.push('复检时 ' + F.TP + ' × s = ' + num(R.TP2));
    if (k >= 5 && !isInt(R.FP2)) list.push('复检时 ' + F.FP + ' × (1 − t) = ' + num(R.FP2));
    if (!list.length) return '到这一步为止，自然频数都是整数，没有取整，左右两栏的结果完全一致。';
    s = '有取整：' + list.join('，') + '，都按四舍五入记成整数（.5 进位）。';
    d1 = k >= 4 ? Math.abs(ratio(F.TP, F.FP) - M.p1) : 0;
    d2 = k >= 5 ? Math.abs(ratio(F.TP2, F.FP2) - M.p2) : 0;
    if (!(d1 < 0.01 && d2 < 0.01)) return s + '<b>这里取整误差明显</b>（' + (k >= 5 ? '复检时只剩 ' + (F.TP + F.FP) + ' ' + T.cl : '人数太少') + '），以右栏公式的精确值为准；把 1000 换成 10 万，频数就会接近公式。';
    return s + (k >= 4 ? '所以频数比例和精确值略有差别。' : '');
  }
  function bar(a, b, la, lb) {
    if (!(a + b)) return '';
    var w = a * 100 / (a + b);
    return '<div class="x-bar2" role="img" aria-label="' + la + ' ' + a + '，' + lb + ' ' + b + '"><span class="x-ba" style="width:' + w + '%"></span><span class="x-bb" style="width:' + (100 - w) + '%"></span></div>' +
      '<p class="x-bl"><span><i class="x-ka"></i>' + la + ' ' + a + '</span><span><i class="x-kb"></i>' + lb + ' ' + b + '</span></p>';
  }
  function result(M, k, T) {
    var F = M.F;
    if (k < 4) return '';
    var h = '<p class="x-big">P(' + T.D + '|+) = <b>' + pc(M.p1) + '</b></p>' + bar(F.TP, F.FP, '真阳性', '假阳性');
    if (k === 5) h += '<p class="x-big">P(' + T.D + '|' + T.pp2 + ') = <b>' + pc(M.p2) + '</b></p>' + bar(F.TP2, F.FP2, T.pp + '的' + T.Dn, T.pp + '的' + T.Hn);
    return h;
  }

  /* ---------- 样式与骨架 ---------- */
  var C = 'var(--c-foundation,#8a5a2b)', TX = 'var(--text,#1b1b19)', T2 = 'var(--text-2,#52514e)', T3 = 'var(--text-3,#6b6a66)',
    SF = 'var(--surface,#fff)', S2 = 'var(--surface-2,#f0efec)', BD = 'var(--border,#e2e1dc)', NEG = 'var(--div-pos,#e34948)';
  var CSS =
    '.x-root{color:' + TX + ';font-family:var(--font,sans-serif);font-size:15px;line-height:1.65}' +
    '.x-root *{box-sizing:border-box}' +
    '.x-root p{margin:0 0 8px}' +
    '.x-root h3{margin:0 0 6px;font-size:16px;font-weight:600;line-height:1.4;color:' + TX + '}' +
    '.x-root .x-how{font-size:14px;color:' + T2 + ';margin-bottom:6px}' +
    '.x-root .x-intro{font-size:14px;color:' + T2 + ';margin-bottom:12px}' +
    '.x-box{background:' + SF + ';border:1px solid ' + BD + ';border-radius:var(--radius,10px);padding:12px;min-width:0}' +
    '.x-field{display:flex;flex-direction:column;gap:4px;font-size:13px;color:' + T2 + '}' +
    '.x-in{font:inherit;font-size:14px;color:' + TX + ';background:' + SF + ';border:1px solid ' + BD + ';border-radius:8px;padding:6px 8px;min-height:36px;min-width:0;max-width:100%}' +
    '.x-sls{display:grid;gap:10px 18px;margin-top:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))}' +
    '.x-sl{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;min-width:0}' +
    '.x-sn{flex:1 1 100%;font-size:13px;color:' + T2 + '}' +
    '.x-range{flex:1 1 110px;min-width:0;margin:6px 0;accent-color:' + C + '}' +
    '.x-num{flex:0 0 86px;width:86px}' +
    '.x-unit{font-size:13px;color:' + T2 + '}' +
    '.x-root .x-msg{margin:8px 0 0;font-size:13px;color:' + T2 + '}' +
    '.x-root .x-msg:empty{display:none}' +
    '.x-btn{font:inherit;font-size:14px;color:' + TX + ';background:' + SF + ';border:1px solid ' + BD + ';border-radius:8px;padding:6px 12px;min-height:36px;cursor:pointer}' +
    '.x-btn:hover{background:' + S2 + '}' +
    '.x-btn[aria-pressed=true],.x-pri{background:color-mix(in srgb,' + C + ' 16%,' + SF + ');border-color:' + C + '}' +
    '.x-pri{font-weight:600}' +
    '.x-btn[aria-disabled=true]{opacity:.45;cursor:default}' +
    '.x-root :focus-visible{outline:2px solid var(--focus,#2457b3);outline-offset:2px}' +
    '.x-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}' +
    '.x-status{flex:1 1 220px;font-size:14px}' +
    '.x-main{display:grid;gap:12px;margin-bottom:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))}' +
    '.x-fig{margin:0;border-top:3px solid ' + C + '}' +
    '.x-svg{display:block;width:100%;height:auto}' +
    '.x-leg{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:3px;font-size:13px;color:' + T2 + '}' +
    '.x-leg li{display:flex;align-items:center;gap:8px}' +
    '.x-leg svg{flex:0 0 auto}' +
    '.x-leg span{flex:1 1 auto}' +
    '.x-leg b{font-family:var(--mono,monospace);color:' + TX + '}' +
    '.x-u,.x-h0,.x-tn{fill:none;stroke:' + T3 + ';stroke-width:1.2}' +
    '.x-sk{fill:color-mix(in srgb,' + C + ' 35%,' + SF + ');stroke:' + C + ';stroke-width:1.2}' +
    '.x-tp{fill:' + C + '}' +
    '.x-fn{fill:' + SF + ';stroke:' + C + ';stroke-width:1.5}' +
    '.x-fp{fill:' + NEG + '}' +
    '.x-off{fill:' + T3 + ';opacity:.45}' +
    '.x-dim{opacity:.22}' +
    '.x-half{opacity:.6}' +
    '.x-now h3 small{display:block;font-size:13px;font-weight:400;color:' + T2 + '}' +
    '.x-root .x-say{padding:8px 10px;background:' + S2 + ';border-radius:8px;font-size:14px}' +
    '.x-root .x-big{margin:10px 0 4px;font-size:15px}' +
    '.x-big b{font-size:20px;font-family:var(--mono,monospace)}' +
    '.x-bar2{display:flex;height:14px;border:1px solid ' + BD + ';border-radius:4px;overflow:hidden}' +
    '.x-ba,.x-ka{background:' + C + '}' +
    '.x-bb,.x-kb{background:repeating-linear-gradient(135deg,' + NEG + ' 0 3px,color-mix(in srgb,' + NEG + ' 25%,' + SF + ') 3px 6px)}' +
    '.x-root .x-bl{display:flex;flex-wrap:wrap;gap:2px 14px;margin:4px 0 0;font-size:13px;color:' + T2 + '}' +
    '.x-bl i{display:inline-block;width:12px;height:12px;margin-right:5px;vertical-align:-1px;border-radius:2px}' +
    '.x-calc{border-top:3px solid ' + C + '}' +
    '.x-row{display:grid;gap:4px 14px;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));padding:8px 10px;border-top:1px solid ' + BD + ';font-size:14px;color:' + T2 + '}' +
    '.x-row.x-cur{color:' + TX + ';border-left:3px solid ' + C + ';background:color-mix(in srgb,' + C + ' 8%,' + SF + ')}' +
    '.x-rt{grid-column:1/-1;font-weight:600;color:' + TX + '}' +
    '.x-row small{display:block;font-size:12px;color:' + T3 + '}' +
    '.x-f{font-variant-numeric:tabular-nums;overflow-wrap:anywhere}' +
    '.x-root .x-note{margin:10px 0 0;font-size:13px;color:' + T2 + '}' +
    '.x-root .x-note:empty{display:none}';

  function sliderHTML(d) {
    return '<div class="x-sl"><span class="x-sn" data-lab="' + d.k + '"></span>' +
      '<input class="x-range" type="range" min="' + d.min + '" max="' + d.max + '" step="0.1" data-k="' + d.k + '">' +
      '<input class="x-in x-num" type="number" min="' + d.min + '" max="' + d.max + '" step="0.1" inputmode="decimal" data-k="' + d.k + '">' +
      '<span class="x-unit">%</span></div>';
  }
  var TPL =
    '<p class="x-how">怎么玩：选一个场景，或者拖动三个滑块（也可以直接输入数字），然后按「下一步」。方格里 1000 个人一步步分成四组，最后算出阳性的人里真有病的比例。方块是病人、圆点是健康人；实心表示检测阳性，空心表示阴性。</p>' +
    '<p class="x-intro">检测阳性时真正要问的是 P(病|+)：阳性的人里有多少真有病。它不等于灵敏度 P(+|病)，还取决于基率（检测前的先验概率）。把概率换成「1000 人里有几个」的自然频数（natural frequencies），这个问题会好想很多。</p>' +
    '<div class="x-box">' +
    '<label class="x-field">场景<select class="x-in x-preset" aria-label="选择场景">' +
    Object.keys(PRESETS).map(function (id) { return '<option value="' + id + '">' + PRESETS[id].name + '</option>'; }).join('') +
    '<option value="custom">自定义（沿用当前场景的说法）</option></select></label>' +
    '<div class="x-sls">' + SL.map(sliderHTML).join('') + '</div>' +
    '<p class="x-msg" aria-live="polite"></p></div>' +
    '<div class="x-bar">' +
    '<button class="x-btn" type="button" data-act="reset" aria-label="重置到开始">重置</button>' +
    '<button class="x-btn" type="button" data-act="prev" aria-label="上一步">上一步</button>' +
    '<button class="x-btn x-pri" type="button" data-act="next" aria-label="下一步">下一步</button>' +
    '<button class="x-btn" type="button" data-act="play" aria-pressed="false" aria-label="自动播放">自动播放</button>' +
    '<span class="x-status"></span></div>' +
    '<div class="x-main"><figure class="x-box x-fig"></figure>' +
    '<section class="x-box x-now" aria-label="现在发生了什么"><h3>现在发生了什么<small class="x-stitle"></small></h3><p class="x-say" aria-live="polite"></p><div class="x-res"></div></section></div>' +
    '<section class="x-box x-calc" aria-label="自然频数和贝叶斯公式对照"><h3>两种算法对照</h3><div class="x-rows"></div><p class="x-note"></p></section>';

  /* ---------- 挂载 ---------- */
  function mount(container) {
    if (!document.getElementById('dm-style-' + ID)) {
      var sty = document.createElement('style');
      sty.id = 'dm-style-' + ID; sty.textContent = X(CSS);
      document.head.appendChild(sty);
    }
    var root = document.createElement('div');
    root.className = P + 'root';
    root.innerHTML = X(TPL);
    container.appendChild(root);
    function $(sel) { return root.querySelector(X(sel)); }
    var el = {
      preset: $('.x-preset'), msg: $('.x-msg'), status: $('.x-status'), fig: $('.x-fig'), stitle: $('.x-stitle'), say: $('.x-say'),
      res: $('.x-res'), rows: $('.x-rows'), note: $('.x-note'), prev: $('[data-act=prev]'), next: $('[data-act=next]'), play: $('[data-act=play]')
    };
    var S = { T: MED, v: { p: 1, s: 90, t: 91 }, k: 0, timer: null, note: '' };
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduce) { el.play.setAttribute('aria-disabled', 'true'); el.play.title = '系统开启了「减少动态效果」，自动播放已关闭'; }
    function inp(kind, k) { return root.querySelector('.' + P + kind + '[data-k=' + k + ']'); }
    function def(k) { for (var i = 0; i < SL.length; i++) if (SL[i].k === k) return SL[i]; }

    function setMsg(t) { el.msg.textContent = t; }
    function labels() {
      SL.forEach(function (d) {
        var lab = d.lab(S.T);
        root.querySelector('[data-lab=' + d.k + ']').textContent = lab;
        inp('range', d.k).setAttribute('aria-label', lab + '，滑块，单位 %');
        inp('num', d.k).setAttribute('aria-label', lab + '，输入百分数');
      });
    }
    function sync() { SL.forEach(function (d) { inp('range', d.k).value = S.v[d.k]; inp('num', d.k).value = S.v[d.k]; }); }
    function matchPreset() {
      var m = 'custom';
      for (var id in PRESETS) { var pr = PRESETS[id]; if (pr.p === S.v.p && pr.s === S.v.s && pr.t === S.v.t && pr.T === S.T) m = id; }
      el.preset.value = m;
      setMsg(m === 'custom' ? '自定义参数。' : PRESETS[m].note);
    }
    function loadPreset(id) {
      var pr = PRESETS[id];
      S.T = pr.T; S.v = { p: pr.p, s: pr.s, t: pr.t };
      el.preset.value = id; labels(); sync(); setMsg(pr.note);
    }
    function stop() {
      if (S.timer) { clearInterval(S.timer); S.timer = null; }
      el.play.setAttribute('aria-pressed', 'false'); el.play.textContent = '自动播放'; el.play.setAttribute('aria-label', '自动播放');
    }
    function go(k) { S.k = Math.max(0, Math.min(LAST, k)); render(); }
    function play() {
      if (reduce) { setMsg('系统开启了「减少动态效果」，自动播放已关闭，请用「下一步」。'); return; }
      if (S.timer) { stop(); return; }
      if (S.k >= LAST) S.k = 0;
      el.play.setAttribute('aria-pressed', 'true'); el.play.textContent = '暂停'; el.play.setAttribute('aria-label', '暂停自动播放');
      S.timer = setInterval(function () { go(S.k + 1); if (S.k >= LAST) stop(); }, 2400);
      render();
    }
    function render() {
      var T = S.T, k = S.k, M = model(S.v.p / 100, S.v.s / 100, S.v.t / 100), R = rows(M, T), h = '', i;
      el.status.textContent = '第 ' + k + ' / ' + LAST + ' 步：' + T.steps[k] + (k === LAST ? '。已经是最后一步。' : '');
      el.prev.setAttribute('aria-disabled', k === 0 ? 'true' : 'false');
      el.next.setAttribute('aria-disabled', k === LAST ? 'true' : 'false');
      el.fig.innerHTML = X(gridHTML(M.F, k, T));
      el.stitle.textContent = k ? '第 ' + k + ' 步 · ' + T.steps[k] : '开始前';
      el.say.textContent = say(M, k, T);
      el.res.innerHTML = X(result(M, k, T));
      if (!k) h = '<p class="x-note">按「下一步」开始。每一步在这里并排给出两种算法：左边数人头，右边用概率公式。</p>';
      else {
        for (i = 1; i <= k; i++) {
          h += '<div class="x-row' + (i === k ? ' x-cur' : '') + '"><span class="x-rt">' + i + ' · ' + T.steps[i] + '</span>' +
            '<span><small>自然频数（' + T.all + '，数人头）</small><span class="x-f">' + R[i][0] + '</span></span>' +
            '<span><small>贝叶斯公式（精确概率）</small><span class="x-f">' + R[i][1] + '</span></span></div>';
        }
      }
      el.rows.innerHTML = X(h);
      el.note.innerHTML = k ? roundNote(M, k, T) : '';
    }

    function onClick(e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || !root.contains(b)) return;
      var act = b.getAttribute('data-act');
      if (act === 'next') { if (S.k < LAST) go(S.k + 1); }
      else if (act === 'prev') { stop(); go(S.k - 1); }
      else if (act === 'reset') { stop(); go(0); }
      else if (act === 'play') play();
    }
    function onInput(e) {
      var tg = e.target, k = tg.getAttribute && tg.getAttribute('data-k');
      if (!k) return;
      var d = def(k), v = parseFloat(tg.value);
      if (!isFinite(v) || v < d.min || v > d.max) return;     // 输入框还没打完时先不动，等 change 再纠正
      S.v[k] = v;
      if (tg.type === 'range') inp('num', k).value = v; else inp('range', k).value = v;
      matchPreset(); render();
    }
    function onChange(e) {
      var tg = e.target;
      if (tg === el.preset) {
        if (el.preset.value === 'custom') { setMsg('拖动滑块或输入数字，说法沿用当前场景。'); return; }
        loadPreset(el.preset.value); render(); return;
      }
      if (tg.type !== 'number') return;
      var k = tg.getAttribute('data-k'), d = def(k), v = parseFloat(tg.value), w;
      w = isFinite(v) ? Math.round(Math.min(d.max, Math.max(d.min, v)) * 10) / 10 : S.v[k];
      S.v[k] = w; sync(); matchPreset();
      if (w !== v) setMsg(d.lab(S.T) + ' 的范围是 ' + d.min + '%–' + d.max + '%，保留一位小数，已调成 ' + w + '%。');
      render();
    }
    function onKey(e) {
      var n = e.target.tagName;
      if (n === 'INPUT' || n === 'SELECT' || n === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); if (S.k < LAST) go(S.k + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); go(S.k - 1); }
    }
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKey);

    loadPreset('screen');
    render();

    return {
      destroy: function () {
        stop();
        root.removeEventListener('click', onClick);
        root.removeEventListener('input', onInput);
        root.removeEventListener('change', onChange);
        root.removeEventListener('keydown', onKey);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  /* ---------- 自测：期望值都先用 python 算过 ---------- */
  function selfTest() {
    var details = [], ok = true;
    function rec(pass, name, exp, got, how) {
      ok = ok && pass;
      details.push((pass ? '通过：' : '失败：') + name + '，期望 ' + exp + '，得到 ' + got + '。核对：' + how);
    }
    function near(name, got, exp, how) { rec(Math.abs(got - exp) < 1e-9, name, exp, got, how); }
    function same(name, got, exp, how) { rec(JSON.stringify(got) === JSON.stringify(exp), name, JSON.stringify(exp), JSON.stringify(got), how); }
    var A = model(0.01, 0.9, 0.91), F = A.F, B = model(0.001, 0.99, 0.99), Sp = model(0.2, 0.4, 0.98);
    near('p=1%、s=90%、t=91% 时 P(病|+)', A.p1, 0.0917431193, 'python 0.9*0.01/(0.9*0.01+0.09*0.99) = 0.009/0.0981 = 0.0917431193');
    near('同一组再独立阳性一次（p′ = 上一次的后验）', A.p2, 0.5025125628, 'python p2=0.9*p1/(0.9*p1+0.09*(1-p1))，p1=0.0917431193，得 0.5025125628');
    near('p=50%、s=90%、t=91% 时 P(病|+)', model(0.5, 0.9, 0.91).p1, 0.9090909091, 'python 0.45/(0.45+0.045) = 0.9090909091');
    near('p=0.1%、s=t=99% 时 P(病|+)', B.p1, 0.0901639344, 'python 0.00099/(0.00099+0.00999) = 0.0901639344');
    same('第一组的自然频数 [病人, TP, FN, FP, TN]', [F.D, F.TP, F.FN, F.FP, F.TN], [10, 9, 1, 89, 901],
      'python 四舍五入（floor(x+0.5)）：1000*0.01=10，10*0.9=9，990*0.09=89.1→89，TN=990-89=901');
    same('第一组复检仍阳性 [TP2, FP2]，频数比例 8/16', [F.TP2, F.FP2, ratio(F.TP2, F.FP2)], [8, 8, 0.5], 'python 9*0.9=8.1→8，89*0.09=8.01→8，8/16=0.5（精确值 0.5025，差别来自取整）');
    near('第一组 P(健康|−)', A.neg, 0.9988912296, 'python 0.91*0.99/(0.91*0.99+0.1*0.01) = 0.9009/0.9019 = 0.9988912296；频数 901/902 = 0.99889');
    same('0.1% 那组的自然频数 [病人, TP, FP]，比例 1/11', [B.F.D, B.F.TP, B.F.FP, ratio(B.F.TP, B.F.FP)], [1, 1, 10, 1 / 11], 'python 1000*0.001=1，1*0.99=0.99→1，999*0.01=9.99→10');
    near('垃圾邮件那组 P(垃圾|含「中奖」)', Sp.p1, 0.8333333333, 'python 0.4*0.2/(0.4*0.2+0.02*0.8) = 0.08/0.096 = 0.8333333333；频数 80/96 也是 5/6');
    // 全概率：P(+)·P(病|+) + P(−)·P(病|−) 必须等于先验 p；s + t > 1 时阳性一定让概率上升
    var seed = 7, bad = 0, i, p, s, t, pp, back;
    function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (i = 0; i < 500; i++) {
      p = 0.001 + rand() * 0.499; s = 0.01 + rand() * 0.99; t = 0.5 + rand() * 0.5;
      pp = s * p + (1 - t) * (1 - p);
      back = pp * bayes(p, s, t) + (1 - pp) * (1 - negPost(p, s, t));
      if (Math.abs(back - p) > 1e-12 || ((s + t > 1) !== (bayes(p, s, t) > p))) bad++;
    }
    same('随机 500 组参数：全概率还原先验，且 s + t > 1 时后验大于先验', bad, 0, 'P(+)P(病|+) + P(−)(1 − P(健康|−)) = p 是恒等式；P(病|+) > p 等价于 s > 1 − t');
    return { ok: ok, details: details };
  }

  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = {
    title: '贝叶斯：基率怎么改变检测结论',
    mount: mount,
    selfTest: selfTest
  };
})();
