/* ds-hash：哈希表的冲突与扩容（链地址法 / 线性探测）。纯原生 JS，挂到 window.KGDemos['ds-hash']。 */
(function () {
'use strict';
var ID = 'ds-hash', P = 'dm-ds-hash-', MAXK = 30, TWO32 = 4294967296;

// 纯计算（selfTest 只用这一部分）
function isPrime(n) { if (n < 2) return false; for (var d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; }
function nextPrimeAbove(x) { var p = x + 1; while (!isPrime(p)) p++; return p; }
function minFactor(n) { for (var d = 2; d * d <= n; d++) if (n % d === 0) return d; return n; }
// h(s) = Σ s[i]·31^(n−1−i) mod 2^32。Horner 法每步取模：h < 2^32，h·31 + 编码 < 2^53，double 运算是精确的。
function strHash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % TWO32; return h; }
function hv(k) { return k.t === 'i' ? k.v : strHash(k.v); }
function same(a, b) { return !!a && !!b && a.t === b.t && a.v === b.v; }
function I(v) { return { t: 'i', v: v }; }

// 表：mode 'chain' 时 s[i] 是键数组（链）；'probe' 时 s[i] 是 null（空）/ {k}（键）/ {tomb}（墓碑，记着被删的键）
function mk(mode, m) { var s = []; for (var i = 0; i < m; i++) s.push(mode === 'chain' ? [] : null); return { mode: mode, m: m, s: s, n: 0, tb: 0 }; }
function cp(T) { return { mode: T.mode, m: T.m, n: T.n, tb: T.tb, s: T.s.map(function (x) { return Array.isArray(x) ? x.slice() : x; }) }; }

function parseKey(raw) {
  var s = String(raw == null ? '' : raw).trim(), q = /^"(.*)"$|^'(.*)'$/.exec(s);
  if (!s) return { err: '先在输入框里写一个键，例如 17 或 cat。' };
  if (q) s = q[1] != null ? q[1] : q[2];
  else if (/^-\d+$/.test(s)) return { err: '整数键必须是非负数。想把 ' + s + ' 当字符串用，请加引号："' + s + '"。' };
  else if (/^\d+$/.test(s)) return s.length > 6 ? { err: '整数键请写 0 到 999999 之间的数。' } : { k: I(parseInt(s, 10)) };
  if (!s) return { err: '引号里至少要有 1 个字符。' };
  if (s.length > 8) return { err: '字符串键最多 8 个字符，现在是 ' + s.length + ' 个。' };
  return { k: { t: 's', v: s } };
}

// 说明文字用到的小工具
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
function kt(k) { return k.t === 'i' ? String(k.v) : '"' + k.v + '"'; }
function kc(k) { return '<code>' + esc(kt(k)) + '</code>'; }
function cd(s, long) { return '<code' + (long ? ' class="' + P + 'long"' : '') + '>' + s + '</code>'; }
function trim0(s) { return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, ''); }
function fa(n, m) { return (n * 1000) % m === 0 ? '= ' + trim0((n / m).toFixed(3)) : '≈ ' + (n / m).toFixed(3); }
function ft(t) { var s = trim0((+t).toFixed(2)); return s.indexOf('.') < 0 ? s + '.0' : s; }
function over(n, m, t) { return n * 100 > Math.round(t * 100) * m; }
function a0(T) { return 'n = ' + T.n + '，α = ' + T.n + '/' + T.m + ' ' + fa(T.n, T.m) + '。'; }
function alpha(T, c) { return 'n = ' + T.n + '，α = ' + T.n + '/' + T.m + ' ' + fa(T.n, T.m) + '，' + (over(T.n, T.m, c.thr) ? '超过' : '没超过') + '阈值 ' + ft(c.thr) + '。'; }
function none(n) { return n === 1 ? '链上唯一的键也不是 ' : '链上 ' + n + ' 个键都不是 '; }
function ids(p) { return p.map(function (q) { return q.i; }).join(' → '); }

function strCalc(s) {
  var n = s.length, t = [], codes = [], raw = null, i, R;
  for (i = 0; i < n; i++) {
    var e = n - 1 - i;
    t.push(s.charCodeAt(i) + (e === 0 ? '' : e === 1 ? '·31' : '·31<sup>' + e + '</sup>'));
    if (s.indexOf(s.charAt(i)) === i) codes.push(esc(s.charAt(i)) + ' = ' + s.charCodeAt(i));
  }
  var h = strHash(s);
  if (typeof BigInt === 'function') { R = BigInt(0); for (i = 0; i < n; i++) R = R * BigInt(31) + BigInt(s.charCodeAt(i)); raw = R.toString(); }
  var tail = raw === null ? ' mod 2<sup>32</sup> = ' + h : raw === String(h) ? ' = ' + h : ' = ' + raw + '，mod 2<sup>32</sup> 后 = ' + h;
  return { h: h, html: cd('h(' + esc(kt({ t: 's', v: s })) + ') = ' + t.join(' + ') + tail, 1), codes: codes.join('，') };
}
// 下标计算的完整说明：整数 h(k) = k mod m；字符串先算 h(s)，再 mod m
function idxCalc(k, m) {
  var h = hv(k), r = h % m;
  if (k.t === 'i') return { r: r, html: cd('h(' + h + ') = ' + h + ' mod ' + m + ' = ' + r) + '（' + h + ' = ' + Math.floor(h / m) + '×' + m + ' + ' + r + '）。' };
  var sc = strCalc(k.v);
  return { r: r, html: '字符串先按公式变成整数：' + sc.html + '（字符编码：' + sc.codes + '）。再取余：' + cd(h + ' mod ' + m + ' = ' + r) + '。' };
}
function idxShort(k, m) { var h = hv(k); return k.t === 'i' ? cd(h + ' mod ' + m + ' = ' + h % m) : cd('h(' + esc(kt(k)) + ') = ' + h) + '，' + cd(h + ' mod ' + m + ' = ' + h % m); }
function lead(h0, i, m, p) { return 'i = ' + i + '：' + cd('(' + h0 + ' + ' + i + ') mod ' + m + ' = ' + p) + '，格子 ' + p + ' '; }
function wrapTxt(p, m) { return p === m - 1 ? '格子 ' + p + ' 是最后一格，下一格绕回格子 0。' : ''; }

function push(st, T, hl, title, html, O) { if (st) st.push({ T: cp(T), O: O ? cp(O) : null, hl: hl || {}, title: title, html: html }); }

// 插入
function insert(T, k, c, st, tag) { return T.mode === 'chain' ? insChain(T, k, c, st, tag || '') : insProbe(T, k, c, st, tag || ''); }

function insChain(T, k, c, st, tag) {
  var m = T.m, x = idxCalc(k, m), b = x.r, ch = T.s[b], K = kc(k), ti = tag + '插入 ' + kt(k);
  push(st, T, { home: b, cur: b }, ti, x.html + K + ' 应该放进 ' + b + ' 号桶。');
  for (var j = 0; j < ch.length; j++) {
    if (same(ch[j], k)) { push(st, T, { home: b, cur: b, node: j, st: 'hit' }, ti, '链上第 ' + (j + 1) + ' 个键就是 ' + K + '，表里已经有它，不重复插入。'); return T; }
    push(st, T, { home: b, cur: b, node: j, st: 'clash' }, ti,
      (j === 0 ? b + ' 号桶里已经有键，发生冲突：不同的键算出了同一个下标。链地址法让同一个桶里的键排成一条链。插入前先沿链检查 ' + K + ' 是否已经在链上，避免重复。' : '') +
      '链上第 ' + (j + 1) + ' 个键是 ' + kc(ch[j]) + '，不是 ' + K + '。' + (j < ch.length - 1 ? '继续看下一个。' : '链到头了。'));
  }
  T = cp(T); T.s[b] = ch.concat([k]); T.n++;
  push(st, T, { home: b, cur: b, node: ch.length, st: 'put' }, ti,
    (ch.length ? none(ch.length) + K + '，把它接到链尾。' + b + ' 号桶现在是 ' + T.s[b].map(kc).join(' → ') + '。'
      : b + ' 号桶是空的，' + K + ' 直接放进去，成为这条链的第 1 个节点。') + alpha(T, c));
  return grow(T, c, st, tag);
}

function insProbe(T, k, c, st, tag) {
  var m = T.m, x = idxCalc(k, m), h0 = x.r, K = kc(k), ti = tag + '插入 ' + kt(k), path = [], mark = -1, i, p, cell, L;
  push(st, T, { home: h0 }, ti, x.html + '线性探测从格子 ' + h0 + ' 开始，依次看格子 ' + cd('(' + h0 + ' + i) mod ' + m) + '，i = 0, 1, 2, …，找第一个能放的格子。看过的格子按顺序排成探测序列（probe sequence）。');
  for (i = 0; i < m; i++) {
    p = (h0 + i) % m; cell = T.s[p]; L = lead(h0, i, m, p);
    if (cell === null) {
      var at = mark >= 0 ? mark : p;
      path.push({ i: p, st: mark >= 0 ? 'empty' : 'put' });
      T = cp(T); if (mark >= 0) T.tb--; T.s[at] = { k: k }; T.n++;
      push(st, T, { home: h0, cur: at, st: 'put', path: path.slice() }, ti, L + '是空的。' +
        (mark >= 0 ? '遇到空格子，说明 ' + K + ' 不在表里，把它放进前面记下的墓碑格 ' + mark + '。' : '把 ' + K + ' 放进格子 ' + p + '。') +
        '探测序列 ' + ids(path) + '，共看了 ' + path.length + ' 个格子。' + alpha(T, c));
      return grow(T, c, st, tag);
    }
    if (cell.tomb) {
      var first = mark < 0; if (first) mark = p;
      path.push({ i: p, st: 'tomb' });
      push(st, T, { home: h0, cur: p, st: 'tomb', path: path.slice(), mark: mark }, ti, L + (first
        ? '是墓碑（原来放着 ' + kc(cell.tomb) + '，已删除）。墓碑格可以复用，先记下格子 ' + p + '。但 ' + K + ' 也许放在更后面，要继续找到空格子，才能确认它不在表里。'
        : '又是墓碑，继续。') + wrapTxt(p, m));
      continue;
    }
    if (same(cell.k, k)) {
      path.push({ i: p, st: 'hit' });
      push(st, T, { home: h0, cur: p, st: 'hit', path: path.slice(), mark: mark }, ti, L + '放的就是 ' + K + '，表里已经有它，不重复插入。');
      return T;
    }
    path.push({ i: p, st: 'clash' });
    push(st, T, { home: h0, cur: p, st: 'clash', path: path.slice(), mark: mark }, ti, L + '已经放着 ' + kc(cell.k) + '，' +
      (i === 0 ? '发生冲突。线性探测的办法是往后一格接着找。' : '也被占了，继续往后。') + wrapTxt(p, m));
  }
  if (mark >= 0) {
    T = cp(T); T.tb--; T.s[mark] = { k: k }; T.n++;
    push(st, T, { home: h0, cur: mark, st: 'put', path: path.slice() }, ti, '全部 ' + m + ' 个格子都看过了，没有 ' + K + '。把它放进记下的墓碑格 ' + mark + '。' + alpha(T, c));
    return grow(T, c, st, tag);
  }
  push(st, T, { home: h0 }, ti, '全部 ' + m + ' 个格子都满了，放不下。');
  return T;
}

// 阈值被调低后，扩容一次 α 可能仍超过阈值，所以循环到不超过为止
function grow(T, c, st, tag) {
  for (var g = 0; over(T.n, T.m, c.thr); g++) T = rehash(T, nextPrimeAbove(2 * T.m), c, st, tag, true, g > 0);
  if (T.mode === 'probe' && T.tb && over(T.n + T.tb, T.m, c.thr)) return rehash(T, T.m, c, st, tag, false);
  return T;
}

// 扩容 / 重建：逐个重新插入
function rehash(O, m2, c, st, tag, isGrow, again) {
  var m = O.m, N = mk(O.mode, m2), list = [], i, ch = O.mode === 'chain', ti = tag + (isGrow ? '扩容' : '清理墓碑');
  for (i = 0; i < m; i++) {
    if (ch) O.s[i].forEach(function (k, j) { list.push({ k: k, oi: i, oj: j }); });
    else if (O.s[i] && O.s[i].k) list.push({ k: O.s[i].k, oi: i, oj: 0 });
  }
  if (isGrow) {
    var sk = [];
    for (i = 2 * m + 1; i < m2; i++) sk.push(i + ' = ' + minFactor(i) + '×' + i / minFactor(i));
    push(st, O, {}, ti, 'α = ' + O.n + '/' + m + ' ' + fa(O.n, m) + '，' + (again ? '仍然超过阈值 ' + ft(c.thr) + '（之前把阈值调低了，扩容一次还不够）' : '超过阈值 ' + ft(c.thr)) +
      '，要扩容（resize）。新容量取大于 2×' + m + ' = ' + 2 * m + ' 的最小质数：' + (sk.length ? sk.join('，') + '，都不是质数；' : '') + m2 + ' 是质数，所以新的 m = ' + m2 +
      '。取质数是为了让余数分布得更均匀：假如 m = 10 而键全是偶数，k mod 10 只会是 0、2、4、6、8，' + (ch ? '一半的桶永远用不上。' : '起点只落在一半的格子上，冲突会多很多。'));
    // 举例用的键：余数真的变了，而且新下标不是它现在所在的格子
    var ex = null, nr = 0;
    list.forEach(function (e) { var h = hv(e.k); if (h % m2 !== h % m) { nr++; if (!ex && h % m2 !== e.oi) ex = e; } });
    var exs = function (k) { var h = hv(k); return (k.t === 'i' ? '' : cd('h(' + esc(kt(k)) + ') = ' + h) + '，') + cd(h + ' mod ' + m + ' = ' + h % m) + '，而 ' + cd(h + ' mod ' + m2 + ' = ' + h % m2); };
    push(st, N, {}, ti, '新开一个有 ' + m2 + (ch ? ' 个桶' : ' 个格子') + '的空表，把旧表的键按' + (ch ? '桶' : '格子') + '的顺序一个个重新插入（rehash）。为什么不能把旧数组原样复制过去？下标是对 m 取余得到的，m 从 ' + m + ' 变成 ' + m2 + '，余数通常会变：' +
      (ex ? exs(ex.k) + '。如果 ' + kc(ex.k) + ' 还留在' + (ch ? ' ' + ex.oi + ' 号桶' : '格子 ' + ex.oi) + '，查找它时会用新的 m 算出 ' + hv(ex.k) % m2 + '，' + (ch ? '去 ' + hv(ex.k) % m2 + ' 号桶找' : '从格子 ' + hv(ex.k) % m2 + ' 开始找') + '，找错了地方。'
        : '比如 ' + exs(I(m + 3)) + '。' + (nr ? '' : '这张表里的键碰巧余数都没变，但不重算就不知道。')) +
      '所以每个键都要用新的 m 重新算下标。' + (ch ? '' : '线性探测里，键落在哪一格还取决于谁先占了位置，所以必须真的重新插入一遍。'), O);
  } else {
    push(st, O, {}, ti, '键只有 ' + O.n + ' 个，α 没超过阈值；但键加墓碑一共占了 ' + (O.n + O.tb) + ' 个格子，(' + O.n + ' + ' + O.tb + ')/' + m + ' ' + fa(O.n + O.tb, m) +
      '，超过阈值 ' + ft(c.thr) + '。墓碑越多，查找越难遇到空格子停下，要走的路越长。所以按原容量 ' + m + ' 重建一次，把墓碑清掉。');
    push(st, N, {}, ti, '新开一个有 ' + m + ' 个格子的空表，把键按旧表的格子顺序重新插入，墓碑不搬。下标 h mod ' + m + ' 不变，但原来被挤到后面的键可能回到更靠前的格子。', O);
  }
  var moved = [], nCh = 0;
  list.forEach(function (e, j) {
    var h = hv(e.k), r = h % m2, at = r, path = [], tx, node = 0;
    if (ch) {
      node = N.s[r].length;
      tx = node ? '接在 ' + N.s[r].map(kc).join(' → ') + ' 后面' : r + ' 号桶原来是空的，直接放进去';
      N = cp(N); N.s[r] = N.s[r].concat([e.k]); N.n++;
    } else {
      while (N.s[at] !== null) { path.push({ i: at, st: 'clash' }); at = (at + 1) % m2; }
      path.push({ i: at, st: 'put' });
      tx = path.length > 1 ? '格子 ' + ids(path.slice(0, -1)).replace(/ → /g, '、') + ' 已被占，往后探测到格子 ' + at + '，放进去' : '格子 ' + at + ' 是空的，直接放进去';
      N = cp(N); N.s[at] = { k: e.k }; N.n++;
    }
    var chg = at !== e.oi; if (chg) nCh++;
    moved.push(e.oi + ':' + e.oj);
    push(st, N, { home: r, cur: at, node: node, st: 'put', path: ch ? null : path, ocur: e.oi, onode: e.oj, moved: moved.slice() }, ti,
      '搬第 ' + (j + 1) + '/' + list.length + ' 个键 ' + kc(e.k) + '（在旧表' + (ch ? '的 ' + e.oi + ' 号桶' : '格子 ' + e.oi) + '）：' +
      (e.k.t === 'i' ? '' : 'h 值 ' + h + ' 不变，') + '新下标 ' + cd(h + ' mod ' + m2 + ' = ' + r) + '，' + tx + '。' +
      (chg ? '位置从 ' + e.oi + ' 变成 ' + at + '。' : '位置碰巧没变。'), O);
  });
  push(st, N, {}, ti, (isGrow ? '扩容完成，m 从 ' + m + ' 变成 ' + m2 + '。' : '重建完成，墓碑清空了。') + alpha(N, c) +
    (nCh ? list.length + ' 个键里有 ' + nCh + ' 个换了位置。' : '这次所有键的位置碰巧都没变。') + (!ch && O.tb ? '旧表里的 ' + O.tb + ' 个墓碑没有搬过来。' : ''));
  return N;
}

// 查找
function find(T, k, st, ti) {
  var m = T.m, x = idxCalc(k, m), h0 = x.r, K = kc(k), i, p, cell, L, path = [];
  if (T.mode === 'chain') {
    var ch = T.s[h0];
    push(st, T, { home: h0, cur: h0 }, ti, x.html + '只需要在 ' + h0 + ' 号桶的链上找，其他桶不用看。');
    for (i = 0; i < ch.length; i++) {
      if (same(ch[i], k)) { push(st, T, { home: h0, cur: h0, node: i, st: 'hit' }, ti, '链上第 ' + (i + 1) + ' 个键就是 ' + K + '，找到了。共比较 ' + (i + 1) + ' 次。'); return { found: true, at: h0, node: i, count: i + 1 }; }
      push(st, T, { home: h0, cur: h0, node: i, st: 'clash' }, ti, '比较链上第 ' + (i + 1) + ' 个键 ' + kc(ch[i]) + '：不是 ' + K + '。' + (i < ch.length - 1 ? '继续看下一个。' : ''));
    }
    push(st, T, { home: h0, cur: h0, st: 'miss' }, ti, ch.length ? none(ch.length) + K + '，所以 ' + K + ' 不在表里。共比较 ' + ch.length + ' 次。'
      : h0 + ' 号桶是空的，比较 0 次就知道 ' + K + ' 不在表里。');
    return { found: false, count: ch.length };
  }
  push(st, T, { home: h0 }, ti, x.html + '从格子 ' + h0 + ' 开始，依次看格子 ' + cd('(' + h0 + ' + i) mod ' + m) + '，i = 0, 1, 2, …，直到找到 ' + K + ' 或遇到空格子。');
  for (i = 0; i < m; i++) {
    p = (h0 + i) % m; cell = T.s[p]; L = lead(h0, i, m, p);
    if (cell === null) {
      path.push({ i: p, st: 'empty' });
      push(st, T, { home: h0, cur: p, st: 'miss', path: path.slice() }, ti, L + '是空的，可以停了：如果 ' + K + ' 在表里，它当初插入时一定停在这个空格子或更前面。' +
        K + ' 不在表里，共探测 ' + path.length + ' 次。');
      return { found: false, count: path.length };
    }
    if (cell.tomb) {
      path.push({ i: p, st: 'tomb' });
      push(st, T, { home: h0, cur: p, st: 'tomb', path: path.slice() }, ti, L + '是墓碑（原来放着 ' + kc(cell.tomb) + '）。墓碑表示这里有过键、后来删了，后面可能还有被挤过去的键，查找不能在这里停，继续往后。' + wrapTxt(p, m));
      continue;
    }
    if (same(cell.k, k)) {
      path.push({ i: p, st: 'hit' });
      push(st, T, { home: h0, cur: p, st: 'hit', path: path.slice() }, ti, L + '放的就是 ' + K + '，找到了。共探测 ' + path.length + ' 次。');
      return { found: true, at: p, count: path.length };
    }
    path.push({ i: p, st: 'clash' });
    push(st, T, { home: h0, cur: p, st: 'clash', path: path.slice() }, ti, L + '放着 ' + kc(cell.k) + '，不是 ' + K + '，继续往后。' + wrapTxt(p, m));
  }
  push(st, T, { home: h0 }, ti, '全部 ' + m + ' 个格子都看过了，没有 ' + K + '。');
  return { found: false, count: m };
}

// 删除
// 找一个「探测路线经过格子 i」的键：它的起点 h 到 i 的距离小于 h 到它所在格 j 的距离
function victim(T, i) {
  var m = T.m;
  for (var d = 1; d < m; d++) {
    var j = (i + d) % m, c = T.s[j];
    if (c === null) return null;
    if (c.k) { var h = hv(c.k) % m; if ((i - h + m) % m < (j - h + m) % m) return { k: c.k, h: h, j: j }; }
  }
  return null;
}
function remove(T, k, c, st) {
  var ti = '删除 ' + kt(k), r = find(T, k, st, ti), K = kc(k), m = T.m;
  if (!r.found) return T;
  if (T.mode === 'chain') {
    var b = r.at, before = T.s[b].map(kc).join(' → '), len = T.s[b].length;
    T = cp(T); T.s[b] = T.s[b].filter(function (q, j) { return j !== r.node; }); T.n--;
    push(st, T, { home: b, cur: b, st: 'del' }, ti, '把 ' + K + ' 从 ' + b + ' 号桶的链上摘掉：' + before + ' 变成 ' +
      (T.s[b].length ? T.s[b].map(kc).join(' → ') : '空链') + '。' + (r.node > 0 && r.node < len - 1 ? '它前面的节点直接连到它后面的节点。' : '') + a0(T));
    return T;
  }
  var p = r.at, v = victim(T, p), why, q, pth = [];
  if (v) {
    for (q = v.h; ; q = (q + 1) % m) { pth.push(q); if (q === v.j) break; }
    why = '原因：' + kc(v.k) + ' 的下标是 ' + idxShort(v.k, m) + '，插入时它沿 ' + pth.join(' → ') + ' 被挤到了格子 ' + v.j + '。如果格子 ' + p + ' 直接变空，下次查 ' + kc(v.k) +
      ' 会在格子 ' + p + ' 遇到空格子就停下，以为它不存在，可它明明在格子 ' + v.j + '。墓碑告诉查找「这里有过键，接着往后找」，探测链就不会断。';
  } else {
    why = '眼下没有键的探测路线经过格子 ' + p + '，这一次直接清空其实也不会出错。但一般情况下，后面可能有键是从格子 ' + p + ' 或更前面被挤过去的（比如下标是 ' + p + '、因冲突放到格子 ' + (p + 1) % m +
      ' 的键），清空会让查找在格子 ' + p + ' 提前停下，切断它的探测链。要确认安全，得检查后面整段连续的格子；统一留墓碑就不用检查。';
  }
  T = cp(T); T.s[p] = { tomb: k }; T.n--; T.tb++;
  push(st, T, { cur: p, st: 'del' }, ti, '把格子 ' + p + ' 标成墓碑（tombstone），不直接清空。' + why + '以后插入新键时，墓碑格可以复用。' + a0(T) + '墓碑现在有 ' + T.tb + ' 个。');
  return T;
}

// 预设：制造冲突
function preset(T, c, st) {
  var m = T.m, ks = [3, 3 + m, 3 + 2 * m, 3 + 3 * m], last = ks[3], txt;
  push(st, T, {}, '制造冲突', '选 4 个除以 ' + m + ' 余数都是 3 的键：' + ks.join('、') + '（相邻两个差 ' + m + '）。它们的下标都是 ' + cd('k mod ' + m + ' = 3') + '，一定会互相冲突。');
  ks.forEach(function (v, j) { T = insert(T, I(v), c, st, '（' + (j + 1) + '/4）'); });
  if (T.m !== m) txt = '插入途中表扩容到了 m = ' + T.m + '。在新表里这 4 个键的下标是 ' + ks.map(function (v) { return v % T.m; }).join('、') + '，不再挤在同一处。';
  else if (T.mode === 'chain') {
    var emp = T.s.filter(function (b) { return !b.length; }).length;
    txt = '3 号桶的链长现在是 ' + T.s[3].length + '，查 ' + last + ' 要从链头比较 ' + find(T, I(last)).count + ' 次；与此同时，' + m + ' 个桶里有 ' + emp + ' 个是空的。冲突越多，链越长，查找就越接近在链表里逐个比较。';
  } else {
    // 只数放着键的格子：墓碑会被新键复用，不算进这一段
    var run = [3], g, hasK = function (p) { return !!(T.s[p] && T.s[p].k); };
    for (g = 1; g < m && hasK((3 - g + m) % m); g++) run.unshift((3 - g + m) % m);
    for (g = 1; g < m && hasK((3 + g) % m) && run.length < m; g++) run.push((3 + g) % m);
    txt = '格子 ' + run.join('、') + ' 连成了一整段放着键的格子（' + run.length + ' 格）。以后下标落在这一段里的新键，都要先走完这一段才能找到位置，放进去后这一段又长一格。这种现象叫一次聚集（primary clustering），是线性探测的主要缺点。查 ' + last + ' 要探测 ' + find(T, I(last)).count + ' 次。';
  }
  push(st, T, {}, '制造冲突：小结', txt);
  return T;
}

function rebuild(order, mode, m0, c) { var T = mk(mode, m0); order.forEach(function (k) { T = insert(T, k, c, null, ''); }); return T; }

// 自测：只验证计算，不碰 DOM
function selfTest() {
  var d = [], ok = true, cP = { thr: 0.7 }, cC = { thr: 1 }, T, r;
  function chk(name, cond, info) { d.push((cond ? '通过：' : '失败：') + name + (info ? '（实际 ' + info + '）' : '')); if (!cond) ok = false; }
  function ins(T, vs, c) { vs.forEach(function (v) { T = insert(T, typeof v === 'number' ? I(v) : { t: 's', v: v }, c, null, ''); }); return T; }
  function at(T, v) { for (var i = 0; i < T.m; i++) if (T.s[i] && T.s[i].k && same(T.s[i].k, I(v))) return i; return -1; }
  try {
    chk('m = 7 时 hash(10) = 10 mod 7 = 3', idxCalc(I(10), 7).r === 3);
    T = ins(mk('probe', 7), [3, 10, 17], cP);
    chk('线性探测依次插入 3、10、17，落在格子 3、4、5', at(T, 3) === 3 && at(T, 10) === 4 && at(T, 17) === 5, [at(T, 3), at(T, 10), at(T, 17)].join(','));
    chk('大于 2m 的最小质数：m = 5→11，7→17，11→23，17→37', nextPrimeAbove(10) === 11 && nextPrimeAbove(14) === 17 && nextPrimeAbove(22) === 23 && nextPrimeAbove(34) === 37);
    var T5 = ins(T, [24, 31], cP);
    chk('线性探测 m = 7 插入第 5 个键（α = 5/7 > 0.7）后扩容，容量是 17', T5.m === 17 && T5.n === 5 && T5.tb === 0, 'm=' + T5.m);
    chk('扩容后逐个重插：17→0，3→3，24→7，10→10，31→14', at(T5, 17) === 0 && at(T5, 3) === 3 && at(T5, 24) === 7 && at(T5, 10) === 10 && at(T5, 31) === 14);
    var TC = ins(mk('chain', 7), [0, 1, 2, 3, 4, 5, 6], cC);
    chk('链地址 m = 7 放 7 个键（α = 1，不超过阈值 1）时不扩容', TC.m === 7);
    TC = ins(TC, [7], cC);
    chk('链地址 m = 7 放第 8 个键（α = 8/7 > 1）后扩容，容量是 17', TC.m === 17 && TC.n === 8 && find(TC, I(7)).found, 'm=' + TC.m);
    var TL = ins(ins(mk('chain', 5), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], { thr: 2 }), [10], { thr: 0.5 });
    chk('阈值从 2.0 调到 0.5 后再插入：5→11 后 α = 11/11 仍超过 0.5，接着扩到 23', TL.m === 23 && TL.n === 11, 'm=' + TL.m);
    var TD = remove(T, I(10), cP, null);
    r = find(TD, I(17));
    chk('线性探测删除 10 后格子 4 是墓碑，仍能查到 17（格子 5，探测 3 次）', !!(TD.s[4] && TD.s[4].tomb) && r.found && r.at === 5 && r.count === 3);
    var TX = cp(T); TX.s[4] = null; TX.n--;
    chk('反例：把格子 4 直接清空，查 17 会在格子 4 停下、找不到', !find(TX, I(17)).found);
    var TR = ins(TD, [24], cP);
    chk('墓碑复用：再插入 24（下标 3）放进墓碑格 4', at(TR, 24) === 4 && TR.tb === 0, at(TR, 24));
    var TH = ins(mk('chain', 7), [3, 10, 17, 24], cC);
    r = find(TH, I(24));
    chk('链地址：3、10、17、24 都进 3 号桶，查 24 比较 4 次', TH.s[3].length === 4 && r.found && r.count === 4);
    TH = remove(TH, I(10), cC, null);
    chk('链地址删除 10 后 3 号桶是 3 → 17 → 24', TH.s[3].map(kt).join(',') === '3,17,24');
    chk('字符串哈希与 Java String.hashCode 一致："cat" = 98262，"hello" = 99162322', strHash('cat') === 98262 && strHash('hello') === 99162322);
    chk('溢出取模：h("polygenelubricants") = 2^31（Java 里是 Integer.MIN_VALUE）', strHash('polygenelubricants') === 2147483648);
    chk('"cat" 在 m = 7 时下标是 98262 mod 7 = 3', idxCalc({ t: 's', v: 'cat' }, 7).r === 3);
    chk('输入解析：17 是整数，"17" 是字符串，-5 报错', parseKey('17').k.t === 'i' && parseKey('"17"').k.t === 's' && !!parseKey('-5').err);
  } catch (e) { chk('运行出错', false, String(e)); }
  return { ok: ok, details: d };
}

