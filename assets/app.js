// ===== Utilities / Config =====
const TZ = "America/Toronto";
const fmtLong = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const fmtIso = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});
const el = (id) => document.getElementById(id);

const els = {
  count: el("count"),
  daysAhead: el("daysAhead"),
  name: el("name"),
  startTime: el("startTime"),
  endTime: el("endTime"),
  interval: el("interval"),
  perDay: el("perDay"),
  weekdaysOnly: el("weekdaysOnly"),
  bizFriendly: el("bizFriendly"),
  morningBias: el("morningBias"),
  afternoonBias: el("afternoonBias"),
  blacklist: el("blacklist"),
  gen: el("gen"),
  copyList: el("copyList"),
  copyEmail: el("copyEmail"),
  tone: el("tone"),
  downloadICS: el("downloadICS"),
  slots: el("slots"),
  status: el("status"),
  peek: el("peek"),
  helpFab: el("helpFab"),
  helpModal: el("helpModal"),
  helpClose: el("helpClose"),
  useGoogle: el("useGoogle"),
  googleAuth: el("googleAuth"),
  useICS: el("useICS"),
  icsFile: el("icsFile"),
  chooseICS: el("chooseICS"),
  calendarStatus: el("calendarStatus"),
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function isWeekend(d) {
  const w = d.getDay();
  return w === 0 || w === 6;
}
function parseHHMM(s) {
  const [h, m] = s.split(":").map(Number);
  return { h: clamp(h, 0, 23), m: clamp(m, 0, 59) };
}
function addDays(base, days) {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}
function toLocalDate(y, m, d, hh, mm) {
  const dt = new Date();
  dt.setFullYear(y, m, d);
  dt.setHours(hh, mm, 0, 0);
  return dt;
}
function snap(date, interval) {
  date.setMinutes(Math.floor(date.getMinutes() / interval) * interval, 0, 0);
  return date;
}
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function toETLabel(d) {
  const parts = fmtLong.formatToParts(d);
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${m.weekday}, ${m.month} ${m.day}, ${m.year} — ${m.hour}:${m.minute} ${m.dayPeriod} ET`;
}
function partitionByDay(dates) {
  const key = (dt) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dt);
  const map = new Map();
  dates.forEach((d) => {
    const k = key(d);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(d);
  });
  return map;
}

// ===== Generation =====
function getCfg() {
  const bl = (els.blacklist?.value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    count: clamp(parseInt(els.count.value || "6", 10), 1, 24),
    maxDaysAhead: clamp(parseInt(els.daysAhead.value || "21", 10), 1, 120),
    start: els.startTime.value || "09:30",
    end: els.endTime.value || "17:30",
    interval: clamp(parseInt(els.interval.value || "30", 10), 5, 180),
    perDay: parseInt(els.perDay.value || "0", 10),
    weekdaysOnly: !!els.weekdaysOnly.checked,
    bizFriendly: !!els.bizFriendly.checked,
    morningBias: !!els.morningBias.checked,
    afternoonBias: !!els.afternoonBias.checked,
    blacklist: bl,
  };
}

function generateSlots(cfg) {
  const out = new Set();
  const today = new Date();
  const { h: sh, m: sm } = parseHHMM(cfg.start);
  const { h: eh, m: em } = parseHHMM(cfg.end);
  const openMin = Math.min(sh * 60 + sm, eh * 60 + em),
    closeMin = Math.max(sh * 60 + sm, eh * 60 + em);
  const blacklist = new Set(
    (cfg.blacklist || []).map((s) => s.trim()).filter(Boolean)
  );
  const dayCounts = new Map();
  const keyDay = (dt) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dt);

  let tries = 0,
    maxTries = 6000;
  while (out.size < cfg.count && tries++ < maxTries) {
    let off = rand(1, Math.max(1, cfg.maxDaysAhead));
    let base = addDays(today, off);
    const y = base.getFullYear(),
      m = base.getMonth(),
      d = base.getDate();
    if (cfg.weekdaysOnly && isWeekend(base)) continue;

    const isoDay = `${y.toString().padStart(4, "0")}-${String(m + 1).padStart(
      2,
      "0"
    )}-${String(d).padStart(2, "0")}`;
    if (blacklist.has(isoDay)) continue;

    let minute = rand(openMin, closeMin);
    if (cfg.bizFriendly) {
      const pad = Math.min(60, Math.floor(cfg.interval / 2) + 30);
      minute = clamp(minute, openMin + pad, closeMin - pad);
    }
    if (cfg.morningBias && cfg.afternoonBias) {
      /* cancel */
    } else if (cfg.morningBias) {
      minute = clamp(minute, openMin, Math.floor((openMin + closeMin) / 2));
    } else if (cfg.afternoonBias) {
      minute = clamp(
        minute,
        Math.floor((openMin + closeMin) / 2) + 1,
        closeMin
      );
    }

    const hh = Math.floor(minute / 60),
      mm = minute % 60;
    const dt = snap(toLocalDate(y, m, d, hh, mm), cfg.interval);

    const kd = keyDay(dt),
      cur = dayCounts.get(kd) || 0;
    if (cfg.perDay > 0 && cur >= cfg.perDay) continue;

    const epochMin = Math.floor(dt.getTime() / (60 * 1000));
    if (!out.has(epochMin)) {
      out.add(epochMin);
      dayCounts.set(kd, cur + 1);
    }
  }
  return Array.from(out)
    .map((k) => new Date(k * 60 * 1000))
    .sort((a, b) => a - b);
}

// ===== Email / ICS export =====
function bulletLines(dates) {
  return dates.map((d) => `• ${toETLabel(d)}`);
}
function buildEmail(dates, name, tone) {
  const bullets = bulletLines(dates).join("\n");
  return tone === "warm"
    ? `Hi there!\n\nHere are a few interview times that work for me (America/Toronto):\n\n${bullets}\n\nIf none of these work, I'm happy to suggest alternatives.\n\nThanks so much,\n${
        name || "Candidate"
      }`
    : `Hello,\n\nPlease find a few interview times that work for me (America/Toronto):\n\n${bullets}\n\nIf none of these are suitable, I can propose alternatives.\n\nKind regards,\n${
        name || "Candidate"
      }`;
}
function icsForDates(dates, name) {
  const pad2 = (n) => String(n).padStart(2, "0");
  const toUTC = (d) =>
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(
      d.getUTCDate()
    )}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(
      d.getUTCSeconds()
    )}Z`;
  const now = toUTC(new Date());
  let cal = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Availability Generator//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n`;
  dates.forEach((d, i) => {
    const end = new Date(d.getTime() + 30 * 60 * 1000);
    const uid = `${d.getTime()}-${i}@availability.local`;
    const startLbl = toETLabel(d);
    cal += `BEGIN:VEVENT\nUID:${uid}\nDTSTAMP:${now}\nDTSTART:${toUTC(
      d
    )}\nDTEND:${toUTC(end)}\nSUMMARY:Interview availability hold — ${
      name || "Candidate"
    }\nDESCRIPTION:${startLbl}\nEND:VEVENT\n`;
  });
  cal += `END:VCALENDAR`;
  return cal;
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    ok("Copied ✔");
  } catch {
    warn("Copy failed — select & Ctrl/Cmd+C");
  }
}
function ok(msg) {
  els.status.innerHTML = `<span class="ok">${msg}</span>`;
  setTimeout(() => (els.status.textContent = "Ready 💅"), 2000);
}
function warn(msg) {
  els.status.innerHTML = `<span class="warn">${msg}</span>`;
}
function render(dates) {
  const t = els.slots;
  t.innerHTML = "";
  if (!dates.length) {
    els.copyList.disabled =
      els.copyEmail.disabled =
      els.downloadICS.disabled =
        true;
    els.status.innerHTML =
      '<span class="err">No slots — loosen the settings ✨</span>';
    return;
  }
  const byDay = partitionByDay(dates);
  els.peek.innerHTML = Array.from(byDay.entries())
    .map(([day, arr]) => `<span class="pill">${day} × ${arr.length}</span>`)
    .join(" ");
  const frag = document.createDocumentFragment();
  dates.forEach((d) => {
    const line = toETLabel(d);
    const li = document.createElement("div");
    li.className = "slot";
    const left = document.createElement("div");
    left.className = "row";
    const timeEl = document.createElement("time");
    timeEl.textContent = line;
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = fmtIso.format(d).replace(",", "") + " ET";
    left.appendChild(timeEl);
    left.appendChild(badge);
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Copy";
    btn.addEventListener("click", () => copy(line));
    li.appendChild(left);
    li.appendChild(btn);
    frag.appendChild(li);
  });
  t.appendChild(frag);
  els.copyList.disabled =
    els.copyEmail.disabled =
    els.downloadICS.disabled =
      false;
  ok(`Generated ${dates.length} slot${dates.length > 1 ? "s" : ""} ✨`);
}

