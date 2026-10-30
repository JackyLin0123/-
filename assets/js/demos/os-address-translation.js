/* 交互演示：地址翻译（虚拟地址 → 物理地址）
 * 单级页表 + TLB（LRU 替换）。纯原生 JS，不依赖任何库。 */
(function () {
'use strict';
var ID = 'os-address-translation', PX = 'dm-' + ID + '-';
var PTE = 4;                                    // 每个页表项 4 字节
var VA_BITS = [12, 13, 14, 15, 16], PAGES = [16, 32, 64, 128, 256];
var MEMS = [1024, 2048, 4096, 8192, 16384, 32768, 65536], TLBS = [2, 4, 8];
var MAX_ACC = 64;

function log2(x) { var k = 0; while ((1 << k) < x) k++; return k; }
function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
function pad(s, w) { s = String(s); while (s.length < w) s = '0' + s; return s; }
function bin(x, w) { return pad(x.toString(2), w); }
function hex(x, bits) { return '0x' + pad(x.toString(16).toUpperCase(), Math.ceil(bits / 4)); }
function size(b) { return b >= 1024 && b % 1024 === 0 ? b / 1024 + ' KB' : b + ' B'; }
function pct(h, n) { return n ? Math.round(h / n * 10000) / 100 + '%' : '—'; }
function perm(w) { return w ? 'RW' : 'R-'; }
function tpl(s) { return s.replace(/@@/g, PX); }

/* ---------- 模型：参数 → 页表内容 ---------- */
// 线性页表要占 ptFrames 个物理页，另外至少留 20 页给数据，才算放得下
function fits(n, P, M) { return M / P >= Math.ceil((1 << n) / P * PTE / P) + 20; }

function makeConfig(n, P, M, T) {
  var off = log2(P), vpnBits = n - off, V = 1 << vpnBits, F = M / P;
  var c = { n: n, P: P, M: M, T: T, off: off, vpnBits: vpnBits, V: V, F: F, pfnBits: log2(F),
    paBits: log2(M), ptBytes: V * PTE, D: n >= 13 ? 0x1200 : 0x400 };
  c.ptFrames = Math.ceil(c.ptBytes / P);
  c.ptbr = (F - c.ptFrames) * P;               // 页表放在物理内存最高处
  c.d0 = Math.floor(c.D / P);                  // 数组所在的第一页
  // 有效的页：代码 2 页（只读）、数组 8 页、栈 2 页；其余无效
  var vpns = [0, 1], i;
  for (i = 0; i < 8; i++) vpns.push(c.d0 + i);
  vpns.push(V - 2, V - 1);
  // 物理页号在 1..A 里按固定步长打散；数组第一页固定放在物理页 5
  var A = F - c.ptFrames - 1;
  var mul = [7, 5, 11, 13, 3, 1].filter(m => gcd(m, A) === 1)[0];
  c.map = {}; c.vpns = vpns;
  vpns.forEach(function (v, j) {
    c.map[v] = { pfn: ((mul * (j - 2) + 4) % A + A) % A + 1, w: j < 2 ? 0 : 1 };
  });
  return c;
}

function split(c, va) { return { vpn: Math.floor(va / c.P), off: va % c.P }; }
function phys(c, pfn, off) { return pfn * c.P + off; }
function pteAddr(c, vpn) { return c.ptbr + vpn * PTE; }
// 输入法全角模式打出的「０ｘ１２３４」先换成半角
function parseAddr(s) {
  s = String(s).replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).trim();
  if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s.slice(2), 16);
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return NaN;
}

function presets(c) {
  var D = c.D, P = c.P, i, arr = [], stride = [];
  for (i = 0; i < 32; i++) arr.push({ va: D + 4 * i, w: 0 });
  for (i = 0; i < 12; i++) stride.push({ va: D + (i % 6) * P, w: 0 });
  return {
    mix: [{ va: D + 0x34, w: 0 }, { va: D + 0x38, w: 0 }, { va: P + 8, w: 0 }, { va: P + 12, w: 1 },
      { va: (c.d0 + 8) * P + 8, w: 0 }, { va: D + 0x34, w: 1 }],
    array: arr, stride: stride };
}

/* 单级页表 + TLB：把一串访问展开成一步一步的快照 */
function simulate(c, accs) {
  var tlb = [], st = { n: 0, hit: 0, miss: 0, fault: 0 }, steps = [], res = [], first = [], i;
  for (i = 0; i < c.T; i++) tlb.push(null);
  accs.forEach(function (acc, k) {
    var s = split(c, acc.va), e = c.map[s.vpn] || null, r = { hit: false, fault: '' };
    var base = { k: k, acc: acc, vpn: s.vpn, off: s.off };
    function step(type, x) {
      var o = Object.assign({ type: type }, base, x || {});
      o.tlb = tlb.map(function (t) { return t && { vpn: t.vpn, pfn: t.pfn, w: t.w, last: t.last }; });
      o.st = Object.assign({}, st);
      steps.push(o);
    }
    res.push(r); first.push(steps.length);
    step('split');
    st.n++;
    var hi = -1;
    tlb.forEach(function (t, j) { if (t && t.vpn === s.vpn) hi = j; });
    if (hi >= 0) {
      var t = tlb[hi], x = { idx: hi, pfn: t.pfn, w: t.w };
      st.hit++; r.hit = true; t.last = k + 1;
      step('tlb', Object.assign({ hit: true }, x));
      if (acc.w && !t.w) { st.fault++; r.fault = 'prot'; step('prot', x); return; }
      r.pa = phys(c, t.pfn, s.off); step('pa', Object.assign({ pa: r.pa }, x));
      return;
    }
    st.miss++;
    step('tlb', { hit: false });
    var y = { pt: true, addr: pteAddr(c, s.vpn), ent: e, pfn: e ? e.pfn : null };
    step('pte', y);
    if (!e) { st.fault++; r.fault = 'page'; step('fault', y); return; }
    if (acc.w && !e.w) { st.fault++; r.fault = 'prot'; step('prot', y); return; }
    var idx = tlb.indexOf(null), victim = null;
    if (idx < 0) {                              // 满了：换掉「上次使用」最早的一项（LRU）
      idx = 0;
      tlb.forEach(function (t, j) { if (t.last < tlb[idx].last) idx = j; });
      victim = { vpn: tlb[idx].vpn, last: tlb[idx].last };
    }
    tlb[idx] = { vpn: s.vpn, pfn: e.pfn, w: e.w, last: k + 1 };
    y.idx = idx;
    step('fill', Object.assign({ victim: victim }, y));
    r.pa = phys(c, e.pfn, s.off); step('pa', Object.assign({ pa: r.pa }, y));
  });
  return { steps: steps, res: res, first: first };
}

