/* Synchronous, deterministic teaching model. No analogue/metastability simulation. */
(function () {
'use strict';
function next(q,b) {
  if (![0,1,2].includes(q) || ![0,1].includes(b)) throw new Error('状态必须为0/1/2，输入必须为0/1');
  return (q+b)%3;
}
function trace(bits) {
  var q=0;
  return bits.map(function(b,i){ var d=next(q,b),row={cycle:i+1,b:b,before:q,next:d,after:d,zero:d===0};q=d;return row;});
}
function alu(a,b,sub,width) {
  width=width||8;
  if (![4,8,16].includes(width)||!Number.isInteger(a)||!Number.isInteger(b)) throw new Error('整数输入，宽度4/8/16');
  var mask=(1<<width)-1,sign=1<<(width-1);a&=mask;b&=mask;
  var rhs=sub?(b^mask):b,total=a+rhs+(sub?1:0),result=total&mask;
  return {result:result,carry:(total>>>width)&1,signed:(result&sign)?result-(1<<width):result,
    overflow:sub?!!(((a^b)&(a^result))&sign):!!(((~(a^b))&(a^result))&sign)};
}
function mount(container) {
  var root=document.createElement('section');root.className='arch-fsm-lab';
  root.innerHTML='<p>模型：初始余数0；输入1使余数加一模3，输入0保持。改变输入只改变组合下一状态；上升沿才更新寄存器。未模拟亚稳态电压。</p>'+
    '<label>当前输入位 <select data-bit><option>0</option><option>1</option></select></label> <button data-edge>时钟上升沿（单步）</button> <button data-reset>复位</button>'+
    '<pre data-state aria-live="polite" style="white-space:pre-wrap"></pre><div style="overflow-x:auto"><table><thead><tr><th>边沿</th><th>输入</th><th>旧q</th><th>d</th><th>新q</th></tr></thead><tbody data-log></tbody></table></div>'+
    '<details><summary>组合ALU：进位与溢出</summary><label>A <input data-a type="number" value="127" min="0" max="255"></label> <label>B <input data-b type="number" value="1" min="0" max="255"></label> <label><input data-sub type="checkbox">减法</label><pre data-alu style="white-space:pre-wrap"></pre><p>固定8位；数值先截到低8位。carry是最高位输出；减法carry不命名为借位。</p></details>';
  container.appendChild(root);var q=0,rows=[],bindings=[];
  function at(s){return root.querySelector(s);}
  function on(s,ev,fn){var el=at(s);el.addEventListener(ev,fn);bindings.push([el,ev,fn]);}
  function draw(){
    var b=+at('[data-bit]').value;
    at('[data-state]').textContent='当前寄存器 q='+q+'；输入 b='+b+'；组合下一状态 d='+next(q,b)+'\n当前Moore输出 z=(q==0)='+Number(q===0)+'。尚未点击边沿时q保持。';
    at('[data-log]').innerHTML=rows.map(function(r){return '<tr><td>'+r.cycle+'</td><td>'+r.b+'</td><td>'+r.before+'</td><td>'+r.next+'</td><td>'+r.after+'</td></tr>';}).join('');
    var a=Number(at('[data-a]').value),bb=Number(at('[data-b]').value);
    if(!Number.isInteger(a)||!Number.isInteger(bb)){at('[data-alu]').textContent='请输入整数';return;}
    var x=alu(a,bb,at('[data-sub]').checked,8);
    at('[data-alu]').textContent='低8位='+x.result.toString(2).padStart(8,'0')+'；无符号='+x.result+'；补码='+x.signed+'；carry='+x.carry+'；signed overflow='+Number(x.overflow);
  }
  on('[data-bit]','change',draw);
  on('[data-edge]','click',function(){var b=+at('[data-bit]').value,d=next(q,b);rows.push({cycle:rows.length+1,b:b,before:q,next:d,after:d});q=d;draw();});
  on('[data-reset]','click',function(){q=0;rows=[];draw();});
  ['[data-a]','[data-b]','[data-sub]'].forEach(function(s){on(s,'input',draw);});draw();
  return {destroy:function(){bindings.forEach(function(v){v[0].removeEventListener(v[1],v[2]);});root.remove();}};
}
function selfTest(){var x=alu(127,1,false,8),y=alu(255,1,false,8);return {ok:x.result===128&&x.overflow&&!x.carry&&y.carry&&!y.overflow&&trace([1,0,1,1])[3].after===0,details:['127+1：128/overflow1/carry0；255+1：0/overflow0/carry1；模3轨迹1,1,2,0']};}
window.KGDemos=window.KGDemos||{};
window.KGDemos['arch-logic-fsm']={title:'组合输入与时钟边沿',mount:mount,selfTest:selfTest,model:{next:next,trace:trace,alu:alu}};
})();
