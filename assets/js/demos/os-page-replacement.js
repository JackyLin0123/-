/* 交互演示：页面置换（FIFO、LRU、OPT、Clock）。纯原生 JS，挂到 window.KGDemos['os-page-replacement']。 */
(function () {
  'use strict';
  var ID = 'os-page-replacement', P = 'dm-' + ID + '-';
  function X(s) { return s.replace(/\bx-/g, P); }

  var ALGS = ['fifo', 'lru', 'opt', 'clock'];
  var INFO = {
    fifo: ['FIFO', '先进先出', '换出最早装入内存的页，不管它最近有没有被用过。'],
    lru: ['LRU', '最近最久未使用', '换出最久没被访问的页。依据是局部性（locality）：刚用过的页，很可能马上又要用。'],
    opt: ['OPT', '最优置换', '换出以后最晚才会再被访问的页。它要预先知道整个引用串，真实系统做不到，只当比较的标杆。'],
    clock: ['Clock', '时钟，也叫第二次机会（second chance）','帧围成一圈，每帧有一个使用位（use bit，也叫访问位、reference bit），页被访问时置 1。缺页时指针往前转：使用位是 1 就清成 0、跳过，是 0 就换出。表中页号右上角的小数字是使用位，「指针」行是这一步结束后指针所在的帧。']
  };
  var PRESETS = {
    ostep: { refs: [0, 1, 2, 0, 1, 3, 0, 3, 1, 2, 1], note: 'OSTEP 第 22 章用这个串和 3 帧逐步追踪 OPT、FIFO 和 LRU，可以对照书里的表格。只有一处不同：第 10 步 OPT 要在以后都不再访问的页 0 和 3 里挑一个，书里换出 3，这里换出先装入的 0，两种选法缺页次数一样。' },
    belady: { refs: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5], note: '教材里演示 Belady 异常（Belady\'s anomaly）的经典串。点「演示 Belady 异常」可以直接对比 FIFO 用 3 帧和 4 帧。' },
    local: { refs: [1, 2, 3, 2, 1, 2, 4, 1, 2, 1, 4, 1, 5, 1, 4, 1], note: '页 1 一直在用（好比循环代码所在的页），前半段常用页 2，后半段常用页 4，页 3 和 5 各只出现一次。刚用过的页很快又被用到，这叫时间局部性（temporal locality）。' }
  };

  /* ---------- 核心计算（不碰 DOM） ---------- */
  // 从下标 from（0 起）开始找页 x 下一次出现的时间步（1 起），找不到返回 Infinity
  function nextUse(refs, from, x) {
    for (var j = from; j < refs.length; j++) if (refs[j] === x) return j + 1;
    return Infinity;
  }
  function pickBest(n, better) { var b = 0; for (var i = 1; i < n; i++) if (better(i, b)) b = i; return b; }

  // 逐步模拟。每步记录：访问的页 p、是否命中、用到的帧 f、换出的页 ev，以及这一步结束后的各帧状态。
  function simulate(alg, refs, k) {
    var fr = [], ub = [], at = [], last = [], h = 0, out = [], i;
    for (i = 0; i < k; i++) { fr.push(null); ub.push(0); at.push(0); last.push(0); }
    refs.forEach(function (p, idx) {
      var t = idx + 1, f = fr.indexOf(p), st = { p: p, t: t, ev: null, h0: h };
      if (f >= 0) {
        st.hit = true; st.ub0 = ub[f];
        if (alg === 'clock') ub[f] = 1;
      } else {
        st.hit = false;
        if (alg === 'clock') {
          // 指针所在帧使用位为 1：清零并前进；遇到空帧或使用位为 0 的帧就停
          st.scan = [];
          while (fr[h] !== null && ub[h] === 1) { st.scan.push(h); ub[h] = 0; h = (h + 1) % k; }
          f = h;
        } else {
          f = fr.indexOf(null);
          if (f < 0) {
            if (alg === 'fifo') f = pickBest(k, function (a, b) { return at[a] < at[b]; });
            else if (alg === 'lru') f = pickBest(k, function (a, b) { return last[a] < last[b]; });
            else {
              // OPT：下次访问最晚的换出；几页都不再访问时，换先装入的（换哪个缺页次数都一样）
              var nx = fr.map(function (x) { return nextUse(refs, t, x); });
              st.cand = fr.map(function (x, j) { return { p: x, nx: nx[j], at: at[j] }; });
              f = pickBest(k, function (a, b) { return nx[a] > nx[b] || (nx[a] === nx[b] && at[a] < at[b]); });
            }
          }
        }
        st.ev = fr[f];
        if (st.ev !== null) { st.evAt = at[f]; st.evLast = last[f]; }
        fr[f] = p; at[f] = t; ub[f] = 1;
        if (alg === 'clock') h = (f + 1) % k;
      }
      last[f] = t;
      st.f = f; st.h = h;
      st.fr = fr.slice(); st.ub = ub.slice(); st.at = at.slice(); st.last = last.slice();
      st.nx = fr.map(function (x) { return x === null ? null : nextUse(refs, t, x); });
      out.push(st);
    });
    return out;
  }
  function missCount(steps, upto) { var m = 0; for (var i = 0; i < upto; i++) if (!steps[i].hit) m++; return m; }
  function rate(h, n) { return (n ? (h * 100 / n).toFixed(1) : '0.0') + '%'; }

  function parse(str) {
    var parts = String(str).trim().split(/[\s,，、;；]+/).filter(Boolean), out = [];
    if (!parts.length) return { err: '引用串是空的，至少输入 1 个页号。' };
    if (parts.length > 30) return { err: '最多 30 个页号，现在有 ' + parts.length + ' 个。' };
    for (var i = 0; i < parts.length; i++) {
      if (!/^\d{1,2}$/.test(parts[i])) return { err: '「' + parts[i] + '」不是 0–99 的整数页号。' };
      out.push(+parts[i]);
    }
    return { refs: out };
  }

  /* ---------- 文字说明 ---------- */
  function explain(alg, st) {
    var p = st.p, f = st.f, s, put = '页 ' + p + ' 装进帧 ' + f;
    if (st.hit) {
      s = '页 ' + p + ' 已经在帧 ' + f + ' 里，命中，不用换页。';
      if (alg === 'fifo') return s + 'FIFO 命中时不改装入顺序。';
      if (alg === 'lru') return s + '页 ' + p + ' 成了最近刚用过的页，排到使用顺序的最右边。';
      if (alg === 'clock') return s + (st.ub0 ? '它的使用位本来就是 1，' : '它的使用位从 0 改回 1，') + '指针不动，停在帧 ' + st.h + '。';
      return s;
    }
    s = '页 ' + p + ' 不在内存，缺页。';
    if (st.ev === null) return s + '帧 ' + f + ' 还空着，直接装进去' + (alg === 'clock' ? '，使用位设为 1，指针移到帧 ' + st.h : '') + '。';
    if (alg === 'fifo') return s + '帧都满了，换出最早装入的页 ' + st.ev + '（第 ' + st.evAt + ' 步装入），' + put + '。';
    if (alg === 'lru') return s + '帧都满了，换出最久没用的页 ' + st.ev + '（上次访问在第 ' + st.evLast + ' 步），' + put + '。';
    if (alg === 'opt') {
      var c = st.cand.slice().sort(function (a, b) { return a.nx === b.nx ? a.at - b.at : (a.nx < b.nx ? -1 : 1); });
      var far = [], never = [];
      c.forEach(function (x) { if (x.nx === Infinity) never.push(x.p); else far.push('页 ' + x.p + ' 还有 ' + (x.nx - st.t) + ' 步'); });
      if (never.length) far.push('页 ' + never.join('、') + ' 以后' + (never.length > 1 ? '都' : '') + '不再访问');
      s += '帧都满了，比较下次被访问还有多远：' + far.join('，') + '。';
      if (never.length > 1) s += '这' + (never.length === 2 ? '两' : '几') + '页换哪个，缺页次数都一样，这里换出先装入的页 ' + st.ev;
      else if (never.length === 1) s += '换出以后不再访问的页 ' + st.ev;
      else s += '换出最远才用的页 ' + st.ev;
      return s + '，' + put + '。';
    }
    var sc = st.scan, many = sc.length > 1;
    if (!sc.length) s += '指针指着帧 ' + f + '，页 ' + st.ev + ' 的使用位是 0，换出它。';
    else {
      s += '指针从帧 ' + st.h0 + ' 出发：帧 ' + sc.join('、') + ' 的使用位' + (many ? '都' : '') + '是 1，' + (many ? '逐个' : '') + '清成 0 后跳过；';
      s += (sc.indexOf(f) >= 0 ? '转了一圈回到帧 ' + f + '，页 ' + st.ev + ' 的使用位已经是 0' : '到帧 ' + f + '，页 ' + st.ev + ' 的使用位是 0') + '，换出它。';
    }
    return s + put + '，使用位设为 1，指针移到帧 ' + st.h + '。';
  }

  /* ---------- HTML 片段 ---------- */
  function chip(top, big, cap, tag, pick) {
    return '<span class="x-chip' + (pick ? ' x-pick' : '') + '">' + (top ? '<small>' + top + '</small>' : '') + '<b>' + big + '</b>' +
      (cap ? '<small>' + cap + '</small>' : '') + (tag ? '<em>' + tag + '</em>' : '') + '</span>';
  }

  // nxt：下一步要访问的页（已经走完时是 undefined）
  function stateHTML(alg, st, k, end, nxt) {
    var fr = st.fr, idx = [], free = 0, j, lab, out, tail = '', pick, why;
    for (j = 0; j < k; j++) { if (fr[j] === null) free++; else idx.push(j); }
    if (alg === 'clock') {
      lab = k > 1 ? '帧围成一圈，帧 ' + (k - 1) + ' 之后回到帧 0：' : '只有 1 个帧，指针一直指着帧 0：';
      out = fr.map(function (x, i) {
        return chip('帧 ' + i, x === null ? '空' : x, x === null ? '' : '使用位 ' + st.ub[i], i === st.h ? '↑ 指针' : '', i === st.h);
      }).join('');
      if (!end) tail = '下一步如果缺页，指针从帧 ' + st.h + ' 开始找使用位为 0 的页。';
    } else {
      if (alg === 'opt') idx.sort(function (a, b) { return st.nx[a] === st.nx[b] ? st.at[a] - st.at[b] : (st.nx[a] > st.nx[b] ? -1 : 1); });
      else { var key = alg === 'fifo' ? st.at : st.last; idx.sort(function (a, b) { return key[a] - key[b]; }); }
      lab = { fifo: '装入顺序（左边最早装入）：', lru: '最近使用顺序（左边最久没用）：', opt: '每页下次被访问还有多远（左边最远）：' }[alg];
      // OPT 按真实的将来做决定：下一步命中时不标「换出对象」，否则会误导（之后真正换出的可能是别的页）
      pick = !free && !end && !(alg === 'opt' && fr.indexOf(nxt) >= 0);
      out = idx.map(function (i, n) {
        var cap = alg === 'fifo' ? '第 ' + st.at[i] + ' 步装入' : alg === 'lru' ? '第 ' + st.last[i] + ' 步用过' :
          (st.nx[i] === Infinity ? '不再访问' : '还有 ' + (st.nx[i] - st.t) + ' 步');
        return (n && alg !== 'opt' ? '<span class="x-arr" aria-hidden="true">→</span>' : '') + chip('', fr[i], cap, '', n === 0 && pick);
      }).join('');
      if (!end) {
        if (free) tail = '还有 ' + free + ' 个空帧，下一步如果缺页，先用空帧。';
        else if (alg !== 'opt') tail = '下一步如果缺页，换出页 ' + fr[idx[0]] + '（加粗框）。';
        else if (!pick) tail = '下一步访问页 ' + nxt + '，它在内存里，会命中。';
        else {
          why = idx.length < 2 ? '' : st.nx[idx[1]] === Infinity ? '以后不再访问的几页中最先装入的' : '下次访问最远的';
          tail = '下一步访问页 ' + nxt + '，不在内存，会换出' + why + '页 ' + fr[idx[0]] + '（加粗框）。';
        }
      }
    }
    return '<span class="x-lab">' + lab + '</span>' + out + (tail ? '<span class="x-lab">' + tail + '</span>' : '');
  }

  function tableHTML(alg, refs, steps, s, k) {
    var n = refs.length, t, f, h = '<table class="x-tbl"><thead><tr><th scope="row">步</th>';
    function cur(t) { return t === s ? ' x-cur' : ''; }
    function row(label, cell) {
      var r = '<tr><th scope="row">' + label + '</th>';
      for (var t = 1; t <= n; t++) {
        var c = t <= s ? cell(steps[t - 1]) : ['', ''];
        r += '<td class="' + c[0] + cur(t) + '">' + c[1] + '</td>';
      }
      return r + '</tr>';
    }
    for (t = 1; t <= n; t++) h += '<th scope="col" class="x-stp' + cur(t) + '">' + t + '</th>';
    h += '</tr><tr><th scope="row">访问</th>';
    for (t = 1; t <= n; t++) h += '<th scope="col" class="x-ref' + cur(t) + (t > s ? ' x-fut' : '') + '">' + refs[t - 1] + '</th>';
    h += '</tr></thead><tbody>';
    for (f = 0; f < k; f++) {
      h += row('帧 ' + f, (function (f) {
        return function (st) {
          var x = st.fr[f];
          return [st.f === f ? (st.hit ? 'x-hc' : 'x-mc') : '', x === null ? '' : x + (alg === 'clock' ? '<sup>' + st.ub[f] + '</sup>' : '')];
        };
      })(f));
    }
    if (alg === 'clock') h += row('指针', function (st) { return ['', st.h]; });
    h += row('换出', function (st) { return ['', st.ev === null ? '' : st.ev]; });
    h += row('结果', function (st) { return [st.hit ? 'x-H' : 'x-M', st.hit ? 'H' : 'M']; });
    return h + '</tbody></table>';
  }

  function panelHTML(alg, k, refs, s, bel) {
    var steps = simulate(alg, refs, k), n = refs.length, inf = INFO[alg], st = s ? steps[s - 1] : null;
    var tm = missCount(steps, n), cm = missCount(steps, s);
    return '<section class="x-box x-panel" aria-label="' + inf[0] + '，' + k + ' 帧">' +
      '<h3>' + inf[0] + (bel ? ' · ' + k + ' 帧' : '') + ' <small>' + inf[1] + '</small></h3>' +
      '<p class="x-rule">' + inf[2] + '</p>' +
      '<div class="x-scroll" data-key="' + alg + k + '">' + tableHTML(alg, refs, steps, s, k) + '</div>' +
      '<div class="x-state">' + (st ? stateHTML(alg, st, k, s === n, refs[s]) :
        '<span class="x-lab">' + k + ' 个帧都空着' + (alg === 'clock' ? '，指针在帧 0' : '') + '。</span>') + '</div>' +
      '<p class="x-say"><span class="x-tag">' + (st ? '第 ' + s + ' 步' : '开始前') + '</span>' + (st ? explain(alg, st) : '还没有访问任何页。') + '</p>' +
      '<p class="x-stat">' + (s && s < n ? '到第 ' + s + ' 步：缺页 ' + cm + ' 次，命中 ' + (s - cm) + ' 次。<br>' : '') +
      '跑完整串 ' + n + ' 次访问：缺页 <b>' + tm + '</b> 次，命中 ' + (n - tm) + ' 次，命中率 ' + rate(n - tm, n) + '。</p></section>';
  }

  function bannerHTML() {
    var B = PRESETS.belady.refs, m3 = missCount(simulate('fifo', B, 3), B.length), m4 = missCount(simulate('fifo', B, 4), B.length);
    return '<div class="x-box x-banner"><h3>Belady 异常：帧多了，缺页反而多</h3>' +
      '<p>同一个引用串 ' + B.join(',') + '，FIFO 用 3 帧缺页 ' + m3 + ' 次，用 4 帧缺页 ' + m4 + ' 次。下面两张表已经走到最后一步，按「重置」可以从第 1 步开始对照着看。</p>' +
      '<p>差别出在第 5 步以后。4 帧时，第 5、6 步访问页 1、2 都命中，但 FIFO 只看装入时间，1、2 仍是最早装入的两页：第 7 步装入 5 时换出 1，第 8 步又要用 1，只好换出 2，第 7 到 12 步全部缺页。3 帧时，1、2 在第 5、6 步缺页后重新装入，反倒成了较新的页，第 8、9 步正好命中。</p>' +
      '<p>LRU 和 OPT 不会出现这种情况，见下方「不同帧数下的缺页次数」。</p>' +
      '<button class="x-btn" type="button" data-act="exit" aria-label="回到四种算法对比">回到四种算法对比</button></div>';
  }

  function sumHTML(refs, ks) {
    var j, up = [], h = '<h3>不同帧数下的缺页次数</h3><p class="x-note">每格是整串跑完的缺页次数，两侧有色线的那一列是当前帧数。</p>' +
      '<div class="x-scroll"><table class="x-tbl"><thead><tr><th scope="col">算法</th>';
    for (j = 1; j <= 6; j++) h += '<th scope="col" class="' + (ks.indexOf(j) >= 0 ? 'x-cur' : '') + '">' + j + ' 帧</th>';
    h += '</tr></thead><tbody>';
    ALGS.forEach(function (a) {
      var prev = -1;
      h += '<tr><th scope="row">' + INFO[a][0] + '</th>';
      for (j = 1; j <= 6; j++) {
        var m = missCount(simulate(a, refs, j), refs.length), bad = prev >= 0 && m > prev;
        if (bad) up.push(INFO[a][0] + ' 从 ' + (j - 1) + ' 帧加到 ' + j + ' 帧，缺页从 ' + prev + ' 次变成 ' + m + ' 次');
        h += '<td class="' + (bad ? 'x-up' : '') + (ks.indexOf(j) >= 0 ? ' x-cur' : '') + '">' + m + (bad ? ' ↑' : '') + '</td>';
        prev = m;
      }
      h += '</tr>';
    });
    h += '</tbody></table></div><p class="x-note">' + (up.length ? '标 ↑ 的格子比少一帧时缺页还多：' + up.join('；') + '。这就是 Belady 异常。' :
      '在这个串上，四种算法都是帧越多，缺页越少或持平。');
    return h + 'LRU 和 OPT 属于栈算法（stack algorithm），加帧永远不会让缺页变多。拿 LRU 来说，n 帧里放的是最近用过的 n 个不同的页，它们一定也在 n+1 帧里，所以 n 帧能命中的访问，n+1 帧也都能命中。FIFO 和 Clock 没有这个保证。</p>';
  }

  /* ---------- 样式与骨架 ---------- */
  var CSS =
    '.x-root{color:var(--text,#1b1b19);font-family:var(--font,sans-serif);font-size:15px;line-height:1.65}' +
    '.x-root *{box-sizing:border-box}' +
    '.x-root p{margin:0 0 8px}' +
    '.x-root h3{margin:0 0 4px;font-size:16px;font-weight:600;line-height:1.4;color:var(--text)}' +
    '.x-root h3 small{font-size:13px;font-weight:400;color:var(--text-2)}' +
    '.x-root .x-intro{color:var(--text-2);font-size:14px;margin-bottom:12px}' +
    '.x-box{background:var(--surface,#fff);border:1px solid var(--border);border-radius:var(--radius,10px);padding:12px}' +
    '.x-ctl{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-end}' +
    '.x-field{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--text-2);min-width:0}' +
    '.x-ctl>.x-field:first-child{flex:1 1 240px}' +
    '.x-wide{flex:1 1 100%}' +
    '.x-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '.x-in{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 8px;min-height:36px;min-width:0;width:100%}' +
    '.x-row .x-in{flex:1 1 180px;width:auto}' +
    '.x-k{accent-color:var(--c-os);width:140px;margin:6px 0}' +
    '.x-btn{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 12px;min-height:36px;cursor:pointer}' +
    '.x-btn:hover{background:var(--surface-2)}' +
    '.x-btn[aria-pressed=true],.x-pri{background:color-mix(in srgb,var(--c-os) 16%,var(--surface));border-color:var(--c-os)}' +
    '.x-pri{font-weight:600}' +
    '.x-btn[aria-disabled=true]{opacity:.45;cursor:default}' +
    '.x-push{margin-left:auto}' +
    '.x-root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}' +
    '.x-root .x-msg{margin:0;font-size:13px;color:var(--text-2)}' +
    '.x-root .x-msg:empty{display:none}' +
    '.x-root .x-err{color:var(--text);background:color-mix(in srgb,var(--div-pos) 16%,var(--surface));border-radius:6px;padding:4px 8px}' +
    '.x-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}' +
    '.x-status{flex:1 1 240px;font-size:14px}' +
    '.x-banner{margin-bottom:12px;border-left:4px solid var(--c-os)}' +
    '.x-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))}' +
    '.x-panel{min-width:0;border-top:3px solid var(--c-os)}' +
    '.x-root .x-rule{font-size:13px;color:var(--text-2)}' +
    '.x-scroll{overflow-x:auto;margin:0 0 8px}' +
    '.x-root .x-tbl{display:table;width:auto;margin:0;border-collapse:separate;border-spacing:0;font-family:var(--mono);font-size:13px;line-height:1.2}' +
    '.x-tbl th,.x-tbl td{border:0;border-right:1px solid var(--border);border-bottom:1px solid var(--border);min-width:25px;height:26px;padding:0 3px;text-align:center;font-weight:400;background:var(--surface);color:var(--text)}' +
    '.x-tbl tr:first-child>*{border-top:1px solid var(--border)}' +
    '.x-tbl tr>:first-child{position:sticky;left:0;z-index:1;border-left:1px solid var(--border);background:var(--surface-2);font-family:var(--font);font-size:12px;color:var(--text-2);text-align:left;padding:0 6px;white-space:nowrap}' +
    '.x-tbl thead th{background:var(--surface-2)}' +
    '.x-tbl .x-stp{font-size:11px;color:var(--text-3)}' +
    '.x-tbl .x-ref{font-weight:600}' +
    '.x-tbl .x-fut{color:var(--text-3);font-weight:400}' +
    '.x-tbl .x-cur{box-shadow:inset 2px 0 var(--c-os),inset -2px 0 var(--c-os)}' +
    '.x-tbl thead .x-cur{background:color-mix(in srgb,var(--c-os) 26%,var(--surface))}' +
    '.x-tbl .x-hc,.x-tbl .x-H{background:color-mix(in srgb,var(--good) 24%,var(--surface));font-weight:600}' +
    '.x-tbl .x-mc,.x-tbl .x-M,.x-tbl .x-up{background:color-mix(in srgb,var(--div-pos) 22%,var(--surface));font-weight:600}' +
    '.x-tbl sup{font-size:9px;color:var(--text-2);margin-left:1px}' +
    '.x-state{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;color:var(--text-2)}' +
    '.x-lab{flex:1 1 100%}' +
    '.x-chip{display:inline-flex;flex-direction:column;align-items:center;min-width:58px;padding:2px 6px;border:1px solid var(--border);border-radius:8px;background:var(--surface);line-height:1.35}' +
    '.x-chip b{font-family:var(--mono);font-size:16px;color:var(--text)}' +
    '.x-chip small{font-size:11px;color:var(--text-3)}' +
    '.x-chip em{font-style:normal;font-size:11px;font-weight:600;color:var(--text)}' +
    '.x-chip.x-pick{border:2px solid var(--text-2)}' +
    '.x-arr{color:var(--text-3)}' +
    '.x-root .x-say{margin:8px 0 6px;padding:8px 10px;background:var(--surface-2);border-radius:8px;font-size:14px}' +
    '.x-tag{display:inline-block;margin-right:6px;padding:0 6px;border:1px solid var(--border);border-radius:999px;background:var(--surface);font-size:12px;color:var(--text-2)}' +
    '.x-root .x-stat{margin:0;font-size:13px;color:var(--text-2)}' +
    '.x-stat b{color:var(--text)}' +
    '.x-sum{margin-top:12px}' +
    '.x-sum thead th{font-family:var(--font);font-size:12px;padding:0 6px;white-space:nowrap}' +
    '.x-root .x-note{font-size:13px;color:var(--text-2)}';

  var TPL =
    '<p class="x-how">怎么玩：选一个引用串（reference string，程序依次访问的页号）和帧数，按「下一步」每次访问一个页，看四种算法各自换出哪一页。表格里一列是一步，一行是一个帧；「结果」行的 H 表示命中（hit），M 表示缺页（miss）。</p>' +
    '<p class="x-intro">物理内存分成大小相同的页框（page frame，下文叫帧），一帧放一页。程序要访问的页不在内存里，就发生缺页（page fault），操作系统得从磁盘把它读进来；帧都占满时，还得先换出一页。换出哪一页由页面置换算法（page replacement algorithm）决定，选得好，以后缺页就少。</p>' +
    '<div class="x-box x-ctl">' +
    '<label class="x-field">引用串<select class="x-in x-preset" aria-label="选择引用串">' +
    '<option value="ostep">OSTEP 第 22 章：0,1,2,0,1,3,0,3,1,2,1</option>' +
    '<option value="belady">Belady 异常：1,2,3,4,1,2,5,1,2,3,4,5</option>' +
    '<option value="local">有局部性：1,2,3,2,1,2,4,1,2,1,4,1,5,1,4,1</option>' +
    '<option value="custom">自定义</option></select></label>' +
    '<label class="x-field"><span>帧数：<b class="x-kv">3</b></span><input class="x-k" type="range" min="1" max="6" step="1" value="3" aria-label="帧数（1 到 6）"></label>' +
    '<div class="x-field x-wide"><span>页号序列：0–99 的整数，用逗号或空格隔开，最多 30 个</span>' +
    '<div class="x-row"><input class="x-in x-refs" type="text" spellcheck="false" autocomplete="off" aria-label="引用串（页号序列）">' +
    '<button class="x-btn" type="button" data-act="apply" aria-label="应用这个引用串">应用</button></div></div>' +
    '<p class="x-msg x-wide" aria-live="polite"></p>' +
    '<div class="x-row x-wide" role="group" aria-label="选择要比较的算法"><span class="x-note">比较：</span>' +
    ALGS.map(function (a) {
      return '<button class="x-btn" type="button" data-alg="' + a + '" aria-pressed="true" aria-label="显示或隐藏 ' + INFO[a][0] + '">' + INFO[a][0] + '</button>';
    }).join('') +
    '<button class="x-btn x-push" type="button" data-act="belady" aria-label="演示 Belady 异常：FIFO 3 帧对比 4 帧">演示 Belady 异常</button></div>' +
    '</div>' +
    '<div class="x-bar">' +
    '<button class="x-btn" type="button" data-act="reset" aria-label="重置到开始">重置</button>' +
    '<button class="x-btn" type="button" data-act="prev" aria-label="上一步">上一步</button>' +
    '<button class="x-btn x-pri" type="button" data-act="next" aria-label="下一步">下一步</button>' +
    '<button class="x-btn" type="button" data-act="play" aria-pressed="false" aria-label="自动播放">自动播放</button>' +
    '<span class="x-status" aria-live="polite"></span></div>' +
    '<div class="x-ban"></div><div class="x-grid"></div>' +
    '<section class="x-box x-sum" aria-label="不同帧数下的缺页次数"></section>';

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
    function $(sel) { return root.querySelector(X(sel)); }
    var el = {
      preset: $('.x-preset'), k: $('.x-k'), kv: $('.x-kv'), refs: $('.x-refs'), msg: $('.x-msg'), status: $('.x-status'),
      ban: $('.x-ban'), grid: $('.x-grid'), sum: $('.x-sum'), prev: $('[data-act=prev]'), next: $('[data-act=next]'), play: $('[data-act=play]')
    };
    var S = { refs: PRESETS.ostep.refs.slice(), k: 3, s: 0, show: { fifo: 1, lru: 1, opt: 1, clock: 1 }, belady: false, timer: null };
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduce) { el.play.setAttribute('aria-disabled', 'true'); el.play.title = '系统开启了「减少动态效果」，自动播放已关闭'; }

    function setMsg(txt, err) { el.msg.textContent = txt; el.msg.className = X('x-msg x-wide' + (err ? ' x-err' : '')); }
    // note 是当前引用串的说明；临时提示（警告、Belady 模式）结束后恢复成它
    var note = '', sumKey = '';
    function setNote(txt) { note = txt; setMsg(txt); }
    function stop() {
      if (S.timer) { clearInterval(S.timer); S.timer = null; }
      el.play.setAttribute('aria-pressed', 'false'); el.play.textContent = '自动播放'; el.play.setAttribute('aria-label', '自动播放');
    }
    function go(s) { S.s = Math.max(0, Math.min(S.refs.length, s)); render(); }
    function loadPreset(id) {
      var pr = PRESETS[id];
      S.refs = pr.refs.slice(); S.k = 3; el.k.value = 3; el.refs.value = pr.refs.join(',');
      el.preset.value = id; S.belady = false; S.s = 0; setNote(pr.note);
    }
    function apply() {
      var r = parse(el.refs.value);
      if (r.err) { setMsg(r.err, true); return; }
      stop(); S.refs = r.refs; S.belady = false; S.s = 0;
      var match = 'custom';
      for (var id in PRESETS) if (PRESETS[id].refs.join() === r.refs.join()) match = id;
      el.preset.value = match; el.refs.value = r.refs.join(',');
      setNote(match === 'custom' ? '已换成自定义引用串，共 ' + r.refs.length + ' 次访问。' : PRESETS[match].note);
      render();
    }
    function play() {
      if (reduce) { setMsg('系统开启了「减少动态效果」，自动播放已关闭，请用「下一步」。'); return; }
      if (S.timer) { stop(); return; }
      if (S.s >= S.refs.length) S.s = 0;
      el.play.setAttribute('aria-pressed', 'true'); el.play.textContent = '暂停'; el.play.setAttribute('aria-label', '暂停自动播放');
      S.timer = setInterval(function () { go(S.s + 1); if (S.s >= S.refs.length) stop(); }, 1100);
      render();
    }
    // 表格横向放不下时，让当前这一列保持在可视范围里
    function follow(box) {
      var c = box.querySelector('.' + P + 'ref.' + P + 'cur'), rh = box.querySelector('th');
      if (!c) { box.scrollLeft = 0; return; }
      var l = c.offsetLeft - rh.offsetWidth, r = c.offsetLeft + c.offsetWidth;
      if (l < box.scrollLeft) box.scrollLeft = Math.max(0, l - 8);
      else if (r > box.scrollLeft + box.clientWidth) box.scrollLeft = r - box.clientWidth + 8;
    }
    function render() {
      var n = S.refs.length, s = S.s, keep = {}, sel = '.' + P + 'scroll[data-key]', ae = document.activeElement,
        fk = ae && ae.matches && root.contains(ae) && ae.matches(sel) ? ae.getAttribute('data-key') : null,
        sk = S.refs.join() + '|' + (S.belady ? '3,4' : S.k);
      el.kv.textContent = S.k;
      el.status.textContent = s === 0 ? '第 0 / ' + n + ' 步：还没开始，按「下一步」访问第 1 个页（页 ' + S.refs[0] + '）。' :
        '第 ' + s + ' / ' + n + ' 步：访问页 ' + S.refs[s - 1] + (s === n ? '。引用串已经走完。' : '。');
      el.prev.setAttribute('aria-disabled', s === 0 ? 'true' : 'false');
      el.next.setAttribute('aria-disabled', s === n ? 'true' : 'false');
      ALGS.forEach(function (a) { root.querySelector('[data-alg=' + a + ']').setAttribute('aria-disabled', S.belady ? 'true' : 'false'); });
      var panels = S.belady ? [['fifo', 3], ['fifo', 4]] :
        ALGS.filter(function (a) { return S.show[a]; }).map(function (a) { return [a, S.k]; });
      root.querySelectorAll(sel).forEach(function (b) { keep[b.getAttribute('data-key')] = b.scrollLeft; });
      // 横幅和汇总表不随步数变化，只在内容变了时重建，免得按方向键时焦点所在的按钮被替换掉
      if (S.belady !== !!el.ban.firstChild) el.ban.innerHTML = S.belady ? X(bannerHTML()) : '';
      el.grid.innerHTML = X(panels.map(function (pk) { return panelHTML(pk[0], pk[1], S.refs, s, S.belady); }).join(''));
      if (sk !== sumKey) { sumKey = sk; el.sum.innerHTML = X(sumHTML(S.refs, S.belady ? [3, 4] : [S.k])); }
      root.querySelectorAll(sel).forEach(function (b) {
        var key = b.getAttribute('data-key');
        if (key in keep) b.scrollLeft = keep[key];
        follow(b);
        if (key === fk) b.focus({ preventScroll: true });   // 自动播放时键盘焦点留在原来那张表上
      });
    }

    function onClick(e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || !root.contains(b)) return;
      var act = b.getAttribute('data-act'), alg = b.getAttribute('data-alg'), n = S.refs.length;
      if (alg) {
        if (S.belady) { setMsg('现在是 Belady 异常演示，先点「回到四种算法对比」再选算法。'); return; }
        var on = ALGS.filter(function (a) { return S.show[a]; }).length;
        if (S.show[alg] && on === 1) { setMsg('至少要留一种算法。'); return; }
        S.show[alg] = S.show[alg] ? 0 : 1;
        b.setAttribute('aria-pressed', S.show[alg] ? 'true' : 'false');
        setMsg(note); render(); return;
      }
      if (act === 'next') { if (S.s < n) go(S.s + 1); }
      else if (act === 'prev') { stop(); go(S.s - 1); }
      else if (act === 'reset') { stop(); go(0); }
      else if (act === 'play') play();
      else if (act === 'apply') apply();
      else if (act === 'belady') {
        stop(); loadPreset('belady'); setMsg('');
        S.belady = true; S.s = S.refs.length; render();
      } else if (act === 'exit') {
        S.belady = false; setMsg(note); render();
        root.querySelector('[data-act=belady]').focus();
      }
    }
    function onChange(e) {
      if (e.target !== el.preset) return;
      stop();
      if (el.preset.value === 'custom') { setMsg('在下面的输入框里改页号，按回车或「应用」。'); el.refs.focus(); return; }
      loadPreset(el.preset.value); render();
    }
    function onInput(e) {
      if (e.target !== el.k) return;
      S.k = +el.k.value;
      if (S.belady) { S.belady = false; setMsg(note); }
      render();
    }
    function onKey(e) {
      var tg = e.target, name = tg.tagName;
      if (tg === el.refs && e.key === 'Enter') { e.preventDefault(); apply(); return; }
      if (name === 'INPUT' || name === 'SELECT' || name === 'TEXTAREA' || (tg.classList && tg.classList.contains(P + 'scroll'))) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); if (S.s < S.refs.length) go(S.s + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); go(S.s - 1); }
    }
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    root.addEventListener('keydown', onKey);

    loadPreset('ostep');
    render();

    return {
      destroy: function () {
        stop();
        root.removeEventListener('click', onClick);
        root.removeEventListener('change', onChange);
        root.removeEventListener('input', onInput);
        root.removeEventListener('keydown', onKey);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  /* ---------- 自测：用例都已手算核对 ---------- */
  function selfTest() {
    var details = [], ok = true;
    function chk(name, got, exp) {
      var pass = JSON.stringify(got) === JSON.stringify(exp);
      ok = ok && pass;
      details.push((pass ? '通过：' : '失败：') + name + '，期望 ' + JSON.stringify(exp) + '，得到 ' + JSON.stringify(got));
    }
    function m(a, r, k) { return missCount(simulate(a, r, k), r.length); }
    function trace(a, r, k) { return simulate(a, r, k).map(function (s) { return s.hit ? 'H' : s.ev === null ? 'M' : 'M' + s.ev; }).join(' '); }
    var O = PRESETS.ostep.refs, B = PRESETS.belady.refs, L = PRESETS.local.refs;
    var SG = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1], C2 = [1, 2, 3, 1, 4, 2, 5, 2];
    chk('Belady 串，FIFO 3 帧缺页次数', m('fifo', B, 3), 9);
    chk('Belady 串，FIFO 4 帧缺页次数', m('fifo', B, 4), 10);
    chk('OSTEP 串 3 帧，OPT 命中次数', O.length - m('opt', O, 3), 6);
    chk('OSTEP 串 3 帧，LRU 命中次数', O.length - m('lru', O, 3), 6);
    chk('OSTEP 串 3 帧，FIFO 命中次数', O.length - m('fifo', O, 3), 4);
    chk('OSTEP 串 3 帧，FIFO 逐步（M 后面是换出的页）', trace('fifo', O, 3), 'M M M H H M0 M1 H M2 M3 H');
    chk('OSTEP 串 3 帧，LRU 逐步', trace('lru', O, 3), 'M M M H H M2 H H H M0 H');
    chk('OSTEP 串 3 帧，OPT 逐步（第 10 步 0、3 都不再访问，换先装入的 0）', trace('opt', O, 3), 'M M M H H M2 H H H M0 H');
    chk('Silberschatz 教材串 3 帧，FIFO / OPT / LRU 缺页', [m('fifo', SG, 3), m('opt', SG, 3), m('lru', SG, 3)], [15, 9, 12]);
    chk('Belady 串 LRU 3 帧 / 4 帧缺页', [m('lru', B, 3), m('lru', B, 4)], [10, 8]);
    chk('Belady 串 OPT 3 帧缺页', m('opt', B, 3), 7);
    chk('OSTEP 串 3 帧，Clock 命中次数', O.length - m('clock', O, 3), 4);
    chk('Belady 串 Clock 3 帧 / 4 帧缺页', [m('clock', B, 3), m('clock', B, 4)], [9, 10]);
    var c = simulate('clock', C2, 3), e = c[c.length - 1];
    chk('第二次机会：1,2,3,1,4,2,5,2 用 3 帧，Clock / FIFO 缺页', [missCount(c, C2.length), m('fifo', C2, 3)], [5, 6]);
    chk('第二次机会：第 7 步 Clock 清掉页 2 的使用位，换出 3', [c[6].scan, c[6].ev], [[1], 3]);
    chk('第二次机会：结束时各帧、使用位、指针', [e.fr, e.ub, e.h], [[4, 2, 5], [1, 1, 1], 0]);
    chk('局部性串 3 帧，FIFO / LRU / OPT / Clock 缺页', ALGS.map(function (a) { return m(a, L, 3); }), [9, 5, 5, 8]);
    var mono = true;
    [O, B, L, SG].forEach(function (r) {
      ['lru', 'opt'].forEach(function (a) { for (var k = 1; k < 6; k++) if (m(a, r, k + 1) > m(a, r, k)) mono = false; });
    });
    chk('LRU、OPT 加一帧缺页不增加（栈算法）', mono, true);
    chk('解析「0, 1，2 3、4」', parse('0, 1，2 3、4').refs, [0, 1, 2, 3, 4]);
    chk('非法输入给出错误提示', [!!parse('1,a').err, !!parse('').err, !!parse('100').err], [true, true, true]);
    return { ok: ok, details: details };
  }

  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = {
    title: '页面置换：FIFO、LRU、OPT 和 Clock',
    mount: mount,
    selfTest: selfTest
  };
})();