/* ---------- 自测：只验证计算，不碰 DOM ---------- */
function selfTest() {
  var details = [], ok = true;
  function chk(name, got, want) {
    var pass = JSON.stringify(got) === JSON.stringify(want);
    if (!pass) ok = false;
    details.push({ name: name, ok: pass, got: got, want: want });
  }
  function hits(r) { return r.filter(x => x.hit).length; }
  var c = makeConfig(14, 64, 4096, 4), s = split(c, 0x1234);
  chk('14 位虚拟地址、64 字节页：offset 6 位', c.off, 6);
  chk('14 位虚拟地址、64 字节页：VPN 8 位', c.vpnBits, 8);
  chk('输入解析：0x1234、4660、全角 ０ｘ１２３４、非法输入', [parseAddr('0x1234'), parseAddr(' 4660 '), parseAddr('０ｘ１２３４'), parseAddr('12a')].map(String),
    ['4660', '4660', '4660', 'NaN']);
  chk('VA 0x1234 → VPN 72 (0x48)', s.vpn, 0x48);
  chk('VA 0x1234 → offset 52 (0x34)', s.off, 0x34);
  chk('默认页表：VPN 72 → PFN 5', c.map[72].pfn, 5);
  chk('物理地址 = 5 × 64 + 52 = 372', phys(c, c.map[72].pfn, s.off), 372);
  chk('PFN 000101 接上 offset 110100 = 000101110100', [bin(5, c.pfnBits), bin(52, c.off), bin(phys(c, 5, 52), c.paBits)],
    ['000101', '110100', '000101110100']);
  chk('页表项地址 = PTBR 0xC00 + 72 × 4 = 3360', pteAddr(c, 72), 3360);
  var p = presets(c), r = simulate(c, p.mix).res;
  chk('综合序列：TLB 命中情况', r.map(x => x.hit), [false, true, false, true, false, true]);
  chk('综合序列：异常类型', r.map(x => x.fault), ['', '', '', 'prot', 'page', '']);
  chk('综合序列：0x1234 → 372，0x0048 → 45 × 64 + 8 = 2888', [r[0].pa, r[2].pa], [372, 2888]);
  chk('顺序读 32 个 int：命中 30 次（93.75%）', hits(simulate(c, p.array).res), 30);
  chk('跨页跳读，TLB 4 项：命中 0 次', hits(simulate(c, p.stride).res), 0);
  chk('跨页跳读，TLB 8 项：命中 6 次', hits(simulate(makeConfig(14, 64, 4096, 8), p.stride).res), 6);
  var lru = simulate(makeConfig(14, 64, 4096, 2), [72, 73, 72, 74, 73].map(function (v) { return { va: v * 64, w: 0 }; }));
  chk('LRU（2 项）：页 A B A C B 只有第 3 次命中', lru.res.map(x => x.hit), [false, false, true, false, false]);
  chk('LRU（2 项）：放入 C 时换出最久没用的 B（VPN 73）',
    lru.steps.filter(x => x.type === 'fill' && x.k === 3)[0].victim.vpn, 73);
  var c3 = makeConfig(16, 256, 65536, 4), s3 = split(c3, 0xABCD);
  chk('16 位地址、256 字节页：0xABCD → VPN 0xAB、offset 0xCD', [c3.off, s3.vpn, s3.off], [8, 171, 205]);
  var bad = 0, combos = 0;                       // 所有参数组合：物理页不重复，也不和页表重叠
  VA_BITS.forEach(function (n) {
    PAGES.forEach(function (P) {
      var any = false;
      MEMS.forEach(function (M) {
        if (!fits(n, P, M)) return;
        any = true; combos++;
        var k = makeConfig(n, P, M, 4), seen = {};
        k.vpns.forEach(function (v) {
          var f = k.map[v].pfn;
          if (seen[f] || f < 1 || f >= k.F - k.ptFrames || v >= k.V) bad++;
          seen[f] = 1;
        });
        if (Object.keys(k.map).length !== 12) bad++;
      });
      if (!any) bad++;
    });
  });
  chk('全部 ' + combos + ' 种参数组合：物理页不重复、不和页表重叠', bad, 0);
  return { ok: ok, details: details };
}

