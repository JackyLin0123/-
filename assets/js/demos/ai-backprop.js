/* 交互演示 ai-backprop：反向传播，在计算图上用链式法则。
   计算图：p1 = w1·x1，p2 = w2·x2，z = p1 + p2 + b，a = σ(z)，d = a − y，q = d²，L = ½·q */
(function () {
  'use strict';
  var ID = 'ai-backprop', C = 'dm-ai-backprop-';
  var P0 = { x1: 1, x2: 2, w1: 0.5, w2: -0.3, b: 0.1, y: 1 };
  var ETA0 = 0.5, EPS = 1e-4, MINUS = '−';

  /* 计算核心（不碰 DOM） */
  function sigmoid(z) {
    if (z >= 0) return 1 / (1 + Math.exp(-z));
    var e = Math.exp(z);
    return e / (1 + e);
  }
  function clone(o) { var r = {}, k; for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function forward(P) {
    var v = clone(P);
    v.p1 = P.w1 * P.x1;
    v.p2 = P.w2 * P.x2;
    v.z = v.p1 + v.p2 + P.b;
    v.a = sigmoid(v.z);
    v.d = v.a - P.y;
    v.q = v.d * v.d;
    v.L = 0.5 * v.q;
    return v;
  }
  // 梯度 = 局部导数 × 上游梯度
  function backward(v) {
    var g = { L: 1 };
    g.q = 0.5 * g.L;                 // L = ½q
    g.d = 2 * v.d * g.q;             // q = d²
    g.a = 1 * g.d;                   // d = a − y
    g.y = -1 * g.d;
    g.z = v.a * (1 - v.a) * g.a;     // a = σ(z)，σ′(z) = σ(z)(1 − σ(z))
    g.p1 = g.z; g.p2 = g.z; g.b = g.z;          // z = p1 + p2 + b
    g.w1 = v.x1 * g.p1; g.x1 = v.w1 * g.p1;     // p1 = w1·x1
    g.w2 = v.x2 * g.p2; g.x2 = v.w2 * g.p2;     // p2 = w2·x2
    return g;
  }
  function lossOf(P) { return forward(P).L; }
  function numGrad(P, k, eps) {
    var hi = clone(P), lo = clone(P);
    hi[k] += eps; lo[k] -= eps;
    var Lh = lossOf(hi), Ll = lossOf(lo);
    return { g: (Lh - Ll) / (2 * eps), Lh: Lh, Ll: Ll };
  }
  function relErr(a, b) {
    var m = Math.max(Math.abs(a), Math.abs(b));
    return m === 0 ? 0 : Math.abs(a - b) / m;
  }
  function sgdStep(P, g, eta) {
    var n = clone(P);
    n.w1 = P.w1 - eta * g.w1;
    n.w2 = P.w2 - eta * g.w2;
    n.b = P.b - eta * g.b;
    return n;
  }
  // 相对误差 ≥ 1e-6 时另用 ε/10、ε×10 重算，区分截断误差和舍入误差
  function checkRows(P) {
    var g = backward(forward(P));
    return ['w1', 'w2', 'b'].map(function (k) {
      var n = numGrad(P, k, EPS), r = { k: k, a: g[k], n: n.g, e: relErr(g[k], n.g), Lh: n.Lh, Ll: n.Ll };
      r.tiny = Math.max(Math.abs(r.a), Math.abs(r.n)) < 1e-8;
      if (!r.tiny && r.e >= 1e-6) { r.s = relErr(g[k], numGrad(P, k, EPS / 10).g); r.b = relErr(g[k], numGrad(P, k, EPS * 10).g); }
      return r;
    });
  }

  /* 数字格式 */
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function sci(x, d) {
    if (x === 0) return '0';
    var p = x.toExponential(d).split('e');
    return p[0].replace('-', MINUS) + '×10' + String(+p[1]).replace(/[0-9-]/g, function (c) { return SUP[c]; });
  }
  function fmt(x) {
    if (typeof x !== 'number' || isNaN(x)) return '?';
    if (!isFinite(x)) return (x < 0 ? MINUS : '') + '∞';
    var ax = Math.abs(x);
    if (ax < 1e-12) return '0';
    if (ax < 5e-5 || ax >= 1e6) return sci(x, 2);
    var s = x.toFixed(4).replace(/\.?0+$/, '');
    return s === '-0' ? '0' : s.replace('-', MINUS);
  }
  function fx(x, n) { var s = x.toFixed(n); return (/^-0\.?0*$/.test(s) ? s.slice(1) : s).replace('-', MINUS); }
  function par(x) { var s = fmt(x); return s.charAt(0) === MINUS ? '(' + s + ')' : s; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* 计算图的结构 */
  var NODE = {
    x1: { leaf: '输入' }, w1: { leaf: '参数' }, x2: { leaf: '输入' }, w2: { leaf: '参数' }, b: { leaf: '参数' }, y: { leaf: '标签' },
    p1: { sym: '×', head: 'p1 = w1·x1', ins: ['w1', 'x1'] },
    p2: { sym: '×', head: 'p2 = w2·x2', ins: ['w2', 'x2'] },
    z: { sym: '+', head: 'z = p1+p2+b', ins: ['p1', 'p2', 'b'] },
    a: { sym: 'σ', head: 'a = σ(z)', ins: ['z'] },
    d: { sym: '−', head: 'd = a − y', ins: ['a', 'y'] },
    q: { sym: '平方', head: 'q = d²', ins: ['d'] },
    L: { sym: '×½', head: 'L = ½·q', ins: ['q'] }
  };
  var IDS = ['x1', 'w1', 'x2', 'w2', 'b', 'y', 'p1', 'p2', 'z', 'a', 'd', 'q', 'L'];
  var OUT = {};
  IDS.forEach(function (id) { (NODE[id].ins || []).forEach(function (s) { OUT[s] = id; }); });
  var FWD = ['p1', 'p2', 'z', 'a', 'd', 'q', 'L'];
  var BWD = [['L'], ['q'], ['d'], ['a', 'y'], ['z'], ['p1', 'p2', 'b'], ['w1', 'x1'], ['w2', 'x2']];
  var NF = FWD.length, LAST = 1 + NF + BWD.length; // 0 准备，1–7 前向，8–15 反向，16 汇总

  function valKnown(id, s) { return !!NODE[id].leaf || FWD.indexOf(id) < s; }
  function gradKnown(id, s) {
    for (var j = 0; j < BWD.length; j++) if (BWD[j].indexOf(id) >= 0) return s >= NF + 1 + j;
    return false;
  }

  /* 每一步的说明（带具体数字） */
  function chip(c, t, r) { return { c: c, t: t, r: !!r }; }
  function buildSteps(v, g) {
    var f = fmt, p = par, S = [];
    S.push({ title: '还没开始计算',
      text: '训练时要知道：损失 L 对每个参数的导数是多少，也就是每个参数该往哪边调、调多少。反向传播就是在计算图（computational graph）上从 L 往回走一遍，把这些导数全部算出来。图里 x1、x2 是输入数据，w1、w2、b 是要学习的参数（parameter），y 是正确答案，叫标签（label）。按「下一步」开始前向传播。' });
    function F(id, title, text, sub, extra) {
      var row = [chip('运算', NODE[id].head), '=', chip('代入数字', sub)];
      if (extra) row.push('=', chip('先算指数', extra));
      row.push('=', chip('结果', id + ' = ' + f(v[id]), 1));
      S.push({ act: [id], title: title, text: text, eqs: [row] });
    }
    F('p1', '乘法节点：p1 = w1 · x1', '前向传播沿着箭头方向，用已经知道的数算出下一个节点的值。第一个乘法节点把参数 w1 和输入 x1 相乘。',
      f(v.w1) + ' × ' + p(v.x1));
    F('p2', '乘法节点：p2 = w2 · x2', '第二个乘法节点做同样的事：参数 w2 乘输入 x2。', f(v.w2) + ' × ' + p(v.x2));
    F('z', '加法节点：z = p1 + p2 + b', '加法节点把两个乘积和偏置（bias）b 加起来，得到加权和 z。',
      f(v.p1) + ' + ' + p(v.p2) + ' + ' + p(v.b));
    F('a', 'σ 节点：a = σ(z)', 'σ 是 sigmoid 函数，σ(z) = 1 / (1 + e^(−z))，它把任意实数压到 0 和 1 之间。a 就是模型给出的预测。',
      '1 / (1 + e^(' + f(-v.z) + '))', '1 / (1 + ' + f(Math.exp(-v.z)) + ')');
    var ds = f(v.d);
    F('d', '减法节点：d = a − y', '减法节点算预测和正确答案差多少。d = ' + ds + '，说明' +
      (ds === '0' ? '预测正好等于正确答案。' : (v.d < 0 ? '预测比正确答案小。' : '预测比正确答案大。')),
      f(v.a) + ' − ' + p(v.y));
    F('q', '平方节点：q = d²', '平方让误差变成非负数，预测偏大或偏小都会产生损失。', p(v.d) + '²');
    F('L', '×½ 节点：L = ½ · q', '乘 ½ 得到损失 L，前向传播到这里结束。乘 ½ 是为了求导时和平方带出来的 2 抵消。',
      '0.5 × ' + p(v.q));

    S.push({ act: ['L'], title: '反向传播的起点：∂L/∂L = 1',
      text: '反向传播从 L 往回走，L 对自己的导数是 1。之后每一步都用链式法则（chain rule）：这个节点的梯度 = 局部导数（local derivative）× 上游梯度（upstream gradient）。局部导数只看紧挨着的那一个运算；梯度从 L 往回流，上游梯度就是这个节点的输出所连的那个节点（离 L 更近）已经算好的梯度。这张图里每个输出只连到一个节点；如果连到好几个，要把每条路传回来的乘积加起来。',
      eqs: [[chip('起点', '∂L/∂L = 1', 1)]], raw: [] });
    // l = [局部导数式, 值, 上游梯度式, 值, 节点]
    function B(act, title, text, lines) {
      S.push({ act: act, title: title, text: text,
        eqs: lines.map(function (l) {
          return [chip('局部导数', l[0] + ' = ' + f(l[1])), '×', chip('上游梯度', l[2] + ' = ' + f(l[3])), '=',
            chip('这个节点的梯度', '∂L/∂' + l[4] + ' = ' + f(g[l[4]]), 1)];
        }),
        raw: lines.map(function (l) { return { loc: l[1], up: l[3], res: g[l[4]] }; }) });
    }
    B(['q'], '×½ 节点 → q', 'L = ½ · q，L 对 q 的局部导数是 ½。上游梯度是 ∂L/∂L = 1，所以 q 的梯度就等于这个局部导数。',
      [['∂L/∂q = ½', 0.5, '∂L/∂L', g.L, 'q']]);
    B(['d'], '平方节点 → d', 'q = d²，对 d 的局部导数是 2d，代入前向算好的 d = ' + f(v.d) + '。',
      [['∂q/∂d = 2d = 2 × ' + p(v.d), 2 * v.d, '∂L/∂q', g.q, 'd']]);
    B(['a', 'y'], '减法节点 → a 和 y', 'd = a − y 有两个输入，分开算：对 a 的局部导数是 1，对 y 的局部导数是 −1。y 是标签，训练时不改它，这里只是顺带算出它的梯度。',
      [['∂d/∂a', 1, '∂L/∂d', g.d, 'a'], ['∂d/∂y', -1, '∂L/∂d', g.d, 'y']]);
    var sp = v.a * (1 - v.a);
    B(['z'], 'σ 节点 → z', 'σ 的导数可以用它自己的输出来写：σ′(z) = σ(z)(1 − σ(z))。σ(z) 就是前向算好的 a = ' + f(v.a) + '，直接代入，不用再算一次指数。' +
      (sp < 0.01 ? '这里 a 已经很接近 ' + (v.a > 0.5 ? 1 : 0) + '，σ 进入了饱和区（saturation），σ′(z) ' + (sp ? '只有 ' + f(sp) : '小到在浮点数里成了 0') +
      '，上游梯度乘上它就几乎没了，再往回传的梯度都很小。这就是 sigmoid 容易造成梯度消失（vanishing gradient）的原因。' : ''),
      [['σ′(z) = a(1 − a) = ' + f(v.a) + ' × (1 − ' + f(v.a) + ')', sp, '∂L/∂a', g.a, 'z']]);
    B(['p1', 'p2', 'b'], '加法节点 → p1、p2、b', 'z = p1 + p2 + b 对每一项的局部导数都是 1，所以加法节点把上游梯度原样传给三个输入：每个输入拿到的都是完整的 ∂L/∂z，不是三等分。',
      [['∂z/∂p1', 1, '∂L/∂z', g.z, 'p1'], ['∂z/∂p2', 1, '∂L/∂z', g.z, 'p2'], ['∂z/∂b', 1, '∂L/∂z', g.z, 'b']]);
    B(['w1', 'x1'], '乘法节点 → w1 和 x1', 'p1 = w1 · x1。乘法对一个输入的局部导数，等于另一个输入的值：∂p1/∂w1 = x1，∂p1/∂x1 = w1。',
      [['∂p1/∂w1 = x1', v.x1, '∂L/∂p1', g.p1, 'w1'], ['∂p1/∂x1 = w1', v.w1, '∂L/∂p1', g.p1, 'x1']]);
    B(['w2', 'x2'], '乘法节点 → w2 和 x2', '规则同上：∂p2/∂w2 = x2，∂p2/∂x2 = w2。到这一步，图里每个节点的梯度都填好了。',
      [['∂p2/∂w2 = x2', v.x2, '∂L/∂p2', g.p2, 'w2'], ['∂p2/∂x2 = w2', v.w2, '∂L/∂p2', g.p2, 'x2']]);

    var up = [], dn = [];
    ['w1', 'w2', 'b'].forEach(function (k) { var s = f(g[k]); if (s.charAt(0) === MINUS) up.push(k); else if (s !== '0') dn.push(k); });
    var t = '要更新的是参数 w1、w2、b。';
    if (up.length) t += '梯度为负的参数（' + up.join('、') + '）调大一点，L 会变小。';
    if (dn.length) t += '梯度为正的参数（' + dn.join('、') + '）调小一点，L 会变小。';
    if (!up.length && !dn.length) t += '三个梯度都是 0，更新不会改变参数' + (f(v.L) === '0' ? '。' : '。L 不是 0，梯度却是 0，是因为 σ 饱和了（见第 12 步）。');
    t += 'x1、x2 的梯度也算出来了，但它们是数据，不更新；在多层网络里，这个梯度会继续传给前一层。下面可以按学习率 η 更新一次参数，或者做数值梯度检查。';
    S.push({ act: ['w1', 'w2', 'b'], title: '反向传播完成', text: t, raw: [],
      eqs: [[chip('参数 w1', '∂L/∂w1 = ' + f(g.w1), 1), chip('参数 w2', '∂L/∂w2 = ' + f(g.w2), 1), chip('参数 b', '∂L/∂b = ' + f(g.b), 1)]] });
    return S;
  }
  function phaseTag(s) {
    if (s === 0) return '准备';
    if (s <= NF) return '前向传播 · 第 ' + s + ' / ' + NF + ' 步';
    if (s < LAST) return '反向传播 · 第 ' + (s - NF) + ' / ' + BWD.length + ' 步';
    return '汇总';
  }

  /* 样式（~ 会被换成类名前缀） */
  var A = 'var(--c-ai,#4a3aa7)', SF = 'var(--surface,#fff)', S2 = 'var(--surface-2,#f0efec)', BD = 'var(--border,#e2e1dc)',
    T1 = 'var(--text,#1b1b19)', T2 = 'var(--text-2,#52514e)', T3 = 'var(--text-3,#6b6a66)', MO = 'var(--mono,monospace)',
    ES = 'var(--edge-strong,#6f6e69)', EG = 'var(--edge,#c4c3bd)';
  var CSS = [
    '.~root{font-family:var(--font,sans-serif);color:' + T1 + ';font-size:15px;line-height:1.65}',
    '.~root *{box-sizing:border-box}',
    '.~root :focus-visible{outline:2px solid var(--focus,#2457b3);outline-offset:2px}',
    '.~how{margin:0 0 8px;color:' + T2 + '}', '.~how b{color:' + T1 + '}',
    '.~model{margin:0 0 12px;padding:6px 10px;border-radius:8px;background:' + S2 + ';font:13.5px/1.6 ' + MO + ';overflow-wrap:anywhere}',
    '.~inputs{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px 10px;align-items:end;margin:0 0 12px}',
    '.~field{display:flex;flex-direction:column;gap:2px;font-size:13px;color:' + T2 + ';min-width:0}',
    '.~field b{color:' + T1 + ';font-family:' + MO + '}',
    '.~field input{width:100%;min-width:0;font:15px ' + MO + ';color:' + T1 + ';background:' + SF + ';border:1px solid ' + BD + ';border-radius:6px;padding:5px 7px}',
    '.~field input::-webkit-inner-spin-button,.~field input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}', '.~field input{-moz-appearance:textfield;appearance:textfield}',
    '.~field input[aria-invalid=true]{border-color:var(--div-pos,#e34948);box-shadow:0 0 0 1px var(--div-pos,#e34948)}',
    '.~inputs .~btn{grid-column:span 2;justify-self:start;white-space:nowrap}',
    '.~btn{font:inherit;font-size:14px;line-height:1.2;padding:7px 14px;min-height:36px;border-radius:8px;border:1px solid ' + BD + ';background:' + SF + ';color:' + T1 + ';cursor:pointer}',
    '.~btn:hover:not(:disabled){background:' + S2 + '}',
    '.~btn:disabled{opacity:.45;cursor:not-allowed}',
    '.~pri{border-color:' + A + ';background:color-mix(in srgb,' + A + ' 12%,' + SF + ')}',
    '.~pri:hover:not(:disabled){background:color-mix(in srgb,' + A + ' 22%,' + SF + ')}',
    '.~bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 10px}',
    '.~steps{display:flex;align-items:center;gap:8px;flex:1 1 200px;font-size:13px;color:' + T2 + ';white-space:nowrap}',
    '.~steps input{flex:1;min-width:60px;accent-color:' + A + '}',
    '.~explain{border:1px solid ' + BD + ';border-left:4px solid ' + A + ';border-radius:var(--radius,10px);background:' + SF + ';padding:10px 14px;margin:0 0 12px;min-height:11em}',
    '.~tag{font-size:12.5px;color:' + T3 + '}', '.~title{font-weight:600;margin:2px 0 4px}',
    '.~note{margin:0 0 6px;padding:4px 8px;border-radius:6px;background:' + S2 + ';font-size:14px}',
    '.~text{margin:0 0 4px}',
    '.~eq{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:6px 0 0}',
    '.~grp{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%}',
    '.~chip{display:inline-flex;flex-direction:column;padding:3px 9px;border-radius:7px;background:' + S2 + ';max-width:100%}',
    '.~chip small{font-size:11.5px;color:' + T3 + ';line-height:1.4}',
    '.~chip span{font:13.5px/1.5 ' + MO + ';overflow-wrap:anywhere}',
    '.~res{background:color-mix(in srgb,' + A + ' 15%,' + SF + ');box-shadow:inset 0 0 0 1px color-mix(in srgb,' + A + ' 45%,transparent)}',
    '.~op{font:15px ' + MO + ';color:' + T2 + '}',
    '.~legend{font-size:12.5px;color:' + T3 + ';margin:0 0 6px}',
    '.~graph svg{display:block;width:100%;height:auto;margin:0 auto}',
    '.~card{fill:' + SF + '}',
    '.~frame{fill:none;stroke:' + ES + ';stroke-width:1.2}',
    '.~pend .~frame{stroke:' + EG + ';stroke-dasharray:4 3}',
    '.~act .~frame{stroke:' + A + ';stroke-width:2.6;stroke-dasharray:none}',
    '.~halo{fill:none;stroke:' + A + ';stroke-opacity:.22;stroke-width:6}',
    '.~strip{fill:color-mix(in srgb,' + A + ' 20%,' + SF + ')}',
    '.~sym{fill:' + T1 + ';font-weight:600;text-anchor:middle}',
    '.~head{fill:' + T2 + ';font-size:11px;text-anchor:middle}',
    '.~nm{fill:' + T1 + ';font-weight:600;font-family:' + MO + '}',
    '.~val{fill:' + T1 + ';font:600 15px ' + MO + ';text-anchor:middle}',
    '.~gv{fill:' + T1 + ';font:600 13px ' + MO + ';text-anchor:middle}',
    '.~val.~q,.~gv.~q{fill:' + T3 + ';font-weight:400}',
    '.~band{fill:color-mix(in srgb,' + A + ' 15%,' + SF + ')}',
    '.~band.~empty{fill:none;stroke:' + EG + ';stroke-dasharray:3 3}',
    '.~cap{fill:' + T2 + ';font-size:10.5px;text-anchor:middle}',
    '.~edge{stroke:' + ES + ';stroke-width:1.4;fill:none}', '.~ah{fill:' + ES + '}',
    '.~edge.~on{stroke:' + A + ';stroke-width:2.6}', '.~ah.~on{fill:' + A + '}',
    '.~back{stroke:' + A + ';stroke-width:2.2;stroke-dasharray:5 4;fill:none}', '.~bh{fill:' + A + '}',
    '.~results{margin-top:14px;padding-top:12px;border-top:1px solid ' + BD + '}',
    '.~rhead{font-weight:600;margin:0 0 6px}',
    '.~grads{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}',
    '.~ctrl{display:flex;flex-wrap:wrap;align-items:end;gap:8px 10px}', '.~ctrl .~field{width:104px}',
    '.~hint{font-size:13px;color:' + T3 + ';margin:6px 0 0}',
    '.~box{margin-top:12px;padding:10px 12px;border-radius:var(--radius,10px);background:' + SF + ';border:1px solid ' + BD + '}',
    '.~box p{margin:6px 0}', '.~sub{font-weight:600}',
    '.~list{margin:6px 0;padding-left:1.2em;font:13.5px/1.7 ' + MO + ';overflow-wrap:anywhere}',
    '.~tw{overflow-x:auto;max-width:100%}',
    '.~tbl{border-collapse:collapse;font-size:13px;margin:6px 0;min-width:100%}',
    '.~tbl th,.~tbl td{border-bottom:1px solid ' + BD + ';padding:5px 8px;text-align:right;white-space:nowrap}',
    '.~tbl thead th{background:' + S2 + ';font-weight:600}', '.~tbl thead th:first-child{text-align:left}',
    '.~tbl th[scope=row]{text-align:left;font-family:' + MO + '}', '.~tbl td{font-family:' + MO + '}',
    '@media (prefers-reduced-motion:no-preference){.~frame,.~edge{transition:stroke .2s}}'
  ].join('\n');
  function injectStyle() {
    if (document.getElementById('dm-style-' + ID)) return;
    var el = document.createElement('style');
    el.id = 'dm-style-' + ID;
    el.textContent = CSS.replace(/~/g, C);
    document.head.appendChild(el);
  }

  /* 两种布局：宽屏横向流动，窄屏纵向折返 */
  var CH = 90; // 卡片高；lw、ow 是叶子节点和运算节点的宽
  var LAYOUT = {
    wide: { W: 650, H: 524, max: 680, lw: 84, ow: 96, pos: {
      x1: [52, 50], w1: [52, 152], x2: [52, 266], w2: [52, 368],
      p1: [184, 101], b: [184, 209], p2: [184, 317],
      z: [320, 209], a: [456, 209], d: [592, 209], y: [592, 62], q: [592, 339], L: [592, 469] } },
    narrow: { W: 344, H: 604, max: 440, lw: 76, ow: 92, pos: {
      x1: [42, 50], w1: [124, 50], x2: [220, 50], w2: [302, 50],
      p1: [83, 176], p2: [261, 176],
      b: [48, 302], z: [172, 302], y: [294, 302],
      a: [50, 428], d: [172, 428], q: [294, 428], L: [294, 554] } }
  };
  function r1(n) { return Math.round(n * 10) / 10; }
  function hw(lay, id) { return (NODE[id].leaf ? lay.lw : lay.ow) / 2 + 3; }
  // 从中心偏移 (nx,ny) 的点沿 (dx,dy) 走出方框需要的参数 t
  function exitT(nx, ny, dx, dy, w, h) {
    var t = Infinity;
    if (dx) t = Math.min(t, ((dx > 0 ? w : -w) - nx) / dx);
    if (dy) t = Math.min(t, ((dy > 0 ? h : -h) - ny) / dy);
    return t;
  }
  function seg(lay, s, t, off) {
    var a = lay.pos[s], b = lay.pos[t], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy);
    var nx = -dy / len * off, ny = dx / len * off, h = CH / 2 + 3;
    var t0 = exitT(nx, ny, dx, dy, hw(lay, s), h), t1 = exitT(nx, ny, -dx, -dy, hw(lay, t), h);
    return { x0: a[0] + nx + dx * t0, y0: a[1] + ny + dy * t0, x1: b[0] + nx - dx * t1, y1: b[1] + ny - dy * t1, ux: dx / len, uy: dy / len };
  }
  function arrowHead(x, y, ux, uy, cls) {
    var bx = x - ux * 8, by = y - uy * 8, w = 4.5;
    return '<path class="' + cls + '" d="M' + r1(x) + ',' + r1(y) + 'L' + r1(bx - uy * w) + ',' + r1(by + ux * w) +
      'L' + r1(bx + uy * w) + ',' + r1(by - ux * w) + 'Z"/>';
  }
  function line(x0, y0, x1, y1, cls) {
    return '<line class="' + cls + '" x1="' + r1(x0) + '" y1="' + r1(y0) + '" x2="' + r1(x1) + '" y2="' + r1(y1) + '"/>';
  }
  function fit(t, fs, room) { // 放不下就缩小字号，并压到 room 宽
    var w = t.length * fs * 0.6;
    return w <= room ? '' : ' style="font-size:' + r1(fs * room / w) + 'px" textLength="' + room + '" lengthAdjust="spacingAndGlyphs"';
  }
  function cardSvg(lay, id, x, y, o) {
    var nd = NODE[id], w = nd.leaf ? lay.lw : lay.ow, cx = nd.leaf ? w / 2 : 20 + (w - 20) / 2, bx = nd.leaf ? 6 : 25;
    var s = '<g class="~node' + (o.act ? ' ~act' : '') + (o.val ? '' : ' ~pend') + '" transform="translate(' + (x - w / 2) + ',' + (y - CH / 2) + ')">';
    if (o.act) s += '<rect class="~halo" x="-4" y="-4" width="' + (w + 8) + '" height="' + (CH + 8) + '" rx="11"/>';
    s += '<rect class="~card" width="' + w + '" height="' + CH + '" rx="8"/>';
    if (!nd.leaf) {
      s += '<path class="~strip" d="M8,0H20V' + CH + 'H8A8,8 0 0 1 0,' + (CH - 8) + 'V8A8,8 0 0 1 8,0Z"/>';
      if (nd.sym.length > 1) s += '<text class="~sym" font-size="13" x="10" y="' + (CH / 2 - 3) + '">' + nd.sym.charAt(0) + '</text>' +
        '<text class="~sym" font-size="13" x="10" y="' + (CH / 2 + 14) + '">' + nd.sym.charAt(1) + '</text>';
      else s += '<text class="~sym" font-size="17" x="10" y="' + (CH / 2 + 6) + '">' + nd.sym + '</text>';
    }
    s += '<rect class="~frame" width="' + w + '" height="' + CH + '" rx="8"/>';
    s += '<text class="~head" x="' + cx + '" y="17">' + (nd.leaf ? '<tspan class="~nm">' + id + '</tspan> ' + nd.leaf : esc(nd.head)) + '</text>';
    var vt = o.val ? fmt(o.v) : '?', gt = o.grad ? fmt(o.g) : '?';
    s += '<text class="~val' + (o.val ? '' : ' ~q') + '" x="' + cx + '" y="39"' + fit(vt, 15, nd.leaf ? w - 8 : w - 28) + '>' + vt + '</text>';
    s += '<rect class="~band' + (o.grad ? '' : ' ~empty') + '" x="' + bx + '" y="48" width="' + (w - bx - 6) + '" height="36" rx="6"/>';
    s += '<text class="~cap" x="' + cx + '" y="62">∂L/∂' + id + '</text>';
    s += '<text class="~gv' + (o.grad ? '' : ' ~q') + '" x="' + cx + '" y="78"' + fit(gt, 13, w - bx - 12) + '>' + gt + '</text>';
    return s + '</g>';
  }
  function graphSvg(lay, s, step, v, g) {
    var act = step.act || [], fwd = s >= 1 && s <= NF, bwd = s > NF && s < LAST;
    var o = '<svg viewBox="0 0 ' + lay.W + ' ' + lay.H + '" style="max-width:' + lay.max + 'px" role="img" aria-label="计算图：' +
      esc(phaseTag(s) + '，' + step.title) + '">', back = '';
    IDS.forEach(function (t) {
      (NODE[t].ins || []).forEach(function (src) {
        var on = fwd && act.indexOf(t) >= 0, e = seg(lay, src, t, 0), c = on ? ' ~on' : '';
        o += line(e.x0, e.y0, e.x1 - e.ux * 7, e.y1 - e.uy * 7, '~edge' + c) + arrowHead(e.x1, e.y1, e.ux, e.uy, '~ah' + c);
        if (bwd && act.indexOf(src) >= 0) { // 梯度沿这条边往回流：画一条平行虚线，箭头指回输入
          var k = seg(lay, src, t, 8);
          back += line(k.x1, k.y1, k.x0 + k.ux * 7, k.y0 + k.uy * 7, '~back') + arrowHead(k.x0, k.y0, -k.ux, -k.uy, '~bh');
        }
      });
    });
    IDS.forEach(function (id) {
      var p = lay.pos[id];
      o += cardSvg(lay, id, p[0], p[1], { act: act.indexOf(id) >= 0, val: valKnown(id, s), grad: gradKnown(id, s), v: v[id], g: g[id] });
    });
    return (o + back + '</svg>').replace(/~/g, C);
  }

  /* 界面 */
  var FIELDS = [['x1', '输入'], ['x2', '输入'], ['w1', '参数'], ['w2', '参数'], ['b', '参数'], ['y', '标签']];
  var TPL = '<p class="~how"><b>怎么玩：</b>先在下面改数值（不改也行），再按「下一步」。第 1–7 步是前向传播（forward pass），沿箭头算出每个节点的值；第 8–15 步是反向传播（backpropagation），从 L 往回算出每个节点的梯度（gradient）∂L/∂(节点)。到第 16 步汇总以后，可以按学习率（learning rate）η 更新一次参数，或者做数值梯度检查（gradient checking）。</p>' +
    '<p class="~model">模型：z = w1·x1 + w2·x2 + b，a = σ(z)；损失（loss）：L = ½(a − y)²</p>' +
    '<div class="~inputs" role="group" aria-label="可以修改的数值">' +
    FIELDS.map(function (f) {
      return '<label class="~field"><span><b>' + f[0] + '</b> ' + f[1] + '</span><input type="number" step="0.1" inputmode="decimal" data-k="' +
        f[0] + '" aria-label="' + f[0] + ' ' + f[1] + '"></label>';
    }).join('') +
    '<button type="button" class="~btn" data-act="defaults" aria-label="恢复默认数值">恢复默认数值</button></div>' +
    '<div class="~bar"><button type="button" class="~btn" data-act="prev" aria-label="上一步">上一步</button>' +
    '<button type="button" class="~btn ~pri" data-act="next" aria-label="下一步">下一步</button>' +
    '<button type="button" class="~btn" data-act="play" aria-label="自动播放">自动播放</button>' +
    '<button type="button" class="~btn" data-act="reset" aria-label="重置到第 0 步">重置</button>' +
    '<label class="~steps"><span class="~stepno"></span><input type="range" class="~range" min="0" max="' + LAST +
    '" step="1" value="0" aria-label="跳到第几步"></label></div>' +
    '<div class="~explain" aria-live="polite"><div class="~tag"></div><div class="~title"></div><p class="~note" hidden></p><p class="~text"></p><div class="~eqs"></div></div>' +
    '<p class="~legend">每个方框是一个节点：色条里是运算符号，第一行写它算什么，大号数字是前向传播算出的值，带底色的一格是反向传播算出的梯度 ∂L/∂(这个节点)。「?」表示还没算到，数字最多保留 4 位小数。</p>' +
    '<div class="~graph"></div>' +
    '<section class="~results" aria-label="参数的梯度、更新和检查"><p class="~rhead">参数的梯度</p><div class="~grads"></div>' +
    '<div class="~ctrl"><label class="~field"><span>学习率 η</span><input type="number" step="0.1" min="0" max="10" inputmode="decimal" data-k="eta" aria-label="学习率 η"></label>' +
    '<button type="button" class="~btn ~pri" data-act="update" aria-label="按 η 更新一次参数">按 η 更新一次参数</button>' +
    '<button type="button" class="~btn" data-act="check" aria-label="数值梯度检查">数值梯度检查</button></div>' +
    '<p class="~hint"></p><div class="~upd"></div><div class="~chk"></div></section>';

  function chipHtml(it) { return '<span class="~chip' + (it.r ? ' ~res' : '') + '"><small>' + it.c + '</small><span>' + esc(it.t) + '</span></span>'; }
  function eqsHtml(eqs) {
    return (eqs || []).map(function (row) {
      for (var h = '', i = 0; i < row.length; i++) {
        h += typeof row[i] === 'string' ? '<span class="~grp"><span class="~op" aria-hidden="true">' + row[i] + '</span>' + chipHtml(row[++i]) + '</span>' : chipHtml(row[i]);
      }
      return '<div class="~eq">' + h + '</div>';
    }).join('');
  }
  function updHtml(u, hist) {
    var dL = u.L1 - u.L0, d = fmt(Math.abs(dL));
    return '<div class="~box"><div class="~sub">第 ' + u.n + ' 次更新（η = ' + fmt(u.eta) + '）：w ← w − η · ∂L/∂w</div><ul class="~list">' +
      ['w1', 'w2', 'b'].map(function (k) {
        return '<li>' + k + ' ← ' + fmt(u.old[k]) + ' − ' + fmt(u.eta) + ' × ' + par(u.g[k]) + ' = ' + fmt(u.P[k]) + '</li>';
      }).join('') + '</ul><p>用新参数重新前向传播，损失 L 从 ' + fmt(u.L0) + ' 变成 ' + fmt(u.L1) + '。' +
      (d === '0' ? '损失几乎没变。' : dL < 0 ? '下降了 ' + d + '。' : '反而上升了 ' + d + '：η 太大，这一步跨过了最低点，把 η 调小再试。') + '</p>' +
      (hist.length > 2 ? '<p>损失记录：' + hist.map(fmt).join(' → ') + '</p>' : '') +
      '<p>想再更新一次，就接着按「下一步」，用新参数重新做一遍反向传播。</p></div>';
  }
  function chkHtml(c) {
    var r0 = null, tiny = [], big = null;
    var rows = c.rows.map(function (r) {
      if (r.tiny) tiny.push(r.k); else { r0 = r0 || r; if (r.e >= 1e-6 && (!big || r.e > big.e)) big = r; }
      return '<tr><th scope="row">' + r.k + '</th><td>' + fx(r.a, 8) + '</td><td>' + fx(r.n, 8) + '</td><td>' + (r.tiny ? '—' : sci(r.e, 1)) + '</td></tr>';
    }).join('');
    var t = '相对误差 = |反向传播 − 数值梯度| / max(|反向传播|, |数值梯度|)。', k = big && big.k;
    if (r0 && !big) t += '都小于 10⁻⁶：两种算法得到同一个梯度，说明反向传播算对了。';
    if (big) {
      t += k + ' 的相对误差是 ' + sci(big.e, 1) + '，超过了 10⁻⁶。数值梯度自己也有误差：ε 太大，L 在 ' + k + ' ± ε 这段上的弯曲带来截断误差（truncation error），输入越大越明显；ε 太小，L(' + k +
        ' + ε) 和 L(' + k + ' − ε) 几乎相等，相减后有效数字所剩无几，舍入误差（round-off error）变大。换 ε 重算：ε = 0.001 时是 ' + sci(big.b, 1) + '，ε = 0.00001 时是 ' + sci(big.s, 1) + '，';
      t += Math.min(big.s, big.b) < 1e-6 ? '其中 ε = ' + (big.s < big.b ? '0.00001' : '0.001') + ' 时降到了 10⁻⁶ 以下，说明差别来自数值梯度，不是反向传播错了。' : '都没降到 10⁻⁶ 以下：' +
        (Math.abs(big.a) < 1e-4 * c.L ? k + ' 的梯度只有 ' + fmt(big.a) + '，不到 L = ' + fmt(c.L) + ' 的万分之一，两个 L 相减后剩下的有效数字太少，' : '') + '数值梯度在这里精确不到 10⁻⁶。';
      t += '相对误差偏大时，要先排除这两种数值原因，再怀疑反向传播写错了。';
    }
    if (tiny.length) t += tiny.join('、') + ' 的两种结果都小于 10⁻⁸，几乎是 0，相对误差的分母太小，没有意义，表里记作「—」。';
    r0 = r0 || c.rows[0];
    return '<div class="~box"><div class="~sub">数值梯度检查（ε = 0.0001）</div>' +
      '<p>不用链式法则，直接把参数挪一点点，看 L 变了多少：数值梯度 = (L(w + ε) − L(w − ε)) / 2ε。以 ' + r0.k + ' 为例：L(' + r0.k + ' + ε) = ' +
      fx(r0.Lh, 12) + '，L(' + r0.k + ' − ε) = ' + fx(r0.Ll, 12) + '，两者相减再除以 2ε = 0.0002，得到 ' + fx(r0.n, 8) + '。</p>' +
      '<div class="~tw"><table class="~tbl"><thead><tr><th scope="col">参数</th><th scope="col">反向传播</th><th scope="col">数值梯度</th><th scope="col">相对误差</th></tr></thead><tbody>' +
      rows + '</tbody></table></div><p>' + t + '</p></div>';
  }

  function mount(container) {
    injectStyle();
    var root = document.createElement('div');
    root.className = C + 'root';
    root.innerHTML = TPL.replace(/~/g, C);
    container.appendChild(root);
    function $(n) { return root.querySelector('.' + C + n); }
    var st = { P: clone(P0), eta: ETA0, step: 0, narrow: null, timer: null, note: '', upd: null, chk: null, hist: [], n: 0 };
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
    var inp = {};
    FIELDS.concat([['eta']]).forEach(function (f) { inp[f[0]] = root.querySelector('[data-k="' + f[0] + '"]'); });
    var btn = {};
    ['prev', 'next', 'play', 'reset', 'update', 'check'].forEach(function (a) { btn[a] = root.querySelector('[data-act="' + a + '"]'); });
    var range = $('range'), graph = $('graph'), offs = [], ro = null;
    function on(el, ev, fn) { el.addEventListener(ev, fn); offs.push(function () { el.removeEventListener(ev, fn); }); }
    function syncInputs() {
      FIELDS.forEach(function (f) { inp[f[0]].value = String(+st.P[f[0]].toPrecision(6)); inp[f[0]].removeAttribute('aria-invalid'); });
      inp.eta.value = String(st.eta); inp.eta.removeAttribute('aria-invalid');
    }
    function pickLayout() {
      var w = root.clientWidth || 600, n = st.narrow === null ? w < 620 : (st.narrow ? w < 632 : w < 608);
      if (n === st.narrow) return false;
      st.narrow = n; return true;
    }
    function drawGraph(v, g, S) {
      graph.innerHTML = graphSvg(LAYOUT[st.narrow ? 'narrow' : 'wide'], st.step, S[st.step], v, g);
    }
    function render() {
      pickLayout();
      var s = st.step, v = forward(st.P), g = backward(v), S = buildSteps(v, g), cur = S[s];
      drawGraph(v, g, S);
      btn.prev.disabled = s === 0; btn.next.disabled = s === LAST;
      btn.play.textContent = st.timer ? '暂停' : '自动播放';
      btn.play.setAttribute('aria-label', st.timer ? '暂停' : '自动播放');
      btn.play.disabled = reduce;
      if (reduce) btn.play.title = '系统开启了「减少动态效果」，自动播放已关闭，请用「下一步」。';
      range.value = String(s);
      $('stepno').textContent = '第 ' + s + ' / ' + LAST + ' 步';
      $('tag').textContent = phaseTag(s);
      $('title').textContent = cur.title;
      var note = $('note'); note.hidden = !st.note; note.textContent = st.note;
      $('text').textContent = cur.text;
      $('eqs').innerHTML = eqsHtml(cur.eqs).replace(/~/g, C);
      $('grads').innerHTML = ['w1', 'w2', 'b'].map(function (k) {
        var known = gradKnown(k, s);
        return '<span class="' + C + 'chip' + (known ? ' ' + C + 'res' : '') + '"><small>参数 ' + k + '</small><span>∂L/∂' + k + ' = ' + (known ? fmt(g[k]) : '?') + '</span></span>';
      }).join('');
      var done = s === LAST;
      btn.update.disabled = !done; btn.check.disabled = !done;
      $('hint').textContent = done ? '更新规则：w ← w − η · ∂L/∂w，这就是梯度下降（gradient descent）走一步。η 越大，一步走得越远。' :
        '走到第 ' + LAST + ' 步（汇总）后才能更新参数或做梯度检查：一直按「下一步」，或把步骤滑块拖到最右边。';
      $('upd').innerHTML = st.upd ? updHtml(st.upd, st.hist).replace(/~/g, C) : '';
      $('chk').innerHTML = st.chk ? chkHtml(st.chk).replace(/~/g, C) : '';
    }
    function go(n) { st.step = Math.max(0, Math.min(LAST, n)); st.note = ''; render(); }
    function stop() { if (st.timer) { clearInterval(st.timer); st.timer = null; } }
    function play() {
      if (st.timer) { stop(); render(); return; }
      if (reduce) return;
      if (st.step >= LAST) st.step = 0;
      st.timer = setInterval(function () {
        if (st.step >= LAST - 1) stop();
        go(st.step + 1);
      }, 1300);
      render();
    }
    function doUpdate() {
      if (st.step !== LAST) return;
      var v = forward(st.P), g = backward(v), nP = sgdStep(st.P, g, st.eta), L1 = lossOf(nP);
      if (!st.hist.length) st.hist.push(v.L);
      st.hist.push(L1);
      st.n += 1;
      st.upd = { n: st.n, old: clone(st.P), g: { w1: g.w1, w2: g.w2, b: g.b }, eta: st.eta, P: nP, L0: v.L, L1: L1 };
      st.P = nP; st.chk = null;
      syncInputs();
      st.step = NF;
      st.note = '参数已更新：w1 = ' + fmt(nP.w1) + '，w2 = ' + fmt(nP.w2) + '，b = ' + fmt(nP.b) + '。下面是用新参数重新做的前向传播，L 从 ' +
        fmt(v.L) + ' 变成 ' + fmt(L1) + '。';
      render();
    }
    function doCheck() {
      if (st.step !== LAST) return;
      st.chk = { rows: checkRows(st.P), L: lossOf(st.P) };
      render();
    }
    on(root, 'click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b || b.disabled) return;
      var a = b.getAttribute('data-act');
      if (a === 'next') { stop(); go(st.step + 1); }
      else if (a === 'prev') { stop(); go(st.step - 1); }
      else if (a === 'play') play();
      else if (a === 'reset') { stop(); st.chk = null; go(0); }
      else if (a === 'defaults') { stop(); st.P = clone(P0); st.eta = ETA0; st.upd = st.chk = null; st.hist = []; st.n = 0; syncInputs(); go(0); }
      else if (a === 'update') doUpdate();
      else if (a === 'check') doCheck();
    });
    on(range, 'input', function () { stop(); go(+range.value); });
    FIELDS.concat([['eta']]).forEach(function (f) {
      var k = f[0], el = inp[k];
      on(el, 'input', function () {
        var x = el.value === '' ? NaN : Number(el.value);
        var okv = isFinite(x) && (k === 'eta' ? x > 0 && x <= 10 : Math.abs(x) <= 100);
        el.setAttribute('aria-invalid', okv ? 'false' : 'true');
        if (!okv) return;
        if (k === 'eta') { st.eta = x; return; }
        st.P[k] = x; st.upd = st.chk = null; st.hist = []; st.n = 0; st.note = '';
        render();
      });
      on(el, 'change', function () {
        if (el.getAttribute('aria-invalid') === 'true') { el.value = String(+(k === 'eta' ? st.eta : st.P[k]).toPrecision(6)); el.removeAttribute('aria-invalid'); }
      });
    });
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { if (pickLayout()) { var v = forward(st.P), g = backward(v); drawGraph(v, g, buildSteps(v, g)); } });
      ro.observe(root);
    } else {
      on(window, 'resize', function () { if (pickLayout()) render(); });
    }
    syncInputs();
    render();
    // Separate scalar runtime exercise: do not confuse leaf accumulation with the main network's graph walk.
    var lifecycle = document.createElement('section');
    var heading = document.createElement('h3'); heading.textContent = '梯度运行时：新前向、累加与图释放'; lifecycle.appendChild(heading);
    var explanation = document.createElement('p'); explanation.textContent = '独立标量例子 w=2，h=3w，L=h²，单次 dL/dw=36。以下是浏览器教学模拟，CPU PyTorch 对照见“自动微分运行时”知识点。新前向重建图，但不清空叶子梯度。'; lifecycle.appendChild(explanation);
    var runtimeState = document.createElement('p'); runtimeState.setAttribute('role','status'); lifecycle.appendChild(runtimeState);
    var accumulated = null, consumed = false, detached = false;
    function runtimeShow(message) { runtimeState.textContent = message + ' .grad=' + (accumulated === null ? 'None' : accumulated) + '；当前图' + (consumed ? '已反传' : '未反传') + '；detach=' + detached; }
    [['新前向',function(){consumed=false;runtimeShow('重新计算 L=(3w)²，保留叶子梯度。');}],
     ['反传当前图',function(){if(detached){runtimeShow('没有到 w 的梯度路径，不能正常反传。');return;}if(consumed){runtimeShow('本例反向所需中间量已释放；需要新前向，或在确有需要时事先保留图。');return;}accumulated=(accumulated===null?0:accumulated)+36;consumed=true;runtimeShow('本次梯度36，累加到叶子。');}],
     ['清空叶子梯度',function(){accumulated=null;runtimeShow('清空 .grad 不会重建已使用的图。');}],
     ['切换 detach',function(){detached=!detached;consumed=false;runtimeShow('用所选模式重新前向。');}],
     ['重置梯度实验',function(){accumulated=null;consumed=false;detached=false;runtimeShow('已重置。');}]].forEach(function(pair){var button=document.createElement('button');button.type='button';button.className='btn';button.textContent=pair[0];on(button,'click',pair[1]);lifecycle.appendChild(button);});
    runtimeShow('先预测，再点击反传。'); root.appendChild(lifecycle);
    return {
      destroy: function () {
        stop();
        if (ro) ro.disconnect();
        offs.forEach(function (f) { f(); });
        offs = [];
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  /* 自测：只验证计算，不碰 DOM */
  function selfTest() {
    var details = [], ok = true;
    function check(name, cond, info) {
      cond = !!cond; if (!cond) ok = false;
      details.push((cond ? '通过：' : '失败：') + name + (info ? '（' + info + '）' : ''));
    }
    function near(a, b, tol) { return Math.abs(a - b) <= tol; }
    var v = forward(P0), g = backward(v);
    check('默认值前向（手算）：p1 = 0.5，p2 = −0.6，z = 0，a = 0.5，L = 0.125',
      near(v.p1, 0.5, 1e-12) && near(v.p2, -0.6, 1e-12) && near(v.z, 0, 1e-12) && near(v.a, 0.5, 1e-12) && near(v.L, 0.125, 1e-12),
      'L = ' + v.L);
    // ∂L/∂z = (a − y)·a(1 − a) = −0.5 × 0.25 = −0.125；∂L/∂w2 = x2 × (−0.125) = −0.25
    check('默认值反向（手算）：∂L/∂w1 = −0.125，∂L/∂w2 = −0.25，∂L/∂b = −0.125，∂L/∂x1 = −0.0625，∂L/∂x2 = 0.0375',
      near(g.w1, -0.125, 1e-12) && near(g.w2, -0.25, 1e-12) && near(g.b, -0.125, 1e-12) && near(g.x1, -0.0625, 1e-12) && near(g.x2, 0.0375, 1e-12));
    var cases = [[P0, '默认值'], [{ x1: 2, x2: -1, w1: 0.3, w2: 0.8, b: -0.2, y: 0 }, '第二组'],
      [{ x1: -1.5, x2: 0.5, w1: 1.2, w2: -2, b: 0.7, y: 0.3 }, '第三组']];
    cases.forEach(function (c) {
      var gg = backward(forward(c[0])), worst = 0;
      ['w1', 'w2', 'b', 'x1', 'x2', 'y'].forEach(function (k) { worst = Math.max(worst, relErr(gg[k], numGrad(c[0], k, EPS).g)); });
      check(c[1] + '：解析梯度与数值梯度的最大相对误差 < 1e-6', worst < 1e-6, worst.toExponential(2));
    });
    var worstS = 0;
    [-4, -1.3, 0, 0.7, 2.5].forEach(function (z) {
      var h = 1e-5, num = (sigmoid(z + h) - sigmoid(z - h)) / (2 * h), s = sigmoid(z);
      worstS = Math.max(worstS, Math.abs(num - s * (1 - s)));
    });
    check('σ′(z) = σ(z)(1 − σ(z))：z = −4、−1.3、0、0.7、2.5 处与数值导数之差 < 1e-9', worstS < 1e-9, worstS.toExponential(2));
    check('σ(0) = 0.5，σ′(0) = 0.25，σ(2) = 0.880797', sigmoid(0) === 0.5 && sigmoid(0) * (1 - sigmoid(0)) === 0.25 && near(sigmoid(2), 0.880797, 1e-6));
    check('参数都取最大值 100（z = 20100）：σ 不溢出，L = 4900.5', sigmoid(20100) === 1 && sigmoid(-20100) === 0 && lossOf({ x1: 100, x2: 100, w1: 100, w2: 100, b: 100, y: 100 }) === 4900.5);
    var R3 = checkRows({ x1: 100, x2: 0, w1: 0.01, w2: 0, b: 0, y: 0 })[0], R4 = checkRows({ x1: -10, x2: 0, w1: 1.7, w2: 0, b: 0, y: 1 })[2],
      R1 = checkRows({ x1: 1, x2: 2, w1: 0.5, w2: -0.3, b: 0.1, y: 0.5 });
    check('梯度检查不误报：x1 = 100 的截断误差、z = −17 的舍入误差、a = y 时梯度为 0',
      R3.e >= 1e-6 && R3.s < 1e-6 && R3.s < R3.b && R4.e >= 1e-6 && R4.b < R4.e && R4.b < R4.s && R1.every(function (r) { return r.tiny; }),
      'w1 ' + R3.e.toExponential(1) + ' → ' + R3.s.toExponential(1) + '，b ' + R4.e.toExponential(1) + ' → ' + R4.b.toExponential(1));
    // 用例 4：η = 0.5 更新一步。w1 = 0.5 + 0.0625，w2 = −0.3 + 0.125，b = 0.1 + 0.0625，新 z = 0.375，L ≈ 0.08296
    var P1 = sgdStep(P0, g, ETA0), L1 = lossOf(P1);
    check('η = 0.5 更新一步：w1 = 0.5625，w2 = −0.175，b = 0.1625，L 从 0.125 降到约 0.08296',
      near(P1.w1, 0.5625, 1e-12) && near(P1.w2, -0.175, 1e-12) && near(P1.b, 0.1625, 1e-12) && L1 < v.L && near(L1, 0.08296, 1e-5),
      'L = ' + L1.toFixed(6));
    var allDown = cases.every(function (c) { var P = c[0]; return lossOf(sgdStep(P, backward(forward(P)), 0.1)) < lossOf(P); });
    check('三组数值用 η = 0.1 更新一步，损失都变小', allDown);
    var S = buildSteps(v, g), bad = 0, lines = 0;
    S.forEach(function (st) { (st.raw || []).forEach(function (r) { lines++; if (!near(r.loc * r.up, r.res, 1e-12)) bad++; }); });
    check('共 ' + (LAST + 1) + ' 个步骤，反向各行「局部导数 × 上游梯度 = 梯度」全部成立', S.length === LAST + 1 && lines === 12 && bad === 0, lines + ' 行');
    return { ok: ok, details: details };
  }

  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = { title: '反向传播：在计算图上用链式法则', mount: mount, selfTest: selfTest };
})();
