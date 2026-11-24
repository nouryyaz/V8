/* Motion layer: floating balloons and clouds, 3D alphabet blocks, pop-out hover, random wiggles.
   Plain JavaScript, no libraries. Styles live in fun.css. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  root.classList.add("js");

  /* ---------- Sky: balloons and clouds ---------- */

  function buildSky() {
    var colors = ["#ff5fa2", "#ffd93d", "#4cc9f0", "#7ed957", "#ff9f1c", "#9b5de5", "#2ec4b6", "#ff5fa2"];
    var xs = [4, 15, 27, 40, 54, 67, 80, 92];
    var widths = [50, 44, 58, 48, 54, 46, 60, 42];
    var durs = [26, 32, 29, 36, 25, 33, 28, 31];
    var delays = [-3, -17, -9, -26, -13, -21, -6, -30];
    var rests = [62, 22, 74, 38, 56, 80, 30, 68];
    var html = "";
    var i;
    for (i = 0; i < 8; i++) {
      html += '<span class="balloon" style="--c:' + colors[i] + ";--x:" + xs[i] + "%;--w:" + widths[i] +
              "px;--dur:" + durs[i] + "s;--delay:" + delays[i] + "s;--rest:" + rests[i] + '%"></span>';
    }
    var tops = [10, 34, 58, 80];
    var scales = [1, 0.7, 1.15, 0.85];
    var cdurs = [75, 105, 88, 120];
    var cdelays = [-12, -60, -35, -90];
    var cxs = [12, 62, 30, 74];
    for (i = 0; i < 4; i++) {
      html += '<span class="cloud" style="--top:' + tops[i] + "%;--s:" + scales[i] + ";--dur:" + cdurs[i] +
              "s;--delay:" + cdelays[i] + "s;--cx:" + cxs[i] + '%"></span>';
    }
    var sky = document.createElement("div");
    sky.className = "sky";
    sky.setAttribute("aria-hidden", "true");
    sky.innerHTML = html;
    document.body.insertBefore(sky, document.body.firstChild);
  }

  /* ---------- 3D alphabet blocks ---------- */

  function buildCubes() {
    var colors = { pink: "#ff5fa2", sun: "#ffb800", sky: "#2fb8e6", lime: "#5fc03a", purple: "#9b5de5", orange: "#ff9f1c" };
    var faces = ["front", "back", "right", "left", "top", "bottom"];
    var cubes = document.querySelectorAll(".cube[data-letter]");
    for (var i = 0; i < cubes.length; i++) {
      var c = cubes[i];
      var letter = c.getAttribute("data-letter");
      c.style.setProperty("--c", colors[c.getAttribute("data-color")] || colors.pink);
      c.setAttribute("aria-hidden", "true");
      c.innerHTML = '<div class="cube-in">' + faces.map(function (f) {
        return '<span class="face ' + f + '">' + letter + "</span>";
      }).join("") + "</div>";
    }
  }

  /* ---------- Scroll pop-in ---------- */

  function setupReveal() {
    var SEL = ".reveal-me, main h2, .card, .photo-pair img, .cta-band, .booking-calendar, .list-head";
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });

    function scan() {
      var els = document.querySelectorAll(SEL);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.__seen) continue;
        el.__seen = true;
        el.style.setProperty("--i", String(i % 4));
        el.classList.add("reveal");
        io.observe(el);
      }
    }
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- Pop-out hover: things lean toward your pointer and come forward ---------- */

  var POP_SEL = ".card, .btn, .blob-photo, .photo-pair img, .cta-band img, button.cal-day";
  var RANGE = 120;
  var px = -9999, py = -9999, queued = false;

  function clear(el) {
    if (!el.__p) return;
    el.__p = 0;
    el.style.removeProperty("--pop");
    el.style.removeProperty("--rx");
    el.style.removeProperty("--ry");
    el.style.removeProperty("--rz");
    el.classList.remove("near");
  }

  function update() {
    queued = false;
    var list = document.querySelectorAll(POP_SEL);
    var vh = window.innerHeight;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.bottom < -RANGE || r.top > vh + RANGE) { clear(el); continue; }
      var hw = r.width / 2, hh = r.height / 2;
      var dx = px - (r.left + hw), dy = py - (r.top + hh);
      var dist = Math.sqrt(Math.pow(Math.max(0, Math.abs(dx) - hw), 2) + Math.pow(Math.max(0, Math.abs(dy) - hh), 2));
      var t = 1 - dist / RANGE;
      if (t <= 0) { clear(el); continue; }
      var p = t * t * (3 - 2 * t);
      var max = el.classList.contains("btn") ? 7 : el.classList.contains("cal-day") ? 9 : 10;
      var nx = Math.max(-1.2, Math.min(1.2, dx / hw));
      var ny = Math.max(-1.2, Math.min(1.2, dy / hh));
      if (el.__rot === undefined) el.__rot = Math.random() * 6 - 3;
      el.__p = p;
      el.style.setProperty("--pop", p.toFixed(3));
      el.style.setProperty("--ry", (nx * max * p).toFixed(2) + "deg");
      el.style.setProperty("--rx", (-ny * max * p).toFixed(2) + "deg");
      el.style.setProperty("--rz", (el.__rot * p).toFixed(2) + "deg");
      el.classList.toggle("near", p > 0.35);
    }
  }

  function queue() {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }

  function resetAll() {
    px = py = -9999;
    var list = document.querySelectorAll(POP_SEL);
    for (var i = 0; i < list.length; i++) clear(list[i]);
  }

  function setupPop() {
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      px = e.clientX; py = e.clientY; queue();
    }, { passive: true });
    window.addEventListener("scroll", function () { if (px > -9000) queue(); }, { passive: true });
    document.documentElement.addEventListener("mouseleave", resetAll);
    window.addEventListener("blur", resetAll);
  }

  /* ---------- Random wiggles, one thing at a time ---------- */

  function setupWiggle() {
    var SEL = ".btn, .photo-pair img, .cta-band img, .blob-photo, .card img";
    function inView(el) {
      var r = el.getBoundingClientRect();
      return r.width > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
    }
    function tick() {
      var dlg = document.getElementById("book-dialog");
      if (!document.hidden && !(dlg && dlg.open)) {
        var all = document.querySelectorAll(SEL);
        var cands = [];
        for (var i = 0; i < all.length; i++) if (inView(all[i]) && !all[i].classList.contains("near")) cands.push(all[i]);
        if (cands.length) {
          var el = cands[Math.floor(Math.random() * cands.length)];
          el.classList.add("wiggle");
          el.addEventListener("animationend", function done() {
            el.classList.remove("wiggle");
            el.removeEventListener("animationend", done);
          });
        }
      }
      setTimeout(tick, 3500 + Math.random() * 4000);
    }
    setTimeout(tick, 3000);
  }

  /* ---------- Start ---------- */

  buildSky();
  buildCubes();
  if (reduce) return;
  setupReveal();
  if (finePointer) setupPop();
  setupWiggle();
})();
