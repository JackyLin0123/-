/* 交互演示：k-means 的 Lloyd 算法。分配（最近质心）和更新（簇内均值）交替，
 * 簇内平方和 SSE 相对上一步不增，但坏初始化会停在更差的局部最优。
 * 纯原生 JS，挂到 window.KGDemos['ai-kmeans']。selfTest 不碰 DOM。 */
(function () {
  'use strict';

  var ID = 'ai-kmeans';
  var PX = 'dm-' + ID + '-';
  var EPS = 1e-9;

  /* ---------- 核心计算（不碰 DOM） ---------- */
  function d2(a, b) {
    var dx = a[0] - b[0], dy = a[1] - b[1];
    return dx * dx + dy * dy;
  }

  function copyPts(pts) {
    var out = [], i;
    for (i = 0; i < pts.length; i++) out.push([pts[i][0], pts[i][1]]);
    return out;
  }

  function samePts(a, b) {
    var i, d;
    if (!a || !b || a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) {
      for (d = 0; d < 2; d++) if (Math.abs(a[i][d] - b[i][d]) > EPS) return false;
    }
    return true;
  }

  // 平方距离更小者胜出；距离相等时归编号较小的质心。
  function assign(points, centroids) {
    var labels = [], i, j, best, bd, dist;
    for (i = 0; i < points.length; i++) {
      best = 0;
      bd = d2(points[i], centroids[0]);
      for (j = 1; j < centroids.length; j++) {
        dist = d2(points[i], centroids[j]);
        if (dist < bd) { bd = dist; best = j; }
      }
      labels.push(best);
    }
    return labels;
  }

  function sse(points, labels, centroids) {
    var s = 0, i;
    for (i = 0; i < points.length; i++) s += d2(points[i], centroids[labels[i]]);
    return s;
  }

  // 空簇没有样本，质心留在原地，避免除以 0。
  function update(points, labels, centroids) {
    var next = [], j, i, n, sx, sy;
    for (j = 0; j < centroids.length; j++) {
      n = 0;
      sx = 0;
      sy = 0;
      for (i = 0; i < points.length; i++) {
        if (labels[i] !== j) continue;
        n++;
        sx += points[i][0];
        sy += points[i][1];
      }
      next.push(n ? [sx / n, sy / n] : [centroids[j][0], centroids[j][1]]);
    }
    return next;
  }

  function counts(labels, k) {
    var c = [], i;
    for (i = 0; i < k; i++) c.push(0);
    for (i = 0; i < labels.length; i++) {
      if (labels[i] >= 0 && labels[i] < k) c[labels[i]]++;
    }
    return c;
  }

  // 从初始质心跑到质心不再移动。每一步先分配、再更新，两步都记下来。
  function runUntil(points, init) {
    var k, centroids, steps, it, labels, sAssign, next, sUpdate, moved;
    points = points || [];
    init = init || [];
    k = init.length;
    if (!points.length) {
      return { err: '点集是空的，没有样本可以分配，簇内平方和没有定义。', sse: null, steps: [], centroids: [], labels: [], converged: false };
    }
    if (k < 1) {
      return { err: 'k 至少要是 1，否则没有质心可以分配。', sse: null, steps: [], centroids: [], labels: [], converged: false };
    }
    if (k > points.length) {
      return { err: 'k（' + k + '）大于点数（' + points.length + '），样本不够给每个簇各放一个质心。', sse: null, steps: [], centroids: [], labels: [], converged: false };
    }
    centroids = copyPts(init);
    steps = [];
    labels = [];
    moved = true;
    for (it = 0; it < 32; it++) {
      labels = assign(points, centroids);
      sAssign = sse(points, labels, centroids);
      steps.push({ phase: 'assign', round: it + 1, labels: labels.slice(), centroids: copyPts(centroids), sse: sAssign });
      next = update(points, labels, centroids);
      sUpdate = sse(points, labels, next);
      moved = !samePts(centroids, next);
      centroids = next;
      steps.push({ phase: 'update', round: it + 1, labels: labels.slice(), centroids: copyPts(centroids), sse: sUpdate, moved: moved });
      if (!moved) break;
    }
    return {
      err: null,
      sse: steps.length ? steps[steps.length - 1].sse : null,
      steps: steps,
      centroids: copyPts(centroids),
      labels: labels.slice(),
      converged: !moved
    };
  }

  function fmt(x) {
    var r;
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    r = Math.round(x);
    if (Math.abs(x - r) < 1e-6) return String(r);
    return (Math.round(x * 100) / 100).toFixed(2);
  }

  function fmtPt(p) { return '(' + fmt(p[0]) + ', ' + fmt(p[1]) + ')'; }

  function fmtList(cents) {
    var s = [], i;
    for (i = 0; i < cents.length; i++) s.push(fmtPt(cents[i]));
    return s.join('、');
  }

  /* 两套点都放在 0–16 的坐标系里，网格一格是 4，横纵同一比例。
   * 明显两团：左右两个边长 4 的正方形。k=2 时坏初始化按上下切开，最终 SSE 160 > 好初始化 64。
   * 三团：左下、右下、右上。k=3 时坏初始化把左下切成两半、右边两团合并，最终 SSE 148 > 24。
   * 这些最终值和中间 SSE 先用 Python 按同一规则算过，期望值写在 selfTest 里。 */
  var PRESETS = [
    {
      id: 'blobs',
      name: '明显两团',
      k0: 2,
      note: '左右各一团，每团 4 个样本，围成边长为 4 的正方形。推荐 k = 2。好初始化把质心放在 (4, 8) 和 (12, 8)。坏初始化把两个质心都放在左团，一个在上沿 (4, 10)，一个在下沿 (4, 6)。',
      points: [[2, 6], [2, 10], [6, 6], [6, 10], [10, 6], [10, 10], [14, 6], [14, 10]],
      init: {
        1: { good: [[8, 8]], bad: [[2, 6]] },
        2: { good: [[4, 8], [12, 8]], bad: [[4, 10], [4, 6]] },
        3: { good: [[4, 10], [4, 6], [12, 8]], bad: [[2, 6], [2, 10], [6, 6]] },
        4: { good: [[4, 10], [4, 6], [12, 10], [12, 6]], bad: [[2, 6], [2, 10], [6, 6], [6, 10]] }
      }
    },
    {
      id: 'local',
      name: '容易陷入局部最优',
      k0: 3,
      note: '三团样本，在左下、右下和右上，每团 4 个点。推荐 k = 3。好初始化每团放一个质心：(4, 4)、(12, 4)、(12, 12)。坏初始化把两个质心放进左下 (3, 4)、(5, 4)，第三个放在右下 (12, 4)，右上那团会被并进去。',
      points: [[3, 3], [3, 5], [5, 3], [5, 5], [11, 3], [11, 5], [13, 3], [13, 5], [11, 11], [11, 13], [13, 11], [13, 13]],
      init: {
        1: { good: [[9, 7]], bad: [[3, 3]] },
        2: { good: [[4, 4], [12, 8]], bad: [[3, 4], [5, 4]] },
        3: { good: [[4, 4], [12, 4], [12, 12]], bad: [[3, 4], [5, 4], [12, 4]] },
        4: { good: [[3, 4], [5, 4], [12, 4], [12, 12]], bad: [[3, 3], [3, 5], [5, 3], [12, 4]] }
      }
    }
  ];

  function presetById(id) {
    var i;
    for (i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return PRESETS[0];
  }

  /* ---------- 样式 ---------- */
  var FB = {
    '--text': '#1b1b19', '--text-2': '#52514e', '--text-3': '#6b6a66',
    '--surface': '#ffffff', '--surface-2': '#f0efec', '--border': '#e2e1dc',
    '--c-ai': '#4a3aa7', '--div-neg': '#2a78d6', '--div-pos': '#e34948',
    '--c-compiler': '#d95926', '--c-os': '#199e70', '--focus': '#2457b3', '--good': '#0ca30c'
  };

  function tpl(s) { return s.replace(/@@/g, PX); }

  var CSS = [
    '.@@root{font-family:var(--font);color:var(--text);font-size:15px;line-height:1.65;display:flex;flex-direction:column;gap:12px;min-width:0;overflow-wrap:anywhere}',
    '.@@root *{box-sizing:border-box}',
    '.@@root p{margin:0}',
    '.@@root h4{margin:0 0 6px;font-size:15px;font-weight:600;line-height:1.4;color:var(--text)}',
    '.@@how,.@@intro,.@@note{font-size:14px;color:var(--text-2)}',
    '.@@note{background:var(--surface-2);border-radius:8px;padding:8px 12px}',
    '.@@box,.@@card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px;min-width:0}',
    '.@@ctl{display:flex;flex-direction:column;gap:10px}',
    '.@@params,.@@bar,.@@chips{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}',
    '.@@root label{display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:14px;color:var(--text-2);max-width:100%}',
    '.@@root select{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:5px 8px;min-height:36px;max-width:100%}',
    '.@@btn{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 12px;min-height:36px;cursor:pointer}',
    '.@@btn:hover:not(:disabled){background:var(--surface-2)}',
    '.@@pri{font-weight:600;border-color:var(--c-ai)}',
    '.@@btn[aria-pressed=true]{border-color:var(--c-ai)}',
    '.@@btn:disabled{color:var(--text-3);cursor:default;background:var(--surface)}',
    '.@@root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}',
    '.@@now{background:var(--surface-2);border:1px solid var(--border);border-left:4px solid var(--c-ai);border-radius:var(--radius);padding:10px 14px}',
    '.@@status{color:var(--text);font-size:15px}',
    '.@@why{margin-top:6px!important;color:var(--text-2);font-size:14px}',
    '.@@sum{margin-top:10px}',
    '.@@wait{font-size:14px;color:var(--text-2)}',
    '.@@pair{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}',
    '.@@cell{flex:1 1 160px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 10px;min-width:0}',
    '.@@cell span{display:block;font-size:13px;color:var(--text-2)}',
    '.@@cell b{display:block;margin-top:2px;font-family:var(--mono);font-size:22px;font-weight:600;color:var(--text);line-height:1.3}',
    '.@@cell small{display:block;font-size:12px;color:var(--text-3)}',
    '.@@lo{border-color:var(--c-ai)}',
    '.@@hi{border-color:var(--div-pos)}',
    '.@@judge{font-size:14px;color:var(--text)}',
    '.@@stage{min-width:0}',
    '.@@plot{width:min(100%,560px);height:auto;aspect-ratio:19.6/18.3;display:block;margin:0 auto;background:var(--surface-2);border:1px solid var(--border);border-radius:10px}',
    '.@@plot text{font-family:var(--mono);fill:var(--text-3)}',
    '.@@plot text.@@clab{fill:var(--text);font-family:var(--font)}',
    '.@@frame{fill:var(--surface);stroke:var(--border);stroke-width:.06}',
    '.@@grid{stroke:var(--border);stroke-width:.04}',
    '.@@ln{fill:none;stroke-width:.08;opacity:.55}',
    '.@@dot{stroke:var(--surface);stroke-width:.12}',
    '.@@cen{fill:var(--surface);stroke-width:.18}',
    '.@@halo{fill:var(--surface);stroke:none}',
    '.@@dot.@@none{fill:var(--surface-2);stroke:var(--text-3)}',
    '.@@cen.@@idle{stroke:var(--c-ai)}',
    '.@@dot.@@c0,.@@sw.@@c0{fill:var(--c-ai);background:var(--c-ai)}',
    '.@@cen.@@c0,.@@ln.@@c0{stroke:var(--c-ai)}',
    '.@@dot.@@c1,.@@sw.@@c1{fill:var(--div-neg);background:var(--div-neg)}',
    '.@@cen.@@c1,.@@ln.@@c1{stroke:var(--div-neg)}',
    '.@@dot.@@c2,.@@sw.@@c2{fill:var(--c-compiler);background:var(--c-compiler)}',
    '.@@cen.@@c2,.@@ln.@@c2{stroke:var(--c-compiler)}',
    '.@@dot.@@c3,.@@sw.@@c3{fill:var(--c-os);background:var(--c-os)}',
    '.@@cen.@@c3,.@@ln.@@c3{stroke:var(--c-os)}',
    '.@@cap{margin-top:8px!important;font-size:13px;color:var(--text-3)}',
    '.@@chip{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:3px 10px}',
    '.@@sw{width:10px;height:10px;border-radius:50%;flex:0 0 auto}',
    '.@@dia{width:9px;height:9px;border-radius:1px;background:var(--surface);border:2px solid var(--c-ai);transform:rotate(45deg);box-sizing:border-box}',
    '@media (max-width:420px){.@@btn{padding:6px 10px}.@@now{padding:8px 10px}.@@cell b{font-size:20px}}',
    '@media (prefers-reduced-motion:reduce){.@@root{scroll-behavior:auto}}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('dm-style-' + ID)) return;
    var st = document.createElement('style');
    st.id = 'dm-style-' + ID;
    st.textContent = tpl(CSS).replace(/var\((--[\w-]+)\)/g, function (m, v) {
      return FB[v] ? 'var(' + v + ',' + FB[v] + ')' : m;
    });
    document.head.appendChild(st);
  }

  var HTML = [
    '<p class="@@how">怎么玩：按「单步」或空格。单步先做分配（每个样本归到最近的质心），再做更新（质心换成这一簇样本的均值），两步交替。R 键重置。可以换点集、k（1 到 4）和初始质心。收敛后自动停下，并写下好、坏两种初始化的最终簇内平方和。</p>',
    '<p class="@@intro">k-means 要最小化的目标函数，是样本到所属质心的平方距离之和，也就是簇内平方和 SSE。Lloyd 算法交替做最近质心分配和均值更新：每一步都不增加目标，但只能保证到局部最优。这里的分配是硬分配，一个样本只属于一个簇；高斯混合才给出软责任度。</p>',
    '<div class="@@box @@ctl"><div class="@@params">',
    '<label>点集<select data-r="preset" aria-label="点集预设"></select></label>',
    '<label>k<select data-r="k" aria-label="簇数 k，从 1 到 4"></select></label>',
    '<label>初始质心<select data-r="init" aria-label="初始质心：好初始化或坏初始化"></select></label>',
    '</div><p class="@@note" data-r="note"></p></div>',
    '<div class="@@bar" role="group" aria-label="逐步控制">',
    '<button type="button" class="@@btn @@pri" data-r="step" aria-label="单步，进行分配">单步</button>',
    '<button type="button" class="@@btn" data-r="play" aria-pressed="false" aria-label="自动播放，分配和更新交替进行">自动播放</button>',
    '<button type="button" class="@@btn" data-r="reset" aria-label="重置到初始质心">重置</button>',
    '</div>',
    '<div class="@@now" data-r="now" aria-live="polite" aria-atomic="true">',
    '<h4>现在发生了什么</h4>',
    '<p class="@@status" data-r="status"></p>',
    '<p class="@@why" data-r="why"></p>',
    '<div class="@@sum" data-r="sum"></div>',
    '</div>',
    '<section class="@@card @@stage" aria-label="样本和质心的坐标图">',
    '<div class="@@chips" data-r="legend" aria-label="图例"></div>',
    '<svg class="@@plot" data-r="plot" viewBox="-2.5 -0.7 19.6 18.3" role="img" aria-label="k-means 坐标图"></svg>',
    '<p class="@@cap">网格间隔为 4，横轴和纵轴同一比例。圆点是样本，按硬分配的簇着色；菱形是质心，里面的数字是簇的编号。</p>',
    '</section>'
  ].join('');

  function sy(y) { return 16 - y; }

  function diamond(cx, cy, r) {
    return cx + ',' + (cy - r) + ' ' + (cx + r) + ',' + cy + ' ' + cx + ',' + (cy + r) + ' ' + (cx - r) + ',' + cy;
  }

  function plotHTML(points, labels, centroids) {
    var h = '', v, i, j, p, c, cx, cy, cls, col;
    h += '<rect class="' + PX + 'frame" x="0" y="0" width="16" height="16"></rect>';
    for (v = 0; v <= 16; v += 4) {
      h += '<line class="' + PX + 'grid" x1="' + v + '" y1="0" x2="' + v + '" y2="16"></line>';
      h += '<line class="' + PX + 'grid" x1="0" y1="' + sy(v) + '" x2="16" y2="' + sy(v) + '"></line>';
      h += '<text font-size="0.62" text-anchor="middle" x="' + v + '" y="16.85">' + v + '</text>';
      h += '<text font-size="0.62" text-anchor="end" dominant-baseline="middle" x="-0.35" y="' + sy(v) + '">' + v + '</text>';
    }
    if (labels) {
      for (i = 0; i < points.length; i++) {
        p = points[i];
        c = centroids[labels[i]];
        h += '<line class="' + PX + 'ln ' + PX + 'c' + labels[i] + '" x1="' + p[0] + '" y1="' + sy(p[1]) + '" x2="' + c[0] + '" y2="' + sy(c[1]) + '"></line>';
      }
    }
    for (i = 0; i < points.length; i++) {
      p = points[i];
      cls = labels ? PX + 'c' + labels[i] : PX + 'none';
      h += '<circle class="' + PX + 'dot ' + cls + '" cx="' + p[0] + '" cy="' + sy(p[1]) + '" r="0.4">';
      h += '<title>样本 ' + (i + 1) + ' ' + fmtPt(p) + (labels ? '，簇 ' + (labels[i] + 1) : '，尚未分配') + '</title></circle>';
    }
    for (j = 0; j < centroids.length; j++) {
      c = centroids[j];
      cx = c[0];
      cy = sy(c[1]);
      col = labels ? PX + 'c' + j : PX + 'idle';
      h += '<polygon class="' + PX + 'halo" points="' + diamond(cx, cy, 1.05) + '"></polygon>';
      h += '<polygon class="' + PX + 'cen ' + col + '" points="' + diamond(cx, cy, 0.82) + '">';
      h += '<title>质心 ' + (j + 1) + ' ' + fmtPt(c) + '</title></polygon>';
      h += '<text class="' + PX + 'clab" font-size="0.72" text-anchor="middle" dominant-baseline="middle" x="' + cx + '" y="' + cy + '">' + (j + 1) + '</text>';
    }
    return h;
  }

  function legendHTML(labels, centroids) {
    var h = '', k = centroids.length, c = labels ? counts(labels, k) : null, j;
    for (j = 0; j < k; j++) {
      h += '<span class="' + PX + 'chip"><i class="' + PX + 'sw ' + PX + 'c' + j + '" aria-hidden="true"></i>簇 ' + (j + 1);
      if (c) h += ' · ' + c[j] + ' 个样本';
      h += ' · 质心 ' + fmtPt(centroids[j]) + '</span>';
    }
    h += '<span class="' + PX + 'chip"><i class="' + PX + 'sw ' + PX + 'dia" aria-hidden="true"></i>菱形是质心</span>';
    return h;
  }

  function ariaPlot(points, labels, centroids, sseNow) {
    var s = '坐标图，横纵同一比例，网格间隔 4。' + points.length + ' 个样本。';
    var c, i, bits;
    if (!labels) return s + '还没分配。初始质心 ' + fmtList(centroids) + '。';
    c = counts(labels, centroids.length);
    bits = [];
    for (i = 0; i < c.length; i++) bits.push('簇 ' + (i + 1) + ' 有 ' + c[i] + ' 个样本，质心 ' + fmtPt(centroids[i]));
    s += bits.join('；') + '。';
    if (sseNow !== null && sseNow !== undefined) s += '簇内平方和 ' + fmt(sseNow) + '。';
    return s;
  }

  function whyWorse(preset, k, goodRun, badRun) {
    if (!(badRun.sse > goodRun.sse + 1e-6)) return '';
    if (preset.id === 'blobs' && k === 2) {
      return '坏初始化把左右两团按上下切开，质心停在 ' + fmtList(badRun.centroids) + '；好初始化一团一个质心，停在 ' + fmtList(goodRun.centroids) + '。';
    }
    if (preset.id === 'local' && k === 3) {
      return '坏初始化把左下那团切成两半，右下和右上并成一簇，质心停在 ' + fmtList(badRun.centroids) + '；好初始化三团各一个质心，停在 ' + fmtList(goodRun.centroids) + '。';
    }
    return '坏初始化停在另一个局部最优，质心是 ' + fmtList(badRun.centroids) + '。';
  }

  function summaryHTML(show, preset, k, runs) {
    var g, b, worse, same, markG, markB, capG, capB, judge;
    if (!show) {
      return '<p class="' + PX + 'wait">收敛后会在这里写下两种初始化各自跑完的最终簇内平方和。k-means 每一步都不增加目标，但换一套初始质心，最终 SSE 可能更大。</p>';
    }
    g = runs.good;
    b = runs.bad;
    if (!g || !b || g.err || b.err || g.sse === null || b.sse === null) {
      return '<p class="' + PX + 'wait">这两种初始化没能算出簇内平方和。</p>';
    }
    worse = b.sse > g.sse + 1e-6;
    same = Math.abs(b.sse - g.sse) <= 1e-6;
    markG = worse || same ? '' : PX + 'hi';
    markB = worse ? PX + 'hi' : '';
    if (!same && g.sse < b.sse) markG = PX + 'lo';
    capG = same ? '两种一样' : (g.sse < b.sse ? '较小' : '较大');
    capB = same ? '两种一样' : (b.sse > g.sse ? '较大' : '较小');
    if (worse) {
      judge = '坏初始化更差：最终簇内平方和 ' + fmt(b.sse) + ' 大于好初始化的 ' + fmt(g.sse) + '。' + whyWorse(preset, k, g, b) + '每一步都不增加目标，但 Lloyd 算法只能保证到局部最优，所以要多次初始化，留下 SSE 更小的那一次。k-means++ 改善的是初始质心怎么放，这里用事先放好的两套起点来对比。';
    } else if (same) {
      judge = '这一次两种初始化的最终簇内平方和一样，坏初始化没有被卡住。把 k 换成这套点的推荐值（明显两团用 2，三团用 3），坏初始化的最终 SSE 会严格更大。';
    } else {
      judge = '好初始化的最终簇内平方和更大。这组起点和结果对不上，需要检查初始质心。';
    }
    return '<div class="' + PX + 'pair">' +
      '<div class="' + PX + 'cell ' + markG + '"><span>好初始化的最终簇内平方和</span><b>' + fmt(g.sse) + '</b><small>' + capG + '</small></div>' +
      '<div class="' + PX + 'cell ' + markB + '"><span>坏初始化的最终簇内平方和</span><b>' + fmt(b.sse) + '</b><small>' + capB + '</small></div>' +
      '</div><p class="' + PX + 'judge">' + judge + '</p>';
  }

  /* ---------- 挂载 ---------- */
  function mount(container) {
    injectStyle();
    var reduce = false;
    try { reduce = !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
    var root = document.createElement('div');
    root.className = PX + 'root';
    root.tabIndex = 0;
    root.setAttribute('aria-label', 'k-means 演示。空格单步，R 键重置。');
    root.innerHTML = tpl(HTML);
    container.appendChild(root);

    var ls = [], timer = null, dead = false;
    var preset = PRESETS[0], k = 2, which = 'bad', runs = null, active = null, idx = -1;

    function q(r) { return root.querySelector('[data-r="' + r + '"]'); }
    function on(el, ev, fn) { el.addEventListener(ev, fn); ls.push([el, ev, fn]); }
    function stopPlay() { if (timer) { clearInterval(timer); timer = null; } }

    q('preset').innerHTML = PRESETS.map(function (p) {
      return '<option value="' + p.id + '">' + p.name + '</option>';
    }).join('');
    q('k').innerHTML = [1, 2, 3, 4].map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('');
    q('init').innerHTML = '<option value="good">好初始化</option><option value="bad">坏初始化</option>';

    function cur() { return idx < 0 || !active ? null : active.steps[idx]; }

    function sseSentence(step) {
      var prev;
      if (!step) return '样本还没分配，簇内平方和还没有。';
      if (idx === 0) return '簇内平方和 SSE = ' + fmt(step.sse) + '。这是第一步，还没有上一步；后面每一步的 SSE 都不会比上一步大。';
      prev = active.steps[idx - 1].sse;
      if (step.sse < prev - 1e-6) return '簇内平方和 SSE 从 ' + fmt(prev) + ' 降到 ' + fmt(step.sse) + '，少了 ' + fmt(prev - step.sse) + '，相对上一步没有增加。';
      if (step.sse > prev + 1e-6) return '簇内平方和 SSE 从 ' + fmt(prev) + ' 变成 ' + fmt(step.sse) + '，变大了。这一步不该让目标函数上升。';
      return '簇内平方和 SSE 仍是 ' + fmt(step.sse) + '，跟上一步一样，相对上一步没有增加。';
    }

    function whySentence(step) {
      var c, empty, i, prevC, bits;
      if (!step) return '初始质心放在 ' + fmtList(preset.init[k][which]) + '。按「单步」做分配：每个样本归到平方距离最近的质心。';
      if (step.phase === 'assign') {
        c = counts(step.labels, step.centroids.length);
        bits = [];
        for (i = 0; i < c.length; i++) bits.push('簇 ' + (i + 1) + ' 有 ' + c[i] + ' 个样本');
        return '分配步把每个样本归到平方距离最近的质心，距离一样就归编号较小的那个。这是硬分配，一个样本只进一个簇。固定质心时，这样分不会比别的分法留下更大的簇内平方和。' + bits.join('，') + '。';
      }
      prevC = active.steps[idx - 1].centroids;
      c = counts(step.labels, step.centroids.length);
      empty = [];
      for (i = 0; i < c.length; i++) if (!c[i]) empty.push(i + 1);
      bits = '更新步把质心换成这一簇样本的坐标均值。';
      if (!step.moved) bits += '质心已经在均值上，位置仍是 ' + fmtList(step.centroids) + '，所以不再移动。';
      else bits += '质心从 ' + fmtList(prevC) + ' 移到 ' + fmtList(step.centroids) + '。';
      if (empty.length) bits += '簇 ' + empty.join('、') + ' 没有样本，质心留在原地。';
      bits += '给定分配时，均值是平方距离和的最小值，所以这一步的目标函数不会变大。';
      if (active.converged && idx === active.steps.length - 1) bits += '分配和质心都不再变化，Lloyd 算法停在这里。';
      return bits;
    }

    function render() {
      var step = cur(), labels = step ? step.labels : null;
      var cents = step ? step.centroids : preset.init[k][which];
      var done = !!(active && !active.err && idx >= active.steps.length - 1);
      var nextIsUpdate = !!(step && step.phase === 'assign' && !done);
      var playBtn = q('play'), stepBtn = q('step'), note = preset.note;
      if (k !== preset.k0) note += '当前 k = ' + k + '，不是这套点的推荐值 ' + preset.k0 + '。';
      q('note').textContent = note;
      if (active && active.err) q('status').textContent = active.err;
      else if (!step) q('status').textContent = '当前还没开始。下一步是分配步。' + sseSentence(null);
      else {
        q('status').textContent = (done ? '已收敛。最后一步是' : '当前是') +
          (step.phase === 'assign' ? '分配步' : '更新步') +
          '（第 ' + step.round + ' 轮，第 ' + (idx + 1) + ' / ' + active.steps.length + ' 步）。' +
          sseSentence(step);
      }
      q('why').textContent = active && active.err ? '请换一个 k，或换一套点。' : whySentence(step);
      q('sum').innerHTML = summaryHTML(done, preset, k, runs);
      q('legend').innerHTML = legendHTML(labels, cents);
      q('plot').innerHTML = plotHTML(preset.points, labels, cents);
      q('plot').setAttribute('aria-label', ariaPlot(preset.points, labels, cents, step ? step.sse : null));
      stepBtn.disabled = !active || !!active.err || done;
      stepBtn.setAttribute('aria-label', done ? '已收敛，单步停止' : (nextIsUpdate ? '单步，更新质心' : '单步，进行分配'));
      if (reduce) {
        playBtn.disabled = true;
        playBtn.textContent = '自动播放';
        playBtn.setAttribute('aria-pressed', 'false');
        playBtn.setAttribute('aria-label', '自动播放已关闭：系统开启了减少动态效果');
        playBtn.title = '系统开启了减少动态效果，不自动播放。请用单步或空格。';
      } else {
        playBtn.disabled = !active || !!active.err;
        playBtn.textContent = timer ? '暂停' : '自动播放';
        playBtn.setAttribute('aria-pressed', timer ? 'true' : 'false');
        playBtn.setAttribute('aria-label', timer ? '暂停自动播放' : '自动播放，分配和更新交替进行');
        playBtn.removeAttribute('title');
      }
    }

    function loadConfig() {
      stopPlay();
      preset = presetById(q('preset').value);
      k = Number(q('k').value);
      if (!preset.init[k]) k = preset.k0;
      which = q('init').value === 'good' ? 'good' : 'bad';
      q('preset').value = preset.id;
      q('k').value = String(k);
      q('init').value = which;
      runs = {
        good: runUntil(preset.points, preset.init[k].good),
        bad: runUntil(preset.points, preset.init[k].bad)
      };
      active = runs[which];
      idx = -1;
      render();
    }

    function doStep() {
      if (dead || !active || active.err) return;
      if (idx >= active.steps.length - 1) { stopPlay(); render(); return; }
      idx++;
      if (idx >= active.steps.length - 1) stopPlay();
      render();
    }

    function doReset() {
      if (dead) return;
      stopPlay();
      idx = -1;
      render();
    }

    function play() {
      if (dead || reduce || !active || active.err) return;
      if (timer) { stopPlay(); render(); return; }
      if (idx >= active.steps.length - 1) idx = -1;
      timer = setInterval(doStep, 850);
      doStep();
    }

    on(root, 'click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null, r;
      if (!b || !root.contains(b) || b.disabled) return;
      r = b.getAttribute('data-r');
      if (r === 'step') doStep();
      else if (r === 'play') play();
      else if (r === 'reset') doReset();
    });
    on(root, 'change', function (e) {
      var r = e.target.getAttribute && e.target.getAttribute('data-r');
      if (r === 'preset') {
        var p = presetById(e.target.value);
        q('k').value = String(p.k0);
      }
      if (r === 'preset' || r === 'k' || r === 'init') loadConfig();
    });
    on(document, 'keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (dead || e.repeat) return;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); doReset(); return; }
      if (e.key === ' ' || e.key === 'Spacebar') {
        if (tag === 'BUTTON') return;
        e.preventDefault();
        doStep();
      }
    });

    q('preset').value = 'blobs';
    q('k').value = '2';
    q('init').value = 'bad';
    if (reduce) q('play').title = '系统开启了减少动态效果，不自动播放。请用单步或空格。';
    loadConfig();

    return {
      destroy: function () {
        dead = true;
        stopPlay();
        ls.forEach(function (x) { x[0].removeEventListener(x[1], x[2]); });
        ls = [];
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  /* ---------- 自测：不碰 DOM。期望值先用 Python 按同一规则算过，再写死在下面 ---------- */
  function eqNum(a, b) { return Math.abs(a - b) < 1e-6; }
  function eqPt(a, b) { return !!a && !!b && eqNum(a[0], b[0]) && eqNum(a[1], b[1]); }
  function eqPts(a, b) {
    var i;
    if (!a || !b || a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) if (!eqPt(a[i], b[i])) return false;
    return true;
  }
  function ssesOf(run) {
    var a = [], i;
    for (i = 0; i < run.steps.length; i++) a.push(run.steps[i].sse);
    return a;
  }
  function monotone(steps) {
    var i;
    for (i = 1; i < steps.length; i++) if (steps[i].sse > steps[i - 1].sse + 1e-6) return false;
    return true;
  }

  function selfTest() {
    var details = [], ok = true;
    function chk(name, pass, info) {
      ok = ok && !!pass;
      details.push((pass ? '通过：' : '失败：') + name + '。' + info);
    }

    var handPts = [[0, 0], [0, 4], [6, 2], [10, 10], [10, 14], [16, 12]];
    var handInit = [[0, 0], [10, 10]];
    var want1 = [[2, 2], [12, 12]];
    var want2 = [[2, 2], [12, 12]];
    var hand, threw, res, blobs, local, g, b, sweepOk, sweepN, badName, pi, kk, kind, run, frozen, i;

    threw = false;
    try { hand = runUntil(handPts, handInit); } catch (e1) { threw = true; hand = null; }
    chk('6 个点、2 个簇，两轮迭代的质心和标签',
      !threw && hand && hand.converged && hand.steps.length === 4 &&
        eqPts(hand.steps[1].centroids, want1) && eqPts(hand.steps[3].centroids, want2) &&
        hand.steps[0].labels.join(',') === '0,0,0,1,1,1' &&
        hand.steps[2].labels.join(',') === '0,0,0,1,1,1' &&
        eqPts(hand.steps[0].centroids, [[0, 0], [10, 10]]) &&
        hand.steps[1].phase === 'update' && hand.steps[3].phase === 'update' && hand.steps[3].moved === false,
      '期望写死：第 1 轮更新后质心 (2, 2)、(12, 12)，第 2 轮更新后仍是 (2, 2)、(12, 12)，两轮标签都是 [0,0,0,1,1,1]。得到 ' +
        (hand ? '第 1 轮更新 ' + JSON.stringify(hand.steps[1].centroids) + '，第 2 轮更新 ' + JSON.stringify(hand.steps[3].centroids) +
          '，标签 ' + hand.steps[0].labels.join(',') + ' / ' + hand.steps[2].labels.join(',') : '运行失败') +
        '。Python 核对：点 (0,0)、(0,4)、(6,2)、(10,10)、(10,14)、(16,12)，初始质心 (0,0)、(10,10)。平方距离分别是 0 对 200、16 对 136、40 对 80、200 对 0、296 对 16、400 对 40，所以前三点归簇 0、后三点归簇 1。更新：簇 0 均值 ((0+0+6)/3,(0+4+2)/3)=(2,2)，簇 1 均值 ((10+10+16)/3,(10+14+12)/3)=(12,12)。第 2 轮分配不变，均值也不动。平局归编号较小的质心，空簇质心不动；这一题没有平局也没有空簇。');

    chk('6 个点的簇内平方和依次是 112、64、64、64，且单调不增',
      !!(hand && hand.steps.length === 4 && eqNum(hand.steps[0].sse, 112) && eqNum(hand.steps[1].sse, 64) &&
        eqNum(hand.steps[2].sse, 64) && eqNum(hand.steps[3].sse, 64) && monotone(hand.steps)),
      '期望 SSE 写死为 [112, 64, 64, 64]。得到 ' + (hand ? JSON.stringify(ssesOf(hand)) : '无') +
        '。112 = 0+16+40+0+16+40，是初始质心上的分配。更新后各点到 (2,2) 或 (12,12) 的平方距离是 8、8、16、8、8、16，和为 64。第 2 轮分配和更新都不再改变，SSE 保持 64，四步相对上一步都不增。');

    blobs = presetById('blobs');
    frozen = JSON.stringify(blobs.init[2].bad);
    g = runUntil(blobs.points, blobs.init[2].good);
    b = runUntil(blobs.points, blobs.init[2].bad);
    chk('明显两团、k=2：坏初始化的最终 SSE 严格大于好初始化',
      g.converged && b.converged && eqNum(g.sse, 64) && eqNum(b.sse, 160) && b.sse > g.sse &&
        eqPts(g.centroids, [[4, 8], [12, 8]]) && eqPts(b.centroids, [[8, 10], [8, 6]]) &&
        JSON.stringify(ssesOf(b)) === JSON.stringify([288, 160, 160, 160]) &&
        frozen === JSON.stringify(blobs.init[2].bad),
      '好初始化 (4, 8)、(12, 8) 的最终 SSE 期望 64，坏初始化 (4, 10)、(4, 6) 的最终 SSE 期望 160，坏的一步 SSE 期望 [288, 160, 160, 160]。得到好 ' + g.sse + '、坏 ' + b.sse + '，坏的各步 ' + JSON.stringify(ssesOf(b)) +
        '。Python：好初始化下每点偏移 (±2,±2)，平方距离 8，8 点合计 64，质心不动。坏初始化先按上下切开，SSE=4+4+4+4+36+36+100+100=288；更新到 (8,10)、(8,6) 后每排 36+4+4+36=80，两排 160，之后分配和质心都不变。160>64。');

    local = presetById('local');
    g = runUntil(local.points, local.init[3].good);
    b = runUntil(local.points, local.init[3].bad);
    chk('容易陷入局部最优、k=3：坏初始化的最终 SSE 严格大于好初始化',
      g.converged && b.converged && eqNum(g.sse, 24) && eqNum(b.sse, 148) && b.sse > g.sse &&
        eqPts(b.centroids, [[3, 4], [5, 4], [12, 8]]) &&
        eqNum(b.steps[0].sse, 276) && eqNum(b.steps[1].sse, 148),
      '好初始化 (4,4)、(12,4)、(12,12) 的最终 SSE 期望 24，坏初始化 (3,4)、(5,4)、(12,4) 的最终 SSE 期望 148。得到好 ' + g.sse + '、坏 ' + b.sse + '，坏的各步 ' + JSON.stringify(ssesOf(b)) +
        '。Python：每团 4 个点，每点到团中心的平方距离是 2，三团 24。坏初始化第 1 次分配 SSE=1+1+1+1+2+2+2+2+50+82+50+82=276；更新后质心 (3,4)、(5,4)、(12,8)，左下两半各贡献 2，右边 8 个点贡献 144，合计 148，下一步分配不变。148>24。');

    sweepOk = true;
    sweepN = 0;
    badName = '';
    for (pi = 0; pi < PRESETS.length; pi++) {
      for (kk = 1; kk <= 4; kk++) {
        for (kind = 0; kind < 2; kind++) {
          run = runUntil(PRESETS[pi].points, kind ? PRESETS[pi].init[kk].bad : PRESETS[pi].init[kk].good);
          sweepN++;
          if (run.err || !run.converged || !monotone(run.steps) || !run.steps.length) {
            sweepOk = false;
            badName = PRESETS[pi].id + ' k=' + kk + ' ' + (kind ? 'bad' : 'good');
          }
        }
      }
    }
    if (hand && !monotone(hand.steps)) { sweepOk = false; badName = 'hand6'; }
    chk('两套预设、k=1 到 4、好和坏初始化，逐步 SSE 都不增',
      sweepOk && sweepN === 16 && hand && monotone(hand.steps),
      '共 ' + sweepN + ' 次预设运行，另加 6 点那一题。规则是后一步 SSE ≤ 前一步（容差 1e-6）。' +
        (sweepOk ? 'Python 用同一套点和初始质心扫过，也全部单调并在 32 轮内停住。界面只按 runUntil 的 steps 逐格显示，不另写计算。' : '失败于 ' + badName + '。'));

    threw = false;
    res = null;
    try { res = runUntil([], [[0, 0]]); } catch (e2) { threw = true; }
    chk('空点集给出明确结果，不抛错',
      !threw && res && typeof res.err === 'string' && res.err.length > 0 && res.sse === null && res.steps.length === 0 && res.converged === false,
      'runUntil([], [[0,0]]) 得到 err=' + (res ? JSON.stringify(res.err) : '抛错') + '，sse=' + (res ? String(res.sse) : '无') + '。空点集没有样本可分配，簇内平方和不定义，函数返回这段说明而不是抛异常。');

    threw = false;
    res = null;
    try { res = runUntil([[0, 0], [1, 1]], [[0, 0], [1, 0], [0, 1]]); } catch (e3) { threw = true; }
    var zero = null, threw0 = false;
    try { zero = runUntil([[0, 0], [1, 0], [0, 1]], []); } catch (e4) { threw0 = true; }
    chk('k 大于点数时给出明确结果，不抛错',
      !threw && res && typeof res.err === 'string' && res.err.indexOf('大于') >= 0 && res.sse === null && res.steps.length === 0 &&
        !threw0 && zero && typeof zero.err === 'string' && zero.sse === null,
      '2 个点配 3 个初始质心，得到 err=' + (res ? JSON.stringify(res.err) : '抛错') + '。另外 k=0（空的初始质心）得到 err=' + (zero ? JSON.stringify(zero.err) : '抛错') + '。两种都返回说明，sse 为 null，不抛异常。');

    var emptyRun = null, tie = null, near = null, threwE = false;
    try {
      emptyRun = runUntil([[0, 0], [0, 2], [0, 4]], [[0, 2], [20, 20]]);
      tie = assign([[0, 0]], [[0, 1], [0, -1]]);
      near = assign([[5, 0]], [[0, 0], [4, 0]]);
    } catch (e5) { threwE = true; }
    chk('空簇的质心留在原地；距离平局归编号较小的质心',
      !threwE && emptyRun && emptyRun.converged && eqNum(emptyRun.sse, 8) &&
        eqPts(emptyRun.centroids, [[0, 2], [20, 20]]) && emptyRun.labels.join(',') === '0,0,0' &&
        tie && tie[0] === 0 && near && near[0] === 1,
      '3 个点 (0,0)、(0,2)、(0,4)，初始质心 (0,2)、(20,20)。Python：三点都更靠近 (0,2)，第二个质心没有样本，留在 (20,20)；均值是 (0,2)，SSE=4+0+4=8。得到质心 ' +
        (emptyRun ? JSON.stringify(emptyRun.centroids) + '，SSE ' + emptyRun.sse : '失败') +
        '。平局：点 (0,0) 到 (0,1) 和 (0,-1) 的平方距离都是 1，期望标签 0，得到 ' + (tie ? String(tie[0]) : '无') +
        '。点 (5,0) 更靠近 (4,0)，期望标签 1，得到 ' + (near ? String(near[0]) : '无') + '。');

    return { ok: ok, details: details };
  }

  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = {
    title: 'k-means：分配与更新交替进行',
    mount: mount,
    selfTest: selfTest
  };
})();
