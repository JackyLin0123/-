/* Cycle-accurate in-order 5-stage teaching model; independent semantics from sequential demo. */
(function(){
'use strict';
function decode(text){var p=[];String(text).split(/\r?\n/).forEach(function(line){line=line.replace(/#.*/,'').trim();if(!line)return;var t=line.replace(/[,()]/g,' ').trim().split(/\s+/),op=t.shift(),i={op:op,pc:p.length*4,text:line};
 function r(s){if(!/^x(?:\d|[12]\d|3[01])$/.test(s))throw Error('寄存器须为x0…x31');return +s.slice(1);}
 function n(s,lo,hi){var x=Number(s);if(!/^-?(?:\d+|0x[\da-f]+)$/i.test(s)||!Number.isInteger(x)||x<lo||x>hi)throw Error('立即数非法/越界');return x;}
 if(['add','sub'].includes(op)&&t.length===3){i.rd=r(t[0]);i.a=r(t[1]);i.b=r(t[2]);}
 else if(['addi','jalr'].includes(op)&&t.length===3){i.rd=r(t[0]);i.a=r(t[1]);i.imm=n(t[2],-2048,2047);}
 else if(['lw','sw'].includes(op)&&t.length===3){i[op==='lw'?'rd':'b']=r(t[0]);i.imm=n(t[1],-2048,2047);i.a=r(t[2]);}
 else if(op==='beq'&&t.length===3){i.a=r(t[0]);i.b=r(t[1]);i.imm=n(t[2],-4096,4094);if(i.imm%2)throw Error('分支偏移须为偶数');}
 else if(op==='jal'&&t.length===2){i.rd=r(t[0]);i.imm=n(t[1],-1048576,1048574);if(i.imm%2)throw Error('jal偏移须为偶数');}
 else throw Error('不支持的指令/参数：'+line);p.push(i);});if(p.length>64)throw Error('最多64条');return p;}
function simulate(program,options){options=options||{};var forward=options.forward!==false,branchStage=options.branchStage==='MEM'?'MEM':'EX',regs=Array(32).fill(0),mem=new Uint8Array(256),view=new DataView(mem.buffer),cycles=[],rows=[],retired=[],uid=0,stalls=0,flushes=0;
 Object.keys(options.regs||{}).forEach(function(k){if(!Number.isInteger(+k)||+k<0||+k>31)throw Error('初始寄存器编号非法');regs[+k]=options.regs[k]>>>0;});regs[0]=0;
 function address(a){if(a<0||a>252||a%4)throw Error('数据地址越界或不对齐：'+a);}
 Object.keys(options.words||{}).forEach(function(k){address(+k);view.setUint32(+k,options.words[k]>>>0,true);});
 var fetchPC=0,archPC=0,heldPrevious=false,slots={IF:null,ID:null,EX:null,MEM:null,WB:null};
 function validPC(pc){if(pc<0||pc>program.length*4||pc%4)throw Error('取指目标越界或不对齐：'+pc);}
 function fetch(){validPC(fetchPC);if(fetchPC===program.length*4)return null;var ins=program[fetchPC/4],row={id:uid++,pc:fetchPC,text:ins.text,stages:{}};rows.push(row);fetchPC+=4;return {i:ins,row:row};}
 function writes(x,r){return x&&x.i.rd===r&&r!==0;}
 function operand(r,m,w,notes){if(r===undefined||r===0)return 0;if(forward&&writes(m,r)&&m.i.op!=='lw'){notes.push('EX/MEM→EX x'+r);return m.value>>>0;}if(forward&&writes(w,r)){notes.push('MEM/WB→EX x'+r);return w.value>>>0;}return regs[r]>>>0;}
 function execute(x,m,w,notes){if(!x)return null;var i=x.i,a=operand(i.a,m,w,notes),b=operand(i.b,m,w,notes),z={i:i,row:x.row,next:i.pc+4,value:null,address:null,data:b,taken:false};
  if(i.op==='add')z.value=(a+b)>>>0;if(i.op==='sub')z.value=(a-b)>>>0;if(i.op==='addi')z.value=(a+i.imm)>>>0;
  if(i.op==='lw'||i.op==='sw'){z.address=(a+i.imm)>>>0;address(z.address);}
  if(i.op==='beq'&&a===b){z.taken=true;z.next=(i.pc+i.imm)>>>0;}
  if(i.op==='jal'){z.taken=true;z.value=i.pc+4;z.next=(i.pc+i.imm)>>>0;}
  if(i.op==='jalr'){z.taken=true;z.value=i.pc+4;z.next=((a+i.imm)&~1)>>>0;}validPC(z.next);return z;}
 slots.IF=fetch();
 for(var cycle=1;cycle<=512;cycle++){
  if(!Object.keys(slots).some(function(k){return slots[k];}))return {cycles:cycles,rows:rows,regs:regs,memory:Array.from(mem),pc:archPC,stalls:stalls,flushes:flushes,retired:retired.length,forward:forward,branchStage:branchStage};
  var notes=[],s=slots,w=s.WB,m=s.MEM,e=s.EX,d=s.ID,f=s.IF;
  Object.keys(s).forEach(function(k){if(s[k])s[k].row.stages[cycle]=k;});
  if(heldPrevious){if(d)d.row.stages[cycle]='ID STALL';if(f)f.row.stages[cycle]='IF HOLD';notes.push('本拍前端保持，EX为气泡；生产者继续推进');}
  // WB happens before ID reads in this cycle.
  if(w){if(w.i.rd!==undefined&&w.i.rd!==0&&w.value!==null)regs[w.i.rd]=w.value>>>0;regs[0]=0;archPC=w.next;retired.push(w.i.pc);}
  var memRedirect=branchStage==='MEM'&&m&&m.taken;
  var newW=m?Object.assign({},m):null;
  if(m&&m.i.op==='lw')newW.value=view.getUint32(m.address,true);
  if(m&&m.i.op==='sw')view.setUint32(m.address,m.data,true);
  var newM=memRedirect?null:execute(e,m,w,notes),redirect=memRedirect?m:(branchStage==='EX'&&newM&&newM.taken?newM:null),stall=false;
  if(d&&!redirect){var reads=[d.i.a,d.i.b].filter(function(r){return r!==undefined&&r!==0;});
   stall=forward?!!(e&&e.i.op==='lw'&&reads.includes(e.i.rd)):reads.some(function(r){return writes(e,r)||writes(m,r);});
  }
  if(redirect){var flushed=[f,d].concat(memRedirect?[e]:[]).filter(Boolean);flushed.forEach(function(x){x.row.stages[cycle]+=' FLUSH';});flushes+=flushed.length;notes.push('flush '+flushed.length+' 槽；'+branchStage+'末跳转到'+redirect.next);fetchPC=redirect.next;slots={IF:fetch(),ID:null,EX:null,MEM:newM,WB:newW};}
  else if(stall){stalls++;notes.push(forward?'检测load-use：下一拍冻结IF/ID，EX注入bubble':'无转发：下一拍ID继续等待写回，EX注入bubble');slots={IF:f,ID:d,EX:null,MEM:newM,WB:newW};}
  else slots={IF:fetch(),ID:f,EX:d,MEM:newM,WB:newW};
  heldPrevious=stall&&!redirect;
  cycles.push({cycle:cycle,notes:notes,regs:regs.slice(),memory:Array.from(mem),retired:retired.length});
 }
 throw Error('达到512周期预算，可能循环');
}
var SAMPLE='lw x1,0(x2)\nadd x3,x1,x4\nadd x5,x3,x6';
function mount(container){var root=document.createElement('section');root.innerHTML='<p>5级IF/ID/EX/MEM/WB；分离指令/数据存储器；单周期访存；同拍前半写寄存器、后半读。完整EX转发含store数据，load-use停一拍。静态预测不跳转，分支决议可切EX/MEM末。32位，256B小端对齐内存，末尾排空停止。初值x2=0,x4=2,x6=3,[0]=7，其余0。</p><label>程序<textarea data-code rows="5" style="width:100%;box-sizing:border-box"></textarea></label><label><input data-forward type="checkbox" checked>完整转发</label> <label>分支决议<select data-branch><option>EX</option><option>MEM</option></select>末</label> <button data-load>载入/复位</button> <button data-step>单步周期</button> <button data-all>全部周期</button><pre data-status aria-live="polite" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><div style="overflow:auto"><table><thead data-head></thead><tbody data-body></tbody></table></div>';container.appendChild(root);var result=null,pos=0,ev=[];
 function q(s){return root.querySelector(s);}function on(s,fn){var el=q(s);el.addEventListener('click',fn);ev.push([el,fn]);}
 function esc(x){return String(x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function draw(){if(!result)return;var c=result.cycles[pos-1];q('[data-status]').textContent='周期 '+pos+'/'+result.cycles.length+'；总stall='+result.stalls+'；被冲刷槽='+result.flushes+'\n'+(c?c.notes.join('\n')||'本周期无新增冒险':'尚未推进')+'\n已退休='+(c?c.retired:0)+'；寄存器='+JSON.stringify(c?c.regs:Array(32).fill(0))+(pos===result.cycles.length?'\n已排空；最终x5='+result.regs[5]+'，PC='+result.pc:'');
 q('[data-head]').innerHTML='<tr><th>指令（动态身份）</th>'+Array.from({length:pos},function(_,k){return '<th>'+(k+1)+'</th>';}).join('')+'</tr>';
 q('[data-body]').innerHTML=result.rows.filter(function(r){return Object.keys(r.stages).some(function(k){return +k<=pos;});}).map(function(r){return '<tr><td>'+r.id+': '+esc(r.text)+'</td>'+Array.from({length:pos},function(_,k){return '<td style="white-space:nowrap">'+(r.stages[k+1]||'')+'</td>';}).join('')+'</tr>';}).join('');}
 function load(){try{result=simulate(decode(q('[data-code]').value),{forward:q('[data-forward]').checked,branchStage:q('[data-branch]').value,regs:{2:0,4:2,6:3},words:{0:7}});pos=0;draw();}catch(e){result=null;q('[data-status]').textContent='错误：'+e.message;q('[data-head]').innerHTML='';q('[data-body]').innerHTML='';}}
 on('[data-load]',load);on('[data-step]',function(){if(result){pos=Math.min(pos+1,result.cycles.length);draw();}});on('[data-all]',function(){if(result){pos=result.cycles.length;draw();}});q('[data-code]').value=SAMPLE;load();return {destroy:function(){ev.forEach(function(x){x[0].removeEventListener('click',x[1]);});root.remove();}};}
function selfTest(){var a=simulate(decode(SAMPLE),{regs:{2:0,4:2,6:3},words:{0:7}}),b=simulate(decode(SAMPLE),{forward:false,regs:{2:0,4:2,6:3},words:{0:7}});return {ok:a.cycles.length===8&&b.cycles.length===11&&a.regs[5]===12&&b.regs[5]===12,details:['完整转发8周期、无转发11周期；最终x5均为12']};}
window.KGDemos=window.KGDemos||{};window.KGDemos['arch-pipeline-timing']={title:'流水冒险逐周期追踪',mount:mount,selfTest:selfTest,model:{parse:decode,simulate:simulate,sample:SAMPLE}};
})();