/* ---------- 样式（@@ 会换成类名前缀） ---------- */
var CSS = [
  '.@@root{font-family:var(--font);color:var(--text);font-size:15px;line-height:1.6;display:flex;flex-direction:column;gap:12px;min-width:0;container-type:inline-size}',
  '.@@root *{box-sizing:border-box}',
  '.@@root p{margin:0}.@@how{color:var(--text-2)}',
  '.@@params,.@@row,.@@ctrl{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}',
  '.@@root label{display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px;color:var(--text-2);font-size:14px;max-width:100%}',
  '.@@root select,.@@root input{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:5px 8px;min-height:36px;max-width:100%}',
  '.@@root input{font-family:var(--mono);width:8.5em}',
  '.@@btn{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 12px;min-height:36px;cursor:pointer}',
  '.@@btn:hover:not([aria-disabled=true]){background:var(--surface-2)}',
  '.@@pri{border-color:var(--c-os);background:~--c-os 14~;font-weight:600}',
  // 不能按的按钮只把文字调淡；不用 opacity，免得焦点框也跟着变淡
  '.@@btn[aria-disabled=true]{color:~--text 45~;background:var(--surface);border-color:var(--border);cursor:default}',
  '.@@root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}',
  '.@@derived{font-size:14px;color:var(--text-2);background:var(--surface-2);border-radius:8px;padding:8px 12px}',
  '.@@desc{font-size:14px;color:var(--text-2)}',
  '.@@err:empty{display:none}.@@err{font-size:14px;padding:6px 10px;border-left:3px solid var(--div-pos);background:~--div-pos 10~;border-radius:4px}',
  '.@@pos{font-size:13px;color:var(--text-3)}',
  '.@@ex{background:~--c-os 8~;border:1px solid var(--border);border-left:4px solid var(--c-os);border-radius:var(--radius);padding:10px 14px;line-height:1.75}',
  '.@@ex.@@bad{border-left-color:var(--div-pos);background:~--div-pos 8~}',
  '.@@ex h4{margin:0 0 4px;font-size:15px;font-weight:600}',
  '.@@root code{font-family:var(--mono);font-size:.92em;background:var(--surface-2);padding:0 3px;border-radius:4px;white-space:nowrap}',
  '.@@grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}',
  '.@@col{display:flex;flex-direction:column;gap:12px;min-width:0}',
  '.@@card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px;min-width:0}',
  '.@@card h5{margin:0 0 8px;font-size:14px;font-weight:600}',
  '.@@card>*+h5{margin-top:12px}',
  '.@@note,.@@legend{font-size:13px;color:var(--text-3);margin-top:6px!important}',
  '.@@bits{display:flex;gap:4px;font-family:var(--mono)}',
  '.@@g{border-radius:6px;padding:2px 2px 4px;min-width:0}',
  '.@@cells{display:flex}.@@cells span{flex:1;text-align:center;min-width:0}',
  '.@@cells b{display:block;font-weight:400;font-size:10px;color:var(--text-3);line-height:1.4}',
  '.@@cells i{display:block;font-style:normal;font-size:16px;line-height:1.5}',
  '.@@gl{font-family:var(--font);font-size:12px;text-align:center;color:var(--text-2);line-height:1.35}',
  '.@@gl strong{color:var(--text);font-weight:600}',
  '.@@vpn{background:~--c-os 20~}',
  '.@@off{background:~--warn 26~}',
  '.@@pfn{background:~--div-neg 18~}',
  '.@@flow{font-size:14px;color:var(--text-2);margin:10px 0 0}',
  '.@@ph{border:1px dashed var(--border);border-radius:8px;padding:10px;color:var(--text-3);font-size:14px;text-align:center}',
  '.@@tw{overflow-x:auto}',
  '.@@root table{border-collapse:collapse;width:100%;font-size:13px}',
  '.@@root th,.@@root td{border-bottom:1px solid var(--border);padding:4px 6px;text-align:center;white-space:nowrap}',
  '.@@root th{background:var(--surface-2);font-weight:600;color:var(--text-2)}',
  '.@@root td{font-family:var(--mono)}.@@f{font-family:var(--font)}',
  '.@@dim td{color:var(--text-3)}',
  '.@@gap td{font-family:var(--font);color:var(--text-3);font-size:12px;padding:2px}',
  '.@@hl td{background:~--c-os 20~;color:var(--text)}',
  '.@@hit td{background:~--good 20~;color:var(--text)}',
  '.@@new td{background:~--div-neg 18~;color:var(--text)}',
  '.@@badrow td{background:~--div-pos 18~;color:var(--text)}',
  '.@@stats{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:14px;color:var(--text-2)}',
  '.@@stats strong{font-family:var(--mono);font-size:16px;color:var(--text)}',
  '.@@log{display:flex;flex-wrap:wrap;gap:4px;margin-top:10px}',
  '.@@chip{font-family:var(--mono);font-size:11px;line-height:1.3;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);padding:2px 4px;min-width:46px;cursor:pointer}',
  '.@@chip.@@H{background:~--good 18~}',
  '.@@chip.@@M{background:~--warn 28~}',
  '.@@chip.@@X{background:~--div-pos 22~}',
  '.@@chip.@@todo{color:var(--text-3)}',
  '.@@chip.@@cur{border-color:var(--text);box-shadow:inset 0 0 0 1px var(--text)}',
  '.@@sum{margin-top:10px!important;padding:8px 12px;background:var(--surface-2);border-radius:8px;line-height:1.75}',
  // 根元素自己是查询容器，下面两条只能作用在它的子孙上
  '@container (max-width:699px){.@@grid{grid-template-columns:minmax(0,1fr)}.@@col{display:contents}.@@o2{order:2}.@@o3{order:3}.@@o4{order:4}}',
  '@container (max-width:480px){.@@cells i{font-size:14px}.@@btn{padding:6px 10px}.@@ex{padding:8px 10px}}'
].join('\n');

function injectStyle() {
  if (document.getElementById('dm-style-' + ID)) return;
  var st = document.createElement('style');
  st.id = 'dm-style-' + ID;
  st.textContent = tpl(CSS).replace(/~(--[\w-]+) (\d+)~/g, 'color-mix(in srgb,var($1) $2%,var(--surface))');
  document.head.appendChild(st);
}

