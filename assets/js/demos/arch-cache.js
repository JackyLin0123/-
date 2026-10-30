/* 交互演示：Cache 的命中、缺失与映射方式。直接映射 / 组相联 / 全相联，LRU 替换，
 * 缺失按 3C 分成强制、容量、冲突三类。纯原生 JS，挂到 window.KGDemos['arch-cache']。 */
(function () {
'use strict';
var ID = 'arch-cache', PX = 'dm-' + ID + '-';
var BITS = [8, 10, 12], CAPS = [16, 32, 64, 128], BLKS = [4, 8, 16], ASSOC = [1, 2, 4, 0];   // 相联度 0 表示全相联
var MAX_N = 64;
var KIND = { comp: '强制缺失', cap: '容量缺失', conf: '冲突缺失' };
var FB = { '--text': '#1b1b19', '--text-2': '#52514e', '--text-3': '#6b6a66', '--surface': '#fff', '--surface-2': '#f0efec',
  '--border': '#e2e1dc', '--c-arch': '#c08a00', '--good': '#0ca30c', '--div-neg': '#2a78d6', '--div-pos': '#e34948', '--focus': '#2457b3' };

function tpl(s) { return s.replace(/@@/g, PX); }
function log2(x) { var k = 0; while ((1 << k) < x) k++; return k; }
function pad(s, w) { s = String(s); while (s.length < w) s = '0' + s; return s; }
function bin(x, w) { return w ? pad(x.toString(2), w) : ''; }
function hex(x, n) { return '0x' + pad(x.toString(16).toUpperCase(), Math.ceil(n / 4)); }
function pct(h, n) { return n ? Math.round(h / n * 1000) / 10 + '%' : '—'; }
function seq(a, b, d) { var r = []; for (var i = a; i <= b; i += d) r.push(i); return r; }
function assocName(a) { return a === 0 ? '全相联' : a === 1 ? '直接映射' : a + ' 路组相联'; }

/* ---------- 核心计算（不碰 DOM） ---------- */
function makeConfig(n, C, B, A) {
  var L = C / B, W = A === 0 ? L : A;
  if (C > (1 << n)) return { err: '地址只有 ' + n + ' 位，总共只能访问 ' + (1 << n) + ' 字节，比 ' + C + ' 字节的 Cache 还小。' };
  if (W > L) return { err: '容量 ' + C + ' 字节、块 ' + B + ' 字节的 Cache 只有 ' + L + ' 行，做不成' + assocName(A) + '（每组要 ' + W + ' 行）。换大一点的容量、小一点的块，或者少几路。' };
  var S = L / W, off = log2(B), idx = log2(S);
  return { n: n, C: C, B: B, A: A, L: L, W: W, S: S, off: off, idx: idx, tag: n - off - idx };
}

function split(c, a) {
  var b = Math.floor(a / c.B);
  return { a: a, blk: b, set: b % c.S, tag: Math.floor(b / c.S), off: a % c.B };
}

function emptySets(c) {
  var s = [], i, j;
  for (i = 0; i < c.S; i++) { s.push([]); for (j = 0; j < c.W; j++) s[i].push(null); }
  return s;
}

// 逐次访问，每步记下这一步之后的完整状态。影子 Cache 是同样行数的全相联 LRU，只用来区分容量缺失和冲突缺失。
function simulate(c, addrs) {
  var sets = emptySets(c), seen = {}, sh = [], out = [], tot = { hit: 0, comp: 0, cap: 0, conf: 0 };
  addrs.forEach(function (a, k) {
    var st = split(c, a), lines = sets[st.set], w = -1, j, p = sh.indexOf(st.blk);
    st.k = k; st.shHit = p >= 0; st.shOut = null; st.victim = null;
    if (st.shHit) sh.splice(p, 1); else if (sh.length === c.L) st.shOut = sh.pop();
    sh.unshift(st.blk);
    for (j = 0; j < c.W; j++) if (lines[j] && lines[j].tag === st.tag) w = j;
    st.hit = w >= 0;
    if (st.hit) tot.hit++;
    else {
      st.kind = !seen[st.blk] ? 'comp' : st.shHit ? 'conf' : 'cap';
      tot[st.kind]++;
      for (w = 0; w < c.W && lines[w]; w++);
      if (w === c.W) {                          // 组满了：换出「上次使用」最早的一行
        w = 0;
        for (j = 1; j < c.W; j++) if (lines[j].last < lines[w].last) w = j;
        st.victim = { way: w, blk: lines[w].blk, last: lines[w].last };
      }
      lines[w] = { tag: st.tag, blk: st.blk };
    }
    lines[w].last = k + 1;
    seen[st.blk] = 1;
    st.way = w;
    st.sh = sh.slice();
    st.sets = sets.map(function (r) { return r.map(function (l) { return l && { tag: l.tag, blk: l.blk, last: l.last }; }); });
    st.tot = { hit: tot.hit, comp: tot.comp, cap: tot.cap, conf: tot.conf };
    out.push(st);
  });
  return out;
}

// 组内各行的 LRU 次序：1 = 最近用过
function ranks(lines) {
  var v = [], r = {};
  lines.forEach(function (l, w) { if (l) v.push(w); });
  v.sort(function (a, b) { return lines[b].last - lines[a].last; });
  v.forEach(function (w, i) { r[w] = i + 1; });
  return r;
}

/* Read/write extension. Counts lower writes as transactions, not bytes; no final flush. */
function simulateRW(c, accesses, policy) {
  policy = policy || {};
  var back = policy.writeBack !== false, allocate = policy.writeAllocate !== false;
  var sets = emptySets(c), result = [], totals = {hit:0,miss:0,lowerWrites:0,lowerWriteBytes:0}, clock=0;
  accesses.forEach(function(access) {
    var a=typeof access==='number'?access:access.address,write=typeof access==='object'&&access.op==='W';
    if(!Number.isInteger(a)||a<0||a>=(1<<c.n))throw Error('地址越界或非法');
    if(typeof access==='object'&&!['R','W'].includes(access.op))throw Error('访问类型必须为R或W');
    if(write&&(a%4||a+3>=(1<<c.n)))throw Error('写事务须为对齐4B且不越界');
    var st=split(c,a), lines=sets[st.set],way=lines.findIndex(function(l){return l&&l.tag===st.tag;}),hit=way>=0,victim=null,bypass=write&&!hit&&!allocate;
    clock++;if(hit)totals.hit++;else totals.miss++;
    if(!hit&&!bypass){
      way=lines.findIndex(function(l){return !l;});
      if(way<0){way=0;for(var j=1;j<lines.length;j++)if(lines[j].last<lines[way].last)way=j;
        victim=Object.assign({},lines[way]);if(victim.dirty){totals.lowerWrites++;totals.lowerWriteBytes+=c.B;}}
      lines[way]={tag:st.tag,blk:st.blk,dirty:false,last:clock};
    }
    if(bypass||write&&!back){totals.lowerWrites++;totals.lowerWriteBytes+=4;}
    if(!bypass){lines[way].last=clock;if(write&&back)lines[way].dirty=true;}
    result.push({address:a,op:write?'W':'R',tag:st.tag,index:st.set,offset:st.off,hit:hit,bypass:bypass,victim:victim,
      sets:sets.map(function(s){return s.map(function(l){return l&&Object.assign({},l);});}),totals:Object.assign({},totals)});
  });return result;
}

function mountWriteLab(container) {
  var root=document.createElement('details');root.innerHTML='<summary>新增：读写、脏位与下层流量（独立实验）</summary><p>保留上方原有读访问与3C分类。本区固定8位地址、16B容量、4B块，可改相联度。写每次为对齐4B；下层写事务与字节数分别统计；结束不自动flush。策略性不分配缺失不硬套3C。</p><label>相联度<select data-rw-assoc><option value="1">直接映射</option><option value="2">2路</option><option value="4">全相联</option></select></label> <label>写策略<select data-rw-back><option value="1">写回</option><option value="0">写直达</option></select></label> <label>缺失策略<select data-rw-alloc><option value="1">写分配</option><option value="0">不写分配</option></select></label><label>访问序列（R/W+对齐字节地址）<input data-rw-input value="W0 W16 R0 W4" style="width:100%;box-sizing:border-box"></label><button data-rw-reset>应用/复位</button> <button data-rw-step>单步</button><pre data-rw-out aria-live="polite" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre>';container.appendChild(root);
  var pos=0,steps=[],events=[];function q(s){return root.querySelector(s);}function on(s,fn){var el=q(s);el.addEventListener('click',fn);events.push([el,fn]);}
  function draw(){var st=steps[pos-1];q('[data-rw-out]').textContent=st?'第'+pos+'/'+steps.length+'：'+st.op+st.address+' '+(st.hit?'命中':'缺失')+(st.bypass?'（绕过不分配）':'')+'\ntag/index/offset='+st.tag+'/'+st.index+'/'+st.offset+'\n淘汰='+JSON.stringify(st.victim)+'\n统计='+JSON.stringify(st.totals)+'\n各组/脏位='+JSON.stringify(st.sets,null,2):'已复位，所有valid为0，尚未访问。';}
  function load(){try{var tokens=q('[data-rw-input]').value.trim().split(/[\s,]+/);if(tokens.length>64)throw Error('最多64访问');var accesses=tokens.map(function(t){var m=/^([RW])(\d+)$/i.exec(t);if(!m)throw Error('格式如W0 R16');var a=+m[2];if(a%4||a>252)throw Error('对齐4B字访问0…252');return {op:m[1].toUpperCase(),address:a};});steps=simulateRW(makeConfig(8,16,4,+q('[data-rw-assoc]').value),accesses,{writeBack:q('[data-rw-back]').value==='1',writeAllocate:q('[data-rw-alloc]').value==='1'});pos=0;draw();}catch(e){steps=[];q('[data-rw-out]').textContent='错误：'+e.message;}}
  on('[data-rw-reset]',load);on('[data-rw-step]',function(){pos=Math.min(pos+1,steps.length);draw();});load();return function(){events.forEach(function(x){x[0].removeEventListener('click',x[1]);});root.remove();};
}

// 输入法全角模式打出的「０ｘ１０，」先换成半角
function parseSeq(str, n) {
  str = String(str).replace(/[！-～]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); });
  var parts = str.trim().split(/[\s,、;]+/).filter(Boolean), out = [], max = (1 << n) - 1, i, p, v;
  if (!parts.length) return { err: '地址序列是空的，至少输入 1 个地址。' };
  if (parts.length > MAX_N) return { err: '最多 ' + MAX_N + ' 个地址，现在有 ' + parts.length + ' 个。' };
  for (i = 0; i < parts.length; i++) {
    p = parts[i];
    v = /^0x[0-9a-f]+$/i.test(p) ? parseInt(p.slice(2), 16) : /^\d+$/.test(p) ? parseInt(p, 10) : NaN;
    if (isNaN(v)) return { err: '「' + p + '」不是地址：请写十进制（如 20）或 0x 开头的十六进制（如 0x14）。' };
    if (v > max) return { err: '地址 ' + p + ' 超出 ' + n + ' 位地址的范围 0–' + max + '（' + hex(max, n) + '）。' };
    out.push(v);
  }
  return { addrs: out };
}

