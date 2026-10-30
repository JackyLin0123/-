(function(){
 'use strict';
 function predict(w,x){return w.reduce(function(s,v,i){return s+v*Math.pow(x,i);},0);}
 function mse(w,x,y){return x.reduce(function(s,v,i){return s+Math.pow(predict(w,v)-y[i],2);},0)/x.length;}
 function update(w,x,y,lambda,lr){return w.map(function(v,k){var g=2*x.reduce(function(sum,t,i){return sum+(predict(w,t)-y[i])*Math.pow(t,k);},0)/x.length;return v-lr*(g+(k===0?0:2*lambda*v));});}
 function dataset(noise){var tx=Array.from({length:8},function(_,i){return -1+2*i/7;}),vx=Array.from({length:31},function(_,i){return -.97+1.94*i/30;});var seed=91;function n(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296-.5;}return {tx:tx,ty:tx.map(function(x){return Math.sin(Math.PI*x)+noise*n();}),vx:vx,vy:vx.map(function(x){return Math.sin(Math.PI*x)+noise*n();})};}
 function mount(container){
  function el(t,s){var e=document.createElement(t);if(s!=null)e.textContent=s;return e;}
  container.appendChild(el('p','浏览器多项式回归模拟：目标 sin(πx)，固定种子91；8个训练点、31个验证点。λ 对非截距系数加 L2 惩罚，展示的曲线指标为不含惩罚的 MSE。没有测试集参与调参。'));
  var degree=el('select');degree.setAttribute('aria-label','多项式次数');[1,3,5].forEach(function(n){var o=el('option',n+'次多项式');o.value=n;degree.appendChild(o);});
  var lambda=el('input');lambda.type='number';lambda.min='0';lambda.max='1';lambda.step='0.05';lambda.value='0';lambda.setAttribute('aria-label','正则化强度');
  var noise=el('input');noise.type='number';noise.min='0';noise.max='1';noise.step='0.1';noise.value='0.4';noise.setAttribute('aria-label','噪声幅度');
  [['模型容量 ',degree],[' λ ',lambda],[' 噪声幅度 ',noise]].forEach(function(p){var l=el('label',p[0]);l.appendChild(p[1]);container.appendChild(l);});
  var note=el('textarea');note.setAttribute('aria-label','泛化实验预测');note.placeholder='模型容量增大后，两条误差曲线一定都下降吗？先写预测。';note.style.cssText='display:block;width:100%;margin:1rem 0';container.appendChild(note);
  var action=el('p'),next=el('button','训练10步'),reset=el('button','重置');[next,reset].forEach(function(b){b.type='button';b.className='btn';action.appendChild(b);});container.appendChild(action);
  var status=el('p');status.setAttribute('role','status');container.appendChild(status);var graph=el('div');container.appendChild(graph);var log=el('pre');log.style.overflow='auto';container.appendChild(log);
  var d,w,iteration,history;
  function draw(){var train=mse(w,d.tx,d.ty),valid=mse(w,d.vx,d.vy);status.textContent='更新 '+iteration+' 步：训练 MSE='+train.toFixed(5)+'；验证 MSE='+valid.toFixed(5)+'。学习率0.05；相同噪声设置下数据与划分固定。';log.textContent='最近记录（步数 / 训练 / 验证）\n'+history.slice(-8).map(function(h){return h.map(function(v){return typeof v==='number'?v.toFixed(4):v;}).join(' / ');}).join('\n');
   var points=Array.from({length:81},function(_,i){var x=-1+i/40;return ((x+1)*200)+','+(110-predict(w,x)*55);}).join(' ');
   var circles=d.tx.map(function(x,i){return '<circle cx="'+((x+1)*200)+'" cy="'+(110-d.ty[i]*55)+'" r="4" fill="#cf4b53"/>';}).join('');
   graph.innerHTML='<svg viewBox="0 0 420 230" role="img" aria-label="拟合曲线与训练样本；具体误差见上方文字" style="width:100%;max-width:42rem"><line x1="0" y1="110" x2="410" y2="110" stroke="currentColor"/><polyline points="'+points+'" fill="none" stroke="#3b82c4" stroke-width="2"/>'+circles+'</svg><p>红点为训练样本，蓝线为当前预测。图外数值以文字指标为准。</p>';var maxError=Math.max.apply(null,history.map(function(h){return Math.max(h[1],h[2]);}).concat([.001]));var denom=Math.max(1,iteration);function errorLine(column){return history.map(function(h){return (10+390*h[0]/denom)+','+(190-170*h[column]/maxError);}).join(' ');}graph.innerHTML+='<svg viewBox="0 0 420 210" role="img" aria-label="训练和验证误差随更新步数变化；精确值见下方记录" style="width:100%;max-width:42rem"><polyline points="'+errorLine(1)+'" fill="none" stroke="#cf4b53" stroke-width="2"/><polyline points="'+errorLine(2)+'" fill="none" stroke="#25807c" stroke-width="2"/></svg><p>误差曲线：红色训练、青色验证；下方文字记录提供数值替代。</p>';next.disabled=iteration>=1000;
  }
  function init(){var l=Number(lambda.value),n=Number(noise.value);if(lambda.value===''||noise.value===''||!Number.isFinite(l)||!Number.isFinite(n)||l<0||l>1||n<0||n>1){status.textContent='λ 与噪声幅度必须在0–1之间。';next.disabled=true;graph.replaceChildren();log.textContent='';return;}d=dataset(n);w=Array(Number(degree.value)+1).fill(0);iteration=0;history=[[0,mse(w,d.tx,d.ty),mse(w,d.vx,d.vy)]];draw();}
  degree.onchange=lambda.oninput=noise.oninput=init;next.onclick=function(){for(var i=0;i<10&&iteration<1000;i++){w=update(w,d.tx,d.ty,Number(lambda.value),.05);iteration++;}history.push([iteration,mse(w,d.tx,d.ty),mse(w,d.vx,d.vy)]);draw();};reset.onclick=function(){degree.value='1';lambda.value='0';noise.value='0.4';note.value='';init();};init();
  container.appendChild(el('p','对照任务：固定噪声，分别记录不同次数和λ在100步时的两个误差；先按验证误差选择配置。过拟合是否出现应由结果判断，不能预设每一次高容量都会更差。'));
  return {destroy:function(){degree.onchange=lambda.oninput=noise.oninput=next.onclick=reset.onclick=null;container.replaceChildren();}};
 }
 function selfTest(){var a=update([0,0],[0],[2],0,.1),b=update([0,1],[0],[0],.1,.1),d=dataset(.4);var tests=[{name:'单点一步截距0.4',ok:Math.abs(a[0]-.4)<1e-12&&a[1]===0},{name:'一步后损失2.56',ok:Math.abs(mse(a,[0],[2])-2.56)<1e-12},{name:'L2仅衰减非截距',ok:Math.abs(b[1]-.98)<1e-12},{name:'固定数据可重复',ok:JSON.stringify(d)===JSON.stringify(dataset(.4))}];return {ok:tests.every(function(t){return t.ok;}),details:tests};}
 window.KGDemos=window.KGDemos||{};window.KGDemos['ai-generalization-lab']={title:'泛化对照：容量、噪声与正则化',mount:mount,selfTest:selfTest};
})();