/* ---------- 小零件：二进制位、表格 ---------- */
// groups 从高位到低位：{ len, cls, name, val }
function bitsHTML(value, width, groups) {
  var s = bin(value, width), pos = 0, label = [];
  var h = '';
  groups.forEach(function (g) {
    h += '<div class="@@g @@' + g.cls + '" style="flex:' + g.len + ' 1 0"><div class="@@cells">';
    label.push(g.name + ' ' + s.substr(pos, g.len) + ' = ' + g.val);
    for (var i = 0; i < g.len; i++, pos++) h += '<span><b>' + (width - 1 - pos) + '</b><i>' + s.charAt(pos) + '</i></span>';
    h += '</div><div class="@@gl">' + g.name + '<br><strong>' + g.len + ' 位 = ' + g.val + '</strong></div></div>';
  });
  return '<div class="@@bits" role="img" aria-label="二进制 ' + s + '：' + label.join('，') + '">' + h + '</div>';
}

function tableHTML(head, rows, label) {
  var h = '<div class="@@tw"><table aria-label="' + label + '"><thead><tr>';
  head.forEach(function (x) { h += '<th scope="col">' + x + '</th>'; });
  h += '</tr></thead><tbody>';
  rows.forEach(function (r) {
    if (r.gap) { h += '<tr class="@@gap"><td colspan="' + head.length + '">' + r.gap + '</td></tr>'; return; }
    h += '<tr' + (r.cls ? ' class="@@' + r.cls + '"' : '') + '>';
    r.cells.forEach(function (x) { h += '<td>' + x + '</td>'; });
    h += '</tr>';
  });
  return h + '</tbody></table></div>';
}

// 长表只显示 focus 附近 size 行
function win(total, focus, size) {
  var s = Math.max(0, Math.min(focus - (size >> 1), total - size));
  return [s, Math.min(total, s + size) - 1];
}
function gapRow(a, b) { return { gap: '第 ' + a + '–' + b + ' 项省略' }; }

// 物理地址：算出来了就画 PFN + offset 的位，否则显示占位文字
function paBlock(c, s, msg) {
  if (!s) return '<div class="@@ph">' + msg + '</div>';
  return bitsHTML(s.pa, c.paBits, [{ len: c.pfnBits, cls: 'pfn', name: 'PFN', val: s.pfn }, { len: c.off, cls: 'off', name: 'offset', val: s.off }]) +
    '<p class="@@note">' + hex(s.pa, c.paBits) + ' = ' + s.pfn + ' × ' + c.P + ' + ' + s.off + ' = ' + s.pa + '</p>';
}

function C(x) { return '<code>' + x + '</code>'; }

/* ---------- 「现在发生了什么」 ---------- */
function ex1(c, s) {
  var va = s.acc.va, V = hex(va, c.n), o = s.off, vp = s.vpn, t, h, bad = false;
  switch (s.type) {
    case 'split':
      t = '第 ' + (s.k + 1) + ' 次访问：' + (s.acc.w ? '写' : '读') + ' ' + V + '，先拆分虚拟地址';
      h = V + ' = ' + va + '，写成 ' + c.n + ' 位二进制是 ' + C(bin(va, c.n)) + '。页大小 ' + c.P + ' = 2<sup>' + c.off + '</sup> 字节，所以低 ' +
        c.off + ' 位是页内偏移 offset = ' + C(bin(o, c.off)) + ' = ' + o + '，高 ' + c.vpnBits + ' 位是虚拟页号 VPN = ' + C(bin(vp, c.vpnBits)) +
        ' = ' + vp + '。用除法验算：' + va + ' ÷ ' + c.P + ' = ' + vp + ' 余 ' + o + '。';
      break;
    case 'tlb':
      if (s.hit) {
        t = '查 TLB：命中';
        h = 'TLB 拿 VPN ' + vp + ' 和全部 ' + c.T + ' 项同时比较，第 ' + (s.idx + 1) + ' 项的 VPN 正是 ' + vp + '，直接得到 PFN ' + s.pfn +
          '，不用再去内存读页表。' + (!s.acc.w ? '这次是读，权限 ' + perm(s.w) + ' 允许读。' : s.w ? '这次是写，权限 RW 允许写。'
          : '可这次是写，这一项的权限是 R-（只读），过不了权限检查。') + '这一项的「上次使用」改成第 ' + (s.k + 1) + ' 次。';
      } else {
        var vs = s.tlb.filter(Boolean).map(e => e.vpn);
        t = '查 TLB：未命中';
        h = (vs.length ? 'TLB 里有效的 ' + vs.length + ' 项，VPN ' + (vs.length > 1 ? '分别' : '') + '是 ' + vs.join('、') + '，没有 ' + vp + '，未命中。'
          : 'TLB 现在一项都没有（程序刚开始运行，还没缓存过任何翻译），一定未命中。') + '只好去内存里查页表。';
      }
      break;
    case 'pte':
      t = '查页表：读第 ' + vp + ' 项';
      h = '页表是放在物理内存里的一个数组，从 PTBR = ' + hex(c.ptbr, c.paBits) + '（' + c.ptbr + '）开始，每项 4 字节。第 ' + vp +
        ' 项的地址 = PTBR + VPN × 4 = ' + c.ptbr + ' + ' + vp + ' × 4 = ' + s.addr + '（' + hex(s.addr, c.paBits) + '）。' +
        (s.ent ? '从这里读出：有效位 1，PFN = ' + s.ent.pfn + '，权限 ' + perm(s.ent.w) + '。读页表本身要多访问一次内存，TLB 命中时就省掉了这一次。'
          : '从这里读出：有效位 0，虚拟页 ' + vp + ' 现在没有对应的物理页。');
      break;
    case 'fault':
      bad = true; t = '有效位是 0：触发缺页异常';
      h = '硬件算不出物理地址，就停下这条指令，触发缺页异常（page fault），转去执行操作系统的异常处理程序。操作系统先查这个地址属不属于这个进程：' +
        '属于的话，说明这一页还没调进内存（比如被换出到了磁盘上），操作系统找一个空闲物理页把它调进来，填好 PFN、把有效位改成 1，再让这条指令重新执行；' +
        '不属于的话，就终止进程，也就是常说的段错误（segmentation fault）。这个演示里 VPN ' + vp + ' 不属于代码、数组、栈中的任何一段，是后一种情况。这次访问不会放进 TLB。';
      break;
    case 'prot':
      bad = true; t = '权限不够：触发保护异常';
      h = '这次要写 ' + V + '，可 VPN ' + vp + ' 是代码页，权限 R-：只能读，不能写。硬件触发保护异常（protection fault），交给操作系统处理，' +
        '操作系统一般会终止这个进程。物理内存不会被写入。';
      break;
    case 'fill':
      t = '把这次的翻译放进 TLB';
      h = (s.victim ? 'TLB 的 ' + c.T + ' 项都满了。按 LRU（least recently used，最近最少使用）规则，换掉「上次使用」最早的第 ' + (s.idx + 1) +
        ' 项：VPN ' + s.victim.vpn + '，上次在第 ' + s.victim.last + ' 次访问时用过。' : 'TLB 第 ' + (s.idx + 1) + ' 项还空着。') +
        '把「VPN ' + vp + ' → PFN ' + s.pfn + '」放进第 ' + (s.idx + 1) + ' 项。只要这一项还没被换出，之后再访问 ' + hex(vp * c.P, c.n) + '–' +
        hex(vp * c.P + c.P - 1, c.n) + ' 这一页里的地址都能直接命中。';
      break;
    default:
      t = '拼出物理地址';
      h = 'PFN = ' + s.pfn + '，offset = ' + o + ' 原样保留。物理地址 = PFN × ' + c.P + ' + offset = ' + s.pfn + ' × ' + c.P + ' + ' + o + ' = ' +
        s.pa + '（' + hex(s.pa, c.paBits) + '）。二进制上就是把 ' + c.pfnBits + ' 位的 PFN ' + C(bin(s.pfn, c.pfnBits)) + ' 接在 ' + c.off +
        ' 位的 offset ' + C(bin(o, c.off)) + ' 前面：' + C(bin(s.pa, c.paBits)) + '。';
  }
  return { t: t, h: h, bad: bad };
}