var PRESETS = {
  conflict: { name: '冲突：0 和 16 轮流访问', n: 8, C: 16, B: 4, A: 1, seq: [0, 16, 0, 16, 0, 16, 0, 16],
    note: '16 字节的直接映射 Cache，4 字节一块，共 4 组。地址 0 在块 0，地址 16 在块 4，4 mod 4 = 0，两块都只能进第 0 组，每次访问都把对方挤出去：前 2 次是强制缺失，后 6 次全是冲突缺失，另外 3 组却一直空着。把相联度改成 2 路再看：两块能同时留在一组里，后 6 次全部命中。' },
  scan: { name: '顺序扫描字节 0–31', n: 8, C: 32, B: 8, A: 1, seq: seq(0, 31, 1),
    note: '逐个字节读地址 0 到 31。一块 8 字节，每块只有第一个字节缺失；整块搬进来以后，同一块剩下的 7 个字节都命中，这就是空间局部性（spatial locality）。把块大小改成 4 或 16 字节，比较命中率。' },
  loop: { name: '循环读 40 字节数组两遍', n: 8, C: 32, B: 8, A: 0, seq: seq(0, 36, 4).concat(seq(0, 36, 4)),
    note: '循环两遍读一个 40 字节的数组，每次读 4 字节（地址 0, 4, …, 36）。数组占 5 块，全相联 Cache 只有 4 行，工作集比容量大：每装进一块都要换出最久没用的那块，而它恰好是接下来要用的。第二遍每块的第一次访问都缺失，全相联也躲不开，所以是容量缺失。' }
};

