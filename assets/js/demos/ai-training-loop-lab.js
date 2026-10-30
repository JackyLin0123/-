(function(){
 'use strict';
 function trace(lr,mode){
  var w=0,grad=null,out=[];
  for(var i=0;i<4;i++){
   if(mode!=='accumulate')grad=null;
   var prediction=2*w,loss=(prediction-4)*(prediction-4),local=4*(prediction-4),before=w;
   out.push({iteration:i+1,phase:'前向与损失',w:w,prediction:prediction,loss:loss,gradient:grad,detail:'输入 x=2，标签 y=4；prediction=wx，loss=(prediction−4)²。'});
   if(mode==='detach'){
    out.push({iteration:i+1,phase:'梯度路径断开',w:w,prediction:prediction,loss:loss,gradient:null,detail:'假设预测先 detach：损失没有到参数的梯度路径，不能继续正常 backward。缺失梯度不是 0。'});break;
   }
   grad=(grad===null?0:grad)+local;
   out.push({iteration:i+1,phase:'反向传播',w:w,prediction:prediction,loss:loss,gradient:grad,detail:'局部梯度 2(wx−4)x='+local.toFixed(4)+'；叶子 .grad 按累加语义更新。'});
   if(mode!=='skip-step')w=w-lr*grad;
   out.push({iteration:i+1,phase:'参数更新',w:w,prediction:prediction,loss:loss,gradient:grad,detail:'更新前 w='+before.toFixed(4)+'；'+(mode==='skip-step'?'漏掉 step，权重不变。':'w_new = w_old − learning_rate × grad。')+'此处 loss 仍是更新前前向的值。'});
  }return out;
 }
 function mount(container){
  function el(tag,text){var e=document.createElement(tag);if(text!=null)e.textContent=text;return e;}
  container.appendChild(el('p','浏览器标量训练模拟；观察一个参数的前向、梯度和更新。先预测，再单步核对；Python 完整实现见关联知识点。'));
  var label=el('label','学习率 '),lr=el('input');lr.type='number';lr.min='0';lr.max='1';lr.step='0.05';lr.value='0.1';lr.setAttribute('aria-label','学习率');label.appendChild(lr);container.appendChild(label);
  var ml=el('label',' 故障模式 '),mode=el('select');mode.setAttribute('aria-label','故障模式');[['normal','正常清零并更新'],['accumulate','忘记清零'],['skip-step','忘记参数更新'],['detach','预测断开梯度']].forEach(function(p){var o=el('option',p[1]);o.value=p[0];mode.appendChild(o);});ml.appendChild(mode);container.appendChild(ml);
  var note=el('textarea');note.setAttribute('aria-label','训练结果预测');note.placeholder='第一次更新后 w 会变成多少？下一次前向的损失会怎样？';note.style.cssText='display:block;width:100%;margin:1rem 0';container.appendChild(note);
  var controls=el('p'),back=el('button','上一步'),next=el('button','下一步'),reset=el('button','重置');[back,next,reset].forEach(function(b){b.type='button';b.className='btn';controls.appendChild(b);});container.appendChild(controls);
  var status=el('p');status.setAttribute('role','status');container.appendChild(status);var values=el('pre');values.style.overflowX='auto';container.appendChild(values);
  var index=0;
  function draw(){var rate=Number(lr.value);if(lr.value===''||!Number.isFinite(rate)||rate<0||rate>1){status.textContent='学习率须在 0 到 1 之间。';values.textContent='';next.disabled=true;return;}var frames=trace(rate,mode.value);index=Math.min(index,frames.length-1);var f=frames[index];status.textContent='第 '+f.iteration+' 轮 · '+f.phase+'。'+f.detail;values.textContent='w = '+f.w.toFixed(6)+'\nprediction（本轮前向）= '+f.prediction.toFixed(6)+'\nloss（本轮前向）= '+f.loss.toFixed(6)+'\n.grad = '+(f.gradient===null?'None（未计算/路径缺失）':f.gradient.toFixed(6));back.disabled=index===0;next.disabled=index===frames.length-1;}
  lr.oninput=mode.onchange=function(){index=0;draw();};back.onclick=function(){index--;draw();};next.onclick=function(){index++;draw();};reset.onclick=function(){index=0;lr.value='0.1';mode.value='normal';note.value='';draw();};draw();container.appendChild(el('p','迁移任务：比较正常模式与漏清零模式的第二次更新。控制其他条件相同，记录梯度、权重与下一轮损失。'));
  return {destroy:function(){lr.oninput=mode.onchange=back.onclick=next.onclick=reset.onclick=null;container.replaceChildren();}};
 }
 function selfTest(){var a=trace(.1,'normal'),b=trace(.1,'accumulate'),details=[{name:'首步 w=1.6',ok:Math.abs(a[2].w-1.6)<1e-9},{name:'第二轮前向 loss=0.64',ok:Math.abs(a[3].loss-.64)<1e-9},{name:'漏 step 权重恒为0',ok:trace(.1,'skip-step').every(function(x){return x.w===0;})},{name:'断图梯度缺失',ok:trace(.1,'detach')[1].gradient===null},{name:'第二次累加梯度=-19.2',ok:Math.abs(b[4].gradient+19.2)<1e-9}];return {ok:details.every(function(x){return x.ok;}),details:details};}
 window.KGDemos=window.KGDemos||{};window.KGDemos['ai-training-loop-lab']={title:'一个模型如何学起来',mount:mount,selfTest:selfTest};
})();
