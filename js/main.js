// main.js - app boot + tools menu + scope sheet + save/delete logic
window.toggleToolsMenu = function toggleToolsMenu() {
  const m = document.getElementById('toolsMenu');
  m.style.display = (m.style.display === 'block') ? 'none' : 'block';
};

window.hideToolsMenu = function hideToolsMenu() {
  document.getElementById('toolsMenu').style.display = 'none';
};

window.pickSeriesScope = function pickSeriesScope(actionLabel) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('scopeSheet');
    const title   = document.getElementById('scopeSheetTitle');
    const btnSingle = document.getElementById('btnScopeSingle');
    const btnFuture = document.getElementById('btnScopeFuture');
    const btnCancel = document.getElementById('btnScopeCancel');

    title.textContent = `繰り返し予定を${actionLabel}`;

    const cleanup = (val) => {
      overlay.style.display = 'none';
      overlay.onclick = null;
      btnSingle.onclick = null;
      btnFuture.onclick = null;
      btnCancel.onclick = null;
      resolve(val);
    };

    overlay.style.display = 'flex';

    overlay.onclick = (e) => { if (e.target === overlay) cleanup('cancel'); };
    btnSingle.onclick = () => cleanup('single');
    btnFuture.onclick = () => cleanup('future');
    btnCancel.onclick = () => cleanup('cancel');
  });
};

window.saveEvent = async function saveEvent() {
  const id = document.getElementById('evtId').value;
  const title = document.getElementById('inpTitle').value.trim();
  if (!title) return alert('タイトルを入力してください');

  const dateStr = document.getElementById('evtDate').value;
  const allDay  = document.getElementById('chkAllDay').checked;

  const repeat   = document.getElementById('selRepeat').value;
  const startVal = allDay ? '' : document.getElementById('inpStart').value;
  const endVal   = allDay ? '' : document.getElementById('inpEnd').value;

  const base = {
    title,
    start: startVal,
    end: endVal,
    loc: document.getElementById('inpLoc').value,
    prio: window.form.prio,
    color: window.form.color,
    icon: window.form.icon,
    allDay,
    repeat
  };

  if (id) {
    const idx = window.state.events.findIndex(e => e.id === id);
    if (idx < 0) return;

    const cur = window.state.events[idx];

    if (cur.seriesId) {
      const scope = await window.pickSeriesScope('変更しますか？');
      if (scope === 'cancel') return;

      if (scope === 'single') {
        window.state.events[idx] = { ...cur, ...base, id, date: dateStr };
      } else {
        const sid = cur.seriesId;
        window.state.events = window.state.events.map(e => {
          if (e.seriesId === sid && e.date >= dateStr) return { ...e, ...base };
          return e;
        });
      }

      window.saveData(); window.closeModal(); window.render();
      return;
    }

    window.state.events[idx] = { ...cur, ...base, id, date: dateStr };
    window.saveData(); window.closeModal(); window.render();
    return;
  }

  if (repeat && repeat !== 'none') {
    const seriesId = window.newId();
    const dates = window.genRepeatDates(dateStr, repeat);
    dates.forEach(ds => {
      window.state.events.push({ id: window.newId(), seriesId, date: ds, ...base });
    });
  } else {
    window.state.events.push({ id: window.newId(), seriesId: '', date: dateStr, ...base });
  }

  window.saveData(); window.closeModal(); window.render();
};

window.delEvent = async function delEvent() {
  const id = document.getElementById('evtId').value;
  const evt = window.state.events.find(e => e.id === id);
  if (!evt) return;

  if (evt.seriesId) {
    const scope = await window.pickSeriesScope('削除しますか？');
    if (scope === 'cancel') return;

    if (scope === 'single') {
      window.state.events = window.state.events.filter(e => e.id !== id);
    } else {
      const sid = evt.seriesId;
      const dateStr = evt.date;
      window.state.events = window.state.events.filter(e => !(e.seriesId === sid && e.date >= dateStr));
    }

    window.saveData(); window.closeModal(); window.render();
    return;
  }

  if (!confirm('削除しますか？')) return;
  window.state.events = window.state.events.filter(e => e.id !== id);
  window.saveData(); window.closeModal(); window.render();
};