/* ---------- 文字说明 ---------- */
function rangeOf(c, b) { return hex(b * c.B, c.n) + '–' + hex(b * c.B + c.B - 1, c.n); }

function explain(c, st) {
  var b = st.blk, v = st.victim,
    h = '访问 ' + hex(st.a, c.n) + '（' + st.a + '）：它在块 ' + b + '，' + (c.S > 1 ? '映射到第 ' + st.set + ' 组' : '全相联只有 1 组') + '，标记是 ' + st.tag + '。';
  if (st.hit) return h + '第 ' + st.set + ' 组第 ' + st.way + ' 路有效，标记也是 ' + st.tag + '，✓ 命中，直接从 Cache 取数据。' +
    (c.W > 1 ? '这一行成了组里最近用过的一行（LRU 次序 1）。' : '');
  h += (c.W > 1 ? '把组里 ' + c.W + ' 路的标记都比一遍，' : '这一组只有 1 行，') + '没有标记为 ' + st.tag + ' 的有效行，✗ 缺失：要把整块 ' + rangeOf(c, b) + ' 从下一级存储搬进来。';
  if (!v) h += '第 ' + st.way + ' 路还空着，直接放进去。';
  else if (c.W === 1) h += '直接映射没得选，换出这一行原来的块 ' + v.blk + '。';
  else h += '这一组满了，按 LRU 换出最久没用的第 ' + v.way + ' 路：块 ' + v.blk + '，上次在第 ' + v.last + ' 次访问时用过。';
  if (st.kind === 'comp') return h + '块 ' + b + ' 是第一次被访问，Cache 再大也躲不开，这是强制缺失（compulsory miss，也叫冷缺失）。';
  if (st.kind === 'cap') return h + '块 ' + b + ' 以前访问过，可同样 ' + c.L + ' 行的全相联 LRU Cache 也已经把它换出去了：上次用它之后，又访问了至少 ' + c.L +
    ' 个别的块，' + c.L + ' 行装不下，这是容量缺失（capacity miss）。';
  return h + '块 ' + b + ' 以前访问过，而且同样 ' + c.L + ' 行的全相联 LRU Cache 里它还在：总容量够用，只是它和别的块被映射到同一组、被挤了出去，这是冲突缺失（conflict miss）。';
}

function summary(t, n) {
  var tips = [];
  if (t.conf) tips.push('冲突缺失可以靠提高相联度消除');
  if (t.cap) tips.push('容量缺失要靠更大的 Cache 或更小的工作集');
  if (t.comp) tips.push('强制缺失只能靠更大的块或预取来减少');
  return '整串 ' + n + ' 次访问走完：命中 ' + t.hit + ' 次，命中率 ' + pct(t.hit, n) + '；缺失 ' + (n - t.hit) + ' 次，其中强制 ' + t.comp + '、容量 ' + t.cap +
    '、冲突 ' + t.conf + '。' + (tips.length ? tips.join('；') + '。' : '');
}

/* ---------- HTML 片段 ---------- */
function derivedHTML(c) {
  return '共 ' + c.L + ' 行（' + c.C + ' ÷ ' + c.B + '），分成 ' + c.S + ' 组，每组 ' + c.W + ' 路。块内偏移 log<sub>2</sub>' + c.B + ' = ' + c.off +
    ' 位，组索引 log<sub>2</sub>' + c.S + ' = ' + c.idx + ' 位，标记 ' + c.n + ' − ' + c.off + ' − ' + c.idx + ' = ' + c.tag +
    ' 位。替换策略固定为 LRU：组满了又缺失时，换出组里最久没用的一行。';
}

function bitsHTML(c, st) {
  var s = st ? bin(st.a, c.n) : '', pos = 0, h = '', lab = [];
  [['tg', '标记', c.tag, st && st.tag], ['ix', '组索引', c.idx, st && st.set], ['of', '偏移', c.off, st && st.off]].forEach(function (g) {
    if (!g[2]) return;
    h += '<div class="@@g @@' + g[0] + '" style="flex:' + g[2] + ' 1 0"><div class="@@cells">';
    for (var i = 0; i < g[2]; i++) h += '<span>' + (st ? s.charAt(pos + i) : '·') + '</span>';
    h += '</div><div class="@@gl">' + g[1] + '<br>' + g[2] + ' 位</div></div>';
    lab.push(g[1] + ' ' + g[2] + ' 位' + (st ? ' ' + s.substr(pos, g[2]) + ' = ' + g[3] : ''));
    pos += g[2];
  });
  return '<div class="@@bits" role="img" aria-label="' + (st ? '地址 ' + s + '：' : '') + lab.join('，') + '">' + h + '</div>';
}