function endNote(c, preset, accs, res) {
  var n = res.length, h = res.filter(r => r.hit).length, m = n - h;
  if (preset === 'array') {
    var pages = {}, alt = c.P <= 32 ? 256 : 16;
    accs.forEach(function (a) { pages[Math.floor(a.va / c.P)] = 1; });
    return '数组元素在内存里挨着放，读完 a[0] 接着读 a[1]，地址只差 4 字节，这叫空间局部性（spatial locality）。一页 ' + c.P + ' 字节放得下 ' +
      c.P / 4 + ' 个 int，32 次访问只用到 ' + Object.keys(pages).length + ' 个页，只有每进入一个新页的第一次访问未命中：未命中 ' + m +
      ' 次，命中率 ' + h + '/' + n + ' = ' + pct(h, n) + '。把页大小改成 ' + alt + ' 字节再跑一遍，未命中会变成 ' + Math.ceil(128 / alt) + ' 次。';
  }
  if (preset === 'stride') {
    return c.T < 6 ? '每次访问都跳到一个新页，6 个页轮流用，TLB 却只有 ' + c.T + ' 项。按 LRU，下一次要用的页恰好是最早被换出去的那一个，所以 ' +
      n + ' 次访问一次都没命中。把 TLB 项数改成 8 再跑一遍，第二轮的 6 次会全部命中。'
      : 'TLB 有 ' + c.T + ' 项，6 个页都装得下：第一轮 6 次都是第一次进入新页，全部未命中；第二轮 6 次全部命中，命中率 ' + pct(h, n) +
      '。把 TLB 项数改成 4 再跑一遍，就一次也不会命中。';
  }
  var f = [];
  res.forEach(function (r, k) {
    if (r.fault) f.push('第 ' + (k + 1) + ' 次' + (r.fault === 'prot' ? '写只读的代码页，触发保护异常' : '访问没分配的页，触发缺页异常'));
  });
  return n + ' 次访问里，TLB 命中 ' + h + ' 次、未命中 ' + m + ' 次，命中率 ' + pct(h, n) + '。' + (f.length ? f.join('；') + '。' : '');
}

/* ---------- 各个卡片 ---------- */
function derivedHTML(c, note) {
  return (note ? note + '<br>' : '') + '页大小 ' + c.P + ' B = 2<sup>' + c.off + '</sup> B，所以页内偏移 offset 占 ' + c.off +
    ' 位；虚拟页号 VPN（virtual page number）占 ' + c.n + ' − ' + c.off + ' = ' + c.vpnBits + ' 位，共 ' + c.V + ' 个虚拟页。物理内存 ' +
    size(c.M) + ' ÷ ' + c.P + ' B = ' + c.F + ' 个物理页，物理页号 PFN（physical frame number）占 ' + c.pfnBits + ' 位，物理地址 ' + c.paBits +
    ' 位。页表 ' + c.V + ' 项 × 4 B = ' + size(c.ptBytes) + '，放在物理内存最高处，起始地址记在页表基址寄存器 PTBR（page-table base register）里：' +
    hex(c.ptbr, c.paBits) + '。';
}