// ===== Google Calendar (FreeBusy) =====
const GOOGLE = {
  CLIENT_ID:
    "894100688957-gsurkh6qra5v87ggm7def4511i4hh31d.apps.googleusercontent.com",
  SCOPES: "https://www.googleapis.com/auth/calendar.readonly",
  DISCOVERY_DOC:
    "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
};
let gapiInited = false,
  gisInited = false,
  tokenClient = null,
  accessToken = null;
function setCalStatus(msg, type = "") {
  els.calendarStatus.innerHTML = `<span class="${
    type || "status"
  }">${msg}</span>`;
}
function gapiLoaded() {
  if (!window.gapi) return;
  gapi.load("client", initializeGapiClient);
}
async function initializeGapiClient() {
  try {
    await gapi.client.init({ discoveryDocs: [GOOGLE.DISCOVERY_DOC] });
    gapiInited = true;
    maybeEnableGoogle();
  } catch {
    setCalStatus("Google API init failed", "err");
  }
}
function gisLoaded() {
  if (!window.google?.accounts?.oauth2) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE.CLIENT_ID,
    scope: GOOGLE.SCOPES,
    callback: (resp) => {
      if (resp.error) {
        setCalStatus("Auth error", "err");
        return;
      }
      accessToken = resp.access_token || google.accounts.oauth2.getToken();
      setCalStatus("Google Calendar connected ✔", "ok");
    },
  });
  gisInited = true;
  maybeEnableGoogle();
}
function maybeEnableGoogle() {
  if (gapiInited && gisInited) els.googleAuth.disabled = false;
}
window.addEventListener("DOMContentLoaded", () => {
  gapiLoaded();
  gisLoaded();
});
async function ensureGoogleAuth() {
  if (accessToken) return true;
  return new Promise((resolve) => {
    tokenClient.requestAccessToken({ prompt: "consent" });
    const iv = setInterval(() => {
      if (accessToken) {
        clearInterval(iv);
        resolve(true);
      }
    }, 300);
    setTimeout(() => {
      clearInterval(iv);
      resolve(!!accessToken);
    }, 4000);
  });
}
async function getBusyIntervals_Google(timeMinISO, timeMaxISO) {
  try {
    const resp = await gapi.client.calendar.freebusy.query({
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      items: [{ id: "primary" }],
    });
    const busy = resp.result.calendars.primary.busy || [];
    return busy.map((b) => ({
      start: new Date(b.start),
      end: new Date(b.end),
    }));
  } catch (e) {
    setCalStatus("FreeBusy failed (check OAuth & origins)", "err");
    return [];
  }
}