function addrCard(c, st) {
  var h = '<h4>地址怎么拆' + (st ? '<small>' + hex(st.a, c.n) + ' = ' + st.a + '</small>' : '') + '</h4>' + bitsHTML(c, st);
  if (!st) return h + '<p class="@@note">还没有访问。' + c.n + ' 位地址里，高 ' + c.tag + ' 位是标记（tag），' +
    (c.idx ? '中间 ' + c.idx + ' 位是组索引（index），' : '没有组索引（只有 1 组），') + '低 ' + c.off + ' 位是块内偏移（offset）。</p>';
  var b = st.blk;
  return h + '<p class="@@calc">块号 = ⌊' + st.a + ' ÷ ' + c.B + '⌋ = ' + b + '，块内偏移 = ' + st.a + ' mod ' + c.B + ' = ' + st.off + '<br>' +
    (c.S > 1 ? '组号 = ' + b + ' mod ' + c.S + ' = ' + st.set + '，标记 = ⌊' + b + ' ÷ ' + c.S + '⌋ = ' + st.tag : '只有 1 组：组号 0，标记 = 块号 = ' + st.tag) +
    '<br>块 ' + b + ' 覆盖地址 ' + rangeOf(c, b) + '，共 ' + c.B + ' 字节</p>' +
    '<p class="@@note">除以 2 的幂就是去掉低位：低 ' + c.off + ' 位是偏移，' + (c.idx ? '再往上 ' + c.idx + ' 位是组号，' : '') + '剩下的高位是标记。</p>';
}

function shadowCard(c, st) {
  var list = st ? st.sh : [];
  return '<h4>影子 Cache<small>同样 ' + c.L + ' 行的全相联 LRU</small></h4>' +
    '<p class="@@note">只用来给缺失分类，不影响真正的 Cache。里面的块按最近用过 → 最久没用排列：</p><div class="@@blks">' +
    (list.length ? list.map(function (b) { return '<span class="@@blk">块 ' + b + '</span>'; }).join('<span class="@@arr" aria-hidden="true">→</span>') : '<span class="@@note">空</span>') +
    '</div><p class="@@note">' + (st ? '这一步影子 Cache ' + (st.shHit ? '命中块 ' + st.blk : '缺失') + (st.shOut !== null ? '，换出块 ' + st.shOut : '') + '。' : '') +
    (c.A === 0 ? '现在真正的 Cache 也是全相联，和影子一模一样，所以不会有冲突缺失。' : '') + '</p>' +
    '<p class="@@note">分类规则：块第一次被访问 → 强制缺失；以前访问过、影子也缺失 → 容量缺失；以前访问过、影子却命中 → 冲突缺失。</p>';
}

function cacheCard(c, st) {
  var sets = st ? st.sets : emptySets(c), h = '<h4>Cache 的内容<small>' + c.S + ' 组 × ' + c.W + ' 路，' + assocName(c.A) + '</small></h4>' +
    '<div class="@@tw" data-r="tw"><table><thead><tr><th scope="col">组</th><th scope="col">路</th><th scope="col">有效</th><th scope="col">标记</th>' +
    '<th scope="col">装的块（地址范围）</th><th scope="col">LRU 次序</th><th scope="col">这一步</th></tr></thead><tbody>';
  sets.forEach(function (lines, si) {
    var rk = ranks(lines), full = lines.every(Boolean), cur = !!st && st.set === si;
    lines.forEach(function (l, w) {
      var me = cur && st.way === w, lru = '—', act = '',
        cls = (cur ? '@@cs' : '') + (me ? ' @@me ' + (st.hit ? '@@hr' : '@@mr') : '') + (l ? '' : ' @@dim');
      if (l && c.W > 1) lru = rk[w] + (rk[w] === 1 ? '（最近）' : full && rk[w] === c.W ? '（最久）' : '');
      if (me) act = st.hit ? '✓ 命中' : '✗ ' + KIND[st.kind] + '，装入' + (st.victim ? '，换出块 ' + st.victim.blk : '');
      h += '<tr class="' + cls + '">' + (w ? '' : '<th scope="rowgroup" rowspan="' + c.W + '">' + si + '</th>') + '<td>' + w + '</td><td>' + (l ? 1 : 0) +
        '</td><td>' + (l ? bin(l.tag, c.tag) + ' <span class="@@f">(' + l.tag + ')</span>' : '—') + '</td><td class="@@f">' +
        (l ? '块 ' + l.blk + '：' + rangeOf(c, l.blk) : '—') + '</td><td class="@@f">' + lru + '</td><td class="@@f">' + act + '</td></tr>';
    });
  });
  return h + '</tbody></table></div><p class="@@note">' + (c.W > 1 ? 'LRU 次序 1 是组里最近用过的一行，数字越大越久没用；组满了又缺失时，换出标「最久」的那一行。'
    : '直接映射每组只有 1 行，缺失时没有选择，直接替换原来的块。') + '有效位 0 的行还没装过数据。标记列括号里是十进制。</p>';
}

