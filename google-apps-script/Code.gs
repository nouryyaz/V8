/**
 * Mateology Play Society: booking backend (Google Apps Script)
 *
 * What it does
 *  - Reads your sessions from a Google Calendar (you add sessions there, on your phone or computer).
 *  - Takes bookings from the website, saves them to this Google Sheet and checks there is room.
 *  - Emails the parent a confirmation (with an "Add to Google Calendar" link) and emails you an alert.
 *  - Writes "Booked: X of Y" back into the calendar event so you can see numbers at a glance.
 *
 * Setup steps are in SETUP-GOOGLE-BOOKING.md. Edit only the CONFIG block below.
 */

const CONFIG = {
  BUSINESS_NAME: "Mateology Play Society",
  OWNER_EMAIL: "you@example.com",   // booking alerts come here, and parents' replies go here
  CALENDAR_ID: "",                  // blank = your main calendar. Better: the ID of a dedicated "Mateology Play Sessions" calendar
  SPREADSHEET_ID: "",               // blank = the Google Sheet this script was created from
  SHEET_NAME: "Bookings",
  TIMEZONE: "Australia/Sydney",
  DEFAULT_CAPACITY: 20,             // used when an event has no "capacity:" line
  DAYS_AHEAD: 120,                  // how far ahead sessions show on the website
  MAX_CHILDREN_PER_BOOKING: 6
};

const HEADERS = [
  "Booked at", "Ref", "Session key", "Session date", "Session", "Venue",
  "Parent name", "Email", "Phone", "Children", "Child names and ages",
  "Allergies or notes", "Status"
];
const COL = {
  BOOKED_AT: 0, REF: 1, KEY: 2, DATE: 3, TITLE: 4, VENUE: 5, NAME: 6,
  EMAIL: 7, PHONE: 8, CHILDREN: 9, CHILD_DETAILS: 10, NOTES: 11, STATUS: 12
};

/* ---------- One-time setup: run this once from the editor ---------- */

function setup() {
  if (/example\.com$/i.test(CONFIG.OWNER_EMAIL)) {
    throw new Error("Edit OWNER_EMAIL at the top of the script first, then run setup again.");
  }
  const sheet = getSheet_();   // also creates the heading row
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  // Keep phone numbers as text so a leading 0 is not lost
  sheet.getRange(1, COL.PHONE + 1, sheet.getMaxRows(), 1).setNumberFormat("@");
  // Status dropdown: set a booking to "cancelled" to free its spots
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["confirmed", "cancelled"], true).build();
  sheet.getRange(2, COL.STATUS + 1, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
  sheet.autoResizeColumns(1, HEADERS.length);

  const cal = getCalendar_();                 // asks for Calendar permission
  MailApp.getRemainingDailyQuota();           // asks for Gmail permission
  Logger.log("Setup done. Calendar: " + cal.getName() + ". Sheet: " + sheet.getName() +
             ". Emails left today: " + MailApp.getRemainingDailyQuota());
}

/* ---------- Web app: the website talks to these two functions ---------- */

function doGet(e) {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get("sessions");
    if (cached) return out_(cached);

    const booked = countBooked_(readRows_(getSheet_()));
    const sessions = listEvents_()
      .sort(function (a, b) { return a.getStartTime() - b.getStartTime(); })
      .map(function (ev) { return sessionFromEvent_(ev, booked); });
    const payload = JSON.stringify({ ok: true, sessions: sessions, generated: new Date().toISOString() });
    cache.put("sessions", payload, 60);
    return out_(payload);
  } catch (err) {
    console.error("doGet failed: " + err);
    return out_({ ok: false, error: "Could not load sessions." });
  }
}

