/* 交互演示：CPU 调度（FIFO / SJF / STCF / RR）。接口见 _build/SITE-SPEC.md 第 7.2 节。 */
(function () {
'use strict';
const ID = 'os-scheduling', P = 'dm-os-scheduling-';
const MINN = 3, MAXN = 6, MAXARR = 15, MAXRUN = 10, MAXQ = 4;
const ALGOS = [
  { id: 'FIFO', full: 'FIFO：先进先出（First In First Out），也叫先来先服务（FCFS）' },
  { id: 'SJF', full: 'SJF：最短作业优先（Shortest Job First），非抢占' },
  { id: 'STCF', full: 'STCF：最短完成时间优先（Shortest Time-to-Completion First），抢占式' },
  { id: 'RR', full: 'RR：轮转（Round Robin）' }
];
const PRESETS = [
  { id: 'convoy', label: '护航效应', rows: [['A', 0, 8], ['B', 1, 2], ['C', 2, 2]] },
  { id: 'same', label: '三个同时到达', rows: [['A', 0, 6], ['B', 0, 4], ['C', 0, 2]] }
];
// 进程序号 → 深浅档位（0 最深 … 5 最浅），相邻进程的深浅差得开。
const LV = [2, 4, 0, 3, 1, 5];

const mk = rows => rows.map(r => ({ name: r[0], arrival: r[1], burst: r[2] }));
const fmt = x => String(Math.round(x * 100) / 100);
const eq = x => Math.abs(Math.round(x * 100) / 100 - x) > 1e-9 ? '≈ ' : '= ';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const idx = n => Array.from({ length: n }, (_, i) => i);

/* 逐个时间单位模拟，返回每个时间单位的决策记录 units 和每个进程的指标。
   平局规则（页面「平局怎么定」里写给读者）：同时到达按进程表顺序；SJF 一样长时先到的优先；
   STCF 剩余一样时正在跑的不换；RR 同一时刻有进程到达、又有进程用完时间片，新到的先进队尾。 */
function simulate(procs, algo, q) {
  const n = procs.length, rem = procs.map(p => p.burst), first = procs.map(() => null), fin = procs.map(() => null), units = [];
  const byArr = (a, b) => procs[a].arrival - procs[b].arrival || a - b;
  const order = idx(n).sort(byArr);
  let queue = [], cur = -1, used = 0, done = 0;
  for (let t = 0; done < n && t < 5000; t++) {
    const u = { t, run: -1, arr: [], exp: -1, pre: -1, prev: -1, cand: [], wait: [], fin: -1, first: false, next: -1 };
    order.forEach(j => { if (procs[j].arrival === t) { queue.push(j); u.arr.push(j); } });
    if (algo === 'RR' && cur >= 0 && used >= q) { u.exp = cur; queue.push(cur); cur = -1; }
    u.prev = cur;
    let pick = cur;
    if (algo === 'STCF') {
      const c = (cur >= 0 ? [cur] : []).concat(queue).sort((a, b) => rem[a] - rem[b] || (b === cur) - (a === cur) || byArr(a, b));
      u.cand = c.map(j => [j, rem[j]]);
      if (c.length) {
        pick = c[0];
        if (cur >= 0 && pick !== cur) { u.pre = cur; queue.push(cur); }
        queue = queue.filter(j => j !== pick);
      }
    } else if (cur < 0 && queue.length) {
      if (algo === 'SJF') queue.sort((a, b) => procs[a].burst - procs[b].burst || byArr(a, b));
      u.cand = queue.map(j => [j, algo === 'SJF' ? procs[j].burst : rem[j]]);
      pick = queue.shift();
    }
    if (pick < 0) { u.next = order.find(j => procs[j].arrival > t); units.push(u); continue; }
    if (pick !== cur) used = 0;
    cur = pick;
    u.run = pick; u.remBefore = rem[pick]; u.usedBefore = used;
    if (first[pick] === null) { first[pick] = t; u.first = true; }
    rem[pick]--; used++;
    u.wait = algo === 'FIFO' || algo === 'RR' ? queue.slice() : queue.slice().sort(byArr);
    if (!rem[pick]) { fin[pick] = t + 1; done++; u.fin = pick; cur = -1; used = 0; }
    units.push(u);
  }
  const stats = procs.map((p, j) => {
    const ta = fin[j] - p.arrival;
    return { fin: fin[j], first: first[j], ta, resp: first[j] - p.arrival, wait: ta - p.burst };
  });
  const mean = key => stats.reduce((s, x) => s + x[key], 0) / n;
  return { units, T: units.length, stats, avg: { ta: mean('ta'), resp: mean('resp'), wait: mean('wait') },
    seq: units.map(x => x.run < 0 ? '-' : procs[x.run].name).join('') };
}

const RULE = {
  FIFO: '谁先到谁先跑，跑完才换下一个，中途不打断。',
  SJF: 'CPU 空出来时，在已到达的进程里挑运行时间最短的；开跑后不打断。',
  STCF: '每个时间单位都重新挑剩余时间最短的进程；新到的进程更短，就抢占正在跑的。',
  RR: '按到达顺序排队，每个进程最多连续跑 q 个时间单位（一个时间片），没跑完就回到队尾。'
};
const rule = (algo, q) => RULE[algo].replace('q 个', q + ' 个');

/* 第 k 步的说明：k = 0 是开始前，k ≥ 1 讲时间单位 [k-1, k)。返回 { head, body, notes }。 */
function stepText(procs, sim, algo, q, k) {
  const N = j => esc(procs[j].name), names = ids => ids.map(N).join('、');
  const chain = c => c.map(x => N(x[0])).join(' → '), vals = c => c.map(x => N(x[0]) + ' ' + x[1]).join('、');
  const withRun = j => `${N(j)}（运行时间 ${procs[j].burst}）`;
  const tie = (c, word, cur) => {
    const m = c.filter(x => x[1] === c[0][1]).map(x => x[0]);
    if (m.length < 2) return '';
    if (m.includes(cur)) return `（${names(m)} ${word}，正在跑的 ${N(cur)} 不换下来）`;
    const e = m.filter(x => procs[x].arrival === procs[m[0]].arrival);
    return `（${names(m)} ${word}，` + (e.length === 1 ? N(m[0]) + ' 先到' : (e.length === m.length ? '又同时到达' : names(e) + ' 同时最先到达') + '，按进程表顺序') + '）';
  };
  if (!k) {
    const a0 = idx(procs.length).filter(j => !procs[j].arrival);
    return { head: '第 0 步 · 时刻 0 · 还没开始', body: ['规则：' + rule(algo, q)],
      notes: [(a0.length ? `时刻 0 到达的有 ${names(a0)}。` : '时刻 0 还没有进程到达。') + '点「下一步」，看调度器在时刻 0 选谁。'] };
  }
  const u = sim.units[k - 1], t = u.t, j = u.run, B = [], M = [], fq = algo === 'FIFO' || algo === 'RR';
  const cont = u.prev === j, more = u.cand.length > 1;
  if (u.arr.length === 1) B.push(`时刻 ${t}：${withRun(u.arr[0])}到达${fq ? '，排到队尾' : ''}。`);
  else if (u.arr.length) B.push(`时刻 ${t}：${u.arr.map(withRun).join('、')}同时到达，按进程表顺序${fq ? '排到队尾' : '排队'}。`);
  if (j < 0) B.push('没有已到达、还没完成的进程，CPU 空闲' + (u.next >= 0 ? `，下一个到达的是 ${N(u.next)}（时刻 ${procs[u.next].arrival}）` : '') + '。');
  else if (algo === 'FIFO') B.push(cont ? (u.wait.length ? names(u.wait) + ' 在排队，但 ' : '') + `FIFO 不打断正在跑的进程，${N(j)} 继续运行。` :
    more ? `CPU 空着。就绪队列按到达顺序是 ${chain(u.cand)}，FIFO 选队首 ${N(j)}。` : `CPU 空着，就绪队列里只有 ${N(j)}，它开始运行。`);
  else if (algo === 'SJF') {
    const sh = u.wait.filter(x => procs[x].burst < u.remBefore);
    B.push(cont ? (sh.length ? sh.map(withRun).join('、') + `比 ${N(j)} 剩下的 ${u.remBefore} 短，但 ` : '') + `SJF 不抢占，${N(j)} 继续运行。` :
      more ? `CPU 空着。就绪进程的运行时间：${vals(u.cand)}，SJF 选最短的 ${N(j)}${tie(u.cand, '一样长')}。` : `CPU 空着，就绪的只有 ${N(j)}，它开始运行。`);
  } else if (algo === 'STCF') {
    B.push(!more ? `就绪的只有 ${N(j)}（剩余 ${u.remBefore}），它运行。` : `比较剩余时间：${vals(u.cand)}。${N(j)} 最短` +
      (cont ? '，继续运行' + tie(u.cand, '剩余一样', j) : u.pre >= 0 ? tie(u.cand, '剩余一样') + `，抢占 ${N(u.pre)}，${N(u.pre)} 回到就绪队列` :
        '，开始运行' + tie(u.cand, '剩余一样')) + '。');
  } else if (u.exp === j) B.push(`${N(j)} 用完了 ${q} 个单位的时间片，但队列里没有别的进程，它接着跑，时间片重新计。`);
  else {
    if (u.exp >= 0) B.push(`${N(u.exp)} 用完了 ${q} 个单位的时间片，回到队尾` + (u.arr.length ? `（排在刚到的 ${names(u.arr)} 后面）` : '') + '。');
    B.push(cont ? `${N(j)} 的时间片还没用完（已用 ${u.usedBefore}，共 ${q}），继续运行。` :
      more ? `队列：${chain(u.cand)}，队首 ${N(j)} 运行。` : `队列里只有 ${N(j)}，它运行。`);
  }
  if (j >= 0) {
    const p = procs[j], ta = t + 1 - p.arrival;
    if (u.first) M.push(`${N(j)} 第一次上 CPU：响应时间 = ${t} − ${p.arrival} = ${t - p.arrival}。`);
    if (u.fin === j) M.push(`${N(j)} 在时刻 ${t + 1} 完成：周转时间 = ${t + 1} − ${p.arrival} = ${ta}，等待时间 = 周转 − 运行 = ${ta} − ${p.burst} = ${ta - p.burst}。`);
  }
  if (k === sim.T) M.push(`全部完成。平均周转 ${fmt(sim.avg.ta)}，平均响应 ${fmt(sim.avg.resp)}，平均等待 ${fmt(sim.avg.wait)}，算式见下面的表。`);
  return { head: `第 ${k} 步 · 时刻 ${t} → ${t + 1} · ` + (j < 0 ? 'CPU 空闲' : `${N(j)} 运行，剩余 ${u.remBefore} → ${u.remBefore - 1}`), body: B, notes: M };
}

function selfTest() {
  const details = [];
  let ok = true;
  const chk = (name, got, exp) => {
    const num = typeof exp === 'number', pass = num ? Math.abs(got - exp) < 1e-6 : got === exp;
    ok = ok && pass;
    details.push(`${pass ? 'PASS' : 'FAIL'} ${name}：期望 ${num ? fmt(exp) : exp}，得到 ${num ? fmt(got) : got}`);
  };
  const sim = (rows, a, q) => simulate(mk(rows), a, q || 1);
  const big = [['A', 0, 100], ['B', 0, 10], ['C', 0, 10]], five = [['A', 0, 5], ['B', 0, 5], ['C', 0, 5]];
  const late = [['A', 0, 100], ['B', 10, 10], ['C', 10, 10]], cv = PRESETS[0].rows;
  chk('OSTEP 第 7 章：A、B、C 同时到达，各运行 10，FIFO 平均周转', sim([['A', 0, 10], ['B', 0, 10], ['C', 0, 10]], 'FIFO').avg.ta, 20);
  chk('OSTEP 第 7 章：A=100、B=10、C=10 同时到达，FIFO 平均周转', sim(big, 'FIFO').avg.ta, 110);
  chk('OSTEP 第 7 章：同上，SJF 平均周转', sim(big, 'SJF').avg.ta, 50);
  chk('OSTEP 第 7 章：A、B、C 各运行 5，RR 时间片 1，平均响应', sim(five, 'RR').avg.resp, 1);
  chk('OSTEP 第 7 章：同上，RR 平均周转', sim(five, 'RR').avg.ta, 14);
  chk('OSTEP 第 7 章：同上，SJF 平均响应', sim(five, 'SJF').avg.resp, 5);
  chk('OSTEP 第 7 章：A=100 在 0 到达，B、C=10 在 10 到达，SJF 平均周转', sim(late, 'SJF').avg.ta, 310 / 3);
  chk('OSTEP 第 7 章：同上，STCF 平均周转', sim(late, 'STCF').avg.ta, 50);
  chk('平局（手算）：RR 时间片 1，新到的 B 排在用完时间片的 A 前面', sim([['A', 0, 3], ['B', 1, 2]], 'RR').seq, 'ABABA');
  chk('平局（手算）：STCF 剩余一样时不切换', sim([['A', 0, 4], ['B', 2, 2]], 'STCF').seq, 'AAAABB');
  chk('空闲（手算）：没有进程可跑时 CPU 空着', sim([['A', 0, 2], ['B', 5, 1], ['C', 5, 1]], 'FIFO').seq, 'AA---BC');
  chk('护航效应预设（手算 (8+9+10)/3）：FIFO 平均周转', sim(cv, 'FIFO').avg.ta, 9);
  chk('护航效应预设（手算 (12+2+3)/3）：STCF 平均周转', sim(cv, 'STCF').avg.ta, 17 / 3);
  chk('护航效应预设（手算）：RR 时间片 2 的运行顺序', sim(cv, 'RR', 2).seq, 'AABBCCAAAAAA');
  // 随机检查不变量：每个进程恰好跑满运行时间、不早于到达；有进程可跑时 CPU 不空闲；
  // RR 用完时间片后只有队列为空才接着跑；STCF 的平均周转不比其他三种差。
  let seed = 20261019, bad = 0;
  const rnd = m => (seed = seed * 16807 % 2147483647) % m;
  for (let c = 0; c < 300; c++) {
    const ps = idx(MINN + rnd(MAXN - MINN + 1)).map(i => ({ name: 'P' + i, arrival: rnd(MAXARR + 1), burst: 1 + rnd(MAXRUN) }));
    const q = 1 + rnd(MAXQ), res = ALGOS.map(a => simulate(ps, a.id, q));
    res.forEach(r => {
      const cnt = ps.map(() => 0);
      r.units.forEach(u => {
        if (u.run >= 0) { cnt[u.run]++; if (ps[u.run].arrival > u.t) bad++; }
        else if (ps.some((p, j) => p.arrival <= u.t && r.stats[j].fin > u.t)) bad++;
        if (u.exp >= 0 && u.run === u.exp && u.wait.length) bad++;
      });
      ps.forEach((p, j) => { if (cnt[j] !== p.burst || r.stats[j].wait < 0) bad++; });
    });
    if (res[2].avg.ta > Math.min(...res.map(r => r.avg.ta)) + 1e-9) bad++;
  }
  chk('随机 300 组进程表 × 4 种算法：违反不变量的次数', bad, 0);
  return { ok, details };
}
/* ---------- 样式 ---------- */
// 每档深浅：[浅色主题填充, 浅色主题字色, 深色主题填充, 深色主题字色]。只用 --c-os 一种色相，与主题色混合出深浅。
const SHADE = [
  ['55%,var(--text)', 'var(--surface)', '62%,var(--bg)', 'var(--text)'],
  ['78%,var(--text)', 'var(--surface)', '', 'var(--bg)'],
  ['', 'var(--text)', '78%,var(--text)', 'var(--bg)'],
  ['62%,var(--surface)', 'var(--text)', '58%,var(--text)', 'var(--bg)'],
  ['40%,var(--surface)', 'var(--text)', '40%,var(--text)', 'var(--bg)'],
  ['20%,var(--surface)', 'var(--text)', '22%,var(--text)', 'var(--bg)']
];
const shadeVars = d => SHADE.map((s, i) => `--dmp${i}:${s[d] ? `color-mix(in srgb,var(--c-os) ${s[d]})` : 'var(--c-os)'};--dmi${i}:${s[d + 1]};`).join('');
const css = () => `.S-root{container-type:inline-size;display:grid;gap:14px;font-size:15px;line-height:1.65;color:var(--text);font-variant-numeric:tabular-nums;--dms:color-mix(in srgb,var(--c-os) 55%,var(--text));${shadeVars(0)}}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .S-root{${shadeVars(2)}}}
:root[data-theme="dark"] .S-root{${shadeVars(2)}}
.S-root *{box-sizing:border-box}.S-root>*{min-width:0}
.S-root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.S-how{margin:0;color:var(--text-2)}
.S-two,.S-res{display:grid;gap:12px;grid-template-columns:minmax(0,1fr)}
@container (min-width:700px){.S-two{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}.S-res{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}}
.S-card,.S-gw{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)}
.S-card{padding:12px 14px}
.S-h{font-size:15px;font-weight:600;margin:0 0 8px;line-height:1.4}
.S-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.S-lbl{color:var(--text-2);font-size:14px}
.S-hint,.S-msg{font-size:13px;color:var(--text-3);margin:6px 0 0}.S-msg{color:var(--text-2)}.S-msg:empty{display:none}
.S-btn{font:inherit;font-size:14px;line-height:1.3;padding:7px 12px;min-height:34px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);cursor:pointer;white-space:nowrap}
.S-btn:hover{background:var(--surface-2)}
.S-btn:disabled,.S-btn[aria-disabled="true"]{opacity:.45;cursor:default;background:var(--surface)}
.S-btn[aria-pressed="true"],.S-btn.S-on,.S-main,.S-opt input:checked+span{border-color:var(--c-os);background:color-mix(in srgb,var(--c-os) 15%,var(--surface))}
.S-main{font-weight:600}
.S-edit{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 6px}
.S-edit th{font-weight:600;color:var(--text-2);text-align:left;padding:2px 4px;font-size:13px}
.S-edit td{padding:3px 4px}.S-edit td:last-child{width:1%}
.S-nmw{display:flex;align-items:center;gap:6px}
.S-in{width:100%;min-width:0;font:inherit;font-size:14px;padding:5px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)}
.S-sw{display:inline-block;flex:none;width:12px;height:12px;border-radius:3px;border:1px solid var(--dms);vertical-align:-1px}
.S-seg{display:flex;flex-wrap:wrap;gap:6px}
.S-opt{position:relative}
.S-opt input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.S-opt span{display:block;padding:6px 14px;border:1px solid var(--border);border-radius:8px;font-weight:600;font-size:14px}
.S-opt input:focus-visible+span{outline:2px solid var(--focus);outline-offset:2px}
.S-rule{margin:8px 0 0;font-size:14px;color:var(--text-2)}.S-rule b{color:var(--text);font-weight:600}
.S-qrow{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:14px}
.S-qrow input{flex:1;max-width:200px;accent-color:var(--c-os)}
.S-qrow output{font-weight:600;min-width:1.5em}.S-qoff{opacity:.5}
.S-play{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.S-clock{margin-left:auto;font-size:14px;color:var(--text-2)}
.S-gw{display:flex;padding:6px 0}.S-glab{flex:none}.S-gsc{flex:1;min-width:0;overflow-x:auto;overflow-y:hidden}
.S-gw svg{display:block;max-width:none}.S-gw text{font-family:var(--font)}
.S-gl{stroke:var(--border)}.S-gl2{stroke:var(--edge)}
.S-ax,.S-pn{font-size:11px;fill:var(--text-3);text-anchor:middle}
.S-rl{font-size:12px;fill:var(--text-2);text-anchor:end;font-weight:600}
.S-trk{fill:var(--surface-2)}.S-sg{stroke:var(--dms)}
.S-sl,.S-idle{font-size:12px;font-weight:600;text-anchor:middle}.S-idle{font-weight:400;fill:var(--text-3)}
.S-wt{fill:color-mix(in srgb,var(--text-3) 10%,transparent);stroke:var(--text-3);stroke-dasharray:3 3}
.S-arr{fill:var(--text-2)}
.S-nl{stroke:var(--text);stroke-width:1.5}.S-pill{fill:var(--text)}.S-pn{font-weight:600;fill:var(--surface)}
.S-legend{display:flex;flex-wrap:wrap;gap:2px 16px;font-size:13px;color:var(--text-2);margin-top:-6px}
.S-legend i{display:inline-block;width:18px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.S-legend .S-lr{background:var(--c-os);border:1px solid var(--dms)}
.S-legend .S-lw{border:1px dashed var(--text-3);background:color-mix(in srgb,var(--text-3) 10%,transparent)}
.S-legend .S-la{width:0;height:0;border-radius:0;border:5px solid transparent;border-top:6px solid var(--text-2);border-bottom:0}
.S-legend .S-ln{width:2px;height:14px;border-radius:0;background:var(--text);vertical-align:-2px}
.S-now{background:color-mix(in srgb,var(--c-os) 7%,var(--surface));border:1px solid var(--border);border-left:4px solid var(--c-os);border-radius:var(--radius);padding:10px 14px;min-height:118px}
.S-now p{margin:3px 0}.S-nh{font-weight:600}.S-nm2{color:var(--text-2);font-size:14px}
.S-tw{overflow-x:auto}
.S-tbl{width:100%;border-collapse:collapse;font-size:14px}
.S-tbl th,.S-tbl td{padding:5px 7px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap}
.S-tbl thead th{background:var(--surface-2);color:var(--text-2);font-size:13px}
.S-tbl th{font-weight:600}.S-tbl th:first-child{text-align:left}
.S-tbl tfoot>tr>*{border-bottom:0;border-top:2px solid var(--border)}
.S-tbl .S-on{background:color-mix(in srgb,var(--c-os) 12%,var(--surface))}
.S-best{font-weight:700}.S-na{color:var(--text-3)}.S-tbl .S-sw{margin-right:6px}
.S-cur{font-size:12px;color:var(--text-2);border:1px solid var(--border);border-radius:999px;padding:0 6px;margin-left:6px}
.S-calc{font-size:14px;color:var(--text-2);margin-top:6px}.S-calc p{margin:2px 0}
.S-ex h3{font-size:15px;font-weight:600;margin:12px 0 4px}.S-ex h3:first-child{margin-top:0}
.S-ex ul{margin:0;padding-left:1.2em}.S-ex li{margin:4px 0}.S-k{font-weight:600}
.S-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@container (max-width:420px){.S-card{padding:10px}.S-tbl th,.S-tbl td{padding:5px 4px}.S-ctab thead th{white-space:normal;word-break:keep-all}.S-opt span{padding:6px 11px}.S-btn{padding:7px 10px}}
` + idx(6).map(i => `.S-f${i}{fill:var(--dmp${i})}.S-t${i}{fill:var(--dmi${i})}.S-b${i}{background:var(--dmp${i})}`).join('');
function injectStyle() {
  if (document.getElementById('dm-style-' + ID)) return;
  const s = document.createElement('style');
  s.id = 'dm-style-' + ID;
  s.textContent = css().replace(/\.S-/g, '.' + P);
  document.head.appendChild(s);
}
// 模板里写 class="S-xxx"，统一换成带前缀的类名。
const cls = html => html.replace(/class="([^"]*)"/g, (m, c) => `class="${c.replace(/\bS-/g, P)}"`);

const EXPLAIN = `<h3>三个指标怎么算</h3><ul>
<li><span class="S-k">周转时间</span>（turnaround time）= 完成时刻 − 到达时刻。作业从交上来到拿到结果一共花了多久，批处理任务最在乎它。</li>
<li><span class="S-k">响应时间</span>（response time）= 第一次运行的时刻 − 到达时刻。在终端敲完命令，多久能看到第一点反应，交互程序最在乎它。</li>
<li><span class="S-k">等待时间</span>（waiting time）= 周转时间 − 运行时间。这里的进程只用 CPU、不做 I/O，所以它就是在就绪队列（ready queue）里排队的总时长。甘特图里每个进程一行，虚线框加起来的长度就是它。</li></ul>
<h3>四种算法的取舍</h3><ul>
<li><span class="S-k">FIFO</span>（先进先出，也叫先来先服务 FCFS）：按到达顺序跑，一个跑完才换下一个，实现最简单。长作业排在前面时，后面的短作业全得等，这叫护航效应（convoy effect）。OSTEP 第 7 章的例子：A 运行 100、B 和 C 各运行 10，同时到达，FIFO 的平均周转是 110。</li>
<li><span class="S-k">SJF</span>（最短作业优先）：CPU 空出来时挑运行时间最短的。上面的例子换成 SJF，平均周转降到 50（演示里运行时间最多填 10，可以缩小 10 倍来试：A=10、B=1、C=1，FIFO 是 11，SJF 是 5）。所有作业同时到达时，它的平均周转最短。它不抢占（preemption）：在「护航效应」预设里，B 在时刻 1 到达时 A 已经开跑，SJF 只能等 A 跑完，结果和 FIFO 一样。</li>
<li><span class="S-k">STCF</span>（最短完成时间优先，也叫最短剩余时间优先 SRTF）：每个时间单位都比较剩余时间，新来的更短就抢占。作业陆续到达时，它的平均周转最短，「护航效应」预设里从 FIFO 的 9 降到 5.67。代价有两个，SJF 也一样：只要不断有短作业进来，长作业就一直轮不到，这叫饿死（starvation）；它还得事先知道每个作业要跑多久，真实系统只能估计。</li>
<li><span class="S-k">RR</span>（轮转）：每个进程最多连续跑一个时间片（time slice，这里记作 q），没跑完就回到队尾。响应快：A、B、C 各运行 5、同时到达，q = 1 时平均响应时间是 1，SJF 是 5。周转差：同一组作业，RR 的平均周转是 14，SJF 是 10，因为三个作业都要拖到快结束才跑完。q 越小，响应一般越快，但真实系统每次切换进程（上下文切换，context switch）都要花时间，这个演示把切换开销记为 0。</li></ul>
<h3>平局怎么定</h3><ul>
<li>同一时刻到达的进程，按进程表从上到下的顺序排队。</li>
<li>SJF：运行时间一样长，先到的优先；到达时刻也一样，按进程表顺序。</li>
<li>STCF：剩余时间一样时，正在运行的进程继续跑，不切换；都没在运行时，先到的优先，再按进程表顺序。</li>
<li>RR：同一时刻既有进程到达、又有进程用完时间片，新到的先进队尾，用完时间片的排在它后面。队列里只剩一个进程时，它用完时间片接着跑。</li></ul>`;

function template(me) {
  const b = (a, t, c) => `<button type="button" class="S-btn${c || ''}" ${a}>${t}</button>`;
  return `<p class="S-how">怎么玩：先选一组预设，或直接改进程表，再选调度算法。点「下一步」一次走 1 个时间单位，看甘特图（Gantt chart）一格格长出来，表里的数字一个个算出来。</p>
<div class="S-two"><section class="S-card"><h3 class="S-h">进程表</h3>
<div class="S-row"><span class="S-lbl">预设：</span>${PRESETS.map(p => b(`data-preset="${p.id}" aria-pressed="false"`, p.label)).join('')}</div>
<table class="S-edit"><thead><tr><th scope="col">进程</th><th scope="col">到达时刻</th><th scope="col">运行时间</th><th scope="col"><span class="S-sr">删除</span></th></tr></thead><tbody></tbody></table>
<div class="S-row">${b('data-act="add"', '添加进程')}<span class="S-hint" style="margin:0">3–6 个进程；到达 0–${MAXARR}，运行 1–${MAXRUN}，都取整数。</span></div>
<p class="S-msg" aria-live="polite"></p></section>
<section class="S-card"><h3 class="S-h">调度算法</h3>
<div class="S-seg" role="radiogroup" aria-label="调度算法">${ALGOS.map(a => `<label class="S-opt"><input type="radio" name="${P}algo-${me}" value="${a.id}" aria-label="${a.full}"><span>${a.id}</span></label>`).join('')}</div>
<p class="S-rule"></p>
<div class="S-qrow"><label for="${P}q-${me}">RR 时间片 q</label><input type="range" id="${P}q-${me}" min="1" max="${MAXQ}" step="1" value="2" aria-label="RR 时间片 q，1 到 ${MAXQ}"><output class="S-qv">2</output></div>
<p class="S-hint S-qh"></p></section></div>
<div class="S-play" role="group" aria-label="播放控制">${b('data-act="reset" aria-label="重置到时刻 0"', '重置')}${b('data-act="prev" aria-label="上一步"', '上一步')}${b('data-act="next" aria-label="下一步"', '下一步', ' S-main')}${b('data-act="play" aria-label="自动播放"', '自动播放')}${b('data-act="end" aria-label="跳到结尾"', '跳到结尾')}<span class="S-clock"></span></div>
<div class="S-gw"><div class="S-glab"></div><div class="S-gsc"></div></div>
<div class="S-legend"><span><i class="S-lr"></i>实心块：在 CPU 上运行</span><span><i class="S-lw"></i>虚线框：已到达，在就绪队列里等</span><span><i class="S-la"></i>到达时刻</span><span><i class="S-ln"></i>现在</span><span class="S-sh" hidden>时间轴较长，可以左右滚动</span></div>
<div class="S-now" aria-live="polite"></div>
<div class="S-res"><section class="S-card"><h3 class="S-h">每个进程的指标</h3><div class="S-tw"><table class="S-tbl S-ptab"></table></div><div class="S-calc"></div></section>
<section class="S-card"><h3 class="S-h">四种算法跑完后的平均值</h3><div class="S-tw"><table class="S-tbl S-ctab"></table></div><p class="S-hint">同一张进程表，加粗的是每列最小的数。这张表按全部跑完计算，不跟着「下一步」变。</p></section></div>
<section class="S-card S-ex">${EXPLAIN}</section>`;
}

/* ---------- 甘特图：左边固定的行名，右边可横向滚动的时间轴，两边行高一致 ---------- */
function runsOf(arr) {
  const out = [];
  arr.forEach((v, t) => { const last = out[out.length - 1]; if (last && last.v === v) last.b = t + 1; else out.push({ v, a: t, b: t + 1 }); });
  return out;
}
const textW = s => [...s].reduce((w, c) => w + (/[\x00-\xff]/.test(c) ? 7.5 : 12.5), 0);
const fits = (s, w) => textW(s) + 6 <= w;
const CY = 26, CH = 32, LY = 78, LH = 18, LG = 12, MID = CY + CH / 2 + 4;
const ganttH = n => LY + n * (LH + LG) - LG + 6, laneY = j => LY + j * (LH + LG);
function labelSVG(procs) {
  const w = Math.ceil(Math.max(26, ...procs.map(p => textW(p.name))) + 14), x = w - 6;
  return `<svg width="${w}" height="${ganttH(procs.length)}" aria-hidden="true"><text class="S-rl" x="${x}" y="${MID}">CPU</text>` +
    procs.map((p, j) => `<text class="S-rl" x="${x}" y="${laneY(j) + LH / 2 + 4}">${esc(p.name)}</text>`).join('') + '</svg>';
}
function chartSVG(procs, sim, k, W) {
  // 1 格至少宽到写得下最长的进程名（P1、P2 这类名字在窄屏上也能写进 1 格），但不超过 32px。
  const mu = Math.min(32, Math.max(18, Math.ceil(Math.max(...procs.map(p => textW(p.name)))) + 6));
  const T = sim.T, L = 15, h = ganttH(procs.length), uw = Math.max(mu, (W - 2 * L) / T), w = Math.ceil(2 * L + uw * T);
  const X = t => +(L + t * uw).toFixed(2), stp = [1, 2, 5, 10, 20].find(v => v * uw >= 22) || 20;
  const rect = (c, x, y, wd, ht, r) => `<rect class="${c}" x="${x}" y="${y}" width="${wd.toFixed(2)}" height="${ht}" rx="${r}"/>`;
  const cpu = runsOf(sim.units.slice(0, k).map(u => u.run)), o = [rect('S-trk', X(0), CY, uw * T, CH, 4)];
  procs.forEach((p, j) => o.push(rect('S-trk', X(0), laneY(j), uw * T, LH, 3)));
  for (let t = 0; t <= T; t++) o.push(`<line class="S-gl${t % stp ? '' : ' S-gl2'}" x1="${X(t)}" x2="${X(t)}" y1="20" y2="${h - 2}"/>`);
  for (let t = 0; t <= T; t += stp) if (Math.abs(t - k) * uw >= 24) o.push(`<text class="S-ax" x="${X(t)}" y="14">${t}</text>`);
  cpu.forEach(r => {
    const x = X(r.a), wd = (r.b - r.a) * uw, cx = (x + wd / 2).toFixed(2);
    if (r.v < 0) { if (fits('空闲', wd)) o.push(`<text class="S-idle" x="${cx}" y="${MID}">空闲</text>`); return; }
    o.push(rect('S-sg S-f' + LV[r.v], x, CY, wd, CH, 3));
    if (fits(procs[r.v].name, wd)) o.push(`<text class="S-sl S-t${LV[r.v]}" x="${cx}" y="${MID}">${esc(procs[r.v].name)}</text>`);
  });
  procs.forEach((p, j) => {
    const y = laneY(j), f = sim.stats[j].fin, s = [];
    for (let t = 0; t < k; t++) s.push(sim.units[t].run === j ? 1 : p.arrival <= t && t < f ? 2 : 0);
    runsOf(s).forEach(r => {
      const x = X(r.a), wd = (r.b - r.a) * uw;
      if (r.v === 1) o.push(rect('S-sg S-f' + LV[j], x, y, wd, LH, 3));
      else if (r.v === 2) o.push(rect('S-wt', x + 1, y + 1, wd - 2, LH - 2, 3));
    });
    o.push(`<path class="S-arr" d="M${(X(p.arrival) - 4.5).toFixed(2)} ${y - 8}h9l-4.5 6z"/>`);
  });
  const nx = X(k);
  o.push(`<line class="S-nl" x1="${nx}" x2="${nx}" y1="19" y2="${h - 2}"/><rect class="S-pill" x="${nx - 13}" y="2" width="26" height="16" rx="8"/><text class="S-pn" x="${nx}" y="14">${k}</text>`);
  const aria = `CPU 甘特图，画到时刻 ${k}` + (cpu.length ? '：' + cpu.map(r => `${r.v < 0 ? '空闲' : procs[r.v].name} ${r.a} 到 ${r.b}`).join('，') : '，还没有进程运行');
  return { svg: `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(aria)}">${o.join('')}</svg>`, nx, w };
}
/* ---------- 挂载 ---------- */
let uid = 0;
function mount(container) {
  injectStyle();
  const me = ++uid, st = { procs: mk(PRESETS[0].rows), algo: 'FIFO', q: 2, k: 0, timer: null, sim: null, all: null };
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const root = document.createElement('div');
  root.className = P + 'root';
  root.innerHTML = cls(template(me));
  container.appendChild(root);
  const $ = s => root.querySelector('.' + P + s), act = a => root.querySelector(`[data-act="${a}"]`);
  const el = { edit: $('edit tbody'), msg: $('msg'), rule: $('rule'), q: root.querySelector('input[type="range"]'), qv: $('qv'), qrow: $('qrow'), qh: $('qh'),
    clock: $('clock'), glab: $('glab'), gsc: $('gsc'), sh: $('sh'), now: $('now'), ptab: $('ptab'), ctab: $('ctab'), calc: $('calc'), add: act('add'), play: act('play') };
  if (reduce) { el.play.disabled = true; el.play.title = '系统开启了「减少动态效果」，请用「下一步」逐步看'; }
  let lastW = 0, raf = 0;

  function buildEditor() {
    const lock = st.procs.length <= MINN;
    el.edit.innerHTML = cls(st.procs.map((p, i) => {
      const n = i + 1, num = (f, lo, hi, lab) => `<td><input class="S-in" data-f="${f}" type="number" min="${lo}" max="${hi}" step="1" inputmode="numeric" value="${p[f]}" aria-label="进程 ${n} 的${lab}"></td>`;
      return `<tr><td><div class="S-nmw"><span class="S-sw S-b${LV[i]}" aria-hidden="true"></span><input class="S-in" data-f="name" type="text" maxlength="4" value="${esc(p.name)}" aria-label="进程 ${n} 的名称"></div></td>` +
        num('arrival', 0, MAXARR, '到达时刻') + num('burst', 1, MAXRUN, '运行时间') +
        `<td><button type="button" class="S-btn" data-del="${i}" aria-label="删除进程 ${esc(p.name)}"${lock ? ' disabled title="至少保留 3 个进程"' : ''}>删除</button></td></tr>`;
    }).join(''));
    el.add.disabled = st.procs.length >= MAXN;
    el.add.title = el.add.disabled ? '最多 6 个进程' : '';
  }
  const freeName = used => { for (let c = 65; c < 91; c++) if (!used.includes(String.fromCharCode(c))) return String.fromCharCode(c); return 'P' + used.length; };
  function readEditor() {
    const rows = [...el.edit.querySelectorAll('tr')], raw = rows.map(tr => [...tr.querySelectorAll('input')].map(x => x.value)), out = [], notes = [];
    // 没改名的行先占住自己的名字；改过的名字为空或和别的行重复时，退回原名（原名被占了才换一个没用过的字母）。
    const want = raw.map(r => r[0].trim().slice(0, 4)), names = want.map((x, i) => x === st.procs[i].name ? x : '');
    raw.forEach((r, i) => {
      const old = st.procs[i];
      if (!names[i]) {
        names[i] = want[i] && !names.includes(want[i]) ? want[i] : names.includes(old.name) ? freeName(names) : old.name;
        if (names[i] !== want[i]) notes.push(`进程名不能为空也不能重复，第 ${i + 1} 行${names[i] === old.name ? '恢复成' : '改成了'} ${names[i]}。`);
      }
      const nm = names[i];
      const num = (v, lo, hi, prev, lab) => {
        const x = Number(v);
        if (!v.trim() || !isFinite(x)) { notes.push(`第 ${i + 1} 行的${lab}不是数字，恢复成 ${prev}。`); return prev; }
        const y = Math.min(hi, Math.max(lo, Math.round(x)));
        if (y !== x) notes.push(`第 ${i + 1} 行的${lab}要取 ${lo}–${hi} 的整数，改成了 ${y}。`);
        return y;
      };
      out.push({ name: nm, arrival: num(r[1], 0, MAXARR, old.arrival, '到达时刻'), burst: num(r[2], 1, MAXRUN, old.burst, '运行时间') });
    });
    rows.forEach((tr, i) => {
      const ins = tr.querySelectorAll('input'), p = out[i];
      [p.name, p.arrival, p.burst].forEach((v, c) => { if (ins[c].value !== String(v)) ins[c].value = v; });
      tr.querySelector('[data-del]').setAttribute('aria-label', '删除进程 ' + p.name);
    });
    el.msg.textContent = notes.join(' ');
    if (JSON.stringify(out) === JSON.stringify(st.procs)) return;
    st.procs = out; st.k = 0; recompute();
  }

  function renderSetup() {
    const key = JSON.stringify(st.procs), a = ALGOS.find(x => x.id === st.algo), rr = st.algo === 'RR';
    root.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(JSON.stringify(mk(PRESETS.find(p => p.id === b.dataset.preset).rows)) === key)));
    root.querySelectorAll('input[type="radio"]').forEach(r => { r.checked = r.value === st.algo; });
    el.rule.innerHTML = `<b>${esc(a.full)}</b><br>${rule(st.algo, st.q)}`;
    el.q.disabled = !rr;
    el.qrow.classList.toggle(P + 'qoff', !rr);
    el.qh.textContent = rr ? '时间片越小，进程轮得越勤，响应越快。' : '时间片只对 RR 起作用，选 RR 后才能调。';
  }
  function renderStep() {
    const s = st.sim, k = st.k, x = stepText(st.procs, s, st.algo, st.q, k);
    el.clock.textContent = `时刻 ${k} / 共 ${s.T}`;
    ['reset', 'prev'].forEach(a => act(a).setAttribute('aria-disabled', String(!k)));
    ['next', 'end'].forEach(a => act(a).setAttribute('aria-disabled', String(k >= s.T)));
    drawGantt();
    el.now.innerHTML = `<p class="${P}nh">${x.head}</p>` + x.body.map(b => `<p>${b}</p>`).join('') + x.notes.map(b => `<p class="${P}nm2">${b}</p>`).join('');
    renderTable();
  }
  function drawGantt() {
    const sc = el.gsc, keep = sc.scrollLeft;
    el.glab.innerHTML = cls(labelSVG(st.procs));
    const W = Math.floor(sc.clientWidth) - 1, g = chartSVG(st.procs, st.sim, st.k, W > 80 ? W : 600);
    sc.innerHTML = cls(g.svg);
    el.sh.hidden = g.w <= sc.clientWidth + 1; // 手机上滚动条是隐藏的，图比框宽时用文字提示
    sc.scrollLeft = keep;
    // 「现在」那条线跑出可见范围时，把它滚回视野里。
    if (g.nx < sc.scrollLeft + 20 || g.nx > sc.scrollLeft + sc.clientWidth - 20) sc.scrollLeft = Math.max(0, g.nx - sc.clientWidth * 0.6);
    lastW = sc.clientWidth;
  }
  const td = v => v === null ? '<td class="S-na" title="还没发生">—</td>' : `<td>${v}</td>`;
  function renderTable() {
    const s = st.sim, k = st.k, cur = k ? s.units[k - 1].run : -1, all = k >= s.T;
    el.ptab.innerHTML = cls('<thead><tr>' + ['进程', '到达', '运行', '完成', '周转', '响应', '等待'].map(h => `<th scope="col">${h}</th>`).join('') + '</tr></thead><tbody>' +
      st.procs.map((p, j) => {
        const x = s.stats[j], done = x.fin <= k;
        return `<tr${j === cur ? ' class="S-on"' : ''}><th scope="row"><span class="S-sw S-b${LV[j]}" aria-hidden="true"></span>${esc(p.name)}</th><td>${p.arrival}</td><td>${p.burst}</td>` +
          td(done ? x.fin : null) + td(done ? x.ta : null) + td(x.first < k ? x.resp : null) + td(done ? x.wait : null) + '</tr>';
      }).join('') + '</tbody><tfoot><tr><th scope="row">平均</th><td></td><td></td><td></td>' + ['ta', 'resp', 'wait'].map(key => td(all ? fmt(s.avg[key]) : null)).join('') + '</tr></tfoot>');
    const line = (lab, key) => `<p>${lab} = (${s.stats.map(x => x[key]).join(' + ')}) / ${s.stats.length} ${eq(s.avg[key])}${fmt(s.avg[key])}</p>`;
    el.calc.innerHTML = all ? line('平均周转', 'ta') + line('平均响应', 'resp') + line('平均等待', 'wait') :
      '<p>「—」表示还没发生：响应时间在进程第一次上 CPU 后出现，周转和等待在它完成后出现。全部完成后，这里列出平均值的算式。</p>';
  }
  function renderCompare() {
    const keys = ['ta', 'resp', 'wait'], min = keys.map(key => Math.min(...st.all.map(s => s.avg[key])));
    el.ctab.innerHTML = cls('<thead><tr><th scope="col">算法</th><th scope="col">平均<wbr>周转</th><th scope="col">平均<wbr>响应</th><th scope="col">平均<wbr>等待</th></tr></thead><tbody>' +
      ALGOS.map((a, i) => {
        const on = a.id === st.algo;
        return `<tr${on ? ' class="S-on" aria-current="true"' : ''}><th scope="row">${a.id}${a.id === 'RR' ? ' q=' + st.q : ''}${on ? '<span class="S-cur">当前</span>' : ''}</th>` +
          keys.map((key, c) => { const v = st.all[i].avg[key]; return `<td${Math.abs(v - min[c]) < 1e-9 ? ' class="S-best"' : ''}>${fmt(v)}</td>`; }).join('') + '</tr>';
      }).join('') + '</tbody>');
  }
  function recompute() {
    st.sim = simulate(st.procs, st.algo, st.q);
    st.all = ALGOS.map(a => simulate(st.procs, a.id, st.q));
    st.k = Math.min(st.k, st.sim.T);
    renderSetup(); renderStep(); renderCompare();
  }

  // 播放键的文字本身就表示状态（自动播放 / 暂停），所以不再叠加 aria-pressed。
  function setPlay(on) {
    el.play.textContent = on ? '暂停' : '自动播放';
    el.play.classList.toggle(P + 'on', on);
    el.play.setAttribute('aria-label', on ? '暂停自动播放' : '自动播放');
  }
  function stop() { clearInterval(st.timer); st.timer = null; setPlay(false); }
  function play() {
    if (reduce) return;
    if (st.k >= st.sim.T) { st.k = 0; renderStep(); }
    setPlay(true);
    st.timer = setInterval(() => { if (st.k < st.sim.T) { st.k++; renderStep(); } if (st.k >= st.sim.T) stop(); }, 800);
  }
  function onClick(e) {
    const b = e.target.closest && e.target.closest('button');
    if (!b || !root.contains(b) || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
    const a = b.dataset.act, pre = b.dataset.preset, del = b.dataset.del;
    if (a !== 'play') stop();
    if (pre || del !== undefined || a === 'add') {
      if (pre) st.procs = mk(PRESETS.find(p => p.id === pre).rows);
      else if (del !== undefined) st.procs.splice(+del, 1);
      else st.procs.push({ name: freeName(st.procs.map(p => p.name)), arrival: Math.min(MAXARR, st.procs[st.procs.length - 1].arrival + 1), burst: 3 });
      st.k = 0; el.msg.textContent = ''; buildEditor(); recompute();
      if (del !== undefined) el.add.focus();
      if (a === 'add') el.edit.querySelector('tr:last-child input').focus();
    } else if (a === 'next' || a === 'prev') { st.k = Math.max(0, Math.min(st.sim.T, st.k + (a === 'next' ? 1 : -1))); renderStep(); }
    else if (a === 'reset' || a === 'end') { st.k = a === 'end' ? st.sim.T : 0; renderStep(); }
    else if (a === 'play') { if (st.timer) stop(); else play(); }
  }
  function onChange(e) {
    const x = e.target;
    if (x.type === 'radio') { stop(); st.algo = x.value; recompute(); }
    else if (x.dataset.f) { stop(); readEditor(); }
  }
  function onInput(e) {
    if (e.target !== el.q) return;
    stop();
    st.q = Math.min(MAXQ, Math.max(1, +el.q.value || 1));
    el.qv.textContent = st.q;
    recompute();
  }
  // 在进程表里按回车，立即应用修改。
  const onKey = e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.f) { e.preventDefault(); readEditor(); } };
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKey);
  const ro = window.ResizeObserver ? new ResizeObserver(() => {
    if (Math.abs(el.gsc.clientWidth - lastW) < 2) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(drawGantt);
  }) : null;
  if (ro) ro.observe(el.gsc);
  buildEditor();
  recompute();
  return {
    destroy() {
      stop(); cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      root.removeEventListener('click', onClick); root.removeEventListener('change', onChange);
      root.removeEventListener('input', onInput); root.removeEventListener('keydown', onKey);
      root.remove();
    }
  };
}

window.KGDemos = window.KGDemos || {};
window.KGDemos[ID] = { title: 'CPU 调度：甘特图里的取舍', mount, selfTest };
})();
