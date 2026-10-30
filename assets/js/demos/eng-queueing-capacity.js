/* 交互演示：排队与容量（M/M/1 公式 + 固定种子的逐请求模拟）。纯原生 JS，挂到 window.KGDemos['eng-queueing-capacity']。 */
(function () {
  'use strict';
  var ID = 'eng-queueing-capacity', P = 'dm-' + ID + '-', NSTEP = 20, NRUN = 5000, NS = 240;
  function X(s) { return s.replace(/\bx-/g, P); }
  // 预设：[λ, μ, 按钮上的 ρ]
  var PRESETS = [[5, 10, '0.5'], [8, 10, '0.8'], [9.5, 10, '0.95'], [11, 10, '1.1']];

  /* ---------- 核心计算（不碰 DOM） ---------- */
  // mulberry32：32 位种子的小型伪随机数发生器，返回 [0, 1) 的数；同一种子每次得到同一串数
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // 指数分布，均值 1/rate；1 − u 落在 (0, 1]，不会取到 log(0)
  function expo(rng, rate) { return -Math.log(1 - rng()) / rate; }

  function mm1(lam, mu) {
    var rho = lam / mu, ok = rho < 1, I = Infinity;
    return { rho: rho, stable: ok, W: ok ? 1 / (mu - lam) : I, Wq: ok ? rho / (mu - lam) : I,
      L: ok ? rho / (1 - rho) : I, Lq: ok ? rho * rho / (1 - rho) : I };
  }

  // 单服务台、先到先服务：开始 = max(到达, 上一个完成)，完成 = 开始 + 服务时间。
  // q 是它到达时系统里已有的请求数（FIFO 下完成时刻递增，用一个指针数已经离开的）
  function fifo(A, S) {
    var out = [], free = 0, j = 0, i, s;
    for (i = 0; i < A.length; i++) {
      while (j < i && out[j].d <= A[i]) j++;
      s = Math.max(A[i], free); free = s + S[i];
      out.push({ a: A[i], s: s, d: free, x: S[i], q: i - j });
    }
    return out;
  }
  // 每个请求先抽到达间隔、再抽服务时间，顺序固定：前 20 个请求和 5000 个请求的前 20 个完全一样
  function simulate(lam, mu, n, seed) {
    var rng = mulberry32(seed), A = [], S = [], t = 0;
    for (var i = 0; i < n; i++) { t += expo(rng, lam); A.push(t); S.push(expo(rng, mu)); }
    return fifo(A, S);
  }
  // 观察窗口 [0, T]，T 是最后一个请求到达的时刻。L 是 N(t) 在窗口里的时间平均：按事件顺序累加曲线下面积，
  // 不经过 W，所以拿 (n/T)·W 和它比才算核对 Little 定律。smp 是 N(t) 在 0、T/ns、…、T 处的采样
  function stats(R, ns) {
    var n = R.length, T = R[n - 1].a, sw = 0, swq = 0, area = 0, N = 0, last = 0, ai = 0, di = 0, smp = [], k = 0, ta, td, tn, i;
    for (i = 0; i < n; i++) { sw += R[i].d - R[i].a; swq += R[i].s - R[i].a; }
    for (;;) {
      ta = ai < n ? R[ai].a : Infinity; td = di < n ? R[di].d : Infinity; tn = Math.min(ta, td);
      if (tn > T) break;
      while (k <= ns && k * T / ns < tn) { smp.push(N); k++; }
      area += N * (tn - last); last = tn;
      if (ta <= td) { N++; ai++; } else { N--; di++; }
    }
    while (k <= ns) { smp.push(N); k++; }
    area += N * (T - last);
    var W = sw / n, lh = n / T, L = area / T;
    return { n: n, T: T, lh: lh, W: W, Wq: swq / n, L: L, lw: lh * W, rel: Math.abs(L - lh * W) / L, end: N, smp: smp };
  }
  function meanW(R, i0, i1) { var s = 0; for (var i = i0; i < i1; i++) s += R[i].d - R[i].a; return s / (i1 - i0); }

  /* ---------- 格式与 SVG 小工具 ---------- */
  function fmt(x, p) {
    if (x === Infinity) return '∞';
    if (!isFinite(x)) return '—';
    var a = Math.abs(x), t = a >= 1000 ? x.toFixed(0) : a >= 100 ? x.toFixed(1) : String(parseFloat(x.toPrecision(p || 4)));
    return t.replace('-', '−');
  }
  function t3(v) { return v.toFixed(3); }
  function ft(t) { return String(t).replace('-', '−'); }
  function pct(v) { return (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%'; }
  function num(s) {
    return parseFloat(String(s).trim().replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[，。．]/g, '.'));
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function ln(x1, y1, x2, y2, c) { return '<line class="x-' + c + '" x1="' + r1(x1) + '" y1="' + r1(y1) + '" x2="' + r1(x2) + '" y2="' + r1(y2) + '"/>'; }
  function tx(x, y, s, c, a) { return '<text class="x-' + c + '" x="' + r1(x) + '" y="' + r1(y) + '" text-anchor="' + (a || 'start') + '">' + s + '</text>'; }
  function nice(max, n, int) {
    if (!(max > 0)) max = 1;
    var raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p, out = [], k, i,
      step = Math.max(int ? 1 : 0, (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 && !int ? 2.5 : m <= 5 ? 5 : 10) * p);
    k = Math.max(1, Math.ceil(max / step - 1e-9));
    for (i = 0; i <= k; i++) out.push(+(i * step).toPrecision(10));
    return out;
  }
  function stepPath(ev, t1, x, y) {
    var N = 0, d = 'M' + r1(x(0)) + ' ' + r1(y(0));
    ev.forEach(function (e) { d += 'H' + r1(x(e[0])); N += e[1]; d += 'V' + r1(y(N)); });
    return d + 'H' + r1(x(t1));
  }
  function area(d, x1, y0, c) { return '<path class="x-' + c + 'f" d="' + d + 'V' + r1(y0) + 'H' + r1(x1) + 'Z"/><path class="x-' + c + '" d="' + d + '"/>'; }

  /* ---------- 图：W 随 ρ 的变化（μ 固定） ---------- */
  function chartW(Wd, lam, mu, m) {
    var H = Math.round(Math.max(220, Math.min(300, Wd * 0.62))), ml = 46, mr = 14, mt = 16, mb = 40, pw = Wd - ml - mr, ph = H - mt - mb,
      XM = 1.2, yt = nice(1 / (mu * 0.02), 4), top = yt[yt.length - 1], o = '', i, pts = [];
    function x(r) { return ml + r / XM * pw; }
    function y(w) { return mt + ph - w / top * ph; }
    // 竖排的「不稳定」避开当前 ρ 的竖线
    var ux = r1(x(m.rho >= 1.06 && m.rho <= 1.14 ? (m.rho < 1.1 ? 1.15 : 1.05) : 1.1));
    o += '<rect class="x-un" x="' + r1(x(1)) + '" y="' + mt + '" width="' + r1(x(XM) - x(1)) + '" height="' + ph + '"/>';
    o += '<text class="x-tk" x="' + ux + '" y="' + (mt + 18) + '" text-anchor="middle"><tspan>不</tspan><tspan x="' + ux + '" dy="14">稳</tspan><tspan x="' + ux + '" dy="14">定</tspan></text>';
    yt.forEach(function (t) { o += ln(ml, y(t), x(XM), y(t), 'gl') + tx(ml - 7, y(t) + 4, ft(t), 'tk', 'end'); });
    for (i = 0; i <= 5; i++) o += ln(x(i / 5), mt + ph, x(i / 5), mt + ph + 4, 'ax') + tx(x(i / 5), mt + ph + 17, ft(i / 5), 'tk', 'middle');
    o += ln(ml, mt + ph, x(XM), mt + ph, 'ax') + ln(ml, mt, ml, mt + ph, 'ax') + ln(x(1), mt, x(1), mt + ph, 'ax');
    o += tx(ml - 6, mt - 5, 'W（秒）', 'tt', 'start') + tx(x(XM), H - 6, '利用率 ρ = λ/μ', 'tt', 'end');
    o += ln(ml, y(1 / mu), x(1), y(1 / mu), 'base');
    for (i = 0; i <= 240; i++) { var r = 0.98 * i / 240; pts.push((i ? 'L' : 'M') + r1(x(r)) + ' ' + r1(y(1 / (mu * (1 - r))))); }
    o += '<path class="x-cv" d="' + pts.join('') + '"/>';
    var cx = x(Math.min(m.rho, XM)), lab, right = m.rho > 0.55;
    if (m.rho <= 0.98) {
      var cy = y(m.W);
      lab = 'ρ = ' + fmt(m.rho) + '，W = ' + fmt(m.W) + ' s';
      o += ln(cx, cy, cx, mt + ph, 'gd') + ln(ml, cy, cx, cy, 'gd') + '<circle class="x-pt" cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="6"/>';
      o += tx(right ? cx - 10 : cx + 10, Math.max(mt + 12, cy - 9), lab, 'hl x-big', right ? 'end' : 'start');
    } else if (m.stable) {
      o += ln(cx, mt + 14, cx, mt + ph, 'vl') + '<path class="x-pt" d="M' + r1(cx) + ' ' + mt + 'l6 11h-12z"/>';
      o += tx(cx - 10, mt + 12, 'W = ' + fmt(m.W) + ' s（超出图）', 'hl x-big', 'end');
    } else {
      o += ln(cx, mt, cx, mt + ph, 'vl') + tx(ml + 12, mt + 30, 'ρ = ' + fmt(m.rho) + ' ≥ 1', 'hl x-big') + tx(ml + 12, mt + 50, '不稳定：队列会无界增长', 'hl x-big');
    }
    return { H: H, svg: o };
  }

  /* ---------- 图：前 20 个请求的时间线 ---------- */
  function chartTL(Wd, R, s) {
    var n = R.length, ml = 36, mr = 12, top = 18, sh = 44, rh = 13, y0 = top + sh + 20, yb = y0 + n * rh + 4, H = yb + 34,
      pw = Wd - ml - mr, xt = nice(R[n - 1].d, Wd < 440 ? 4 : 7), xm = xt[xt.length - 1], mx = 1, o = '', i, r, ev = [];
    for (i = 0; i < n; i++) mx = Math.max(mx, R[i].q + 1);
    function x(t) { return ml + t / xm * pw; }
    function yN(k) { return top + sh - k / mx * sh; }
    xt.forEach(function (t) { o += ln(x(t), top, x(t), yb, 'gl') + tx(x(t), yb + 15, ft(t), 'tk', 'middle'); });
    o += ln(ml, yb, Wd - mr, yb, 'ax') + ln(ml, top + sh, Wd - mr, top + sh, 'ax') + tx(Wd - mr, H - 4, '时间 t（秒）', 'tt', 'end');
    o += tx(ml - 6, yN(mx) + 4, mx, 'tk', 'end') + tx(ml - 6, yN(0) + 4, '0', 'tk', 'end') + tx(ml + 4, top - 5, '系统内请求数 N(t)', 'tt');
    if (s) {
      var tn = R[s - 1].a;
      for (i = 0; i < s; i++) { ev.push([R[i].a, 1]); if (R[i].d <= tn) ev.push([R[i].d, -1]); }
      ev.sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; });
      o += area(stepPath(ev, tn, x, yN), x(tn), yN(0), 'nl');
      o += '<rect class="x-band" x="' + ml + '" y="' + (y0 + (s - 1) * rh) + '" width="' + pw + '" height="' + rh + '"/>';
    }
    for (i = 0; i < n; i++) {
      var yc = y0 + i * rh + rh / 2;
      o += tx(ml - 6, yc + 4, '#' + (i + 1), i === s - 1 ? 'rl x-rlc' : 'rl', 'end');
      if (i >= s) continue;
      r = R[i];
      if (r.s > r.a) o += ln(x(r.a), yc, x(r.s), yc, 'wt');
      o += '<rect class="x-sv" x="' + r1(x(r.s)) + '" y="' + r1(yc - 4) + '" width="' + Math.max(1, r1(x(r.d) - x(r.s))) + '" height="8"/>';
      o += '<circle class="x-arr" cx="' + r1(x(r.a)) + '" cy="' + r1(yc) + '" r="3.5"/>';
    }
    if (s) {
      var cx = x(R[s - 1].a), lft = cx > ml + pw * 0.6;
      o += ln(cx, top, cx, yb, 'now') + tx(lft ? cx - 5 : cx + 5, top + 12, 't = ' + t3(R[s - 1].a), 'hl', lft ? 'end' : 'start');
    }
    return { H: H, svg: o };
  }

  /* ---------- 图：5000 个请求跑下来，N(t) 随时间 ---------- */
  function chartN(Wd, run) {
    var st = run.st, H = Math.round(Math.max(180, Math.min(240, Wd * 0.45))), ml = 46, mr = 14, mt = 22, mb = 36, pw = Wd - ml - mr, ph = H - mt - mb,
      mxs = 0, o = '', ev = [], k, Lth = run.m.stable ? run.m.L : 0;
    st.smp.forEach(function (v) { mxs = Math.max(mxs, v); });
    var yt = nice(Math.max(mxs, Lth * 1.2, 4), 4, true), ytop = yt[yt.length - 1], xt = nice(st.T, Wd < 440 ? 4 : 6), xm = xt[xt.length - 1];
    function x(t) { return ml + t / xm * pw; }
    function y(v) { return mt + ph - v / ytop * ph; }
    yt.forEach(function (t) { o += ln(ml, y(t), ml + pw, y(t), 'gl') + tx(ml - 7, y(t) + 4, t, 'tk', 'end'); });
    xt.forEach(function (t) { o += ln(x(t), mt + ph, x(t), mt + ph + 4, 'ax') + tx(x(t), mt + ph + 17, ft(t), 'tk', 'middle'); });
    o += ln(ml, mt + ph, ml + pw, mt + ph, 'ax') + tx(ml - 6, mt - 8, '系统内请求数 N(t)', 'tt') + tx(ml + pw, H - 4, '时间 t（秒）', 'tt', 'end');
    for (k = 1; k < st.smp.length; k++) ev.push([k * st.T / NS, st.smp[k] - st.smp[k - 1]]);
    o += area(stepPath(ev, st.T, x, y), x(st.T), y(0), 'nl');
    if (Lth) o += ln(ml, y(Lth), ml + pw, y(Lth), 'vl') + tx(ml + pw - 4, y(Lth) - 6, '公式 L = ' + fmt(Lth), 'hl', 'end');
    else if (run.lam > run.mu) {
      var t1 = Math.min(st.T, ytop / (run.lam - run.mu));
      o += ln(x(0), y(0), x(t1), y((run.lam - run.mu) * t1), 'vl') + tx(x(t1 * 0.55) - 6, y((run.lam - run.mu) * t1 * 0.55) - 8, '(λ − μ)·t', 'hl', 'end');
    }
    return { H: H, svg: o };
  }

  /* ---------- 文字 ---------- */
  function intro(m, lam, mu) {
    var s = '现在 λ = ' + fmt(lam) + '、μ = ' + fmt(mu) + '，利用率 ρ = λ/μ = ' + fmt(m.rho);
    if (m.stable) return s + '：服务台平均有 ' + fmt(m.rho * 100, 3) + '% 的时间在忙。一个请求平均只要服务 1/μ = ' + fmt(1 / mu) + ' s，平均驻留时间却是 W = ' + fmt(m.W) +
      ' s，是服务时间的 1/(1−ρ) = ' + fmt(1 / (1 - m.rho)) + ' 倍，多出来的 ' + fmt(m.Wq) + ' s 都花在排队上。按「下一步」逐个跟踪前 20 个请求。';
    return s + ' ≥ 1，不稳定：队列会无界增长。' + (m.rho > 1 ? '平均每秒来 ' + fmt(lam) + ' 个请求，最多只能处理 ' + fmt(mu) + ' 个，平均每秒多积压 ' + fmt(lam - mu) + ' 个。'
      : '到达和处理能力刚好持平，但随机波动造成的积压没有多余的空闲时间来消化，队列会越漂越长。') + 'M/M/1 的 W、L 公式只在 ρ < 1 时成立。按「下一步」跟踪前 20 个请求，再跑 5000 个看队列怎么增长。';
  }
  function sayStep(R, s, m, lam, mu) {
    if (!s) return intro(m, lam, mu);
    var r = R[s - 1], p = R[s - 2], txt = '第 ' + s + ' 个请求在 t = ' + t3(r.a) + ' s 到达' + (p ? '（离上一个到达隔了 ' + t3(r.a - p.a) + ' s）' : '') + '。';
    if (!r.q) txt += (p ? '前面的请求都走了（第 ' + (s - 1) + ' 个在 t = ' + t3(p.d) + ' s 离开），' : '系统是空的，') + '服务台空闲，它不用排队，马上开始服务。';
    else txt += '服务台正忙，系统里已经有 ' + r.q + ' 个请求（1 个正在服务' + (r.q > 1 ? '、' + (r.q - 1) + ' 个在排队' : '') + '）。先到先服务，它要等第 ' + (s - 1) +
      ' 个在 t = ' + t3(r.s) + ' s 做完才能开始，排队 Wq = ' + t3(r.s - r.a) + ' s。';
    txt += '服务用了 ' + t3(r.x) + ' s，在 t = ' + t3(r.d) + ' s 离开，驻留时间 W = ' + (r.q ? '排队 + 服务 = ' : '') + t3(r.d - r.a) + ' s。';
    txt += '前 ' + s + ' 个请求的平均 W = ' + t3(meanW(R, 0, s)) + ' s' + (m.stable ? '，公式给的长期平均是 ' + fmt(m.W) + ' s' : '') + '。';
    if (s === R.length) txt += '20 个样本太少，平均值波动很大；按下面的「跑完 5000 个请求」看长期平均。';
    return txt;
  }
  function eqHTML(m, lam, mu) {
    var L = fmt(lam), M = fmt(mu), D = fmt(mu - lam), R = fmt(m.rho);
    function row(l, r) { return '<div><span class="x-eq">' + l + '</span> <span>' + r + '</span></div>'; }
    if (!m.stable) return row('ρ = λ/μ', '= ' + L + '/' + M + ' = ' + R + ' ≥ 1') +
      '<p class="x-bad">μ − λ = ' + D + ' ≤ 0：下面的公式都不成立，W、Wq、L、Lq 没有有限的稳态值。</p>' +
      row('W = 1/(μ−λ)', '') + row('Wq = ρ/(μ−λ)', '') + row('L = λW = ρ/(1−ρ)', '') + row('Lq = ρ²/(1−ρ)', '');
    return row('ρ = λ/μ', '= ' + L + '/' + M + ' = ' + R) + row('W = 1/(μ−λ)', '= 1/(' + M + '−' + L + ') = ' + fmt(m.W) + ' s') +
      row('Wq = ρ/(μ−λ)', '= ' + R + '/' + D + ' = ' + fmt(m.Wq) + ' s') + row('L = λW = ρ/(1−ρ)', '= ' + L + ' × ' + fmt(m.W) + ' = ' + fmt(m.L)) +
      row('Lq = ρ²/(1−ρ)', '= ' + fmt(m.rho * m.rho) + '/' + fmt(1 - m.rho) + ' = ' + fmt(m.Lq)) +
      '<p class="x-note">W = Wq + 1/μ：排队 ' + fmt(m.Wq) + ' s + 服务 ' + fmt(1 / mu) + ' s。Lq = λWq 也是 Little 定律，只是把「系统」换成「队列」。</p>';
  }
  function runHTML(run) {
    var st = run.st, m = run.m, h = '<p class="x-note">种子 ' + run.seed + '，λ = ' + fmt(run.lam) + '、μ = ' + fmt(run.mu) + '。观察窗口从 0 到最后一个请求到达的时刻 T = ' + fmt(st.T) +
      ' s；L 是窗口内 N(t) 曲线下面积除以 T，没用到 W。</p>';
    function tr(a, b, c, d) { return '<tr><th scope="row">' + a + '</th><td>' + b + '</td><td>' + c + '</td><td>' + d + '</td></tr>'; }
    var lit = '<p><b>Little 定律核对：</b>(n/T) × W = ' + fmt(st.lh) + ' × ' + fmt(st.W) + ' = ' + fmt(st.lw) + '，窗口内的时间平均 L = ' + fmt(st.L) + '，相差 ' + (st.rel * 100).toFixed(2) + '%。';
    if (m.stable) {
      h += '<div class="x-scroll x-rt" tabindex="0" aria-label="模拟结果和公式对照表"><table class="x-tbl"><thead><tr><th scope="col">量</th><th scope="col">模拟</th><th scope="col">M/M/1 公式</th><th scope="col">偏差</th></tr></thead><tbody>' +
        tr('实测到达率 n/T（个/秒）', fmt(st.lh), fmt(run.lam), pct(st.lh / run.lam - 1)) + tr('平均驻留时间 W（秒）', fmt(st.W), fmt(m.W), pct(st.W / m.W - 1)) +
        tr('平均排队时间 Wq（秒）', fmt(st.Wq), fmt(m.Wq), pct(st.Wq / m.Wq - 1)) + tr('时间平均在途数 L', fmt(st.L), fmt(m.L), pct(st.L / m.L - 1)) + '</tbody></table></div>';
      return h + lit + '两种算法得到的 L 对得上：这就是 L = λW。</p><p class="x-note">5000 个请求的平均值仍有随机误差，换几个种子试试；ρ 越接近 1，波动越大，要跑得越久才稳定。</p>';
    }
    var R = run.R, ks = [1250, 2500, 3750, 5000];
    h += '<div class="x-scroll x-rt" tabindex="0" aria-label="队列增长表"><table class="x-tbl"><thead><tr><th scope="col">第几个请求到达时</th>' +
      ks.map(function (k) { return '<th scope="col">' + k + '</th>'; }).join('') + '</tr></thead><tbody><tr><th scope="row">系统里已有的请求数</th>' +
      ks.map(function (k) { return '<td>' + R[k - 1].q + '</td>'; }).join('') + '</tr></tbody></table></div>';
    h += '<p><b>队列在增长：</b>前 1000 个请求平均驻留 ' + fmt(meanW(R, 0, 1000)) + ' s，最后 1000 个是 ' + fmt(meanW(R, NRUN - 1000, NRUN)) + ' s。没有稳态，跑得越久这些数越大，所以不拿公式来比。' +
      (run.lam > run.mu ? '图里的斜线是 (λ − μ)·t：平均每秒多积压 λ − μ = ' + fmt(run.lam - run.mu) + ' 个。' : 'ρ = 1 时队列像随机游走一样越漂越远，比 ρ > 1 长得慢，但同样没有上限。') + '</p>';
    return h + lit + '对不上，是因为窗口结束时还有 ' + st.end + ' 个请求没走，它们在 T 之后的驻留时间算进了 W，却不在窗口里。</p>';
  }

  /* ---------- 样式与骨架 ---------- */
  var CSS =
    '.x-root{container-type:inline-size;color:var(--text,#1b1b19);font-family:var(--font,sans-serif);font-size:15px;line-height:1.65}' +
    '.x-root *{box-sizing:border-box}' +
    '.x-root p{margin:0 0 8px}' +
    '.x-root h3{margin:0 0 6px;font-size:15px;font-weight:600;line-height:1.4;color:var(--text,#1b1b19)}' +
    '.x-root .x-how{color:var(--text-2,#52514e);font-size:14px;margin-bottom:12px}' +
    '.x-box{background:var(--surface,#fff);border:1px solid var(--border,#e2e1dc);border-radius:var(--radius,10px);padding:12px;margin:0 0 12px;min-width:0}' +
    '.x-ctl{display:flex;flex-wrap:wrap;gap:10px 20px;align-items:flex-end}' +
    '.x-field{display:flex;flex-direction:column;gap:2px;font-size:13px;color:var(--text-2,#52514e);min-width:0}' +
    '.x-par{flex:1 1 240px}' +
    '.x-row{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;min-width:0}' +
    '.x-rng{flex:1 1 120px;min-width:0;margin:0;accent-color:var(--c-eng,#a23b72)}' +
    '.x-in{font:14px var(--mono,monospace);color:var(--text,#1b1b19);background:var(--surface,#fff);border:1px solid var(--border,#e2e1dc);border-radius:8px;padding:4px 6px;min-height:34px;width:6em}' +
    '.x-btn{font:inherit;font-size:14px;color:var(--text,#1b1b19);background:var(--surface,#fff);border:1px solid var(--border,#e2e1dc);border-radius:8px;padding:5px 12px;min-height:36px;cursor:pointer}' +
    '.x-btn:hover{background:var(--surface-2,#f0efec)}' +
    '.x-btn[aria-pressed=true],.x-pri{background:color-mix(in srgb,var(--c-eng,#a23b72) 14%,var(--surface,#fff));border-color:var(--c-eng,#a23b72)}' +
    '.x-pri{font-weight:600}' +
    '.x-btn[aria-disabled=true]{opacity:.45;cursor:default}' +
    '.x-root :focus-visible{outline:2px solid var(--focus,#2457b3);outline-offset:2px}' +
    '.x-lab{font-size:13px;color:var(--text-2,#52514e)}' +
    '.x-root .x-msg{flex:1 1 100%;margin:0;font-size:13px;color:var(--text-2,#52514e)}' +
    '.x-root .x-msg:empty{display:none}' +
    '.x-root .x-err{color:var(--text,#1b1b19);background:color-mix(in srgb,var(--div-pos,#e34948) 16%,var(--surface,#fff));border-radius:6px;padding:4px 8px}' +
    '.x-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:0 12px}' +
    '@container (min-width:720px){.x-grid{grid-template-columns:minmax(0,3fr) minmax(0,2fr)}}' +
    '.x-root .x-read{font-size:14px;color:var(--text-2,#52514e);margin-bottom:4px}' +
    '.x-read b{color:var(--text,#1b1b19)}' +
    '.x-svg svg{display:block;width:100%;height:auto}' +
    '.x-eqs{font:13px/1.9 var(--mono,monospace);margin-bottom:8px;overflow-wrap:anywhere}' +
    '.x-eq{font-weight:600}' +
    '.x-root .x-eqs p{font-family:var(--font,sans-serif);line-height:1.6;margin:4px 0 0}' +
    '.x-root .x-bad{font-family:var(--font,sans-serif);font-size:13px;line-height:1.6;margin:4px 0;padding:4px 8px;border-left:3px solid var(--div-pos,#e34948);background:var(--surface-2,#f0efec)}' +
    '.x-root .x-note{font-size:13px;color:var(--text-2,#52514e)}' +
    '.x-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}' +
    '.x-status{flex:1 1 220px;font-size:14px;color:var(--text-2,#52514e)}' +
    '.x-say{border-left:4px solid var(--c-eng,#a23b72)}' +
    '.x-root .x-say p{margin:0;font-size:14.5px;line-height:1.75}' +
    '.x-key{display:flex;flex-wrap:wrap;gap:2px 14px;font-size:12.5px;color:var(--text-3,#6b6a66);margin:4px 0 8px}' +
    '.x-key span{display:inline-flex;align-items:center;gap:5px}' +
    '.x-scroll{overflow:auto;max-height:240px;border:1px solid var(--border,#e2e1dc);border-radius:8px;margin:0 0 8px}' +
    '.x-rt{max-height:none}' +
    '.x-tbl{border-collapse:collapse;width:100%;font:12.5px/1.5 var(--mono,monospace);font-variant-numeric:tabular-nums}' +
    '.x-tbl th,.x-tbl td{padding:3px 8px;text-align:right;border-bottom:1px solid var(--border,#e2e1dc);white-space:nowrap;color:var(--text,#1b1b19)}' +
    '.x-tbl thead th{position:sticky;top:0;background:var(--surface-2,#f0efec);font-family:var(--font,sans-serif);font-weight:600;color:var(--text-2,#52514e)}' +
    '.x-tbl tbody th{text-align:left;font-family:var(--font,sans-serif);font-weight:400;color:var(--text-2,#52514e)}' +
    '.x-tbl tr.x-cur td{background:color-mix(in srgb,var(--c-eng,#a23b72) 12%,var(--surface,#fff));font-weight:600}' +
    '.x-gl{stroke:var(--border,#e2e1dc)}' +
    '.x-ax{stroke:var(--edge-strong,#6f6e69)}' +
    '.x-tk{fill:var(--text-3,#6b6a66);font-size:11.5px}' +
    '.x-tt{fill:var(--text-2,#52514e);font-size:12px}' +
    '.x-un{fill:var(--surface-2,#f0efec)}' +
    '.x-cv{fill:none;stroke:var(--c-eng,#a23b72);stroke-width:2.5}' +
    '.x-base{stroke:var(--text-3,#6b6a66);stroke-dasharray:5 4}' +
    '.x-gd{stroke:var(--text-3,#6b6a66);stroke-dasharray:3 3}' +
    '.x-pt{fill:var(--c-eng,#a23b72);stroke:var(--surface,#fff);stroke-width:2}' +
    '.x-vl{stroke:var(--c-eng,#a23b72);stroke-width:2;stroke-dasharray:6 4}' +
    '.x-hl{fill:var(--text,#1b1b19);font-size:12px;paint-order:stroke;stroke:var(--surface,#fff);stroke-width:4px;stroke-linejoin:round}' +
    '.x-big{font-size:13px;font-weight:600}' +
    '.x-nl{fill:none;stroke:var(--c-eng,#a23b72);stroke-width:1.5}' +
    '.x-nlf{fill:color-mix(in srgb,var(--c-eng,#a23b72) 22%,var(--surface,#fff))}' +
    '.x-band{fill:color-mix(in srgb,var(--c-eng,#a23b72) 12%,var(--surface,#fff))}' +
    '.x-rl{fill:var(--text-3,#6b6a66);font-size:11px}' +
    '.x-rlc{fill:var(--text,#1b1b19);font-weight:600}' +
    '.x-wt{stroke:var(--text-2,#52514e);stroke-width:2;stroke-dasharray:3 2}' +
    '.x-sv{fill:var(--c-eng,#a23b72)}' +
    '.x-arr{fill:var(--surface,#fff);stroke:var(--text,#1b1b19);stroke-width:1.5}' +
    '.x-now{stroke:var(--text-2,#52514e);stroke-dasharray:4 3}';

  function par(k, name, unit, min, max) {
    return '<div class="x-field x-par"><span>' + name + '（' + unit + '）</span><div class="x-row">' +
      '<input class="x-rng x-' + k + 'r" type="range" min="' + min + '" max="' + max + '" step="0.1" aria-label="' + name + ' 滑块，' + min + ' 到 ' + max + ' ' + unit + '">' +
      '<input class="x-in x-' + k + 'n" type="text" inputmode="decimal" spellcheck="false" autocomplete="off" aria-label="' + name + ' 数值（0.1 到 100），输入后按回车"></div></div>';
  }
  function key(svg, w, t) { return '<span><svg width="' + w + '" height="12" aria-hidden="true">' + svg + '</svg>' + t + '</span>'; }
  var TPL =
    '<p class="x-how">怎么玩：拖动到达率 λ 和服务率 μ（或点预设），看平均驻留时间 W 怎样随利用率 ρ 变化；再按「下一步」逐个跟踪前 20 个请求的到达、排队和离开，最后「跑完 5000 个请求」，用模拟核对公式和 Little 定律 L = λW。</p>' +
    '<div class="x-box x-ctl">' + par('l', '到达率 λ', '请求/秒', 0.5, 20) + par('m', '服务率 μ', '请求/秒', 1, 20) +
    '<div class="x-row" role="group" aria-label="预设，μ = 10"><span class="x-lab">预设（μ = 10）：</span>' +
    PRESETS.map(function (p, i) { return '<button class="x-btn" type="button" data-pre="' + i + '" aria-pressed="false" aria-label="预设 ρ = ' + p[2] + '：λ = ' + p[0] + '，μ = ' + p[1] + '">ρ = ' + p[2] + '</button>'; }).join('') + '</div>' +
    '<label class="x-field">随机种子<input class="x-in x-seed" type="text" inputmode="numeric" spellcheck="false" autocomplete="off" aria-label="随机种子（非负整数），输入后按回车"></label>' +
    '<p class="x-msg" aria-live="polite"></p></div>' +
    '<div class="x-grid"><section class="x-box" aria-label="W 随 ρ 变化的曲线"><h3>平均驻留时间 W 随利用率 ρ 的变化（μ 固定）</h3><p class="x-read"></p>' +
    '<div class="x-svg x-wbox"><svg role="img"></svg></div><div class="x-key">' + key('<path class="x-cv" d="M1 6h18"/>', 20, 'W = 1/(μ−λ)') +
    key('<path class="x-base" d="M1 6h18"/>', 20, '1/μ：平均服务时间') + key('<circle class="x-pt" cx="7" cy="6" r="5"/>', 14, '当前 λ、μ') +
    key('<rect class="x-un" x="0" y="0" width="14" height="12"/>', 14, 'ρ ≥ 1：不稳定') + '</div><p class="x-note x-cnote"></p></section>' +
    '<section class="x-box" aria-label="M/M/1 公式"><h3>M/M/1 公式（代入当前值）</h3><div class="x-eqs"></div>' +
    '<p class="x-note">适用条件：到达是泊松过程（相邻到达间隔服从均值 1/λ 的指数分布），服务时间服从均值 1/μ 的指数分布，只有 1 个服务台，先到先服务（FIFO），队列不限长，并且 ρ < 1、系统已到稳态。W 是平均驻留时间（从到达到离开，含排队和服务），L 是平均在途数量（排队的加正在服务的）。Little 定律 L = λW 不依赖这些分布假设，只要求系统稳定、观察边界一致。</p></section></div>' +
    '<div class="x-bar">' +
    '<button class="x-btn" type="button" data-act="reset" aria-label="重置到第 0 步">重置</button>' +
    '<button class="x-btn" type="button" data-act="prev" aria-label="上一步">上一步</button>' +
    '<button class="x-btn x-pri" type="button" data-act="next" aria-label="下一步">下一步</button>' +
    '<button class="x-btn" type="button" data-act="play" aria-pressed="false" aria-label="自动播放">自动播放</button>' +
    '<span class="x-status" aria-live="polite"></span></div>' +
    '<section class="x-box x-say" aria-label="现在发生了什么"><h3>现在发生了什么</h3><p class="x-saytxt" aria-live="polite"></p></section>' +
    '<section class="x-box" aria-label="前 20 个请求的时间线"><h3>逐个请求：前 20 个（同一种子的 5000 个请求的开头）</h3>' +
    '<div class="x-svg x-tlbox"><svg role="img" aria-label="前 20 个请求的到达、排队、服务时间线，上方是系统内请求数 N(t)，数值见下表"></svg></div>' +
    '<div class="x-key">' + key('<circle class="x-arr" cx="7" cy="6" r="3.5"/>', 14, '到达') + key('<line class="x-wt" x1="1" y1="6" x2="19" y2="6"/>', 20, '排队等待') +
    key('<rect class="x-sv" x="1" y="2" width="18" height="8"/>', 20, '服务中') + key('<line class="x-now" x1="6" y1="0" x2="6" y2="12"/>', 12, '当前请求到达的时刻') + '</div>' +
    '<div class="x-scroll x-tbox" tabindex="0" role="region" aria-label="逐个请求的时刻表，可滚动"></div></section>' +
    '<section class="x-box" aria-label="跑完 5000 个请求"><h3>长期平均：跑完 5000 个请求</h3>' +
    '<p><button class="x-btn x-pri" type="button" data-act="run" aria-label="用当前 λ、μ 和种子跑完 5000 个请求">跑完 5000 个请求</button></p>' +
    '<div class="x-res" aria-live="polite"></div><div class="x-svg x-nbox" hidden><svg role="img" aria-label="5000 个请求跑下来，系统内请求数随时间的变化"></svg></div></section>';

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
    function $(c) { return root.querySelector('.' + P + c); }
    var el = { lr: $('lr'), ln: $('ln'), mr: $('mr'), mn: $('mn'), seed: $('seed'), msg: $('msg'), read: $('read'), wbox: $('wbox'), cnote: $('cnote'),
      eqs: $('eqs'), status: $('status'), say: $('saytxt'), tlbox: $('tlbox'), tbox: $('tbox'), res: $('res'), nbox: $('nbox'),
      prev: root.querySelector('[data-act=prev]'), next: root.querySelector('[data-act=next]'), play: root.querySelector('[data-act=play]') };
    var S = { lam: 8, mu: 10, seed: 1, s: 0, R: null, m: null, run: null, timer: null }, widths = {}, raf = 0;
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null, reduce = !!(mq && mq.matches);
    function setReduce() {
      if (reduce) { stop(); el.play.setAttribute('aria-disabled', 'true'); el.play.title = '系统开启了「减少动态效果」，自动播放已关闭'; }
      else { el.play.removeAttribute('aria-disabled'); el.play.removeAttribute('title'); }
    }
    function setMsg(t, err) { el.msg.textContent = t || ''; el.msg.className = X('x-msg' + (err ? ' x-err' : '')); }
    function stop() {
      if (S.timer) { clearInterval(S.timer); S.timer = null; }
      el.play.setAttribute('aria-pressed', 'false'); el.play.textContent = '自动播放'; el.play.setAttribute('aria-label', '自动播放');
    }
    function recompute() {
      stop();
      S.m = mm1(S.lam, S.mu); S.R = simulate(S.lam, S.mu, NSTEP, S.seed); S.s = 0;
      if (S.run) { S.run = null; setMsg('参数变了，「跑完 5000 个请求」的结果已清空，需要的话重新跑一次。'); }
      el.lr.value = S.lam; el.ln.value = fmt(S.lam); el.mr.value = S.mu; el.mn.value = fmt(S.mu); el.seed.value = S.seed;
      el.lr.setAttribute('aria-valuetext', 'λ = ' + fmt(S.lam) + ' 请求每秒'); el.mr.setAttribute('aria-valuetext', 'μ = ' + fmt(S.mu) + ' 请求每秒');
      root.querySelectorAll('[data-pre]').forEach(function (b) {
        var p = PRESETS[+b.getAttribute('data-pre')];
        b.setAttribute('aria-pressed', p[0] === S.lam && p[1] === S.mu ? 'true' : 'false');
      });
      render(true);
    }
    function svgInto(box, fn) {
      var Wd = Math.max(280, Math.round(box.clientWidth || 560)), g = fn(Wd), svg = box.querySelector('svg');
      svg.setAttribute('viewBox', '0 0 ' + Wd + ' ' + g.H); svg.setAttribute('width', Wd); svg.setAttribute('height', g.H);
      svg.innerHTML = X(g.svg); widths[box.className] = Wd;
    }
    function drawW() { svgInto(el.wbox, function (Wd) { return chartW(Wd, S.lam, S.mu, S.m); }); }
    function drawTL() { svgInto(el.tlbox, function (Wd) { return chartTL(Wd, S.R, S.s); }); }
    function drawN() { if (S.run) svgInto(el.nbox, function (Wd) { return chartN(Wd, S.run); }); }
    function tableHTML() {
      if (!S.s) return '<p class="x-note" style="margin:8px">还没有请求。按「下一步」，第 1 个请求就会出现在这里。</p>';
      var h = '<table class="x-tbl"><thead><tr><th scope="col">请求</th><th scope="col">到达 a</th><th scope="col">开始服务</th><th scope="col">离开 d</th>' +
        '<th scope="col">排队 Wq</th><th scope="col">驻留 W</th><th scope="col">到达时已有</th></tr></thead><tbody>';
      for (var i = 0; i < S.s; i++) {
        var r = S.R[i];
        h += '<tr' + (i === S.s - 1 ? ' class="x-cur"' : '') + '><td>#' + (i + 1) + '</td><td>' + t3(r.a) + '</td><td>' + t3(r.s) + '</td><td>' + t3(r.d) +
          '</td><td>' + t3(r.s - r.a) + '</td><td>' + t3(r.d - r.a) + '</td><td>' + r.q + '</td></tr>';
      }
      return h + '</tbody></table>';
    }
    function render(all) {
      var m = S.m, s = S.s, n = NSTEP;
      if (all) {
        el.read.innerHTML = m.stable ? '当前 ρ = <b>' + fmt(m.rho) + '</b>：W = <b>' + fmt(m.W) + ' s</b>，是服务时间 1/μ = ' + fmt(1 / S.mu) + ' s 的 ' + fmt(1 / (1 - m.rho)) + ' 倍。'
          : '当前 ρ = <b>' + fmt(m.rho) + '</b> ≥ 1：<b>不稳定：队列会无界增长</b>，W 没有稳态值。';
        el.wbox.querySelector('svg').setAttribute('aria-label', '平均驻留时间 W 随利用率 ρ 变化的曲线，μ = ' + fmt(S.mu) + '。' + el.read.textContent);
        el.cnote.textContent = '曲线是 W = (1/μ)/(1−ρ)，ρ 画到 0.98。μ 不变时，ρ = 0.5 时 W 是服务时间的 2 倍，0.8 时 5 倍，0.95 时 20 倍，0.98 时 50 倍：越靠近 1 涨得越陡。所以容量规划要给利用率留余量，不能长期跑在理论极限附近。';
        el.eqs.innerHTML = X(eqHTML(m, S.lam, S.mu));
        drawW();
        el.res.innerHTML = S.run ? X(runHTML(S.run)) : '<p class="x-note">用当前的 λ、μ 和种子模拟 5000 个请求，算出平均驻留时间 W、时间平均在途数 L，并核对 Little 定律。</p>';
        el.nbox.hidden = !S.run; drawN();
      }
      el.status.textContent = s === 0 ? '第 0 / ' + n + ' 步：还没开始，按「下一步」让第 1 个请求到达。' : '第 ' + s + ' / ' + n + ' 步：第 ' + s + ' 个请求' + (s === n ? '。前 20 个已经走完。' : '。');
      el.prev.setAttribute('aria-disabled', s === 0 ? 'true' : 'false');
      el.next.setAttribute('aria-disabled', s === n ? 'true' : 'false');
      el.say.textContent = sayStep(S.R, s, m, S.lam, S.mu);
      drawTL();
      el.tbox.innerHTML = X(tableHTML());
      var cur = el.tbox.querySelector('.' + P + 'cur');
      if (cur) {
        var top = cur.offsetTop - el.tbox.querySelector('thead').offsetHeight;
        if (top < el.tbox.scrollTop || cur.offsetTop + cur.offsetHeight > el.tbox.scrollTop + el.tbox.clientHeight) el.tbox.scrollTop = Math.max(0, top - 40);
      }
    }
    function go(s) { S.s = Math.max(0, Math.min(NSTEP, s)); render(false); }
    function play() {
      if (reduce) { setMsg('系统开启了「减少动态效果」，自动播放已关闭，请用「下一步」。'); return; }
      if (S.timer) { stop(); return; }
      if (S.s >= NSTEP) S.s = 0;
      el.play.setAttribute('aria-pressed', 'true'); el.play.textContent = '暂停'; el.play.setAttribute('aria-label', '暂停自动播放');
      S.timer = setInterval(function () { go(S.s + 1); if (S.s >= NSTEP) stop(); }, 900);
      render(false);
    }
    function runAll() {
      var R = simulate(S.lam, S.mu, NRUN, S.seed);
      S.run = { st: stats(R, NS), R: R, m: S.m, lam: S.lam, mu: S.mu, seed: S.seed };
      setMsg('');
      render(true);
      var st = S.run.st;
      el.say.textContent = '跑完了 ' + NRUN + ' 个请求（种子 ' + S.seed + '）：' + (S.m.stable ? '模拟的平均驻留时间 W = ' + fmt(st.W) + ' s，公式是 ' + fmt(S.m.W) +
        ' s；窗口内时间平均 L = ' + fmt(st.L) + '，(n/T) × W = ' + fmt(st.lw) + '，Little 定律对得上。' : '队列一直在变长，最后一个请求到达时系统里已有 ' + S.run.R[NRUN - 1].q + ' 个请求。') + '结果见下方。';
    }
    function setPar(k, v) {
      if (!isFinite(v) || v <= 0) { setMsg((k === 'lam' ? '到达率 λ' : '服务率 μ') + ' 要是正数，例如 8 或 9.5。', true); recompute(); return; }
      S[k] = Math.round(Math.min(100, Math.max(0.1, v)) * 1000) / 1000; setMsg(v > 100 || v < 0.1 ? '已限制在 0.1 到 100 之间。' : ''); recompute();
    }
    function onClick(e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || !root.contains(b)) return;
      var act = b.getAttribute('data-act'), pre = b.getAttribute('data-pre');
      if (pre !== null) { var p = PRESETS[+pre]; S.lam = p[0]; S.mu = p[1]; setMsg(''); recompute(); return; }
      if (act === 'next') { if (S.s < NSTEP) go(S.s + 1); }
      else if (act === 'prev') { stop(); go(S.s - 1); }
      else if (act === 'reset') { stop(); go(0); }
      else if (act === 'play') play();
      else if (act === 'run') runAll();
    }
    function onInput(e) {
      if (e.target === el.lr) { S.lam = +el.lr.value; setMsg(''); recompute(); }
      else if (e.target === el.mr) { S.mu = +el.mr.value; setMsg(''); recompute(); }
    }
    function onChange(e) {
      var t = e.target;
      if (t === el.ln) setPar('lam', num(t.value));
      else if (t === el.mn) setPar('mu', num(t.value));
      else if (t === el.seed) {
        var v = num(t.value);
        if (!(v >= 0 && v <= 4294967295 && Math.floor(v) === v)) { setMsg('种子要是 0 到 4294967295 之间的整数。', true); t.value = S.seed; return; }
        S.seed = v; setMsg(''); recompute();
      }
    }
    function onKey(e) {
      var tg = e.target, name = tg.tagName;
      if (name === 'INPUT' || name === 'SELECT' || name === 'TEXTAREA' || (tg.classList && tg.classList.contains(P + 'scroll'))) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); if (S.s < NSTEP) go(S.s + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); go(S.s - 1); }
    }
    function onMq() { reduce = mq.matches; setReduce(); }
    var ro = window.ResizeObserver ? new ResizeObserver(function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        [[el.wbox, drawW], [el.tlbox, drawTL], [el.nbox, drawN]].forEach(function (p) {
          var w = Math.max(280, Math.round(p[0].clientWidth || 560));
          if (p[0].clientWidth && widths[p[0].className] !== w) p[1]();
        });
      });
    }) : null;
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKey);
    if (mq && mq.addEventListener) mq.addEventListener('change', onMq);
    if (ro) { ro.observe(el.wbox); ro.observe(el.tlbox); ro.observe(el.nbox); }
    setReduce();
    recompute();

    return {
      destroy: function () {
        stop();
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        if (mq && mq.removeEventListener) mq.removeEventListener('change', onMq);
        root.removeEventListener('click', onClick);
        root.removeEventListener('input', onInput);
        root.removeEventListener('change', onChange);
        root.removeEventListener('keydown', onKey);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  /* ---------- 自测：期望值用手算和 Python 独立实现核对过 ---------- */
  function selfTest() {
    var det = [], ok = true;
    function ck(name, pass, got) { ok = ok && !!pass; det.push((pass ? '通过：' : '失败：') + name + (got !== undefined ? '（得到 ' + got + '）' : '')); }
    function near(a, b, t) { return Math.abs(a - b) <= (t == null ? 1e-9 : t); }
    function show(m) { return ['ρ', 'W', 'Wq', 'L', 'Lq'].map(function (k, i) { return k + '=' + fmt([m.rho, m.W, m.Wq, m.L, m.Lq][i]); }).join(' '); }
    var m = mm1(8, 10);
    ck('λ=8、μ=10 → ρ=0.8、W=0.5 s、Wq=0.4 s、L=4、Lq=3.2', m.stable && near(m.rho, 0.8) && near(m.W, 0.5) && near(m.Wq, 0.4) && near(m.L, 4) && near(m.Lq, 3.2), show(m));
    m = mm1(5, 10);
    ck('λ=5、μ=10（ρ=0.5）→ W=0.2 s、Wq=0.1 s、L=1、Lq=0.5', m.stable && near(m.rho, 0.5) && near(m.W, 0.2) && near(m.Wq, 0.1) && near(m.L, 1) && near(m.Lq, 0.5), show(m));
    var u1 = mm1(10, 10), u2 = mm1(11, 10);
    ck('λ=10、μ=10（ρ=1）和 λ=11、μ=10（ρ=1.1）判为不稳定，W、L 无穷', !u1.stable && !u2.stable && u1.W === Infinity && u1.L === Infinity && u2.W === Infinity, show(u1) + '；' + show(u2));
    ck('公式内部一致：L = λW、Lq = λWq、W = Wq + 1/μ（λ,μ = 3,7；9.5,10；0.2,0.25）', [[3, 7], [9.5, 10], [0.2, 0.25]].every(function (p) {
      var q = mm1(p[0], p[1]); return near(q.L, p[0] * q.W) && near(q.Lq, p[0] * q.Wq) && near(q.W, q.Wq + 1 / p[1]);
    }));
    var R = fifo([0, 1, 1.5, 5], [2, 1, 0.5, 1]), st = stats(R, 5);
    ck('手算 FIFO：到达 0,1,1.5,5，服务 2,1,0.5,1 → 开始 0,2,3,5，离开 2,3,3.5,6，到达时已有 0,1,2,0',
      JSON.stringify(R.map(function (r) { return [r.s, r.d, r.q]; })) === '[[0,2,0],[2,3,1],[3,3.5,2],[5,6,0]]', JSON.stringify(R.map(function (r) { return [r.s, r.d, r.q]; })));
    ck('手算窗口 [0,5]：N(t) 面积 1+1+1.5+2+0.5 = 6 → L = 1.2；n/T = 0.8、W = 1.75，(n/T)·W = 1.4（差的 1 s 是最后一个请求落在窗口外的驻留）',
      near(st.L, 1.2, 1e-12) && near(st.lh, 0.8, 1e-12) && near(st.W, 1.75, 1e-12) && st.end === 1, [st.L, st.lh, st.W].join('，'));
    ck('手算 N(t) 在 t = 0,1,2,3,4,5 的采样是 1,2,2,1,0,1（t = 2、3 正好有请求离开，取离开之后的值）', st.smp.join() === '1,2,2,1,0,1', st.smp.join(','));
    var g = mulberry32(1), v = [g(), g(), g()];
    ck('mulberry32(1) 前三个数与 Python 实现一致', v.join() === '0.6270739405881613,0.002735721180215478,0.5274470399599522', v.join(', '));
    var B = simulate(8, 10, 20000, 1), sb = stats(B, 10), e = sb.W / 0.5 - 1, fine = true;
    for (var i = 0; i < B.length; i++) if (B[i].s < B[i].a || (i && B[i].s !== Math.max(B[i].a, B[i - 1].d))) fine = false;
    ck('模拟 λ=8、μ=10、种子 1、20000 个请求：平均 W 在 0.5 s 的 ±15% 以内', Math.abs(e) <= 0.15, fmt(sb.W) + ' s，偏差 ' + pct(e));
    ck('同一次模拟：Little 定律 (n/T)·W 和时间平均 L 相差在 ±5% 以内', sb.rel <= 0.05, '(n/T)·W = ' + fmt(sb.lw) + '，L = ' + fmt(sb.L) + '，相差 ' + (sb.rel * 100).toFixed(3) + '%');
    ck('同一次模拟：时间平均 L 在公式值 4 的 ±15% 以内，且每个请求都满足开始 = max(到达, 上一个离开)', Math.abs(sb.L / 4 - 1) <= 0.15 && fine, fmt(sb.L));
    var U = simulate(11, 10, NRUN, 1), qs = [1250, 2500, 3750, 5000].map(function (k) { return U[k - 1].q; });
    ck('λ=11、μ=10 不稳定：第 1250、2500、3750、5000 个请求到达时，系统里的请求数越来越多', qs[0] < qs[1] && qs[1] < qs[2] && qs[2] < qs[3], qs.join(' < '));
    var a1 = simulate(8, 10, 50, 7), a2 = simulate(8, 10, 50, 7), a3 = simulate(8, 10, 50, 8);
    ck('同一种子结果完全相同，换种子结果不同；前 20 个请求就是长模拟的开头', JSON.stringify(a1) === JSON.stringify(a2) && a1[49].d !== a3[49].d &&
      JSON.stringify(simulate(8, 10, 20, 7)) === JSON.stringify(a1.slice(0, 20)));
    return { ok: ok, details: det };
  }

  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = {
    title: '排队与容量：利用率逼近 1 时延迟怎么变',
    mount: mount,
    selfTest: selfTest
  };
})();