function addrCard(c, s) {
  if (!s) return '<h5>虚拟地址</h5><div class="@@ph">还没有要翻译的地址</div>';
  var va = s.acc.va, bad = s.type === 'fault' || s.type === 'prot', pw = s.ent ? s.ent.w : s.w;
  var msg = bad ? '这次访问触发了异常，没有物理地址' : s.pt && !s.ent ? '页表项无效，算不出物理地址' : s.pfn == null ? '还没算出来：先要拿到 PFN'
    : s.acc.w && !pw ? '要写只读页，过不了权限检查' : '已经拿到 PFN，下一步拼出物理地址';
  var h = '<h5>虚拟地址 ' + hex(va, c.n) + ' = ' + va + '（' + (s.acc.w ? '写' : '读') + '）</h5>' +
    bitsHTML(va, c.n, [{ len: c.vpnBits, cls: 'vpn', name: 'VPN', val: s.vpn }, { len: c.off, cls: 'off', name: 'offset', val: s.off }]) +
    '<p class="@@flow">VPN ' + s.vpn + ' → ' + (s.pfn != null ? 'PFN ' + s.pfn : s.pt && !s.ent ? '没有对应的物理页（页表项无效）'
      : s.type === 'tlb' ? 'PFN 待查：TLB 未命中，去查页表' : 'PFN 待查（先查 TLB，再查页表）') +
    '<br>offset ' + s.off + ' → 原样搬到物理地址的低 ' + c.off + ' 位</p><h5>物理地址</h5>';
  return h + paBlock(c, s.type === 'pa' && s, msg);
}

function tlbCard(c, s) {
  var t = s ? s.tlb : [], rows = [], j, e, cls;
  for (j = 0; j < c.T; j++) {
    e = t[j] || null; cls = e ? '' : 'dim';
    if (s && s.idx === j) cls = s.type === 'prot' ? 'badrow' : s.pt ? 'new' : 'hit';
    rows.push({ cls: cls, cells: [j + 1, e ? 1 : 0, e ? e.vpn : '—', e ? e.pfn : '—', e ? perm(e.w) : '—', e ? '<span class="@@f">第 ' + e.last + ' 次</span>' : '—'] });
  }
  return '<h5>TLB（translation lookaside buffer）：' + c.T + ' 项，满了按 LRU 替换</h5>' +
    tableHTML(['#', '有效', 'VPN', 'PFN', '权限', '上次使用'], rows, 'TLB') +
    '<p class="@@note">TLB 是 CPU 里缓存「VPN → PFN」的一张小表，查它不用访问内存。「上次使用」记的是第几次访问用到这一项，要替换时换掉数字最小的那项。</p>';
}

function ptCard(c, s) {
  var w = win(c.V, s ? s.vpn : c.d0, 7), rows = [], v, e, cls;
  if (w[0] > 0) rows.push(gapRow(0, w[0] - 1));
  for (v = w[0]; v <= w[1]; v++) {
    e = c.map[v]; cls = e ? '' : 'dim';
    if (s && s.pt && v === s.vpn) cls = s.type === 'fault' || s.type === 'prot' ? 'badrow' : 'hl';
    rows.push({ cls: cls, cells: [v, hex(pteAddr(c, v), c.paBits), e ? 1 : 0, e ? e.pfn : '—', e ? perm(e.w) : '—'] });
  }
  if (w[1] < c.V - 1) rows.push(gapRow(w[1] + 1, c.V - 1));
  return '<h5>页表（page table）：' + c.V + ' 项，从 PTBR = ' + hex(c.ptbr, c.paBits) + ' 开始</h5>' +
    tableHTML(['VPN', '项地址', '有效', 'PFN', '权限'], rows, '页表') +
    '<p class="@@note">有效位（valid bit）为 1 的只有：代码 VPN 0–1（只读）、数组 VPN ' + c.d0 + '–' + (c.d0 + 7) + '、栈 VPN ' + (c.V - 2) + '–' + (c.V - 1) +
    '，其余 ' + (c.V - 12) + ' 项都无效。权限 R = 可读，W = 可写，- = 不允许。只有 12 项有用，整张表也得按 ' + c.V +
    ' 项分配；虚拟地址到了 32 位、64 位，这张表就太大了，所以真实系统用多级页表（multi-level page table），只给用到的部分建表。</p>';
}

function statsCard(c, accs, sim, s, last, preset) {
  var st = s ? s.st : { n: 0, hit: 0, miss: 0, fault: 0 };
  var h = '<h5>统计（截至当前这一步）</h5><div class="@@stats"><span>访问 <strong>' + st.n + '</strong> 次</span><span>TLB 命中 <strong>' +
    st.hit + '</strong></span><span>未命中 <strong>' + st.miss + '</strong></span><span>命中率 <strong>' +
    (st.n ? st.hit + '/' + st.n + ' = ' + pct(st.hit, st.n) : '—') + '</strong></span><span>异常 <strong>' + st.fault +
    '</strong></span></div><div class="@@log" role="group" aria-label="访问记录">';
  accs.forEach(function (a, j) {
    var r = sim.res[j], cls = 'todo', mark = '·', txt = '还没执行', cur = s && j === s.k;
    if (s && (j < s.k || cur && s.type !== 'split')) {
      var f = r.fault && (j < s.k || s.type === 'fault' || s.type === 'prot');
      cls = f ? 'X' : r.hit ? 'H' : 'M'; mark = f ? '!' : cls;
      txt = f ? '触发异常' : r.hit ? 'TLB 命中' : 'TLB 未命中';
    }
    h += '<button type="button" class="@@chip @@' + cls + (cur ? ' @@cur" aria-current="step' : '') + '" data-k="' + j + '" aria-label="第 ' +
      (j + 1) + ' 次访问 ' + hex(a.va, c.n) + '：' + txt + '。点击跳到这次访问">' + hex(a.va, c.n).slice(2) + '<br>' + mark + '</button>';
  });
  h += '</div><p class="@@legend">格子里是每次访问的虚拟地址（十六进制）。H = TLB 命中，M = 未命中，! = 触发异常，· = 还没执行。点一个格子可以跳到那次访问。</p>';
  if (s && last) h += '<p class="@@sum">' + endNote(c, preset, accs, sim.res) + '</p>';
  return h;
}