function doPost(e) {
  let lock = null;
  let result;
  let after = null;
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const v = validate_(body);
    if (!v.ok) return out_({ ok: false, error: v.error });
    const d = v.data;

    const cache = CacheService.getScriptCache();
    if (cache.get("rl:" + d.email)) {
      return out_({ ok: false, error: "Please wait a few seconds before trying again." });
    }
    cache.put("rl:" + d.email, "1", 20);

    lock = LockService.getScriptLock();
    lock.waitLock(15000);   // one booking at a time, so two parents cannot take the same last spot

    const ev = listEvents_().filter(function (x) { return sessionKey_(x) === d.sessionKey; })[0];
    if (!ev) {
      return out_({ ok: false, error: "Sorry, that session is no longer available. Please refresh the page." });
    }
    const sheet = getSheet_();
    const rows = readRows_(sheet);
    const bookedMap = countBooked_(rows);
    const info = sessionFromEvent_(ev, bookedMap);

    if (info.status !== "confirmed") {
      return out_({ ok: false, error: "This session is not open for booking yet." });
    }
    if (ev.getStartTime().getTime() <= Date.now()) {
      return out_({ ok: false, error: "This session has already started." });
    }
    if (info.spotsLeft <= 0) {
      return out_({ ok: false, error: "Sorry, this session is now full." });
    }
    if (d.children > info.spotsLeft) {
      return out_({
        ok: false,
        error: "Only " + info.spotsLeft + (info.spotsLeft === 1 ? " spot is" : " spots are") + " left for this session."
      });
    }
    const dup = rows.some(function (r) {
      return String(r[COL.KEY]) === d.sessionKey &&
             String(r[COL.EMAIL]).toLowerCase() === d.email &&
             String(r[COL.STATUS]).toLowerCase().trim() !== "cancelled";
    });
    if (dup) {
      return out_({
        ok: false,
        error: "This email already has a booking for this session. Reply to your confirmation email if you need to change it."
      });
    }

    const ref = makeRef_();
    sheet.appendRow([
      new Date(), ref, d.sessionKey, info.date, cell_(info.title), cell_(info.venue),
      cell_(d.parentName), d.email, d.phone, d.children,
      cell_(d.childDetails), cell_(d.notes), "confirmed"
    ]);
    SpreadsheetApp.flush();
    const bookedNow = (bookedMap[d.sessionKey] || 0) + d.children;
    updateBookedLine_(ev, bookedNow, info.capacity);
    cache.remove("sessions");

    after = { d: d, info: info, ref: ref, bookedNow: bookedNow };
    result = {
      ok: true,
      ref: ref,
      session: {
        title: info.title, dateLabel: info.dateLabel, timeLabel: info.timeLabel,
        venue: info.venue, price: info.price, payUrl: info.payUrl,
        addToCalendarUrl: info.addToCalendarUrl
      }
    };
  } catch (err) {
    console.error("doPost failed: " + err);
    return out_({ ok: false, error: "Something went wrong on our side. Please try again in a moment." });
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (ignore) {} }
  }

  // Emails go out after the lock is released so other parents are not kept waiting
  result.emailed = sendEmails_(after.d, after.info, after.ref, after.bookedNow);
  return out_(result);
}

/* ---------- Calendar ---------- */

function getCalendar_() {
  const cal = CONFIG.CALENDAR_ID
    ? CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)
    : CalendarApp.getDefaultCalendar();
  if (!cal) throw new Error("Calendar not found. Check CALENDAR_ID.");
  return cal;
}

function listEvents_() {
  const now = new Date();
  const end = new Date(now.getTime() + CONFIG.DAYS_AHEAD * 86400000);
  return getCalendar_().getEvents(now, end);
}

function sessionKey_(ev) {
  return ev.getId() + "|" + ev.getStartTime().getTime();
}

function sessionFromEvent_(ev, bookedMap) {
  const tz = CONFIG.TIMEZONE;
  const start = ev.getStartTime();
  const end = ev.getEndTime();
  const key = sessionKey_(ev);
  const d = parseDescription_(ev.getDescription());
  const title = ev.getTitle() || "Sensory play session";
  const potential = d.status === "potential" || /\b(tbc|potential|pencilled)\b/i.test(title);
  const capacity = d.capacity || CONFIG.DEFAULT_CAPACITY;
  const booked = bookedMap[key] || 0;
  const spotsLeft = Math.max(0, capacity - booked);
  const allDay = ev.isAllDayEvent();
  const venue = ev.getLocation() || "Venue to be confirmed";
  const timeLabel = allDay
    ? "All day"
    : Utilities.formatDate(start, tz, "h:mma").toLowerCase() + " to " +
      Utilities.formatDate(end, tz, "h:mma").toLowerCase();
  const status = potential ? "potential" : "confirmed";
  const details = CONFIG.BUSINESS_NAME + " session." + (d.about ? " " + d.about : "");

  return {
    key: key,
    title: title,
    date: Utilities.formatDate(start, tz, "yyyy-MM-dd"),
    dateLabel: Utilities.formatDate(start, tz, "EEEE d MMMM yyyy"),
    timeLabel: timeLabel,
    venue: venue,
    ages: d.ages,
    price: d.price,
    about: d.about,
    capacity: capacity,
    spotsLeft: spotsLeft,
    status: status,
    bookable: status === "confirmed" && spotsLeft > 0 && start.getTime() > Date.now(),
    payUrl: d.pay,
    addToCalendarUrl: calendarUrl_(ev, title, venue, details)
  };
}

