// utils.js - helpers
window.fmtLocal = function fmtLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

window.newId = function newId() {
  return Date.now().toString() + Math.random().toString(16).slice(2);
};

window.parseDateStr = function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

window.toDateStr = function toDateStr(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// repeat dates for 1 year
window.genRepeatDates = function genRepeatDates(startDateStr, repeatType) {
  const start = window.parseDateStr(startDateStr);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);

  const dates = [];
  let cur = new Date(start);

  while (cur <= end) {
    dates.push(window.toDateStr(cur));
    if (repeatType === 'weekly') cur.setDate(cur.getDate() + 7);
    else if (repeatType === 'monthly') cur.setMonth(cur.getMonth() + 1);
    else if (repeatType === 'yearly') cur.setFullYear(cur.getFullYear() + 1);
    else break;
  }
  return dates;
};

window.isMobileEnv = function isMobileEnv() {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
};
