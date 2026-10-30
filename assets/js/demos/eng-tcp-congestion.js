/* 交互演示：TCP 拥塞窗口——慢启动、拥塞避免与快速恢复。按 RTT 轮次简化，Reno / Tahoe 两种变体。
 * 纯原生 JS，挂到 window.KGDemos['eng-tcp-congestion']。 */
(function () {
'use strict';
var ID = 'eng-tcp-congestion', PX = 'dm-' + ID + '-';
var ROUNDS = [15, 20, 25, 30], MAX_EV = 8;
var EV = { dup: '三个重复 ACK', to: '超时' };
var PHASE = { ss: '慢启动', ca: '拥塞避免', fr: '快速恢复' };
var VAR = { reno: 'Reno', tahoe: 'Tahoe' };
var FB = { '--text': '#1b1b19', '--text-2': '#52514e', '--text-3': '#6b6a66', '--surface': '#fff', '--surface-2': '#f0efec',
  '--border': '#e2e1dc', '--c-eng': '#a23b72', '--div-pos': '#e34948', '--focus': '#2457b3' };

function tpl(s) { return s.replace(/@@/g, PX); }

/* ---------- 核心计算（不碰 DOM） ---------- */
// 第 t 轮用 cwnd 个报文段；events[t] 是第 t 轮结束时发现的事件，影响第 t+1 轮。
// 每轮记下：cwnd、ssthresh、阶段、这一轮的 cwnd 是怎么来的（why，p 是上一轮的 cwnd），以及下一轮的值 nc、ns。
function simulate(T, ss0, variant, events) {
  var out = [], cw = 1, ss = ss0, fr = false, why = 'init', p = null, t, r, e;
  for (t = 1; t <= T; t++) {
    r = { t: t, cwnd: cw, ss: ss, phase: fr ? 'fr' : cw < ss ? 'ss' : 'ca', why: why, p: p, ev: events[t] || null };
    e = r.ev; p = cw;
    if (e) {
      ss = Math.max(Math.floor(cw / 2), 2);
      if (e === 'dup' && variant === 'reno') { cw = ss + 3; fr = true; why = 'dupR'; }
      else { cw = 1; fr = false; why = e === 'to' ? 'to' : 'dupT'; }
    } else if (fr) { cw += 1; fr = false; why = 'frca'; }
    else if (cw < ss) { why = 2 * cw > ss ? 'cap' : 'ss'; cw = Math.min(2 * cw, ss); }
    else { cw += 1; why = 'ca'; }
    r.nc = cw; r.ns = ss;
    out.push(r);
  }
  return out;
}

// 事件只能放在第 1 到 T−1 轮末：最后一轮之后没有下一轮，看不到效果
function eventRound(str, T) {
  var s = String(str).trim(), t = /^\d+$/.test(s) ? Number(s) : NaN;
  if (!(t >= 1 && t <= T - 1)) return { err: '轮次要是 1 到 ' + (T - 1) + ' 之间的整数（最后一轮之后没有下一轮，看不到效果）。' };
  return { t: t };
}

function evKey(ev) { return Object.keys(ev).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return k + ev[k]; }).join(); }

var PRESETS = {
  kurose: { name: '教材图：第 8 轮末三个重复 ACK', T: 15, ss: 8, v: 'reno', ev: { 8: 'dup' },
    note: 'Kurose & Ross《计算机网络：自顶向下方法》里对比 Tahoe 和 Reno 的那张图：初始 ssthresh = 8，第 8 轮（cwnd = 12）结束时收到三个重复 ACK。Reno 下一轮 cwnd = 6 + 3 = 9，接着每轮加 1；把变体换成 Tahoe，下一轮从 1 重新慢启动。勾选「叠加另一种变体」可以把两条线画在一起。' },
  timeout: { name: '第 7 轮末超时', T: 20, ss: 16, v: 'reno', ev: { 7: 'to' },
    note: '初始 ssthresh = 16，第 7 轮（cwnd = 18）结束时超时：ssthresh 降到 9，cwnd 回到 1 重新慢启动。翻倍到 8 之后，再翻倍会超过 9，只涨到 9，然后转入拥塞避免。超时的处理 Reno 和 Tahoe 一样，换变体曲线不变。' },
  both: { name: '先三个重复 ACK，再超时', T: 20, ss: 8, v: 'reno', ev: { 8: 'dup', 14: 'to' },
    note: '第 8 轮末三个重复 ACK：只丢了个别报文段，Reno 把窗口减半后继续线性增长。第 14 轮末超时：拥塞严重，窗口回到 1。比较两次之后曲线的走法；再换成 Tahoe，两次都会从 1 重新开始。' }
};

