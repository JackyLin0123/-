(function () {
  'use strict';
  var diagnostics = {
    'ds-core': ['从 [2,4,6] 依次累加，处理前两个元素后的 sum 是多少？', ['4','6','12'], 1, '前两项为 2+4=6。先补数组访问与循环追踪，再读复杂度。', 'ds-dynamic-array'],
    'os-core': ['两个进程都使用虚拟地址 0x1000，是否必然访问同一物理位置？', ['必然','不一定'], 1, '虚拟地址由各自地址空间映射，数值相同不代表同一物理位置。', 'os-address-space'],
    'compiler-core': ['对表达式 2+3*4 构造 AST，通常哪个运算位于根部？', ['加法','乘法'], 0, '乘法优先级更高，先组合 3*4，再与 2 相加。', 'compiler-ast'],
    'ai-core': ['矩阵 (4,3) 乘 (3,2)，输出形状是什么？', ['(4,2)','(3,3)','(2,4)'], 0, '中间维 3 相等，保留外侧维度，得到 (4,2)。', 'ai-math-toolkit'],
    'tools-bridge': ['修改后只通过格式检查，是否能替代行为测试？', ['能','不能'], 1, '格式正确不能证明程序在边界输入上的行为正确。', 'eng-git-testing-debugging']
  };
  diagnostics['ai-dl-practice']=['输入形状 (8,3) 乘权重 (3,2)，输出形状？',['(8,2)','(3,3)'],0,'保留矩阵乘法外侧维；补齐形状与广播。','ai-tensor-shapes-broadcast'];
  diagnostics['ai-rl-foundation']=['有限 MDP 的状态应包含什么？',['预测下一步所需的信息','仅时间编号'],0,'状态需要保留转移与奖励所需信息。','ai-rl-mdp'];
  diagnostics['ai-rl-deep']=['DQN 的目标网络是否每一步都参与梯度更新？',['是','否'],1,'目标值作为停止梯度的参照，目标参数另按规则更新。','ai-rl-replay-target'];
  diagnostics['pi-systems-practice']=['静态站点在 Pi 上启动后，电脑和手机的学习记录是否自动相同？',['自动相同','仍分别保存在各自浏览器'],1,'提供网页的设备与保存学习进度的浏览器不同；需要使用导入导出迁移，先准备终端和局域网环境。','eng-shell-environment'];
  diagnostics['software-engineering-core']=['预约已有半开区间 [10,20)，新预约 [20,30) 是否重叠？',['重叠','不重叠'],1,'半开区间不包含结束时刻；接口规格和测试都应使用同一约定。','eng-specifications-contracts'];
  diagnostics['algorithm-design-analysis']=['0/1 背包压成一维表时，容量正序更新可能造成什么？',['同一物品被重复使用','自动恢复最优方案'],0,'正序可能读取本轮刚更新的状态；先回到完整二维状态检查依赖。','ds-knapsack-dp'];
  diagnostics['architecture-core']=['8 位补码的 127 加 1 得到 10000000，应怎样解释？',['有符号结果 -128 且溢出','有符号结果仍为 128'],0,'位模式和整数解释必须同时看；8 位有符号范围为 -128 到 127。','arch-integer-arithmetic-alu'];
  function el(tag, text) { var n=document.createElement(tag); if(text) n.textContent=text; return n; }
  function mount(root, model) {
    if (!root.querySelector('.route-page')) return;
    var p=model.progress; p.learningEvidence=p.learningEvidence || {};
    var box=el('section'); box.className='card route-diagnostic';
    box.appendChild(el('h2','起点诊断'));
    box.appendChild(el('p','诊断只用于发现缺口，不会自动把节点标为掌握。已有基础可以直接继续学习。'));
    var defaultIds=(window.KG.routeCatalog||{}).defaultTrackIds||[];
    var diagnosticIds=Object.keys(diagnostics).filter(function(id){return model.track==='all'||model.track===id||(model.track==='core'&&defaultIds.indexOf(id)>=0);});
    diagnosticIds.forEach(function(id){
      var d=diagnostics[id], group=el('fieldset'); group.className='diagnostic-item';group.appendChild(el('legend',d[0]));
      d[1].forEach(function(label,i){var b=el('button',label);b.type='button';b.className='btn';b.onclick=function(){var result=group.querySelector('[role=status]');result.dataset.state=i===d[2]?'correct':'review';result.textContent=(i===d[2]?'回答正确。':'建议补课。')+d[3];p.learningEvidence['diagnostic:'+id]={answer:i,correct:i===d[2],at:new Date().toISOString()};model.save();};group.appendChild(b);});
      var result=el('p');result.className='diagnostic-result';result.setAttribute('role','status');group.appendChild(result);
      var link=el('a','需要时补这一节');link.href='#/n/'+d[4];group.appendChild(link);box.appendChild(group);
    });
    if (!diagnosticIds.length) {
      box.appendChild(el('p','该路线尚无专用起点题。先查看每个单元的入口能力；遇到缺口可沿节点前置链接补课。'));
      var first=model.route.length && model.route[0].nodeIds[0];
      if(first){var start=el('a','查看第一个单元的基础');start.href='#/n/'+first;box.appendChild(start);}
    }
    root.querySelector('.route-page header').after(box);
    var legacyKeys=Object.keys(p.learningEvidence).filter(function(k){return k.indexOf('stage:'+model.track+':')===0;});
    if(legacyKeys.length){
      var history=el('details');history.className='card legacy-evidence';history.appendChild(el('summary','旧分组的阶段记录（'+legacyKeys.length+' 条）'));
      history.appendChild(el('p','原来的每四节点分组已经调整。旧记录按原节点范围保留；新能力单元有稳定 ID，不自动继承旧分组的完成自评。'));
      legacyKeys.forEach(function(k){var old=p.learningEvidence[k]||{},item=el('article');item.appendChild(el('h3','原范围：'+k.slice(('stage:'+model.track+':').length)));item.appendChild(el('p','解释自评：'+(old.explained?'已勾选':'未勾选')+'；迁移自评：'+(old.transferred?'已勾选':'未勾选')+'；时间：'+(old.at||'未知')));item.appendChild(el('p',old.note||'未填写说明'));history.appendChild(item);});box.after(history);
    }
    root.querySelectorAll('.phase').forEach(function(phase,i){
      var unit=model.route[i],ids=unit.nodeIds,key=unit.unitId?'unit:'+unit.unitId:'stage:'+model.track+':'+ids.join(','),old=p.learningEvidence[key]||{};
      var hasRecord=Object.prototype.hasOwnProperty.call(p.learningEvidence,key),revision=unit.revision||1;
      function sameNodes(a,b){return Array.isArray(a)&&a.length===b.length&&a.slice().sort().every(function(id,j){return id===b.slice().sort()[j];});}
      var requiresRenewal=!!(unit.unitId&&hasRecord&&(old.unitRevision!==revision||!sameNodes(old.nodeIds,ids)));
      var previousVersions=Array.isArray(old.previousVersions)?old.previousVersions.slice():[];
      var details=el('details'); details.className='stage-evidence';details.appendChild(el('summary','阶段自检与实践记录（自评）'));
      if(unit.entry)details.appendChild(el('p','入口能力：'+unit.entry));
      if(unit.exitTask)details.appendChild(el('p','出口任务：'+unit.exitTask));
      if(requiresRenewal){
        var earlier={unitRevision:old.unitRevision,nodeIds:old.nodeIds,explained:old.explained,transferred:old.transferred,note:old.note||'',at:old.at};previousVersions.push(earlier);
        details.appendChild(el('p','单元版本或节点范围已改变。旧自评保留，当前版本 '+revision+' 需要重新勾选两项自检；原实践文字可修改后继续使用。'));
      }
      if(previousVersions.length){var versionHistory=el('details');versionHistory.className='unit-version-history';versionHistory.appendChild(el('summary','旧版本记录（'+previousVersions.length+' 条）'));previousVersions.forEach(function(record){var item=el('article');item.appendChild(el('p','版本：'+(record.unitRevision==null?'未记录':record.unitRevision)+'；节点范围：'+(Array.isArray(record.nodeIds)?record.nodeIds.join(', '):'未记录')+'；时间：'+(record.at||'未知')));item.appendChild(el('p',record.note||'未填写实践文字'));versionHistory.appendChild(item);});details.appendChild(versionHistory);}
      var explain=el('input');explain.type='checkbox';explain.checked=!requiresRenewal&&!!old.explained;
      var l1=el('label');l1.appendChild(explain);l1.appendChild(document.createTextNode('我能解释本单元的关键机制及适用条件'));details.appendChild(l1);details.appendChild(el('br'));
      var transfer=el('input');transfer.type='checkbox';transfer.checked=!requiresRenewal&&!!old.transferred;
      var l2=el('label');l2.appendChild(transfer);l2.appendChild(document.createTextNode('我已独立完成一个新输入的推演或实践'));details.appendChild(l2);
      var label=el('label','记录输入、关键过程和结果，或写下本地作品路径：');var note=el('textarea');note.value=old.note||'';note.maxLength=4000;note.setAttribute('aria-label','阶段实践证据');label.appendChild(note);details.appendChild(label);
      var save=el('button','保存阶段自检');save.type='button';save.className='btn';var status=el('p');status.setAttribute('role','status');
      function show(){var missing=ids.filter(function(id){return !p.learned[id];});status.textContent=explain.checked&&transfer.checked&&note.value.trim()&&missing.length===0?'阶段自检已完成（用户自评，未作外部认证）':(requiresRenewal?'当前单元已更新，需要重新自评。':'')+'尚未完成：需掌握本单元节点、勾选两项自检并记录实践过程。';}
      save.onclick=function(){p.learningEvidence[key]={explained:explain.checked,transferred:transfer.checked,note:note.value.trim(),at:new Date().toISOString(),unitRevision:revision,nodeIds:ids.slice(),previousVersions:previousVersions};var saved=model.save();if(saved===false){status.textContent='保存未完成，请检查存储提示并导出未保存记录。';return;}requiresRenewal=false;show();};details.appendChild(save);details.appendChild(status);show();phase.querySelector('section').appendChild(details);
    });
  }
  window.KGLearning={mount:mount,diagnostics:diagnostics};
})();