// 样式：类名里的 P- 换成 dm-ds-hash-；--dk/--dw/--dg/--dh 是本演示内部的颜色简写
var CSS = [
  '.P-root{--dk:color-mix(in srgb,var(--c-ds) 10%,var(--surface));--dw:color-mix(in srgb,var(--warn) 32%,var(--surface));--dg:color-mix(in srgb,var(--good) 24%,var(--surface));',
  '--dh:repeating-linear-gradient(135deg,color-mix(in srgb,var(--text-3) 28%,transparent) 0 2px,transparent 2px 6px);font-family:var(--font,sans-serif);color:var(--text);font-size:15px;line-height:1.6;min-width:0}',
  '.P-root *{box-sizing:border-box}.P-how{margin:0 0 12px;color:var(--text-2);font-size:14px;line-height:1.7}',
  '.P-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin:0 0 10px}.P-steps{gap:8px}',
  '.P-fld{display:inline-flex;align-items:center;gap:6px;font-size:14px;color:var(--text-2)}',
  '.P-seg{display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden}',
  '.P-btn,.P-seg button,.P-root select,.P-in{font:inherit;font-size:14px;line-height:1.2;padding:7px 12px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;min-height:36px}',
  '.P-btn,.P-seg button{cursor:pointer}.P-root select{padding:6px 8px}.P-in{font-family:var(--mono);width:9.5em;max-width:100%;padding:6px 8px}',
  '.P-seg button{border:0;border-radius:0}.P-seg button+button{border-left:1px solid var(--border)}',
  '.P-seg button[aria-pressed=true]{background:color-mix(in srgb,var(--c-ds) 18%,var(--surface));font-weight:600}',
  '.P-btn:hover:not([aria-disabled=true]),.P-seg button:hover{background:var(--surface-2)}',
  '.P-btn.is-pri{border-color:var(--c-ds);background:color-mix(in srgb,var(--c-ds) 12%,var(--surface))}.P-btn[aria-disabled=true]{opacity:.45;cursor:default}',
  '.P-root input[type=range]{width:110px;accent-color:var(--c-ds)}.P-root output{font:13px var(--mono);min-width:2.6em}',
  '.P-root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}',
  '.P-err{min-height:1.5em;margin:-4px 0 6px;font-size:13px;color:var(--text-2)}',
  '.P-nums{display:flex;flex-wrap:wrap;gap:0 14px;font:13px/1.6 var(--mono);color:var(--text-2)}',
  '.P-meter{position:relative;height:10px;margin:8px 0 3px;border-radius:5px;background:var(--surface-2);border:1px solid var(--border)}',
  '.P-meter span{position:absolute;left:0;top:0;bottom:0;border-radius:4px}.P-occ{background:var(--dh)}',
  '.P-fill{background:var(--c-ds);transition:width .3s}.P-fill.is-over{background:var(--warn)}',
  '.P-meter .P-thr{width:2px;top:-5px;bottom:-5px;background:var(--text)}',
  '.P-scale{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--text-3);margin-bottom:12px}',
  '.P-tbl{margin:0 0 14px}.P-cap{font-size:13px;color:var(--text-2);margin:0 0 6px}',
  '.P-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:10px 4px;align-items:start}',
  '.P-tbl.is-old .P-grid{grid-template-columns:repeat(auto-fill,minmax(40px,1fr))}',
  '.P-cell{display:flex;flex-direction:column;gap:3px;min-width:0}.P-idx{font:12px/1.3 var(--mono);color:var(--text-3);text-align:center}',
  '.P-box{height:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1.5px solid var(--border);border-radius:6px;background:var(--surface);overflow:hidden}',
  '.P-cell.is-empty .P-box,.P-sw.is-empty{border-style:dashed}',
  '.P-cell.is-key .P-box,.P-node,.P-sw.is-key{border:1.5px solid var(--c-ds);background:var(--dk)}',
  '.P-cell.is-tomb .P-box,.P-sw.is-tomb{border-style:dashed;border-color:var(--text-3);background:var(--dh)}',
  '.P-tw,.P-was{background:var(--surface);padding:0 3px;border-radius:3px;max-width:100%;overflow-wrap:anywhere;text-align:center;line-height:1.2}',
  '.P-tw{font-size:12px;font-weight:600}.P-was{font-size:11px;color:var(--text-2)}.P-was.is-xl{font-size:9px}',
  '.P-k{font:600 14px/1.15 var(--mono);text-align:center;overflow-wrap:anywhere;padding:0 2px}.P-k.is-l{font-size:12px}.P-k.is-xl{font-size:10px}',
  '.P-cell.is-cur .P-box,.P-node.is-cur,.P-bkt.is-cur>.P-idx,.P-sw.is-cur{outline:2.5px solid var(--text);outline-offset:1px}',
  '.P-cell.st-clash .P-box,.P-node.st-clash,.P-sw.is-clash,.P-chip.st-clash{background:var(--dw)}',
  '.P-cell.st-hit .P-box,.P-cell.st-put .P-box,.P-node.st-hit,.P-node.st-put,.P-sw.is-ok{border-color:var(--good);background:var(--dg)}',
  '.P-chip.st-hit,.P-chip.st-put{background:var(--dg)}.P-chip.st-tomb{background:var(--dh)}',
  '.P-cell.st-del .P-box,.P-bkt.st-del>.P-idx{background:color-mix(in srgb,var(--div-pos) 20%,var(--surface))}',
  '.P-cell.st-miss .P-box,.P-bkt.st-miss>.P-idx{background:var(--surface-2)}.P-cell.is-moved .P-box,.P-node.is-moved{opacity:.3}',
  '.P-cell.is-home>.P-idx{color:var(--text);font-weight:700;box-shadow:inset 0 -2px 0 var(--c-ds)}',
  '.P-tag{font-size:11px;line-height:1.2;text-align:center;color:var(--text-2)}',
  '.P-bkt>.P-idx{padding:5px 0;border:1.5px solid var(--border);border-radius:6px;background:var(--surface-2)}.P-bkt.is-home>.P-idx{border-color:var(--c-ds);box-shadow:none}',
  '.P-chain{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}',
  '.P-node{position:relative;min-height:30px;display:flex;align-items:center;justify-content:center;border-radius:6px}',
  '.P-node::before{content:"";position:absolute;left:50%;top:-11px;width:1.5px;height:9px;background:var(--edge-strong);transform:translateX(-50%)}',
  '.P-nil{font-size:11px;color:var(--text-3);text-align:center}',
  '.P-path{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;margin:-4px 0 12px}.P-lab{color:var(--text-2);font-size:13px}.P-arr{color:var(--text-3)}',
  '.P-chip{font:12px/1.4 var(--mono);padding:2px 8px;border-radius:12px;border:1px solid var(--border);background:var(--surface)}',
  '.P-chip small{font:11px var(--font);color:var(--text-2)}',
  '.P-now{margin:0 0 10px;padding:12px 14px;border:1px solid var(--border);border-left:3px solid var(--c-ds);border-radius:8px;background:var(--surface)}',
  '.P-nowh{display:flex;flex-wrap:wrap;justify-content:space-between;gap:0 10px;margin-bottom:4px}.P-nowt{font-weight:600}.P-cnt{font-size:13px;color:var(--text-3)}',
  '.P-nowb{line-height:1.8;overflow-wrap:anywhere}.P-nowb sup{font-size:.7em}',
  '.P-nowb code{font-family:var(--mono);font-size:.9em;background:var(--surface-2);border-radius:4px;padding:1px 5px;white-space:nowrap}',
  '.P-nowb code.P-long{white-space:normal;-webkit-box-decoration-break:clone;box-decoration-break:clone}',
  '.P-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--text-2)}',
  '.P-sw{display:inline-block;width:14px;height:14px;border-radius:3px;border:1.5px solid var(--border);vertical-align:-3px;margin-right:5px;background:var(--surface)}',
  '@media (prefers-reduced-motion:reduce){.P-root *{transition:none!important;animation:none!important}}'
].join('\n').replace(/P-/g, P);

