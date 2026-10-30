/* 交互演示：λ 演算的归约顺序（正常序、应用序、按名调用、按值调用）。纯原生 JS，挂到 window.KGDemos['pl-lambda-reduction']。 */
(function () {
  'use strict';
  var ID = 'pl-lambda-reduction', P = 'dm-' + ID + '-';
  function X(s) { return s.replace(/\bx-/g, P); }
  var LIMIT = 200, MAXSIZE = 3000, MAXSRC = 300, HISTMAX = 100;

  /* ---------- 项：变量 v、抽象 l、应用 a。项不可变，子项可以共享 ---------- */
  function V(n) { return { t: 'v', n: n }; }
  function L(v, b) { return { t: 'l', v: v, b: b }; }
  function A(f, a) { return { t: 'a', f: f, a: a }; }

  var MACROS = {
    I: 'λx. x', K: 'λx y. x', S: 'λx y z. x z (y z)', OMEGA: '(λx. x x) (λx. x x)', TRUE: 'λt f. t', FALSE: 'λt f. f',
    SUCC: 'λn f x. f (n f x)', PLUS: 'λm n f x. m f (n f x)'
  };
  var macroTerm = {};
  function church(n) { var b = V('x'); for (var i = 0; i < n; i++) b = A(V('f'), b); return L('f', L('x', b)); }

  /* ---------- 词法与语法 ---------- */
  function lex(s) {
    var toks = [], i = 0, m, c;
    while (i < s.length) {
      c = s.charAt(i);
      if (/\s/.test(c)) { i++; continue; }
      if (c === 'λ' || c === '\\') { toks.push({ k: 'λ', p: i }); i++; continue; }
      if (c === '.' || c === '(' || c === ')') { toks.push({ k: c, p: i }); i++; continue; }
      if (c === 'Ω') { toks.push({ k: 'mac', v: 'OMEGA', p: i }); i++; continue; }
      if ((m = /^[a-z][a-z0-9']*/.exec(s.slice(i)))) { toks.push({ k: 'id', v: m[0], p: i }); i += m[0].length; continue; }
      if ((m = /^[A-Z][A-Za-z0-9]*/.exec(s.slice(i)))) { toks.push({ k: 'mac', v: m[0], p: i }); i += m[0].length; continue; }
      if ((m = /^[0-9]+/.exec(s.slice(i)))) { toks.push({ k: 'num', v: m[0], p: i }); i += m[0].length; continue; }
      return { err: '第 ' + (i + 1) + ' 个字符「' + c + '」不认识。λ 可以写成 \\，变量名要用小写字母开头。' };
    }
    return { toks: toks };
  }
  // 语法：项 = 应用 | λ 变量… . 项；应用 = 原子 原子 …（向左结合，最后一个可以是 λ，它的函数体一直延伸到最右边）
  function parse(src) {
    src = String(src);
    if (src.length > MAXSRC) return { err: '输入太长了，最多 ' + MAXSRC + ' 个字符。' };
    var lx = lex(src), T, i = 0;
    if (lx.err) return lx;
    T = lx.toks;
    if (!T.length) return { err: '输入是空的。先写一个 λ 项，例如 (λx. x) y。' };
    function fail(msg, tok) { throw { msg: msg + (tok ? '（第 ' + (tok.p + 1) + ' 个字符）' : '（在末尾）') + '。' }; }
    function starts(t) { return t && (t.k === 'id' || t.k === 'mac' || t.k === 'num' || t.k === '(' || t.k === 'λ'); }
    function term() {
      var f = null, t, a;
      while (starts(t = T[i])) { a = t.k === 'λ' ? lam() : atom(); f = f ? A(f, a) : a; }
      if (!f) fail(!t ? '这里缺一个项' : t.k === ')' ? '「)」前面缺一个项' : '这里缺一个项，却遇到了「.」', t);
      return f;
    }
    function lam() {
      var vs = [], b, j;
      i++;
      while (T[i] && T[i].k === 'id') vs.push(T[i++].v);
      if (!vs.length) fail('λ 后面要写变量名（小写字母开头）', T[i]);
      if (!T[i] || T[i].k !== '.') fail('λ' + vs.join(' ') + ' 后面要有「.」', T[i]);
      i++;
      b = term();
      for (j = vs.length - 1; j >= 0; j--) b = L(vs[j], b);
      return b;
    }
    function atom() {
      var t = T[i++], e, key;
      if (t.k === 'id') return V(t.v);
      if (t.k === 'num') {
        if (t.v.length > 1 || +t.v > 5) fail('Church 数只支持 0–5，「' + t.v + '」超出范围', t);
        return church(+t.v);
      }
      if (t.k === 'mac') {
        key = t.v.toUpperCase();
        if (!MACROS[key]) fail('不认识的名字「' + t.v + '」。大写名字只能是 I、K、S、Ω（OMEGA）、TRUE、FALSE、SUCC、PLUS', t);
        return macroTerm[key] || (macroTerm[key] = parse(MACROS[key]).term);
      }
      e = term();
      if (!T[i] || T[i].k !== ')') fail('「(」没有配对的「)」', t);
      i++;
      return e;
    }
    try {
      var r = term();
      if (i < T.length) fail(T[i].k === ')' ? '多了一个「)」' : '这里不该出现「' + T[i].k + '」', T[i]);
      return { term: r };
    } catch (e) {
      if (e && e.msg) return { err: e.msg };
      throw e;
    }
  }

  /* ---------- 变量、替换与归约（不碰 DOM） ---------- */
  function fv(t, out, bound) {
    out = out || {}; bound = bound || {};
    if (t.t === 'v') { if (!bound[t.n]) out[t.n] = 1; }
    else if (t.t === 'a') { fv(t.f, out, bound); fv(t.a, out, bound); }
    else { var was = bound[t.v]; bound[t.v] = 1; fv(t.b, out, bound); bound[t.v] = was; }
    return out;
  }
  function names(t, out) {
    if (t.t === 'v') out[t.n] = 1;
    else if (t.t === 'a') { names(t.f, out); names(t.a, out); }
    else { out[t.v] = 1; names(t.b, out); }
    return out;
  }
  // x 在 t 里自由出现的次数
  function occ(t, x) { return t.t === 'v' ? (t.n === x ? 1 : 0) : t.t === 'a' ? occ(t.f, x) + occ(t.a, x) : t.v === x ? 0 : occ(t.b, x); }
  function size(t) { return t.t === 'v' ? 1 : t.t === 'a' ? 1 + size(t.f) + size(t.a) : 1 + size(t.b); }

  // 把 t 里自由出现的 x 换成 N，避免捕获。fvN 是 N 的自由变量；avoid 是新名字要避开的名字（整个项里出现过的）；log 记下换名和遮蔽
  function subst(t, x, N, fvN, log, avoid) {
    if (t.t === 'v') return t.n === x ? N : t;
    if (t.t === 'a') return A(subst(t.f, x, N, fvN, log, avoid), subst(t.a, x, N, fvN, log, avoid));
    if (t.v === x) { if (log && occ(t.b, x)) log.push({ k: 'shadow', v: x }); return t; }
    if (!fv(t.b)[x]) return t;
    if (fvN[t.v]) {
      var z = t.v, one = {};
      do { z += "'"; } while (avoid[z]);
      avoid[z] = 1; one[z] = 1;
      if (log) log.push({ k: 'ren', from: t.v, to: z });
      return L(z, subst(subst(t.b, t.v, V(z), one, null, avoid), x, N, fvN, log, avoid));
    }
    return L(t.v, subst(t.b, x, N, fvN, log, avoid));
  }

  // 各策略找下一个红式的位置。路径由 f（函数位置）、a（实参）、b（λ 的函数体）组成，'' 是整个项，null 表示没有
  var FIND = {
    n: function f(t, p) {
      if (t.t === 'v') return null;
      if (t.t === 'l') return f(t.b, p + 'b');
      if (t.f.t === 'l') return p;
      var r = f(t.f, p + 'f');
      return r !== null ? r : f(t.a, p + 'a');
    },
    a: function f(t, p) {
      if (t.t === 'v') return null;
      if (t.t === 'l') return f(t.b, p + 'b');
      var r = f(t.f, p + 'f');
      if (r === null) r = f(t.a, p + 'a');
      return r !== null ? r : t.f.t === 'l' ? p : null;
    },
    name: function f(t, p) {
      if (t.t !== 'a') return null;
      return t.f.t === 'l' ? p : f(t.f, p + 'f');
    },
    value: function f(t, p) {
      if (t.t !== 'a') return null;
      var r = f(t.f, p + 'f');
      if (r === null) r = f(t.a, p + 'a');
      return r !== null ? r : t.f.t === 'l' ? p : null;
    }
  };
  var STRATS = ['n', 'a', 'name', 'value'];
  var SN = { n: '正常序', a: '应用序', name: '按名调用', value: '按值调用' };
  var RULES = {
    n: '正常序（normal order）：每步归约最左、最外的红式。实参原样代入，用不到就不算；也进入 λ 内部继续化简。只要项有范式，正常序一定能走到。',
    a: '应用序（applicative order）：每步归约最左、最内的红式，也就是先把函数和实参都化到范式，最后才代入。实参自己停不下来时，整个归约也停不下来。',
    name: '按名调用（call by name）：实参原样代入，用到时再算；但不进入 λ 内部，也不算参数里的红式，最外层不是红式就停。正常序可以看成「再进入 λ 内部继续化简的按名调用」。',
    value: '按值调用（call by value）：先把函数位置、再把实参算到不能再算（值），然后才代入；不进入 λ 内部。应用序可以看成「再进入 λ 内部继续化简的按值调用」。'
  };

  function getAt(t, p) { for (var i = 0; i < p.length; i++) t = p[i] === 'f' ? t.f : p[i] === 'a' ? t.a : t.b; return t; }
  function setAt(t, p, s) {
    if (!p) return s;
    var c = p[0], r = p.slice(1);
    return c === 'f' ? A(setAt(t.f, r, s), t.a) : c === 'a' ? A(t.f, setAt(t.a, r, s)) : L(t.v, setAt(t.b, r, s));
  }
  function stepT(t, strat) {
    var p = FIND[strat](t, '');
    if (p === null) return null;
    var red = getAt(t, p), log = [];
    var out = subst(red.f.b, red.f.v, red.a, fv(red.a), log, names(t, {}));
    return { term: setAt(t, p, out), path: p, red: red, log: log };
  }
  // 化成 de Bruijn 形式：约束变量换成「隔了几层 λ」的编号，α 等价的项得到同一个串
  function db(t, env) {
    env = env || [];
    if (t.t === 'v') { var i = env.lastIndexOf(t.n); return i < 0 ? t.n : '#' + (env.length - 1 - i); }
    if (t.t === 'l') { env.push(t.v); var s = 'λ' + db(t.b, env); env.pop(); return s; }
    return '(' + db(t.f, env) + ' ' + db(t.a, env) + ')';
  }
  // 跑完整个归约：end 是 nf（范式）、weak（策略停住但还有红式）、limit（超过步数上限）、big（项太大）
  function reduce(t0, strat) {
    var terms = [t0], infos = [], seen = {}, t = t0, end, next = null, r, key;
    seen[db(t0)] = 0;
    for (;;) {
      r = stepT(t, strat);
      if (!r) { end = FIND.n(t, '') === null ? 'nf' : 'weak'; break; }
      if (infos.length >= LIMIT) { end = 'limit'; next = r.path; break; }
      if (size(r.term) > MAXSIZE) { end = 'big'; next = r.path; break; }
      key = db(r.term);
      if (seen[key] !== undefined) r.cyc = seen[key]; else seen[key] = terms.length;
      infos.push(r); terms.push(r.term); t = r.term;
    }
    return { terms: terms, infos: infos, end: end, next: next, strat: strat };
  }
  // Church 数 n = λf. λx. f (f … (f x))，按 α 等价判断
  function churchN(t) {
    var s = db(t), n = 0;
    if (s.slice(0, 2) !== 'λλ') return -1;
    s = s.slice(2);
    while (s.slice(0, 4) === '(#1 ') { n++; s = s.slice(4); }
    return s === '#0' + new Array(n + 1).join(')') ? n : -1;
  }
  var KNOWN = [['I', 'I'], ['K', 'TRUE，也是 K'], ['S', 'S'], ['SUCC', 'SUCC'], ['PLUS', 'PLUS']];
  function describe(t) {
    var n = churchN(t), k, i;
    if (n >= 0) return '= ' + n + '（Church 数' + (n === 0 ? '，也是 FALSE' : '') + '）';
    k = db(t);
    for (i = 0; i < KNOWN.length; i++) if (db(parse(KNOWN[i][0]).term) === k) return '= ' + KNOWN[i][1] + '（α 等价）';
    return '';
  }

  /* ---------- 打印：应用向左结合、λ 的函数体延伸到最右，只在必要处加括号；作实参的 λ 照教材习惯加括号。h 是要框出的红式路径 ---------- */
  function show(t, h, html) {
    function go(t, p, hole) {
      if (t.t === 'v') return html && t.n === hole ? '<span class="x-hole">' + t.n + '</span>' : t.n;
      if (t.t === 'l') return 'λ' + t.v + '. ' + go(t.b, p + 'b', t.v === hole ? null : hole);
      var red = html && p === h, f = t.f, a = t.a, fs, as;
      if (red) fs = '(<span class="x-bind">λ' + f.v + '</span>. ' + go(f.b, p + 'fb', f.v) + ')';
      else { fs = go(f, p + 'f', hole); if (f.t === 'l') fs = '(' + fs + ')'; }
      as = go(a, p + 'a', hole);
      if (a.t !== 'v') as = '(' + as + ')';
      if (red) return '<span class="x-redex">' + fs + ' <span class="x-arg">' + as + '</span></span>';
      return fs + ' ' + as;
    }
    return go(t, '', null);
  }
  function txt(t) { return show(t, null, false); }
  function cut(s, n) { n = n || 50; return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  /* ---------- 文字说明 ---------- */
  function nextPath(R, s) { return s < R.infos.length ? R.infos[s].path : s === R.terms.length - 1 ? R.next : null; }
  function whyNext(R, s) {
    var p = nextPath(R, s), red, argRed;
    if (p === null) return '';
    red = getAt(R.terms[s], p); argRed = FIND.n(red.a, '') !== null;
    if (R.strat === 'n') return '下一步：正常序从最外层往里、从左往右找，最先碰到的红式就是框出来的这个。' + (argRed ? '它的实参里还有红式，正常序不先算实参，原样代进去。' : '');
    if (R.strat === 'a') return '下一步：应用序先算里面。框出来的红式，函数体和实参里都已经没有红式了，所以轮到它。';
    if (R.strat === 'name') return '下一步：按名调用沿着最外层的函数位置找红式，不先算实参' + (argRed ? '（实参里的红式先不管）' : '') + '，也不进入 λ 内部。';
    return '下一步：按值调用已经把函数位置和实参算到不能再算，现在可以代入了。它不进入 λ 内部。';
  }
  function explain(R, s, macro) {
    var out, info, red, x, k, n = R.terms.length - 1;
    if (s === 0) out = '这是输入' + (macro ? '，宏已经展开成 λ 项' : '') + '。';
    else {
      info = R.infos[s - 1]; red = info.red; x = red.f.v; k = occ(red.f.b, x);
      out = '第 ' + s + ' 步：归约红式 ' + cut(txt(red)) + '，把函数体 ' + cut(txt(red.f.b), 36) + ' 里的 ' + x + ' 换成实参 ' + cut(txt(red.a), 36) + '。' +
        (k === 0 ? '函数体里没有 ' + x + '，实参直接被丢掉，一次也没算。' : k === 1 ? '' : x + ' 出现了 ' + k + ' 次，实参被复制成 ' + k + ' 份。');
      info.log.forEach(function (e) {
        if (e.k === 'ren') {
          out += '换名：函数体里有 λ' + e.from + '，而实参里有自由变量 ' + e.from + '。直接代进去，这个 ' + e.from + ' 会被 λ' + e.from +
            ' 绑住（变量捕获），意思就变了。所以先把 λ' + e.from + ' 和它绑定的 ' + e.from + ' 改名为 ' + e.to + '（α 换名，不改变含义），再代入。';
        } else out += '函数体里的 λ' + e.v + ' 又绑定了一个 ' + e.v + '，那一层里的 ' + e.v + ' 属于内层，替换不进去。';
      });
      if (info.cyc !== undefined) out += '得到的项和第 ' + info.cyc + ' 步的一样（最多差变量名），照这个策略会一直绕圈。';
    }
    if (s < n) return out + ' ' + whyNext(R, s);
    if (R.end === 'nf') return out + ' 项里已经没有红式，这就是范式。';
    if (R.end === 'weak') return out + ' ' + SN[R.strat] + '到这里停住：它不进入 λ 内部' + (R.strat === 'name' ? '，也不先算参数' : '') + '，可项里还有红式。换成正常序可以继续化简。';
    if (R.end === 'limit') return out + ' 已经做了 ' + LIMIT + ' 步，还有红式没归约，超过步数上限。';
    return out + ' 再归约一步，项会超过 ' + MAXSIZE + ' 个结点，停止。';
  }
  function resultOf(R) {
    var t = R.terms[R.terms.length - 1], n = R.infos.length;
    if (R.end === 'nf') return ['ok', '✓ 到达范式，共 ' + n + ' 步：' + cut(txt(t), 80) + (describe(t) ? ' ' + describe(t) : '')];
    if (R.end === 'weak') return ['weak', '■ ' + SN[R.strat] + '停住了，共 ' + n + ' 步。λ 里面或参数里还有红式，这叫弱范式（weak normal form）。'];
    if (R.end === 'limit') return ['bad', '✗ 超过步数上限（' + LIMIT + ' 步），还没到范式。'];
    return ['bad', '✗ 项太大（超过 ' + MAXSIZE + ' 个结点），停止。'];
  }
  function compareHTML(runs, cur) {
    var h = '<table class="x-tbl"><thead><tr><th scope="col">策略</th><th scope="col">步数</th><th scope="col">结果</th></tr></thead><tbody>';
    STRATS.forEach(function (k) {
      var R = runs[k], t = R.terms[R.terms.length - 1], res;
      if (R.end === 'nf') res = '✓ 范式 <code>' + cut(txt(t), 40) + '</code> ' + describe(t);
      else if (R.end === 'weak') res = '■ 停住（弱范式）<code>' + cut(txt(t), 40) + '</code>';
      else if (R.end === 'limit') res = '✗ 超过步数上限';
      else res = '✗ 项太大，停止';
      h += '<tr' + (k === cur ? ' class="x-now"' : '') + '><th scope="row">' + (k === cur ? '<span class="x-mk">当前</span>' : '') + SN[k] + '</th><td>' +
        (R.end === 'limit' ? '&gt; ' + LIMIT : R.infos.length) + '</td><td>' + res + '</td></tr>';
    });
    return h + '</tbody></table>';
  }

  /* ---------- 样式与骨架 ---------- */
  var PRESETS = [
    ['kio', 'K I Ω', 'K I Ω：参数是死循环', 'K = λx y. x 只返回第一个参数。第二个参数 Ω = (λx. x x) (λx. x x) 归约一步还是它自己。正常序根本不算 Ω，两步得到 I；应用序先算参数，永远停不下来。下方表格对比四种策略。'],
    ['id', '(λx. x) y', '(λx. x) y：最简单的一步', '恒等函数应用到 y，一步 β 归约：把函数体 x 换成 y。'],
    ['cap', '(λx. λy. x) y', '(λx. λy. x) y：要换名', '直接代入会得到 λy. y，实参里的自由变量 y 被内层的 λy 捕获，变成了恒等函数。正确结果是 λy\'. y：一个总返回外面那个 y 的函数。'],
    ['succ', 'SUCC 1', 'SUCC 1：Church 数的后继', 'SUCC = λn f x. f (n f x)，在 n 层 f 外面再套一层。1 的后继应该是 Church 数 2。'],
    ['plus', 'PLUS 2 1', 'PLUS 2 1：Church 数相加', 'PLUS = λm n f x. m f (n f x)：先套 n 层 f，再在外面套 m 层。结果应该是 Church 数 3。'],
    ['skk', 'S K K', 'S K K：和 I 一样', 'S = λx y z. x z (y z)。S K K 对任何参数 z 都返回 z，范式是 λz. z，和 I 只差变量名。']
  ];
  var CSS =
    '.x-root{color:var(--text,#1b1b19);font-family:var(--font,sans-serif);font-size:15px;line-height:1.65}' +
    '.x-root *{box-sizing:border-box}' +
    '.x-root p{margin:0 0 8px}' +
    '.x-root h3{margin:0 0 6px;font-size:16px;font-weight:600;line-height:1.4;color:var(--text,#1b1b19)}' +
    '.x-root .x-intro,.x-root .x-rule{color:var(--text-2,#52514e);font-size:14px}' +
    '.x-box{background:var(--surface,#fff);border:1px solid var(--border,#e2e1dc);border-radius:var(--radius,10px);padding:12px;min-width:0;margin-bottom:10px}' +
    '.x-ctl{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-end}' +
    '.x-field{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--text-2,#52514e);min-width:0;flex:1 1 220px}' +
    '.x-wide{flex:1 1 100%}' +
    '.x-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '.x-in{font:inherit;font-size:14px;color:var(--text,#1b1b19);background:var(--surface,#fff);border:1px solid var(--border,#e2e1dc);border-radius:8px;padding:6px 8px;min-height:36px;min-width:0;width:100%}' +
    '.x-row .x-in{flex:1 1 180px;width:auto;font-family:var(--mono,monospace)}' +
    '.x-btn{font:inherit;font-size:14px;color:var(--text,#1b1b19);background:var(--surface,#fff);border:1px solid var(--border,#e2e1dc);border-radius:8px;padding:6px 12px;min-height:36px;cursor:pointer}' +
    '.x-btn:hover{background:var(--surface-2,#f0efec)}' +
    '.x-btn[aria-pressed=true],.x-pri{background:color-mix(in srgb,var(--c-pl,#0e7c86) 16%,var(--surface,#fff));border-color:var(--c-pl,#0e7c86)}' +
    '.x-pri{font-weight:600}' +
    '.x-btn[aria-disabled=true]{opacity:.45;cursor:default}' +
    '.x-root :focus-visible{outline:2px solid var(--focus,#2457b3);outline-offset:2px}' +
    '.x-root .x-msg{margin:0;font-size:13px;color:var(--text-2,#52514e)}' +
    '.x-root .x-msg:empty{display:none}' +
    '.x-root .x-err{color:var(--text,#1b1b19);background:color-mix(in srgb,var(--div-pos,#e34948) 16%,var(--surface,#fff));border-radius:6px;padding:4px 8px}' +
    '.x-root .x-note{font-size:13px;color:var(--text-2,#52514e)}' +
    '.x-note code,.x-tbl code{font-family:var(--mono,monospace);color:var(--text,#1b1b19);overflow-wrap:anywhere}' +
    '.x-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}' +
    '.x-status{flex:1 1 200px;font-size:14px}' +
    '.x-cur{border-top:3px solid var(--c-pl,#0e7c86)}' +
    '.x-term{margin:0 0 6px;padding:6px 10px;background:var(--surface-2,#f0efec);border-radius:8px;font-family:var(--mono,monospace);font-size:16px;line-height:2.2;color:var(--text,#1b1b19);white-space:pre-wrap;overflow-wrap:anywhere}' +
    '.x-redex{border:2px solid var(--c-pl,#0e7c86);border-radius:6px;padding:1px 3px;background:color-mix(in srgb,var(--c-pl,#0e7c86) 14%,var(--surface,#fff));-webkit-box-decoration-break:clone;box-decoration-break:clone}' +
    '.x-bind{font-weight:700}' +
    '.x-hole{font-weight:700;text-decoration:underline dotted;text-decoration-thickness:2px;text-underline-offset:4px}' +
    '.x-arg{border-bottom:2px dashed var(--text-2,#52514e);background:color-mix(in srgb,var(--warn,#fab219) 24%,var(--surface,#fff))}' +
    '.x-root .x-say{margin:0 0 8px;padding:8px 10px;background:var(--surface-2,#f0efec);border-left:4px solid var(--c-pl,#0e7c86);border-radius:8px;font-size:14px}' +
    '.x-tag{display:inline-block;margin-right:6px;padding:0 6px;border:1px solid var(--border,#e2e1dc);border-radius:999px;background:var(--surface,#fff);font-size:12px;color:var(--text-2,#52514e)}' +
    '.x-root .x-res{margin:0 0 10px;padding:6px 10px;border-radius:8px;font-size:14px;font-weight:600;color:var(--text,#1b1b19);border:1px solid var(--border,#e2e1dc);overflow-wrap:anywhere}' +
    '.x-root .x-res:empty{display:none}' +
    '.x-res.x-ok{background:color-mix(in srgb,var(--good,#0ca30c) 16%,var(--surface,#fff));border-color:var(--good,#0ca30c)}' +
    '.x-res.x-weak{background:color-mix(in srgb,var(--div-neg,#2a78d6) 14%,var(--surface,#fff));border-color:var(--div-neg,#2a78d6)}' +
    '.x-res.x-bad{background:color-mix(in srgb,var(--div-pos,#e34948) 16%,var(--surface,#fff));border-color:var(--div-pos,#e34948)}' +
    '.x-hist{list-style:none;margin:0;padding:0;max-height:280px;overflow:auto;font-family:var(--mono,monospace);font-size:13px;line-height:2.1}' +
    '.x-hist li{white-space:nowrap;padding:0 4px;border-bottom:1px solid var(--border,#e2e1dc)}' +
    '.x-hn{display:inline-block;min-width:5em;font-family:var(--font,sans-serif);font-size:12px;color:var(--text-3,#6b6a66)}' +
    '.x-scroll{overflow-x:auto}' +
    '.x-root .x-tbl{width:100%;margin:0;border-collapse:collapse;font-size:13px;line-height:1.5}' +
    '.x-tbl th,.x-tbl td{border:1px solid var(--border,#e2e1dc);padding:4px 6px;text-align:left;vertical-align:top;color:var(--text,#1b1b19);background:var(--surface,#fff)}' +
    '.x-tbl thead th{background:var(--surface-2,#f0efec);font-size:12px;color:var(--text-2,#52514e)}' +
    '.x-tbl tbody th{font-weight:400;white-space:nowrap}' +
    '.x-tbl tr.x-now>*{background:color-mix(in srgb,var(--c-pl,#0e7c86) 12%,var(--surface,#fff))}' +
    '.x-tbl tr.x-now>th{box-shadow:inset 4px 0 var(--c-pl,#0e7c86)}' +
    '.x-mk{display:inline-block;margin-right:6px;padding:0 6px;border:1px solid var(--c-pl,#0e7c86);border-radius:999px;font-size:11px;font-weight:600;color:var(--text,#1b1b19);background:var(--surface,#fff)}';

  var TPL =
    '<p class="x-how">怎么玩：选一个预置的项（或自己输入）和一种归约策略，按「下一步」每次做一次 β 归约。框出来的是下一步要归约的红式（redex），历史记录里列出之前每一步的项。也可以用键盘 ← → 单步。</p>' +
    '<p class="x-intro">λ 演算只有三种项：变量 x；λ 抽象 λx. M，表示以 x 为参数、M 为函数体的函数；应用 M N，把 M 应用到 N。形如 (λx. M) N 的子项叫红式，把它换成「M 里自由出现的 x 都替换成 N」叫 β 归约。项里没有红式时叫范式（normal form）。一个项里常有好几个红式，先归约哪一个，由归约策略决定。</p>' +
    '<div class="x-box x-ctl">' +
    '<label class="x-field">预置的项<select class="x-in x-preset" aria-label="选择预置的项">' +
    PRESETS.map(function (p) { return '<option value="' + p[0] + '">' + p[2] + '</option>'; }).join('') + '<option value="custom">自定义</option></select></label>' +
    '<label class="x-field">归约策略<select class="x-in x-strat" aria-label="选择归约策略">' +
    '<option value="n">正常序（最左最外，进 λ 内部）</option><option value="a">应用序（最左最内，先算实参）</option>' +
    '<option value="name">按名调用（不进 λ 内部）</option><option value="value">按值调用（先算实参，不进 λ 内部）</option></select></label>' +
    '<div class="x-field x-wide"><span>λ 项（可以直接改，按回车或「应用」）</span>' +
    '<div class="x-row"><input class="x-in x-src" type="text" spellcheck="false" autocomplete="off" aria-label="λ 项">' +
    '<button class="x-btn" type="button" data-act="apply" aria-label="用这个 λ 项重新开始">应用</button></div></div>' +
    '<p class="x-note x-wide">写法：λ 也可以写成 \\；λx y. M 是 λx. λy. M 的简写；应用向左结合，f a b 就是 (f a) b；λ 的函数体一直延伸到最右边。变量名用小写字母开头，后面可以跟数字和 \'。可用的宏（先展开再归约）：I、K、S、Ω（也可写 OMEGA）、TRUE、FALSE、SUCC、PLUS；数字 0–5 表示 Church 数，例如 2 就是 λf. λx. f (f x)。</p>' +
    '<p class="x-msg x-wide" aria-live="polite"></p>' +
    '</div>' +
    '<p class="x-rule"></p>' +
    '<div class="x-bar">' +
    '<button class="x-btn" type="button" data-act="reset" aria-label="重置到第 0 步">重置</button>' +
    '<button class="x-btn" type="button" data-act="prev" aria-label="上一步">上一步</button>' +
    '<button class="x-btn x-pri" type="button" data-act="next" aria-label="下一步">下一步</button>' +
    '<button class="x-btn" type="button" data-act="play" aria-pressed="false" aria-label="自动播放">自动播放</button>' +
    '<button class="x-btn" type="button" data-act="end" aria-label="直接跑到最后一步">跑到最后</button>' +
    '<span class="x-status"></span></div>' +
    '<section class="x-box x-cur" aria-label="当前的项"><h3 class="x-curh"></h3><div class="x-term"></div>' +
    '<p class="x-note">实线框：下一步要归约的红式；加粗的 λx：红式里函数的参数；点线下划线：函数体里会被替换掉的 x；虚线下划线加底色：实参。</p></section>' +
    '<p class="x-say" aria-live="polite"><span class="x-tag">现在发生了什么</span><span class="x-saytxt"></span></p>' +
    '<p class="x-res"></p>' +
    '<section class="x-box" aria-label="历史记录"><h3>历史记录</h3><p class="x-note">每行是那一步之前的项，框出的是那一步归约的红式。</p><ol class="x-hist"></ol></section>' +
    '<section class="x-box" aria-label="四种策略对比"><h3>同一个项，四种策略的结果</h3><div class="x-scroll x-cmp"></div></section>';

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
      preset: $('.x-preset'), strat: $('.x-strat'), src: $('.x-src'), msg: $('.x-msg'), rule: $('.x-rule'), status: $('.x-status'),
      curh: $('.x-curh'), term: $('.x-term'), say: $('.x-saytxt'), res: $('.x-res'), hist: $('.x-hist'), cmp: $('.x-cmp'),
      prev: $('[data-act=prev]'), next: $('[data-act=next]'), play: $('[data-act=play]'), end: $('[data-act=end]')
    };
    var S = { src: '', macro: false, runs: null, strat: 'n', s: 0, timer: null };
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduceMotion) { el.play.setAttribute('aria-disabled', 'true'); el.play.title = '系统开启了「减少动态效果」，自动播放已关闭'; }

    function setMsg(txt, err) { el.msg.textContent = txt; el.msg.className = X('x-msg x-wide' + (err ? ' x-err' : '')); }
    function stop() {
      if (S.timer) { clearInterval(S.timer); S.timer = null; }
      el.play.setAttribute('aria-pressed', 'false'); el.play.textContent = '自动播放'; el.play.setAttribute('aria-label', '自动播放');
    }
    function cur() { return S.runs[S.strat]; }
    function last() { return cur().terms.length - 1; }
    function go(s) { S.s = Math.max(0, Math.min(last(), s)); render(); }
    function load(src) {
      var r = parse(src), i, pr = null;
      if (r.err) { setMsg(r.err, true); return; }
      stop();
      S.src = src; S.macro = /[A-Z0-9Ω]/.test(src); S.runs = {}; S.s = 0;
      STRATS.forEach(function (k) { S.runs[k] = reduce(r.term, k); });
      for (i = 0; i < PRESETS.length; i++) if (PRESETS[i][1] === src.trim()) pr = PRESETS[i];
      el.preset.value = pr ? pr[0] : 'custom'; el.src.value = src;
      setMsg(pr ? pr[3] : '已换成自定义的项。');
      el.cmp.innerHTML = X(compareHTML(S.runs, S.strat));
      render();
    }
    function setStrat(k) {
      stop(); S.strat = k; el.strat.value = k; el.rule.textContent = RULES[k]; S.s = 0;
      el.cmp.innerHTML = X(compareHTML(S.runs, k));
      render();
    }
    function play() {
      if (reduceMotion) { setMsg('系统开启了「减少动态效果」，自动播放已关闭，请用「下一步」。'); return; }
      if (S.timer) { stop(); return; }
      if (S.s >= last()) go(0);
      el.play.setAttribute('aria-pressed', 'true'); el.play.textContent = '暂停'; el.play.setAttribute('aria-label', '暂停自动播放');
      S.timer = setInterval(function () { go(S.s + 1); if (S.s >= last()) stop(); }, 1000);
    }
    function render() {
      var R = cur(), s = S.s, n = last(), t = R.terms[s], d = describe(t), i, h = '', from;
      el.status.textContent = '第 ' + s + ' / ' + n + ' 步' + (s === n ? { nf: '，已到范式', weak: '，停住了', limit: '，到了步数上限', big: '，项太大' }[R.end] : '');
      el.prev.setAttribute('aria-disabled', s === 0 ? 'true' : 'false');
      el.next.setAttribute('aria-disabled', s === n ? 'true' : 'false');
      el.end.setAttribute('aria-disabled', s === n ? 'true' : 'false');
      el.curh.textContent = (s === 0 ? '第 0 步：输入' : '第 ' + s + ' 步之后') + (d ? '　' + d : '');
      el.term.innerHTML = X(show(t, nextPath(R, s), true));
      el.say.textContent = explain(R, s, S.macro);
      if (s === n) { var r = resultOf(R); el.res.className = X('x-res x-' + r[0]); el.res.textContent = r[1]; }
      else { el.res.className = X('x-res'); el.res.textContent = ''; }
      from = Math.max(0, s - HISTMAX);
      if (from) h += '<li><span class="x-hn">…</span>更早的 ' + from + ' 步没有列出</li>';
      for (i = from; i < s; i++) h += '<li><span class="x-hn">第 ' + i + ' 步</span>' + show(R.terms[i], R.infos[i].path, true) + '</li>';
      el.hist.innerHTML = X(h || '<li><span class="x-hn">（空）</span>还没有归约过。</li>');
      el.hist.scrollTop = el.hist.scrollHeight;
    }

    function onClick(e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || !root.contains(b)) return;
      var act = b.getAttribute('data-act'), n = last();
      if (act === 'next') { if (S.s < n) go(S.s + 1); }
      else if (act === 'prev') { stop(); go(S.s - 1); }
      else if (act === 'reset') { stop(); go(0); }
      else if (act === 'play') play();
      else if (act === 'end') { stop(); go(n); }
      else if (act === 'apply') load(el.src.value);
    }
    function onChange(e) {
      if (e.target === el.strat) setStrat(el.strat.value);
      else if (e.target === el.preset) {
        if (el.preset.value === 'custom') { setMsg('在输入框里写一个 λ 项，按回车或「应用」。'); el.src.focus(); return; }
        for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i][0] === el.preset.value) load(PRESETS[i][1]);
      }
    }
    function onKey(e) {
      var tg = e.target, name = tg.tagName;
      if (tg === el.src && e.key === 'Enter') { e.preventDefault(); load(el.src.value); return; }
      if (name === 'INPUT' || name === 'SELECT' || name === 'TEXTAREA' || tg === el.hist) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); if (S.s < last()) go(S.s + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); go(S.s - 1); }
    }
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKey);

    el.rule.textContent = RULES.n;
    load(PRESETS[0][1]);

    return {
      destroy: function () {
        stop();
        root.removeEventListener('click', onClick);
        root.removeEventListener('change', onChange);
        root.removeEventListener('keydown', onKey);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  /* ---------- 自测：结果按 α 等价比较（de Bruijn 形式）；Church 数另用一个不做替换的闭包求值器核对 ---------- */
  function selfTest() {
    var details = [], ok = true;
    function chk(name, got, exp, how) {
      var pass = JSON.stringify(got) === JSON.stringify(exp);
      ok = ok && pass;
      details.push((pass ? '通过：' : '失败：') + name + '，期望 ' + JSON.stringify(exp) + '，得到 ' + JSON.stringify(got) + (how ? '。核对：' + how : ''));
    }
    function T(s) { return parse(s).term; }
    function aeq(a, b) { return db(a) === db(b); }
    function run(s, st) { var R = reduce(T(s), st); R.t = R.terms[R.terms.length - 1]; return R; }
    // 闭包求值器：用 JS 函数表示 λ，和上面的替换实现无关
    function ev(t, env) {
      if (t.t === 'v') return env[t.n];
      if (t.t === 'l') return function (v) { var e = Object.create(env); e[t.v] = v; return ev(t.b, e); };
      return ev(t.f, env)(ev(t.a, env));
    }
    function toInt(s) { return ev(T(s), Object.create(null))(function (k) { return k + 1; })(0); }

    var r = run('(λx. x) y', 'n');
    chk('(λx. x) y 正常序', [r.end, txt(r.t), r.infos.length], ['nf', 'y', 1], '一步 β 归约，函数体 x 换成 y');
    r = run('K I Ω', 'n');
    chk('K I Ω 正常序得到 I', [r.end, aeq(r.t, T('λx. x')), r.infos.length], ['nf', true, 2], 'K I → λy. λx. x，再把 Ω 丢掉，得 λx. x');
    r = run('K I Ω', 'a');
    chk('K I Ω 应用序超过步数上限', [r.end, r.infos.length, r.infos[1].cyc], ['limit', LIMIT, 1], '先归约 K I，之后每步都是 Ω → Ω，第 2 步起和第 1 步的项相同');
    r = run('(λx. λy. x) y', 'n');
    chk('(λx. λy. x) y 换名避免捕获', [txt(r.t), aeq(r.t, T("λy'. y")), aeq(r.t, T('λy. y')), r.infos[0].log], ["λy'. y", true, false, [{ k: 'ren', from: 'y', to: "y'" }]],
      '直接代入得 λy. y 是恒等函数，错；先把 λy 换名为 λy\'，结果是返回自由变量 y 的常函数');
    r = run("(λx. λy. x y') y", 'n');
    chk("新名字避开已有的 y'", txt(r.t), "λy''. y y'", "y' 已经在函数体里自由出现，只能用 y''");
    r = run('(λx. λx. x) y', 'n');
    chk('内层同名绑定挡住替换', [txt(r.t), r.infos[0].log[0].k], ['λx. x', 'shadow'], '内层 λx 绑定自己的 x，y 代不进去');
    var s1 = [run('SUCC 1', 'n'), run('SUCC 1', 'a')], p21 = [run('PLUS 2 1', 'n'), run('PLUS 2 1', 'a')];
    chk('SUCC 1 的范式是 Church 数 2（正常序、应用序）', [churchN(s1[0].t), churchN(s1[1].t), toInt('SUCC 1')], [2, 2, 2],
      '手算：λf. λx. f (1 f x) → λf. λx. f (f x)；闭包求值器把它作用到 (+1) 和 0 上也得 2');
    chk('PLUS 2 1 的范式是 Church 数 3（正常序、应用序）', [churchN(p21[0].t), churchN(p21[1].t), toInt('PLUS 2 1')], [3, 3, 3],
      '手算：λf. λx. 2 f (1 f x) → λf. λx. f (f (f x))；闭包求值器也得 3');
    chk('PLUS 2 3 = 5，SUCC (SUCC 0) = 2', [churchN(run('PLUS 2 3', 'n').t), toInt('PLUS 2 3'), churchN(run('SUCC (SUCC 0)', 'n').t)], [5, 5, 2], '两种求值方式一致');
    chk('S K K 的范式和 I α 等价', [aeq(run('S K K', 'n').t, T('I')), aeq(run('S K K', 'a').t, T('I'))], [true, true], 'S K K → λz. K z (K z) → λz. z');
    var cn = run('K I Ω', 'name'), cv = run('K I Ω', 'value'), w = run('λx. (λy. y) x', 'name');
    chk('按名调用跳过死循环参数，按值调用陷进去', [cn.end, aeq(cn.t, T('I')), cv.end], ['nf', true, 'limit'], '与节点里「参数是死循环」的对比一致');
    chk('按名调用不进 λ 内部，正常序进去', [w.end, w.infos.length, txt(run('λx. (λy. y) x', 'n').t)], ['weak', 0, 'λx. x'], '最外层是 λ，按名调用一步也不走');
    chk('语法：多参数简写、\\ 写法、向左结合、Ω 与 OMEGA、数字',
      [aeq(T('λx y. x'), T('\\x.\\y.x')), aeq(T('a b c'), T('(a b) c')), aeq(T('a b c'), T('a (b c)')), aeq(T('Ω'), T('OMEGA')), txt(T('2')), txt(T('x λy. y z'))],
      [true, true, false, true, 'λf. λx. f (f x)', 'x (λy. y z)'], '按语法规则手写的等价形式；作实参的 λ 打印时加括号');
    chk('语法错误给出提示', ['λ. x', '(x', 'x)', 'FOO', '7', '', 'λx x', 'x # y'].map(function (s) { return !!parse(s).err; }),
      [true, true, true, true, true, true, true, true], '缺变量名、括号不配对、未知宏、超出 0–5、空输入、缺「.」、非法字符');
    // 最少括号打印后再解析，必须得到同一个项：枚举结点数 ≤ 6、变量取 x、y 的全部项
    var memo = {}, bad = [], cnt = 0;
    function gen(n) {
      if (memo[n]) return memo[n];
      var out = [], k;
      if (n === 1) out = [V('x'), V('y')];
      else {
        gen(n - 1).forEach(function (b) { out.push(L('x', b), L('y', b)); });
        for (k = 1; k < n - 1; k++) gen(k).forEach(function (f) { gen(n - 1 - k).forEach(function (a) { out.push(A(f, a)); }); });
      }
      return (memo[n] = out);
    }
    for (var n = 1; n <= 6; n++) gen(n).forEach(function (t) { cnt++; var s = txt(t), b = T(s); if (!b || db(b) !== db(t) || txt(b) !== s) bad.push(s); });
    chk('打印再解析得到同一个项（枚举 ' + cnt + ' 个项）', bad.slice(0, 3), [], '括号省到最少后，解析器读回来的结构不变');
    return { ok: ok, details: details };
  }

  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = {
    title: 'λ 演算：正常序和应用序的归约',
    mount: mount,
    selfTest: selfTest
  };
})();