/* ---------- 界面骨架 ---------- */
var HTML = '<p class="@@how">怎么玩：在「虚拟地址」框里输入一个地址（十进制，或 0x 开头的十六进制），点「翻译这个地址」把它加到访问序列末尾；也可以直接选一个预设序列。' +
  '然后点「下一步」，一步步看 CPU 怎么把它变成物理地址。改动下面四个参数，所有数字都会重新计算。</p>' +
  '<div class="@@params"><label>虚拟地址位数 <select data-r="n" aria-label="虚拟地址位数"></select></label>' +
  '<label>页大小 <select data-r="P" aria-label="页大小"></select></label>' +
  '<label>物理内存 <select data-r="M" aria-label="物理内存大小"></select></label>' +
  '<label>TLB 项数 <select data-r="T" aria-label="TLB 项数"></select></label></div>' +
  '<p class="@@derived" data-r="derived"></p>' +
  '<div class="@@row"><label>虚拟地址 <input data-r="va" spellcheck="false" autocomplete="off" aria-label="虚拟地址，十进制或 0x 开头的十六进制"></label>' +
  '<select data-r="rw" aria-label="读还是写"><option value="0">读</option><option value="1">写</option></select>' +
  '<button type="button" class="@@btn" data-r="go">翻译这个地址</button><button type="button" class="@@btn" data-r="clear">清空序列</button>' +
  '<label>预设序列 <select data-r="preset" aria-label="预设访问序列"></select></label></div>' +
  '<p class="@@desc" data-r="pdesc"></p><p class="@@err" data-r="err" role="alert"></p>' +
  '<div class="@@ctrl"><button type="button" class="@@btn" data-r="prev">上一步</button>' +
  '<button type="button" class="@@btn @@pri" data-r="next">下一步</button>' +
  '<button type="button" class="@@btn" data-r="play">自动播放</button>' +
  '<button type="button" class="@@btn" data-r="end">跑完全部</button>' +
  '<button type="button" class="@@btn" data-r="reset">重置</button><span class="@@pos" data-r="pos"></span></div>' +
  '<div class="@@ex" data-r="ex" aria-live="polite"></div>' +
  '<div class="@@grid"><div class="@@col"><div class="@@card" data-r="addr"></div><div class="@@card @@o4" data-r="stats"></div></div>' +
  '<div class="@@col"><div class="@@card @@o2" data-r="tlb"></div><div class="@@card @@o3" data-r="pt"></div></div></div>';

function opts(list, cur, fmt, dis) {
  return list.map(function (v) {
    var d = dis && dis(v);
    return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + (d ? ' disabled' : '') + '>' + fmt(v) + (d ? '（放不下页表）' : '') + '</option>';
  }).join('');
}

