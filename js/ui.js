// ui.js - modal, form, tooltip, search UI
window.initEmojis = function initEmojis() {
  const c = document.getElementById('emojiContainer');
  if (!c) return;
  c.innerHTML = '';
  window.emojiList.forEach(em => {
    const d = document.createElement('div');
    d.className = 'emoji-item'; d.textContent = em;
    d.onclick = () => { window.form.icon = em; window.updateFormUI(); };
    c.appendChild(d);
  });
};

window.updateFormUI = function updateFormUI() {
  ['urgent','imp','norm','done'].forEach(k => {
    const el = document.getElementById('po-'+k);
    if (!el) return;
    el.className = 'prio-opt ' + (window.form.prio === k ? `selected p-${k}` : '');
  });

  ['bg-blue','bg-green','bg-orange','bg-red','bg-purple','bg-gray'].forEach(k => {
    const short = k.replace('bg-','co-');
    const el = document.getElementById(short);
    if (!el) return;
    el.className = `c-circle ${k} ` + (window.form.color === k ? 'selected' : '');
  });

  document.querySelectorAll('.emoji-item').forEach(e => {
    e.className = 'emoji-item ' + (e.textContent === window.form.icon ? 'selected' : '');
  });
};

window.setFormPrio = function setFormPrio(p) { window.form.prio = p; window.updateFormUI(); };
window.setFormColor = function setFormColor(c) { window.form.color = c; window.updateFormUI(); };

window.toggleAllDayUI = function toggleAllDayUI() {
  const on = document.getElementById('chkAllDay').checked;
  document.getElementById('grpStart').style.display = on ? 'none' : 'block';
  document.getElementById('grpEnd').style.display = on ? 'none' : 'block';

  if (on) {
    document.getElementById('inpStart').value = '';
    document.getElementById('inpEnd').value = '';
    document.getElementById('btnStartDisp').innerText = '--:--';
    document.getElementById('btnEndDisp').innerText = '--:--';
  } else {
    if (!document.getElementById('inpStart').value) {
      document.getElementById('inpStart').value = '09:00';
      document.getElementById('btnStartDisp').innerText = '09:00';
    }
    if (!document.getElementById('inpEnd').value) {
      document.getElementById('inpEnd').value = '10:00';
      document.getElementById('btnEndDisp').innerText = '10:00';
    }
  }
};

window.onRepeatChange = function onRepeatChange() {
  const v = document.getElementById('selRepeat').value;
  document.getElementById('repeatHint').style.display = (v !== 'none') ? 'block' : 'none';
};

// Modal
window.modalEl = null;

window.openModal = function openModal(evt, dStr) {
  if (!window.modalEl) window.modalEl = document.getElementById('modal');
  const modal = window.modalEl;

  const isEdit = !!evt;
  document.getElementById('evtId').value = isEdit ? evt.id : '';
  document.getElementById('evtDate').value = dStr;
  document.getElementById('modalTitle').textContent = isEdit ? '予定の編集' : '新しい予定';
  document.getElementById('btnDel').style.display = isEdit ? 'block' : 'none';

  document.getElementById('inpTitle').value = isEdit ? evt.title : '';
  document.getElementById('inpLoc').value = isEdit ? evt.loc : '';

  const isAllDay = isEdit ? !!evt.allDay : false;
  document.getElementById('chkAllDay').checked = isAllDay;

  const tStart = isEdit ? (evt.start || '09:00') : '09:00';
  const tEnd = isEdit ? (evt.end || '10:00') : '10:00';

  document.getElementById('inpStart').value = isAllDay ? '' : tStart;
  document.getElementById('btnStartDisp').innerText = isAllDay ? '--:--' : tStart;

  document.getElementById('inpEnd').value = isAllDay ? '' : tEnd;
  document.getElementById('btnEndDisp').innerText = isAllDay ? '--:--' : tEnd;

  document.getElementById('selRepeat').value = isEdit ? (evt.repeat || 'none') : 'none';
  window.onRepeatChange();

  window.form.prio = isEdit ? evt.prio : 'norm';
  window.form.color = isEdit ? evt.color : 'bg-blue';
  window.form.icon = isEdit ? evt.icon : '🚫';

  window.updateFormUI();
  modal.style.display = 'flex';
  window.toggleAllDayUI();

  const inner = modal.querySelector('.modal-inner');
  if (inner) inner.scrollTop = 0;

  setTimeout(() => document.getElementById('inpTitle').focus(), 50);
};