// ===== ICS import (Apple iCloud / Outlook / any .ics) =====
let icsBusy = [];
function parseICSDate(val) {
  const v = String(val).trim();
  if (/Z$/.test(v)) {
    // UTC
    const y = v.slice(0, 4),
      mo = v.slice(4, 6),
      d = v.slice(6, 8),
      hh = v.slice(9, 11),
      mm = v.slice(11, 13),
      ss = v.slice(13, 15);
    return new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss || 0));
  } else if (/^\d{8}T\d{6}$/.test(v)) {
    // floating local time
    const y = v.slice(0, 4),
      mo = v.slice(4, 6),
      d = v.slice(6, 8),
      hh = v.slice(9, 11),
      mm = v.slice(11, 13),
      ss = v.slice(13, 15);
    const dt = new Date();
    dt.setFullYear(+y, +mo - 1, +d);
    dt.setHours(+hh, +mm, +ss || 0, 0);
    return dt;
  }
  return null;
}
function parseICS(text) {
  const lines = text.replace(/\r\n/g, "\n").split(/\n/);
  const events = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur?.DTSTART && cur?.DTEND) {
        const s = parseICSDate(cur.DTSTART);
        const e = parseICSDate(cur.DTEND);
        if (s && e) events.push({ start: s, end: e });
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const keyPart = line.slice(0, idx);
        const val = line.slice(idx + 1);
        const key = keyPart.split(";")[0];
        if (key === "DTSTART" || key === "DTEND") cur[key] = val;
      }
    }
  }
  return events;
}

