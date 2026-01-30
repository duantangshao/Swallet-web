// calendar.js - calendar render & navigation & sidebar
window.getWeekStart = function getWeekStart(d) {
  const t = new Date(d);
  const day = t.getDay();
  const diff = t.getDate() - day;
  return new Date(t.setDate(diff));
};

window.getDaysArray = function getDaysArray() {
  const res = [];
  const y = window.state.date.getFullYear(), m = window.state.date.getMonth();
  if(window.state.view==='month') {
    const first = new Date(y, m, 1).getDay();
    const count = new Date(y, m+1, 0).getDate();
    for(let i=0; i<first; i++) res.push({date:new Date(y, m, -first+i+1)});
    for(let i=1; i<=count; i++) res.push({date:new Date(y, m, i)});
    while(res.length<35) res.push({date:new Date(y,m,res.length-first+1)});
  } else {
    const s = window.getWeekStart(window.state.date);
    for(let i=0; i<7; i++) {
      const t = new Date(s); t.setDate(s.getDate()+i);
      res.push({date:t});
    }
  }
  return res;
};

window.renderSidebar = function renderSidebar() {
  const uBox = document.getElementById('listUrgent');
  const iBox = document.getElementById('listImp');
  const tBox = document.getElementById('listToday');
  if (!uBox || !iBox || !tBox) return;

  uBox.innerHTML = '';
  iBox.innerHTML = '';
  tBox.innerHTML = '';

  const isMobile = window.matchMedia('(max-width: 900px)').matches;

  let startStr, endStr;
  if (window.state.view === 'month') {
    const y = window.state.date.getFullYear();
    const m = window.state.date.getMonth();
    startStr = window.fmtLocal(new Date(y, m, 1));
    endStr   = window.fmtLocal(new Date(y, m + 1, 0));
  } else {
    const wStart = window.getWeekStart(window.state.date);
    const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate() + 6);
    startStr = window.fmtLocal(wStart);
    endStr   = window.fmtLocal(wEnd);
  }

  const todayStr = window.fmtLocal(new Date());

  function renderEmpty(box, text) {
    box.innerHTML = `
      <div class="side-card" style="
        opacity:0.45;
        text-align:center;
        font-size:0.78rem;
        font-weight:600;
        color:#999;
        padding:14px 10px;
      ">${text}</div>
    `;
  }

  function renderCards(box, events, mode) {
    events.forEach(e => {
      const card = document.createElement('div');
      card.className = 'side-card';
      card.onclick = () => window.openModal(e, e.date);

      if (mode === 'today') {
        card.innerHTML = `
          <div class="sc-row">
            <div class="sc-title">${e.icon !== '🚫' ? e.icon : ''} ${e.title}</div>
            ${(!e.allDay && e.start) ? `<div class="sc-time">${e.start}</div>` : ''}
          </div>
          <div class="sc-date">${e.loc ? ' @ ' + e.loc : ''}</div>
        `;
      } else {
        const dayName = ['日','月','火','水','木','金','土'][new Date(e.date).getDay()];
        card.innerHTML = `
          <div class="sc-row">
            <div class="sc-title">${e.icon !== '🚫' ? e.icon : ''} ${e.title}</div>
            ${(!e.allDay && e.start) ? `<div class="sc-time">${e.start}</div>` : ''}
          </div>
          <div class="sc-date">${e.date} (${dayName}) ${e.loc ? ' @ '+e.loc : ''}</div>
        `;
      }
      box.appendChild(card);
    });
  }

  function buildToday() {
    const todayEvents = window.state.events
      .filter(e => e.date === todayStr && e.prio !== 'done')
      .sort((a,b) =>
        ((a.allDay?'00:00':(a.start||''))).localeCompare((b.allDay?'00:00':(b.start||'')))
      );
    if (!todayEvents.length) renderEmpty(tBox, '今日予定なし');
    else renderCards(tBox, todayEvents, 'today');
  }

  function buildPrio() {
    const prioEvents = window.state.events
      .filter(e => {
        const inRange = e.date >= startStr && e.date <= endStr;
        const isPrio  = e.prio === 'urgent' || e.prio === 'imp';
        const notDone = e.prio !== 'done' && e.date >= todayStr;
        return inRange && isPrio && notDone;
      })
      .sort((a,b) =>
        a.date.localeCompare(b.date) ||
        ((a.allDay?'00:00':(a.start||''))).localeCompare((b.allDay?'00:00':(b.start||'')))
      );

    const urg = prioEvents.filter(e => e.prio === 'urgent');
    const imp = prioEvents.filter(e => e.prio === 'imp');

    if (!urg.length) renderEmpty(uBox, '予定なし');
    else renderCards(uBox, urg, 'prio');

    if (!imp.length) renderEmpty(iBox, '予定なし');
    else renderCards(iBox, imp, 'prio');
  }

  if (isMobile) { buildToday(); buildPrio(); }
  else { buildPrio(); buildToday(); }
};