/* ---------- 文字说明 ---------- */
function explain(r) {
  var p = r.p, h, half = 'max(⌊' + p + ' ÷ 2⌋, 2) = ' + r.ss;
  switch (r.why) {
    case 'init': h = '连接刚建立，cwnd 从 1 个 MSS 开始，初始 ssthresh = ' + r.ss + '。cwnd < ssthresh，处于慢启动：这一轮只发 1 个报文段。'; break;
    case 'ss': h = '上一轮发出的 ' + p + ' 个报文段都收到了确认。慢启动时每收到一个 ACK，cwnd 加 1 个 MSS，一轮下来翻倍：' + p + ' × 2 = ' + r.cwnd + '。'; break;
    case 'cap': h = '上一轮的 ' + p + ' 个报文段都收到了确认。翻倍是 ' + 2 * p + '，超过了 ssthresh = ' + r.ss + '，只涨到 ssthresh：cwnd = min(' + 2 * p + ', ' + r.ss + ') = ' + r.cwnd + '。'; break;
    case 'ca': h = '上一轮 cwnd = ' + p + '，不小于 ssthresh = ' + r.ss + '，处于拥塞避免：每轮只加 1 个 MSS（加性增），' + p + ' + 1 = ' + r.cwnd + '。'; break;
    case 'frca': h = '上一轮是快速恢复。按教材图的按轮简化，接着转入拥塞避免，每轮加 1：' + p + ' + 1 = ' + r.cwnd + '。'; break;
    case 'dupR': h = '第 ' + (r.t - 1) + ' 轮结束时收到三个重复 ACK：有一个报文段丢了，但它后面的报文段还在陆续到达，网络只是轻度拥塞。Reno 马上重传丢失的报文段（快速重传），ssthresh = ' + half +
      '，cwnd = ssthresh + 3 = ' + r.cwnd + '（加的 3 对应那 3 个已经离开网络的报文段），进入快速恢复。ssthresh 减半，这是乘性减。'; break;
    case 'dupT': h = '第 ' + (r.t - 1) + ' 轮结束时收到三个重复 ACK。Tahoe 不区分重复 ACK 和超时，一律从头来：ssthresh = ' + half + '，cwnd 回到 1，重新慢启动。'; break;
    default: h = '第 ' + (r.t - 1) + ' 轮结束时超时：一直等不到确认，可能连后面的报文段也丢了，说明拥塞严重。ssthresh = ' + half + '，cwnd 回到 1，重新慢启动（Reno 和 Tahoe 都这样）。';
  }
  if ((r.why === 'ss' || r.why === 'cap') && r.phase === 'ca') h += '现在 cwnd = ssthresh，慢启动到此为止：从下一轮起每轮只加 1，所以这一轮在表里记为拥塞避免。';
  if (r.ev) {
    h += '这一轮结束时' + (r.ev === 'dup' ? '收到三个重复 ACK' : '超时') + '：下一轮 ssthresh = ' + r.ns + '，cwnd = ' + r.nc + '。';
    if (r.ev === 'dup' && r.cwnd < 4) h += '（实际上 cwnd 不到 4 个报文段时，丢掉的那个后面最多只有 ' + (r.cwnd - 1) + ' 个报文段，凑不齐 3 个重复 ACK，通常只能等超时；这里仍按你安排的事件计算。）';
  }
  return h;
}

/* ---------- 图和表 ---------- */
function f1(x) { return Math.round(x * 10) / 10; }

