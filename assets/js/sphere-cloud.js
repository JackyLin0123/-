/* Local 3D knowledge nebula: 3d-force-graph + Three.js (MIT).
 * Source, pinned dependencies and notices: assets/vendor/nebula/UPSTREAM.md.
 */
(function () {
  'use strict';
  function mount(host, options) {
    var o = options || {}, entries = o.entries || [], links = o.links || [], R = window.KGNebulaRuntime;
    var graph = null, destroyed = false, raf = 0, selected = null, hoveredNode = null, highlight = null;
    var hovered = false, focused = false, blocked = false, dragging = false, visible = true, ready = false, fallback = false;
    var motion = matchMedia('(prefers-reduced-motion: reduce)');
    var playing = typeof o.playing === 'boolean' ? o.playing : !motion.matches;
    var nodes = [], byId = {}, neighbors = {}, removers = [], resources = [];
    var palette = { foundation: '#e8b979', theory: '#f689ad', ds: '#61baff', arch: '#f3ca65', os: '#55dfb6', pl: '#62dce6', compiler: '#ff9c79', ai: '#ae9aff', eng: '#ed9bd0', hum: '#dacb9a', research: '#c3e07a' };
    function el(tag, cls, text) { var node = document.createElement(tag); if (cls) node.className = cls; if (text) node.textContent = text; return node; }
    function listen(target, name, fn, config) { target.addEventListener(name, fn, config); removers.push(function () { target.removeEventListener(name, fn, config); }); }
    function resource(value) { resources.push(value); return value; }
    var root = el('div', 'kgg-sphere-shell'); root.dataset.renderer = 'webgl';
    var header = el('div', 'kgg-sphere-head'), caption = el('span', 'kgg-sphere-caption', '知识星云');
    var count = el('span', 'kgg-sphere-count', entries.length + ' 个知识点 · ' + links.length + ' 条关系'); count.setAttribute('role', 'status');
    var expand = el('button', 'kgg-btn kgg-sphere-expand', '放大查看'); expand.type = 'button'; expand.setAttribute('aria-label', '放大3D知识云'); expand.hidden = !o.onExpand;
    header.appendChild(caption); header.appendChild(count); header.appendChild(expand);
    var scene = el('div', 'kgg-sphere-scene kgg-nebula-scene'); scene.tabIndex = 0; scene.setAttribute('role', 'group'); scene.setAttribute('aria-label', '3D 知识星云，拖动旋转，滚轮缩放，方向键旋转，点击知识点查看详情');
    var viewport = el('div', 'kgg-nebula-viewport'), labels = el('div', 'kgg-nebula-labels');
    scene.appendChild(viewport); scene.appendChild(labels);
    var footer = el('div', 'kgg-sphere-foot'), hint = el('span', 'kgg-sphere-hint', '拖动旋转 · 滚轮缩放 · 点击探索');
    var controls = el('div', 'kgg-sphere-controls');
    var reset = el('button', 'kgg-btn', '复位星云'), play = el('button', 'kgg-btn');
    reset.type = play.type = 'button'; reset.setAttribute('aria-label', '复位星云');
    controls.appendChild(reset); controls.appendChild(play); footer.appendChild(hint); footer.appendChild(controls);
    root.appendChild(header); root.appendChild(scene); root.appendChild(footer); host.appendChild(root);
    var domains = Array.from(new Set(entries.map(function (e) { return e.domain; })));
    entries.forEach(function (entry, index) {
      var d = domains.indexOf(entry.domain), phi = Math.acos(1 - 2 * (d + .5) / domains.length), theta = d * 2.399963;
      var anchor = { x: 115 * Math.cos(theta) * Math.sin(phi), y: 95 * Math.cos(phi), z: 115 * Math.sin(theta) * Math.sin(phi) };
      var angle = index * 2.399963, spread = 12 + (index % 7) * 4;
      var node = Object.assign({}, entry, { color: palette[entry.domain] || '#85c8ff', anchor: anchor, x: anchor.x + Math.cos(angle) * spread, y: anchor.y + Math.sin(angle) * spread, z: anchor.z + Math.sin(index * 1.71) * spread });
      var word = el('span', 'kgg-sphere-word kgg-nebula-word', entry.label);
      word.dataset.nodeId = entry.id; word.tabIndex = 0; word.setAttribute('role', 'button'); word.title = entry.title;
      word.style.setProperty('--kc', node.color); labels.appendChild(word); node.word = word;
      nodes.push(node); byId[node.id] = node; neighbors[node.id] = {};
    });
    links = links.filter(function (link) { return byId[link.source] && byId[link.target]; }).map(function (link) {
      neighbors[link.source][link.target] = true; neighbors[link.target][link.source] = true; return Object.assign({}, link);
    });
    function activeSet() {
      if (highlight) return highlight;
      var id = selected || hoveredNode;
      if (!id) return null;
      var set = Object.assign({}, neighbors[id]); set[id] = true; return set;
    }
    function updateVisuals() {
      var active = activeSet();
      nodes.forEach(function (node) {
        node.word.classList.toggle('is-learned', !!node.learned); node.word.classList.toggle('is-next', !!node.next); node.word.classList.toggle('is-selected', selected === node.id);
        node.word.setAttribute('aria-label', node.aria || node.title);
        node.word.style.fontSize = (host.clientWidth < 560 ? 11 + Math.round(node.weight * 3) : 12 + Math.round(node.weight * 3)) + 'px';
        node.word.style.fontWeight = node.weight > .45 ? '600' : '400';
        if (node.orb) {
          var dim = active && !active[node.id];
          var inspecting = node.id === selected || node.id === hoveredNode;
          var lit = !!node.learned;
          node.orb.children[0].material.color.set(node.color).multiplyScalar(lit || inspecting ? 1 : .58);
          node.orb.children[0].material.opacity = dim ? (lit ? .28 : .1) : lit || inspecting ? 1 : .38;
          node.orb.children[1].material.opacity = dim ? (lit ? .1 : .025) : inspecting ? .95 : lit ? .85 : .1;
          node.orb.children[1].scale.setScalar((2.2 + node.weight * 1.5) * (inspecting ? 7 : lit ? 6.4 : 3.8));
          node.word.dataset.brightness = lit ? 'lit' : 'dim';
        }
      });
      if (graph) graph.linkColor(function (link) {
        var a = typeof link.source === 'object' ? link.source.id : link.source, b = typeof link.target === 'object' ? link.target.id : link.target;
        return active ? (active[a] && active[b] ? '#85cfff' : 'rgba(80,121,157,0.06)') : 'rgba(104,159,207,0.38)';
      }).linkDirectionalParticles(function (link) {
        var a = typeof link.source === 'object' ? link.source.id : link.source, b = typeof link.target === 'object' ? link.target.id : link.target;
        return !motion.matches && playing && selected && (a === selected || b === selected) ? 1 : 0;
      });
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function canRotate() { return !destroyed && !!graph && playing && !hovered && !hoveredNode && !dragging && !focused && !blocked && visible && !document.hidden; }
    function sync() {
      if (destroyed) return;
      play.textContent = playing ? '暂停旋转' : '自动旋转'; play.setAttribute('aria-label', playing ? '暂停自动旋转' : '开始自动旋转'); play.setAttribute('aria-pressed', String(playing));
      root.dataset.playing = String(canRotate());
      if (graph) {
        graph.controls().autoRotate = canRotate();
        if (visible && !document.hidden) { graph.resumeAnimation(); if (!raf) raf = requestAnimationFrame(frame); }
        else { graph.pauseAnimation(); stop(); }
      }
    }
    function projectLabels() {
      if (!graph || !ready) return;
      var camera = graph.camera(), active = activeSet(), boxes = [], shown = 0, maxLabels = host.clientWidth < 560 ? 18 : 38;
      maxLabels = active ? maxLabels : (host.clientWidth < 560 ? 10 : 20);
      var width = scene.clientWidth, height = scene.clientHeight;
      nodes.slice().sort(function (a, b) {
        if ((a.id === selected) !== (b.id === selected)) return a.id === selected ? -1 : 1;
        return camera.position.distanceToSquared(a.position || a) - camera.position.distanceToSquared(b.position || b);
      }).forEach(function (node) {
        var projected = new R.Vector3(node.x, node.y, node.z).project(camera);
        var x = (projected.x + 1) * width / 2 + 6, y = (1 - projected.y) * height / 2 - 10;
        var w = node.word.offsetWidth, h = node.word.offsetHeight;
        // Labels are culled, never nodes: all data remains in the WebGL graph and keyboard order.
        var fits = projected.z > -1 && projected.z < 1 && x > 3 && x + w < width - 3 && y > 3 && y + h < height - 3;
        var box = [x, y, w, h], overlap = boxes.some(function (b) { return x < b[0] + b[2] + 4 && b[0] < x + w + 4 && y < b[1] + b[3] + 3 && b[1] < y + h + 3; });
        var show = fits && (!overlap || node.id === selected) && (shown < maxLabels || node.id === selected);
        var alpha = show ? (active && !active[node.id] ? .12 : (node.id === selected ? 1 : (active ? .9 : .65))) : 0;
        if (show) { boxes.push(box); shown++; }
        node.word.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
        node.word.style.opacity = alpha; node.word.style.pointerEvents = alpha > .25 ? 'auto' : 'none'; node.word.style.zIndex = node.id === selected ? '3' : '1';
        node.word.dataset.depth = node.z.toFixed(2); node.word.dataset.labelVisible = String(show);
      });
    }
    function frame() { raf = 0; if (destroyed || !visible || document.hidden) return; projectLabels(); raf = requestAnimationFrame(frame); }
    function fit() {
      if (!graph || !ready || !nodes.length) return;
      // Fit the solved coordinates directly: onEngineStop can precede mesh-position updates.
      var bounds = ['x', 'y', 'z'].map(function (axis) { var values = nodes.map(function (node) { return node[axis]; }); return [Math.min.apply(null, values) - 6, Math.max.apply(null, values) + 6]; });
      var center = { x: (bounds[0][0] + bounds[0][1]) / 2, y: (bounds[1][0] + bounds[1][1]) / 2, z: (bounds[2][0] + bounds[2][1]) / 2 };
      var tan = Math.tan(graph.camera().fov * Math.PI / 360), aspect = Math.max(.2, scene.clientWidth / Math.max(1, scene.clientHeight));
      var distance = Math.max((bounds[1][1] - bounds[1][0]) / (2 * tan), (bounds[0][1] - bounds[0][0]) / (2 * tan * aspect)) * 1.2 + (bounds[2][1] - bounds[2][0]) / 2;
      graph.cameraPosition({ x: center.x, y: center.y + distance * .06, z: center.z + Math.max(80, distance) }, center);
    }
    function focus(id) {
      var node = byId[id]; if (!node) return false;
      selected = id; updateVisuals();
      if (graph) {
        var direction = graph.camera().position.clone().sub(new R.Vector3(node.x, node.y, node.z)).normalize().multiplyScalar(140);
        graph.cameraPosition({ x: node.x + direction.x, y: node.y + direction.y, z: node.z + direction.z }, node, motion.matches ? 0 : 450);
        projectLabels();
      }
      return true;
    }
    function resize() {
      if (destroyed) return;
      if (host.closest('.kgg-cloud-dialog')) hovered = false;
      updateVisuals();
      if (graph) { graph.width(scene.clientWidth).height(scene.clientHeight); if (!selected) fit(); else projectLabels(); }
    }
    function select(id, keyboard) { focus(id); if (o.onSelect) o.onSelect(id, keyboard); }
    function hover(id) { if (hoveredNode === id) return; hoveredNode = id; updateVisuals(); sync(); }
    function initialize() {
      if (!nodes.length) { root.dataset.renderer = 'empty'; root.dataset.ready = 'true'; scene.appendChild(el('div', 'kgg-nebula-empty', '没有可显示的知识点')); play.disabled = true; reset.disabled = true; sync(); return; }
      try {
        if (!R) throw new Error('3D runtime unavailable');
        var canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
        var ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.14, 'rgba(255,255,255,.85)'); gradient.addColorStop(.4, 'rgba(255,255,255,.2)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
        var glow = resource(new R.CanvasTexture(canvas)), geometry = resource(new R.SphereGeometry(1, 12, 10));
        graph = new R.ForceGraph3D(viewport, { controlType: 'orbit', rendererConfig: { antialias: true, alpha: true, powerPreference: 'low-power' } });
        graph.width(scene.clientWidth).height(scene.clientHeight).backgroundColor('rgba(0,0,0,0)').showNavInfo(false)
          .nodeLabel(function () { return ''; }).nodeThreeObject(function (node) {
            var group = new R.Group(), size = 1.7 + node.weight * 1.5;
            var core = new R.Mesh(geometry, resource(new R.MeshBasicMaterial({ color: node.color, transparent: true })));
            core.scale.setScalar(size); group.add(core);
            var halo = new R.Sprite(resource(new R.SpriteMaterial({ map: glow, color: node.color, transparent: true, opacity: .55, blending: R.AdditiveBlending, depthWrite: false })));
            halo.scale.setScalar(size * 5.5); group.add(halo); node.orb = group; return group;
          }).linkWidth(0).linkOpacity(.28).linkDirectionalParticleWidth(1.3).linkDirectionalParticleSpeed(.003)
          .enableNodeDrag(false).warmupTicks(160).cooldownTicks(0)
          .onNodeClick(function (node) { select(node.id, false); })
          .onNodeHover(function (node) { hover(node ? node.id : null); })
          .onBackgroundClick(function () { if (!host.closest('.kgg-cloud-dialog') && o.onExpand) o.onExpand(); })
          .onEngineStop(function () { if (!ready && !destroyed) { ready = true; root.dataset.ready = 'true'; fit(); updateVisuals(); } });
        graph.renderer().setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
        graph.controls().enableDamping = false; graph.controls().autoRotateSpeed = .35; graph.controls().minDistance = 45; graph.controls().maxDistance = 1500;
        graph.d3Force('charge').strength(-45).distanceMax(160);
        graph.d3Force('link').distance(function (link) { return link.cross ? 85 : 29; }).strength(function (link) { return link.cross ? .025 : .16; });
        graph.d3Force('center', null);
        graph.d3Force('domains', function (alpha) { nodes.forEach(function (node) { node.vx += (node.anchor.x - node.x) * alpha * .075; node.vy += (node.anchor.y - node.y) * alpha * .075; node.vz += (node.anchor.z - node.z) * alpha * .075; }); });
        graph.graphData({ nodes: nodes, links: links });
        graph.cameraPosition({ x: 0, y: 30, z: 500 });
        var starsGeometry = resource(new R.BufferGeometry()), stars = [];
        for (var i = 0; i < 160; i++) { var a = i * 2.399963, z = 1 - 2 * (i + .5) / 160, r = 650 * Math.sqrt(1 - z * z); stars.push(r * Math.cos(a), r * Math.sin(a), 650 * z); }
        starsGeometry.setAttribute('position', new R.Float32BufferAttribute(stars, 3));
        graph.scene().add(new R.Points(starsGeometry, resource(new R.PointsMaterial({ color: '#88a8cb', size: .9, transparent: true, opacity: .35, sizeAttenuation: true }))));
        // Decorative dust is a separate Points object: it never adds knowledge nodes or relations.
        var dustGeometry = resource(new R.BufferGeometry()), dust = [], colors = [], seed = 1823;
        function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
        var dustCount = host.clientWidth < 560 ? 1400 : 3200;
        for (var j = 0; j < dustCount; j++) {
          var rDust = 20 + Math.pow(random(), .65) * 190, arm = j % 3, angleDust = rDust * .018 + arm * Math.PI * 2 / 3 + (random() - .5) * 1.3;
          dust.push(Math.cos(angleDust) * rDust, Math.sin(angleDust) * rDust * .7, (random() - .5) * 65 + Math.sin(angleDust * 2) * 18);
          var tint = random(); colors.push(.2 + tint * .18, .28 + (1 - tint) * .24, .68 + tint * .28);
        }
        dustGeometry.setAttribute('position', new R.Float32BufferAttribute(dust, 3)); dustGeometry.setAttribute('color', new R.Float32BufferAttribute(colors, 3));
        graph.scene().add(new R.Points(dustGeometry, resource(new R.PointsMaterial({ map: glow, size: 2.8, vertexColors: true, transparent: true, opacity: .65, blending: R.AdditiveBlending, depthWrite: false }))));
        domains.forEach(function (domain) {
          var node = nodes.find(function (item) { return item.domain === domain; });
          var mist = new R.Sprite(resource(new R.SpriteMaterial({ map: glow, color: palette[domain] || '#87bfff', transparent: true, opacity: .13, blending: R.AdditiveBlending, depthWrite: false })));
          mist.position.set(node.anchor.x * .65, node.anchor.y * .65, node.anchor.z * .65); mist.scale.set(150, 95, 1); graph.scene().add(mist);
        });
        updateVisuals(); sync();
      } catch (error) {
        fallback = true; root.dataset.renderer = 'fallback'; play.disabled = true; reset.disabled = true;
        if (graph) { graph._destructor(); graph = null; }
        viewport.remove(); labels.classList.add('kgg-nebula-fallback');
        hint.textContent = '3D 暂不可用，仍可点击知识点学习';
        nodes.forEach(function (node) { node.word.style.opacity = 1; }); updateVisuals(); sync();
      }
    }
    listen(expand, 'click', function () { if (o.onExpand) o.onExpand(); });
    listen(reset, 'click', function () { selected = null; hoveredNode = null; updateVisuals(); fit(); });
    listen(play, 'click', function () { playing = !playing; updateVisuals(); sync(); });
    listen(scene, 'pointerenter', function (e) { if (e.pointerType !== 'touch') { hovered = !host.closest('.kgg-cloud-dialog'); sync(); } });
    listen(scene, 'pointerleave', function () { hovered = false; hover(null); sync(); });
    listen(scene, 'pointerdown', function () { dragging = true; sync(); });
    listen(document, 'pointerup', function () { if (dragging) { dragging = false; sync(); } });
    listen(document, 'pointercancel', function () { if (dragging) { dragging = false; sync(); } });
    listen(labels, 'click', function (e) { var word = e.target.closest('[data-node-id]'); if (word) { e.stopPropagation(); select(word.dataset.nodeId, false); } });
    listen(labels, 'pointerover', function (e) { var word = e.target.closest('[data-node-id]'); if (word) hover(word.dataset.nodeId); });
    listen(labels, 'pointerout', function (e) { if (!labels.contains(e.relatedTarget)) hover(null); });
    listen(scene, 'focusin', function (e) { focused = true; if (e.target.dataset.nodeId && e.target.matches(':focus-visible')) focus(e.target.dataset.nodeId); sync(); });
    listen(scene, 'focusout', function (e) { if (!scene.contains(e.relatedTarget)) { focused = false; sync(); } });
    listen(scene, 'keydown', function (e) {
      var word = e.target.closest('[data-node-id]');
      if (word && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(word.dataset.nodeId, true); return; }
      if (!graph || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) < 0) return;
      e.preventDefault();
      var target = graph.controls().target, delta = graph.camera().position.clone().sub(target), radius = delta.length();
      var theta = Math.atan2(delta.x, delta.z) + (e.key === 'ArrowLeft' ? -.15 : e.key === 'ArrowRight' ? .15 : 0);
      var phi = Math.acos(delta.y / radius) + (e.key === 'ArrowUp' ? -.15 : e.key === 'ArrowDown' ? .15 : 0); phi = Math.max(.1, Math.min(Math.PI - .1, phi));
      graph.cameraPosition({ x: target.x + radius * Math.sin(phi) * Math.sin(theta), y: target.y + radius * Math.cos(phi), z: target.z + radius * Math.sin(phi) * Math.cos(theta) }, target); projectLabels();
    });
    listen(document, 'visibilitychange', sync);
    listen(motion, 'change', function () { if (motion.matches) playing = false; sync(); });
    var observer = window.IntersectionObserver && new IntersectionObserver(function (records) { visible = records[0].isIntersecting; sync(); });
    if (observer) observer.observe(host);
    initialize();
    return {
      focus: focus,
      setBlocked: function (value) { blocked = !!value; sync(); },
      setHighlight: function (value) { highlight = value; updateVisuals(); projectLabels(); },
      refresh: function (value) { entries = value; value.forEach(function (entry) { if (byId[entry.id]) Object.assign(byId[entry.id], entry); }); updateVisuals(); projectLabels(); },
      clearSelection: function () { selected = null; updateVisuals(); projectLabels(); },
      reset: function () { selected = null; hoveredNode = null; updateVisuals(); fit(); },
      resize: resize,
      isPlaying: function () { return playing; },
      snapshot: function () { return { ready: ready, nodes: nodes.map(function (node) { return { id: node.id, x: node.x, y: node.y, z: node.z, learned: !!node.learned, opacity: node.orb ? node.orb.children[0].material.opacity : null, glow: node.orb ? node.orb.children[1].material.opacity : null }; }), links: links.map(function (link) { return { source: typeof link.source === 'object' ? link.source.id : link.source, target: typeof link.target === 'object' ? link.target.id : link.target }; }), camera: graph ? graph.cameraPosition() : null, renderer: !nodes.length ? 'empty' : fallback ? 'fallback' : 'webgl' }; },
      destroy: function () {
        if (destroyed) return; destroyed = true; stop(); removers.forEach(function (remove) { remove(); }); if (observer) observer.disconnect();
        if (graph) { var renderer = graph.renderer(); graph._destructor(); renderer.forceContextLoss(); graph = null; }
        resources.forEach(function (item) { item.dispose(); }); resources = []; root.remove();
      }
    };
  }
  window.KGSphereCloud = { mount: mount };
})();