/* ---------- 挂载 ---------- */
function mount(container) {
  injectStyle();
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
  var S = { n: 14, P: 64, M: 4096, T: 4 }, c, note = '';
  var L = { accs: [], preset: 'mix', sim: null, cur: 0, timer: null };
  var ls = [];
  var root = document.createElement('div');
  root.className = PX + 'root';
  root.innerHTML = tpl(HTML);
  container.appendChild(root);
  function q(r) { return root.querySelector('[data-r="' + r + '"]'); }
  function on(el, ev, fn) { el.addEventListener(ev, fn); ls.push([el, ev, fn]); }
  function setEx(el, e) {
    el.className = PX + 'ex' + (e.bad ? ' ' + PX + 'bad' : '');
    el.innerHTML = '<h4>' + e.t + '</h4><p>' + e.h + '</p>';
  }
  function addrErr(s) {
    var va = parseAddr(s), max = (1 << c.n) - 1;
    if (isNaN(va)) return { err: '格式不对：请输入十进制（如 4660）或 0x 开头的十六进制（如 0x1234）。' };
    if (va > max) return { err: '超出范围：' + c.n + ' 位虚拟地址只能是 0 到 ' + max + '（' + hex(max, c.n) + '）。' };
    return { va: va };
  }

  // 上一步 / 下一步 / 自动播放 / 跑完全部 / 重置。
  // 用 aria-disabled 而不用 disabled：按钮不能按时焦点仍留在原地，键盘用户不会被甩回页面开头
  function dis(r, v) { q(r).setAttribute('aria-disabled', String(!!v)); }
  function off(r) { return q(r).getAttribute('aria-disabled') === 'true'; }
  function stop() {
    if (L.timer) { clearInterval(L.timer); L.timer = null; }
    q('play').textContent = '自动播放';
  }
  function go(i) { L.cur = Math.max(0, Math.min(L.sim.steps.length - 1, i)); render1(); }
  on(q('prev'), 'click', function () { if (!off('prev')) { stop(); go(L.cur - 1); } });
  on(q('next'), 'click', function () { if (!off('next')) { stop(); go(L.cur + 1); } });
  on(q('reset'), 'click', function () { if (!off('reset')) { stop(); go(0); } });
  on(q('end'), 'click', function () { if (!off('end')) { stop(); go(L.sim.steps.length - 1); } });
  on(q('play'), 'click', function () {
    if (off('play')) return;
    if (L.timer) { stop(); render1(); return; }
    q('play').textContent = '暂停';
    L.timer = setInterval(function () {
      if (L.cur >= L.sim.steps.length - 1) { stop(); render1(); } else go(L.cur + 1);
    }, 1200);
    go(L.cur + 1);
  });
  if (reduce) q('play').title = '系统开启了「减少动态效果」，自动播放已关闭';

  function presetDesc() {
    var D = c.D, h = x => hex(x, c.n);
    if (L.preset === 'array') return '顺序读 int 数组 a[0] 到 a[31]：a[i] 的地址是 ' + h(D) + ' + 4 × i，共 32 次访问。TLB 从空开始。';
    if (L.preset === 'stride') return '每次跳一整页（+' + c.P + ' 字节）：从 ' + h(D) + ' 开始依次访问 6 个页，再按同样顺序访问一遍，共 12 次。TLB 从空开始。';
    if (L.preset === 'mix') return '读 ' + h(D + 0x34) + ' → 读同一页的 ' + h(D + 0x38) + ' → 读代码页 ' + h(c.P + 8) + ' → 写同一个代码页 ' +
      h(c.P + 12) + ' → 读没分配的 ' + h((c.d0 + 8) * c.P + 8) + ' → 写 ' + h(D + 0x34) + '。TLB 从空开始。';
    return L.accs.length ? '当前序列共 ' + L.accs.length + ' 次访问（包括你输入的地址），TLB 从空开始。' : '当前序列是空的。';
  }
  function render1() {
    var st = L.sim.steps, s = st[L.cur] || null, last = !!s && L.cur === st.length - 1;
    dis('prev', !s || L.cur === 0); dis('reset', !s || L.cur === 0);
    dis('next', !s || last); dis('end', !s || last);
    dis('play', reduce || !s || (last && !L.timer));
    q('pos').textContent = s ? '第 ' + (L.cur + 1) + ' / ' + st.length + ' 步 · 第 ' + (s.k + 1) + ' / ' + L.accs.length + ' 次访问' : '';
    q('pdesc').textContent = presetDesc();
    var e = s ? ex1(c, s) : { t: '序列是空的', h: '在上面输入一个虚拟地址，点「翻译这个地址」；或者从「预设序列」里选一个。' };
    if (last) e.h += '序列到此结束，命中率见下面的统计。';
    setEx(q('ex'), e);
    q('addr').innerHTML = tpl(addrCard(c, s));
    q('tlb').innerHTML = tpl(tlbCard(c, s));
    q('pt').innerHTML = tpl(ptCard(c, s));
    q('stats').innerHTML = tpl(statsCard(c, L.accs, L.sim, s, last, L.preset));
  }
  function load(accs, cur) { stop(); L.accs = accs; L.sim = simulate(c, accs); L.cur = cur; render1(); }
  function fillPreset() {
    q('preset').innerHTML = '<option value="mix">综合：命中、缺页、写只读页</option><option value="array">顺序读数组 a[0..31]</option>' +
      '<option value="stride">跨页跳读：6 页轮 2 遍</option>' + (L.preset === 'custom' ? '<option value="custom">自己输入的序列</option>' : '');
    q('preset').value = L.preset;
  }
  function addAccess() {
    var r = addrErr(q('va').value);
    if (r.err) { q('err').textContent = r.err; return; }
    if (L.accs.length >= MAX_ACC) { q('err').textContent = '序列最多 ' + MAX_ACC + ' 次访问，先点「清空序列」或换一个预设。'; return; }
    q('err').textContent = '';
    if (L.preset !== 'custom') { L.preset = 'custom'; fillPreset(); }
    var accs = L.accs.concat([{ va: r.va, w: Number(q('rw').value) }]);
    load(accs, 0);
    L.cur = L.sim.first[accs.length - 1]; render1();
  }
  on(q('go'), 'click', addAccess);
  on(q('va'), 'keydown', function (ev) { if (ev.key === 'Enter') addAccess(); });
  on(q('clear'), 'click', function () { L.preset = 'custom'; fillPreset(); q('err').textContent = ''; load([], 0); });
  on(q('preset'), 'change', function () {
    var v = q('preset').value;
    if (v === 'custom') return;
    L.preset = v; fillPreset(); q('err').textContent = ''; load(presets(c)[v], 0);
  });
  on(q('stats'), 'click', function (ev) {
    var b = ev.target.closest('[data-k]');
    if (!b) return;
    var k = b.getAttribute('data-k');
    stop(); go(L.sim.first[Number(k)]);
    var nb = q('stats').querySelector('[data-k="' + k + '"]');
    if (nb) nb.focus();
  });

  /* 参数 */
  function rebuild() {
    c = makeConfig(S.n, S.P, S.M, S.T);
    q('n').innerHTML = opts(VA_BITS, S.n, v => v + ' 位');
    q('P').innerHTML = opts(PAGES, S.P, v => v + ' 字节');
    q('M').innerHTML = opts(MEMS, S.M, size, m => !fits(S.n, S.P, m));
    q('T').innerHTML = opts(TLBS, S.T, v => v + ' 项');
    q('derived').innerHTML = derivedHTML(c, note);
    var accs = L.preset === 'custom' ? L.accs.filter(a => a.va < (1 << c.n)) : presets(c)[L.preset];
    if (L.preset === 'custom' && !accs.length) { L.preset = 'mix'; accs = presets(c).mix; }
    fillPreset(); q('va').value = hex(c.D + 0x34, c.n); q('err').textContent = '';
    load(accs, 0);
  }
  ['n', 'P', 'M', 'T'].forEach(function (k) {
    on(q(k), 'change', function () {
      S[k] = Number(q(k).value); note = '';
      if (!fits(S.n, S.P, S.M)) {
        var m = MEMS.filter(x => fits(S.n, S.P, x))[0];
        note = '页表要占 ' + size((1 << S.n) / S.P * PTE) + '，' + size(S.M) + ' 的物理内存放不下（还得留地方给数据），已自动改成 ' + size(m) + '。';
        S.M = m;
      }
      rebuild();
    });
  });

  rebuild();
  return {
    destroy: function () {
      stop();
      ls.forEach(function (x) { x[0].removeEventListener(x[1], x[2]); });
      ls = [];
      if (root.parentNode) root.parentNode.removeChild(root);
    }
  };
}

window.KGDemos = window.KGDemos || {};
window.KGDemos[ID] = { title: '地址翻译：从虚拟地址到物理地址', mount: mount, selfTest: selfTest };
})();