function calendarUrl_(ev, title, venue, details) {
  const tz = CONFIG.TIMEZONE;
  const fmt = ev.isAllDayEvent() ? "yyyyMMdd" : "yyyyMMdd'T'HHmmss";
  const dates = Utilities.formatDate(ev.getStartTime(), tz, fmt) + "/" +
                Utilities.formatDate(ev.getEndTime(), tz, fmt);
  return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" + encodeURIComponent(title) +
    "&dates=" + dates +
    "&ctz=" + encodeURIComponent(tz) +
    "&location=" + encodeURIComponent(venue) +
    "&details=" + encodeURIComponent(details);
}

/** Event description lines like "capacity: 20", "price: $15 per child". Anything else becomes the "about" text. */
function parseDescription_(raw) {
  const out = { capacity: 0, price: "", ages: "", pay: "", status: "confirmed", about: "" };
  const about = [];
  htmlToText_(raw || "").split("\n").forEach(function (line) {
    const m = line.match(/^\s*(capacity|price|ages|pay|status|booked)\s*[:=]\s*(.*?)\s*$/i);
    if (!m) {
      if (line.trim()) about.push(line.trim());
      return;
    }
    const k = m[1].toLowerCase();
    const v = m[2];
    if (k === "capacity") out.capacity = Math.max(0, parseInt(v, 10) || 0);
    else if (k === "price") out.price = v;
    else if (k === "ages") out.ages = v;
    else if (k === "pay") out.pay = /^https:\/\//i.test(v) ? v : "";
    else if (k === "status") out.status = v.toLowerCase();
    // "booked" is written by this script and is ignored here
  });
  out.about = about.join(" ");
  return out;
}

function htmlToText_(s) {
  return String(s)
    .replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\r/g, "");
}

/** Keeps a "Booked: X of Y" line at the bottom of the event so you can see numbers in Google Calendar. */
function updateBookedLine_(ev, booked, capacity) {
  try {
    const lines = htmlToText_(ev.getDescription() || "").split("\n")
      .filter(function (l) { return !/^\s*booked\s*[:=]/i.test(l); });
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    lines.push("Booked: " + booked + " of " + capacity);
    ev.setDescription(lines.join("\n"));
  } catch (err) {
    console.error("Could not update the event description: " + err);
  }
}

/* ---------- Sheet ---------- */

