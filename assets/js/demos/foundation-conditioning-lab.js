(function () {
  'use strict';
  function calculate(epsilon, delta, degrees) {
    if (![epsilon, delta, degrees].every(Number.isFinite) || epsilon < 0 || epsilon > 1 || delta < 0 || delta > 0.1 || degrees < 0 || degrees > 360) throw new Error('输入需要有限数值：小对角元 0–1，扰动 0–0.1，方向 0–360 度。');
    if (epsilon === 0) return {singular:true};
    if (epsilon < 1e-12) throw new Error('ε 太小：本实验支持 ε=0 的奇异情况或 ε≥1e-12 的非奇异情况。');
    var a=degrees*Math.PI/180, db=[delta*Math.cos(a),delta*Math.sin(a)], dx=[db[0],db[1]/epsilon], xp=[1+dx[0],1+dx[1]];
    return {singular:false,condition:1/epsilon,db:db,x:[1,1],xp:xp,residual:Math.hypot(db[0],db[1]),relativeInput:delta/Math.hypot(1,epsilon),relativeError:Math.hypot(dx[0],dx[1])/Math.sqrt(2),wellConditionedDelta:delta,warning:epsilon<1e-8};
  }
  function mount(root) {
    function el(t,s){var n=document.createElement(t);if(s!=null)n.textContent=s;return n;}
    root.classList.add('practice-lab');
    root.appendChild(el('p','教学计算 · A=diag(1,ε)，b=(1,ε)，原解 x=(1,1)。固定向量 2 范数，选择输入扰动方向；另以 A=I 作良态对照。先预测哪个方向最敏感。'));
    var fields={},controls=el('div');
    [['epsilon','小对角元 ε',0.001,0,1,0.001],['delta','扰动大小 δ',0.0001,0,0.1,0.0001],['degrees','扰动方向（度）',90,0,360,1]].forEach(function(a){var label=el('label',a[1]+' '),input=el('input');input.type='number';input.value=a[2];input.min=a[3];input.max=a[4];input.step=a[5];input.setAttribute('aria-label',a[1]);label.appendChild(input);controls.appendChild(label);fields[a[0]]={input:input,initial:a[2]};});root.appendChild(controls);
    var reset=el('button','重置'),status=el('p');reset.type='button';reset.className='btn';root.appendChild(reset);status.setAttribute('role','status');root.appendChild(status);
    var output=el('div');output.style.overflowX='auto';root.appendChild(output);
    var prediction=el('textarea');prediction.setAttribute('aria-label','数值条件性预测与解释');prediction.placeholder='先预测：改变扰动方向后，残差和解误差分别如何变化？';root.appendChild(prediction);
    function fmt(x){return Number(x.toPrecision(7)).toString();}
    function draw(){var v={};try{Object.keys(fields).forEach(function(k){var s=fields[k].input.value;if(!s.trim())throw new Error('字段不能为空。');v[k]=Number(s);});var c=calculate(v.epsilon,v.delta,v.degrees);output.replaceChildren();if(c.singular){status.textContent='奇异矩阵：ε=0，方程没有唯一解；本实验的唯一解与条件数界不再适用。调整 ε>0 可继续。';return;}
      status.textContent=c.warning?'有限精度提醒：小对角元很小，本实验使用 JavaScript 双精度；解析对角求解避免抵消，但不能代表任意矩阵算法的稳定性。':'条件数是最坏方向的敏感度界；不要求每次扰动都按这个倍数放大。';
      var table=el('table');table.appendChild(el('caption','病态系统与单位矩阵的对照（向量 2 范数）'));
      [['观测量','A=diag(1,ε)','A=I，b=(1,1)'],['κ₂',fmt(c.condition),'1'],['输入扰动 Δb',c.db.map(fmt).join(', '),c.db.map(fmt).join(', ')],['原解 x','1, 1','1, 1'],['扰动解 x′',c.xp.map(fmt).join(', '),[1+c.db[0],1+c.db[1]].map(fmt).join(', ')],['原方程残差 ||Ax′−b||',fmt(c.residual),fmt(v.delta)],['相对输入误差',fmt(c.relativeInput),fmt(v.delta/Math.sqrt(2))],['相对解误差',fmt(c.relativeError),fmt(v.delta/Math.sqrt(2))]].forEach(function(row,i){var tr=el('tr');row.forEach(function(s){tr.appendChild(el(i?'td':'th',s));});table.appendChild(tr);});output.appendChild(table);
      var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 360 240');svg.setAttribute('role','img');svg.setAttribute('aria-label','原解与扰动解向量，坐标统一按当前最大分量缩放');svg.style.width='100%';svg.style.maxWidth='420px';var title=document.createElementNS(ns,'title');title.textContent='实线原解 x，虚线扰动解 x′，共享坐标缩放';svg.appendChild(title);
      var scale=95/Math.max(1,Math.abs(c.xp[0]),Math.abs(c.xp[1]));[[c.x,'#555',''],[c.xp,'#8152a0','5 3']].forEach(function(a){var line=document.createElementNS(ns,'line');line.setAttribute('x1',180);line.setAttribute('y1',120);line.setAttribute('x2',180+a[0][0]*scale);line.setAttribute('y2',120-a[0][1]*scale);line.setAttribute('stroke',a[1]);line.setAttribute('stroke-width',3);if(a[2])line.setAttribute('stroke-dasharray',a[2]);svg.appendChild(line);});output.appendChild(svg);output.appendChild(el('p','实线：原解 (1,1)；虚线：扰动解。两线使用同一坐标缩放；所有具体数值以上表为准。残差接近零不自动证明解的前向误差很小。'));
    }catch(error){status.textContent=error.message+' 保留上一次有效结果；修正输入或重置即可继续。';}}
    Object.keys(fields).forEach(function(k){fields[k].input.oninput=draw;});reset.onclick=function(){Object.keys(fields).forEach(function(k){fields[k].input.value=fields[k].initial;});prediction.value='';draw();};draw();
    return {destroy:function(){Object.keys(fields).forEach(function(k){fields[k].input.oninput=null;});reset.onclick=null;root.replaceChildren();}};
  }
  function selfTest(){var a=calculate(.001,.0001,90),b=calculate(.001,.0001,0),checks=[['病态方向解',Math.abs(a.xp[1]-1.1)<1e-12],['方向对照',Math.abs(b.relativeError-.0001/Math.sqrt(2))<1e-12],['残差',Math.abs(a.residual-.0001)<1e-12],['条件数',a.condition===1000],['奇异边界',calculate(0,0,0).singular],['良态',calculate(1,.01,45).condition===1],['误差界',a.relativeError<=a.condition*a.relativeInput+1e-12]];try{calculate(NaN,0,0);checks.push(['非法拒绝',false]);}catch(e){checks.push(['非法拒绝',true]);}return {ok:checks.every(function(c){return c[1];}),details:checks.map(function(c){return {name:c[0],ok:c[1]};})};}
  window.KGDemos=window.KGDemos||{};window.KGDemos['foundation-conditioning-lab']={mount:mount,selfTest:selfTest,calculate:calculate};
})();
