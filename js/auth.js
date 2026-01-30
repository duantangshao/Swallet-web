// auth.js - Firebase init/auth + cloud backup/restore
// FIXES:
// 1) Mobile Google login redirect/persistence (LOCAL persistence + robust redirect result handling)
// 2) Cloud Restore "offline" on first try (auth/firestore warm-up + retry + friendly guard)
// 3) Prevent accidental overwrite when you only want to restore (backup shows local/cloud diff + confirm)
// 4) Always show success/failure toast via uiAlert (fallback to native alert)

(function () {
  function hasIOSDialogs() {
    return typeof window.iosAlert === 'function' && typeof window.iosConfirm === 'function';
  }
  window.uiAlert = async function uiAlert(message, title) {
    if (hasIOSDialogs()) return window.iosAlert(String(message || ''), title || '提示');
    alert(String(message || ''));
    return true;
  };
  window.uiConfirm = async function uiConfirm(message, title, okText, cancelText) {
    if (hasIOSDialogs()) return window.iosConfirm(String(message || ''), title || '确认', okText || '确定', cancelText || '取消');
    return confirm(String(message || ''));
  };
})();

window.openAuth = function openAuth() {
  const authModal = document.getElementById('authModal');
  authModal.style.display = 'flex';
  setTimeout(() => document.getElementById('authEmail')?.focus(), 50);
};

window.closeAuth = function closeAuth() {
  document.getElementById('authModal').style.display = 'none';
};

window.setAuthStatus = function setAuthStatus(msg, isErr=false) {
  const el = document.getElementById('authStatus');
  if (!el) return;
  el.style.color = isErr ? '#FF3B30' : '#666';
  el.textContent = msg || '';
};

window.ensureFirebase = function ensureFirebase() {
  if (!window.firebase || !firebase.initializeApp) return false;
  if (window.fbApp && window.fbAuth && window.fbDb) return true;

  const firebaseConfig = {
    apiKey: "AIzaSyC27rM6oVGFmc6lb7l2glJaC2rRVZ2h-nw",
    authDomain: "scalcader-swallet.firebaseapp.com",
    projectId: "scalcader-swallet",
    storageBucket: "scalcader-swallet.firebasestorage.app",
    messagingSenderId: "256672414065",
    appId: "1:256672414065:web:0ec5b87ee6cce1faa81ed0",
    measurementId: "G-1MDQ8WBG0X"
  };

  if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    window.updateAuthUI(null, true);
    return false;
  }

  try {
    window.fbApp = firebase.apps?.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
    window.fbAuth = firebase.auth();
    window.fbDb = firebase.firestore();

    // --- Firestore transport hardening (must run BEFORE any Firestore calls) ---
    // Desktop home Wi‑Fi can still have flaky HTTP/2/WebChannel; let SDK auto-detect long polling.
    // NOTE: settings() only works before Firestore is started; call immediately after firestore() and only once.
    try {
      if (!window.__firestoreSettingsApplied && window.fbDb && typeof window.fbDb.settings === 'function') {
        window.fbDb.settings({ experimentalAutoDetectLongPolling: true });
        window.__firestoreSettingsApplied = true;
      }
    } catch (e) {
      // If Firestore already started, settings can't be changed. That's OK.
      console.warn('Firestore settings skipped:', e);
    }
    // ---------------------------------------------------------------

    // --- Firestore network compatibility (fix "client is offline" behind proxies/iOS) ---
    // Force long-polling when WebChannel/WebSocket is blocked (common on some mobile networks / corporate Wi‑Fi)
    try {
      if (window.fbDb && typeof window.fbDb.settings === 'function') {
        window.fbDb.settings({
          experimentalAutoDetectLongPolling: true,
          useFetchStreams: false
        });
      }
    } catch (e) {
      console.warn('Firestore settings() failed:', e);
    }
    // ------------------------------------------------------------------------------

    // --- IMPORTANT: persist auth session (mobile Safari / in-app browsers) ---
    try {
      if (window.fbAuth.setPersistence && firebase.auth?.Auth?.Persistence) {
        window.fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});
      }
    } catch (_) {}
    // -------------------------------------------------------------

    window.fbAuth.onAuthStateChanged((user) => window.updateAuthUI(user));

    // Only call redirect result on supported protocols (file:// will throw)
    const p = location.protocol;
    if (p === 'http:' || p === 'https:' || p === 'chrome-extension:') {
      window.fbAuth.getRedirectResult()
        .then((res) => {
          // Some mobile browsers need explicit result handling to finalize state
          if (res && res.user) {
            try { window.updateAuthUI(res.user); } catch (_) {}
            try { window.setAuthStatus('登录成功'); } catch (_) {}
            try { window.closeAuth && window.closeAuth(); } catch (_) {}
          }
        })
        .catch(console.error);
    }

    return true;
  } catch (e) {
    console.error(e);
    window.updateAuthUI(null, true);
    return false;
  }
};