function chartSVG(W, rows, s, cmp) {
  var T = rows.length, H = W < 480 ? 230 : 280, L = 34, R = 12, TOP = 38, B = 26, pw = W - L - R, ph = H - TOP - B, dx = pw / T,
    ymax = 1, h = '', i, v, r;
  rows.concat(cmp || []).forEach(function (x) { ymax = Math.max(ymax, x.cwnd, x.ss); });
  var step = [2, 4, 5, 10, 20].filter(function (x) { return ymax / x <= 6; })[0] || 20, top = Math.ceil((ymax + 1) / step) * step;
  function X(t) { return f1(L + (t - 0.5) * dx); }
  function Y(y) { return f1(TOP + ph - y / top * ph); }
  function pts(list) { return list.slice(0, s).map(function (x) { return X(x.t) + ',' + Y(x.cwnd); }).join(' '); }
  if (s) h += '<rect class="@@band" x="' + f1(L + (s - 1) * dx) + '" y="' + TOP + '" width="' + f1(dx) + '" height="' + ph + '"/>';
  for (v = 0; v <= top; v += step) {
    h += '<line class="@@gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="@@ax" x="' + (L - 6) + '" y="' + f1(Y(v) + 4) + '" text-anchor="end">' + v + '</text>';
  }
  var k = dx >= 22 ? 1 : dx >= 11 ? 2 : 5;
  for (i = 1; i <= T; i++) if (i === 1 || i % k === 0) h += '<text class="@@ax" x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + i + '</text>';
  // 丢包事件：竖虚线画在那一轮的末尾；两个标签挨得太近时放到上下两行
  var lastX = [-1e9, -1e9];
  rows.forEach(function (x) {
    if (!x.ev || x.t > s) return;
    var at = f1(L + x.t * dx), w = x.ev === 'dup' ? 76 : 26, tx = f1(Math.max(L + w / 2, Math.min(W - R - w / 2, at))), row = tx - lastX[0] >= w + 10 ? 0 : 1;
    lastX[row] = tx;
    h += '<line class="@@evl" x1="' + at + '" x2="' + at + '" y1="' + (row ? 17 : 31) + '" y2="' + (TOP + ph) + '"/>' +
      '<text class="@@evt" x="' + tx + '" y="' + (row ? 12 : 26) + '" text-anchor="middle">' + EV[x.ev] + '</text>';
  });
  if (s) {
    var d = 'M' + L + ' ' + Y(rows[0].ss);
    for (i = 0; i < s; i++) d += (i ? 'V' + Y(rows[i].ss) : '') + 'H' + f1(L + (i + 1) * dx);
    h += '<path class="@@ssl" d="' + d + '"/>';
    if (cmp) h += '<polyline class="@@cmpl" points="' + pts(cmp) + '"/>';
    h += '<polyline class="@@cwl" points="' + pts(rows) + '"/>';
  }
  for (i = 0; i < s; i++) {
    r = rows[i];
    var cur = i === s - 1;
    h += '<circle class="@@' + (cur ? 'ptc' : 'pt') + '" cx="' + X(r.t) + '" cy="' + Y(r.cwnd) + '" r="' + (cur ? 5.5 : 3.5) + '"/>';
    if (cur || dx >= 26) h += '<text class="@@vl" x="' + X(r.t) + '" y="' + f1(Y(r.cwnd) - 9) + '" text-anchor="middle">' + r.cwnd + '</text>';
  }
  var lab = s ? 'cwnd 折线图：第 1 到 ' + s + ' 轮的 cwnd 依次是 ' + rows.slice(0, s).map(function (x) { return x.cwnd; }).join('、') +
    '；ssthresh 依次是 ' + rows.slice(0, s).map(function (x) { return x.ss; }).join('、') : 'cwnd 折线图：还没开始';
  return '<svg class="@@svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + lab + '">' + h + '</svg>';
}

function tableHTML(rows, s, v) {
  var h = '<div class="@@tw" data-r="tw"><table><thead><tr><th scope="col">轮次</th><th scope="col">阶段</th><th scope="col">cwnd</th><th scope="col">ssthresh</th>' +
    '<th scope="col">本轮末的事件</th></tr></thead><tbody>', i, r;
  if (!s) h += '<tr><td colspan="5" class="@@f">还没开始</td></tr>';
  for (i = 0; i < s; i++) {
    r = rows[i];
    h += '<tr' + (i === s - 1 ? ' class="@@cur"' : '') + '><th scope="row">' + r.t + '</th><td class="@@f">' + PHASE[r.phase] + '</td><td>' + r.cwnd + '</td><td>' + r.ss +
      '</td><td class="@@f">' + (r.ev ? EV[r.ev] + (r.ev === 'dup' && v === 'tahoe' ? '（Tahoe 按超时处理）' : '') : '') + '</td></tr>';
  }
  return h + '</tbody></table></div>';
}

function sw(cls, vert) {
  return '<svg class="@@sw" viewBox="0 0 28 12" aria-hidden="true">' + (vert ? '<line class="' + cls + '" x1="14" y1="0" x2="14" y2="12"/>'
    : '<line class="' + cls + '" x1="1" y1="6" x2="27" y2="6"/>' + (cls === '@@cwl' ? '<circle class="@@pt" cx="14" cy="6" r="3"/>' : '')) + '</svg>';
}

