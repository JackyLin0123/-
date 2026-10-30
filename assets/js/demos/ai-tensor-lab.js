(function () {
  'use strict';
  var ID = 'ai-tensor-lab';
  function matrix(rows, cols, start) {
    return Array.from({length: rows}, function (_, i) {
      return Array.from({length: cols}, function (_, j) { return start + i * cols + j; });
    });
  }
  function transpose(a) { return a[0].map(function (_, j) { return a.map(function (r) { return r[j]; }); }); }
  function broadcast(a, b) {
    var rows = Math.max(a.length, b.length), cols = Math.max(a[0].length, b[0].length);
    if ([a, b].some(function (x) { return (x.length !== rows && x.length !== 1) || (x[0].length !== cols && x[0].length !== 1); })) throw new Error('广播失败：从末轴对齐后，长度必须相同或其中一个为 1。');
    return Array.from({length: rows}, function (_, i) { return Array.from({length: cols}, function (_, j) { return a[i % a.length][j % a[0].length] + b[i % b.length][j % b[0].length]; }); });
  }
  function matmul(a, b) {
    if (a[0].length !== b.length) throw new Error('矩阵乘法失败：左矩阵列数必须等于右矩阵行数。');
    return a.map(function (r) { return b[0].map(function (_, j) { return r.reduce(function (sum, x, k) { return sum + x * b[k][j]; }, 0); }); });
  }
  function frame(mode, step, value) {
    var x = matrix(2, 3, 0), t = transpose(x), copy = transpose(x);
    if (mode === 'alias' || mode === 'copy') {
      if (step) { t[1][0] = value; x[0][1] = value; }
      return {a:x, b:t, out:mode === 'copy' ? copy : t,
        text:step ? '修改共享 view 的 t[1,0]，原数据 x[0,1] 同时改变。提前生成的连续副本保持原值。' : '转置将 (2,3) 变成 (3,2)，逻辑 stride 从 (3,1) 变为 (1,3)。先预测：修改转置后的一个元素会影响谁？',
        code:'x = torch.arange(6).reshape(2, 3)\nt = x.t()\nc = t.contiguous()\n' + (step ? 't[1, 0] = ' + value : '# 下一步修改共享 view') + '\n# t 与 x 共享；c 为独立副本'};
    }
    var a = mode === 'broadcast' ? [[1], [2]] : [[1,2,3],[4,5,6]];
    var b = mode === 'broadcast' ? [[value,value+10,value+20]] : [[1,0],[0,1],[value,1]];
    return {a:a,b:b,out:step ? (mode === 'broadcast' ? broadcast(a,b) : matmul(a,b)) : null,
      text:step ? (mode === 'broadcast' ? '每个输出 C[i,j] = A[i,0] + B[0,j]，得到 (2,3)。' : '每个输出是左侧一行与右侧一列的点积。内侧维度 3 匹配，输出 (2,2)。') : '先写下输出形状和左上角元素，再点击下一步核对。',
      code:mode === 'broadcast' ? 'a = torch.tensor([[1.], [2.]])\nb = torch.tensor([[' + b[0].join(', ') + ']])\nc = a + b' : 'a = torch.tensor([[1.,2.,3.],[4.,5.,6.]])\nb = torch.tensor([[1.,0.],[0.,1.],['+value+'.,1.]])\nc = a @ b'};
  }
  function mount(container) {
    var alive = true, step = 0;
    function el(tag, text) { var e = document.createElement(tag); if (text != null) e.textContent = text; return e; }
    container.appendChild(el('p','浏览器教学模拟，展示二维数值与索引规则；下面代码可在 CPU PyTorch 中独立核对。'));
    var label=el('label','实验模式 '), select=el('select'); select.setAttribute('aria-label','张量实验模式');
    [['broadcast','广播相加'],['matmul','矩阵乘法'],['alias','转置与共享修改'],['copy','连续副本对照']].forEach(function(pair){var o=el('option',pair[1]);o.value=pair[0];select.appendChild(o);});label.appendChild(select);container.appendChild(label);
    var vl=el('label',' 参数值 '), input=el('input');input.type='number';input.min='-100';input.max='100';input.step='1';input.value='10';input.setAttribute('aria-label','实验参数，整数负100到100');vl.appendChild(input);container.appendChild(vl);
    var prediction=el('textarea');prediction.rows=2;prediction.style.cssText='display:block;width:100%;max-width:32rem;margin:1rem 0';prediction.placeholder='先预测输出形状或共享修改的影响';prediction.setAttribute('aria-label','我的预测');container.appendChild(prediction);
    var actions=el('p'), previous=el('button','上一步'),next=el('button','下一步'),reset=el('button','重置');
    [previous,next,reset].forEach(function(b){b.type='button';b.className='btn';actions.appendChild(b);});container.appendChild(actions);
    var status=el('p');status.setAttribute('role','status');container.appendChild(status);
    var output=el('div');output.style.cssText='display:flex;flex-wrap:wrap;gap:1.5rem';container.appendChild(output);
    var code=el('pre');code.style.overflowX='auto';container.appendChild(code);
    var exercise=el('p','迁移任务：解释为什么预测 (3,1) 减标签 (3,) 会得到 (3,3)。修正形状后，再分别计算两种损失。');container.appendChild(exercise);
    function table(title,data){var section=el('section');section.appendChild(el('h4',title));if(!data){section.appendChild(el('p','尚未计算，请先预测。'));return section;}var tab=el('table');tab.style.cssText='min-width:10rem;border-collapse:collapse';tab.appendChild(el('caption','形状 ('+data.length+', '+data[0].length+')'));var body=el('tbody');data.forEach(function(row){var tr=el('tr');row.forEach(function(v){var cell=el('td',String(v));cell.style.cssText='padding:.4rem .7rem;border:1px solid currentColor;text-align:center';tr.appendChild(cell);});body.appendChild(tr);});tab.appendChild(body);section.appendChild(tab);return section;}
    function render(){if(!alive)return;var value=Number(input.value);output.replaceChildren();if(input.value===''||!Number.isInteger(value)||value < -100||value>100){status.textContent='请输入 -100 到 100 的整数。';code.textContent='';next.disabled=true;return;}var f=frame(select.value,step,value);status.textContent=f.text;output.appendChild(table('输入 A / 原张量 x',f.a));output.appendChild(table('输入 B / 转置 t',f.b));output.appendChild(table(select.value==='copy'?'独立连续副本 c':'结果',f.out));code.textContent=f.code;previous.disabled=step===0;next.disabled=step===1;}
    select.onchange=function(){step=0;render();};input.oninput=function(){step=0;render();};previous.onclick=function(){step=0;render();};next.onclick=function(){step=1;render();};reset.onclick=function(){step=0;select.value='broadcast';input.value='10';prediction.value='';render();};render();
    return {destroy:function(){alive=false;select.onchange=input.oninput=previous.onclick=next.onclick=reset.onclick=null;container.replaceChildren();}};
  }
  function selfTest(){var details=[];function check(name,ok){details.push({name:name,ok:ok});}
    check('广播：独立手算 [[11,21,31],[12,22,32]]',JSON.stringify(broadcast([[1],[2]],[[10,20,30]]))==='[[11,21,31],[12,22,32]]');
    check('乘法：左上 1+9=10，右下 5+6=11',JSON.stringify(matmul([[1,2,3],[4,5,6]],[[1,0],[0,1],[3,1]]))==='[[10,5],[22,11]]');
    var invalid=false;try{broadcast([[1,2,3]],[[1,2]]);}catch(e){invalid=true;}check('不兼容广播被拒绝',invalid);
    check('共享修改影响 x',frame('alias',1,99).a[0][1]===99);
    check('复制前快照不受影响',frame('copy',1,99).out[1][0]===1);
    return {ok:details.every(function(d){return d.ok;}),details:details};
  }
  window.KGDemos=window.KGDemos||{};window.KGDemos[ID]={title:'张量操作台',mount:mount,selfTest:selfTest};
})();
