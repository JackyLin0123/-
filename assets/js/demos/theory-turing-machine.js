/* 交互演示：图灵机一格一格地读写纸带。纯原生 JS，挂到 window.KGDemos['theory-turing-machine']。 */
(function () {
  'use strict';
  var ID = 'theory-turing-machine', P = 'dm-' + ID + '-';
  function X(s) { return s.replace(/\bx-/g, P); }
  var BL = '⊔', LIMIT = 1000, MAXLEN = 30;
  var SPEEDS = [1400, 800, 450, 200, 60], SPEED_NAMES = ['很慢', '慢', '中', '快', '很快'];
  var HALT = { acc: '接受', rej: '拒绝', halt: '停机' };
  var HALT_MARK = { acc: '✓ 接受', rej: '✗ 拒绝', halt: '■ 停机' };

  /* ---------- 机器定义：规则是 [状态, 读到, 写入, 移动, 下一状态, 这一行在做什么] ---------- */
  var MACHINES = {
    inc: {
      name: '二进制加一', alpha: '01', minLen: 1, sample: '1011', tries: ['1011', '111', '0', '1001'],
      goal: '把纸带上的二进制数加 1，结果留在纸带上。机器先走到最低位（最右边），再往左进位：遇到 1 改成 0 继续进位，遇到 0 改成 1 就不再进位。',
      states: [['q0', '往右走到最低位'], ['q1', '从最低位往左进位'], ['q2', '往左回到数的开头']],
      rules: [
        ['q0', '0', '0', 'R', 'q0', '还没到最低位，继续往右'],
        ['q0', '1', '1', 'R', 'q0', '还没到最低位，继续往右'],
        ['q0', BL, BL, 'L', 'q1', '走过了最低位，退回一格，从这里开始加 1'],
        ['q1', '1', '0', 'L', 'q1', '1 加 1 等于 10：这一位写 0，向左进一位'],
        ['q1', '0', '1', 'L', 'q2', '0 加 1 等于 1：这一位写 1，进位到此结束'],
        ['q1', BL, '1', 'L', 'q2', '原来每一位都是 1，进位一直进到最左边外面，补一个 1'],
        ['q2', '0', '0', 'L', 'q2', '往左走回数的开头'],
        ['q2', '1', '1', 'L', 'q2', '往左走回数的开头'],
        ['q2', BL, BL, 'R', 'halt', '到了数左边的空白，右移一格停在最高位，停机']
      ]
    },
    anbn: {
      name: '识别 aⁿbⁿ（n ≥ 0）', alpha: 'ab', minLen: 0, sample: 'aabb', tries: ['aabb', 'ab', '', 'aab', 'abab', 'ba'],
      yes: '属于 {aⁿbⁿ | n ≥ 0}', no: '不属于 {aⁿbⁿ | n ≥ 0}',
      goal: '判断输入是不是「n 个 a 后面跟 n 个 b」。办法是配对做记号：把最左边没配对的 a 标成 X，去右边把第一个没配对的 b 标成 Y，再回到左边，重复到 a 用完，最后检查剩下的是不是全是 Y。',
      states: [['q0', '看最左边还没配对的符号'], ['q1', '带着一个 a 往右找 b'], ['q2', '往左回到最右边的 X'], ['q3', 'a 用完了，检查后面只剩 Y']],
      rules: [
        ['q0', 'a', 'X', 'R', 'q1', '把最左边的 a 标成 X，去右边找配对的 b'],
        ['q0', 'Y', 'Y', 'R', 'q3', 'a 都配完了，去检查后面是不是只剩 Y'],
        ['q0', BL, BL, 'R', 'acc', '纸带一开始就是空的，n = 0，接受'],
        ['q0', 'b', 'b', 'R', 'rej', '还没配对的 a 前面出现了 b，顺序不对，拒绝'],
        ['q1', 'a', 'a', 'R', 'q1', '跳过还没配对的 a'],
        ['q1', 'Y', 'Y', 'R', 'q1', '跳过已经配对的 b（Y）'],
        ['q1', 'b', 'Y', 'L', 'q2', '找到第一个没配对的 b，标成 Y，回头'],
        ['q1', BL, BL, 'R', 'rej', '走到头也没找到 b：a 比 b 多，拒绝'],
        ['q2', 'a', 'a', 'L', 'q2', '往左走'],
        ['q2', 'Y', 'Y', 'L', 'q2', '往左走'],
        ['q2', 'X', 'X', 'R', 'q0', '碰到最右边的 X，右移一格，去处理下一个 a'],
        ['q3', 'Y', 'Y', 'R', 'q3', '跳过 Y'],
        ['q3', BL, BL, 'R', 'acc', '后面只有 Y：a 和 b 一样多，a 全在前面，接受'],
        ['q3', 'a', 'a', 'R', 'rej', 'b 后面又出现了 a，拒绝'],
        ['q3', 'b', 'b', 'R', 'rej', '还有 b 没配上 a：b 比 a 多，拒绝']
      ]
    },
    pal: {
      name: '识别回文（字母表 {a, b}）', alpha: 'ab', minLen: 0, sample: 'abba', tries: ['abba', 'aba', 'ab', '', 'abab'],
      yes: '是回文', no: '不是回文',
      goal: '判断输入正着读和倒着读是否一样。每轮擦掉最左边的符号，用状态记住它是 a 还是 b，走到最右边比较：一样就也擦掉，回到左边继续；不一样就拒绝。',
      states: [['q0', '看最左边剩下的符号'], ['q1', '记着 a，往右走到底'], ['q2', '记着 b，往右走到底'], ['q3', '检查最右边是不是 a'], ['q4', '检查最右边是不是 b'], ['q5', '往左回到开头']],
      rules: [
        ['q0', 'a', BL, 'R', 'q1', '最左边是 a：擦掉它，用状态 q1 记住，去最右边'],
        ['q0', 'b', BL, 'R', 'q2', '最左边是 b：擦掉它，用状态 q2 记住，去最右边'],
        ['q0', BL, BL, 'R', 'acc', '符号已经两两配对擦完，接受'],
        ['q1', 'a', 'a', 'R', 'q1', '记着 a，往右走'],
        ['q1', 'b', 'b', 'R', 'q1', '记着 a，往右走'],
        ['q1', BL, BL, 'L', 'q3', '走过了最右边，退回一格'],
        ['q2', 'a', 'a', 'R', 'q2', '记着 b，往右走'],
        ['q2', 'b', 'b', 'R', 'q2', '记着 b，往右走'],
        ['q2', BL, BL, 'L', 'q4', '走过了最右边，退回一格'],
        ['q3', 'a', BL, 'L', 'q5', '最右边也是 a，配上了：擦掉，回左边'],
        ['q3', 'b', 'b', 'R', 'rej', '最左边是 a，最右边却是 b，拒绝'],
        ['q3', BL, BL, 'R', 'acc', '右边已经没有符号：刚擦掉的是正中间那个，接受'],
        ['q4', 'b', BL, 'L', 'q5', '最右边也是 b，配上了：擦掉，回左边'],
        ['q4', 'a', 'a', 'R', 'rej', '最左边是 b，最右边却是 a，拒绝'],
        ['q4', BL, BL, 'R', 'acc', '右边已经没有符号：刚擦掉的是正中间那个，接受'],
        ['q5', 'a', 'a', 'L', 'q5', '往左回到开头'],
        ['q5', 'b', 'b', 'L', 'q5', '往左回到开头'],
        ['q5', BL, BL, 'R', 'q0', '到了左边的空白，右移一格，处理下一对']
      ]
    },
    findb: {
      name: '含 b 就接受（可能永不停机）', alpha: 'ab', minLen: 0, sample: 'aab', tries: ['aab', 'aaa', ''],
      yes: '含有 b', no: '',
      goal: '一直往右找 b，找到就接受。读到空白时它不拒绝，而是继续往右走，所以对不含 b 的输入永远不停。这样的机器是识别器（recognizer），不是判定器（decider）：属于语言的输入一定接受，不属于的可能永远不停。',
      limitNote: '这台机器读到空白时不拒绝，只会一直往右走，对不含 b 的输入永远不会停。把 (q0, ⊔) 这一行改成进入拒绝，它就成了判定器。',
      states: [['q0', '往右找 b']],
      rules: [
        ['q0', 'a', 'a', 'R', 'q0', '是 a，继续往右找 b'],
        ['q0', 'b', 'b', 'R', 'acc', '找到 b，接受'],
        ['q0', BL, BL, 'R', 'q0', '读到空白也不拒绝，继续往右走，所以可能永远不停']
      ]
    }
  };
  var ORDER = ['inc', 'anbn', 'pal', 'findb'];
  ORDER.forEach(function (id) {
    var m = MACHINES[id]; m.delta = {};
    m.rules.forEach(function (r, i) { m.delta[r[0] + '|' + r[1]] = i; });
  });

  /* ---------- 核心计算（不碰 DOM） ---------- */
  // 从状态 q0、读写头在第 0 格（输入的第一个符号）开始，最多跑 LIMIT 步。每步只记录读写和移动，纸带按需重放。
  function run(m, input) {
    var chars = Array.from(input), tape0 = {}, tape = {}, head = 0, st = 'q0', steps = [], end = null, i;
    for (i = 0; i < chars.length; i++) tape0[i] = tape[i] = chars[i];
    while (!end) {
      if (steps.length >= LIMIT) { end = 'limit'; break; }
      var sym = tape[head] || BL, ri = m.delta[st + '|' + sym], r = ri === undefined ? null : m.rules[ri];
      var x = { st: st, pos: head, read: sym, ri: r ? ri : -1, w: r ? r[2] : sym, mv: r ? (r[3] === 'R' ? 1 : -1) : 0, to: r ? r[4] : 'rej' };
      steps.push(x);
      if (x.w === BL) delete tape[head]; else tape[head] = x.w;
      head += x.mv; st = x.to;
      if (HALT[st]) end = st;
    }
    return { input: input, tape0: tape0, steps: steps, end: end, tape: tape };
  }
  // 第 k 步结束时的纸带、读写头位置和状态
  function config(R, k) {
    var tape = {}, p, i, head = 0, st = 'q0';
    for (p in R.tape0) tape[p] = R.tape0[p];
    for (i = 0; i < k; i++) {
      var x = R.steps[i];
      if (x.w === BL) delete tape[x.pos]; else tape[x.pos] = x.w;
      head = x.pos + x.mv; st = x.to;
    }
    return { tape: tape, head: head, st: st };
  }
  // 纸带上非空白的那一段（中间的空白照样显示成 ⊔）
  function tapeStr(tape) {
    var ks = Object.keys(tape).map(Number), lo, hi, s = '', p;
    if (!ks.length) return '';
    lo = Math.min.apply(null, ks); hi = Math.max.apply(null, ks);
    for (p = lo; p <= hi; p++) s += tape[p] || BL;
    return s;
  }
  function validate(m, raw) {
    var s = String(raw).replace(/\s+/g, ''), cs, i;
    if (s === 'ε') s = '';
    cs = Array.from(s);
    if (cs.length > MAXLEN) return { err: '输入最多 ' + MAXLEN + ' 个符号，现在有 ' + cs.length + ' 个。' };
    for (i = 0; i < cs.length; i++) {
      if (m.alpha.indexOf(cs[i]) >= 0) continue;
      return { err: (cs[i] === BL || cs[i] === '_' ? '「' + cs[i] + '」是空白符号，不能写在输入里。' : '输入里有「' + cs[i] + '」，') +
        '这台机器的输入字母表只有 {' + m.alpha.split('').join(', ') + '}。' };
    }
    if (cs.length < m.minLen) return { err: '二进制加一至少要输入一位数字，比如 1011。' };
    return { input: s };
  }

  /* ---------- 文字说明 ---------- */
  function q(c) { return '「' + c + '」'; }
  function showIn(s) { return s === '' ? 'ε（空串）' : s; }
  function explain(m, R, s) {
    var x, r, t, nx = s < R.steps.length ? R.steps[s] : null;
    if (s === 0) {
      t = '还没开始。机器处在开始状态 q0，读写头在第 0 格（' + (R.input ? '输入的第一个符号' : '输入是空串，这一格是空白 ⊔') + '）。';
    } else {
      x = R.steps[s - 1]; r = x.ri >= 0 ? m.rules[x.ri] : null;
      t = '第 ' + s + ' 步：状态 ' + x.st + '，读写头在第 ' + x.pos + ' 格读到' + q(x.read) + '。';
      if (!r) t += '转移表里没有 (' + x.st + ', ' + x.read + ') 这一行，按约定进入拒绝状态，停机。';
      else {
        t += '查 (' + x.st + ', ' + x.read + ') 这一行：' + (x.w === x.read ? '原样写回' : '写入') + q(x.w) + '，读写头' +
          (x.mv > 0 ? '右' : '左') + '移一格，' + (HALT[x.to] ? '进入' + HALT[x.to] + '状态，停机。' : '进入 ' + x.to + '。') + '为什么：' + r[5] + '。';
      }
    }
    if (nx) t += ' 下一步查 (' + nx.st + ', ' + nx.read + ') 这一行。';
    else if (R.end === 'limit') t += ' 已经走了 ' + LIMIT + ' 步，机器还没进入停机状态。' + (m.limitNote || '光看模拟没法断定它以后会不会停，这正是停机问题。');
    return t;
  }
  function resultOf(m, R) {
    if (R.end === 'acc') return ['acc', '✓ 接受：' + showIn(R.input) + ' ' + m.yes + '。'];
    if (R.end === 'rej') return ['rej', '✗ 拒绝：' + showIn(R.input) + ' ' + m.no + '。'];
    if (R.end === 'halt') {
      var out = tapeStr(R.tape);
      return ['halt', '■ 停机，输出在纸带上：' + out + '。输入 ' + R.input + ' 是十进制 ' + parseInt(R.input, 2) + '，输出 ' + out + ' 是 ' + parseInt(out, 2) + '。'];
    }
    return ['lim', '… 超过步数上限（' + LIMIT + ' 步），还没停机。'];
  }

  /* ---------- HTML 片段 ---------- */
  function tapeHTML(cf, R, s, rad) {
    var h = '', p, last = s ? R.steps[s - 1].pos : null;
    for (p = cf.head - rad; p <= cf.head + rad; p++) {
      var c = cf.tape[p] || BL, cls = 'x-cell' + (c === BL ? ' x-blank' : '') + (p === cf.head ? ' x-head' : '') + (p === last && p !== cf.head ? ' x-wrote' : '');
      h += '<div class="x-col"><div class="' + cls + '">' + c + '</div><div class="x-idx">' + p + '</div></div>';
    }
    return h;
  }
  function stateName(st) { return HALT[st] ? HALT[st] + '（停机）' : st; }
  function tableHTML(m, used, next) {
    var h = '<table class="x-tbl"><thead><tr><th scope="col">状态</th><th scope="col">读到</th><th scope="col">写入</th><th scope="col">移动</th><th scope="col">下一状态</th><th scope="col">这一行在做什么</th></tr></thead><tbody>';
    m.rules.forEach(function (r, i) {
      var tag = i === used ? '<span class="x-mk x-mk-used">刚用</span>' : i === next ? '<span class="x-mk x-mk-next">下一步</span>' : '';
      h += '<tr class="' + (i === used ? 'x-used' : '') + (i === next ? ' x-next' : '') + '"><td class="x-mono">' + r[0] + '</td><td class="x-mono">' + r[1] +
        '</td><td class="x-mono">' + r[2] + '</td><td>' + (r[3] === 'R' ? '右 R' : '左 L') + '</td><td>' + (HALT_MARK[r[4]] || '<span class="x-mono">' + r[4] + '</span>') +
        '</td><td class="x-why">' + tag + r[5] + '</td></tr>';
    });
    return h + '</tbody></table>';
  }

  /* ---------- 样式与骨架 ---------- */
  var CSS =
    '.x-root{color:var(--text,#1b1b19);font-family:var(--font,sans-serif);font-size:15px;line-height:1.65}' +
    '.x-root *{box-sizing:border-box}' +
    '.x-root p{margin:0 0 8px}' +
    '.x-root h3{margin:0 0 6px;font-size:16px;font-weight:600;line-height:1.4;color:var(--text,#1b1b19)}' +
    '.x-root .x-intro,.x-root .x-goal{color:var(--text-2,#52514e);font-size:14px}' +
    '.x-box{background:var(--surface,#fff);border:1px solid var(--border,#e2e1dc);border-radius:var(--radius,10px);padding:12px;min-width:0}' +
    '.x-ctl{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-end;margin-bottom:10px}' +
    '.x-field{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--text-2,#52514e);min-width:0}' +
    '.x-ctl>.x-field:first-child{flex:1 1 220px}' +
    '.x-wide{flex:1 1 100%}' +
    '.x-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '.x-in{font:inherit;font-size:14px;color:var(--text,#1b1b19);background:var(--surface,#fff);border:1px solid var(--border,#e2e1dc);border-radius:8px;padding:6px 8px;min-height:36px;min-width:0;width:100%}' +
    '.x-row .x-in{flex:1 1 160px;width:auto;font-family:var(--mono,monospace)}' +
    '.x-spd{accent-color:var(--c-theory,#b13b55);width:140px;margin:6px 0}' +
    '.x-btn{font:inherit;font-size:14px;color:var(--text,#1b1b19);background:var(--surface,#fff);border:1px solid var(--border,#e2e1dc);border-radius:8px;padding:6px 12px;min-height:36px;cursor:pointer}' +
    '.x-btn:hover{background:var(--surface-2,#f0efec)}' +
    '.x-btn[aria-pressed=true],.x-pri{background:color-mix(in srgb,var(--c-theory,#b13b55) 16%,var(--surface,#fff));border-color:var(--c-theory,#b13b55)}' +
    '.x-pri{font-weight:600}' +
    '.x-btn[aria-disabled=true]{opacity:.45;cursor:default}' +
    '.x-sm{min-height:30px;padding:2px 10px;font-family:var(--mono,monospace);font-size:13px}' +
    '.x-root :focus-visible{outline:2px solid var(--focus,#2457b3);outline-offset:2px}' +
    '.x-root .x-msg{margin:0;font-size:13px;color:var(--text-2,#52514e)}' +
    '.x-root .x-msg:empty{display:none}' +
    '.x-root .x-err{color:var(--text,#1b1b19);background:color-mix(in srgb,var(--div-pos,#e34948) 16%,var(--surface,#fff));border-radius:6px;padding:4px 8px}' +
    '.x-note{font-size:13px;color:var(--text-2,#52514e)}' +
    '.x-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}' +
    '.x-status{flex:1 1 200px;font-size:14px;color:var(--text,#1b1b19)}' +
    '.x-tapebox{border-top:3px solid var(--c-theory,#b13b55)}' +
    '.x-headlab{text-align:center;font-size:13px;color:var(--text-2,#52514e);line-height:1.35}' +
    '.x-headlab b{font-family:var(--mono,monospace);font-size:15px;color:var(--text,#1b1b19)}' +
    '.x-arrow{display:block;font-size:13px;color:var(--text,#1b1b19)}' +
    '.x-tape{display:flex;justify-content:center;overflow:hidden;padding:2px 0}' +
    '.x-col{flex:0 0 34px;width:34px;display:flex;flex-direction:column;align-items:center}' +
    '.x-cell{width:32px;height:40px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border,#e2e1dc);border-radius:4px;background:var(--surface-2,#f0efec);font-family:var(--mono,monospace);font-size:18px;color:var(--text,#1b1b19)}' +
    '.x-cell.x-blank{color:var(--text-3,#6b6a66)}' +
    '.x-cell.x-head{border:3px solid var(--c-theory,#b13b55);background:color-mix(in srgb,var(--c-theory,#b13b55) 14%,var(--surface,#fff));font-weight:700}' +
    '.x-cell.x-wrote{border:2px dashed var(--text-2,#52514e)}' +
    '.x-idx{font-family:var(--mono,monospace);font-size:10px;line-height:1.7;color:var(--text-3,#6b6a66)}' +
    '.x-root .x-tinfo{margin:6px 0 0;font-size:13px;color:var(--text-2,#52514e)}' +
    '.x-tinfo code{font-family:var(--mono,monospace);font-size:14px;color:var(--text,#1b1b19);background:var(--surface-2,#f0efec);border-radius:4px;padding:0 4px;overflow-wrap:anywhere}' +
    '.x-root .x-say{margin:10px 0 8px;padding:8px 10px;background:var(--surface-2,#f0efec);border-left:4px solid var(--c-theory,#b13b55);border-radius:8px;font-size:14px}' +
    '.x-tag{display:inline-block;margin-right:6px;padding:0 6px;border:1px solid var(--border,#e2e1dc);border-radius:999px;background:var(--surface,#fff);font-size:12px;color:var(--text-2,#52514e)}' +
    '.x-root .x-res{margin:0 0 10px;padding:6px 10px;border-radius:8px;font-size:14px;font-weight:600;color:var(--text,#1b1b19);border:1px solid var(--border,#e2e1dc)}' +
    '.x-root .x-res:empty{display:none}' +
    '.x-res.x-acc{background:color-mix(in srgb,var(--good,#0ca30c) 16%,var(--surface,#fff));border-color:var(--good,#0ca30c)}' +
    '.x-res.x-rej{background:color-mix(in srgb,var(--div-pos,#e34948) 16%,var(--surface,#fff));border-color:var(--div-pos,#e34948)}' +
    '.x-res.x-halt{background:color-mix(in srgb,var(--div-neg,#2a78d6) 14%,var(--surface,#fff));border-color:var(--div-neg,#2a78d6)}' +
    '.x-res.x-lim{background:color-mix(in srgb,var(--warn,#fab219) 22%,var(--surface,#fff));border-color:var(--warn,#fab219)}' +
    '.x-scroll{overflow-x:auto}' +
    '.x-root .x-tbl{width:100%;margin:0;border-collapse:collapse;font-size:13px;line-height:1.4}' +
    '.x-tbl th,.x-tbl td{border:1px solid var(--border,#e2e1dc);padding:3px 6px;text-align:left;vertical-align:top;color:var(--text,#1b1b19);background:var(--surface,#fff)}' +
    '.x-tbl th{background:var(--surface-2,#f0efec);font-weight:600;font-size:12px;color:var(--text-2,#52514e);white-space:nowrap}' +
    '.x-tbl td{white-space:nowrap}' +
    '.x-tbl td.x-why{white-space:normal;min-width:9em;color:var(--text-2,#52514e)}' +
    '.x-tbl .x-mono{font-family:var(--mono,monospace);font-size:14px}' +
    '.x-tbl tr.x-used td{background:color-mix(in srgb,var(--c-theory,#b13b55) 16%,var(--surface,#fff));color:var(--text,#1b1b19)}' +
    '.x-tbl tr.x-used td:first-child{box-shadow:inset 4px 0 var(--c-theory,#b13b55)}' +
    '.x-tbl tr.x-next td:first-child{box-shadow:inset 4px 0 var(--text-3,#6b6a66)}' +
    '.x-mk{display:inline-block;margin-right:6px;padding:0 6px;border-radius:999px;font-size:11px;font-weight:600;color:var(--text,#1b1b19);background:var(--surface,#fff);white-space:nowrap}' +
    '.x-mk-used{border:1px solid var(--c-theory,#b13b55)}' +
    '.x-mk-next{border:1px dashed var(--text-2,#52514e)}' +
    '.x-tblbox{margin-top:10px}';

  var TPL =
    '<p class="x-how">怎么玩：选一台机器，输入一串符号，按「下一步」看读写头每一步读到什么、写什么、往哪边走。下方转移表里标「刚用」的是这一步查到的那一行。也可以用键盘 ← → 单步。</p>' +
    '<p class="x-intro">图灵机（Turing machine）只有三样东西：一条两头无限长的纸带、一个读写头、一个有限状态控制器。每一步只看「当前状态 + 读写头下的符号」，查转移表决定写什么、往左还是往右移一格、进入哪个状态。进入接受、拒绝或停机状态就停下，也可能永远不停。没写过的格子是空白符号 ⊔。</p>' +
    '<div class="x-box x-ctl">' +
    '<label class="x-field">机器<select class="x-in x-mach" aria-label="选择图灵机">' +
    ORDER.map(function (id) { return '<option value="' + id + '">' + MACHINES[id].name + '</option>'; }).join('') + '</select></label>' +
    '<label class="x-field"><span>自动播放速度：<b class="x-spv">中</b></span><input class="x-spd" type="range" min="1" max="5" step="1" value="3" aria-label="自动播放速度，1 最慢，5 最快"></label>' +
    '<div class="x-field x-wide"><span class="x-alpha"></span>' +
    '<div class="x-row"><input class="x-in x-inp" type="text" spellcheck="false" autocomplete="off" aria-label="输入串">' +
    '<button class="x-btn" type="button" data-act="apply" aria-label="用这个输入重新开始">应用</button></div></div>' +
    '<div class="x-row x-wide x-tries" role="group" aria-label="示例输入"></div>' +
    '<p class="x-msg x-wide" aria-live="polite"></p>' +
    '</div>' +
    '<p class="x-goal"></p>' +
    '<div class="x-bar">' +
    '<button class="x-btn" type="button" data-act="reset" aria-label="重置到第 0 步">重置</button>' +
    '<button class="x-btn" type="button" data-act="prev" aria-label="上一步">上一步</button>' +
    '<button class="x-btn x-pri" type="button" data-act="next" aria-label="下一步">下一步</button>' +
    '<button class="x-btn" type="button" data-act="play" aria-pressed="false" aria-label="自动播放">自动播放</button>' +
    '<button class="x-btn" type="button" data-act="end" aria-label="直接跑到停机或步数上限">跑到最后</button>' +
    '<span class="x-status"></span></div>' +
    '<section class="x-box x-tapebox" aria-label="纸带和读写头">' +
    '<div class="x-headlab"></div><div class="x-tape"></div>' +
    '<p class="x-tinfo"></p>' +
    '<p class="x-note">粗框是读写头所在的格，虚线框是上一步刚写过的格，格子下面的数字是位置（第 0 格是输入的第一个符号）。</p></section>' +
    '<p class="x-say" aria-live="polite"><span class="x-tag">现在发生了什么</span><span class="x-saytxt"></span></p>' +
    '<p class="x-res"></p>' +
    '<section class="x-box x-tblbox" aria-label="转移表"><h3>转移表</h3><p class="x-note x-states"></p>' +
    '<div class="x-scroll x-tbl-wrap"></div></section>';

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
      mach: $('.x-mach'), spd: $('.x-spd'), spv: $('.x-spv'), inp: $('.x-inp'), alpha: $('.x-alpha'), tries: $('.x-tries'), msg: $('.x-msg'),
      goal: $('.x-goal'), status: $('.x-status'), headlab: $('.x-headlab'), tape: $('.x-tape'), tinfo: $('.x-tinfo'), say: $('.x-saytxt'),
      res: $('.x-res'), states: $('.x-states'), tbl: $('.x-tbl-wrap'),
      prev: $('[data-act=prev]'), next: $('[data-act=next]'), play: $('[data-act=play]'), end: $('[data-act=end]')
    };
    var S = { mid: 'inc', R: null, s: 0, speed: 3, timer: null };
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduce) { el.play.setAttribute('aria-disabled', 'true'); el.play.title = '系统开启了「减少动态效果」，自动播放已关闭'; }

    function setMsg(txt, err) { el.msg.textContent = txt; el.msg.className = X('x-msg x-wide' + (err ? ' x-err' : '')); }
    function stop() {
      if (S.timer) { clearTimeout(S.timer); S.timer = null; }
      el.play.setAttribute('aria-pressed', 'false'); el.play.textContent = '自动播放'; el.play.setAttribute('aria-label', '自动播放');
    }
    function go(s) { S.s = Math.max(0, Math.min(S.R.steps.length, s)); render(); }
    function start(input) { stop(); S.R = run(MACHINES[S.mid], input); S.s = 0; el.inp.value = input; render(); }
    function loadMachine(id) {
      var m = MACHINES[id];
      S.mid = id; el.mach.value = id;
      el.goal.textContent = m.goal;
      el.alpha.textContent = '输入：字母表 {' + m.alpha.split('').join(', ') + '}，最多 ' + MAXLEN + ' 个符号' + (m.minLen ? '' : '，留空或写 ε 表示空串');
      el.states.textContent = '状态：' + m.states.map(function (s) { return s[0] + ' ' + s[1]; }).join('；') +
        '。停机状态：' + (id === 'inc' ? '停机（输出留在纸带上）' : id === 'findb' ? '接受' : '接受、拒绝') + '。';
      el.tries.innerHTML = '<span class="' + P + 'note">试试：</span>' + m.tries.map(function (t) {
        return '<button class="' + P + 'btn ' + P + 'sm" type="button" data-try="' + t + '" aria-label="输入 ' + showIn(t) + ' 并重新开始">' + (t || 'ε') + '</button>';
      }).join('');
      setMsg('');
      start(m.sample);
    }
    function apply() {
      var r = validate(MACHINES[S.mid], el.inp.value);
      if (r.err) { setMsg(r.err, true); return; }
      setMsg('已换成输入 ' + showIn(r.input) + '。'); start(r.input);
    }
    function tick() {
      S.timer = setTimeout(function () {
        go(S.s + 1);
        if (S.s >= S.R.steps.length) stop(); else tick();
      }, SPEEDS[S.speed - 1]);
    }
    function play() {
      if (reduce) { setMsg('系统开启了「减少动态效果」，自动播放已关闭，请用「下一步」。'); return; }
      if (S.timer) { stop(); return; }
      if (S.s >= S.R.steps.length) go(0);
      el.play.setAttribute('aria-pressed', 'true'); el.play.textContent = '暂停'; el.play.setAttribute('aria-label', '暂停自动播放');
      tick();
    }
    function radius() {
      var w = el.tape.clientWidth || 300, cols = Math.floor(w / 34);
      return Math.max(2, Math.min(12, Math.floor((cols - 1) / 2)));
    }
    function render() {
      var m = MACHINES[S.mid], R = S.R, n = R.steps.length, s = S.s, cf = config(R, s), done = s === n;
      var used = s ? R.steps[s - 1].ri : -1, next = done ? -1 : R.steps[s].ri;
      el.status.textContent = '第 ' + s + ' / ' + n + ' 步' + (done ? (R.end === 'limit' ? '，到了步数上限' : '，已停机') : '');
      el.prev.setAttribute('aria-disabled', s === 0 ? 'true' : 'false');
      el.next.setAttribute('aria-disabled', done ? 'true' : 'false');
      el.end.setAttribute('aria-disabled', done ? 'true' : 'false');
      el.headlab.innerHTML = '读写头 · 状态 <b>' + stateName(cf.st) + '</b><span class="' + P + 'arrow" aria-hidden="true">▼</span>';
      el.tape.innerHTML = X(tapeHTML(cf, R, s, radius()));
      var ts = tapeStr(cf.tape);
      el.tinfo.innerHTML = '读写头在第 ' + cf.head + ' 格，读到 <code>' + (cf.tape[cf.head] || BL) + '</code>；纸带上写着：' +
        (ts ? '<code>' + ts + '</code>' : '全是空白');
      el.say.textContent = explain(m, R, s);
      if (done) { var r = resultOf(m, R); el.res.className = X('x-res x-' + r[0]); el.res.textContent = r[1]; }
      else { el.res.className = X('x-res'); el.res.textContent = ''; }
      el.tbl.innerHTML = X(tableHTML(m, used, next));
    }

    function onClick(e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || !root.contains(b)) return;
      var act = b.getAttribute('data-act'), tr = b.getAttribute('data-try'), n = S.R.steps.length;
      if (tr !== null) { setMsg('已换成输入 ' + showIn(tr) + '。'); start(tr); return; }
      if (act === 'next') { if (S.s < n) go(S.s + 1); }
      else if (act === 'prev') { stop(); go(S.s - 1); }
      else if (act === 'reset') { stop(); go(0); }
      else if (act === 'play') play();
      else if (act === 'end') { stop(); go(n); }
      else if (act === 'apply') apply();
    }
    function onChange(e) { if (e.target === el.mach) loadMachine(el.mach.value); }
    function onInput(e) {
      if (e.target !== el.spd) return;
      S.speed = +el.spd.value; el.spv.textContent = SPEED_NAMES[S.speed - 1];
    }
    function onKey(e) {
      var tg = e.target, name = tg.tagName;
      if (tg === el.inp && e.key === 'Enter') { e.preventDefault(); apply(); return; }
      if (name === 'INPUT' || name === 'SELECT' || name === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); if (S.s < S.R.steps.length) go(S.s + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); go(S.s - 1); }
    }
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    root.addEventListener('keydown', onKey);
    var ro = null, lastW = 0;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { var w = el.tape.clientWidth; if (w !== lastW) { lastW = w; render(); } });
      ro.observe(el.tape);
    }

    loadMachine('inc');

    return {
      destroy: function () {
        stop();
        if (ro) ro.disconnect();
        root.removeEventListener('click', onClick);
        root.removeEventListener('change', onChange);
        root.removeEventListener('input', onInput);
        root.removeEventListener('keydown', onKey);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  /* ---------- 自测：前几条手算核对，后几条与不经过图灵机的直接判断逐个对比 ---------- */
  function selfTest() {
    var details = [], ok = true;
    function chk(name, got, exp, how) {
      var pass = JSON.stringify(got) === JSON.stringify(exp);
      ok = ok && pass;
      details.push((pass ? '通过：' : '失败：') + name + '，期望 ' + JSON.stringify(exp) + '，得到 ' + JSON.stringify(got) + (how ? '。核对：' + how : ''));
    }
    function inc(w) { var R = run(MACHINES.inc, w); return [R.end, tapeStr(R.tape)]; }
    function ends(id, ws) { return ws.map(function (w) { return run(MACHINES[id], w).end; }); }
    chk('二进制加一 1011', inc('1011'), ['halt', '1100'], '1011 是 11，加一得 12，二进制 1100');
    chk('二进制加一 111', inc('111'), ['halt', '1000'], '7 + 1 = 8，二进制 1000，进位一直进到最左边外面');
    chk('二进制加一 0', inc('0'), ['halt', '1'], '0 + 1 = 1');
    var R = run(MACHINES.inc, '111'), cf = config(R, R.steps.length);
    chk('加一停机后读写头停在最高位，状态是停机', [cf.head, cf.st], [-1, 'halt'], '111 变成 1000 后最高位在第 -1 格');
    chk('aⁿbⁿ：空串、ab、aabb 接受', ends('anbn', ['', 'ab', 'aabb']), ['acc', 'acc', 'acc'], 'n = 0、1、2');
    chk('aⁿbⁿ：aab、abab、ba 拒绝', ends('anbn', ['aab', 'abab', 'ba']), ['rej', 'rej', 'rej'], 'a 比 b 多；b 后面又有 a；b 在 a 前');
    chk('回文：abba、aba 接受，ab 拒绝', ends('pal', ['abba', 'aba', 'ab']), ['acc', 'acc', 'rej'], '倒过来读分别是 abba、aba、ba');
    chk('回文：空串和 a 接受，abab 拒绝', ends('pal', ['', 'a', 'abab']), ['acc', 'acc', 'rej'], '空串和单个符号倒过来不变');
    chk('含 b：aab 接受，aaa 和空串超过步数上限', ends('findb', ['aab', 'aaa', '']), ['acc', 'limit', 'limit'], '没有 b 时一直往右走');
    var badL = [], badI = [], len, i, w, maxSteps = 0;
    for (len = 0; len <= 8; len++) {
      for (i = 0; i < (1 << len); i++) {
        w = ''; for (var j = len - 1; j >= 0; j--) w += (i >> j) & 1 ? 'b' : 'a';
        var mm = /^(a*)(b*)$/.exec(w), isAB = !!mm && mm[1].length === mm[2].length, isPal = w === w.split('').reverse().join('');
        var ra = run(MACHINES.anbn, w), rp = run(MACHINES.pal, w);
        maxSteps = Math.max(maxSteps, ra.steps.length, rp.steps.length);
        if (ra.end !== (isAB ? 'acc' : 'rej')) badL.push('aⁿbⁿ:' + w);
        if (rp.end !== (isPal ? 'acc' : 'rej')) badL.push('回文:' + w);
        if (len <= 5 && run(MACHINES.findb, w).end !== (w.indexOf('b') >= 0 ? 'acc' : 'limit')) badL.push('含b:' + w);
      }
    }
    chk('穷举长度 0–8 的全部 511 个 {a,b} 串：两台识别器都停机，结果与直接判断一致', badL, [],
      '直接判断用正则 ^(a*)(b*)$ 比长度、把串反转比较；最长一次跑了 ' + maxSteps + ' 步');
    for (len = 1; len <= 10; len++) {
      for (i = 0; i < (1 << len); i++) {
        w = i.toString(2); while (w.length < len) w = '0' + w;
        var want = (i + 1).toString(2); while (want.length < len) want = '0' + want;
        var got = inc(w);
        if (got[0] !== 'halt' || got[1] !== want) badI.push(w + '→' + got[1]);
      }
    }
    chk('穷举长度 1–10 的全部 2046 个二进制串：加一结果与直接算术一致', badI, [], '直接算 n + 1 再转二进制，保留前导 0，满位时多一位');
    var a15 = new Array(16).join('a') + new Array(16).join('b'), p30 = new Array(16).join('ab') ;
    p30 = p30.slice(0, 15) + p30.slice(0, 15).split('').reverse().join('');
    var big = [run(MACHINES.anbn, a15), run(MACHINES.pal, p30), run(MACHINES.pal, new Array(31).join('a'))];
    chk('最长 30 个符号的输入也在 ' + LIMIT + ' 步内停机', big.map(function (r) { return r.end; }), ['acc', 'acc', 'acc'],
      'a¹⁵b¹⁵ 用 ' + big[0].steps.length + ' 步，30 位回文用 ' + big[1].steps.length + ' 和 ' + big[2].steps.length + ' 步');
    chk('输入检查', [!!validate(MACHINES.inc, '102').err, !!validate(MACHINES.inc, '').err, !!validate(MACHINES.anbn, 'abc').err,
      !!validate(MACHINES.anbn, 'a⊔b').err, validate(MACHINES.anbn, ' a b ').input, validate(MACHINES.pal, 'ε').input],
      [true, true, true, true, 'ab', ''], '非法符号、空的二进制数、空白符都报错；空格被忽略，ε 表示空串');
    return { ok: ok, details: details };
  }

  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = {
    title: '图灵机：一格一格地读写',
    mount: mount,
    selfTest: selfTest
  };
})();
