// state.js - shared state & constants (non-module script)
window.state = { view: 'month', date: new Date(), events: [] };
window.STORAGE_KEY = 'smart_calendar_data_v1';

window.emojiList = [
  '💼','🧑‍💻','👩‍💻','👨‍💻','🗂️','📁','🗄️','🗃️','📝','📌','📍','📎','🧾',
  '📊','📈','📉','🧮','🧠','🔬','🔭','🗓️','📆','⏱️','⏰',
  '📞','🎧','🎤','📹','🖥️','⌨️','🖱️','🖨️','🌐','🔒','🛡️','🔑','⚙️','🧰','🔧','🪛',
  '🤝','👥','🏢','🏦','✅','☑️','❗','⚠️','🔥','⭐️',
  '🚫','📅','🕒','✉️','🏠','☕','🍽️','🏃','✈️','🚗','💰','🎉','📚','🎓','🎨','🎵','🎬','🎮','📷','🐶','🐱'
];

window.form = { prio: 'norm', color: 'bg-blue', icon: '🚫' };

window.dragSrc = null;
window.dragCopy = false;

window.pickerTargetInput = null;
window.pickerTargetBtn = null;

// Firebase handles
window.fbApp = null;
window.fbAuth = null;
window.fbDb = null;