document.addEventListener('DOMContentLoaded', () => {
  // main init
  window.loadData();
  window.initEmojis();
  window.initTimePickerDOM();
  window.bindImportInput();
  window.render();
  window.ensureFirebase();


  // tools menu: stop propagation so menu item clicks won't be intercepted by any document-level handlers
  const toolsMenu = document.getElementById('toolsMenu');
  if (toolsMenu) {
    toolsMenu.addEventListener('click', (e) => e.stopPropagation());
    toolsMenu.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  }
  const btnMore = document.getElementById('btnMore');
  if (btnMore) {
    btnMore.addEventListener('click', (e) => e.stopPropagation());
    btnMore.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  }

  // tools menu outside click
  document.addEventListener('click', (e) => {
    const m = document.getElementById('toolsMenu');
    if (!m) return;
    if (m.style.display !== 'block') return;
    if (m.contains(e.target)) return;
    if (e.target.closest('#btnMore')) return;
    window.hideToolsMenu();
  });

  // modal click to close
  const modal = document.getElementById('modal');
  if (modal) {
    modal.onclick = (e) => { if(e.target===modal) window.closeModal(); };
  }

  // search modal click to close
  const searchModal = document.getElementById('searchModal');
  if (searchModal) {
    searchModal.onclick = (e) => { if (e.target === searchModal) window.closeSearch(); };
  }

  // auth modal click to close
  const authModal = document.getElementById('authModal');
  if (authModal) {
    authModal.onclick = (e) => { if (e.target === authModal) window.closeAuth(); };
  }
});

// ===== iOS-style modal: replacements for alert()/confirm() =====
(function () {
  function els() {
    const modal = document.getElementById('iosModal');
    const titleEl = document.getElementById('iosTitle');
    const msgEl = document.getElementById('iosMsg');
    const actionsEl = document.getElementById('iosActions');
    return { modal, titleEl, msgEl, actionsEl };
  }

  function hasContainer() {
    const { modal, titleEl, msgEl, actionsEl } = els();
    return !!(modal && titleEl && msgEl && actionsEl);
  }

  function show({ title = '', message = '', buttons = [] }) {
    return new Promise((resolve) => {
      const { modal, titleEl, msgEl, actionsEl } = els();

      // If container is missing (e.g., scripts loaded before modal DOM),
      // do NOT auto-confirm. Fall back to native dialogs.
      if (!modal || !titleEl || !msgEl || !actionsEl) {
        if (buttons.length >= 2) {
          resolve(confirm(message));
        } else {
          alert(message);
          resolve(true);
        }
        return;
      }

      titleEl.textContent = title || '';
      titleEl.style.display = title ? 'block' : 'none';
      msgEl.textContent = message || '';
      actionsEl.innerHTML = '';

      buttons.forEach((b) => {
        const btn = document.createElement('button');
        btn.className = `ios-btn ${b.className || ''}`.trim();
        btn.textContent = b.text || 'OK';
        btn.addEventListener('click', () => {
          modal.style.display = 'none';
          resolve(b.value);
        });
        actionsEl.appendChild(btn);
      });

      // Default single OK button
      if (!buttons.length) {
        const btn = document.createElement('button');
        btn.className = 'ios-btn bold';
        btn.textContent = '好';
        btn.addEventListener('click', () => {
          modal.style.display = 'none';
          resolve(true);
        });
        actionsEl.appendChild(btn);
      }

      modal.style.display = 'block';
    });
  }

  window.iosAlert = function iosAlert(message, title = '提示', okText = '好') {
    return show({
      title,
      message,
      buttons: [{ text: okText, value: true, className: 'bold' }]
    });
  };

  window.iosConfirm = function iosConfirm(message, title = '确认', okText = '确定', cancelText = '取消') {
    return show({
      title,
      message,
      buttons: [
        { text: cancelText, value: false },
        { text: okText, value: true, className: 'bold' }
      ]
    });
  };

  // UI helpers: prefer iOS-style modal, fallback to native alert/confirm
  window.uiAlert = async function uiAlert(message, title = '提示', okText = '好') {
    if (window.iosAlert && hasContainer()) return window.iosAlert(message, title, okText);
    alert(message);
    return true;
  };

  window.uiConfirm = async function uiConfirm(message, title = '确认', okText = '确定', cancelText = '取消') {
    if (window.iosConfirm && hasContainer()) return window.iosConfirm(message, title, okText, cancelText);
    return confirm(message);
  };
})();;
