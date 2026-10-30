/* 交互演示 ai-attention：注意力，每个词去「查询」其他词。接口见 _build/SITE-SPEC.md 第 7.2 节。 */
(function () {
  'use strict';
  var ID = 'ai-attention', P = 'dm-ai-attention-', MI = '−';

  // ---------- 数据：手工设计的词向量和三个矩阵 ----------
  // x 的 4 维（q、k、v 的 4 维含义相同）：活物、地点、动作（含状态）、虚词
  var DIMS = ['活物', '地点', '动作', '虚词'];
  // W_Q 每一行：x 的这一维「想找什么」
  var WQ = [[1, 0, 0, 0], [0, 1, 0, 0], [2, 1, 0, 0], [0, 0, 1, 0]];
  // W_K 每一行：x 的这一维给自己贴的标签
  var WK = [[1, 0, 0, 0], [0, 1, 0, 0], [-1, 0, 1, 0], [-1, -1, 0, 1]];
  // W_V：虚词那一维只交一半
  var WV = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 0.5]];
  var SENTS = {
    zh: { label: '中文：猫坐在垫子上，因为它累了', q0: 6, st: 7,
      t: ['猫', '坐', '在', '垫子', '上', '因为', '它', '累', '了'],
      x: [[2, 0, 0, 0], [0, 0, 1, 0], [0, 2, 0, 1], [0, 2, 0, 0], [0, 1, 0, 1], [0, 0, 0, 2], [2, 0, 0, 1], [1, 0, 1, 0], [0, 0, 0, 1]] },
    en: { label: 'English：The cat sat because it was tired', q0: 4, st: 6,
      t: ['The', 'cat', 'sat', 'because', 'it', 'was', 'tired'],
      x: [[0, 0, 0, 1], [2, 0, 0, 0], [0, 0, 1, 0], [0, 0, 0, 2], [2, 0, 0, 1], [0, 0, 1, 1], [1, 0, 1, 0]] }
  };
  var STEPS = ['词向量', '算 q、k、v', '打分', 'softmax', '加权求和', '整个矩阵'];

  // ---------- 核心计算（纯函数，不碰 DOM） ----------
  function vecMat(x, W) {            // 行向量 x 乘矩阵 W
    var out = [];
    for (var c = 0; c < W[0].length; c++) {
      var s = 0;
      for (var r = 0; r < x.length; r++) s += x[r] * W[r][c];
      out.push(s);
    }
    return out;
  }
  function dot(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  function softmax(s) {              // −Infinity 表示被遮住，权重为 0
    var m = -Infinity, z = 0, e = [], i;
    for (i = 0; i < s.length; i++) if (s[i] > m) m = s[i];
    for (i = 0; i < s.length; i++) { e.push(s[i] === -Infinity ? 0 : Math.exp(s[i] - m)); z += e[i]; }
    return e.map(v => v / z);
  }
  // 给定 Q、K、V（每行一个词），算原始点积 R、分数 S、权重 A、输出 O
  function attend(Q, K, V, opt) {
    var n = Q.length, d = n ? K[0].length : 0, c = opt.scale ? Math.sqrt(d) : 1, R = [], S = [], A = [], O = [];
    for (var i = 0; i < n; i++) {
      var r = K.map(k => dot(Q[i], k));
      var s = r.map((v, j) => opt.causal && j > i ? -Infinity : v / c);
      var a = softmax(s);
      R.push(r); S.push(s); A.push(a);
      O.push(V[0].map(function (_, col) { var t = 0; for (var j = 0; j < n; j++) t += a[j] * V[j][col]; return t; }));
    }
    return { R: R, S: S, A: A, O: O, d: d, c: c };
  }
  function compute(X, opt) {
    var Q = X.map(x => vecMat(x, WQ));
    var K = X.map(x => vecMat(x, WK));
    var V = X.map(x => vecMat(x, WV));
    var r = attend(Q, K, V, opt);
    r.X = X; r.Q = Q; r.K = K; r.V = V;
    return r;
  }
  function argmax(a) { var b = 0; for (var i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; }

  function selfTest() {
    var details = [], ok = true;
    function chk(name, pass, info) {
      ok = ok && !!pass;
      details.push((pass ? '通过 ' : '失败 ') + name + (info ? '：' + info : ''));
    }
    function near(a, b) { return Math.abs(a - b) < 1e-9; }
    // 1. 每行权重之和为 1：两个句子 × 缩放开/关 × 掩码开/关
    var worst = 0, rows = 0;
    ['zh', 'en'].forEach(function (k) {
      [true, false].forEach(function (sc) {
        [false, true].forEach(function (ca) {
          compute(SENTS[k].x, { scale: sc, causal: ca }).A.forEach(function (row) {
            var s = row.reduce((a, b) => a + b, 0);
            worst = Math.max(worst, Math.abs(s - 1)); rows++;
          });
        });
      });
    });
    chk('每行 softmax 之和为 1（共 ' + rows + ' 行）', worst < 1e-9, '最大误差 ' + worst.toExponential(2));
    // 2. 手算的 2 个词：W 取单位矩阵，q = k = v = x，A = [1, 1, 0, 0]，B = [1, −1, 0, 0]
    //    q_A·k_A = 2，q_A·k_B = 0，÷√4 → [1, 0]，softmax → [e/(e+1), 1/(e+1)] = [0.7311, 0.2689]
    var X2 = [[1, 1, 0, 0], [1, -1, 0, 0]], t2 = attend(X2, X2, X2, { scale: true, causal: false });
    var pA = Math.E / (Math.E + 1);
    chk('手算 2 个词：A 行点积 [2, 0] ÷ 2 = [1, 0]，权重 = [e/(e+1), 1/(e+1)] ≈ [0.7311, 0.2689]，B 行反过来', t2.R[0].join() === '2,0' && near(t2.A[0][0], pA) && near(t2.A[0][1], 1 - pA) && near(t2.A[1][0], 1 - pA) && near(t2.A[1][1], pA), t2.A[0].map(v => v.toFixed(4)).join(', '));
    chk('手算 2 个词：A 的输出 = [1, (e−1)/(e+1), 0, 0] ≈ [1, 0.4621, 0, 0]', near(t2.O[0][0], 1) && near(t2.O[0][1], (Math.E - 1) / (Math.E + 1)) && t2.O[0][2] === 0, t2.O[0].map(v => v.toFixed(4)).join(', '));
    var u2 = attend(X2, X2, X2, { scale: false, causal: false }), pU = Math.exp(2) / (Math.exp(2) + 1);
    chk('手算 2 个词，不除以 √d：A 行权重 = [e²/(e²+1), 1/(e²+1)] ≈ [0.8808, 0.1192]', near(u2.A[0][0], pU) && near(u2.A[0][1], 1 - pU));
    // 3. 因果掩码：第 1 个词只关注自己；所有 j > i 的权重都是 0
    ['zh', 'en'].forEach(function (k) {
      var c = compute(SENTS[k].x, { scale: true, causal: true }), zero = true;
      c.A.forEach(function (row, i) { row.forEach(function (w, j) { if (j > i && w !== 0) zero = false; }); });
      chk('因果掩码（' + k + '）：第 1 个词「' + SENTS[k].t[0] + '」只看自己，权重 = 1', c.A[0][0] === 1 && c.A[0].slice(1).every(w => w === 0));
      chk('因果掩码（' + k + '）：后面的词权重全是 0', zero);
    });
    // 4. 用演示里的真实数据手算「它」这一行
    var z = compute(SENTS.zh.x, { scale: true, causal: false });
    chk('q_它 = [2, 0, 1, 0]，k_猫 = [2, 0, 0, 0]；「它」一行点积 = [4, −1, −2, 0, −2, −4, 2, 1, −2]', z.Q[6].join() === '2,0,1,0' && z.K[0].join() === '2,0,0,0' && z.R[6].join() === '4,-1,-2,0,-2,-4,2,1,-2');
    var Z = Math.exp(2) + Math.exp(-0.5) + 3 * Math.exp(-1) + 1 + Math.exp(-2) + Math.E + Math.exp(0.5);
    chk('「它」对「猫」的权重 = e² ÷ (e² + e^−0.5 + 3e^−1 + 1 + e^−2 + e + e^0.5) ≈ 0.506', near(z.A[6][0], Math.exp(2) / Z), z.A[6][0].toFixed(4));
    var o = [0, 1, 2, 3].map(function (c) { return z.A[6].reduce((s, w, j) => s + w * z.V[j][c], 0); });
    chk('「它」的输出 = Σ 权重 × v', o.every((v, c) => near(v, z.O[6][c])));
    // 5. 去掉 √d 后每一行都更尖（最大权重变大）
    var u = compute(SENTS.zh.x, { scale: false, causal: false });
    chk('去掉 √d 后每行最大权重都变大', z.A.every((row, i) => Math.max.apply(null, u.A[i]) > Math.max.apply(null, row)));
    return { ok: ok, details: details };
  }

  // ---------- 格式化 ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sg(r, s) { return (r < 0 ? MI : '') + s; }
  function fx(v, k) {                // 固定 k 位小数，负号用 −
    if (v === -Infinity) return MI + '∞';
    var f = Math.pow(10, k), r = Math.round(v * f) / f;
    if (r === 0) r = 0;
    return sg(r, Math.abs(r).toFixed(k));
  }
  function nn(v) { var r = Math.round(v * 100) / 100; if (r === 0) r = 0; return sg(r, String(Math.abs(r))); }
  function z2(v) { return Math.abs(v) < 1e-12 ? '0' : fx(v, 2); }
  function vec(a, f) { return '[' + a.map(f || nn).join(', ') + ']'; }
  function vc(a, f) { return '[' + a.map(f || nn).join(',') + ']'; }
  function ex(v) {
    if (v === 0) return '0';
    if (v >= 100) return String(Math.round(v));
    if (v >= 1) return v.toFixed(2);
    return v.toFixed(v >= 0.01 ? 3 : 4);
  }
  function mul(a, b) { return nn(a) + '×' + (b < 0 ? '(' + nn(b) + ')' : nn(b)); }
  function expand(a, b) { return a.map((v, i) => mul(v, b[i])).join(' + '); }
  function pct(w) { return (65 * Math.sqrt(w)).toFixed(1) + '%'; }   // 热力图深浅：最深 65%，保证格子里的字够清楚
  function W(n) { return 'W<sub>' + n + '</sub>'; }

  // ---------- 样式 ----------
  var CSS = [
    '.§root{container-type:inline-size;--a:var(--c-ai,#4a3aa7);--s:var(--surface,#fff);--s2:var(--surface-2,#f0efec);--t:var(--text,#1b1b19);--t2:var(--text-2,#52514e);--t3:var(--text-3,#6b6a66);--b:var(--border,#e2e1dc);--mo:var(--mono,Consolas,monospace);--a1:color-mix(in srgb,var(--a) 10%,var(--s));--a2:color-mix(in srgb,var(--a) 16%,var(--s));color:var(--t);min-width:0}',
    '.§in{font-size:15px;line-height:1.65}',
    '.§in *{box-sizing:border-box}',
    '.§in :focus-visible{outline:2px solid var(--focus,#2457b3);outline-offset:2px}',
    '.§in p{margin:0}',
    '.§how{margin:0 0 12px!important;color:var(--t2)}',
    '.§tag{display:inline-block;margin-right:8px;padding:0 8px;border-radius:999px;background:var(--s2);color:var(--t);font-size:13px;font-weight:600}',
    '.§ctl{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin:0 0 12px}',
    '.§fld{display:flex;align-items:center;gap:6px;min-width:0;max-width:100%}',
    '.§fld select{font:inherit;font-size:14px;min-width:0;max-width:100%;padding:4px 6px;border:1px solid var(--b);border-radius:6px;background:var(--s);color:var(--t)}',
    '.§sw{display:inline-flex;align-items:center;gap:6px;cursor:pointer}',
    '.§sw input{accent-color:var(--a);width:16px;height:16px;margin:0;flex:none}',
    '.§chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 14px}',
    '.§cl{color:var(--t2);font-size:14px;margin-right:2px}',
    '.§chip{font:inherit;min-width:42px;min-height:32px;padding:2px 12px;border:1px solid var(--b);border-radius:999px;background:var(--s);color:var(--t);cursor:pointer}',
    '.§chip:hover{border-color:var(--a)}',
    '.§chip[aria-pressed=true]{border-color:var(--a);box-shadow:inset 0 0 0 1px var(--a);background:var(--a2);font-weight:600}',
    '.§stepper{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin:0 0 10px}',
    '.§btns{display:flex;flex-wrap:wrap;gap:6px}',
    '.§btn{font:inherit;font-size:14px;min-height:34px;padding:4px 14px;border:1px solid var(--b);border-radius:8px;background:var(--s);color:var(--t);cursor:pointer}',
    '.§btn:hover{background:var(--s2)}',
    '.§pri{border-color:var(--a);background:var(--a1)}',
    '.§btn[aria-disabled=true]{opacity:.45;cursor:default}',
    '.§prog{flex:1 1 170px;min-width:0;font-size:14px;color:var(--t2)}',
    '.§pb{display:block;height:4px;margin-top:4px;border-radius:2px;background:var(--s2);overflow:hidden}',
    '.§pb span{display:block;height:100%;background:var(--a);transition:width .3s}',
    '.§now{margin:0 0 14px;padding:10px 14px;border:1px solid var(--b);border-left:3px solid var(--a);border-radius:8px;background:var(--s)}',
    '.§nl{font-size:13px;font-weight:600;color:var(--t2)}',
    '.§now p{margin-top:4px}',
    '.§note{margin-top:8px!important;padding-top:8px;border-top:1px solid var(--b)}',
    '.§card{min-width:0;padding:12px 14px;border:1px solid var(--b);border-radius:var(--radius,10px);background:var(--s)}',
    '.§detail{margin:0 0 14px}',
    '.§cap{font-size:14px;color:var(--t2);margin:0 0 6px!important}',
    '.§tw{overflow-x:auto;max-width:100%}',
    '.§tbl{border-collapse:collapse;width:auto;min-width:min(100%,360px);font-size:13px}',
    '.§tbl th,.§tbl td{padding:4px 6px;border-bottom:1px solid var(--b);text-align:right;white-space:nowrap;vertical-align:top}',
    '.§tbl thead th{background:var(--s2);color:var(--t2);font-weight:600;white-space:normal;word-break:keep-all}',
    '.§tbl tbody th,.§tbl tfoot th{text-align:left;font-weight:600}',
    '.§tbl .§wr{white-space:normal;word-break:normal;text-align:left}',
    '.§m{font-family:var(--mo);font-variant-numeric:tabular-nums}',
    '.§tbl tr.§q>*{background:var(--a1)}',
    '.§tbl tr.§x>*{color:var(--t3)}',
    '.§tbl tfoot>tr>*{border-bottom:0;border-top:2px solid var(--b)}',
    '.§hint{font-size:13px;color:var(--t3);margin-top:6px!important}',
    '.§calc{font-family:var(--mo);font-size:13px;padding:8px 10px;background:var(--s2);border-radius:6px;margin:0 0 10px;overflow-x:auto}',
    '.§wd{margin-top:10px}',
    '.§wd summary{cursor:pointer;font-size:14px}',
    '.§ws{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}',
    '.§ws>div{flex:1 1 200px;min-width:0}',
    '.§ws p{font-size:13px;color:var(--t2);margin-top:4px}',
    '.§res{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;margin:0 0 16px}',
    '.§h{font-size:15px;font-weight:600;margin:0}',
    '.§sub{font-size:13px;color:var(--t2);margin:2px 0 8px!important}',
    '.§bt{width:100%;border-collapse:collapse;font-size:13px}',
    '.§bt th,.§bt td{padding:3px 4px;text-align:right;white-space:nowrap}',
    '.§bt thead th{color:var(--t2);font-weight:600;font-size:12px}',
    '.§bt tbody th,.§bt tfoot th,.§bt .§l{text-align:left;font-weight:600}',
    '.§bt tfoot>tr>*{border-top:1px solid var(--b);padding-top:5px}',
    '.§bt .§bc{width:100%;text-align:left}',
    '.§tr{display:block;height:14px;background:var(--s2);border-radius:0 4px 4px 0}',
    '.§fl{display:block;height:100%;background:var(--a);border-radius:0 4px 4px 0;transition:width .35s}',
    '.§self{font-size:11px;font-weight:400;color:var(--t3);margin-left:2px}',
    '.§mkt{font-size:12px;color:var(--t3)}',
    '.§out{margin-top:8px!important;font-size:14px}',
    '.§cmp{margin-top:4px!important;font-size:13px;color:var(--t2)}',
    '.§hm{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:2px;font-size:12px}',
    '.§hm thead th{font-weight:600;color:var(--t2);text-align:center;vertical-align:bottom;padding:0 0 2px;overflow:hidden}',
    '.§hm tbody th{padding:0;font-weight:600}',
    '.§hm th button{font:inherit;width:100%;padding:4px 3px 4px 0;border:0;border-radius:4px;background:none;color:var(--t);text-align:right;cursor:pointer}',
    '.§hm td{text-align:center;padding:5px 0;border-radius:3px;background:color-mix(in srgb,var(--a) var(--p,0%),var(--s));font-family:var(--mo);cursor:pointer;overflow:hidden}',
    '.§hm td.§mk,.§lg .§mk{background:repeating-linear-gradient(135deg,var(--s2) 0 3px,var(--s) 3px 6px);color:var(--t3)}',
    '.§hm tbody tr:hover{outline:1px solid var(--t3);outline-offset:-1px}',
    '.§hm tbody tr.§sel{outline:2px solid var(--t);outline-offset:-1px}',
    '.§hm tr.§sel th button{background:var(--a2)}',
    '.§lg{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;font-size:12px;color:var(--t2);margin-top:8px}',
    '.§sq{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:3px;border:1px solid var(--b);background:color-mix(in srgb,var(--a) var(--p,0%),var(--s))}',
    '.§ex h4{font-size:15px;font-weight:600;margin:16px 0 4px}',
    '.§ex p{margin-bottom:6px}',
    '.§root[data-step="2"] .§sc,.§root[data-step="3"] .§bc,.§root[data-step="4"] .§out{background:var(--a1);border-radius:4px}',
    '.§root[data-step="5"] .§hmcard{box-shadow:0 0 0 2px var(--a)}',
    '@container (min-width:680px){.§res{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}',
    '@container (max-width:479px){.§in{font-size:14px}.§n1{display:none}.§tbl{font-size:12px}.§tbl th,.§tbl td{padding:4px 3px}.§card{padding:10px}.§hm{font-size:11px}}',
    '@container (max-width:340px){.§hm{font-size:10px}.§lz{display:none}.§tbl{font-size:11px}.§tbl th,.§tbl td{padding:3px 2px}}',
    '@container (max-width:520px){.§hm-en thead th span{display:inline-block;writing-mode:vertical-rl;transform:rotate(180deg)}}',
    '@media (prefers-reduced-motion:reduce){.§fl,.§pb span{transition:none}}'
  ].join('\n').replace(/§/g, P);

  function injectStyle() {
    if (document.getElementById('dm-style-' + ID)) return;
    var s = document.createElement('style');
    s.id = 'dm-style-' + ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---------- 界面 ----------
  function mount(container) {
    injectStyle();
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var st = { lang: 'zh', q: SENTS.zh.q0, step: 0, scale: true, causal: false, note: '', wOpen: false };
    var timer = null, LAST = STEPS.length - 1;
    var root = document.createElement('div');
    root.className = P + 'root';
    root.innerHTML = shell();
    container.appendChild(root);
    function $(n) { return root.querySelector('.' + P + n); }
    var el = { chips: $('chips'), prog: $('prog'), now: $('now'), detail: $('detail'), bars: $('bars'), hm: $('hmcard'), ex: $('ex'), play: $('play'), prev: $('prev'), next: $('next') };

    function sent() { return SENTS[st.lang]; }
    function data(sc, ca) { return compute(sent().x, { scale: sc === undefined ? st.scale : sc, causal: ca === undefined ? st.causal : ca }); }
    function tk(j) { return '「' + esc(sent().t[j]) + '」'; }
    function sub(j) { return '<sub>' + esc(sent().t[j]) + '</sub>'; }
    function vis(i) { var n = sent().t.length, out = []; for (var j = 0; j < n; j++) if (!(st.causal && j > i)) out.push(j); return out; }
    function h(s) { return s.replace(/§/g, P); }
    function gv(i, j) { return j === i ? '给自己' : '给' + tk(j); }
    function few(js) { return js.slice(0, 3).map(tk).join('') + (js.length > 3 ? '等' : ''); }
    function ties(a, i) { var m = Math.max.apply(null, a); return vis(i).filter(j => Math.abs(a[j] - m) < 1e-12); }   // 权重并列最大的词
    function fm() { return 'softmax(QK<sup>T</sup>' + (st.scale ? ' ÷ √d' : '') + (st.causal ? ' + M' : '') + ')·V'; }

    function shell() {
      var opts = Object.keys(SENTS).map(k => '<option value="' + k + '">' + esc(SENTS[k].label) + '</option>').join('');
      return h('<div class="§in">' +
        '<p class="§how"><span class="§tag">怎么玩</span>点一个词当查询词（query），再按「下一步」，看它怎么给句子里每个词打分、把分数换成权重、按权重把信息加起来。热力图是每个词都当一次查询词的结果，点其中一行也能换查询词。</p>' +
        '<div class="§ctl">' +
          '<label class="§fld">句子<select data-act="lang" aria-label="选择例句">' + opts + '</select></label>' +
          '<label class="§sw"><input type="checkbox" data-act="scale" checked aria-label="除以 √d（打分时把点积除以根号 d）">除以 √d</label>' +
          '<label class="§sw"><input type="checkbox" data-act="causal" aria-label="因果掩码（只看自己和前面的词）">因果掩码（只看自己和前面的词）</label>' +
        '</div>' +
        '<div class="§chips" role="group" aria-label="选择查询词"></div>' +
        '<div class="§stepper"><div class="§btns">' +
          '<button type="button" class="§btn §prev" data-act="prev" aria-label="上一步">上一步</button>' +
          '<button type="button" class="§btn §pri §next" data-act="next" aria-label="下一步">下一步</button>' +
          '<button type="button" class="§btn §play" data-act="play" aria-label="自动播放">自动播放</button>' +
          '<button type="button" class="§btn" data-act="reset" aria-label="重置到第 1 步">重置</button>' +
        '</div><div class="§prog"></div></div>' +
        '<div class="§now" aria-live="polite"></div>' +
        '<div class="§card §detail"></div>' +
        '<div class="§res"><section class="§card §bars"></section><section class="§card §hmcard"></section></div>' +
        '<div class="§ex"></div></div>');
    }

    function chips() {
      return h('<span class="§cl">查询词</span>') + sent().t.map(function (t, j) {
        return h('<button type="button" class="§chip" data-act="q" data-i="' + j + '" data-fk="c' + j + '" aria-pressed="' + (j === st.q) + '" aria-label="以「' + esc(t) + '」为查询词">' + esc(t) + '</button>');
      }).join('');
    }

    function prog() {
      return h('第 ' + (st.step + 1) + ' / ' + STEPS.length + ' 步：' + STEPS[st.step] +
        '<span class="§pb" aria-hidden="true"><span style="width:' + ((st.step + 1) / STEPS.length * 100).toFixed(1) + '%"></span></span>');
    }

    // 「现在发生了什么」：每步一段，带真实数字
    function narrate(d) {
      var T = sent().t, i = st.q, n = T.length, v = vis(i), masked = n - v.length, a = d.A[i], top = argmax(a), q = d.Q[i];
      var two = st.scale ? '，再除以 √d = √4 = 2' : '，缩放已关闭，点积直接当分数';
      switch (st.step) {
        case 0:
          var nz = d.X[i].map((x, c) => x ? DIMS[c] + ' ' + nn(x) : '').filter(Boolean).join('、');
          return '每个词先换成一个向量 x。这里的 4 个数是手工定的，分别表示这个词有多像「活物、地点、动作、虚词」。比如' + tk(i) + '的 x = ' + vec(d.X[i]) + '（' + nz + '）。真实模型的词向量是训练出来的，有几百到几千维，每一维的含义一般说不清。';
        case 1:
          return tk(i) + '的 x 分别乘三个固定矩阵：q = x·' + W('Q') + ' = ' + vec(q) + '，表示「我要找什么」；k = x·' + W('K') + ' = ' + vec(d.K[i]) + '，表示「我是什么，别人凭这个找到我」；v = x·' + W('V') + ' = ' + vec(d.V[i]) + '，是被找到以后交出去的内容。每个词都用同样的三个矩阵算一遍，结果见下表。';
        case 2:
          if (v.length === 1) return tk(i) + '是第 1 个词，因果掩码打开后它只能看自己：q·k = ' + expand(q, d.K[i]) + ' = ' + nn(d.R[i][i]) + (st.scale ? '，÷ 2 = ' + fx(d.S[i][i], 2) : '') + '。后面 ' + (n - 1) + ' 个词的分数都换成 ' + MI + '∞。';
          var sc = d.S[i], mx = Math.max.apply(null, sc), mn = Math.min.apply(null, v.map(j => sc[j]));
          var tops = v.filter(j => sc[j] === mx), lows = v.filter(j => sc[j] === mn);
          var s = '拿' + tk(i) + '的 q = ' + vec(q) + ' 和每个词的 k 做点积（dot product）' + two + '。';
          if (mx === mn) s += '所有词的分数都是 ' + fx(mx, 2) + '。';
          else {
            s += tops.length > 1 ? '最高分是 ' + fx(mx, 2) + '，' + tops.map(tk).join('') + '同分；'
              : (top === i ? '和自己' : '和' + tk(top)) + '：' + expand(q, d.K[top]) + ' = ' + nn(d.R[i][top]) + (st.scale ? '，÷ 2 = ' + fx(mx, 2) : '') + '，分数最高；';
            s += lows.length > 1 ? '最低分 ' + fx(mn, 2) + '，有 ' + lows.length + ' 个词（' + few(lows) + '）。' : '最低的是' + tk(lows[0]) + '，' + fx(mn, 2) + '。';
          }
          s += '点积越大，说明 q 要找的和 k 标出来的越对得上。';
          if (masked) s += '因果掩码把后面 ' + masked + ' 个词的分数换成 ' + MI + '∞。';
          return s;
        case 3:
          if (v.length === 1) return '只有一个分数时，softmax 的结果就是 1：' + tk(i) + '把全部注意力给了自己，后面的词 e<sup>' + MI + '∞</sup> = 0。';
          var E = Math.exp(d.S[i][top]), Z = v.reduce((t, j) => t + Math.exp(d.S[i][j]), 0);
          return 'softmax 把分数换成权重：每个分数先取 e 的幂（e ≈ 2.718），再除以所有结果的总和。比如' + tk(top) + '：e<sup>' + fx(d.S[i][top], 2) + '</sup> = ' + ex(E) + '，总和 = ' + ex(Z) + '，权重 = ' + ex(E) + ' ÷ ' + ex(Z) + ' = ' + fx(a[top], 3) + '。分数越高，分到的越多，这一行的权重加起来正好是 1。' + (masked ? '被遮住的词 e<sup>' + MI + '∞</sup> = 0，权重是 0。' : '');
        case 4:
          var ord = v.slice().sort((x, y) => a[y] - a[x]);
          var terms = ord.slice(0, 2).map(j => fx(a[j], 3) + '×v' + sub(j)).join(' + ') + (ord.length > 2 ? ' + …' : '');
          var s4 = '按权重把每个词的 v 加起来，就是' + tk(i) + '的输出：o = ' + terms + ' = ' + vec(d.O[i], z2) + '。', tp = ties(a, i);
          if (v.length === 1) return s4 + tk(i) + '只能看自己，权重是 1，o 就是它自己的 v。';
          if (a[top] > 0.5) return s4 + (top === i ? tk(i) + '把 ' + fx(a[i], 3) + ' 的权重留给了自己，o 有一半以上还是自己的 v。'
            : tk(top) + '一个词就分到 ' + fx(a[top], 3) + '，o 有一半以上来自 v' + sub(top) + ' = ' + vec(d.V[top]) + '：' + tk(i) + '的输出里带上了' + tk(top) + '的信息。');
          return s4 + '没有哪个词分到一半以上，最大的' + tp.map(tk).join('') + '也' + (tp.length > 1 ? '各' : '') + '只有 ' + fx(a[top], 3) + '，o 是好几个词的 v 按权重混合出来的。';
        default:
          return '上面只算了' + tk(i) + '这一行。让每个词都当一次查询词，就得到下面 ' + n + '×' + n + ' 的注意力矩阵：第 i 行是第 i 个词分给各个词的权重，每一行加起来都是 1。实际计算时所有行一起算：O = ' + fm() + '，两次矩阵乘法加一次按行的 softmax。' + (st.causal ? '因果掩码打开着：M 的右上角是 ' + MI + '∞、其余是 0，所以矩阵右上角的权重都是 0。' : '');
      }
    }

    function nowBox(d) {
      return h('<div class="§nl">现在发生了什么</div><p>' + narrate(d) + '</p>' + (st.note ? '<p class="§note">' + st.note + '</p>' : ''));
    }

    function row(cls, cells) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + cells + '</tr>'; }
    function th(s, cls) { return '<th' + (cls ? ' class="' + cls + '"' : '') + ' scope="row">' + s + '</th>'; }
    function td(s, cls) { return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + s + '</td>'; }
    function tbl(head, body, foot) {
      return '<div class="§tw"><table class="§tbl"><thead><tr>' + head.map(x => '<th scope="col"' + (x[1] ? ' class="' + x[1] + '"' : '') + '>' + x[0] + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '') + '</table></div>';
    }
    function mat(M, name, note) {
      return '<div><div class="§cap">' + name + '</div>' + tbl([['']].concat(DIMS.map(x => [x])),
        M.map(function (r, k) { return row('', th(DIMS[k]) + r.map(x => td(nn(x), '§m')).join('')); }).join('')) + '<p>' + note + '</p></div>';
    }

    function detail(d) {
      var T = sent().t, i = st.q, a = d.A[i], top = argmax(a), v = vis(i), n = T.length, s;
      var qrow = j => j === i ? '§q' : '';
      var tp = ties(a, i), krow = j => v.indexOf(j) < 0 ? '§x' : (tp.indexOf(j) >= 0 ? '§q' : '');
      if (st.step === 0) {
        s = '<p class="§cap">词向量 x：每行一个词，每列一个特征（手工设定）</p>' +
          tbl([['词']].concat(DIMS.map(x => [x])), T.map(function (t, j) {
            return row(qrow(j), th(esc(t)) + d.X[j].map(x => td(nn(x), '§m')).join(''));
          }).join('')) + '<p class="§hint">「动作」这一列也包括状态，比如' + tk(sent().st) + '。真实模型还会把词的位置信息（位置编码，positional encoding）加进 x；这里省略了，所以打分只看词本身，不看它排在第几。</p>';
      } else if (st.step === 1) {
        s = '<p class="§cap">以' + tk(i) + '为例：q 的第 j 个数 = x 的 4 个数分别乘 ' + W('Q') + ' 第 j 列的 4 个数，再相加</p><div class="§calc">' +
          [0, 1, 2, 3].map(function (c) {
            return 'q<sub>' + (c + 1) + '</sub> = ' + expand(d.X[i], WQ.map(r => r[c])) + ' = ' + nn(d.Q[i][c]);
          }).join('<br>') + '</div><p class="§cap">k、v 的算法一样，只是换成 ' + W('K') + '、' + W('V') + '。所有词的结果：</p>' +
          tbl([['词'], ['q（找什么）'], ['k（是什么）'], ['v（交出什么）']], T.map(function (t, j) {
            return row(qrow(j), th(esc(t)) + td(vc(d.Q[j]), '§m') + td(vc(d.K[j]), '§m') + td(vc(d.V[j]), '§m'));
          }).join('')) +
          '<details class="§wd"' + (st.wOpen ? ' open' : '') + '><summary>展开看 ' + W('Q') + '、' + W('K') + '、' + W('V') + ' 和它们的含义</summary><div class="§ws">' +
          mat(WQ, W('Q') + '：每一行是 x 的这一维「想找什么」', '活物行去找活物，' + (st.lang === 'zh' ? '「它」' : '「it」') + '靠这一行找到' + (st.lang === 'zh' ? '「猫」' : '「cat」') + '；动作行 [2, 1, 0, 0] 最想找「谁」（2），其次是「在哪」（1）；虚词行去找动作。第 4 列全是 0：这个头里没有词去找虚词。') +
          mat(WK, W('K') + '：每一行是这一维给自己贴的标签', '动作行在「活物」上扣 1，免得动作被当成「谁」；虚词行在「活物」「地点」上各扣 1。') +
          mat(WV, W('V') + '：交出去的内容', '对角线是 1、1、1、0.5：前三维原样交出，虚词那一维只交一半。') +
          '</div><p class="§hint">真实模型里这三个矩阵是训练出来的，数字一般说不出含义。这里手工设计，让这个注意力头主要做一件事：帮每个词找「谁」（活物）。</p></details>';
      } else if (st.step === 2) {
        s = '<p class="§cap">' + tk(i) + '的 q = ' + vec(d.Q[i]) + '，和每个词的 k 逐项相乘再相加' + (st.scale ? '，然后 ÷ √4 = 2' : '') + '</p>' +
          tbl([['键'], ['k', '§n1'], ['q·k（逐项相乘再相加）', '§wr'], ['点积'], [st.scale ? '分数 = 点积&nbsp;÷&nbsp;2' : '分数 = 点积']], T.map(function (t, j) {
            var m = v.indexOf(j) < 0;
            return row(krow(j), th(esc(t)) + td(vc(d.K[j]), '§m §n1') + td(expand(d.Q[i], d.K[j]), '§m §wr') + td(nn(d.R[i][j]), '§m') +
              td(m ? MI + '∞ <span class="§mkt">遮住</span>' : fx(d.S[i][j], 2), '§m'));
          }).join(''));
      } else if (st.step === 3) {
        var Z = v.reduce((t, j) => t + Math.exp(d.S[i][j]), 0);
        s = '<p class="§cap">权重 = e<sup>分数</sup> ÷ 这一行所有 e<sup>分数</sup> 的总和</p>' +
          tbl([['键'], ['分数'], ['e<sup>分数</sup>'], ['权重']], T.map(function (t, j) {
            var m = v.indexOf(j) < 0, E = m ? 0 : Math.exp(d.S[i][j]);
            return row(krow(j), th(esc(t)) + td(fx(d.S[i][j], 2), '§m') + td(ex(E), '§m') + td(m ? '0' : fx(a[j], 3), '§m'));
          }).join(''), row('', th('合计') + td('') + td(ex(Z), '§m') + td(fx(a.reduce((x, y) => x + y, 0), 3), '§m'))) +
          '<p class="§hint">表里的权重四舍五入到 3 位小数，手动相加可能差 0.001。</p>';
      } else if (st.step === 4) {
        s = '<p class="§cap">每个词的 v 乘上自己的权重，再逐列相加</p>' +
          tbl([['键'], ['权重'], ['v', '§n1'], ['权重 × v']], T.map(function (t, j) {
            var m = v.indexOf(j) < 0;
            return row(krow(j), th(esc(t)) + td(m ? '0' : fx(a[j], 3), '§m') + td(vc(d.V[j]), '§m §n1') +
              td(m ? '<span class="§mkt">遮住，不参与</span>' : vc(d.V[j].map(x => a[j] * x), z2), '§m'));
          }).join(''), row('', th('输出 o') + td('') + td('', '§n1') + td(vc(d.O[i], z2), '§m')));
      } else {
        s = '<p class="§cap">矩阵写法：O = ' + fm() + '。Q、K、V 都是 ' + n + '×4；QK<sup>T</sup> 是 ' + n + '×' + n + '，第 i 行第 j 列就是 q<sub>i</sub>·k<sub>j</sub>' + (st.causal ? '；M 是掩码，右上角是 ' + MI + '∞，其余是 0' : '') + '；softmax 按行做，得到下方的注意力矩阵；再乘 V，得到每个词的输出：</p>' +
          tbl([['词']].concat(DIMS.map(x => [x])), T.map(function (t, j) {
            return row(qrow(j), th(esc(t)) + d.O[j].map(x => td(z2(x), '§m')).join(''));
          }).join(''));
      }
      return h(s);
    }

    function bars(d) {
      var T = sent().t, i = st.q, a = d.A[i], v = vis(i), sum = a.reduce((x, y) => x + y, 0);
      var other = data(!st.scale), ma = Math.max.apply(null, a), mo = Math.max.apply(null, other.A[i]);
      var body = T.map(function (t, j) {
        var m = v.indexOf(j) < 0;
        return row('', th(esc(t) + (j === i ? '<span class="§self">自己</span>' : '')) + td(fx(d.S[i][j], 2), '§m §sc') +
          td(m ? '<span class="§mkt">遮住</span>' : '<span class="§tr"><span class="§fl" style="width:' + (a[j] * 100).toFixed(1) + '%"></span></span>', '§bc') +
          td(m ? '0' : fx(a[j], 3), '§m'));
      }).join('');
      var cmp = v.length === 1 ? '这一行只能看自己，开不开 √d 缩放权重都是 1。'
        : '对比：' + (st.scale ? '不除以' : '除以') + ' √d 时，这一行最大的权重是 ' + fx(mo, 3) + '（现在 ' + fx(ma, 3) + '）。';
      return h('<h4 class="§h">' + tk(i) + '分给每个词的权重</h4><p class="§sub">分数 = q·k' + (st.scale ? ' ÷ √d' : '（未缩放）') + '，权重 = softmax(分数)</p>' +
        '<table class="§bt"><thead><tr><th scope="col" class="§l">键</th><th scope="col">分数</th><th scope="col" class="§l">权重</th><th scope="col">数值</th></tr></thead><tbody>' + body + '</tbody>' +
        '<tfoot>' + row('', th('合计') + td('') + td('') + td(fx(sum, 3), '§m')) + '</tfoot></table>' +
        '<p class="§out">输出 o = ' + vec(d.O[i], z2) + '</p><p class="§cmp">' + cmp + '</p>');
    }

    function heat(d) {
      var T = sent().t, n = T.length, lang = st.lang;
      var head = '<tr><td></td>' + T.map(t => '<th scope="col"><span>' + esc(t) + '</span></th>').join('') + '</tr>';
      var body = T.map(function (t, i) {
        return '<tr data-row="' + i + '"' + (i === st.q ? ' class="§sel"' : '') + '><th scope="row"><button type="button" data-act="q" data-i="' + i + '" data-fk="h' + i + '" aria-pressed="' + (i === st.q) + '" aria-label="第 ' + (i + 1) + ' 行：以「' + esc(t) + '」为查询词">' + esc(t) + '</button></th>' +
          d.A[i].map(function (w, j) {
            return st.causal && j > i ? '<td class="§mk">0</td>' : '<td style="--p:' + pct(w) + '">' + fx(w, 2).replace(/^0\./, '<span class="§lz">0</span>.') + '</td>';
          }).join('') + '</tr>';
      }).join('');
      var lg = '<span>颜色越深，权重越大：</span>' + [0, 0.1, 0.25, 0.5, 1].map(function (w) {
        return '<span><span class="§sq" style="--p:' + pct(w) + '"></span>' + w + '</span>';
      }).join('') + (st.causal ? '<span><span class="§sq §mk"></span>斜纹：被因果掩码遮住，权重 0</span>' : '');
      return h('<h4 class="§h">注意力矩阵（' + n + '×' + n + '）</h4><p class="§sub">行是查询词，列是被查的词（键），每行加起来是 1。点一行换查询词。</p>' +
        '<table class="§hm §hm-' + lang + '"><colgroup><col style="width:' + (lang === 'en' ? 4.8 : 3.2) + 'em">' + T.map(() => '<col>').join('') + '</colgroup>' +
        '<thead>' + head + '</thead><tbody>' + body + '</tbody></table><div class="§lg">' + lg + '</div>');
    }

    function explain(d) {
      var T = sent().t, i = st.q, a = d.A[i], top = argmax(a), n = T.length;
      var tp = ties(a, i), me = tp.indexOf(i) >= 0;
      var got = tp.map(tk).join('') + (tp.length > 1 ? '各' : me ? '自己' : '') + '分到 ' + fx(a[top], 3) + (me ? '' : '，' + tk(i) + '自己 ' + fx(a[i], 3));
      var rest = 1 - tp.length * a[top] - (me ? 0 : a[i]), k = n - tp.length - (me ? 0 : 1);
      var on = data(true), off = data(false), j = argmax(on.A[i]);
      var cmp = vis(i).length === 1 ? tk(i) + '这一行只能看自己，权重一直是 1；换一个查询词再试。'
        : tk(i) + gv(i, j) + '的权重会从 ' + fx(on.A[i][j], 3) + ' 变成 ' + fx(off.A[i][j], 3) + '。';
      return h('<h4>q、k、v 各管什么</h4><p>可以拿哈希表来对照。哈希表查找时，拿一个键去找完全相等的那一项，找到就返回它的值，别的项一概不看。注意力也有键（key）和值（value）：每个词的 k 是键，v 是值，查询词的 q（query）是拿去查的东西。不同的是它做「软」查找：q 和每个 k 都算一个相似度（点积），softmax 把相似度变成加起来为 1 的权重，每个键都分到一份，返回所有 v 按权重加起来的和。比如现在' + tk(i) + '去查：' + got + '，其余 ' + k + ' 个词一共 ' + fx(Math.max(rest, 0), 3) + '。</p>' +
        '<h4>为什么要除以 √d</h4><p>q 和 k 各有 d 个数，点积是 d 个乘积相加。如果这些数是互相独立、均值 0、方差 1 的随机数，点积的方差就是 d。原始 Transformer 里 d = 64，点积的标准差是 √64 = 8，两个分数之间常常差 10 以上，而 e<sup>10</sup> ≈ 22026，softmax 几乎把全部权重给最高分那一项，其余接近 0。这时梯度也接近 0，模型很难学下去。除以 √d 把分数的标准差拉回 1 左右。这里 d = 4，√d = 2：关掉上面的「除以 √d」，分数整体变成 2 倍，' + cmp + '</p>' +
        '<h4>多头注意力</h4><p>多头注意力（multi-head attention）就是准备 h 套不同的 ' + W('Q') + '、' + W('K') + '、' + W('V') + '，把上面的计算并行做 h 遍，再把 h 个输出拼起来乘一个矩阵 ' + W('O') + '；不同的头可以学到不同的关系，这个演示只手工搭了一个「找活物」的头。原始 Transformer 用 8 个头，每个头的 q、k 是 512 ÷ 8 = 64 维，上面的 d = 64 就是这么来的。</p>' +
        '<h4>因果掩码</h4><p>因果掩码（causal mask）用在 GPT 这类从左往右逐词生成的模型里：生成第 i 个词时，后面的词还不存在。训练时整句话是一次输进去的，不遮住的话，模型预测下一个词时能直接看到答案。所以把每个词后面的位置遮住：分数换成 ' + MI + '∞，e<sup>' + MI + '∞</sup> = 0，权重就是 0。BERT 这类用来理解整句话的模型，每个词都能看到前后文，不加这个掩码。</p>');
    }

    function render() {
      var d = data(), a = document.activeElement, fk = a && root.contains(a) && a.getAttribute('data-fk'), wd = root.querySelector('details');
      if (wd) st.wOpen = wd.open;
      root.setAttribute('data-step', st.step);
      el.chips.innerHTML = chips();
      el.prog.innerHTML = prog();
      el.now.innerHTML = nowBox(d);
      el.detail.innerHTML = detail(d);
      el.bars.innerHTML = bars(d);
      el.hm.innerHTML = heat(d);
      el.ex.innerHTML = explain(d);
      el.prev.setAttribute('aria-disabled', String(st.step === 0));
      el.next.setAttribute('aria-disabled', String(st.step === LAST));
      el.play.textContent = timer ? '暂停' : '自动播放';
      el.play.setAttribute('aria-label', timer ? '暂停自动播放' : '自动播放');
      if (fk) { var f = root.querySelector('[data-fk="' + fk + '"]'); if (f) f.focus(); }
    }

    function go(k) {
      k = Math.max(0, Math.min(LAST, k));
      if (k === st.step) return;
      st.step = k; st.note = ''; render();
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function play() {
      if (timer) { stop(); render(); return; }
      if (mq && mq.matches) { st.note = '系统开启了「减少动态效果」，自动播放已关闭，请用「下一步」一步步看。'; render(); return; }
      if (st.step === LAST) st.step = 0;
      st.note = '';
      timer = setInterval(function () {
        st.step = Math.min(LAST, st.step + 1);
        if (st.step === LAST) stop();
        render();
      }, 2600);
      render();
    }
    function setQ(j) { st.q = j; st.note = ''; render(); }

    function scaleNote(before) {
      var after = data(), i = st.q, j = argmax(after.A[i]);
      if (vis(i).length === 1) return tk(i) + '只能看自己，权重一直是 1，缩放对它没有影响。';
      return (st.scale ? '恢复 ÷√d：分数变回点积的一半，权重平一些。' : '去掉了 ÷√d：分数都变成原来的 2 倍，softmax 更尖。') +
        tk(i) + gv(i, j) + '的权重 ' + fx(before.A[i][j], 3) + ' → ' + fx(after.A[i][j], 3) + '，其余词合计 ' + fx(1 - before.A[i][j], 3) + ' → ' + fx(1 - after.A[i][j], 3) + '。';
    }
    function causalNote(before) {
      var after = data(), T = sent().t, i = st.q, n = T.length, j = argmax(after.A[i]);
      if (!st.causal) return '关掉因果掩码：每个词又能看到整句话（BERT 这类模型就是这样）。' + tk(i) + gv(i, j) + '的权重 ' + fx(before.A[i][j], 3) + ' → ' + fx(after.A[i][j], 3) + '。';
      var s = '打开因果掩码：每个词只能看自己和前面的词，矩阵右上角全变成 0。第 1 个词' + tk(0) + '只能看自己，权重是 1。';
      if (i > 0 && i < n - 1) s += tk(i) + '现在只能看前 ' + (i + 1) + ' 个词，' + gv(i, j) + '的权重 ' + fx(before.A[i][j], 3) + ' → ' + fx(after.A[i][j], 3) + '。';
      else if (i === n - 1) s += tk(i) + '是最后一个词，本来就能看到所有词，它这一行不变。';
      return s;
    }

    function onClick(e) {
      var t = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t || !root.contains(t)) {
        var tr = e.target.closest ? e.target.closest('tr[data-row]') : null;
        if (tr && root.contains(tr)) setQ(+tr.getAttribute('data-row'));
        return;
      }
      var act = t.getAttribute('data-act');
      if (act === 'q') setQ(+t.getAttribute('data-i'));
      else if (act === 'prev') { stop(); go(st.step - 1); }
      else if (act === 'next') { stop(); go(st.step + 1); }
      else if (act === 'play') play();
      else if (act === 'reset') { stop(); st.step = 0; st.q = sent().q0; st.note = ''; render(); }
    }
    function onChange(e) {
      var t = e.target, act = t.getAttribute && t.getAttribute('data-act'), before = data();
      if (act === 'lang') { st.lang = t.value; st.q = sent().q0; st.note = ''; render(); }
      else if (act === 'scale') { st.scale = t.checked; st.note = scaleNote(before); render(); }
      else if (act === 'causal') { st.causal = t.checked; st.note = causalNote(before); render(); }
    }

    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    render();
    return {
      destroy: function () {
        stop();
        root.removeEventListener('click', onClick);
        root.removeEventListener('change', onChange);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = {
    title: '注意力：每个词去「查询」其他词',
    mount: mount,
    selfTest: selfTest
  };
})();
(function(){
'use strict';
function attention(heads,causal){var n=3,d=8/heads,weights=[],outputs=[];for(var h=0;h<heads;h++){var aw=[],out=[];for(var i=0;i<n;i++){var scores=[];for(var j=0;j<n;j++){var dot=0;for(var k=0;k<d;k++)dot+=(i*8+h*d+k)/10*(j*8+h*d+k)/10;scores.push(causal&&j>i?-Infinity:dot/Math.sqrt(d));}var max=Math.max.apply(null,scores),exp=scores.map(function(s){return Math.exp(s-max);}),sum=exp.reduce(function(a,b){return a+b;},0),a=exp.map(function(v){return v/sum;}),o=[];for(var k=0;k<d;k++)o.push(a.reduce(function(v,w,j){return v+w*(j*8+h*d+k)/10;},0));aw.push(a);out.push(o);}weights.push(aw);outputs.push(out);}return {weights:weights,outputs:outputs,shape:[2,heads,3,d]};}
var old=window.KGDemos['ai-attention'];
function mount(container){var legacy=old.mount(container),root=document.createElement('section');root.className='stage-evidence practice-lab';container.appendChild(root);function el(t,v){var e=document.createElement(t);if(v!=null)e.textContent=v;return e;}
root.appendChild(el('h3','多头形状与因果输出'));
root.appendChild(el('p','浏览器数值模拟：X形状[2,3,8]，各批次采用相同0…23除以10。以恒等投影令Q=K=V=X，无输出投影；逐头展示拆分、缩放、softmax与加权值。这是受控算例，权重不代表因果解释。'));
var label=el('label','头数 '),heads=el('select');heads.setAttribute('aria-label','注意力头数');[1,2,4].forEach(function(v){var o=el('option',String(v));o.value=v;heads.appendChild(o);});heads.value=2;label.appendChild(heads);root.appendChild(label);var cl=el('label',' 因果遮罩 '),causal=el('input');causal.type='checkbox';causal.checked=true;causal.setAttribute('aria-label','多头因果遮罩');cl.appendChild(causal);root.appendChild(cl);
var note=el('textarea');note.setAttribute('aria-label','多头输出预测');note.placeholder='第一位置是否能读取未来？拆头后的形状是什么？';root.appendChild(note);
var prev=el('button','前一查询'),next=el('button','后一查询'),reset=el('button','重置多头');[prev,next,reset].forEach(function(b){b.type='button';b.className='btn';root.appendChild(b);});var status=el('p');status.setAttribute('role','status');root.appendChild(status);var values=el('pre');values.style.overflowX='auto';root.appendChild(values);var index=0;
function draw(){var a=attention(+heads.value,causal.checked);status.textContent='查询位置'+index+'；每头形状[B,H,T,Dh]='+JSON.stringify(a.shape)+'；拼接回[2,3,8]。';values.textContent=a.weights.map(function(w,h){return '头'+h+' 权重 '+w[index].map(function(x){return x.toFixed(4);}).join(', ')+'\n输出 '+a.outputs[h][index].map(function(x){return x.toFixed(4);}).join(', ');}).join('\n');prev.disabled=index===0;next.disabled=index===2;}
heads.onchange=causal.onchange=draw;prev.onclick=function(){index--;draw();};next.onclick=function(){index++;draw();};reset.onclick=function(){index=0;heads.value=2;causal.checked=true;note.value='';draw();};draw();root.appendChild(el('p','迁移：取消遮罩比较第一位置输出；只改变头数比较缩放与权重。位置表示的作用用 P05 项目单独对照，避免同时改变多个变量。对应代码：ai-attention-qkv-masks 和 ai-attention-heads-position。'));
return {destroy:function(){legacy.destroy();heads.onchange=causal.onchange=prev.onclick=next.onclick=reset.onclick=null;root.remove();}};}
window.KGDemos['ai-attention']={title:old.title,mount:mount,selfTest:function(){var a=attention(2,true),b=attention(4,false),details=[{name:'原实验',ok:old.selfTest().ok},{name:'拆头维度',ok:JSON.stringify(a.shape)==='[2,2,3,4]'},{name:'因果首行无未来',ok:a.weights[0][0][0]===1&&a.weights[0][0][1]===0&&Math.abs(a.outputs[1][0][0]-.4)<1e-12},{name:'无遮罩归一化',ok:b.weights.every(function(h){return h.every(function(r){return Math.abs(r.reduce(function(x,y){return x+y;},0)-1)<1e-12;});})}];return {ok:details.every(function(x){return x.ok;}),details:details};}};
})();