window.updateAuthUI = function updateAuthUI(user, configMissing=false) {
  const line = document.getElementById('authUserLine');
  const btn = document.getElementById('btnLogout');
  const menuLogin = document.getElementById('btnLoginMenu');
  const menuLogout = document.getElementById('btnLogoutMenu');
  const hint = document.getElementById('authHintLine');

  if (configMissing) {
    if (hint) hint.textContent = 'Firebase 未配置（无法登录/云端备份）';
    if (menuLogin) menuLogin.style.display = 'block';
    if (menuLogout) menuLogout.style.display = 'none';
    if (btn) btn.style.display = 'none';
    if (line) line.textContent = '未登录';
    return;
  }

  if (user) {
    const name = user.displayName || '';
    const email = user.email || '';
    if (line) line.textContent = `已登录：${name ? name + ' / ' : ''}${email}`;

    if (btn) btn.style.display = 'inline-block';
    if (menuLogin) menuLogin.style.display = 'none';
    if (menuLogout) menuLogout.style.display = 'block';

    const isPasswordUser = user.providerData?.some(p => p.providerId === 'password');
    if (hint) {
      if (isPasswordUser && !user.emailVerified) hint.textContent = `已登录但邮箱未验证 ⚠️（云端备份/恢复将受限）`;
      else hint.textContent = `Cloud ready ✅（${email || 'user'}）`;
    }
    window.setAuthStatus('');
  } else {
    if (line) line.textContent = '未登录';
    if (btn) btn.style.display = 'none';
    if (menuLogin) menuLogin.style.display = 'block';
    if (menuLogout) menuLogout.style.display = 'none';
    if (hint) hint.textContent = '未登录（云端备份需登录）';
  }
};

window.authGoogle = async function authGoogle() {
  if (!window.ensureFirebase()) return window.uiAlert('Firebase 未配置：请先填 firebaseConfig');
  window.setAuthStatus('登录中...');

  try {
    const provider = new firebase.auth.GoogleAuthProvider();

    // Prefer popup; fallback to redirect if blocked/unsupported
    try {
      await window.fbAuth.signInWithPopup(provider);
      window.setAuthStatus('登录成功');
      window.closeAuth();
      return;
    } catch (e) {
      const msg = String(e?.message || e || '');
      if (/popup|blocked|cancelled|unsupported|operation-not-supported/i.test(msg)) {
        await window.fbAuth.signInWithRedirect(provider);
        return;
      }
      throw e;
    }
  } catch (e) {
    console.error(e);
    window.setAuthStatus(e.message || 'Google 登录失败', true);
  }
};

// Email/Password: Sign up (send verification email)
window.authEmailSignup = async function authEmailSignup() {
  if (!window.ensureFirebase()) return window.uiAlert('Firebase 未配置：请先填 firebaseConfig');
  const email = (document.getElementById('authEmail')?.value || '').trim();
  const pass  = (document.getElementById('authPass')?.value || '').trim();
  if (!email || !pass) return window.setAuthStatus('请填写 Email / Password', true);

  window.setAuthStatus('注册中...');
  try {
    const cred = await window.fbAuth.createUserWithEmailAndPassword(email, pass);
    await cred.user.sendEmailVerification();

    window.setAuthStatus('注册成功：已发送验证邮件，请先验证邮箱', false);
    await window.uiAlert(
      '注册成功 ✅\n\n已发送验证邮件到你的邮箱，请点击邮件里的链接完成验证。\n验证完成后再使用云端备份/恢复。',
      '验证邮箱'
    );
    window.closeAuth();
  } catch (e) {
    console.error(e);
    window.setAuthStatus(e.message || '注册失败', true);
  }
};