window.render = function render() {
  const y = window.state.date.getFullYear();
  const m = window.state.date.getMonth();
  const calBody = document.getElementById('calBody');
  const todayStr = window.fmtLocal(new Date());

  if (window.state.view === 'month') {
    document.getElementById('headerTitle').textContent = `${y}年 ${m+1}月`;
    calBody.classList.remove('week-mode');
  } else {
    const start = window.getWeekStart(window.state.date);
    document.getElementById('headerTitle').textContent = `${start.getMonth()+1}月 第${Math.ceil(start.getDate()/7)}週`;
    calBody.classList.add('week-mode');
  }

  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const days = window.getDaysArray();

  days.forEach(d => {
    const dStr = window.fmtLocal(d.date);
    const isToday = dStr === todayStr;
    const isOther = d.date.getMonth() !== m && window.state.view === 'month';
    const isPast = dStr < todayStr;

    const cell = document.createElement('div');
    cell.className = `day-cell ${isToday?'today':''} ${isPast?'past-day':''}`;
    if(isOther) cell.style.opacity = '0.5';

    let dateHTML = d.date.getDate();
    if(window.state.view === 'week') {
      const dayName = ['日','月','火','水','木','金','土'][d.date.getDay()];
      dateHTML = `${d.date.getMonth()+1}/${d.date.getDate()} ${dayName}`;
    }

    cell.innerHTML = `<div class="day-header"><div class="date-num">${dateHTML}</div></div>`;
    const cont = document.createElement('div');
    cont.className = 'events-container';

    const dayEvts = window.state.events
      .filter(e => e.date === dStr)
      .sort((a,b) => {
        const aKey = a.allDay ? '00:00' : (a.start || '23:59');
        const bKey = b.allDay ? '00:00' : (b.start || '23:59');
        return aKey.localeCompare(bKey);
      });

    dayEvts.forEach(e => {
      const el = document.createElement('div');
      const isDone = isPast || e.prio === 'done';

      el.className = `event-chip ${e.color} ${isDone ? 'is-done' : ''}`;
      el.draggable = true;

      const timeLabel = e.allDay ? '' : (e.start || '');
      el.innerHTML = `${e.icon!=='🚫'?e.icon:''} <strong>${timeLabel}</strong> <span class="evt-title">${e.title}</span>`;

      el.ondragstart = (ev) => {
        window.dragSrc = e.id;
        window.dragCopy = !!(ev.ctrlKey || ev.metaKey);
        ev.dataTransfer.effectAllowed = window.dragCopy ? 'copy' : 'move';
        try { ev.dataTransfer.setData('text/plain', e.id); } catch(_) {}
        el.style.opacity = 0.5;
      };
      el.ondragend = () => { el.style.opacity = 1; window.dragCopy = false; };

      el.onclick = (ev) => { ev.stopPropagation(); window.openModal(e, dStr); };
      el.onmouseenter = (ev) => window.showTip(ev, e);
      el.onmouseleave = window.hideTip;

      cont.appendChild(el);
    });

    cell.ondragover = e => { e.preventDefault(); cell.style.background = '#F0F8FF'; };
    cell.ondragleave = () => cell.style.background = '';
    cell.ondrop = e => {
      e.preventDefault(); cell.style.background = '';
      if(window.dragSrc) {
        const evt = window.state.events.find(x=>x.id===window.dragSrc);
        if(evt) {
          if (window.dragCopy) {
            const cloned = { ...evt, id: window.newId(), date: dStr, seriesId: '' };
            window.state.events.push(cloned);
          } else {
            evt.date = dStr;
          }
          window.saveData(); window.render();
        }
        window.dragSrc = null;
        window.dragCopy = false;
      }
    };

    cell.onclick = (e) => {
      if(e.target===cell || e.target.classList.contains('events-container') || e.target.classList.contains('day-header'))
        window.openModal(null, dStr);
    };

    cell.appendChild(cont);
    grid.appendChild(cell);
  });

  window.renderSidebar();
};

window.nav = function nav(d) {
  if(window.state.view==='month') window.state.date.setMonth(window.state.date.getMonth()+d);
  else window.state.date.setDate(window.state.date.getDate()+(d*7));
  window.render();
};

window.setView = function setView(v) {
  window.state.view = v;
  document.getElementById('btnMonth').className = v==='month'?'view-btn active':'view-btn';
  document.getElementById('btnWeek').className = v==='week'?'view-btn active':'view-btn';
  window.render();
};
