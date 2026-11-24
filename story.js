/* Story layer: scroll progress, bubble cursor, parallax, and the scroll-driven home page chapters.
   Plain JavaScript, no libraries. Styles live in story.css. */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var narrow = function () { return window.matchMedia("(max-width: 800px)").matches; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Progress bar ---------- */
  var bar = document.createElement("div");
  bar.className = "progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);

  /* ---------- Bubble cursor and trail ---------- */
  var ring = null, rx = -100, ry = -100, tx = -100, ty = -100, lastB = { x: 0, y: 0 };
  if (fine && !reduce) {
    ring = document.createElement("div");
    ring.className = "cursor-ring";
    ring.setAttribute("aria-hidden", "true");
    document.body.appendChild(ring);
    var colors = ["#ff5fa2", "#ffd93d", "#4cc9f0", "#7ed957", "#ff9f1c", "#9b5de5"];
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      tx = e.clientX; ty = e.clientY;
      ring.classList.add("on");
      ring.classList.toggle("big", !!e.target.closest && !!e.target.closest("a, button, .card"));
      var dx = tx - lastB.x, dy = ty - lastB.y;
      if (dx * dx + dy * dy > 2600) {
        lastB = { x: tx, y: ty };
        var b = document.createElement("span"), s = 8 + Math.random() * 14;
        b.className = "trail-bub";
        b.style.cssText = "width:" + s + "px;height:" + s + "px;left:" + (tx - s / 2) + "px;top:" + (ty - s / 2) +
          "px;--c:" + colors[Math.floor(Math.random() * colors.length)] + ";--dx:" + (Math.random() * 40 - 20) + "px";
        document.body.appendChild(b);
        setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 1400);
      }
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", function () { ring.classList.remove("on"); });
    (function follow() {
      rx += (tx - rx) * 0.18; ry += (ty - ry) * 0.18;
      ring.style.transform = "translate3d(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px,0)";
      requestAnimationFrame(follow);
    })();
  }

  /* ---------- Parallax (elements with data-speed) ---------- */
  var par = [];
  function measurePar() {
    par = $$("[data-speed]").map(function (el) {
      el.style.transform = "";
      var r = el.getBoundingClientRect();
      return { el: el, speed: parseFloat(el.getAttribute("data-speed")) || 0, base: r.top + window.scrollY + r.height / 2 - window.innerHeight / 2 };
    });
  }
  function updatePar(y) {
    if (reduce) return;
    for (var i = 0; i < par.length; i++) {
      var p = par[i];
      p.el.style.transform = "translate3d(0," + ((y - p.base) * p.speed).toFixed(1) + "px,0)";
    }
  }

  /* ---------- Marquee rows ---------- */
  var rows = $$(".s-marquee .row");
  function updateMarquee(y) {
    if (reduce) return;
    rows.forEach(function (row) {
      var dir = parseFloat(row.getAttribute("data-dir")) || 1;
      var sec = row.parentNode, top = sec.getBoundingClientRect().top + y;
      var off = (y - top + window.innerHeight) * 0.32 * dir;
      row.style.transform = "translate3d(" + (dir > 0 ? -off - 200 : off - 2200).toFixed(1) + "px,0,0)";
    });
  }

  /* ---------- Chapter one: pinned steps ---------- */
  var dive = $(".s-dive");
  var diveStep = -1;
  function updateDive() {
    if (!dive) return;
    var r = dive.getBoundingClientRect();
    var p = clamp(-r.top / Math.max(1, r.height - window.innerHeight), 0, 0.999);
    var step = Math.floor(p * 3);
    if (step === diveStep) return;
    diveStep = step;
    dive.setAttribute("data-step", String(step));
    $$(".step", dive).forEach(function (el, i) { el.classList.toggle("on", i === step); });
    $$(".dots i", dive).forEach(function (el, i) { el.classList.toggle("on", i === step); });
    $$(".orb img", dive).forEach(function (el, i) { el.classList.toggle("on", i <= step); });
  }

  /* ---------- Chapter two: the trail draws itself ---------- */
  var box = $("#path-box"), trail = $("#trail"), runner = $(".runner"), pins = $$(".pin");
  function placePins() {
    if (!box || !trail || !trail.getPointAtLength) return;
    var len = trail.getTotalLength();
    pins.forEach(function (pin) {
      var pt = trail.getPointAtLength(parseFloat(pin.getAttribute("data-at")) * len);
      pin.style.left = (pt.x / 400 * 100).toFixed(2) + "%";
      pin.style.top = (pt.y / 1000 * 100).toFixed(2) + "%";
    });
  }
  function updatePath() {
    if (!box || !trail || !trail.getPointAtLength) return;
    var r = box.getBoundingClientRect();
    var drawn = reduce ? 1 : clamp((window.innerHeight * 0.62 - r.top) / r.height, 0, 1);
    trail.style.strokeDashoffset = String(1 - drawn);
    var len = trail.getTotalLength();
    var pt = trail.getPointAtLength(drawn * len);
    runner.style.left = (pt.x / 400 * 100).toFixed(2) + "%";
    runner.style.top = (pt.y / 1000 * 100).toFixed(2) + "%";
    runner.style.opacity = drawn > 0 && drawn < 1 ? "1" : "0";
    pins.forEach(function (pin) {
      pin.classList.toggle("on", drawn >= parseFloat(pin.getAttribute("data-at")) - 0.02);
    });
  }

  /* ---------- Chapter three: sideways kits ---------- */
  var kits = $(".s-kits"), track = $("#kits-track");
  function sizeKits() {
    if (!kits || !track) return;
    if (narrow()) { kits.style.height = ""; track.style.transform = ""; return; }
    var dist = Math.max(0, track.scrollWidth - window.innerWidth);
    kits.style.height = (dist + window.innerHeight) + "px";
    kits.__dist = dist;
  }
  function updateKits() {
    if (!kits || !track || narrow()) return;
    var r = kits.getBoundingClientRect();
    var p = clamp(-r.top / Math.max(1, r.height - window.innerHeight), 0, 1);
    track.style.transform = "translate3d(" + (-p * (kits.__dist || 0)).toFixed(1) + "px,0,0)";
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function loadKits() {
    if (!track) return;
    fetch("data/products.json").then(function (r) { return r.json(); }).then(function (list) {
      var end = $(".kit-end", track);
      list.forEach(function (p) {
        var a = document.createElement("a");
        a.className = "card kit";
        a.href = "shop.html";
        a.innerHTML = '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '"><h3>' + esc(p.name) + "</h3><p>" +
          esc(p.description) + '</p><span class="price">' + esc(p.price) + "</span>";
        track.insertBefore(a, end);
        $("img", a).addEventListener("load", onResize);
      });
      onResize();
    }).catch(function () {});
  }

  /* ---------- Scroll loop ---------- */
  var queued = false;
  function frame() {
    queued = false;
    var y = window.scrollY;
    bar.style.transform = "scaleX(" + clamp(y / Math.max(1, document.documentElement.scrollHeight - window.innerHeight), 0, 1).toFixed(4) + ")";
    updatePar(y);
    updateMarquee(y);
    updateDive();
    updatePath();
    updateKits();
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  function onResize() { sizeKits(); measurePar(); placePins(); queue(); }

  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("load", onResize);
  placePins();
  loadKits();
  onResize();
})();
