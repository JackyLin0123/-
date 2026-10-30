/* 交互演示 ai-gradient-descent：梯度下降，学习率决定你怎么下山。接口见 _build/SITE-SPEC.md 第 7.2 节。 */
(function () {
  'use strict';
  const ID = 'ai-gradient-descent', P = 'dm-' + ID + '-', BETA = 0.9, MAXK = 1000, HUMP = 0.30725;
  // 学习率滑块的停靠点：大致按对数均匀分布，在 0.05–0.1、0.9–1.2 这些分界线附近加密
  const ETAS = [0.001, 0.0015, 0.002, 0.003, 0.005, 0.007, 0.01, 0.015, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.095,
    0.1, 0.105, 0.11, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2];
  const LMIN = Math.log(0.001), LMAX = Math.log(1.2);

  // ---------- 损失函数（p 是坐标数组：一维 [w]，二维 [x, y]） ----------
  const FN = {
    quad: { dim: 1, xr: [-1, 7], yr: [0, 16], yt: [0, 4, 8, 12, 16], start: [0], mins: [[3, '最低点']],
      L: p => (p[0] - 3) * (p[0] - 3), g: p => [2 * (p[0] - 3)], hs: () => [2] },
    // (w² − 4)²/16 + 0.3w + 1：对称的双坑再加一点倾斜。驻点 −2.13585（全局最小）、0.30725（山顶）、1.82859（局部极小）
    quartic: { dim: 1, xr: [-3.2, 3.2], yr: [0, 4.5], yt: [0, 1, 2, 3, 4], start: [3], mins: [[-2.13585, '全局最小'], [1.82859, '局部极小']],
      L: ([w]) => w * w * w * w / 16 - w * w / 2 + 0.3 * w + 2, g: ([w]) => [w * w * w / 4 - w + 0.3], hs: ([w]) => [0.75 * w * w - 1] },
    bowl: { dim: 2, b: 1, start: [-4, 2] },
    valley: { dim: 2, b: 10, start: [-4, 1.5] }
  };
  for (const f of [FN.bowl, FN.valley]) { // L = x² + b·y²
    f.xr = [-5, 5]; f.yr = [-3, 3];
    f.L = p => p[0] * p[0] + f.b * p[1] * p[1];
    f.g = p => [2 * p[0], 2 * f.b * p[1]];
    f.hs = () => [2, 2 * f.b];
  }
  const NAMES = { quad: 'L = (w − 3)²（一个坑）', quartic: '四次函数（两个坑）', bowl: '圆碗 L = x² + y²', valley: '狭长山谷 L = x² + 10y²' };
  const FX = { quad: 'L(w) = (w − 3)<sup>2</sup>，L′(w) = 2(w − 3)', quartic: 'L(w) = w<sup>4</sup>/16 − w<sup>2</sup>/2 + 0.3w + 2，L′(w) = w<sup>3</sup>/4 − w + 0.3',
    bowl: 'L = x<sup>2</sup> + y<sup>2</sup>，∇L = (2x, 2y)', valley: 'L = x<sup>2</sup> + 10y<sup>2</sup>，∇L = (2x, 20y)' };

  // ---------- 核心计算（纯函数，不碰 DOM） ----------
  const init = (f, p) => ({ p: p.slice(), v: p.map(() => 0), g: null, L: f.L(p) });
  // 一步梯度下降。不开动量：p ← p − η·g；开动量（和 PyTorch 的 SGD 一样）：v ← β·v + g，p ← p − η·v。
  // 返回的 g 是这一步用到的梯度（在上一个点算的）。
  function stepOnce(f, s, eta, mom) {
    const g = f.g(s.p), v = g.map((gi, i) => mom ? BETA * s.v[i] + gi : gi), p = s.p.map((x, i) => x - eta * v[i]);
    return { p, v, g, L: f.L(p), e: eta, m: mom };
  }
  const nrm = a => Math.hypot(...a);
  // 停得住的坑底：每个方向的曲率 h > 0（山顶 h < 0），而且 η·h < 2（加动量时 < 2(1 + β)），否则偏一点就会被越甩越远；
  // 某个方向的梯度恰好是 0 时，那个方向不会再动
  const settled = (f, s) => { const G = f.g(s.p); return f.hs(s.p).every((h, i) => h > 0 && (s.e * h < (s.m ? 2 * (1 + BETA) : 2) || G[i] === 0)); };
  // '' 还能继续；'conv' 收敛（梯度 < 1e-3、这一步挪动 < 1e-4，而且停在 settled 的坑底）；'div' 发散；'max' 走满 MAXK 步
  function status(f, S) {
    const k = S.length - 1, s = S[k], big = Math.max(...s.p.map(Math.abs));
    if (!isFinite(s.L) || !(big <= 1e4) || s.L > 1e4 * Math.max(S[0].L, 1)) return 'div';
    if (k && nrm(f.g(s.p)) < 1e-3 && nrm(s.p.map((x, i) => x - S[k - 1].p[i])) < 1e-4 && settled(f, s)) return 'conv';
    return k >= MAXK ? 'max' : '';
  }
  function simulate(f, p0, eta, mom, n) {
    const S = [init(f, p0)];
    while (S.length <= n && !status(f, S)) S.push(stepOnce(f, S[S.length - 1], eta, mom));
    return S;
  }

  function selfTest() {
    const det = [], q = FN.quad, f4 = FN.quartic, va = FN.valley, near = (x, y, t = 1e-9) => Math.abs(x - y) <= t,
      ws = (S, n) => S.slice(0, n).map(s => +s.p[0].toFixed(6)).join(', '), end = S => S[S.length - 1].p[0];
    let ok = true, S, a, b;
    const ck = (name, pass, got) => { det.push((pass ? '通过' : '失败') + '：' + name + (got != null ? `（实际 ${got}）` : '')); ok = ok && pass; };
    S = simulate(q, [0], 0.1, false, 2);
    ck('L=(w−3)², w0=0, η=0.1 → w1=0.6, w2=1.08', near(S[1].p[0], 0.6) && near(S[2].p[0], 1.08), ws(S, 3));
    S = simulate(q, [0], 0.1, false, 25);
    ck('η=0.1 时 w−3 每步乘以 1−2η = 0.8', S.length === 26 && S.every((s, i) => !i || near((s.p[0] - 3) / (S[i - 1].p[0] - 3), 0.8)));
    S = simulate(q, [0], 1, false, 12);
    ck('η=1.0 → w 在 0 和 6 之间来回跳，L 一直是 9', S.length === 13 && !status(q, S) && S.every((s, i) => near(s.p[0], i % 2 ? 6 : 0) && near(s.L, 9)), ws(S, 6));
    S = simulate(q, [0], 1.1, false, MAXK);
    ck('η=1.1 → |w−3| 每步乘以 1.2（w1=6.6, w2=−1.32），判定发散', status(q, S) === 'div' && near(S[1].p[0], 6.6) && near(S[2].p[0], -1.32) &&
      S.every((s, i) => !i || near(Math.abs(s.p[0] - 3) / Math.abs(S[i - 1].p[0] - 3), 1.2)), ws(S, 4) + ` … 第 ${S.length - 1} 步判定发散`);
    S = simulate(q, [0], 0.5, false, 1);
    ck('η=0.5 → 一步到 w=3', near(S[1].p[0], 3), ws(S, 2));
    S = simulate(q, [0], 0.1, true, 2);
    ck('动量 β=0.9：v1=−6, w1=0.6；v2=0.9×(−6)+(−4.8)=−10.2, w2=1.62',
      near(S[1].v[0], -6) && near(S[1].p[0], 0.6) && near(S[2].v[0], -10.2) && near(S[2].p[0], 1.62), ws(S, 3));
    ck('四次函数的导数和数值差分一致', [-3, -1.2, 0.5, 2.7].every(w => near(f4.g([w])[0], (f4.L([w + 1e-5]) - f4.L([w - 1e-5])) / 2e-5, 1e-6)));
    ck('四次函数的驻点 −2.13585、0.30725、1.82859', [-2.13585, HUMP, 1.82859].every(w => Math.abs(f4.g([w])[0]) < 1e-4));
    a = simulate(f4, [3], 0.1, false, MAXK); b = simulate(f4, [3], 0.1, true, MAXK);
    ck('四次函数 w0=3、η=0.1：不加动量停在局部极小 1.8286，加动量越过山顶到全局最小 −2.1359',
      status(f4, a) === 'conv' && near(end(a), 1.82859, 1e-3) && status(f4, b) === 'conv' && near(end(b), -2.13585, 1e-3), end(a).toFixed(4) + ' / ' + end(b).toFixed(4));
    S = simulate(f4, [0.307], 0.1, false, MAXK);
    ck('四次函数从山顶旁 w0=0.307 出发（斜率只有 0.00023）：不会停在山顶，最后滚进左边的坑 −2.1359',
      S.length > 50 && status(f4, S) === 'conv' && near(end(S), -2.13585, 1e-3), `${S.length - 1} 步，停在 ${end(S).toFixed(4)}`);
    S = simulate(f4, [3.1], 1.2, false, MAXK);
    ck('四次函数 η=1.2、w0=3.1：左坑 η·L″ ≈ 2.9 > 2，偶尔落到坑底旁边也停不住，不判收敛', status(f4, S) === 'max', `${S.length - 1} 步，${status(f4, S)}`);
    S = simulate(va, [-4, 1.5], 0.09, false, 2);
    ck('山谷 η=0.09：x 每步乘 0.82，y 每步乘 −0.8（之字形）', near(S[1].p[0], -3.28) && near(S[1].p[1], -1.2) && near(S[2].p[0], -2.6896) && near(S[2].p[1], 0.96));
    a = simulate(va, [-4, 1.5], 0.01, false, MAXK); b = simulate(va, [-4, 1.5], 0.01, true, MAXK);
    ck('山谷 η=0.01：加动量收敛所需步数比不加少', status(va, a) === 'conv' && status(va, b) === 'conv' && b.length < a.length, `${a.length - 1} 步 vs ${b.length - 1} 步`);
    S = simulate(FN.bowl, [-4, 2], 0.1, false, 10);
    ck('圆碗 η=0.1：x、y 每步都乘 0.8，路线是指向中心的直线', near(S[1].p[0], -3.2) && S.every(s => near(s.p[1] / s.p[0], -0.5, 1e-12)));
    return { ok, details: det };
  }

  // ---------- 数字格式：一般保留 4 位小数；很小的数保留 2 位有效数字；很大或极小的数用 ×10ⁿ ----------
  function fmt(x, d) {
    if (!isFinite(x)) return isNaN(x) ? '—' : x > 0 ? '∞' : '−∞';
    const a = Math.abs(x) < 1e-12 ? 0 : Math.abs(x);
    if (!a) return '0';
    let t;
    if (a >= 1e5 || a < 1e-6 || d === 'e') {
      let e = Math.floor(Math.log10(a)), m = +(x / 10 ** e).toFixed(2);
      if (Math.abs(m) >= 10) { m /= 10; e++; }
      t = m + '×10' + [...String(e)].map(c => c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('');
    } else {
      t = d == null && a < 0.01 ? x.toPrecision(2) : x.toFixed(d ?? (a >= 1000 ? 1 : a >= 100 ? 2 : 4));
      if (t.includes('.')) t = t.replace(/0+$/, '').replace(/\.$/, '');
    }
    return t === '-0' ? '0' : t.replace('-', '−');
  }
  const pf = x => { const t = fmt(x); return t[0] === '−' ? '(' + t + ')' : t; };
  const r1 = v => Math.round(Math.max(-1e5, Math.min(1e5, v)) * 10) / 10;

  // ---------- 样式：类名都以 dm-ai-gradient-descent- 开头，颜色只用站点令牌 ----------
  const CSS = `.X-root{container-type:inline-size;font:15px/1.6 var(--font);color:var(--text)}
.X-root *{box-sizing:border-box}
.X-how{margin:0 0 10px;color:var(--text-2)}
.X-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin:0 0 10px}
.X-seg{display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden}
.X-seg button,.X-chip,.X-btn,.X-sel,.X-in{font:inherit;font-size:14px;color:var(--text-2);background:var(--surface);border:1px solid var(--border);cursor:pointer}
.X-seg button{border:0;margin:0;padding:5px 12px}
.X-seg button+button{border-left:1px solid var(--border)}
.X-seg button[aria-pressed=true],.X-chip[aria-pressed=true],.X-btn.X-pri{background:color-mix(in srgb,var(--c-ai) 14%,var(--surface));color:var(--text);font-weight:600}
.X-chip[aria-pressed=true],.X-btn.X-pri{border-color:var(--c-ai)}
.X-lbl,.X-chk{color:var(--text-2);font-size:14px}
.X-sel,.X-in{color:var(--text);border-radius:6px;padding:3px 6px;max-width:100%}
.X-in{width:4.4em;font-family:var(--mono);cursor:text}
.X-eta{display:flex;align-items:center;gap:8px;flex:1 1 260px;min-width:0}
.X-range{flex:1 1 auto;min-width:60px;accent-color:var(--c-ai)}
.X-chk{display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.X-chk input{accent-color:var(--c-ai);width:16px;height:16px;margin:0}
.X-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px}
.X-chip{font-size:13px;border-radius:999px;padding:2px 10px}
.X-chip:hover,.X-btn:hover:not(:disabled){background:var(--surface-2)}
.X-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start}
@container (min-width:700px){.X-grid{grid-template-columns:minmax(0,3fr) minmax(0,2fr)}}
.X-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;min-width:0}
.X-side{display:flex;flex-direction:column;gap:12px;min-width:0}
.X-read{font-size:14px;color:var(--text-2);margin-bottom:4px;font-variant-numeric:tabular-nums}
.X-read b{color:var(--text);font-weight:600}
.X-plot svg{display:block;width:100%;height:auto;cursor:crosshair;touch-action:manipulation}
.X-key{display:flex;flex-wrap:wrap;gap:2px 14px;font-size:12.5px;color:var(--text-3);margin-top:6px}
.X-key span{display:inline-flex;align-items:center;gap:5px}
.X-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.X-btn{color:var(--text);min-height:36px;padding:4px 14px;border-radius:8px}
.X-btn:disabled{opacity:.45;cursor:not-allowed}
.X-root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.X-h{font-size:13.5px;font-weight:600;color:var(--text-2);margin:0 0 6px;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}
.X-eqs{font:13px/1.75 var(--mono);overflow-wrap:anywhere}
.X-eqs span{display:inline-block;max-width:100%}
.X-eqs sup{line-height:0;font-size:.75em}
.X-fx{color:var(--text-3);font-size:12.5px;margin-bottom:4px}
.X-note{color:var(--text-3);font-size:12px;margin-top:4px}
.X-tag{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--text);background:var(--surface-2);border-radius:999px;padding:1px 9px 1px 7px}
.X-tag i{width:8px;height:8px;border-radius:50%;background:var(--c-ai)}
.X-tag[data-tone=good] i{background:var(--good)}
.X-tag[data-tone=warn] i{background:var(--warn)}
.X-tag[data-tone=bad] i{background:var(--div-pos)}
.X-exp{margin:0;font-size:14.5px;line-height:1.75}
.X-hint{margin:6px 0 0;font-size:13.5px;color:var(--text-3)}
.X-loss svg{display:block;width:100%;height:auto;touch-action:pan-y}
.X-tbl{margin-top:12px}
.X-tbl summary{cursor:pointer;color:var(--text-2);font-size:14px}
.X-tw{max-height:280px;overflow:auto;margin-top:6px;border:1px solid var(--border);border-radius:8px}
.X-tw table{border-collapse:collapse;width:100%;font:12.5px/1.5 var(--mono);font-variant-numeric:tabular-nums}
.X-tw th,.X-tw td{padding:2px 8px;text-align:right;border-bottom:1px solid var(--border);white-space:nowrap}
.X-tw th{position:sticky;top:0;background:var(--surface-2);font-family:var(--font);color:var(--text-2)}
.X-gl{stroke:var(--border)}
.X-ax{stroke:var(--edge-strong)}
.X-tk{fill:var(--text-3);font-size:11.5px}
.X-tt{fill:var(--text-2);font-size:12.5px;font-style:italic}
.X-curve{fill:none;stroke:var(--text-2);stroke-width:2}
.X-mk{fill:var(--surface);stroke:var(--text-2);stroke-width:1.5}
.X-mx{stroke:var(--text);stroke-width:1.75}
.X-ml,.X-halo{fill:var(--text-2);font-size:11.5px;paint-order:stroke;stroke:var(--surface);stroke-width:3px;stroke-linejoin:round}
.X-halo{font-size:12px}
.X-cbg{fill:var(--surface-2)}
.X-cf{fill:var(--surface);fill-opacity:.16;stroke:var(--edge)}
.X-cl{fill:var(--text-3);font-size:10.5px}
.X-frame{fill:none;stroke:var(--border)}
.X-trail,.X-cmp{fill:none;stroke:var(--c-ai);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.X-cmp{stroke:var(--text-3);stroke-width:1.75;stroke-dasharray:5 4}
.X-dot,.X-dot2,.X-kb,.X-ball circle{fill:var(--c-ai);stroke:var(--surface);stroke-width:1.5}
.X-dot2,.X-ball circle{stroke-width:2.5}
.X-cring{fill:var(--surface);stroke:var(--text-3);stroke-width:2}
.X-start{fill:var(--surface);stroke:var(--c-ai);stroke-width:2}
.X-ball{transition:transform .28s ease}
.X-tan{stroke:var(--div-pos);stroke-width:1.75;stroke-dasharray:6 4}
.X-arr{stroke:var(--text);stroke-width:1.75}
.X-arrh{fill:var(--text)}
.X-oarr{stroke:var(--c-ai);stroke-width:2.5}
.X-oarrh{fill:var(--c-ai)}
.X-hov{stroke:var(--text-3)}
.X-hit{fill:transparent}
@media (prefers-reduced-motion:reduce){.X-ball{transition:none!important}}`.replace(/\.X-/g, '.' + P);

  const TPL = `<p class="X-how">怎么玩：选一个典型场景，或拖动学习率（learning rate）η，再点「下一步」，看梯度下降（gradient descent）怎样一步步把小球带下山；「运行」会连续走，在图上点一下可以换起点。</p>
<div class="X-row"><div class="X-seg" role="group" aria-label="选择视图"><button type="button" data-v="1d" aria-label="一维视图：损失曲线">一维：损失曲线</button><button type="button" data-v="2d" aria-label="二维视图：等高线图">二维：等高线图</button></div>
<label class="X-lbl">函数 <select class="X-sel X-fn" aria-label="选择损失函数"></select></label></div>
<div class="X-row"><div class="X-eta"><span class="X-lbl">学习率 η</span><input class="X-range" type="range" min="0" max="1000" step="1" aria-label="学习率 η，对数刻度，0.001 到 1.2"><input class="X-in X-etain" type="text" inputmode="decimal" aria-label="学习率 η 的数值，输入后按回车"></div>
<label class="X-chk"><input type="checkbox" class="X-mom" aria-label="动量开关，β = 0.9">动量 β = 0.9</label>
<label class="X-chk"><input type="checkbox" class="X-cmpc" aria-label="同时画出对照路线"><span class="X-cmpt"></span></label>
<span class="X-lbl X-starts"></span></div>
<div class="X-chips" role="group" aria-label="典型场景"></div>
<div class="X-grid"><div class="X-card"><div class="X-read"></div>
<div class="X-plot"><svg class="X-svg" tabindex="0" role="img"><g class="X-st"></g><g class="X-dy"></g><g class="X-ball"><circle r="7"></circle></g><g class="X-ov"></g></svg></div>
<div class="X-key"></div><div class="X-btns"><button type="button" class="X-btn X-prev" aria-label="上一步">上一步</button><button type="button" class="X-btn X-pri X-next" aria-label="下一步">下一步</button><button type="button" class="X-btn X-run"></button><button type="button" class="X-btn X-reset" aria-label="重置，回到起点">重置</button></div></div>
<div class="X-side"><div class="X-card"><div class="X-h X-eqh"></div><div class="X-eqs"></div><div class="X-note">数值一般保留 4 位小数。</div></div>
<div class="X-card"><div class="X-h">现在发生了什么 <span class="X-tag"><i></i><span class="X-tagt"></span></span></div><p class="X-exp" aria-live="polite"></p><p class="X-hint"></p></div>
<div class="X-card"><div class="X-h">损失随步数的变化</div><div class="X-loss"><svg role="img" aria-label="损失随步数变化的折线图，具体数值见下方表格"></svg></div><div class="X-key X-lkey"></div></div></div></div>
<details class="X-tbl"><summary>全部步骤（表格）</summary><div class="X-tw"></div></details>`;

  // 典型场景：[id, 视图, 函数, η, 是否开动量, 按钮文字]
  const PRE = [['q1', '1d', 'quad', 0.01, 0, 'η = 0.01：太慢'], ['q2', '1d', 'quad', 0.1, 0, 'η = 0.1：正常'], ['q3', '1d', 'quad', 0.9, 0, 'η = 0.9：振荡'],
    ['q4', '1d', 'quad', 1, 0, 'η = 1：来回跳'], ['q5', '1d', 'quad', 1.1, 0, 'η = 1.1：发散'], ['x1', '1d', 'quartic', 0.1, 0, '卡在局部极小'],
    ['x2', '1d', 'quartic', 0.1, 1, '动量冲过山顶'], ['b1', '2d', 'bowl', 0.1, 0, '圆碗'], ['v1', '2d', 'valley', 0.09, 0, '山谷：之字形'],
    ['v2', '2d', 'valley', 0.01, 0, '山谷：η 小就很慢'], ['v3', '2d', 'valley', 0.01, 1, '山谷：加动量']];

  const ln = (x1, y1, x2, y2, c) => `<line class="${P + c}" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}"/>`;
  const tx = (x, y, s, c, a = 'start') => `<text class="${P + c}" x="${r1(x)}" y="${r1(y)}" text-anchor="${a}">${s}</text>`;
  const poly = (pts, c) => `<path class="${P + c}" d="${pts.map((q, j) => (j ? 'L' : 'M') + r1(q[0]) + ' ' + r1(q[1])).join('')}"/>`;
  const circ = (q, r, c) => `<circle class="${P + c}" cx="${r1(q[0])}" cy="${r1(q[1])}" r="${r}"/>`;
  function arrow(x1, y1, x2, y2, c = 'arr') {
    const a = Math.atan2(y2 - y1, x2 - x1), co = Math.cos(a), si = Math.sin(a), bx = x2 - 7 * co, by = y2 - 7 * si;
    return ln(x1, y1, bx, by, c) + `<path class="${P + c}h" d="M${r1(x2)} ${r1(y2)}L${r1(bx - 4 * si)} ${r1(by + 4 * co)}L${r1(bx + 4 * si)} ${r1(by - 4 * co)}Z"/>`;
  }
  // 坐标轴刻度：从 0 到不小于 max 的整齐数，大约 n 段
  function nice(max, n, int) {
    if (!(max > 0)) max = 1;
    const raw = max / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
    const step = Math.max(int ? 1 : 0, (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 && !int ? 2.5 : m <= 5 ? 5 : 10) * p);
    return Array.from({ length: Math.max(1, Math.ceil(max / step - 1e-9)) + 1 }, (_, i) => +(i * step).toPrecision(10));
  }

  function mount(container) {
    if (!document.getElementById('dm-style-' + ID)) {
      const sty = document.createElement('style'); sty.id = 'dm-style-' + ID; sty.textContent = CSS; document.head.appendChild(sty);
    }
    const root = document.createElement('div'), uid = 'dmgd' + Math.random().toString(36).slice(2, 8), offs = [];
    root.className = P + 'root'; root.innerHTML = TPL.replace(/X-/g, P); container.appendChild(root);
    const $ = c => root.querySelector('.' + P + c);
    const on = (el, t, fn) => { el.addEventListener(t, fn); offs.push(() => el.removeEventListener(t, fn)); };
    const [fnSel, range, etaIn, momC, cmpC, cmpT, startsEl, chipsEl, readEl, plotBox, svg, stG, dyG, ball, ovG, keyEl, prevB, nextB, runB, resetB,
      eqH, eqs, tagEl, tagT, expEl, hintEl, lossBox, lkey, tbl, tw] = ('fn range etain mom cmpc cmpt starts chips read plot svg st dy ball ov key prev next run ' +
      'reset eqh eqs tag tagt exp hint loss lkey tbl tw').split(' ').map($);
    const tabs = [...root.querySelectorAll(`.${P}seg button`)], lossSvg = lossBox.querySelector('svg');
    dyG.setAttribute('clip-path', `url(#${uid}c)`);
    const mq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
    let reduce = !!(mq && mq.matches), raf = 0, lastTbl = 0;
    const st = { view: '1d', fn1: 'quad', fn2: 'bowl', eta: 0.1, lastEta: 0.1, mom: false, cmp: false, preset: 'q2', S: null, other: null, timer: 0, running: false,
      start: { quad: [0], quartic: [3], bowl: [-4, 2], valley: [-4, 1.5] } };
    const key = () => st.view === '1d' ? st.fn1 : st.fn2, F = () => FN[key()];

    // ----- 控件同步 -----
    function setEta(v) {
      st.eta = v; range.value = Math.round((Math.log(v) - LMIN) / (LMAX - LMIN) * 1000); etaIn.value = String(v);
      range.setAttribute('aria-valuetext', 'η = ' + v);
    }
    const sw = (inner, w = 14) => `<svg width="${w}" height="12" aria-hidden="true">${inner}</svg>`;
    const line = c => sw(`<path class="${P + c}" d="M2 6h14"/>`, 18);
    function sync() {
      const two = st.view === '2d', k = key(), inp = (i, n) => `${n}<sub>0</sub> <input class="${P}in" data-i="${i}" inputmode="decimal" aria-label="起点 ${n}0">`;
      if (st.shown !== st.view) { // 只在切换视图时重建，避免正在操作的控件被替换掉
        st.shown = st.view;
        fnSel.innerHTML = (two ? ['bowl', 'valley'] : ['quad', 'quartic']).map(n => `<option value="${n}">${NAMES[n]}</option>`).join('');
        startsEl.innerHTML = '起点 ' + (two ? inp(0, 'x') + ' ' + inp(1, 'y') : inp(0, 'w'));
        chipsEl.innerHTML = `<span class="${P}lbl">典型场景</span>` + PRE.filter(r => r[1] === st.view)
          .map(r => `<button type="button" class="${P}chip" data-p="${r[0]}">${r[5]}</button>`).join('');
        svg.setAttribute('aria-label', (two ? '等高线图和小球的路线' : '损失曲线和小球的位置') + '。点击图可以设置起点，聚焦后可用方向键微调起点。');
      }
      tabs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.view)));
      chipsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === st.preset)));
      fnSel.value = k; momC.checked = st.mom; cmpC.checked = st.cmp;
      cmpT.textContent = '对照：' + (st.mom ? '不加动量' : '加动量');
      startsEl.querySelectorAll('input').forEach(el => { el.value = String(+st.start[k][el.dataset.i].toFixed(4)); });
      keyEl.innerHTML = `<span>${sw(`<circle class="${P}kb" cx="7" cy="6" r="5"/>`)}小球</span><span>${sw(`<circle class="${P}start" cx="7" cy="6" r="4"/>`)}起点</span>` +
        `<span>${line('trail')}走过的路</span>` + (two ? `<span>${sw(arrow(1, 6, 17, 6), 18)}最陡的下坡方向 −∇L</span><span>等高线：同一圈上损失相同，数字是 L</span>`
        : `<span>${line('tan')}切线，斜率就是 L′(w)</span>`) + (st.cmp ? `<span>${line('cmp')}${cmpT.textContent}</span>` : '');
      lkey.innerHTML = st.cmp ? `<span>${line('trail')}当前设置</span><span>${line('cmp')}${cmpT.textContent}</span>` : '';
      lkey.hidden = !st.cmp;
    }
    function reset() {
      stop();
      const f = F(), p0 = st.start[key()], o = simulate(f, p0, st.eta, !st.mom, MAXK);
      st.S = [init(f, p0)]; st.other = { S: o, stt: status(f, o) };
      render(true);
    }
    function change() { st.preset = ''; sync(); reset(); }

    // ----- 运行控制 -----
    function stop() { clearTimeout(st.timer); st.timer = 0; st.running = false; }
    const delay = k => k < 3 ? 600 : k < 10 ? 330 : k < 30 ? 150 : k < 100 ? 45 : 25;
    const push = () => st.S.push(stepOnce(F(), st.S[st.S.length - 1], st.eta, st.mom));
    function tick() {
      const f = F(), k = st.S.length - 1;
      for (let i = 0; i < (k < 100 ? 1 : k < 300 ? 3 : 8) && !status(f, st.S); i++) push();
      if (status(f, st.S)) stop();
      render(false, delay(k) >= 150);
      if (st.running) st.timer = setTimeout(tick, delay(st.S.length - 1));
    }

    // ----- 主图 -----
    function svgStatic(d, s, f) {
      let o = `<defs><clipPath id="${uid}c"><rect x="${d.ml}" y="${d.mt}" width="${s.pw}" height="${s.ph}"/></clipPath></defs>`;
      if (f.dim === 1) {
        const y0 = s.y(0), pth = [];
        f.yt.forEach(t => { o += ln(d.ml, s.y(t), d.W - d.mr, s.y(t), 'gl') + tx(d.ml - 9, s.y(t) + 4, fmt(t), 'tk', 'end'); });
        o += ln(d.ml, y0, d.W - d.mr, y0, 'ax');
        for (let t = Math.ceil(f.xr[0]); t <= f.xr[1]; t++) o += ln(s.x(t), y0, s.x(t), y0 + 4, 'ax') + tx(s.x(t), y0 + 16, fmt(t), 'tk', 'middle');
        o += tx(d.ml - 6, d.mt - 9, 'L(w)', 'tt', 'end') + tx(d.W - d.mr, y0 + 33, 'w', 'tt', 'end');
        for (let i = 0; i <= 240; i++) { const t = f.xr[0] + (f.xr[1] - f.xr[0]) * i / 240; pth.push([s.x(t), s.y(f.L([t]))]); }
        o += poly(pth, 'curve').replace('<path', `<path clip-path="url(#${uid}c)"`);
        f.mins.forEach(([w, name]) => {
          const x = s.x(w), y = s.y(f.L([w]));
          o += `<path class="${P}mk" d="M${r1(x)} ${r1(y - 5)}l5 5-5 5-5-5z"/>` + tx(x, y0 + 33, name, 'ml', 'middle');
        });
        return o;
      }
      // 等高线 x² + b·y² = c 取 c = (0.5k)²，是半轴为 0.5k 和 0.5k/√b 的椭圆；从外往里叠，越靠近中心底色越浅
      const cx = s.x(0), cy = s.y(0), kx = s.pw / 10, B = d.H - d.mb;
      o += `<rect class="${P}cbg" x="${d.ml}" y="${d.mt}" width="${s.pw}" height="${s.ph}"/><g clip-path="url(#${uid}c)">`;
      for (let i = f.b === 1 ? 12 : 19; i >= 1; i--) o += `<ellipse class="${P}cf" cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(0.5 * i * kx)}" ry="${r1(0.5 * i / Math.sqrt(f.b) * kx)}"/>`;
      for (let i = 1; i <= 4; i++) o += tx(s.x(i) + 3, cy - 4, i * i, 'cl');
      o += `</g><rect class="${P}frame" x="${d.ml}" y="${d.mt}" width="${s.pw}" height="${s.ph}"/>`;
      o += `<path class="${P}mx" d="M${r1(cx - 5)} ${r1(cy)}h10M${r1(cx)} ${r1(cy - 5)}v10"/>` + tx(cx, cy + 17, '最低点', 'ml', 'middle');
      for (let t = -4; t <= 4; t++) o += ln(s.x(t), B, s.x(t), B + 4, 'ax') + tx(s.x(t), B + 16, fmt(t), 'tk', 'middle');
      for (let t = -2; t <= 2; t++) o += ln(d.ml - 4, s.y(t), d.ml, s.y(t), 'ax') + tx(d.ml - 9, s.y(t) + 4, fmt(t), 'tk', 'end');
      return o + tx(d.W - d.mr, B + 16, 'x', 'tt', 'end') + tx(d.ml - 7, d.mt + 11, 'y', 'tt', 'end');
    }
    const pix = (f, s, q) => [s.x(q.p[0]), f.dim === 1 ? s.y(q.L) : s.y(q.p[1])];
    const inside = (f, q) => q.p[0] >= f.xr[0] && q.p[0] <= f.xr[1] && (f.dim === 1 ? q.L <= f.yr[1] * 1.02 : q.p[1] >= f.yr[0] && q.p[1] <= f.yr[1]);
    function svgDyn(s, f) {
      const S = st.S, k = S.length - 1, pts = S.map(q => pix(f, s, q));
      let o = '';
      if (st.cmp) {
        const O = st.other.S.slice(0, k + 1).map(q => pix(f, s, q));
        if (O.length > 1) o += poly(O, 'cmp');
        o += circ(O[O.length - 1], 5, 'cring');
      }
      if (k) o += poly(pts, 'trail');
      for (let i = Math.max(1, k - 60); i < k; i++) o += circ(pts[i], 3, 'dot');
      return o + circ(pts[0], 5, 'start');
    }
    function svgOver(d, s, f) {
      const c = st.S[st.S.length - 1], g = f.g(c.p), [cx, cy] = pix(f, s, c);
      if (!inside(f, c)) { // 小球出界：在图边上画一个指向它的箭头
        const bx = Math.min(d.W - d.mr - 6, Math.max(d.ml + 6, cx)), by = Math.min(d.H - d.mb - 6, Math.max(d.mt + 6, cy)),
          n = Math.hypot(cx - bx, cy - by) || 1;
        return arrow(bx - 24 * (cx - bx) / n, by - 24 * (cy - by) / n, bx, by, 'oarr');
      }
      if (f.dim === 2) { const n = nrm(g); return n > 1e-9 ? arrow(cx, cy, cx - g[0] / n * 34, cy + g[1] / n * 34) : ''; }
      // 一维：在小球处画切线，并标出斜率
      const dy = -g[0] * (s.ph / (f.yr[1] - f.yr[0])) / (s.pw / (f.xr[1] - f.xr[0])), n = Math.hypot(1, dy), ux = 60 / n, uy = dy * 60 / n,
        ex = uy < 0 ? cx + ux : cx - ux, lab = '斜率 ' + fmt(g[0], 2), wd = lab.length * 7 + 6;
      let a = ex >= cx ? 'start' : 'end', lx = a === 'start' ? ex + 5 : ex - 5;
      if (a === 'start' && lx + wd > d.W - d.mr) { a = 'end'; lx = Math.min(ex - 5, d.W - d.mr); }
      if (a === 'end' && lx - wd < d.ml) { a = 'start'; lx = Math.max(ex + 5, d.ml + 2); }
      return ln(cx - ux, cy - uy, cx + ux, cy + uy, 'tan').replace('<line', `<line clip-path="url(#${uid}c)"`) + tx(lx, Math.max(d.mt + 10, Math.min(d.H - d.mb - 6, cy - Math.abs(uy) - 4)), lab, 'halo', a);
    }
    function drawMain(full, anim) {
      const f = F(), W = Math.max(260, Math.round(plotBox.clientWidth || 600));
      let d = st.d;
      if (full || !d || d.W !== W || d.kk !== key()) {
        d = f.dim === 1 ? { W, H: Math.round(Math.min(380, Math.max(230, W * 0.62))), ml: 40, mr: 14, mt: 24, mb: 40 } : { W, ml: 32, mr: 12, mt: 10, mb: 26 };
        if (f.dim === 2) d.H = Math.round((W - 44) * 0.6) + 36;
        d.kk = key();
        const pw = d.W - d.ml - d.mr, ph = d.H - d.mt - d.mb;
        st.d = d; st.s = { pw, ph, x: v => d.ml + (v - f.xr[0]) / (f.xr[1] - f.xr[0]) * pw, y: v => d.mt + ph - (v - f.yr[0]) / (f.yr[1] - f.yr[0]) * ph };
        svg.setAttribute('viewBox', `0 0 ${d.W} ${d.H}`); svg.setAttribute('width', d.W); svg.setAttribute('height', d.H);
        stG.innerHTML = svgStatic(d, st.s, f); anim = false;
      }
      const s = st.s, c = st.S[st.S.length - 1], cp = pix(f, s, c);
      dyG.innerHTML = svgDyn(s, f); ovG.innerHTML = svgOver(d, s, f);
      ball.style.transition = anim && !reduce ? '' : 'none';
      ball.style.transform = `translate(${r1(cp[0])}px,${r1(cp[1])}px)`;
      ball.style.opacity = inside(f, c) ? '1' : '0';
    }

    // ----- 损失折线图 -----
    function drawLoss() {
      const W = Math.max(220, Math.round(lossBox.clientWidth || 300)), H = 150, ml = 50, mr = 12, mt = 12, pw = W - ml - mr, ph = H - mt - 24, S = st.S, k = S.length - 1;
      const yt = nice(Math.max(...S.map(q => isFinite(q.L) ? q.L : 0)), 3), ytop = yt[yt.length - 1], xt = nice(Math.max(10, k), 4, true), xtop = xt[xt.length - 1];
      const X = v => ml + v / xtop * pw, Y = v => mt + ph - Math.min(v, ytop * 50) / ytop * ph;
      let o = `<defs><clipPath id="${uid}l"><rect x="${ml}" y="${mt - 3}" width="${pw + 3}" height="${ph + 6}"/></clipPath></defs>`;
      yt.forEach(t => { o += ln(ml, Y(t), W - mr, Y(t), 'gl') + tx(ml - 6, Y(t) + 4, ytop >= 1e4 && t ? fmt(t, 'e') : fmt(t, 2), 'tk', 'end'); });
      xt.forEach(t => { o += ln(X(t), mt + ph, X(t), mt + ph + 4, 'ax') + tx(X(t), H - 6, t, 'tk', 'middle'); });
      o += ln(ml, mt + ph, W - mr, mt + ph, 'ax') + `<g clip-path="url(#${uid}l)">`;
      if (st.cmp && k) o += poly(st.other.S.slice(0, k + 1).map((q, j) => [X(j), Y(q.L)]), 'cmp');
      if (k) o += poly(S.map((q, j) => [X(j), Y(q.L)]), 'trail');
      o += `</g>${circ([X(k), Y(S[k].L)], 4, 'dot2')}<g class="${P}hv"></g><rect class="${P}hit" x="${ml}" y="${mt}" width="${pw}" height="${ph}"/>`;
      lossSvg.setAttribute('viewBox', `0 0 ${W} ${H}`); lossSvg.setAttribute('width', W); lossSvg.setAttribute('height', H);
      lossSvg.innerHTML = o;
      st.lg = { X, Y, xtop, ml, mr, pw, mt, ph, W };
    }
    function hover(ev) {
      const G = st.lg, hv = lossSvg.querySelector(`.${P}hv`);
      if (!G || !hv) return;
      const r = lossSvg.getBoundingClientRect(), i = Math.round(((ev.clientX - r.left) * G.W / r.width - G.ml) / G.pw * G.xtop);
      if (i < 0 || i >= st.S.length) { hv.innerHTML = ''; return; }
      const x = G.X(i), L = st.S[i].L, left = x < G.ml + G.pw / 2;
      hv.innerHTML = ln(x, G.mt, x, G.mt + G.ph, 'hov') + circ([x, G.Y(L)], 4, 'dot2') +
        tx(left ? G.W - G.mr - 4 : G.ml + 6, G.mt + 12, `第 ${i} 步：L = ${fmt(L)}`, 'halo', left ? 'end' : 'start');
    }

    // ----- 「这一步怎么算」：k = 0 时预告第 1 步 -----
    function eqLines() {
      const kk = key(), f = FN[kk], S = st.S, k = S.length - 1, n = k || 1, a = S[n - 1], b = k ? S[k] : stepOnce(f, a, st.eta, st.mom),
        E = fmt(st.eta), mom = st.mom, i0 = `<sub>${n - 1}</sub>`, i1 = `<sub>${n}</sub>`;
      let o = '';
      const row = (l, r) => { o += `<div><span>${l}</span> <span>${r}</span></div>`; };
      if (f.dim === 1) {
        const w = a.p[0], g = b.g[0], Wn = 'w' + i0;
        row(`L′(${Wn})`, kk === 'quad' ? `= 2 × (${fmt(w)} − 3) = ${fmt(g)}` : `= ${pf(w)}<sup>3</sup>/4 − ${pf(w)} + 0.3 = ${fmt(g)}`);
        if (mom) {
          row(`v${i1} = β·v${i0} + L′(${Wn})`, `= 0.9 × ${pf(a.v[0])} + ${pf(g)} = ${fmt(b.v[0])}`);
          row(`w${i1} = ${Wn} − η·v${i1}`, `= ${fmt(w)} − ${E} × ${pf(b.v[0])} = ${fmt(b.p[0])}`);
        } else row(`w${i1} = ${Wn} − η·L′(${Wn})`, `= ${fmt(w)} − ${E} × ${pf(g)} = ${fmt(b.p[0])}`);
        row(`L(w${i1})`, kk === 'quad' ? `= (${fmt(b.p[0])} − 3)<sup>2</sup> = ${fmt(b.L)}` : '= ' + fmt(b.L));
        return o;
      }
      const c = f.b === 10 ? '20' : '2', nm = ['x', 'y'];
      nm.forEach((v, j) => row(`∂L/∂${v} = ${j ? c : 2}${v}${i0}`, `= ${j ? c : 2} × ${pf(a.p[j])} = ${fmt(b.g[j])}`));
      if (mom) nm.forEach((v, j) => row(`v<sub>${v}</sub> ← 0.9·v<sub>${v}</sub> + ∂L/∂${v}`, `= 0.9 × ${pf(a.v[j])} + ${pf(b.g[j])} = ${fmt(b.v[j])}`));
      nm.forEach((v, j) => row(`${v}${i1} = ${v}${i0} − η·${mom ? `v<sub>${v}</sub>` : '∂L/∂' + v}`, `= ${fmt(a.p[j])} − ${E} × ${pf(mom ? b.v[j] : b.g[j])} = ${fmt(b.p[j])}`));
      row(`L = x${i1}<sup>2</sup> + ${f.b === 10 ? 10 : ''}y${i1}<sup>2</sup>`, '= ' + fmt(b.L));
      return o;
    }

    // ----- 「现在发生了什么」：返回 [语气, 标签, 说明, 提示] -----
    const T = (tone, tag, txt, hint = '') => [tone, tag, txt, hint];
    const dir = d => d > 0 ? '右' : '左';
    const remain = (e, r) => { e = Math.abs(e); r = Math.abs(r); return e > 0.01 && r > 0 && r < 1 ? Math.ceil(Math.log(0.01 / e) / Math.log(r)) : 0; };
    function cmpS() {
      const o = st.other, n = o.S.length - 1;
      return '同样的 η 和起点，' + (st.mom ? '不加动量' : '加动量') + (o.stt === 'conv' ? `要 ${n} 步收敛${key() === 'quartic' ? '，停在 w ≈ ' + fmt(o.S[n].p[0], 2) : ''}。`
        : o.stt === 'div' ? '会发散。' : `走 ${MAXK} 步也收敛不了。`);
    }
    const slower = k => st.mom && st.other.stt === 'conv' && st.other.S.length - 1 < k && key() !== 'quartic'
      ? '这次加动量反而更慢：β = 0.9 的惯性很大，η 较大时会冲过头再折回来；η 小的时候（比如 0.01），动量的好处才明显。' : '';
    const START = w => `速度从 0 起步，第一步和不加动量一样远；之后速度会把每一步的${w}打折累加起来。`;
    function momPhr(base, k, w, wp, m, mname, g, v, vp) {
      if (k === 1) return T('info', '起步', base + START('斜率'));
      if ((wp - m) * (w - m) < 0) return T('warn', '冲过头', base + `小球冲过了${mname}：现在斜率反过来往回拉，可速度里还存着往${dir(w - wp)}的惯性，要先把它抵消掉，小球才会折回来。`);
      if (v * g < 0) return T('warn', '减速', base + `惯性带着小球往上坡走，斜率在往回拉，速度从 ${fmt(Math.abs(vp))} 降到 ${fmt(Math.abs(v))}。`);
      if (v * vp < 0) return T('info', '掉头', base + '速度变了号：小球掉头往回走，朝坑底重新加速。');
      if (Math.abs(v) > Math.abs(vp)) return T('good', '加速', base + `一直在下坡，速度越攒越大：从 ${fmt(Math.abs(vp))} 涨到 ${fmt(Math.abs(v))}。`);
      return T('info', '惯性滑行', base + `还在下坡，可新加的斜率 ${fmt(Math.abs(g))} 比惯性打九折损失的 0.1 × ${fmt(Math.abs(vp))} = ${fmt(0.1 * Math.abs(vp))} 小，所以速度从 ${fmt(Math.abs(vp))} 降到 ${fmt(Math.abs(v))}。`);
    }
    function explain() {
      const kk = key(), f = FN[kk], S = st.S, k = S.length - 1, s = S[k], eta = st.eta, E = fmt(eta), mom = st.mom, ss = status(f, S),
        two = f.dim === 2, cs = mom || st.cmp ? cmpS() : '', r = 1 - 2 * eta, mx = ss === 'max' ? `已经走满 ${MAXK} 步。` : '';
      if (!k) {
        const g0 = f.g(s.p), gw = two ? '梯度' : '斜率', MI = `开了动量（momentum）：每步先更新速度 v ← 0.9·v + ${two ? '∇L' : 'L′(w)'}，再走 ${two ? '(x, y) ← (x, y)' : 'w ← w'} − η·v。` +
          `速度是各步${gw}打折后的累加：这一步的${gw}算 1 份，上一步算 0.9 份，再往前算 0.81 份……一直下坡就会越走越快。`;
        if (nrm(g0) < 1e-12) return T('info', '没有坡', `小球所在位置的${gw}为 0，梯度下降一步也不会动。` + (kk === 'quartic' && Math.abs(s.p[0] - HUMP) < 0.01
          ? '这里是山顶：斜率为 0 的点叫驻点（stationary point），它可能是坑底，也可能是山顶。' : '') + '在图上点别处换个起点。');
        let t;
        if (!two) {
          t = `小球在 w = ${fmt(s.p[0])}，损失 L = ${fmt(s.L)}。这里斜率 L′ = ${fmt(g0[0])}，是${g0[0] < 0 ? '负数，说明往右走损失会变小，所以 w 会往右' : '正数，说明往左走损失会变小，所以 w 会往左'}挪。`;
          if (kk === 'quartic') t += '这条曲线有两个坑：左边 w ≈ −2.14 更低（L ≈ 0.38），右边 w ≈ 1.83 浅一些（L ≈ 1.58），中间 w ≈ 0.31 是个小山顶。';
          else if (!mom) t += `把公式代进去：新的 w − 3 = (w − 3) − η·2(w − 3) = (1 − 2η)(w − 3)。现在 1 − 2η = ${fmt(r)}，也就是每走一步，w 到 3 的差都乘以 ${fmt(r)}。`;
          return T('info', '准备出发', t + (mom ? MI : ''), kk === 'quartic' ? '点「下一步」，看小球会掉进哪个坑。' : '点「下一步」，对照上面的算式看 w 怎么变。');
        }
        t = `小球在 (${fmt(s.p[0])}, ${fmt(s.p[1])})，损失 L = ${fmt(s.L)}。梯度（gradient）∇L = (${fmt(g0[0])}, ${fmt(g0[1])})，图上的小箭头是 −∇L，也就是最陡的下坡方向，它总是垂直于等高线（contour）。`;
        t += kk === 'valley' ? '离谷底同样远时，y 方向的坡是 x 方向的 10 倍（∂L/∂y = 20y，∂L/∂x = 2x），所以 −∇L 主要指向横穿山谷的方向，没有对准中心。' + (mom ? '' : `每走一步，x 乘以 1 − 2η = ${fmt(r)}，y 乘以 1 − 20η = ${fmt(1 - 20 * eta)}。`)
          : '在圆碗里，−∇L 正好指向中心。' + (mom ? '' : `每走一步，x 和 y 都乘以 1 − 2η = ${fmt(r)}。`);
        return T('info', '准备出发', t + (mom ? MI : ''));
      }
      const q = S[k - 1];
      if (!two) {
        const w = s.p[0], wp = q.p[0], d = w - wp, g = s.g[0];
        const base = mx + `在 w = ${fmt(wp)} 处斜率 L′ = ${fmt(g)}，` + (!d ? '这一步 w 没有动。' : mom ? `速度 v = 0.9 × ${pf(q.v[0])} + ${pf(g)} = ${fmt(s.v[0])}，这一步 w 往${dir(d)}走了 η·|v| = ${fmt(Math.abs(d))}（不加动量是 ${fmt(Math.abs(eta * g))}）。`
          : `所以这一步 w 往${dir(d)}走了 η·|L′| = ${fmt(Math.abs(d))}。`);
        if (kk === 'quad') {
          const e = w - 3, chg = `w − 3 从 ${fmt(wp - 3)} 变成 ${fmt(e)}，乘了 ${fmt(r)}。`;
          if (ss === 'conv') return T('good', '已收敛', `收敛（converge）了：走了 ${k} 步，w = ${fmt(w)}，斜率只剩 ${fmt(f.g(s.p)[0])}，再走也几乎不动。` + cs + slower(k),
            mom ? '' : '想看步子太大会怎样？试试 η = 0.9、1、1.1。');
          if (ss === 'div') return T('bad', '发散', `发散了：走了 ${k} 步，w 已经跑到 ${fmt(w)}，损失 ${fmt(s.L)}。` + (mom ? cs : 'η > 1 时 |1 − 2η| > 1，w 到 3 的差每步都被放大。'),
            '试试 η = 0.5：1 − 2η = 0，一步就到 3。');
          if (mom) return momPhr(base, k, w, wp, 3, '最低点 3', g, s.v[0], q.v[0]);
          if (eta < 0.05) {
            const m = remain(e, r);
            return T('warn', '太慢', base + chg + `η = ${E} 太小，每步只缩小 ${fmt((1 - r) * 100, 1)}%` + (m ? `：照这样还要大约 ${m} 步，w 才能离 3 不到 0.01。` : '。'), '试试 η = 0.1。');
          }
          if (eta < 0.5) return T('good', '稳步下山', base + chg + '越接近 3，斜率越小，步子也越小：w 一步步逼近 3，不会跳过去。');
          if (eta === 0.5) return T('good', '一步到位', base + '1 − 2η = 0，一步就正好落到 w = 3。η 再大一点就会跳过 3。');
          if (eta < 1) return T('warn', '振荡收敛', base + 'w 跳过了最低点 3：' + chg + `乘数是负的，所以每步换一边；它的绝对值 ${fmt(-r)} 小于 1，所以越摆越小，最后还是收敛到 3。`);
          if (eta === 1) return T('bad', '来回跳', base + chg + `每一步都跳到 3 另一边同样远的地方：w 在 ${fmt(S[0].p[0])} 和 ${fmt(6 - S[0].p[0])} 之间来回跳，损失一直是 ${fmt(S[0].L)}，永远到不了 3。`,
            '把 η 调到 1.1，看看再大一点会怎样。');
          return T('bad', '发散', base + chg + `绝对值大于 1：每一步都跳过 3，而且落点更远，损失从 ${fmt(q.L)} 涨到 ${fmt(s.L)}。这就是发散（diverge）。`);
        }
        const left = w < HUMP, mn = left ? -2.13585 : 1.82859, h = left ? 2.4214 : 1.5078, eh = eta * h, M = fmt(mn, 2), side = left ? '左' : '右';
        if (ss === 'conv') return left ? T('good', '全局最小', '停在了 w ≈ −2.14，这是整条曲线的最低点（全局最小值，global minimum），L ≈ 0.38。' + cs +
            (mom && S[0].p[0] > HUMP ? '动量帮它冲过了山顶，但不是每次都灵：比如从 w = 2 出发，加了动量也还是停在右边的坑。' : ''))
          : T('warn', '局部极小', '停在了 w ≈ 1.83 的坑底，L ≈ 1.58。这里斜率为 0，梯度下降不会再动，可左边 w ≈ −2.14 的坑更低（L ≈ 0.38）。' +
            '梯度只看脚下哪边低，看不到远处的坑，这就是卡在局部极小值（local minimum）。' + cs, mom ? '' : '打开动量再跑一次，或者在图上点左边换个起点。');
        if (ss === 'div') return T('bad', '发散', `被甩出去了：四次函数越往外坡越陡，一步迈大了，下一步的斜率更大、步子更大，w 已经到了 ${fmt(w)}。`, '把 η 调小一些再试。');
        if ((wp - HUMP) * (w - HUMP) < 0) return T('info', '越过山顶', base + `小球越过了 w ≈ 0.31 的山顶，进了${side}边的坑。`);
        if (Math.abs(w - HUMP) < 0.05 && (!mom || Math.abs(s.v[0]) < 0.05)) return !d
          ? T('warn', '停在山顶', base + '斜率为 0，每步都走 η × 0 = 0，小球停在山顶不动。斜率为 0 的点叫驻点（stationary point），它可能是坑底，也可能是山顶；只要起点偏一点点，小球就会滚下去。')
          : T('info', '山顶附近', base + `小球在山顶 w ≈ 0.31 附近，这里几乎是平的，所以步子很小。山顶的斜率也是 0，却不是最低点：离山顶越远坡越陡，步子会越来越大，小球会往${side}边滚下去。`);
        if (mom) return momPhr(base, k, w, wp, mn, '坑底 w ≈ ' + M, g, s.v[0], q.v[0]);
        if ((wp - mn) * (w - mn) < 0) return eh < 1 ? T('info', '越过坑底', base + `这一步迈得稍大，越过了坑底 w ≈ ${M}，接下来会从另一侧慢慢靠近。`)
          : T(eh > 2 ? 'bad' : 'warn', eh > 2 ? '停不下来' : '振荡', base + `跳过了坑底 w ≈ ${M}。坑底的弯曲程度（二阶导数）L″ ≈ ${fmt(h, 2)}，η × L″ = ${fmt(eh, 2)}` +
            (eh > 2 ? '，大于 2：在坑底附近每一步都跳过头，停不下来。' : '，在 1 和 2 之间：会在坑底两边来回摆，越摆越小。'));
        if (eta < 0.05) return T('warn', '太慢', base + `η = ${E} 太小，每步只挪这么一点，要很多步才能到坑底。`);
        const gn = f.g(s.p)[0];
        return T('good', '下坡中', base + (Math.abs(gn) > Math.abs(g) ? `这一段坡越来越陡：新位置的斜率是 ${fmt(gn)}，比这一步用的 ${fmt(g)} 更陡，下一步会迈得更大（步长 = η × |斜率|）。`
          : `离坑底 w ≈ ${M} 越近，斜率越小，步子也跟着变小。`));
      }
      // 二维
      const [x, y] = s.p, [qx, qy] = q.p, dx = x - qx, g2 = s.g, vy = kk === 'valley', at = `(${fmt(x)}, ${fmt(y)})`;
      const b2 = mx + `在 (${fmt(qx)}, ${fmt(qy)}) 处梯度 ∇L = (${fmt(g2[0])}, ${fmt(g2[1])})，` +
        (mom ? `速度 v = 0.9·v + ∇L = (${fmt(s.v[0])}, ${fmt(s.v[1])})，这一步走了 −η·v` : '这一步走了 −η∇L') + ` = (${fmt(dx)}, ${fmt(y - qy)})。`;
      if (ss === 'conv') return T('good', '已收敛', `收敛（converge）了：走了 ${k} 步，到了 ${at}，梯度几乎为 0。` + cs + slower(k),
        vy && !mom ? (eta < 0.05 ? '打开动量，看同样的 η 能快多少。' : '把 η 调到 0.01 再跑，然后打开动量对比。') : '');
      if (ss === 'div') return T('bad', '发散', `发散了：走了 ${k} 步，小球跑到 ${at}，损失 ${fmt(s.L)}。` + (mom ? cs : vy
        ? `y 方向每步乘以 1 − 20η = ${fmt(1 - 20 * eta)}，绝对值大于 1。越陡的方向能承受的 η 越小，这个山谷里 η 必须小于 0.1。` : `x 和 y 每步都乘以 1 − 2η = ${fmt(r)}，绝对值大于 1。`),
        vy ? '把 η 调到 0.09 看之字形。' : '');
      if (mom) {
        if (k === 1) return T('info', '起步', b2 + START('梯度'));
        if (vy ? qx * x < 0 : qx * x + qy * y < 0) return T('warn', '冲过头', b2 + '冲过了中心：惯性还没耗完，要先被梯度抵消掉，小球才会折回来。');
        if (vy && s.v[0] * g2[0] > 0 && Math.abs(s.v[0]) > Math.max(1.5 * Math.abs(g2[0]), Math.abs(q.v[0])))
          return T('good', '越走越快', b2 + `x 方向的梯度连续几步都朝同一边，速度越攒越大：这一步 x 挪了 ${fmt(Math.abs(dx))}，不加动量只会挪 ${fmt(Math.abs(eta * g2[0]))}。`);
        if (vy && qy * y < 0) return T('info', '横向摆动', b2 + 'y 方向冲过了谷底，惯性让小球在两侧山壁之间来回晃。');
        if (s.v[0] * g2[0] + s.v[1] * g2[1] < 0) return T('warn', '减速', b2 + '惯性带着小球往上坡走，梯度在往回拉，速度在变小。');
        const sp = nrm(q.v), sn = nrm(s.v);
        if (s.v[0] * q.v[0] + s.v[1] * q.v[1] < 0) return T('info', '掉头', b2 + '速度方向反过来了：梯度压过了惯性，小球掉头往回走。');
        return sn > sp ? T('good', '加速', b2 + `一直在下坡，速度越攒越大：大小从 ${fmt(sp)} 涨到 ${fmt(sn)}。`)
          : T('info', '惯性滑行', b2 + `还在下坡，可惯性每步先打九折，新加的梯度没能把速度补回来：大小从 ${fmt(sp)} 降到 ${fmt(sn)}。`);
      }
      if (!vy) {
        const dist = Math.hypot(x, y), chg = `到中心的距离从 ${fmt(Math.hypot(qx, qy))} 变成 ${fmt(dist)}。`, m = remain(dist, r);
        if (eta < 0.05) return T('warn', '太慢', b2 + chg + `x 和 y 每步只乘以 ${fmt(r)}，η 太小` + (m ? `，还要大约 ${m} 步才能离中心不到 0.01。` : '。'), '试试 η = 0.1。');
        if (eta < 0.5) return T('good', '直奔中心', b2 + chg + `x 和 y 都乘了 ${fmt(r)}，方向不变，所以路线是一条指向中心的直线。`);
        if (eta === 0.5) return T('good', '一步到位', b2 + '1 − 2η = 0，一步就到了中心。');
        if (eta < 1) return T('warn', '振荡收敛', b2 + `跳过中心到了对面：x 和 y 都乘了 ${fmt(r)}。` + chg + '每步换一边，但越来越近。');
        if (eta === 1) return T('bad', '来回跳', b2 + `x 和 y 都乘了 −1：小球在 (${fmt(S[0].p[0])}, ${fmt(S[0].p[1])}) 和 (${fmt(-S[0].p[0])}, ${fmt(-S[0].p[1])}) 之间来回跳，永远到不了中心。`);
        return T('bad', '发散', b2 + chg + `x 和 y 都乘了 ${fmt(r)}，绝对值大于 1，越跳越远。`);
      }
      const ry = 1 - 20 * eta, m = remain(x, r);
      if (eta > 0.1) return T('bad', '之字形发散', b2 + `y 乘了 1 − 20η = ${fmt(ry)}，绝对值大于 1：在两侧山壁之间越弹越高。` + (Math.abs(r) < 1
        ? `x 方向乘 ${fmt(r)}，本来能收敛，可 y 方向撑不住了：越陡的方向，能承受的 η 越小。` : r === -1 ? 'x 方向乘 −1，也只是在两侧来回跳。'
        : `x 方向乘 ${fmt(r)}，绝对值也大于 1，两个方向一起发散。`));
      if (eta === 0.1) return T('bad', '来回弹', b2 + `y 乘了 1 − 20η = −1：在 y = ${fmt(Math.abs(S[0].p[1]))} 和 ${fmt(-Math.abs(S[0].p[1]))} 两侧山壁之间来回弹，永远落不到谷底；` +
        `x 每步乘 0.8，慢慢移到 0。损失最后会卡在 ${fmt(10 * S[0].p[1] * S[0].p[1])} 下不去。`);
      if (eta > 0.05) return T('warn', '之字形', b2 + `y 乘了 1 − 20η = ${fmt(ry)}，是负数：每步跳过谷底到对面山壁；x 乘了 1 − 2η = ${fmt(r)}，沿着谷底往中心挪。陡的方向来回折腾，缓的方向进展慢，路线就成了之字形。`);
      if (eta === 0.05) return T('good', '先落谷底', b2 + 'y 乘了 1 − 20η = 0，一步就落到谷底；之后只剩 x 方向，每步乘 0.9。');
      return T('warn', '沿谷底慢慢挪', b2 + `y 每步乘 ${fmt(ry)}，很快落到谷底；x 每步只乘 ${fmt(r)}，在平缓的谷底一点点挪` + (m ? `，到中心还要大约 ${m} 步` : '') +
        '。η 又不能无限加大：到 0.1 时 y 方向就落不到谷底了，再大还会发散。陡的方向卡住了 η，缓的方向只能慢慢走。', '打开动量，看同样的 η 能快多少。');
    }

    // ----- 表格（打开时才画；连续运行时最多 0.3 秒刷新一次） -----
    function drawTable(force) {
      if (!tbl.open || (!force && st.running && Date.now() - lastTbl < 300)) return;
      lastTbl = Date.now();
      const f = F(), two = f.dim === 2, mom = st.mom, td = v => `<td>${fmt(v)}</td>`;
      tw.innerHTML = '<table><thead><tr><th>步</th>' + (two ? '<th>x</th><th>y</th>' : '<th>w</th>') + '<th>L</th>' + (two ? '<th>∂L/∂x</th><th>∂L/∂y</th>' : '<th>L′(w)</th>') +
        (mom ? (two ? '<th>v<sub>x</sub></th><th>v<sub>y</sub></th>' : '<th>v</th>') : '') + '</tr></thead><tbody>' +
        st.S.map((s, i) => `<tr><td>${i}</td>${s.p.map(td).join('')}${td(s.L)}${f.g(s.p).map(td).join('')}${mom ? s.v.map(td).join('') : ''}</tr>`).join('') + '</tbody></table>';
      tw.scrollTop = tw.scrollHeight;
    }

    // ----- 总渲染 -----
    function render(full, anim) {
      const f = F(), S = st.S, k = S.length - 1, s = S[k], ss = status(f, S), ae = document.activeElement;
      readEl.innerHTML = (k ? `第 <b>${k}</b> 步` : '起点') + ' · ' + (f.dim === 1 ? `w = <b>${fmt(s.p[0])}</b>` : `(x, y) = (<b>${fmt(s.p[0])}</b>, <b>${fmt(s.p[1])}</b>)`) +
        ` · L = <b>${fmt(s.L)}</b>` + (inside(f, s) ? '' : ' · 已跑出画面');
      drawMain(full, anim); drawLoss();
      eqH.textContent = (k ? `第 ${k} 步怎么算` : '点「下一步」会这样算') + `（η = ${fmt(st.eta)}${st.mom ? '，β = 0.9' : ''}）`;
      eqs.innerHTML = `<div class="${P}fx">${FX[key()]}</div>` + eqLines();
      const ex = explain();
      tagEl.dataset.tone = ex[0]; tagT.textContent = ex[1]; expEl.textContent = ex[2]; hintEl.textContent = ex[3]; hintEl.hidden = !ex[3];
      prevB.disabled = st.running || !k;
      nextB.disabled = st.running || !!ss;
      runB.disabled = !st.running && !!ss;
      runB.textContent = st.running ? '暂停' : reduce ? '快进 20 步' : '运行';
      runB.setAttribute('aria-label', st.running ? '暂停' : reduce ? '一次走 20 步（系统开启了减少动态效果，不自动播放）' : `运行：自动一步步走，直到收敛、发散或走满 ${MAXK} 步`);
      if ((ae === nextB || ae === runB || ae === prevB) && ae.disabled) (ae === prevB && !nextB.disabled ? nextB : resetB).focus();
      root.setAttribute('aria-busy', String(st.running));
      drawTable(false);
    }

    // ----- 事件 -----
    tabs.forEach(b => on(b, 'click', () => { if (st.view !== b.dataset.v) { st.view = b.dataset.v; change(); } }));
    on(fnSel, 'change', () => { st[st.view === '1d' ? 'fn1' : 'fn2'] = fnSel.value; change(); });
    const pickEta = v => { setEta(v); if (v !== st.lastEta) { st.lastEta = v; change(); } };
    on(range, 'input', () => { // 滑块按对数刻度取值，再吸附到最近的停靠点
      const raw = Math.exp(LMIN + range.value / 1000 * (LMAX - LMIN));
      pickEta(ETAS.reduce((b, v) => Math.abs(Math.log(v / raw)) < Math.abs(Math.log(b / raw)) ? v : b));
    });
    on(range, 'keydown', ev => {
      const up = ETAS.filter(v => v > st.eta + 1e-12), dn = ETAS.filter(v => v < st.eta - 1e-12), last = dn[dn.length - 1],
        m = { ArrowRight: up[0], ArrowUp: up[0], ArrowLeft: last, ArrowDown: last, PageUp: up[4] || up[up.length - 1], PageDown: dn[dn.length - 5] || dn[0], Home: ETAS[0], End: 1.2 };
      if (!(ev.key in m)) return;
      ev.preventDefault();
      if (m[ev.key] != null) pickEta(m[ev.key]);
    });
    // 兼容中文输入法：全角数字、全角负号，以及用逗号或句号当小数点
    const num = s => parseFloat(String(s).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[−–－]/g, '-').replace(/[,，。．]/g, '.'));
    on(etaIn, 'change', () => { const v = num(etaIn.value); if (isFinite(v)) pickEta(Math.min(1.2, Math.max(0.001, +v.toPrecision(6)))); else setEta(st.eta); });
    on(momC, 'change', () => { st.mom = momC.checked; change(); });
    on(cmpC, 'change', () => { st.cmp = cmpC.checked; sync(); render(); });
    on(startsEl, 'change', ev => {
      const i = +ev.target.dataset.i, r = i ? F().yr : F().xr, v = num(ev.target.value);
      if (isFinite(v)) { st.start[key()][i] = Math.min(r[1], Math.max(r[0], v)); change(); } else sync();
    });
    on(chipsEl, 'click', ev => {
      const b = ev.target.closest('button'), p = b && PRE.find(r => r[0] === b.dataset.p);
      if (!p) return;
      st.view = p[1]; st[p[1] === '1d' ? 'fn1' : 'fn2'] = p[2]; setEta(p[3]); st.lastEta = p[3]; st.mom = st.cmp = !!p[4];
      st.start[p[2]] = FN[p[2]].start.slice(); st.preset = p[0]; sync(); reset();
    });
    on(svg, 'click', ev => { // 点图设置起点（吸附到 0.1）
      const d = st.d, f = F(), r = svg.getBoundingClientRect();
      if (!d || !r.width) return;
      const px = (ev.clientX - r.left) * d.W / r.width, py = (ev.clientY - r.top) * d.H / r.height, pw = d.W - d.ml - d.mr, ph = d.H - d.mt - d.mb;
      if (px < d.ml || px > d.W - d.mr || py < d.mt || py > d.H - d.mb) return;
      const x = Math.round((f.xr[0] + (px - d.ml) / pw * (f.xr[1] - f.xr[0])) * 10) / 10, y = Math.round((f.yr[1] - (py - d.mt) / ph * (f.yr[1] - f.yr[0])) * 10) / 10;
      st.start[key()] = f.dim === 1 ? [x] : [x, y]; change();
    });
    on(svg, 'keydown', ev => { // 聚焦主图后用方向键微调起点，按住 Shift 一次挪 1
      const f = F(), p = st.start[key()].slice(), m = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [1, 1], ArrowDown: [1, -1] }[ev.key];
      if (!m || (f.dim === 1 && m[0])) return;
      ev.preventDefault();
      const r = m[0] ? f.yr : f.xr;
      p[m[0]] = Math.min(r[1], Math.max(r[0], Math.round((p[m[0]] + m[1] * (ev.shiftKey ? 1 : 0.1)) * 10) / 10));
      st.start[key()] = p; change();
    });
    on(nextB, 'click', () => { if (!status(F(), st.S)) { push(); render(false, true); } });
    on(prevB, 'click', () => { if (st.S.length > 1) { st.S.pop(); render(false, true); } });
    on(resetB, 'click', reset);
    on(runB, 'click', () => {
      if (st.running) { stop(); render(); return; }
      const f = F();
      if (status(f, st.S)) return;
      if (reduce) { for (let i = 0; i < 20 && !status(f, st.S); i++) push(); render(); return; } // 减少动态时不自动播放，一次走完 20 步
      st.running = true; tick();
    });
    on(lossSvg, 'pointermove', hover);
    on(lossSvg, 'pointerleave', () => { const hv = lossSvg.querySelector(`.${P}hv`); if (hv) hv.innerHTML = ''; });
    on(tbl, 'toggle', () => drawTable(true));
    const mqf = () => { reduce = mq.matches; if (reduce) stop(); render(); };
    if (mq && mq.addEventListener) { mq.addEventListener('change', mqf); offs.push(() => mq.removeEventListener('change', mqf)); }
    const ro = window.ResizeObserver && new ResizeObserver(() => {
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        if (!st.d || !st.lg || st.d.W !== Math.max(260, Math.round(plotBox.clientWidth || 600)) || st.lg.W !== Math.max(220, Math.round(lossBox.clientWidth || 300))) render(true);
      });
    });
    if (ro) { ro.observe(plotBox); ro.observe(lossBox); }

    setEta(st.eta); sync(); reset();
    return {
      destroy() {
        stop(); cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        offs.forEach(fn => fn());
        root.remove();
      }
    };
  }

  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = { title: '梯度下降：学习率决定你怎么下山', mount, selfTest };
})();