/* ---------- 样式（@@ 换成类名前缀，~--x N~ 换成按比例混进 --surface 的浅色底） ---------- */
var CSS = [
  '.@@root{font-family:var(--font);color:var(--text);font-size:15px;line-height:1.65;display:flex;flex-direction:column;gap:12px;min-width:0}',
  '.@@root *{box-sizing:border-box}',
  '.@@root p{margin:0}',
  '.@@root h4{margin:0 0 8px;font-size:15px;font-weight:600;line-height:1.4;color:var(--text)}',
  '.@@root h4 small{margin-left:8px;font-size:13px;font-weight:400;color:var(--text-2)}',
  '.@@intro{font-size:14px;color:var(--text-2)}',
  '.@@box,.@@card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius,10px);padding:12px;min-width:0}',
  '.@@ctl{display:flex;flex-direction:column;gap:10px}',
  '.@@params,.@@bar{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}',
  '.@@root label{display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:14px;color:var(--text-2);max-width:100%}',
  '.@@root label b{font-family:var(--mono);color:var(--text);min-width:1.5em}',
  '.@@root select,.@@root input{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:5px 8px;min-height:36px;max-width:100%;min-width:0}',
  '.@@root input[type=number]{width:4.5em;font-family:var(--mono)}',
  '.@@root input[type=range]{width:150px;padding:0;border:0;background:none;accent-color:var(--c-eng)}',
  '.@@root input[type=checkbox]{width:18px;height:18px;min-height:0;margin:0;accent-color:var(--c-eng)}',
  '.@@hint{font-size:14px;color:var(--text-2)}',
  '.@@btn{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 12px;min-height:36px;cursor:pointer}',
  '.@@btn:hover:not([aria-disabled=true]){background:var(--surface-2)}',
  '.@@pri,.@@btn[aria-pressed=true]{border-color:var(--c-eng);background:~--c-eng 14~}',
  '.@@pri{font-weight:600}',
  '.@@btn[aria-disabled=true]{color:~--text 45~;background:var(--surface);border-color:var(--border);cursor:default}',
  '.@@sm{min-height:30px;padding:2px 8px;font-size:13px}',
  '.@@root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}',
  '.@@evs{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}',
  '.@@evs li{display:inline-flex;align-items:center;gap:8px;padding:2px 4px 2px 10px;border:1px solid var(--border);border-left:3px solid var(--c-eng);border-radius:8px;background:var(--surface-2);font-size:14px}',
  '.@@evs li.@@note{border:0;background:none;padding:0;margin:0!important}',
  '.@@msg{font-size:14px;color:var(--text-2)}.@@msg:empty{display:none}',
  '.@@msg.@@err{color:var(--text);padding:6px 10px;border-left:3px solid var(--div-pos);background:~--div-pos 10~;border-radius:4px}',
  '.@@pos{flex:1 1 220px;font-size:14px;color:var(--text-2)}',
  '.@@now{background:~--c-eng 7~;border:1px solid var(--border);border-left:4px solid var(--c-eng);border-radius:var(--radius,10px);padding:10px 14px;line-height:1.75}',
  '.@@note{font-size:13px;color:var(--text-3);margin-top:6px!important}',
  '.@@chart{min-width:0}',
  '.@@svg{display:block;width:100%;height:auto}',
  '.@@gl{stroke:var(--border);stroke-width:1}',
  '.@@ax{fill:var(--text-2);font-size:11px;font-family:var(--font)}',
  '.@@vl{fill:var(--text);font-size:11px;font-family:var(--mono)}',
  '.@@evt{fill:var(--text);font-size:11px;font-family:var(--font)}',
  '.@@band{fill:~--c-eng 12~}',
  '.@@cwl{fill:none;stroke:var(--c-eng);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}',
  '.@@ssl{fill:none;stroke:var(--text-2);stroke-width:1.5;stroke-dasharray:6 4}',
  '.@@cmpl{fill:none;stroke:var(--c-eng);stroke-width:2;stroke-dasharray:1 5;stroke-linecap:round}',
  '.@@evl{stroke:var(--text-3);stroke-width:1.2;stroke-dasharray:3 3}',
  '.@@pt{fill:var(--c-eng)}',
  '.@@ptc{fill:var(--c-eng);stroke:var(--text);stroke-width:2}',
  '.@@legend{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px;color:var(--text-2);margin-top:6px}',
  '.@@legend span{display:inline-flex;align-items:center;gap:6px}.@@legend [hidden]{display:none}',
  '.@@sw{width:28px;height:12px;flex:none}',
  '.@@tw{overflow:auto;max-height:300px;border:1px solid var(--border);border-radius:8px}',
  '.@@root table{border-collapse:separate;border-spacing:0;width:100%;font-size:13px}',
  '.@@root th,.@@root td{border-bottom:1px solid var(--border);padding:4px 10px;text-align:center;white-space:nowrap;font-weight:400;color:var(--text)}',
  '.@@root thead th{position:sticky;top:0;z-index:1;background:var(--surface-2);font-weight:600;color:var(--text-2)}',
  '.@@root td{font-family:var(--mono)}.@@root td.@@f{font-family:var(--font)}',
  '.@@cur>*{background:~--c-eng 12~;font-weight:600}',
  '.@@cur>th{box-shadow:inset 3px 0 var(--c-eng)}'
].join('\n');

function injectStyle() {
  if (document.getElementById('dm-style-' + ID)) return;
  var st = document.createElement('style');
  st.id = 'dm-style-' + ID;
  st.textContent = tpl(CSS).replace(/~(--[\w-]+) (\d+)~/g, 'color-mix(in srgb,var($1) $2%,var(--surface))')
    .replace(/var\((--[\w-]+)\)/g, function (m, v) { return FB[v] ? 'var(' + v + ',' + FB[v] + ')' : m; });
  document.head.appendChild(st);
}

