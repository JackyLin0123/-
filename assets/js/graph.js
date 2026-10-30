/*
 * graph.js — 知识图谱组件 window.KGGraph（依赖 d3 v7：assets/vendor/d3.min.js）
 *
 *   var g = KGGraph.mount(container, options);
 *   g.focus(id, { open: true })  定位到节点：平移缩放、高亮邻居；open 默认 true（打开侧面板）。mini 模式只高亮。
 *                                节点不在当前图上（比如领域页里的别的领域）返回 false。
 *   g.refresh(patch?)            进度变了以后调用：重读 isLearned / nextId，重画状态。patch 可覆盖同名 options。
 *   g.setLayout('force'|'columns'|'sphere')   g.getLayout() → 当前布局
 *   g.destroy()                  移除 DOM、监听器、ResizeObserver（可重复调用）。
 *   g.el                         组件根元素 div.kgg。
 *
 * options（只有 nodes 必填）：
 *   nodes            KG.nodes：{ id: node } 或 node 数组。用到 id, domain, title, en, level(1|2|3), order,
 *                    stage, prereqs[], oneLiner, estMinutes。
 *   edges            KG.edges：[{ s, t, kind, cross, label }]。s 先学、t 后学；cross=true 为跨领域边。
 *                    不传时用 nodes[].prereqs 推出领域内前置边。
 *   domains          KG.domains：[{ id, name, short, stages:[{ id, name, nodeIds }] }]，决定顺序、名称和阶段。
 *   filterDomain     领域 id：只画这个领域（领域页）。此时「分栏」按学习阶段分栏，跨领域边不画（侧面板仍列出）。
 *   focusId          mini 模式的中心节点；完整模式下挂载后定位到它（不打开侧面板）。
 *   mini             true = 迷你图：只画 focusId 和直接邻居；没有控制条、图例、侧面板、缩放；点节点调用 onOpen。
 *   onOpen(id)       跳到节点页：「开始学习」按钮、mini 点击、侧面板里不在当前图上的节点。
 *   isLearned(id)    返回布尔值。组件本身不读写 localStorage。
 *   nextId           「下一步」节点 id，或返回 id 的函数（建议传函数，掌握状态变化后会重新取值）。
 *   onToggleLearned(id, learned)  侧面板「已掌握」开关；learned 是要设成的新状态，存储由 app.js 负责，
 *                    回调返回后组件自动 refresh()。不传则不显示开关。
 *   layout           初始布局：'force'（默认）| 'columns'（分栏）| 'sphere'（3D 知识云）。
 *   onLayoutChange(name)  用户切换布局时回调（可选，用来记住偏好）。
 *   height           画布高度 px；默认 clamp(420px, 72vh, 780px)。mini 模式按内容自适应。
 */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var LEVEL = { 1: '入门', 2: '核心', 3: '进阶' };
  var DOMAIN_NAME = { foundation: '数学与统计基础', theory: '计算理论', ds: '数据结构与算法', arch: '计算机组成', os: '操作系统', pl: '编程语言', compiler: '编译原理', ai: '人工智能', eng: '工程与工业技术栈', hum: '论证、人文与技术判断', research: '科研' };
  var SHAPE = { foundation: 'triangle', theory: 'kite', ds: 'circle', arch: 'octagon', os: 'square', pl: 'capsule', compiler: 'diamond', ai: 'hexagon', eng: 'pentagon', hum: 'book', research: 'flask' };
  var ANCHOR = { foundation: [-1.6, -1.1], theory: [-1.45, .25], ds: [-0.55, -1.15], arch: [0.5, -1.2], os: [1.55, -.65], pl: [-1.15, .55], compiler: [-.75, .9], ai: [.35, 1.15], eng: [1.35, .75], hum: [1.7, 1.55], research: [-1.7, 1.5] };
  var KIND = { prereq: '前置', uses: '用到', implements: '实现', analogy: '思想相通', applies: '应用' };
  var RADIUS = { 1: 10, 2: 8.5, 3: 7 };
  var LABEL_PX = 12;
  var uid = 0;
  var FONT = '-apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function safeId(s) { return String(s == null ? '' : s).replace(/[^a-zA-Z0-9_-]/g, ''); }
  function domColor(d) { var s = safeId(d); return s ? 'var(--c-' + s + ', var(--text-3))' : 'var(--text-3)'; }
  function radius(n) { return RADIUS[n.level] || RADIUS[2]; }
  function shapeOf(d) { return SHAPE[d] || 'circle'; }

  // 面积大致相同的四种形状，中心在原点
  function shapePath(shape, r) {
    var f = function (v) { return Math.round(v * 100) / 100; };
    if (shape === 'triangle') {
      var tr = r * 1.2;
      return 'M0,' + f(-tr) + 'L' + f(tr) + ',' + f(tr * .85) + 'L' + f(-tr) + ',' + f(tr * .85) + 'Z';
    }
    if (shape === 'kite') {
      var kr = r * 1.18;
      return 'M0,' + f(-kr) + 'L' + f(kr) + ',0L0,' + f(kr) + 'L' + f(-kr) + ',0Z';
    }
    if (shape === 'octagon') {
      var oh = r, oc = r * .42;
      return 'M' + f(-oc) + ',' + f(-oh) + 'H' + f(oc) + 'L' + f(oh) + ',' + f(-oc) + 'V' + f(oc) +
        'L' + f(oc) + ',' + f(oh) + 'H' + f(-oc) + 'L' + f(-oh) + ',' + f(oc) + 'V' + f(-oc) + 'Z';
    }
    if (shape === 'square') {
      var h = r * 0.92, c = h * 0.38;
      return 'M' + f(-h + c) + ',' + f(-h) + 'H' + f(h - c) + 'Q' + f(h) + ',' + f(-h) + ' ' + f(h) + ',' + f(-h + c) +
        'V' + f(h - c) + 'Q' + f(h) + ',' + f(h) + ' ' + f(h - c) + ',' + f(h) + 'H' + f(-h + c) +
        'Q' + f(-h) + ',' + f(h) + ' ' + f(-h) + ',' + f(h - c) + 'V' + f(-h + c) + 'Q' + f(-h) + ',' + f(-h) + ' ' + f(-h + c) + ',' + f(-h) + 'Z';
    }
    if (shape === 'diamond') {
      var d = r * 1.25;
      return 'M0,' + f(-d) + 'L' + f(d) + ',0L0,' + f(d) + 'L' + f(-d) + ',0Z';
    }
    if (shape === 'hexagon') {
      var R = r * 1.1, p = [];
      for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i; p.push(f(R * Math.cos(a)) + ',' + f(R * Math.sin(a))); }
      return 'M' + p.join('L') + 'Z';
    }
    if (shape === 'pentagon') {
      var P = r * 1.13, pp = [];
      for (var j = 0; j < 5; j++) { var pa = -Math.PI / 2 + Math.PI * 2 / 5 * j; pp.push(f(P * Math.cos(pa)) + ',' + f(P * Math.sin(pa))); }
      return 'M' + pp.join('L') + 'Z';
    }
    if (shape === 'capsule') {
      var w = r * 1.35, h = r * 0.72;
      return 'M' + f(-w + h) + ',' + f(-h) + 'H' + f(w - h) +
        'A' + f(h) + ',' + f(h) + ' 0 0 1 ' + f(w - h) + ',' + f(h) +
        'H' + f(-w + h) +
        'A' + f(h) + ',' + f(h) + ' 0 0 1 ' + f(-w + h) + ',' + f(-h) + 'Z';
    }
    if (shape === 'book') {
      var bw = r * 1.08, bh = r * 1.18, gap = r * .12;
      return 'M' + f(-bw) + ',' + f(-bh) + 'H' + f(-gap) + 'Q0,' + f(-bh) + ' 0,' + f(-bh + gap) +
        'V' + f(bh) + 'Q' + f(-gap) + ',' + f(bh - gap) + ' ' + f(-bw) + ',' + f(bh - gap) + 'Z' +
        'M' + f(bw) + ',' + f(-bh) + 'H' + f(gap) + 'Q0,' + f(-bh) + ' 0,' + f(-bh + gap) +
        'V' + f(bh) + 'Q' + f(gap) + ',' + f(bh - gap) + ' ' + f(bw) + ',' + f(bh - gap) + 'Z';
    }
    if (shape === 'flask') {
      var fn = r * .38, fh = r * 1.2, fw = r * 1.15, fs = -r * .15;
      return 'M' + f(-fn) + ',' + f(-fh) + 'H' + f(fn) + 'V' + f(fs) + 'L' + f(fw) + ',' + f(fh * .85) +
        'H' + f(-fw) + 'L' + f(-fn) + ',' + f(fs) + 'Z';
    }
    return 'M' + f(r) + ',0A' + f(r) + ',' + f(r) + ' 0 1,1 ' + f(-r) + ',0A' + f(r) + ',' + f(r) + ' 0 1,1 ' + f(r) + ',0Z';
  }

  // 小图标（图例、筛选标签、提示框、列表）：mode = fill | outline | next
  function iconSVG(domain, mode, size) {
    size = size || 14;
    var half = size / 2, r = size * 0.3, col = domColor(domain), shape = shapeOf(domain);
    var body = '<path d="' + shapePath(shape, mode === 'next' ? r * 0.8 : r) + '" style="fill:' +
      (mode === 'outline' || mode === 'next' ? 'var(--surface)' : col) + ';stroke:' + col + ';stroke-width:' +
      (size > 12 ? 1.75 : 1.5) + '"/>';
    if (mode === 'next') body += '<path d="' + shapePath(shape, r * 0.8 + 3) + '" style="fill:none;stroke:var(--text);stroke-width:1.25"/>';
    return '<svg class="kgg-ico" width="' + size + '" height="' + size + '" viewBox="' + (-half) + ' ' + (-half) + ' ' + size + ' ' + size +
      '" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  var ICON = {
    search: '<svg class="kgg-i" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/></svg>',
    close: '<svg class="kgg-i" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    plus: '<svg class="kgg-i" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>',
    minus: '<svg class="kgg-i" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8h10"/></svg>',
    reset: '<svg class="kgg-i" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2.5 6V2.5H6M2.5 2.5l3 3M13.5 10v3.5H10M13.5 13.5l-3-3M10 2.5h3.5V6M13.5 2.5l-3 3M6 13.5H2.5V10M2.5 13.5l3-3"/></svg>',
    list: '<svg class="kgg-i" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.5M2.5 8h.5M2.5 12h.5"/></svg>',
    arrow: '<svg class="kgg-i" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
    down: '<svg class="kgg-i" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 3v10M4 9l4 4 4-4"/></svg>'
  };

  // ---------- 文本测量 ----------
  var mctx = null, mcache = {};
  function textW(str, px, weight) {
    var key = (weight || 400) + '|' + px + '|' + str;
    if (mcache[key] != null) return mcache[key];
    if (!mctx) { try { mctx = document.createElement('canvas').getContext('2d'); } catch (e) { mctx = null; } }
    var w;
    if (mctx) { mctx.font = (weight || 400) + ' ' + px + 'px ' + FONT; w = mctx.measureText(str).width; }
    else {
      w = 0;
      for (var i = 0; i < str.length; i++) w += (str.charCodeAt(i) > 0x2e80 ? 1 : 0.58) * px;
    }
    mcache[key] = w;
    return w;
  }
  function fitText(str, px, maxW, weight) {
    str = String(str || '');
    if (textW(str, px, weight) <= maxW) return str;
    var lo = 1, hi = str.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (textW(str.slice(0, mid) + '…', px, weight) <= maxW) lo = mid; else hi = mid - 1;
    }
    return str.slice(0, lo) + '…';
  }

  // ---------- DOM 小工具 ----------
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;            // 只用于本文件里的静态图标字符串
      else if (k === 'class') e.className = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function s(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); });
    return e;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------- 样式（只注入一次；颜色全部来自 SPEC 4.1 的令牌） ----------
  var CSS = [
    '.kgg{position:relative;container-type:inline-size;font-family:var(--font,sans-serif);color:var(--text);font-size:14px;line-height:1.5;min-width:0}',
    '.kgg *,.kgg *::before,.kgg *::after{box-sizing:border-box}',
    '.kgg [hidden]{display:none!important}',
    ':where(.kgg) button{font:inherit;color:inherit}',
    '.kgg :focus-visible{outline:2px solid var(--focus);outline-offset:2px}',
    '.kgg-i{fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;flex:none}',
    '.kgg-ico{flex:none;overflow:visible}',
    /* 控制条 */
    '.kgg-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin:0 0 10px}',
    '.kgg-grp{display:flex;flex-wrap:wrap;align-items:center;gap:6px}',
    '.kgg-btn{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:4px 10px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text-2);font-size:13px;line-height:1.2;cursor:pointer;white-space:nowrap}',
    '.kgg-btn:hover{border-color:var(--edge-strong);color:var(--text)}',
    '.kgg-chip[aria-pressed="true"]{color:var(--text);border-color:var(--text-3);background:var(--surface)}',
    '.kgg-chip[aria-pressed="false"]{color:var(--text-3);background:transparent;border-style:dashed}',
    '.kgg-chip[aria-pressed="false"] .kgg-ico,.kgg-chip[aria-pressed="false"] .kgg-ekey{opacity:.35}',
    '.kgg-ekey{width:18px;height:8px;flex:none;overflow:visible}',
    // 透明边框 + padding-box 背景：选中的药丸看起来内缩 2px，可点区域仍是整条 32px 高
    '.kgg-seg{display:inline-flex;padding:0;border:1px solid var(--border);border-radius:999px;background:var(--surface)}',
    '.kgg-seg button{min-height:30px;padding:3px 10px;border:2px solid transparent;border-radius:999px;background:transparent;background-clip:padding-box;color:var(--text-2);font-size:13px;cursor:pointer}',
    '.kgg-seg button[aria-pressed="true"]{background:var(--text);color:var(--bg);font-weight:600}',
    '.kgg-tool[aria-pressed="true"]{background:var(--text);color:var(--bg);border-color:var(--text)}',
    '.kgg-search{position:relative;flex:1 1 170px;min-width:150px;max-width:260px}',
    '.kgg-search .kgg-i{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-3);pointer-events:none}',
    '.kgg-search input{width:100%;min-height:32px;padding:5px 10px 5px 30px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text);font:inherit;font-size:13px}',
    '.kgg-search input::placeholder{color:var(--text-3)}',
    '.kgg-dd{position:absolute;z-index:40;top:calc(100% + 4px);left:0;min-width:100%;width:max-content;max-width:min(320px,86vw);margin:0;padding:4px;list-style:none;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow)}',
    '.kgg-dd li{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:6px;font-size:13px;cursor:pointer;color:var(--text)}',
    '.kgg-dd li .en{color:var(--text-3);font-size:12px}',
    '.kgg-dd li[aria-selected="true"],.kgg-dd li:hover{background:var(--surface-2)}',
    '.kgg-dd li.empty{color:var(--text-3);cursor:default;background:none}',
    /* 画布 */
    '.kgg-stage{position:relative;height:clamp(420px,72vh,780px);background:var(--bg);border:1px solid var(--border);border-radius:var(--radius,10px);overflow:hidden}',
    '.kgg--mini .kgg-stage{height:auto;border-radius:8px}',
    '.kgg-svg{display:block;width:100%;height:100%;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}',
    '.kgg--mini .kgg-svg{height:auto;cursor:default;touch-action:auto}',
    '.kgg-svg.grabbing{cursor:grabbing}',
    '.kgg-frame{fill:none;stroke:var(--border);stroke-width:1}',
    '.kgg-e{fill:none;stroke-width:1.25;transition:opacity .15s}',
    '.kgg-e.pre{stroke:var(--edge)}',
    '.kgg-e.crs{stroke:var(--edge-strong);stroke-dasharray:5 4;opacity:.6}',
    '.kgg-e.on{opacity:1;stroke:var(--edge-strong);stroke-width:1.75}',
    '.kgg-e.crs.on{stroke:var(--text-2)}',
    '.kgg-ah{fill:var(--edge)}',
    '.kgg-ah.on{fill:var(--edge-strong)}',
    '.kgg-ehit{fill:none;stroke:transparent;stroke-width:12;pointer-events:stroke;cursor:help}',
    '.kgg-n{cursor:pointer;transition:opacity .15s}',
    '.kgg-n.cur{cursor:default}',
    '.kgg--sphere .kgg-edge-controls,.kgg--sphere .kgg-legend,.kgg--sphere .kgg-zoom{display:none}',
    '.kgg-n:focus{outline:none}',
    '.kgg-shape{fill:var(--surface);stroke:var(--kc);stroke-width:2}',
    '.kgg-n.learned .kgg-shape{fill:var(--kc)}',
    '.kgg-hit{fill:transparent;stroke:none}',
    '.kgg-ring{fill:none;stroke:var(--text);stroke-width:1.5}',
    '.kgg-fring{fill:none;stroke:var(--focus);stroke-width:2.5;opacity:0}',
    '.kgg-n:focus-visible .kgg-fring,.kgg-n.sel .kgg-fring{opacity:1}',
    '.kgg-n.cur .kgg-fring{opacity:0}',
    '.kgg-halo{fill:var(--kc);fill-opacity:.2;stroke:none}',
    '.kgg-n:hover .kgg-shape{stroke-width:2.75}',
    '.kgg-lab{pointer-events:none;transition:opacity .15s}',
    '.kgg-lab text{font-size:12px;fill:var(--text);stroke:var(--bg);stroke-width:3px;stroke-linejoin:round;paint-order:stroke}',
    '.kgg-lab.cull{display:none}',
    '.kgg-lab.hdr text{font-size:13px;font-weight:600}',
    '.kgg-lab.stg text{font-size:11.5px;fill:var(--text-2)}',
    '.kgg-lab.me text{font-weight:600}',
    '.kgg-pill rect{fill:var(--text)}',
    '.kgg-pill text{font-size:10.5px;font-weight:600;fill:var(--bg);stroke:none}',
    '.kgg-dim .kgg-n:not(.on),.kgg-dim .kgg-e:not(.on),.kgg-dim .kgg-lab.nl:not(.on),.kgg-dim .kgg-pill:not(.on){opacity:.15}',
    /* 缩放按钮、图例 */
    '.kgg-zoom{position:absolute;z-index:6;top:10px;right:10px;display:flex;flex-direction:column;gap:4px}',
    '.kgg-zoom button{display:grid;place-items:center;width:32px;height:32px;padding:0;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text-2);cursor:pointer}',
    '.kgg-zoom button:hover{color:var(--text);border-color:var(--edge-strong)}',
    '@container (max-width: 640px){.kgg-zoom{display:none}}',
    '@container (max-width: 480px){.kgg-bar{gap:8px 10px}.kgg-grp{gap:5px}.kgg-btn{padding:4px 7px;gap:5px;font-size:12.5px}.kgg-btn .kgg-ico{width:12px;height:12px}.kgg-search{min-width:130px}.kgg-seg button{padding:3px 9px}}',
    '.kgg-legend{position:absolute;z-index:6;left:10px;bottom:10px;max-width:calc(100% - 20px);display:flex;flex-wrap:wrap;gap:3px 18px;padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:8px;font-size:12px;line-height:1.4;color:var(--text-2)}',
    '.kgg-legend .row{display:flex;flex-wrap:wrap;gap:2px 12px}',
    '.kgg-legend .it{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}',
    // 宽屏侧面板打开时，图例收窄换行，不被 360px 的抽屉盖住
    '@container (min-width: 641px){.kgg-stage:has(>.kgg-panel:not([hidden])) .kgg-legend{max-width:calc(100% - 390px)}}',
    '.kgg-more{position:absolute;z-index:7;right:10px;bottom:10px;display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:4px 11px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text-2);font-size:12.5px;line-height:1.2;box-shadow:var(--shadow);cursor:pointer;white-space:nowrap}',
    '.kgg-more:hover{color:var(--text);border-color:var(--edge-strong)}',
    '.kgg-more[data-dir="up"] .kgg-i{transform:rotate(180deg)}',
    '.kgg-empty{position:absolute;inset:0;display:grid;place-items:center;padding:24px;color:var(--text-3);font-size:14px;text-align:center}',
    '.kgg--mini .kgg-empty{position:static;display:block;padding:6px 12px 12px;font-size:13px}',
    /* 提示框 */
    '.kgg-tip{position:absolute;z-index:30;left:0;top:0;max-width:min(300px,calc(100% - 16px));padding:8px 11px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow);font-size:12.5px;line-height:1.55;pointer-events:none}',
    '.kgg-tip .t{font-size:14px;font-weight:600}',
    '.kgg-tip .en{color:var(--text-3);font-size:12px}',
    '.kgg-tip .meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin-top:3px;color:var(--text-2)}',
    '.kgg-tip .meta span{display:inline-flex;align-items:center;gap:4px}',
    '.kgg-tip .d{margin-top:5px;color:var(--text-2)}',
    '.kgg-tip .rel{display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-weight:600}',
    '.kgg-tip .rel span{display:inline-flex;align-items:center;gap:4px}',
    '.kgg-tip .kind{color:var(--text-3);font-size:12px}',
    /* 侧面板：宽屏右侧抽屉，窄屏底部弹层 */
    '.kgg-panel{position:absolute;z-index:20;top:0;right:0;bottom:0;width:360px;max-width:100%;overflow-y:auto;overscroll-behavior:contain;padding:16px 18px 20px;background:var(--surface);border-left:1px solid var(--border);box-shadow:var(--shadow)}',
    '@container (max-width: 640px){.kgg-panel{top:auto;left:0;width:auto;max-height:74%;border-left:0;border-top:1px solid var(--border);border-radius:14px 14px 0 0;padding-top:14px}}',
    '.kgg-panel .x{position:absolute;top:10px;right:10px;display:grid;place-items:center;width:32px;height:32px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--text-2);cursor:pointer}',
    '.kgg-panel .x:hover{background:var(--surface-2);color:var(--text)}',
    '.kgg-panel h3{margin:0 40px 0 0;font-size:19px;line-height:1.35;font-weight:600}',
    '.kgg-panel h3:focus{outline:none}',
    '.kgg-panel .en{margin-top:2px;color:var(--text-3);font-size:13px}',
    '.kgg-panel .meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
    '.kgg-badge{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border:1px solid var(--border);border-radius:999px;background:var(--surface-2);color:var(--text-2);font-size:12px;line-height:1.6}',
    '.kgg-panel .one{margin:12px 0 0;padding:9px 12px;border-left:3px solid var(--kc,var(--border));border-radius:0 8px 8px 0;background:var(--surface-2);color:var(--text);font-size:14px;line-height:1.65}',
    '.kgg-panel .acts{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:14px}',
    '.kgg-go{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:6px 14px;border:0;border-radius:8px;background:var(--text);color:var(--bg)!important;font-weight:600;font-size:14px;cursor:pointer}',
    '.kgg-go:hover{opacity:.88}',
    '.kgg-switch{display:inline-flex;align-items:center;gap:8px;min-height:34px;padding:0;border:0;background:none;color:var(--text);font-size:14px;cursor:pointer}',
    '.kgg-switch .trk{position:relative;width:36px;height:20px;flex:none;border-radius:999px;background:var(--surface-2);border:1px solid var(--edge-strong);transition:background .15s}',
    '.kgg-switch .kn{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--text-2);transition:transform .15s}',
    // 和节点页的「已掌握」开关一致：打开后轨道用本节点的领域色
    '.kgg-switch[aria-checked="true"] .trk{background:var(--kc,var(--text));border-color:var(--kc,var(--text))}',
    '.kgg-switch[aria-checked="true"] .kn{transform:translateX(16px);background:var(--surface)}',
    '.kgg-panel h4{margin:18px 0 6px;font-size:13px;font-weight:600;color:var(--text-2)}',
    '.kgg-panel ul{margin:0;padding:0;list-style:none;display:grid;gap:2px}',
    '.kgg-item{display:flex;align-items:flex-start;gap:8px;width:100%;padding:6px 8px;border:0;border-radius:6px;background:transparent;text-align:left;cursor:pointer;color:var(--text);font-size:13.5px;line-height:1.5}',
    '.kgg-item:hover{background:var(--surface-2)}',
    '.kgg-item .kgg-ico{margin-top:3px}',
    '.kgg-item .tt{flex:1;min-width:0}',
    '.kgg-item .st{flex:none;color:var(--text-3);font-size:12px}',
    '.kgg-item .lb{display:block;color:var(--text-2);font-size:12.5px;line-height:1.55;margin-top:1px}',
    '.kgg-panel .none{color:var(--text-3);font-size:13px;padding:2px 8px}',
    /* 列表视图 */
    '.kgg-list{position:absolute;inset:0;z-index:4;overflow:auto;background:var(--bg)}',
    '.kgg-list table{width:100%;min-width:600px;border-collapse:collapse;font-size:13px}',
    '.kgg-list th{position:sticky;top:0;z-index:1;padding:8px 10px;background:var(--surface-2);color:var(--text-2);font-weight:600;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap}',
    '.kgg-list td{padding:7px 10px;border-bottom:1px solid var(--border);vertical-align:top;color:var(--text)}',
    '.kgg-list td.c2,.kgg-list td.c5{white-space:nowrap}',
    '.kgg-list td.c4{color:var(--text-2)}',
    '.kgg-list .ttl{padding:6px 0;margin:-6px 0;border:0;background:none;color:var(--link);font-weight:600;text-align:left;cursor:pointer}',
    '.kgg-list .ttl:hover{text-decoration:underline}',
    '.kgg-list .en{display:block;color:var(--text-3);font-size:12px}',
    '.kgg-list .dm{display:inline-flex;align-items:center;gap:5px}',
    '.kgg-sr{position:absolute!important;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '@media (prefers-reduced-motion: reduce){.kgg *{transition:none!important;animation:none!important}}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('kgg-style')) return;
    var st = document.createElement('style');
    st.id = 'kgg-style';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  // ---------- 数据整理 ----------
  function buildModel(o) {
    var all = {}, src = o.nodes || {};
    if (Array.isArray(src)) src.forEach(function (n) { if (n && n.id != null) all[n.id] = n; });
    else Object.keys(src).forEach(function (k) { var n = src[k]; if (n) { if (n.id == null) n = Object.assign({ id: k }, n); all[n.id] = n; } });

    var doms = [], domById = {};
    function addDom(d) {
      if (!d || d.id == null || domById[d.id]) return;
      var rec = { id: d.id, name: d.short || d.name || DOMAIN_NAME[d.id] || String(d.id), full: d.name || DOMAIN_NAME[d.id] || String(d.id), stages: d.stages || [] };
      domById[d.id] = rec; doms.push(rec);
    }
    (o.domains || []).forEach(addDom);
    var order = ['ds', 'os', 'compiler', 'ai'];
    var present = {};
    Object.keys(all).forEach(function (id) { present[all[id].domain] = 1; });
    order.concat(Object.keys(present).sort()).forEach(function (d) { if (present[d] && !domById[d]) addDom({ id: d }); });

    var edges = [], seen = {};
    function add(sId, tId, kind, cross, label) {
      if (sId == null || tId == null || sId === tId || !all[sId] || !all[tId]) return;
      cross = cross != null ? !!cross : all[sId].domain !== all[tId].domain;
      var key = sId + '\u0001' + tId + '\u0001' + (cross ? 'c' : 'p');
      if (seen[key]) return;
      seen[key] = 1;
      edges.push({ s: sId, t: tId, kind: kind || 'prereq', cross: cross, label: label || '' });
    }
    if (Array.isArray(o.edges)) o.edges.forEach(function (e) {
      if (e) add(e.s != null ? e.s : e.source, e.t != null ? e.t : e.target, e.kind || e.type, e.cross, e.label);
    });
    else Object.keys(all).forEach(function (id) {
      (all[id].prereqs || []).forEach(function (p) { add(p, id, 'prereq', false, ''); });
    });
    return { all: all, doms: doms, domById: domById, edges: edges };
  }

  // 每个领域的阶段分段：[{ id, name, ids:[nodeId] }]，按 order 排；没归到阶段的放进「其他」
  function stagesOf(M, domId) {
    var dom = M.domById[domId], res = [], used = {};
    var ids = Object.keys(M.all).filter(function (id) { return M.all[id].domain === domId; });
    var byOrder = function (a, b) { return (M.all[a].order || 999) - (M.all[b].order || 999) || String(M.all[a].title).localeCompare(String(M.all[b].title)); };
    var stages = (dom && dom.stages) || [], known = {};
    stages.forEach(function (st) { known[st.id] = 1; });
    stages.forEach(function (st) {
      var list = ids.filter(function (id) {
        var n = M.all[id];
        return !used[id] && (n.stage === st.id || (!known[n.stage] && (st.nodeIds || []).indexOf(id) > -1));
      });
      list.forEach(function (id) { used[id] = 1; });
      if (list.length) res.push({ id: st.id, name: st.name || st.id, ids: list.sort(byOrder) });
    });
    var rest = ids.filter(function (id) { return !used[id]; }).sort(byOrder);
    if (rest.length) res.push({ id: '_rest', name: res.length ? '其他' : '', ids: rest });
    return res;
  }

  // ---------- 几何 ----------
  function lcg(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function bez(p, t) {
    var u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * p[0] + b * p[2] + c * p[4] + d * p[6], a * p[1] + b * p[3] + c * p[5] + d * p[7]];
  }
  function splitBez(p, t) {
    var L = function (a, b) { return a + (b - a) * t; };
    var x01 = L(p[0], p[2]), y01 = L(p[1], p[3]), x12 = L(p[2], p[4]), y12 = L(p[3], p[5]), x23 = L(p[4], p[6]), y23 = L(p[5], p[7]);
    var xa = L(x01, x12), ya = L(y01, y12), xb = L(x12, x23), yb = L(y12, y23), xm = L(xa, xb), ym = L(ya, yb);
    return [[p[0], p[1], x01, y01, xa, ya, xm, ym], [xm, ym, xb, yb, x23, y23, p[6], p[7]]];
  }
  // 把三次贝塞尔两端各截掉 r0 / r1（到节点边缘为止）
  function trimBez(p, r0, r1) {
    function solve(ex, ey, r, fromStart) {
      var lo = fromStart ? 0 : 0.5, hi = fromStart ? 0.5 : 1;
      for (var i = 0; i < 22; i++) {
        var m = (lo + hi) / 2, q = bez(p, m), d = Math.hypot(q[0] - ex, q[1] - ey);
        if (fromStart) { if (d < r) lo = m; else hi = m; } else { if (d < r) hi = m; else lo = m; }
      }
      return (lo + hi) / 2;
    }
    var t0 = solve(p[0], p[1], r0, true), t1 = solve(p[6], p[7], r1, false);
    if (t1 <= t0) return null;
    var left = splitBez(p, t1)[0];
    return splitBez(left, t0 / t1)[1];
  }
  function bezD(q) {
    var f = function (v) { return Math.round(v * 10) / 10; };
    return 'M' + f(q[0]) + ',' + f(q[1]) + 'C' + f(q[2]) + ',' + f(q[3]) + ' ' + f(q[4]) + ',' + f(q[5]) + ' ' + f(q[6]) + ',' + f(q[7]);
  }
  function edgeR(n) { return n.r * 1.18 + 2.5; }

  // ---------- 布局 1：全景（力导向，同步跑完再画） ----------
  function forceBox(k) {
    var nodes;
    function f() {
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j];
          var dx = b.x + b.vx - a.x - a.vx, dy = b.y + b.vy - a.y - a.vy;
          var ox = (a.bw + b.bw) / 2 - Math.abs(dx);
          if (ox <= 0) continue;
          var oy = (a.bh + b.bh) / 2 - Math.abs(dy);
          if (oy <= 0) continue;
          if (ox / (a.bw + b.bw) < oy / (a.bh + b.bh)) {
            var sx = (dx < 0 || (dx === 0 && i % 2) ? -1 : 1) * ox * 0.5 * k;
            a.vx -= sx; b.vx += sx;
          } else {
            var sy = (dy < 0 || (dy === 0 && i % 2) ? -1 : 1) * oy * 0.5 * k;
            a.vy -= sy; b.vy += sy;
          }
        }
      }
    }
    f.initialize = function (n) { nodes = n; };
    return f;
  }

  // 画布宽高比分档（0.2 一档），同一档布局完全相同
  function aspectBucket(W, H) { return Math.round(clamp(W / Math.max(1, H), 0.5, 2.4) * 5) / 5; }

  function layoutForce(V, W, H) {
    // 参考画布：面积按节点数定，宽高比取画布的档位；四个锚点在四个象限的中心
    var base = W < 560 ? 0.65 : 1;
    var A = aspectBucket(W, H), area = Math.max(200000, V.nodes.length * 8000) * base * base;
    var ax = Math.sqrt(area * A) / 4, ay = Math.sqrt(area / A) / 4;
    var kx = 0.1 / Math.sqrt(A), ky = 0.1 * Math.sqrt(A);
    var doms = V.domIds, single = doms.length === 1;
    var anchors = {};
    doms.forEach(function (d, i) {
      if (single) anchors[d] = [0, 0];
      else if (ANCHOR[d]) anchors[d] = [ANCHOR[d][0] * ax, ANCHOR[d][1] * ay];
      else { var a = 2 * Math.PI * i / doms.length; anchors[d] = [Math.cos(a) * ax, Math.sin(a) * ay]; }
    });
    // 节点的目标点：领域锚点，再按学习阶段错开。单领域时阶段从左到右（竖屏从上到下），多领域时在象限里从上到下
    var stageIdx = {}, nStages = {}, inStage = {};
    doms.forEach(function (d) {
      var sl = (V.stageList && V.stageList[d]) || [];
      nStages[d] = sl.length;
      sl.forEach(function (stg, si) {
        stg.ids.forEach(function (id, j) { stageIdx[id] = si; inStage[id] = stg.ids.length > 1 ? j / (stg.ids.length - 1) - 0.5 : 0; });
      });
    });
    var spanX = Math.sqrt(area * A) * 0.78, spanY = Math.sqrt(area / A) * 0.78;
    function target(n) {
      var a = anchors[n.dom], ns = nStages[n.dom] || 1, f = ns > 1 ? (stageIdx[n.id] || 0) / (ns - 1) - 0.5 : 0;
      var g = inStage[n.id] || 0;
      if (single) return A >= 1 ? [f * spanX, g * spanY * 0.6] : [g * spanX * 0.6, f * spanY];
      return [a[0], a[1] + f * ay * 0.9];
    }
    if (single) { kx = A >= 1 ? 0.12 : 0.04; ky = A >= 1 ? 0.04 : 0.12; }
    var links = V.edges.map(function (e) { return { source: e.a, target: e.b, cross: e.cross }; });
    // 跑一遍：sc 是标签框的放大倍数。返回这个布局放进画布时的缩放比例
    function run(sc) {
      var counter = {};
      V.nodes.forEach(function (n) {
        var key = n.dom + '|' + (stageIdx[n.id] || 0);
        var i = counter[key] = (counter[key] || 0) + 1;
        var rr = 24 * sc * Math.sqrt(i - 0.5), th = (i - 1) * 2.399963;
        var a = target(n);
        n.ax = a[0]; n.ay = a[1];
        n.x = a[0] + rr * Math.cos(th); n.y = a[1] + rr * Math.sin(th);
        n.vx = 0; n.vy = 0;
        n.bw = (Math.max(2 * n.r, n.lwF) + 12) * sc;
        n.bh = (2 * n.r + 24) * sc;
      });
      d3.forceSimulation(V.nodes).randomSource(lcg(20261019))
        .force('link', d3.forceLink(links).distance(function (l) { return l.cross ? 160 : 54; }).strength(function (l) { return l.cross ? 0.025 : 0.42; }))
        .force('charge', d3.forceManyBody().strength(-160).distanceMax(300))
        .force('x', d3.forceX(function (n) { return n.ax; }).strength(kx))
        .force('y', d3.forceY(function (n) { return n.ay; }).strength(ky))
        .force('box', forceBox(0.55))
        .stop()
        .tick(300);
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      V.nodes.forEach(function (n) {
        var ex = Math.max(n.r, n.lwF * sc / 2);
        x0 = Math.min(x0, n.x - ex); x1 = Math.max(x1, n.x + ex);
        y0 = Math.min(y0, n.y - n.r - 22 * sc); y1 = Math.max(y1, n.y + n.r + 20 * sc);
      });
      return Math.min((W - 64) / Math.max(1, x1 - x0), (H - 28) / Math.max(1, y1 - y0));
    }
    // 宽屏时如果放进画布要缩小，就把标签框按缩小比例放大再跑一遍，让标签在实际显示尺寸下也不重叠
    var k = run(base);
    if (base === 1 && k >= 0.7 && k < 0.97) run(1 / k);
    V.frames = [];
    V.heads = [];
  }

  // ---------- 布局 2：分栏 ----------
  var COL = { BW: 236, GAP: 18, NODE_X: 66, HEAD: 40, STAGE: 26, ROW: 34, SEG: 6, PAD: 8 };
  function layoutColumns(V, W, H) {
    var blocks = [];
    if (V.single) {
      V.stageList[V.domIds[0]].forEach(function (st) {
        var nodes = st.ids.map(function (id) { return V.byId[id]; }).filter(Boolean);
        if (nodes.length) blocks.push({ title: st.name || '其他', dom: V.domIds[0], icon: false, segs: [{ title: null, nodes: nodes }] });
      });
    } else {
      V.domIds.forEach(function (d) {
        var segs = V.stageList[d].map(function (st) {
          return { title: st.name, nodes: st.ids.map(function (id) { return V.byId[id]; }).filter(Boolean) };
        }).filter(function (sg) { return sg.nodes.length; });
        if (segs.length) blocks.push({ title: V.domName(d), dom: d, icon: true, segs: segs });
      });
    }
    blocks.forEach(function (b) {
      var y = COL.HEAD;
      b.segs.forEach(function (sg) { if (sg.title) y += COL.STAGE; y += sg.nodes.length * COL.ROW + COL.SEG; });
      b.h = y + COL.PAD;
    });
    var maxCols = colsFor(W);
    var rows = Math.max(1, Math.ceil(blocks.length / maxCols));
    var ncol = Math.max(1, Math.ceil(blocks.length / rows));
    var totalH = 0;
    for (var r0 = 0; r0 < rows; r0++) {
      totalH += (r0 ? COL.GAP : 0) + Math.max.apply(null, blocks.slice(r0 * ncol, r0 * ncol + ncol).map(function (b) { return b.h; }));
    }
    // 先按高度估计缩放比例，再让栏宽吃满画布宽度（标签更完整，跨栏曲线也更舒展）
    var kEst = clamp((H - 28) / totalH, 0.62, 1);
    var BW = Math.round(clamp(((W - 28) / kEst - (ncol - 1) * COL.GAP) / ncol, COL.BW, 360));
    V.bw = BW;
    var rowY = 0;
    V.frames = []; V.heads = [];
    for (var r = 0; r < rows; r++) {
      var rowH = 0, row = blocks.slice(r * ncol, r * ncol + ncol);
      row.forEach(function (b, c) {
        b.x = c * (BW + COL.GAP); b.y = rowY;
        var y = COL.HEAD;
        V.heads.push({ kind: 'hdr', text: b.title, dom: b.icon ? b.dom : null, x: b.x + 14, y: b.y + 24, maxW: BW - 28 - (b.icon ? 20 : 0) });
        b.segs.forEach(function (sg) {
          if (sg.title) { V.heads.push({ kind: 'stg', text: sg.title, x: b.x + 14, y: b.y + y + 15, maxW: BW - 28 }); y += COL.STAGE; }
          sg.nodes.forEach(function (n) { n.x = b.x + COL.NODE_X; n.y = b.y + y + COL.ROW / 2; n.block = b; y += COL.ROW; });
          y += COL.SEG;
        });
        rowH = Math.max(rowH, b.h);
      });
      row.forEach(function (b) { V.frames.push({ x: b.x, y: b.y, w: BW, h: rowH }); });
      rowY += rowH + COL.GAP;
    }
  }
  function colsFor(W) { return clamp(Math.floor((W / 0.8 + COL.GAP) / (COL.BW + COL.GAP)), 2, 6); }

  // 分栏布局里的边：同一栏用左侧弧线，不同栏用 S 形曲线
  function columnBez(e) {
    var a = e.a, b = e.b;
    if (Math.abs(a.x - b.x) < 1) {
      var dy = Math.abs(b.y - a.y), same = a.block === b.block;
      var bulge = same ? Math.min(56, 12 + dy * 0.17) : Math.min(84, 66 + dy * 0.01);
      return { p: [a.x, a.y, a.x - bulge, a.y, b.x - bulge, b.y, b.x, b.y], rev: false };
    }
    var dx = b.x - a.x;
    // 前置边一律从左侧进入后学的节点（箭头不会压在标题下面）；目标在左边时也从源节点左侧出发
    if (!e.cross) {
      if (dx > 0) return { p: [a.x, a.y, a.x + dx * 0.45, a.y, b.x - dx * 0.45, b.y, b.x, b.y], rev: false };
      var c = Math.min(90, 46 + Math.abs(b.y - a.y) * 0.05);
      return { p: [a.x, a.y, a.x - c, a.y, b.x - c, b.y, b.x, b.y], rev: false };
    }
    var L = a.x < b.x ? a : b, R = L === a ? b : a, d = R.x - L.x;
    return { p: [L.x, L.y, L.x + d * 0.45, L.y, R.x - d * 0.45, R.y, R.x, R.y], rev: L !== a };
  }
  function forceBez(e, straight) {
    var a = e.a, b = e.b;
    if (!e.cross || straight) return { p: [a.x, a.y, a.x + (b.x - a.x) / 3, a.y + (b.y - a.y) / 3, a.x + (b.x - a.x) * 2 / 3, a.y + (b.y - a.y) * 2 / 3, b.x, b.y], rev: false };
    var mx = b.x - a.x, my = b.y - a.y, k = 0.14;
    return { p: [a.x, a.y, a.x + mx / 3 - my * k, a.y + my / 3 + mx * k, a.x + mx * 2 / 3 - my * k, a.y + my * 2 / 3 + mx * k, b.x, b.y], rev: false };
  }

  // ---------- 迷你图 ----------
  // 左栏：要先懂的（领域内前置、被本节点用到/实现/应用的），右栏：之后的；思想相通的放到人少的一边
  function layoutMini(V, W) {
    var f = V.byId[V.focusId], left = [], right = [], either = [], seen = {};
    seen[f.id] = 1;
    V.edges.forEach(function (e) {
      if (e.a !== f && e.b !== f) return;
      var o = e.a === f ? e.b : e.a;
      if (seen[o.id]) return;
      seen[o.id] = 1;
      var oIsS = e.a === o;
      if (!e.cross || e.kind === 'prereq') (oIsS ? left : right).push(o);
      else if (e.kind === 'analogy') either.push(o);
      else (oIsS ? right : left).push(o);
    });
    either.forEach(function (o) { (left.length <= right.length ? left : right).push(o); });
    var byOrder = function (a, b) { return V.domIdx(a.dom) - V.domIdx(b.dom) || (a.n.order || 0) - (b.n.order || 0); };
    left.sort(byOrder); right.sort(byOrder);
    var ROW = 50, top = 22, rows = Math.max(1, left.length, right.length), midH = rows * ROW;
    function col(list, fx) {
      var y0 = top + (midH - list.length * ROW) / 2;
      list.forEach(function (n, i) { n.x = W * fx; n.y = y0 + (i + 0.5) * ROW - 6; });
    }
    col(left, 0.17); col(right, 0.83);
    f.x = W / 2; f.y = top + midH / 2 - 6;
    V.miniH = top + midH + 10;
    V.frames = []; V.heads = [];
  }

  // ---------- 挂载 ----------
  function mount(container, options) {
    if (!container) throw new Error('KGGraph.mount: 需要 container');
    var o = Object.assign({}, options || {});
    injectStyle();
    var noop = function () {};
    if (!window.d3 || !window.d3.forceSimulation) {
      container.appendChild(h('p', { class: 'kgg-empty', text: '图谱组件需要 d3（assets/vendor/d3.min.js）。' }));
      return { destroy: noop, focus: noop, refresh: noop, setLayout: noop };
    }
    var ID = 'kgg' + (++uid);
    var mini = !!o.mini;
    var M = buildModel(o);
    var single = !mini && o.filterDomain != null;
    var root = h('div', { class: 'kgg ' + (mini ? 'kgg--mini' : 'kgg--full') + (single ? ' kgg--single' : '') });
    container.appendChild(root);
    try { var ff = getComputedStyle(root).fontFamily; if (ff) FONT = ff; } catch (e) { /* 用默认字体 */ }

    var st = {
      layout: ['columns', 'sphere'].indexOf(o.layout) > -1 ? o.layout : 'force',
      hidden: {}, showPre: true, showCross: !single,
      list: false, hover: null, hoverEdge: null, sel: null, panelId: null, query: '',
      t: d3.zoomIdentity, userZoomed: false, focused: false, layoutKey: '', destroyed: false
    };
    if (st.layout === 'sphere' && (!window.KGSphereCloud || !window.KGNebulaRuntime)) st.layout = 'force';

    // ---- 要画的节点和边 ----
    var domIds = M.doms.map(function (d) { return d.id; }).filter(function (d) {
      return Object.keys(M.all).some(function (id) { return M.all[id].domain === d; });
    });
    if (single) domIds = domIds.filter(function (d) { return d === o.filterDomain; });
    function domIdx(d) { var i = domIds.indexOf(d); return i < 0 ? 99 : i; }
    function domName(d) { return (M.domById[d] && M.domById[d].name) || DOMAIN_NAME[d] || String(d); }
    function domFull(d) { return (M.domById[d] && M.domById[d].full) || domName(d); }
    function titleOf(id) { var n = M.all[id]; return n ? (n.title || id) : id; }

    var drawn = {};
    if (mini) {
      if (o.focusId != null && M.all[o.focusId]) {
        drawn[o.focusId] = 1;
        M.edges.forEach(function (e) {
          if (e.s === o.focusId) drawn[e.t] = 1;
          if (e.t === o.focusId) drawn[e.s] = 1;
        });
      }
    } else {
      Object.keys(M.all).forEach(function (id) { if (domIds.indexOf(M.all[id].domain) > -1) drawn[id] = 1; });
    }
    var recs = Object.keys(drawn).map(function (id) {
      var n = M.all[id];
      return { id: id, n: n, dom: n.domain, r: radius(n), shape: shapeOf(n.domain), vis: true, learned: false, isNext: false };
    }).sort(function (a, b) {
      return domIdx(a.dom) - domIdx(b.dom) || (a.n.order || 999) - (b.n.order || 999) || String(a.n.title).localeCompare(String(b.n.title));
    });
    var byId = {};
    recs.forEach(function (r) {
      byId[r.id] = r;
      var t = r.n.title || r.id;
      r.labF = fitText(t, LABEL_PX, 128); r.lwF = textW(r.labF, LABEL_PX);
      r.labC = fitText(t, LABEL_PX, 140); r.lwC = textW(r.labC, LABEL_PX);
      r.lwF = r.lwF; r.deg = 0;
    });
    var edges = M.edges.filter(function (e) {
      if (!byId[e.s] || !byId[e.t]) return false;
      if (mini) return e.s === o.focusId || e.t === o.focusId;
      return true;
    }).map(function (e) {
      byId[e.s].deg++; byId[e.t].deg++;
      return { e: e, a: byId[e.s], b: byId[e.t], cross: !!e.cross, kind: e.kind, label: e.label, vis: true };
    });
    var stageList = {};
    domIds.forEach(function (d) { stageList[d] = stagesOf(M, d); });

    // ---- DOM 骨架 ----
    var bar = null, stage = h('div', { class: 'kgg-stage' });
    if (!mini) { bar = h('div', { class: 'kgg-bar' }); root.appendChild(bar); }
    root.appendChild(stage);
    if (!mini && o.height) stage.style.height = (+o.height) + 'px';

    var svg = s('svg', { class: 'kgg-svg', role: 'group', 'aria-label': (single ? domFull(o.filterDomain) + ' · ' : mini ? '相邻知识点 · ' : '') + '知识图谱，' + recs.length + ' 个知识点' });
    var defs = s('defs');
    [['ah', 'kgg-ah'], ['ah-on', 'kgg-ah on']].forEach(function (m) {
      var mk = s('marker', { id: ID + '-' + m[0], viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' });
      mk.appendChild(s('path', { class: m[1], d: 'M0,1L10,5L0,9Z' }));
      defs.appendChild(mk);
    });
    svg.appendChild(defs);
    var gView = s('g', { class: 'kgg-view' }), gFrames = s('g'), gEdges = s('g'), gHits = s('g'), gNodes = s('g');
    gView.appendChild(gFrames); gView.appendChild(gEdges); gView.appendChild(gHits); gView.appendChild(gNodes);
    var gLabels = s('g', { class: 'kgg-labels', 'aria-hidden': 'true' });
    svg.appendChild(gView); svg.appendChild(gLabels);
    stage.appendChild(svg);
    var tip = h('div', { class: 'kgg-tip', hidden: true, role: 'tooltip', id: ID + '-tip' });
    var empty = h('div', { class: 'kgg-empty', hidden: true });
    stage.appendChild(empty);
    stage.appendChild(tip);
    var legend = null, zoomBox = null, panel = null, listBox = null, moreBtn = null;
    var sphere = null, sphereHost = null, sphereKey = '', spherePlaying;
    var cloudDialog = null, cloudContent = null, cloudOpener = null, bodyOverflow = '';

    function closeCloudDialog(returnFocus) {
      if (!cloudDialog) return;
      var dialog = cloudDialog; cloudDialog = null;
      if (sphereHost) stage.insertBefore(sphereHost, tip);
      if (panel) stage.appendChild(panel);
      cloudContent = null;
      dialog.close(); dialog.remove(); document.body.style.overflow = bodyOverflow;
      if (!st.destroyed) {
        doLayout(); applyHighlight();
        if (st.panelId) ensureVisible(st.panelId, false);
        if (returnFocus) {
          var opener = cloudOpener && cloudOpener.isConnected ? cloudOpener : segBtns.sphere;
          if (opener) opener.focus({ preventScroll: true });
        }
      }
      cloudOpener = null;
    }
    function openCloudDialog() {
      if (mini || st.destroyed || !sphereMode() || cloudDialog) return;
      cloudOpener = document.activeElement;
      cloudDialog = h('dialog', { class: 'kgg-cloud-dialog', 'aria-label': '3D 知识云，按 Esc 退出', tabindex: -1, autofocus: true });
      var card = h('div', { class: 'kgg-cloud-card' });
      cloudContent = h('div', { class: 'kgg kgg-cloud-content' });
      cloudContent.appendChild(sphereHost);
      if (panel) cloudContent.appendChild(panel);
      card.appendChild(cloudContent); cloudDialog.appendChild(card); document.body.appendChild(cloudDialog);
      bodyOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
      cloudDialog.addEventListener('cancel', function (e) { e.preventDefault(); closePanel(false); closeCloudDialog(true); });
      cloudDialog.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); closePanel(false); closeCloudDialog(true); } });
      cloudDialog.showModal(); cloudDialog.focus({ preventScroll: true });
      doLayout(); applyHighlight();
    }

    // ---- 节点 ----
    recs.forEach(function (r) {
      var isFocus = mini && r.id === o.focusId;
      var g = s('g', { class: 'kgg-n' + (isFocus ? ' cur' : ''), 'data-node-id': r.id, tabindex: isFocus ? -1 : 0, role: isFocus ? 'img' : 'button', 'aria-describedby': ID + '-tip' });
      g.style.setProperty('--kc', domColor(r.dom));
      // 迷你图的当前节点：放大一号，背后垫一圈浅色领域色光晕（不用焦点环，免得和别的领域色混淆）
      if (isFocus) { r.r = Math.round(r.r * 1.3 * 10) / 10; g.appendChild(s('circle', { class: 'kgg-halo', r: r.r + 9 })); }
      g.appendChild(s('circle', { class: 'kgg-hit', r: Math.max(15, r.r + 7) }));
      r.ring = s('path', { class: 'kgg-ring', d: shapePath(r.shape, r.r + 4.5) });
      g.appendChild(r.ring);
      g.appendChild(s('path', { class: 'kgg-shape', d: shapePath(r.shape, r.r) }));
      g.appendChild(s('path', { class: 'kgg-fring', d: shapePath(r.shape, r.r + 4.5) }));
      r.el = g;
      gNodes.appendChild(g);
      var lab = s('g', { class: 'kgg-lab nl' });
      r.text = s('text', { y: 0 });
      lab.appendChild(r.text);
      r.labEl = lab;
      gLabels.appendChild(lab);
    });
    // 「下一步」小标签
    var pill = s('g', { class: 'kgg-pill' });
    var pillW = Math.ceil(textW('下一步', 10.5, 600)) + 12;
    pill.appendChild(s('rect', { x: -pillW / 2, y: -9, width: pillW, height: 17, rx: 8.5 }));
    var pt = s('text', { 'text-anchor': 'middle', y: 3.5 }); pt.textContent = '下一步';
    pill.appendChild(pt);
    gLabels.appendChild(pill);

    // ---- 边 ----
    edges.forEach(function (E) {
      var p = s('path', { class: 'kgg-e ' + (E.cross ? 'crs' : 'pre') });
      E.el = p;
      gEdges.appendChild(p);
      if (E.cross) { E.hit = s('path', { class: 'kgg-ehit' }); gHits.appendChild(E.hit); }
    });

    var heads = [];   // 分栏布局的栏头和阶段名（屏幕坐标层）
    var frames = [], colBW = COL.BW, forceCache = {};
    function clearHeads() { heads.forEach(function (hd) { hd.el.remove(); }); heads = []; while (gFrames.firstChild) gFrames.removeChild(gFrames.firstChild); }

    function stageW() { return stage.clientWidth || root.clientWidth || 800; }
    function stageH() { return stage.clientHeight || 560; }
    function getNext() { try { return typeof o.nextId === 'function' ? o.nextId() : o.nextId; } catch (e) { return null; } }
    function learned(id) { try { return !!(o.isLearned && o.isLearned(id)); } catch (e) { return false; } }
    function columnsMode() { return !mini && st.layout === 'columns'; }
    function sphereMode() { return !mini && st.layout === 'sphere'; }
    function sphereEntries() {
      var maxDegree = Math.max.apply(null, recs.map(function (r) { return r.deg; }).concat([1]));
      // Interleave domains so each group shows a mix of topics instead of one long block.
      var groups = domIds.map(function (id) { return recs.filter(function (r) { return r.dom === id && r.vis; }).sort(function (a, b) { return b.deg - a.deg || a.id.localeCompare(b.id); }); });
      var result = [], index = 0;
      while (groups.some(function (group) { return group.length > index; })) {
        groups.forEach(function (group) {
          var r = group[index]; if (!r) return;
          var title = r.n.title || r.id, shortTitle = title.split(/[：:]/)[0];
          var keyword = shortTitle.split(/[、，]|与|及/)[0].trim();
          if (keyword.length >= 3) shortTitle = keyword;
          result.push({ id: r.id, title: title, label: fitText(shortTitle.length >= 3 ? shortTitle : title, 17, stageW() < 560 ? 112 : 148, 600), domain: r.dom, weight: r.deg / maxDegree, learned: learned(r.id), next: r.id === getNext(), aria: ariaFor(r) });
        });
        index++;
      }
      return result;
    }
    function destroySphere() {
      if (sphere) { spherePlaying = sphere.isPlaying(); sphere.destroy(); sphere = null; }
      sphereKey = '';
      if (sphereHost) sphereHost.hidden = true;
    }

    // ---- 布局 ----
    function layoutKey() {
      var W = stageW(), H = stageH();
      if (mini) return 'm' + Math.round(W);
      if (sphereMode()) return 'sphere|' + W + '|' + H;
      if (st.layout === 'force') return 'f' + aspectBucket(W, H - legendH()) + (W < 560 ? 'n' : 'w');
      return st.layout + '|' + (colsFor(W) + '|' + Math.round(W / 40)) + '|' + Math.round((H - legendH()) / 40) + '|' + Object.keys(st.hidden).filter(function (d) { return st.hidden[d]; }).join(',');
    }
    function doLayout() {
      var W = stageW(), H = stageH();
      root.classList.toggle('kgg--sphere', sphereMode());
      root.setAttribute('data-layout', mini ? 'mini' : st.layout);
      gLabels.style.display = sphereMode() ? 'none' : '';
      svg.style.visibility = st.list || sphereMode() ? 'hidden' : '';
      var V = { nodes: recs, edges: edges, domIds: domIds, single: single, byId: byId, stageList: stageList, domName: domName, domIdx: domIdx, focusId: o.focusId };
      recs.forEach(function (r) { r.placed = true; r.vis = mini || !st.hidden[r.dom]; });
      if (sphereMode() && window.KGSphereCloud && window.KGNebulaRuntime) {
        clearHeads();
        if (!sphereHost) { sphereHost = h('div', { class: 'kgg-sphere-host' }); stage.insertBefore(sphereHost, tip); }
        sphereHost.hidden = st.list;
        var entries = sphereEntries(), key = entries.map(function (entry) { return entry.id; }).join('|');
        if (sphere && key === sphereKey) { sphere.refresh(entries); sphere.resize(); }
        else {
          destroySphere(); sphereHost.hidden = st.list;
          var relations = edges.filter(function (E) { return E.a.vis && E.b.vis; }).map(function (E) { return { source: E.a.id, target: E.b.id, kind: E.kind, label: E.label, cross: E.cross }; });
          sphere = window.KGSphereCloud.mount(sphereHost, { entries: entries, links: relations, playing: spherePlaying, onExpand: openCloudDialog, onSelect: function (id, kb) { openPanel(id, kb); } });
          sphereKey = key;
        }
        sphere.setBlocked(st.list || !!st.panelId);
        st.layoutKey = layoutKey(); syncDisplay(); updateMore();
        return;
      }
      destroySphere();
      if (mini && !recs.length) {
        svg.setAttribute('height', 0); svg.style.height = '0px';
      } else if (mini) {
        recs.forEach(function (r) { r.lab = fitText(r.n.title || r.id, LABEL_PX, Math.max(56, W * 0.3)); r.lw = textW(r.lab, LABEL_PX); });
        layoutMini(V, W);
        svg.setAttribute('height', V.miniH);
        svg.style.height = V.miniH + 'px';
      } else if (st.layout === 'force') {
        recs.forEach(function (r) { r.lab = r.labF; r.lw = r.lwF; });
        var fk = layoutKey(), cached = forceCache[fk];
        if (cached) recs.forEach(function (r) { r.x = cached[r.id][0]; r.y = cached[r.id][1]; });
        else {
          layoutForce(V, W, H - legendH());
          cached = forceCache[fk] = {};
          recs.forEach(function (r) { cached[r.id] = [r.x, r.y]; });
        }
      } else {
        V.nodes = recs.filter(function (r) { return r.vis; });
        V.domIds = domIds.filter(function (d) { return !st.hidden[d]; });
        recs.forEach(function (r) { r.lab = r.labC; r.lw = r.lwC; r.placed = r.vis; });
        layoutColumns(V, W, H - legendH());
        colBW = V.bw;
      }
      frames = V.frames || [];
      st.layoutKey = layoutKey();
      clearHeads();
      (V.frames || []).forEach(function (f) { gFrames.appendChild(s('rect', { class: 'kgg-frame', x: f.x, y: f.y, width: f.w, height: f.h, rx: 10 })); });
      (V.heads || []).forEach(function (hd) {
        var g = s('g', { class: 'kgg-lab ' + hd.kind });
        var x0 = 0;
        if (hd.dom) {
          var ic = s('path', { d: shapePath(shapeOf(hd.dom), 5), transform: 'translate(6,-4.5)' });
          ic.setAttribute('style', 'fill:' + domColor(hd.dom) + ';stroke:' + domColor(hd.dom) + ';stroke-width:1.5');
          g.appendChild(ic);
          x0 = 18;
        }
        var px = hd.kind === 'hdr' ? 13 : 11.5, wt = hd.kind === 'hdr' ? 600 : 400;
        var tx = s('text', { x: x0 }); tx.textContent = hd.text;
        g.appendChild(tx);
        hd.el = g; hd.tx = tx; hd.px = px; hd.wt = wt; hd.x0 = x0; hd.cur = hd.text;
        hd.fullW = textW(hd.text, px, wt); hd.w = x0 + hd.fullW; hd.hgt = px + 4;
        gLabels.insertBefore(g, gLabels.firstChild);
        heads.push(hd);
      });
      recs.forEach(function (r) {
        r.text.textContent = r.lab || '';
        r.anchor = columnsMode() ? 'start' : 'middle';
        r.text.setAttribute('text-anchor', r.anchor);
        r.el.setAttribute('transform', 'translate(' + (Math.round(r.x * 10) / 10) + ',' + (Math.round(r.y * 10) / 10) + ')');
      });
      drawEdges();
      syncDisplay();
    }

    function drawEdges() {
      var cols = columnsMode();
      edges.forEach(function (E) {
        var g = cols ? columnBez(E) : forceBez(E, mini);
        var P = g.rev ? E.b : E.a, Q = g.rev ? E.a : E.b;
        var q = trimBez(g.p, edgeR(P), edgeR(Q));
        E.ok = !!q;
        if (!q) { E.el.removeAttribute('d'); if (E.hit) E.hit.removeAttribute('d'); return; }
        var d = bezD(q);
        E.el.setAttribute('d', d);
        if (E.hit) E.hit.setAttribute('d', d);
        E.mk = E.cross ? null : (g.rev ? 'marker-start' : 'marker-end');
        E.el.removeAttribute('marker-start'); E.el.removeAttribute('marker-end');
        if (E.mk) E.el.setAttribute(E.mk, 'url(#' + ID + '-ah)');
      });
    }

    // 按当前筛选显示 / 隐藏
    function syncDisplay() {
      recs.forEach(function (r) {
        r.vis = mini || !st.hidden[r.dom];
        var show = r.vis && r.placed;
        r.el.style.display = show ? '' : 'none';
        r.labEl.style.display = show ? '' : 'none';
      });
      edges.forEach(function (E) {
        E.vis = !sphereMode() && E.a.vis && E.b.vis && E.a.placed && E.b.placed && E.ok !== false && (E.cross ? st.showCross : st.showPre);
        E.el.style.display = E.vis ? '' : 'none';
        if (E.hit) E.hit.style.display = E.vis ? '' : 'none';
      });
      var any = recs.some(function (r) { return r.vis; });
      empty.hidden = sphereMode() || (any && recs.length > 0);
      empty.textContent = !recs.length ? (mini ? '暂无相邻的知识点' : '没有可显示的知识点') : '请至少选择一个领域';
      if (mini && recs.length === 1) { empty.hidden = false; empty.textContent = '暂无直接相连的知识点'; }
    }

    // ---- 缩放平移 ----
    var zoom = null, rafId = 0;
    if (!mini) {
      zoom = d3.zoom().scaleExtent([0.15, 4]).clickDistance(5)
        .filter(function (e) {
          // 滚轮：全景直接缩放；分栏和知识云上下滚动；Ctrl/⌘ + 滚轮仍可缩放。
          if (e.type === 'wheel') return e.ctrlKey || e.metaKey || (!single && !columnsMode());
          return !e.ctrlKey && !e.button;
        })
        .on('start', function (e) { if (e.sourceEvent && e.sourceEvent.type !== 'wheel') svg.classList.add('grabbing'); })
        .on('end', function () { svg.classList.remove('grabbing'); })
        .on('zoom', function (e) {
          st.t = e.transform;
          gView.setAttribute('transform', e.transform.toString());
          if (e.sourceEvent) { st.userZoomed = true; st.focused = false; hideTip(); }
          schedule();
        });
      d3.select(svg).call(zoom).on('dblclick.zoom', null);
      svg.addEventListener('wheel', function (e) {
        if (single || !columnsMode() || e.ctrlKey || e.metaKey || !st.cb || st.list) return;
        var t = st.t, H = stageH(), k = t.k, b = colBounds();
        var unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1;
        var dy = e.deltaY * unit, dx = e.deltaX * unit;
        if (e.shiftKey && !dx) { dx = dy; dy = 0; }
        var ny = b.lo < b.hi ? clamp(t.y - dy, b.lo, b.hi) : t.y;
        var nx = b.loX < b.hiX ? clamp(t.x - dx, b.loX, b.hiX) : t.x;
        if (Math.abs(ny - t.y) < 0.5 && Math.abs(nx - t.x) < 0.5) return;   // 到头了：让页面自己滚
        e.preventDefault();
        hideTip();
        st.userZoomed = true; st.focused = false;
        d3.select(svg).interrupt().call(zoom.transform, d3.zoomIdentity.translate(nx, ny).scale(k));
      }, { passive: false });
    }
    // 分栏布局里内容能上下滚动的范围（平移量 y 的上下限）；lo < hi 说明放不下、可以滚
    function colBounds() {
      var W = stageW(), H = stageH(), k = st.t.k, cb = st.cb || [0, 0, 0, 0];
      return { lo: H - 14 - legendH() - cb[3] * k, hi: 14 - cb[1] * k, loX: W - 14 - cb[2] * k, hiX: 14 - cb[0] * k };
    }
    // 分栏内容超出画布时，右下角显示「向下滚动」按钮；滚到底后变成「回到顶部」
    function updateMore() {
      if (!moreBtn) return;
      var show = columnsMode() && !st.list && !!st.cb, b = show ? colBounds() : null;
      if (show && b.lo >= b.hi - 1) show = false;
      moreBtn.hidden = !show;
      if (!show) return;
      var up = st.t.y <= b.lo + 2;
      if (moreBtn.getAttribute('data-dir') !== (up ? 'up' : 'down')) {
        moreBtn.setAttribute('data-dir', up ? 'up' : 'down');
        moreBtn.lastChild.textContent = up ? '回到顶部' : '向下滚动看更多';
      }
      // 和图例挤在一行放不下时，挪到图例上方
      var W = stageW(), lw = legend && !legend.hidden ? legend.offsetLeft + legend.offsetWidth : 0;
      moreBtn.style.bottom = (lw && lw + 12 + moreBtn.offsetWidth > W - 10 ? legendH() + 2 : 10) + 'px';
    }
    function scrollMore() {
      if (!st.cb) return;
      var t = st.t, b = colBounds(), up = moreBtn.getAttribute('data-dir') === 'up';
      var ny = up ? b.hi : clamp(t.y - (stageH() - legendH()) * 0.7, b.lo, b.hi);
      st.userZoomed = true; st.focused = false;
      setT(d3.zoomIdentity.translate(t.x, ny).scale(t.k), true);
    }
    function setT(t, animate) {
      if (!zoom) return;
      var sel = d3.select(svg);
      sel.interrupt();
      if (animate && !reducedMotion()) sel.transition().duration(420).call(zoom.transform, t);
      else sel.call(zoom.transform, t);
    }
    function schedule() {
      if (rafId) return;
      rafId = requestAnimationFrame(function () { rafId = 0; if (!st.destroyed) placeLabels(); });
    }
    function legendH() { return legend && !legend.hidden && !st.list ? legend.offsetHeight + 12 : 0; }
    function fit(animate) {
      if (sphereMode()) return;
      if (!zoom) return;
      var W = stageW(), H = stageH(), vis = recs.filter(function (r) { return r.vis && r.placed; });
      if (!vis.length) return;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, cols = columnsMode();
      if (cols && frames.length) frames.forEach(function (f) {
        x0 = Math.min(x0, f.x); y0 = Math.min(y0, f.y); x1 = Math.max(x1, f.x + f.w); y1 = Math.max(y1, f.y + f.h);
      });
      else vis.forEach(function (r) {
        var ex = Math.max(r.r, r.lw / 2);
        x0 = Math.min(x0, r.x - ex); x1 = Math.max(x1, r.x + ex);
        y0 = Math.min(y0, r.y - r.r - 22); y1 = Math.max(y1, r.y + r.r + 20);
      });
      st.cb = [x0, y0, x1, y1];
      var padL = 14, padR = W > 640 ? 50 : 14, padT = 14, padB = 14 + legendH();
      var bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
      var kw = (W - padL - padR) / bw, kh = (H - padT - padB) / bh, k = Math.min(kw, kh), top = false;
      if (cols && k < 0.62) { k = Math.min(kw, 0.62); top = true; }
      k = clamp(k, 0.15, 1.25);
      var tx = padL + (W - padL - padR - bw * k) / 2 - x0 * k;
      var ty = (top ? padT : padT + (H - padT - padB - bh * k) / 2) - y0 * k;
      st.userZoomed = false; st.focused = false;
      setT(d3.zoomIdentity.translate(tx, ty).scale(k), animate);
    }
    function zoomBy(f) {
      if (!zoom) return;
      var sel = d3.select(svg);
      sel.interrupt();
      st.userZoomed = true; st.focused = false;
      if (reducedMotion()) zoom.scaleBy(sel, f); else zoom.scaleBy(sel.transition().duration(250), f);
    }

    // ---- 标签：屏幕坐标、固定 12px，放不下的隐藏（优先：当前节点 > 下一步 > 高亮集合 > level 低 > order 小） ----
    function placeLabels() {
      var t = st.t, cols = columnsMode(), W = stageW(), H = stageH();
      if (sphereMode()) return;
      var boxes = [], nodeBoxes = [];
      function overlaps(b, list, skip) {
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          if (skip != null && c[4] === skip) continue;
          if (b[0] < c[0] + c[2] && c[0] < b[0] + b[2] && b[1] < c[1] + c[3] && c[1] < b[1] + b[3]) return true;
        }
        return false;
      }
      function offStage(b) { return b[0] < 2 || b[0] + b[2] > W - 2 || b[1] < 2 || b[1] + b[3] > H - 2; }
      function coverArea(b, list, skip) {
        var a = 0;
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          if (skip != null && c[4] === skip) continue;
          var ox = Math.min(b[0] + b[2], c[0] + c[2]) - Math.max(b[0], c[0]), oy = Math.min(b[1] + b[3], c[1] + c[3]) - Math.max(b[1], c[1]);
          if (ox > 0 && oy > 0) a += ox * oy;
        }
        return a;
      }
      var showRecs = recs.filter(function (r) { return r.vis && r.placed; }), pillNodes = [];
      showRecs.forEach(function (r) {
        r.sx = t.applyX(r.x); r.sy = t.applyY(r.y);
        var rk = r.r * t.k, q = rk * 0.85, sx = r.sx, sy = r.sy, g = (r.r + 3) * t.k + 2, e = rk * 1.15 + 2;
        nodeBoxes.push([sx - q, sy - q, 2 * q, 2 * q, r.id]);
        pillNodes.push([sx - e, sy - e, 2 * e, 2 * e, r.id]);
        if (cols) {
          // 栏宽随缩放变化：放不下的长标题截断，完整标题在提示框和侧面板里
          var avail = Math.max(40, (colBW - COL.NODE_X - r.r - 16) * t.k);
          var lab = r.lwC > avail ? fitText(r.n.title || r.id, LABEL_PX, avail) : r.labC;
          if (lab !== r.lab) { r.lab = lab; r.lw = textW(lab, LABEL_PX); r.text.textContent = lab; }
          r.cands = [[[sx + g, sy - 9, r.lw + 4, 17], sx + g + 2, sy + 4, 'start']];
        } else {
          // 候选位置：下、右、左、上，依次尝试
          var w = r.lw;
          r.cands = [
            [[sx - w / 2 - 2, sy + g, w + 4, 16], sx, sy + g + 12, 'middle'],
            [[sx + g, sy - 9, w + 4, 17], sx + g + 2, sy + 4, 'start'],
            [[sx - g - w - 4, sy - 9, w + 4, 17], sx - g - 2, sy + 4, 'end'],
            [[sx - w / 2 - 2, sy - g - 16, w + 4, 16], sx, sy - g - 4, 'middle']
          ];
        }
        r.box = r.cands[0][0];
      });
      heads.forEach(function (hd) {
        var x = t.applyX(hd.x), y = t.applyY(hd.y);
        var availH = Math.max(30, hd.maxW * t.k);
        var txt = hd.fullW > availH ? fitText(hd.text, hd.px, availH, hd.wt) : hd.text;
        if (txt !== hd.cur) { hd.cur = txt; hd.tx.textContent = txt; hd.w = hd.x0 + textW(txt, hd.px, hd.wt); }
        hd.el.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')');
        var b = [x - 2, y - hd.hgt + 3, hd.w + 4, hd.hgt + 2];
        var hide = overlaps(b, boxes) && hd.kind === 'stg';
        hd.el.classList.toggle('cull', hide);
        if (!hide) boxes.push(b);
      });
      var next = recs.filter(function (r) { return r.isNext && r.vis && r.placed; })[0];
      pill.style.display = next ? '' : 'none';
      if (next) {
        // 分栏：标题右边；全景：先试节点上方，再试右、左、下，避开别的节点和栏头
        var px, py;
        if (cols) { px = next.box[0] + next.box[2] + 4 + pillW / 2; py = next.sy; }
        else {
          // 八个候选位置按顺序试，第一个完全不挡东西的直接用；都挡的话取压住面积最小的
          var gp = (next.r + 4.5) * t.k, dg = gp * 0.72, hw = pillW / 2, sx0 = next.sx, sy0 = next.sy;
          var pc = [[sx0, sy0 - gp - 12], [sx0 + gp + 5 + hw, sy0], [sx0 - gp - 5 - hw, sy0], [sx0, sy0 + gp + 12],
            [sx0 + dg + hw, sy0 - dg - 9], [sx0 - dg - hw, sy0 - dg - 9], [sx0 + dg + hw, sy0 + dg + 9], [sx0 - dg - hw, sy0 + dg + 9]];
          var best = 0, bestS = Infinity;
          for (var pi = 0; pi < pc.length; pi++) {
            var pb = [pc[pi][0] - hw - 2, pc[pi][1] - 11, pillW + 4, 21];   // 四周留 2px
            var sc = (offStage(pb) ? 1e7 : 0) + coverArea(pb, boxes) + 3 * coverArea(pb, pillNodes, next.id);
            if (sc < bestS) { bestS = sc; best = pi; }
            if (!sc) break;
          }
          px = pc[best][0]; py = pc[best][1];
        }
        pill.setAttribute('transform', 'translate(' + px.toFixed(1) + ',' + py.toFixed(1) + ')');
        boxes.push([px - pillW / 2, py - 9, pillW, 17, '_pill']);
      }
      var me = st.hoverEdge ? null : (st.hover || st.sel);
      var on = st.onSet || {};
      var order = showRecs.slice().sort(function (a, b) {
        var pa = (a.id === me ? 0 : a.isNext ? 1 : on[a.id] ? 2 : 3), pb = (b.id === me ? 0 : b.isNext ? 1 : on[b.id] ? 2 : 3);
        return pa - pb || (a.n.level || 2) - (b.n.level || 2) || b.deg - a.deg || (a.n.order || 0) - (b.n.order || 0);
      });
      order.forEach(function (r) {
        var forced = r.id === me || (st.hoverEdge && on[r.id]);
        var pick = null;
        for (var c = 0; c < r.cands.length && !pick; c++) {
          var b = r.cands[c][0];
          if (offStage(b) && !forced) continue;
          if (forced || (!overlaps(b, boxes) && !overlaps(b, nodeBoxes, r.id))) pick = r.cands[c];
        }
        r.labEl.classList.toggle('cull', !pick);
        r.labEl.classList.toggle('me', r.id === me);
        if (!pick) return;
        r.box = pick[0];
        boxes.push(pick[0]);
        r.labEl.setAttribute('transform', 'translate(' + pick[1].toFixed(1) + ',' + pick[2].toFixed(1) + ')');
        if (r.anchor !== pick[3]) { r.anchor = pick[3]; r.text.setAttribute('text-anchor', pick[3]); }
      });
      updateMore();
    }

    // ---- 高亮 ----
    function applyHighlight() {
      var on = null, onE = null;
      if (st.hoverEdge && st.hoverEdge.vis) {
        on = {}; on[st.hoverEdge.a.id] = 1; on[st.hoverEdge.b.id] = 1; onE = [st.hoverEdge];
      } else {
        var id = st.hover || st.sel;
        if (id && byId[id] && byId[id].vis) {
          on = {}; on[id] = 1; onE = [];
          edges.forEach(function (E) {
            if ((!E.vis && !sphereMode()) || !E.a.vis || !E.b.vis || (E.a.id !== id && E.b.id !== id)) return;
            onE.push(E); on[E.a.id] = 1; on[E.b.id] = 1;
          });
        } else if (st.query && !mini) {
          on = {}; onE = [];
          searchHits(st.query).forEach(function (r) { on[r.id] = 1; });
        }
      }
      st.onSet = on;
      if (sphere) sphere.setHighlight(on);
      stage.classList.toggle('kgg-dim', !!on);
      recs.forEach(function (r) {
        var x = !!on && !!on[r.id];
        r.el.classList.toggle('on', x); r.labEl.classList.toggle('on', x);
        r.el.classList.toggle('sel', r.id === st.sel);
        if (r.isNext) pill.classList.toggle('on', x);
      });
      edges.forEach(function (E) {
        var x = !!onE && onE.indexOf(E) > -1;
        E.el.classList.toggle('on', x);
        if (E.mk) E.el.setAttribute(E.mk, 'url(#' + ID + (x ? '-ah-on' : '-ah') + ')');
        if (x) E.el.parentNode.appendChild(E.el);
      });
      placeLabels();
    }

    // ---- 节点状态 ----
    function ariaFor(r) {
      var state = r.learned ? '已掌握' : '未掌握';
      if (r.isNext) state += '，推荐下一步';
      var tail = mini ? (r.id === o.focusId ? '。当前知识点' : '。回车打开') : '。回车查看详情';
      return (r.n.title || r.id) + '，' + domName(r.dom) + '，' + (LEVEL[r.n.level] || '') + '，' + state + tail;
    }
    function updateStates() {
      var next = getNext();
      recs.forEach(function (r) {
        r.learned = learned(r.id);
        r.isNext = r.id === next;
        r.el.classList.toggle('learned', r.learned);
        r.el.classList.toggle('is-next', r.isNext);
        r.ring.style.display = r.isNext ? '' : 'none';
        r.el.setAttribute('aria-label', ariaFor(r));
      });
      if (st.panelId) renderPanel(st.panelId, true);
      if (sphere) sphere.refresh(sphereEntries());
      if (st.list) renderList();
      applyHighlight();
    }

    // ---- 提示框 ----
    function hideTip() { tip.hidden = true; }
    function tipAt(px, py) {
      var W = stageW(), H = stageH(), w = tip.offsetWidth, hh = tip.offsetHeight;
      var x = px + 14, y = py + 16;
      if (x + w > W - 6) x = Math.max(6, px - 14 - w);
      if (y + hh > H - 6) y = Math.max(6, py - 16 - hh);
      tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    }
    function stateText(id) { return learned(id) ? '已掌握' : (id === getNext() ? '下一步' : '未掌握'); }
    function relText(sId, tId, kind) {
      var A = titleOf(sId), B = titleOf(tId);
      if (kind === 'uses') return A + ' 用到 ' + B;
      if (kind === 'implements') return A + ' 实现了 ' + B;
      if (kind === 'analogy') return A + ' 与 ' + B + ' 思想相通';
      if (kind === 'applies') return A + ' 是 ' + B + ' 的应用';
      if (kind === 'prereq') return '先懂 ' + A + '，再学 ' + B;
      return A + ' · ' + B;
    }
    function showTipNode(r, px, py) {
      tip.textContent = '';
      tip.appendChild(h('div', { class: 't', text: r.n.title || r.id }));
      if (r.n.en) tip.appendChild(h('div', { class: 'en', text: r.n.en }));
      var meta = h('div', { class: 'meta' });
      meta.appendChild(h('span', { html: iconSVG(r.dom, r.learned ? 'fill' : 'outline', 12) }, [domName(r.dom)]));
      if (LEVEL[r.n.level]) meta.appendChild(h('span', { text: LEVEL[r.n.level] }));
      meta.appendChild(h('span', { text: stateText(r.id) }));
      tip.appendChild(meta);
      if (r.n.oneLiner) tip.appendChild(h('div', { class: 'd', text: r.n.oneLiner }));
      tip.hidden = false;
      tipAt(px, py);
    }
    function showTipEdge(E, px, py) {
      tip.textContent = '';
      tip.appendChild(h('div', { class: 'kind', text: '跨领域联系 · ' + (KIND[E.kind] || E.kind || '') }));
      var rel = h('div', { class: 'rel' });
      rel.appendChild(h('span', { html: iconSVG(E.a.dom, E.a.learned ? 'fill' : 'outline', 12) }, [E.a.n.title || E.a.id]));
      rel.appendChild(h('span', { html: ICON.arrow }));
      rel.appendChild(h('span', { html: iconSVG(E.b.dom, E.b.learned ? 'fill' : 'outline', 12) }, [E.b.n.title || E.b.id]));
      tip.appendChild(rel);
      tip.appendChild(h('div', { class: 'd', text: E.label || relText(E.a.id, E.b.id, E.kind) }));
      tip.hidden = false;
      tipAt(px, py);
    }

    // ---- 侧面板 ----
    function goTo(id) {
      if (byId[id] && !mini) focusNode(id, { open: true });
      else if (typeof o.onOpen === 'function') o.onOpen(id);
    }
    function renderPanel(id, keep) {
      var n = M.all[id];
      if (!n || !panel) return;
      var ae = document.activeElement;
      var refocus = keep && ae && panel.contains(ae) && ae.classList.contains('kgg-switch');
      var scroll = panel.scrollTop;
      panel.textContent = '';
      panel.style.setProperty('--kc', domColor(n.domain));
      panel.appendChild(h('button', { class: 'x', type: 'button', 'aria-label': '关闭详情', title: '关闭（Esc）', html: ICON.close, onclick: function () { closePanel(true); } }));
      panel.appendChild(h('h3', { tabindex: '-1', text: n.title || id }));
      if (n.en) panel.appendChild(h('div', { class: 'en', text: n.en }));
      var L = learned(id);
      var meta = h('div', { class: 'meta' });
      meta.appendChild(h('span', { class: 'kgg-badge', html: iconSVG(n.domain, L ? 'fill' : 'outline', 12) }, [domFull(n.domain)]));
      if (LEVEL[n.level]) meta.appendChild(h('span', { class: 'kgg-badge', text: LEVEL[n.level] }));
      if (n.estMinutes) meta.appendChild(h('span', { class: 'kgg-badge', text: '约 ' + n.estMinutes + ' 分钟' }));
      if (!L && id === getNext()) meta.appendChild(h('span', { class: 'kgg-badge', html: iconSVG('neutral', 'next', 12) }, ['推荐下一步']));
      panel.appendChild(meta);
      if (n.oneLiner) panel.appendChild(h('p', { class: 'one', text: n.oneLiner }));
      var acts = h('div', { class: 'acts' });
      if (typeof o.onToggleLearned === 'function') {
        acts.appendChild(h('button', {
          class: 'kgg-switch', type: 'button', role: 'switch', 'aria-checked': L ? 'true' : 'false',
          onclick: function () {
            try { o.onToggleLearned(id, !learned(id)); } catch (e) { if (window.console) console.error(e); }
            updateStates();
          }
        }, [h('span', { class: 'trk', 'aria-hidden': 'true' }, [h('span', { class: 'kn' })]), h('span', { text: '已掌握' })]));
      }
      if (typeof o.onOpen === 'function') {
        acts.appendChild(h('button', { class: 'kgg-go', type: 'button', onclick: function () { o.onOpen(id); } }, ['开始学习', h('span', { html: ICON.arrow, style: 'display:inline-flex' })]));
      }
      if (acts.childNodes.length) panel.appendChild(acts);

      var pre = [], post = [], cross = [], seenP = {}, seenN = {};
      M.edges.forEach(function (e) {
        if (e.cross) { if (e.s === id || e.t === id) cross.push(e); return; }
        if (e.t === id && !seenP[e.s]) { seenP[e.s] = 1; pre.push(e.s); }
        else if (e.s === id && !seenN[e.t]) { seenN[e.t] = 1; post.push(e.t); }
      });
      (n.prereqs || []).forEach(function (p) { if (M.all[p] && !seenP[p]) { seenP[p] = 1; pre.push(p); } });
      function item(oid, sub, tag) {
        var on = M.all[oid], L2 = learned(oid);
        var b = h('button', { class: 'kgg-item', type: 'button', html: iconSVG(on.domain, L2 ? 'fill' : 'outline', 13), onclick: function () { goTo(oid); } });
        var tt = h('span', { class: 'tt' }, [on.title || oid]);
        if (sub) tt.appendChild(h('span', { class: 'lb', text: sub }));
        b.appendChild(tt);
        b.appendChild(h('span', { class: 'st', text: tag != null ? tag : (L2 ? '已掌握' : '') }));
        return h('li', null, [b]);
      }
      function section(title, lis, none) {
        panel.appendChild(h('h4', { text: title }));
        panel.appendChild(lis.length ? h('ul', null, lis) : h('div', { class: 'none', text: none }));
      }
      section('前置知识', pre.map(function (p) { return item(p); }), '没有前置，可以直接学');
      section('学完可以去学', post.map(function (p) { return item(p); }), '暂无后续节点');
      if (!mini) section('跨领域联系', cross.map(function (e) {
        var other = e.s === id ? e.t : e.s;
        return item(other, e.label || relText(e.s, e.t, e.kind), (KIND[e.kind] || '') + ' · ' + domName(M.all[other].domain));
      }), '暂无跨领域联系');
      if (keep) panel.scrollTop = scroll;
      if (refocus) { var sw = panel.querySelector('.kgg-switch'); if (sw) sw.focus({ preventScroll: true }); }
    }
    function openPanel(id, kb) {
      if (!panel) { panel = h('aside', { class: 'kgg-panel', hidden: true, 'aria-label': '知识点详情' }); (cloudContent || stage).appendChild(panel); }
      var ae = document.activeElement;
      st.opener = ae && listBox && listBox.contains(ae) ? ae : null;
      st.sel = id; st.panelId = id;
      renderPanel(id, false);
      panel.hidden = false;
      panel.scrollTop = 0;
      hideTip();
      applyHighlight();
      if (sphere) sphere.setBlocked(true);
      ensureVisible(id, false);
      if (kb) { var t = panel.querySelector('h3'); if (t) t.focus({ preventScroll: true }); }
    }
    function closePanel(returnFocus) {
      if (!panel || panel.hidden) return;
      var id = st.panelId;
      panel.hidden = true; st.panelId = null; st.sel = null;
      if (sphere) { sphere.clearSelection(); sphere.setBlocked(st.list); }
      applyHighlight();
      if (!returnFocus) return;
      if (sphereMode() && sphereHost && !st.list) {
        var word = Array.from(sphereHost.querySelectorAll('[data-node-id]')).filter(function (el) { return el.dataset.nodeId === id; })[0];
        if (word) word.focus({ preventScroll: true });
        return;
      }
      if (st.list && st.opener && listBox.contains(st.opener)) st.opener.focus({ preventScroll: true });
      else if (byId[id] && byId[id].vis && !st.list) byId[id].el.focus({ preventScroll: true });
    }
    // 让节点落在可见区域里（扣掉侧面板 / 底部弹层 / 图例）；center=true 时居中，k 是目标缩放
    function ensureVisible(id, center, k, anim) {
      var r = byId[id];
      if (sphereMode() && sphere) { sphere.focus(id); return; }
      if (!r || !r.vis || !zoom || st.list) return;
      var W = stageW(), H = stageH(), t = st.t;
      k = k || t.k;
      var open = panel && !panel.hidden, sheet = W <= 640;
      var aw = open && !sheet ? W - 360 : W, ah = open && sheet ? Math.max(120, H - panel.offsetHeight) : H - legendH();
      var sx = t.applyX(r.x), sy = t.applyY(r.y);
      if (!center && k === t.k && sx > 40 && sx < aw - 40 && sy > 40 && sy < ah - 30) return;
      setT(d3.zoomIdentity.translate(aw / 2 - r.x * k, ah / 2 - r.y * k).scale(k), anim !== false);
    }
    function focusNode(id, opts) {
      opts = opts || {};
      var r = byId[id];
      if (!r) return false;
      if (mini) { st.sel = id; applyHighlight(); return true; }
      if (st.hidden[r.dom]) { st.hidden[r.dom] = false; if (chips[r.dom]) chips[r.dom].setAttribute('aria-pressed', 'true'); onFilterChange(true); }
      if (st.list) setList(false);
      if (opts.open !== false) openPanel(id, false);
      else { st.sel = id; applyHighlight(); }
      ensureVisible(id, true, Math.max(st.t.k, 0.9));
      st.focused = true;   // 尺寸变化时重新居中到这个节点
      return true;
    }

    // ---- 列表视图 ----
    function renderList() {
      if (!listBox) { listBox = h('div', { class: 'kgg-list', hidden: true }); stage.appendChild(listBox); }
      var hit = null;
      if (st.query.trim()) { hit = {}; searchHits(st.query).forEach(function (r) { hit[r.id] = 1; }); }
      var rows = recs.filter(function (r) { return r.vis && (!hit || hit[r.id]); });
      var tb = h('tbody');
      rows.forEach(function (r) {
        var pre = [], seen = {};
        edges.forEach(function (E) { if (E.kind === "prereq" && E.b === r && !seen[E.a.id]) { seen[E.a.id] = 1; pre.push(E.a.n.title || E.a.id); } });
        (r.n.prereqs || []).forEach(function (p) { if (M.all[p] && !seen[p]) { seen[p] = 1; pre.push(titleOf(p)); } });
        tb.appendChild(h('tr', null, [
          h('td', { class: 'c1' }, [h('button', { class: 'ttl', type: 'button', text: r.n.title || r.id, onclick: function () { openPanel(r.id, true); } }), r.n.en ? h('span', { class: 'en', text: r.n.en }) : null]),
          h('td', { class: 'c2' }, [h('span', { class: 'dm', html: iconSVG(r.dom, 'fill', 12) }, [domName(r.dom)])]),
          h('td', { class: 'c3', text: LEVEL[r.n.level] || '' }),
          h('td', { class: 'c4', text: pre.length ? pre.join('、') : '—' }),
          h('td', { class: 'c5' }, [h('span', { class: 'dm', html: iconSVG(r.dom, r.learned ? 'fill' : r.isNext ? 'next' : 'outline', 12) }, [stateText(r.id)])])
        ]));
      });
      if (!rows.length) tb.appendChild(h('tr', null, [h('td', { colspan: '5', text: '没有匹配的知识点' })]));
      var table = h('table', null, [
        h('caption', { class: 'kgg-sr', text: '知识点列表（' + rows.length + ' 个）' }),
        h('thead', null, [h('tr', null, ['节点', '领域', '层级', '前置', '状态'].map(function (t) { return h('th', { scope: 'col', text: t }); }))]),
        tb
      ]);
      listBox.textContent = '';
      listBox.appendChild(table);
    }
    function setList(on) {
      st.list = !!on;
      if (on) renderList();
      if (listBox) listBox.hidden = !on;
      svg.style.visibility = on || sphereMode() ? 'hidden' : '';
      if (sphereHost) sphereHost.hidden = on || !sphereMode();
      if (sphere) sphere.setBlocked(on || !!st.panelId);
      if (legend) legend.hidden = on;
      if (zoomBox) zoomBox.hidden = on;
      if (listBtn) listBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      hideTip();
      if (!on) placeLabels(); else updateMore();
    }

    // ---- 搜索 ----
    function searchHits(q) {
      q = String(q || '').trim().toLowerCase();
      if (!q) return [];
      var res = [];
      recs.forEach(function (r) {
        var t = String(r.n.title || '').toLowerCase(), en = String(r.n.en || '').toLowerCase();
        var sc = t.indexOf(q) === 0 ? 0 : t.indexOf(q) > 0 ? 1 : en.indexOf(q) > -1 ? 2 : -1;
        if (sc >= 0) res.push({ r: r, s: sc });
      });
      res.sort(function (a, b) { return a.s - b.s || domIdx(a.r.dom) - domIdx(b.r.dom) || (a.r.n.order || 0) - (b.r.n.order || 0); });
      return res.map(function (x) { return x.r; });
    }

    // ---- 控制条、图例、缩放按钮 ----
    var chips = {}, segBtns = {}, listBtn = null, input = null, dd = null, ddItems = [], ddActive = -1;
    var EKEY_PRE = '<svg class="kgg-ekey" viewBox="0 0 18 8" aria-hidden="true" focusable="false"><path d="M1 4H12" style="fill:none;stroke:var(--edge);stroke-width:2"/><path d="M11 0.8L17 4L11 7.2Z" style="fill:var(--edge)"/></svg>';
    var EKEY_CROSS = '<svg class="kgg-ekey" viewBox="0 0 18 8" aria-hidden="true" focusable="false"><path d="M1 4H17" style="fill:none;stroke:var(--edge-strong);stroke-width:1.5;stroke-dasharray:4 3"/></svg>';

    function renderDD() {
      var q = input.value.trim();
      dd.textContent = '';
      ddItems = searchHits(q).slice(0, 7);
      if (!q) { dd.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); return; }
      if (!ddItems.length) dd.appendChild(h('li', { class: 'empty', text: '没有匹配的知识点' }));
      ddItems.forEach(function (r, i) {
        var li = h('li', { role: 'option', id: ID + '-opt' + i, 'aria-selected': i === ddActive ? 'true' : 'false', html: iconSVG(r.dom, r.learned ? 'fill' : 'outline', 12) },
          [h('span', { text: r.n.title || r.id }), r.n.en ? h('span', { class: 'en', text: r.n.en }) : null]);
        li.addEventListener('mousedown', function (e) { e.preventDefault(); pick(i); });
        dd.appendChild(li);
      });
      dd.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      if (ddActive >= 0 && ddItems[ddActive]) input.setAttribute('aria-activedescendant', ID + '-opt' + ddActive);
      else input.removeAttribute('aria-activedescendant');
    }
    function pick(i) {
      var r = ddItems[i];
      if (!r) return;
      dd.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      focusNode(r.id, { open: true });
    }
    function onFilterChange(noFit) {
      if (st.panelId && byId[st.panelId] && st.hidden[byId[st.panelId].dom]) closePanel(false);
      if (columnsMode() || sphereMode()) doLayout(); else syncDisplay();
      applyHighlight();
      if (st.list) renderList();
      if (!noFit) fit(true);
    }
    function setLayout(name, user) {
      name = ['columns', 'sphere'].indexOf(name) > -1 ? name : 'force';
      if (name === 'sphere' && (!window.KGSphereCloud || !window.KGNebulaRuntime)) return;
      if (cloudDialog && name !== 'sphere') closeCloudDialog(false);
      if (mini || name === st.layout) return;
      if (st.list) setList(false);
      st.layout = name;
      Object.keys(segBtns).forEach(function (k) { segBtns[k].setAttribute('aria-pressed', k === name ? 'true' : 'false'); });
      hideTip(); st.hover = null; st.hoverEdge = null;
      doLayout();
      applyHighlight();
      fit(false);
      if (st.panelId) ensureVisible(st.panelId, false);
      if (user && typeof o.onLayoutChange === 'function') { try { o.onLayoutChange(name); } catch (e) { /* 忽略 */ } }
    }

    function buildBar() {
      if (!single) {
        var g1 = h('div', { class: 'kgg-grp', role: 'group', 'aria-label': '按领域筛选' });
        domIds.forEach(function (d) {
          var b = h('button', {
            class: 'kgg-btn kgg-chip', type: 'button', 'aria-pressed': 'true', html: iconSVG(d, 'fill', 13),
            onclick: function () { st.hidden[d] = !st.hidden[d]; b.setAttribute('aria-pressed', st.hidden[d] ? 'false' : 'true'); onFilterChange(false); }
          }, [domName(d)]);
          chips[d] = b;
          g1.appendChild(b);
        });
        bar.appendChild(g1);
      }
      var g2 = h('div', { class: 'kgg-grp kgg-edge-controls', role: 'group', 'aria-label': '显示哪些连线' });
      var preBtn = h('button', { class: 'kgg-btn kgg-chip', type: 'button', 'aria-pressed': 'true', html: EKEY_PRE,
        onclick: function () { st.showPre = !st.showPre; preBtn.setAttribute('aria-pressed', String(st.showPre)); syncDisplay(); applyHighlight(); } }, ['前置关系']);
      g2.appendChild(preBtn);
      if (!single) {
        var crossBtn = h('button', { class: 'kgg-btn kgg-chip', type: 'button', 'aria-pressed': 'true', html: EKEY_CROSS,
          onclick: function () { st.showCross = !st.showCross; crossBtn.setAttribute('aria-pressed', String(st.showCross)); syncDisplay(); applyHighlight(); } }, ['跨领域联系']);
        g2.appendChild(crossBtn);
      }
      bar.appendChild(g2);
      var seg = h('div', { class: 'kgg-seg', role: 'group', 'aria-label': '布局' });
      [['force', '全景'], ['columns', '分栏'], ['sphere', '3D 知识云']].forEach(function (L) {
        var b = h('button', { type: 'button', 'aria-pressed': st.layout === L[0] ? 'true' : 'false', onclick: function () { setLayout(L[0], true); if (L[0] === 'sphere') openCloudDialog(); } }, [L[1]]);
        if (L[0] === 'sphere' && (!window.KGSphereCloud || !window.KGNebulaRuntime)) { b.disabled = true; b.title = '3D 知识云组件尚未加载'; }
        segBtns[L[0]] = b;
        seg.appendChild(b);
      });
      bar.appendChild(seg);
      var sw = h('div', { class: 'kgg-search', html: ICON.search });
      input = h('input', { type: 'search', placeholder: '在图中搜索知识点', 'aria-label': '在图中搜索知识点', autocomplete: 'off', spellcheck: 'false',
        role: 'combobox', 'aria-expanded': 'false', 'aria-controls': ID + '-dd', 'aria-autocomplete': 'list' });
      dd = h('ul', { class: 'kgg-dd', id: ID + '-dd', role: 'listbox', 'aria-label': '搜索结果', hidden: true });
      input.addEventListener('input', function () {
        st.query = input.value;
        ddActive = searchHits(input.value).length ? 0 : -1;
        renderDD();
        applyHighlight();
        if (st.list) renderList();
      });
      input.addEventListener('keydown', function (e) {
        var n = ddItems.length;
        if (e.key === 'ArrowDown' && n) { e.preventDefault(); ddActive = (ddActive + 1) % n; renderDD(); }
        else if (e.key === 'ArrowUp' && n) { e.preventDefault(); ddActive = (ddActive - 1 + n) % n; renderDD(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (n) pick(ddActive >= 0 ? ddActive : 0); }
        else if (e.key === 'Escape') {
          e.preventDefault(); e.stopPropagation();
          if (!dd.hidden) { dd.hidden = true; input.setAttribute('aria-expanded', 'false'); }
          else if (input.value) { input.value = ''; st.query = ''; renderDD(); applyHighlight(); if (st.list) renderList(); }
        }
      });
      input.addEventListener('focus', function () { if (input.value.trim()) renderDD(); });
      input.addEventListener('blur', function () { dd.hidden = true; input.setAttribute('aria-expanded', 'false'); });
      sw.appendChild(input);
      sw.appendChild(dd);
      bar.appendChild(sw);
      var g3 = h('div', { class: 'kgg-grp' });
      listBtn = h('button', { class: 'kgg-btn kgg-tool', type: 'button', 'aria-pressed': 'false', html: ICON.list, onclick: function () { setList(!st.list); } }, ['列表视图']);
      g3.appendChild(listBtn);
      g3.appendChild(h('button', { class: 'kgg-btn', type: 'button', html: ICON.reset, onclick: function () { if (st.list) setList(false); if (sphereMode() && sphere) sphere.reset(); else fit(true); } }, ['复位视图']));
      bar.appendChild(g3);
    }
    function buildLegend() {
      legend = h('div', { class: 'kgg-legend', role: 'note', 'aria-label': '图例' });
      var r1 = h('div', { class: 'row kgg-domain-key' });
      domIds.forEach(function (d) { r1.appendChild(h('span', { class: 'it', html: iconSVG(d, 'fill', 13) }, [domName(d)])); });
      var r2 = h('div', { class: 'row kgg-graph-key' });
      r2.appendChild(h('span', { class: 'it', html: EKEY_PRE }, ['前置（箭头指向后学的）']));
      if (!single) r2.appendChild(h('span', { class: 'it', html: EKEY_CROSS }, ['跨领域联系']));
      var r3 = h('div', { class: 'row kgg-graph-key' });
      r3.appendChild(h('span', { class: 'it', html: iconSVG('neutral', 'fill', 13) }, ['已掌握']));
      r3.appendChild(h('span', { class: 'it', html: iconSVG('neutral', 'outline', 13) }, ['未掌握']));
      r3.appendChild(h('span', { class: 'it', html: iconSVG('neutral', 'next', 14) }, ['下一步']));
      legend.appendChild(r1); legend.appendChild(r2); legend.appendChild(r3);
      stage.appendChild(legend);
      zoomBox = h('div', { class: 'kgg-zoom' }, [
        h('button', { type: 'button', 'aria-label': '放大', title: '放大', html: ICON.plus, onclick: function () { zoomBy(1.4); } }),
        h('button', { type: 'button', 'aria-label': '缩小', title: '缩小', html: ICON.minus, onclick: function () { zoomBy(1 / 1.4); } })
      ]);
      stage.appendChild(zoomBox);
      moreBtn = h('button', { class: 'kgg-more', type: 'button', hidden: true, 'data-dir': 'down', html: ICON.down, onclick: scrollMore }, ['向下滚动看更多']);
      stage.appendChild(moreBtn);
    }

    // ---- 事件 ----
    function ptr(e) { return d3.pointer(e, stage); }
    recs.forEach(function (r) {
      var el = r.el;
      el.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        st.hover = r.id; st.hoverEdge = null; applyHighlight();
        var p = ptr(e); showTipNode(r, p[0], p[1]);
      });
      el.addEventListener('pointermove', function (e) { if (st.hover === r.id && !tip.hidden) { var p = ptr(e); tipAt(p[0], p[1]); } });
      el.addEventListener('pointerleave', function () { if (st.hover === r.id) { st.hover = null; applyHighlight(); hideTip(); } });
      function activate(kb) {
        hideTip();
        if (mini) { if (r.id !== o.focusId && typeof o.onOpen === 'function') o.onOpen(r.id); return; }
        if (st.panelId === r.id && !kb) { closePanel(false); return; }
        openPanel(r.id, kb);
      }
      el.addEventListener('click', function (e) { e.stopPropagation(); activate(false); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(true); }
      });
      el.addEventListener('focus', function () {
        var kb = false;
        try { kb = el.matches(':focus-visible'); } catch (err) { kb = true; }
        if (!kb) return;
        st.hover = r.id; st.hoverEdge = null;
        ensureVisible(r.id, false);
        applyHighlight();
        showTipNode(r, r.sx, r.sy + r.r * st.t.k + 4);
      });
      el.addEventListener('blur', function () { if (st.hover === r.id) { st.hover = null; applyHighlight(); hideTip(); } });
    });
    edges.forEach(function (E) {
      if (!E.hit) return;
      E.hit.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        st.hoverEdge = E; applyHighlight();
        var p = ptr(e); showTipEdge(E, p[0], p[1]);
      });
      E.hit.addEventListener('pointermove', function (e) { if (st.hoverEdge === E) { var p = ptr(e); tipAt(p[0], p[1]); } });
      E.hit.addEventListener('pointerleave', function () { if (st.hoverEdge === E) { st.hoverEdge = null; applyHighlight(); hideTip(); } });
    });
    svg.addEventListener('click', function (e) {
      if (mini) return;
      if (e.target === svg || (e.target.classList && e.target.classList.contains('kgg-frame'))) {
        if (st.panelId) closePanel(false);
        else if (st.sel) { st.sel = null; applyHighlight(); }
      }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && st.panelId) { e.preventDefault(); closePanel(true); }
    });

    // ---- 尺寸变化 ----
    var ro = null, rT = 0, lastW = 0, lastH = 0;
    function onResize() {
      if (st.destroyed) return;
      var W = stageW(), H = stageH();
      if (W === lastW && H === lastH) return;
      lastW = W; lastH = H;
      var relayout = layoutKey() !== st.layoutKey;
      if (relayout) { doLayout(); applyHighlight(); }
      if (mini) { if (!relayout) placeLabels(); return; }
      if (relayout || !st.userZoomed) {
        // 重新适配画布；定位过的节点（focus() 或打开了侧面板的）再放回视野里
        var foc = st.focused && st.sel;
        fit(false);
        if (st.sel) ensureVisible(st.sel, !!foc, foc ? Math.max(st.t.k, 0.9) : 0, false);
        st.focused = !!foc;
      } else placeLabels();
    }
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { clearTimeout(rT); rT = setTimeout(onResize, 120); });
      ro.observe(stage);
    }

    // ---- 初始化 ----
    if (!mini) { buildBar(); buildLegend(); }
    doLayout();
    updateStates();
    if (!mini) fit(false);
    if (o.focusId != null && byId[o.focusId]) {
      if (mini) { st.sel = o.focusId; applyHighlight(); }
      else focusNode(o.focusId, { open: false });
    }
    lastW = stageW(); lastH = stageH();

    return {
      el: root,
      destroy: function () {
        if (st.destroyed) return;
        st.destroyed = true;
        closeCloudDialog(false);
        destroySphere();
        if (ro) ro.disconnect();
        clearTimeout(rT);
        if (rafId) cancelAnimationFrame(rafId);
        if (zoom) d3.select(svg).interrupt().on('.zoom', null);
        if (root.parentNode) root.parentNode.removeChild(root);
      },
      focus: function (id, opts) { return st.destroyed ? false : focusNode(id, opts); },
      refresh: function (patch) { if (st.destroyed) return; if (patch) Object.assign(o, patch); updateStates(); },
      setLayout: function (name) { if (!st.destroyed) setLayout(name, false); },
      getLayout: function () { return st.layout; }
    };
  }

  window.KGGraph = { mount: mount, version: '1.0.0' };
})();