function getSheet_() {
  const ss = CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {   // make sure the heading row always exists
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readRows_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
}

/** Children booked per session. Rows marked "cancelled" do not count. */
function countBooked_(rows) {
  const map = {};
  rows.forEach(function (r) {
    if (String(r[COL.STATUS]).toLowerCase().trim() === "cancelled") return;
    const key = String(r[COL.KEY]);
    map[key] = (map[key] || 0) + (Number(r[COL.CHILDREN]) || 0);
  });
  return map;
}

/** Stops text like =HYPERLINK(...) from running as a formula in the Sheet. */
function cell_(v) {
  const s = String(v == null ? "" : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/* ---------- Validation ---------- */

function validate_(b) {
  const clean = function (v, max) {
    return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  };
  if (b.website) return { ok: false, error: "Sorry, something went wrong." };   // hidden spam trap
  if (b.consent !== true) return { ok: false, error: "Please tick the box to agree before booking." };

  const parentName = clean(b.parentName, 80);
  if (parentName.length < 2) return { ok: false, error: "Please enter your name." };

  const email = clean(b.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Please enter a valid email address." };

  const phone = clean(b.phone, 20);
  if (!/^[+0-9() \-]{6,20}$/.test(phone)) return { ok: false, error: "Please enter a valid phone number." };

  const children = parseInt(b.children, 10);
  if (!(children >= 1 && children <= CONFIG.MAX_CHILDREN_PER_BOOKING)) {
    return { ok: false, error: "Please choose between 1 and " + CONFIG.MAX_CHILDREN_PER_BOOKING + " children." };
  }
  const sessionKey = clean(b.sessionKey, 200);
  if (!sessionKey) return { ok: false, error: "Please choose a session." };

  return {
    ok: true,
    data: {
      parentName: parentName, email: email, phone: phone, children: children,
      childDetails: clean(b.childDetails, 300), notes: clean(b.notes, 500), sessionKey: sessionKey
    }
  };
}

/* ---------- Emails ---------- */

function sendEmails_(d, info, ref, bookedNow) {
  let parentOk = true;
  const priceLine = info.price ? "Price: " + info.price + "\n" : "";
  try {
    const text =
      "Hi " + d.parentName + ",\n\nYou're booked in! Here are your details.\n\n" +
      "Session: " + info.title + "\nDate: " + info.dateLabel + "\nTime: " + info.timeLabel + "\n" +
      "Venue: " + info.venue + "\nChildren: " + d.children + "\n" + priceLine +
      "Booking reference: " + ref + "\n\n" +
      (info.payUrl ? "Pay online: " + info.payUrl + "\n" : "") +
      "Add to your Google Calendar: " + info.addToCalendarUrl + "\n\n" +
      "Need to change or cancel? Just reply to this email.\n\n" + CONFIG.BUSINESS_NAME;
    const html =
      "<p>Hi " + esc_(d.parentName) + ",</p><p>You're booked in! Here are your details.</p><ul>" +
      "<li><b>Session:</b> " + esc_(info.title) + "</li>" +
      "<li><b>Date:</b> " + esc_(info.dateLabel) + "</li>" +
      "<li><b>Time:</b> " + esc_(info.timeLabel) + "</li>" +
      "<li><b>Venue:</b> " + esc_(info.venue) + "</li>" +
      "<li><b>Children:</b> " + d.children + "</li>" +
      (info.price ? "<li><b>Price:</b> " + esc_(info.price) + "</li>" : "") +
      "<li><b>Booking reference:</b> " + esc_(ref) + "</li></ul>" +
      (info.payUrl ? '<p><a href="' + esc_(info.payUrl) + '">Pay online</a></p>' : "") +
      '<p><a href="' + esc_(info.addToCalendarUrl) + '">Add to your Google Calendar</a></p>' +
      "<p>Need to change or cancel? Just reply to this email.</p><p>" + esc_(CONFIG.BUSINESS_NAME) + "</p>";
    MailApp.sendEmail({
      to: d.email,
      subject: "Booking confirmed: " + info.title + ", " + info.dateLabel,
      body: text,
      htmlBody: html,
      name: CONFIG.BUSINESS_NAME,
      replyTo: CONFIG.OWNER_EMAIL
    });
  } catch (err) {
    parentOk = false;
    console.error("Parent email failed: " + err);
  }

  try {
    MailApp.sendEmail({
      to: CONFIG.OWNER_EMAIL,
      subject: "New booking: " + d.parentName + ", " + d.children + (d.children === 1 ? " child" : " children") + ", " + info.dateLabel,
      body:
        "Ref: " + ref + "\nSession: " + info.title + "\nWhen: " + info.dateLabel + ", " + info.timeLabel +
        "\nVenue: " + info.venue + "\nSpots taken: " + bookedNow + " of " + info.capacity +
        "\n\nParent: " + d.parentName + "\nEmail: " + d.email + "\nPhone: " + d.phone +
        "\nChildren: " + d.children + "\nChild names and ages: " + (d.childDetails || "none given") +
        "\nAllergies or notes: " + (d.notes || "none given") +
        "\n\nEmail sent to parent: " + (parentOk ? "yes" : "NO, please contact them")
    });
  } catch (err) {
    console.error("Owner email failed: " + err);
  }
  return parentOk;
}

/* ---------- Helpers ---------- */

function makeRef_() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "SP-";
  for (let i = 0; i < 5; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function esc_(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function out_(obj) {
  return ContentService
    .createTextOutput(typeof obj === "string" ? obj : JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