// 画面
var STW = { clash: '被占', tomb: '墓碑', empty: '空', put: '放入', hit: '找到' };
function sp(c, h, a) { return '<span class="' + P + c + '"' + (a || '') + '>' + h + '</span>'; }
function dw(t) { return t.replace(/[^\x00-\xff]/g, 'xx').length; } // 显示宽度：汉字等全角字符按 2 个算
function keySpan(k) { var t = kt(k), w = dw(t); return sp('k' + (w > 4 ? ' is-xl' : w > 3 ? ' is-l' : ''), esc(t)); }
function cellCls(hl, i, j) { return hl.cur === i && hl.node === j ? ' is-cur st-' + (hl.st || 'look') : ''; }
function slotHTML(T, i, hl, old) {
  var c = T.s[i], cls = 'cell', inner = '', lab, tags = '', w;
  if (c === null) { cls += ' is-empty'; lab = '空'; }
  else if (c.tomb) { w = kt(c.tomb); cls += ' is-tomb'; inner = sp('tw', '墓碑') + sp('was' + (dw(w) > 4 ? ' is-xl' : ''), (dw(w) > 4 ? '' : '原 ') + esc(w)); lab = '墓碑，原来是 ' + w; }
  else { cls += ' is-key'; inner = keySpan(c.k); lab = kt(c.k); }
  if (old) cls += hl.ocur === i ? ' is-cur' : hl.moved && hl.moved.indexOf(i + ':0') > -1 ? ' is-moved' : '';
  else {
    cls += cellCls(hl, i, hl.node);
    if (hl.home === i) { cls += ' is-home'; tags += sp('tag', '起点'); }
    if (hl.mark === i && hl.cur !== i) tags += sp('tag', '记下');
  }
  return '<div class="' + P + cls + '" role="listitem" aria-label="格子 ' + i + '：' + esc(lab) + '">' + sp('idx', i) + sp('box', inner) + tags + '</div>';
}
function bucketHTML(T, i, hl, old) {
  var ch = T.s[i], cls = 'cell ' + P + 'bkt', nodes = '', j, nc;
  if (!old) cls += (hl.node == null ? cellCls(hl, i, hl.node) : '') + (hl.home === i ? ' is-home' : '');
  for (j = 0; j < ch.length; j++) {
    nc = old ? (hl.ocur === i && hl.onode === j ? ' is-cur' : hl.moved && hl.moved.indexOf(i + ':' + j) > -1 ? ' is-moved' : '') : cellCls(hl, i, j);
    nodes += '<li class="' + P + 'node' + nc + '">' + keySpan(ch[j]) + '</li>';
  }
  return '<div class="' + P + cls + '" role="listitem" aria-label="' + i + ' 号桶：' + esc(ch.length ? ch.map(kt).join(' → ') : '空') + '">' + sp('idx', i) +
    (ch.length ? '<ol class="' + P + 'chain">' + nodes + '</ol>' : sp('nil', '空')) + '</div>';
}
function tableHTML(T, hl, cap, old) {
  for (var i = 0, h = ''; i < T.m; i++) h += T.mode === 'chain' ? bucketHTML(T, i, hl, old) : slotHTML(T, i, hl, old);
  return '<div class="' + P + 'tbl' + (old ? ' is-old' : '') + '"><div class="' + P + 'cap">' + cap + '</div><div class="' + P + 'grid" role="list" aria-label="' + cap + '">' + h + '</div></div>';
}
function pathHTML(hl) {
  if (!hl.path || !hl.path.length) return '';
  return '<div class="' + P + 'path">' + sp('lab', '探测序列') + hl.path.map(function (q) { return sp('chip st-' + q.st, q.i + ' <small>' + STW[q.st] + '</small>'); })
    .join(sp('arr', '→', ' aria-hidden="true"')) + '</div>';
}
function statsHTML(T, c) {
  var max = T.mode === 'chain' ? 2 : 1, o = over(T.n, T.m, c.thr);
  function bar(cl, v) { return sp(cl, '', ' style="width:' + Math.min(100, v / max * 100).toFixed(1) + '%"'); }
  return '<div class="' + P + 'nums"><span>m = ' + T.m + '</span><span>n = ' + T.n + '</span><span>装载因子 α = n/m = ' + T.n + '/' + T.m + ' ' + fa(T.n, T.m) + '</span><span>阈值 ' + ft(c.thr) + '</span>' +
    (T.mode === 'probe' ? '<span>墓碑 ' + T.tb + '</span>' : '') + '</div><div class="' + P + 'meter" role="img" aria-label="装载因子 α ' + fa(T.n, T.m) + '，扩容阈值 ' + ft(c.thr) + '">' +
    (T.tb ? bar('occ', (T.n + T.tb) / T.m) : '') + bar('fill' + (o ? ' is-over' : ''), T.n / T.m) + sp('thr', '', ' style="left:calc(' + (c.thr / max * 100) + '% - 1px)"') + '</div>' +
    '<div class="' + P + 'scale"><span>0</span><span>竖线是阈值 ' + ft(c.thr) + (o ? '，α 已超过' : '') + (T.tb ? '；斜纹是墓碑' : '') + '</span><span>' + max + '</span></div>';
}
function legendHTML(ch) {
  function it(c, t) { return '<span><i class="' + P + 'sw ' + c + '"></i>' + t + '</span>'; }
  return it('is-key', '键') + (ch ? '' : it('is-empty', '空格子') + it('is-tomb', '墓碑')) + it('is-cur', '正在看') + it('is-clash', '被占 / 不相等') + it('is-ok', '放入 / 找到');
}
function btn(a, t, lab, pri) { return '<button type="button" class="P-btn' + (pri ? ' is-pri' : '') + '" data-a="' + a + '" data-r="' + a + '"' + (lab ? ' aria-label="' + lab + '"' : '') + '>' + t + '</button>'; }
var TPL = ('<p class="P-how">怎么玩：在输入框写一个非负整数（如 17）或不超过 8 个字符的字符串（如 cat），点「插入」「查找」或「删除」。每次操作拆成几步，点「下一步」逐步看，或点「自动播放」。想直接看冲突，点「制造冲突」。</p>' +
  '<div class="P-row"><span class="P-fld">冲突处理</span><span class="P-seg" role="group" aria-label="冲突处理方式"><button type="button" data-mode="chain" aria-pressed="true">链地址法</button><button type="button" data-mode="probe" aria-pressed="false">线性探测</button></span>' +
  '<label class="P-fld">初始大小 m<select data-r="size" aria-label="初始表大小 m"><option>5</option><option selected>7</option><option>11</option></select></label>' +
  '<label class="P-fld">扩容阈值<input type="range" data-r="thr" aria-label="扩容阈值：α 超过它就扩容"><output data-r="thrv"></output></label></div>' +
  '<div class="P-row"><input class="P-in" data-r="key" type="text" maxlength="12" placeholder="如 17 或 cat" aria-label="要操作的键：非负整数或短字符串" autocomplete="off" spellcheck="false">' +
  btn('ins', '插入', '插入这个键', 1) + btn('find', '查找', '查找这个键') + btn('del', '删除', '删除这个键') + btn('rand', '随机插入', '随机插入一个 0 到 99 的整数') +
  btn('clash', '制造冲突', '制造冲突：插入 4 个同余的键') + btn('reset', '重置', '重置：清空哈希表') + '</div>' +
  '<p class="P-err" data-r="err" role="status" aria-live="polite"></p><div data-r="stats"></div><div data-r="viz"></div>' +
  '<div class="P-now"><div class="P-nowh"><span class="P-nowt" data-r="title"></span><span class="P-cnt" data-r="cnt"></span></div><div class="P-nowb" data-r="text" aria-live="polite"></div></div>' +
  '<div class="P-row P-steps">' + btn('prev', '上一步', '上一步') + btn('next', '下一步', '下一步', 1) + btn('auto', '自动播放') + btn('end', '跳到结果', '跳到这次操作的结果') +
  '</div><div class="P-legend" data-r="legend"></div>').replace(/P-/g, P);

