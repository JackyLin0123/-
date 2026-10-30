/* Markdown + 公式渲染：window.KGMarkdown
 *
 * 流程：
 *   1. 按行切出围栏代码块（``` / ~~~），这些块原样交给 marked。
 *   2. 其余文本里跳过行内代码，把 $$...$$ 和 $...$ 换成纯字母数字的占位符，
 *      这样 marked 不会把公式里的 _ * \ { } 当成 Markdown 语法。
 *   3. marked 转成 HTML，再把占位符换成 KaTeX 的渲染结果（throwOnError: false）。
 *   4. 收尾：外链加 target="_blank" rel="noopener"，表格包一层可横向滚动的容器。
 */
(function () {
  'use strict';

  var NONCE = 'kgm' + Math.random().toString(36).slice(2, 8) + 'q';
  var PH_RE = new RegExp(NONCE + '(\\d+)z', 'g');
  var ALLOWED_TAGS = { br: 1, sub: 1, sup: 1, kbd: 1, mark: 1, small: 1, b: 1, i: 1, em: 1, strong: 1, u: 1, s: 1, del: 1, ins: 1 };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 第 1 步：围栏代码块 ---------- */
  function splitFences(src) {
    var lines = src.split('\n');
    var parts = [];
    var buf = [];
    var fence = null; // { ch, len }
    function flush(isCode) {
      if (buf.length) parts.push({ code: isCode, text: buf.join('\n') });
      buf = [];
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!fence) {
        var m = /^\s*(`{3,}|~{3,})/.exec(line);
        if (m && !(m[1][0] === '`' && line.slice(line.indexOf(m[1]) + m[1].length).indexOf('`') >= 0)) {
          flush(false);
          fence = { ch: m[1][0], len: m[1].length };
          buf.push(line);
          continue;
        }
        buf.push(line);
      } else {
        buf.push(line);
        var t = line.trim();
        if (t.length >= fence.len && t.split('').every(function (c) { return c === fence.ch; })) {
          flush(true);
          fence = null;
        }
      }
    }
    flush(!!fence);
    return parts;
  }

  /* ---------- 第 2 步：抽出公式 ---------- */
  function runLength(s, i, ch) {
    var j = i;
    while (j < s.length && s[j] === ch) j++;
    return j - i;
  }

  function isBlankLineAt(s, i) {
    // s[i] 是换行，且下一行只有空白
    if (s[i] !== '\n') return false;
    var j = i + 1;
    while (j < s.length && (s[j] === ' ' || s[j] === '\t')) j++;
    return j >= s.length || s[j] === '\n';
  }

  function findCodeSpanEnd(s, start, run) {
    var j = start;
    while (j < s.length) {
      var c = s[j];
      if (c === '`') {
        var r = runLength(s, j, '`');
        if (r === run) return j;
        j += r;
        continue;
      }
      if (c === '\n' && isBlankLineAt(s, j)) return -1;
      j++;
    }
    return -1;
  }

  function findInlineMathEnd(s, start) {
    // 开头的 $ 后面不能是空白；结尾的 $ 前面不能是空白，后面不能紧跟数字（避免把 $5 和 $10 当公式）
    if (start >= s.length || /\s/.test(s[start]) || s[start] === '$') return -1;
    var j = start;
    var limit = Math.min(s.length, start + 2000);
    while (j < limit) {
      var c = s[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '`') return -1;
      if (c === '\n' && isBlankLineAt(s, j)) return -1;
      if (c === '$') {
        if (!/\s/.test(s[j - 1]) && !/[0-9]/.test(s[j + 1] || '')) return j;
      }
      j++;
    }
    return -1;
  }

  function findDisplayMathEnd(s, start) {
    var j = start;
    while (j < s.length - 1) {
      var c = s[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '$' && s[j + 1] === '$') return j;
      j++;
    }
    return -1;
  }

  function extractFromText(s, store) {
    var out = '';
    var i = 0;
    while (i < s.length) {
      var c = s[i];
      if (c === '\\') {
        out += s.substr(i, 2);
        i += 2;
        continue;
      }
      if (c === '`') {
        var run = runLength(s, i, '`');
        var end = findCodeSpanEnd(s, i + run, run);
        if (end >= 0) {
          out += s.slice(i, end + run);
          i = end + run;
        } else {
          out += s.substr(i, run);
          i += run;
        }
        continue;
      }
      if (c === '$') {
        if (s[i + 1] === '$') {
          var dEnd = findDisplayMathEnd(s, i + 2);
          if (dEnd >= 0) {
            out += placeholder(store, s.slice(i + 2, dEnd), true, s.slice(i, dEnd + 2));
            i = dEnd + 2;
            continue;
          }
          out += '$$';
          i += 2;
          continue;
        }
        var iEnd = findInlineMathEnd(s, i + 1);
        if (iEnd >= 0) {
          out += placeholder(store, s.slice(i + 1, iEnd), false, s.slice(i, iEnd + 1));
          i = iEnd + 1;
          continue;
        }
        out += '$';
        i++;
        continue;
      }
      out += c;
      i++;
    }
    return out;
  }

  function placeholder(store, tex, display, raw) {
    store.push({ tex: tex.trim(), display: display, raw: raw });
    return NONCE + (store.length - 1) + 'z';
  }

  function extract(src) {
    var store = [];
    var parts = splitFences(String(src == null ? '' : src).replace(/\r\n?/g, '\n'));
    var text = parts.map(function (p) { return p.code ? p.text : extractFromText(p.text, store); }).join('\n');
    return { text: text, store: store };
  }

  /* ---------- 第 3 步：KaTeX ---------- */
  var mathCache = new Map();

  function renderTex(tex, display) {
    var key = (display ? 'D' : 'I') + tex;
    if (mathCache.has(key)) return mathCache.get(key);
    var html = null;
    if (window.katex && typeof window.katex.renderToString === 'function') {
      try {
        html = window.katex.renderToString(tex, {
          displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml', trust: false
        });
      } catch (e) {
        html = null;
      }
    }
    if (mathCache.size > 4000) mathCache.clear();
    mathCache.set(key, html);
    return html;
  }

  function mathNode(item) {
    var el = document.createElement('span');
    el.className = item.display ? 'math math-display' : 'math math-inline';
    var html = renderTex(item.tex, item.display);
    if (html) {
      el.innerHTML = html;
    } else {
      el.classList.add('math-fallback');
      el.textContent = item.raw;
    }
    return el;
  }

  /* ---------- marked 配置 ---------- */
  var md = null;

  function sanitizeHtml(text) {
    // 正文约定不写 HTML。为了防止 List<Integer> 这类文字被当成标签吞掉，只放行少数无属性的标签，其余转义。
    return String(text).replace(/<!--[\s\S]*?-->/g, '').split(/(<\/?[A-Za-z][\w-]*(?:\s[^<>]*)?\/?>)/).map(function (piece, idx) {
      if (idx % 2 === 1) {
        var m = /^<(\/?)([A-Za-z][\w-]*)/.exec(piece);
        var name = m && m[2].toLowerCase();
        if (name && ALLOWED_TAGS[name]) return '<' + m[1] + name + (name === 'br' ? ' /' : '') + '>';
        return escapeHtml(piece);
      }
      return piece.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }).join('');
  }

  function getMarked() {
    if (md) return md;
    var lib = window.marked;
    if (!lib) return null;
    var Ctor = lib.Marked;
    md = Ctor ? new Ctor() : lib;
    var opts = { gfm: true, breaks: false };
    if (md.setOptions && !Ctor) md.setOptions(opts);
    md.use({
      gfm: true,
      breaks: false,
      renderer: {
        html: function (html) {
          var text = html && typeof html === 'object' ? html.text : html;
          return sanitizeHtml(text || '');
        }
      }
    });
    return md;
  }

  function fallbackMarkdown(text, inline) {
    var esc = escapeHtml(text);
    if (inline) return esc;
    return esc.split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('');
  }

  /* ---------- 第 4 步：还原占位符并收尾 ---------- */
  // 行内公式后面紧跟的中文标点、前面紧挨的左括号，和公式包进一个不折行的 span，
  // 免得一行以「，」「。」开头。只处理短公式，长公式照常可以在运算符处折行。
  var CLOSE_PUNCT = /^[，。、；：！？）」』》〉】,.;:!?)\]]/;
  var OPEN_PUNCT = /[（「『《〈【(\[]$/;
  function isShortTex(tex) {
    return String(tex).replace(/\\[a-zA-Z]+/g, 'x').replace(/[\s{}^_\\]/g, '').length <= 24;
  }

  function finish(html, store, opts) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    var root = tpl.content;

    if (store.length) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var hits = [];
      while (walker.nextNode()) {
        if (walker.currentNode.nodeValue.indexOf(NONCE) >= 0) hits.push(walker.currentNode);
      }
      hits.forEach(function (tn) {
        var parent = tn.parentNode;
        var inCode = !!(parent && parent.closest && parent.closest('code, pre'));
        var s = tn.nodeValue;
        var frag = document.createDocumentFragment();
        var last = 0;
        var m;
        PH_RE.lastIndex = 0;
        while ((m = PH_RE.exec(s))) {
          var item = store[+m[1]];
          if (!item) continue;
          var start = m.index, end = PH_RE.lastIndex;
          var node = inCode ? document.createTextNode(item.raw) : mathNode(item);
          if (!inCode && !item.display && isShortTex(item.tex)) {
            var pre = OPEN_PUNCT.test(s.slice(last, start)) ? s.charAt(start - 1) : '';
            var post = CLOSE_PUNCT.exec(s.slice(end));
            if (pre || post) {
              var glue = document.createElement('span');
              glue.className = 'math-nb';
              if (pre) { glue.appendChild(document.createTextNode(pre)); start -= 1; }
              glue.appendChild(node);
              if (post) { glue.appendChild(document.createTextNode(post[0])); end += post[0].length; PH_RE.lastIndex = end; }
              node = glue;
            }
          }
          if (start > last) frag.appendChild(document.createTextNode(s.slice(last, start)));
          frag.appendChild(node);
          last = end;
        }
        if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
        parent.replaceChild(frag, tn);
      });
      // 属性里的占位符（比如链接标题）还原成原文
      Array.prototype.forEach.call(root.querySelectorAll('*'), function (el) {
        Array.prototype.forEach.call(el.attributes, function (a) {
          if (a.value.indexOf(NONCE) >= 0) {
            a.value = a.value.replace(PH_RE, function (_, k) { return store[+k] ? store[+k].raw : ''; });
          }
        });
      });
      // 段落里只有一个独立公式时，把段落换成块级容器
      Array.prototype.forEach.call(root.querySelectorAll('p'), function (p) {
        var kids = Array.prototype.filter.call(p.childNodes, function (n) {
          return !(n.nodeType === 3 && !n.nodeValue.trim());
        });
        if (kids.length === 1 && kids[0].nodeType === 1 && kids[0].classList.contains('math-display')) {
          var div = document.createElement('div');
          div.className = kids[0].className;
          while (kids[0].firstChild) div.appendChild(kids[0].firstChild);
          p.parentNode.replaceChild(div, p);
        }
      });
    }

    Array.prototype.forEach.call(root.querySelectorAll('a[href]'), function (a) {
      var href = a.getAttribute('href') || '';
      if (/^\s*javascript:/i.test(href)) {
        a.removeAttribute('href');
      } else if (/^(https?:)?\/\//i.test(href)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
        a.classList.add('ext');
      }
    });
    Array.prototype.forEach.call(root.querySelectorAll('table'), function (t) {
      if (t.parentNode && t.parentNode.classList && t.parentNode.classList.contains('table-wrap')) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    });
    Array.prototype.forEach.call(root.querySelectorAll('pre'), function (pre) {
      pre.classList.add('code-block');
      pre.setAttribute('tabindex', '0');
      var code = pre.querySelector('code[class*="language-"]');
      var lang = code && /language-([\w+#.-]+)/.exec(code.className);
      if (lang) pre.setAttribute('data-lang', lang[1]);
    });
    Array.prototype.forEach.call(root.querySelectorAll('pre > code.language-flow, pre > code.language-stack, pre > code.language-tree'), function (code) {
      var kind = /language-(\w+)/.exec(code.className)[1];
      var fig = diagram(kind, code.textContent);
      if (fig) code.parentNode.parentNode.replaceChild(fig, code.parentNode);
    });
    Array.prototype.forEach.call(root.querySelectorAll('blockquote'), callout);
    Array.prototype.forEach.call(root.querySelectorAll('img'), function (img) {
      img.setAttribute('loading', 'lazy');
      img.setAttribute('alt', img.getAttribute('alt') || '');
    });
    var minH = opts && opts.minHeading;
    if (minH) {
      var hs = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
      var top = 7;
      Array.prototype.forEach.call(hs, function (h) { top = Math.min(top, +h.tagName[1]); });
      var shift = Math.max(0, minH - top);
      if (shift) {
        Array.prototype.forEach.call(hs, function (h) {
          var nh = document.createElement('h' + Math.min(6, +h.tagName[1] + shift));
          while (h.firstChild) nh.appendChild(h.firstChild);
          h.parentNode.replaceChild(nh, h);
        });
      }
    }
    var box = document.createElement('div');
    box.appendChild(root);
    return box.innerHTML;
  }

  /* ---------- 图例：```flow / ```stack / ```tree 和 > [!kind] 提示框 ----------
   * flow：每行一条链，节点用 -> 连接，-(标签)-> 给箭头加字；「标题 | 说明」给节点加一行小字。
   * stack：每行一层，从上到下；「名称 | 说明 | 说明」。加一行 style: pyramid 画成上窄下宽。
   * tree：按缩进分层（行首的 - 可有可无），同样支持「标题 | 说明」。
   * 三种都可以用 title: 开头的一行写图题。节点文字按行内 Markdown 渲染，可以写 `代码` 和 $公式$。 */
  var CALLOUTS = {
    feynman: '大白话', analogy: '打个比方', key: '要点', check: '自查', warn: '注意', note: '补充'
  };

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function cellsOf(text) {
    return text.split(/\s+\|\s+|\s*\|\s*$/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function nodeBox(text) {
    var cells = cellsOf(text);
    var box = el('div', 'dg-node');
    box.appendChild(el('span', 'dg-title', inline(cells[0] || '')));
    if (cells.length > 1) box.appendChild(el('span', 'dg-detail', cells.slice(1).map(inline).join('<br>')));
    return box;
  }

  function diagram(kind, src) {
    var title = '', style = '', lines = [];
    String(src).replace(/\s+$/, '').split('\n').forEach(function (line) {
      var m = /^\s*(title|style)\s*[:：]\s*(.*)$/.exec(line);
      if (m && m[1] === 'title') title = m[2].trim();
      else if (m) style = m[2].trim();
      else if (line.trim()) lines.push(line);
    });
    if (!lines.length) return null;
    var fig = el('figure', 'dg dg-' + kind + (style ? ' dg-' + style : ''));
    if (kind === 'flow') {
      lines.forEach(function (line) {
        var row = el('div', 'dg-row');
        line.trim().split(/\s*(-\(.*?\)->|->)\s*/).forEach(function (part, i) {
          if (i % 2 === 0) { row.appendChild(nodeBox(part)); return; }
          var label = /^-\((.*)\)->$/.exec(part);
          var arrow = el('div', 'dg-arrow');
          if (!label) arrow.setAttribute('aria-hidden', 'true');
          if (label && label[1].trim()) arrow.appendChild(el('span', 'dg-label', inline(label[1].trim())));
          arrow.appendChild(el('span', 'dg-line'));
          row.appendChild(arrow);
        });
        fig.appendChild(row);
      });
    } else if (kind === 'stack') {
      var n = lines.length;
      lines.forEach(function (line, i) {
        var cells = cellsOf(line.trim());
        var layer = el('div', 'dg-layer');
        if (style === 'pyramid') layer.style.width = (n > 1 ? 46 + 54 * i / (n - 1) : 100) + '%';
        layer.appendChild(el('span', 'dg-title', inline(cells[0] || '')));
        if (cells.length > 1) layer.appendChild(el('span', 'dg-detail', cells.slice(1).map(inline).join(' · ')));
        fig.appendChild(layer);
      });
    } else {
      // tree：用栈把缩进转换成嵌套列表
      var rootList = el('ul', 'dg-tree-list');
      var stack = [{ indent: -1, list: rootList }];
      lines.forEach(function (line) {
        var indent = /^\s*/.exec(line)[0].replace(/\t/g, '  ').length;
        // 行首的 - / * 是可选的列表符号；剩下的若以 | 开头，说明它本身就是节点文字（比如运算符 *）
        var text = line.trim();
        var bullet = /^[-*]\s+/.exec(text);
        if (bullet && text.slice(bullet[0].length).charAt(0) !== '|') text = text.slice(bullet[0].length);
        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
        var parent = stack[stack.length - 1];
        var list = parent.list;
        if (!list) { list = parent.list = el('ul'); parent.li.appendChild(list); }
        var li = el('li');
        li.appendChild(nodeBox(text));
        list.appendChild(li);
        stack.push({ indent: indent, li: li, list: null });
      });
      fig.appendChild(rootList);
    }
    if (title) fig.appendChild(el('figcaption', '', inline(title)));
    return fig;
  }

  function callout(bq) {
    var p = bq.firstElementChild;
    if (!p || p.tagName !== 'P') return;
    var m = /^\s*\[!(\w+)\][ \t]*([^\n<]*)(?:\n|<br\s*\/?>)?/.exec(p.innerHTML);
    if (!m || !CALLOUTS[m[1].toLowerCase()]) return;
    var kind = m[1].toLowerCase();
    p.innerHTML = p.innerHTML.slice(m[0].length);
    if (!p.innerHTML.trim()) bq.removeChild(p);
    var aside = el('aside', 'tip-box tip-' + kind);
    aside.appendChild(el('div', 'tip-title', m[2].trim() || CALLOUTS[kind]));
    while (bq.firstChild) aside.appendChild(bq.firstChild);
    bq.parentNode.replaceChild(aside, bq);
  }

  /* ---------- 对外接口 ---------- */
  function render(src, opts) {
    if (src == null || src === '') return '';
    var ex = extract(src);
    var m = getMarked();
    var html;
    try {
      html = m ? m.parse(ex.text) : fallbackMarkdown(ex.text, false);
    } catch (e) {
      html = fallbackMarkdown(ex.text, false);
    }
    return finish(html, ex.store, opts || { minHeading: 3 });
  }

  function inline(src) {
    if (src == null || src === '') return '';
    var ex = extract(src);
    var m = getMarked();
    var html;
    try {
      html = m ? m.parseInline(ex.text) : fallbackMarkdown(ex.text, true);
    } catch (e) {
      html = fallbackMarkdown(ex.text, true);
    }
    return finish(html, ex.store, null);
  }

  function renderInto(el, src, opts) {
    el.innerHTML = render(src, opts);
    return el;
  }

  window.KGMarkdown = {
    render: render,
    inline: inline,
    renderInto: renderInto,
    escape: escapeHtml,
    _extract: extract,
    _nonce: NONCE
  };
})();
