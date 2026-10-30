/* 交互演示 ai-conv2d：卷积运算，卷积核怎么在图上滑。接口见 _build/SITE-SPEC.md 第 7.2 节。 */
(function () {
  'use strict';
  var ID = 'ai-conv2d', C = 'dm-ai-conv2d-', N = 7, MS = 900, MINUS = '−';

  // ---------- 预设 ----------
  var IMGS = [ // [id, 名字, (行, 列) => 0–9]
    ['v', '竖直边缘', (r, c) => c < 3 ? 9 : 0],          // 每行都是 9 9 9 0 0 0 0
    ['h', '水平边缘', (r, c) => r < 3 ? 9 : 0],
    ['d', '对角线', (r, c) => r === c ? 9 : 0],
    ['b', '小方块', (r, c) => r > 1 && r < 5 && c > 1 && c < 5 ? 9 : 0]
  ];
  var KERS = [ // [id, 名字, 整数权重, 除数]：输出 = Σ(x·w) ÷ 除数
    ['v', '竖边检测', [[1, 0, -1], [1, 0, -1], [1, 0, -1]], 1],
    ['h', '横边检测', [[1, 1, 1], [0, 0, 0], [-1, -1, -1]], 1],
    ['m', '均值模糊（1/9）', [[1, 1, 1], [1, 1, 1], [1, 1, 1]], 9],
    ['s', '锐化', [[0, -1, 0], [-1, 5, -1], [0, -1, 0]], 1]
  ];
  // 第二部分：3 通道的 4×4 输入，3×3×3 的核（第 c 层只和第 c 个通道相乘）
  var MCX = [
    [[9, 9, 0, 0], [9, 9, 0, 0], [9, 9, 0, 0], [9, 9, 0, 0]],
    [[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4]],
    [[0, 0, 0, 0], [0, 5, 5, 0], [0, 5, 5, 0], [0, 0, 0, 0]]
  ];
  var MCW = [KERS[0][2], [[0, 0, 0], [0, 1, 0], [0, 0, 0]], KERS[1][2]];
  var MCN = ['红 R', '绿 G', '蓝 B'];

  // ---------- 核心计算（纯函数，不碰 DOM） ----------
  var grid = (n, f) => Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => f(r, c)));
  var makeImg = key => grid(N, IMGS.find(x => x[0] === key)[2]);
  var outSize = (n, k, p, s) => Math.floor((n + 2 * p - k) / s) + 1;
  var padImg = (x, p) => grid(x.length + 2 * p, (r, c) => (x[r - p] || [])[c - p] || 0);
  // 和 PyTorch 的 F.conv2d 一样算互相关（cross-correlation），核不翻转：
  // sum[i][j] = Σa Σb X[i·s + a][j·s + b] × W[a][b]，X 是四周补了 p 圈 0 的输入。返回整数和。
  function conv(x, w, s, p) {
    var X = padImg(x, p), k = w.length;
    return grid(outSize(x.length, k, p, s), (i, j) => {
      var t = 0;
      for (var a = 0; a < k; a++) for (var b = 0; b < k; b++) t += X[i * s + a][j * s + b] * w[a][b];
      return t;
    });
  }
  // 多通道：每个通道和核的对应层各做一次 conv，再逐位置相加，得到 1 个输出通道
  var convMC = (xs, ws, s, p) => xs.map((x, c) => conv(x, ws[c], s, p))
    .reduce((A, B) => grid(A.length, (i, j) => A[i][j] + B[i][j]));
  // 数学定义的卷积：先把核旋转 180°，再做上面的运算
  var rot180 = w => grid(w.length, (a, b) => w[w.length - 1 - a][w.length - 1 - b]);

  function selfTest() {
    var details = [], ok = true;
    function eq(name, got, want) {
      var pass = JSON.stringify(got) === JSON.stringify(want);
      ok = ok && pass;
      details.push((pass ? '通过 ' : '失败 ') + name + '：' + JSON.stringify(got) + (pass ? '' : '，应为 ' + JSON.stringify(want)));
    }
    var V = makeImg('v'), KV = KERS[0][2];
    eq('n=7 k=3 p=0 s=1 的输出边长', outSize(7, 3, 0, 1), 5);   // (7 + 0 − 3)/1 + 1 = 5
    eq('n=7 k=3 p=1 s=2 的输出边长', outSize(7, 3, 1, 2), 4);   // ⌊(7 + 2 − 3)/2⌋ + 1 = 3 + 1 = 4
    eq('n=7 k=3 p=0 s=2 的输出边长', outSize(7, 3, 0, 2), 3);   // ⌊4/2⌋ + 1 = 3
    eq('n=8 k=3 p=0 s=2 向下取整', outSize(8, 3, 0, 2), 3);     // ⌊5/2⌋ + 1 = 2 + 1 = 3
    var o = conv(V, KV, 1, 0);
    eq('竖边图 × 竖边核，实际输出形状', [o.length, o[0].length], [5, 5]);
    // 手算 out[0][1]：窗口盖住第 1–3 行、第 2–4 列（下标 0–2 行、1–3 列），每行都是 9 9 0：
    //   9×1 + 9×0 + 0×(−1) = 9，三行合计 9 + 9 + 9 = 27
    eq('竖边图 × 竖边核 out[0][1]', o[0][1], 27);
    // 手算 out[0][0]：每行都是 9 9 9：9×1 + 9×0 + 9×(−1) = 0，三行合计 0
    eq('竖边图 × 竖边核 out[0][0]', o[0][0], 0);
    eq('竖边图 × 竖边核 第 3 行', o[2], [0, 27, 27, 0, 0]);
    var o2 = conv(V, KV, 2, 1);
    eq('p=1 s=2 实际输出形状', [o2.length, o2[0].length], [4, 4]);
    // 手算 p=1、s=2 的 out[0][0]：补 0 后第 1–3 行、第 1–3 列。第 1 行全是补的 0；
    //   第 2、3 行都是 0(补) 9 9：0×1 + 9×0 + 9×(−1) = −9，合计 0 + (−9) + (−9) = −18
    eq('p=1 s=2 out[0][0]', o2[0][0], -18);
    // 手算 out[1][1]：补 0 后第 3–5 行、第 3–5 列 = 原图第 2–4 行、第 2–4 列，每行 9 9 0 → 9，合计 27
    eq('p=1 s=2 out[1][1]', o2[1][1], 27);
    // 横边核 = 上行和 − 下行和；竖边图每行都一样，所以 p=0 时处处是 0
    eq('竖边图 × 横边核 全是 0', conv(V, KERS[1][2], 1, 0).flat().every(v => v === 0), true);
    // 均值模糊 out[0][1]：窗口每行 9 9 0，和 = 18 × 3 = 54，54 ÷ 9 = 6
    eq('竖边图 × 均值模糊 out[0][1] 的和', conv(V, KERS[2][2], 1, 0)[0][1], 54);
    // 小方块（下标 2–4 行、2–4 列是 9）× 锐化 out[1][1]：中心是方块左上角，
    //   5×9 − (上 0 + 下 9 + 左 0 + 右 9) = 45 − 18 = 27
    eq('小方块 × 锐化 out[1][1]', conv(makeImg('b'), KERS[3][2], 1, 0)[1][1], 27);
    // 数学卷积先旋转核：竖边核变成每行 −1 0 1，同一位置 27 → −27
    eq('核旋转 180° 后 out[0][1]', conv(V, rot180(KV), 1, 0)[0][1], -27);
    // 3 通道 out[0][0]：红层 27 + 绿层 2 + 蓝层 (−10) = 19；以上数值都和 PyTorch F.conv2d 的结果核对过
    eq('3 通道 × 3×3×3 核', convMC(MCX, MCW, 1, 0), [[19, 20], [39, 40]]);
    return { ok: ok, details: details };
  }

  // ---------- 文案 ----------
  var HOW = '怎么玩：选好输入图和卷积核（kernel），反复点「下一步」，看 3×3 的窗口按步幅在输入上滑动，每一步算出输出里的一个数。格子里的数字可以直接改（输入图 0–9，卷积核 −9 到 9），点输出的格子能跳到算它的那一步。';
  var EX =
    '<h4>为什么竖边核在竖直边缘处响应大</h4><p>竖边核的三行都是 (1, 0, −1)：左列乘 1，中列乘 0，右列乘 −1，所以它算的就是「窗口左列 3 个数之和 − 右列 3 个数之和」。拿默认的竖直边缘图看：窗口整个落在亮区时，左列 9 + 9 + 9 = 27，右列也是 27，相减得 0；窗口跨在亮暗交界上时，左列 27、右列 0，得 27。输出里只有交界附近的两列是 27，其余全是 0，正好标出了竖直边缘在哪里。卷积层的输出叫特征图（feature map），这一张记录的就是「哪里有竖直边缘」。如果原图左暗右亮，同一位置会得到 −27：正负号表示明暗方向，绝对值表示边缘有多强。同一张图换成横边核（p = 0），输出全是 0，因为每一行都一样，上行之和减下行之和总是 0。</p>' +
    '<h4>参数共享：整张图只用这 9 个数</h4><p>窗口滑到哪里，用的都是同一个 3×3 的核，这叫参数共享（parameter sharing）。所以这一层要学的参数只有 9 个，实际网络里通常再加 1 个偏置（bias）。换成全连接层（fully connected layer）把 7×7 的输入变成 5×5 的输出：25 个输出各自连着全部 49 个输入，需要 49 × 25 = 1225 个权重，约是 9 的 136 倍。参数共享还有一个好处：竖直边缘出现在图的左边还是右边，都由同一组 9 个数来检测，网络不用在每个位置各学一遍。</p>' +
    '<h4>框架里的「卷积」其实是互相关</h4><p>数学里的卷积（convolution）要先把核旋转 180°（上下翻一次、左右翻一次），再滑动、相乘、求和。本演示和 PyTorch 的 nn.Conv2d 一样不翻转，直接相乘，这个运算在数学上叫互相关（cross-correlation）。差别可以用数字看：竖边核旋转 180° 后每行变成 (−1, 0, 1)，上面那个 27 会变成 −27。卷积神经网络里核的数值是训练学出来的，按哪种定义算，网络都能学到效果一样的核（两者只差一次旋转），所以框架直接算互相关，名字沿用了「卷积」。</p>' +
    '<h4>输出尺寸和填充</h4><p>设输入边长 n、核边长 k、填充（padding）p、步幅（stride）s。补 0 后输入边长是 n + 2p，窗口在一行里能停在第 0、s、2s……格，最后一个位置不能让窗口超出边界，数下来一共 ⌊(n + 2p − k) / s⌋ + 1 个，这就是输出边长。除不尽时向下取整：n = 8、k = 3、p = 0、s = 2 时 (8 − 3) / 2 = 2.5，取 2 再加 1，输出 3×3，最右一列和最下一行凑不满一个窗口，被跳过。p = 1 让 7×7 的输入在 s = 1 时输出仍是 7×7，图像边上的像素也能当窗口中心；代价是补的 0（虚线格）相当于给图镶了一圈最暗的黑边，竖直边缘图在 p = 1 时最左一列会出现 −27 这样的假边缘。</p>';
  var MCT = '彩色图片的每个像素有红、绿、蓝 3 个数，可以看成 3 张一样大的灰度图叠在一起，每一张叫一个通道（channel）。这时卷积核也有 3 层，形状是 3×3×3，第 1 层只和红色通道相乘，第 2 层只和绿色通道相乘，第 3 层只和蓝色通道相乘。算一个输出格子时，3 层各自做一次 9 项乘积求和，再把 3 个结果加起来（实际网络还会再加 1 个偏置），所以 3 个输入通道配 1 个核，只得到 1 个输出通道。想要 64 个输出通道就用 64 个这样的核，参数是 64 × 27 = 1728 个（不算偏置）。点输出的 4 个格子，看每个数是怎么来的。';

  var CSS = `
.~root{--dm-g:2px;--dm-px0:var(--text,#1b1b19);--dm-px9:var(--surface,#fff);--dm-cap:88%;font-size:15px;line-height:1.7;color:var(--text,#1b1b19)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .~root{--dm-px0:var(--bg);--dm-px9:var(--text);--dm-cap:60%}}
:root[data-theme="dark"] .~root{--dm-px0:var(--bg);--dm-px9:var(--text);--dm-cap:60%}
.~root *{box-sizing:border-box}
.~how{margin:0 0 12px;color:var(--text-2)}
.~ctrl,.~bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}
.~ctrl label{display:flex;gap:6px;align-items:center;font-size:14px;color:var(--text-2)}
.~root select,.~bar button{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:4px 10px;min-height:34px}
.~bar button{cursor:pointer}
.~bar button:hover:not(:disabled){background:var(--surface-2)}
.~bar button:disabled{opacity:.45;cursor:default}
.~root :focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.~size{margin:10px 0 14px;padding:6px 10px;border-radius:8px;background:var(--surface-2);font:13px/1.6 var(--mono)}
.~stage{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:flex-start}
.~pan{margin:0;min-width:0;flex:0 0 auto}
.~pin{flex:1 1 300px;max-width:calc(var(--n)*38px)}
.~pout{flex:1 1 150px}
.~pan figcaption{margin-bottom:6px;font-size:13px;line-height:1.5;color:var(--text-2)}
.~grid{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:var(--dm-g);width:min(100%,calc(var(--n)*38px))}
.~cell{width:100%;aspect-ratio:1;min-width:0;margin:0;padding:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font:600 14px/1 var(--mono);text-align:center}
.~gk{width:114px}
.~cell:focus-visible{position:relative;z-index:3}
.~inw{padding-bottom:12px}
.~padc{background:none;border:1px dashed var(--edge-strong);color:var(--text-3);font-weight:400}
.~win{z-index:2;pointer-events:none;display:grid;grid-template-columns:repeat(3,1fr);gap:var(--dm-g);outline:3px solid var(--c-ai);outline-offset:1px;border-radius:5px}
.~wb{align-self:end;justify-self:center;margin-bottom:2px;padding:0 2px;border:1px solid var(--c-ai);border-radius:3px;background:var(--surface);color:var(--text);font:600 9px/1.25 var(--mono)}
.~gout{container-type:inline-size}
.~oc{font-size:clamp(10px,calc(34cqi / var(--n)),13px);cursor:pointer;overflow:hidden}
.~oc.~long{font-size:clamp(8px,calc(27cqi / var(--n)),11px);letter-spacing:-.02em}
.~todo{border-style:dashed;border-color:var(--edge);background:none}
.~cur{position:relative;z-index:1;outline:3px solid var(--c-ai);outline-offset:1px}
.~den,.~leg{margin:6px 0 0;max-width:190px;font-size:12px;line-height:1.5;color:var(--text-3)}
.~den{max-width:114px}
.~leg i{display:inline-block;width:10px;height:10px;margin:0 3px 0 6px;border:1px solid var(--border);border-radius:2px;vertical-align:-1px}
.~leg i:first-child{margin-left:0}
.~bar{margin:0 0 14px}
.~cnt{font-size:14px;color:var(--text-2)}
.~row{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}
.~calc,.~now{flex:1 1 300px;min-width:0;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius,10px);background:var(--surface)}
.~now{border-left:3px solid var(--c-ai)}
.~calc{font:14px/1.9 var(--mono)}
.~z{color:var(--text-3)}
.~hint{font:14px/1.7 var(--font);color:var(--text-2)}
.~rs,.~tot{font-weight:600}
.~tot{margin-top:4px;padding-top:4px;border-top:1px solid var(--border)}
.~t{margin-bottom:4px;font:600 13px/1.6 var(--font);color:var(--text-2)}
.~ex h4{margin:20px 0 4px;font-size:15px;font-weight:600}
.~ex p,.~mc p{margin:0}
.~mc{margin-top:20px;padding-top:12px;border-top:1px solid var(--border)}
.~mc summary{cursor:pointer;font-weight:600}
.~mc>p{margin-top:8px}
.~mcg,.~mcb{display:flex;flex-wrap:wrap;gap:12px 28px;align-items:flex-start;margin-top:12px}
.~pair{display:flex;align-items:center;gap:8px}
.~sm{width:min(100%,calc(var(--n)*28px))}
.~sm .~cell{font-size:12px}
.~mcx{flex:1 1 260px;min-width:0;font-size:14px}
`;

  var opt = list => list.map(x => '<option value="' + x[0] + '">' + x[1] + '</option>').join('') +
    '<option value="c" disabled>自定义</option>';
  var btn = (a, t, l) => '<button type="button" data-a="' + a + '" aria-label="' + (l || t) + '">' + t + '</button>';
  var TPL = `<p class="~how">${HOW}</p>
<div class="~ctrl">
<label>输入图 <select data-k="img" aria-label="输入图预设">${opt(IMGS)}</select></label>
<label>卷积核 <select data-k="ker" aria-label="卷积核预设">${opt(KERS)}</select></label>
<label>步幅 s <select data-k="s" aria-label="步幅 s"><option>1</option><option>2</option></select></label>
<label>填充 p <select data-k="p" aria-label="填充 p"><option>0</option><option>1</option></select></label>
</div>
<p class="~size"></p>
<div class="~bar">${btn('prev', '上一步')}${btn('next', '下一步')}${btn('play', '自动播放')}${btn('all', '全部算完')}${btn('reset', '重置', '重置到第 0 步')}<span class="~cnt"></span></div>
<div class="~stage">
<figure class="~pan ~pin"><figcaption class="~capin"></figcaption><div class="~grid ~gin"></div></figure>
<figure class="~pan"><figcaption>卷积核 3×3</figcaption><div class="~grid ~gk" style="--n:3"></div><p class="~den"></p></figure>
<figure class="~pan ~pout"><figcaption class="~capout"></figcaption><div class="~grid ~gout"></div><p class="~leg"><i style="background:color-mix(in srgb,var(--div-neg) var(--dm-cap),var(--div-mid))"></i>负数<i style="background:var(--div-mid)"></i>0<i style="background:color-mix(in srgb,var(--div-pos) var(--dm-cap),var(--div-mid))"></i>正数<br>颜色越浓，绝对值越大</p></figure>
</div>
<div class="~row"><div class="~calc"></div><div class="~now" aria-live="polite"></div></div>
<div class="~ex">${EX}</div>
<details class="~mc"><summary>第二部分：彩色图有 3 个通道时怎么算</summary><p>${MCT}</p><div class="~mcg"></div><div class="~mcb"><figure class="~pan"><figcaption>输出 2×2（只有 1 个通道）</figcaption><div class="~grid ~sm ~mco" style="--n:2"></div></figure><div class="~mcx" aria-live="polite"></div></div></details>`;

  // ---------- 显示用的小工具 ----------
  var fmt = v => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1)).replace('-', MINUS);
  var par = v => v < 0 ? '(' + fmt(v) + ')' : fmt(v);
  var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  // 像素灰度：0 最暗、9 最亮；两端颜色随主题取自令牌。在 oklab 里插值，亮度按感知均匀变化，
  // 4 和 5 分别落在中灰两侧，格子里的字（4 及以下用亮字，5 及以上用暗字）对比度都不低于 4.5:1
  function px(e, v) {
    e.style.background = 'color-mix(in oklab,var(--dm-px9) ' + Math.round(v / 9 * 100) + '%,var(--dm-px0))';
    e.style.color = v >= 5 ? 'var(--dm-px0)' : 'var(--dm-px9)';
  }
  // 发散色：负数偏 --div-neg，0 是 --div-mid，正数偏 --div-pos；cap 是绝对值最大时的混色比例（CSS 长度表达式）。
  // 输出格用 var(--dm-cap)：浅色 88%，深色 60%。深色主题下混色再往上会落进「亮字暗字都不够 4.5:1」的区间，所以封顶
  function tint(e, v, max, cap) {
    var f = max ? Math.min(1, Math.abs(v) / max) : 0;
    e.style.background = 'color-mix(in srgb,var(--div-' + (v < 0 ? 'neg' : 'pos') + ') calc(' + f.toFixed(4) + ' * ' + cap + '),var(--div-mid))';
    e.style.color = 'var(--text)';
  }
  var reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function mount(container) {
    if (!document.getElementById('dm-style-' + ID)) {
      var style = el('style');
      style.id = 'dm-style-' + ID;
      style.textContent = CSS.replace(/~/g, C);
      document.head.appendChild(style);
    }
    var root = el('div', C + 'root');
    root.innerHTML = TPL.replace(/~/g, C);
    container.appendChild(root);
    var $ = n => root.querySelector('.' + C + n);
    var gin = $('gin'), gk = $('gk'), gout = $('gout'), calc = $('calc'), now = $('now'), sel = {}, btns = {};
    root.querySelectorAll('select').forEach(e => { sel[e.dataset.k] = e; });
    root.querySelectorAll('[data-a]').forEach(e => { btns[e.dataset.a] = e; });
    var st = { img: makeImg('v'), w: KERS[0][2].map(r => r.slice()), den: 1, s: 1, p: 0, step: 0 };
    var out, o = 0, T = 0, maxAbs = 0, win, badges, cellsIn = [], timer = null, mcSel = 0, mcWins = [];
    if (reduced()) {
      btns.play.disabled = true;
      btns.play.title = '系统开启了「减少动态效果」，自动播放已关闭，请用「下一步」';
    }

    var kerKey = () => (KERS.find(K => K[3] === st.den && same(K[2], st.w)) || 'c')[0];
    var imgKey = () => (IMGS.find(I => same(makeImg(I[0]), st.img)) || 'c')[0];

    function compute() {
      out = conv(st.img, st.w, st.s, st.p);
      o = out.length; T = o * o;
      maxAbs = Math.max.apply(null, out.flat().map(Math.abs));
    }

    function buildIn() {
      var p = st.p, m = N + 2 * p;
      gin.textContent = '';
      gin.parentNode.style.setProperty('--n', m);
      cellsIn = [];
      for (var r = 0; r < m; r++) for (var c = 0; c < m; c++) {
        var R = r - p, Q = c - p, e;
        if (R < 0 || Q < 0 || R >= N || Q >= N) {
          e = el('span', C + 'cell ' + C + 'padc', '0');
          e.title = '补的 0';
        } else {
          e = el('input', C + 'cell');
          e.value = st.img[R][Q]; e.size = 1; e.maxLength = 1; e.inputMode = 'numeric'; e.autocomplete = 'off';
          e.dataset.r = R; e.dataset.c = Q;
          e.setAttribute('aria-label', '输入图第 ' + (R + 1) + ' 行第 ' + (Q + 1) + ' 列（0 到 9）');
          px(e, st.img[R][Q]);
        }
        e.style.gridArea = (r + 1) + '/' + (c + 1); // 每格都显式定位，窗口框才能叠在格子上
        cellsIn.push(gin.appendChild(e));
      }
      win = el('div', C + 'win');
      win.setAttribute('aria-hidden', 'true'); // 框和「×权重」小标签只是视觉提示，算式区已经用文字写了一遍
      badges = [];
      for (var i = 0; i < 9; i++) badges.push(win.appendChild(el('span', C + 'wb')));
      gin.appendChild(win);
      $('capin').textContent = p ? '输入 7×7，四周补一圈 0 后是 9×9（虚线格是补的 0）' : '输入 7×7';
    }

    function buildK() {
      for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) {
        var e = el('input', C + 'cell');
        e.size = 1; e.maxLength = 2; e.autocomplete = 'off'; e.dataset.kr = a; e.dataset.kc = b;
        e.setAttribute('aria-label', '卷积核第 ' + (a + 1) + ' 行第 ' + (b + 1) + ' 列（−9 到 9）');
        gk.appendChild(e);
      }
    }
    function paintK() {
      for (var e of gk.children) {
        var v = st.w[e.dataset.kr][e.dataset.kc];
        if (e !== document.activeElement) e.value = fmt(v);
        tint(e, v, 5, '45%');
      }
      $('den').textContent = st.den > 1 ? '× 1/' + st.den + '：9 个乘积加起来以后再 ÷ ' + st.den : '';
    }

    function buildOut() {
      gout.textContent = '';
      gout.style.setProperty('--n', o);
      for (var i = 0; i < T; i++) {
        var b = el('button', C + 'cell ' + C + 'oc');
        b.type = 'button'; b.dataset.o = i;
        gout.appendChild(b);
      }
      $('capout').textContent = '输出 ' + o + '×' + o;
    }

    // 「现在发生了什么」里解释这一格的数为什么是这个值
    function why(cell, sum, v, r0, c0) {
      var key = kerKey(), col = b => cell(0, b) + cell(1, b) + cell(2, b), row = a => cell(a, 0) + cell(a, 1) + cell(a, 2);
      if (key === 'v' || key === 'h') {
        var V = key === 'v', A = V ? col(0) : row(0), B = V ? col(2) : row(2), d = V ? '竖直' : '水平', lo = V ? c0 : r0;
        // 假边缘的条件：窗口的左列（横边核看上行）整条是补的 0，图像部分在核比较的方向上是平的（中列和右列逐行相等）。
        // 图像要是照原样往外延伸，这里本该得 0，响应完全来自补的 0。对角线图的背景本来就是 0，
        // 补的 0 和背景一样，那里的响应来自线条本身，不算假边缘
        var at = (t, u) => V ? cell(t, u) : cell(u, t), flat = (u, w) => [0, 1, 2].every(t => at(t, u) === at(t, w));
        var side = st.p && sum ? (lo === 0 && flat(1, 2) ? (V ? '左列' : '上行')
          : lo + 3 > N + st.p && flat(0, 1) ? (V ? '右列' : '下行') : '') : '';
        return (V ? '竖边核算的是「左列之和 − 右列之和」' : '横边核算的是「上行之和 − 下行之和」') +
          '= ' + A + ' − ' + B + ' = ' + fmt(sum) + '，' +
          (side ? side + '全是补的 0，图像本身在这里' + (V ? '左右' : '上下') + '一样亮，这个响应来自补的 0 和图像边上像素的落差，是填充造成的假边缘。'
            : sum > 0 ? (V ? '左列比右列亮' : '上行比下行亮') + '，说明这里有' + d + '边缘。'
            : sum < 0 ? (V ? '右列比左列亮' : '下行比上行亮') + '，也是' + d + '边缘，只是明暗方向反过来，所以是负数。'
            : (V ? '左右两列' : '上下两行') + '一样亮，相减得 0，' + (V ? '竖' : '横') + '边核在这里没有响应。');
      }
      if (key === 'm') {
        var c = cell(1, 1);
        return '均值模糊的输出是窗口里 9 个数的平均。窗口中心原来是 ' + c + '，平均后是 ' + fmt(v) +
          (v === c ? '。' : '，周围的亮暗混了进来，图因此变模糊。');
      }
      if (key === 's') {
        var m = cell(1, 1), nb = cell(0, 1) + cell(2, 1) + cell(1, 0) + cell(1, 2);
        return '锐化核算的是「5 × 中心 − 上下左右 4 个邻居之和」= 5×' + m + ' − ' + nb + ' = ' + fmt(sum) + '，' +
          (sum > m ? '中心比四周平均更亮，结果被抬高，明暗差变大了。'
            : sum < m ? '中心比四周平均更暗，结果被压低，明暗差变大了。'
            : '中心和四周平均一样亮，结果等于原值，平坦的地方不变。');
      }
      return '这是自定义的核，输出就是上面算式的结果。';
    }

    function render() {
      var k = st.step;
      Array.from(gout.children).forEach((b, n) => {
        var i = n / o | 0, j = n % o, done = n < k, v = out[i][j];
        b.textContent = done ? fmt(v / st.den) : '';
        b.classList.toggle(C + 'todo', !done);
        b.classList.toggle(C + 'cur', n === k - 1);
        // 自定义核保留 1/9 时可能出现 −41.2 这样 5 个字符的数，换小一号字，免得在窄格子里被截断
        b.classList.toggle(C + 'long', b.textContent.length > 4);
        if (done) tint(b, v, maxAbs, 'var(--dm-cap)'); else b.style.background = b.style.color = '';
        b.setAttribute('aria-label', '输出第 ' + (i + 1) + ' 行第 ' + (j + 1) + ' 列：' + (done ? fmt(v / st.den) : '还没算') + '，点击跳到这一步');
      });
      $('cnt').textContent = '第 ' + k + ' / ' + T + ' 步';
      btns.prev.disabled = btns.reset.disabled = !k;
      btns.next.disabled = btns.all.disabled = k >= T;
      var T1 = '<div class="' + C + 't">', m = N + 2 * st.p;
      var n = k - 1, i = n / o | 0, j = n % o, r0 = i * st.s, c0 = j * st.s, X = padImg(st.img, st.p);
      // 窗口里的格子把数字往上挪一点，给下面的「×权重」小标签腾地方
      cellsIn.forEach((e, q) => {
        var r = q / m | 0, c = q % m;
        e.classList.toggle(C + 'inw', k > 0 && r >= r0 && r < r0 + 3 && c >= c0 && c < c0 + 3);
      });
      if (!k) {
        win.style.display = 'none';
        calc.innerHTML = T1 + '算式</div><div class="' + C + 'hint">点「下一步」后，这里会列出窗口里 9 对数的乘积和它们的和。</div>';
        now.innerHTML = T1 + '现在发生了什么</div><div>还没开始。点「下一步」，卷积核会先放到输入的左上角，算出输出的第 1 个格子；一共要算 ' + T + ' 个格子。</div>';
        return;
      }
      var cell = (a, b) => X[r0 + a][c0 + b];
      win.style.display = '';
      win.style.gridArea = (r0 + 1) + '/' + (c0 + 1) + '/span 3/span 3';
      var rows = '', rs = [], sum = 0;
      for (var a = 0; a < 3; a++) {
        var t = 0, terms = [];
        for (var b = 0; b < 3; b++) {
          var x = cell(a, b), w = st.w[a][b];
          t += x * w;
          terms.push('<span' + (x * w ? '' : ' class="' + C + 'z"') + '>' + x + '×' + par(w) + '</span>');
          badges[a * 3 + b].textContent = '×' + fmt(w);
        }
        rs.push(t); sum += t;
        rows += '<div>' + terms.join(' + ') + ' <span class="' + C + 'rs">= ' + fmt(t) + '</span></div>';
      }
      var v = sum / st.den, D = st.den > 1;
      calc.innerHTML = T1 + '第 ' + k + ' 步的算式：窗口里的数 × 核上对应位置的数</div>' + rows +
        '<div class="' + C + 'tot">合计 ' + rs.map(par).join(' + ') + ' = ' + fmt(sum) +
        (D ? '，÷ ' + st.den + (v % 1 ? ' ≈ ' : ' = ') + fmt(v) : '') + '</div>';
      var edge = st.p && (r0 === 0 || c0 === 0 || r0 + 3 > N + st.p || c0 + 3 > N + st.p);
      var move = k === 1 ? '卷积核先放在左上角。' : j ? '窗口向右移 ' + st.s + ' 格（步幅 s = ' + st.s + '）。'
        : '上一行走到头了，窗口回到最左边，再向下移 ' + st.s + ' 格。';
      now.innerHTML = T1 + '现在发生了什么</div><div>第 ' + k + ' 步：' + move +
        (edge ? '窗口有一部分盖在补的 0 上，这些 0 也参与相乘。' : '') +
        '9 对数相乘再相加得 ' + fmt(sum) + (D ? '，÷ ' + st.den + ' 后是 ' + fmt(v) : '') +
        '，写进输出第 ' + (i + 1) + ' 行第 ' + (j + 1) + ' 列。' + why(cell, sum, v, r0, c0) +
        (k === T ? '输出的 ' + T + ' 个格子全部算完了。' : '') + '</div>';
    }

    function refresh(rebuild) {
      var end = T && st.step === T;
      compute();
      if (rebuild) { st.step = end ? T : 0; buildIn(); buildOut(); }
      st.step = Math.min(st.step, T);
      $('size').textContent = '输出边长 = ⌊(n + 2p − k) / s⌋ + 1 = ⌊(7 + 2×' + st.p + ' − 3) / ' + st.s + '⌋ + 1 = ⌊' +
        (4 + 2 * st.p) + ' / ' + st.s + '⌋ + 1 = ' + o + '，输出 ' + o + '×' + o + '，共 ' + T + ' 步';
      render();
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      btns.play.textContent = '自动播放';
      btns.play.setAttribute('aria-label', '自动播放');
    }
    function tick() {
      if (st.step < T) { st.step++; render(); }
      if (st.step >= T) stop();
    }
    function play() {
      if (reduced()) return;
      if (st.step >= T) st.step = 0;
      timer = setInterval(tick, MS);
      btns.play.textContent = '暂停';
      btns.play.setAttribute('aria-label', '暂停自动播放');
      tick();
    }

    // ---------- 第二部分：多通道 ----------
    function buildMC() {
      var box = $('mcg');
      MCX.forEach((x, c) => {
        var card = el('figure', C + 'pan'), pair = el('div', C + 'pair');
        var g = el('div', C + 'grid ' + C + 'sm'), gw = el('div', C + 'grid ' + C + 'sm');
        g.style.setProperty('--n', 4); gw.style.setProperty('--n', 3);
        x.forEach((row, r) => row.forEach((v, q) => {
          var e = el('span', C + 'cell', v);
          px(e, v); e.style.gridArea = (r + 1) + '/' + (q + 1);
          g.appendChild(e);
        }));
        mcWins.push(g.appendChild(el('div', C + 'win')));
        MCW[c].forEach(row => row.forEach(v => { var e = el('span', C + 'cell', fmt(v)); tint(e, v, 5, '45%'); gw.appendChild(e); }));
        pair.append(g, el('span', '', '×'), gw);
        card.append(el('figcaption', '', '第 ' + (c + 1) + ' 通道（' + MCN[c] + '）× 核的第 ' + (c + 1) + ' 层'), pair);
        box.appendChild(card);
      });
      var mo = convMC(MCX, MCW, 1, 0).flat(), mx = Math.max.apply(null, mo.map(Math.abs));
      mo.forEach((v, n) => {
        var b = el('button', C + 'cell ' + C + 'oc', fmt(v));
        b.type = 'button'; b.dataset.mc = n; tint(b, v, mx, 'var(--dm-cap)');
        b.setAttribute('aria-label', '输出第 ' + ((n >> 1) + 1) + ' 行第 ' + (n % 2 + 1) + ' 列：' + fmt(v) + '，点击看它怎么算出来');
        $('mco').appendChild(b);
      });
      renderMC();
    }
    function renderMC() {
      var i = mcSel >> 1, j = mcSel & 1;
      mcWins.forEach(w => { w.style.gridArea = (i + 1) + '/' + (j + 1) + '/span 3/span 3'; });
      Array.from($('mco').children).forEach((b, n) => b.classList.toggle(C + 'cur', n === mcSel));
      var parts = MCX.map((x, c) => {
        var ts = [], t = 0;
        for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) {
          var xv = x[i + a][j + b], w = MCW[c][a][b];
          if (xv * w) { ts.push(xv + '×' + par(w)); t += xv * w; }
        }
        return [t, MCN[c][0] + '层：' + (ts.length ? ts.join(' + ') + ' = ' + fmt(t) + '（另外 ' + (9 - ts.length) + ' 项乘积是 0）' : '9 项乘积都是 0')];
      });
      var tot = parts.reduce((s, q) => s + q[0], 0);
      $('mcx').innerHTML = '<div class="' + C + 't">输出第 ' + (i + 1) + ' 行第 ' + (j + 1) + ' 列 = 红层 + 绿层 + 蓝层 = ' +
        parts.map(q => par(q[0])).join(' + ') + ' = ' + fmt(tot) + '</div>' +
        parts.map(q => '<div>' + q[1] + '</div>').join('') +
        '<div>3 层合起来要做 27 次乘法，这个 3×3×3 的核有 27 个参数。</div>';
    }

    // ---------- 事件 ----------
    function onClick(e) {
      var t = e.target;
      if (t.tagName === 'INPUT') { t.select(); return; }
      var b = t.closest('button');
      if (!b) return;
      if (b.dataset.mc) { mcSel = +b.dataset.mc; renderMC(); return; }
      var a = b.dataset.a;
      if (a === 'play') { if (timer) stop(); else play(); return; }
      stop();
      if (b.dataset.o) st.step = +b.dataset.o + 1;
      else if (a === 'prev') st.step--;
      else if (a === 'next') st.step++;
      else if (a === 'all') st.step = T;
      else if (a === 'reset') st.step = 0;
      st.step = Math.max(0, Math.min(T, st.step));
      render();
    }
    function onInput(e) {
      var t = e.target, v = t.value.replace(MINUS, '-').trim();
      if (t.dataset.r) {
        if (!/^\d$/.test(v)) return;
        st.img[t.dataset.r][t.dataset.c] = +v;
        px(t, +v);
        sel.img.value = imgKey();
      } else if (t.dataset.kr) {
        if (!/^-?\d$/.test(v)) return;
        st.w[t.dataset.kr][t.dataset.kc] = +v;
        sel.ker.value = kerKey();
        paintK();
      } else return;
      refresh();
    }
    function onChange(e) {
      var t = e.target, k = t.dataset.k;
      if (!k) { // 格子编辑结束：没填成合法数字就恢复成当前值
        if (t.dataset.r) t.value = st.img[t.dataset.r][t.dataset.c];
        if (t.dataset.kr) t.value = fmt(st.w[t.dataset.kr][t.dataset.kc]);
        return;
      }
      stop();
      if (k === 'img') { if (!IMGS.some(x => x[0] === t.value)) return; st.img = makeImg(t.value); buildIn(); refresh(); }
      else if (k === 'ker') {
        var K = KERS.find(x => x[0] === t.value);
        if (!K) return; // 「自定义」是禁用项，只用来显示，不会被选中
        st.w = K[2].map(r => r.slice()); st.den = K[3];
        paintK(); refresh();
      } else { st[k] = +t.value; refresh(true); }
    }
    function onFocus(e) { if (e.target.tagName === 'INPUT') e.target.select(); }

    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('focusin', onFocus);
    buildK(); paintK(); refresh(true); buildMC();

    return {
      destroy: function () {
        stop();
        root.removeEventListener('click', onClick);
        root.removeEventListener('input', onInput);
        root.removeEventListener('change', onChange);
        root.removeEventListener('focusin', onFocus);
        root.remove();
      }
    };
  }

  window.KGDemos = window.KGDemos || {};
  window.KGDemos[ID] = {
    title: '卷积运算：卷积核怎么在图上滑',
    mount: mount,
    selfTest: selfTest
  };
})();
(function(){
'use strict';
function fixture(ci,co,s,p,pool){
 var h=3,w=4,oh=Math.floor((h+2*p-2)/s)+1,ow=Math.floor((w+2*p-2)/s)+1,outputs=[],cells=[];
 for(var o=0;o<co;o++){var a=[];for(var y=0;y<oh;y++){var r=[];for(var x=0;x<ow;x++){var parts=[];for(var c=0;c<ci;c++){var sum=0;for(var ky=0;ky<2;ky++)for(var kx=0;kx<2;kx++){var iy=y*s+ky-p,ix=x*s+kx-p;if(iy>=0&&iy<h&&ix>=0&&ix<w)sum+=(c+1)*(o+1);}parts.push(sum);}r.push(parts.reduce(function(a,b){return a+b;},0));cells.push({channel:o,row:y,column:x,contributions:parts});}a.push(r);}outputs.push(a);}
 var pooled=outputs.map(function(a){if(!pool)return a;var v=[];for(var y=0;y+1<oh;y+=2){var r=[];for(var x=0;x+1<ow;x+=2)r.push(Math.max(a[y][x],a[y][x+1],a[y+1][x],a[y+1][x+1]));v.push(r);}return v;});
 return {outputs:outputs,pooled:pooled,cells:cells,shape:[1,co,oh,ow],parameters:ci*co*4};
}
var old=window.KGDemos['ai-conv2d'];
function mount(container){var legacy=old.mount(container),root=document.createElement('section');root.className='stage-evidence practice-lab';container.appendChild(root);
function el(t,v){var e=document.createElement(t);if(v!=null)e.textContent=v;return e;}
root.appendChild(el('h3','多通道、非方形输入与池化'));
root.appendChild(el('p','浏览器教学模拟。固定输入 [1,Cin,3,4]，第c通道所有值为c+1；第o输出通道的2×2核所有权重为o+1，无偏置。预测通道累加后的首个输出。'));
var controls=el('p'),fields={};[['ci','输入通道',[1,2],2],['co','输出通道',[1,3],3],['stride','步幅',[1,2],1],['pad','零填充',[0,1],0],['pool','2×2步幅2最大池化',[0,1],0]].forEach(function(a){var l=el('label',a[1]+' '),s=el('select');s.setAttribute('aria-label','多通道'+a[1]);a[2].forEach(function(v){var o=el('option',String(v));o.value=v;s.appendChild(o);});s.value=a[3];l.appendChild(s);controls.appendChild(l);fields[a[0]]=s;});root.appendChild(controls);
var note=el('textarea');note.setAttribute('aria-label','多通道结果预测');note.placeholder='先计算输出形状与参数量，再检查首个输出';root.appendChild(note);
var prev=el('button','前一窗口'),next=el('button','后一窗口'),reset=el('button','重置多通道');[prev,next,reset].forEach(function(b){b.type='button';b.className='btn';root.appendChild(b);});var status=el('p');status.setAttribute('role','status');root.appendChild(status);var data=el('pre');data.style.overflowX='auto';root.appendChild(data);var index=0;
function draw(){var d=fixture(+fields.ci.value,+fields.co.value,+fields.stride.value,+fields.pad.value,+fields.pool.value);index=Math.min(index,d.cells.length-1);var c=d.cells[index];status.textContent='输出通道'+c.channel+'，窗口('+c.row+','+c.column+')：各输入通道贡献 '+c.contributions.join(' + ')+' = '+c.contributions.reduce(function(a,b){return a+b;},0);data.textContent='卷积输出形状 '+JSON.stringify(d.shape)+'；权重数 '+d.parameters+'\n卷积结果 '+JSON.stringify(d.outputs)+'\n池化后（若开启） '+JSON.stringify(d.pooled);prev.disabled=index===0;next.disabled=index===d.cells.length-1;}
Object.keys(fields).forEach(function(k){fields[k].onchange=function(){index=0;draw();};});prev.onclick=function(){index--;draw();};next.onclick=function(){index++;draw();};reset.onclick=function(){fields.ci.value=2;fields.co.value=3;fields.stride.value=1;fields.pad.value=0;fields.pool.value=0;note.value='';index=0;draw();};draw();root.appendChild(el('p','迁移：只改步幅或填充，解释边缘贡献为何改变。池化不增加权重；用 ai-conv-channels-pooling 节点中的 PyTorch 代码验证核心通道累加。'));
return {destroy:function(){legacy.destroy();Object.keys(fields).forEach(function(k){fields[k].onchange=null;});prev.onclick=next.onclick=reset.onclick=null;root.remove();}};}
window.KGDemos['ai-conv2d']={title:old.title,mount:mount,selfTest:function(){var a=fixture(2,3,1,0,1),b=fixture(1,1,2,1,0),details=[{name:'原实验',ok:old.selfTest().ok},{name:'非方形2入3出形状和参数',ok:JSON.stringify(a.shape)==='[1,3,2,3]'&&a.parameters===24},{name:'通道累加与池化',ok:a.outputs[0][0][0]===12&&a.pooled[2][0][0]===36},{name:'零填充边界',ok:b.outputs[0][0][0]===1&&JSON.stringify(b.shape)==='[1,1,2,3]'}];return {ok:details.every(function(x){return x.ok;}),details:details};}};
})();
