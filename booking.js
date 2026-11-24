/* Booking calendar for the Sessions page.
   Talks to the Google Apps Script web app whose URL is set in config.js. */
(function () {
  "use strict";

  var API = (typeof BOOKING_API_URL === "string" ? BOOKING_API_URL : "").trim();
  var DEMO = API === "";
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November", "December"];
  var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  var state = { sessions: [], month: null, day: null, current: null, submitting: false };

  var $ = function (id) { return document.getElementById(id); };
  var calTitle = $("cal-title"), calGrid = $("cal-grid"), calPrev = $("cal-prev"), calNext = $("cal-next");
  var listEl = $("sessions"), listTitle = $("list-title"), showAll = $("show-all");
  var statusEl = $("status"), demoNote = $("demo-note");
  var dialog = $("book-dialog"), form = $("book-form"), formView = $("form-view"), doneView = $("done-view");
  var summaryEl = $("dialog-summary"), childrenSel = $("children-select");
  var formError = $("form-error"), submitBtn = $("submit-btn");
  var doneBody = $("done-body"), doneActions = $("done-actions");

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function keyOf(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }   // m is 0-11
  function todayKey() { var t = new Date(); return keyOf(t.getFullYear(), t.getMonth(), t.getDate()); }
  function parseKey(k) { var p = k.split("-"); return { y: +p[0], m: +p[1] - 1, d: +p[2] }; }
  function monthOf(k) { var p = parseKey(k); return { y: p.y, m: p.m }; }
  function monthIndex(mo) { return mo.y * 12 + mo.m; }
  function longDate(k) {
    var p = parseKey(k);
    return new Date(p.y, p.m, p.d).toLocaleDateString("en-AU", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }
  function safeUrl(u, prefix) {
    return typeof u === "string" && u.indexOf(prefix) === 0 ? u : "";
  }
  function findSession(key) {
    for (var i = 0; i < state.sessions.length; i++) {
      if (state.sessions[i].key === key) return state.sessions[i];
    }
    return null;
  }

  /* ---------- loading ---------- */

  function loadLive() {
    var url = API + (API.indexOf("?") > -1 ? "&" : "?") + "action=sessions";
    return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || !data.ok) throw new Error("bad response");
      return data.sessions || [];
    });
  }

  function loadDemo() {
    return fetch("data/sessions.json").then(function (r) { return r.json(); }).then(function (rows) {
      return rows.map(function (s, i) {
        return {
          key: "demo-" + i, title: "Sensory play session", date: s.date, timeLabel: s.time,
          venue: [s.venue, s.address].filter(Boolean).join(", "), ages: s.ages, price: s.price,
          status: s.status === "confirmed" ? "confirmed" : "potential", spotsLeft: null, bookable: false
        };
      });
    });
  }

  function load() {
    statusEl.textContent = "Loading sessions...";
    demoNote.hidden = !DEMO;
    return (DEMO ? loadDemo() : loadLive()).then(function (list) {
      var today = todayKey();
      state.sessions = list.filter(function (s) { return s.date >= today; })
        .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      if (!state.month) {
        state.month = monthOf(state.sessions.length ? state.sessions[0].date : today);
      }
      statusEl.textContent = "";
      render();
    }).catch(function () {
      statusEl.textContent = "We couldn't load the sessions just now. Please refresh the page in a moment.";
    });
  }

  /* ---------- calendar ---------- */

  function renderCalendar() {
    var y = state.month.y, m = state.month.m;
    var today = todayKey();
    var byDate = {};
    state.sessions.forEach(function (s) { (byDate[s.date] = byDate[s.date] || []).push(s); });

    calTitle.textContent = MONTHS[m] + " " + y;
    var nowMo = monthOf(today);
    calPrev.disabled = monthIndex(state.month) <= monthIndex(nowMo);
    calNext.disabled = monthIndex(state.month) >= monthIndex(nowMo) + 6;

    var html = DOW.map(function (d) { return '<div class="cal-dow">' + d + "</div>"; }).join("");
    var offset = (new Date(y, m, 1).getDay() + 6) % 7;   // Monday first
    var days = new Date(y, m + 1, 0).getDate();
    for (var i = 0; i < offset; i++) html += '<div class="cal-day blank"></div>';

    for (var d = 1; d <= days; d++) {
      var k = keyOf(y, m, d);
      var list = byDate[k];
      var cls = "cal-day" + (k === today ? " is-today" : "") + (k < today ? " past" : "");
      if (!list) {
        html += '<div class="' + cls + '">' + d + "</div>";
        continue;
      }
      var hasOpen = list.some(function (s) { return s.status === "confirmed" && s.spotsLeft !== 0; });
      var hasConfirmed = list.some(function (s) { return s.status === "confirmed"; });
      cls += hasOpen ? " has-confirmed" : hasConfirmed ? " has-full" : " has-potential";
      if (state.day === k) cls += " is-selected";
      var label = longDate(k) + ": " + list.length + (list.length === 1 ? " session" : " sessions");
      html += '<button type="button" class="' + cls + '" data-day="' + k + '" aria-label="' + esc(label) +
              '" aria-pressed="' + (state.day === k) + '">' + d + "</button>";
    }
    calGrid.innerHTML = html;
  }

  /* ---------- session list ---------- */

  function cardHtml(s) {
    var potential = s.status !== "confirmed";
    var full = !potential && s.spotsLeft === 0;
    var cls = "card " + (potential ? "potential" : "confirmed") + (full ? " full" : "");
    var tag = potential ? '<span class="tag potential">Pencilled in</span>'
            : full ? '<span class="tag full">Fully booked</span>'
            : '<span class="tag">' + (DEMO ? "Confirmed" : "Open for booking") + "</span>";
    var h = '<div class="' + cls + '">' + tag + "<h3>" + esc(longDate(s.date)) + "</h3>" +
            "<p><strong>" + esc(s.timeLabel) + "</strong></p>" +
            "<p>" + esc(s.venue) + "</p>";
    if (s.title && !DEMO) h += '<p class="muted">' + esc(s.title) + "</p>";
    if (s.ages) h += "<p>Ages: " + esc(s.ages) + "</p>";
    if (s.about) h += "<p>" + esc(s.about) + "</p>";
    if (s.price) h += '<p class="price">' + esc(s.price) + "</p>";
    if (!potential && !full && s.spotsLeft != null) {
      h += '<p class="spots' + (s.spotsLeft <= 5 ? " low" : "") + '">' + s.spotsLeft +
           (s.spotsLeft === 1 ? " spot left" : " spots left") + "</p>";
    }
    if (s.bookable) {
      h += '<button type="button" class="btn" data-book="' + esc(s.key) + '">Book a spot</button>';
    } else if (potential) {
      h += '<p class="muted">Venue and time are still being confirmed. Check back soon.</p>';
    } else if (full) {
      h += '<p class="muted">This session is full.</p>';
    } else if (DEMO) {
      h += '<p class="muted">Online booking opens soon.</p>';
    } else {
      h += '<p class="muted">Booking has closed for this session.</p>';
    }
    return h + "</div>";
  }

  function renderList() {
    var shown = state.day
      ? state.sessions.filter(function (s) { return s.date === state.day; })
      : state.sessions;
    listTitle.textContent = state.day ? "Sessions on " + longDate(state.day) : "Upcoming sessions";
    showAll.hidden = !state.day;
    listEl.innerHTML = shown.length
      ? shown.map(cardHtml).join("")
      : "<p>New sessions are coming soon. Check back shortly!</p>";
  }

  function render() { renderCalendar(); renderList(); }

  /* ---------- booking dialog ---------- */

  function openDialog() {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  function closeDialog() {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function openBooking(key) {
    var s = findSession(key);
    if (!s || !s.bookable) return;
    state.current = s;
    form.reset();
    formError.textContent = "";
    formView.hidden = false;
    doneView.hidden = true;
    summaryEl.textContent = longDate(s.date) + ", " + s.timeLabel + " at " + s.venue +
                            (s.price ? " (" + s.price + ")" : "");
    var max = Math.min(6, s.spotsLeft);
    var opts = "";
    for (var i = 1; i <= max; i++) opts += '<option value="' + i + '">' + i + "</option>";
    childrenSel.innerHTML = opts;
    openDialog();
  }

  function showDone(res, email) {
    var s = res.session || {};
    var html = "<p>Your booking reference is <strong>" + esc(res.ref) + "</strong>.</p>" +
      "<p>" + esc(s.dateLabel || "") + ", " + esc(s.timeLabel || "") + "<br>" + esc(s.venue || "") + "</p>" +
      (res.emailed
        ? "<p>We've emailed a confirmation to " + esc(email) + ". If you can't see it, check your junk folder.</p>"
        : "<p>Your spot is saved, but we couldn't send the confirmation email. Please keep your reference above.</p>");
    var pay = safeUrl(s.payUrl, "https://");
    if (s.price && pay) html += "<p>Price: " + esc(s.price) + ". You can pay online now, or on the day if you prefer.</p>";
    else if (s.price) html += "<p>Price: " + esc(s.price) + ". Payment is taken on the day.</p>";
    doneBody.innerHTML = html;

    var actions = "";
    var cal = safeUrl(s.addToCalendarUrl, "https://calendar.google.com/");
    if (cal) actions += '<a class="btn" href="' + esc(cal) + '" target="_blank" rel="noopener">Add to Google Calendar</a>';
    if (pay) actions += '<a class="btn btn-sun" href="' + esc(pay) + '" target="_blank" rel="noopener">Pay now</a>';
    actions += '<button type="button" class="link-btn" data-close>Close</button>';
    doneActions.innerHTML = actions;

    formView.hidden = true;
    doneView.hidden = false;
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!state.current || state.submitting) return;
    var fd = new FormData(form);
    var payload = {
      sessionKey: state.current.key,
      parentName: String(fd.get("parentName") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      children: Number(fd.get("children")),
      childDetails: String(fd.get("childDetails") || "").trim(),
      notes: String(fd.get("notes") || "").trim(),
      consent: form.elements.consent.checked,
      website: String(fd.get("website") || "")
    };
    if (payload.parentName.length < 2) { formError.textContent = "Please enter your name."; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) { formError.textContent = "Please enter a valid email address."; return; }
    if (!/^[+0-9() \-]{6,20}$/.test(payload.phone)) { formError.textContent = "Please enter a valid phone number."; return; }
    if (!payload.consent) { formError.textContent = "Please tick the box to agree before booking."; return; }

    state.submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Booking...";
    formError.textContent = "";

    // text/plain keeps this a "simple" request, so the browser does not need a permission check first
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (res && res.ok) {
        showDone(res, payload.email);
        load();   // refresh spots left
      } else {
        formError.textContent = (res && res.error) || "Something went wrong. Please try again.";
        if (res && res.error && /full|spot|no longer available|already started/i.test(res.error)) load();
      }
    }).catch(function () {
      formError.textContent = "We couldn't reach the booking system. Please check your connection and try again.";
    }).then(function () {
      state.submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Confirm booking";
    });
  });

  /* ---------- events ---------- */

  calGrid.addEventListener("click", function (e) {
    var b = e.target.closest("[data-day]");
    if (!b) return;
    state.day = state.day === b.getAttribute("data-day") ? null : b.getAttribute("data-day");
    render();
    if (state.day) listTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  calPrev.addEventListener("click", function () {
    state.month = { y: state.month.y + (state.month.m === 0 ? -1 : 0), m: (state.month.m + 11) % 12 };
    renderCalendar();
  });
  calNext.addEventListener("click", function () {
    state.month = { y: state.month.y + (state.month.m === 11 ? 1 : 0), m: (state.month.m + 1) % 12 };
    renderCalendar();
  });
  showAll.addEventListener("click", function () { state.day = null; render(); });
  listEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-book]");
    if (b) openBooking(b.getAttribute("data-book"));
  });
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog || e.target.closest("[data-close]")) closeDialog();
  });

  load();
})();