function statsCard(c, steps, s, addrs) {
  var t = s ? steps[s - 1].tot : { hit: 0, comp: 0, cap: 0, conf: 0 }, n = addrs.length;
  var h = '<h4>统计<small>前 ' + s + ' 次访问</small></h4><div class="@@stats"><span>✓ 命中 <b>' + t.hit + '</b></span><span>✗ 缺失 <b>' + (s - t.hit) +
    '</b></span><span>强制 ' + t.comp + ' · 容量 ' + t.cap + ' · 冲突 ' + t.conf + '</span><span>命中率 <b>' + (s ? t.hit + '/' + s + ' = ' + pct(t.hit, s) : '—') +
    '</b></span></div><div class="@@log" role="group" aria-label="访问记录">';
  addrs.forEach(function (a, j) {
    var x = j < s ? steps[j] : null, cls = x ? (x.hit ? 'H' : 'M') : 'todo';
    h += '<button type="button" class="@@chip @@' + cls + (j === s - 1 ? ' @@cur" aria-current="step' : '') + '" data-k="' + j + '" aria-label="第 ' + (j + 1) +
      ' 次访问 ' + hex(a, c.n) + '：' + (x ? (x.hit ? '命中' : KIND[x.kind]) : '还没访问') + '。跳到这一步">' + hex(a, c.n) + '<br>' +
      (x ? (x.hit ? '✓' : '✗' + KIND[x.kind].charAt(0)) : '·') + '</button>';
  });
  h += '</div><p class="@@note">✓ = 命中；✗强、✗容、✗冲 = 强制、容量、冲突缺失；· = 还没访问。点一个格子跳到那次访问。</p>';
  if (n && s === n) h += '<p class="@@sum">' + summary(t, n) + '</p>';
  return h;
}

