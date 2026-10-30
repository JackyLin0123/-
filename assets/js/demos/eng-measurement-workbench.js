(function () {
  'use strict';
  var LIMIT=50000, MAX_BYTES=10*1024*1024;
  function obj(v){return v!==null && typeof v==='object' && !Array.isArray(v);}
  function measurementOf(r,i){return Array.isArray(r.measurements)&&r.measurements.length ? r.measurements[i||0] : r.measurement || {type:'events',unit:'event',scope:'事件序列'};}
  function rowsOf(r,i){if(Array.isArray(r.measurements)&&r.measurements.length)return r.measurements[i||0].data;var d=r.data||r;return d.events||d.samples||d.groups||r.events||r.samples||r.groups||[];}
  function validate(r,known){
    if(!obj(r)||r.schemaVersion!==1)throw Error('不支持的结果格式版本');
    var origin=r.origin||r.provenance;if(!['measured','simulation','prerecorded'].includes(origin))throw Error('必须明确记录来源：实测、预录或教学模拟');
    if(!known.includes(r.projectId))throw Error('未知项目：'+r.projectId);
    if(!Number.isInteger(r.projectRevision)||r.projectRevision<1)throw Error('项目版本无效');
    ['targetId','runId','recordedAt'].forEach(function(k){if(typeof r[k]!=='string'||!r[k]||r[k].length>200)throw Error(k+' 无效');});
    if(!Number.isFinite(Date.parse(r.recordedAt)))throw Error('记录日期无效');
    if(!obj(r.environment)||!obj(r.config))throw Error('缺少环境、配置或测量口径');
    var measurements=Array.isArray(r.measurements)&&r.measurements.length?r.measurements:[measurementOf(r)];var total=0;measurements.forEach(function(m,i){if(!obj(m)||!['events','samples','groups'].includes(m.type)||typeof m.unit!=='string'||!m.unit.trim()||m.unit.length>80)throw Error('测量类型或单位无效');var rows=rowsOf(r,i);if(!Array.isArray(rows)||rows.some(function(x){return !obj(x);}))throw Error('记录须为对象数组');total+=rows.length;});if(total>LIMIT)throw Error('最多 50,000 条事件或采样');
    if(['measured','prerecorded'].includes(r.origin||r.provenance)){
      if(!['passed','failed','skipped','cancelled'].includes(r.status)||!Array.isArray(r.command)||!r.command.length||!Array.isArray(r.sourceManifest)||!r.sourceManifest.length||!Array.isArray(r.inputManifest)||!Array.isArray(r.assertions))throw Error('实测记录缺少状态、命令、摘要或断言');
      r.sourceManifest.concat(r.inputManifest).forEach(function(a){if(!obj(a)||typeof a.path!=='string'||!a.path||!(/^[0-9a-f]{64}$/).test(a.sha256))throw Error('产物摘要格式无效');});
      if(r.assertions.some(function(a){return !obj(a)||typeof a.name!=='string'||typeof a.passed!=='boolean';}))throw Error('断言格式无效');
      if(r.status==='passed'&&(!r.assertions.length||r.assertions.some(function(a){return !a.passed;})))throw Error('通过状态与断言不一致');
    }
    var count=0;
    function scan(v,depth){if(++count>1000000||depth>20)throw Error('数据嵌套或数量超限');if(typeof v==='number'&&!Number.isFinite(v))throw Error('结果包含非有限数值');if(typeof v==='string'&&v.length>8000)throw Error('文本字段过长');if(v&&typeof v==='object')Object.keys(v).forEach(function(k){if(['__proto__','constructor','prototype'].includes(k))throw Error('非法字段');scan(v[k],depth+1);});}
    scan(r,0);return r;
  }
  function quantile(values,p){var a=values.slice().sort(function(x,y){return x-y;});if(!a.length)return null;var k=(a.length-1)*p,i=Math.floor(k);return a[i]+(a[Math.ceil(k)]-a[i])*(k-i);}
  function example(){return {schemaVersion:1,projectId:'pi03-concurrency',projectRevision:1,targetId:'teaching-simulator',runId:'controlled-two-loads',recordedAt:'2026-10-22T00:00:00Z',provenance:'simulation',environment:{device:'教学模拟，无真实设备',architecture:'unspecified'},config:{initial:0,threads:2,ordering:'controlled sequentially consistent atomic accesses'},measurement:{type:'events',unit:'counter value',scope:'两个线程先读后写'},data:{events:[{step:1,thread:'A',operation:'atomic load',value:0},{step:2,thread:'B',operation:'atomic load',value:0},{step:3,thread:'A',operation:'atomic store',value:1},{step:4,thread:'B',operation:'atomic store',value:1}]},assertions:[{name:'两个更新最终只增加1',passed:true}]};}
  function mount(root){
    function el(t,text){var e=document.createElement(t);if(['input','select','textarea','pre'].includes(t)){e.style.maxWidth='100%';e.style.boxSizing='border-box';}if(text!=null)e.textContent=String(text);return e;}
    root.classList.add('practice-lab');var record=example(),label='教学模拟',index=0,page=0,comparison=null,disposed=false,request=0,measurementIndex=0;
    root.appendChild(el('p','先预测：两个原子 load/store 为什么仍可能只增加 1？导入项目结果后，比较事件、原始测量与统计。文件只在当前页面内读取，不自动保存或上传。'));
    var predict=el('textarea');predict.setAttribute('aria-label','实验预测与解释');root.appendChild(predict);
    var file=el('input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','导入本地实验结果 JSON');root.appendChild(file);
    var compare=el('input');compare.type='file';compare.accept='.json,application/json';compare.setAttribute('aria-label','导入对照结果 JSON');root.appendChild(compare);
    var status=el('p');status.setAttribute('role','status');root.appendChild(status);
    var evidenceSummary=el('p');root.appendChild(evidenceSummary);var details=el('details');details.appendChild(el('summary','环境、口径与原始记录信息'));var meta=el('pre');meta.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';details.appendChild(meta);root.appendChild(details);
    var measurementSelect=el('select');measurementSelect.setAttribute('aria-label','选择测量组');root.appendChild(measurementSelect);measurementSelect.onchange=function(){measurementIndex=Number(measurementSelect.value);index=page=0;comparison=null;draw();};
    var metric=el('select');metric.setAttribute('aria-label','绘制的数值字段');root.appendChild(metric);
    var chart=el('div');chart.setAttribute('aria-label','原始采样数值图');root.appendChild(chart);
    var summary=el('p');root.appendChild(summary);
    var tools=el('div');tools.className='btn-row';root.appendChild(tools);
    function button(text,fn){var b=el('button',text);b.type='button';b.className='btn';b.onclick=fn;tools.appendChild(b);return b;}
    var prev=button('前一事件',function(){index=Math.max(0,index-1);page=Math.floor(index/100);draw();});
    var next=button('后一事件',function(){index=Math.min(rowsOf(record,measurementIndex).length-1,index+1);page=Math.floor(index/100);draw();});
    var earlier=button('上一页数据',function(){page--;draw();}),later=button('下一页数据',function(){page++;draw();});
    button('导出当前结果',function(){var u=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'})),a=el('a');a.href=u;a.download=record.projectId+'-results.json';a.click();setTimeout(function(){URL.revokeObjectURL(u);},1000);});
    button('重置为教学模拟',function(){request++;record=example();label='教学模拟';comparison=null;page=index=measurementIndex=0;predict.value='';file.value=compare.value='';draw();status.textContent='已恢复教学模拟，浏览器学习记录未改变。';});
    var wrap=el('div');wrap.style.overflowX='auto';root.appendChild(wrap);
    function known(){return (window.KG.projects||[]).map(function(p){return p.id;}).concat(['pi00-setup']);}
    function comparable(a,b){return a.projectId===b.projectId&&a.projectRevision===b.projectRevision&&['type','unit','name','scope','normalization'].every(function(k){return measurementOf(a,measurementIndex)[k]===measurementOf(b,measurementIndex)[k];});}
    async function load(input,isComparison){var ticket=++request;try{var f=input.files[0];if(!f)return;if(f.size>MAX_BYTES)throw Error('文件超过 10 MiB，请先用项目摘要工具精简');var candidate=validate(JSON.parse(await f.text()),known());if(disposed||ticket!==request)return;
      if(isComparison){if(!comparable(record,candidate))throw Error('项目、版本或测量单位/口径不一致，请分别查看；没有合并两份记录。');comparison=candidate;}else{record=candidate;comparison=null;label='本次导入（真实性未经认证）';index=page=measurementIndex=0;}draw();status.textContent='已读取 '+f.name+'，仅在本页查看。';
    }catch(e){if(!disposed&&ticket===request)status.textContent='导入失败：'+e.message+'。保留上一次有效结果。';}finally{input.value='';}}
    file.onchange=function(){load(file,false);};compare.onchange=function(){load(compare,true);};metric.onchange=draw;
    function draw(){
      var measures=record.measurements&&record.measurements.length?record.measurements:[measurementOf(record)];measurementSelect.replaceChildren();measures.forEach(function(m,i){var o=el('option',m.name||m.scope||m.type);o.value=i;measurementSelect.appendChild(o);});measurementSelect.value=measurementIndex;var rows=rowsOf(record,measurementIndex),keys=Array.from(new Set(rows.slice(0,100).flatMap(Object.keys))).slice(0,18),numeric=keys.filter(function(k){return rows.some(function(r){return typeof r[k]==='number';});}),selected=metric.value;
      metric.replaceChildren();numeric.forEach(function(k){var o=el('option',k);o.value=k;metric.appendChild(o);});if(numeric.includes(selected))metric.value=selected;
      var m=measurementOf(record,measurementIndex),measureMeta={};Object.keys(m).filter(function(k){return k!=='data';}).forEach(function(k){measureMeta[k]=m[k];});
      evidenceSummary.textContent=label+' · 来源 '+(record.origin||record.provenance)+' · 目标 '+record.targetId+' · '+rows.length+' 条记录 · 单位 '+m.unit+' · '+(record.status||'教学模型');
      meta.textContent=label+'\n'+JSON.stringify({origin:record.origin||record.provenance,status:record.status||'teaching-model',project:record.projectId,revision:record.projectRevision,target:record.targetId,recordedAt:record.recordedAt,environment:record.environment,config:record.config,measurement:measureMeta,rows:rows.length,assertions:record.assertions||[],missing:record.missing||null},null,2);
      var values=rows.map(function(r){return r[metric.value];}).filter(function(v){return typeof v==='number'&&Number.isFinite(v);});
      summary.textContent=values.length?'字段 '+metric.value+'：n='+values.length+'，中位数='+quantile(values,.5)+'，IQR='+ (quantile(values,.75)-quantile(values,.25))+'。单位与字段含义请对照上方测量说明。':'没有可绘制的数值，请检查文字事件与缺失原因。';
      if(comparison){var other=rowsOf(comparison,measurementIndex).map(function(r){return r[metric.value];}).filter(function(v){return typeof v==='number'&&Number.isFinite(v);});summary.textContent+=' 对照记录 '+comparison.runId+'：n='+other.length+'，中位数='+quantile(other,.5)+'。配置差异：'+JSON.stringify(comparison.config);}
      chart.replaceChildren();if(values.length){var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 600 150');svg.style.width='100%';svg.setAttribute('role','img');var title=document.createElementNS(ns,'title');title.textContent='字段 '+metric.value+'，横轴为记录序号，完整值见下方表格';svg.appendChild(title);var min=Math.min.apply(null,values),max=Math.max.apply(null,values),step=Math.max(1,Math.ceil(values.length/1000)),points=[];for(var i=0;i<values.length;i+=step)points.push((10+580*i/Math.max(1,values.length-1))+','+(135-120*(values[i]-min)/(max-min||1)));var line=document.createElementNS(ns,'polyline');line.setAttribute('points',points.join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','currentColor');line.setAttribute('stroke-width','2');svg.appendChild(line);chart.appendChild(svg);chart.appendChild(el('p','图表最多绘制 1000 点；未截断原数据，表格分页可查看全部 '+rows.length+' 行。'));}
      wrap.replaceChildren();var table=el('table'),caption=el('caption','原始记录，第 '+(page+1)+' 页；当前事件 '+(rows.length?index+1:0)+' / '+rows.length);table.appendChild(caption);var head=el('tr');keys.forEach(function(k){var th=el('th',k);th.scope='col';head.appendChild(th);});var thead=el('thead');thead.appendChild(head);table.appendChild(thead);var body=el('tbody');rows.slice(page*100,page*100+100).forEach(function(row,i){var tr=el('tr');if(page*100+i===index)tr.style.fontWeight='bold';keys.forEach(function(k){var v=row[k];tr.appendChild(el('td',typeof v==='object'?JSON.stringify(v):v==null?'缺失':v));});body.appendChild(tr);});table.appendChild(body);wrap.appendChild(table);prev.disabled=index<=0;next.disabled=!rows.length||index>=rows.length-1;earlier.disabled=page<=0;later.disabled=(page+1)*100>=rows.length;
    }
    draw();return {destroy:function(){disposed=true;request++;file.onchange=compare.onchange=metric.onchange=null;root.replaceChildren();}};
  }
  function selfTest(){var sample=example(),details=[];function check(name,fn){try{details.push({name:name,ok:!!fn()});}catch(e){details.push({name:name,ok:false,error:e.message});}}
    check('教学交错有4步且最终为1',function(){return validate(sample,['pi03-concurrency'])&&rowsOf(sample).length===4&&rowsOf(sample)[3].value===1;});
    check('独立中位数与IQR夹具',function(){return quantile([4,1,3,2],.5)===2.5&&quantile([1,2,3,4],.75)-quantile([1,2,3,4],.25)===1.5;});
    ['unknown','nonfinite','unit','limit'].forEach(function(kind){check('拒绝 '+kind,function(){var bad=JSON.parse(JSON.stringify(sample));if(kind==='unknown')bad.projectId='unknown';if(kind==='nonfinite')bad.data.events[0].value=Infinity;if(kind==='unit')bad.measurement.unit='';if(kind==='limit')bad.data.events=Array(LIMIT+1).fill({});try{validate(bad,['pi03-concurrency']);return false;}catch(e){return true;}});});return {ok:details.every(function(d){return d.ok;}),details:details};
  }
  window.KGDemos=window.KGDemos||{};window.KGDemos['eng-measurement-workbench']={title:'实验结果工作台',mount:mount,selfTest:selfTest,validate:validate,rowsOf:rowsOf,quantile:quantile};
})();