// Email/Password: Login (warn if not verified; allow resend)
window.authEmailLogin = async function authEmailLogin() {
  if (!window.ensureFirebase()) return window.uiAlert('Firebase 未配置：请先填 firebaseConfig');
  const email = (document.getElementById('authEmail')?.value || '').trim();
  const pass  = (document.getElementById('authPass')?.value || '').trim();
  if (!email || !pass) return window.setAuthStatus('请填写 Email / Password', true);

  window.setAuthStatus('登录中...');
  try {
    const cred = await window.fbAuth.signInWithEmailAndPassword(email, pass);

    try { await cred.user.reload(); } catch (_) {}

    if (!cred.user.emailVerified) {
      window.setAuthStatus('已登录但邮箱未验证：云端功能将受限', true);
      const resend = await window.uiConfirm('你的邮箱尚未验证。\n\n是否重新发送验证邮件？', '邮箱未验证', '重新发送', '暂不');
      if (resend) {
        await cred.user.sendEmailVerification();
        await window.uiAlert('已重新发送验证邮件，请去邮箱点击链接完成验证。', '已发送');
      }
    } else {
      window.setAuthStatus('登录成功');
    }

    window.closeAuth();
  } catch (e) {
    console.error(e);
    window.setAuthStatus(e.message || '登录失败', true);
  }
};

window.authLogout = async function authLogout() {
  if (!window.ensureFirebase()) return window.uiAlert('Firebase 未配置：请先填 firebaseConfig');
  try {
    await window.fbAuth.signOut();
    await window.uiAlert('已登出', '退出登录');
  } catch (e) {
    console.error(e);
    await window.uiAlert(e.message || '登出失败', '退出登录');
  }
};

// ===== Cloud helpers =====
function normalizeEvents(events) {
  const safe = Array.isArray(events) ? events : [];
  return safe.map(e => ({
    id: (e?.id || (window.newId ? window.newId() : String(Date.now()))).toString(),
    seriesId: (e?.seriesId || '').toString(),
    date: (e?.date || (window.fmtLocal ? window.fmtLocal(new Date()) : '')).toString(),
    title: (e?.title || '').toString(),
    start: (e?.start || '').toString(),
    end: (e?.end || '').toString(),
    loc: (e?.loc || '').toString(),
    prio: (e?.prio || 'norm').toString(),
    color: (e?.color || 'bg-blue').toString(),
    icon: (e?.icon || '🚫').toString(),
    allDay: !!e?.allDay,
    repeat: (e?.repeat || 'none').toString(),
  }));
}

function formatMaybeTimestamp(ts) {
  try {
    if (ts && typeof ts.toDate === 'function') return ts.toDate().toLocaleString();
  } catch (_) {}
  return '';
}