window.closeModal = function closeModal() {
  const modal = document.getElementById('modal');
  modal.style.display = 'none';
};

// Tooltip
window.tipEl = null;

window.showTip = function showTip(ev, e) {
  if (!window.tipEl) window.tipEl = document.getElementById('tooltip');
  const tip = window.tipEl;
  const r = ev.target.getBoundingClientRect();
  const tLine = e.allDay ? '終日' : `${e.start||'--'} ~ ${e.end||'--'}`;
  tip.innerHTML = `<h4>${e.icon!=='🚫'?e.icon:''} ${e.title}</h4><p><strong>時間:</strong> ${tLine}</p>${e.loc ? `<p><strong>場所:</strong> ${e.loc}</p>` : ''}`;

  tip.style.display = 'block';
  const tipH = tip.offsetHeight;
  const winH = window.innerHeight;
  let top = r.bottom + 8;
  let left = r.left;
  if (top + tipH > winH - 10) top = r.top - tipH - 8;
  if (left + 180 > window.innerWidth) left = window.innerWidth - 190;
  tip.style.top = top + 'px';
  tip.style.left = left + 'px';
};

window.hideTip = function hideTip() {
  const tip = document.getElementById('tooltip');
  tip.style.display = 'none';
};

// Search modal
window.openSearch = function openSearch() {
  const searchModal = document.getElementById('searchModal');
  searchModal.style.display = 'flex';
  const q = document.getElementById('searchQuery');
  q.value = '';
  setTimeout(() => q.focus(), 50);
  window.renderSearchResults();
};

window.closeSearch = function closeSearch() {
  document.getElementById('searchModal').style.display = 'none';
};

window.renderSearchResults = function renderSearchResults() {
  const box = document.getElementById('searchResults');
  const q = (document.getElementById('searchQuery').value || '').trim().toLowerCase();
  box.innerHTML = '';

  const items = [...window.state.events]
    .filter(e => {
      if (!q) return true;
      const t = (e.title || '').toLowerCase();
      const l = (e.loc || '').toLowerCase();
      return t.includes(q) || l.includes(q);
    })
    .sort((a,b) =>
      a.date.localeCompare(b.date) ||
      ((a.allDay?'00:00':(a.start||'23:59'))).localeCompare((b.allDay?'00:00':(b.start||'23:59')))
    )
    .slice(0, 150);

  if (items.length === 0) {
    box.innerHTML = `<div style="text-align:center; color:#ccc; font-size:0.85rem; padding:12px;">なし</div>`;
    return;
  }

  items.forEach(e => {
    const card = document.createElement('div');
    card.className = 'side-card';
    const dayName = ['日','月','火','水','木','金','土'][new Date(e.date).getDay()];
    const tLine = e.allDay ? '終日' : (e.start ? e.start : '');

    card.innerHTML = `
      <div class="sc-row">
        <div class="sc-title">${e.icon!=='🚫'?e.icon:''} ${e.title}</div>
        ${tLine ? `<div class="sc-time">${tLine}</div>` : ''}
      </div>
      <div class="sc-date">${e.date} (${dayName}) ${e.loc ? ' @ '+e.loc : ''}</div>
    `;
    card.onclick = () => { window.closeSearch(); window.openModal(e, e.date); };
    box.appendChild(card);
  });
};
