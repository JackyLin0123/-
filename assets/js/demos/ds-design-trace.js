/* Offline DP laboratory. Pure models are also exported for independent checks. */
(function (global) {
  'use strict';
  function copy(a) { return a.map(function (r) { return r.slice(); }); }
  function matrix(n, m) { var a = []; for (var i = 0; i < n; i++) a.push(new Array(m).fill(0)); return a; }
  function knapsackTrace(weights, values, capacity, wrongDirection) {
    if (!Array.isArray(weights) || weights.length !== values.length || weights.length > 8 ||
        !Number.isInteger(capacity) || capacity < 0 || capacity > 20 ||
        weights.some(function (w) { return !Number.isInteger(w) || w <= 0; }) ||
        values.some(function (v) { return !Number.isInteger(v) || v < 0 || v > 1000; })) throw new Error('最多 8 件，重量为正整数，价值 0..1000，容量 0..20。');
    var table = matrix(weights.length + 1, capacity + 1), dp = new Array(capacity + 1).fill(0), steps = [];
    function record(kind, i, c, text, read) { steps.push({ kind: kind, row: i, col: c, table: copy(table), compressed: dp.slice(), read: read || [], text: text }); }
    record('init', 0, 0, 'F[i][c]：只用前 i 件、容量不超过 c 的最优值。空物品一行全为 0。');
    for (var i = 1; i <= weights.length; i++) {
      var w = weights[i - 1], v = values[i - 1];
      for (var c = 0; c <= capacity; c++) {
        table[i][c] = table[i - 1][c];
        var read = [[i - 1, c]];
        if (c >= w) { table[i][c] = Math.max(table[i][c], table[i - 1][c - w] + v); read.push([i - 1, c - w]); }
        record('cell', i, c, '二维格 F[' + i + '][' + c + '] = ' + table[i][c] + '；只读上一物品层，物品 ' + i + ' 不会重复。', read);
      }
      var start = wrongDirection ? w : capacity, end = wrongDirection ? capacity : w, d = wrongDirection ? 1 : -1;
      for (var x = start; wrongDirection ? x <= end : x >= end; x += d) {
        var before = dp[x], source = dp[x - w];
        dp[x] = Math.max(before, source + v);
        record('compressed', i, x, (wrongDirection ? '错误正序' : '正确倒序') + '：dp[' + x + '] = max(' + before + ', ' + source + ' + ' + v + ') = ' + dp[x] +
          '。读取 dp[' + (x - w) + ']：' + (wrongDirection && x - w >= w ? '它已被本轮更新，可能重用第 ' + i + ' 件。' : '这里仍是上一层数值。'));
      }
    }
    var items = [], cap = capacity;
    if (!wrongDirection) {
      for (var row = weights.length; row > 0; row--) {
        if (table[row][cap] !== table[row - 1][cap]) {
          items.push(row - 1); record('backtrack', row, cap, '恢复：本格优于不选，选择物品 ' + row + '，容量从 ' + cap + ' 减去 ' + weights[row - 1] + '。'); cap -= weights[row - 1];
        } else record('backtrack', row, cap, '恢复：与上一层相同，可不选物品 ' + row + '。');
      }
      items.reverse();
    }
    record('done', weights.length, capacity, '二维合法最优值 ' + table[weights.length][capacity] + '；压缩值 ' + dp[capacity] +
      (wrongDirection ? '。正序结果不保证满足每件至多一次，不从此错误表伪造恢复方案。' : '；所选下标（从 0 起）：[' + items.join(',') + ']。'));
    return { steps: steps, table: table, value: table[weights.length][capacity], compressedValue: dp[capacity], items: items, wrongDirection: !!wrongDirection };
  }
  function lcsTrace(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length > 8 || b.length > 8 || !/^[A-Za-z]*$/.test(a + b)) throw new Error('演示接受长度 0..8 的 ASCII 字母串。');
    var table = matrix(a.length + 1, b.length + 1), steps = [], out = [];
    function record(kind, i, j, text, read) { steps.push({ kind: kind, row: i, col: j, table: copy(table), read: read || [], text: text, recovered: out.slice().reverse().join('') }); }
    record('init', 0, 0, 'L[i][j]：两个前缀的 LCS 长度。空前缀行列为 0。');
    for (var i = 1; i <= a.length; i++) for (var j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
        record('cell', i, j, a[i - 1] + ' 相等，读左上格 +1，得到 ' + table[i][j] + '。', [[i - 1, j - 1]]);
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
        record('cell', i, j, a[i - 1] + ' 与 ' + b[j - 1] + ' 不同，取上/左较大值 ' + table[i][j] + '。', [[i - 1, j], [i, j - 1]]);
      }
    }
    var x = a.length, y = b.length;
    while (x > 0 && y > 0) {
      if (a[x - 1] === b[y - 1]) { out.push(a[x - 1]); record('backtrack', x, y, '末字符相等，记录 ' + a[x - 1] + ' 并向左上走。'); x--; y--; }
      else if (table[x - 1][y] >= table[x][y - 1]) { record('backtrack', x, y, '走向上格；平局固定向上，另一平局分支也可能产生合法最优序列。'); x--; }
      else { record('backtrack', x, y, '走向左格，其最优值更大。'); y--; }
    }
    record('done', x, y, 'LCS 长度 ' + table[a.length][b.length] + '，恢复为 ' + (out.slice().reverse().join('') || '空串') + '。验收检查长度及在两个输入中的顺序，不限定唯一字符串。');
    return { table: table, value: table[a.length][b.length], sequence: out.reverse().join(''), steps: steps };
  }
  function escape(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mount(container) {
    var root = document.createElement('div'); root.className = 'ds-design-trace';
    root.innerHTML = '<style>.ds-design-trace{line-height:1.6}.ds-design-trace [hidden]{display:none!important}.ds-design-trace .controls{display:flex;gap:.6rem;flex-wrap:wrap;margin:.7rem 0}.ds-design-trace label{display:flex;gap:.4rem;align-items:center}.ds-design-trace input{width:7rem;max-width:100%}.ds-design-trace .scroll{overflow-x:auto;max-width:100%}.ds-design-trace table{border-collapse:collapse;width:100%;margin:.5rem 0}.ds-design-trace th,.ds-design-trace td{border:1px solid var(--border,#888);padding:.35rem;text-align:center;min-width:2.4rem}.ds-design-trace .active{outline:3px solid #b97700;outline-offset:-3px}.ds-design-trace .source{background:rgba(40,120,200,.22)}.ds-design-trace button,.ds-design-trace select,.ds-design-trace input{font:inherit;padding:.25rem}.ds-design-trace .status{min-height:4em;overflow-wrap:anywhere}</style>' +
      '<p>逐格核对状态依赖，再回溯恢复方案。蓝底是本步读取格，边框是写入或回溯格；点号是尚未计算的格。修改串后点“应用输入”重新运行。</p>' +
      '<div class="controls"><label>模式 <select data-mode aria-label="DP 模式"><option value="knapsack">0/1 背包：倒序</option><option value="wrong">背包：错误正序对照</option><option value="lcs">最长公共子序列</option></select></label><label data-cap-label>容量 <select data-cap aria-label="背包容量"><option>4</option><option>5</option><option>0</option></select></label><label data-string-label>串 A <input data-a value="ABCD" maxlength="8" aria-label="序列 A"></label><label data-string-label>串 B <input data-b value="ACBD" maxlength="8" aria-label="序列 B"></label><button type="button" data-apply>应用输入</button></div>' +
      '<p data-input></p><div class="controls"><button type="button" data-prev>上一步</button><button type="button" data-next>单步</button><button type="button" data-play>自动播放</button><button type="button" data-reset>重置</button><span data-count></span></div><p class="status" data-status aria-live="polite"></p><div class="scroll" data-table></div><p data-compressed></p>';
    container.appendChild(root);
    var mode = root.querySelector('[data-mode]'), cap = root.querySelector('[data-cap]'), a = root.querySelector('[data-a]'), b = root.querySelector('[data-b]');
    var result, position = 0, timer = null, committedA = '', committedB = '';
    var reducedMotion = false;
    try { reducedMotion = global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (ignore) { reducedMotion = false; }
    function stop() { if (timer !== null) { clearInterval(timer); timer = null; } }
    function render() {
      var step = result.steps[position], html = '<table aria-label="动态规划状态表"><thead><tr><th>前缀/容量</th>';
      for (var j = 0; j < step.table[0].length; j++) html += '<th scope="col">' + (mode.value === 'lcs' ? escape(committedB.slice(0, j) || '空') : j) + '</th>';
      html += '</tr></thead><tbody>';
      step.table.forEach(function (row, i) {
        html += '<tr><th scope="row">' + (mode.value === 'lcs' ? escape(committedA.slice(0, i) || '空') : i) + '</th>';
        row.forEach(function (v, j) {
          var read = step.read.some(function (p) { return p[0] === i && p[1] === j; });
          var finished = step.kind === 'done' || step.kind === 'backtrack' || i === 0 || (mode.value === 'lcs' && j === 0) || i < step.row || (i === step.row && (step.kind === 'compressed' || j <= step.col));
          html += '<td class="' + (read ? 'source ' : '') + (step.row === i && step.col === j ? 'active' : '') + '">' + (finished ? v : '·') + '</td>';
        }); html += '</tr>';
      });
      root.querySelector('[data-table]').innerHTML = html + '</tbody></table>';
      root.querySelector('[data-status]').textContent = step.text;
      root.querySelector('[data-count]').textContent = (position + 1) + ' / ' + result.steps.length;
      root.querySelector('[data-compressed]').textContent = step.compressed ? '一维数组（当前已执行层）：[' + step.compressed.join(', ') + ']' : '当前恢复：' + (step.recovered || '空串');
      root.querySelector('[data-prev]').disabled = position === 0;
      root.querySelector('[data-next]').disabled = position === result.steps.length - 1;
      root.querySelector('[data-play]').textContent = timer === null ? '自动播放' : '暂停';
      root.querySelector('[data-play]').disabled = reducedMotion;
    }
    function build() {
      stop(); position = 0;
      root.querySelector('[data-cap-label]').hidden = mode.value === 'lcs';
      root.querySelectorAll('[data-string-label]').forEach(function (el) { el.hidden = mode.value !== 'lcs'; });
      try {
        result = mode.value === 'lcs' ? lcsTrace(a.value, b.value) : knapsackTrace([2, 3, 4], [4, 5, 7], +cap.value, mode.value === 'wrong');
        committedA = a.value; committedB = b.value;
        root.querySelector('[data-input]').textContent = mode.value === 'lcs' ? '输入：A=' + (a.value || '空串') + '，B=' + (b.value || '空串') : '固定物品：重量 [2,3,4]，价值 [4,5,7]；每件最多一次。二维表始终遵循合法 0/1 规格，一维表按所选方向执行。';
        render();
      } catch (e) {
        root.querySelector('[data-status]').textContent = e.message; result = null;
        root.querySelector('[data-table]').textContent = ''; root.querySelector('[data-compressed]').textContent = '';
        root.querySelector('[data-count]').textContent = '';
        ['prev', 'next', 'play'].forEach(function (name) { root.querySelector('[data-' + name + ']').disabled = true; });
        root.querySelector('[data-play]').textContent = '自动播放';
      }
    }
    function click(e) {
      var t = e.target;
      if (t.hasAttribute('data-apply')) { build(); return; }
      if (!result) return;
      if (t.hasAttribute('data-play')) {
        if (timer !== null) stop(); else {
          if (position === result.steps.length - 1) position = 0;
          timer = setInterval(function () { if (position < result.steps.length - 1) position++; if (position === result.steps.length - 1) stop(); render(); }, 850);
        } render(); return;
      }
      if (t.hasAttribute('data-next') || t.hasAttribute('data-prev') || t.hasAttribute('data-reset')) {
        stop(); if (t.hasAttribute('data-reset')) position = 0;
        else position = Math.max(0, Math.min(result.steps.length - 1, position + (t.hasAttribute('data-next') ? 1 : -1)));
        render();
      }
    }
    function changed(e) { if (e.target === mode || e.target === cap) build(); else { stop(); if (result) render(); } }
    root.addEventListener('click', click); root.addEventListener('change', changed); build();
    return { destroy: function () { stop(); root.removeEventListener('click', click); root.removeEventListener('change', changed); root.remove(); } };
  }
  var models = { knapsackTrace: knapsackTrace, lcsTrace: lcsTrace };
  global.KGDSDesignTrace = models;
  global.KGDemos = global.KGDemos || {};
  global.KGDemos['ds-design-trace'] = { title: '背包与 LCS：依赖和方案恢复', mount: mount, models: models };
  if (typeof module !== 'undefined' && module.exports) module.exports = models;
})(typeof window !== 'undefined' ? window : globalThis);
