/* RV32I text-subset semantics, separate from pipeline implementation. */
(function () {
'use strict';
var OPS=['add','sub','addi','lw','sw','beq','jal','jalr'];
function reg(s){if(!/^x(?:[0-9]|[12][0-9]|3[01])$/.test(s))throw Error('寄存器必须为x0…x31：'+s);return +s.slice(1);}
function imm(s,lo,hi){var n=Number(s);if(!/^-?(?:0x[0-9a-f]+|\d+)$/i.test(s)||!Number.isInteger(n)||n<lo||n>hi)throw Error('立即数超范围或格式错误：'+s);return n;}
function parse(text) {
  var lines=String(text).split(/\r?\n/),p=[];
  lines.forEach(function(line,index){var clean=line.replace(/#.*/,'').trim();if(!clean)return;var t=clean.replace(/[,()]/g,' ').trim().split(/\s+/),op=t[0].toLowerCase(),i={op:op,text:clean,pc:p.length*4,line:index+1};
    if(!OPS.includes(op))throw Error('第'+(index+1)+'行不支持指令：'+op);
    if(['add','sub'].includes(op)){if(t.length!==4)throw Error('算术指令需3操作数');i.rd=reg(t[1]);i.rs1=reg(t[2]);i.rs2=reg(t[3]);}
    if(['addi','jalr'].includes(op)){if(t.length!==4)throw Error('立即数指令需3操作数');i.rd=reg(t[1]);i.rs1=reg(t[2]);i.imm=imm(t[3],-2048,2047);}
    if(['lw','sw'].includes(op)){if(t.length!==4)throw Error('访存格式：lw x1,0(x2)');i[op==='lw'?'rd':'rs2']=reg(t[1]);i.imm=imm(t[2],-2048,2047);i.rs1=reg(t[3]);}
    if(op==='beq'){if(t.length!==4)throw Error('分支需3操作数');i.rs1=reg(t[1]);i.rs2=reg(t[2]);i.imm=imm(t[3],-4096,4094);if(i.imm%2)throw Error('beq偏移必须偶数');}
    if(op==='jal'){if(t.length!==3)throw Error('jal需目标寄存器和偏移');i.rd=reg(t[1]);i.imm=imm(t[2],-1048576,1048574);if(i.imm%2)throw Error('jal偏移必须偶数');}
    p.push(i);
  });if(p.length>64)throw Error('最多64条指令');return p;
}
function create(program,initial){initial=initial||{};var r=Array(32).fill(0),mem=new Uint8Array(256);Object.keys(initial.regs||{}).forEach(function(k){r[reg('x'+k)]=initial.regs[k]>>>0;});r[0]=0;
  Object.keys(initial.words||{}).forEach(function(k){address(+k);new DataView(mem.buffer).setUint32(+k,initial.words[k]>>>0,true);});return {program:program,regs:r,memory:mem,pc:0,trace:[],stopped:false};}
function address(a){if(!Number.isInteger(a)||a<0||a>252||a%4)throw Error('数据访问越界或不对齐：'+a);}
function target(a,p){if(a%4||a<0||a>p.length*4)throw Error('取指目标越界或不对齐：'+a);return a;}
function step(s){if(s.pc===s.program.length*4){s.stopped=true;return null;}if(s.stopped)return null;target(s.pc,s.program);var i=s.program[s.pc/4],a=s.regs[i.rs1]||0,b=s.regs[i.rs2]||0,pc=s.pc,next=pc+4,value=null,addr=null,write=null;
  if(i.op==='add')value=(a+b)>>>0;if(i.op==='sub')value=(a-b)>>>0;if(i.op==='addi')value=(a+i.imm)>>>0;
  if(i.op==='lw'||i.op==='sw'){addr=(a+i.imm)>>>0;address(addr);var view=new DataView(s.memory.buffer);if(i.op==='lw')value=view.getUint32(addr,true);else write=b;}
  if(i.op==='beq'&&a===b)next=(pc+i.imm)>>>0;
  if(i.op==='jal'){value=pc+4;next=(pc+i.imm)>>>0;}
  if(i.op==='jalr'){value=pc+4;next=((a+i.imm)&~1)>>>0;}
  target(next,s.program); // validate before committing architectural effects
  if(i.rd!==undefined&&i.rd!==0&&value!==null)s.regs[i.rd]=value>>>0;
  if(write!==null)new DataView(s.memory.buffer).setUint32(addr,write,true);
  s.regs[0]=0;s.pc=next;s.stopped=next===s.program.length*4;
  var row={pc:pc,instruction:i.text,rs1:a,rs2:b,rd:i.rd===undefined?null:i.rd,value:value,address:addr,memoryWrite:write,nextPC:next,regs:s.regs.slice()};
  row.controlTrace=controls(i).map(function(control){var values={};
    if(control.state==='IF')values={IR:i.text,oldPC:pc,sequentialPC:pc+4};
    if(control.state==='ID')values={A:a,B:b};
    if(control.state==='EX')values={ALUOut:addr!==null?addr:value,branchTarget:i.op==='beq'?(pc+i.imm)>>>0:null,nextPC:next};
    if(control.state==='MEM')values=i.op==='lw'?{address:addr,MDR:value}:{address:addr,writeData:write};
    if(control.state==='WB')values={rd:i.rd,writeValue:value,discard:i.rd===0};
    return {state:control.state,signals:control.signals,values:values};
  });s.trace.push(row);return row;
}
function run(p,initial,budget){var s=create(p,initial);for(var k=0;k<(budget||256)&&!s.stopped;k++)step(s);if(!s.stopped)throw Error('达到256步/指定预算，可能循环');return s;}
function controls(i){var rows=[{state:'IF',signals:'IRWrite=1, PCWrite=1, ALU=PC+4'},{state:'ID',signals:'A←rs1, B←rs2；保存当前指令地址/分支候选目标'}];
 if(i.op==='lw'||i.op==='sw'){rows.push({state:'EX',signals:'ALUOut←A+imm'});rows.push({state:'MEM',signals:i.op==='lw'?'MemRead=1, MDRWrite=1':'MemWrite=1, Data=B'});if(i.op==='lw')rows.push({state:'WB',signals:'RegWrite=1, WB=MDR'});}
 else if(i.op==='beq')rows.push({state:'EX',signals:'比较A/B；相等时PCWriteCond=1, PC=oldPC+imm'});
 else{rows.push({state:'EX',signals:'ALUOut/目标←算术或跳转计算'});rows.push({state:'WB',signals:'RegWrite=1（rd=x0时丢弃）；跳转写PC+4'});}return rows;
}
var SAMPLE='lw x1,0(x2)\nadd x3,x1,x4\nadd x5,x3,x6\nsw x5,4(x2)\nbeq x5,x5,8\naddi x7,x0,99\naddi x8,x0,1';
function mount(container){var root=document.createElement('section');root.innerHTML='<p>固定RV32I文本子集 add/sub/addi/lw/sw/beq/jal/jalr，32位、小端、256B数据内存、4B对齐。寄存器初值x2=0,x4=2,x6=3，内存[0]=7，其余0。PC到程序末尾停止；非法输入明确报错。jalr文本格式为 jalr x0,x1,0。</p><label>程序<textarea data-code rows="8" style="width:100%;box-sizing:border-box"></textarea></label><button data-load>载入/复位</button> <button data-step>执行一条（单步）</button> <button data-all>运行至停止</button><pre data-output aria-live="polite" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><div style="overflow-x:auto"><table><thead><tr><th>内部拍</th><th>控制/传送（多周期模型）</th></tr></thead><tbody data-controls></tbody></table></div>';container.appendChild(root);var state,events=[];
 function q(s){return root.querySelector(s);}function on(s,f){var e=q(s);e.addEventListener('click',f);events.push([e,f]);}
 function show(error){var row=state&&state.trace[state.trace.length-1];q('[data-output]').textContent=error?'错误：'+error.message:'PC='+state.pc+'；'+(state.stopped?'已到末尾停止':'待执行')+'\n'+(row?JSON.stringify(row,null,2):'当前尚未执行。')+'\n寄存器：'+state.regs.map(function(v,k){return 'x'+k+'='+v;}).join(' ')+'\n数据字[0]='+new DataView(state.memory.buffer).getUint32(0,true)+'；[4]='+new DataView(state.memory.buffer).getUint32(4,true);if(row)q('[data-controls]').innerHTML=controls(state.program[row.pc/4]).map(function(r){return '<tr><td>'+r.state+'</td><td>'+r.signals+'</td></tr>';}).join('');}
 function load(){try{state=create(parse(q('[data-code]').value),{regs:{2:0,4:2,6:3},words:{0:7}});q('[data-controls]').innerHTML='';show();}catch(e){show(e);}}
 on('[data-load]',load);on('[data-step]',function(){try{if(!state)throw Error('先载入程序');step(state);show();}catch(e){show(e);}});on('[data-all]',function(){try{if(!state)throw Error('先载入程序');for(var k=0;k<256&&!state.stopped;k++)step(state);if(!state.stopped)throw Error('达到256步预算，检查循环或复位');show();}catch(e){show(e);}});q('[data-code]').value=SAMPLE;load();return {destroy:function(){events.forEach(function(v){v[0].removeEventListener('click',v[1]);});root.remove();}};}
function selfTest(){var s=run(parse(SAMPLE),{regs:{2:0,4:2,6:3},words:{0:7}});return {ok:s.regs[5]===12&&s.regs[7]===0&&s.regs[8]===1&&new DataView(s.memory.buffer).getUint32(4,true)===12,details:['load-use程序顺序结果x5=12，错误路径x7=0，store[4]=12']};}
var api={parse:parse,create:create,step:step,run:run,controls:controls,sample:SAMPLE};window.KGArchSequential=api;window.KGDemos=window.KGDemos||{};window.KGDemos['arch-datapath-control']={title:'RV32I数据通路与控制',mount:mount,selfTest:selfTest,model:api};
})();
