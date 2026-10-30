/* 图搜索：BFS、DFS 和 Dijkstra —— window.KGDemos['ds-graph-search'] */
(function () {
  'use strict';
  var ID = 'ds-graph-search', P = 'dm-' + ID + '-';

  // ---------- 预设图 ----------
  // 8 个顶点 0–7，11 条无向边 [u, v, 权重]。坐标固定，SVG viewBox 为 0 0 520 354。
  var N = 8;
  var POS = [[40, 183], [150, 78], [300, 78], [460, 78], [150, 288], [300, 288], [390, 183], [480, 268]];
  var EDGES = [[0, 1, 4], [0, 4, 1], [1, 2, 5], [1, 4, 2], [2, 3, 6], [2, 5, 3], [2, 6, 1], [3, 7, 1], [4, 5, 9], [5, 6, 2], [6, 7, 3]];
  var WPOS = [[85, 120], [85, 246], [225, 97], [166, 183], [380, 97], [284, 183], [356, 121], [484, 172], [225, 270], [356, 245], [445, 215]]; // 权重标签，顺序同 EDGES
  var BPOS = [[40, 136], [150, 28], [300, 28], [460, 28], [150, 336], [300, 336], [444, 180], [480, 315]]; // dist / 层数小框
  var TPOS = [[40, 226], [100, 78], [264, 117], [424, 112], [100, 288], [350, 288], [390, 142], [428, 282]]; // 「起点」标签
  var WM = [];
  EDGES.forEach(function (e) { WM[e[0]] = WM[e[0]] || []; WM[e[1]] = WM[e[1]] || []; WM[e[0]][e[1]] = WM[e[1]][e[0]] = e[2]; });

  function fill(n, x) { var a = []; for (var i = 0; i < n; i++) a.push(x); return a; }
  // 邻接表：每个点的邻居按编号升序排好（演示的约定）。unit = true 时每条边算 1（无权视图）。
  function buildAdj(n, edges, directed, unit) {
    var adj = [], i;
    for (i = 0; i < n; i++) adj.push([]);
    edges.forEach(function (e) {
      var w = unit ? 1 : e[2];
      adj[e[0]].push({ v: e[1], w: w });
      if (!directed) adj[e[1]].push({ v: e[0], w: w });
    });
    adj.forEach(function (l) { l.sort(function (a, b) { return a.v - b.v; }); });
    return adj;
  }
  function nbs(adj, u) {
    return adj[u].length ? '按编号从小到大检查 ' + u + ' 的邻居：' + adj[u].map(function (e) { return e.v; }).join('、') + '。' : u + ' 没有邻居。';
  }

  // ---------- 三个算法：边算边记录每一步的快照 ----------
  // 快照字段：t 类型，cur 当前点，nb 正在检查的邻居，box 队列/栈/优先队列，hi 刚放入的项，
  // vis 已访问（Dijkstra 为已确定），proc 已处理，front 在容器里还没处理，d 层数/深度/dist，p 父节点/前驱。
  function bfs(adj, s) {
    var n = adj.length, vis = fill(n, false), proc = fill(n, false), lv = fill(n, Infinity), par = fill(n, -1),
      order = [], q = [], steps = [];
    function rec(o) {
      steps.push(Object.assign({ cur: -1, nb: -1, hi: -1, chg: -1, box: q.map(function (x) { return { n: x }; }),
        vis: vis.slice(), proc: proc.slice(), front: vis.map(function (b, i) { return b && !proc[i]; }),
        order: order.slice(), d: lv.slice(), p: par.slice() }, o));
    }
    vis[s] = true; lv[s] = 0; order.push(s); q.push(s);
    rec({ t: 'init', hi: 0, chg: s, msg: '起点 ' + s + ' 入队，标记为已访问，层数记为 0。队列先进先出，离起点近的点会先出队。' });
    while (q.length) {
      var u = q.shift();
      proc[u] = true;
      rec({ t: 'pop', cur: u, msg: '队首 ' + u + ' 出队，它在第 ' + lv[u] + ' 层。' + nbs(adj, u) });
      adj[u].forEach(function (e, i) {
        var v = e.v, fresh = !vis[v], m;
        if (fresh) {
          vis[v] = true; lv[v] = lv[u] + 1; par[v] = u; order.push(v); q.push(v);
          m = '检查邻居 ' + v + '：还没访问过。标记为已访问，层数 = ' + lv[u] + ' + 1 = ' + lv[v] + '，父节点记为 ' + u + '，放到队尾。';
        } else m = '检查邻居 ' + v + '：已经访问过（' + (proc[v] ? '已出队' : '还在队列里') + '），不再入队。';
        if (i === adj[u].length - 1) m += u + ' 的邻居查完了，' + (q.length ? '下一步队首 ' + q[0] + ' 出队。' : '队列已空。');
        rec({ t: fresh ? 'new' : 'old', cur: u, nb: v, w: e.w, hi: fresh ? q.length - 1 : -1, chg: fresh ? v : -1, msg: m });
      });
    }
    rec({ t: 'done', msg: '' });
    return { steps: steps, order: order, dist: lv, prev: par };
  }

  // 迭代式 DFS：弹出时才标记已访问；邻居按升序压栈，所以编号大的邻居在栈顶、先弹出。
  function dfs(adj, s) {
    var n = adj.length, vis = fill(n, false), dep = fill(n, Infinity), par = fill(n, -1),
      order = [], st = [{ n: s, f: -1 }], steps = [], skips = 0;
    function rec(o) {
      var front = fill(n, false);
      st.forEach(function (x) { if (!vis[x.n]) front[x.n] = true; });
      steps.push(Object.assign({ cur: -1, nb: -1, hi: -1, chg: -1,
        box: st.map(function (x) { return { n: x.n, f: x.f, old: vis[x.n] }; }),
        vis: vis.slice(), proc: vis.slice(), front: front, order: order.slice(), d: dep.slice(), p: par.slice() }, o));
    }
    function tail() {
      if (!st.length) return '栈已空。';
      var t = st[st.length - 1];
      return '栈顶是 ' + t.n + '，下一步弹出它' + (vis[t.n] ? '（它已访问过，会被跳过）' : '') + '。';
    }
    rec({ t: 'init', hi: 0, msg: '起点 ' + s + ' 压入栈。栈后进先出，每次弹出最后压进去的点，所以 DFS 会沿着一条路一直往深处走。' });
    while (st.length) {
      var e = st.pop(), u = e.n, from = e.f < 0 ? '起点' : '由 ' + e.f + ' 压入';
      if (vis[u]) {
        rec({ t: 'skip', popped: e, msg: '弹出栈顶 ' + u + '（' + from + '），但 ' + u + ' 已经访问过了，跳过。' +
          (skips++ ? '' : '同一个点可能被压栈好几次，弹出时再检查一次，就不会重复访问。') + tail() });
        continue;
      }
      vis[u] = true; par[u] = e.f; dep[u] = e.f < 0 ? 0 : dep[e.f] + 1; order.push(u);
      rec({ t: 'pop', cur: u, popped: e, chg: u, msg: '弹出栈顶 ' + u + '（' + from + '），它还没访问过：标记为已访问' +
        (e.f < 0 ? '' : '，父节点记为 ' + e.f) + '。' + nbs(adj, u) + (adj[u].length ? '' : tail()) });
      adj[u].forEach(function (x, i) {
        var v = x.v, fresh = !vis[v], m;
        if (fresh) {
          var dup = st.some(function (y) { return y.n === v; });
          st.push({ n: v, f: u });
          m = '检查邻居 ' + v + '：还没访问，压入栈。' + (dup ? '栈里已经有一个 ' + v + '，新压入的这个在更上面，会先弹出。' : '');
        } else m = '检查邻居 ' + v + '：已经访问过，不压栈。';
        if (i === adj[u].length - 1) m += u + ' 的邻居查完了。' + tail();
        rec({ t: fresh ? 'new' : 'old', cur: u, nb: v, w: x.w, hi: fresh ? st.length - 1 : -1, msg: m });
      });
    }
    rec({ t: 'done', msg: '' });
    return { steps: steps, order: order, dist: dep, prev: par };
  }

  // Dijkstra：优先队列按 (dist, 编号) 升序；更新 dist 时直接放入新记录，旧记录取出时跳过（惰性删除）。
  function dijkstra(adj, s) {
    var n = adj.length, fin = fill(n, false), dist = fill(n, Infinity), prev = fill(n, -1),
      order = [], pq = [{ d: 0, n: s }], steps = [], relax = 0;
    dist[s] = 0;
    function rec(o) {
      steps.push(Object.assign({ cur: -1, nb: -1, hi: -1, chg: -1,
        box: pq.map(function (x) { return { d: x.d, n: x.n, old: fin[x.n] || x.d > dist[x.n] }; }),
        vis: fin.slice(), proc: fin.slice(), front: dist.map(function (d, i) { return !fin[i] && d < Infinity; }),
        order: order.slice(), d: dist.slice(), p: prev.slice() }, o));
    }
    function tail() { return pq.length ? '下一步取出 dist 最小的 (' + pq[0].d + ', ' + pq[0].n + ')。' : '优先队列已空。'; }
    rec({ t: 'init', hi: 0, chg: s, msg: 'dist[' + s + '] = 0，其余点的 dist 都是 ∞。把 (0, ' + s + ') 放进优先队列，之后每一步取出 dist 最小的一项。' });
    while (pq.length) {
      var e = pq.shift(), u = e.n;
      if (fin[u]) {
        rec({ t: 'skip', popped: e, msg: '取出 (' + e.d + ', ' + u + ')，但 ' + u + ' 已经确定了（dist[' + u + '] = ' + dist[u] + '），这一项是更新前留下的旧记录，跳过。' + tail() });
        continue;
      }
      fin[u] = true; order.push(u);
      rec({ t: 'pop', cur: u, popped: e, msg: (u === s ? '取出 (0, ' + s + ')，确定 dist[' + s + '] = 0。' :
        '取出 dist 最小的 (' + e.d + ', ' + u + ')，确定 dist[' + u + '] = ' + e.d + '：其余没确定的点 dist 都不小于 ' + e.d +
        '，边权又非负，从它们绕到 ' + u + ' 不会更短。') + nbs(adj, u) + (adj[u].length ? '' : tail()) });
      adj[u].forEach(function (x, i) {
        var v = x.v, m, t, hi = -1, chg = -1;
        if (fin[v]) { t = 'old'; m = '检查邻居 ' + v + '：已经确定，跳过。'; }
        else {
          var nd = dist[u] + x.w, calc = '检查邻居 ' + v + '：经过 ' + u + ' 走到 ' + v + ' 是 ' + dist[u] + ' + ' + x.w + ' = ' + nd;
          if (nd < dist[v]) {
            var od = dist[v], op = prev[v], it = { d: nd, n: v };
            dist[v] = nd; prev[v] = u; pq.push(it);
            pq.sort(function (a, b) { return a.d - b.d || a.n - b.n; });
            hi = pq.indexOf(it); chg = v; t = 'new';
            m = calc + '，比当前的 ' + (op < 0 ? '∞' : 'dist[' + v + '] = ' + od) + ' 小。更新 dist[' + v + '] = ' + nd + '，前驱' +
              (op < 0 ? '记为 ' + u : '从 ' + op + ' 改成 ' + u) + '，放入 (' + nd + ', ' + v + ')。' +
              (op < 0 ? '' : '旧的 (' + od + ', ' + v + ') 留在队列里，以后取出时跳过。') +
              (relax++ ? '' : '这种「找到更短的路就更新」的操作叫松弛（relaxation）。');
          } else { t = 'keep'; m = calc + '，不比当前的 dist[' + v + '] = ' + dist[v] + ' 小，不更新。'; }
        }
        if (i === adj[u].length - 1) m += u + ' 的邻居查完了，' + tail();
        rec({ t: t, cur: u, nb: v, w: x.w, hi: hi, chg: chg, msg: m });
      });
    }
    rec({ t: 'done', msg: '' });
    return { steps: steps, order: order, dist: dist, prev: prev };
  }

  // ---------- 结束时的总结（带实际数字） ----------
  function pathTo(prev, t) { var p = [t]; while (prev[t] >= 0) { t = prev[t]; p.unshift(t); } return p; }
  function wsum(p) {
    var ws = [], i;
    for (i = 1; i < p.length; i++) ws.push(WM[p[i - 1]][p[i]]);
    return { txt: ws.join(' + '), total: ws.reduce(function (a, b) { return a + b; }, 0) };
  }
  // 找「BFS 树上的路权重和」比真正最短距离大得最多的点
  function worstBfs(R) {
    var t = -1, best = 0, i, df;
    for (i = 0; i < N; i++) { df = wsum(pathTo(R.bfs.prev, i)).total - R.dij.dist[i]; if (df > best) { best = df; t = i; } }
    return t;
  }
  function summary(alg, s, unit, R) {
    var b = R.bfs, t, i, bp, bs, dp, ds, h;
    if (alg === 'bfs') {
      h = '队列空了，BFS 结束。访问顺序：' + b.order.join('、') + '。高亮的边组成 BFS 树，层数就是从 ' + s + ' 出发最少要走的边数。';
      t = unit ? -1 : worstBfs(R);
      if (t < 0) {
        t = s;
        for (i = 0; i < N; i++) if (b.dist[i] > b.dist[t]) t = i;
        return h + '例如最远的 ' + t + ' 在第 ' + b.dist[t] + ' 层：' + pathTo(b.prev, t).join('→') + '。';
      }
      bp = pathTo(b.prev, t); bs = wsum(bp); dp = pathTo(R.dij.prev, t); ds = wsum(dp);
      return h + '例如 ' + t + ' 在第 ' + b.dist[t] + ' 层：' + bp.join('→') + '。BFS 不看边权，这条路的权重和是 ' + bs.txt + ' = ' + bs.total +
        '，而 Dijkstra 找到的 ' + dp.join('→') + ' 只要 ' + ds.txt + ' = ' + ds.total + '。';
    }
    if (alg === 'dfs') {
      var f = R.dfs, best = 0;
      h = '栈空了，DFS 结束。访问顺序：' + f.order.join('、') + '。高亮的边组成 DFS 树。';
      t = -1;
      for (i = 0; i < N; i++) {
        var df = f.dist[i] - b.dist[i]; // 绕远最多的点；一样多时选离起点边数少的，例子更直观
        if (df > best || (df > 0 && df === best && b.dist[i] < b.dist[t])) { best = df; t = i; }
      }
      if (t < 0) return h + '这次 DFS 树上的路径碰巧都和 BFS 一样短，换个起点再试试。';
      return h + 'DFS 树上从 ' + s + ' 到 ' + t + ' 走了 ' + f.dist[t] + ' 条边（' + pathTo(f.prev, t).join('→') + '），' +
        (b.dist[t] === 1 ? '可 ' + s + ' 和 ' + t + ' 之间就有一条边。' : '可最少只要 ' + b.dist[t] + ' 条（' + pathTo(b.prev, t).join('→') + '）。') +
        'DFS 找到的路径不保证最短。';
    }
    h = '优先队列空了，Dijkstra 结束。确定顺序：' + R.cur.order.join('、') + '。高亮的边是最短路径树（shortest-path tree）：从任意一点沿前驱往回走，就是从 ' + s + ' 出发的最短路。';
    if (unit) return h + '每条边都算 1 时，dist 就是最少要走的边数，和 BFS 的层数一样，可以切到 BFS 对照。';
    t = worstBfs(R);
    if (t < 0) return h + '从 ' + s + ' 出发，边数最少的路碰巧也是权重和最小的路。';
    bp = pathTo(b.prev, t); bs = wsum(bp); dp = pathTo(R.dij.prev, t); ds = wsum(dp);
    return h + '例如到 ' + t + '：' + dp.join('→') + '，权重和 ' + ds.txt + ' = ' + ds.total + '；BFS 找到的 ' + bp.join('→') + (bp.length < dp.length ? ' 只有 ' : ' 也是 ') +
      (bp.length - 1) + ' 条边，权重和却是 ' + bs.txt + ' = ' + bs.total + '。';
  }

  // ---------- 自测 ----------
  function floyd(n, edges, directed, unit) {
    var d = [], i, j, k;
    for (i = 0; i < n; i++) { d.push(fill(n, Infinity)); d[i][i] = 0; }
    edges.forEach(function (e) {
      var w = unit ? 1 : e[2];
      d[e[0]][e[1]] = Math.min(d[e[0]][e[1]], w);
      if (!directed) d[e[1]][e[0]] = Math.min(d[e[1]][e[0]], w);
    });
    for (k = 0; k < n; k++) for (i = 0; i < n; i++) for (j = 0; j < n; j++) if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
    return d;
  }
  function selfTest() {
    var out = [], ok = true;
    function eq(name, got, want) {
      var g = JSON.stringify(got), w = JSON.stringify(want), pass = g === w;
      if (!pass) ok = false;
      out.push((pass ? '通过：' : '失败：') + name + ' = ' + g + (pass ? '' : '，应为 ' + w));
    }
    function at(tr, cur, nb) { return tr.steps.filter(function (x) { return x.cur === cur && x.nb === nb; })[0]; }
    var A = buildAdj(N, EDGES, false, false), A1 = buildAdj(N, EDGES, false, true);
    var b0 = bfs(A, 0), f0 = dfs(A, 0), d0 = dijkstra(A, 0);
    // 邻接表（升序）：0:1(4),4(1)  1:0(4),2(5),4(2)  2:1(5),3(6),5(3),6(1)  3:2(6),7(1)
    //                 4:0(1),1(2),5(9)  5:2(3),4(9),6(2)  6:2(1),5(2),7(3)  7:3(1),6(3)
    // 手算 BFS（起点 0）：队列 [0] → 0 出队，1、4 入队 → 1 出队，2 入队 → 4 出队，5 入队
    //   → 2 出队，3、6 入队 → 5 出队 → 3 出队，7 入队 → 6、7 出队。
    //   访问顺序 0,1,4,2,5,3,6,7；层数 [0,1,2,3,1,2,3,4]
    eq('BFS 访问顺序（起点 0）', b0.order, [0, 1, 4, 2, 5, 3, 6, 7]);
    eq('BFS 层数（起点 0）', b0.dist, [0, 1, 2, 3, 1, 2, 3, 4]);
    // 手算 DFS（起点 0，栈底→栈顶）：[0] → 弹 0，压 1、4 → 弹 4，压 1、5 → 弹 5，压 2、6 → 弹 6，压 2、7
    //   → 弹 7，压 3 → 弹 3，压 2 → 弹 2，压 1 → 弹 1 → 剩下 2、2、1、1 都已访问，依次跳过。
    //   访问顺序 0,4,5,6,7,3,2,1（树上 0 到 1 走了 7 条边）
    eq('DFS 访问顺序（起点 0）', f0.order, [0, 4, 5, 6, 7, 3, 2, 1]);
    // 手算 Dijkstra（起点 0）：取 (0,0)：dist1=4，dist4=1 → 取 (1,4)：dist1=1+2=3（改小），dist5=1+9=10
    //   → 取 (3,1)：dist2=3+5=8 → (4,1) 过期跳过 → 取 (8,2)：dist3=8+6=14，dist5 不变（11>10），dist6=8+1=9
    //   → 取 (9,6)：dist7=9+3=12 → 取 (10,5) → 取 (12,7)：dist3=12+1=13（改小）→ 取 (13,3) → (14,3) 过期跳过。
    //   dist = [0,3,8,13,1,10,9,12]，前驱 = [-,4,1,7,0,4,2,6]
    eq('Dijkstra 距离（起点 0）', d0.dist, [0, 3, 8, 13, 1, 10, 9, 12]);
    eq('Dijkstra 前驱（起点 0）', d0.prev, [-1, 4, 1, 7, 0, 4, 2, 6]);
    eq('Dijkstra 确定顺序（起点 0）', d0.order, [0, 4, 1, 2, 6, 5, 7, 3]);
    eq('Dijkstra 跳过的过期项数（起点 0）', d0.steps.filter(function (x) { return x.t === 'skip'; }).length, 2);
    // 手算起点 3：BFS 3,2,7,1,5,6,0,4；DFS 3,7,6,5,4,1,2,0；
    //   Dijkstra：取 (0,3)：dist2=6，dist7=1 → (1,7)：dist6=4 → (4,6)：dist2=5（改小），dist5=6 → (5,2)：dist1=10
    //   → (6,2) 过期 → (6,5)：dist4=15 → (10,1)：dist0=14，dist4=12（改小）→ (12,4)：dist0=13（改小）→ (13,0)
    //   dist = [13,10,5,0,12,6,4,1]
    eq('BFS 访问顺序（起点 3）', bfs(A, 3).order, [3, 2, 7, 1, 5, 6, 0, 4]);
    eq('DFS 访问顺序（起点 3）', dfs(A, 3).order, [3, 7, 6, 5, 4, 1, 2, 0]);
    eq('Dijkstra 距离（起点 3）', dijkstra(A, 3).dist, [13, 10, 5, 0, 12, 6, 4, 1]);
    // 中间状态（起点 0）：处理完 4 的最后一个邻居后
    eq('Dijkstra 处理完 4 后的优先队列 [dist, 点, 过期]', at(d0, 4, 5).box.map(function (x) { return [x.d, x.n, x.old]; }), [[3, 1, false], [4, 1, true], [10, 5, false]]);
    eq('DFS 处理完 4 后的栈（栈底→栈顶）', at(f0, 4, 5).box.map(function (x) { return x.n; }), [1, 1, 5]);
    eq('BFS 处理完 2 后的队列（队首→队尾）', at(b0, 2, 6).box.map(function (x) { return x.n; }), [5, 3, 6]);
    // 交叉验证：8 个起点都和 Floyd–Warshall 一致；无权时 Dijkstra = BFS 层数
    var F = floyd(N, EDGES, false, false), F1 = floyd(N, EDGES, false, true), bad = [], s;
    for (s = 0; s < N; s++) {
      if (JSON.stringify(dijkstra(A, s).dist) !== JSON.stringify(F[s])) bad.push('带权起点 ' + s);
      if (JSON.stringify(dijkstra(A1, s).dist) !== JSON.stringify(F1[s]) || JSON.stringify(bfs(A, s).dist) !== JSON.stringify(F1[s])) bad.push('无权起点 ' + s);
      if (dfs(A, s).order.length !== N) bad.push('DFS 起点 ' + s);
    }
    eq('8 个起点交叉验证（Floyd–Warshall）不一致的项', bad, []);
    // 负权反例（有向）：s→a 2，s→b 3，b→a −2。Dijkstra 先确定 dist[a] = 2，真实最短是 s→b→a = 1。
    var neg = [[0, 1, 2], [0, 2, 3], [2, 1, -2]];
    eq('负权反例：Dijkstra 给出的 dist[a]', dijkstra(buildAdj(3, neg, true, false), 0).dist[1], 2);
    eq('负权反例：真实最短距离', floyd(3, neg, true, false)[0][1], 1);
    return { ok: ok, details: out };
  }

  // ---------- 界面 ----------
  var ALG = {
    bfs: { box: '队列（先进先出）', ends: ['队首（先出）', '队尾'], vis: '已访问（入队时标记）', ord: '访问顺序',
      front: '在队列中', done: '已出队', tree: 'BFS 树的边', badge: '层数', rows: ['层数', '父节点'], old: '',
      note: '层数 = 从起点出发最少要走的边数；父节点 = 第一次发现它的点。' },
    dfs: { box: '栈（后进先出）', ends: ['栈底', '栈顶（先出）'], vis: '已访问（弹出时标记）', ord: '访问顺序',
      front: '在栈中、未访问', done: '已访问', tree: 'DFS 树的边', badge: '', rows: ['父节点', '树上边数'],
      old: '划线的项：这个点已经访问过，弹出时会跳过。',
      note: '栈里的小字「由 4」表示这一项是处理 4 时压入的；弹出它时如果这个点还没访问过，4 就是它的父节点。树上边数 = DFS 树上离起点几条边。' },
    dij: { box: '优先队列（按 dist 从小到大）', ends: ['最小（先出）', ''], vis: '已确定', ord: '确定顺序',
      front: '在优先队列中', done: '已确定', tree: '最短路径树的边', badge: 'dist', rows: ['dist', '前驱'],
      old: '划线的项已过期：这个点已经有了更小的 dist，或已经确定，取出时跳过。',
      note: 'dist = 目前找到的从起点出发的最短距离；前驱（predecessor）= 这条路上它的前一个点。' }
  };

  var CSS = [
    '.~root{container-type:inline-size;color:var(--text);font-family:var(--font);font-size:15px;line-height:1.65}',
    '.~root *{box-sizing:border-box}',
    '.~howto{margin:0 0 10px;color:var(--text-2)}',
    '.~opts{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin:0 0 10px}',
    '.~opts label{display:inline-flex;align-items:center;gap:6px;cursor:pointer}',
    '.~opts select{font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:4px 8px;min-height:36px;max-width:100%}',
    '.~opts input{width:18px;height:18px;margin:0;accent-color:var(--c-ds)}',
    '.~rule{margin:0 0 12px;padding:8px 12px;border-radius:8px;background:var(--surface-2);color:var(--text-2);font-size:14px}',
    '.~main{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start}',
    '@container (min-width:720px){.~main{grid-template-columns:minmax(0,1.12fr) minmax(0,1fr)}}',
    '.~col{display:grid;gap:12px;min-width:0}',
    '.~card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;min-width:0}',
    '.~svg{display:block;width:100%;height:auto}',
    '.~edge{stroke:var(--edge);stroke-width:3;stroke-linecap:round}',
    '.~edge.~tree{stroke:var(--c-ds);stroke-width:7}',
    '.~edge.~tent{stroke:var(--c-ds);stroke-width:4;stroke-dasharray:9 7;stroke-linecap:butt}',
    '.~edge.~chk{stroke:var(--text);stroke-width:7}',
    '.~dim{opacity:.35}',
    '.~w{font:600 20px var(--font);fill:var(--text-2);paint-order:stroke;stroke:var(--surface);stroke-width:6px;stroke-linejoin:round;text-anchor:middle;dominant-baseline:central}',
    '.~body{fill:var(--surface);stroke:var(--edge-strong);stroke-width:2}',
    '.~front .~body{stroke:var(--c-ds);stroke-width:3.5;stroke-dasharray:7 4}',
    '.~done .~body{fill:color-mix(in srgb,var(--c-ds) 32%,var(--surface));stroke:var(--c-ds);stroke-width:3.5}',
    '.~ring{fill:none;stroke:none}',
    '.~cur .~ring{stroke:var(--text);stroke-width:3.5}',
    '.~nb .~ring{stroke:var(--text);stroke-width:3.5;stroke-dasharray:6 4}',
    '.~lbl{font:700 22px var(--font);fill:var(--text);text-anchor:middle;dominant-baseline:central}',
    '.~badge rect{fill:var(--surface-2);stroke:var(--edge-strong);stroke-width:1.5}',
    '.~badge text{font:600 20px var(--mono);fill:var(--text);text-anchor:middle;dominant-baseline:central}',
    '.~badge.~chg rect{stroke:var(--text);stroke-width:3}',
    '.~tag{font:600 18px var(--font);fill:var(--text-2);text-anchor:middle;dominant-baseline:central}',
    '.~hide{display:none}',
    '.~legend{display:flex;flex-wrap:wrap;gap:2px 14px;margin-top:6px;font-size:13px;color:var(--text-2)}',
    '.~legend span{display:inline-flex;align-items:center;gap:5px}',
    '.~legend svg{width:20px;height:20px;flex:none}',
    '.~step{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.~step button{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 14px;min-height:38px;cursor:pointer}',
    '.~step button.~pri{background:color-mix(in srgb,var(--c-ds) 14%,var(--surface));border-color:var(--c-ds)}',
    '.~step button[aria-disabled=true]{opacity:.45;cursor:default}',
    '.~root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}',
    '.~count{font-size:13px;color:var(--text-3);margin-left:auto}',
    '.~now{border-left:4px solid var(--c-ds);background:color-mix(in srgb,var(--c-ds) 7%,var(--surface));border-radius:0 var(--radius) var(--radius) 0;padding:10px 14px}',
    '.~nowh{font-size:13px;font-weight:600;color:var(--text-2)}',
    '.~msg{margin:2px 0 0;min-height:3.3em}',
    '.~h{font-weight:600;font-size:14px;margin-bottom:6px}',
    '.~lane{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-height:42px}',
    '.~end,.~empty{font-size:12px;color:var(--text-3)}',
    '.~cell{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-width:36px;padding:3px 8px;border:1px solid var(--border);border-radius:7px;background:var(--surface-2);font:600 15px var(--mono);line-height:1.3}',
    '.~cell small{font:11px var(--font);color:var(--text-3)}',
    '.~cell.~hi{border:2px solid var(--c-ds);background:color-mix(in srgb,var(--c-ds) 16%,var(--surface))}',
    '.~cell.~old{opacity:.55;text-decoration:line-through}',
    '.~small{margin:6px 0 0;font-size:13px;color:var(--text-2)}',
    '.~small:empty{display:none}',
    '.~info{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;margin:0;font-size:14px}',
    '.~info dt{color:var(--text-2)}',
    '.~info dd{margin:0}',
    '.~tblwrap{overflow-x:auto}',
    '.~tbl{border-collapse:collapse;width:100%;font-size:14px;text-align:center;font-variant-numeric:tabular-nums}',
    '.~tbl th,.~tbl td{border:1px solid var(--border);padding:4px 2px;min-width:28px}',
    '.~tbl th{background:var(--surface-2);font-weight:600}',
    '.~tbl th[scope=row]{text-align:left;padding:4px 8px;white-space:nowrap}',
    '.~tbl thead th.~start{box-shadow:inset 0 -3px 0 var(--c-ds)}',
    '.~tbl td.~fin{background:color-mix(in srgb,var(--c-ds) 18%,var(--surface))}',
    '.~tbl td.~chg{box-shadow:inset 0 0 0 2px var(--text);font-weight:700}',
    '@container (max-width:340px){.~tbl th,.~tbl td{min-width:22px}}',
    '.~notes{margin-top:18px}',
    '.~notes h4{margin:14px 0 4px;font-size:15px;font-weight:600}',
    '.~notes p{margin:0 0 8px}',
    '@media (prefers-reduced-motion:no-preference){.~body,.~edge,.~cell,.~tbl td{transition:fill .25s,stroke .25s,opacity .25s,background-color .25s}}'
  ].join('\n');

  var NOTES = '<p>三种算法的框架相同：把起点放进一个容器，然后反复取出一个点、检查它的邻居。主要区别在于容器先给出谁：队列（queue）给出最早放进去的点（BFS），栈（stack）给出最后放进去的点（DFS），优先队列（priority queue）给出 dist 最小的点（Dijkstra）。标记的时机也不同：BFS 入队时就标记已访问；DFS 要等弹出时才标记，否则访问顺序可能不再是深度优先；Dijkstra 取出时才确定 dist。</p><h4>BFS：无权图上得到边数最少的路径</h4>' +
    '<p>BFS（广度优先搜索，Breadth-First Search）用队列。它先处理完离起点 1 条边的所有点，再处理 2 条边的，一层层往外扩，所以一个点第一次被发现时经过的边数就是最少边数。以起点 0 为例：第 1 层是 1、4，第 2 层是 2、5，第 3 层是 3、6，第 4 层是 7。</p>' +
    '<p>BFS 不看边权。带权时，边数最少的路不一定权重和最小：BFS 到 7 走 0→1→2→3→7，权重和 4 + 5 + 6 + 1 = 16；最短路 0→4→1→2→6→7 的权重和是 1 + 2 + 5 + 1 + 3 = 12。</p>' +
    '<h4>DFS：能走遍所有点，但不保证最短</h4>' +
    '<p>DFS（深度优先搜索，Depth-First Search）用栈，沿一条路一直往深处走，走不通再退回来。它能找出从起点走得到的所有点，常用来判断连通、找环，但找到的路径不保证最短。以起点 0 为例，DFS 最后才访问 1，DFS 树上的路径是 0→4→5→6→7→3→2→1，共 7 条边，可 0 和 1 之间就有一条边。</p>' +
    '<h4>Dijkstra：带权图的最短路，要求边权非负</h4>' +
    '<p>Dijkstra 用优先队列，每次取出 dist 最小的点，认定它的最短距离已经确定。这一步靠的是边权非负：其余没确定的点 dist 都不比它小，从那些点绕过来还要再加上非负的边权，不可能更短。有负权边时这个推理就失效。例如有向图里 s→a 权 2、s→b 权 3、b→a 权 −2：Dijkstra 先取出 a，定下 dist[a] = 2，可 s→b→a 只要 3 + (−2) = 1。有负权边时要改用 Bellman-Ford 算法。</p>' +
    '<p>实现细节：更新 dist 时，演示直接往优先队列里放一条新记录，旧记录留在原处，等它被取出时发现点已确定就跳过（面板里划线显示），这叫惰性删除（lazy deletion）。用二叉堆（binary heap）写 Dijkstra 通常这样做，时间复杂度是 O((V + E) log V)；BFS 和 DFS 是 O(V + E)。</p>';

  function T(s) { return s.replace(/~(\w+)/g, P + '$1'); }
  function cx() { var o = [], i; for (i = 0; i < arguments.length; i++) if (arguments[i]) o.push(P + arguments[i]); return o.join(' '); }

  function svgHTML() {
    var s = '<svg class="~svg" viewBox="0 0 520 354" role="img">', i, p, b, t;
    EDGES.forEach(function (e) {
      var a = POS[e[0]], c = POS[e[1]];
      s += '<line class="~edge" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + c[0] + '" y2="' + c[1] + '"/>';
    });
    EDGES.forEach(function (e, k) { s += '<text class="~w" x="' + WPOS[k][0] + '" y="' + WPOS[k][1] + '">' + e[2] + '</text>'; });
    for (i = 0; i < N; i++) {
      p = POS[i];
      s += '<g class="~node"><circle class="~ring" cx="' + p[0] + '" cy="' + p[1] + '" r="29"/><circle class="~body" cx="' + p[0] + '" cy="' + p[1] +
        '" r="22"/><text class="~lbl" x="' + p[0] + '" y="' + p[1] + '">' + i + '</text></g>';
    }
    for (i = 0; i < N; i++) {
      b = BPOS[i]; t = TPOS[i];
      s += '<g class="~badge"><rect x="' + (b[0] - 20) + '" y="' + (b[1] - 13) + '" width="40" height="26" rx="7"/><text x="' + b[0] + '" y="' + b[1] + '"></text></g>' +
        '<text class="~tag" x="' + t[0] + '" y="' + t[1] + '">起点</text>';
    }
    return s + '</svg>';
  }

  function swatch(kind) {
    var o = '<svg viewBox="0 0 60 60" aria-hidden="true">';
    if (kind === 'tree' || kind === 'tent') return o + '<line class="' + cx('edge', kind) + '" x1="4" y1="30" x2="56" y2="30"/></svg>';
    if (kind === 'badge') return o + '<g class="' + cx('badge') + '"><rect x="4" y="15" width="52" height="30" rx="7"/><text x="30" y="30">8</text></g></svg>';
    return o + '<g class="' + cx('node', kind) + '"><circle class="' + cx('ring') + '" cx="30" cy="30" r="27"/><circle class="' + cx('body') + '" cx="30" cy="30" r="19"/></g></svg>';
  }

  var OPTS = '', i0;
  for (i0 = 0; i0 < N; i0++) OPTS += '<option value="' + i0 + '">' + i0 + '</option>';
  var HTML = T('<p class="~howto">怎么玩：选好算法和起点，点「下一步」逐步执行；焦点在演示里时也可以按 ← → 键。每走一步，图和面板会一起更新。</p>' +
    '<div class="~opts"><label>算法 <select data-k="alg" aria-label="选择算法"><option value="bfs">BFS 广度优先（队列）</option>' +
    '<option value="dfs">DFS 深度优先（栈）</option><option value="dij">Dijkstra 最短路（优先队列）</option></select></label>' +
    '<label>起点 <select data-k="start" aria-label="选择起点">' + OPTS + '</select></label>' +
    '<label><input type="checkbox" data-k="unit" aria-label="无权视图：每条边算 1"> 无权视图（每条边算 1）</label></div>' +
    '<p class="~rule">约定：每个点的邻居一律按编号从小到大检查，所以每次运行的结果都一样。DFS 也按这个顺序压栈，编号大的邻居后压入、先弹出；优先队列里 dist 相同时，编号小的先出。</p>' +
    '<div class="~main"><div class="~col"><div class="~card">' + svgHTML() + '<div class="~legend" data-r="legend"></div></div>' +
    '<div class="~step"><button type="button" data-a="prev" aria-label="上一步">上一步</button>' +
    '<button type="button" data-a="next" class="~pri" aria-label="下一步">下一步</button>' +
    '<button type="button" data-a="play" aria-label="自动播放">自动播放</button>' +
    '<button type="button" data-a="reset" aria-label="重置到第一步">重置</button><span class="~count" data-r="count"></span></div>' +
    '<div class="~now"><div class="~nowh">现在发生了什么</div><p class="~msg" data-r="msg" aria-live="polite"></p></div></div>' +
    '<div class="~col"><div class="~card"><div class="~h" data-r="boxh"></div><div class="~lane" data-r="lane"></div><p class="~small" data-r="boxnote"></p></div>' +
    '<div class="~card"><dl class="~info" data-r="info"></dl></div>' +
    '<div class="~card"><div class="~tblwrap"><table class="~tbl" data-r="tbl"></table></div><p class="~small" data-r="tblnote"></p></div></div></div>' +
    '<div class="~notes">' + NOTES + '</div>');

  function injectStyle() {
    if (document.getElementById('dm-style-' + ID)) return;
    var el = document.createElement('style');
    el.id = 'dm-style-' + ID;
    el.textContent = T(CSS);
    document.head.appendChild(el);
  }

  function mount(container) {
    injectStyle();
    var root = document.createElement('div');
    root.className = P + 'root';
    root.innerHTML = HTML;
    container.innerHTML = '';
    container.appendChild(root);
    function q(r) { return root.querySelector('[data-r="' + r + '"]'); }
    var svg = root.querySelector('svg'), sv = function (c) { return Array.prototype.slice.call(svg.querySelectorAll('.' + P + c)); };
    var eEdges = sv('edge'), eW = sv('w'), eNodes = sv('node'), eBadges = sv('badge'), eTags = sv('tag');
    var bPrev = root.querySelector('[data-a=prev]'), bNext = root.querySelector('[data-a=next]'), bPlay = root.querySelector('[data-a=play]');
    var S = { alg: 'bfs', start: 0, unit: false, idx: 0, steps: [], timer: null };
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (err) { reduce = false; }

    function build() {
      var A = buildAdj(N, EDGES, false, false), Ad = ALG[S.alg];
      var R = { bfs: bfs(A, S.start), dfs: dfs(A, S.start), dij: dijkstra(A, S.start) };
      R.cur = S.alg === 'bfs' ? R.bfs : S.alg === 'dfs' ? R.dfs : S.unit ? dijkstra(buildAdj(N, EDGES, false, true), S.start) : R.dij;
      R.cur.steps[R.cur.steps.length - 1].msg = summary(S.alg, S.start, S.unit, R);
      S.steps = R.cur.steps;
      var lg = [['', '未访问'], ['front', Ad.front], ['done', Ad.done], ['cur', '当前节点'], ['nb', '正在检查的邻居'], ['tree', Ad.tree]];
      if (S.alg === 'dij') lg.push(['tent', '前驱（还可能改）']);
      if (Ad.badge) lg.push(['badge', '小框：' + Ad.badge]);
      q('legend').innerHTML = lg.map(function (x) { return '<span>' + swatch(x[0]) + x[1] + '</span>'; }).join('');
      q('boxh').textContent = Ad.box;
      q('tblnote').textContent = Ad.note + '表头带蓝色下划线的列是起点。';
      svg.setAttribute('aria-label', '无向图，8 个顶点（0 到 7），11 条边：' + EDGES.map(function (e) {
        return e[0] + '–' + e[1] + (S.unit ? '' : '（权 ' + e[2] + '）');
      }).join('、') + '。');
    }

    function render() {
      var st = S.steps[S.idx], Ad = ALG[S.alg], end = st.t === 'done', i, h, a, b, c, set = [], hd = '', r1 = '', r2 = '';
      for (i = 0; i < N; i++) {
        var showB = S.alg === 'dij' || (S.alg === 'bfs' && st.vis[i]);
        eNodes[i].setAttribute('class', cx('node', st.proc[i] ? 'done' : st.front[i] && 'front', st.cur === i && 'cur', st.nb === i && 'nb'));
        eBadges[i].setAttribute('class', cx('badge', !showB && 'hide', st.chg === i && 'chg'));
        eBadges[i].lastChild.textContent = st.d[i] === Infinity ? '∞' : String(st.d[i]);
        eTags[i].setAttribute('class', cx('tag', i !== S.start && 'hide'));
      }
      EDGES.forEach(function (e, k) {
        var u = e[0], v = e[1], child = st.p[v] === u ? v : st.p[u] === v ? u : -1;
        var chk = (st.cur === u && st.nb === v) || (st.cur === v && st.nb === u);
        var tree = child >= 0 && (S.alg !== 'dij' || st.proc[child]);
        eEdges[k].setAttribute('class', cx('edge', chk ? 'chk' : tree ? 'tree' : child >= 0 && 'tent', end && child < 0 && 'dim'));
        eW[k].setAttribute('class', cx('w', S.unit && 'hide', end && child < 0 && 'dim'));
      });
      h = '<span class="' + cx('end') + '">' + Ad.ends[0] + '</span>';
      if (!st.box.length) h += '<span class="' + cx('empty') + '">（空）</span>';
      st.box.forEach(function (x, j) {
        h += '<span class="' + cx('cell', j === st.hi && 'hi', x.old && 'old') + '">' + (S.alg === 'dij' ? '(' + x.d + ', ' + x.n + ')' : x.n) +
          (S.alg === 'dfs' ? '<small>' + (x.f < 0 ? '起点' : '由 ' + x.f) + '</small>' : '') + '</span>';
      });
      if (Ad.ends[1]) h += '<span class="' + cx('end') + '">' + Ad.ends[1] + '</span>';
      q('lane').innerHTML = h;
      q('boxnote').textContent = st.box.some(function (x) { return x.old; }) ? Ad.old : '';
      a = '–';
      if (st.t === 'skip') a = '无（' + (S.alg === 'dij' ? '取出的 (' + st.popped.d + ', ' + st.popped.n + ') 已过期' : '弹出的 ' + st.popped.n + ' 已访问过') + '，跳过）';
      else if (st.cur >= 0) a = st.cur + (S.alg === 'bfs' ? '（刚出队）' : S.alg === 'dfs' ? '（刚弹出）' : '（刚取出，dist = ' + st.d[st.cur] + '）');
      b = st.nb < 0 ? '–' : '邻居 ' + st.nb + '（边 ' + st.cur + '–' + st.nb + (S.alg === 'dij' ? '，权 ' + st.w : '') + '）';
      for (i = 0; i < N; i++) if (st.vis[i]) set.push(i);
      q('info').innerHTML = '<dt>当前节点</dt><dd>' + a + '</dd><dt>正在检查</dt><dd>' + b + '</dd><dt>' + Ad.vis + '</dt><dd>{' + set.join(', ') +
        '}</dd><dt>' + Ad.ord + '</dt><dd>' + (st.order.length ? st.order.join(' → ') : '–') + '</dd>';
      for (i = 0; i < N; i++) {
        c = cx(st.proc[i] && 'fin', st.chg === i && 'chg');
        if (S.alg === 'bfs') { a = st.vis[i] ? st.d[i] : '–'; b = st.p[i] >= 0 ? st.p[i] : '–'; }
        else if (S.alg === 'dfs') { a = st.p[i] >= 0 ? st.p[i] : '–'; b = st.vis[i] ? st.d[i] : '–'; }
        else { a = st.d[i] === Infinity ? '∞' : st.d[i]; b = st.p[i] >= 0 ? st.p[i] : '–'; }
        hd += '<th scope="col" class="' + cx(i === S.start && 'start') + '">' + i + '</th>';
        r1 += '<td class="' + c + '">' + a + '</td>';
        r2 += '<td class="' + c + '">' + b + '</td>';
      }
      q('tbl').innerHTML = '<thead><tr><th scope="row">节点</th>' + hd + '</tr></thead><tbody><tr><th scope="row">' + Ad.rows[0] + '</th>' + r1 +
        '</tr><tr><th scope="row">' + Ad.rows[1] + '</th>' + r2 + '</tr></tbody>';
      q('msg').textContent = st.msg;
      q('count').textContent = '第 ' + (S.idx + 1) + ' / ' + S.steps.length + ' 步';
      bPrev.setAttribute('aria-disabled', S.idx === 0 ? 'true' : 'false');
      bNext.setAttribute('aria-disabled', S.idx === S.steps.length - 1 ? 'true' : 'false');
      bPlay.setAttribute('aria-disabled', reduce ? 'true' : 'false');
      bPlay.textContent = S.timer ? '暂停' : '自动播放';
      bPlay.setAttribute('aria-label', S.timer ? '暂停' : '自动播放');
      if (reduce) bPlay.title = '系统开启了「减少动态效果」，自动播放已关闭';
    }

    function stop() { if (S.timer) { clearInterval(S.timer); S.timer = null; } }
    function go(d) { S.idx = Math.max(0, Math.min(S.steps.length - 1, S.idx + d)); render(); }
    function tick() {
      if (S.idx < S.steps.length - 1) S.idx++;
      if (S.idx >= S.steps.length - 1) stop();
      render();
    }
    function onClick(ev) {
      var btn = ev.target.closest ? ev.target.closest('button[data-a]') : null;
      if (!btn || !root.contains(btn) || btn.getAttribute('aria-disabled') === 'true') return;
      var act = btn.getAttribute('data-a');
      if (act === 'play') {
        if (S.timer) { stop(); render(); return; }
        if (S.idx >= S.steps.length - 1) S.idx = 0;
        S.timer = setInterval(tick, 1100);
        render();
        return;
      }
      stop();
      if (act === 'prev') go(-1); else if (act === 'next') go(1); else { S.idx = 0; render(); }
    }
    function onChange(ev) {
      var k = ev.target.getAttribute('data-k');
      if (!k) return;
      stop();
      if (k === 'alg') S.alg = ev.target.value;
      else if (k === 'start') S.start = +ev.target.value;
      else S.unit = ev.target.checked;
      var keep = k === 'unit' && S.alg !== 'dij' ? S.idx : 0;
      build();
      S.idx = Math.min(keep, S.steps.length - 1);
      render();
    }
    function onKey(ev) {
      if (/^(SELECT|INPUT|TEXTAREA)$/.test(ev.target.tagName)) return;
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      ev.preventDefault();
      stop();
      go(ev.key === 'ArrowRight' ? 1 : -1);
    }
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKey);
    build();
    render();
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

  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = { title: '图搜索：BFS、DFS 和 Dijkstra', mount: mount, selfTest: selfTest };
})();
