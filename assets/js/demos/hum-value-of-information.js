/* 交互演示：信息价值（EVPI 与不完美信息的价值）。纯原生 JS，挂到 window.KGDemos['hum-value-of-information']。 */
(function () {
  'use strict';
  var ID = 'hum-value-of-information', P = 'dm-' + ID + '-', LAST = 4;
  function X(s) { return s.replace(/\bx-/g, P); }

  var LAUNCH = { a: ['上线新功能', '不上线'], s: ['用户需要', '不需要'], test: '小范围实验', pos: '实验说需要', neg: '实验说不需要' };
  function preset(base, o) { var r = {}, k; for (k in base) r[k] = base[k]; for (k in o) r[k] = o[k]; return r; }
  var PRESETS = {
    launch: preset(LAUNCH, { name: '上线新功能（基本例子）', U: [[100, -60], [0, 0]], q: 40, se: 80, sp: 70, c: 10,
      note: '用户需要时上线赚 100，不需要时上线亏 60（开发和维护白花了），不上线什么都不变。' }),
    node: { name: '节点里的例子：70% 赚 10、30% 亏 20', a: ['直接上线', '不上线'], s: ['顺利', '出问题'], test: '灰度试验', pos: '试验顺利', neg: '试验出问题',
      U: [[10, -20], [0, 0]], q: 70, se: 90, sp: 80, c: 1,
      note: '节点「不确定性决策与信息价值」的例子：直接上线的期望值是 0.7×10 − 0.3×20 = 1；花成本 1 做灰度试验，出问题的信号出现时就不上线。' },
    sure: preset(LAUNCH, { name: '已经很有把握：先验 90%', U: [[100, -60], [0, 0]], q: 90, se: 80, sp: 70, c: 10,
      note: '同一个上线决策，只是先验已经是 90%。不管实验结果如何都会上线，实验改变不了决定。' }),
    migrate: { name: '数据库迁移：先压测还是直接迁', a: ['直接迁移', '保持现状'], s: ['新库扛得住', '扛不住'], test: '压测', pos: '压测通过', neg: '压测不通过',
      U: [[50, -200], [0, 0]], q: 85, se: 90, sp: 80, c: 5,
      note: '扛不住时损失很大（长时间故障、难回滚）。先验 85% 看起来乐观，但坏情况太重，压测很值钱。' }
  };
  var SL = [
    { k: 'q', min: 1, max: 99, lab: function (L) { return 'P(' + L.s[0] + ')，先验'; } },
    { k: 'se', min: 50, max: 100, lab: function (L) { return '灵敏度 P(+|' + L.s[0] + ')'; } },
    { k: 'sp', min: 50, max: 100, lab: function (L) { return '特异度 P(−|' + L.s[1] + ')'; } }
  ];
  var STEPS = ['开始前', '直接决定：两个方案的期望值', '完美信息：EVPI', '不完美检测：先实验再决定', '和成本比：值不值得做'];

  /* ---------- 核心计算（不碰 DOM） ---------- */
  // U[行动][状态]；q = P(状态 0)；se = P(+|状态 0)；sp = P(−|状态 1)；c = 实验成本。期望值相同时取行动 0
  function ev(U, q, a) { return q * U[a][0] + (1 - q) * U[a][1]; }
  function pick(e) { return e[0] >= e[1] ? 0 : 1; }
  function tiny(x) { return Math.abs(x) < 1e-9 ? 0 : x; }
  function analyze(U, q, se, sp, c) {
    var e = [ev(U, q, 0), ev(U, q, 1)], b = pick(e), ev0 = e[b];
    var ps = [U[0][0] >= U[1][0] ? 0 : 1, U[0][1] >= U[1][1] ? 0 : 1], evp = q * U[ps[0]][0] + (1 - q) * U[ps[1]][1];
    var res = [[se * q + (1 - sp) * (1 - q), se * q], [(1 - se) * q + sp * (1 - q), (1 - se) * q]].map(function (r) {
      var post = r[0] > 0 ? r[1] / r[0] : q, ee = [ev(U, post, 0), ev(U, post, 1)];
      return { p: r[0], joint: r[1], post: post, ev: ee, best: pick(ee) };
    });
    var evt = res[0].p * res[0].ev[res[0].best] + res[1].p * res[1].ev[res[1].best], voi = tiny(evt - ev0);
    return { ev: e, best: b, tie: tiny(e[0] - e[1]) === 0, ev0: ev0, ps: ps, evp: evp, evpi: tiny(evp - ev0), res: res, evt: evt, voi: voi,
      c: c, net: voi - c, worth: voi > c, changes: res[0].best !== res[1].best };
  }

  /* ---------- 格式 ---------- */
  function n(x) { var v = +x.toFixed(2); return v < 0 ? '−' + (-v) : String(v === 0 ? 0 : v); }
  function par(x) { return +x.toFixed(2) < 0 ? '(' + n(x) + ')' : n(x); }
  function pr(x) { return String(+x.toFixed(3)); }

  /* ---------- 决策树：嵌套列表。方框 = 决策点，圆 = 机会点，三角 = 结果 ---------- */
  var ICON = { d: '<rect x="1.5" y="1.5" width="11" height="11" rx="1"/>', c: '<circle cx="7" cy="7" r="5.5"/>', t: '<path d="M2.5 2 L12 7 L2.5 12 Z"/>' };
  function nd(kind, text) {
    return '<span class="x-nd"><svg class="x-ic x-ic-' + kind + '" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">' + ICON[kind] + '</svg><span>' + text + '</span></span>';
  }
  function ul(kids) {
    return '<ul>' + kids.map(function (k) {
      return '<li class="' + (k.on === true ? 'x-on' : k.on === false ? 'x-off' : '') + '">' + (k.edge ? '<span class="x-ed">' + k.edge + '</span>' : '') + k.html +
        (k.on === true ? '<em class="x-tag x-yes">✓ 选这个</em>' : k.on === false ? '<em class="x-tag">不选</em>' : '') + (k.kids ? ul(k.kids) : '') + '</li>';
    }).join('') + '</ul>';
  }
  function tree(label, root, kids) { return '<div class="x-tree" role="group" aria-label="' + label + '">' + root + ul(kids) + '</div>'; }
  function leaves(L, U, a, q) {
    return [{ edge: L.s[0] + ' ' + pr(q), html: nd('t', n(U[a][0])) }, { edge: L.s[1] + ' ' + pr(1 - q), html: nd('t', n(U[a][1])) }];
  }
  function tree1(L, U, q, R) {
    return tree('决策树：现在就决定', nd('d', '<b>现在就决定</b>'), [0, 1].map(function (a) {
      return { edge: L.a[a], html: nd('c', 'EV = ' + n(R.ev[a])), on: a === R.best, kids: leaves(L, U, a, q) };
    }));
  }
  function tree2(L, U, q, R) {
    return tree('决策树：先知道真实状态', nd('c', '<b>先知道真实状态（完美信息）</b>'), [0, 1].map(function (st) {
      return { edge: L.s[st] + '，概率 ' + pr(st ? 1 - q : q), html: nd('d', '知道是「' + L.s[st] + '」再选'), kids: [0, 1].map(function (a) {
        return { edge: L.a[a], html: nd('t', n(U[a][st])), on: a === R.ps[st] };
      }) };
    }));
  }
  function tree3(L, R) {
    return tree('决策树：先做' + L.test, nd('c', '<b>先做' + L.test + '</b>'), [0, 1].map(function (r) {
      var x = R.res[r];
      return { edge: (r ? L.neg : L.pos) + '，P = ' + pr(x.p), html: nd('d', '再选（P(' + L.s[0] + ') 已变成 ' + pr(x.post) + '）'), kids: [0, 1].map(function (a) {
        return { edge: L.a[a], html: nd('c', 'EV = ' + n(x.ev[a])), on: a === x.best };
      }) };
    }));
  }
  function tree4(L, R) {
    return tree('决策树：要不要先做' + L.test, nd('d', '<b>要不要先做' + L.test + '？</b>'), [
      { edge: '先做，付成本 ' + n(R.c), html: nd('c', 'EV = ' + n(R.evt) + ' − ' + par(R.c) + ' = ' + n(R.evt - R.c)), on: R.worth },
      { edge: '不做，直接选「' + L.a[R.best] + '」', html: nd('c', 'EV = ' + n(R.ev0)), on: !R.worth }
    ]);
  }
  function postTable(L, R) {
    var h = '<div class="x-scroll" tabindex="0" role="region" aria-label="两种实验结果下的后验和期望值"><table class="x-tbl"><thead><tr><th scope="col">实验结果</th><th scope="col">概率</th>' +
      '<th scope="col">P(' + L.s[0] + '|结果)</th><th scope="col">EV(' + L.a[0] + ')</th><th scope="col">EV(' + L.a[1] + ')</th><th scope="col">选</th></tr></thead><tbody>';
    R.res.forEach(function (x, r) {
      h += '<tr><th scope="row">' + (r ? '− ' + L.neg : '+ ' + L.pos) + '</th><td>' + pr(x.p) + '</td><td>' + pr(x.post) + '</td><td>' + n(x.ev[0]) + '</td><td>' + n(x.ev[1]) + '</td><td>' + L.a[x.best] + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ---------- 每一步的说明和算式 ---------- */
  function say(L, V, R, k) {
    var A = L.a, S = L.s, r0 = R.res[0], r1 = R.res[1];
    if (k === 0) return '上面是收益表：每个方案在每种世界状态下的结果。接下来四步依次回答：现在就决定能拿多少？事先知道真相能多拿多少（EVPI）？一个会出错的' + L.test + '能多拿多少？它值不值成本？';
    if (k === 1) return '不收集任何信息，用先验 P(' + S[0] + ') = ' + pr(V.q) + ' 给每个方案算期望值（EV）：「' + A[0] + '」' + n(R.ev[0]) + '，「' + A[1] + '」' + n(R.ev[1]) + '。' +
      (R.tie ? '两个一样好，这里取「' + A[0] + '」。' : '选期望值高的「' + A[R.best] + '」，期望值 ' + n(R.ev0) + '。') + '这是后面比较的基准。';
    if (k === 2) return '假设有人能事先告诉你真实状态：「' + S[0] + '」就选「' + A[R.ps[0]] + '」，「' + S[1] + '」就选「' + A[R.ps[1]] + '」。这样平均能拿 ' + n(R.evp) + '，比直接决定多 ' + n(R.evpi) +
      '，这就是完美信息的期望价值 EVPI。它是任何信息的价值上限：真实的实验会出错，只会更少。' + (R.evpi === 0 ? '这里 EVPI 是 0：不管哪种状态，最好的都是同一个方案，什么信息都帮不上。' : '');
    if (k === 3) return '真实的' + L.test + '会出错（灵敏度 ' + pr(V.se) + '，特异度 ' + pr(V.sp) + '）。先算两种结果各自出现的概率，再用贝叶斯公式把先验 ' + pr(V.q) + ' 更新成后验：「' + L.pos + '」时变成 ' + pr(r0.post) +
      '，「' + L.neg + '」时变成 ' + pr(r1.post) + '。' + (R.changes ? '两种结果下最好的方案不同，' + L.test + '能帮你避开坏选择：平均能拿 ' + n(R.evt) + '，比直接决定多 ' + n(R.voi) + '，这就是不完美信息的价值。' :
      '两种结果下最好的都是「' + A[r0.best] + '」，' + L.test + '改变不了决定，所以信息价值是 0。');
    return '信息价值 ' + n(R.voi) + ' 一定在 0 和 EVPI ' + n(R.evpi) + ' 之间。' + (R.worth ? '它大于成本 ' + n(R.c) + '，值得先做' + L.test + '，扣掉成本还多得 ' + n(R.net) + '。' :
      R.voi === 0 ? L.test + '改变不了决定，花多少成本都不值得，直接选「' + A[R.best] + '」。' : '它不超过成本 ' + n(R.c) + '，不值得做，直接选「' + A[R.best] + '」。') +
      (R.voi > 0 ? '换句话说，成本只要低于 ' + n(R.voi) + ' 就值得做。' : '');
  }
  function evLine(name, q, u0, u1, v) { return name + ' = ' + pr(q) + ' × ' + par(u0) + ' + ' + pr(1 - q) + ' × ' + par(u1) + ' = ' + n(v); }
  function lines(L, V, U, R, k) {
    var A = L.a, S = L.s, out = [];
    if (k === 1) {
      out.push(evLine('EV(' + A[0] + ')', V.q, U[0][0], U[0][1], R.ev[0]), evLine('EV(' + A[1] + ')', V.q, U[1][0], U[1][1], R.ev[1]));
      out.push('最好的期望值 = max(' + n(R.ev[0]) + ', ' + n(R.ev[1]) + ') = <b>' + n(R.ev0) + '</b>，选「' + A[R.best] + '」');
    } else if (k === 2) {
      out.push('「' + S[0] + '」时最好得 ' + n(U[R.ps[0]][0]) + '（' + A[R.ps[0]] + '），「' + S[1] + '」时最好得 ' + n(U[R.ps[1]][1]) + '（' + A[R.ps[1]] + '）');
      out.push(evLine('E[每种状态下的最好收益]', V.q, U[R.ps[0]][0], U[R.ps[1]][1], R.evp));
      out.push('EVPI = ' + n(R.evp) + ' − ' + par(R.ev0) + ' = <b>' + n(R.evpi) + '</b>');
    } else if (k === 3) {
      out.push('+ 表示「' + L.pos + '」，− 表示「' + L.neg + '」');
      out.push('P(+) = ' + pr(V.se) + ' × ' + pr(V.q) + ' + ' + pr(1 - V.sp) + ' × ' + pr(1 - V.q) + ' = ' + pr(R.res[0].p) + '，P(−) = 1 − P(+) = ' + pr(R.res[1].p));
      R.res.forEach(function (x, r) {
        var g = r ? '−' : '+';
        out.push('P(' + S[0] + '|' + g + ') = ' + pr(x.joint) + ' / ' + pr(x.p) + ' = ' + pr(x.post) + '；' + evLine('EV(' + A[0] + '|' + g + ')', x.post, U[0][0], U[0][1], x.ev[0]) +
          '，EV(' + A[1] + '|' + g + ') = ' + n(x.ev[1]) + ' → 选「' + A[x.best] + '」');
      });
      out.push('EV(先' + L.test + '，不算成本) = ' + pr(R.res[0].p) + ' × ' + par(R.res[0].ev[R.res[0].best]) + ' + ' + pr(R.res[1].p) + ' × ' + par(R.res[1].ev[R.res[1].best]) + ' = ' + n(R.evt));
      out.push('不完美信息的价值 = ' + n(R.evt) + ' − ' + par(R.ev0) + ' = <b>' + n(R.voi) + '</b>');
    } else if (k === 4) {
      out.push('0 ≤ 信息价值 ' + n(R.voi) + ' ≤ EVPI ' + n(R.evpi));
      out.push('信息价值 ' + n(R.voi) + (R.worth ? ' > ' : ' ≤ ') + '成本 ' + n(R.c) + ' → ' + (R.worth ? '<b>先做' + L.test + '</b>，净多得 ' + n(R.voi) + ' − ' + par(R.c) + ' = ' + n(R.net) :
        '<b>不做，直接选「' + A[R.best] + '」</b>'));
      out.push('为这个' + L.test + '最多愿意付 ' + n(R.voi) + '；为任何信息最多愿意付 ' + n(R.evpi));
    }
    return out.length ? '<ol class="x-lines">' + out.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' : '';
  }
  function vis(L, V, U, R, k) {
    if (k === 0) return '<p class="x-note">按「下一步」开始。每一步在这里画出决策树，并写出算式。</p>';
    var h = k === 1 ? tree1(L, U, V.q, R) : k === 2 ? tree2(L, U, V.q, R) : k === 3 ? tree3(L, R) + postTable(L, R) : tree4(L, R);
    return h + lines(L, V, U, R, k);
  }
  // 数轴：每行一个期望值；虚线是「直接决定」的期望值，色条是比它多出来的部分，斜纹条表示比它少
  function ladder(L, R, k) {
    if (k === 0) return '<p class="x-note">走到第 1 步以后，这里把每一步得到的期望值画在同一条数轴上。</p>';
    var rows = [['直接决定，不要信息', R.ev0, '']];
    if (k >= 2) rows.push(['完美信息（先知道真相）', R.evp, 'EVPI ' + n(R.evpi)]);
    if (k >= 3) rows.push(['先做' + L.test + '，不算成本', R.evt, '信息价值 ' + n(R.voi)]);
    if (k >= 4) rows.push(['先做' + L.test + '，扣掉成本 ' + n(R.c), R.evt - R.c, '净 ' + n(R.net)]);
    var vals = rows.map(function (r) { return r[1]; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad;
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    function x(v) { return ((v - lo) * 100 / (hi - lo)).toFixed(2); }
    var x0 = +x(R.ev0);
    return '<div class="x-lad">' + rows.map(function (r, i) {
      var xv = +x(r[1]), loss = r[1] < R.ev0 - 1e-9;
      return '<div class="x-lr"><span class="x-ll">' + r[0] + '</span><span class="x-lt" aria-hidden="true">' +
        (i ? '<span class="x-lg' + (loss ? ' x-loss' : '') + '" style="left:' + Math.min(x0, xv) + '%;width:' + Math.abs(xv - x0).toFixed(2) + '%"></span>' : '') +
        '<span class="x-l0" style="left:' + x0 + '%"></span><span class="x-lm" style="left:' + xv + '%"></span></span>' +
        '<span class="x-lv"><b>' + n(r[1]) + '</b>' + (r[2] ? '<small>' + r[2] + '</small>' : '') + '</span></div>';
    }).join('') + '</div><p class="x-note">竖虚线是「直接决定」的期望值；实心色条是比它多出的部分，斜纹条表示比它少。</p>';
  }

  /* ---------- 样式与骨架 ---------- */
  var C = 'var(--c-hum,#6f5b3e)', TX = 'var(--text,#1b1b19)', T2 = 'var(--text-2,#52514e)', T3 = 'var(--text-3,#6b6a66)',
    SF = 'var(--surface,#fff)', S2 = 'var(--surface-2,#f0efec)', BD = 'var(--border,#e2e1dc)', NEG = 'var(--div-pos,#e34948)';
  var CSS =
    '.x-root{color:' + TX + ';font-family:var(--font,sans-serif);font-size:15px;line-height:1.65}' +
    '.x-root *{box-sizing:border-box}' +
    '.x-root p{margin:0 0 8px}' +
    '.x-root h3{margin:0 0 6px;font-size:16px;font-weight:600;line-height:1.4;color:' + TX + '}' +
    '.x-root h3 small{display:block;font-size:13px;font-weight:400;color:' + T2 + '}' +
    '.x-root .x-how,.x-root .x-intro{font-size:14px;color:' + T2 + ';margin-bottom:6px}' +
    '.x-root .x-intro{margin-bottom:12px}' +
    '.x-box{background:' + SF + ';border:1px solid ' + BD + ';border-radius:var(--radius,10px);padding:12px;min-width:0}' +
    '.x-field{display:flex;flex-direction:column;gap:4px;font-size:13px;color:' + T2 + '}' +
    '.x-in{font:inherit;font-size:14px;color:' + TX + ';background:' + SF + ';border:1px solid ' + BD + ';border-radius:8px;padding:6px 8px;min-height:36px;min-width:0;max-width:100%}' +
    '.x-cap{margin:12px 0 4px;font-size:13px;color:' + T2 + '}' +
    '.x-scroll{overflow-x:auto;max-width:100%}' +
    '.x-root .x-tbl{border-collapse:separate;border-spacing:0;font-size:13px;line-height:1.3;margin:0}' +
    '.x-tbl th,.x-tbl td{border-right:1px solid ' + BD + ';border-bottom:1px solid ' + BD + ';padding:5px 8px;text-align:center;font-weight:400;background:' + SF + ';color:' + TX + ';white-space:nowrap}' +
    '.x-tbl tr:first-child>*{border-top:1px solid ' + BD + '}' +
    '.x-tbl tr>:first-child{border-left:1px solid ' + BD + ';text-align:left}' +
    '.x-tbl thead th,.x-tbl tbody th{background:' + S2 + ';color:' + T2 + '}' +
    '.x-tbl td{font-variant-numeric:tabular-nums}' +
    '.x-vis .x-tbl thead th{white-space:normal;min-width:4.5em}' +
    '.x-pv{width:88px;text-align:right}' +
    '.x-pay td{padding:3px 4px}' +
    '.x-sls{display:grid;gap:10px 18px;margin-top:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))}' +
    '.x-sl{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;min-width:0}' +
    '.x-sn{flex:1 1 100%;font-size:13px;color:' + T2 + '}' +
    '.x-range{flex:1 1 90px;min-width:0;margin:6px 0;accent-color:' + C + '}' +
    '.x-num{flex:0 0 76px;width:76px}' +
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
    '.x-now{margin-bottom:12px;border-top:3px solid ' + C + '}' +
    '.x-root .x-say{margin:0;padding:8px 10px;background:' + S2 + ';border-radius:8px;font-size:14px}' +
    '.x-main{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))}' +
    '.x-tree{font-size:14px;line-height:1.5;margin-bottom:10px}' +
    '.x-tree ul{list-style:none;margin:0 0 0 6px;padding:0}' +
    '.x-tree li{position:relative;padding:4px 0 4px 20px}' +
    '.x-tree li::before{content:"";position:absolute;left:0;top:0;bottom:0;border-left:1.5px solid ' + T3 + '}' +
    '.x-tree li:last-child::before{bottom:auto;height:17px}' +
    '.x-tree li::after{content:"";position:absolute;left:0;top:16px;width:16px;border-top:1.5px solid ' + T3 + '}' +
    '.x-tree li.x-on::after{border-top:3px solid ' + C + ';top:15px}' +
    '.x-tree li.x-off::after{border-top-style:dashed}' +
    '.x-ed{color:' + T2 + ';margin-right:6px}' +
    '.x-off>.x-ed,.x-off>.x-nd{color:' + T3 + '}' +
    '.x-nd{display:inline-flex;align-items:center;gap:5px}' +
    '.x-ic{flex:0 0 auto;fill:' + SF + ';stroke:' + T2 + ';stroke-width:1.5}' +
    '.x-on>.x-nd .x-ic{fill:' + C + ';stroke:' + C + '}' +
    '.x-tag{font-style:normal;font-size:12px;margin-left:6px;padding:0 6px;border:1px solid ' + BD + ';border-radius:999px;color:' + T3 + ';white-space:nowrap}' +
    '.x-tag.x-yes{border-color:' + C + ';background:color-mix(in srgb,' + C + ' 14%,' + SF + ');color:' + TX + ';font-weight:600}' +
    '.x-lines{margin:10px 0 0;padding-left:1.4em;font-size:14px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}' +
    '.x-lines li{margin:2px 0}' +
    '.x-lines b{color:' + TX + '}' +
    '.x-vis .x-scroll{margin-top:4px}' +
    '.x-lr{display:grid;grid-template-columns:minmax(0,9em) minmax(70px,1fr) 6.5em;gap:4px 10px;align-items:center;padding:6px 0;border-bottom:1px solid ' + BD + ';font-size:13px}' +
    '.x-ll{color:' + T2 + '}' +
    '.x-lt{position:relative;height:20px;margin:0 8px;background:' + S2 + ';border-radius:4px}' +
    '.x-lg{position:absolute;top:5px;height:10px;background:' + C + ';border-radius:2px}' +
    '.x-lg.x-loss{background:repeating-linear-gradient(135deg,' + NEG + ' 0 3px,transparent 3px 6px)}' +
    '.x-l0{position:absolute;top:-2px;bottom:-2px;border-left:2px dashed ' + T2 + '}' +
    '.x-lm{position:absolute;top:3px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:' + SF + ';border:3px solid ' + TX + '}' +
    '.x-lv{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}' +
    '.x-lv b{font-size:15px}' +
    '.x-lv small{display:block;font-size:12px;color:' + T2 + '}' +
    '.x-root .x-note{margin:8px 0 0;font-size:13px;color:' + T2 + '}';

  function sliderHTML(d) {
    return '<div class="x-sl"><span class="x-sn" data-lab="' + d.k + '"></span>' +
      '<input class="x-range" type="range" min="' + d.min + '" max="' + d.max + '" step="1" data-k="' + d.k + '">' +
      '<input class="x-in x-num" type="number" min="' + d.min + '" max="' + d.max + '" step="1" inputmode="numeric" data-k="' + d.k + '">' +
      '<span class="x-unit">%</span></div>';
  }
  var TPL =
    '<p class="x-how">怎么玩：选一个场景，或者改收益表里的数字、拖动滑块，然后按「下一步」，从「现在就决定」一路算到「先做实验值不值」。决策树里方框是你做选择的地方，圆圈是由世界决定的机会点，三角是最终收益；标「✓ 选这个」的是期望值更高的那一支。</p>' +
    '<p class="x-intro">信息本身不产生收益，它的价值来自可能改变你的选择。完美信息的期望价值（EVPI，expected value of perfect information）是上限；真实的实验会出错，它的价值叫不完美信息的价值（也叫样本信息的期望价值，EVSI），只有大于实验成本才值得做。这里按线性效用算期望值；不可逆的灾难性后果需要另外设硬约束。</p>' +
    '<div class="x-box">' +
    '<label class="x-field">场景<select class="x-in x-preset" aria-label="选择场景">' +
    Object.keys(PRESETS).map(function (id) { return '<option value="' + id + '">' + PRESETS[id].name + '</option>'; }).join('') +
    '<option value="custom">自定义（沿用当前场景的名字）</option></select></label>' +
    '<p class="x-cap">收益表（可以直接改数字，正数是赚，负数是亏）</p><div class="x-scroll x-pay"></div>' +
    '<div class="x-sls">' + SL.map(sliderHTML).join('') +
    '<label class="x-sl"><span class="x-sn x-cl"></span><input class="x-in x-num x-cost" type="number" min="0" max="10000" step="any" data-k="c"></label></div>' +
    '<p class="x-note x-pm"></p>' +
    '<p class="x-msg" aria-live="polite"></p></div>' +
    '<div class="x-bar">' +
    '<button class="x-btn" type="button" data-act="reset" aria-label="重置到开始">重置</button>' +
    '<button class="x-btn" type="button" data-act="prev" aria-label="上一步">上一步</button>' +
    '<button class="x-btn x-pri" type="button" data-act="next" aria-label="下一步">下一步</button>' +
    '<button class="x-btn" type="button" data-act="play" aria-pressed="false" aria-label="自动播放">自动播放</button>' +
    '<span class="x-status"></span></div>' +
    '<section class="x-box x-now" aria-label="现在发生了什么"><h3>现在发生了什么<small class="x-stitle"></small></h3><p class="x-say" aria-live="polite"></p></section>' +
    '<div class="x-main"><section class="x-box x-vis" aria-label="决策树和算式"><h3>决策树和算式</h3><div class="x-vbody"></div></section>' +
    '<section class="x-box x-lbox" aria-label="三个期望值放在一起比"><h3>三个期望值放在一起比</h3><div class="x-lbody"></div></section></div>';

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
      preset: $('.x-preset'), pay: $('.x-pay'), cost: $('.x-cost'), cl: $('.x-cl'), pm: $('.x-pm'), msg: $('.x-msg'), status: $('.x-status'),
      stitle: $('.x-stitle'), say: $('.x-say'), vbody: $('.x-vbody'), lbody: $('.x-lbody'),
      prev: $('[data-act=prev]'), next: $('[data-act=next]'), play: $('[data-act=play]')
    };
    var S = { L: null, U: null, V: null, k: 0, timer: null };
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduce) { el.play.setAttribute('aria-disabled', 'true'); el.play.title = '系统开启了「减少动态效果」，自动播放已关闭'; }
    function inp(kind, k) { return root.querySelector('.' + P + kind + '[data-k=' + k + ']'); }
    function def(k) { for (var i = 0; i < SL.length; i++) if (SL[i].k === k) return SL[i]; }
    function setMsg(t) { el.msg.textContent = t; }

    function payTable() {
      var L = S.L, h = '<table class="x-tbl"><thead><tr><th scope="col">方案 \\ 状态</th><th scope="col">' + L.s[0] + '</th><th scope="col">' + L.s[1] + '</th></tr></thead><tbody>';
      [0, 1].forEach(function (a) {
        h += '<tr><th scope="row">' + L.a[a] + '</th>';
        [0, 1].forEach(function (st) {
          h += '<td><input class="x-in x-pv" type="number" step="any" data-a="' + a + '" data-s="' + st + '" value="' + S.U[a][st] + '" aria-label="' + L.a[a] + '、' + L.s[st] + '时的收益"></td>';
        });
        h += '</tr>';
      });
      el.pay.innerHTML = X(h + '</tbody></table>');
    }
    function labels() {
      SL.forEach(function (d) {
        var lab = d.lab(S.L);
        root.querySelector('[data-lab=' + d.k + ']').textContent = lab;
        inp('range', d.k).setAttribute('aria-label', lab + '，滑块，单位 %');
        inp('num', d.k).setAttribute('aria-label', lab + '，输入百分数');
      });
      el.cl.textContent = S.L.test + '的成本（和收益同一单位）';
      el.cost.setAttribute('aria-label', S.L.test + '的成本');
      el.pm.textContent = '+ 表示「' + S.L.pos + '」，− 表示「' + S.L.neg + '」。';
    }
    function sync() { SL.forEach(function (d) { inp('range', d.k).value = S.V[d.k]; inp('num', d.k).value = S.V[d.k]; }); el.cost.value = S.V.c; }
    function matchPreset() {
      var m = 'custom';
      for (var id in PRESETS) {
        var p = PRESETS[id];
        if (p.a[0] === S.L.a[0] && p.s[0] === S.L.s[0] && JSON.stringify(p.U) === JSON.stringify(S.U) && p.q === S.V.q && p.se === S.V.se && p.sp === S.V.sp && p.c === S.V.c) m = id;
      }
      el.preset.value = m;
      setMsg(m === 'custom' ? '自定义参数。' : PRESETS[m].note);
    }
    function loadPreset(id) {
      var p = PRESETS[id];
      S.L = p; S.U = [p.U[0].slice(), p.U[1].slice()]; S.V = { q: p.q, se: p.se, sp: p.sp, c: p.c };
      el.preset.value = id; payTable(); labels(); sync(); setMsg(p.note);
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
      S.timer = setInterval(function () { go(S.k + 1); if (S.k >= LAST) stop(); }, 2600);
      render();
    }
    function render() {
      var k = S.k, V = { q: S.V.q / 100, se: S.V.se / 100, sp: S.V.sp / 100 }, R = analyze(S.U, V.q, V.se, V.sp, S.V.c);
      el.status.textContent = '第 ' + k + ' / ' + LAST + ' 步：' + STEPS[k] + (k === LAST ? '。已经是最后一步。' : '');
      el.prev.setAttribute('aria-disabled', k === 0 ? 'true' : 'false');
      el.next.setAttribute('aria-disabled', k === LAST ? 'true' : 'false');
      el.stitle.textContent = k ? '第 ' + k + ' 步 · ' + STEPS[k] : '开始前';
      el.say.textContent = say(S.L, V, R, k);
      el.vbody.innerHTML = X(vis(S.L, V, S.U, R, k));
      el.lbody.innerHTML = X(ladder(S.L, R, k));
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
    // 输入框还没打完（空、负号、超出范围）时先不动，等 change 再纠正
    function onInput(e) {
      var tg = e.target, v = parseFloat(tg.value), k = tg.getAttribute && tg.getAttribute('data-k'), d;
      if (tg.hasAttribute && tg.hasAttribute('data-a')) {
        if (!isFinite(v) || Math.abs(v) > 10000) return;
        S.U[+tg.getAttribute('data-a')][+tg.getAttribute('data-s')] = v;
      } else if (k === 'c') {
        if (!isFinite(v) || v < 0 || v > 10000) return;
        S.V.c = v;
      } else if (k) {
        d = def(k);
        if (!isFinite(v) || v < d.min || v > d.max) return;
        S.V[k] = Math.round(v);
        if (tg.type === 'range') inp('num', k).value = S.V[k]; else inp('range', k).value = S.V[k];
      } else return;
      matchPreset(); render();
    }
    function onChange(e) {
      var tg = e.target, v = parseFloat(tg.value), k = tg.getAttribute('data-k'), d, w;
      if (tg === el.preset) {
        if (el.preset.value === 'custom') { setMsg('改收益表或拖动滑块，名字沿用当前场景。'); return; }
        loadPreset(el.preset.value); render(); return;
      }
      if (tg.type !== 'number') return;
      var msg;
      if (tg.hasAttribute('data-a')) {
        var a = +tg.getAttribute('data-a'), st = +tg.getAttribute('data-s');
        w = isFinite(v) ? Math.max(-10000, Math.min(10000, v)) : S.U[a][st];
        S.U[a][st] = w; tg.value = w;
        msg = '收益要在 −10000 到 10000 之间，已调成 ' + w + '。';
      } else if (k === 'c') {
        w = isFinite(v) ? Math.max(0, Math.min(10000, v)) : S.V.c;
        S.V.c = w; tg.value = w;
        msg = '成本要在 0 到 10000 之间，已调成 ' + w + '。';
      } else {
        d = def(k);
        w = isFinite(v) ? Math.round(Math.max(d.min, Math.min(d.max, v))) : S.V[k];
        S.V[k] = w; sync();
        msg = d.lab(S.L) + ' 的范围是 ' + d.min + '%–' + d.max + '% 的整数，已调成 ' + w + '%。';
      }
      matchPreset();
      if (w !== v) setMsg(msg);
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

    loadPreset('launch');
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
    function near(name, got, exp, how) {
      var g = [].concat(got), x = [].concat(exp), pass = g.length === x.length;
      for (var i = 0; pass && i < g.length; i++) pass = typeof x[i] === 'number' ? Math.abs(g[i] - x[i]) < 1e-9 : g[i] === x[i];
      rec(pass, name, JSON.stringify(exp), JSON.stringify(got.map ? got.map(function (v) { return typeof v === 'number' ? +v.toFixed(10) : v; }) : got), how);
    }
    var U = [[100, -60], [0, 0]], A = analyze(U, 0.4, 0.8, 0.7, 10), r0 = A.res[0], r1 = A.res[1];
    near('上线 +100/−60、不上线 0/0、先验 0.4：[EV(上线), EV(不上线), 选哪个]', [A.ev[0], A.ev[1], A.best], [4, 0, 0], 'python 0.4*100+0.6*(-60)=4，0.4*0+0.6*0=0，选上线');
    near('同上：EVPI', [A.evp, A.evpi], [40, 36], 'python 完美信息 0.4*max(100,0)+0.6*max(-60,0)=40，40-4=36');
    near('灵敏度 0.8、特异度 0.7：[P(+), P(需要|+), EV(上线|+), 选]', [r0.p, r0.post, r0.ev[0], r0.best], [0.5, 0.64, 42.4, 0],
      'python P(+)=0.8*0.4+0.3*0.6=0.5，0.32/0.5=0.64，0.64*100+0.36*(-60)=42.4，选上线');
    near('同上：[P(−), P(需要|−), EV(上线|−), 选]', [r1.p, r1.post, r1.ev[0], r1.best], [0.5, 0.16, -34.4, 1],
      'python P(−)=0.2*0.4+0.7*0.6=0.5，0.08/0.5=0.16，0.16*100+0.84*(-60)=-34.4 < 0，选不上线');
    near('同上：[先实验的期望值, 不完美信息的价值, 扣成本 10 后的净值, 值不值]', [A.evt, A.voi, A.net, A.worth], [21.2, 17.2, 7.2, true],
      'python 0.5*42.4+0.5*0=21.2，21.2-4=17.2，17.2-10=7.2');
    near('成本 20 时不值得做', [analyze(U, 0.4, 0.8, 0.7, 20).worth], [false], '17.2 ≤ 20');
    var B = analyze(U, 0.9, 0.8, 0.7, 10);
    near('先验 0.9：两种结果都选上线，[改变决定吗, 信息价值, EVPI]', [B.changes, B.voi, B.evpi], [false, 0, 6],
      'python EV(上线|+)=0.96*100-0.04*60=93.6，EV(上线|−)=0.72*100-0.28*60=55.2，都 > 0；先实验 0.75*93.6+0.25*55.2=84=EV0；EVPI=0.1*60=6');
    near('完美的实验（灵敏度 = 特异度 = 1）：信息价值等于 EVPI', [analyze(U, 0.4, 1, 1, 0).voi], [36], 'python 0.4*100+0.6*0-4=36');
    var Nd = analyze([[10, -20], [0, 0]], 0.7, 0.9, 0.8, 1);
    near('节点例子 70% 赚 10、30% 亏 20，灵敏度 0.9、特异度 0.8：[EV0, EVPI, 先实验, 信息价值]', [Nd.ev0, Nd.evpi, Nd.evt, Nd.voi], [1, 6, 5.1, 4.1],
      'python 0.7*10-0.3*20=1，0.3*20=6，P(+)=0.69、EV(上线|+)=7.3913，0.69*7.3913=5.1，5.1-1=4.1');
    var seed = 11, bad = 0, i, R;
    function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    function pay() { return Math.round(rand() * 400 - 200); }
    for (i = 0; i < 2000; i++) {
      R = analyze([[pay(), pay()], [pay(), pay()]], 0.01 + rand() * 0.98, 0.5 + rand() * 0.5, 0.5 + rand() * 0.5, 0);
      if (R.voi < -1e-9 || R.voi > R.evpi + 1e-9 || (R.voi > 1e-9 && !R.changes)) bad++;
    }
    near('随机 2000 组收益、先验、灵敏度、特异度：违反 0 ≤ 信息价值 ≤ EVPI 的组数', [bad], [0], '信息价值 > 0 时两种结果下的最优方案一定不同；python 用同样的随机扫描复核');
    return { ok: ok, details: details };
  }

  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = {
    title: '信息价值：先做实验还是直接决定',
    mount: mount,
    selfTest: selfTest
  };
})();
