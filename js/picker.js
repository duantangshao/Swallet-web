// picker.js - iOS style time picker
// FIX v3: dynamic spacer height so 00/59 can be perfectly centered under highlight on any device/zoom.
// Also reads selected value by geometry (nearest to wheel center).

(function () {
  function mkSpacer(hPx) {
    const s = document.createElement('div');
    s.className = 'picker-spacer';
    if (typeof hPx === 'number' && isFinite(hPx)) s.style.height = `${Math.max(0, hPx)}px`;
    return s;
  }

  function buildWheel(col, max) {
    if (!col) return;

    col.innerHTML = '';

    // We'll insert placeholders; spacer heights will be recalculated after layout.
    const top1 = mkSpacer(40);
    const top2 = mkSpacer(40);
    col.appendChild(top1);
    col.appendChild(top2);

    for (let i = 0; i < max; i++) {
      const div = document.createElement('div');
      div.className = 'picker-item';
      div.innerText = String(i).padStart(2, '0');
      div.dataset.val = String(i);
      col.appendChild(div);
    }

    const bot1 = mkSpacer(40);
    const bot2 = mkSpacer(40);
    col.appendChild(bot1);
    col.appendChild(bot2);

    // Tag spacers so we can tune them later
    top1.dataset.spacer = 'top1';
    top2.dataset.spacer = 'top2';
    bot1.dataset.spacer = 'bot1';
    bot2.dataset.spacer = 'bot2';
  }

  function wheelCenterY(col) {
    const r = col.getBoundingClientRect();
    return r.top + r.height / 2;
  }

  function pickNearestValue(col) {
    const center = wheelCenterY(col);
    const items = Array.from(col.querySelectorAll('.picker-item'));
    if (!items.length) return 0;

    let best = items[0];
    let bestDist = Infinity;

    for (const it of items) {
      const ir = it.getBoundingClientRect();
      const itCenter = ir.top + ir.height / 2;
      const dist = Math.abs(itCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = it;
      }
    }
    return Number(best.dataset.val || '0');
  }

  function updateActive(col) {
    const center = wheelCenterY(col);
    const items = Array.from(col.querySelectorAll('.picker-item'));
    if (!items.length) return;

    let bestIdx = 0;
    let bestDist = Infinity;

    items.forEach((it, idx) => {
      const ir = it.getBoundingClientRect();
      const itCenter = ir.top + ir.height / 2;
      const dist = Math.abs(itCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });

    items.forEach((it, idx) => it.classList.toggle('active', idx === bestIdx));
  }

  function tuneSpacers(col) {
    // Goal: allow first/last item center to align with wheel center.
    // Required paddingTop = colHeight/2 - itemHeight/2 (same for bottom).
    const items = col.querySelectorAll('.picker-item');
    if (!items.length) return;

    const itemH = items[0].offsetHeight || 40;
    const colH = col.clientHeight || 220;

    const needed = Math.max(0, colH / 2 - itemH / 2);

    const top1 = col.querySelector('[data-spacer="top1"]');
    const top2 = col.querySelector('[data-spacer="top2"]');
    const bot1 = col.querySelector('[data-spacer="bot1"]');
    const bot2 = col.querySelector('[data-spacer="bot2"]');

    // Split across two spacers to keep existing structure.
    const half = needed / 2;

    if (top1) top1.style.height = `${half}px`;
    if (top2) top2.style.height = `${needed - half}px`;
    if (bot1) bot1.style.height = `${half}px`;
    if (bot2) bot2.style.height = `${needed - half}px`;
  }

  function scrollToValue(col, v) {
    const items = Array.from(col.querySelectorAll('.picker-item'));
    const target = items.find(it => Number(it.dataset.val) === Number(v)) || items[0];
    if (!target) return;

    const colH = col.clientHeight;
    const itemH = target.offsetHeight || 40;

    // Align target's center to column center
    const desiredTop = target.offsetTop - (colH / 2 - itemH / 2);
    col.scrollTop = desiredTop;
  }

  window.initTimePickerDOM = function initTimePickerDOM() {
    const colH = document.getElementById('colHour');
    const colM = document.getElementById('colMin');
    if (!colH || !colM) return;

    buildWheel(colH, 24);
    buildWheel(colM, 60);

    // After layout, tune spacer heights so edges can center correctly (fix 00/59 misalignment)
    setTimeout(() => {
      tuneSpacers(colH);
      tuneSpacers(colM);
      updateActive(colH);
      updateActive(colM);
    }, 0);

    [colH, colM].forEach(col => {
      col.addEventListener('scroll', () => updateActive(col), { passive: true });
    });
  };

  window.openTimePicker = function openTimePicker(inputId, btnId) {
    if (document.getElementById('chkAllDay')?.checked) return;

    window.pickerTargetInput = inputId;
    window.pickerTargetBtn = btnId;

    const currentVal = document.getElementById(inputId).value || '09:00';
    const [h, m] = currentVal.split(':').map(n => Number(n || 0));

    const overlay = document.getElementById('timePickerOverlay');
    overlay.style.display = 'flex';

    setTimeout(() => {
      const colHour = document.getElementById('colHour');
      const colMin  = document.getElementById('colMin');

      // Ensure spacer tuning runs with final overlay layout (mobile Safari can change sizes after display:flex)
      tuneSpacers(colHour);
      tuneSpacers(colMin);

      scrollToValue(colHour, Math.max(0, Math.min(23, h)));
      scrollToValue(colMin,  Math.max(0, Math.min(59, m)));

      updateActive(colHour);
      updateActive(colMin);
    }, 30);
  };

  window.closeTimePicker = function closeTimePicker(save) {
    if (save && window.pickerTargetInput) {
      const colH = document.getElementById('colHour');
      const colM = document.getElementById('colMin');

      const h = Math.min(23, Math.max(0, pickNearestValue(colH)));
      const m = Math.min(59, Math.max(0, pickNearestValue(colM)));

      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      document.getElementById(window.pickerTargetInput).value = timeStr;
      document.getElementById(window.pickerTargetBtn).innerText = timeStr;

      if (window.pickerTargetInput === 'inpStart') {
        const endInp = document.getElementById('inpEnd');
        const endBtn = document.getElementById('btnEndDisp');

        let nextH = h + 1;
        if (nextH > 23) nextH = 0;

        const endStr = `${String(nextH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        endInp.value = endStr;
        endBtn.innerText = endStr;
      }
    }

    document.getElementById('timePickerOverlay').style.display = 'none';
    window.pickerTargetInput = null;
    window.pickerTargetBtn = null;
  };
})();