var HTML =
  '<p class="@@how">怎么玩：选一个预设，或者自己调初始 ssthresh、选 Reno 或 Tahoe，在某一轮末安排「三个重复 ACK」或「超时」。按「下一步」一轮一轮地推进，看 cwnd 怎么涨、丢包后怎么降。' +
  '改设置时曲线立即重算，停在当前这一轮，方便对比。</p>' +
  '<p class="@@intro">TCP 发送方用拥塞窗口 cwnd 限制一轮最多发几个报文段。cwnd 小于慢启动阈值 ssthresh 时是慢启动，每轮翻倍；达到 ssthresh 后是拥塞避免，每轮加 1。' +
  '发现丢包就把 ssthresh 降到当时 cwnd 的一半：三个重复 ACK 说明只丢了个别报文段，Reno 进入快速恢复，cwnd = ssthresh + 3；超时说明拥塞严重，cwnd 回到 1 重新慢启动。</p>' +
  '<div class="@@box @@ctl"><div class="@@params">' +
  '<label>预设<select data-r="preset" aria-label="预设场景"></select></label>' +
  '<label>变体<select data-r="v" aria-label="TCP 变体"><option value="reno">Reno</option><option value="tahoe">Tahoe</option></select></label>' +
  '<label>轮数<select data-r="T" aria-label="一共推进多少轮"></select></label>' +
  '<label>初始 ssthresh <b data-r="ssv"></b><input data-r="ss" type="range" min="4" max="32" step="1" aria-label="初始 ssthresh，4 到 32 个 MSS"></label></div>' +
  '<div class="@@params"><span class="@@hint">安排丢包事件：</span>' +
  '<label>第<input data-r="er" type="number" min="1" step="1" value="8" inputmode="numeric" aria-label="事件发生在第几轮结束时">轮结束时</label>' +
  '<select data-r="et" aria-label="事件类型"><option value="dup">三个重复 ACK</option><option value="to">超时</option></select>' +
  '<button type="button" class="@@btn" data-r="add" aria-label="添加这个事件">添加事件</button></div>' +
  '<ul class="@@evs" data-r="evs" aria-label="已安排的事件"></ul>' +
  '<label><input data-r="cmp" type="checkbox" aria-label="叠加另一种变体的 cwnd 作对比">叠加另一种变体作对比（细点线）</label>' +
  '<p class="@@msg" data-r="msg" aria-live="polite"></p></div>' +
  '<div class="@@bar" role="group" aria-label="逐轮控制">' +
  '<button type="button" class="@@btn" data-r="prev" aria-label="上一步">上一步</button>' +
  '<button type="button" class="@@btn @@pri" data-r="next" aria-label="下一步">下一步</button>' +
  '<button type="button" class="@@btn" data-r="play" aria-pressed="false" aria-label="自动播放">自动播放</button>' +
  '<button type="button" class="@@btn" data-r="reset" aria-label="重置到开始">重置</button>' +
  '<span class="@@pos" data-r="pos"></span></div>' +
  '<div class="@@now" data-r="now" aria-live="polite"></div>' +
  '<section class="@@card" aria-label="cwnd 折线图"><h4>cwnd 和 ssthresh 随轮次的变化</h4><div class="@@chart" data-r="chart"></div>' +
  '<div class="@@legend"><span>' + sw('@@cwl') + 'cwnd 拥塞窗口</span><span>' + sw('@@ssl') + 'ssthresh 慢启动阈值</span>' +
  '<span data-r="lcmp" hidden>' + sw('@@cmpl') + '另一种变体的 cwnd</span><span>' + sw('@@evl', 1) + '丢包事件，画在那一轮的末尾</span></div>' +
  '<p class="@@note">横轴是轮次，每轮一个 RTT；纵轴是报文段个数，以 MSS（最大报文段长度）为单位。接收窗口当作无限大。</p></section>' +
  '<section class="@@card" aria-label="逐轮记录"><h4>逐轮记录</h4><div data-r="table"></div></section>' +
  '<p class="@@note">这是按轮次（每个 RTT 一次）的简化。RFC 5681 的规则是按每个 ACK 更新的：慢启动每收到一个 ACK，cwnd 加 1 个 MSS，一轮下来约翻倍；' +
  '拥塞避免每个 ACK 只加 MSS × MSS / cwnd，一轮下来约加 1 个 MSS。翻倍时不超过 ssthresh、快速恢复后直接从 ssthresh + 3 每轮加 1，都是 Kurose & Ross 教材图的画法；' +
  '按 RFC 5681，Reno 收到确认新数据的 ACK、退出快速恢复时，会先把 cwnd 收回到 ssthresh，图里省掉了这一步。</p>';