// ===== Availability filter =====
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
async function filterByCalendarAvailability(dates) {
  let busy = [];
  if (els.useICS.checked && icsBusy.length) busy = busy.concat(icsBusy);
  if (els.useGoogle.checked) {
    const start = new Date(dates[0].getTime());
    const end = new Date(dates[dates.length - 1].getTime() + 30 * 60 * 1000);
    if (await ensureGoogleAuth()) {
      busy = busy.concat(
        await getBusyIntervals_Google(start.toISOString(), end.toISOString())
      );
    } else {
      setCalStatus("Sign-in required to read Google Calendar.", "warn");
    }
  }
  if (!busy.length) return dates;
  const filtered = dates.filter((d) => {
    const s = d,
      e = new Date(d.getTime() + 30 * 60 * 1000);
    return !busy.some((b) => overlaps(s, e, b.start, b.end));
  });
  setCalStatus(`Filtered to ${filtered.length} free slots ✔`, "ok");
  return filtered;
}

// ===== Events =====
els.chooseICS.addEventListener("click", () => els.icsFile.click());
els.icsFile.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const txt = await file.text();
  icsBusy = parseICS(txt);
  setCalStatus(`Loaded ${icsBusy.length} busy events from .ics ✔`, "ok");
});
els.googleAuth.addEventListener("click", async () => {
  const okk = await ensureGoogleAuth();
  if (okk) setCalStatus("Google Calendar connected ✔", "ok");
});

els.gen.addEventListener("click", async () => {
  const cfg = getCfg();
  let dates = generateSlots(cfg);
  if (
    dates.length &&
    (els.useGoogle.checked || (els.useICS.checked && icsBusy.length))
  ) {
    dates = await filterByCalendarAvailability(dates);
  }
  render(dates);
  const bullets = bulletLines(dates);
  els.copyList.onclick = () => copy(bullets.join("\n"));
  els.copyEmail.onclick = () =>
    copy(buildEmail(dates, els.name.value || "Candidate", els.tone.value));
  els.downloadICS.onclick = () => {
    const ics = icsForDates(dates, els.name.value || "Candidate");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "availability.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };
});

// Help modal
function openHelp() {
  els.helpModal.style.display = "block";
  document.querySelector(".help-dialog").focus();
}
function closeHelp() {
  els.helpModal.style.display = "none";
}
els.helpFab.addEventListener("click", openHelp);
els.helpClose.addEventListener("click", closeHelp);
els.helpModal.addEventListener("click", (e) => {
  if (e.target === els.helpModal) closeHelp();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "?" || (e.shiftKey && e.key === "/")) openHelp();
  if (e.key === "Escape") closeHelp();
});

// Auto-generate on load
window.addEventListener("DOMContentLoaded", () => els.gen.click());
