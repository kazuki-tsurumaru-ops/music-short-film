/* ===== 全作品共通の動き =====
   ・物語の各場面（.scene）の data-shot に書いた名前の画像を、背景に切り替えて表示する
     （images/名前-l.jpg が横長用、images/名前-p.jpg がスマホ縦用）
   ・#watch の data-youtube-id に動画IDを書くと、YouTube を埋め込む
*/
(function () {
  // スクロールする場所：ページ全体か、.scroller の箱の中（埋め込み表示用）
  var box0 = document.querySelector(".scroller");
  var view = box0 || window;
  var getY = function () { return box0 ? box0.scrollTop : (window.pageYOffset || document.documentElement.scrollTop || 0); };
  var setY = function (y) { if (box0) box0.scrollTop = y; else window.scrollTo(0, y); };

  // 「本編を観る」などのページ内リンクは、なめらかに移動する
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var to = document.getElementById(a.getAttribute("href").slice(1));
    if (!to) return;
    e.preventDefault();
    try { to.scrollIntoView({ behavior: "smooth", block: "start" }); }
    catch (err) { to.scrollIntoView(true); }
  });

  var story = document.querySelector(".story");
  if (story) {
    var base = story.getAttribute("data-img-base") || "images/";
    var stage = story.querySelector(".stage");
    var scenes = Array.prototype.slice.call(story.querySelectorAll(".scene"));
    var shots = {};

    scenes.forEach(function (scene) {
      var name = scene.getAttribute("data-shot");
      if (!name || shots[name]) return;
      var el = document.createElement("div");
      el.className = "shot";
      el.innerHTML =
        '<picture><source media="(orientation: portrait)" data-srcset="' + base + name + '-p.jpg">' +
        '<img alt="" decoding="async" data-src="' + base + name + '-l.jpg"></picture>';
      stage.appendChild(el);
      shots[name] = el;
    });

    function load(name) {
      var el = shots[name];
      if (!el || el.dataset.loaded) return;
      var src = el.querySelector("source"), img = el.querySelector("img");
      src.srcset = src.getAttribute("data-srcset");
      img.src = img.getAttribute("data-src");
      el.dataset.loaded = "1";
    }

    function show(i) {
      var name = scenes[i].getAttribute("data-shot");
      Object.keys(shots).forEach(function (k) { shots[k].classList.toggle("on", k === name); });
      for (var j = i; j <= i + 3 && j < scenes.length; j++) load(scenes[j].getAttribute("data-shot"));
    }

    show(0);

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          show(scenes.indexOf(e.target));
        });
      }, { rootMargin: "-45% 0px -45% 0px" });
      scenes.forEach(function (s) { io.observe(s); });
    }

    // 文字が画面の中央に近いほど濃く、そのぶん背景の写真を暗くする
    var cards = scenes.map(function (s) { return s.querySelector(".card"); });
    var dim = document.createElement("div");
    dim.className = "dim";
    stage.appendChild(dim);
    var ticking = false;
    var focus = function () {
      ticking = false;
      var vh = window.innerHeight, best = 0;
      cards.forEach(function (c, i) {
        if (!c) return;
        var r = c.getBoundingClientRect();
        var t = 0;
        if (r.bottom > -vh * 0.2 && r.top < vh * 1.2) {
          var d = Math.abs(r.top + r.height / 2 - vh / 2) / (vh * 0.42);
          t = Math.max(0, 1 - d);
          t = t * t * (3 - 2 * t);
        }
        c.style.setProperty("--t", t.toFixed(3));
        if (scenes[i].getAttribute("data-shot")) best = Math.max(best, t);
      });
      stage.style.setProperty("--dim", best.toFixed(3));
    };
    var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(focus); } };
    view.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    focus();
  }

  // 冒頭のメッセージ：約1秒で暗転 → タイプライターで文章 → 少し止まってフェードアウト。触るとスキップ
  var intro = document.getElementById("intro");
  if (intro) {
    var out = intro.querySelector(".intro-text");
    var full = (out.getAttribute("data-text") || "").replace(/^\s+|\s+$/g, "");
    var finished = false, timer = 0, k = 0;
    var finish = function () {
      if (finished) return;
      finished = true; clearTimeout(timer);
      intro.classList.add("out");
      setTimeout(function () {
        intro.hidden = true;
        document.dispatchEvent(new Event("intro:done"));
      }, 1200);
    };
    var typed = function () {
      out.textContent = full;
      intro.classList.add("typed");
      timer = setTimeout(finish, 2600);
    };
    var type = function () {
      if (finished) return;
      if (k >= full.length) { typed(); return; }
      var ch = full.charAt(k++);
      out.textContent = full.slice(0, k);
      var wait = 50;
      if (ch === "、") wait = 180;
      else if (ch === "。") wait = 400;
      else if (ch === "\n") wait = full.charAt(k) === "\n" ? 700 : 280;
      timer = setTimeout(type, wait);
    };
    intro.hidden = false;
    setTimeout(function () {
      intro.classList.add("dark");
      timer = setTimeout(type, 900);
    }, 1000);
    ["click", "wheel", "keydown", "touchstart"].forEach(function (ev) {
      intro.addEventListener(ev, finish, { passive: true });
    });
    window.addEventListener("keydown", finish);
  }

  // 粒子のテクスチャ
  var grain = document.createElement("div");
  grain.className = "grain";
  grain.setAttribute("aria-hidden", "true");
  document.body.appendChild(grain);

  // 自動スクロール：次の文字までなめらかに移動し、文字が画面の中央に来たら少し止まって読ませる。
  // 触る・スクロール・キー操作で止まる。本編まで来たら止まる
  var watchEl = document.getElementById("watch");
  if (story && watchEl) {
    var pill = document.createElement("button");
    pill.type = "button";
    pill.className = "autoplay";
    pill.innerHTML = '<span class="ico" aria-hidden="true"></span>';
    document.body.appendChild(pill);
    var stops = Array.prototype.slice.call(story.querySelectorAll(".scene .card"));
    var auto = { on: false, raf: 0, timer: 0 };
    var label = function () {
      pill.classList.toggle("on", auto.on);
      pill.setAttribute("aria-label", auto.on ? "自動スクロールを止める" : "自動スクロールを始める");
    };
    // その文字の中央が画面の中央に来るスクロール位置
    var targetOf = function (el) {
      var r = el.getBoundingClientRect();
      return getY() + r.top + r.height / 2 - window.innerHeight / 2;
    };
    var watchTarget = function () { return getY() + watchEl.getBoundingClientRect().top - window.innerHeight * 0.06; };
    // 読む時間：文字数に合わせて2〜3.4秒（幕の題名は2秒）
    var holdOf = function (el) {
      if (el.closest(".act")) return 2000;
      var n = (el.textContent || "").replace(/\s/g, "").length;
      return Math.min(3400, 2000 + n * 18);
    };
    var ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var glide = function (to, done) {
      var from = getY(), dist = to - from;
      var dur = 900 + 500 * Math.min(1.6, Math.abs(dist) / window.innerHeight);
      var t0 = 0;
      var tick = function (ts) {
        if (!auto.on) return;
        if (!t0) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur);
        setY(from + dist * ease(k));
        if (k < 1) auto.raf = requestAnimationFrame(tick); else done();
      };
      auto.raf = requestAnimationFrame(tick);
    };
    var next = function () {
      if (!auto.on) return;
      var y = getY() + 4;
      var el = null;
      for (var i = 0; i < stops.length; i++) { if (targetOf(stops[i]) > y) { el = stops[i]; break; } }
      if (!el) { glide(Math.max(getY(), watchTarget()), stopAuto); return; }
      glide(targetOf(el), function () { auto.timer = setTimeout(next, holdOf(el)); });
    };
    var stopAuto = function () {
      if (!auto.on) return;
      auto.on = false;
      cancelAnimationFrame(auto.raf); clearTimeout(auto.timer);
      label();
    };
    var startAuto = function () {
      if (watchEl.getBoundingClientRect().top <= window.innerHeight * 0.1) return;
      auto.on = true; label(); next();
    };
    pill.addEventListener("click", function () { auto.on ? stopAuto() : startAuto(); });
    ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (ev) {
      window.addEventListener(ev, function (e) {
        if (auto.on && !(e.target.closest && e.target.closest(".autoplay"))) stopAuto();
      }, { passive: true });
    });
    // 物語を見ている間だけボタンを出す
    var togglePill = function () { pill.hidden = story.getBoundingClientRect().bottom < window.innerHeight * 0.5; };
    view.addEventListener("scroll", togglePill, { passive: true });
    togglePill();
    label();
    // 端末の「視差効果を減らす」の設定に関係なく、同じ動きで始める（2026-10-24 本人の指定）
    var kick = function () { if (getY() < 10) startAuto(); };
    // 冒頭のメッセージがあるページでは、それが終わってから始める
    if (document.getElementById("intro")) document.addEventListener("intro:done", function () { setTimeout(kick, 900); });
    else setTimeout(kick, 2500);
  }

  // メイキング写真：押すと大きく表示する（← → キー、ボタンで前後へ）
  var links = Array.prototype.slice.call(document.querySelectorAll(".gallery a"));
  if (links.length && window.HTMLDialogElement) {
    var box = document.createElement("dialog");
    box.className = "lightbox";
    box.setAttribute("aria-label", "写真");
    box.innerHTML =
      '<img alt="">' +
      '<button class="lb-btn lb-close" type="button" aria-label="閉じる">×</button>' +
      '<button class="lb-btn lb-prev" type="button" aria-label="前の写真">‹</button>' +
      '<button class="lb-btn lb-next" type="button" aria-label="次の写真">›</button>' +
      '<span class="lb-count"></span>';
    document.body.appendChild(box);
    var big = box.querySelector("img"), count = box.querySelector(".lb-count"), cur = 0;
    var go = function (i) {
      cur = (i + links.length) % links.length;
      big.src = links[cur].href;
      big.alt = links[cur].querySelector("img").alt;
      count.textContent = (cur + 1) + " / " + links.length;
    };
    links.forEach(function (a, i) {
      a.addEventListener("click", function (e) { e.preventDefault(); go(i); box.showModal(); });
    });
    box.querySelector(".lb-close").addEventListener("click", function () { box.close(); });
    box.querySelector(".lb-prev").addEventListener("click", function () { go(cur - 1); });
    box.querySelector(".lb-next").addEventListener("click", function () { go(cur + 1); });
    box.addEventListener("click", function (e) { if (e.target === box) box.close(); });
    box.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") go(cur - 1);
      if (e.key === "ArrowRight") go(cur + 1);
    });
    var sx = null;
    box.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 40) go(dx < 0 ? cur + 1 : cur - 1);
    });
  }

  var watch = document.getElementById("watch");
  if (watch) {
    var id = (watch.getAttribute("data-youtube-id") || "").trim();
    var facade = watch.querySelector(".facade");
    var link = watch.querySelector(".yt-link");
    if (!id) {
      watch.classList.add("pending");
      facade.setAttribute("aria-label", "本編は近日公開");
    } else {
      link.href = "https://www.youtube.com/watch?v=" + encodeURIComponent(id);
      if (watch.getAttribute("data-embed") === "off") {
        // 埋め込みが使えない置き場所では、画像を押すとYouTubeを開く
        var a = document.createElement("a");
        a.className = facade.className;
        a.href = link.href; a.target = "_blank"; a.rel = "noopener";
        a.setAttribute("aria-label", "YouTubeで本編を観る");
        a.innerHTML = facade.innerHTML;
        facade.replaceWith(a);
        return;
      }
      facade.addEventListener("click", function () {
        var f = document.createElement("iframe");
        f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0&playsinline=1";
        f.title = facade.getAttribute("data-title") || "本編";
        f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        f.allowFullscreen = true;
        facade.replaceWith(f);
      });
    }
  }
})();