/* ---------- 挂载 ---------- */
function mount(container) {
  injectStyle();
  var reduce = false;
  try { reduce = !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
  var root = document.createElement('div');
  root.className = PX + 'root';
  root.innerHTML = tpl(HTML);
  container.appendChild(root);
  var ls = [], timer = null, ro = null, raf = 0, lastW = 0, rows = [], other = [];
  var S = { T: 15, ss: 8, v: 'reno', ev: {}, cmp: false, s: 0, preset: 'kurose' };
  function q(r) { return root.querySelector('[data-r="' + r + '"]'); }
  function on(el, ev, fn) { el.addEventListener(ev, fn); ls.push([el, ev, fn]); }
  function setMsg(t, err) { var m = q('msg'); m.textContent = t; m.className = PX + 'msg' + (err ? ' ' + PX + 'err' : ''); }
  function dis(r, v) { q(r).setAttribute('aria-disabled', v ? 'true' : 'false'); }
  function off(r) { return q(r).getAttribute('aria-disabled') === 'true'; }

  q('T').innerHTML = ROUNDS.map(function (t) { return '<option value="' + t + '">' + t + ' 轮</option>'; }).join('');
  q('preset').innerHTML = Object.keys(PRESETS).map(function (k) { return '<option value="' + k + '">' + PRESETS[k].name + '</option>'; }).join('') +
    '<option value="custom">自定义</option>';
  if (reduce) q('play').title = '系统开启了「减少动态效果」，自动播放已关闭';

  function recalc() {
    rows = simulate(S.T, S.ss, S.v, S.ev);
    other = simulate(S.T, S.ss, S.v === 'reno' ? 'tahoe' : 'reno', S.ev);
    S.s = Math.min(S.s, S.T);
  }
  function matchPreset() {
    S.preset = 'custom';
    for (var id in PRESETS) { var p = PRESETS[id]; if (p.T === S.T && p.ss === S.ss && evKey(p.ev) === evKey(S.ev)) S.preset = id; }
  }
  function renderEvents() {
    var ks = Object.keys(S.ev).map(Number).sort(function (a, b) { return a - b; });
    q('evs').innerHTML = tpl(ks.length ? ks.map(function (t) {
      return '<li>第 ' + t + ' 轮末：' + EV[S.ev[t]] + '<button type="button" class="@@btn @@sm" data-del="' + t + '" aria-label="删除第 ' + t + ' 轮末的' + EV[S.ev[t]] + '">删除</button></li>';
    }).join('') : '<li class="@@note">还没有安排事件，cwnd 会一直增长。</li>');
  }
  function sync() {
    q('preset').value = S.preset; q('v').value = S.v; q('T').value = S.T; q('ss').value = S.ss; q('ssv').textContent = S.ss;
    q('cmp').checked = S.cmp; q('er').max = S.T - 1; q('lcmp').hidden = !S.cmp;
    renderEvents();
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    var b = q('play'); b.textContent = '自动播放'; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', '自动播放');
  }
  function go(k) { S.s = Math.max(0, Math.min(S.T, k)); render(); }
  function changed(msg, err) { matchPreset(); recalc(); sync(); if (msg) setMsg(msg, err); render(); }
  function loadPreset(id) {
    var p = PRESETS[id], k;
    stop(); S.T = p.T; S.ss = p.ss; S.v = p.v; S.ev = {}; S.s = 0; S.preset = id;
    for (k in p.ev) S.ev[k] = p.ev[k];
    recalc(); sync(); setMsg(p.note); render();
  }
  function addEvent() {
    var r = eventRound(q('er').value, S.T), type = q('et').value, had;
    if (r.err) { setMsg(r.err, true); return; }
    had = S.ev[r.t];
    if (!had && Object.keys(S.ev).length >= MAX_EV) { setMsg('最多安排 ' + MAX_EV + ' 个事件，先删掉一个。', true); return; }
    S.ev[r.t] = type;
    changed(had ? '第 ' + r.t + ' 轮末原来是「' + EV[had] + '」，改成了「' + EV[type] + '」。' : '已在第 ' + r.t + ' 轮末安排「' + EV[type] + '」。');
  }
  function play() {
    if (reduce) { setMsg('系统开启了「减少动态效果」，自动播放已关闭，请用「下一步」。'); return; }
    if (timer) { stop(); return; }
    if (S.s >= S.T) S.s = 0;
    var b = q('play'); b.textContent = '暂停'; b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', '暂停自动播放');
    timer = setInterval(function () { go(S.s + 1); if (S.s >= S.T) stop(); }, 900);
    go(S.s + 1);
    if (S.s >= S.T) stop();
  }
  function drawChart() {
    var box = q('chart'), W = Math.max(260, Math.round(box.clientWidth) || 600);
    lastW = W;
    box.innerHTML = tpl(chartSVG(W, rows, S.s, S.cmp ? other : null));
  }
  function render() {
    var s = S.s, r = s ? rows[s - 1] : null, tb = q('tw'), keep = tb ? tb.scrollTop : 0, cur;
    q('pos').textContent = r ? '第 ' + s + ' / ' + S.T + ' 轮：cwnd = ' + r.cwnd + '，ssthresh = ' + r.ss + '，' + PHASE[r.phase] + (s === S.T ? '。已经是最后一轮。' : '。')
      : '第 0 / ' + S.T + ' 轮：还没开始。';
    dis('prev', !s); dis('reset', !s); dis('next', s === S.T); dis('play', reduce);
    q('now').innerHTML = tpl('<h4>现在发生了什么<small>' + (r ? '第 ' + s + ' 轮 · ' + VAR[S.v] : '开始前') + '</small></h4><p>' +
      (r ? explain(r) : '连接刚建立：cwnd = 1 个 MSS，初始 ssthresh = ' + S.ss + '，变体 ' + VAR[S.v] + '。按「下一步」发出第 1 轮。') + '</p>');
    drawChart();
    q('table').innerHTML = tpl(tableHTML(rows, s, S.v));
    tb = q('tw'); tb.scrollTop = keep; cur = tb.querySelector('.' + PX + 'cur');
    if (cur) {
      var head = tb.querySelector('thead').offsetHeight, top = cur.offsetTop - head, bot = cur.offsetTop + cur.offsetHeight;
      if (top < tb.scrollTop) tb.scrollTop = top;
      else if (bot > tb.scrollTop + tb.clientHeight) tb.scrollTop = bot - tb.clientHeight;
    }
  }

  on(root, 'click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b || !root.contains(b)) return;
    var r = b.getAttribute('data-r'), del = b.getAttribute('data-del');
    if (del !== null) {
      var was = EV[S.ev[del]];
      delete S.ev[del];
      changed('删除了第 ' + del + ' 轮末的「' + was + '」。');
      q('add').focus();
      return;
    }
    if (!r || off(r)) return;
    if (r === 'next') go(S.s + 1);
    else if (r === 'prev') { stop(); go(S.s - 1); }
    else if (r === 'reset') { stop(); go(0); }
    else if (r === 'play') play();
    else if (r === 'add') addEvent();
  });
  on(root, 'change', function (e) {
    var r = e.target.getAttribute('data-r'), val = e.target.value;
    if (r === 'preset') {
      if (val === 'custom') { setMsg('在上面调 ssthresh、轮数，或者添加、删除事件。'); return; }
      loadPreset(val);
    } else if (r === 'v') {
      S.v = val;
      changed('变体改成 ' + VAR[val] + '。' + (evKey(S.ev).indexOf('dup') < 0 ? '现在没有安排三个重复 ACK，两种变体的曲线一样。' : ''));
    } else if (r === 'T') {
      var nt = Number(val), drop = Object.keys(S.ev).map(Number).filter(function (t) { return t >= nt; }).sort(function (a, b) { return a - b; });
      drop.forEach(function (t) { delete S.ev[t]; });
      S.T = nt;
      changed('轮数改成 ' + nt + '。' + (drop.length ? '第 ' + drop.join('、') + ' 轮末的事件超出范围，已删除。' : ''));
    } else if (r === 'cmp') { S.cmp = e.target.checked; sync(); render(); }
  });
  on(root, 'input', function (e) {
    if (e.target !== q('ss')) return;
    S.ss = Number(e.target.value);
    changed('');
  });
  on(root, 'keydown', function (e) {
    var tg = e.target, nm = tg.tagName;
    if (tg === q('er') && e.key === 'Enter') { e.preventDefault(); addEvent(); return; }
    if (nm === 'INPUT' || nm === 'SELECT' || nm === 'TEXTAREA' || (tg.classList && tg.classList.contains(PX + 'tw'))) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(S.s + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); go(S.s - 1); }
  });
  if (window.ResizeObserver) {
    ro = new ResizeObserver(function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { var w = Math.round(q('chart').clientWidth); if (w && Math.abs(Math.max(260, w) - lastW) > 1) drawChart(); });
    });
    ro.observe(q('chart'));
  }

  loadPreset('kurose');
  return {
    destroy: function () {
      stop();
      if (ro) { ro.disconnect(); ro = null; }
      cancelAnimationFrame(raf);
      ls.forEach(function (x) { x[0].removeEventListener(x[1], x[2]); });
      ls = [];
      if (root.parentNode) root.parentNode.removeChild(root);
    }
  };
}

