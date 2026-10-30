/* 迷你编译器：源码 → Token → AST → 三地址码（附常量折叠）。纯原生 JS，不依赖任何库。 */
(function () {
  'use strict';
  var ID = 'compiler-pipeline', P = 'dm-' + ID + '-';
  window.KGDemos = window.KGDemos || {};

  /* ================= 1. 核心计算（不碰 DOM） ================= */

  var SYM = { '+': 'PLUS', '-': 'MINUS', '*': 'STAR', '/': 'SLASH', '(': 'LPAREN', ')': 'RPAREN', '=': 'ASSIGN' };
  var ZH = { PLUS: '加号', MINUS: '减号', STAR: '乘号', SLASH: '除号', LPAREN: '左括号', RPAREN: '右括号', ASSIGN: '赋值号' };
  var WIDE = { '（': '(', '）': ')', '＋': '+', '－': '-', '＊': '*', '／': '/', '＝': '=', '×': '*', '÷': '/' };

  // 词法分析：每一步识别一个 token；ws 是这一步先跳过的空白数
  function lex(src) {
    var toks = [], steps = [], i = 0, n = src.length, err = null, ws, s, type;
    for (;;) {
      for (ws = 0; i < n && /\s/.test(src[i]); i++) ws++;
      if (i >= n) { toks.push({ type: 'EOF', text: '', pos: n, end: n }); steps.push({ t: toks.length - 1, ws: ws }); break; }
      s = i;
      if (/[A-Za-z_]/.test(src[i])) { while (i < n && /\w/.test(src[i])) i++; type = 'IDENT'; }
      else if (/\d/.test(src[i])) { while (i < n && /\d/.test(src[i])) i++; type = 'NUMBER'; }
      else if (SYM[src[i]]) { type = SYM[src[i]]; i++; }
      else { err = { stage: 'lex', pos: i, ch: String.fromCodePoint(src.codePointAt(i)) }; steps.push({ err: 1, ws: ws }); break; }
      toks.push({ type: type, text: src.slice(s, i), pos: s, end: i });
      steps.push({ t: toks.length - 1, ws: ws });
    }
    return { tokens: toks, steps: steps, error: err };
  }

  // 递归下降。trace 的每一项是一步：k 事件，p 当前 token 下标，stack 调用栈快照，built 已建节点数
  function parse(toks) {
    var p = 0, nodes = [], stack = [], tr = [], err = null, root = null;
    function mk(o) { o.id = nodes.length; nodes.push(o); return o; }
    function ev(k, o) {
      o.k = k; o.p = p; o.built = nodes.length;
      o.stack = stack.map(function (f) { return { fn: f.fn, left: f.left ? f.left.id : -1, target: f.target ? f.target.id : -1 }; });
      tr.push(o); return o;
    }
    function fail(expected, why, open) {
      err = ev('err', { tok: p, expected: expected, why: why, open: open, stage: 'parse', pos: toks[p].pos });
      throw err;
    }
    function enter(fn) { var f = { fn: fn }; stack.push(f); ev('enter', { fn: fn }); return f; }
    // expr 和 term 的共同骨架：先读一项，然后循环「运算符 + 一项」，每轮立刻和左边合并，所以左结合
    function loop(fn, ops, sub) {
      var f = enter(fn), left = f.left = sub(), opTok, right, iter = 0;
      while (ops.indexOf(toks[p].type) >= 0) {
        opTok = p; p++;
        ev('op', { fn: fn, tok: opTok });
        right = sub();
        left = f.left = mk({ kind: 'bin', op: toks[opTok].text, left: left, right: right, tok: opTok });
        ev('build', { fn: fn, node: left.id, iter: ++iter });
      }
      ev('exit', { fn: fn, node: left.id });
      stack.pop();
      return left;
    }
    function expr() { return loop('expr', ['PLUS', 'MINUS'], term); }
    function term() { return loop('term', ['STAR', 'SLASH'], factor); }
    function factor() {
      enter('factor');
      var t = toks[p], n, open;
      if (t.type === 'NUMBER' || t.type === 'IDENT') {
        n = mk(t.type === 'NUMBER' ? { kind: 'num', value: t.text, tok: p } : { kind: 'var', name: t.text, tok: p });
        p++; ev('leaf', { tok: p - 1, node: n.id });
      } else if (t.type === 'LPAREN') {
        open = p; p++;
        ev('lparen', { tok: open });
        n = expr();
        if (toks[p].type !== 'RPAREN') fail([')'], 'rparen', open);
        p++; ev('rparen', { tok: p - 1, node: n.id, open: open });
      } else fail(['NUMBER', 'IDENT', '('], 'factor');
      stack.pop();
      return n;
    }
    function stmt() {
      var f = enter('stmt'), e, r;
      if (toks[p].type !== 'IDENT') fail(['IDENT'], 'target');
      f.target = mk({ kind: 'var', name: toks[p].text, tok: p });
      p++; ev('target', { tok: p - 1, node: f.target.id });
      if (toks[p].type !== 'ASSIGN') fail(['='], 'assign');
      p++; ev('eq', { tok: p - 1 });
      e = expr();
      if (toks[p].type !== 'EOF') fail(['+', '-', '*', '/', 'EOF'], 'end');
      r = mk({ kind: 'assign', target: f.target, expr: e, tok: f.target.tok + 1 });
      ev('done', { node: r.id });
      stack.pop();
      return r;
    }
    try { root = stmt(); } catch (x) { if (x !== err) throw x; }
    return { root: root, nodes: nodes, trace: tr, error: err };
  }

  function kids(n) { return n.kind === 'assign' ? [n.target, n.expr] : n.kind === 'bin' ? [n.left, n.right] : []; }
  // 子树写成全括号中缀式，top 为真时去掉最外层括号
  function fmt(n, top) {
    if (n.kind === 'num') return n.value;
    if (n.kind === 'var') return n.name;
    if (n.kind === 'assign') return n.target.name + ' = ' + fmt(n.expr, true);
    var s = fmt(n.left) + ' ' + n.op + ' ' + fmt(n.right);
    return top ? s : '(' + s + ')';
  }
  function postorder(n, out) { kids(n).forEach(function (c) { postorder(c, out); }); out.push(n); return out; }

  // 常量折叠：后序遍历，两个子节点都是常数就在编译时算出来。用 BigInt 保证大数精确；整数除法向零取整（同 C）
  function fold(root) {
    var steps = [], count = 0;
    function f(n) {
      if (n.kind !== 'bin') return n;
      var l = f(n.left), r = f(n.right), a, b, v, st = { node: n.id, op: n.op, l: l, r: r };
      steps.push(st);
      if (l.kind === 'num' && r.kind === 'num') {
        a = BigInt(l.value); b = BigInt(r.value);
        if (n.op === '/' && b === BigInt(0)) st.k = 'div0';
        else {
          v = n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : a / b;
          st.k = 'fold'; st.v = String(v); count++;
          return { kind: 'num', value: st.v, tok: n.tok, id: n.id, folded: true };
        }
      } else st.k = 'keep';
      return { kind: 'bin', op: n.op, left: l, right: r, tok: n.tok, id: n.id };
    }
    var e = f(root.expr);
    return { root: { kind: 'assign', target: root.target, expr: e, tok: root.tok, id: root.id }, steps: steps, count: count };
  }

  // 三地址码：后序遍历；叶子直接当操作数，每个运算节点开一个新临时变量（跳过源码里已有的名字）
  function genTAC(root, used) {
    var code = [], steps = [], n = 0;
    function g(x) {
      if (x.kind !== 'bin') {
        var nm = x.kind === 'num' ? x.value : x.name;
        steps.push({ k: 'leaf', node: x.id, name: nm, num: x.kind === 'num' });
        return nm;
      }
      var a = g(x.left), b = g(x.right), skip = [], t;
      for (n++; used['t' + n]; n++) skip.push('t' + n);
      t = 't' + n;
      code.push(t + ' = ' + a + ' ' + x.op + ' ' + b);
      steps.push({ k: 'emit', node: x.id, a: a, b: b, op: x.op, t: t, skip: skip, line: code.length - 1 });
      return t;
    }
    var v = g(root.expr);
    code.push(root.target.name + ' = ' + v);
    steps.push({ k: 'store', node: root.id, v: v, temp: root.expr.kind === 'bin', line: code.length - 1 });
    return { code: code, steps: steps };
  }

  function compile(src, doFold) {
    var L = lex(src), R = { src: src, lex: L, error: L.error }, used = {};
    if (L.error) return R;
    R.parse = parse(L.tokens);
    if ((R.error = R.parse.error)) return R;
    L.tokens.forEach(function (t) { if (t.type === 'IDENT') used[t.text] = 1; });
    R.fold = fold(R.parse.root);
    R.plain = genTAC(R.parse.root, used);
    R.folded = genTAC(R.fold.root, used);
    R.tac = doFold ? R.folded : R.plain;
    return R;
  }

  // 自动布局：节点的横向次序 = 它对应的 token 在源码里的次序（正好是中序），
  // 每个节点独占一段横向区间，所以任何两个节点都不会重叠；父节点总在左右子树之间，连线不交叉。纵向按深度。
  var LH = 58, PADX = 10, PADY = 8, GAP = 12, R0 = 15;
  function textW(s) { return Math.max(30, Math.round(String(s).length * 9 + 14)); }
  function label(n) { return n.kind === 'bin' ? n.op : n.kind === 'assign' ? '=' : n.kind === 'num' ? n.value : n.name; }
  function isOp(n) { return n.kind === 'bin' || n.kind === 'assign'; }
  function baseW(n) { return isOp(n) ? R0 * 2 : textW(label(n)); }
  function pillW(s) { return Math.max(24, Math.round(s.length * 7.5 + 9)); }
  function layout(roots, wOf, extra) {
    var list = [], dep = {}, pos = {}, x = PADX, maxD = 0;
    function walk(n, d) { dep[n.id] = d; maxD = Math.max(maxD, d); list.push(n); kids(n).forEach(function (c) { walk(c, d + 1); }); }
    roots.forEach(function (r) { walk(r, 0); });
    list.sort(function (a, b) { return a.tok - b.tok; });
    list.forEach(function (n) {
      var w = wOf(n), e = extra ? extra(n) : 0;
      pos[n.id] = { x: x + w / 2, y: PADY + R0 + dep[n.id] * LH, w: w, e: e };
      x += w + e + GAP;
    });
    return { pos: pos, list: list, W: Math.round(x - GAP + PADX), H: PADY * 2 + R0 * 2 + maxD * LH };
  }
  function layoutOk(L) {
    var prev = -Infinity, ok = true;
    L.list.forEach(function (n) {
      var q = L.pos[n.id], k = kids(n);
      if (q.x - q.w / 2 < prev + 4) ok = false;
      prev = q.x + q.w / 2 + q.e;
      if (k.length && !(L.pos[k[0].id].x < q.x && q.x < L.pos[k[1].id].x)) ok = false;
    });
    return ok;
  }

  function selfTest() {
    var details = [], ok = true, r, tr, bi = -1, oi = -1;
    function check(name, cond, got) {
      cond = !!cond; if (!cond) ok = false;
      details.push((cond ? '通过：' : '失败：') + name + (cond ? '' : '；实际 ' + JSON.stringify(got)));
    }
    function code(x) { return x && x.tac ? x.tac.code.join('; ') : null; }
    r = compile('a = b + c * (d - 4)', false);
    check('词法：a = b + c * (d - 4) 得到 12 个 token', r.lex.tokens.map(function (t) { return t.type; }).join(' ') ===
      'IDENT ASSIGN IDENT PLUS IDENT STAR LPAREN IDENT MINUS NUMBER RPAREN EOF', r.lex.tokens.length);
    check('语法：* 比 + 先结合', fmt(r.parse.root, true) === 'a = b + (c * (d - 4))', fmt(r.parse.root, true));
    check('三地址码：t1 = d - 4; t2 = c * t1; t3 = b + t2; a = t3', code(r) === 't1 = d - 4; t2 = c * t1; t3 = b + t2; a = t3', code(r));
    r = compile('x = a - b - c', false);
    check('x = a - b - c 解析成 (a - b) - c', r.parse.root && fmt(r.parse.root.expr, true) === '(a - b) - c', r.parse.root && fmt(r.parse.root.expr, true));
    tr = r.parse.trace;
    tr.forEach(function (e, i) { if (e.k === 'build' && bi < 0) bi = i; if (e.k === 'op' && e.tok === 5) oi = i; });
    check('左结合的过程：先合成 (a - b)，之后才读第二个 -', bi >= 0 && oi > bi, [bi, oi]);
    r = compile('x = 2 * 3 + y', true);
    check('常量折叠：x = 2 * 3 + y 第一步算出 2 * 3 = 6', r.fold.steps[0].k === 'fold' && r.fold.steps[0].v === '6', r.fold.steps[0].v);
    check('折叠后：t1 = 6 + y; x = t1', code(r) === 't1 = 6 + y; x = t1', code(r));
    check('不折叠：t1 = 2 * 3; t2 = t1 + y; x = t2', r.plain.code.join('; ') === 't1 = 2 * 3; t2 = t1 + y; x = t2', r.plain.code);
    r = compile('x = (a +', false);
    check('x = (a + 报语法错误：第 9 列（输入结尾），期望 NUMBER、IDENT 或 (', r.error && r.error.stage === 'parse' &&
      r.error.pos === 8 && r.error.expected.join(' ') === 'NUMBER IDENT (', r.error && [r.error.pos, r.error.expected]);
    r = compile('x = (a + b', false);
    check('x = (a + b 缺 )：第 11 列', r.error && r.error.why === 'rparen' && r.error.pos === 10, r.error && r.error.pos);
    r = compile('x = -a', false);
    check('x = -a：第 5 列报错并提示不支持一元负号', r.error && r.error.why === 'factor' && r.error.pos === 4 && /一元负号/.test(errMsg(r)), r.error && r.error.pos);
    r = compile('x = a $ b', false);
    check('x = a $ b：第 7 列词法错误', r.error && r.error.stage === 'lex' && r.error.pos === 6, r.error);
    r = compile('x = 8 / 4 / 2', true);
    check('8 / 4 / 2 按 (8 / 4) / 2 折叠成 1', code(r) === 'x = 1', code(r));
    r = compile('x = (0 - 7) / 2', true);
    check('整数除法向零取整：(0 - 7) / 2 = -3', code(r) === 'x = -3', code(r));
    r = compile('x = (1 + 2) * (3 + 4)', true);
    check('(1 + 2) * (3 + 4) 逐层折叠成 21', code(r) === 'x = 21' && r.plain.code.join('; ') === 't1 = 1 + 2; t2 = 3 + 4; t3 = t1 * t2; x = t3', code(r));
    r = compile('x = 6 / 0', true);
    check('除数为 0 不折叠', r.fold.steps[0].k === 'div0' && code(r) === 't1 = 6 / 0; x = t1', code(r));
    r = compile('x = t1 + t2 * 3', false);
    check('临时变量避开源码里的 t1、t2', code(r) === 't3 = t2 * 3; t4 = t1 + t3; x = t4', code(r));
    ['a = b + c * (d - 4)', 'x = a - b - c', 'y = (1 + 2) * (3 + 4) / long_name - 12345'].forEach(function (s) {
      var q = compile(s, false), tmp = {};
      q.tac.steps.forEach(function (st) { if (st.k === 'emit') tmp[st.node] = st.t; });
      check('AST 布局不重叠、连线不交叉：' + s, layoutOk(layout([q.parse.root], baseW)) &&
        layoutOk(layout([q.parse.root], baseW, function (n) { return tmp[n.id] ? pillW(tmp[n.id]) + 5 : 0; })), s);
    });
    return { ok: ok, details: details };
  }

  /* ================= 2. 说明文字（纯函数，返回 HTML） ================= */

  // esc 顺带把 ~ 转义，这样 H() 只会替换模板里写的类名前缀 ~，不会碰用户输入
  function esc(s) { return String(s).replace(/[&<>"~]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function H(s) { return s.replace(/~(?=[a-z])/g, P); }
  function cd(s) { s = esc(s); return '<code>' + (s.length < 26 ? s.replace(/ /g, '&nbsp;') : s) + '</code>'; }
  function col(pos) { return '第 ' + (pos + 1) + ' 列'; }
  function tokDesc(t) {
    if (t.type === 'EOF') return 'EOF（输入结尾）';
    return (t.type === 'IDENT' || t.type === 'NUMBER' ? t.type + ' ' : '') + cd(t.text);
  }
  var RULE = { expr: cd('+') + ' 或 ' + cd('-'), term: cd('*') + ' 或 ' + cd('/') };

  function errMsg(R) {
    var E = R.error, toks, t, c, miss;
    if (E.stage === 'lex') {
      return col(E.pos) + '的 ' + cd(E.ch) + ' 不是合法字符。' + (WIDE[E.ch] ? '它是全角符号，请切换到英文输入法，改成半角的 ' + cd(WIDE[E.ch]) + '。' :
        E.ch === '.' ? '这个演示只支持整数，没有小数。' : E.ch === ';' ? '一行只写一条语句，不需要分号。' :
        '只允许字母、数字、下划线、' + cd('+ - * / ( ) =') + ' 和空格。');
    }
    toks = R.lex.tokens; t = toks[E.tok]; c = '在' + col(t.pos) + '遇到了 ' + tokDesc(t) + '。';
    miss = /^(IDENT|NUMBER|LPAREN)$/.test(t.type) ? '两个操作数之间可能少了运算符。' : '';
    switch (E.why) {
      case 'target': return 'stmt() 期望 IDENT（被赋值的变量名），但' + c + (t.type === 'EOF' && !E.tok ? '输入是空的，' : '') + '赋值语句要以变量名开头，例如 ' + cd('x = a + 1') + '。';
      case 'assign': return 'stmt() 读完变量名 ' + cd(toks[E.tok - 1].text) + ' 后期望 ' + cd('=') + '，但' + c + '这个演示只接受 ' + cd('变量 = 表达式') + ' 形式的赋值语句。';
      case 'end': return '表达式到这里已经完整，接下来期望运算符 ' + cd('+ - * /') + '（表达式继续）或 EOF（语句结束），但' + c +
        (t.type === 'RPAREN' ? '这个 ' + cd(')') + ' 前面没有配对的 ' + cd('(') + '。' : t.type === 'ASSIGN' ? '一条语句只能有一个 ' + cd('=') + '。' : miss);
      case 'rparen': return 'factor() 期望 ' + cd(')') + ' 来配对' + col(toks[E.open].pos) + '的 ' + cd('(') + '，但' + c + (t.type === 'EOF' ? '括号没有闭合。' : miss);
    }
    return 'factor() 期望 NUMBER、IDENT 或 ' + cd('(') + '，但' + c + (
      t.type === 'MINUS' ? '这个文法不支持一元负号：' + cd('-a') + ' 可以写成 ' + cd('0 - a') + '。' :
      t.type === 'PLUS' ? '这个文法不支持一元正号，把这个 ' + cd('+') + ' 去掉即可。' :
      t.type === 'EOF' ? (toks[E.tok - 1].type === 'ASSIGN' ? cd('=') + ' 右边还没有写表达式。' : '表达式还没写完，最后一个运算符后面缺少操作数。') :
      t.type === 'RPAREN' ? '括号里是空的，或者 ' + cd(')') + ' 前面缺少操作数。' :
      t.type === 'ASSIGN' ? '这里需要一个操作数，一条语句只能有一个 ' + cd('=') + '。' : '运算符前面缺少操作数。');
  }

  function lexNow(R, k) {
    var L = R.lex, src = R.src, s, pre, t, nx, span, stop;
    if (!k) return '词法分析（lexical analysis）从左往右扫描字符，按规则把它们切成 token（词法单元），每个 token 记下类型、原文和所在的列。点「下一步」读出第一个 token。';
    s = L.steps[k - 1]; pre = s.ws ? '先跳过 ' + s.ws + ' 个空格。' : '';
    if (s.err) return pre + '出错了：' + errMsg(R) + '词法分析到这里停止。';
    t = L.tokens[s.t];
    if (t.type === 'EOF') return pre + '字符读完了。最后补一个 EOF token 表示「输入结束」，语法分析靠它判断语句是否完整。一共 ' + L.tokens.length + ' 个 token（含 EOF）。';
    nx = src[t.end];
    span = t.end - t.pos > 1 ? '第 ' + (t.pos + 1) + ' 到 ' + t.end + ' 列' : col(t.pos);
    stop = nx === undefined ? '后面没有字符了' : /\s/.test(nx) ? '后面是空格' : '后面的 ' + cd(nx) + (t.type === 'IDENT' ? ' 不能出现在标识符里' : ' 不是数字');
    if (t.type === 'IDENT') return pre + span + '是 ' + cd(t.text) + '：以字母或下划线开头，按 IDENT 规则往后读字母、数字和下划线，' + stop + '。得到 IDENT ' + cd(t.text) + '。';
    if (t.type === 'NUMBER') return pre + span + '是 ' + cd(t.text) + '：连续的数字合成一个整数，' + stop + '。得到 NUMBER ' + cd(t.text) + '。';
    return pre + col(t.pos) + '是 ' + cd(t.text) + '，单个字符就是一个 token：' + t.type + '（' + ZH[t.type] + '）。';
  }

  function parseNow(R, k) {
    if (R.lex.error) return '词法分析在' + col(R.lex.error.pos) + '出错，没有 token 可以交给语法分析。先修正输入框里的内容。';
    var Pr = R.parse, N = Pr.nodes, toks = R.lex.tokens, e, la, st, top, n, s, ops, caller;
    if (!k) return '语法分析（parsing）这里用递归下降（recursive descent）：文法里每条规则对应一个函数（stmt、expr、term、factor），函数按规则互相调用，一边读 token 一边建抽象语法树（abstract syntax tree，AST）。下面能看到调用栈；token 流里橙色框是当前 token，也就是还没消耗、下一个要看的 token（lookahead）。点「下一步」从 stmt() 开始。';
    e = Pr.trace[k - 1]; la = toks[e.p]; st = e.stack; top = st[st.length - 1];
    function nd(id) { return cd(fmt(N[id], true)); }
    switch (e.k) {
      case 'enter':
        if (e.fn === 'stmt') return '调用 stmt()。赋值语句的规则是 ' + cd('stmt → IDENT "=" expr EOF') + '，先要读到一个变量名。';
        if (e.fn === 'factor') return '调用 factor()。当前 token 是 ' + tokDesc(la) + '。factor 有三个分支：NUMBER、IDENT、' + cd('"(" expr ")"') + '，看当前 token 选一支。';
        return '调用 ' + e.fn + '()' + (e.fn === 'expr' && st.filter(function (f) { return f.fn === 'expr'; }).length > 1 ? '（括号里面的那一层）' : '') + '。' +
          '规则是 ' + (e.fn === 'expr' ? cd('expr → term (("+"|"-") term)*') + '：先调用 term() 读第一项，再看后面有没有 ' :
            cd('term → factor (("*"|"/") factor)*') + '：先调用 factor() 读第一个因子，再看后面有没有 ') + RULE[e.fn] + '。';
      case 'target': return 'stmt() 看到 ' + tokDesc(toks[e.tok]) + '，这是被赋值的变量。消耗它，记为赋值目标。';
      case 'eq': return 'stmt() 看到 ' + cd('=') + '，消耗它。等号右边是表达式，调用 expr() 去解析。';
      case 'leaf': return 'factor() 看到 ' + tokDesc(toks[e.tok]) + '，走 ' + toks[e.tok].type + ' 分支：消耗它，建叶子节点 ' + cd(toks[e.tok].text) + '，返回给 term()。';
      case 'lparen': return 'factor() 看到 ' + cd('(') + '，走 ' + cd('"(" expr ")"') + ' 分支：消耗它，调用 expr() 解析括号里的整个表达式。';
      case 'rparen': return '括号里的 expr() 返回了 ' + nd(e.node) + '。factor() 需要一个 ' + cd(')') + ' 来配对' + col(toks[e.open].pos) + '的 ' + cd('(') + '，当前正好是 ' + cd(')') + '，消耗它。括号只负责分组，不进 AST，factor() 把 ' + nd(e.node) + ' 整棵子树当作一个因子返回。';
      case 'op': return e.fn + '() 手里的左边是 ' + nd(top.left) + '。看到 ' + cd(toks[e.tok].text) + '，属于 ' + RULE[e.fn] + '，进入循环：消耗它，再调用 ' + (e.fn === 'expr' ? 'term()' : 'factor()') + ' 读右边。';
      case 'build':
        n = N[e.node];
        s = e.fn + '() 拿到右边 ' + nd(n.right.id) + '，和左边 ' + nd(n.left.id) + ' 合成新节点 ' + nd(n.id) + '，新节点成为当前的左边。';
        if (e.iter > 1) s += '左边是上一轮循环刚合成的，它被放进新节点的左子树，所以先算：这就是左结合（left-associative）。';
        else if ((e.fn === 'expr' ? /^(PLUS|MINUS)$/ : /^(STAR|SLASH)$/).test(la.type))
          s += '后面的 ' + cd(la.text) + ' 还没读，要等下一轮循环，所以 ' + nd(n.id) + ' 会整个成为它的左边。';
        if (e.fn === 'expr' && n.right.kind === 'bin' && (n.right.op === '*' || n.right.op === '/')) s += '右边的 ' + nd(n.right.id) + ' 是 term() 把整棵子树建好之后才交回来的，所以 ' + cd(n.right.op) + ' 在 ' + cd(n.op) + ' 下面，先算。';
        return s;
      case 'exit':
        caller = st.length > 1 ? st[st.length - 2].fn : '';
        return e.fn + '() 手里是 ' + nd(e.node) + '，当前 token 是 ' + tokDesc(la) + '，不属于 ' + RULE[e.fn] + '，循环结束，把 ' + nd(e.node) + ' 返回给 ' + caller + '()。' +
          (e.fn === 'term' && (la.type === 'PLUS' || la.type === 'MINUS') ? '这个 ' + cd(la.text) + ' 留给上一层的 expr() 处理：乘除在 term() 这一层就合并完了，加减要回到 expr() 才合并，所以乘除先算。' : '');
      case 'done':
        ops = postorder(Pr.root.expr, []).filter(function (x) { return x.kind === 'bin'; }).map(function (x) { return cd(fmt(x, true)); });
        n = ops.length;
        if (n > 4) ops = ops.slice(0, 2).concat('…', ops[n - 1]);
        return 'stmt() 看到 EOF，整行读完。用赋值目标和右边的表达式建根节点 ' + cd('=') + '，语法分析完成。' +
          (n > 1 ? '树的形状决定了先后：子节点总是比父节点先算。按后序遍历排出的计算顺序是 ' + ops.join(' → ') + (n > 4 ? '（共 ' + n + ' 个运算，中间省略）' : '') + '。' : '');
    }
    return '出错了：' + errMsg(R) + '语法分析到这里停止。';
  }

  function unavail(R) { return (R.error.stage === 'lex' ? '词法' : '语法') + '分析出错，没有 AST，这一阶段做不了。出错的位置和原因见输入框下方。'; }

  function tacNow(R, k, on) {
    if (R.error) return unavail(R);
    var T = R.tac, s;
    if (!k) return '三地址码（three-address code）的每条指令最多涉及三个地址：一个结果、两个操作数，例如 ' + cd('t1 = d - 4') + '。生成时对 AST 做后序遍历（postorder traversal）：先左子树，再右子树，最后节点自己。轮到一个运算时，它的两个操作数都已经有名字了。' + (on ? '常量折叠已打开，这里翻译的是折叠后的 AST。' : '');
    s = T.steps[k - 1];
    if (s.k === 'leaf') return '后序遍历来到叶子 ' + cd(s.name) + '。' + (s.num ? '常数' : '变量') + '可以直接当操作数，不生成指令，它的名字就是 ' + cd(s.name) + '。';
    if (s.k === 'emit') return '节点 ' + cd(s.op) + ' 的两个子节点都处理完了：左边的名字是 ' + cd(s.a) + '，右边是 ' + cd(s.b) + '。新开临时变量 ' + cd(s.t) + ' 存结果' +
      (s.skip.length ? '（' + s.skip.join('、') + ' 已经是源码里的变量名，跳过）' : '') + '，生成第 ' + (s.line + 1) + ' 条指令 ' + cd(T.code[s.line]) + '。';
    return '最后回到根节点 ' + cd('=') + '：右边的值' + (s.temp ? '在 ' + cd(s.v) + ' 里' : '就是 ' + cd(s.v)) + '，生成 ' + cd(T.code[s.line]) + '。一共 ' + T.code.length + ' 条指令。';
  }

  function foldNow(R, k, on) {
    if (R.error) return unavail(R);
    if (!on) return '常量折叠现在关闭。打开后，编译器在生成三地址码之前先检查 AST：两个子节点都是常数的运算，在编译时就算出结果。';
    var F = R.fold, s, why;
    if (!k) return '常量折叠（constant folding）把两个子节点都是常数的运算在编译时算掉，程序运行时就少算一次。它在生成三地址码之前直接改 AST，也按后序遍历：子树先折成常数，父节点才有机会接着折。';
    s = F.steps[k - 1];
    if (!s) return F.count ? '折叠完成：一共算掉 ' + F.count + ' 个运算，三地址码从 ' + R.plain.code.length + ' 条变成 ' + R.folded.code.length + ' 条，见「折叠前后对比」。' :
      F.steps.length ? '这个式子里没有两个子节点都是常数的运算，折叠前后代码一样。可以试试示例 ' + cd('x = 2 * 3 + y') + '。' : '右边没有运算，不需要折叠。';
    if (s.k === 'fold') return '节点 ' + cd(s.op) + ' 的两个子节点都是常数：' + cd(s.l.value) + ' 和 ' + cd(s.r.value) + '。编译时直接算出 ' + cd(s.l.value + ' ' + s.op + ' ' + s.r.value + ' = ' + s.v) +
      (s.op === '/' ? '（整数除法，向零取整）' : '') + '，用常数节点 ' + cd(s.v) + ' 替换这棵子树。';
    if (s.k === 'div0') return '节点 ' + cd('/') + ' 的除数是常数 0。除以 0 没有结果（在 C 语言里属于未定义行为），编译器不能替程序算出一个值，只能保留原样。';
    why = [s.l, s.r].filter(function (c) { return c.kind !== 'num'; }).map(function (c) {
      return c.kind === 'var' ? '变量 ' + cd(c.name) + ' 的值要到运行时才知道' : cd(fmt(c, true)) + ' 没能折成常数';
    });
    return '节点 ' + cd(s.op) + '：' + why.join('，') + '，所以不能折叠，保留 ' + cd(fmt({ kind: 'bin', op: s.op, left: s.l, right: s.r }, true)) + '。';
  }

  function srcMark(R) {
    var s = R.src, E = R.error, t = E.stage === 'lex' ? null : R.lex.tokens[E.tok],
      len = t ? (t.end - t.pos) : E.ch.length, h = esc(s.slice(0, E.pos));
    if (E.pos >= s.length) h += '<span class="~mark ~eofm">EOF</span>';
    else h += '<span class="~mark">' + esc(s.slice(E.pos, E.pos + len)) + '</span>' + esc(s.slice(E.pos + len));
    return '<div class="~srcl"><code>' + h + '</code></div>';
  }
  function statusHTML(R, on) {
    if (R.error) return '<div class="~serr"><span class="~lab">' + (R.error.stage === 'lex' ? '词法错误' : '语法错误') + '</span>' + errMsg(R) + srcMark(R) + '</div>';
    return '<div class="~sok">词法：' + R.lex.tokens.length + ' 个 token　语法：通过，AST 有 ' + R.parse.nodes.length + ' 个节点　三地址码：' + R.tac.code.length + ' 条' +
      (on ? '（已折叠；不折叠是 ' + R.plain.code.length + ' 条）' : '') + '</div>';
  }

  /* ================= 3. 样式（~ 在注入时换成 dm-compiler-pipeline-） ================= */
  var CSS = [
    '.~root{container-type:inline-size;width:100%;font-family:var(--font);color:var(--text);font-size:15px;line-height:1.65}',
    '.~root *{box-sizing:border-box}',
    '.~root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}',
    '.~root code{font-family:var(--mono);font-size:.92em;background:var(--surface-2);padding:0 .3em;border-radius:4px;overflow-wrap:anywhere}',
    '.~tip code,.~notes code,.~rules code{white-space:nowrap}',
    '.~sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.~how{margin:0 0 10px;color:var(--text-2)}',
    '.~inrow{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}',
    '.~in{flex:1 1 240px;min-width:0;font:16px/1.4 var(--mono);padding:8px 10px;color:var(--text);background:var(--surface);border:1px solid var(--edge-strong);border-radius:8px}',
    '.~sw{display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none}',
    '.~sw input{width:18px;height:18px;margin:0;accent-color:var(--c-compiler)}',
    '.~exs{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 0;font-size:13px;color:var(--text-2)}',
    '.~ex{font:13px var(--mono);padding:3px 9px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:999px;cursor:pointer}',
    '.~ex:hover,.~b:hover{border-color:var(--edge-strong)}',
    '.~status{margin:0 0 12px;font-size:14px}',
    '.~sok{padding:6px 10px;color:var(--text-2);background:var(--surface-2);border-left:3px solid var(--good);border-radius:4px}',
    '.~serr{padding:8px 10px;background:$R9;border-left:3px solid var(--div-pos);border-radius:4px}',
    '.~lab{font-weight:600;margin-right:6px}',
    '.~srcl{margin-top:6px;overflow-x:auto}',
    '.~root .~srcl code{display:inline-block;white-space:pre;font-size:15px;padding:2px 8px;background:var(--surface)}',
    '.~mark{outline:2px solid var(--div-pos);outline-offset:1px;border-radius:2px}',
    '.~eofm{margin-left:3px;padding:0 3px;font-size:11px;color:var(--text-2)}',
    '.~tabs{display:flex;gap:2px;border-bottom:1px solid var(--border)}',
    '.~tab{flex:1 1 0;min-width:0;font:inherit;font-size:14px;line-height:1.35;padding:8px 4px;color:var(--text-2);background:none;border:0;border-bottom:3px solid transparent;margin-bottom:-1px;cursor:pointer}',
    '.~tab[aria-selected="true"]{color:var(--text);font-weight:600;border-bottom-color:var(--c-compiler)}',
    '.~tab.~na{color:var(--text-3)}',
    '.~tl{white-space:nowrap}',
    '.~dot{display:inline-block;width:7px;height:7px;margin-left:5px;border-radius:50%;background:var(--div-pos);vertical-align:middle}',
    '.~panel{padding:12px;background:var(--surface);border:1px solid var(--border);border-top:0;border-radius:0 0 var(--radius) var(--radius)}',
    '.~ctrl{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
    '.~b{font:inherit;font-size:14px;padding:5px 12px;color:var(--text);background:var(--surface-2);border:1px solid var(--border);border-radius:8px;cursor:pointer}',
    '.~b[aria-disabled="true"],.~b:disabled{opacity:.45;cursor:not-allowed}',
    '.~b.~pri{color:var(--surface);background:var(--text);border-color:var(--text)}',
    '.~cnt{margin-left:auto;font-size:13px;color:var(--text-3);font-variant-numeric:tabular-nums}',
    '.~now{margin:10px 0 4px;padding:8px 12px;min-height:6.4em;background:$C7;border-left:3px solid var(--c-compiler);border-radius:4px}',
    '.~nowh{font-size:12px;color:var(--text-3)}',
    '.~now p{margin:0}',
    '.~sub{margin:12px 0 6px;font-size:12.5px;color:var(--text-3)}',
    '.~empty{margin:0;font-size:13px;color:var(--text-3)}',
    '.~note{margin:10px 0 0;font-size:13.5px;color:var(--text-2)}',
    '.~cells{display:flex;flex-wrap:wrap;row-gap:6px;font-family:var(--mono)}',
    '.~cell{display:flex;flex-direction:column;align-items:center;min-width:22px;border-bottom:2px solid transparent}',
    '.~cell b{font-weight:400;font-size:17px;line-height:1.5;color:var(--text)}',
    '.~cell i{font-style:normal;font-size:10px;color:var(--text-3)}',
    '.~cell.~ws b{color:var(--text-3)}',
    '.~ta{background:var(--surface-2)}',
    '.~tb{background:color-mix(in srgb,var(--edge) 50%,var(--surface))}',
    '.~cell.~cur{background:$C20;border-bottom-color:var(--c-compiler)}',
    '.~skip{background:$C7}',
    '.~cell.~err{box-shadow:inset 0 0 0 2px var(--div-pos)}',
    '.~cell.~eofc{padding:0 4px}',
    '.~cell.~eofc b{font-size:12px;line-height:2.125}',
    '.~toks{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}',
    '.~tk{display:flex;flex-direction:column;align-items:center;min-width:48px;padding:3px 6px;line-height:1.3;background:var(--surface);border:1px solid var(--border);border-radius:6px}',
    '.~tkt,.~tkc{font-size:10px;color:var(--text-3)}',
    '.~root .~tkx{font-size:15px;background:none;padding:0}',
    '.~tk.~eat{background:$C16;border-color:var(--c-compiler)}',
    '.~tk.~used{opacity:.45}',
    '.~tk.~la{border:2px solid var(--c-compiler);padding:2px 5px}',
    '.~tk.~bad{border:2px solid var(--div-pos);padding:2px 5px;background:$R12}',
    '.~rules ul{margin:0;padding-left:1.3em;font-size:13.5px;color:var(--text-2)}',
    '.~pg,.~tg{display:grid;grid-template-columns:minmax(0,296px) minmax(0,1fr);gap:0 16px}',
    '.~tg{grid-template-columns:minmax(0,1fr) minmax(0,230px)}',
    '@container (max-width:620px){.~pg,.~tg{grid-template-columns:minmax(0,1fr)}}',
    '.~gram{padding:6px;font:12px/1.8 var(--mono);background:var(--surface-2);border-radius:6px;overflow-x:auto}',
    '.~gram div{padding:0 5px;white-space:pre;border-left:3px solid transparent;border-radius:3px}',
    '.~gram .~on{background:$C16;border-left-color:var(--c-compiler)}',
    '.~frame{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:4px;padding:3px 8px;font-size:13px;background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--border);border-radius:5px}',
    '.~root .~frame code{background:none;padding:0}',
    '.~frame span{font:12px var(--mono);color:var(--text-2);text-align:right;overflow-wrap:anywhere}',
    '.~ftop{border-left-color:var(--c-compiler);background:$C9}',
    '.~ferr{border-left-color:var(--div-pos);background:$R9}',
    '.~svgbox{padding:4px;overflow:auto;max-height:min(480px,75vh);background:var(--bg);border:1px solid var(--border);border-radius:6px}',
    '.~svg{display:block;max-width:100%;height:auto;margin:0 auto}',
    '.~svg line{stroke:var(--edge-strong);stroke-width:1.5}',
    '.~svg line.~fade{stroke-dasharray:4 3;opacity:.35}',
    '.~nd circle,.~nd rect{fill:var(--surface);stroke:var(--edge-strong);stroke-width:1.5}',
    '.~nd.~op circle,.~nd.~num rect{fill:var(--surface-2)}',
    '.~nd text,.~pill text{fill:var(--text);font:15px var(--mono);text-anchor:middle;dominant-baseline:central}',
    '.~nd.~done circle,.~nd.~done rect{fill:$C10}',
    '.~nd.~fold rect{fill:$C18;stroke:var(--c-compiler);stroke-dasharray:4 2}',
    '.~nd.~cur circle,.~nd.~cur rect{stroke:var(--c-compiler);stroke-width:3.5;stroke-dasharray:none}',
    '.~nd.~fade{opacity:.3}',
    '.~pill rect{fill:$C16;stroke:var(--c-compiler)}',
    '.~pill text{font-size:12px}',
    '.~legend{margin-top:4px;font-size:12px;color:var(--text-3)}',
    '.~codebox{padding:6px 10px;background:var(--surface-2);border-radius:6px}',
    '.~codebox .~sub{margin:2px 0 4px}',
    '.~lines{margin:0;padding-left:1.8em;font:14px/1.9 var(--mono);color:var(--text-3)}',
    '.~root .~lines code{background:none;padding:2px 6px 2px 8px;color:var(--text);font-size:14px}',
    '.~root .~lines .~cur code{background:$C20;box-shadow:inset 3px 0 0 var(--c-compiler)}',
    '.~seq{display:flex;flex-wrap:wrap;gap:4px;margin:0;padding:0;list-style:none;font-family:var(--mono)}',
    '.~seq li{min-width:28px;padding:1px 6px;text-align:center;border:1px solid var(--border);border-radius:4px}',
    '.~seq .~sd{background:$C10}',
    '.~seq .~sc{border:2px solid var(--c-compiler);padding:0 5px}',
    '.~seq .~st{color:var(--text-3)}',
    '.~cmp{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}',
    '.~off{padding:10px 12px;border:1px dashed var(--edge-strong);border-radius:6px}',
    '.~off p{margin:0 0 8px}',
    '.~tip{margin:12px 0 0;font-size:13.5px;color:var(--text-2)}',
    '.~notes{margin-top:20px;border-top:1px solid var(--border)}',
    '.~notes h3{margin:14px 0 6px;font-size:17px;font-weight:600}',
    '.~notes h4{margin:14px 0 4px;font-size:15px;font-weight:600}',
    '.~notes p{margin:0 0 10px}'
  ].join('');

  /* ================= 4. 可视化（返回 HTML） ================= */
  var TABS = ['词法分析', '语法分析', '三地址码', '常量折叠'];
  // 标签名不在词中间断行：窄屏时只在编号和名字之间换行
  function tabHTML(i, dot) { return (i + 1) + ' <span class="~tl">' + TABS[i] + (dot ? '<span class="~dot" aria-hidden="true"></span>' : '') + '</span>'; }
  // tab：点完切到哪个阶段；fold：同时打开常量折叠
  function exBtn(v, tab, fold) {
    var to = tab !== undefined ? '，' + (fold ? '打开常量折叠，' : '') + '切到「' + (tab + 1) + ' ' + TABS[tab] + '」' : '';
    return '<button type="button" class="~ex" data-a="ex" data-v="' + esc(v) + '"' + (tab !== undefined ? ' data-tab="' + tab + '"' : '') +
      (fold ? ' data-fold="1"' : '') + ' aria-label="载入示例 ' + esc(v) + to + '">' + esc(v) + '</button>';
  }
  var EXAMPLES = ['a = b + c * (d - 4)', 'x = a - b - c', 'x = 2 * 3 + y', 'x = (a + b) * c', 'x = (a +', 'x = -a'];
  var GRAM = [['stmt', 'stmt   → IDENT "=" expr EOF'], ['expr', 'expr   → term (("+"|"-") term)*'],
    ['term', 'term   → factor (("*"|"/") factor)*'], ['factor', 'factor → NUMBER | IDENT | "(" expr ")"']];
  // 图例不写「白底 / 灰底」，那种说法在深色主题下不成立
  function legend(extra) { return '<div class="~legend">圆圈：运算符　方框：变量或常数　橙色粗框：这一步处理的节点' + (extra || '') + '</div>'; }
  var RULES = '<div class="~rules"><div class="~sub">切分规则</div><ul>' +
    '<li><code>IDENT</code>：字母或下划线开头，后面接字母、数字、下划线，如 <code>a</code>、<code>x1</code>、<code>_tmp</code></li>' +
    '<li><code>NUMBER</code>：一串数字，只支持整数，如 <code>4</code>、<code>120</code></li>' +
    '<li><code>+ - * /</code> 依次是 PLUS、MINUS、STAR、SLASH；<code>( )</code> 是 LPAREN、RPAREN；<code>=</code> 是 ASSIGN</li>' +
    '<li>空格只起分隔作用，跳过，不产生 token</li></ul></div>';
  var FOLDTIP = '<p class="~tip">这里的折叠只看一个运算的两个子节点是不是常数。<code>x = a + 2 + 3</code> 解析成 <code>(a + 2) + 3</code>，两个 + 都有一边不是常数，一个也折不掉；写成 <code>x = 2 + 3 + a</code> 就能先算出 5。GCC、Clang 这类编译器开了优化，还会利用整数加法的结合律把 <code>(a + 2) + 3</code> 改写成 <code>a + 5</code>，这个演示没有做这一步。整数除法和 C 语言一样向零取整，<code>7 / 2</code> 得 3；除数是 0 时不折叠。</p>' +
    '<div class="~exs"><span>对比一下：</span>' + exBtn('x = a + 2 + 3', 3, 1) + exBtn('x = 2 + 3 + a', 3, 1) + exBtn('x = (1 + 2) * (3 + 4)', 3, 1) + '</div>';
  var NOTES = '<section class="~notes"><h3>优先级和结合性是怎么来的</h3>' +
    '<p>文法里没有哪条规则直接写着「* 比 + 优先」或「减法从左往右算」。优先级（precedence）来自函数的分层，结合性（associativity）来自循环的写法。先看分层：expr 只处理 + 和 -，term 只处理 * 和 /，factor 处理数字、变量和括号。expr 要拿到一项，必须先调用 term；term 要拿到一个因子，必须先调用 factor。层次越深的函数，组出来的节点在树里越靠下。</p>' +
    '<h4>为什么 * 比 + 先算</h4>' +
    '<p>以 <code>b + c * d</code> 为例。expr 先拿到 b，看到 +，调用 term 去读右边那一项。term 拿到 c 后看到 *，于是在自己的循环里接着读 d，组成 <code>c * d</code>，整体交回给 expr。expr 最后组成 <code>b + (c * d)</code>。* 节点在 + 节点下面，求值时子节点先算，所以 * 先算。代入 b = 1、c = 2、d = 3，得到 1 + 6 = 7；如果从左往右硬算，会得到 (1 + 2) * 3 = 9。</p>' +
    '<p>括号能改变顺序，是因为 factor 遇到 ( 会重新调用 expr，括号里的整个表达式变成一个因子。<code>(b + c) * d</code> 里，+ 节点落到了 * 节点下面，所以先算加法。</p>' +
    '<h4>为什么 a - b - c 是左结合</h4>' +
    '<p>规则 <code>expr → term (("+"|"-") term)*</code> 末尾的 <code>*</code> 表示「重复零次或多次」，写成代码就是一个 while 循环。每读完一个运算符和它右边的项，就立刻把当前的左边和这一项合成新节点，新节点成为下一轮的左边。解析 <code>a - b - c</code> 时，读到 b 就先合成 <code>(a - b)</code>，然后才看到第二个 -，再合成 <code>(a - b) - c</code>。同一层的运算这样从左往右组合，叫左结合（left-associative）。代入 a = 10、b = 5、c = 2：(10 - 5) - 2 = 3，符合减法的约定；如果合成了 10 - (5 - 2)，结果是 7。除法也一样，<code>8 / 4 / 2</code> 是 (8 / 4) / 2 = 1。</p>' +
    '<p>如果把规则写成右递归（right recursion）<code>expr → term "-" expr</code>，函数会先递归解析右边的 b - c，得到 <code>a - (b - c)</code>，结合方向就反了。左递归（left recursion）<code>expr → expr "-" term</code> 能表达左结合，但递归下降照着写的话，expr 一进来还没消耗任何 token 就调用自己，会无限递归，所以改写成上面的循环。</p>' +
    '<div class="~exs"><span>到「2 语法分析」里一步步看：</span>' + exBtn('x = b + c * d', 1) + exBtn('x = a - b - c', 1) + exBtn('x = 8 / 4 / 2', 1) + '</div></section>';

  function chip(t, c) {
    return '<li class="~tk' + (c ? ' ~' + c : '') + '"><span class="~tkt">' + t.type + '</span><code class="~tkx">' + (t.type === 'EOF' ? '&nbsp;' : esc(t.text)) +
      '</code><span class="~tkc">第 ' + (t.pos + 1) + ' 列</span></li>';
  }
  function clip(s) { return s.length > 22 ? s.slice(0, 21) + '…' : s; }
  function all() { return true; }

  function drawTree(L, sp, aria) {
    var h = [];
    L.list.forEach(function (n) {
      var a = L.pos[n.id];
      if (!sp.vis(n)) return;
      kids(n).forEach(function (c) {
        if (!sp.vis(c)) return;
        var b = L.pos[c.id];
        h.push('<line' + (sp.fadeE && sp.fadeE(c) ? ' class="~fade"' : '') + ' x1="' + a.x + '" y1="' + (a.y + 14) + '" x2="' + b.x + '" y2="' + (b.y - 14) + '"/>');
      });
    });
    L.list.forEach(function (n) {
      if (!sp.vis(n)) return;
      var a = L.pos[n.id], lab = sp.lab ? sp.lab(n) : label(n), rect = sp.rect ? sp.rect(n) : !isOp(n), w = textW(lab),
        pl = sp.pill && sp.pill(n), pw, px;
      h.push('<g class="~nd' + (rect ? (n.kind === 'num' || isOp(n) ? ' ~num' : '') : ' ~op') + (sp.cls ? sp.cls(n) : '') + '">' +
        (rect ? '<rect x="' + (a.x - w / 2) + '" y="' + (a.y - 14) + '" width="' + w + '" height="28" rx="6"/>' : '<circle cx="' + a.x + '" cy="' + a.y + '" r="' + R0 + '"/>') +
        '<text x="' + a.x + '" y="' + a.y + '">' + esc(lab) + '</text></g>');
      if (pl) {
        pw = pillW(pl); px = a.x + R0 + 3;
        h.push('<g class="~pill"><rect x="' + px + '" y="' + (a.y - 9) + '" width="' + pw + '" height="18" rx="9"/><text x="' + (px + pw / 2) + '" y="' + a.y + '">' + esc(pl) + '</text></g>');
      }
    });
    return '<div class="~svgbox"><svg class="~svg" viewBox="0 0 ' + L.W + ' ' + L.H + '" width="' + L.W + '" height="' + L.H + '" style="min-width:' +
      Math.round(L.W * 0.62) + 'px" role="img" aria-label="' + esc(aria) + '">' + h.join('') + '</svg></div>';
  }

  function visLex(R, k) {
    var L = R.lex, src = R.src, last = k ? L.steps[k - 1] : null, cls = [], h = '', done = [], i, j, t, at, ch, sp;
    L.steps.slice(0, k).forEach(function (s) {
      if (s.err) return;
      t = L.tokens[s.t]; done.push(s);
      for (j = t.pos; j < t.end; j++) cls[j] = s === last ? 'cur' : s.t % 2 ? 'tb' : 'ta';
    });
    if (last) {
      at = last.err ? L.error.pos : L.tokens[last.t].pos;
      for (j = at - last.ws; j < at; j++) cls[j] = 'skip';
      if (last.err) cls[at] = 'err';
    }
    for (i = 0; i < src.length; i += ch.length) {
      ch = String.fromCodePoint(src.codePointAt(i)); sp = /\s/.test(ch);
      h += '<span class="~cell' + (cls[i] ? ' ~' + cls[i] : '') + (sp ? ' ~ws' : '') + '"><b>' + (sp ? '·' : esc(ch)) + '</b><i>' + (i + 1) + '</i></span>';
    }
    if (last && !last.err && L.tokens[last.t].type === 'EOF') h += '<span class="~cell ~cur ~eofc"><b>EOF</b><i>' + (src.length + 1) + '</i></span>';
    return '<div class="~sub">源码（每个字符下面的小数字是列号）</div><div class="~cells">' + h + '</div>' +
      '<div class="~sub">token 列表（' + done.length + ' 个）</div>' + (done.length ? '<ol class="~toks">' +
      done.map(function (s) { return chip(L.tokens[s.t], s === last ? 'eat' : ''); }).join('') + '</ol>' : '<p class="~empty">还没有 token。</p>') + RULES;
  }

  function visParse(R, k, C) {
    if (R.lex.error) return '';
    var Pr = R.parse, N = Pr.nodes, toks = R.lex.tokens, e = k ? Pr.trace[k - 1] : null, p = e ? e.p : 0,
      eat = e && /^(target|eq|leaf|lparen|rparen|op)$/.test(e.k) ? e.tok : -1, bad = e && e.k === 'err' ? e.tok : -1,
      st = e ? e.stack : [], topFn = st.length ? st[st.length - 1].fn : '', built = e ? e.built : 0,
      cur = e && e.node !== undefined ? e.node : -1, h, i, f, info;
    h = '<div class="~sub">token 流：灰色的已经消耗，橙色框是当前 token</div><ol class="~toks">' + toks.map(function (t, j) {
      return chip(t, j === bad ? 'bad' : j === eat ? 'eat' : j < p ? 'used' : j === p ? 'la' : '');
    }).join('') + '</ol><div class="~pg"><div><div class="~sub">文法（高亮的是正在执行的函数）</div><div class="~gram">' +
      GRAM.map(function (g) { return '<div' + (g[0] === topFn ? ' class="~on"' : '') + '>' + esc(g[1]) + '</div>'; }).join('') +
      '</div><div class="~sub">调用栈（最上面是正在执行的函数）</div>';
    if (!st.length) h += '<p class="~empty">空：还没有调用任何函数。</p>';
    for (i = st.length - 1; i >= 0; i--) {
      f = st[i];
      info = f.fn === 'stmt' ? (f.target >= 0 ? '目标 ' + N[f.target].name : '') : f.fn === 'factor' ? (i < st.length - 1 ? '在括号里，等 )' : '') : '左边 ' + (f.left >= 0 ? clip(fmt(N[f.left], true)) : '还没有');
      h += '<div class="~frame' + (i === st.length - 1 ? (e.k === 'err' ? ' ~ferr' : ' ~ftop') : '') + '"><code>' + f.fn + '()</code><span>' + esc(info) + '</span></div>';
    }
    h += '</div><div><div class="~sub">' + (Pr.error ? 'AST：出错前已经建好的节点' : 'AST：已建 ' + built + ' / ' + N.length + ' 个节点') + '</div>';
    if (!N.length) return h + '<p class="~empty">出错前还没有建出任何节点。</p></div></div>';
    return h + drawTree(C.parseL, { vis: function (n) { return n.id < built; }, cls: function (n) { return n.id === cur ? ' ~cur' : ''; } },
      '抽象语法树，已建 ' + built + ' 个节点' + (Pr.root && built === N.length ? '：' + fmt(Pr.root, true) : '')) + legend() + '</div></div>';
  }

  function visTac(R, k, C, on) {
    if (R.error) return '';
    var T = R.tac, name = {}, lines = [], s = k ? T.steps[k - 1] : null, cur = s ? s.node : -1;
    T.steps.slice(0, k).forEach(function (x) {
      name[x.node] = x.k === 'emit' ? x.t : x.k === 'leaf' ? x.name : '=';
      if (x.line !== undefined) lines.push(x.line);
    });
    return '<p class="~note">常量折叠：' + (on ? '开。下面的 AST 已经折叠过，虚线框是折叠算出的常数，过程见「4 常量折叠」。' : '关。下面是 AST 原样翻译的结果。') +
      '</p><div class="~tg"><div><div class="~sub">AST（运算节点右边的小标签：存放它结果的临时变量）</div>' +
      drawTree(C.tacL, {
        vis: all, pill: function (n) { return n.kind === 'bin' && name[n.id] ? name[n.id] : null; },
        cls: function (n) { return (n.id === cur ? ' ~cur' : name[n.id] !== undefined ? ' ~done' : '') + (n.folded ? ' ~fold' : ''); }
      }, '抽象语法树：' + fmt(on ? R.fold.root : R.parse.root, true)) + legend('　淡橙底：后序遍历已经走过' + (on ? '　虚线框：折叠出的常数' : '')) +
      '</div><div><div class="~sub">三地址码</div><div class="~codebox">' + (lines.length ? '<ol class="~lines">' + lines.map(function (ln) {
        return '<li' + (s && ln === s.line ? ' class="~cur"' : '') + '><code>' + esc(T.code[ln]) + '</code></li>';
      }).join('') + '</ol>' : '<p class="~empty">还没有生成指令。</p>') +
      '</div></div></div><div class="~sub">后序遍历的访问顺序：先左子树，再右子树，最后节点自己</div><ol class="~seq">' + T.steps.map(function (x, i) {
        return '<li class="' + (i === k - 1 ? '~sc' : i < k - 1 ? '~sd' : '~st') + '">' + esc(x.k === 'emit' ? x.op : x.k === 'leaf' ? x.name : '=') + '</li>';
      }).join('') + '</ol>';
  }

  function codeList(title, code) {
    return '<div class="~codebox"><div class="~sub">' + title + '（' + code.length + ' 条）</div><ol class="~lines">' +
      code.map(function (c) { return '<li><code>' + esc(c) + '</code></li>'; }).join('') + '</ol></div>';
  }
  function visFold(R, k, C, on) {
    if (R.error) return '';
    if (!on) return '<div class="~off"><p>打开后，这里会逐个检查 AST 里的运算节点，演示哪些能折叠、哪些不能，并对比折叠前后的三地址码。</p>' +
      '<button type="button" class="~b ~pri" data-a="foldon" aria-label="打开常量折叠">打开常量折叠</button></div>' + FOLDTIP;
    var F = R.fold, N = R.parse.nodes, val = {}, fade = {}, seen = {}, cur = k && k <= F.steps.length ? F.steps[k - 1].node : -1;
    function sub(n) { kids(n).forEach(function (c) { fade[c.id] = 1; sub(c); }); }
    F.steps.slice(0, k).forEach(function (s) { seen[s.node] = 1; if (s.k === 'fold') { val[s.node] = s.v; sub(N[s.node]); } });
    return '<div class="~tg"><div><div class="~sub">AST：折成常数的子树变淡，换成虚线框里的结果</div>' + drawTree(C.foldL, {
      vis: all,
      lab: function (n) { return val[n.id] !== undefined ? val[n.id] : label(n); },
      rect: function (n) { return val[n.id] !== undefined || !isOp(n); },
      cls: function (n) { return (n.id === cur ? ' ~cur' : '') + (fade[n.id] ? ' ~fade' : val[n.id] !== undefined ? ' ~fold' : seen[n.id] ? ' ~done' : ''); },
      fadeE: function (c) { return !!fade[c.id]; }
    }, '常量折叠过程中的抽象语法树') + legend('　淡橙底：检查过但保留的运算　虚线框：折叠出的常数　变淡：被折掉的子树') +'</div><div><div class="~sub">折叠前后对比</div><div class="~cmp">' +
      codeList('不折叠', R.plain.code) + codeList('折叠后', R.folded.code) + '</div></div></div>' + FOLDTIP;
  }

  /* ================= 5. 挂载与交互 ================= */
  function injectStyle() {
    if (document.getElementById('dm-style-' + ID)) return;
    var el = document.createElement('style');
    el.id = 'dm-style-' + ID;
    el.textContent = H(CSS).replace(/\$C(\d+)/g, 'color-mix(in srgb,var(--c-compiler) $1%,var(--surface))')
      .replace(/\$R(\d+)/g, 'color-mix(in srgb,var(--div-pos) $1%,var(--surface))');
    document.head.appendChild(el);
  }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (x) { return false; } }
  var NOW = [lexNow, parseNow, tacNow, foldNow], VIS = [visLex, visParse, visTac, visFold], uidSeq = 0;

  function mount(container) {
    injectStyle();
    var uid = ++uidSeq, S = { tab: 0, step: [0, 0, 0, 0], fold: false, R: null, C: null, timer: null, deb: null, gen: 0, view: '' },
      root = document.createElement('div'), inp, cb, status, cnt, nowP, vis, panel, tabs, B = {};
    function btn(a, text, aria, pri) { return '<button type="button" class="~b' + (pri ? ' ~pri' : '') + '" data-a="' + a + '" aria-label="' + aria + '">' + text + '</button>'; }
    root.className = P + 'root';
    root.innerHTML = H('<p class="~how">怎么玩：在输入框里写一行赋值语句，或点一个示例；再选一个阶段标签，用「下一步」看编译器怎样把它一步步变成三地址码。</p>' +
      '<div class="~inrow"><input class="~in" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" maxlength="80" aria-label="源码：一行赋值语句" value="' + esc(EXAMPLES[0]) + '">' +
      '<label class="~sw"><input type="checkbox" class="~cb" aria-label="常量折叠">常量折叠</label></div>' +
      '<div class="~exs"><span>示例：</span>' + EXAMPLES.map(function (v) { return exBtn(v); }).join('') + '</div>' +
      '<div class="~status" aria-live="polite"></div>' +
      '<div class="~tabs" role="tablist" aria-label="编译阶段">' + TABS.map(function (t, i) {
        return '<button type="button" role="tab" class="~tab" id="' + P + uid + '-t' + i + '" aria-controls="' + P + uid + '-p" data-a="tab" data-i="' + i + '">' + tabHTML(i) + '</button>';
      }).join('') + '</div>' +
      '<div class="~panel" role="tabpanel" id="' + P + uid + '-p"><div class="~ctrl">' + btn('reset', '重置', '重置：回到第 0 步') + btn('prev', '上一步', '上一步') +
      btn('next', '下一步', '下一步', 1) + btn('play', '自动播放', '自动播放或暂停') + btn('end', '跳到最后', '跳到最后一步') + '<span class="~cnt"></span></div>' +
      '<div class="~now"><div class="~nowh">现在发生了什么</div><p aria-live="polite"></p></div><div class="~vis"></div></div>' + NOTES);
    container.appendChild(root);
    function q(c) { return root.querySelector('.' + P + c); }
    inp = q('in'); cb = q('cb'); status = q('status'); cnt = q('cnt'); nowP = q('now').querySelector('p'); vis = q('vis'); panel = q('panel');
    tabs = [].slice.call(root.querySelectorAll('[role="tab"]'));
    [].forEach.call(q('ctrl').querySelectorAll('button'), function (b) { B[b.getAttribute('data-a')] = b; });

    function total() {
      var R = S.R;
      return S.tab === 0 ? R.lex.steps.length : S.tab === 1 ? (R.lex.error ? 0 : R.parse.trace.length) :
        R.error ? 0 : S.tab === 2 ? R.tac.steps.length : S.fold ? R.fold.steps.length + 1 : 0;
    }
    function dis(b, v) { b.setAttribute('aria-disabled', v ? 'true' : 'false'); }
    function render() {
      var N = total(), k = S.step[S.tab] = Math.min(S.step[S.tab], N), rm = reduced(),
        old = vis.querySelector('.' + P + 'svgbox'), view = S.tab + '|' + S.gen,
        keep = old && S.view === view ? [old.scrollLeft, old.scrollTop] : null;
      tabs.forEach(function (b, i) { b.setAttribute('aria-selected', i === S.tab ? 'true' : 'false'); b.tabIndex = i === S.tab ? 0 : -1; });
      panel.setAttribute('aria-labelledby', tabs[S.tab].id);
      dis(B.reset, k <= 0); dis(B.prev, k <= 0); dis(B.next, k >= N); dis(B.end, k >= N);
      B.play.disabled = !N || rm;
      B.play.title = rm ? '系统设置了减少动态效果，自动播放已关闭' : '';
      B.play.textContent = S.timer ? '暂停' : '自动播放';
      B.play.setAttribute('aria-pressed', S.timer ? 'true' : 'false');
      cnt.textContent = '第 ' + k + ' / ' + N + ' 步';
      nowP.innerHTML = H(NOW[S.tab](S.R, k, S.fold));
      vis.innerHTML = H(VIS[S.tab](S.R, k, S.C, S.fold));
      // 树比框大时（框两个方向都能滚），把这一步的节点滚到框的中间；这一步没有高亮节点就保持上一步的滚动位置
      var box = vis.querySelector('.' + P + 'svgbox'), c = box && box.querySelector('.' + P + 'cur'), br, cr;
      S.view = view;
      if (!box) return;
      if (c) {
        br = box.getBoundingClientRect(); cr = c.getBoundingClientRect();
        box.scrollLeft += cr.left + cr.width / 2 - br.left - br.width / 2;
        box.scrollTop += cr.top + cr.height / 2 - br.top - br.height / 2;
      } else if (keep) { box.scrollLeft = keep[0]; box.scrollTop = keep[1]; }
    }
    function stop() { if (S.timer) { clearInterval(S.timer); S.timer = null; } }
    function go(k) { stop(); S.step[S.tab] = Math.max(0, Math.min(k, total())); render(); }
    function play() {
      if (S.timer) { stop(); render(); return; }
      if (reduced() || !total()) return;
      if (S.step[S.tab] >= total()) S.step[S.tab] = 0;
      S.timer = setInterval(function () {
        S.step[S.tab] = Math.min(S.step[S.tab] + 1, total());
        if (S.step[S.tab] >= total()) stop();
        render();
      }, 1200);
      render();
    }
    function recompute() {
      var R = S.R = compile(inp.value, S.fold), C = S.C = {}, isKid = {}, tmp = {}, fv = {}, bad = R.error ? (R.error.stage === 'lex' ? 0 : 1) : 9;
      S.gen++;
      if (R.parse) {
        R.parse.nodes.forEach(function (n) { kids(n).forEach(function (c) { isKid[c.id] = 1; }); });
        C.parseL = layout(R.parse.nodes.filter(function (n) { return !isKid[n.id]; }), baseW);
      }
      if (!R.error) {
        R.tac.steps.forEach(function (s) { if (s.k === 'emit') tmp[s.node] = s.t; });
        C.tacL = layout([S.fold ? R.fold.root : R.parse.root], baseW, function (n) { return tmp[n.id] ? pillW(tmp[n.id]) + 5 : 0; });
        R.fold.steps.forEach(function (s) { if (s.k === 'fold') fv[s.node] = s.v; });
        C.foldL = layout([R.parse.root], function (n) { return fv[n.id] !== undefined ? textW(fv[n.id]) : baseW(n); });
      }
      status.innerHTML = H(statusHTML(R, S.fold));
      tabs.forEach(function (b, i) {
        b.innerHTML = H(tabHTML(i, i === bad) + (i === bad ? '<span class="~sr">（出错）</span>' : i > bad ? '<span class="~sr">（前一阶段出错，不可用）</span>' : ''));
        b.classList.toggle(P + 'na', i > bad);
      });
    }
    function refresh(all) {
      stop(); recompute();
      if (all) S.step = [0, 0, 0, 0]; else S.step[2] = S.step[3] = 0;
      render();
    }
    function selectTab(i) { if (i !== S.tab) { stop(); S.tab = i; render(); } }

    function onClick(ev) {
      var b = ev.target.closest ? ev.target.closest('button') : null, a, t;
      if (!b || !root.contains(b) || b.getAttribute('aria-disabled') === 'true') return;
      a = b.getAttribute('data-a');
      if (a === 'ex') {
        inp.value = b.getAttribute('data-v'); clearTimeout(S.deb);
        if (b.getAttribute('data-fold')) cb.checked = S.fold = true;
        refresh(true);
        t = b.getAttribute('data-tab');
        if (t !== null) { selectTab(+t); tabs[+t].scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); }
      } else if (a === 'tab') selectTab(+b.getAttribute('data-i'));
      else if (a === 'foldon') { cb.checked = S.fold = true; refresh(false); B.next.focus(); }
      else if (a === 'play') play();
      else if (a === 'reset') go(0);
      else if (a === 'prev') go(S.step[S.tab] - 1);
      else if (a === 'next') go(S.step[S.tab] + 1);
      else if (a === 'end') go(total());
    }
    function onInput(ev) { if (ev.target === inp) { clearTimeout(S.deb); S.deb = setTimeout(function () { refresh(true); }, 300); } }
    function onChange(ev) { if (ev.target === cb) { S.fold = cb.checked; refresh(false); } }
    function onKey(ev) {
      var t = ev.target, i = S.tab;
      if (t === inp && ev.key === 'Enter') { ev.preventDefault(); clearTimeout(S.deb); refresh(true); return; }
      if (!t.getAttribute || t.getAttribute('role') !== 'tab') return;
      if (ev.key === 'ArrowRight') i = (i + 1) % 4; else if (ev.key === 'ArrowLeft') i = (i + 3) % 4;
      else if (ev.key === 'Home') i = 0; else if (ev.key === 'End') i = 3; else return;
      ev.preventDefault(); selectTab(i); tabs[i].focus();
    }
    root.addEventListener('click', onClick); root.addEventListener('input', onInput);
    root.addEventListener('change', onChange); root.addEventListener('keydown', onKey);
    refresh(true);
    return {
      destroy: function () {
        stop(); clearTimeout(S.deb);
        root.removeEventListener('click', onClick); root.removeEventListener('input', onInput);
        root.removeEventListener('change', onChange); root.removeEventListener('keydown', onKey);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  window.KGDemos[ID] = {
    title: '迷你编译器：源码 → Token → AST → 三地址码',
    mount: mount,
    selfTest: selfTest
  };
})();
