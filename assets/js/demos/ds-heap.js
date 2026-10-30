/* ds-heap：二叉堆，数组和树是同一个东西。window.KGDemos['ds-heap'] */
(function () {
  'use strict';
  var ID = 'ds-heap', P = 'dm-ds-heap-', MAX = 15;
  var DEF = [9, 4, 7, 1, 2, 6, 3];

  /* ---------- 核心计算（不碰 DOM） ---------- */
  function better(m, x, y) { return m === 'max' ? x > y : x < y; } // x 应该排在 y 上面
  function words(m) {
    return m === 'max'
      ? { name: '最大堆', prop: '父 ≥ 子', ok: '≥', bad: '<', top: '最大值', adj: '大', order: '从大到小' }
      : { name: '最小堆', prop: '父 ≤ 子', ok: '≤', bad: '>', top: '最小值', adj: '小', order: '从小到大' };
  }
  function par(i) { return Math.floor((i - 1) / 2); }
  function lg(k) { var h = 0; while (k > 1) { k = Math.floor(k / 2); h++; } return h; }
  function fa(a) { return '[' + a.join(', ') + ']'; }
  function tg() { var o = {}; for (var k = 0; k < arguments.length; k += 2) o[arguments[k]] = arguments[k + 1]; return o; }
  function hOf(i, n) { var h = 0; while (2 * i + 1 < n) { i = 2 * i + 1; h++; } return h; } // 节点高度
  function isHeap(a, m) { for (var i = 1; i < a.length; i++) if (better(m, a[i], a[par(i)])) return false; return true; }
  // 一次操作最多显示几格（含空位）。整次操作按它排版，逐步播放时布局不跳
  function capOf(fr) { var k = 0; fr.forEach(function (f) { k = Math.max(k, Math.min(f.arr.length + 1, MAX)); }); return k; }

  // 记录器：每一步存一帧（数组快照 + 高亮 + 说明 + 计数）
  function Rec(a, m) { this.a = a.slice(); this.m = m; this.w = words(m); this.c = 0; this.s = 0; this.fr = []; this.out = null; this.pend = -1; }
  Rec.prototype.f = function (head, body, o) {
    o = o || {};
    var cur = o.cur == null ? -1 : o.cur;
    this.fr.push({ arr: this.a.slice(), head: head, body: [].concat(body), cmp: o.cmp || [], swap: o.swap || [],
      cur: cur, focus: o.focus == null ? cur : o.focus, tags: o.tags || {}, eh: o.eh || [],
      pend: this.pend, out: this.out ? this.out.slice() : null, c: this.c, s: this.s });
  };
  Rec.prototype.sw = function (i, j) { var t = this.a[i]; this.a[i] = this.a[j]; this.a[j] = t; this.s++; };

  function opInsert(arr, v, m) {
    var R = new Rec(arr, m), w = R.w, a = R.a, n = arr.length, i = n, p, x, y, up;
    a.push(v);
    if (!n) {
      R.f('插入 ' + v + '：堆原来是空的', v + ' 放进下标 0，成为根。只有一个节点的树一定满足堆性质，插入完成。', { cur: 0, tags: tg(0, '新') });
      return R;
    }
    p = par(n);
    R.f('插入 ' + v + '：先放到数组末尾，下标 ' + n,
      '完全二叉树按层从左到右填满，下一个空位就是下标 ' + n + '。在树里它是下标 ' + p + ' 的' + (n % 2 ? '左' : '右') +
      '孩子，因为父 = ⌊(' + n + '−1)/2⌋ = ' + p + '。接下来让它和父节点比，不满足「' + w.prop + '」就交换，这个过程叫上浮（sift-up）。',
      { cur: n, tags: tg(n, '新') });
    while (i > 0) {
      p = par(i); x = a[i]; y = a[p]; up = better(m, x, y);
      R.c++;
      R.f('比较：下标 ' + i + ' 的 ' + x + ' 和它的父节点（下标 ' + p + '）' + y,
        '父 = ⌊(' + i + '−1)/2⌋ = ' + p + '。' + w.name + '要求' + w.prop + '，' +
        (up ? '现在父 ' + y + ' ' + w.bad + ' 子 ' + x + '，不满足，要交换。' : '父 ' + y + ' ' + w.ok + ' 子 ' + x + '，满足。' +
          (p ? '再往上的祖先都 ' + w.ok + ' ' + y + (x === y ? '' : '，也就都 ' + w.ok + ' ' + x) + '，' : '') + '上浮到此结束。'),
        { cmp: [i, p], eh: [i], tags: tg(i, '比较', p, '比较'), focus: i });
      if (!up) break;
      R.sw(i, p);
      R.f('交换下标 ' + i + ' 和 ' + p,
        x + ' 上移到下标 ' + p + '，' + y + ' 下移到下标 ' + i + '。' +
        (p ? x + ' 的新父节点是下标 ⌊(' + p + '−1)/2⌋ = ' + par(p) + '，继续比较。' : x + ' 到了根（下标 0），上面没有父节点，上浮结束。'),
        { swap: [i, p], eh: [i], tags: tg(p, '交换', i, '交换'), focus: p });
      i = p;
    }
    var h = lg(n + 1);
    R.f('插入完成：' + v + ' 停在下标 ' + i + (i ? '' : '（根）'),
      '这次比较 ' + R.c + ' 次，交换 ' + R.s + ' 次。新元素从第 ' + h + ' 层出发，每比较一次最多往上走一层，所以最多比较 ' + h +
      ' 次。n 个元素的完全二叉树高 ⌊log₂ n⌋，插入是 O(log n)。',
      { cur: i, tags: tg(i, '到位') });
    return R;
  }

  // 从下标 i 往下沉；pre 是标题前缀，done 是结束时补充的一句
  function sink(R, i, pre, done) {
    var a = R.a, n = a.length, w = R.w, m = R.m, l, r, c, o, x, y, dn;
    done = done || '';
    for (;;) {
      l = 2 * i + 1; r = l + 1; c = l; x = a[i];
      if (l >= n) {
        R.f(pre + x + ' 停在下标 ' + i + '：它没有孩子',
          '左孩子应在 2×' + i + '+1 = ' + l + '，但数组最大下标是 ' + (n - 1) + '，所以下标 ' + i + ' 是叶子，下沉结束。' + done,
          { cur: i, tags: tg(i, '到位') });
        return i;
      }
      if (r < n) {
        R.c++;
        if (better(m, a[r], a[l])) c = r;
        o = c === l ? r : l;
        R.f(pre + '比较两个孩子：下标 ' + l + ' 的 ' + a[l] + ' 和下标 ' + r + ' 的 ' + a[r],
          '左孩子 = 2×' + i + '+1 = ' + l + '，右孩子 = 2×' + i + '+2 = ' + r + '。' + (a[l] === a[r] ? '两个孩子相等，选哪个都行，这里选左孩子。' :
          '较' + w.adj + '的是 ' + a[c] + '。如果要交换，' + x + ' 只能和它换：换上去的若是 ' + a[o] + '，它会成为 ' + a[c] + ' 的父节点，而 ' +
          a[o] + ' ' + w.bad + ' ' + a[c] + '，又违反' + w.prop + '。'),
          { cmp: [l, r], eh: [l, r], cur: i, tags: tg(l, '比较', r, '比较') });
      }
      y = a[c]; dn = better(m, y, x);
      R.c++;
      R.f(pre + '比较：下标 ' + i + ' 的 ' + x + ' 和' + (c === l ? '左' : '右') + '孩子（下标 ' + c + '）' + y,
        (r < n ? '' : '右孩子下标 ' + r + ' 超出范围，只有左孩子 2×' + i + '+1 = ' + l + '。') + w.name + '要求' + w.prop + '，' +
        (dn ? '现在父 ' + x + ' ' + w.bad + ' 子 ' + y + '，不满足，要交换。' : '父 ' + x + ' ' + w.ok + ' 子 ' + y + '，满足，下沉结束。' + done),
        { cmp: [i, c], eh: [c], tags: tg(i, '比较', c, '比较'), focus: i });
      if (!dn) return i;
      R.sw(i, c);
      R.f(pre + '交换下标 ' + i + ' 和 ' + c,
        x + ' 下沉到下标 ' + c + '，' + y + ' 上到下标 ' + i + '。接着看 ' + x + ' 在下标 ' + c + ' 的孩子。',
        { swap: [i, c], eh: [c], tags: tg(i, '交换', c, '交换'), focus: c });
      i = c;
    }
  }

  function popInto(R, pre) {
    var a = R.a, n = a.length, w = R.w, top = a[0], last;
    R.f(pre + '取出堆顶：下标 0 的 ' + top,
      w.name + '的根是全堆的' + w.top + '，所以弹出的就是 ' + top + '。' + (n > 1 ? '根空出来以后要找一个元素补上。' : '它是堆里唯一的元素。'),
      { cur: 0, tags: tg(0, '堆顶') });
    last = a.pop();
    if (R.out) R.out.push(top);
    if (n === 1) return { top: top, at: -1 };
    a[0] = last;
    R.f(pre + '把最后一个元素 ' + last + '（下标 ' + (n - 1) + '）移到根',
      '删掉数组的最后一格不会破坏完全二叉树的形状，所以用末尾元素补到根上，数组长度从 ' + n + ' 变成 ' + (n - 1) + '。现在根是 ' + last +
      '，要和孩子比较，不满足「' + w.prop + '」就往下换，这个过程叫下沉（sift-down）。',
      { cur: 0, tags: tg(0, '移入') });
    return { top: top, at: sink(R, 0, pre) };
  }

  function opPop(arr, m) {
    var R = new Rec(arr, m), n = arr.length, res, k, h;
    if (!n) { R.f('堆是空的', '没有元素可以弹出。先插入几个数，或者输入一组数建堆。'); return R; }
    res = popInto(R, ''); R.top = res.top; k = n - 1; h = lg(k);
    R.f('弹出完成，返回 ' + res.top,
      k ? '这次比较 ' + R.c + ' 次，交换 ' + R.s + ' 次。下沉每到一层最多比较 2 次（两个孩子先比一次，再和选中的孩子比一次）。剩下 ' + k +
        ' 个元素，树高 ⌊log₂ ' + k + '⌋ = ' + h + '，最多下沉 ' + h + ' 层，所以弹出是 O(log n)。'
        : res.top + ' 是唯一的元素，取走后堆空了。',
      res.at >= 0 ? { cur: res.at, tags: tg(res.at, '到位') } : {});
    return R;
  }

  // Floyd 自底向上建堆；sw=true 表示是切换堆类型时的重建
  function opBuild(arr, m, sw) {
    var R = new Rec(arr, m), a = R.a, n = a.length, w = R.w, st = Math.floor(n / 2) - 1, i, h, l, r, lv = {};
    var hp = isHeap(a, m);
    if (n < 2) {
      R.f((sw ? '切换成' + w.name : '建堆') + '：只有 ' + n + ' 个元素', '不超过一个元素的数组本身就是堆，不用调整。');
      return R;
    }
    for (i = st + 1; i < n; i++) lv[i] = '叶子';
    R.pend = st + 1;
    R.f(sw ? '切换成' + w.name + '：用 Floyd 建堆重新调整' : 'Floyd 建堆：先把 ' + n + ' 个数原样放进数组',
      [(sw ? w.name + '要求' + w.prop + '。' : '') + '现在的数组 ' + fa(a) +
        (hp ? ' 恰好已经满足' + w.prop + '，流程照样走一遍。' : ' 还不满足' + w.prop + '，还不是堆。'),
       '下标 ' + (st + 1) + (n > 2 ? ' 到 ' + (n - 1) : '') + ' 是叶子（leaf，左孩子下标 2i+1 ≥ ' + n + '），一个节点自己就是堆，不用动。Floyd 建堆（自底向上的 build-heap，常被叫作 heapify）从最后一个非叶子 ⌊' + n +
        '/2⌋−1 = ' + st + ' 开始，倒着处理到下标 0，每个都做一次下沉。必须从下往上：下沉要求左右子树已经是堆，倒着处理，轮到下标 i 时它的孩子都已经处理过了。'],
      { tags: lv });
    for (i = st; i >= 0; i--) {
      R.pend = i; l = 2 * i + 1; r = l + 1;
      R.f('处理下标 ' + i + '（值 ' + a[i] + '）',
        (r < n ? '它的两棵子树（根在下标 ' + l + ' 和 ' + r + '）' : '它的子树（根在下标 ' + l + '）') + '已经是堆，只有 ' + a[i] +
        ' 自己可能放错了位置。把它下沉到位，以下标 ' + i + ' 为根的子树就整个成了堆。',
        { cur: i, tags: tg(i, '处理') });
      sink(R, i, '', '以下标 ' + i + ' 为根的子树现在是堆了。');
    }
    R.pend = -1;
    var cnt = [], S = 0, parts = [], terms = [], ins = 0;
    for (i = 0; i < n; i++) { h = hOf(i, n); cnt[h] = (cnt[h] || 0) + 1; S += h; }
    for (h = 0; h < cnt.length; h++) { parts.push('高度 ' + h + ' 的 ' + cnt[h] + ' 个'); terms.push(cnt[h] + '×' + h); }
    for (i = 1; i <= n; i++) ins += lg(i);
    R.f('建堆完成：' + fa(a),
      ['这次比较 ' + R.c + ' 次，交换 ' + R.s + ' 次。',
       '为什么总代价是 O(n)：一个节点最多下沉到底，下沉的层数不超过它的高度（height：从它往下到最深的叶子隔几层）。这 ' + n + ' 个节点里，' + parts.join('、') +
        '，所以交换最多 ' + terms.join(' + ') + ' = ' + S + ' 次；每层最多比较 2 次，比较最多 ' + (2 * S) + ' 次。',
       '一般地，约一半节点是叶子，不用动；1/4 的节点最多下沉 1 层，1/8 最多下沉 2 层，依此类推，能沉很多层的只有根附近的少数节点。总层数 ≤ n×(1/4 + 2/8 + 3/16 + …) = n。',
       '对比：从空堆开始逐个插入这 ' + n + ' 个数，第 k 个数最多上浮 ⌊log₂ k⌋ 层，最坏共交换 ' + ins + ' 次，是 O(n log n)。'],
      {});
    return R;
  }

  function opSort(arr, m) {
    var R = new Rec(arr, m), n = arr.length, w = R.w, k;
    R.out = [];
    if (!n) { R.f('堆是空的', '没有元素可以排序。'); return R; }
    R.f('堆排序：反复弹出堆顶',
      w.name + '每次弹出的都是剩下元素里的' + w.top + '，按弹出顺序排下来就是' + w.order + '。这里有 ' + n + ' 个元素，要弹出 ' + n +
      ' 次，弹出的数依次记在数组下方的「已弹出」一行。');
    for (k = 1; k <= n; k++) popInto(R, '第 ' + k + '/' + n + ' 次弹出 · ');
    R.f('堆排序完成：' + fa(R.out),
      ['这次一共比较 ' + R.c + ' 次，交换 ' + R.s + ' 次。弹出 n 次，每次 O(log n)，所以堆排序是 O(n log n)。从无序数组开始时要先建堆，Floyd 建堆只要 O(n)，总量级不变。',
       '这里为了看清楚，把弹出的数放进了另一个数组。常见写法是原地排序：把堆顶和堆的最后一个元素交换，堆的范围缩小 1，再让新的根下沉；数组尾部逐渐变成排好的部分，不需要额外空间。原地做时用最大堆，结果是升序。',
       '堆已经弹空了。想接着试，点「重置」，或者在「建堆」里输入一组数。']);
    return R;
  }

  function opInit(m) {
    var a = opBuild(DEF, m).a, R = new Rec(a, m), w = R.w;
    R.f('准备好了：一个' + w.name + '，数组 ' + fa(a),
      '数组按层、从左到右排成一棵完全二叉树（complete binary tree）：下标 i 的父节点是下标 ⌊(i−1)/2⌋，孩子是 2i+1 和 2i+2。每个父节点都' +
      (m === 'max' ? '不小于' : '不大于') + '它的孩子（' + w.prop + '），这条规则叫堆性质（heap property），所以堆顶 ' + a[0] + ' 是' + w.top +
      '。试试插入一个数、弹出堆顶，或者在「建堆」里输入一组数。');
    return R;
  }

  function selfTest() {
    var det = [], ok = true;
    function eq(x, y) { return JSON.stringify(x) === JSON.stringify(y); }
    function chk(name, got, want) {
      var p = eq(got, want); if (!p) ok = false;
      det.push((p ? '通过：' : '失败：') + name + ' → ' + JSON.stringify(got) + (p ? '' : '，期望 ' + JSON.stringify(want)));
    }
    function ins(list, m) { var a = []; list.forEach(function (v) { a = opInsert(a, v, m).a; }); return a; }
    var h = ins([5, 3, 8, 1], 'min');
    chk('最小堆依次插入 5,3,8,1', h, [1, 3, 8, 5]);
    var p = opPop(h, 'min');
    chk('接着弹出：返回值、剩下的数组', [p.top, p.a], [1, [3, 5, 8]]);
    var b = opBuild([9, 4, 7, 1, 2, 6, 3], 'min');
    chk('Floyd 建堆 [9,4,7,1,2,6,3]（最小堆）', b.a, [1, 2, 3, 4, 9, 6, 7]);
    chk('这次建堆的比较、交换次数', [b.c, b.s], [8, 4]);
    var i1 = opInsert([3, 5, 8], 1, 'min');
    chk('[3,5,8] 插入 1：数组、比较、交换', [i1.a, i1.c, i1.s], [[1, 3, 8, 5], 2, 2]);
    var mh = ins([5, 3, 8, 1], 'max'), mp = opPop(mh, 'max');
    chk('最大堆插入 5,3,8,1，再弹出', [mh, mp.top, mp.a], [[8, 3, 5, 1], 8, [5, 3, 1]]);
    chk('最大堆 Floyd 建堆 [1,2,3,4,5,6,7]', opBuild([1, 2, 3, 4, 5, 6, 7], 'max').a, [7, 5, 6, 4, 2, 1, 3]);
    chk('堆排序（最小堆 [1,2,3,4,9,6,7]）', opSort(b.a, 'min').out, [1, 2, 3, 4, 6, 7, 9]);
    var seed = 20241019, bad = 0, N = 300, t, j;
    function rnd(k) { seed = seed * 16807 % 2147483647; return seed % k; }
    for (t = 0; t < N; t++) {
      var m = t % 2 ? 'max' : 'min', n = 1 + rnd(MAX), arr = [], Hs = 0;
      for (j = 0; j < n; j++) { arr.push(rnd(100)); Hs += hOf(j, n); }
      var B = opBuild(arr, m), I = ins(arr, m), So = opSort(B.a, m);
      var want = arr.slice().sort(function (x, y) { return m === 'max' ? y - x : x - y; });
      var lastB = B.fr[B.fr.length - 1];
      if (!isHeap(B.a, m) || !isHeap(I, m) || !eq(So.out, want) || So.a.length || B.s > Hs || B.c > 2 * Hs ||
          !eq(lastB.arr, B.a) || lastB.c !== B.c || lastB.s !== B.s) bad++;
    }
    if (bad) ok = false;
    det.push((bad ? '失败：' : '通过：') + '随机 ' + N + ' 组（最小堆、最大堆各半）：建堆和逐个插入的结果都满足堆性质，堆排序结果正确，' +
      '建堆交换次数 ≤ 各节点高度之和、比较次数 ≤ 2 倍高度之和' + (bad ? '；出错 ' + bad + ' 组' : ''));
    return { ok: ok, details: det };
  }

  /* ---------- 样式与模板（~ 会被替换成类名前缀） ---------- */
  var CSS = [
    '.~root{container-type:inline-size;font-family:var(--font);font-size:15px;line-height:1.65;color:var(--text);' +
      '--~k:color-mix(in srgb,var(--warn) 38%,var(--surface));--~w:color-mix(in srgb,var(--c-ds) 30%,var(--surface))}',
    '.~root *{box-sizing:border-box}',
    '.~how{margin:0 0 12px;color:var(--text-2)}',
    '.~ops,.~viz,.~stats,.~formula{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)}',
    '.~ops{display:flex;flex-direction:column;gap:10px;padding:12px}',
    '.~grp{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
    '.~lab{font-size:13px;color:var(--text-2);width:3.6em;flex:none}',
    '.~root button,.~root input,.~root select{font:inherit;font-size:14px;line-height:1.2;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;min-height:34px}',
    '.~root button{padding:7px 12px;cursor:pointer}',
    '.~root button:hover:not(:disabled){background:var(--surface-2)}',
    '.~root button:disabled,.~root button[aria-disabled=true]{opacity:.45;cursor:not-allowed}',
    '.~root input{padding:6px 8px;min-width:0}',
    '.~root select{padding:4px 6px;margin-left:6px}',
    '.~root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}',
    '.~root .~pri{border-color:var(--c-ds);background:color-mix(in srgb,var(--c-ds) 14%,var(--surface));font-weight:600}',
    '.~seg{display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden}',
    '.~root .~seg button{border:0;border-radius:0}',
    '.~root .~seg button+button{border-left:1px solid var(--border)}',
    '.~root .~seg button[aria-pressed=true]{background:color-mix(in srgb,var(--c-ds) 18%,var(--surface));font-weight:600}',
    '.~val{width:4.6em}',
    '.~arrin{flex:1 1 120px}',
    '.~err{margin:0;padding:6px 10px;font-size:13px;border-left:3px solid var(--warn);background:color-mix(in srgb,var(--warn) 12%,var(--surface))}',
    '.~err:empty{display:none}',
    '.~viz{margin-top:12px;padding:12px 12px 10px}',
    '.~cap{font-size:13px;font-weight:600;color:var(--text-2)}',
    '.~cap span{font-weight:400;color:var(--text-3);margin-left:8px}',
    '.~svg{display:block;width:100%;max-width:460px;height:auto;margin:2px auto 10px;overflow:visible}',
    '.~e{stroke:var(--edge);stroke-width:1.5}',
    '.~ehl{stroke:var(--edge-strong);stroke-width:3.5}',
    '.~eph{stroke-dasharray:3 4}',
    '.~c{fill:var(--surface);stroke:var(--c-ds);stroke-width:2;transition:fill .2s,stroke .2s}',
    '.~h{fill:none;stroke:none;stroke-width:2.5}',
    '.~t{fill:var(--text);font:600 16px var(--mono);text-anchor:middle;dominant-baseline:central}',
    '.~i{fill:var(--text-3);font:11px var(--mono);text-anchor:middle;paint-order:stroke;stroke:var(--surface);stroke-width:3px}',
    '.~s-cmp .~c{fill:var(--~k);stroke:var(--text);stroke-dasharray:4 3;stroke-width:2.5}',
    '.~s-swap .~c{fill:var(--~w);stroke-width:3.5}',
    '.~s-cur .~h{stroke:var(--c-ds)}',
    '.~s-pend .~c{fill:var(--surface-2);stroke:var(--edge-strong);stroke-dasharray:3 3}',
    '.~s-pend .~t{fill:var(--text-2)}',
    '.~s-ph .~c{fill:none;stroke:var(--edge-strong);stroke-dasharray:3 4;stroke-width:1.5}',
    '.~rel .~h{stroke:var(--text-2);stroke-dasharray:2 3}',
    '.~hov .~h{stroke:var(--text);stroke-dasharray:none}',
    '.~arr{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 14px}',
    '.~lvl{display:flex;flex-direction:column;align-items:center}',
    '.~cells{display:flex;gap:3px}',
    '.~cell{display:flex;flex-direction:column;align-items:center;width:34px;border-radius:6px}',
    '.~tag{height:16px;margin-bottom:4px;font-size:10px;line-height:16px;color:var(--text-2);white-space:nowrap}',
    '.~v{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border:2px solid var(--c-ds);border-radius:6px;background:var(--surface);font:600 15px var(--mono);color:var(--text)}',
    '.~ix{font:11px var(--mono);line-height:16px;margin-top:5px;color:var(--text-3)}',
    '.~lvlab{align-self:stretch;margin-top:2px;border-top:2px solid var(--border);font-size:11px;line-height:18px;color:var(--text-3);text-align:center;white-space:nowrap}',
    '.~s-cmp .~v{background:var(--~k);border-color:var(--text);border-style:dashed}',
    '.~s-swap .~v{background:var(--~w);border-width:3px}',
    '.~s-cur .~v{box-shadow:0 0 0 2px var(--surface),0 0 0 4.5px var(--c-ds)}',
    '.~s-pend .~v{background:var(--surface-2);border-color:var(--edge-strong);border-style:dashed;color:var(--text-2)}',
    '.~s-ph .~v{background:none;border:1.5px dashed var(--edge-strong)}',
    '.~rel .~v{outline:1.5px dashed var(--text-2);outline-offset:2px}',
    '.~hov .~v{box-shadow:0 0 0 2px var(--surface),0 0 0 4.5px var(--text)}',
    '.~out{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:10px;font-size:13px;color:var(--text-2)}',
    '.~out b{font:600 13px var(--mono);color:var(--text);padding:1px 6px;border:1px solid var(--border);border-radius:5px;background:var(--surface-2)}',
    '.~legend{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-size:12px;color:var(--text-2)}',
    '.~legend span{display:inline-flex;align-items:center;gap:4px}',
    '.~legend svg{width:20px;height:20px;overflow:visible}',
    '.~steps{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}',
    '.~speed{font-size:13px;color:var(--text-2);display:inline-flex;align-items:center}',
    '.~pos{font-size:13px;color:var(--text-2);font-variant-numeric:tabular-nums;margin-left:auto}',
    '.~rm{margin:6px 0 0;font-size:13px;color:var(--text-3)}',
    '.~now{margin-top:10px;padding:10px 14px 12px;border-left:3px solid var(--c-ds);border-radius:0 var(--radius) var(--radius) 0;background:color-mix(in srgb,var(--c-ds) 7%,var(--surface));min-height:110px}',
    '.~nowlab{font-size:12px;color:var(--text-3)}',
    '.~head{font-weight:600;margin:2px 0 4px}',
    '.~body p{margin:0 0 6px}',
    '.~body p:last-child{margin-bottom:0}',
    '.~note{font-size:13px;color:var(--text-2)}',
    '.~info{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr);gap:10px;margin-top:10px}',
    '.~stats,.~formula{padding:10px 12px;font-size:14px}',
    '.~sh{font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:4px}',
    '.~kv{display:grid;grid-template-columns:auto auto auto;justify-content:start;align-items:baseline;gap:2px 18px}',
    '.~kv b{font:600 15px var(--mono);font-variant-numeric:tabular-nums}',
    '.~kv i{font-style:normal;font-size:12px;color:var(--text-3)}',
    '.~sub{margin-top:6px;font-size:13px;color:var(--text-2)}',
    '.~fx{font-family:var(--mono);font-size:13px;margin:1px 0;overflow-wrap:anywhere}',
    '.~fk{font-size:13px;color:var(--text-2);margin-top:6px}',
    '@container (max-width:560px){.~info{grid-template-columns:minmax(0,1fr)}}',
    '@container (max-width:460px){.~cell,.~v{width:30px}.~v{height:30px;font-size:14px}.~lab{width:auto}.~arr{gap:4px 10px}.~root button{padding:7px 10px}}',
    '@media (prefers-reduced-motion:reduce){.~c{transition:none}}'
  ].join('\n');

  function legendItem(cls, text) {
    return '<span><svg viewBox="-12 -12 24 24" aria-hidden="true"><g class="~' + cls + '"><circle class="~h" r="10.5"/><circle class="~c" r="7"/></g></svg>' + text + '</span>';
  }

  function bt(r, text, label, more) {
    return '<button type="button" data-r="' + r + '" aria-label="' + (label || text) + '"' + (more || '') + '>' + text + '</button>';
  }
  var HTML =
    '<p class="~how">怎么玩：先选最小堆（min-heap）或最大堆（max-heap），点「插入」「弹出堆顶」「建堆」或「堆排序」（heapsort），再用「下一步」（或键盘左右方向键）一步步看。树和数组是同一份数据：指向任意一个节点或格子（键盘用 Tab 移到格子上；触屏点一下选中，再点一下取消），两边一起高亮，下方的「下标公式」会代入具体数字。</p>' +
    '<div class="~ops">' +
      '<div class="~grp" role="group" aria-label="堆类型"><span class="~lab">堆类型</span><span class="~seg">' +
        bt('min', '最小堆', '最小堆：父 ≤ 子', ' aria-pressed="true"') + bt('max', '最大堆', '最大堆：父 ≥ 子', ' aria-pressed="false"') + '</span></div>' +
      '<div class="~grp"><span class="~lab">操作</span>' +
        '<input data-r="val" class="~val" type="number" min="0" max="99" step="1" value="0" aria-label="要插入的数，0 到 99 的整数">' +
        bt('ins', '插入', '插入左边输入的数') + bt('pop', '弹出堆顶') + bt('sort', '堆排序', '堆排序：反复弹出堆顶') + '</div>' +
      '<div class="~grp"><span class="~lab">建堆</span>' +
        '<input data-r="arr" class="~arrin" type="text" value="' + DEF.join(', ') + '" aria-label="建堆用的一组数：最多 15 个 0 到 99 的整数，用逗号或空格隔开">' +
        bt('rnd', '随机填数', '随机填数：生成 8 到 12 个数填进输入框') + bt('build', '建堆', '建堆：用输入框里的数做 Floyd 建堆') + '</div>' +
      '<p class="~err" data-r="err" role="alert"></p>' +
    '</div>' +
    '<div class="~viz">' +
      '<div class="~cap">树视图<span>节点下方的小数字是数组下标</span></div>' +
      '<svg data-r="tree" class="~svg" role="img" aria-label="完全二叉树视图，和下面的数组是同一份数据"></svg>' +
      '<div class="~cap">数组视图<span>内存里实际存的样子：按层、从左到右</span></div>' +
      '<div data-r="arrv" class="~arr"></div>' +
      '<div data-r="out" class="~out" style="display:none"></div>' +
      '<div class="~legend">' + legendItem('s-cmp', '正在比较') + legendItem('s-swap', '刚交换') + legendItem('s-cur', '当前元素') +
        legendItem('s-pend', '建堆时还没处理') + legendItem('s-ph', '下一个空位') + legendItem('hov', '指向的位置') + legendItem('rel', '它的父和孩子') + '</div>' +
    '</div>' +
    '<div class="~steps">' +
      bt('prev', '上一步') + bt('next', '下一步', '', ' class="~pri"') + bt('play', '自动播放', '自动播放或暂停', ' aria-pressed="false"') +
      bt('end', '跳到结束', '跳到结束：直接看这次操作的最后一步') +
      '<label class="~speed">速度<select data-r="speed" aria-label="自动播放速度"><option value="1700">慢</option><option value="1000" selected>中</option><option value="450">快</option></select></label>' +
      '<span class="~pos" data-r="pos"></span>' +
      bt('reset', '重置', '重置：回到初始的堆，计数清零') +
    '</div>' +
    '<p class="~rm" data-r="rm" style="display:none">系统开启了「减少动态效果」，自动播放已关闭，请用「下一步」。</p>' +
    '<div class="~now" aria-live="polite"><div class="~nowlab">现在发生了什么</div><div class="~head" data-r="head"></div><div class="~body" data-r="body"></div></div>' +
    '<div class="~info"><div class="~stats" data-r="stats"></div><div class="~formula" data-r="formula"></div></div>';

  /* ---------- 界面 ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function px(s) { return s.replace(/~/g, P); }
  function sv(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  }
  function injectStyle() {
    if (document.getElementById('dm-style-' + ID)) return;
    var st = document.createElement('style');
    st.id = 'dm-style-' + ID; st.textContent = px(CSS);
    document.head.appendChild(st);
  }

  function mount(container) {
    injectStyle();
    var root = document.createElement('div');
    root.className = P + 'root';
    root.innerHTML = px(HTML);
    container.appendChild(root);
    function q(r) { return root.querySelector('[data-r="' + r + '"]'); }
    var svg = q('tree'), arrv = q('arrv'), offs = [], i, d;
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduced = !!(mq && mq.matches);
    var S = { m: 'min', fr: opInit('min').fr, pos: 0, tc: 0, ts: 0, sel: -1, timer: null, note: '', shown: null };
    S.cap = capOf(S.fr);

    // 元素只建一次，之后每一帧只改属性和文字（键盘焦点不会丢）
    var gE = sv('g', {}, svg), gN = sv('g', {}, svg), edges = [null], nodes = [], cells = [], groups = [], labs = [];
    for (i = 1; i < MAX; i++) edges.push(sv('line', { 'class': P + 'e' }, gE));
    for (i = 0; i < MAX; i++) {
      var g = sv('g', { 'data-i': i }, gN);
      sv('circle', { 'class': P + 'h', r: 23 }, g);
      sv('circle', { 'class': P + 'c', r: 18 }, g);
      var tx = sv('text', { 'class': P + 't' }, g);
      sv('text', { 'class': P + 'i', y: 35 }, g).textContent = i;
      nodes.push({ g: g, t: tx, x: 0, y: 0 });
    }
    for (d = 0; d < 4; d++) {
      var lv = document.createElement('div'), cs = document.createElement('div'), lb = document.createElement('div');
      lv.className = P + 'lvl'; cs.className = P + 'cells'; lb.className = P + 'lvlab'; lb.textContent = '第 ' + d + ' 层';
      cs.setAttribute('role', 'list'); cs.setAttribute('aria-label', '第 ' + d + ' 层'); lb.setAttribute('aria-hidden', 'true');
      lv.appendChild(cs); lv.appendChild(lb); arrv.appendChild(lv); groups.push(lv); labs.push(lb);
      for (i = (1 << d) - 1; i < (1 << (d + 1)) - 1; i++) {
        var ce = document.createElement('div');
        ce.className = P + 'cell'; ce.setAttribute('data-i', i); ce.setAttribute('role', 'listitem'); ce.tabIndex = 0;
        ce.innerHTML = '<span class="' + P + 'tag"></span><span class="' + P + 'v"></span><span class="' + P + 'ix">' + i + '</span>';
        cs.appendChild(ce);
        cells.push({ el: ce, tag: ce.children[0], v: ce.children[1] });
      }
    }

    function add(parent, cls, text) { var e = document.createElement('div'); e.className = cls; e.textContent = text; parent.appendChild(e); return e; }
    function dis(b, v) { b.setAttribute('aria-disabled', v ? 'true' : 'false'); }

    function draw() {
      var f = S.fr[S.pos], a = f.arr, n = a.length, w = words(S.m), last = S.fr.length - 1;
      var ph = n < MAX ? n : -1, cnt = ph >= 0 ? n + 1 : n, cap = Math.max(S.cap, cnt), D = lg(cap), W = 380, top = 28, gap = 62;
      var sel = S.sel < cnt ? S.sel : -1, rel = {}, j, k, dd, st, cls, nd, c;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (top + D * gap + 42));
      if (sel >= 0) {
        if (sel > 0) rel[par(sel)] = '父';
        if (2 * sel + 1 < n) rel[2 * sel + 1] = '左孩子';
        if (2 * sel + 2 < n) rel[2 * sel + 2] = '右孩子';
      }
      for (j = 0; j < MAX; j++) {
        nd = nodes[j]; c = cells[j];
        var vis = j < cnt;
        nd.g.style.display = vis ? '' : 'none';
        c.el.style.display = j < cap ? '' : 'none';      // 这次操作里出现过的格子保留位置
        c.el.style.visibility = vis ? '' : 'hidden';
        if (j) edges[j].style.display = vis ? '' : 'none';
        if (!vis) continue;
        dd = lg(j + 1); k = j - ((1 << dd) - 1);
        nd.x = (k + 0.5) * W / (1 << dd); nd.y = top + dd * gap;
        nd.g.setAttribute('transform', 'translate(' + nd.x + ',' + nd.y + ')');
        st = j === ph ? 'ph' : f.swap.indexOf(j) >= 0 ? 'swap' : f.cmp.indexOf(j) >= 0 ? 'cmp' : f.cur === j ? 'cur' : f.pend > j ? 'pend' : '';
        cls = (st ? ' ' + P + 's-' + st : '') + (j === sel ? ' ' + P + 'hov' : rel[j] ? ' ' + P + 'rel' : '');
        nd.g.setAttribute('class', P + 'n' + cls);
        c.el.className = P + 'cell' + cls;
        nd.t.textContent = c.v.textContent = j < n ? a[j] : '';
        c.tag.textContent = sel >= 0 ? (j === sel ? '指向' : rel[j] || '') : (f.tags[j] || (j === ph ? '空位' : ''));
        c.el.setAttribute('aria-label', '下标 ' + j + (j < n ? '，值 ' + a[j] : '，空位'));
      }
      for (j = 1; j < cnt; j++) {
        var e = edges[j], pn = nodes[par(j)];
        e.setAttribute('x1', pn.x); e.setAttribute('y1', pn.y); e.setAttribute('x2', nodes[j].x); e.setAttribute('y2', nodes[j].y);
        e.setAttribute('class', P + 'e' + (f.eh.indexOf(j) >= 0 ? ' ' + P + 'ehl' : '') + (j === ph ? ' ' + P + 'eph' : ''));
      }
      for (j = 0; j < 4; j++) {
        groups[j].style.display = (1 << j) - 1 < cap ? '' : 'none';
        labs[j].style.visibility = (1 << j) - 1 < cnt ? '' : 'hidden';
      }

      // 已弹出一行：先按最终结果占好位置，还没弹出的数先隐藏
      var out = q('out'), fo = S.fr[last].out || f.out || [];
      out.style.display = f.out ? '' : 'none';
      if (f.out) out.innerHTML = '<span>已弹出（' + w.order + '）：</span>' + fo.map(function (v, k) {
        return '<b' + (k < f.out.length ? '' : ' style="visibility:hidden"') + '>' + v + '</b>'; }).join('');

      // 说明区只在帧变化时重写，避免读屏软件在指向时反复朗读
      var key = S.pos + '|' + S.note;
      if (S.shown !== f || S.shownKey !== key) {
        S.shown = f; S.shownKey = key;
        q('head').textContent = f.head;
        var body = q('body');
        body.textContent = '';
        if (S.pos === 0 && S.note) add(body, P + 'note', S.note);
        f.body.forEach(function (t) { var p = document.createElement('p'); p.textContent = t; body.appendChild(p); });
      }

      q('stats').innerHTML = px('<div class="~sh">比较和交换次数</div><div class="~kv"><i></i><i>本次操作</i><i>累计</i>' +
        '<span>比较</span><b>' + f.c + '</b><b>' + (S.tc + f.c) + '</b><span>交换</span><b>' + f.s + '</b><b>' + (S.ts + f.s) + '</b></div>' +
        '<div class="~sub">' + (n ? '堆里有 n = ' + n + ' 个元素，树高 ⌊log₂ ' + n + '⌋ = ' + lg(n) + '（根在第 0 层）' : '堆现在是空的') + '</div>');

      var fm = q('formula'), fk = sel >= 0 ? sel : f.focus >= 0 && f.focus < n ? f.focus : -1;
      fm.textContent = '';
      add(fm, P + 'sh', '下标公式（下标从 0 开始）');
      add(fm, P + 'fx', '父 = ⌊(i−1)/2⌋　左孩子 = 2i+1　右孩子 = 2i+2');
      if (fk < 0) add(fm, P + 'fk', n ? '指向树里的节点或数组里的格子，这里会代入具体下标。' : '堆是空的。插入一个数以后，可以指向它看看。');
      else {
        var pp = par(fk), l = 2 * fk + 1, r = l + 1;
        add(fm, P + 'fk', (sel >= 0 ? '代入你指向的' : '代入这一步的') + '下标 i = ' + fk + (fk < n ? '（值 ' + a[fk] + '）' : '（空位，下一个插入的元素放这里）') + '：');
        add(fm, P + 'fx', fk ? '父 = ⌊(' + fk + '−1)/2⌋ = ' + pp + '，值 ' + a[pp] : '父 = ⌊(0−1)/2⌋ = −1，不存在：下标 0 是根');
        add(fm, P + 'fx', '左孩子 = 2×' + fk + '+1 = ' + l + (l < n ? '，值 ' + a[l] : n ? '，超出范围（最大下标 ' + (n - 1) + '），没有' : '，没有'));
        add(fm, P + 'fx', '右孩子 = 2×' + fk + '+2 = ' + r + (r < n ? '，值 ' + a[r] : n ? '，超出范围，没有' : '，没有'));
      }

      var bn = S.fr[last].arr.length;
      dis(q('prev'), S.pos === 0); dis(q('next'), S.pos === last); dis(q('end'), S.pos === last);
      dis(q('ins'), bn >= MAX); dis(q('pop'), !bn); dis(q('sort'), !bn);
      q('play').disabled = reduced || last === 0;
      q('play').textContent = S.timer ? '暂停' : '自动播放';
      q('play').setAttribute('aria-pressed', S.timer ? 'true' : 'false');
      q('pos').textContent = '第 ' + (S.pos + 1) + ' / ' + (last + 1) + ' 步';
    }

    function on(el, ev, fn) { el.addEventListener(ev, fn); offs.push(function () { el.removeEventListener(ev, fn); }); }
    function err(msg) { q('err').textContent = msg || ''; }
    function base() { return S.fr[S.fr.length - 1].arr; }
    function stop() { if (S.timer) { clearInterval(S.timer); S.timer = null; } }
    function go(p) { stop(); S.pos = Math.max(0, Math.min(S.fr.length - 1, p)); draw(); }
    function play() {
      if (reduced || S.fr.length < 2) return;
      if (S.pos >= S.fr.length - 1) S.pos = 0;
      S.timer = setInterval(function () {
        S.pos = Math.min(S.pos + 1, S.fr.length - 1);
        if (S.pos >= S.fr.length - 1) stop();
        draw();
      }, +q('speed').value);
      draw();
    }
    function startOp(R) {
      var lf = S.fr[S.fr.length - 1];
      S.note = S.pos < S.fr.length - 1 ? '（上一个操作还没播完，已按它的最终结果接着做。）' : '';
      stop();
      S.tc += lf.c; S.ts += lf.s;
      S.fr = R.fr; S.cap = capOf(S.fr); S.pos = 0; err('');
      draw();
    }
    function setMode(m) {
      if (m === S.m) return;
      var a = base(), R;
      S.m = m;
      q('min').setAttribute('aria-pressed', String(m === 'min'));
      q('max').setAttribute('aria-pressed', String(m === 'max'));
      if (a.length < 2) {
        R = new Rec(a, m);
        R.f('切换成' + R.w.name, '堆里' + (a.length ? '只有一个元素' : '没有元素') + '，不需要调整。之后的插入和弹出都按「' + R.w.prop + '」来比较。');
      } else R = opBuild(a, m, true);
      startOp(R);
    }
    function doIns() {
      var s = String(q('val').value).trim();
      if (!/^\d{1,2}$/.test(s)) return err('请输入 0 到 99 之间的整数。');
      if (base().length >= MAX) return err('堆最多放 ' + MAX + ' 个元素（4 层正好放满），先弹出几个再插入。');
      startOp(opInsert(base(), +s, S.m));
    }
    function doBuild() {
      var parts = q('arr').value.split(/[\s,，、;；]+/).filter(Boolean), j;
      if (!parts.length) return err('请输入至少 1 个数，用逗号或空格隔开。');
      if (parts.length > MAX) return err('最多 ' + MAX + ' 个数（4 层的完全二叉树正好放 15 个），现在有 ' + parts.length + ' 个。');
      for (j = 0; j < parts.length; j++) if (!/^\d{1,2}$/.test(parts[j])) return err('「' + parts[j] + '」不是 0 到 99 之间的整数。');
      startOp(opBuild(parts.map(Number), S.m));
    }
    function reset() {
      stop();
      S.fr = opInit(S.m).fr; S.cap = capOf(S.fr); S.pos = 0; S.tc = S.ts = 0; S.note = ''; S.sel = -1;
      q('val').value = '0'; q('arr').value = DEF.join(', '); err('');
      draw();
    }
    function idxOf(t) { var e = t && t.closest ? t.closest('[data-i]') : null; return e && root.contains(e) ? +e.getAttribute('data-i') : -1; }
    function setSel(j) { if (j !== S.sel) { S.sel = j; draw(); } }
    // 鼠标：指到就选，移开取消。触屏：点一下选中，再点一次或点空白处取消
    function over(e) { var j = idxOf(e.target); setSel(e.pointerType === 'touch' && j === S.sel ? -1 : j); }
    function leave(e) { if (e.pointerType !== 'touch') setSel(-1); }

    on(svg, 'pointerover', over); on(arrv, 'pointerover', over);
    on(svg, 'pointerleave', leave); on(arrv, 'pointerleave', leave);
    on(arrv, 'focusin', function (e) { setSel(idxOf(e.target)); });
    on(arrv, 'focusout', function (e) { if (idxOf(e.target) === S.sel) setSel(-1); });
    on(q('prev'), 'click', function () { go(S.pos - 1); });
    on(q('next'), 'click', function () { go(S.pos + 1); });
    on(q('end'), 'click', function () { go(S.fr.length - 1); });
    on(q('play'), 'click', function () { if (S.timer) { stop(); draw(); } else play(); });
    on(q('speed'), 'change', function () { if (S.timer) { stop(); play(); } });
    on(q('reset'), 'click', reset);
    on(q('min'), 'click', function () { setMode('min'); });
    on(q('max'), 'click', function () { setMode('max'); });
    on(q('ins'), 'click', doIns);
    on(q('val'), 'keydown', function (e) { if (e.key === 'Enter') doIns(); });
    // 新操作接在最终结果上，没播完时说明是「做完后」为空
    function empty(what) { return !base().length && (err((S.pos < S.fr.length - 1 ? '这次操作做完后' : '') + '堆是空的，没有元素可以' + what + '。'), true); }
    on(q('pop'), 'click', function () { if (!empty('弹出')) startOp(opPop(base(), S.m)); });
    on(q('sort'), 'click', function () { if (!empty('排序')) startOp(opSort(base(), S.m)); });
    on(q('build'), 'click', doBuild);
    on(q('arr'), 'keydown', function (e) { if (e.key === 'Enter') doBuild(); });
    on(q('rnd'), 'click', function () {
      var n = 8 + Math.floor(Math.random() * 5), a = [];
      while (a.length < n) a.push(1 + Math.floor(Math.random() * 99));
      q('arr').value = a.join(', '); err('');
    });
    on(root, 'keydown', function (e) {
      var tn = e.target.tagName;
      if (tn === 'INPUT' || tn === 'SELECT' || tn === 'TEXTAREA' || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') { go(S.pos + 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { go(S.pos - 1); e.preventDefault(); }
    });

    if (reduced) q('rm').style.display = '';
    draw();
    return {
      destroy: function () {
        stop();
        offs.forEach(function (fn) { fn(); }); offs = [];
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = { title: '二叉堆：数组和树是同一个东西', mount: mount, selfTest: selfTest };
})();