/* ---------- 自测：只验证计算，不碰 DOM。期望值都手算过，并用独立的 Python 模拟核对 ---------- */
function selfTest() {
  var details = [], ok = true;
  function chk(name, got, want) {
    var pass = JSON.stringify(got) === JSON.stringify(want);
    ok = ok && pass;
    details.push((pass ? '通过：' : '失败：') + name + '，期望 ' + JSON.stringify(want) + '，得到 ' + JSON.stringify(got));
  }
  function cw(r) { return r.map(function (x) { return x.cwnd; }); }
  var a = simulate(8, 8, 'reno', {});
  chk('ssthresh = 8、不丢包：第 1–8 轮 cwnd', cw(a), [1, 2, 4, 8, 9, 10, 11, 12]);
  chk('ssthresh = 8、不丢包：第 1–3 轮慢启动，第 4 轮 cwnd 到达 ssthresh 起为拥塞避免', a.map(function (x) { return x.phase; }),
    ['ss', 'ss', 'ss', 'ca', 'ca', 'ca', 'ca', 'ca']);
  var R = simulate(15, 8, 'reno', { 8: 'dup' }), Th = simulate(15, 8, 'tahoe', { 8: 'dup' });
  chk('Reno：第 8 轮 cwnd = 12 时三个重复 ACK → 第 9 轮 ssthresh 6、cwnd 9、快速恢复；第 10 轮 cwnd 10、拥塞避免',
    [R[7].cwnd, R[8].ss, R[8].cwnd, R[8].phase, R[9].cwnd, R[9].phase], [12, 6, 9, 'fr', 10, 'ca']);
  chk('Tahoe 同一事件：第 9 轮 ssthresh 6，第 9–13 轮 cwnd 1、2、4、6、7', [Th[8].ss, cw(Th).slice(8, 13)], [6, [1, 2, 4, 6, 7]]);
  var O = simulate(10, 8, 'reno', { 8: 'to' });
  chk('超时（cwnd = 12）：第 9 轮 ssthresh 6、cwnd 1、慢启动', [O[8].ss, O[8].cwnd, O[8].phase], [6, 1, 'ss']);
  chk('教材图场景第 1–15 轮：Reno / Tahoe', [cw(R), cw(Th)],
    [[1, 2, 4, 8, 9, 10, 11, 12, 9, 10, 11, 12, 13, 14, 15], [1, 2, 4, 8, 9, 10, 11, 12, 1, 2, 4, 6, 7, 8, 9]]);
  var lo = simulate(6, 8, 'reno', { 2: 'to' });
  chk('cwnd = 2 时超时：ssthresh = max(1, 2) = 2，之后 cwnd 1、2、3、4', [lo[2].ss, cw(lo).slice(2)], [2, [1, 2, 3, 4]]);
  var od = simulate(7, 8, 'reno', { 5: 'dup' });
  chk('cwnd = 9 时三个重复 ACK（Reno）：ssthresh = ⌊9/2⌋ = 4，cwnd = 4 + 3 = 7', [od[4].cwnd, od[5].ss, od[5].cwnd], [9, 4, 7]);
  var P2 = PRESETS.timeout, P3 = PRESETS.both;
  chk('预设「第 7 轮末超时」：ssthresh 16', cw(simulate(P2.T, P2.ss, 'reno', P2.ev)),
    [1, 2, 4, 8, 16, 17, 18, 1, 2, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  chk('只有超时时 Reno 和 Tahoe 完全一样', JSON.stringify(simulate(P2.T, P2.ss, 'tahoe', P2.ev)) === JSON.stringify(simulate(P2.T, P2.ss, 'reno', P2.ev)), true);
  chk('预设「先三个重复 ACK，再超时」：Reno / Tahoe', [cw(simulate(P3.T, P3.ss, 'reno', P3.ev)), cw(simulate(P3.T, P3.ss, 'tahoe', P3.ev))],
    [[1, 2, 4, 8, 9, 10, 11, 12, 9, 10, 11, 12, 13, 14, 1, 2, 4, 7, 8, 9], [1, 2, 4, 8, 9, 10, 11, 12, 1, 2, 4, 6, 7, 8, 1, 2, 4, 5, 6, 7]]);
  chk('事件轮次校验（15 轮）：8 合法；0、15、2.5、空都不合法',
    [eventRound(' 8 ', 15).t, !!eventRound('0', 15).err, !!eventRound('15', 15).err, !!eventRound('2.5', 15).err, !!eventRound('', 15).err], [8, true, true, true, true]);
  return { ok: ok, details: details };
}

window.KGDemos = window.KGDemos || {};
window.KGDemos[ID] = { title: 'TCP 拥塞窗口：慢启动、拥塞避免与快速恢复', mount: mount, selfTest: selfTest };
})();
