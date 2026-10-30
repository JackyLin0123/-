(function () {
  'use strict';
  function prerequisites(project){
    var found={};function visit(id){if(found[id])return;found[id]=true;(window.KG.edges||[]).filter(function(e){return e.kind==='prereq'&&e.t===id;}).forEach(function(e){visit(e.s);});}
    project.prereqs.forEach(visit);return Object.keys(found);
  }
  function render(root, params, model) {
    root.replaceChildren();
    var list=window.KG.projects||[], id=params[0], project=list.find(function(p){return p.id===id;});
    function el(tag,text){var e=document.createElement(tag);if(text!=null)e.textContent=text;return e;}
    function link(text,href){var a=el('a',text);a.href=href;return a;}
    var page=el('div');page.className='page';root.appendChild(page);
    var types={'existing-practice':'教材/已有实践改编','paper-inspired':'论文启发','original-design':'原创教学设计'};
    function targetsText(p){var targets=p.executionTargets||[];if(!targets.length)return '历史记录环境：'+p.environment+'；架构以原始记录为准';return targets.map(function(t){var runs=((p.verification||{}).runs||[]).filter(function(r){return r.targetId===t.id;});var passed=runs.some(function(r){return r.status==='passed';});return t.hardware+' / '+t.architecture+'：'+(passed?'已记录通过':'待实测')+(t.required?'（必需分支）':'（可选分支）');}).join('；');}
    var statuses={'proposal':'设计提案，尚未跑通','reference-verified':'参考资料已核对，实跑待完成','minimal-run-verified':'最小版本已实跑'};
    if(!id){
      page.classList.add('projects-page');
      var heading=el('header');heading.className='page-head';heading.appendChild(el('h1','自主实践项目'));
      heading.appendChild(el('p','选择一个问题，先写下预测，再运行最小版本。完成状态为自评，项目的实跑状态与个人进度分别记录。'));page.appendChild(heading);
      var filterBar=el('div');filterBar.className='filter-bar project-filters';filterBar.setAttribute('role','group');filterBar.setAttribute('aria-label','筛选实践项目');page.appendChild(filterBar);
      var label=el('label'),filter=el('select');label.className='select-field';label.appendChild(el('span','按来源筛选'));filter.setAttribute('aria-label','项目来源');
      [['all','全部']].concat(Object.keys(types).map(function(k){return [k,types[k]];})).forEach(function(pair){var o=el('option',pair[1]);o.value=pair[0];filter.appendChild(o);});label.appendChild(filter);filterBar.appendChild(label);
      var facets={};
      [['practiceGroup','实践系列',Array.from(new Set(list.map(function(p){return p.practiceGroup||'ai-hands-on';})))],['phase','学习阶段',Array.from(new Set(list.map(function(p){return p.phase;})))],['compute','运行环境',['cpu','gpu']],['contentStatus','内容状态',Object.keys(statuses)]].forEach(function(a){var l=el('label'),select=el('select');l.className='select-field';l.appendChild(el('span',a[1]));select.setAttribute('aria-label','项目'+a[1]);[['all','全部']].concat(a[2].map(function(k){return [k,a[0]==='contentStatus'?statuses[k]:k==='cpu'?'CPU':k==='gpu'?'GPU':k==='pi5'?'Raspberry Pi 实践':k==='ai-hands-on'?'AI 动手实践':k==='core-cs'?'计算机核心课程':k];})).forEach(function(pair){var o=el('option',pair[1]);o.value=pair[0];select.appendChild(o);});l.appendChild(select);filterBar.appendChild(l);facets[a[0]]=select;});
      var cards=el('div');cards.className='grid-2 project-grid';page.appendChild(cards);
      function draw(){cards.replaceChildren();var visible=list.filter(function(p){return (filter.value==='all'||p.sourceType===filter.value)&&Object.keys(facets).every(function(k){return facets[k].value==='all'||(k==='practiceGroup'?(p[k]||'ai-hands-on'):p[k])===facets[k].value;});});visible.forEach(function(p){var c=el('article');c.className='card';var h=el('h2');h.appendChild(link(p.title,'#/projects/'+p.id));c.appendChild(h);c.appendChild(el('p',types[p.sourceType]+' · '+statuses[p.contentStatus]));c.appendChild(el('p',p.phase+' · '+p.environment));c.appendChild(el('p',targetsText(p)));(p.demoIds||[]).forEach(function(did){c.appendChild(link('打开关联实验','#/lab/'+did));});var missing=prerequisites(p).filter(function(n){return !(model.progress.learned||{})[n];});c.appendChild(el('p',missing.length?'适合补齐 '+missing.map(function(n){return window.KG.nodes[n].title;}).join('、')+' 后实践。':'前置知识已自评掌握，适合现在尝试。'));cards.appendChild(c);});if(!visible.length)cards.appendChild(el('p','此筛选条件下暂无已登记项目。'));}
      filter.onchange=draw;Object.keys(facets).forEach(function(k){facets[k].onchange=draw;});draw();
      var curriculum=el('details');curriculum.appendChild(el('summary','课程主题参考与阅读范围'));curriculum.appendChild(el('p','主题映射不代表学分等价，不计算本科完成百分比。'));((window.KG.curriculumMap||{}).entries||[]).forEach(function(e){var item=el('p');item.appendChild(link(e.institution+' · '+e.course+' · '+e.year,e.sourceUrl));item.appendChild(document.createTextNode(' — '+e.coverage));curriculum.appendChild(item);});page.appendChild(curriculum);return {title:'自主实践项目',nav:'projects'};
    }
    page.appendChild(link('自主实践项目','#/projects'));
    if(!project){page.appendChild(el('h1','未找到项目'));return {title:'未找到项目',nav:'projects'};}
    page.appendChild(el('h1',project.title));
    page.appendChild(el('p',types[project.sourceType]+' · '+statuses[project.contentStatus]+' · 内容版本 '+project.revision));
    page.appendChild(el('p',project.environment));page.appendChild(el('p',targetsText(project)));
    if((project.projectPrereqs||[]).length){var dep=el('p','建议先完成的实践：');project.projectPrereqs.forEach(function(pid){var p=list.find(function(x){return x.id===pid;});if(p)dep.appendChild(link(p.title+' ','#/projects/'+pid));});page.appendChild(dep);}
    (project.demoIds||[]).forEach(function(did){var p=el('p');p.appendChild(link(did==='eng-measurement-workbench'?'导入本地实验结果，查看事件与测量':'打开关联可视化实验','#/lab/'+did));page.appendChild(p);});
    var prereq=el('section');prereq.appendChild(el('h2','开始前需要什么'));
    var ul=el('ul');prerequisites(project).forEach(function(nid){var li=el('li');li.appendChild(link(window.KG.nodes[nid].title,'#/n/'+nid));li.appendChild(document.createTextNode((model.progress.learned||{})[nid]?' · 已自评掌握':' · 尚未自评，可先补课或直接尝试'));ul.appendChild(li);});prereq.appendChild(ul);page.appendChild(prereq);
    var body=el('div');body.className='prose';body.innerHTML=model.md(project.body);
    body.querySelectorAll('a[href]').forEach(function(a){var href=a.getAttribute('href');if(!href||href[0]==='#'||/^[a-z]+:/i.test(href))return;var base=href.indexOf('projects/')===0?location.href:new URL(project.readme,location.href).href;var url=new URL(href,base);if(url.hash.indexOf('#/demo/')===0)url.hash=url.hash.replace('#/demo/','#/lab/');a.href=url.href;});
    page.appendChild(body);
    var files=el('p');files.appendChild(link('打开最小参考源码',project.entry));files.appendChild(document.createTextNode(' · '));files.appendChild(link('项目 README',project.readme));page.appendChild(files);
    var sources=el('ul');project.sources.forEach(function(url){var li=el('li');li.appendChild(link(url,url));sources.appendChild(li);});page.appendChild(el('h2','参考来源'));page.appendChild(sources);
    var evidence=el('section');evidence.className='stage-evidence';evidence.appendChild(el('h2','我的实践记录（自评）'));
    var key='project:'+project.id+':v'+project.revision;
    var records=model.progress.learningEvidence=model.progress.learningEvidence||{},old=records[key]||{};
    var min=el('input');min.type='checkbox';min.checked=!!old.explained;var ml=el('label');ml.appendChild(min);ml.appendChild(document.createTextNode('完成最小任务，并能解释结果'));evidence.appendChild(ml);evidence.appendChild(el('br'));
    var ext=el('input');ext.type='checkbox';ext.checked=!!old.transferred;var xl=el('label');xl.appendChild(ext);xl.appendChild(document.createTextNode('完成一个扩展与对照实验'));evidence.appendChild(xl);
    var note=el('textarea');note.maxLength=4000;note.value=old.note||'';note.setAttribute('aria-label','项目实践记录');note.placeholder='配置、观察、作品路径、结果和下一步';evidence.appendChild(note);
    var save=el('button','保存实践记录');save.type='button';save.className='btn';evidence.appendChild(save);var status=el('p');status.setAttribute('role','status');evidence.appendChild(status);
    function show(){var r=records[key]||{};status.textContent=r.transferred&&r.explained&&r.note?'完成扩展（自评）':r.explained&&r.note?'完成最小版（自评）':r.at?'进行中':'未开始';}
    save.onclick=async function(){save.disabled=true;try{records[key]={explained:min.checked,transferred:ext.checked,note:note.value.trim(),at:new Date().toISOString()};var ok=await model.save();if(ok)show();else status.textContent='尚未保存：请保留本页并导出进度，存储恢复后重试。';}catch(error){status.textContent='保存失败：'+error.message;}finally{save.disabled=false;}};show();page.appendChild(evidence);
    if(Object.keys(records).some(function(k){return k.indexOf('project:'+project.id+':v')===0&&k!==key;}))page.appendChild(el('p','保留了其他内容版本的项目记录；请对照当前任务重新自检。'));
    return {title:project.title,nav:'projects'};
  }
  window.KGProjects={render:render,prerequisites:prerequisites};
})();