function backupLocalBeforeRestore() {
  try {
    const key = `${window.STORAGE_KEY || 'smart_calendar_data_v1'}_before_restore_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(window.state?.events || []));
    return key;
  } catch (e) {
    console.warn('Local pre-restore backup failed:', e);
    return '';
  }
}

// ---- Warm-up helpers: fix first-try "offline" ----
async function waitForAuthReady(timeoutMs = 4000) {
  try {
    if (!window.fbAuth || typeof window.fbAuth.onAuthStateChanged !== 'function') return;
    if (window.fbAuth.currentUser) { await Promise.resolve(); return; }

    await new Promise((resolve) => {
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; try { unsub && unsub(); } catch(_) {} resolve(); } }, timeoutMs);
      const unsub = window.fbAuth.onAuthStateChanged(() => {
        if (done) return;
        done = true;
        clearTimeout(t);
        try { unsub && unsub(); } catch(_) {}
        resolve();
      });
    });
  } catch (_) {}
}

async function warmFirestore(db, attempts = 3) {
  if (!db) return { ok: false, lastErr: null };

  try { if (typeof db.enableNetwork === 'function') await db.enableNetwork(); } catch (_) {}

  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      // Lightweight read to force establishing a connection
      await db.collection('_ping').doc('_ping').get();
      return { ok: true, lastErr: null };
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e || '');
      // retry on offline-ish errors
      if (i < attempts - 1 && (/offline|unavailable|network/i).test(msg)) {
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
      break;
    }
  }
  return { ok: false, lastErr };
}

// --- Robust Firestore operation with retry/reset (fix intermittent 'client is offline') ---
async function resetFirestoreNetwork(db) {
  try { if (db && typeof db.disableNetwork === 'function') await db.disableNetwork(); } catch (_) {}
  try { if (db && typeof db.enableNetwork === 'function') await db.enableNetwork(); } catch (_) {}
}

async function getDocWithRetry(ref, db, retries = 5) {
  let lastErr = null;
  for (let i = 0; i < retries; i++) {
    try {
      return await ref.get();
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e || '');
      const offlineish = (/offline|unavailable|network/i).test(msg);
      if (offlineish && i < retries - 1) {
        // Reset network state and backoff
        await resetFirestoreNetwork(db);
        await new Promise(r => setTimeout(r, 350 + i * 400));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function setDocWithRetry(ref, payload, db, retries = 5) {
  let lastErr = null;
  for (let i = 0; i < retries; i++) {
    try {
      return await setDocWithRetry(ref, payload, window.fbDb);
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e || '');
      const offlineish = (/offline|unavailable|network/i).test(msg);
      if (offlineish && i < retries - 1) {
        await resetFirestoreNetwork(db);
        await new Promise(r => setTimeout(r, 350 + i * 400));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
// --- /retry helpers ---
// ---- /Warm-up helpers ----

async function withFirestoreRetry(fn, retries = 3) {
  let lastErr = null;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e || '');
      // Retry only on offline/unavailable/network-ish errors
      if (i < retries - 1 && (/offline|unavailable|network|timeout/i).test(msg)) {
        await new Promise(r => setTimeout(r, 350 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}


async function requireVerifiedEmailForCloud(user, actionLabel = '云端操作') {
  const isPasswordUser = user?.providerData?.some(p => p.providerId === 'password');
  if (!isPasswordUser) return true;

  try { await user.reload(); } catch (_) {}
  if (user.emailVerified) return true;

  await (window.uiAlert
    ? window.uiAlert(`你的邮箱尚未验证。\n\n为了使用${actionLabel}（备份/恢复），请先完成邮箱验证。`, '需要邮箱验证')
    : Promise.resolve());

  const resend = window.uiConfirm
    ? await window.uiConfirm(
        '是否现在发送一封验证邮件到你的邮箱？\n\n（打开邮箱点击验证链接后返回本页）',
        '发送验证邮件',
        '发送',
        '取消'
      )
    : confirm('你的邮箱尚未验证。是否发送验证邮件？');

  if (!resend) return false;

  try {
    const key = 'email_verify_last_sent_at';
    const last = Number(localStorage.getItem(key) || '0');
    const now = Date.now();
    if (last && now - last < 60 * 1000) {
      await (window.uiAlert ? window.uiAlert('刚刚已发送过验证邮件，请稍等 1 分钟再试。', '发送过于频繁') : Promise.resolve());
      return false;
    }
    await user.sendEmailVerification();
    localStorage.setItem(key, String(now));
    await (window.uiAlert
      ? window.uiAlert('已发送验证邮件 ✅\n\n请到邮箱里点击验证链接完成验证，然后回到这里继续。', '已发送')
      : Promise.resolve());
  } catch (e) {
    console.error(e);
    await (window.uiAlert
      ? window.uiAlert('发送验证邮件失败：' + (e?.message || 'unknown'), '失败')
      : Promise.resolve());
    return false;
  }

  const recheck = window.uiConfirm
    ? await window.uiConfirm(
        '你是否已经完成邮箱验证？\n\n点击“已验证”我会立刻重新检查状态。',
        '重新检查',
        '已验证',
        '稍后'
      )
    : confirm('你是否已经完成邮箱验证？');

  if (!recheck) return false;

  try { await user.reload(); } catch (_) {}

  if (user.emailVerified) {
    await (window.uiAlert ? window.uiAlert('验证已生效 ✅ 现在可以继续操作了。', '已验证') : Promise.resolve());
    return true;
  }

  await (window.uiAlert
    ? window.uiAlert('我这边仍然检测到“未验证”。\n\n可能原因：\n- 你点了邮件但还没完成\n- 需要稍等几秒再试\n- 你登录的不是同一个邮箱账号\n\n请完成验证后再点击备份/恢复。', '尚未验证')
    : Promise.resolve());

  return false;
}

function userDocRef(user) {
  return window.fbDb.collection('users').doc(user.uid).collection('calendar').doc('main');
}

// ===== Cloud backup/restore =====
window.cloudBackup = async function cloudBackup() {
  if (!window.ensureFirebase()) return window.uiAlert('Firebase 未配置：请先填 firebaseConfig');
  const user = window.fbAuth.currentUser;
  if (!user) return window.uiAlert('请先 Login 才能 Cloud Backup', '需要登录');

  if (!(await requireVerifiedEmailForCloud(user, '云端备份'))) return;

  try {
    // Warm-up so first action doesn't get "offline"
    await waitForAuthReady();
    try { await user.reload(); } catch (_) {}
    const warm = await warmFirestore(window.fbDb);
    // warm-up is best-effort; do not block main operation
const ref = userDocRef(user);
    const events = normalizeEvents(window.state?.events);

    // Prevent accidental overwrite: compare with cloud first
    let cloudInfo = null;
    try {
      const snap = await withFirestoreRetry(() => ref.get(), 3);
      if (snap.exists) {
        const data = snap.data() || {};
        cloudInfo = {
          count: Array.isArray(data.events) ? data.events.length : 0,
          updatedAtText: formatMaybeTimestamp(data.updatedAt),
        };
      }
    } catch (_) {}

    if (cloudInfo) {
      const ok = await window.uiConfirm(
        `即将上传并覆盖云端数据。\n\n本地：${events.length} 件\n云端：${cloudInfo.count} 件\n` +
        (cloudInfo.updatedAtText ? `云端更新时间：${cloudInfo.updatedAtText}\n\n` : `\n`) +
        `确定继续“覆盖云端”吗？`,
        '确认备份',
        '覆盖并备份',
        '取消'
      );
      if (!ok) return;
    }

    const payload = {
      format: "smart_calendar_cloud",
      version: 1,
      exportedAt: new Date().toISOString(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      events
    };

    await withFirestoreRetry(() => ref.set(payload), 3);
    await window.uiAlert(`Cloud Backup 成功 ✅（${events.length} 件）`, '备份成功');
  } catch (e) {
    console.error(e);
    await window.uiAlert('Cloud Backup 失败：' + (e?.message || 'unknown'), '备份失败');
  }
};

window.cloudRestore = async function cloudRestore() {
  if (!window.ensureFirebase()) return window.uiAlert('Firebase 未配置：请先填 firebaseConfig');
  const user = window.fbAuth.currentUser;
  if (!user) return window.uiAlert('请先 Login 才能 Cloud Restore', '需要登录');

  if (!(await requireVerifiedEmailForCloud(user, '云端恢复'))) return;

  try {
    // Warm-up: avoid false 'offline' on first restore
    await waitForAuthReady();
    try { await user.reload(); } catch (_) {}
    const warm = await warmFirestore(window.fbDb);
    // warm-up is best-effort; do not block main operation
const ref = userDocRef(user);
    const snap = await withFirestoreRetry(() => ref.get(), 3);
    if (!snap.exists) return window.uiAlert('云端没有备份数据', '无备份');

    const data = snap.data() || {};
    if (!Array.isArray(data.events)) return window.uiAlert('云端数据格式不正确', '数据错误');

    const cloudEvents = normalizeEvents(data.events);
    const localCount = (window.state?.events || []).length;
    const cloudCount = cloudEvents.length;
    const updatedAtText = formatMaybeTimestamp(data.updatedAt);

    const backupKey = backupLocalBeforeRestore();

    const msg =
      `即将用云端数据覆盖本地数据。\n\n` +
      `本地：${localCount} 件\n` +
      `云端：${cloudCount} 件\n` +
      (updatedAtText ? `云端更新时间：${updatedAtText}\n\n` : `\n`) +
      (backupKey ? `已自动备份本地到：${backupKey}\n\n` : `\n`) +
      `确定要继续吗？`;

    const ok = await window.uiConfirm(msg, '确认恢复', '恢复', '取消');
    if (!ok) return;

    window.state.events = cloudEvents;
    if (window.saveData) window.saveData();
    if (window.render) window.render();
    await window.uiAlert(`Cloud Restore 成功 ✅（${cloudCount} 件）`, '恢复成功');
  } catch (e) {
    console.error(e);
    await window.uiAlert('Cloud Restore 失败：' + (e?.message || 'unknown'), '恢复失败');
  }
};