function mount(container) {
  if (!document.getElementById('dm-style-' + ID)) {
    var stl = document.createElement('style'); stl.id = 'dm-style-' + ID; stl.textContent = CSS; document.head.appendChild(stl);
  }
  var S = { mode: 'chain', m0: 7, thr: { chain: 1, probe: 0.7 }, order: [], frames: [], pos: 0, timer: 0 };
  var root = document.createElement('div'), offs = [], E = {};
  root.className = P + 'root'; root.innerHTML = TPL; container.appendChild(root);
  ['key', 'err', 'stats', 'viz', 'title', 'cnt', 'text', 'size', 'thr', 'thrv', 'legend', 'prev', 'next', 'auto', 'end'].forEach(function (r) { E[r] = root.querySelector('[data-r="' + r + '"]'); });
  function on(el, ev, fn) { el.addEventListener(ev, fn); offs.push(function () { el.removeEventListener(ev, fn); }); }
  function cfg() { return { thr: S.thr[S.mode] }; }
  function mname() { return S.mode === 'chain' ? '链地址法' : '线性探测'; }
  function stop() { if (S.timer) { clearInterval(S.timer); S.timer = 0; } }
  function reduced() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (x) { return false; } }
  function introText() {
    var m = S.cur.m;
    return '这是一张空的哈希表（hash table），有 ' + m + ' 个' + (S.mode === 'chain' ? '桶' : '格子') + '（m = ' + m + '）。键 k 放进下标为 ' + cd('k mod ' + m) + ' 的位置，比如 ' + cd('17 mod ' + m + ' = ' + 17 % m) + '。字符串键先按 ' + cd('h(s) = Σ s[i]·31<sup>n−1−i</sup> mod 2<sup>32</sup>', 1) + ' 算成整数（s[i] 是第 i 个字符的编码，n 是长度），再对 m 取余。两个键算出同一个下标，叫冲突（collision）。' +
      (S.mode === 'chain' ? '链地址法（separate chaining）让同一个桶里的键排成一条链。' : '线性探测（linear probing）属于开放定址（open addressing）：键都存在数组本身里，冲突了就往后一格一格找空格子。') +
      '键数 n 除以 m 叫装载因子（load factor）α，超过阈值就扩容。在上面输入一个键再点「插入」，或者直接点「制造冲突」。';
  }
  function intro(msg) { S.frames = []; push(S.frames, S.cur, {}, '准备好了', msg || introText()); S.pos = 0; render(); }
  function render() {
    var f = S.frames[S.pos], T = f.T, hl = f.hl, ch = T.mode === 'chain', last = S.pos >= S.frames.length - 1;
    E.stats.innerHTML = statsHTML(T, cfg());
    E.viz.innerHTML = (f.O ? tableHTML(f.O, hl, '旧表：m = ' + f.O.m + '，键正在搬出', true) : '') +
      tableHTML(T, hl, f.O ? '新表：m = ' + T.m + (hl.moved ? '，已搬 ' + hl.moved.length + '/' + f.O.n + ' 个键' : '') : '哈希表：m = ' + T.m + (ch ? ' 个桶，链地址法' : ' 个格子，线性探测'), false) + pathHTML(hl);
    E.title.textContent = f.title;
    E.cnt.textContent = '第 ' + (S.pos + 1) + ' / ' + S.frames.length + ' 步';
    E.text.innerHTML = f.html;
    // 用 aria-disabled 而不是 disabled：按钮到头时焦点留在原处，键盘用户不会被甩回页面开头
    var rm = reduced();
    E.prev.setAttribute('aria-disabled', String(S.pos === 0)); E.next.setAttribute('aria-disabled', String(last)); E.end.setAttribute('aria-disabled', String(last));
    E.auto.setAttribute('aria-disabled', String(rm || (!S.timer && last)));
    E.auto.textContent = S.timer ? '暂停' : '自动播放';
    E.auto.setAttribute('aria-label', S.timer ? '暂停自动播放' : '自动播放这次操作的每一步');
    E.auto.title = rm ? '系统开启了「减少动态效果」，自动播放已关闭' : '';
    E.legend.innerHTML = legendHTML(ch);
  }
  function go(p) { S.pos = Math.max(0, Math.min(S.frames.length - 1, p)); render(); }
  function auto() {
    if (S.timer) { stop(); render(); return; }
    if (S.pos >= S.frames.length - 1) return;
    if (reduced()) { E.err.textContent = '系统开启了「减少动态效果」，自动播放已关闭，请用「下一步」逐步看。'; return; }
    S.timer = setInterval(function () { if (S.pos < S.frames.length - 1) S.pos++; if (S.pos >= S.frames.length - 1) stop(); render(); }, 1300);
    render();
  }
  // 执行一次操作：算出全部步骤，表的最终状态立即生效；keys 用来维护插入顺序（切换策略时按这个顺序重放）
  function run(fn, keys) {
    stop(); E.err.textContent = '';
    var st = [], before = S.cur, T = fn(S.cur, cfg(), st);
    (keys || []).forEach(function (k) {
      var had = find(before, k).found, has = find(T, k).found;
      if (!had && has) S.order.push(k);
      if (had && !has) S.order = S.order.filter(function (x) { return !same(x, k); });
    });
    S.cur = T; S.frames = st; S.pos = 0; render();
  }
  function getKey() { var r = parseKey(E.key.value); if (r.err) { E.err.textContent = r.err; return null; } return r.k; }
  function full() { E.err.textContent = '这个演示最多放 ' + MAXK + ' 个键，现在已经有 ' + S.cur.n + ' 个。先删几个，或者点「重置」。'; }
  function doIns(k) {
    k = k || getKey(); if (!k) return;
    if (S.cur.n >= MAXK && !find(S.cur, k).found) return full();
    run(function (T, c, st) { return insert(T, k, c, st, ''); }, [k]);
  }
  function act(a) {
    var k, m = S.cur.m;
    if (a === 'ins') doIns();
    else if (a === 'find') { k = getKey(); if (k) run(function (T, c, st) { find(T, k, st, '查找 ' + kt(k)); return T; }); }
    else if (a === 'del') { k = getKey(); if (k) run(function (T, c, st) { return remove(T, k, c, st); }, [k]); }
    else if (a === 'rand') {
      for (var pool = [], v = 0; v < 100; v++) if (!find(S.cur, I(v)).found) pool.push(v);
      v = pool[Math.floor(Math.random() * pool.length)]; E.key.value = String(v); doIns(I(v));
    }
    else if (a === 'clash') { if (S.cur.n + 4 > MAXK) return full(); run(preset, [0, 1, 2, 3].map(function (j) { return I(3 + j * m); })); }
    else if (a === 'prev') { stop(); go(S.pos - 1); }
    else if (a === 'next') { stop(); go(S.pos + 1); }
    else if (a === 'end') { stop(); go(S.frames.length - 1); }
    else if (a === 'auto') auto();
    else if (a === 'reset') { stop(); S.order = []; S.cur = mk(S.mode, S.m0); E.err.textContent = ''; intro(); }
  }
  function syncThr() {
    var t = S.thr[S.mode];
    E.thr.min = '0.5'; E.thr.max = S.mode === 'chain' ? '2' : '0.9'; E.thr.step = '0.05'; E.thr.value = String(t);
    E.thrv.textContent = ft(t); E.thr.setAttribute('aria-valuetext', '阈值 ' + ft(t));
  }
  function rebuilt(what) {
    stop(); E.err.textContent = '';
    S.cur = rebuild(S.order, S.mode, S.m0, cfg());
    intro(S.order.length ? what + '现有的 ' + S.order.length + ' 个键按原来的插入顺序重新放了一遍（从 m = ' + S.m0 + ' 开始' + (S.cur.m !== S.m0 ? '，途中扩容到了 m = ' + S.cur.m : '') + '）。' + alpha(S.cur, cfg()) : introText());
  }
  on(root, 'click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b || !root.contains(b) || b.disabled) return;
    var md = b.getAttribute('data-mode');
    if (md) {
      if (md === S.mode) return;
      S.mode = md; syncThr();
      root.querySelectorAll('[data-mode]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-mode') === md)); });
      return rebuilt('已切换到' + mname() + '，扩容阈值换成 ' + ft(S.thr[S.mode]) + '。');
    }
    act(b.getAttribute('data-a'));
  });
  on(E.key, 'keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doIns(); } });
  on(root, 'keydown', function (e) {
    var t = e.target.tagName;
    if (t === 'INPUT' || t === 'SELECT' || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); act('next'); } else if (e.key === 'ArrowLeft') { e.preventDefault(); act('prev'); }
  });
  on(E.size, 'change', function () { S.m0 = +E.size.value; rebuilt('初始大小改成 ' + S.m0 + '。'); });
  on(E.thr, 'input', function () {
    var t = +E.thr.value; S.thr[S.mode] = t; E.thrv.textContent = ft(t); E.thr.setAttribute('aria-valuetext', '阈值 ' + ft(t));
    E.stats.innerHTML = statsHTML(S.frames[S.pos].T, cfg());
    E.err.textContent = over(S.cur.n, S.cur.m, t) ? '当前 α = ' + S.cur.n + '/' + S.cur.m + ' ' + fa(S.cur.n, S.cur.m) + ' 已超过新阈值 ' + ft(t) + '，下一次插入后会扩容。' : '';
  });
  S.cur = mk(S.mode, S.m0); syncThr(); intro();
  return { destroy: function () { stop(); offs.forEach(function (f) { f(); }); offs = []; if (root.parentNode) root.parentNode.removeChild(root); } };
}

window.KGDemos = window.KGDemos || {};
window.KGDemos[ID] = { title: '哈希表：冲突与扩容', mount: mount, selfTest: selfTest };
})();
