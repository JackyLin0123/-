/* Pure reservation model plus DOM shell; ordinary offline script. */
(function () {
  'use strict';
  var ID = 'eng-contract-test-lab';
  var MODES = ['list', 'tree', 'closed', 'leaky'];
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function values(state) { return state.mode === 'tree' ? Object.keys(state.slots).map(function (key) { return state.slots[key]; }) : state.slots; }
  function snapshot(state) {
    return copy(values(state)).sort(function (a, b) { return a.resource < b.resource ? -1 : a.resource > b.resource ? 1 : a.start - b.start || a.end - b.end || a.id - b.id; });
  }
  function initial(mode) {
    if (MODES.indexOf(mode) < 0) throw new Error('未知实现。');
    return { mode: mode, slots: mode === 'tree' ? {} : [], nextId: 1 };
  }
  function reserve(state, resource, start, end) {
    if (typeof resource !== 'string' || !/^[A-Za-z0-9_-]+$/.test(resource) || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= end || end > 2147483647) return 'IllegalArgumentException';
    if (state.nextId > 2147483647) return 'IllegalStateException';
    var conflict = values(state).some(function (slot) {
      if (slot.resource !== resource) return false;
      return state.mode === 'closed' ? start <= slot.end && slot.start <= end : start < slot.end && slot.start < end;
    });
    if (conflict) return 'ConflictException';
    var id = state.nextId++, slot = { id: id, resource: resource, start: start, end: end };
    if (state.mode === 'tree') state.slots[id] = slot; else state.slots.push(slot);
    return 'OK ' + id;
  }
  function execute(state, operation) {
    if (operation.kind === 'reserve') return reserve(state, operation.resource, operation.start, operation.end);
    if (operation.kind === 'clear-returned') {
      var returned = state.mode === 'leaky' ? state.slots : snapshot(state);
      returned.length = 0;
      return '返回列表已清空';
    }
    if (operation.kind === 'query') return JSON.stringify(snapshot(state));
    throw new Error('未支持的操作。');
  }
  var PRESETS = {
    touch: { title: '端点相接 A:[20,30)', resource: 'A', start: 20, end: 30 },
    overlap: { title: '发生重叠 A:[19,21)', resource: 'A', start: 19, end: 21 },
    empty: { title: '空区间 A:[5,5)', resource: 'A', start: 5, end: 5 },
    reverse: { title: '反向区间 A:[8,2)', resource: 'A', start: 8, end: 2 },
    other: { title: '不同资源 B:[19,21)', resource: 'B', start: 19, end: 21 },
    left: { title: '迁移输入 A:[1,10)', resource: 'A', start: 1, end: 10 }
  };
  function trace(mode, suite, preset) {
    if (!PRESETS[preset] || ['happy', 'full'].indexOf(suite) < 0) throw new Error('未知测试集或输入。');
    var actual = initial(mode), reference = initial('list'), frames = [];
    var operations = [{ kind: 'reserve', resource: 'A', start: 10, end: 20, name: '空库成功路径' }];
    if (suite === 'full') {
      var selected = PRESETS[preset];
      operations.push({ kind: 'reserve', resource: selected.resource, start: selected.start, end: selected.end, name: selected.title });
      operations.push({ kind: 'reserve', resource: 'B', start: 40, end: 50, name: '后续成功与 ID：失败不消耗 ID' });
      operations.push({ kind: 'clear-returned', name: '表示攻击：清空取得的返回列表' });
      operations.push({ kind: 'query', name: '重新查询，内部必须保留预约' });
    }
    operations.forEach(function (operation) {
      var before = snapshot(actual), expected = execute(reference, operation), got = execute(actual, operation);
      var after = snapshot(actual), expectedState = snapshot(reference);
      frames.push({ name: operation.name, operation: copy(operation), before: before, expected: expected, actual: got,
        after: after, expectedState: expectedState, passed: expected === got && JSON.stringify(after) === JSON.stringify(expectedState),
        reason: operation.kind === 'clear-returned' ? '比较调用后内部状态；只断言 clear 没抛异常抓不到泄漏。'
          : operation.kind === 'query' ? '排序、条目与快照均按同一契约判定。'
          : '同资源冲突当且仅当 start < old.end 且 old.start < end；拒绝不写入，不消耗 ID。' });
    });
    return frames;
  }
  function selfTest() {
    var checks = [];
    function check(name, pass) { checks.push({ name: name, ok: !!pass }); }
    ['list', 'tree'].forEach(function (mode) { Object.keys(PRESETS).forEach(function (preset) {
      check(mode + ' ' + preset + ' 完整契约', trace(mode, 'full', preset).every(function (f) { return f.passed; }));
    }); });
    check('错误实现能通过不充分成功样例', ['closed', 'leaky'].every(function (mode) { return trace(mode, 'happy', 'touch').every(function (f) { return f.passed; }); }));
    check('相接用例杀死闭区间错误', !trace('closed', 'full', 'touch')[1].passed);
    check('清空返回列表杀死泄漏错误', !trace('leaky', 'full', 'touch')[3].passed);
    check('不同资源不冲突', trace('closed', 'full', 'other')[1].passed);
    var s = initial('list');
    check('负数拒绝', reserve(s, 'A', -1, 2) === 'IllegalArgumentException');
    check('空资源拒绝', reserve(s, '', 1, 2) === 'IllegalArgumentException');
    check('小数拒绝', reserve(s, 'A', 1.2, 3) === 'IllegalArgumentException');
    check('int 溢出拒绝', reserve(s, 'A', 1, 2147483648) === 'IllegalArgumentException');
    return { ok: checks.every(function (c) { return c.ok; }), details: checks };
  }
  function mount(container) {
    function el(tag, text) { var element = document.createElement(tag); if (text != null) element.textContent = text; return element; }
    var root = el('div'); root.className = 'eng-contract-lab'; container.appendChild(root);
    var style = el('style', '.eng-contract-lab label{display:inline-flex;flex-direction:column;gap:.35rem;margin:0 .75rem .75rem 0;max-width:100%}.eng-contract-lab select{max-width:100%;padding:.4rem;color:var(--text);background:var(--surface);border:1px solid var(--border)}.eng-contract-lab button{margin:.25rem;padding:.45rem .7rem}.eng-contract-lab .eng-scroll{overflow-x:auto;max-width:100%}.eng-contract-lab table{border-collapse:collapse;width:100%}.eng-contract-lab th,.eng-contract-lab td{padding:.5rem;border:1px solid var(--border);text-align:left;vertical-align:top;min-width:7rem}.eng-contract-lab pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--surface-2);padding:.7rem}.eng-contract-lab .eng-fail{font-weight:bold;color:var(--text)}'); root.appendChild(style);
    root.appendChild(el('p', '玩法：先用“仅成功样例”预测哪些实现会通过，再切到“边界与封装”，逐步比较同一规格要求的结果和实际状态。资源使用非负整数半开区间；这里是单线程教学模型。'));
    var controls = el('div'); root.appendChild(controls);
    function select(label, choices) { var wrap = el('label', label), field = el('select'); field.setAttribute('aria-label', label); choices.forEach(function (choice) { var option = el('option', choice[1]); option.value = choice[0]; field.appendChild(option); }); wrap.appendChild(field); controls.appendChild(wrap); return field; }
    var mode = select('实现', [['list', '正确：列表 + 防御性复制'], ['tree', '合法替代：按 ID 存储的映射 + 同一输出'], ['closed', '错误：把 < 写成 <='], ['leaky', '错误：泄漏内部列表']]);
    var suite = select('测试集合', [['happy', '仅成功样例（不充分）'], ['full', '边界与封装（有针对性断言）']]);
    var input = select('第二次预约输入', Object.keys(PRESETS).map(function (k) { return [k, PRESETS[k].title]; }));
    var bar = el('div'), buttons = {};
    [['reset', '重置'], ['prev', '上一步'], ['next', '下一步']].forEach(function (a) { var b = el('button', a[1]); b.type = 'button'; b.className = 'btn'; buttons[a[0]] = b; bar.appendChild(b); }); root.appendChild(bar);
    var status = el('p'); status.setAttribute('role', 'status'); root.appendChild(status);
    var output = el('div'); root.appendChild(output);
    var prediction = el('textarea'); prediction.placeholder = '记录预测：哪个断言会失败？只通过成功样例能说明什么？'; prediction.setAttribute('aria-label', '契约测试预测与迁移解释'); prediction.style.width = '100%'; root.appendChild(prediction);
    var frames = [], index = 0;
    function fmt(slots) { return slots.length ? slots.map(function (s) { return '#' + s.id + ' ' + s.resource + ':[' + s.start + ',' + s.end + ')'; }).join('; ') : '空集合'; }
    function draw() {
      output.replaceChildren(); status.textContent = '第 ' + index + ' / ' + frames.length + ' 步。' + (index === 0 ? '当前为空库；按下一步执行断言。' : '本次已执行 ' + index + ' 个断言，失败 ' + frames.slice(0, index).filter(function (f) { return !f.passed; }).length + ' 个。');
      buttons.prev.disabled = index === 0; buttons.next.disabled = index === frames.length;
      if (!index) return;
      var frame = frames[index - 1]; output.appendChild(el('h3', frame.name));
      var scroll = el('div'); scroll.className = 'eng-scroll'; scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', '契约预期与实际对照，可横向滚动');
      var table = el('table'); table.appendChild(el('caption', '每步重新从规格对照返回行为与状态'));
      [['观察项', '规格预期', '所选实现实际'], ['结果/异常', frame.expected, frame.actual], ['调用后内部集合', fmt(frame.expectedState), fmt(frame.after)]].forEach(function (row, i) { var tr = el('tr'); row.forEach(function (text) { var cell = el(i ? 'td' : 'th', text); if (!i) cell.scope = 'col'; tr.appendChild(cell); }); table.appendChild(tr); }); scroll.appendChild(table); output.appendChild(scroll);
      output.appendChild(el('p', '调用前内部集合：' + fmt(frame.before)));
      var verdict = el('p', (frame.passed ? '通过：' : '失败：') + frame.reason); if (!frame.passed) verdict.className = 'eng-fail'; output.appendChild(verdict);
      output.appendChild(el('pre', frames.slice(0, index).map(function (f, i) { return (i + 1) + '. ' + (f.passed ? '通过 ' : '失败 ') + f.name; }).join('\n')));
      if (index === frames.length) output.appendChild(el('p', suite.value === 'happy' ? '错误实现也可能通过这个测试集。切换“边界与封装”检查未覆盖的规则。' : '有限用例通过不等于全输入证明。换一个未见输入并解释判断依据；正确列表和映射的存储结构可以不同。'));
    }
    function rebuild() { frames = trace(mode.value, suite.value, input.value); index = 0; draw(); }
    mode.onchange = suite.onchange = input.onchange = rebuild;
    buttons.reset.onclick = function () { index = 0; prediction.value = ''; draw(); };
    buttons.prev.onclick = function () { index = Math.max(0, index - 1); draw(); };
    buttons.next.onclick = function () { index = Math.min(frames.length, index + 1); draw(); };
    rebuild();
    return { destroy: function () { mode.onchange = suite.onchange = input.onchange = null; Object.keys(buttons).forEach(function (k) { buttons[k].onclick = null; }); root.remove(); } };
  }
  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = { title: '同一预约契约：测试怎样区分错误实现', mount: mount, selfTest: selfTest, trace: trace, initial: initial, reserve: reserve, snapshot: snapshot };
  window.KGDemosAPI = window.KGDemosAPI || {};
  window.KGDemosAPI[ID] = { trace: trace, initial: initial, reserve: reserve, snapshot: snapshot };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.KGDemos[ID];
})();
