/* 计算机核心知识图谱 · 应用主体
 * 路由（hash）、各页面视图、进度存储、搜索、主题、演示懒加载。
 * 依赖：window.KG（data.js）、window.KGMarkdown（md.js）；可选：window.KGGraph（graph.js）、window.KGDemos。
 */
(function () {
  'use strict';

  var SITE = '计算机核心知识图谱';
  var STORE_KEY = 'kg-progress-v2';
  var DOMAIN_IDS = ['foundation', 'theory', 'ds', 'arch', 'os', 'pl', 'compiler', 'ai', 'eng', 'hum', 'research'];
  var LEVEL = { 1: '入门', 2: '核心', 3: '进阶' };
  var KIND_LABEL = { video: '视频', article: '文章', course: '课程', book: '书', tool: '工具', code: '代码', discussion: '讨论' };
  var LANG_LABEL = { zh: '中文', en: '英文' };
  var QUIZ_KIND = { concept: '概念', calc: '计算', tf: '判断' };
  var BOX_DAYS = [0, 1, 2, 4, 8];

  var ICONS = {
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    external: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M12 3.5 2.8 19.5h18.4L12 3.5Z"/><path d="M12 10v4M12 16.8h.01"/>',
    graph: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.5 6.2l7 .6M7.1 8.3l3.8 7.4M16.8 9.3l-3.6 6.4"/>',
    route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    cards: '<rect x="3.5" y="7" width="13" height="13" rx="2"/><path d="M7.5 3.5H18a2.5 2.5 0 0 1 2.5 2.5v10.5"/>',
    flask: '<path d="M9 3.5h6M10 3.5v6L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9.5v-6"/><path d="M7.2 15h9.6"/>',
    book: '<path d="M4.5 5.5a2 2 0 0 1 2-2h13v15h-13a2 2 0 0 0-2 2v-15Z"/><path d="M4.5 20.5a2 2 0 0 0 2 2h13"/>',
    branch: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="8" r="2.2"/><path d="M6 8.2v7.6M18 10.2c0 4-5.5 3.3-10.4 6.4"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    layers: '<path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5Z"/><path d="M3.5 12.5 12 17l8.5-4.5"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    quiz: '<path d="M9 4.5H6.5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-14a1 1 0 0 0-1-1H15"/><rect x="9" y="3" width="6" height="3.2" rx="1"/><path d="M8.8 13.2l2.2 2.2 4.2-4.4"/>',
    retry: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>',
    notebook: '<rect x="5" y="3.5" width="14" height="17" rx="1.6"/><path d="M9 3.5v17M12 8h4M12 11.5h4"/>'
  };
  var SHAPES = {
    foundation: '<path d="M6 .4 11.6 11.2H.4Z"/>',
    theory: '<path d="M6 .4 11.6 6 6 11.6.4 6Z"/>',
    ds: '<circle cx="6" cy="6" r="5.2"/>',
    arch: '<path d="M3 0.7h6l2.3 2.3v6L9 11.3H3L.7 9V3Z"/>',
    os: '<rect x="0.9" y="0.9" width="10.2" height="10.2" rx="2.6"/>',
    compiler: '<path d="M6 0.3 11.7 6 6 11.7 0.3 6Z"/>',
    pl: '<rect x="1.2" y="3.1" width="9.6" height="5.8" rx="2.9"/>',
    ai: '<path d="M6 0.4 10.9 3.2 10.9 8.8 6 11.6 1.1 8.8 1.1 3.2Z"/>',
    hum: '<path d="M1 1.2h4.1c.5 0 .9.2.9.7v8.9c0-.7-.5-1.1-1.2-1.1H1Zm10 0H6.9c-.5 0-.9.2-.9.7v8.9c0-.7.5-1.1 1.2-1.1H11Z"/>',
    research: '<path d="M4.2.8h3.6v1.1h-.6v3.2l3.6 5.3c.4.6 0 1.4-.7 1.4H1.9c-.7 0-1.1-.8-.7-1.4l3.6-5.3V1.9h-.6Z"/>'
  };

  /* ================================================================ 工具函数 */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function md(s) { return window.KGMarkdown ? window.KGMarkdown.render(s) : '<p>' + esc(s) + '</p>'; }
  function mdi(s) { return window.KGMarkdown ? window.KGMarkdown.inline(s) : esc(s); }
  function icon(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  }
  function shape(did, cls) {
    return '<svg class="dom-icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 12 12" aria-hidden="true" focusable="false" style="fill:var(--c-' + did + ')">' + (SHAPES[did] || SHAPES.ds) + '</svg>';
  }
  function fmtMin(m) {
    m = Number(m) || 0;
    if (m < 60) return Math.round(m) + ' 分钟';
    return (Math.round(m / 6) / 10) + ' 小时';
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function addDays(str, n) {
    var p = str.split('-').map(Number);
    return todayStr(new Date(p[0], p[1] - 1, p[2] + n));
  }
  function fmtDay(str) {
    var p = String(str || '').split('-').map(Number);
    if (p.length < 3 || !p[1]) return str || '';
    return p[1] + ' 月 ' + p[2] + ' 日';
  }
  function fmtDateTime(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return iso || '';
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function fmtWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return iso || '';
    return (d.getFullYear() === new Date().getFullYear() ? '' : d.getFullYear() + ' 年 ') + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function sum(arr, f) { return arr.reduce(function (a, x) { return a + (f ? f(x) : x); }, 0); }
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }
  function domName(did) { return DOM[did] ? DOM[did].short : did; }
  function domTag(did) { return '<span class="dom-tag">' + shape(did) + '<span>' + esc(domName(did)) + '</span></span>'; }
  function reducedMotion() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function toast(msg) {
    var t = $('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show'); }, 3600);
  }

  /* ================================================================ 进度存储 */
  var storageOK = true, corruptStorage = false, failedCandidate = null, failedOptions = null, storageError = '', corruptRaw = '';
  var progressStore = window.KGProgress.createStore({getItem:function(k){return window.localStorage.getItem(k);},setItem:function(k,v){window.localStorage.setItem(k,v);},removeItem:function(k){window.localStorage.removeItem(k);},key:function(i){return window.localStorage.key(i);},get length(){return window.localStorage.length;}}, STORE_KEY, normalizeProgress, blankProgress);
  var P = blankProgress(), savedSnapshot = blankProgress(), syncingStorage = false;

  function blankProgress() { return { schemaVersion: 2, track: 'core', learned: {}, cards: {}, last: null, theme: null, quiz: { sections: {}, wrong: {}, history: {} }, learningEvidence: {} }; }

  function normalizeProgress(o) {
    var p = blankProgress();
    if (!o || typeof o !== 'object' || Array.isArray(o)) return p;
    Object.keys(o).forEach(function (k) { if (!(k in p)) p[k] = o[k]; }); // 保留以后新增的字段
    if (o.learned && typeof o.learned === 'object') {
      Object.keys(o.learned).forEach(function (k) {
        var v = o.learned[k];
        if (typeof v === 'string' && v) p.learned[k] = v;
        else if (v === true) p.learned[k] = true;
      });
    }
    if (o.cards && typeof o.cards === 'object') {
      Object.keys(o.cards).forEach(function (k) {
        var v = o.cards[k];
        if (!v || typeof v !== 'object') return;
        var box = Math.max(0, Math.min(4, parseInt(v.box, 10) || 0));
        var due = /^\d{4}-\d{2}-\d{2}$/.test(v.due) ? v.due : todayStr();
        p.cards[k] = Object.assign({},v,{box:box,due:due});
      });
    }
    if (typeof o.track === 'string') p.track = o.track;
    if (typeof o.last === 'string') p.last = o.last;
    if (o.theme === 'light' || o.theme === 'dark') p.theme = o.theme;
    if(o.learningEvidence&&typeof o.learningEvidence==='object'&&!Array.isArray(o.learningEvidence))p.learningEvidence=o.learningEvidence;
    var qz = o.quiz;
    if(qz&&typeof qz==='object')Object.keys(qz).forEach(function(k){if(!['history','sections','wrong'].includes(k))p.quiz[k]=qz[k];});
    if (qz && qz.history && typeof qz.history === 'object' && !Array.isArray(qz.history)) p.quiz.history=qz.history;
    if (qz && typeof qz === 'object' && !Array.isArray(qz)) {
      if (qz.sections && typeof qz.sections === 'object') {
        Object.keys(qz.sections).forEach(function (k) {
          var v = qz.sections[k];
          if (!v || typeof v !== 'object') return;
          var best = Number(v.best);
          if (!isFinite(best) || best < 0) best = 0;
          if (best > 1) best = best <= 100 ? best / 100 : 1; // 兼容写成百分数的旧文件
          p.quiz.sections[k] = Object.assign({},v,{
            best: best,
            last: typeof v.last === 'string' && v.last ? v.last : null,
            attempts: Math.max(0, parseInt(v.attempts, 10) || 0)
          });
        });
      }
      if (qz.wrong && typeof qz.wrong === 'object') {
        Object.keys(qz.wrong).forEach(function (k) {
          var v = qz.wrong[k];
          if (typeof v === 'string' && v) p.quiz.wrong[k] = v;
          else if (v === true) p.quiz.wrong[k] = true;
        });
      }
    }
    return p;
  }

  // Keep this object identity stable for project/stage event handlers mounted on a page.
  function publishProgress(next) {
    function reconcile(target,source){
      Object.keys(target).forEach(function(k){if(!(k in source))delete target[k];});
      Object.keys(source).forEach(function(k){var v=source[k];if(v&&typeof v==='object'&&!Array.isArray(v)&&target[k]&&typeof target[k]==='object'&&!Array.isArray(target[k]))reconcile(target[k],v);else target[k]=JSON.parse(JSON.stringify(v));});
    }
    // Mounted project forms retain learningEvidence references between repeated saves.
    reconcile(P,JSON.parse(JSON.stringify(next)));
  }
  function loadProgress() {
    try {
      P=progressStore.read(); savedSnapshot=JSON.parse(JSON.stringify(P));
    } catch(error) {
      storageOK=false;storageError=error.message;
      try {corruptRaw=localStorage.getItem(STORE_KEY)||localStorage.getItem('kg-progress-v1')||'';corruptStorage=!!corruptRaw;}catch(ignored){}
    }
  }
  function updateSaveWarning() {
    var warning=document.getElementById('save-warning');
    if(warning)warning.remove();
    if(storageOK)return;
    warning=document.createElement('div');warning.id='save-warning';warning.setAttribute('role','alert');warning.className='notice notice-warn';
    warning.textContent=(corruptStorage?'原始进度无法读取，已停止自动覆盖。请导出原文后，从关于页导入有效备份、恢复或明确清空。':'进度尚未保存；显示的是最近已保存记录。待保存修改可导出或重试。')+' '+storageError;
    if(corruptStorage){var diagnostic=document.createElement('button');diagnostic.textContent='导出存储诊断';diagnostic.onclick=function(){var details={reason:storageError,canonical:corruptRaw,entries:{}};try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf(STORE_KEY)===0)details.entries[k]=localStorage.getItem(k);}}catch(error){details.readError=error.message;}downloadProgressText(JSON.stringify(details,null,2),'kg-progress-storage-diagnostic.json');};warning.appendChild(diagnostic);var rawButton=document.createElement('button');rawButton.textContent='导出损坏原文';rawButton.onclick=function(){downloadProgressText(corruptRaw,'kg-progress-corrupt.txt','text/plain');};warning.appendChild(rawButton);}
    var backup=document.createElement('button');backup.textContent='导出待保存进度';backup.type='button';backup.onclick=exportProgress;warning.appendChild(backup);
    if(failedCandidate&&!corruptStorage){var retry=document.createElement('button');retry.textContent='重试保存';retry.onclick=function(){if(saveProgress(failedCandidate,failedOptions)){toast('待保存进度已保存。');rehydrateProgress();}};warning.appendChild(retry);}
    document.body.appendChild(warning);
  }
  function saveProgress(candidate,options) {
    options=options||{};
    if(syncingStorage)return true;
    // Existing callers mutate P then call save(); publish only after the write succeeds.
    var next=JSON.parse(JSON.stringify(candidate||P));
    if(!candidate&&failedCandidate){next=window.KGProgress.rebase(savedSnapshot,next,failedCandidate);options=failedOptions||options;}
    try {
      if(corruptStorage&&!options.recovery)throw new Error('原文已保留，需先选择恢复操作');
      if(options.backup){
        if(corruptStorage)localStorage.setItem('kg-progress-corrupt-original',corruptRaw);
        else localStorage.setItem('kg-progress-before-import',JSON.stringify(progressStore.read()));
      }
      var result=progressStore.commit(savedSnapshot,next,!!options.replace,!!options.recovery);
      publishProgress(result.progress);savedSnapshot=JSON.parse(JSON.stringify(P));
      storageOK=true;corruptStorage=false;failedCandidate=null;failedOptions=null;storageError='';
    } catch(error) {
      failedCandidate=next;failedOptions=options;publishProgress(savedSnapshot);storageOK=false;storageError=error.message;
      toast('进度尚未保存：'+error.message+'。可导出待保存进度后重试。');
    }
    updateSaveWarning();return storageOK;
  }
  function rehydrateProgress() {
    // Route variables are initialised once; a reload rebuilds every dependent index together.
    applyTheme();
    if(P.track!==selectedTrack){location.reload();return;}
    render();
  }
  function downloadProgressText(text,name,type) {
    var a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:type||'application/json'}));
    a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);a.remove();},0);
  }

  /* ================================================================ 主题 */
  function effectiveTheme() {
    if (P.theme === 'light' || P.theme === 'dark') return P.theme;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme() {
    var root = document.documentElement;
    if (P.theme === 'light' || P.theme === 'dark') root.setAttribute('data-theme', P.theme);
    else root.removeAttribute('data-theme');
    var btn = $('#theme-toggle');
    if (btn) {
      var dark = effectiveTheme() === 'dark';
      btn.classList.toggle('is-dark', dark);
      btn.setAttribute('aria-label', dark ? '切换到浅色主题' : '切换到深色主题');
      btn.title = dark ? '切换到浅色' : '切换到深色';
    }
  }
  function setTheme(t) {
    P.theme = t === 'light' || t === 'dark' ? t : null;
    saveProgress();
    applyTheme();
    window.dispatchEvent(new CustomEvent('kg:theme', { detail: { theme: effectiveTheme() } }));
  }

  loadProgress();
  window.addEventListener('storage',function(e){
    if(e.key!==null && e.key.indexOf(STORE_KEY)!==0)return;
    try {
      var latest=progressStore.read();
      if(JSON.stringify(latest)===JSON.stringify(savedSnapshot))return;
      publishProgress(latest);savedSnapshot=JSON.parse(JSON.stringify(latest));
      storageOK=true;corruptStorage=false;storageError='';updateSaveWarning();
      syncingStorage=true;rehydrateProgress();
    } catch(error){storageOK=false;storageError=error.message;try{corruptRaw=localStorage.getItem(STORE_KEY)||'';corruptStorage=!!corruptRaw;}catch(ignored){}updateSaveWarning();}
    finally {syncingStorage=false;}
  });
  applyTheme();
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', applyTheme);
  }

  /* ================================================================ 数据和索引 */
  var KG = window.KG;
  if (!KG || !KG.nodes || !KG.domains) {
    $('#view').innerHTML = '<div class="page page-narrow"><h1>没有找到网站数据</h1>' +
      '<p class="lead">assets/js/data.js 不存在或没有加载成功。</p>' +
      '<p>在网站根目录运行 <code>python _build/build.py</code> 生成它，然后刷新这个页面。</p></div>';
    var tb = $('#theme-toggle');
    if (tb) tb.addEventListener('click', function () { setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark'); });
    return;
  }

  var DOMS = KG.domains || [];
  var DOM = {};
  DOMS.forEach(function (d) { DOM[d.id] = d; d.stages = d.stages || []; d.courses = d.courses || []; d.featuredCourse = d.featuredCourse || null; d.bestOverallResources = d.bestOverallResources || []; });
  var NODES = KG.nodes;
  function domIdx(id) { var i = DOMAIN_IDS.indexOf(id); return i < 0 ? 99 : i; }
  var allNodes = Object.keys(NODES).map(function (k) { return NODES[k]; }).sort(function (a, b) {
    return domIdx(a.domain) - domIdx(b.domain) || (a.order || 0) - (b.order || 0) || (a.id < b.id ? -1 : 1);
  });
  var byDomain = {};
  DOMAIN_IDS.forEach(function (d) { byDomain[d] = []; });
  allNodes.forEach(function (n) { (byDomain[n.domain] = byDomain[n.domain] || []).push(n); });

  var stageById = {};
  DOMS.forEach(function (d) { d.stages.forEach(function (s, i) { stageById[s.id] = { stage: s, domain: d, index: i }; }); });

  var prereqIn = {}, nextIn = {}, crossOf = {};
  allNodes.forEach(function (n) { prereqIn[n.id] = []; nextIn[n.id] = []; crossOf[n.id] = []; });
  (KG.edges || []).forEach(function (e) {
    if (!NODES[e.s] || !NODES[e.t]) return;
    if (e.kind === 'prereq') {
      prereqIn[e.t].push(e.s);
      nextIn[e.s].push(e.t);
    } else {
      crossOf[e.s].push({ other: e.t, edge: e, out: true });
      crossOf[e.t].push({ other: e.s, edge: e, out: false });
    }
  });
  function byOrder(a, b) { return (NODES[a].order || 0) - (NODES[b].order || 0); }
  Object.keys(prereqIn).forEach(function (k) { prereqIn[k].sort(byOrder); nextIn[k].sort(byOrder); });

  var CATALOG_ROUTE = (KG.route || []).filter(function (p) { return p && Array.isArray(p.nodeIds); });
  var TRACKS = (KG.routeCatalog || {}).tracks || [];
  var defaultTrackIds = (KG.routeCatalog || {}).defaultTrackIds || TRACKS.map(function(t) { return t.id; });
  var coreTracks = TRACKS.filter(function(t) { return defaultTrackIds.indexOf(t.id) >= 0; });
  var selectedTrack = P.track || 'core';
  var chosen = TRACKS.filter(function(t) { return selectedTrack === 'core' ? defaultTrackIds.indexOf(t.id) >= 0 : t.id === selectedTrack; });
  if (!chosen.length && selectedTrack !== 'all') { selectedTrack = 'core'; chosen = coreTracks; }
  var included = {};
  var ROUTE = selectedTrack === 'all' || !TRACKS.length ? CATALOG_ROUTE : chosen.reduce(function(phases, t) {
    var units=t.units && t.units.length ? t.units : [{unitId:t.id+'--legacy',revision:1,title:t.title,goal:'沿知识依赖推进，并用自测检查理解。',nodeIds:t.nodeIds}];
    units.forEach(function(unit){
      var ids=unit.nodeIds.filter(function(id){if(included[id])return false;included[id]=true;return true;});
      if(!ids.length)return;
      phases.push({phase:unit.title,group:t.title,goal:unit.goal,nodeIds:ids,parallel:'按前置能力推进；可独立选择其他专题。',unitId:unit.unitId,revision:unit.revision,entry:unit.entry,exitTask:unit.exitTask,projectIds:unit.projectIds||[]});
    });
    return phases;
  }, []);
  var routeSelector = '<label class="select-field route-picker"><span>学习目标</span><select id="route-track"><option value="core">四领域核心全景</option>' + TRACKS.map(function(t) {return '<option value="'+esc(t.id)+'">'+esc(t.title)+'</option>';}).join('') + '<option value="all">全部专题探索</option></select></label>';
  document.addEventListener('change', function(e) { if(e.target.id === 'route-track') { P.track=e.target.value; if(saveProgress()) location.reload(); } });
  document.addEventListener('click', function(e) {
    var link=e.target.closest('[data-select-track]');
    if(!link)return;
    var id=link.getAttribute('data-select-track');
    if(!TRACKS.some(function(t){return t.id===id;}))return;
    e.preventDefault();
    var previous=P.track;P.track=id;
    if(saveProgress()===false){P.track=previous;return;}
    location.hash='#/route';location.reload();
  });
  var routeIds = [], routePos = {}, phaseOf = {};
  ROUTE.forEach(function (p, i) {
    p.nodeIds.forEach(function (id) {
      if (NODES[id] && !(id in routePos)) { routePos[id] = routeIds.length; routeIds.push(id); phaseOf[id] = i; }
    });
  });
  var studyOrder = routeIds.concat(allNodes.map(function (n) { return n.id; }).filter(function (id) { return !(id in routePos); }));
  function posOf(id) { return id in routePos ? routePos[id] : 1e6 + studyOrder.indexOf(id); }

  var DEMOS = KG.demos || [];
  var demoById = {};
  DEMOS.forEach(function (d) { demoById[d.id] = d; });
  function demoNodes(d) {
    var ids = (d.nodeIds || []).filter(function (id) { return NODES[id]; });
    allNodes.forEach(function (n) { if (n.demo === d.id && ids.indexOf(n.id) < 0) ids.push(n.id); });
    return ids;
  }

  var CARDS = [];
  studyOrder.forEach(function (id) {
    (NODES[id].quiz || []).forEach(function (q, i) {
      var cardId = q.id || id + '#' + (i + 1);
      if (!P.cards[cardId] && q.legacyId && P.cards[q.legacyId]) P.cards[cardId] = P.cards[q.legacyId];
      CARDS.push({ id: cardId, nid: id, q: q.q, a: q.a, kind: q.kind, context: q.context || '' });
    });
  });

  // 板块测验：KG.quizzes（可能没有）
  var DIFF_LABEL = { 2: '理解应用', 3: '深入综合' };
  var QUIZZES = (Array.isArray(KG.quizzes) ? KG.quizzes : []).filter(function (qz) {
    return qz && DOM[qz.domain] && Array.isArray(qz.sections);
  }).sort(function (a, b) { return domIdx(a.domain) - domIdx(b.domain); });
  var quizByDomain = {}, quizSec = {}, quizQ = {}, quizByNode = {};
  var QUIZ_TOTAL = 0;
  QUIZZES.forEach(function (qz) {
    quizByDomain[qz.domain] = qz;
    qz.sections = qz.sections.filter(function (s) { return s && s.id && Array.isArray(s.questions) && s.questions.length; });
    qz.sections.forEach(function (s, si) {
      quizSec[s.id] = { sec: s, quiz: qz, index: si };
      s.questions = s.questions.filter(function (q) {
        if (!q || !q.id || quizQ[q.id]) return false;
        if (q.type === 'single') return Array.isArray(q.options) && q.options.length === 4 && q.answer >= 0 && q.answer <= 3;
        return q.type === 'tf' && typeof q.answer === 'boolean';
      });
      s.questions.forEach(function (q, qi) {
        quizQ[q.id] = { q: q, sec: s, quiz: qz, index: qi };
        QUIZ_TOTAL++;
        (q.nodeIds || []).forEach(function (nid) {
          if (NODES[nid] && (quizByNode[nid] = quizByNode[nid] || []).indexOf(q.id) < 0) quizByNode[nid].push(q.id);
        });
      });
    });
  });
  function quizOrder(a, b) {
    var x = quizQ[a], y = quizQ[b];
    return domIdx(x.quiz.domain) - domIdx(y.quiz.domain) || quizSec[x.sec.id].index - quizSec[y.sec.id].index || x.index - y.index;
  }
  function wrongIds(did) {
    return Object.keys(P.quiz.wrong).filter(function (qid) {
      var x = quizQ[qid];
      return x && (!did || did === 'all' || x.quiz.domain === did);
    }).sort(quizOrder);
  }
  function noteAnswer(qid, ok) {
    P.quiz.history = P.quiz.history || {};
    var history=P.quiz.history[qid] || []; history.push({id:window.KGProgress.eventId(),ok:ok,at:new Date().toISOString()}); P.quiz.history[qid]=history;
    if (ok) delete P.quiz.wrong[qid];
    else P.quiz.wrong[qid] = new Date().toISOString();
    saveProgress();
  }
  function noteSection(sid, score) {
    var r;try{r=progressStore.read().quiz.sections[sid];}catch(error){r=P.quiz.sections[sid];}r=r||{best:0,last:null,attempts:0};
    var event={score:score,at:new Date().toISOString()},addition={best:score,last:event.at,attempts:1,legacyAttempts:0,events:{}};addition.events[window.KGProgress.eventId()]=event;
    P.quiz.sections[sid]=window.KGProgress.mergeSection(r,addition);
    saveProgress();
  }
  function pctText(x) { return Math.round((x || 0) * 100) + '%'; }

  function isLearned(id) { return !!P.learned[id]; }
  function nextNodeId() {
    for (var i = 0; i < routeIds.length; i++) if (!isLearned(routeIds[i]) && prereqIn[routeIds[i]].every(isLearned)) return routeIds[i];
    return null;
  }
  function learnedCount(ids) { return ids.filter(isLearned).length; }

  /* ================================================================ 掌握状态和进度条 */
  var progressSets = {};

  function idsForKey(key) {
    if (progressSets[key]) return progressSets[key];
    if (key === 'all') return routeIds;
    if (key.indexOf('d:') === 0) return (byDomain[key.slice(2)] || []).map(function (n) { return n.id; });
    if (key.indexOf('p:') === 0) { var p = ROUTE[+key.slice(2)]; return p ? p.nodeIds.filter(function (id) { return NODES[id]; }) : []; }
    if (key.indexOf('s:') === 0) { var s = stageById[key.slice(2)]; return s ? s.stage.nodeIds.filter(function (id) { return NODES[id]; }) : []; }
    return [];
  }
  function stats(key) {
    var ids = idsForKey(key);
    var done = learnedCount(ids);
    return { done: done, total: ids.length, pct: ids.length ? Math.round(done * 100 / ids.length) : 0 };
  }
  function fmtStat(key, fmt) {
    var s = stats(key);
    switch (fmt) {
      case 'done': return String(s.done);
      case 'pct': return s.pct + '%';
      case 'learned': return '自评掌握 ' + s.done + ' / ' + s.total;
      case 'full': return '自评掌握 ' + s.done + ' / ' + s.total + ' · ' + s.pct + '%';
      default: return s.done + ' / ' + s.total;
    }
  }
  function meterHtml(key, did, label, ids) {
    if (ids) progressSets[key] = ids;
    var s = stats(key);
    return '<div class="meter' + (did ? ' d-' + did : '') + '" role="progressbar" aria-label="' + esc(label || '进度') +
      '" aria-valuemin="0" aria-valuemax="' + s.total + '" aria-valuenow="' + s.done + '" data-progress="' + esc(key) + '">' +
      '<span style="width:' + s.pct + '%"></span></div>';
  }
  function statText(key, fmt, cls) {
    return '<span class="' + (cls || 'num') + '" data-stat="' + esc(key) + '" data-fmt="' + (fmt || 'frac') + '">' + esc(fmtStat(key, fmt)) + '</span>';
  }
  function refreshProgress() {
    $$('[data-progress]').forEach(function (el) {
      var s = stats(el.getAttribute('data-progress'));
      el.setAttribute('aria-valuenow', s.done);
      el.setAttribute('aria-valuemax', s.total);
      var bar = el.firstElementChild;
      if (bar) bar.style.width = s.pct + '%';
    });
    $$('[data-stat]').forEach(function (el) { el.textContent = fmtStat(el.getAttribute('data-stat'), el.getAttribute('data-fmt')); });
    $$('.phase[data-phase]').forEach(function (el) {
      var s = stats('p:' + el.getAttribute('data-phase'));
      el.classList.toggle('is-done', s.total > 0 && s.done === s.total);
    });
  }
  function switchHtml(id) {
    var on = isLearned(id);
    return '<button type="button" class="switch d-' + NODES[id].domain + '" role="switch" aria-checked="' + on + '" data-learn="' + esc(id) + '">' +
      '<span class="switch-track" aria-hidden="true"></span><span class="switch-label">' + (on ? '自评掌握' : '标记为自评掌握') + '</span></button>';
  }
  function learningState(id) {
    var evidence=P.learningEvidence || {};
    if (isLearned(id)) {
      var checked=Object.keys(evidence).some(function(key){var e=evidence[key];var ids=key.indexOf('stage:')===0 ? (key.split(':')[2]||'').split(',') : [];return ids.indexOf(id)>=0 && e.explained===true && e.transferred===true && typeof e.note==='string' && e.note.trim() && ids.every(isLearned);});
      return checked ? '完成检查（自评）' : '自评掌握';
    }
    return evidence['visited:'+id] ? '学习中' : '未开始';
  }
  function statusHtml(id) {
    var on = isLearned(id);
    return '<span class="status' + (on ? ' done' : '') + '" data-status="' + esc(id) + '">' + (on ? icon('check') : '') + learningState(id) + '</span>';
  }

  var graphHandles = [];

  function setLearned(id, val) {
    if (!NODES[id]) return;
    if (val) P.learned[id] = new Date().toISOString();
    else delete P.learned[id];
    saveProgress();
    syncLearned(id);
    graphHandles.forEach(function (g) {
      var h = g.handle;
      if (!h) return;
      try {
        if (typeof h.refresh === 'function') h.refresh();
        else if (typeof h.update === 'function') h.update();
        else if (g.remount) g.remount();
      } catch (e) { console.error(e); }
    });
    window.dispatchEvent(new CustomEvent('kg:progress', { detail: { id: id, learned: !!val } }));
  }
  function syncLearned(id) {
    var on = isLearned(id);
    $$('[data-learn="' + cssEsc(id) + '"]').forEach(function (el) {
      if (el.type === 'checkbox') el.checked = on;
      else {
        el.setAttribute('aria-checked', String(on));
        var lab = el.querySelector('.switch-label');
        if (lab) lab.textContent = on ? '自评掌握' : '标记为自评掌握';
      }
      var row = el.closest('.node-row');
      if (row) row.classList.toggle('is-learned', on);
    });
    $$('[data-status="' + cssEsc(id) + '"]').forEach(function (el) {
      el.classList.toggle('done', on);
      el.innerHTML = (on ? icon('check') : '') + learningState(id);
    });
    refreshProgress();
  }

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches('input[type="checkbox"][data-learn]')) setLearned(t.getAttribute('data-learn'), t.checked);
  });
  document.addEventListener('click', function (e) {
    var sw = e.target.closest && e.target.closest('button[data-learn]');
    if (sw) {
      var id = sw.getAttribute('data-learn');
      setLearned(id, !isLearned(id));
    }
  });

  /* ================================================================ 共用片段 */
  function nodeRow(n, o) {
    o = o || {};
    var on = isLearned(n.id);
    return '<li class="node-row d-' + n.domain + (on ? ' is-learned' : '') + '">' +
      '<label class="nr-check"><input type="checkbox" data-learn="' + esc(n.id) + '"' + (on ? ' checked' : '') + '>' +
      '<span class="sr-only">把「' + esc(n.title) + '」标记为自评掌握</span></label>' +
      (o.order ? '<span class="nr-order" aria-hidden="true">' + n.order + '</span>' : '') +
      '<div class="nr-main">' +
      (o.showDomain ? '<span class="nr-dom">' + shape(n.domain) + '<span>' + esc(domName(n.domain)) + '</span></span>' : '') +
      '<a class="nr-title" href="#/n/' + esc(n.id) + '">' + esc(n.title) + '</a>' +
      (n.en ? '<span class="nr-en" lang="en">' + esc(n.en) + '</span>' : '') +
      (n.draft ? '<span class="badge badge-draft">草稿</span>' : '') +
      '</div><span class="nr-meta">' + (o.level ? '<span>' + LEVEL[n.level] + '</span>' : '') + '<span>' + fmtMin(n.estMinutes) + '</span></span></li>';
  }

  function resCard(r, extra) {
    var url = safeUrl(r.url);
    var title = url
      ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(r.title) + icon('external', 'ext-ic') + '<span class="sr-only">（新窗口打开）</span></a>'
      : esc(r.title);
    return '<li class="card res-card"><div class="res-top">' +
      (r.platform ? '<span class="badge badge-strong">' + esc(r.platform) + '</span>' : '') +
      (r.lang ? '<span class="badge">' + esc(LANG_LABEL[r.lang] || r.lang) + '</span>' : '') +
      // 平台和类型同名时（平台「书」+ 类型 book、平台「课程」+ 类型 course）只显示一次
      (r.kind && (KIND_LABEL[r.kind] || r.kind) !== r.platform ? '<span class="badge">' + esc(KIND_LABEL[r.kind] || r.kind) + '</span>' : '') +
      (!url ? '<span class="badge badge-warn">未核实</span>' : '') +
      '</div><h3 class="res-title">' + title + '</h3>' +
      (r.note ? '<p class="res-note">' + esc(r.note) + '</p>' : '') +
      (r.evidence ? '<p class="res-ev">依据：' + esc(r.evidence) + '</p>' : '') +
      (extra || '') + '</li>';
  }

  function miniNodeLink(n, sub) {
    return '<li><a href="#/n/' + esc(n.id) + '">' + shape(n.domain) + '<span>' + esc(n.title) + '</span>' +
      (sub ? '<span class="ml-sub">' + sub + '</span>' : '') + '</a></li>';
  }

  function relLabel(kind, out) {
    switch (kind) {
      case 'uses': return out ? '用到' : '被用于';
      case 'implements': return out ? '实现了' : '实现方式';
      case 'applies': return out ? '应用了' : '应用场景';
      case 'analogy': return '思想相通';
      case 'prereq': return out ? '之后可学' : '建议先学';
      default: return '相关';
    }
  }

  /* ================================================================ 图谱组件接入 */
  var graphLayout = null; // 本次打开期间记住用户选的布局

  function graphOptions(extra) {
    var o = {
      nodes: KG.nodes,
      edges: KG.edges || [],
      domains: KG.domains,
      onOpen: function (id) { go('#/n/' + id); },
      isLearned: isLearned,
      nextId: nextNodeId,
      onToggleLearned: function (id, val) { setLearned(id, typeof val === 'boolean' ? val : !isLearned(id)); },
      layout: graphLayout || 'force',
      onLayoutChange: function (name) { graphLayout = name; }
    };
    Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
    if (!(extra && (extra.mini || extra.filterDomain)) && selectedTrack !== 'all') { o.nodes = routeIds.map(function(id) { return NODES[id]; }); }
    return o;
  }

  function graphFallbackHtml(extra) {
    if (extra && extra.mini) return '<p class="muted small">图谱组件没有加载。</p>';
    var list = extra && extra.filterDomain ? byDomain[extra.filterDomain] : allNodes;
    return '<div class="notice">' + icon('info') + '<p>图谱组件没有加载（assets/js/graph.js）。下面先用列表列出' + (extra && extra.filterDomain ? '本领域' : '全部') + '知识点。</p></div>' +
      '<div class="table-wrap"><table class="list-table"><thead><tr><th scope="col">知识点</th><th scope="col">领域</th><th scope="col">层级</th><th scope="col">前置</th><th scope="col">状态</th></tr></thead><tbody>' +
      list.map(function (n) {
        return '<tr><td><a href="#/n/' + esc(n.id) + '">' + esc(n.title) + '</a></td><td>' + domTag(n.domain) + '</td><td class="muted">' + LEVEL[n.level] + '</td><td>' +
          (prereqIn[n.id].length ? prereqIn[n.id].map(function (p) { return esc(NODES[p].title); }).join('、') : '<span class="muted">无</span>') +
          '</td><td>' + statusHtml(n.id) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function mountGraph(host, extra) {
    var entry = { handle: null, remount: null };
    function mount() {
      if (entry.handle && entry.handle.destroy) { try { entry.handle.destroy(); } catch (e) { console.error(e); } }
      entry.handle = null;
      if (!window.KGGraph || typeof window.KGGraph.mount !== 'function') {
        host.classList.add('graph-missing');
        host.innerHTML = graphFallbackHtml(extra);
        return;
      }
      host.classList.remove('graph-missing');
      host.innerHTML = '';
      try {
        entry.handle = window.KGGraph.mount(host, graphOptions(extra)) || null;
      } catch (e) {
        console.error(e);
        host.classList.add('graph-missing');
        host.innerHTML = graphFallbackHtml(extra);
      }
    }
    entry.remount = extra && extra.mini ? mount : null;
    mount();
    graphHandles.push(entry);
    return {
      destroy: function () {
        var i = graphHandles.indexOf(entry);
        if (i >= 0) graphHandles.splice(i, 1);
        if (entry.handle && entry.handle.destroy) { try { entry.handle.destroy(); } catch (e) { console.error(e); } }
        entry.handle = null;
      },
      focus: function (id) { if (entry.handle && entry.handle.focus) entry.handle.focus(id); }
    };
  }

  /* ================================================================ 演示懒加载 */
  var demoLoads = {};

  function loadDemoScript(d) {
    if (window.KGDemos && window.KGDemos[d.id]) return Promise.resolve(window.KGDemos[d.id]);
    if (demoLoads[d.id]) return demoLoads[d.id];
    demoLoads[d.id] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = d.file;
      s.async = true;
      s.onload = function () {
        if (window.KGDemos && window.KGDemos[d.id]) resolve(window.KGDemos[d.id]);
        else { delete demoLoads[d.id]; reject(new Error('脚本加载了，但没有注册 KGDemos["' + d.id + '"]')); }
      };
      s.onerror = function () {
        delete demoLoads[d.id];
        if (s.parentNode) s.parentNode.removeChild(s);
        reject(new Error('找不到文件 ' + d.file));
      };
      document.head.appendChild(s);
    });
    return demoLoads[d.id];
  }

  function mountDemo(host, d) {
    var handle = null, dead = false;
    function msg(text, retry) {
      host.innerHTML = '<div class="demo-msg">' + '<p>' + text + '</p>' +
        (retry ? '<button type="button" class="btn btn-sm" data-act="retry">再试一次</button>' : '') + '</div>';
      var b = $('[data-act="retry"]', host);
      if (b) b.addEventListener('click', start);
    }
    function start() {
      if (dead) return;
      host.innerHTML = '<div class="demo-loading">正在加载演示……</div>';
      loadDemoScript(d).then(function (mod) {
        if (dead) return;
        host.innerHTML = '';
        try {
          handle = mod.mount(host) || null;
        } catch (e) {
          console.error(e);
          msg('这个演示运行时出错了：' + esc(e && e.message || e), true);
        }
      }, function (err) {
        if (dead) return;
        msg('这个演示还没加载出来（' + esc(err.message) + '）。演示文件可能还在制作，稍后刷新页面再试。', true);
      });
    }
    if (!d) {
      host.innerHTML = '<div class="demo-msg"><p>这个演示没有登记。</p></div>';
    } else if (d.available === false && !(window.KGDemos && window.KGDemos[d.id])) {
      host.innerHTML = '<div class="demo-msg"><p>这个演示还在制作中，做好后会出现在这里。</p>' +
        '<button type="button" class="btn btn-sm" data-act="force">试着加载</button></div>';
      $('[data-act="force"]', host).addEventListener('click', start);
    } else {
      start();
    }
    return {
      destroy: function () {
        dead = true;
        if (handle && typeof handle.destroy === 'function') { try { handle.destroy(); } catch (e) { console.error(e); } }
        handle = null;
        host.innerHTML = '';
      }
    };
  }

  /* ================================================================ 搜索 */
  var SEARCH = allNodes.map(function (n) {
    return {
      n: n,
      title: n.title.toLowerCase(),
      en: (n.en || '').toLowerCase(),
      terms: (n.keyTerms || []).map(function (t) { return [t.zh, t.en].filter(Boolean).join(' / '); }),
      one: n.oneLiner || '',
      interview: (n.interviewQuestions || []).map(function (q) { return [q.question, q.company, q.sourceLabel].filter(Boolean).join(' · '); })
    };
  });

  function searchNodes(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var out = [];
    SEARCH.forEach(function (it) {
      var rank = -1, hit = null;
      var ti = it.title.indexOf(q), ei = it.en.indexOf(q);
      if (ti === 0) rank = 0;
      else if (ti > 0) rank = 1;
      else if (ei >= 0) rank = ei === 0 ? 1 : 2;
      else {
        for (var i = 0; i < it.terms.length; i++) {
          if (it.terms[i].toLowerCase().indexOf(q) >= 0) { rank = 3; hit = { type: 'term', text: it.terms[i] }; break; }
        }
        if (rank < 0 && it.one.toLowerCase().indexOf(q) >= 0) { rank = 4; hit = { type: 'one' }; }
        if (rank < 0) {
          for (var j = 0; j < it.interview.length; j++) {
            if (it.interview[j].toLowerCase().indexOf(q) >= 0) { rank = 5; hit = { type: 'interview', text: it.interview[j] }; break; }
          }
        }
      }
      if (rank >= 0) out.push({ it: it, rank: rank, hit: hit });
    });
    out.sort(function (a, b) { return a.rank - b.rank || posOf(a.it.n.id) - posOf(b.it.n.id); });
    return out.slice(0, 8);
  }

  function hl(text, q) {
    text = String(text || '');
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (!q || i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }
  function snippet(text, q) {
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0 || text.length <= 60) return hl(text, q);
    var start = Math.max(0, i - 20);
    return (start > 0 ? '…' : '') + hl(text.slice(start, start + 70), q) + (start + 70 < text.length ? '…' : '');
  }

  var searchInput = $('#search-input');
  var searchList = $('#search-list');
  var topbar = $('#topbar');
  var searchResults = [];
  var searchActive = -1;

  function closeSearchList() {
    searchList.hidden = true;
    searchList.innerHTML = '';
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
    searchResults = [];
    searchActive = -1;
  }
  function paintActive() {
    $$('.search-item', searchList).forEach(function (li, i) { li.setAttribute('aria-selected', String(i === searchActive)); });
    if (searchActive >= 0) {
      searchInput.setAttribute('aria-activedescendant', 'sr-' + searchActive);
      var el = $('#sr-' + searchActive);
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    } else searchInput.removeAttribute('aria-activedescendant');
  }
  function renderSearch() {
    var raw = searchInput.value;
    var q = raw.trim();
    if (!q) { closeSearchList(); return; }
    searchResults = searchNodes(q);
    searchActive = searchResults.length ? 0 : -1;
    if (!searchResults.length) {
      searchList.innerHTML = '<li class="search-empty" role="option" aria-disabled="true" aria-selected="false">没有找到和「' + esc(q) + '」相关的知识点</li>';
    } else {
      searchList.innerHTML = searchResults.map(function (r, i) {
        var n = r.it.n, sub;
        if (r.hit && r.hit.type === 'term') sub = '关键词：' + hl(r.hit.text, q);
        else if (r.hit && r.hit.type === 'one') sub = snippet(n.oneLiner || '', q);
        else if (r.hit && r.hit.type === 'interview') sub = '面试题：' + snippet(r.hit.text, q);
        else sub = esc(n.oneLiner || '');
        return '<li class="search-item" id="sr-' + i + '" role="option" aria-selected="' + (i === searchActive) + '" data-id="' + esc(n.id) + '">' +
          shape(n.domain) + '<div class="si-head"><span class="si-title">' + hl(n.title, q) + '</span>' +
          (n.en ? '<span class="si-en" lang="en">' + hl(n.en, q) + '</span>' : '') +
          '<span class="sr-only">，' + esc(domName(n.domain)) + '</span></div><div class="si-sub">' + sub + '</div></li>';
      }).join('');
    }
    searchList.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    paintActive();
  }
  function chooseSearch(i) {
    var r = searchResults[i];
    if (!r) return;
    searchInput.value = '';
    closeSearchList();
    searchInput.blur();
    setSearchPanel(false);
    go('#/n/' + r.it.n.id);
  }
  function setSearchPanel(open) {
    topbar.classList.toggle('search-open', open);
    $('#search-toggle').setAttribute('aria-expanded', String(open));
    if (open) { setMenu(false); setTimeout(function () { searchInput.focus(); }, 0); }
  }
  function openSearch() {
    if (window.matchMedia && matchMedia('(max-width: 640px)').matches) setSearchPanel(true);
    else searchInput.focus();
    searchInput.select();
  }
  function setMenu(open) {
    topbar.classList.toggle('nav-open', open);
    var b = $('#menu-toggle');
    b.setAttribute('aria-expanded', String(open));
    b.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
    if (open) topbar.classList.remove('search-open');
  }

  searchInput.addEventListener('input', renderSearch);
  searchInput.addEventListener('focus', function () { if (searchInput.value.trim()) renderSearch(); });
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (searchList.hidden) renderSearch();
      if (!searchResults.length) return;
      e.preventDefault();
      var d = e.key === 'ArrowDown' ? 1 : -1;
      searchActive = (searchActive + d + searchResults.length) % searchResults.length;
      paintActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!searchResults.length) renderSearch();
      if (searchResults.length) chooseSearch(searchActive < 0 ? 0 : searchActive);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (searchInput.value) { searchInput.value = ''; closeSearchList(); }
      else { closeSearchList(); searchInput.blur(); setSearchPanel(false); }
    }
  });
  searchInput.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== searchInput) closeSearchList(); }, 120); });
  searchList.addEventListener('mousedown', function (e) { e.preventDefault(); });
  searchList.addEventListener('click', function (e) {
    var li = e.target.closest('.search-item');
    if (li) chooseSearch($$('.search-item', searchList).indexOf(li));
  });
  searchList.addEventListener('mousemove', function (e) {
    var li = e.target.closest('.search-item');
    if (!li) return;
    var i = $$('.search-item', searchList).indexOf(li);
    if (i !== searchActive) { searchActive = i; paintActive(); }
  });

  $('#search-toggle').addEventListener('click', function () { setSearchPanel(!topbar.classList.contains('search-open')); });
  $('#menu-toggle').addEventListener('click', function () { setMenu(!topbar.classList.contains('nav-open')); });
  $('#theme-toggle').addEventListener('click', function () { setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark'); });
  $('#skip-link').addEventListener('click', function () { var m = $('#main'); m.focus(); m.scrollIntoView(); });
  document.addEventListener('click', function (e) {
    if (!topbar.contains(e.target)) {
      if (topbar.classList.contains('nav-open')) setMenu(false);
      if (topbar.classList.contains('search-open') && !searchInput.value) setSearchPanel(false);
    }
  });

  var pageKeyHandler = null;
  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented) return;
    var t = e.target;
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openSearch();
      return;
    }
    if (e.key === 'Escape' && topbar.classList.contains('nav-open')) { setMenu(false); $('#menu-toggle').focus(); return; }
    if (pageKeyHandler && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) pageKeyHandler(e);
  });

  /* ================================================================ 首页 */
  function viewHome(root) {
    var total = routeIds.length;
    var nid = nextNodeId();
    var nn = nid && NODES[nid];
    var last = P.last && NODES[P.last] && P.last !== nid && !isLearned(P.last) ? NODES[P.last] : null;
    var learnedN = learnedCount(routeIds);
    // 第一次来（什么都没掌握、也没打开过知识点）时说「从这里开始」，之后才是「继续学习」
    var fresh = !learnedN && !(P.last && NODES[P.last]);
    var cont;
    if (nn) {
      var ph = phaseOf[nn.id];
      cont = '<section class="card continue-card d-' + nn.domain + '" aria-labelledby="cc-title">' +
        '<div class="eyebrow">' + (fresh ? '从这里开始' : '继续学习') + '</div>' +
        '<div class="cc-meta">' + domTag(nn.domain) + '<span class="sep" aria-hidden="true">·</span><span>' + LEVEL[nn.level] + '</span>' +
        (ph != null ? '<span class="sep" aria-hidden="true">·</span><span>' + esc(ROUTE[ph].phase) + '</span>' : '') + '</div>' +
        '<h2 class="cc-title" id="cc-title"><a href="#/n/' + esc(nn.id) + '">' + esc(nn.title) + '</a>' +
        (nn.en ? '<span class="en" lang="en">' + esc(nn.en) + '</span>' : '') + '</h2>' +
        '<p class="cc-one">' + esc(nn.oneLiner) + '</p>' +
        '<div class="cc-foot"><span class="muted cc-time">' + icon('clock') + '约 ' + fmtMin(nn.estMinutes) + '</span>' +
        '<a class="btn btn-primary" href="#/n/' + esc(nn.id) + '">开始学习' + icon('arrowRight') + '</a></div>' +
        (last ? '<p class="cc-last">上次看到：<a href="#/n/' + esc(last.id) + '">' + esc(last.title) + '</a></p>'
          : fresh ? '<p class="cc-last">学完后在知识点页顶部打开「标记为自评掌握」，这里会换成路线上的下一个。</p>' : '') +
        '</section>';
    } else {
      cont = '<section class="card continue-card" aria-labelledby="cc-title"><div class="eyebrow">继续学习</div>' +
        '<h2 class="cc-title" id="cc-title">当前学习目标中的 ' + total + ' 个知识点已完成自评</h2>' +
        '<p class="cc-one">可以去复习页把自测题过一遍，或者在图谱里沿着跨领域的连线再走一遍。</p>' +
        '<div class="cc-foot"><span></span><a class="btn btn-primary" href="#/review">去复习' + icon('arrowRight') + '</a></div></section>';
    }

    var prog = '<section class="card progress-card" aria-labelledby="pg-title">' +
      '<h2 class="card-title" id="pg-title">学习进度</h2>' +
      '<div class="prog-total">' + statText('all', 'done', 'big') + '<span class="muted">/ ' + total + ' 个知识点自评掌握</span>' + statText('all', 'pct', 'prog-pct') + '</div>' +
      meterHtml('all', null, '总进度') +
      '<ul class="prog-list">' + DOMS.map(function (d) {
        return '<li class="prog-row d-' + d.id + '"><a class="dom-tag" href="#/d/' + d.id + '">' + shape(d.id) + esc(d.short) + '</a>' +
          meterHtml('d:' + d.id, d.id, d.short + '进度') + statText('d:' + d.id, 'frac') + '</li>';
      }).join('') + '</ul></section>';

    var domainCards = DOMS.map(function (d) {
      var list = byDomain[d.id] || [];
      return '<article class="card card-link domain-card d-' + d.id + '">' +
        '<h3>' + shape(d.id, 'lg') + '<a class="stretched" href="#/d/' + d.id + '">' + esc(d.name) + '</a></h3>' +
        (d.tagline ? '<p class="dc-tagline">' + esc(d.tagline) + '</p>' : '') +
        '<p class="dc-stats muted">' + list.length + ' 个知识点 · ' + d.stages.length + ' 个阶段 · 约 ' + fmtMin(sum(list, function (n) { return n.estMinutes || 0; })) + '</p>' +
        meterHtml('d:' + d.id, d.id, d.short + '进度') +
        '<div class="dc-foot">' + statText('d:' + d.id, 'learned', '') + '<span class="dc-go">进入' + icon('arrowRight') + '</span></div></article>';
    }).join('');

    var due = dueCards(CARDS).length;
    var resN = resourcesIndex().length;
    var totalMin = sum(allNodes, function (n) { return n.estMinutes || 0; });
    var wrongN = wrongIds().length;
    var quick = [
      ['#/graph', 'graph', '知识图谱', total + ' 个知识点、' + (KG.edges || []).length + ' 条连线'],
      ['#/route', 'route', '学习路线', ROUTE.length + ' 个阶段，约 ' + fmtMin(totalMin)],
      ['#/quiz', 'quiz', '板块测验', QUIZ_TOTAL ? QUIZ_TOTAL + ' 道单选和判断，' + (wrongN ? '错题本里有 ' + wrongN + ' 道' : '检验一个阶段学得够不够') : '测验题还在出'],
      ['#/review', 'cards', '复习', !Object.keys(P.cards).length ? (CARDS.length ? CARDS.length + ' 张闪卡，还没开始复习' : '还没有闪卡')
        : due ? '今天有 ' + due + ' 张卡到期' : '今天没有到期的卡'],
      ['#/lab', 'flask', '实验室', DEMOS.length + ' 个交互演示'],
      ['#/resources', 'book', '学习资源', resN + ' 条，可按平台和语言筛选']
    ].map(function (q) {
      return '<li class="card card-link quick-card">' + icon(q[1]) + '<div><h3><a class="stretched" href="' + q[0] + '">' + q[2] + '</a></h3><p>' + esc(q[3]) + '</p></div></li>';
    }).join('');

    var mapArt = '<div class="hero-map" aria-hidden="true"><svg viewBox="0 0 400 210" focusable="false">' +
      '<path class="map-links" d="M54 84 138 42 174 126 54 84M138 42 273 67 174 126 323 137 273 67M174 126 266 179 323 137M273 67 266 179"/>' +
      '<circle class="map-node" cx="54" cy="84" r="10" style="stroke:var(--c-foundation)"/>' +
      '<circle class="map-node" cx="138" cy="42" r="10" style="stroke:var(--c-theory)"/>' +
      '<circle class="map-halo" cx="174" cy="126" r="31"/><circle class="map-center" cx="174" cy="126" r="15"/>' +
      '<circle class="map-node" cx="273" cy="67" r="10" style="stroke:var(--c-arch)"/>' +
      '<circle class="map-node" cx="323" cy="137" r="10" style="stroke:var(--c-os)"/>' +
      '<circle class="map-node" cx="266" cy="179" r="10" style="stroke:var(--c-eng)"/>' +
      '<text x="28" y="115">基础</text><text x="111" y="25">理论</text><text x="146" y="180">算法</text>' +
      '<text x="246" y="48">组成</text><text x="336" y="143">系统</text><text x="292" y="188">工程</text>' +
      '</svg><div class="map-caption"><span>知识连接示意</span><span>' + DOMAIN_IDS.length + ' 个领域</span></div></div>';
    root.innerHTML = '<div class="page home-page">' +
      '<section class="hero"><div class="hero-copy"><h1>计算机核心知识图谱</h1>' +
      '<p class="lead">沿前置关系，把当前目标中的 ' + total + ' 个知识点连成可走的学习路径。通过讲解、例子、自测和实践，逐步理解它们如何协同工作。</p>' +
      '<div class="hero-actions">' + routeSelector + '<a class="btn btn-primary" href="#/graph">查看知识图谱' + icon('arrowRight') + '</a></div></div>' + mapArt + '</section>' +
      '<div class="home-top">' + cont + prog + '</div>' +
      (KG.bigPicture ? '<section class="section" aria-labelledby="bp-title"><h2 id="bp-title">这些领域怎么连起来</h2><div class="prose big-picture">' + md(KG.bigPicture) + '</div></section>' : '') +
      '<section class="section" aria-labelledby="dm-title"><h2 id="dm-title">' + DOMAIN_IDS.length + ' 个领域</h2><div class="grid-2">' + domainCards + '</div></section>' +
      '<section class="section" aria-labelledby="qk-title"><h2 id="qk-title">快捷入口</h2><ul class="grid-3 plain-list">' + quick + '</ul>' +
      '<p class="muted small home-note">进度只存在这台电脑的浏览器里。换浏览器或清理浏览数据之前，先到<a href="#/about">关于本站</a>导出备份。</p></section>' +
      '</div>';
    return { title: null, nav: 'home' };
  }

  /* ================================================================ 图谱页 */
  function viewGraph(root, params, query) {
    root.innerHTML = '<div class="page graph-page">' +
      '<header class="page-head"><h1>知识图谱</h1>' + routeSelector + '<p>切换布局探索知识联系。点击节点或文字看详情，拖动平移。</p></header>' +
      '<div class="graph-host graph-full" id="graph-host"></div></div>';
    var host = $('#graph-host', root);
    var extra = {};
    if (query.focus && NODES[query.focus]) extra.focusId = query.focus;
    // 画布尽量填满一屏：视口高度减去顶栏、标题和控制条
    var top = host.getBoundingClientRect().top + window.scrollY;
    var narrow = window.innerWidth <= 640;
    extra.height = Math.round(Math.max(420, Math.min(900, window.innerHeight - top - (narrow ? 130 : 76))));
    var g = mountGraph(host, extra);
    // 控制条的实际高度要挂载后才知道：量一下，让画布底边刚好落在视口里
    function fitStage() {
      var stage = host.querySelector('.kgg-stage');
      if (!stage) return;
      var top = stage.getBoundingClientRect().top + window.scrollY;
      var h = Math.round(Math.max(380, Math.min(1000, window.innerHeight - top - 20)));
      if (Math.abs(stage.offsetHeight - h) > 2) stage.style.height = h + 'px';
    }
    var rt = 0;
    function onResize() { clearTimeout(rt); rt = setTimeout(fitStage, 150); }
    fitStage();
    window.addEventListener('resize', onResize);
    return {
      title: '知识图谱', nav: 'graph',
      cleanup: function () { clearTimeout(rt); window.removeEventListener('resize', onResize); g.destroy(); }
    };
  }

  /* ================================================================ 学习路线 */
  function stageProjects(ids,preferred) {
    var ps=(KG.projects||[]).filter(function(p){return p.nodeIds.some(function(id){return ids.indexOf(id)>=0;});});
    preferred=preferred||[];ps.sort(function(a,b){var ia=preferred.indexOf(a.id),ib=preferred.indexOf(b.id);return (ia<0?999:ia)-(ib<0?999:ib);});
    function item(p){var missing=window.KGProjects.prerequisites(p).filter(function(id){return !isLearned(id);});return '<li><a href="#/projects/'+esc(p.id)+'">'+esc(p.title)+'</a> · 将本阶段机制用于实作'+(missing.length?'；尚需补齐 '+missing.length+' 个前置':'；前置已自评掌握')+'</li>';}
    return ps.length?'<div class="stage-projects"><h4>实践这个阶段</h4><ul>'+ps.slice(0,2).map(item).join('')+'</ul>'+(ps.length>2?'<details><summary>其他项目</summary><ul>'+ps.slice(2).map(item).join('')+'</ul></details>':'')+'</div>':'';
  }
  function viewRoute(root) {
    var totalMin = sum(routeIds, function (id) { return NODES[id].estMinutes || 0; });
    function phaseIds(p) { return p.nodeIds.filter(function (id) { return NODES[id]; }); }
    function phaseHtml(p, i) {
      var ids = phaseIds(p);
      var mins = sum(ids, function (id) { return NODES[id].estMinutes || 0; });
      var s = stats('p:' + i);
      return '<li class="phase' + (s.total && s.done === s.total ? ' is-done' : '') + '" data-phase="' + i + '">' +
        '<div class="phase-marker" aria-hidden="true">' + (i + 1) + '</div>' +
        '<section class="card phase-card" aria-labelledby="ph-' + i + '">' +
        '<div class="phase-head"><h3 id="ph-' + i + '">' + esc(p.phase) + '</h3><span class="muted small">' + ids.length + ' 个知识点 · 约 ' + fmtMin(mins) + '</span></div>' +
        (p.goal ? '<p class="phase-goal">学完能做到：' + esc(p.goal) + '</p>' : '') +
        '<div class="meter-row phase-progress">' + meterHtml('p:' + i, null, p.phase + ' 进度') + statText('p:' + i, 'frac') + '</div>' +
        '<ul class="node-rows">' + ids.map(function (id) { return nodeRow(NODES[id], { showDomain: true }); }).join('') + '</ul>' +
        stageProjects(ids,p.projectIds) + (p.parallel ? '<p class="phase-parallel">' + icon('branch') + '<span>' + esc(p.parallel) + '</span></p>' : '') +
        '</section></li>';
    }

    // 相邻且 group 相同的阶段归成一组；没写 group 的阶段各自成组、不显示组标题
    var groups = [];
    ROUTE.forEach(function (p, i) {
      var last = groups[groups.length - 1];
      if (p.group && last && last.name === p.group) last.idx.push(i);
      else groups.push({ name: p.group || '', idx: [i] });
    });
    var named = groups.filter(function (g) { return g.name; }).length > 1;
    var body = groups.map(function (g, k) {
      var list = '<ol class="timeline">' + g.idx.map(function (i) { return phaseHtml(ROUTE[i], i); }).join('') + '</ol>';
      if (!named || !g.name) return list;
      var ids = [];
      g.idx.forEach(function (i) { ids = ids.concat(phaseIds(ROUTE[i])); });
      g.ids = ids;
      var mins = sum(ids, function (id) { return NODES[id].estMinutes || 0; });
      var first = g.idx[0] + 1, last = g.idx[g.idx.length - 1] + 1;
      g.range = first === last ? '阶段 ' + first : '阶段 ' + first + '–' + last;
      return '<section class="route-group" id="rg-' + k + '" aria-labelledby="rg-h-' + k + '">' +
        '<div class="route-group-head"><h2 id="rg-h-' + k + '">' + esc(g.name) + '</h2>' +
        '<span class="muted small">' + g.range + ' · ' + ids.length + ' 个知识点 · 约 ' + fmtMin(mins) + '</span></div>' +
        list + '</section>';
    }).join('');
    var index = named ? '<nav class="card route-index" aria-label="路线分组"><ol>' + groups.map(function (g, k) {
      if (!g.name) return '';
      return '<li><a href="#/route" data-scroll="rg-' + k + '"><span class="ri-name">' + esc(g.name) + '</span>' +
        '<span class="ri-meta">' + g.range + ' · ' + g.ids.length + ' 个</span></a>' +
        meterHtml('rg:' + k, null, g.name + ' 进度', g.ids) + '</li>';
    }).join('') + '</ol></nav>' : '';

    root.innerHTML = '<div class="page page-narrow route-page">' +
      '<header class="page-head"><h1>学习路线</h1>' + routeSelector +
      '<p class="lead">' + routeIds.length + ' 个知识点' + (named ? '按主题分成 ' + groups.length + ' 组、' : '分成 ') + ROUTE.length + ' 个阶段。' +
      '按目标选择路径；需要的基础排在使用之前。专题只在选择后计入目标进度。当前节点估时之和约 ' + fmtMin(totalMin) + '，学完一个就勾上它。</p>' +
      '<div class="meter-row route-total">' + meterHtml('all', null, '总进度') + statText('all', 'full') + '</div></header>' +
      courseTracksHtml() +
      (ROUTE.length ? index + body : '<div class="notice">' + icon('info') + '<p>还没有总路线。</p></div>') +
      '</div>';

    function onJump(e) {
      var a = e.target.closest('[data-scroll]');
      if (!a) return;
      e.preventDefault();
      var sec = document.getElementById(a.getAttribute('data-scroll'));
      if (!sec) return;
      sec.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
      var h = sec.querySelector('h2');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    root.addEventListener('click', onJump);
    return { title: '学习路线', nav: 'route', cleanup: function () { root.removeEventListener('click', onJump); } };
  }

  /* ================================================================ 领域页 */
  function courseTracksHtml(did) {
    var courses=TRACKS.filter(function(t){return t.domain && (!did || t.domain===did);});
    if(!courses.length)return '';
    return '<section class="section course-track-entry" aria-label="独立课程路线"><h2>按课程学习</h2><ul class="course-list">'+courses.map(function(t){
      var reading=(t.furtherReadIds||[]).filter(function(id){return NODES[id];});
      return '<li class="card"><a class="course-name" href="#/route" data-select-track="'+esc(t.id)+'">'+esc(t.title)+'</a><p class="muted small">'+esc(t.description||'')+' · '+t.nodeIds.length+' 个知识点</p>'+
        (t.entry?'<p class="small">入口能力：'+esc(t.entry)+'</p>':'')+
        (t.exitTask?'<p class="small">退出任务：'+esc(t.exitTask)+'</p>':'')+
        (reading.length?'<p class="small">进一步阅读：'+reading.map(function(id){return '<a href="#/n/'+esc(id)+'">'+esc(NODES[id].title)+'</a>';}).join('、')+'</p>':'')+'</li>';
    }).join('')+'</ul></section>';
  }

  function viewDomain(root, params, query) {
    var did = params[0];
    var d = DOM[did];
    if (!d) return view404(root);
    var list = byDomain[did] || [];
    var staged = {};
    d.stages.forEach(function (s) { s.nodeIds.forEach(function (id) { staged[id] = 1; }); });
    var others = list.filter(function (n) { return !staged[n.id]; });
    var dq = quizByDomain[did];

    function stageBlock(s, key, ids) {
      ids = ids.filter(function (id) { return NODES[id]; }).sort(byOrder);
      var mins = sum(ids, function (id) { return NODES[id].estMinutes || 0; });
      return '<div class="stage-block" id="stage-' + esc(s.id) + '">' +
        '<div class="stage-head"><h3>' + esc(s.name) + '</h3><span class="muted small">' + ids.length + ' 个知识点 · 约 ' + fmtMin(mins) + '</span></div>' +
        (s.goal ? '<p class="stage-goal">学完能做到：' + esc(s.goal) + '</p>' : '') +
        '<div class="meter-row">' + meterHtml(key, did, s.name + ' 进度', ids) + statText(key, 'frac') + '</div>' +
        '<ul class="node-rows">' + ids.map(function (id) { return nodeRow(NODES[id], { order: true, level: true }); }).join('') + '</ul>'+stageProjects(ids)+'</div>';
    }

    var stagesHtml = d.stages.map(function (s) { return stageBlock(s, 's:' + s.id, s.nodeIds.slice()); }).join('') +
      (others.length ? stageBlock({ id: 'other', name: '其他', goal: '' }, 'x:' + did, others.map(function (n) { return n.id; })) : '');

    function featuredCourseHtml(fc) {
      if (!fc || !fc.labs || !fc.labs.length) return '';
      var courseUrl = safeUrl(fc.url), toolsUrl = safeUrl(fc.toolsUrl), bookUrl = safeUrl(fc.bookUrl);
      var phases = (fc.phases || []).map(function (p, i) {
        return '<li class="mit-phase"><span class="mit-phase-num">' + (i + 1) + '</span><div><h3>' + esc(p.name) + '</h3>' +
          (p.lectures ? '<p class="muted small">' + esc(p.lectures) + '</p>' : '') +
          (p.topics && p.topics.length ? '<p>' + p.topics.map(function (x) { return '<span class="badge">' + esc(x) + '</span>'; }).join(' ') + '</p>' : '') +
          (p.labIds && p.labIds.length ? '<p class="small"><strong>实验：</strong>' + p.labIds.map(function (x) { return '<a href="#/d/' + esc(did) + '?lab=' + encodeURIComponent(x) + '">' + esc(x) + '</a>'; }).join(' → ') + '</p>' : '') + '</div></li>';
      }).join('');
      var labs = fc.labs.map(function (lab, i) {
        var url = safeUrl(lab.url);
        var linked = (lab.nodeIds || []).filter(function (id) { return NODES[id]; });
        return '<li class="card mit-lab" id="mit-lab-' + esc(lab.id) + '">' +
          '<div class="mit-lab-head"><span class="mit-lab-num">' + (i + 1) + '</span><div>' +
          (url ? '<a class="mit-lab-title" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(lab.title) + icon('external', 'ext-ic') + '</a>' : '<span class="mit-lab-title">' + esc(lab.title) + '</span>') +
          (lab.focus ? '<p class="muted small">' + esc(lab.focus) + '</p>' : '') + '</div></div>' +
          (lab.tasks && lab.tasks.length ? '<ul class="mit-task-list">' + lab.tasks.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
          (linked.length ? '<div class="mit-node-links"><span class="muted small">先学：</span>' + linked.map(function (id) { return '<a class="badge" href="#/n/' + esc(id) + '">' + esc(NODES[id].title) + '</a>'; }).join('') + '</div>' : '') +
          '<div class="mit-lab-check"><code>git checkout ' + esc(lab.branch || lab.id) + '</code><code>' + esc(lab.verify || 'make grade') + '</code></div></li>';
      }).join('');
      return '<section class="section featured-course" id="mit-1810" aria-labelledby="mit-title"><div class="section-head"><div><p class="eyebrow">重点动手课程</p><h2 id="mit-title">' + esc(fc.title) + (fc.term ? '（' + esc(fc.term) + '）' : '') + '</h2></div>' +
        (courseUrl ? '<a class="small" href="' + esc(courseUrl) + '" target="_blank" rel="noopener">官方课表' + icon('external', 'ext-ic') + '</a>' : '') + '</div>' +
        (fc.overview ? '<p class="mit-overview">' + esc(fc.overview) + '</p>' : '') +
        '<div class="btn-row mit-links">' +
        (toolsUrl ? '<a class="btn btn-ghost btn-sm" href="' + esc(toolsUrl) + '" target="_blank" rel="noopener">环境配置</a>' : '') +
        (bookUrl ? '<a class="btn btn-ghost btn-sm" href="' + esc(bookUrl) + '" target="_blank" rel="noopener">xv6 教材</a>' : '') + '</div>' +
        (fc.repoCommand ? '<div class="mit-repo"><span class="muted small">2025 实验仓库</span><code>' + esc(fc.repoCommand) + '</code><p class="muted small">请使用课程实验仓库；普通的 xv6-riscv 仓库没有各实验分支和测试脚本。</p></div>' : '') +
        (phases ? '<h3 class="mit-subtitle">课程内容</h3><ol class="mit-phases">' + phases + '</ol>' : '') +
        '<div class="mit-labs-head"><div><h3>9 个 xv6 实验</h3><p class="muted small">按 MIT 2025 秋课程顺序排列。每个实验切到独立分支，完成后以 <code>make grade</code> 为验收依据。</p></div></div>' +
        '<ol class="mit-labs">' + labs + '</ol></section>';
    }

    root.innerHTML = '<div class="page domain-page d-' + did + '">' +
      '<nav class="breadcrumb" aria-label="面包屑"><a href="#/">首页</a><span aria-hidden="true">›</span><span aria-current="page">' + esc(d.name) + '</span></nav>' +
      '<header class="domain-head"><h1>' + shape(did, 'xl') + esc(d.name) + '</h1>' +
      (d.tagline ? '<p class="lead">' + esc(d.tagline) + '</p>' : '') +
      (d.summary ? '<p class="domain-summary">' + esc(d.summary) + '</p>' : '') +
      '<div class="meter-row domain-progress">' + meterHtml('d:' + did, did, d.short + '进度') + statText('d:' + did, 'full') + '</div>' +
      '<div class="btn-row domain-actions"><a class="btn" href="#/resources?domain=' + did + '">' + icon('book') + '本领域资源</a>' +
      '<a class="btn" href="#/review?domain=' + did + '">' + icon('cards') + '复习本领域</a>' +
      (d.featuredCourse ? '<a class="btn" href="#/d/' + did + '?course=1">MIT xv6 实验路线</a>' : '') +
      (dq && dq.sections.length ? '<a class="btn" href="#/d/' + did + '?quiz=1">' + icon('quiz') + '板块测验</a>' : '') + '</div></header>' +
      courseTracksHtml(did) +
      '<section class="section" aria-labelledby="st-title"><h2 id="st-title">学习阶段</h2>' + (stagesHtml || '<p class="muted">这个领域还没有内容。</p>') + '</section>' +
      (dq && dq.sections.length ? '<section class="section" id="domain-quiz" aria-labelledby="dq-title"><div class="section-head"><h2 id="dq-title">板块测验</h2>' +
        '<a class="small" href="#/quiz/' + did + '">在测验总览里看</a></div>' +
        '<p class="qz-intro">' + esc(dq.intro || '每个学习阶段一节，最后一节是综合题。学完一个阶段就做对应的一节，检验是不是真的弄懂了。') + '</p>' +
        '<ul class="qz-secs">' + dq.sections.map(quizSecRow).join('') + '</ul></section>' : '') +
      featuredCourseHtml(d.featuredCourse) +
      '<section class="section" aria-labelledby="dg-title"><div class="section-head"><h2 id="dg-title">本领域图谱</h2><a href="#/graph" class="small">看全部领域</a></div>' +
      '<div class="graph-host graph-domain" id="domain-graph"></div></section>' +
      (d.courses.length ? '<section class="section" aria-labelledby="cs-title"><h2 id="cs-title">对应课程</h2><ul class="course-list">' +
        d.courses.map(function (c) {
          var url = safeUrl(c.url);
          return '<li class="card">' + (url ? '<a class="course-name" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(c.name) + icon('external', 'ext-ic') + '</a>' : '<span class="course-name">' + esc(c.name) + '</span>') +
            (c.note ? '<p class="muted small">' + esc(c.note) + '</p>' : '') + '</li>';
        }).join('') + '</ul></section>' : '') +
      (d.bestOverallResources.length ? '<section class="section" aria-labelledby="br-title"><h2 id="br-title">本领域推荐资源</h2><ul class="res-list">' +
        d.bestOverallResources.map(function (r) { return resCard(r); }).join('') + '</ul></section>' : '') +
      '</div>';

    var g = mountGraph($('#domain-graph', root), { filterDomain: did, height: window.innerWidth <= 640 ? 400 : 480 });
    var target = null;
    if (query.stage) {
      target = document.getElementById('stage-' + query.stage);
      if (target) target.classList.add('is-target');
    } else if (query.quiz) {
      target = document.getElementById('domain-quiz');
    } else if (query.lab) {
      target = document.getElementById('mit-lab-' + query.lab);
    } else if (query.course) {
      target = document.getElementById('mit-1810');
    }
    if (target) setTimeout(function () { target.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }); }, 30);
    return { title: d.name, nav: null, cleanup: g.destroy, keepScroll: !!target };
  }

  /* ================================================================ 节点页 */
  function viewNode(root, params) {
    var id = params[0];
    var n = NODES[id];
    if (!n) return view404(root);
    P.learningEvidence=P.learningEvidence || {};
    P.learningEvidence['visited:'+id]={at:new Date().toISOString()};
    P.last=id; saveProgress();
    var d = DOM[n.domain] || { id: n.domain, short: n.domain, name: n.domain };
    var st = n.stage && stageById[n.stage];
    var prereqs = prereqIn[id].map(function (x) { return NODES[x]; });
    var missing = prereqs.filter(function (p) { return !isLearned(p.id); });
    var nexts = nextIn[id].map(function (x) { return NODES[x]; });
    var connText = {};
    (n.connections || []).forEach(function (c) { if (!(c.id in connText)) connText[c.id] = c.text; });

    var crossItems = [], seen = {};
    crossOf[id].forEach(function (x) {
      if (seen[x.other]) return;
      seen[x.other] = 1;
      crossItems.push({ n: NODES[x.other], rel: relLabel(x.edge.kind, x.out), text: x.edge.label || connText[x.other] || '' });
    });
    (n.connections || []).forEach(function (c) {
      if (seen[c.id] || !NODES[c.id] || prereqIn[id].indexOf(c.id) >= 0 || nextIn[id].indexOf(c.id) >= 0) return;
      seen[c.id] = 1;
      crossItems.push({ n: NODES[c.id], rel: '', text: c.text });
    });

    function connItem(m, o) {
      return '<li class="conn-item d-' + m.domain + '">' + shape(m.domain) + '<div class="ci-main"><div class="ci-line">' +
        (o.rel ? '<span class="ci-rel">' + esc(o.rel) + '</span>' : '') +
        '<a class="ci-title" href="#/n/' + esc(m.id) + '">' + esc(m.title) + '</a><span class="ci-dom">' + esc(domName(m.domain)) + '</span>' +
        (o.status ? statusHtml(m.id) : '') + '</div>' +
        (o.text ? '<div class="ci-text">' + mdi(o.text) + '</div>' : '') + '</div></li>';
    }

    var demo = n.demo && demoById[n.demo];
    var draft = !!n.draft;
    var contentNote = n.contentStatus === 'needs-worked-example' ? '<div class="notice">本节机制说明已整理，完整算例仍待补齐；下面的练习指令不作为参考解答。</div>' : '';
    var S = [];
    var childIds = [];
    ((KG.learningMap || {}).mappings || []).filter(function(entry){return entry.parentId===n.id;}).forEach(function(entry){entry.nodeIds.forEach(function(id){if(id!==n.id && childIds.indexOf(id)<0)childIds.push(id);});});
    if(childIds.length) S.push(['children','细分学习','<p>可按需要展开的学习单元；这些层级链接不是全部必修前置。</p><ul>'+childIds.map(function(id){return '<li><a href="#/n/'+esc(id)+'">'+esc(NODES[id].title)+'</a></li>';}).join('')+'</ul>']);
    var relatedProjects = (KG.projects || []).filter(function(p){return p.nodeIds.indexOf(n.id)>=0;});
    if(relatedProjects.length) S.push(['projects','自主实践项目','<ul>'+relatedProjects.map(function(p){return '<li><a href="#/projects/'+esc(p.id)+'">'+esc(p.title)+'</a></li>';}).join('')+'</ul>']);
    if (n.why) S.push(['why', '为什么要学', '<div class="prose">' + md(n.why) + '</div>']);
    if (n.feynman) S.push(['feynman', '用大白话讲', '<div class="prose">' + md(n.feynman) + '</div>']);
    if (n.primer && n.primer.length) {
      S.push(['primer', '先补一下', '<p class="muted">本节会用到下面这些概念。每条用几句话讲到够用，想深挖再点进对应知识点。</p><ul class="primer-list">' + n.primer.map(function (p) {
        var link = p.id && NODES[p.id] ? '<a href="#/n/' + esc(p.id) + '">' + esc(NODES[p.id].title) + ' →</a>' : '';
        return '<li class="primer-item"><div class="primer-term">' + mdi(p.term) + link + '</div><div class="prose">' + md(p.text) + '</div></li>';
      }).join('') + '</ul>']);
    }
    if (n.intuition) S.push(['intuition', draft ? '常见类比' : '直觉', '<div class="prose">' + md(n.intuition) + '</div>']);
    if (n.core) S.push(['core', draft ? '要讲的要点' : '核心机制', '<div class="prose">' + md(n.core) + '</div>']);
    if (n.example) S.push(['example', '例子', '<div class="prose">' + md(n.example) + '</div>']);
    if (demo) {
      S.push(['demo', '动手试试', '<div class="demo-frame"><p class="demo-caption"><a href="#/lab/' + esc(demo.id) + '">' + esc(demo.title) + '</a><span>' + esc(demo.desc) + '</span></p>' +
        '<div class="demo-host" id="node-demo"></div></div>' +
        '<ul>'+DEMOS.filter(function(d){return d.id!==demo.id && (d.nodeIds||[]).indexOf(n.id)>=0;}).map(function(d){return '<li><a href="#/lab/'+esc(d.id)+'">继续实验：'+esc(d.title)+'</a></li>';}).join('')+'</ul>']);
    }
    if (n.pitfalls && n.pitfalls.length) {
      S.push(['pitfalls', '常见误区', '<ul class="pitfalls">' + n.pitfalls.map(function (p) {
        return '<li>' + icon('alert') + '<div class="prose">' + md(p) + '</div></li>';
      }).join('') + '</ul>']);
    }
    if (n.keyTerms && n.keyTerms.length) {
      S.push(['terms', '关键词', '<div class="table-wrap"><table class="terms"><thead><tr><th scope="col">中文</th><th scope="col">英文</th><th scope="col">解释</th></tr></thead><tbody>' +
        n.keyTerms.map(function (t) {
          return '<tr><td>' + esc(t.zh) + '</td><td lang="en">' + esc(t.en) + '</td><td>' + mdi(t.def) + '</td></tr>';
        }).join('') + '</tbody></table></div>']);
    }
    S.push(['links', '知识联系',
      '<div class="conn-group"><h3>前置知识</h3>' + (prereqs.length ? '<ul class="conn-list">' + prereqs.map(function (p) { return connItem(p, { status: true, text: connText[p.id] }); }).join('') + '</ul>' : '<p class="muted small">没有前置，可以直接学。</p>') + '</div>' +
      '<div class="conn-group"><h3>学完可以去学</h3>' + (nexts.length ? '<ul class="conn-list">' + nexts.map(function (p) { return connItem(p, { status: true, text: connText[p.id] }); }).join('') + '</ul>' : '<p class="muted small">本领域里没有以它为前置的知识点。</p>') + '</div>' +
      '<div class="conn-group"><h3>跨领域联系</h3>' + (crossItems.length ? '<ul class="conn-list">' + crossItems.map(function (c) { return connItem(c.n, { rel: c.rel, text: c.text }); }).join('') + '</ul>' : '<p class="muted small">暂时没有记录跨领域联系。</p>') + '</div>']);
    if (n.quiz && n.quiz.length) {
      S.push(['quiz', '自测', '<ol class="quiz-list">' + n.quiz.map(function (q, i) {
        return '<li class="quiz-card"><div class="qk"><span>第 ' + (i + 1) + ' 题</span><span class="badge">' + (QUIZ_KIND[q.kind] || '概念') + '</span></div>' +
          '<div class="prose quiz-q">' + md(q.q) + '</div>' +
          (q.context ? '<section class="fc-context prose" aria-label="题目材料"><h3>题目材料</h3>' + md(q.context) + '</section>' : '') +
          '<details><summary>' + icon('chevronRight') + '看答案</summary><div class="prose quiz-a">' + md(q.a) + '</div></details></li>';
      }).join('') + '</ol><p class="muted small">这些题也会出现在<a href="#/review">复习</a>的闪卡里。</p>']);
    }
    if (n.interviewQuestions && n.interviewQuestions.length) {
      var iqType = { coding: '编程', concept: '概念', trace: '追踪', 'system-design': '系统设计', 'ml-design': '机器学习设计' };
      var iqDiff = { easy: '基础', medium: '中等', hard: '困难' };
      S.push(['interview', '面试与笔试题', '<ol class="interview-list">' + n.interviewQuestions.map(function (q, i) {
        var source = '<a class="iq-source" href="' + esc(q.sourceUrl) + '" target="_blank" rel="noopener">' + esc(q.sourceLabel) + '</a>';
        return '<li class="interview-card"><div class="qk"><span>题 ' + (i + 1) + '</span><span class="badge">' + esc(iqType[q.type] || '概念') + '</span>' +
          '<span class="badge">' + esc(iqDiff[q.difficulty] || '中等') + '</span><span class="badge badge-tier">证据 ' + esc(q.sourceTier || 'C') + '</span>' +
          (q.company ? '<span class="badge badge-company">' + esc(q.company) + '</span>' : '') + (q.isAdapted ? '<span class="iq-adapted">改编</span>' : '') + '</div>' +
          '<div class="prose quiz-q">' + md(q.question) + '</div><p class="iq-evidence">来源：' + source + '</p>' +
          '<details><summary>' + icon('chevronRight') + '看分析与答案</summary><div class="iq-split"><div><h3>分析</h3><div class="prose">' + md(q.analysis) + '</div></div>' +
          '<div><h3>参考答案</h3><div class="prose">' + md(q.answer) + '</div></div></div>' +
          (q.knowledgeGaps && q.knowledgeGaps.length ? '<p class="iq-gaps"><strong>暴露的知识缺口：</strong>' + q.knowledgeGaps.map(esc).join('、') + '</p>' : '') + '</details></li>';
      }).join('') + '</ol><p class="muted small">A = 公司官方材料；B = 候选人一手复盘（非官方）；C = 按公开考查范围改编。只有 A/B 级题会显示公司名。</p>']);
    }
    if (n.resources && n.resources.length) {
      S.push(['resources', '学习资源', '<ul class="res-list">' + n.resources.map(function (r) { return resCard(r); }).join('') + '</ul>']);
    }

    var toc = '<ol>' + S.map(function (s) { return '<li><a href="#/n/' + esc(id) + '" data-scroll="sec-' + s[0] + '">' + s[1] + '</a></li>'; }).join('') + '</ol>';
    var list = byDomain[n.domain] || [];
    var idx = list.indexOf(n);
    var prev = list[idx - 1], next = list[idx + 1];
    var rn = id in routePos ? NODES[routeIds[routePos[id] + 1]] : null;

    // 「这个知识点出现在 N 道测验题里」，按节分组
    var qids = quizByNode[id] || [];
    var qGroups = [], qgBy = {};
    qids.slice().sort(quizOrder).forEach(function (qid) {
      var sid = quizQ[qid].sec.id;
      if (!qgBy[sid]) { qgBy[sid] = { sid: sid, n: 0 }; qGroups.push(qgBy[sid]); }
      qgBy[sid].n++;
    });
    var quizLine = qids.length ? '<p class="quiz-mention">' + icon('quiz') + '<span>这个知识点出现在 ' + qids.length + ' 道测验题里：' +
      qGroups.map(function (g) {
        var x = quizSec[g.sid];
        return '<a href="' + quizSecHref(g.sid) + '">' + (x.quiz.domain !== n.domain ? esc(domName(x.quiz.domain)) + ' · ' : '') + esc(x.sec.title) + '</a>（' + g.n + ' 道）';
      }).join('、') + '</span></p>' : '';

    root.innerHTML = '<div class="page node-page d-' + n.domain + '"><div class="node-layout">' +
      '<article class="node-article">' +
      '<nav class="breadcrumb" aria-label="面包屑"><a class="dom-tag" href="#/d/' + d.id + '">' + shape(d.id) + esc(d.short) + '</a>' +
      (st ? '<span aria-hidden="true">›</span><a href="#/d/' + d.id + '?stage=' + encodeURIComponent(st.stage.id) + '">' + esc(st.stage.name) + '</a>' : '') +
      '<span aria-hidden="true">›</span><span aria-current="page">' + esc(n.title) + '</span></nav>' +
      '<header class="node-head"><h1>' + esc(n.title) + (n.en ? '<span class="en" lang="en">' + esc(n.en) + '</span>' : '') + '</h1>' +
      '<div class="badges"><span class="badge">' + shape(d.id) + esc(d.short) + '</span><span class="badge">' + LEVEL[n.level] + '</span>' +
      '<span class="badge">' + icon('clock') + '约 ' + fmtMin(n.estMinutes) + '</span>' + (draft ? '<span class="badge badge-draft">草稿</span>' : '') + '</div>' +
      '<div class="node-actions">' + switchHtml(id) +
      (missing.length ? '<p class="prereq-hint">' + icon('info') + '<span>建议先学：' + missing.map(function (p) { return '<a href="#/n/' + esc(p.id) + '">' + esc(p.title) + '</a>'; }).join('、') + '</span></p>' : '') +
      '</div></header>' +
      (n.oneLiner ? '<p class="callout oneliner">' + esc(n.oneLiner) + '</p>' : '') +
      contentNote + (draft ? '<div class="notice">' + icon('info') + '<p>这个知识点的正文还在写。下面先列出要讲的要点、常见误区和候选资源。</p></div>' : '') +
      '<details class="toc-mobile"><summary>本页目录</summary><nav class="toc" aria-label="本页目录">' + toc + '</nav></details>' +
      S.map(function (s) {
        return '<section class="node-section" id="sec-' + s[0] + '" aria-labelledby="h-' + s[0] + '"><h2 id="h-' + s[0] + '">' + s[1] + '</h2>' + s[2] + '</section>';
      }).join('') + quizLine +
      '<nav class="node-pager" aria-label="同领域的上一个和下一个">' +
      (prev ? '<a class="pager-link prev" href="#/n/' + esc(prev.id) + '"><span class="pl-label">' + icon('arrowLeft') + '上一个</span><span class="pl-title">' + esc(prev.title) + '</span></a>' : '<span></span>') +
      (next ? '<a class="pager-link next" href="#/n/' + esc(next.id) + '"><span class="pl-label">下一个' + icon('arrowRight') + '</span><span class="pl-title">' + esc(next.title) + '</span></a>' : '<span></span>') +
      '</nav>' +
      (rn ? '<p class="route-next">按总路线，下一个是 ' + shape(rn.domain) + '<a href="#/n/' + esc(rn.id) + '">' + esc(rn.title) + '</a><span class="muted">（' + esc(domName(rn.domain)) + '）</span></p>' : '') +
      '</article>' +
      '<aside class="node-aside" aria-label="本页导航"><nav class="card aside-card toc" aria-label="目录"><div class="toc-title">目录</div>' + toc + '</nav>' +
      '<div class="card aside-card"><div class="toc-title">相邻的知识点</div><div class="graph-host graph-mini" id="mini-graph"></div>' +
      '<a class="small aside-more" href="#/graph?focus=' + encodeURIComponent(id) + '">在完整图谱里看' + icon('arrowRight') + '</a></div>' +
      '<div class="aside-switch">' + switchHtml(id) + '</div></aside>' +
      '</div></div>';

    var cleanups = [];

    // 目录跳转
    var fixTimer = 0;
    function onTocClick(e) {
      var a = e.target.closest('[data-scroll]');
      if (!a) return;
      e.preventDefault();
      var det = a.closest('details');
      if (det) det.open = false;
      var sec = document.getElementById(a.getAttribute('data-scroll'));
      if (!sec) return;
      sec.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
      var h = sec.querySelector('h2');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      // 滚动途中演示可能刚挂载、把后面的内容往下推，滚完再校正一次
      clearTimeout(fixTimer);
      var fix = function () {
        clearTimeout(fixTimer);
        window.removeEventListener('scrollend', fix);
        var want = parseFloat(getComputedStyle(sec).scrollMarginTop) || 0;
        if (Math.abs(sec.getBoundingClientRect().top - want) > 12) sec.scrollIntoView({ block: 'start' });
      };
      if ('onscrollend' in window) window.addEventListener('scrollend', fix);
      fixTimer = setTimeout(fix, 1200);
    }
    root.addEventListener('click', onTocClick);
    cleanups.push(function () { clearTimeout(fixTimer); root.removeEventListener('click', onTocClick); });

    // 当前小节高亮：标题越过视口上方 30% 的最后一节
    var tocLinks = $$('[data-scroll]', root);
    var secs = $$('.node-section', root);
    var ticking = false;
    function markToc() {
      ticking = false;
      if (!secs.length) return;
      var line = Math.min(window.innerHeight * 0.3, 260);
      var cur = secs[0];
      for (var i = 0; i < secs.length; i++) {
        if (secs[i].getBoundingClientRect().top <= line) cur = secs[i];
        else break;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = secs[secs.length - 1];
      tocLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-scroll') === cur.id); });
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(markToc); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    markToc();
    cleanups.push(function () { window.removeEventListener('scroll', onScroll); });

    // 迷你图谱：只在侧栏可见时挂载
    var mini = null;
    var wide = window.matchMedia ? matchMedia('(min-width: 1101px)') : null;
    function syncMini() {
      var want = !wide || wide.matches;
      if (want && !mini) mini = mountGraph($('#mini-graph', root), { focusId: id, mini: true });
      else if (!want && mini) { mini.destroy(); mini = null; $('#mini-graph', root).innerHTML = ''; }
    }
    syncMini();
    if (wide && wide.addEventListener) {
      wide.addEventListener('change', syncMini);
      cleanups.push(function () { wide.removeEventListener('change', syncMini); });
    }
    cleanups.push(function () { if (mini) mini.destroy(); });

    // 演示：滚到附近再挂载
    if (demo) {
      var host = $('#node-demo', root);
      var dh = null;
      var mountIt = function () { if (!dh) dh = mountDemo(host, demo); };
      if ('IntersectionObserver' in window) {
        var dio = new IntersectionObserver(function (entries) {
          if (entries.some(function (en) { return en.isIntersecting; })) { dio.disconnect(); mountIt(); }
        }, { rootMargin: '300px 0px' });
        dio.observe(host);
        cleanups.push(function () { dio.disconnect(); });
      } else mountIt();
      cleanups.push(function () { if (dh) dh.destroy(); });
    }

    return {
      title: n.title, nav: null,
      cleanup: function () { cleanups.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
    };
  }

  /* ================================================================ 复习 */
  var reviewState = { scope: 'all', learnedOnly: true, limit: 20 };

  function cardsInScope() {
    return CARDS.filter(function (c) {
      var n = NODES[c.nid];
      return (reviewState.scope === 'all' || n.domain === reviewState.scope) && (!reviewState.learnedOnly || isLearned(c.nid));
    });
  }
  function cardOrder(today) {
    return function (a, b) {
      var ra = P.cards[a.id], rb = P.cards[b.id];
      var da = ra ? ra.due : today, db = rb ? rb.due : today;
      if (da !== db) return da < db ? -1 : 1;
      if (!!ra !== !!rb) return ra ? -1 : 1; // 复习过的到期卡先于新卡
      return (ra ? ra.box : 0) - (rb ? rb.box : 0) || posOf(a.nid) - posOf(b.nid) || (a.id < b.id ? -1 : 1);
    };
  }
  function dueCards(list) {
    var today = todayStr();
    return list.filter(function (c) { var r = P.cards[c.id]; return !r || r.due <= today; }).sort(cardOrder(today));
  }

  function viewReview(root, params, query) {
    if (query.domain && DOM[query.domain]) reviewState.scope = query.domain;
    var queue = [], practice = false, flipped = false, reviewed = 0, practiced = {};

    function rebuild() {
      var list = cardsInScope();
      queue = (practice ? list.filter(function(c){return !practiced[c.id];}).sort(cardOrder(todayStr())) : dueCards(list)).slice(0,reviewState.limit);
      reviewed=0;
      flipped = false;
    }

    root.innerHTML = '<div class="page page-narrow review-page">' +
      '<header class="page-head"><h1>复习</h1><p class="lead">题目来自各知识点的自测题。用莱特纳盒子安排间隔：答「会了」升一盒，「模糊」留在原盒，「不会」回到第 0 盒；第 0–4 盒分别隔 0、1、2、4、8 天再出现。</p></header>' +
      '<div class="review-tools"><div class="chips" role="group" aria-label="复习范围" id="rv-scope"></div>' +
      '<label class="check-label"><input type="checkbox" id="rv-learned"' + (reviewState.learnedOnly ? ' checked' : '') + '>只出自评掌握知识点的题</label></div>' +
      '<p class="small">每批最多 20 张；提前练习不改变正常到期计划。做错后今天会重现，达到批次上限可休息后再练。</p><div class="review-stats" id="rv-stats"></div>' +
      '<div id="rv-area" aria-live="polite"></div>' +
      '<p class="kbd-hint"><kbd>空格</kbd> 翻面 · <kbd>1</kbd> 不会 · <kbd>2</kbd> 模糊 · <kbd>3</kbd> 会了</p></div>';

    var scopeEl = $('#rv-scope', root), statsEl = $('#rv-stats', root), area = $('#rv-area', root);

    function drawScope() {
      var opts = [['all', '全部', '']].concat(DOMS.map(function (d) { return [d.id, d.short, shape(d.id)]; }));
      scopeEl.innerHTML = opts.map(function (o) {
        return '<button type="button" class="chip" data-scope="' + o[0] + '" aria-pressed="' + (reviewState.scope === o[0]) + '">' + o[2] + esc(o[1]) + '</button>';
      }).join('');
    }
    function drawStats() {
      var list = cardsInScope();
      var boxes = [0, 0, 0, 0, 0], fresh = 0;
      list.forEach(function (c) { var r = P.cards[c.id]; if (r) boxes[r.box]++; else fresh++; });
      statsEl.innerHTML = '<span>' + (practice ? '提前复习，还剩 ' : '今日剩余 ') + '<strong>' + queue.length + '</strong> 张' +
        (reviewed ? ' · 这次已复习 ' + reviewed + ' 张' : '') + '</span>' +
        '<ul class="box-stats" aria-label="各盒卡片数"><li>新卡 <b>' + fresh + '</b></li>' +
        boxes.map(function (b, i) { return '<li>第 ' + i + ' 盒 <b>' + b + '</b></li>'; }).join('') + '</ul>';
    }
    function gradeHint(box) {
      var up = Math.min(4, box + 1);
      function when(b) { return BOX_DAYS[b] === 0 ? '今天再出现' : BOX_DAYS[b] + ' 天后'; }
      return '不会：回到第 0 盒，今天再出现；模糊：留在第 ' + box + ' 盒，' + when(box) + '；会了：升到第 ' + up + ' 盒，' + when(up) + '。';
    }
    function draw() {
      drawStats();
      var list = cardsInScope();
      // 没有卡可翻时，快捷键提示也收起来
      var kh = $('.kbd-hint', root);
      if (kh) kh.hidden = !list.length || !queue.length;
      if (!list.length) {
        area.innerHTML = '<div class="card review-empty"><h2>这个范围里还没有题</h2><p>' +
          (reviewState.learnedOnly ? '还没有标记为自评掌握的知识点。学完一个知识点后，在它的页面上打开「标记为自评掌握」。' : '这个领域的知识点还没有自测题。') + '</p>' +
          '<div class="btn-row"><a class="btn" href="#/route">去学习路线</a></div></div>';
        return;
      }
      if (!queue.length) {
        var upcoming = list.map(function (c) { return P.cards[c.id] && P.cards[c.id].due; }).filter(Boolean).sort();
        var nextDue = upcoming.find(function (x) { return x > todayStr(); });
        var nextCount = nextDue ? upcoming.filter(function (x) { return x === nextDue; }).length : 0;
        var remaining=list.filter(function(c){return !practiced[c.id];}).length;
        area.innerHTML = '<div class="card review-empty"><h2>' + (practice ? (remaining ? '本批提前练习完成' : '这个范围的提前练习已全部完成') : '当前批次复习完了') + '</h2>' +
          '<p>' + (practice ? '本次练习已覆盖 '+(list.length-remaining)+' / '+list.length+' 张，剩余 '+remaining+' 张。' : (nextDue ? '下一批在 '+fmtDay(nextDue)+'到期，共 '+nextCount+' 张。' : '')) + '提前练习不改变到期计划；切换范围或掌握筛选会开始新的练习会话。</p>' +
          '<div class="btn-row"><button type="button" class="btn" data-act="batch">继续正常复习下一批</button>' +
          (remaining ? '<button type="button" class="btn btn-primary" data-act="practice">'+(practice?'继续提前练习下一批':'提前练习（不改到期计划）')+'，剩余 '+remaining+' 张</button>' : '') +
          (practice ? '<button type="button" class="btn" data-act="practice-restart">从第一张重新练习</button>' : '')+'</div></div>';
        return;
      }
      var c = queue[0], n = NODES[c.nid], rec = P.cards[c.id];
      var box = rec ? rec.box : 0;
      area.innerHTML = '<article class="flashcard d-' + n.domain + '" aria-label="闪卡">' +
        '<header class="fc-head">' + domTag(n.domain) + '<span class="sep" aria-hidden="true">·</span><a href="#/n/' + esc(n.id) + '">' + esc(n.title) + '</a>' +
        '<span class="badge">' + (QUIZ_KIND[c.kind] || '概念') + '</span><span class="fc-box">' + (rec ? '第 ' + rec.box + ' 盒' : '新卡') + '</span></header>' +
        '<div class="fc-q prose">' + md(c.q) + '</div>' +
        (c.context ? '<section class="fc-context prose" aria-label="题目材料"><h3>题目材料</h3>' + md(c.context) + '</section>' : '') +
        (flipped ? '<div class="fc-a"><div class="fc-a-label">答案</div><div class="prose">' + md(c.a) + '</div></div>' : '') +
        '<footer class="fc-actions">' + (flipped
          ? '<div class="grade-btns" role="group" aria-label="这张卡你掌握得怎么样">' +
            '<button type="button" class="btn btn-lg" data-grade="1">不会 <kbd>1</kbd></button>' +
            '<button type="button" class="btn btn-lg" data-grade="2">模糊 <kbd>2</kbd></button>' +
            '<button type="button" class="btn btn-lg btn-primary" data-grade="3">会了 <kbd>3</kbd></button></div>' +
            '<p class="grade-hint">' + gradeHint(box) + '</p>'
          : '<button type="button" class="btn btn-lg btn-primary" data-act="flip">翻面看答案 <kbd>空格</kbd></button>') +
        '</footer><p class="small"><a href="#/n/' + esc(n.id) + '">查看来源知识点：「' + esc(n.title) + '」的完整说明与例子</a></p></article>';
    }
    function flip() {
      if (!queue.length || flipped) return;
      flipped = true;
      draw();
      var b = $('[data-grade="3"]', area);
      if (b) b.focus({ preventScroll: true });
    }
    function grade(g) {
      var c = queue[0];
      if (!c || !flipped) return;
      var rec = P.cards[c.id];
      var box = rec ? rec.box : 0;
      if (g === 1) box = 0;
      else if (g === 3) box = Math.min(4, box + 1);
      var today = todayStr();
      var due = addDays(today, BOX_DAYS[box]);
      if (practice) practiced[c.id]=true;
      if (!practice) { P.cards[c.id] = { box: box, due: due }; saveProgress(); }
      reviewed++;
      queue.shift();
      if (!practice && due <= today) queue.push(c);
      if (reviewed >= reviewState.limit) queue=[];
      flipped = false;
      draw();
      var fb = $('[data-act="flip"]', area) || $('[data-act="practice"]', area);
      if (fb) fb.focus({ preventScroll: true });
    }

    function onClick(e) {
      var t = e.target.closest('button');
      if (!t || !root.contains(t)) return;
      if (t.hasAttribute('data-scope')) {
        reviewState.scope = t.getAttribute('data-scope');
        practice = false; practiced={};
        rebuild(); drawScope(); draw();
      } else if (t.getAttribute('data-act') === 'flip') flip();
      else if (t.getAttribute('data-act') === 'batch') { practice=false; rebuild(); draw(); }
      else if (t.getAttribute('data-act') === 'practice') { practice = true; rebuild(); draw(); }
      else if(t.getAttribute('data-act')==='practice-restart'){practiced={};practice=true;rebuild();draw();}
      else if (t.hasAttribute('data-grade')) grade(+t.getAttribute('data-grade'));
    }
    function onChange(e) {
      if (e.target.id === 'rv-learned') { reviewState.learnedOnly = e.target.checked; practice = false; practiced={}; rebuild(); draw(); }
    }
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    pageKeyHandler = function (e) {
      if (e.key === ' ' || e.key === 'Spacebar') {
        if (e.target.closest && e.target.closest('a, summary')) return;
        e.preventDefault();
        flip();
      } else if (e.key === '1' || e.key === '2' || e.key === '3') {
        if (flipped) { e.preventDefault(); grade(+e.key); }
      }
    };

    rebuild(); drawScope(); draw();
    return {
      title: '复习', nav: 'review',
      cleanup: function () { pageKeyHandler = null; root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); }
    };
  }

  /* ================================================================ 板块测验 */
  function quizSecHref(sid, only) {
    var x = quizSec[sid];
    return '#/quiz/' + x.quiz.domain + '/' + sid + (only && only.length ? '?only=' + only.join(',') : '');
  }
  function coverText(ids, max) {
    var t = (ids || []).filter(function (id) { return NODES[id]; }).map(function (id) { return NODES[id].title; });
    if (t.length > max) return t.slice(0, max).join('、') + ' 等 ' + t.length + ' 个知识点';
    return t.join('、');
  }

  // 一节的一行：标题、题数、最好成绩、上次时间、开始按钮。总览和领域页共用。
  function quizSecRow(s) {
    var x = quizSec[s.id];
    var r = P.quiz.sections[s.id];
    var tried = !!(r && r.attempts);
    var n = s.questions.length;
    var cover = coverText(s.nodeIds, 4);
    return '<li class="qz-sec d-' + x.quiz.domain + '">' +
      '<div class="qs-main"><div class="qs-title"><span>' + esc(s.title) + '</span>' + (s.kind === 'final' && s.title.indexOf('综合') < 0 ? '<span class="badge">综合</span>' : '') + '</div>' +
      '<div class="qs-meta">' + n + ' 道题' + (tried
        ? '<span class="sep" aria-hidden="true">·</span>上次 ' + esc(fmtWhen(r.last)) + '<span class="sep" aria-hidden="true">·</span>做过 ' + r.attempts + ' 次'
        : '<span class="sep" aria-hidden="true">·</span>还没做过') + '</div>' +
      (cover ? '<div class="qs-cover">覆盖：' + esc(cover) + '</div>' : '') + '</div>' +
      '<div class="qs-side">' +
      (tried ? '<div class="qs-best"><span class="qs-best-label">最好 <b>' + pctText(r.best) + '</b></span><div class="meter" aria-hidden="true"><span style="width:' + Math.round(r.best * 100) + '%"></span></div></div>' : '') +
      '<a class="btn btn-sm' + (tried ? '' : ' btn-primary') + '" href="' + quizSecHref(s.id) + '" aria-label="' + (tried ? '再做一次' : '开始') + ' ' + esc(s.title) + '">' + (tried ? '再做一次' : '开始') + '</a></div></li>';
  }

  function viewQuiz(root, params) {
    var focusDid = params[0];
    var secs = [];
    QUIZZES.forEach(function (qz) { secs = secs.concat(qz.sections); });
    var doneN = secs.filter(function (s) { var r = P.quiz.sections[s.id]; return r && r.attempts; }).length;
    var wrongN = wrongIds().length;
    var blocks = DOMS.map(function (d) {
      var qz = quizByDomain[d.id];
      var nQ = qz ? sum(qz.sections, function (s) { return s.questions.length; }) : 0;
      return '<section class="section qz-domain d-' + d.id + '" id="qz-' + d.id + '" aria-labelledby="qzh-' + d.id + '">' +
        '<div class="section-head"><h2 class="dom-h2" id="qzh-' + d.id + '">' + shape(d.id, 'lg') + esc(d.name) + '</h2>' +
        (qz ? '<span class="muted small">' + qz.sections.length + ' 节 · ' + nQ + ' 道题</span>' : '') + '</div>' +
        (qz && qz.intro ? '<p class="qz-intro">' + esc(qz.intro) + '</p>' : '') +
        (qz && qz.sections.length ? '<ul class="qz-secs">' + qz.sections.map(quizSecRow).join('') + '</ul>'
          : '<p class="muted small">这个领域的测验题还在出。</p>') +
        '</section>';
    }).join('');

    root.innerHTML = '<div class="page page-narrow quiz-page">' +
      '<header class="page-head"><h1>板块测验</h1>' +
      '<p class="lead">每个领域按学习阶段分节，最后一节是跨阶段的综合题。题目要你把几个知识点串起来用、在具体场景里算和判断，比知识点页的自测题深一层。</p></header>' +
      (QUIZ_TOTAL ? '<div class="qz-top">' +
        '<div class="card qz-stat">' + icon('quiz') + '<div><div class="v">' + doneN + '<span class="u"> / ' + secs.length + ' 节</span></div><div class="k">做过至少一遍 · 共 ' + QUIZ_TOTAL + ' 道题</div></div></div>' +
        '<div class="card card-link qz-stat">' + icon('notebook') + '<div><div class="v">' + wrongN + '<span class="u"> 道</span></div><div class="k"><a class="stretched" href="#/quiz/mistakes">错题本</a>' +
        (wrongN ? '：做错后还没答对的题' : '：目前是空的') + '</div></div>' + icon('arrowRight', 'qz-go') + '</div>' +
        '</div>' + blocks
        : '<div class="notice">' + icon('info') + '<p>还没有测验题。出好的题放在 <code>_build/quizzes/</code>，重新运行 <code>python _build/build.py</code> 后就会出现在这里。</p></div>') +
      '</div>';

    if (focusDid) {
      var target = document.getElementById('qz-' + focusDid);
      if (target) setTimeout(function () { target.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }); }, 30);
    }
    return { title: '板块测验', nav: 'quiz', keepScroll: !!focusDid };
  }

  function answerLabel(q) { return q.type === 'single' ? 'ABCD'.charAt(q.answer) : (q.answer ? '对' : '错'); }
  function choiceLabel(q, c) { return q.type === 'single' ? 'ABCD'.charAt(c) : (c ? '对' : '错'); }
  function stemExcerpt(s) {
    var first = String(s || '').split(/\n\s*\n/)[0].split(/```|~~~/)[0].replace(/\s*\n\s*/g, ' ').trim();
    return first ? mdi(first) : '（题目是一段代码）';
  }
  function quizNodeLinks(ids) {
    var ns = (ids || []).filter(function (id) { return NODES[id]; });
    if (!ns.length) return '';
    return '<p class="q-nodes"><span>相关知识点：</span>' + ns.map(function (id) {
      return '<a href="#/n/' + esc(id) + '">' + shape(NODES[id].domain) + esc(NODES[id].title) + '</a>';
    }).join('') + '</p>';
  }

  // 做题器：一屏一题，提交后立刻反馈，做完显示成绩。
  // cfg: ids, sid（整节做完才记成绩）, showSection, retryHref(ids), againHref, backHref, backLabel
  function quizRunner(area, live, cfg) {
    var ids = cfg.ids, i = 0, choice = null, submitted = false, finished = false, results = [];
    function cur() { return quizQ[ids[i]]; }

    function optionsHtml(q, done) {
      var vals = q.type === 'single' ? [0, 1, 2, 3] : [true, false];
      var tag = done ? 'li' : 'button';
      var items = vals.map(function (v, k) {
        var key = q.type === 'single' ? 'ABCD'.charAt(k) : (v ? 'T' : 'F');
        var body = q.type === 'single' ? mdi(q.options[k]) : (v ? '对' : '错');
        var isAns = v === q.answer, isPick = v === choice;
        var cls = 'q-opt' + (done && isAns ? ' is-correct' : '') + (done && isPick && !isAns ? ' is-wrong' : '');
        var marks = '';
        if (done && isAns) marks += '<span class="q-mark ok">' + icon('check') + (isPick ? '正确答案 · 你的选择' : '正确答案') + '</span>';
        if (done && isPick && !isAns) marks += '<span class="q-mark bad">' + icon('x') + '你的选择</span>';
        var note = done && q.type === 'single' && q.optionNotes && q.optionNotes[k] ? '<span class="q-note">' + mdi(q.optionNotes[k]) + '</span>' : '';
        var attrs = done ? '' : ' type="button" data-opt="' + k + '" aria-pressed="' + isPick + '"';
        return '<' + tag + ' class="' + cls + '"' + attrs + '>' +
          '<span class="q-key" aria-hidden="true">' + key + '</span>' +
          '<span class="q-opt-body"><span class="sr-only">' + (q.type === 'single' ? '选项 ' + key + '：' : '') + '</span>' + body + marks + note + '</span></' + tag + '>';
      }).join('');
      var cls2 = 'q-opts' + (q.type === 'tf' ? ' q-opts-tf' : '');
      return done ? '<ol class="' + cls2 + ' is-done" aria-label="选项和说明">' + items + '</ol>'
        : '<div class="' + cls2 + '" role="group" aria-label="' + (q.type === 'single' ? '选项' : '判断对错') + '">' + items + '</div>';
    }

    function draw() {
      var x = cur(), q = x.q, n = ids.length;
      var ok = submitted && choice === q.answer;
      var last = i === n - 1;
      area.innerHTML = '<article class="q-card d-' + x.quiz.domain + '" aria-labelledby="q-num">' +
        '<header class="q-top"><h2 class="q-count" id="q-num" tabindex="-1">第 ' + (i + 1) + ' / ' + n + ' 题</h2>' +
        '<div class="q-tags">' + (cfg.showSection ? domTag(x.quiz.domain) + '<span class="q-sec">' + esc(x.sec.title) + '</span>' : '') +
        '<span class="badge">' + (DIFF_LABEL[q.difficulty] || '理解应用') + '</span>' +
        (q.skill ? '<span class="badge">' + esc(q.skill) + '</span>' : '') +
        '<span class="badge">' + (q.type === 'single' ? '单选' : '判断') + '</span></div></header>' +
        '<div class="meter q-progress" aria-hidden="true"><span style="width:' + Math.round((i + (submitted ? 1 : 0)) * 100 / n) + '%"></span></div>' +
        '<div class="prose q-stem">' + md(q.stem) + '</div>' +
        optionsHtml(q, submitted) +
        (submitted ? '<div class="q-feedback ' + (ok ? 'is-ok' : 'is-bad') + '">' +
          '<p class="q-verdict" id="q-verdict">' + icon(ok ? 'check' : 'x') + '<strong>' + (ok ? '回答正确' : '回答错误') + '</strong>' +
          (ok ? '' : '<span>你选了 ' + choiceLabel(q, choice) + '，正确答案是 ' + answerLabel(q) + '</span>') + '</p>' +
          (q.explanation ? '<div class="prose q-expl">' + md(q.explanation) + '</div>' : '') +
          quizNodeLinks(q.nodeIds) + '</div>' : '') +
        '<footer class="q-actions">' + (submitted
          ? '<button type="button" class="btn btn-primary btn-lg" data-act="next">' + (last ? '看成绩' : '下一题') + ' <kbd>Enter</kbd></button>'
          : '<button type="button" class="btn btn-primary btn-lg" data-act="submit"' + (choice === null ? ' disabled' : '') + '>提交 <kbd>Enter</kbd></button>' +
            '<span class="muted small">' + (choice === null ? '先选一个答案' : '已选 ' + choiceLabel(q, choice)) + '</span>') +
        '</footer></article>';
    }

    function select(v) {
      if (submitted || finished) return;
      var q = cur().q;
      if (q.type === 'single' && !(v >= 0 && v <= 3)) return;
      choice = v;
      $$('[data-opt]', area).forEach(function (b) {
        var k = +b.getAttribute('data-opt');
        var bv = q.type === 'single' ? k : k === 0;
        b.setAttribute('aria-pressed', String(bv === v));
      });
      var sb = $('[data-act="submit"]', area);
      if (sb) { sb.disabled = false; var hint = sb.nextElementSibling; if (hint) hint.textContent = '已选 ' + choiceLabel(q, v); }
    }
    function submit() {
      if (submitted || finished || choice === null) return;
      var x = cur(), ok = choice === x.q.answer;
      submitted = true;
      results.push({ id: ids[i], choice: choice, ok: ok });
      noteAnswer(ids[i], ok);
      draw();
      live.textContent = ok ? '回答正确。' : '回答错误。正确答案是 ' + answerLabel(x.q) + '。';
      var v = $('#q-verdict', area);
      if (v && v.scrollIntoView) v.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      var nb = $('[data-act="next"]', area);
      if (nb) nb.focus({ preventScroll: true });
    }
    function next() {
      if (!submitted || finished) return;
      if (i >= ids.length - 1) { finish(); return; }
      i++;
      choice = null;
      submitted = false;
      live.textContent = '';
      draw();
      var top = area.getBoundingClientRect().top;
      if (top < 0) area.scrollIntoView({ block: 'start' });
      var h = $('#q-num', area);
      if (h) h.focus({ preventScroll: true });
    }
    function finish() {
      finished = true;
      var right = results.filter(function (r) { return r.ok; }).length, n = results.length;
      var wrong = results.filter(function (r) { return !r.ok; }).map(function (r) { return r.id; });
      if (cfg.sid) noteSection(cfg.sid, n ? right / n : 0);
      var rec = cfg.sid ? P.quiz.sections[cfg.sid] : null;
      var x0 = quizQ[ids[0]];
      area.innerHTML = '<section class="card qz-result d-' + x0.quiz.domain + '" aria-labelledby="qr-title">' +
        '<h2 class="qz-result-title" id="qr-title" tabindex="-1">' + (right === n ? '全部答对' : '做完了') + '</h2>' +
        '<div class="qz-score"><span class="big">' + right + '</span><span class="muted">/ ' + n + ' 题答对</span><span class="qz-pct">' + Math.round(right * 100 / n) + '%</span></div>' +
        '<div class="meter" aria-hidden="true"><span style="width:' + Math.round(right * 100 / n) + '%"></span></div>' +
        '<p class="qz-note">' + (rec ? '这一节的最好成绩是 ' + pctText(rec.best) + '，一共做过 ' + rec.attempts + ' 次。'
          : (cfg.partialNote || '')) + (wrong.length ? '做错的题已经记进<a href="#/quiz/mistakes">错题本</a>，以后答对就会移出。' : '') + '</p>' +
        '<ol class="qz-list">' + results.map(function (r, k) {
          var x = quizQ[r.id], q = x.q;
          return '<li class="qz-item ' + (r.ok ? 'is-ok' : 'is-bad') + '"><details><summary>' +
            '<span class="qz-mark">' + icon(r.ok ? 'check' : 'x') + (r.ok ? '对' : '错') + '</span>' +
            '<span class="qz-num">第 ' + (k + 1) + ' 题</span><span class="qz-stem">' + stemExcerpt(q.stem) + '</span>' + icon('chevronRight', 'qz-chev') + '</summary>' +
            '<div class="qz-detail">' + (cfg.showSection ? '<p class="muted small">' + esc(domName(x.quiz.domain)) + ' · ' + esc(x.sec.title) + '</p>' : '') +
            '<div class="prose">' + md(q.stem) + '</div>' +
            (q.type === 'single' ? '<ol class="mk-opts">' + q.options.map(function (o, j) {
              return '<li><span class="mk-key">' + 'ABCD'.charAt(j) + '</span><span>' + mdi(o) + '</span></li>';
            }).join('') + '</ol>' : '') +
            '<p class="qz-ans">你的答案：' + choiceLabel(q, r.choice) + '<span class="sep" aria-hidden="true">·</span>正确答案：' + answerLabel(q) + '</p>' +
            (q.explanation ? '<div class="prose small-prose">' + md(q.explanation) + '</div>' : '') + quizNodeLinks(q.nodeIds) +
            '</div></details></li>';
        }).join('') + '</ol>' +
        '<div class="btn-row">' +
        (wrong.length ? '<button type="button" class="btn btn-primary" data-go="' + esc(cfg.retryHref(wrong)) + '">' + icon('retry') + '只重做错题（' + wrong.length + ' 道）</button>' : '') +
        (cfg.againHref ? '<button type="button" class="btn' + (wrong.length ? '' : ' btn-primary') + '" data-go="' + esc(cfg.againHref) + '">再做一遍</button>' : '') +
        '<a class="btn" href="' + esc(cfg.backHref) + '">' + esc(cfg.backLabel) + '</a></div></section>';
      live.textContent = '做完了，答对 ' + right + ' 题，共 ' + n + ' 题。';
      var kh = area.parentNode && area.parentNode.querySelector('.kbd-hint');
      if (kh) kh.hidden = true;
      window.scrollTo(0, 0);
      var h = $('#qr-title', area);
      if (h) h.focus({ preventScroll: true });
    }

    function onClick(e) {
      var b = e.target.closest('button');
      if (!b || !area.contains(b)) return;
      if (b.hasAttribute('data-opt')) {
        var q = cur().q, k = +b.getAttribute('data-opt');
        select(q.type === 'single' ? k : k === 0);
      } else if (b.getAttribute('data-act') === 'submit') submit();
      else if (b.getAttribute('data-act') === 'next') next();
      else if (b.hasAttribute('data-go')) go(b.getAttribute('data-go'));
    }
    function onKey(e) {
      if (finished) return;
      var t = e.target, k = e.key;
      if (t && t.closest && t.closest('a, summary')) return;
      var q = cur().q;
      if (!submitted) {
        if (q.type === 'single') {
          var idx = /^[1-4]$/.test(k) ? +k - 1 : 'abcd'.indexOf(String(k).toLowerCase());
          if (k.length === 1 && idx >= 0) { e.preventDefault(); select(idx); return; }
        } else if (k === 't' || k === 'T' || k === 'f' || k === 'F') {
          e.preventDefault(); select(k === 't' || k === 'T'); return;
        }
        if (k === 'Enter') {
          var ob = t && t.closest && t.closest('[data-opt]');
          if (ob) {
            var ov = q.type === 'single' ? +ob.getAttribute('data-opt') : ob.getAttribute('data-opt') === '0';
            if (ov !== choice) { e.preventDefault(); select(ov); return; }
          }
          if (choice !== null) { e.preventDefault(); submit(); }
        }
      } else if (k === 'Enter') {
        e.preventDefault();
        next();
      }
    }
    area.addEventListener('click', onClick);
    draw();
    return { onKey: onKey, destroy: function () { area.removeEventListener('click', onClick); } };
  }

  function quizShell(root, did, crumbs, title, sub) {
    root.innerHTML = '<div class="page page-narrow quiz-run d-' + did + '">' +
      '<nav class="breadcrumb" aria-label="面包屑"><a href="#/quiz">板块测验</a>' + crumbs + '</nav>' +
      '<header class="qr-head"><h1>' + esc(title) + '</h1><p class="muted">' + sub + '</p></header>' +
      '<div class="qz-area" id="qz-area"></div><p class="sr-only" role="status" aria-live="polite" id="qz-live"></p>' +
      '<p class="kbd-hint"><kbd>1</kbd>–<kbd>4</kbd> 或 <kbd>A</kbd>–<kbd>D</kbd> 选择 · <kbd>T</kbd> / <kbd>F</kbd> 判断对错 · <kbd>Enter</kbd> 提交、下一题</p></div>';
    return { area: $('#qz-area', root), live: $('#qz-live', root) };
  }

  function viewQuizRun(root, params, query) {
    var did = params[0], sid = params[1];
    var x = quizSec[sid];
    if (!x || x.quiz.domain !== did) return view404(root);
    var sec = x.sec, d = DOM[did];
    var all = sec.questions.map(function (q) { return q.id; });
    var only = query.only ? query.only.split(',').filter(function (id) { return all.indexOf(id) >= 0; }) : [];
    var ids = only.length ? all.filter(function (id) { return only.indexOf(id) >= 0; }) : all;
    var partial = ids.length < all.length;
    var cover = coverText(sec.nodeIds, 6);
    var SEP = '<span class="sep" aria-hidden="true">·</span>';
    var sh = quizShell(root, did,
      '<span aria-hidden="true">›</span><a href="#/quiz/' + did + '">' + esc(d.short) + '</a><span aria-hidden="true">›</span><span aria-current="page">' + esc(sec.title) + '</span>',
      sec.title,
      esc(d.short) + (sec.kind === 'final' && sec.title.indexOf('综合') < 0 ? SEP + '综合' : '') + SEP + (partial ? '重做错题 ' + ids.length + ' 道（共 ' + all.length + ' 道）' : ids.length + ' 道题') +
      (cover ? SEP + '覆盖：' + esc(cover) : ''));
    if (!ids.length) {
      sh.area.innerHTML = '<div class="notice">' + icon('info') + '<p>这一节还没有题。</p></div>';
      return { title: sec.title, nav: 'quiz' };
    }
    var run = quizRunner(sh.area, sh.live, {
      ids: ids,
      sid: partial ? null : sid,
      partialNote: '只重做了部分题，这一节的最好成绩不变。',
      retryHref: function (w) { return quizSecHref(sid, w); },
      againHref: quizSecHref(sid),
      backHref: '#/quiz/' + did,
      backLabel: '回到测验总览'
    });
    pageKeyHandler = run.onKey;
    return { title: sec.title + ' · 测验', nav: 'quiz', cleanup: run.destroy };
  }

  var mistakeState = { domain: 'all' };

  function viewMistakes(root, params, query) {
    if (query.domain) mistakeState.domain = DOM[query.domain] ? query.domain : 'all';
    root.innerHTML = '<div class="page page-narrow mistakes-page">' +
      '<nav class="breadcrumb" aria-label="面包屑"><a href="#/quiz">板块测验</a><span aria-hidden="true">›</span><span aria-current="page">错题本</span></nav>' +
      '<header class="page-head"><h1>错题本</h1><p class="lead">做错过、之后还没答对的测验题。不管在哪一节、哪一轮，只要答对一次，它就会移出错题本。</p></header>' +
      '<div class="mk-tools"><div class="chips" role="group" aria-label="按领域筛选" id="mk-scope"></div><div id="mk-go"></div></div>' +
      '<div id="mk-body"></div></div>';
    var scopeEl = $('#mk-scope', root), goEl = $('#mk-go', root), body = $('#mk-body', root);

    function draw() {
      var allW = wrongIds();
      var list = wrongIds(mistakeState.domain);
      var opts = [['all', '全部', '', allW.length]].concat(DOMS.map(function (d) { return [d.id, d.short, shape(d.id), wrongIds(d.id).length]; }));
      scopeEl.innerHTML = opts.map(function (o) {
        return '<button type="button" class="chip" data-scope="' + o[0] + '" aria-pressed="' + (mistakeState.domain === o[0]) + '">' + o[2] + esc(o[1]) + '<span class="chip-n">' + o[3] + '</span></button>';
      }).join('');
      goEl.innerHTML = list.length ? '<button type="button" class="btn btn-primary" data-go="#/quiz/mistakes/practice' +
        (mistakeState.domain !== 'all' ? '?domain=' + mistakeState.domain : '') + '">' + icon('retry') + '重练错题（' + list.length + ' 道）</button>' : '';
      if (!list.length) {
        body.innerHTML = '<div class="card review-empty"><h2>' + (allW.length ? '这个领域没有错题' : '错题本是空的') + '</h2>' +
          '<p>' + (allW.length ? '其他领域还有 ' + allW.length + ' 道错题。' : '做测验时答错的题会记在这里，方便集中重练。') + '</p>' +
          '<div class="btn-row"><a class="btn" href="#/quiz">去做测验</a></div></div>';
        return;
      }
      body.innerHTML = '<ol class="mk-list">' + list.map(function (qid) {
        var x = quizQ[qid], q = x.q, did = x.quiz.domain;
        return '<li class="card mk-card d-' + did + '"><div class="mk-head">' + domTag(did) + '<span class="sep" aria-hidden="true">·</span>' +
          '<a href="' + quizSecHref(x.sec.id) + '">' + esc(x.sec.title) + '</a><span class="badge">' + (DIFF_LABEL[q.difficulty] || '理解应用') + '</span>' +
          '<span class="badge">' + (q.type === 'single' ? '单选' : '判断') + '</span>' +
          '<span class="mk-time">做错于 ' + esc(fmtWhen(P.quiz.wrong[qid])) + '</span></div>' +
          '<div class="prose mk-stem">' + md(q.stem) + '</div>' +
          (q.type === 'single' ? '<ol class="mk-opts">' + q.options.map(function (o, j) {
            return '<li><span class="mk-key">' + 'ABCD'.charAt(j) + '</span><span>' + mdi(o) + '</span></li>';
          }).join('') + '</ol>' : '') +
          '<details class="mk-ans"><summary>' + icon('chevronRight') + '看答案和解析</summary>' +
          '<p class="qz-ans">正确答案：' + answerLabel(q) + '</p>' +
          (q.type === 'single' && q.optionNotes && q.optionNotes.length === 4 ? '<ul class="mk-notes">' + q.optionNotes.map(function (t, j) {
            return '<li><span class="mk-key' + (j === q.answer ? ' is-ans' : '') + '">' + 'ABCD'.charAt(j) + '</span><span>' + mdi(t) + '</span></li>';
          }).join('') + '</ul>' : '') +
          (q.explanation ? '<div class="prose">' + md(q.explanation) + '</div>' : '') + quizNodeLinks(q.nodeIds) + '</details></li>';
      }).join('') + '</ol>';
    }
    function onClick(e) {
      var b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      if (b.hasAttribute('data-scope')) { mistakeState.domain = b.getAttribute('data-scope'); draw(); }
      else if (b.hasAttribute('data-go')) go(b.getAttribute('data-go'));
    }
    root.addEventListener('click', onClick);
    draw();
    return { title: '错题本', nav: 'quiz', cleanup: function () { root.removeEventListener('click', onClick); } };
  }

  function viewMistakesRun(root, params, query) {
    var did = query.domain && DOM[query.domain] ? query.domain : 'all';
    var ids = wrongIds(did);
    if (query.only) {
      var only = query.only.split(',').filter(function (id) { return quizQ[id]; });
      if (only.length) ids = only.sort(quizOrder);
    }
    var sh = quizShell(root, did === 'all' ? (ids.length ? quizQ[ids[0]].quiz.domain : 'ds') : did,
      '<span aria-hidden="true">›</span><a href="#/quiz/mistakes">错题本</a><span aria-hidden="true">›</span><span aria-current="page">重练</span>',
      '重练错题', (did === 'all' ? '全部领域' : esc(domName(did))) + '<span class="sep" aria-hidden="true">·</span>' + ids.length + ' 道');
    if (!ids.length) {
      sh.area.innerHTML = '<div class="card review-empty"><h2>没有要重练的错题</h2><p>错题本里这一部分已经清空了。</p>' +
        '<div class="btn-row"><a class="btn" href="#/quiz/mistakes">回到错题本</a><a class="btn" href="#/quiz">去做测验</a></div></div>';
      return { title: '重练错题', nav: 'quiz' };
    }
    var run = quizRunner(sh.area, sh.live, {
      ids: ids,
      sid: null,
      showSection: true,
      partialNote: '重练错题不计入各节的最好成绩。',
      retryHref: function (w) { return '#/quiz/mistakes/practice?only=' + w.join(','); },
      againHref: null,
      backHref: '#/quiz/mistakes',
      backLabel: '回到错题本'
    });
    pageKeyHandler = run.onKey;
    return { title: '重练错题', nav: 'quiz', cleanup: run.destroy };
  }

  /* ================================================================ 实验室 */
  // 实验室按领域分组展示，组标题已经写了领域，卡片里不再重复领域名
  function demoCard(x) {
    var ns = demoNodes(x);
    return '<li class="card card-link demo-card d-' + (x.domain || 'ds') + '">' +
      (x.available === false ? '<div class="demo-card-top"><span class="badge badge-draft">还在制作</span></div>' : '') +
      '<h3><a class="stretched" href="#/lab/' + esc(x.id) + '">' + esc(x.title) + '</a></h3>' +
      '<p class="demo-desc">' + esc(x.desc) + '</p>' +
      '<p class="demo-nodes muted small">' + (ns.length ? '相关知识点：' + ns.map(function (id) { return esc(NODES[id].title); }).join('、') : '还没有关联的知识点') + '</p></li>';
  }

  function viewLab(root) {
    root.innerHTML='<div class="page lab-page"><header class="page-head"><h1>实验室</h1><p class="lead">'+DEMOS.length+' 个交互演示。先预测，再逐步计算。</p></header><div class="filter-bar lab-filters" role="group" aria-label="筛选实验"></div><div class="lab-results"></div></div>';
    var bar=$('.lab-filters',root),filters={};
    [['domain','实验主题',[['all','全部']].concat(DOMAIN_IDS.map(function(d){return [d,domName(d)];}))],['level','实验难度',[['all','全部'],['1','入门'],['2','基础'],['3','进阶']]],['ready','实验前置',[['all','全部'],['ready','前置已自评掌握'],['missing','有前置待补']]]].forEach(function(a){var l=document.createElement('label');l.className='select-field';var caption=document.createElement('span');caption.textContent=a[1];l.appendChild(caption);var select=document.createElement('select');select.setAttribute('aria-label',a[1]);a[2].forEach(function(p){var o=document.createElement('option');o.value=p[0];o.textContent=p[1];select.appendChild(o);});l.appendChild(select);bar.appendChild(l);filters[a[0]]=select;});
    function draw(){var visible=DEMOS.filter(function(x){var ns=demoNodes(x),level=Math.min(3,Math.max.apply(null,ns.map(function(id){return NODES[id].level||1;}).concat([1]))),prereqs=Array.from(new Set(ns.reduce(function(a,id){return a.concat(NODES[id].prereqs||[]);},[]))),ready=prereqs.every(isLearned);return (filters.domain.value==='all'||x.domain===filters.domain.value)&&(filters.level.value==='all'||level===+filters.level.value)&&(filters.ready.value==='all'||(filters.ready.value==='ready'?ready:!ready));});
      var groups=DOMAIN_IDS.concat(['other']).map(function(did){var ds=visible.filter(function(x){return did==='other'?DOMAIN_IDS.indexOf(x.domain)<0:x.domain===did;});return ds.length?'<section class="section"><h2>'+esc(did==='other'?'其他':domName(did))+'</h2><ul class="demo-grid">'+ds.map(demoCard).join('')+'</ul></section>':'';}).join('');$('.lab-results',root).innerHTML=groups||'<p role="status">此筛选条件下暂无实验。难度按关联节点的最高等级归类，前置完成是自评。</p>';}
    Object.keys(filters).forEach(function(k){filters[k].onchange=draw;});draw();
    return { title: '实验室', nav: 'lab' };
  }

  function viewLabDemo(root, params) {
    var x = demoById[params[0]];
    if (!x) return view404(root);
    var ns = demoNodes(x);
    var siblings = DEMOS.filter(function (y) { return y.domain === x.domain && y.id !== x.id; });
    root.innerHTML = '<div class="page lab-detail d-' + (x.domain || 'ds') + '">' +
      '<nav class="breadcrumb" aria-label="面包屑"><a href="#/lab">实验室</a><span aria-hidden="true">›</span>' +
      (x.domain ? '<span>' + esc(domName(x.domain)) + '</span><span aria-hidden="true">›</span>' : '') +
      '<span aria-current="page">' + esc(x.title) + '</span></nav>' +
      '<header class="page-head"><h1>' + esc(x.title) + '</h1><p class="lead">' + esc(x.desc) + '</p></header>' +
      '<div class="lab-layout"><div class="card demo-stage"><div class="demo-host" id="lab-demo"></div></div>' +
      '<aside class="lab-aside" aria-label="相关内容">' +
      '<section class="card"><h2 class="card-title">相关知识点</h2>' + (ns.length ? '<ul class="mini-list">' + ns.map(function (id) { return miniNodeLink(NODES[id], isLearned(id) ? '自评掌握' : ''); }).join('') + '</ul>' : '<p class="muted small">还没有关联的知识点。</p>') + '</section>' +
      (siblings.length ? '<section class="card"><h2 class="card-title">同领域的其他演示</h2><ul class="mini-list">' + siblings.map(function (y) {
        return '<li><a href="#/lab/' + esc(y.id) + '">' + icon('flask') + '<span>' + esc(y.title) + '</span></a></li>';
      }).join('') + '</ul></section>' : '') +
      '</aside></div></div>';
    var h = mountDemo($('#lab-demo', root), x);
    return { title: x.title, nav: 'lab', cleanup: h.destroy };
  }

  /* ================================================================ 资源 */
  var RES = null;
  function normUrl(u) { u = (u || '').trim(); while (/\/$/.test(u) && u.split('/').length > 4) u = u.slice(0, -1); return u; }

  function resourcesIndex() {
    if (RES) return RES;
    var map = {}, out = [];
    function add(r, ref) {
      var key = normUrl(r.url) || 'title:' + r.title;
      var e = map[key];
      if (!e) {
        e = map[key] = { r: r, nodes: [], domains: [], best: false, courses: false };
        out.push(e);
      }
      if (ref.node && e.nodes.indexOf(ref.node) < 0) e.nodes.push(ref.node);
      if (ref.domain && e.domains.indexOf(ref.domain) < 0) e.domains.push(ref.domain);
      if (ref.best) e.best = true;
      if (ref.course) e.courses = true;
      ['note', 'evidence', 'platform', 'lang', 'kind'].forEach(function (k) { if (!e.r[k] && r[k]) { e.r = Object.assign({}, e.r); e.r[k] = r[k]; } });
    }
    DOMS.forEach(function (d) {
      d.bestOverallResources.forEach(function (r) { add(r, { domain: d.id, best: true }); });
      d.courses.forEach(function (c) { add({ title: c.name, url: c.url, platform: '课程', kind: 'course', lang: '', note: c.note, evidence: '' }, { domain: d.id, course: true }); });
    });
    studyOrder.forEach(function (id) {
      var n = NODES[id];
      (n.resources || []).forEach(function (r) { add(r, { node: id, domain: n.domain }); });
    });
    out.forEach(function (e) {
      e.text = [e.r.title, e.r.note, e.r.evidence, e.r.platform].concat(e.nodes.map(function (id) { return NODES[id].title; })).join(' ').toLowerCase();
    });
    out.sort(function (a, b) {
      return (b.best - a.best) || (b.nodes.length - a.nodes.length) || ((a.r.lang === 'zh' ? 0 : 1) - (b.r.lang === 'zh' ? 0 : 1)) ||
        (posOf(a.nodes[0]) || 0) - (posOf(b.nodes[0]) || 0);
    });
    RES = out;
    return RES;
  }

  var resState = { domain: 'all', platform: 'all', lang: 'all', kind: 'all', q: '', limit: 40 };

  function viewResources(root, params, query) {
    var all = resourcesIndex();
    ['domain', 'platform', 'lang', 'kind', 'q'].forEach(function (k) { if (query[k] != null) resState[k] = query[k]; });
    if (resState.domain !== 'all' && !DOM[resState.domain]) resState.domain = 'all';
    resState.limit = 40;
    var platCount = {};
    all.forEach(function (e) { var p = e.r.platform || '其他'; platCount[p] = (platCount[p] || 0) + 1; });
    var plats = Object.keys(platCount).sort(function (a, b) { return platCount[b] - platCount[a]; });
    var kinds = Object.keys(KIND_LABEL).filter(function (k) { return all.some(function (e) { return e.r.kind === k; }); });
    function opt(v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; }

    root.innerHTML = '<div class="page resources-page">' +
      '<header class="page-head"><h1>学习资源</h1><p class="lead">所有知识点和领域推荐的资源，按链接去掉重复，共 ' + all.length + ' 条。中文资源排在同等条件的英文资源前面。</p></header>' +
      '<form class="card filters" role="search" aria-label="筛选资源" onsubmit="return false">' +
      '<label class="field f-search"><span>关键词</span><input type="search" id="rf-q" placeholder="标题、推荐理由、知识点" value="' + esc(resState.q) + '"></label>' +
      '<label class="field select-field"><span>领域</span><select id="rf-domain">' + opt('all', '全部领域', resState.domain) + DOMS.map(function (d) { return opt(d.id, d.short, resState.domain); }).join('') + '</select></label>' +
      '<label class="field select-field"><span>平台</span><select id="rf-platform">' + opt('all', '全部平台', resState.platform) + plats.map(function (p) { return opt(p, p + '（' + platCount[p] + '）', resState.platform); }).join('') + '</select></label>' +
      '<label class="field select-field"><span>语言</span><select id="rf-lang">' + opt('all', '全部语言', resState.lang) + opt('zh', '中文', resState.lang) + opt('en', '英文', resState.lang) + '</select></label>' +
      '<label class="field select-field"><span>类型</span><select id="rf-kind">' + opt('all', '全部类型', resState.kind) + kinds.map(function (k) { return opt(k, KIND_LABEL[k], resState.kind); }).join('') + '</select></label>' +
      '</form><div class="res-summary"><span id="rf-count" aria-live="polite"></span><button type="button" class="btn btn-ghost btn-sm" id="rf-reset">清空筛选</button></div>' +
      '<ul class="res-list" id="rf-list"></ul><div class="res-more" id="rf-more"></div></div>';

    var listEl = $('#rf-list', root), countEl = $('#rf-count', root), moreEl = $('#rf-more', root);
    function matches(e) {
      if (resState.domain !== 'all' && e.domains.indexOf(resState.domain) < 0) return false;
      if (resState.platform !== 'all' && (e.r.platform || '其他') !== resState.platform) return false;
      if (resState.lang !== 'all' && e.r.lang !== resState.lang) return false;
      if (resState.kind !== 'all' && e.r.kind !== resState.kind) return false;
      var q = resState.q.trim().toLowerCase();
      if (q && e.text.indexOf(q) < 0) return false;
      return true;
    }
    function usedBy(e) {
      var parts = [];
      if (e.best) parts.push(e.domains.map(function (did) { return esc(domName(did)); }).join('、') + '领域推荐');
      if (e.courses) parts.push('对应课程');
      if (e.nodes.length) parts.push('用到它的知识点：' + e.nodes.map(function (id) { return '<a href="#/n/' + esc(id) + '">' + esc(NODES[id].title) + '</a>'; }).join('、'));
      return parts.length ? '<p class="res-used">' + parts.join('；') + '</p>' : '';
    }
    function apply() {
      var hits = all.filter(matches);
      countEl.textContent = hits.length === all.length ? '共 ' + all.length + ' 条' : '筛出 ' + hits.length + ' 条（共 ' + all.length + ' 条）';
      listEl.innerHTML = hits.length ? hits.slice(0, resState.limit).map(function (e) { return resCard(e.r, usedBy(e)); }).join('')
        : '<li class="notice">' + icon('info') + '<p>没有符合条件的资源，换个关键词或放宽筛选试试。</p></li>';
      moreEl.innerHTML = hits.length > resState.limit ? '<button type="button" class="btn" id="rf-more-btn">再显示 ' + Math.min(40, hits.length - resState.limit) + ' 条</button>' : '';
    }
    var timer = null;
    function onInput(e) {
      if (e.target.id === 'rf-q') {
        clearTimeout(timer);
        timer = setTimeout(function () { resState.q = e.target.value; resState.limit = 40; apply(); }, 120);
      }
    }
    function onChange(e) {
      var m = /^rf-(domain|platform|lang|kind)$/.exec(e.target.id || '');
      if (m) { resState[m[1]] = e.target.value; resState.limit = 40; apply(); }
    }
    function onClick(e) {
      if (e.target.closest('#rf-more-btn')) { resState.limit += 40; apply(); }
      else if (e.target.closest('#rf-reset')) {
        resState.domain = resState.platform = resState.lang = resState.kind = 'all';
        resState.q = '';
        resState.limit = 40;
        ['rf-domain', 'rf-platform', 'rf-lang', 'rf-kind'].forEach(function (k) { $('#' + k, root).value = 'all'; });
        $('#rf-q', root).value = '';
        apply();
      }
    }
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('click', onClick);
    apply();
    return {
      title: '学习资源', nav: 'resources',
      cleanup: function () { clearTimeout(timer); root.removeEventListener('input', onInput); root.removeEventListener('change', onChange); root.removeEventListener('click', onClick); }
    };
  }

  /* ================================================================ 关于 */
  function viewAbout(root) {
    var m = KG.meta || {}, c = m.counts || {};
    var research = m.research;
    var learnedN = allNodes.filter(function (n) { return isLearned(n.id); }).length;
    var cardsN = Object.keys(P.cards).length;
    var quizDone = Object.keys(P.quiz.sections).filter(function (k) { return quizSec[k] && P.quiz.sections[k].attempts; }).length;
    var wrongN = wrongIds().length;
    var plats = m.platforms || {};
    var totalTime = fmtMin(c.minutes != null ? c.minutes : sum(allNodes, function (n) { return n.estMinutes || 0; })).split(' ');
    var statsList = [
      ['版本', m.version ? 'v' + m.version : '未标记', '', m.release && m.release.releaseDate ? '发布日期 ' + m.release.releaseDate : ''],
      ['知识点', c.nodes != null ? c.nodes : allNodes.length, '', c.drafts ? '其中 ' + c.drafts + ' 个还是草稿' : ''],
      ['连线', c.edges != null ? c.edges : (KG.edges || []).length, '', c.crossEdges != null ? '跨领域 ' + c.crossEdges + ' 条' : ''],
      ['学习资源', c.resources != null ? c.resources : resourcesIndex().length, '', '按链接去重'],
      ['自测题', c.quiz != null ? c.quiz : CARDS.length, '', QUIZ_TOTAL ? '另有板块测验 ' + QUIZ_TOTAL + ' 道' : ''],
      ['面试题', c.interviewQuestions != null ? c.interviewQuestions : sum(allNodes, function (n) { return (n.interviewQuestions || []).length; }), '', '含来源等级与完整解析'],
      ['交互演示', c.demos != null ? c.demos : DEMOS.length, '', c.demosReady != null ? '已就绪 ' + c.demosReady + ' 个' : ''],
      ['调研笔记', research ? research.files : '无', research ? '份' : '', research ? '引用 ' + research.urls + ' 个链接' : '这次打包没有调研笔记'],
      ['写作参考来源', m.sources || 0, '', '写正文时核对过的网址'],
      ['总学习时长', totalTime[0], totalTime[1] || '', '按每个知识点的预计用时累加']
    ];
    var themeCur = P.theme || 'system';
    root.innerHTML = '<div class="page about-page">' +
      '<header class="page-head"><h1>关于本站</h1><p class="lead">双击 index.html 就能打开的本地学习网站。除了外部资源链接，其余内容都不需要联网。</p></header>' +
      '<section class="section" aria-labelledby="ab-how"><h2 id="ab-how">这个网站怎么做出来的</h2><div class="prose" style="max-width:var(--read-max)">' +
      '<p>内容由一条流水线生成。先针对每个领域检索课程大纲、教材章节和学习者的讨论，整理成调研笔记；再按笔记定出每个领域的知识骨架和前置关系；然后逐个知识点写正文、例子和自测题，核对资源链接；最后用 <code>_build/build.py</code> 打包成网站数据。</p>' +
      (Object.keys(plats).length ? '<p>资源来自这些平台：' + Object.keys(plats).map(function (p) { return esc(p) + ' ' + plats[p] + ' 条'; }).join('，') + '。</p>' : '') +
      '<p>数据生成于 ' + esc(fmtDateTime(m.builtAt)) + '，来源目录 <code>' + esc(m.src || '_build') + '</code>。</p></div>' +
      '<div class="stat-grid" style="margin-top:20px">' + statsList.map(function (s) {
        return '<div class="card stat"><div class="k">' + s[0] + '</div><div class="v">' + esc(s[1]) + (s[2] ? '<span class="u">' + esc(s[2]) + '</span>' : '') + '</div>' + (s[3] ? '<div class="s">' + esc(s[3]) + '</div>' : '') + '</div>';
      }).join('') + '</div></section>' +
      '<div class="about-cols section">' +
      '<section class="card" aria-labelledby="ab-prog"><h2 class="card-title" id="ab-prog">学习进度</h2>' +
      '<p class="small">自评掌握 <strong>' + learnedN + '</strong> 个知识点，有 <strong>' + cardsN + '</strong> 张卡的复习记录，板块测验做过 <strong>' + quizDone + '</strong> 节，错题本里有 <strong>' + wrongN + '</strong> 道题。进度存在这台电脑的浏览器里（localStorage，键名 <code>' + STORE_KEY + '</code>），换浏览器或清除网站数据就没了，记得导出备份。</p>' +
      (storageOK ? '' : '<div class="notice notice-warn" style="margin-bottom:12px">' + icon('alert') + '<p>浏览器进度尚未保存，请使用页面提示导出待保存内容或恢复备份。</p></div>') +
      '<div class="btn-row"><button type="button" class="btn" id="ab-export">' + icon('download') + '导出进度</button>' +
      '<button type="button" class="btn" id="ab-restore">恢复导入前进度</button>' + '<button type="button" class="btn" id="ab-import">' + icon('upload') + '导入进度</button>' +
      '<button type="button" class="btn" id="ab-clear">' + icon('trash') + '清空进度</button></div>' +
      '<input type="file" id="ab-file" accept="application/json,.json" hidden></section>' +
      '<section class="card" aria-labelledby="ab-theme"><h2 class="card-title" id="ab-theme">外观</h2>' +
      '<div class="radio-row" role="radiogroup" aria-labelledby="ab-theme">' +
      [['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(function (o) {
        return '<label><input type="radio" name="ab-theme" value="' + o[0] + '"' + (themeCur === o[0] ? ' checked' : '') + '>' + o[1] + '</label>';
      }).join('') + '</div><p class="muted small" style="margin:12px 0 0">顶栏右边的按钮也能切换明暗。</p></section>' +
      '</div>' +
      '<section class="section" aria-labelledby="ab-keys"><h2 id="ab-keys">快捷键</h2><div class="card" style="max-width:var(--read-max)"><table class="kv-table"><tbody>' +
      [['<kbd>/</kbd>', '聚焦搜索框'], ['<kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd>', '在搜索结果里选择并打开'], ['<kbd>Esc</kbd>', '清空或关闭搜索、关闭菜单'],
        ['<kbd>空格</kbd>', '复习页：翻面看答案'], ['<kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>', '复习页：不会、模糊、会了'],
        ['<kbd>1</kbd>–<kbd>4</kbd> 或 <kbd>A</kbd>–<kbd>D</kbd>', '测验：选择单选题的选项'], ['<kbd>T</kbd> <kbd>F</kbd>', '测验：判断题选对或错'],
        ['<kbd>Enter</kbd>', '测验：提交答案，再按一次进入下一题'], ['<kbd>Tab</kbd>', '在链接、按钮和图谱节点之间移动']].map(function (r) {
        return '<tr><th scope="row">' + r[0] + '</th><td>' + r[1] + '</td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      '</div>';

    var armed = false, armTimer = null;
    function onClick(e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'ab-export') exportProgress();
      else if (b.id === 'ab-restore') { try { var prior = localStorage.getItem('kg-progress-before-import'); if (!prior) { toast('还没有导入前备份。'); return; } var recovered=JSON.parse(prior); if (window.KGProgress.validate(recovered)) { toast('备份格式无效。'); return; } if (window.confirm('恢复最近一次导入前的学习记录？')) { if(saveProgress(normalizeProgress(recovered),{replace:true,backup:true,recovery:corruptStorage})) rehydrateProgress(); } } catch(e) { toast('恢复失败：'+e.message); } }
      else if (b.id === 'ab-import') $('#ab-file', root).click();
      else if (b.id === 'ab-clear') {
        if (!armed) {
          armed = true;
          b.classList.add('btn-danger-armed');
          b.innerHTML = icon('trash') + '再点一次确认清空';
          armTimer = setTimeout(function () { armed = false; b.classList.remove('btn-danger-armed'); b.innerHTML = icon('trash') + '清空进度'; }, 4000);
        } else {
          clearTimeout(armTimer);
          var theme = P.theme;
          var empty=blankProgress();empty.theme=theme;
          if(saveProgress(empty,{replace:true,backup:true,recovery:corruptStorage})) {toast('进度已清空。');rehydrateProgress();}
        }
      }
    }
    function onChange(e) {
      if (e.target.name === 'ab-theme') setTheme(e.target.value === 'system' ? null : e.target.value);
      else if (e.target.id === 'ab-file' && e.target.files && e.target.files[0]) importProgress(e.target.files[0]);
    }
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    return {
      title: '关于本站', nav: null,
      cleanup: function () { clearTimeout(armTimer); root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); }
    };
  }

  function exportProgress() {
    try {
      var blob = new Blob([JSON.stringify(progressStore.clean(failedCandidate||P), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'kg-progress-' + todayStr() + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
      toast('已导出进度文件。');
    } catch (e) {
      console.error(e);
      toast('导出失败：' + e.message);
    }
  }

  function importProgress(file) {
    if (file.size > 5 * 1024 * 1024) { toast('文件超过 5 MB，已取消导入。'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result).replace(/^\uFEFF/, '')); } catch (e) { toast('这个文件不是有效的 JSON。'); return; }
      if (!data || typeof data !== 'object' || Array.isArray(data) || !['learned','cards','quiz','learningEvidence'].some(function(k){return k in data;})) {
        toast('文件里没有找到进度数据（需要 learned、cards、quiz 或 learningEvidence 字段）。');
        return;
      }
      var problem = window.KGProgress.validate(data);
      if (problem) { toast('导入失败：' + problem + '。原进度未改变。'); return; }
      var incoming = normalizeProgress(data);
      function review() {
        var reviewed=JSON.stringify(savedSnapshot);
        window.KGProgress.reviewImport(data,P,KG,function(mode) {
          if(!corruptStorage){
            try {var latest=progressStore.read();if(JSON.stringify(latest)!==reviewed){publishProgress(latest);savedSnapshot=JSON.parse(JSON.stringify(latest));toast('其他页面已更新进度，请重新核对导入差异。');review();return;}}
            catch(error){storageOK=false;storageError=error.message;updateSaveWarning();return;}
          }
          var candidate=mode==='replace'?incoming:window.KGProgress.merge(P,incoming);
          // Preserve extension fields in merge mode; conflict values stay local.
          if(mode==='merge')candidate=Object.assign({},incoming,candidate);
          Object.keys(NODES).forEach(function(id){(NODES[id].quiz||[]).forEach(function(q){if(q.legacyId && candidate.cards[q.legacyId] && !candidate.cards[q.id]) candidate.cards[q.id]=candidate.cards[q.legacyId];});});
          if(!saveProgress(candidate,{replace:mode==='replace'||corruptStorage,backup:true,recovery:corruptStorage}))return;
          var ln=Object.keys(P.learned).filter(function(k){return NODES[k];}).length;
          toast('已导入：'+ln+' 个自评掌握的知识点，'+Object.keys(P.cards).length+' 张卡的复习记录。');
          rehydrateProgress();
        });
      }
      review();
    };
    reader.onerror = function () { toast('读取文件失败。'); };
    reader.readAsText(file);
  }

  /* ================================================================ 404 */
  function view404(root) {
    root.innerHTML = '<div class="page page-narrow notfound"><p class="nf-code" aria-hidden="true">404</p><h1>没有这个页面</h1>' +
      '<p class="lead">地址可能写错了，或者这个知识点换了名字。</p>' +
      '<div class="btn-row"><a class="btn btn-primary" href="#/">回到首页</a><a class="btn" href="#/graph">打开图谱</a></div>' +
      '<p class="muted small">也可以在顶栏搜索知识点<span class="kbd-only">（快捷键 <kbd>/</kbd>）</span>。</p></div>';
    return { title: '找不到页面', nav: null };
  }

  /* ================================================================ 路由 */
  var ROUTES = [
    [/^\/projects(?:\/([\w-]+))?\/?$/, function(root,params){return window.KGProjects.render(root,params,{md:md,progress:P,save:saveProgress});}],
    [/^\/?$/, viewHome],
    [/^\/graph\/?$/, viewGraph],
    [/^\/route\/?$/, viewRoute],
    [/^\/d\/([\w-]+)\/?$/, viewDomain],
    [/^\/n\/([\w-]+)\/?$/, viewNode],
    [/^\/review\/?$/, viewReview],
    [/^\/lab\/?$/, viewLab],
    [/^\/lab\/([\w-]+)\/?$/, viewLabDemo],
    [/^\/resources\/?$/, viewResources],
    [/^\/about\/?$/, viewAbout],
    [/^\/quiz\/?$/, viewQuiz],
    [/^\/quiz\/mistakes\/?$/, viewMistakes],
    [/^\/quiz\/mistakes\/practice\/?$/, viewMistakesRun],
    [/^\/quiz\/([\w-]+)\/?$/, function(root,params){return DOM[params[0]] ? viewQuiz(root,params) : view404(root);}],
    [/^\/quiz\/([\w-]+)\/([\w-]+)\/?$/, viewQuizRun]
  ];

  function parseHash() {
    var h = location.hash.replace(/^#/, '');
    var qi = h.indexOf('?');
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var query = {};
    if (qi >= 0) {
      h.slice(qi + 1).split('&').forEach(function (kv) {
        if (!kv) return;
        var p = kv.split('=');
        try { query[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); } catch (e) { /* 忽略坏参数 */ }
      });
    }
    try { path = decodeURIComponent(path); } catch (e) { /* 保持原样 */ }
    return { path: path || '/', query: query };
  }

  var routeCleanup = null;
  var firstRender = true;

  function render() {
    if (routeCleanup) { try { routeCleanup(); } catch (e) { console.error(e); } }
    routeCleanup = null;
    pageKeyHandler = null;
    progressSets = {};
    setMenu(false);
    closeSearchList();

    var r = parseHash();
    var fn = view404, params = [];
    for (var i = 0; i < ROUTES.length; i++) {
      var m = ROUTES[i][0].exec(r.path);
      if (m) { fn = ROUTES[i][1]; params = m.slice(1); break; }
    }
    var root = $('#view');
    root.innerHTML = '';
    var res;
    try {
      res = fn(root, params, r.query) || {};
    } catch (e) {
      console.error(e);
      root.innerHTML = '<div class="page page-narrow"><h1>页面出错了</h1><p class="lead">' + esc(e && e.message || e) + '</p><p><a href="#/">回到首页</a></p></div>';
      res = { title: '出错了' };
    }
    routeCleanup = res.cleanup || null;
    document.title = res.title ? res.title + ' · ' + SITE : SITE;
    $$('.mainnav a').forEach(function (a) {
      if (res.nav && a.getAttribute('data-nav') === res.nav) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (!res.keepScroll) window.scrollTo(0, 0);
    if (!firstRender) { var main = $('#main'); if (main) main.focus({ preventScroll: true }); }
    if (window.KGLearning) window.KGLearning.mount(root,{track:selectedTrack,route:ROUTE,progress:P,save:saveProgress});
    var trackSelect = document.getElementById('route-track'); if(trackSelect) trackSelect.value = selectedTrack;
    firstRender = false;
  }

  var foot = $('#footer-meta');
  if (foot) {
    var meta = KG.meta || {};
    foot.textContent = (meta.version ? 'v' + meta.version + (meta.sourceDirty ? ' 开发中' : '') + ' · ' : '') + allNodes.length + ' 个知识点 · 数据生成于 ' + (meta.builtAt ? fmtDateTime(meta.builtAt).replace(/ \d\d:\d\d$/, '') : '未知时间');
  }

  window.addEventListener('hashchange', render);

  window.KGApp = {
    isLearned: isLearned,
    setLearned: setLearned,
    nextId: nextNodeId,
    go: go,
    render: render,
    progress: function () { return JSON.parse(JSON.stringify(P)); },
    search: function (q) { return searchNodes(q).map(function (r) { return r.it.n.id; }); }
  };

  render();
  updateSaveWarning();
})();
