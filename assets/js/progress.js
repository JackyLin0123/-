(function () {
  'use strict';
  function map(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function date(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s; }
  function stamp(s) { return typeof s==='string' && date(s.slice(0,10)) && !isNaN(Date.parse(s)); }
  function fingerprint(p) {var text=JSON.stringify(p),a=2166136261,b=3339675911;for(var i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),2246822519);}return text.length.toString(36)+':'+(a>>>0).toString(36)+':'+(b>>>0).toString(36);}
  function uid() { return Date.now().toString(36)+'-'+(window.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)); }
  function validate(p) {
    if (!map(p)) return '进度必须是对象';
    var stack=[p],visited=0;while(stack.length){var item=stack.pop();if(++visited>100000)return '记录数量过多';if(item && typeof item==='object'){for(var field of Object.keys(item)){if(field==='__proto__'||field==='constructor'||field==='prototype')return '非法记录键';if(item[field] && typeof item[field]==='object')stack.push(item[field]);}}}
    if(p.track!=null&&(typeof p.track!=='string'||!p.track))return '路线标识无效';
    if(p.theme!=null&&p.theme!=='light'&&p.theme!=='dark')return '主题设置无效';
    if(p.last!=null&&typeof p.last!=='string')return '最近节点无效';
    if (p.schemaVersion != null && p.schemaVersion !== 1 && p.schemaVersion !== 2) return '不支持此进度版本';
    if (!['learned','cards','quiz','learningEvidence'].some(function(k){return k in p;})) return '没有进度字段';
    for (var key of ['learned','cards','quiz']) if (key in p && !map(p[key])) return key + ' 必须是记录对象';
    for (var id of Object.keys(p.learned || {})) if (p.learned[id] !== true && !stamp(p.learned[id])) return '掌握日期无效';
    for (var cid of Object.keys(p.cards || {})) { var c=p.cards[cid]; if (!map(c) || !Number.isInteger(c.box) || c.box<0 || c.box>4 || !date(c.due)) return '复习记录无效'; }
    var quiz=p.quiz || {};
    for (var k of ['sections','wrong']) if (k in quiz && !map(quiz[k])) return '测验记录无效';
    for (var sid of Object.keys(quiz.sections || {})) { var s=quiz.sections[sid]; if(!map(s) || typeof s.best !== 'number' || !isFinite(s.best) || s.best<0 || s.best>100 || !Number.isInteger(s.attempts) || s.attempts<0 || (s.last != null && !stamp(s.last))) return '测验成绩无效';
      if(s.events!=null && (!map(s.events)||Object.values(s.events).some(function(e){return !map(e)||typeof e.score!=='number'||!isFinite(e.score)||e.score<0||e.score>1||!stamp(e.at);})))return '测验事件无效';
      if(s.legacyAttempts!=null && (!Number.isInteger(s.legacyAttempts)||s.legacyAttempts<0))return '历史次数无效';
    }
    for (var wid of Object.keys(quiz.wrong || {})) if(quiz.wrong[wid] !== true && !stamp(quiz.wrong[wid])) return '错题记录无效';
    if(p.learningEvidence!=null){if(!map(p.learningEvidence))return '学习证据必须是对象';for(var entry of Object.values(p.learningEvidence)){if(!map(entry)||['explained','transferred','correct'].some(function(k){return k in entry && typeof entry[k]!=='boolean';})||(entry.note!=null&&(typeof entry.note!=='string'||entry.note.length>4000))||(entry.at!=null&&!stamp(entry.at)))return '学习证据无效';}}
    if(quiz.history!=null){if(!map(quiz.history))return '答题历史无效';for(var events of Object.values(quiz.history)){if(!Array.isArray(events)||events.some(function(e){return !map(e)||typeof e.ok!=='boolean'||(e.at!=null&&!stamp(e.at))||(e.id!=null&&(typeof e.id!=='string'||!e.id));}))return '答题历史无效';}}
    return null;
  }
  function equal(a,b) {return JSON.stringify(a)===JSON.stringify(b);}
  function changes(base,local,path,out) {
    path=path||[];out=out||[];if(equal(base,local))return out;
    if(path.length===3&&path[0]==='quiz'&&path[1]==='history'&&Array.isArray(local)){
      var old=Array.isArray(base)?base:[],keys=local.map(eventKey);out.push({path:path,events:local.filter(function(e){return !old.some(function(x){return eventKey(x)===eventKey(e);});}),removeEvents:old.map(eventKey).filter(function(k){return keys.indexOf(k)<0;})});return out;
    }
    if(path.length===2&&(path[0]==='cards'||path[0]==='learningEvidence')){out.push({path:path,value:local});return out;}

    if(map(local)){base=map(base)?base:{};Object.keys(base).concat(Object.keys(local)).filter(function(k,i,a){return a.indexOf(k)===i;}).forEach(function(k){if(!(k in local))out.push({path:path.concat(k),remove:true});else changes(base[k],local[k],path.concat(k),out);});}
    else out.push({path:path,value:local});return out;
  }
  function applyChanges(remote,ops) {var out=clone(remote);ops.forEach(function(op){if(!op.path.length){out=clone(op.value);return;}var target=out;op.path.slice(0,-1).forEach(function(k){if(!map(target[k]))target[k]={};target=target[k];});var k=op.path[op.path.length-1];if(op.remove)delete target[k];else if(op.events)target[k]=historyUnion(target[k]||[],op.events).filter(function(e){return op.removeEvents.indexOf(eventKey(e))<0;});else if(op.path[0]==='quiz'&&op.path[1]==='history'&&Array.isArray(op.value))target[k]=historyUnion(target[k]||[],op.value);else if(op.path.length===4&&op.path[0]==='quiz'&&op.path[1]==='sections'&&(k==='best'||k==='legacyAttempts'))target[k]=Math.max(target[k]||0,op.value);else if(op.path.length===4&&op.path[0]==='quiz'&&op.path[1]==='sections'&&k==='last')target[k]=later(target[k],op.value);else target[k]=clone(op.value);});return out;}
  // Only explicit local edits are applied; unchanged stale keys cannot resurrect a reset.
  function rebase(base,local,remote) { return applyChanges(remote,changes(base,local)); }
  function eventKey(e) {return e.id || 'legacy:'+String(e.at||'undated')+':'+String(e.ok);}
  function historyUnion(a,b) {var unique={};a.concat(b).forEach(function(e){var k=eventKey(e);if(!unique[k]||JSON.stringify(e)<JSON.stringify(unique[k]))unique[k]=clone(e);});return Object.values(unique).sort(function(x,y){return (Date.parse(x.at)||0)-(Date.parse(y.at)||0)||eventKey(x).localeCompare(eventKey(y));});}
  function later(a,b) {if(!a)return b;if(!b)return a;return Date.parse(a)>=Date.parse(b)?a:b;}
  function section(a,b) {
    a=a||{best:0,attempts:0};b=b||{best:0,attempts:0};
    var events={};[a.events||{},b.events||{}].forEach(function(entries){Object.keys(entries).forEach(function(k){if(!events[k]||JSON.stringify(entries[k])<JSON.stringify(events[k]))events[k]=clone(entries[k]);});});var legacy=Math.max(a.legacyAttempts==null?a.attempts-Object.keys(a.events||{}).length:a.legacyAttempts,b.legacyAttempts==null?b.attempts-Object.keys(b.events||{}).length:b.legacyAttempts,0);
    return {best:Math.max(a.best||0,b.best||0,...Object.values(events).map(function(e){return e.score;})),attempts:legacy+Object.keys(events).length,last:later(a.last,b.last)||null,events:events,legacyAttempts:legacy};
  }
  function mergeHistory(current,incoming) {
    var a=current.quiz,b=incoming.quiz;a.history=a.history||{};a.wrong=a.wrong||{};
    Object.keys(b.history||{}).forEach(function(id){a.history[id]=historyUnion(a.history[id]||[],b.history[id]);});
    Object.keys(b.wrong||{}).forEach(function(id){var x=a.wrong[id],y=b.wrong[id];if(!x)a.wrong[id]=y;else if(x!==true&&y!==true)a.wrong[id]=later(x,y);});
    Object.keys(a.history).forEach(function(id){var events=a.history[id].filter(function(e){return stamp(e.at);});if(!events.length)return;var last=events[events.length-1],wrong=a.wrong[id];
      // An undated legacy flag cannot establish that it happened after a dated answer.
      if(!wrong||wrong===true||Date.parse(wrong)<=Date.parse(last.at)){if(last.ok)delete a.wrong[id];else a.wrong[id]=last.at;}
    });
  }
  function merge(current,incoming) {
    var out=clone(current);['learned','cards','learningEvidence'].forEach(function(k){out[k]=Object.assign({},incoming[k]||{},current[k]||{});});
    out.quiz=out.quiz||{sections:{},wrong:{}};out.quiz.sections=out.quiz.sections||{};
    Object.keys(incoming.quiz.sections||{}).forEach(function(id){out.quiz.sections[id]=section(out.quiz.sections[id],incoming.quiz.sections[id]);});mergeHistory(out,incoming);return out;
  }
  // Every operation has its own immutable key. Folding the journal, rather than trusting
  // a last-writer snapshot, prevents simultaneous tabs from losing unrelated changes.
  function createStore(storage,key,normalize,blank) {
    var prefix=key+':op:',baseKey=key+':journal-base',meta='_kgJournal',lastClock=0;
    function clean(p){var o=clone(p);delete o[meta];return o;}
    function parse(raw){var p=JSON.parse(raw),error=validate(p);if(error)throw new Error(error);return normalize(p);}
    function read(){var raw=storage.getItem(key)||(!storage.getItem(baseKey)&&storage.getItem('kg-progress-v1')),baseRaw=storage.getItem(baseKey),p;
      // An externally replaced ordinary v2 file starts a new baseline on its next save.
      if(raw && !JSON.parse(raw)[meta] && (!baseRaw || !equal(clean(parse(raw)),clean(parse(JSON.stringify(JSON.parse(baseRaw).progress))))))return clean(parse(raw));
      if(baseRaw){var base=JSON.parse(baseRaw);p=parse(JSON.stringify(base.progress));var ops=[];for(var i=0;i<storage.length;i++){var k=storage.key(i);if(k&&k.indexOf(prefix)===0){var op=JSON.parse(storage.getItem(k));if(op.generation===base.generation){
          if(typeof op.id!=='string'||!Number.isFinite(op.clock)||!['replace','patch'].includes(op.kind))throw new Error('进度变更日志损坏');
          if(op.kind==='replace'){var replacementIssue=validate(op.progress);if(replacementIssue)throw new Error(replacementIssue);}
          else if(!Array.isArray(op.changes)||op.changes.some(function(change){return !map(change)||!Array.isArray(change.path)||change.path.some(function(part){return typeof part!=='string'||['__proto__','constructor','prototype'].includes(part);})||(change.events&&(!Array.isArray(change.removeEvents)||validate({quiz:{history:{entry:change.events}}})))||('value' in change&&validate({learned:{},entry:change.value}));}))throw new Error('进度变更日志结构无效');
          ops.push(op);
        }}}
        ops.sort(function(a,b){return a.clock-b.clock||a.id.localeCompare(b.id);});ops.forEach(function(op){lastClock=Math.max(lastClock,op.clock);p=op.kind==='replace'?clone(op.progress):applyChanges(p,op.changes);});mergeHistory(p,{quiz:{}});Object.keys(p.quiz.sections||{}).forEach(function(id){if(p.quiz.sections[id].events)p.quiz.sections[id]=section(p.quiz.sections[id],null);});var issue=validate(p);if(issue)throw new Error(issue);return clean(normalize(p));}
      return raw?clean(parse(raw)):blank();
    }
    function commit(base,local,replace,recovery) {
      var candidate=clean(local),issue=validate(candidate);if(issue)throw new Error(issue);
      var beforeRaw=storage.getItem(key),prior;
      if(recovery){prior=blank();}else prior=read();
      var baseRaw=storage.getItem(baseKey),external=beforeRaw&&!JSON.parse(recovery?'{}':beforeRaw)[meta]&&(!baseRaw||!equal(clean(parse(beforeRaw)),clean(parse(JSON.stringify(JSON.parse(baseRaw).progress)))));
      if(!baseRaw||external||recovery){var initial={generation:recovery?uid():'base:'+fingerprint(prior),progress:recovery?blank():prior};storage.setItem(baseKey,JSON.stringify(initial));baseRaw=JSON.stringify(initial);}
      var generation=JSON.parse(baseRaw).generation,delta=changes(clean(base),candidate);
      if(!replace&&!delta.length)return {progress:prior,saved:true};
      var op={id:uid(),generation:generation,clock:Math.max(Date.now(),lastClock+1),kind:replace?'replace':'patch'};
      if(replace)op.progress=candidate;else op.changes=delta;
      var opKey=prefix+op.id;
      // The canonical snapshot is an interchange/cache file; the durable journal is authoritative.
      storage.setItem(opKey,JSON.stringify(op));
      try {var result=readJournal();result[meta]={generation:generation};storage.setItem(key,JSON.stringify(result));return {progress:clean(result),saved:true};}
      catch(error){try{storage.removeItem(opKey);}catch(rollback){error.message+='；回滚失败，请导出恢复记录';}throw error;}
      function readJournal(){var saved=storage.getItem(key);if(saved&&!JSON.parse(recovery?'{}':saved)[meta]){
        // The old main still predates journal initialisation. Read via a temporary in-memory facade.
        var facade={getItem:function(k){if(k===key)return JSON.stringify({_kgJournal:{generation:generation},learned:{}});return storage.getItem(k);},key:function(i){return storage.key(i);},get length(){return storage.length;}};
        return createStore(facade,key,normalize,blank).read();
      }return read();}
    }
    return {read:read,commit:commit,clean:clean};
  }
  function preview(incoming,current,kg) {
    var cards={},sections={},questions={},tracks={core:true,all:true},projects={};Object.keys(kg.nodes).forEach(function(id){(kg.nodes[id].quiz||[]).forEach(function(q){cards[q.id]=q.id;if(q.legacyId)cards[q.legacyId]=q.id;});});
    (kg.quizzes||[]).forEach(function(d){(d.sections||[]).forEach(function(s){sections[s.id]=true;(s.questions||[]).forEach(function(q){questions[q.id]=true;});});});(kg.projects||[]).forEach(function(p){projects[p.id]=true;});
    var catalog=kg.routeCatalog||{};(catalog.tracks||[]).forEach(function(t){tracks[t.id]=true;});
    function known(group,id){if(group==='learned')return !!kg.nodes[id];if(group==='cards')return !!cards[id];if(group==='quiz.sections')return !!sections[id];if(group==='quiz.wrong'||group==='quiz.history')return !!questions[id];if(group==='learningEvidence'){if(id.indexOf('project:')===0)return !!projects[id.slice(8).replace(/:v[^:]+$/,'')];if(id.indexOf('visited:')===0)return !!kg.nodes[id.slice(8)];if(id.indexOf('stage:')===0||id.indexOf('diagnostic:')===0)return !!tracks[id.split(':')[1]];}return null;}
    var rows=[];if(incoming.schemaVersion===1)rows.push('schemaVersion — 旧版 v1 规范化为 v2；保留未知记录');[['learned',incoming.learned,current.learned],['cards',incoming.cards,current.cards],['quiz.sections',(incoming.quiz||{}).sections,(current.quiz||{}).sections],['quiz.wrong',(incoming.quiz||{}).wrong,(current.quiz||{}).wrong],['quiz.history',(incoming.quiz||{}).history,(current.quiz||{}).history],['learningEvidence',incoming.learningEvidence,current.learningEvidence]].forEach(function(group){var name=group[0],a=group[1]||{},b=group[2]||{};Object.keys(a).forEach(function(id){var exists=Object.prototype.hasOwnProperty.call(b,id),status=known(name,id),rule=name==='quiz.sections'?'最佳分取高；旧次数取较大值，新事件去重累计':name==='quiz.history'?'按事件 ID 去重；旧记录按时间和正误去重；相同时间按 ID 排序；无时间事件保留但不推断先后':name==='quiz.wrong'?'以最新有时间事件重算；无时间标记不覆盖较新答案':exists?'保留当前值':'新增';rows.push(name+' / '+id+' — '+(status===false?'未知项，仍保留；':status===null?'扩展记录，仍保留；':'')+(exists?(equal(a[id],b[id])?'相同；':'冲突；'):'新增；')+rule+(name==='cards'&&cards[id]&&cards[id]!==id?'；旧卡迁移至 '+cards[id]+'，当前 ID 有值则保留当前值':''));});Object.keys(b).filter(function(id){return !(id in a);}).forEach(function(id){rows.push(name+' / '+id+' — 合并保留；替换将删除');});});
    ['track','theme','last'].forEach(function(k){if(k in incoming||k in current)rows.push(k+' — 合并保留当前 '+String(current[k])+'；替换为 '+String(incoming[k]===undefined?(k==='track'?'core':null):incoming[k]));});
    Object.keys(incoming).concat(Object.keys(current)).filter(function(k,i,a){return a.indexOf(k)===i&&!['schemaVersion','learned','cards','quiz','learningEvidence','track','theme','last','_kgJournal'].includes(k);}).forEach(function(k){rows.push(k+' — 扩展字段；'+(k in incoming?'合并保留当前冲突值，替换使用文件':'合并保留；替换将删除'));});
    rows.push('替换将删除文件未包含的当前记录。无时间旧记录无法推断发生先后；旧成绩次数取最大值，不累加重复备份。');return rows;
  }
  function reviewImport(incoming,current,kg,apply) {
    var dialog=document.createElement('dialog');dialog.id='progress-import-review';dialog.style.maxWidth='min(48rem,94vw)';
    var heading=document.createElement('h2');heading.textContent='核对导入记录';dialog.appendChild(heading);
    var summary=document.createElement('p');summary.textContent='合并保留当前节点、排期、主题、路线和实践冲突值；成绩与答题事件采用以下去重规则。替换使用文件。确认时会重新读取其他标签页的进度，若有变化将要求再次核对。操作前保留恢复备份。';dialog.appendChild(summary);
    var pre=document.createElement('pre');pre.style.cssText='max-height:40vh;overflow:auto;white-space:pre-wrap';pre.textContent=preview(incoming,current,kg).join('\n');dialog.appendChild(pre);
    var mode=document.createElement('select');mode.setAttribute('aria-label','导入方式');[['merge','合并，保留当前冲突项'],['replace','替换为导入文件']].forEach(function(x){var o=document.createElement('option');o.value=x[0];o.textContent=x[1];mode.appendChild(o);});dialog.appendChild(mode);
    var confirm=document.createElement('button');confirm.textContent='确认导入';confirm.type='button';confirm.className='btn';confirm.onclick=function(){var selected=mode.value;dialog.close();dialog.remove();apply(selected);};dialog.appendChild(confirm);
    var cancel=document.createElement('button');cancel.textContent='取消';cancel.type='button';cancel.className='btn';cancel.onclick=function(){dialog.close();dialog.remove();};dialog.appendChild(cancel);
    dialog.addEventListener('cancel',function(){dialog.remove();});document.body.appendChild(dialog);dialog.showModal();
  }
  window.KGProgress = {validate:validate,reviewImport:reviewImport,preview:preview,merge:merge,mergeHistory:mergeHistory,mergeSection:section,rebase:rebase,createStore:createStore,eventId:uid};
})();