/* ---------- 样式（@@ 换成类名前缀，~--x N~ 换成按比例混进 --surface 的浅色底） ---------- */
var CSS = [
  '.@@root{font-family:var(--font);color:var(--text);font-size:15px;line-height:1.65;display:flex;flex-direction:column;gap:12px;min-width:0;container-type:inline-size}',
  '.@@root *{box-sizing:border-box}',
  '.@@root p{margin:0}',
  '.@@root h4{margin:0 0 8px;font-size:15px;font-weight:600;line-height:1.4;color:var(--text)}',
  '.@@root h4 small{margin-left:8px;font-size:13px;font-weight:400;color:var(--text-2)}',
  '.@@intro,.@@derived{font-size:14px;color:var(--text-2)}',
  '.@@derived{background:var(--surface-2);border-radius:8px;padding:8px 12px}',
  '.@@box,.@@card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius,10px);padding:12px;min-width:0}',
  '.@@ctl{display:flex;flex-direction:column;gap:10px}',
  '.@@params,.@@row,.@@bar{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}',
  '.@@root label{display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:14px;color:var(--text-2);max-width:100%}',
  '.@@root select,.@@root input{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:5px 8px;min-height:36px;max-width:100%;min-width:0}',
  '.@@row input{flex:1 1 200px;font-family:var(--mono)}',
  '.@@fixed{font-size:14px;color:var(--text-2)}',
  '.@@hint{display:block;font-size:13px;color:var(--text-2);margin-bottom:4px}',
  '.@@btn{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 12px;min-height:36px;cursor:pointer}',
  '.@@btn:hover:not([aria-disabled=true]){background:var(--surface-2)}',
  '.@@pri,.@@btn[aria-pressed=true]{border-color:var(--c-arch);background:~--c-arch 16~}',
  '.@@pri{font-weight:600}',
  '.@@btn[aria-disabled=true]{color:~--text 45~;background:var(--surface);border-color:var(--border);cursor:default}',
  '.@@root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}',
  '.@@msg{font-size:14px;color:var(--text-2)}.@@msg:empty{display:none}',
  '.@@msg.@@err{color:var(--text);padding:6px 10px;border-left:3px solid var(--div-pos);background:~--div-pos 10~;border-radius:4px}',
  '.@@pos{flex:1 1 220px;font-size:14px;color:var(--text-2)}',
  '.@@now{background:~--c-arch 8~;border:1px solid var(--border);border-left:4px solid var(--c-arch);border-radius:var(--radius,10px);padding:10px 14px;line-height:1.75}',
  '.@@grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}',
  '@container (min-width:640px){.@@grid{grid-template-columns:minmax(0,3fr) minmax(0,2fr)}}',
  '.@@bits{display:flex;gap:4px;font-family:var(--mono);margin:4px 0 8px}',
  '.@@g{border-radius:6px;padding:4px 2px;min-width:30px;text-align:center}',
  '.@@cells{display:flex}.@@cells span{flex:1;min-width:0;font-size:16px;line-height:1.5;color:var(--text)}',
  '.@@gl{font-family:var(--font);font-size:12px;line-height:1.35;color:var(--text)}',
  '.@@tg{background:~--c-arch 26~}.@@ix{background:~--div-neg 20~}.@@of{background:~--text-3 16~}',
  '.@@calc{font-size:14px;line-height:1.8}',
  '.@@note{font-size:13px;color:var(--text-3);margin-top:6px!important}',
  '.@@blks{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;margin:6px 0}',
  '.@@blk{font-family:var(--mono);font-size:13px;padding:1px 8px;border:1px solid var(--border);border-radius:999px;background:var(--surface-2);color:var(--text)}',
  '.@@arr{color:var(--text-3);font-size:12px}',
  '.@@tw{overflow:auto;max-height:340px;border:1px solid var(--border);border-radius:8px}',
  '.@@root table{border-collapse:separate;border-spacing:0;width:100%;font-size:13px}',
  '.@@root th,.@@root td{border-bottom:1px solid var(--border);padding:4px 8px;text-align:center;white-space:nowrap;font-weight:400;color:var(--text)}',
  '.@@root thead th{position:sticky;top:0;z-index:1;background:var(--surface-2);font-weight:600;color:var(--text-2)}',
  '.@@root td{font-family:var(--mono)}.@@root td.@@f,.@@root .@@f{font-family:var(--font)}',
  '.@@dim>td{color:var(--text-3)}',
  '.@@cs>*{background:~--c-arch 10~}',
  '.@@cs>th{box-shadow:inset 3px 0 var(--c-arch);font-weight:600}',
  '.@@hr>td{background:~--good 20~;font-weight:600}',
  '.@@mr>td{background:~--div-pos 18~;font-weight:600}',
  '.@@stats{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:14px;color:var(--text-2)}',
  '.@@stats b{font-family:var(--mono);font-size:16px;color:var(--text)}',
  '.@@log{display:flex;flex-wrap:wrap;gap:4px;margin-top:10px}',
  '.@@chip{font-family:var(--mono);font-size:12px;line-height:1.3;min-width:50px;padding:3px 4px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);cursor:pointer}',
  '.@@chip.@@H{background:~--good 18~}.@@chip.@@M{background:~--div-pos 16~}.@@chip.@@todo{color:var(--text-3)}',
  '.@@chip.@@cur{border-color:var(--text);box-shadow:inset 0 0 0 1px var(--text)}',
  '.@@sum{margin-top:10px!important;padding:8px 12px;background:var(--surface-2);border-radius:8px}',
  '@container (max-width:420px){.@@btn{padding:6px 10px}.@@now{padding:8px 10px}.@@root th,.@@root td{padding:4px 6px}}'
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
  '<p class="@@how">怎么玩：选一个预设，或者自己输入一串字节地址，再按「下一步」逐个访问。每一步看地址怎样拆成标记、组索引和块内偏移，落进哪一组，结果是命中还是缺失，缺失又属于哪一类。' +
  '改参数时，同一串地址会按新的 Cache 重新算，并停在同一步，方便对比。</p>' +
  '<p class="@@intro">Cache 按块（block，放进 Cache 后叫一行，line）从内存搬数据。地址最低几位是块内偏移（offset）；中间几位是组索引（index），决定这块只能进哪一组；' +
  '剩下的高位是标记（tag），和数据一起存在行里，用来认出这一行装的是哪一块。直接映射每组 1 行，W 路组相联每组 W 行，全相联只有 1 组，哪一行都能放。</p>' +
  '<div class="@@box @@ctl"><div class="@@params">' +
  '<label>地址位数<select data-r="n" aria-label="地址位数"></select></label>' +
  '<label>Cache 容量<select data-r="C" aria-label="Cache 容量"></select></label>' +
  '<label>块大小<select data-r="B" aria-label="块大小"></select></label>' +
  '<label>相联度<select data-r="A" aria-label="相联度"></select></label>' +
  '<span class="@@fixed">替换策略：LRU</span></div>' +
  '<p class="@@derived" data-r="derived"></p>' +
  '<label>预设<select data-r="preset" aria-label="预设地址序列"></select></label>' +
  '<div><span class="@@hint">地址序列：十进制或 0x 开头的十六进制，用逗号或空格隔开，最多 ' + MAX_N + ' 个</span>' +
  '<div class="@@row"><input data-r="seq" type="text" spellcheck="false" autocomplete="off" aria-label="地址序列，十进制或 0x 开头的十六进制">' +
  '<button type="button" class="@@btn" data-r="apply" aria-label="应用这串地址，从头开始">应用</button></div></div>' +
  '<p class="@@msg" data-r="msg" aria-live="polite"></p></div>' +
  '<div class="@@bar" role="group" aria-label="逐步控制">' +
  '<button type="button" class="@@btn" data-r="prev" aria-label="上一步">上一步</button>' +
  '<button type="button" class="@@btn @@pri" data-r="next" aria-label="下一步">下一步</button>' +
  '<button type="button" class="@@btn" data-r="play" aria-pressed="false" aria-label="自动播放">自动播放</button>' +
  '<button type="button" class="@@btn" data-r="reset" aria-label="重置到开始">重置</button>' +
  '<span class="@@pos" data-r="pos"></span></div>' +
  '<div class="@@now" data-r="now" aria-live="polite"></div>' +
  '<div class="@@grid"><section class="@@card" data-r="addr" aria-label="地址拆分"></section><section class="@@card" data-r="shadow" aria-label="影子 Cache"></section></div>' +
  '<section class="@@card" data-r="cache" aria-label="Cache 的内容"></section>' +
  '<section class="@@card" data-r="stats" aria-label="统计"></section>';

function opts(list, fmt) { return list.map(function (v) { return '<option value="' + v + '">' + fmt(v) + '</option>'; }).join(''); }

/* ---------- 挂载 ---------- */
function mount(container) {
  injectStyle();
  var reduce = false;
  try { reduce = !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
  var root = document.createElement('div');
  root.className = PX + 'root';
  root.innerHTML = tpl(HTML);
  container.appendChild(root);
  var ls = [], timer = null, P = null, c = null, addrs = [], steps = [], s = 0, preset = 'conflict';
  function q(r) { return root.querySelector('[data-r="' + r + '"]'); }
  function on(el, ev, fn) { el.addEventListener(ev, fn); ls.push([el, ev, fn]); }
  function setMsg(t, err) { var m = q('msg'); m.textContent = t; m.className = PX + 'msg' + (err ? ' ' + PX + 'err' : ''); }
  function dis(r, v) { q(r).setAttribute('aria-disabled', v ? 'true' : 'false'); }
  function off(r) { return q(r).getAttribute('aria-disabled') === 'true'; }

  q('n').innerHTML = opts(BITS, function (v) { return v + ' 位'; });
  q('C').innerHTML = opts(CAPS, function (v) { return v + ' 字节'; });
  q('B').innerHTML = opts(BLKS, function (v) { return v + ' 字节'; });
  q('A').innerHTML = opts(ASSOC, assocName);
  q('preset').innerHTML = Object.keys(PRESETS).map(function (k) { return '<option value="' + k + '">' + PRESETS[k].name + '</option>'; }).join('') +
    '<option value="custom">自己输入的序列</option>';
  if (reduce) q('play').title = '系统开启了「减少动态效果」，自动播放已关闭';

  function sync() { q('n').value = P.n; q('C').value = P.C; q('B').value = P.B; q('A').value = P.A; q('preset').value = preset; }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    var b = q('play'); b.textContent = '自动播放'; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', '自动播放');
  }
  function go(k) { s = Math.max(0, Math.min(addrs.length, k)); render(); }
  function loadPreset(id) {
    var p = PRESETS[id];
    stop(); preset = id; P = { n: p.n, C: p.C, B: p.B, A: p.A }; c = makeConfig(p.n, p.C, p.B, p.A);
    addrs = p.seq.slice(); steps = simulate(c, addrs); s = 0;
    q('seq').value = addrs.join(', '); sync(); setMsg(p.note); render();
  }
  function apply() {
    var r = parseSeq(q('seq').value, P.n), id;
    if (r.err) { setMsg(r.err, true); return; }
    stop(); addrs = r.addrs; steps = simulate(c, addrs); s = 0; preset = 'custom';
    for (id in PRESETS) {
      var p = PRESETS[id];
      if (p.seq.join() === addrs.join() && p.n === P.n && p.C === P.C && p.B === P.B && p.A === P.A) preset = id;
    }
    q('seq').value = addrs.join(', '); sync();
    setMsg(preset === 'custom' ? '已换成你输入的 ' + addrs.length + ' 个地址，从头开始。' : PRESETS[preset].note);
    render();
  }
  function changeParam(k) {
    var np = { n: P.n, C: P.C, B: P.B, A: P.A }, nc, max, bad;
    np[k] = Number(q(k).value);
    nc = makeConfig(np.n, np.C, np.B, np.A);
    if (nc.err) { sync(); setMsg(nc.err + '已恢复原来的设置。', true); return; }
    max = (1 << np.n) - 1;
    bad = addrs.filter(function (a) { return a > max; });
    if (bad.length) {
      sync(); setMsg('序列里的地址 ' + bad[0] + '（' + hex(bad[0], P.n) + '）超出 ' + np.n + ' 位地址的范围 0–' + max + '，先改地址序列再缩小地址位数。已恢复原来的设置。', true);
      return;
    }
    stop(); P = np; c = nc; steps = simulate(c, addrs); s = Math.min(s, addrs.length);
    setMsg('参数改成：' + c.n + ' 位地址，' + c.C + ' 字节，' + c.B + ' 字节一块，' + assocName(c.A) + '。同一串地址按新的 Cache 重新算，' +
      (s ? '仍停在第 ' + s + ' 次访问。' : '从头开始。'));
    render();
  }
  function play() {
    if (reduce) { setMsg('系统开启了「减少动态效果」，自动播放已关闭，请用「下一步」。'); return; }
    if (timer) { stop(); return; }
    if (s >= addrs.length) s = 0;
    var b = q('play'); b.textContent = '暂停'; b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', '暂停自动播放');
    timer = setInterval(function () { go(s + 1); if (s >= addrs.length) stop(); }, 1000);
    go(s + 1);
    if (s >= addrs.length) stop();
  }
  // 表格放不下时，让这一步改动的那一行留在可视范围里
  function follow(keep) {
    var box = q('tw'), row = box && box.querySelector('.' + PX + 'me');
    if (!box) return;
    box.scrollTop = keep;
    if (!row) return;
    var head = box.querySelector('thead').offsetHeight, top = row.offsetTop - head, bot = row.offsetTop + row.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (bot > box.scrollTop + box.clientHeight) box.scrollTop = bot - box.clientHeight;
  }
  function render() {
    var n = addrs.length, st = s ? steps[s - 1] : null, ae = document.activeElement,
      fk = ae && root.contains(ae) ? ae.getAttribute('data-k') : null, box = q('tw'), keep = box ? box.scrollTop : 0;
    q('derived').innerHTML = derivedHTML(c);
    q('pos').textContent = st ? '第 ' + s + ' / ' + n + ' 次访问：' + hex(st.a, c.n) + ' → ' + (st.hit ? '✓ 命中' : '✗ ' + KIND[st.kind]) + (s === n ? '。序列走完了。' : '。')
      : '第 0 / ' + n + ' 次：还没开始，第 1 个地址是 ' + hex(addrs[0], c.n) + '。';
    dis('prev', !s); dis('reset', !s); dis('next', s === n); dis('play', reduce);
    q('now').innerHTML = tpl('<h4>现在发生了什么<small>' + (st ? '第 ' + s + ' 次访问' : '开始前') + '</small></h4><p>' + (st ? explain(c, st)
      : '还没有访问任何地址，Cache 里所有行的有效位都是 0。按「下一步」访问第 1 个地址 ' + hex(addrs[0], c.n) + '。') + '</p>');
    q('addr').innerHTML = tpl(addrCard(c, st));
    q('shadow').innerHTML = tpl(shadowCard(c, st));
    q('cache').innerHTML = tpl(cacheCard(c, st));
    follow(keep);
    q('stats').innerHTML = tpl(statsCard(c, steps, s, addrs));
    if (fk !== null) { var nb = q('stats').querySelector('[data-k="' + fk + '"]'); if (nb) nb.focus({ preventScroll: true }); }
  }

  on(root, 'click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b || !root.contains(b)) return;
    var r = b.getAttribute('data-r'), k = b.getAttribute('data-k');
    if (k !== null) { stop(); go(Number(k) + 1); return; }
    if (!r || off(r)) return;
    if (r === 'next') go(s + 1);
    else if (r === 'prev') { stop(); go(s - 1); }
    else if (r === 'reset') { stop(); go(0); }
    else if (r === 'play') play();
    else if (r === 'apply') apply();
  });
  on(root, 'change', function (e) {
    var r = e.target.getAttribute('data-r');
    if (r === 'preset') {
      if (e.target.value === 'custom') { stop(); setMsg('在下面的输入框里改地址，按回车或「应用」。'); q('seq').focus(); return; }
      loadPreset(e.target.value);
    } else if (r === 'n' || r === 'C' || r === 'B' || r === 'A') changeParam(r);
  });
  on(root, 'keydown', function (e) {
    var tg = e.target, nm = tg.tagName;
    if (tg === q('seq') && e.key === 'Enter') { e.preventDefault(); apply(); return; }
    if (nm === 'INPUT' || nm === 'SELECT' || nm === 'TEXTAREA' || (tg.classList && tg.classList.contains(PX + 'tw'))) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(s + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); go(s - 1); }
  });

  loadPreset('conflict');
  return {
    destroy: function () {
      stop();
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
  function res(c, a) { return simulate(c, a).map(function (x) { return x.hit ? 'H' : x.kind; }); }
  function tot(c, a) { var r = simulate(c, a); return r[r.length - 1].tot; }
  function rep(x, k) { var r = []; while (k--) r.push(x); return r; }
  function cfg(p, A) { return makeConfig(p.n, p.C, p.B, A === undefined ? p.A : A); }
  var dm = makeConfig(8, 16, 4, 1), w2 = makeConfig(8, 16, 4, 2), fa = makeConfig(8, 16, 4, 0), cyc = seq(0, 16, 4);
  chk('直接映射 16B、4B 块：组数、偏移位、索引位、标记位', [dm.S, dm.off, dm.idx, dm.tag], [4, 2, 2, 4]);
  chk('直接映射 16B/4B：0,16,0,16 全部缺失，2 次强制 + 2 次冲突', res(dm, [0, 16, 0, 16]), ['comp', 'comp', 'conf', 'conf']);
  chk('同容量 2 路组相联：0,16,0,16 → 缺失、缺失、命中、命中', res(w2, [0, 16, 0, 16]), ['comp', 'comp', 'H', 'H']);
  chk('顺序读字节 0–15，4B 块：4 次缺失、12 次命中', tot(dm, seq(0, 15, 1)), { hit: 12, comp: 4, cap: 0, conf: 0 });
  chk('全相联 16B/4B 循环 5 个块 3 遍：前 5 次强制，其余 10 次全是容量缺失', res(fa, cyc.concat(cyc, cyc)), rep('comp', 5).concat(rep('cap', 10)));
  var c12 = makeConfig(12, 64, 8, 2), s12 = split(c12, 0x1A7);
  chk('12 位地址、64B、8B 块、2 路：偏移 3 位、4 组、索引 2 位、标记 7 位', [c12.off, c12.S, c12.idx, c12.tag], [3, 4, 2, 7]);
  chk('0x1A7 = 0001101|00|111：块 52、组 0、标记 13、偏移 7', [bin(0x1A7, 12), s12.blk, s12.set, s12.tag, s12.off], ['000110100111', 52, 0, 13, 7]);
  var lru = simulate(w2, [0, 8, 0, 16, 8]);
  chk('2 路 LRU：块 0,2,0,4,2 都进第 0 组；装块 4 时换出最久没用的块 2，再访问块 2 是冲突缺失',
    [lru.map(function (x) { return x.hit ? 'H' : x.kind; }), lru[3].victim.blk], [['comp', 'comp', 'H', 'comp', 'conf'], 2]);
  var P1 = PRESETS.conflict, P2 = PRESETS.scan, P3 = PRESETS.loop;
  chk('预设「冲突」：直接映射 2 强制 + 6 冲突；改成 2 路后 2 次缺失、6 次命中',
    [tot(cfg(P1), P1.seq), tot(cfg(P1, 2), P1.seq)], [{ hit: 0, comp: 2, cap: 0, conf: 6 }, { hit: 6, comp: 2, cap: 0, conf: 0 }]);
  chk('预设「顺序扫描」32B 直接映射：8B 块缺失 4 次；4B 块 8 次；16B 块 2 次',
    [8, 4, 16].map(function (B) { var t = tot(makeConfig(8, 32, B, 1), P2.seq); return P2.seq.length - t.hit; }), [4, 8, 2]);
  chk('预设「循环」全相联 32B/8B：5 强制 + 5 容量 + 10 命中', tot(cfg(P3), P3.seq), { hit: 10, comp: 5, cap: 5, conf: 0 });
  var x = 12345, prop = true, sum = true, a = [], i;
  for (i = 0; i < 48; i++) { x = x * 48271 % 2147483647; a.push(x % 96); }
  CAPS.forEach(function (C) {
    BLKS.forEach(function (B) {
      ASSOC.forEach(function (A) {
        var c = makeConfig(8, C, B, A);
        if (c.err) return;
        var t = tot(c, a);
        if (t.hit + t.comp + t.cap + t.conf !== a.length) sum = false;
        if (A === 0 && t.conf) prop = false;
      });
    });
  });
  chk('全相联从不出现冲突缺失；各种参数下命中 + 三类缺失 = 访问次数（48 个伪随机地址）', [prop, sum], [true, true]);
  chk('不可能的组合被拒绝：16B/8B 做 4 路、16B/16B 做 2 路；16B/16B 直接映射可以',
    [!!makeConfig(8, 16, 8, 4).err, !!makeConfig(8, 16, 16, 2).err, !!makeConfig(8, 16, 16, 1).err], [true, true, false]);
  chk('解析「0x10, 16，0X1f 3」', parseSeq('0x10, 16，0X1f 3', 8).addrs, [16, 16, 31, 3]);
  chk('非法输入：空串、12a、8 位地址里的 256', [!!parseSeq(' ', 8).err, !!parseSeq('12a', 8).err, !!parseSeq('256', 8).err], [true, true, true]);
  return { ok: ok, details: details };
}

window.KGDemos = window.KGDemos || {};
window.KGDemos[ID] = { title: 'Cache：命中、缺失、相联与写策略', mount: function(container){var a=mount(container),b=mountWriteLab(container);return {destroy:function(){if(a&&a.destroy)a.destroy();b();}};}, selfTest: selfTest,
  model:{makeConfig:makeConfig,split:split,simulate:simulate,simulateRW:simulateRW,parseSeq:parseSeq} };
})();
