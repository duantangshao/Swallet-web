// storage.js - local persistence + backup/import (JASO)
window.loadData = function loadData() {
  const raw = localStorage.getItem(window.STORAGE_KEY);
  if (raw) {
    try { window.state.events = JSON.parse(raw); } catch (e) { console.error(e); }
  }
};

window.saveData = function saveData() {
  localStorage.setItem(window.STORAGE_KEY, JSON.stringify(window.state.events));
};

window.backupJASO = function backupJASO() {
  const payload = {
    format: "smart_calendar_backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    storageKey: window.STORAGE_KEY,
    events: window.state.events
  };
  const txt = JSON.stringify(payload, null, 2);
  const blob = new Blob([txt], { type: "application/json" });

  const y = new Date();
  const name = `calendar_backup_${y.getFullYear()}${String(y.getMonth()+1).padStart(2,'0')}${String(y.getDate()).padStart(2,'0')}.jaso`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
};

window.triggerImportJASO = function triggerImportJASO() {
  document.getElementById('inpJasoFile').click();
};

window.bindImportInput = function bindImportInput() {
  const inp = document.getElementById('inpJasoFile');
  if (!inp) return;
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);

      let events = null;
      if (Array.isArray(data)) events = data;
      else if (data && Array.isArray(data.events)) events = data.events;

      if (!events) throw new Error("Invalid jaso format");

      const cleaned = events.map(e => ({
        id: (e.id || window.newId()).toString(),
        seriesId: (e.seriesId || '').toString(),
        date: (e.date || window.fmtLocal(new Date())).toString(),
        title: (e.title || '').toString(),
        start: (e.start || '').toString(),
        end: (e.end || '').toString(),
        loc: (e.loc || '').toString(),
        prio: (e.prio || 'norm').toString(),
        color: (e.color || 'bg-blue').toString(),
        icon: (e.icon || '🚫').toString(),
        allDay: !!e.allDay,
        repeat: (e.repeat || 'none').toString()
      }));

      window.state.events = cleaned;
      window.saveData();
      window.render();
      alert('インポート完了しました');
    } catch (err) {
      console.error(err);
      alert('インポート失敗：ファイル形式が正しくありません');
    } finally {
      inp.value = '';
    }
  });
};
