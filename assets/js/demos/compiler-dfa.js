/* compiler-dfa。模式一：单个 DFA 整串判定；模式二：5 台 DFA + 最长匹配 + 关键字表切 token。
 * 「12.」：小数要求小数点后有数字，所以切出 NUMBER（整数）12，退回「.」；
 * 「.」不能开头任何 token，报第 3 列非法字符，跳过它继续。 */
(function () {
  'use strict';
  var P = 'dm-compiler-dfa-', uid = 0;
  window.KGDemos = window.KGDemos || {};

  // 字符类
  function isL(c) { return /^[A-Za-z]$/.test(c); }
  function isD(c) { return /^[0-9]$/.test(c); }
  function C(label, t) { return { label: label, t: t }; }
  function lit(x) { return C(x, function (c) { return c === x; }); }
  var LU = C('A-Z a-z _', function (c) { return isL(c) || c === '_'; });
  var LUD = C('A-Z a-z 0-9 _', function (c) { return isL(c) || isD(c) || c === '_'; });
  var DG = C('0-9', isD);
  var SP = C('空格 Tab', function (c) { return c === ' ' || c === '\t'; });

  // 5 台手工构造的 DFA（坐标是 SVG viewBox 里的位置）
  function S(x, y, d, tok, sub, tg) { return { x: x, y: y, d: d, tok: tok, sub: sub, tg: tg }; }
  var DFAS = [
    { id: 'ident', name: '标识符', rule: '[A-Za-z_][A-Za-z0-9_]*', note: '字母或下划线开头，后面跟任意多个字母、数字、下划线。',
      vb: [320, 150], r: 20, ex: ['x2', 'count', '_tmp1', '2x', 'a-b'],
      st: { q0: S(80, 95, '还没读到字符'), q1: S(250, 95, '已经读到一个合法的标识符', 'IDENT') },
      ed: [['q0', 'q1', LU], ['q1', 'q1', LUD]] },
    { id: 'int', name: '整数', rule: '[0-9]+', note: '至少 1 个数字。',
      vb: [320, 150], r: 20, ex: ['2024', '7', '12a', '12.5'],
      st: { q0: S(80, 95, '还没读到数字'), q1: S(250, 95, '已经读到至少 1 个数字', 'NUMBER', '整数') },
      ed: [['q0', 'q1', DG], ['q1', 'q1', DG]] },
    { id: 'float', name: '小数', rule: '[0-9]+\\.[0-9]+', note: '小数点前后都至少要有 1 个数字。',
      vb: [410, 150], r: 20, ex: ['12.5', '3.14', '12.', '.5', '1.2.3'],
      st: { q0: S(65, 95, '还没读到数字'), q1: S(160, 95, '读到了整数部分，还没遇到小数点'),
        q2: S(255, 95, '刚读完小数点，后面还需要至少 1 个数字'), q3: S(350, 95, '小数点后面已经有数字', 'NUMBER', '小数') },
      ed: [['q0', 'q1', DG], ['q1', 'q1', DG], ['q1', 'q2', lit('.')], ['q2', 'q3', DG], ['q3', 'q3', DG]] },
    { id: 'op', name: '运算符', rule: '+ - * / = == < <=', note: '8 种运算符，每个接受态对应一种 token。',
      vb: [360, 356], r: 18, ex: ['<=', '==', '+', '=<', '<<'],
      st: { q0: S(64, 168, '还没读到字符'),
        q1: S(180, 30, '读到了「+」', 'PLUS', '', 'r'), q2: S(180, 82, '读到了「-」', 'MINUS', '', 'r'),
        q3: S(180, 134, '读到了「*」', 'MUL', '', 'r'), q4: S(180, 186, '读到了「/」', 'DIV', '', 'r'),
        q5: S(180, 238, '读到了「=」，再来一个「=」就能到 q7', 'ASSIGN', '', [16, 32]),
        q6: S(180, 306, '读到了「<」，再来一个「=」就能到 q8', 'LT'),
        q7: S(300, 238, '读到了「==」', 'EQ', '', 'r'), q8: S(300, 306, '读到了「<=」', 'LE', '', 'r') },
      ed: [['q0', 'q1', lit('+'), 0.62], ['q0', 'q2', lit('-'), 0.62], ['q0', 'q3', lit('*'), 0.62],
        ['q0', 'q4', lit('/'), 0.62], ['q0', 'q5', lit('='), 0.62], ['q0', 'q6', lit('<'), 0.62],
        ['q5', 'q7', lit('=')], ['q6', 'q8', lit('=')]] },
    { id: 'ws', name: '空白', rule: '[ \\t]+', note: '至少 1 个空格或 Tab。',
      vb: [320, 150], r: 20, ex: ['   ', ' x'],
      st: { q0: S(80, 95, '还没读到空白'), q1: S(250, 95, '已经读到至少 1 个空格或 Tab', 'WS', '跳过') },
      ed: [['q0', 'q1', SP], ['q1', 'q1', SP]] }
  ];
  var OP = DFAS[3], KW = ['if', 'while', 'return'];
  var PRE = [['默认', 'count = count + 12.5 <= x2'], ['关键字和 ifx', 'if x2 < 10 return ifx'],
    ['「12.」怎么切', 'y = 12.'], ['不加空格', 'a<=b==c'], ['非法字符', 'a = b @ 3']];

  // 计算核心（不碰 DOM）
  function edge(d, s, c) {
    for (var i = 0; i < d.ed.length; i++) if (d.ed[i][0] === s && d.ed[i][2].t(c)) return d.ed[i];
    return null;
  }
  // 单个 DFA 整串判定；last = 最后一次在接受态时已读的字符数
  function runSteps(d, s) {
    var out = [{ k: 'init', s: 'q0' }], cur = 'q0', last = 0;
    for (var i = 0; i < s.length; i++) {
      var e = edge(d, cur, s[i]);
      if (!e) { out.push({ k: 'stuck', i: i, s: cur, last: last }); return out; }
      cur = e[1];
      if (d.st[cur].tok) last = i + 1;
      out.push({ k: 'read', i: i, from: e[0], s: cur, e: e });
    }
    out.push({ k: 'end', s: cur, acc: !!d.st[cur].tok, last: last });
    return out;
  }
  // 从 pos 读到无边可走，len = 最长能接受的前缀长度
  function longest(d, s, pos) {
    var cur = 'q0', path = [], len = 0, acc = null, i = pos;
    for (; i < s.length; i++) {
      var e = edge(d, cur, s[i]);
      if (!e) break;
      cur = e[1]; path.push(cur);
      if (d.st[cur].tok) { len = i - pos + 1; acc = cur; }
    }
    return { d: d, read: i - pos, stop: i, len: len, acc: acc, path: path };
  }
  // 最长匹配；一样长按 DFAS 顺序（标识符在前），再查关键字表。按码位切数组：emoji 只算 1 列
  function lex(s) {
    s = Array.from(s);
    var pos = 0, rounds = [], tokens = [], errors = [];
    while (pos < s.length) {
      var res = DFAS.map(function (d) { return longest(d, s, pos); }), win = null, rd;
      res.forEach(function (r) { if (r.len > 0 && (!win || r.len > win.len)) win = r; });
      rd = { pos: pos, res: res, win: win, maxRead: Math.max.apply(null, res.map(function (r) { return r.read; })) };
      if (!win) {
        rd.kind = 'err'; rd.lex = s[pos];
        errors.push({ col: pos + 1, ch: s[pos] });
        pos += 1;
      } else {
        rd.lex = s.slice(pos, pos + win.len).join('');
        var a = win.d.st[win.acc];
        if (a.tok === 'WS') rd.kind = 'ws';
        else {
          rd.kind = 'tok';
          rd.tok = { type: a.tok === 'IDENT' && KW.indexOf(rd.lex) >= 0 ? 'KEYWORD' : a.tok, sub: a.sub || '', lex: rd.lex, col: pos + 1 };
          tokens.push(rd.tok);
        }
        pos += win.len;
      }
      rd.next = pos;
      rounds.push(rd);
    }
    return { rounds: rounds, tokens: tokens, errors: errors };
  }

  // 文本工具
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function vis(s) { return (s.join ? s.join('') : String(s)).replace(/ /g, '␣').replace(/\t/g, '⇥'); }
  function q(c) { return c === ' ' ? '空格' : c === '\t' ? 'Tab' : '「' + c + '」'; }
  function qs(s) { return '「' + vis(s) + '」'; }
  function tokName(t, sub) { return t + (sub ? '（' + sub + '）' : ''); }
  function rdc(i, c) { return '读第 ' + (i + 1) + ' 个字符' + (c === ' ' || c === '\t' ? '，是' + q(c) : q(c)) + '。'; }
  function k(n) { return 'class="' + n.split(' ').map(function (x) { return P + x; }).join(' ') + '"'; }

  // 「现在发生了什么」：模式一
  function t1(d, s, x) {
    var n = s.length, st = d.st[x.s], c = s[x.i];
    if (x.k === 'init') {
      return n ? '输入' + qs(s) + '共 ' + n + ' 个字符。DFA（确定有限自动机，deterministic finite automaton）从「开始」箭头指着的 q0 出发。规则：每读一个字符，就沿标签包含这个字符的那条边走一步（「确定」指这样的边最多只有一条）；读完时停在双圈的接受态（accepting state）上就接受，否则拒绝；半路没有边可走，也拒绝。'
        : '输入是空串，一个字符也没有，DFA 停在起始状态 q0。';
    }
    if (x.k === 'read') {
      var lp = x.from === x.s;
      return rdc(x.i, c) + x.from + (lp ? ' 的自环' : ' 到 ' + x.s + ' 的边') + '标着「' + x.e[2].label + '」，' + q(c) + '在其中，所以' +
        (lp ? '沿自环回到 ' + x.s + '，状态不变。' : '走到 ' + x.s + '。') +
        (st.tok ? x.s + ' 是接受态：如果输入到这里就结束，' + qs(s.slice(0, x.i + 1)) + '会被接受。'
          : x.s + ' 不是接受态（' + st.d + '），如果输入到这里就结束，会被拒绝。');
    }
    if (x.k === 'stuck') {
      var outs = d.ed.filter(function (e) { return e[0] === x.s; }).map(function (e) { return '「' + e[2].label + '」'; });
      var t = rdc(x.i, c) + (outs.length ? x.s + ' 的出边只认' + outs.join('、') + '，' + q(c) + '不在其中' : x.s + ' 没有任何出边') +
        '，DFA 无路可走，卡住了。图里没画出来的边其实都通向一个省略掉的死状态（dead state），进去就再也出不来，所以卡住就等于拒绝' + (x.i + 1 < n ? '，后面的' + qs(s.slice(x.i + 1)) + '不用再读' : '') +
        '。原因：在 ' + x.s + '（' + st.d + '）时，' + d.name + '的规则不允许出现' + q(c) + '。';
      if (x.last) {
        t += '前 ' + x.last + ' 个字符' + qs(s.slice(0, x.last)) + '本身是合法的' + d.name + '。单个 DFA 判断的是整串，所以这里拒绝；词法分析器只要求前缀能被接受：单看这台 DFA，它能切下' +
          qs(s.slice(0, x.last)) + '，实际切多长还要和其他 DFA 比（见「词法分析器」）。';
      }
      return t;
    }
    if (!n) return '没有字符可读，停在 q0。q0 不是接受态，所以拒绝：空串不是合法的' + d.name + '。';
    if (!x.acc) return '全部 ' + n + ' 个字符读完，停在 ' + x.s + '。' + x.s + ' 不是接受态（' + st.d + '），所以拒绝：' + qs(s) + '不是合法的' + d.name + '。';
    return '全部 ' + n + ' 个字符读完，停在 ' + x.s + '。' + x.s + ' 是双圈的接受态，所以接受：' + qs(s) + '是合法的' + d.name + '。' +
      (st.tok === 'IDENT' ? (KW.indexOf(s.join('')) >= 0 ? '不过它在关键字表里，词法分析器会记作 KEYWORD。' : '词法分析器会记作 IDENT。')
        : st.tok === 'WS' ? '词法分析器读到空白会直接跳过，不产出 token。' : '词法分析器会产出 ' + tokName(st.tok, st.sub) + '。');
  }

  // 「现在发生了什么」：模式二
  function t2(s, lx, x) {
    if (x.k === 'init') {
      return s.length ? '输入共 ' + s.length + ' 个字符，起点在第 1 列。词法分析器（lexer）每一轮切出一段：5 台 DFA 都从起点往后读，各自记下最长能接受的前缀，再取其中最长的一段。这条规则叫最长匹配（longest match，也叫 maximal munch）。切下的这段叫词素（lexeme），配上类型（IDENT、NUMBER、LE 等）就是一个 token（词法单元）；词素恰好是 if、while 或 return 时，类型记作 KEYWORD。然后起点移到这段后面，开始下一轮。'
        : '输入是空的，没有可切的字符。';
    }
    if (x.k === 'done') {
      var ty = lx.tokens.map(function (t) { return t.type; }), ne = lx.errors.length,
        nws = lx.rounds.filter(function (r) { return r.kind === 'ws'; }).length;
      return '整行 ' + s.length + ' 个字符处理完：切出 ' + ty.length + ' 个 token，跳过 ' + nws + ' 段空白，' +
        (ne ? '有 ' + ne + ' 处词法错误（' + lx.errors.map(function (e) { return '第 ' + e.col + ' 列' + q(e.ch); }).join('、') + '）。' : '没有词法错误。') +
        (ty.length ? '语法分析器（parser）拿到的就是下面这串 token' + (ne ? '（红色虚线框是错误记录，不算 token）' : '') + '：检查语法时看类型序列「' +
          ty.slice(0, 7).join(' ') + (ty.length > 7 ? ' …' : '') + '」，要分清是哪个关键字、哪个变量、哪个数时再看词素。' : '');
    }
    var rd = x.rd, col = rd.pos + 1, c0 = s[rd.pos], parts = [], idle = 0, t = '起点是第 ' + col + ' 列的' + q(c0) + '。';
    if (rd.kind === 'err') {
      return t + '5 台 DFA 读第一个字符就全部卡住，没有哪种 token 能以' + q(c0) + '开头。报错：第 ' + col + ' 列有非法字符' + q(c0) +
        '。这里的做法是记下错误、跳过这 1 个字符，' + (rd.next < s.length ? '从第 ' + (rd.next + 1) + ' 列接着切，这样一行里有几处错误都能报出来。' : '它已经是最后一个字符，整行到此结束。');
    }
    rd.res.forEach(function (r) {
      if (!r.read) { idle++; return; }
      parts.push(r.d.name + ' DFA 读了' + qs(s.slice(rd.pos, rd.pos + r.read)) + '，' +
        (r.stop < s.length ? '遇到第 ' + (r.stop + 1) + ' 列的' + q(s[r.stop]) + '没有边可走' : '读到了行尾') + '，' +
        (r.len ? '最长能接受' + qs(s.slice(rd.pos, rd.pos + r.len)) + '（' + r.len + ' 个字符）'
          : '这时停在 ' + r.path[r.path.length - 1] + '，一次也没到过接受态，不算匹配'));
    });
    t += parts.join('；') + (idle ? '；其余 ' + idle + ' 台读第一个字符就卡住了。' : '。');
    var w = rd.win, lm = rd.lex;
    if (rd.res.filter(function (r) { return r.len; }).length > 1) t += '最长的是' + w.d.name + ' DFA 的' + qs(lm) + '。';
    if (rd.kind === 'ws') t += '空白只用来分隔单词，不产出 token，直接跳过。';
    else if (w.d.id === 'ident') {
      if (rd.tok.type === 'KEYWORD') t += '查关键字表：' + qs(lm) + '在表里，关键字优先于标识符，产出 KEYWORD' + qs(lm) + '。';
      else {
        t += '查关键字表：' + qs(lm) + '不在表里（表里只有 if、while、return），产出 IDENT' + qs(lm) + '。';
        var kp = KW.filter(function (kw) { return lm.length > kw.length && lm.indexOf(kw) === 0; })[0];
        if (kp) t += '它的前 ' + kp.length + ' 个字符' + qs(kp) + '恰好是关键字，但最长匹配先定下这段切到哪里，切出的是完整的' + qs(lm) + '，不会切成 ' + kp + ' 加 ' + lm.slice(kp.length) + '。';
      }
    } else if (w.d.id === 'op' && w.path.length > 1 && OP.st[w.path[0]].tok) {
      var p1 = w.path[0], pcs = lm.split('').map(function (ch) { return OP.st[edge(OP, 'q0', ch)[1]].tok; });
      t += '运算符 DFA 读完' + qs(lm[0]) + '时已经在接受态 ' + p1 + '（' + OP.st[p1].tok + '），它没有停，又读了' + qs(lm[1]) + '到达接受态 ' + w.acc + '（' + rd.tok.type +
        '）。取最长的一次，产出一个 ' + rd.tok.type + qs(lm) + '，不会切成' + (pcs[0] === pcs[1] ? '两个 ' + pcs[0] : ' ' + pcs.join(' 和 ') + ' 两个 token') + '。';
    } else t += '产出 ' + tokName(rd.tok.type, rd.tok.sub) + qs(lm) + '。';
    if (rd.maxRead > lm.length) {
      var fr = rd.res.filter(function (r) { return r.read === rd.maxRead; })[0];
      t += qs(s.slice(rd.pos + lm.length, rd.pos + rd.maxRead)) + '已经被' + fr.d.name + ' DFA 读过，现在退回去，留给下一轮重新读。';
    }
    return t + (rd.next < s.length ? '下一轮从第 ' + (rd.next + 1) + ' 列开始。' : '已经到行尾。');
  }

  // 状态图 SVG
  function f(n) { return Math.round(n * 10) / 10; }
  function tw(s) { var w = 0; for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 0x2000 ? 12 : 7.9; return w; }
  function mk(id, col) {
    return '<marker id="' + id + '" viewBox="0 0 10 10" refX="3" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,1L10,5L0,9z" style="fill:' + col + '"/></marker>';
  }
  function svg(d, cur, hiE, mark, aid) {
    var r = d.r, o = [], lab = [], z = d.st.q0;
    o.push('<svg ' + k('svg') + ' viewBox="0 0 ' + d.vb[0] + ' ' + d.vb[1] + '" style="max-width:' + Math.round(d.vb[0] * 1.15) +
      'px" role="img" aria-label="' + d.name + ' DFA 的状态图，当前在 ' + cur + '">');
    o.push('<defs>' + mk(aid + 'n', 'var(--edge-strong)') + mk(aid + 'h', 'var(--c-compiler)') + '</defs>');
    o.push('<path ' + k('e') + ' d="M' + (z.x - r - 40) + ',' + z.y + 'H' + (z.x - r - 7) + '" marker-end="url(#' + aid + 'n)"/>');
    o.push('<text ' + k('sl') + ' x="' + (z.x - r - 20) + '" y="' + (z.y - 10) + '">开始</text>');
    var eds = d.ed.filter(function (e) { return e !== hiE; });
    if (hiE) eds.push(hiE);
    eds.forEach(function (e) {
      var a = d.st[e[0]], b = d.st[e[1]], hi = e === hiE, p, lx, ly, L1 = e[2].label;
      if (a === b) { // 自环：从圆的左上方出发，绕到右上方回来
        var tx = a.x + 0.5 * r, ty = a.y - 0.866 * r, cx = a.x + 30, cy = a.y - r - 44, vx = tx - cx, vy = ty - cy, vl = Math.hypot(vx, vy);
        p = 'M' + f(a.x - 0.574 * r) + ',' + f(a.y - 0.819 * r) + 'C' + (a.x - 30) + ',' + cy + ' ' + cx + ',' + cy + ' ' + f(tx - 7 * vx / vl) + ',' + f(ty - 7 * vy / vl);
        lx = a.x; ly = a.y - r - 47;
      } else {
        var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, t = e[3] || 0.5;
        p = 'M' + f(a.x + ux * r) + ',' + f(a.y + uy * r) + 'L' + f(b.x - ux * (r + 7)) + ',' + f(b.y - uy * (r + 7));
        lx = a.x + dx * t + 11 * uy; ly = a.y + dy * t - 11 * ux;
      }
      o.push('<path ' + k('e' + (hi ? ' hi' : '')) + ' d="' + p + '" marker-end="url(#' + aid + (hi ? 'h' : 'n') + ')"/>');
      lab.push('<text ' + k('el' + (hi ? ' hi' : '') + (L1 === '.' ? ' dot' : L1.length === 1 ? ' one' : '')) + ' x="' + f(lx) + '" y="' + f(L1 === '.' ? ly + 5 : ly) + '">' + esc(L1) + '</text>');
    });
    Object.keys(d.st).forEach(function (n) {
      var s = d.st[n];
      o.push('<g ' + k('st' + (n === cur ? ' cur' + (mark ? ' ' + mark : '') : '')) + '><circle ' + k('o') + ' cx="' + s.x + '" cy="' + s.y + '" r="' + r + '"/>' +
        (s.tok ? '<circle ' + k('i') + ' cx="' + s.x + '" cy="' + s.y + '" r="' + (r - 4) + '"/>' : '') +
        '<text ' + k('sn') + ' x="' + s.x + '" y="' + s.y + '">' + n + '</text></g>');
      if (s.tok) {
        var tt = tokName(s.tok, s.sub), w = tw(tt) + 10, cx, cy;
        if (s.tg === 'r') { cx = s.x + r + 6 + w / 2; cy = s.y; } else if (s.tg) { cx = s.x + s.tg[0]; cy = s.y + s.tg[1]; } else { cx = s.x; cy = s.y + r + 17; }
        lab.push('<g ' + k('tag') + '><rect x="' + f(cx - w / 2) + '" y="' + (cy - 9) + '" width="' + f(w) + '" height="18" rx="9"/><text x="' + f(cx) + '" y="' + cy + '">' + tt + '</text></g>');
      }
    });
    return o.concat(lab).join('') + '</svg>';
  }

  // 小部件
  function sp(c, h) { return '<span ' + k(c) + '>' + h + '</span>'; }
  function cellH(c, col, cls) { return sp('cw' + (cls ? ' ' + cls : ''), sp('ch', esc(vis(c))) + sp('ix', col)); }
  function arr(c) { return ' ' + sp('c', esc(vis(c))) + '→ '; }
  function stH(d, n) { return sp('s' + (d.st[n].tok ? ' acc' : ''), n); }
  function seg(s, a, n, cls, cap, top) {
    for (var i = a, h = ''; i < a + n; i++) h += cellH(s[i], i + 1, '');
    return sp('seg' + (cls ? ' ' + cls : ''), sp('top', top) + sp('cells', h) + sp('cap', esc(cap)));
  }
  function resRow(s, rd, r) {
    var win = r === rd.win, p = sp('s', 'q0');
    r.path.forEach(function (sn, i) { p += arr(s[rd.pos + i]) + stH(r.d, sn); });
    p += '，' + (r.stop < s.length ? '下一个' + esc(q(s[r.stop])) + '无边可走' : '到行尾');
    return '<div ' + k('res' + (win ? ' win' : '')) + '>' + sp('rn', r.d.name) + '<span>' +
      (r.len ? '最长接受 <code>' + esc(vis(s.slice(rd.pos, rd.pos + r.len))) + '</code>，' + r.len + ' 个字符' + (win ? sp('badge win', '最长，选它') : '')
        : sp('muted', '没有能接受的前缀')) + sp('path', p) + '</span></div>';
  }

  // 样式（._ 会替换成 .dm-compiler-dfa-）
  var CSS = [
    '._root{--acc:var(--c-compiler);--a9:color-mix(in srgb,var(--acc) 9%,var(--surface));--a15:color-mix(in srgb,var(--acc) 15%,var(--surface));--a22:color-mix(in srgb,var(--acc) 22%,var(--surface));--r14:color-mix(in srgb,var(--div-pos) 14%,var(--surface));font-size:15px;line-height:1.7;color:var(--text);container-type:inline-size}',
    '._root *{box-sizing:border-box;font-variant-ligatures:none}._root [hidden]{display:none!important}._root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}',
    '._howto{margin:0 0 12px;color:var(--text-2)}._tabs{display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin:0 0 12px}',
    '._tabs button{font:inherit;border:0;padding:6px 16px;background:var(--surface);color:var(--text-2);cursor:pointer}._tabs button+button{border-left:1px solid var(--border)}._tabs [aria-pressed=true]{background:var(--a15);color:var(--text);font-weight:600}',
    '._card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px}._row{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}',
    '._field{display:flex;align-items:center;gap:8px;color:var(--text-2);min-width:0}._grow{flex:1 1 280px}',
    '._root select,._root input{font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--edge-strong);border-radius:6px;padding:3px 8px;min-width:0}._root input{font-family:var(--mono);width:12em}._grow input{flex:1;width:auto}',
    '._ex{margin-top:10px;gap:6px;font-size:13.5px;color:var(--text-3)}._chip{font:inherit;font-size:13px;padding:1px 10px;border:1px solid var(--border);border-radius:999px;background:var(--surface-2);color:var(--text);cursor:pointer}',
    '._mono{font-family:var(--mono)}._muted{color:var(--text-3)}._rule{margin-top:8px;font-size:14px;color:var(--text-2)}',
    '._root code{font-family:var(--mono);font-size:.95em;background:var(--surface-2);padding:1px 6px;border-radius:4px;color:var(--text)}._fig svg{display:block;width:100%;height:auto;margin:8px auto 0}',
    '._svg text{font-family:var(--mono)}._svg ._e{fill:none;stroke:var(--edge-strong);stroke-width:1.5}._svg ._e._hi{stroke:var(--acc);stroke-width:3}',
    '._svg ._el{font-size:15px;fill:var(--text-2);text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round}._svg ._el._hi{fill:var(--text);font-weight:700}',
    '._svg ._el._one{font-size:17px;font-weight:700}._svg ._el._dot{font-size:30px;font-weight:700;dominant-baseline:auto}._svg ._sl{font-family:var(--font);font-size:12px;fill:var(--text-3);text-anchor:middle}',
    '._svg ._o{fill:var(--surface);stroke:var(--text-2);stroke-width:1.5}._svg ._i{fill:none;stroke:var(--text-2);stroke-width:1.5}._svg ._cur ._o{fill:var(--a22);stroke:var(--acc);stroke-width:3.5}',
    '._svg ._cur._ok ._o{stroke:var(--good)}._svg ._cur._bad ._o{stroke:var(--div-pos);stroke-dasharray:6 3}',
    '._svg ._sn{font-family:var(--font);font-size:15px;font-weight:600;fill:var(--text);text-anchor:middle;dominant-baseline:central}',
    '._svg ._tag rect{fill:var(--surface-2);stroke:var(--border)}._svg ._tag text{font-family:var(--font);font-size:12px;fill:var(--text-2);text-anchor:middle;dominant-baseline:central}',
    '._legend{font-size:12.5px;color:var(--text-3);text-align:center;margin:2px 0 10px}._tape{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:4px 0 8px}',
    '._cw{display:flex;flex-direction:column;align-items:center;width:26px}._ix{font-size:10.5px;color:var(--text-3);line-height:1.5}',
    '._ch{width:26px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:5px;background:var(--surface);font-family:var(--mono);font-size:16px;color:var(--text)}',
    '._done ._ch{background:var(--a9);color:var(--text-2)}._cw._cur ._ch{border:2px solid var(--acc);background:var(--a22);font-weight:700}._cw._bad ._ch{border:2px solid var(--div-pos);background:var(--r14);font-weight:700}',
    '._stat{font-size:14px;color:var(--text-2);text-align:center}._stat b{color:var(--text)}._path{display:block;font-size:13px;color:var(--text-2);line-height:2}',
    '._s{font-family:var(--mono);font-size:12.5px;padding:0 5px;border:1px solid var(--edge-strong);border-radius:9px;color:var(--text);white-space:nowrap}._s._acc{border:3px double var(--edge-strong)}._s._bad{border:1.5px dashed var(--div-pos)}',
    '._c{font-family:var(--mono);font-size:12.5px;padding:0 4px;background:var(--surface-2);border-radius:3px;color:var(--text)}',
    '._badge{display:inline-block;font-size:12.5px;line-height:1.6;padding:0 8px;margin-left:8px;border-radius:999px;border:1.5px solid var(--border);color:var(--text)}',
    '._badge._ok{border-color:var(--good);background:color-mix(in srgb,var(--good) 14%,var(--surface))}._badge._bad{border-color:var(--div-pos);background:var(--r14)}._badge._win{border-color:var(--acc);background:var(--a15)}',
    '._tape2{justify-content:flex-start;gap:2px 4px;margin-top:12px}._seg{display:flex;flex-direction:column;align-items:flex-start}._cells{display:flex;gap:2px;padding:4px 0}',
    '._seg ._cw,._seg ._ch{width:23px}._seg ._ch{height:30px}._gws ._ch{color:var(--text-3)}._seg._back ._ch{border:1.5px dashed var(--text-3)}',
    '._gtok ._cells,._gerr ._cells,._seg._cur ._cells{padding:2px;border:2px solid color-mix(in srgb,var(--acc) 40%,var(--surface));border-radius:8px}._gtok ._cells{background:var(--a9)}',
    '._seg._gerr ._cells{border:2px dashed var(--div-pos)}._seg._cur ._cells{border-color:var(--acc);background:var(--a22)}._seg._gerr._cur ._cells{border-color:var(--div-pos);background:var(--r14)}',
    '._top,._cap{height:17px;line-height:17px;padding-left:3px;white-space:nowrap}._top{font-size:11.5px;font-weight:600;color:var(--text)}._cap{font-family:var(--mono);font-size:11px;color:var(--text-2)}',
    '._ctrl{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}._btn{font:inherit;padding:5px 14px;border:1px solid var(--edge-strong);border-radius:8px;background:var(--surface);color:var(--text);cursor:pointer}',
    '._btn._pri{border-color:var(--acc);background:var(--a15);font-weight:600}._btn:disabled,._btn[aria-disabled=true]{opacity:.45;cursor:default}._count{color:var(--text-3);font-size:13.5px;margin-left:auto}',
    '._explain{background:var(--surface-2);border:1px solid var(--border);border-left:4px solid var(--edge-strong);border-radius:8px;padding:10px 14px}._explain._ok{border-left-color:var(--good)}._explain._bad{border-left-color:var(--div-pos)}',
    '._eh{font-size:13px;font-weight:600;color:var(--text-2)}._explain p{margin:4px 0 0}._sub{font-size:13.5px;font-weight:600;color:var(--text-2);margin:16px 0 6px}',
    '._res{display:grid;grid-template-columns:4em 1fr;gap:0 10px;padding:6px 10px;border-left:3px solid transparent;border-radius:6px}._res+._res{border-top:1px solid var(--border)}._res._win{border-left-color:var(--acc);background:var(--a9)}',
    '._rn{font-weight:600;color:var(--text)}._kw{padding:8px 10px 0;font-size:14px;color:var(--text-2)}._toks{display:flex;flex-wrap:wrap;gap:6px}',
    '._tok{display:inline-flex;flex-direction:column;padding:2px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface)}._tt{font-size:11.5px;color:var(--text-2);white-space:nowrap}',
    '._tok code{background:none;padding:0;font-size:15px}._tok._new{border:2px solid var(--acc)}._tok._err{border:1.5px dashed var(--div-pos)}',
    '@container (max-width:520px){._svg ._el{font-size:17px}._svg ._el._one{font-size:19px}._svg ._sn{font-size:16px}._cw,._ch{width:21px}._ch{height:28px;font-size:14px}._seg ._cw,._seg ._ch{width:20px}._field{flex:1 1 100%}._root input{flex:1;width:auto}._count{margin-left:0;width:100%}._res{grid-template-columns:3.6em 1fr;padding:6px}}'
  ].join('').replace(/\._/g, '.' + P);

  // 挂载
  function mount(container) {
    if (!document.getElementById('dm-style-compiler-dfa')) {
      var se = document.createElement('style');
      se.id = 'dm-style-compiler-dfa'; se.textContent = CSS;
      document.head.appendChild(se);
    }
    var aid = P + 'm' + (++uid), root = document.createElement('div'), timer = null, mode = 1, m1 = { d: 0 }, m2 = {};
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    root.className = P + 'root';
    root.innerHTML =
      '<p ' + k('howto') + '>怎么玩：在「单个 DFA」里选一台 DFA、输入一串字符，按「下一步」看它一个字符一个字符地走，读完判定接受还是拒绝。切到「词法分析器」，看 5 台 DFA 怎样合作把一行代码切成 token。键盘 ← → 也能单步；␣ 表示空格，⇥ 表示 Tab。</p>' +
      '<div ' + k('tabs') + ' role="group" aria-label="选择演示模式"><button type="button" data-r="t1" aria-pressed="true">单个 DFA</button><button type="button" data-r="t2" aria-pressed="false">词法分析器</button></div>' +
      '<div ' + k('card') + ' data-r="m1"><div ' + k('row') + '><label ' + k('field') + '>DFA<select data-r="sel" aria-label="选择一台 DFA">' +
      DFAS.map(function (d, i) { return '<option value="' + i + '">' + d.name + '</option>'; }).join('') +
      '</select></label><label ' + k('field') + '>输入<input data-r="in1" maxlength="20" spellcheck="false" autocomplete="off" aria-label="让 DFA 判定的字符串"></label></div>' +
      '<div ' + k('row ex') + ' data-r="ex1"></div><div ' + k('rule') + ' data-r="rule"></div><div ' + k('fig') + ' data-r="fig"></div>' +
      '<div ' + k('legend') + '>双圈：接受态　粗框：当前状态　粗线：刚走过的边</div><div ' + k('tape') + ' data-r="tape1"></div><div ' + k('stat') + ' data-r="stat1"></div></div>' +
      '<div ' + k('card') + ' data-r="m2" hidden><div ' + k('row') + '><label ' + k('field grow') + '>代码<input data-r="in2" maxlength="48" spellcheck="false" autocomplete="off" aria-label="要切分的一行代码"></label></div>' +
      '<div ' + k('row ex') + '>例子：' + PRE.map(function (p, i) { return '<button type="button" ' + k('chip') + ' data-r="pre" data-x="' + i + '" title="' + esc(p[1]) + '">' + p[0] + '</button>'; }).join('') + '</div>' +
      '<div ' + k('rule') + '>关键字表：<code>if</code> <code>while</code> <code>return</code>。词素和表里某个词完全相同才算关键字。很多编译器给每个关键字单独一个类型（如 IF、WHILE），这里统一记作 KEYWORD。</div>' +
      '<div ' + k('tape tape2') + ' data-r="tape2"></div></div>' +
      '<div ' + k('ctrl') + '><button type="button" ' + k('btn') + ' data-r="prev" aria-label="上一步">上一步</button><button type="button" ' + k('btn pri') + ' data-r="next" aria-label="下一步">下一步</button>' +
      '<button type="button" ' + k('btn') + ' data-r="play" aria-label="自动播放或暂停"' + (reduce ? ' disabled title="系统设置了减少动态，自动播放已关闭"' : '') + '>自动播放</button>' +
      '<button type="button" ' + k('btn') + ' data-r="reset" aria-label="回到第一步">重置</button><span ' + k('count') + ' data-r="count" aria-live="polite"></span></div>' +
      '<div ' + k('explain') + ' data-r="expbox"><div ' + k('eh') + '>现在发生了什么</div><p data-r="exp" aria-live="polite"></p></div>' +
      '<div data-r="m2b" hidden><div ' + k('sub') + ' data-r="ptitle"></div><div data-r="res"></div><div ' + k('sub') + '>token 流（交给语法分析器）</div><div ' + k('toks') + ' data-r="toks"></div></div>';
    container.appendChild(root);
    function $(n) { return root.querySelector('[data-r="' + n + '"]'); }
    function cur() { return mode === 1 ? m1 : m2; }
    // 输入都按码位存成数组，emoji 只占 1 格、1 列
    function setM1(s) { m1.input = Array.from(s); m1.steps = runSteps(DFAS[m1.d], m1.input); m1.i = 0; }
    function setM2(s) {
      var a = Array.from(s), lx = lex(a);
      m2 = { input: a, lx: lx, i: 0, steps: [{ k: 'init' }].concat(lx.rounds.map(function (rd, j) { return { k: 'round', rd: rd, idx: j }; }), [{ k: 'done' }]) };
    }
    function stat1() {
      var d = DFAS[m1.d];
      $('ex1').innerHTML = '例子：' + d.ex.map(function (e) {
        return '<button type="button" ' + k('chip mono') + ' data-r="ex" data-x="' + esc(e) + '" aria-label="用例子 ' + esc(e.replace(/ /g, ' 空格 ').replace(/\t/g, ' Tab ').replace(/\s+/g, ' ').trim()) + '">' + esc(vis(e)) + '</button>';
      }).join('');
      $('rule').innerHTML = '规则：<code>' + esc(d.rule) + '</code>　' + d.note;
    }
    function boxCls(c) { $('expbox').className = P + 'explain' + (c ? ' ' + P + c : ''); }

    function r1() {
      var d = DFAS[m1.d], s = m1.input, x = m1.steps[m1.i], h = '', i;
      var mark = x.k === 'end' ? (x.acc ? 'ok' : 'bad') : x.k === 'stuck' ? 'bad' : '';
      $('fig').innerHTML = svg(d, x.s, x.k === 'read' ? x.e : null, mark, aid);
      var nread = x.k === 'init' ? 0 : x.k === 'read' ? x.i + 1 : x.k === 'stuck' ? x.i : s.length;
      for (i = 0; i < s.length; i++) h += cellH(s[i], i + 1, x.k === 'stuck' && i === x.i ? 'bad' : x.k === 'read' && i === x.i ? 'cur' : i < nread ? 'done' : '');
      $('tape1').innerHTML = h || sp('muted', '（空串）');
      var p = sp('s', 'q0');
      for (i = 1; i <= m1.i; i++) {
        var y = m1.steps[i];
        if (y.k !== 'end') p += arr(s[y.i]) + (y.k === 'read' ? stH(d, y.s) : sp('s bad', '卡住'));
      }
      $('stat1').innerHTML = '<div>当前状态 <b>' + x.s + '</b>' + (d.st[x.s].tok ? '（接受态）' : '') + ' · 已读 ' + nread + ' / ' + s.length + ' 个字符' +
        (mark ? sp('badge ' + mark, mark === 'ok' ? '接受' : '拒绝') : '') + '</div>' + sp('path', '路径：' + p);
      $('exp').textContent = t1(d, s, x);
      boxCls(mark);
    }
    function r2() {
      var s = m2.input, x = m2.steps[m2.i], R = m2.lx.rounds, j, rd, h = '', th = '', pos = 0;
      var upto = x.k === 'init' ? 0 : x.k === 'done' ? R.length : x.idx + 1;
      for (j = 0; j < upto; j++) {
        rd = R[j];
        var now = x.k === 'round' && j === x.idx;
        h += seg(s, rd.pos, rd.next - rd.pos, 'g' + rd.kind + (now ? ' cur' : ''), rd.kind === 'tok' ? rd.tok.type : rd.kind === 'ws' ? '跳过' : '错误', now ? '起点' : '');
        if (rd.kind !== 'ws') {
          th += sp('tok' + (rd.kind === 'err' ? ' err' : '') + (now ? ' new' : ''), sp('tt', rd.tok ? tokName(rd.tok.type, rd.tok.sub) : '非法字符 · 第 ' + (rd.pos + 1) + ' 列') + '<code>' + esc(vis(rd.lex)) + '</code>');
        }
        pos = rd.next;
      }
      var back = x.k === 'round' ? Math.max(0, x.rd.maxRead - (x.rd.next - x.rd.pos)) : 0;
      for (j = pos; j < s.length; j++) h += seg(s, j, 1, j < pos + back ? 'back' : '', j < pos + back ? '退回' : '', x.k === 'init' && j === 0 ? '起点' : '');
      $('tape2').innerHTML = h || sp('muted', '（空）');
      if (x.k === 'round') {
        $('ptitle').textContent = '本轮：5 台 DFA 都从第 ' + (x.rd.pos + 1) + ' 列往后读';
        h = x.rd.res.map(function (r) { return resRow(s, x.rd, r); }).join('');
        if (x.rd.kind === 'tok' && x.rd.win.d.id === 'ident') {
          h += '<div ' + k('kw') + '>查关键字表：<code>' + esc(x.rd.lex) + '</code> ' + (x.rd.tok.type === 'KEYWORD' ? '在表里 → KEYWORD' : '不在表里 → IDENT') + '</div>';
        }
      } else {
        $('ptitle').textContent = '参与切分的 5 台 DFA';
        h = DFAS.map(function (d) { return '<div ' + k('res') + '>' + sp('rn', d.name) + '<span><code>' + esc(d.rule) + '</code></span></div>'; }).join('');
      }
      $('res').innerHTML = h;
      $('toks').innerHTML = th || sp('muted', '还没有 token');
      $('exp').textContent = t2(s, m2.lx, x);
      boxCls(x.k === 'round' && x.rd.kind === 'err' ? 'bad' : '');
    }
    function render() {
      if (mode === 1) r1(); else r2();
      var m = cur(), n = m.steps.length, pb = $('play');
      $('count').textContent = '第 ' + (m.i + 1) + ' / ' + n + ' 步';
      // 用 aria-disabled 而不是 disabled：按钮被真禁用时焦点会掉回 body，键盘 ← → 就失灵了
      $('prev').setAttribute('aria-disabled', String(m.i === 0));
      $('next').setAttribute('aria-disabled', String(m.i >= n - 1));
      pb.textContent = timer ? '暂停' : '自动播放';
      pb.setAttribute('aria-pressed', timer ? 'true' : 'false');
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function go(dl) { var m = cur(); m.i = Math.max(0, Math.min(m.steps.length - 1, m.i + dl)); render(); }
    function play() {
      if (timer) { stop(); render(); return; }
      if (reduce) return;
      var m = cur();
      if (m.i >= m.steps.length - 1) m.i = 0;
      timer = setInterval(function () {
        var c = cur();
        if (c.i >= c.steps.length - 1) { stop(); render(); return; }
        c.i++; render();
      }, mode === 1 ? 1300 : 2500);
      render();
    }
    function setMode(n) {
      stop(); mode = n;
      $('t1').setAttribute('aria-pressed', String(n === 1));
      $('t2').setAttribute('aria-pressed', String(n === 2));
      $('m1').hidden = n !== 1; $('m2').hidden = n !== 2; $('m2b').hidden = n !== 2;
      render();
    }
    function onClick(ev) {
      var b = ev.target.closest ? ev.target.closest('button') : null;
      if (!b || !root.contains(b) || b.getAttribute('aria-disabled') === 'true') return;
      var r = b.getAttribute('data-r');
      if (r === 't1' || r === 't2') setMode(r === 't1' ? 1 : 2);
      else if (r === 'ex') { stop(); $('in1').value = b.getAttribute('data-x'); setM1($('in1').value); render(); }
      else if (r === 'pre') { stop(); $('in2').value = PRE[+b.getAttribute('data-x')][1]; setM2($('in2').value); render(); }
      else if (r === 'prev') { stop(); go(-1); }
      else if (r === 'next') { stop(); go(1); }
      else if (r === 'reset') { stop(); cur().i = 0; render(); }
      else if (r === 'play') play();
    }
    function onKey(ev) {
      var tg = ev.target.tagName;
      if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
      if (ev.key === 'ArrowRight') { ev.preventDefault(); stop(); go(1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); stop(); go(-1); }
    }
    function onInput(ev) { // 两个输入框和下拉框的 input 事件都冒泡到 root
      var t = ev.target, r = t.getAttribute('data-r');
      if (r !== 'in1' && r !== 'in2' && r !== 'sel') return;
      stop();
      if (r === 'sel') { m1.d = +t.value; $('in1').value = DFAS[m1.d].ex[0]; stat1(); }
      if (r === 'in2') setM2(t.value); else setM1($('in1').value);
      render();
    }
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    root.addEventListener('input', onInput);
    $('in1').value = DFAS[0].ex[0]; setM1(DFAS[0].ex[0]); stat1();
    $('in2').value = PRE[0][1]; setM2(PRE[0][1]);
    render();
    return {
      destroy: function () {
        stop();
        root.removeEventListener('click', onClick);
        root.removeEventListener('keydown', onKey);
        root.removeEventListener('input', onInput);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  // 自测：用例都按 DFA 定义手算过
  function selfTest() {
    var det = [], ok = true;
    function chk(name, got, exp) {
      var g = JSON.stringify(got), e = JSON.stringify(exp), p = g === e;
      ok = ok && p; det.push({ name: name, ok: p, got: g, expected: e });
    }
    function tk(s) {
      var r = lex(s);
      return r.tokens.map(function (t) { return tokName(t.type, t.sub) + ' ' + t.lex; })
        .concat(r.errors.map(function (e) { return '非法字符@第' + e.col + '列 ' + e.ch; }));
    }
    function one(i, s) {
      var st = runSteps(DFAS[i], s), z = st[st.length - 1];
      return z.k === 'end' ? (z.acc ? '接受@' : '拒绝@') + z.s : '卡住@' + z.s + '，第' + (z.i + 1) + '个字符';
    }
    var D = 'count = count + 12.5 <= x2', r0 = lex('12.').rounds[0];
    chk('x2 → IDENT', tk('x2'), ['IDENT x2']);
    chk('12.5 → NUMBER（小数）', tk('12.5'), ['NUMBER（小数） 12.5']);
    chk('<= 是一个 LE，不是 LT + ASSIGN', tk('<='), ['LE <=']);
    chk('if → KEYWORD', tk('if'), ['KEYWORD if']);
    chk('ifx → IDENT（最长匹配）', tk('ifx'), ['IDENT ifx']);
    chk('12. → NUMBER（整数）12 + 第 3 列非法「.」', tk('12.'), ['NUMBER（整数） 12', '非法字符@第3列 .']);
    chk('12. 首轮：整数接受 2 个；小数读 3 个停 q2 未接受；退回 1 个',
      [r0.res[1].len, r0.res[2].read, r0.res[2].len, r0.res[2].path[2], r0.maxRead - r0.lex.length], [2, 3, 0, 'q2', 1]);
    chk('默认整行 → 7 个 token', tk(D), ['IDENT count', 'ASSIGN =', 'IDENT count', 'PLUS +', 'NUMBER（小数） 12.5', 'LE <=', 'IDENT x2']);
    chk('默认整行 13 轮，6 轮空白', [lex(D).rounds.length, lex(D).rounds.filter(function (r) { return r.kind === 'ws'; }).length], [13, 6]);
    chk('a<=b==c', tk('a<=b==c'), ['IDENT a', 'LE <=', 'IDENT b', 'EQ ==', 'IDENT c']);
    chk('a==b=c', tk('a==b=c'), ['IDENT a', 'EQ ==', 'IDENT b', 'ASSIGN =', 'IDENT c']);
    chk('if x2 < 10 return ifx', tk('if x2 < 10 return ifx'), ['KEYWORD if', 'IDENT x2', 'LT <', 'NUMBER（整数） 10', 'KEYWORD return', 'IDENT ifx']);
    chk('1.2.3', tk('1.2.3'), ['NUMBER（小数） 1.2', 'NUMBER（整数） 3', '非法字符@第4列 .']);
    chk('a = b @ 3（跳过错误继续）', tk('a = b @ 3'), ['IDENT a', 'ASSIGN =', 'IDENT b', 'NUMBER（整数） 3', '非法字符@第7列 @']);
    chk('a + emoji + b：emoji 按码位只占 1 列', tk('a\uD83D\uDE00b'), ['IDENT a', 'IDENT b', '非法字符@第2列 \uD83D\uDE00']);
    chk('空行：0 轮，没有 token', [lex('').rounds.length, lex('').tokens.length], [0, 0]);
    chk('标识符 DFA：x2', one(0, 'x2'), '接受@q1');
    chk('标识符 DFA：2x', one(0, '2x'), '卡住@q0，第1个字符');
    chk('整数 DFA：12a', one(1, '12a'), '卡住@q1，第3个字符');
    chk('小数 DFA：12.5', one(2, '12.5'), '接受@q3');
    chk('小数 DFA：12.', one(2, '12.'), '拒绝@q2');
    chk('运算符 DFA：<=', [one(3, '<='), OP.st.q8.tok], ['接受@q8', 'LE']);
    chk('运算符 DFA：=<', one(3, '=<'), '卡住@q5，第2个字符');
    chk('整数 DFA：空串', one(1, ''), '拒绝@q0');
    return { ok: ok, details: det };
  }

  window.KGDemos['compiler-dfa'] = {
    title: '词法分析：DFA 一个字符一个字符地读',
    mount: mount,
    selfTest: selfTest
  };
})();
