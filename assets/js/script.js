// ====== FCM + SERVICE WORKER ======
let fcmToken = null;

async function initFCM() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        console.warn('Push: Service Worker or Notification not supported');
        return;
    }
    // Push-уведомления требуют HTTPS
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        console.warn('Push: requires HTTPS');
        return;
    }
    try {
        const reg = await navigator.serviceWorker.register('firebase-messaging-sw.js');
        console.log('Push: SW registered');
        await navigator.serviceWorker.ready;
        console.log('Push: SW ready');
    } catch(e) {
        console.warn('Push: SW registration failed:', e.message || e);
    }
}

async function requestNotifyPermission() {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') {
        console.warn('Push: permission denied');
        return false;
    }
    try {
        const perm = await Notification.requestPermission();
        console.log('Push: permission:', perm);
        return perm === 'granted';
    } catch(e) { console.warn('Push: permission error:', e); return false; }
}

async function getFCMToken() {
    if (fcmToken) return fcmToken;
    if (!firebase.messaging || typeof firebase.messaging !== 'function') {
        console.warn('Push: firebase.messaging not available');
        return null;
    }
    try {
        const messaging = firebase.messaging();
        const token = await messaging.getToken({ vapidKey: 'BDE17DqOWQh8SXT5H3p0k6xOeJJwT7rfEo7_2j1AXt_QzMTFZfAUzAfH3eE4-Kf6X-T3FZGg9_2RWDgxNKBGEgE' });
        if (token) {
            fcmToken = token;
            console.log('Push: token obtained');
            if (currentUser && currentUser.id) {
                try { usersRef.child(currentUser.id).update({ fcmToken: token }); } catch(e) {}
            }
        } else {
            console.warn('Push: token is null');
        }
        return token;
    } catch(e) {
        console.warn('Push: getToken error:', e.message || e);
        return null;
    }
}

// Показываем уведомление в браузере
function showBrowserNotification(title, body) {
    if (Notification.permission !== 'granted') return;
    try {
        const n = new Notification(title, {
            body: body,
            icon: 'assets/ico/tbank.png',
            badge: 'assets/ico/tbank.png'
        });
        setTimeout(() => n.close(), 5000);
        n.onclick = () => { window.focus(); n.close(); };
    } catch(e) {}
}

// Слушаем сообщения в фоне (когда пользователь не на странице чата)
function listenChatNotifications() {
    if (!currentUser || currentUser.role === 'admin') return;
    const notifyRef = db.ref('chat/' + currentUser.id + '/messages');
    notifyRef.limitToLast(1).on('child_added', snap => {
        const msg = snap.val();
        if (!msg || msg.from === currentUser.username) return;
        if (Date.now() - msg.time > 15000) return;
        playMessageSound();
        const isOnChat = chatPage.style.display === 'block' && chatConversation.style.display === 'flex';
        if (!isOnChat || document.hidden) {
            showBrowserNotification('Т-Банк: новое сообщение', msg.text);
        }
    });
}

// Звук нового сообщения (Web Audio API, без файлов)
let _audioCtx = null;
function playMessageSound() {
    try {
        if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = _audioCtx.createOscillator();
        const gain = _audioCtx.createGain();
        osc.connect(gain);
        gain.connect(_audioCtx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.08, _audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(_audioCtx.currentTime + 0.15);
    } catch(e) {}
}

// ====== ОРИГИНАЛЬНАЯ ЛОГИКА ======

function pad(n) { return n.toString().padStart(2, "0"); }

function format(d) {
    return pad(d.getDate()) + "." +
           pad(d.getMonth()+1) + "." +
           d.getFullYear() + " " +
           pad(d.getHours()) + ":" +
           pad(d.getMinutes());
}

function formatDate(d) {
    return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear();
}

function formatTime(d) {
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ====== DOM ЭЛЕМЕНТЫ ======

const fixedTimeElement = document.getElementById("fixedTime");
const modal = document.getElementById("modal");
const payBtn = document.getElementById("payBtn");
const closeBtn = document.getElementById("closeBtn");
const receiptDate = document.getElementById("receiptDate");
const receiptSumBig = document.getElementById("receiptSumBig");
const receiptSumSmall = document.getElementById("receiptSumSmall");
const receiptStore = document.getElementById("receiptStore");
const receiptAccount = document.getElementById("receiptAccount");
const receiptLegal = document.getElementById("receiptLegal");
const receiptTransId = document.getElementById("receiptTransId");
const receiptSbp = document.getElementById("receiptSbp");
const receiptNumber = document.getElementById("receiptNumber");

const scannerView = document.getElementById('scannerView');
const paymentView = document.getElementById('paymentView');
const headerEl = document.getElementById('paymentHeader');
const captureCircle = document.getElementById('captureCircle');
const cameraError = document.getElementById('cameraError');
const video = document.getElementById('webcam');
const canvasElement = document.getElementById('qrCanvas');
const canvas = canvasElement.getContext('2d');

const splashScreen = document.getElementById('splashScreen');
const mainSkeleton = document.getElementById('mainPageSkeleton');
const historySkeleton = document.getElementById('historySkeleton');
const cardSkeleton = document.getElementById('cardPageSkeleton');
const transferSkeleton = document.getElementById('transferSkeleton');
const processingOverlay = document.getElementById('processingOverlay');
const processingText = document.getElementById('processingText');
const processingSub = document.getElementById('processingSub');

const mainPage = document.getElementById('mainPage');
const scanQrBtn = document.getElementById('scanQrBtn');
const paymentsNav = document.getElementById('paymentsNav');
const userName = document.getElementById('userName');
const mainAvatar = document.getElementById('mainAvatar');

const backFromScanner = document.getElementById('backFromScanner');
const backFromHistory = document.getElementById('backFromHistory');
const backFromCard = document.getElementById('backFromCard');
const backFromDetail = document.getElementById('backFromDetail');

const historyPage = document.getElementById('historyPage');
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

const cardPage = document.getElementById('cardPage');
const detailPage = document.getElementById('detailPage');
const detailPrice = document.getElementById('detailPrice');
const detailDatetime = document.getElementById('detailDatetime');
const detailTitle = document.getElementById('detailTitle');
const detailCategory = document.getElementById('detailCategory');
const detailCardName = document.getElementById('detailCardName');
const detailBalance = document.getElementById('detailBalance');
const receiptBtn = document.getElementById('receiptBtn');

const transferPage = document.getElementById('transferPage');
const successPage = document.getElementById('successPage');
const transferPhone = document.getElementById('transferPhone');
const transferAmount = document.getElementById('transferAmount');
const transferComment = document.getElementById('transferComment');
const doTransferBtn = document.getElementById('doTransferBtn');
const backFromTransfer = document.getElementById('backFromTransfer');
const closeSuccess = document.getElementById('closeSuccess');
const successDoneBtn = document.getElementById('successDoneBtn');
const successPhone = document.getElementById('successPhone');
const successName = document.getElementById('successName');
const successAmount = document.getElementById('successAmount');
const successBankLogo = document.getElementById('successBankLogo');
const successReceiptBtn = document.getElementById('successReceiptBtn');

// ====== СОСТОЯНИЕ ======

let stream = null;
let animationFrameId = null;
let payments = [];
let currentPaymentId = null;
let isNavigating = false;

// ====== НОВЫЕ DOM ЭЛЕМЕНТЫ ======
const loginPage = document.getElementById('loginPage');
const registerPage = document.getElementById('registerPage');
const adminPage = document.getElementById('adminPage');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const goToRegisterLink = document.getElementById('goToRegisterLink');
const registerName = document.getElementById('registerName');
const registerUsername = document.getElementById('registerUsername');
const registerPassword = document.getElementById('registerPassword');
const registerBtn = document.getElementById('registerBtn');
const registerError = document.getElementById('registerError');
const goToLoginLink = document.getElementById('goToLoginLink');
const adminSearchInput = document.getElementById('adminSearchInput');
const adminUsersList = document.getElementById('adminUsersList');
const backFromAdmin = document.getElementById('backFromAdmin');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const showcaseNav = document.getElementById('showcaseNav');
const balanceModal = document.getElementById('balanceModal');
const balanceModalUser = document.getElementById('balanceModalUser');
const balanceModalInput = document.getElementById('balanceModalInput');
const balanceModalCancel = document.getElementById('balanceModalCancel');
const balanceModalSave = document.getElementById('balanceModalSave');

const pinPage = document.getElementById('pinPage');
const pinInput = document.getElementById('pinInput');
const pinLoginBtn = document.getElementById('pinLoginBtn');
const pinBackToLogin = document.getElementById('pinBackToLogin');
const pinError = document.getElementById('pinError');
const pinUserDisplay = document.getElementById('pinUserDisplay');
const pinModal = document.getElementById('pinModal');
const newPinInput = document.getElementById('newPinInput');
const confirmPinInput = document.getElementById('confirmPinInput');
const savePinBtn = document.getElementById('savePinBtn');
const cancelPinBtn = document.getElementById('cancelPinBtn');
const pinLogoutBtn = document.getElementById('pinLogoutBtn');

// ====== СИСТЕМА ПОЛЬЗОВАТЕЛЕЙ (FIREBASE) ======

const PRESET_USERS = [
    { username: 'admin', password: 'admin123', name: 'Администратор', balance: 0, role: 'admin' },
];

let users = [];
let currentUser = null;
let editingUserId = null;
let usersLoaded = false;
let firebaseFailed = false;
let initCallbacks = [];

function onUsersLoaded(fn) {
    if (usersLoaded) fn();
    else initCallbacks.push(fn);
}

function initUsers() {
    usersRef.once('value').then(snap => {
        if (!snap.val()) {
            const updates = {};
            PRESET_USERS.forEach(u => {
                updates[usersRef.push().key] = u;
            });
            return usersRef.update(updates);
        }
    }).then(() => {
        usersRef.on('value', snap => {
            const data = snap.val();
            users = [];
            if (data) {
                Object.keys(data).forEach(key => {
                    const u = data[key];
                    u.id = key;
                    if (!u.role) u.role = 'user';
                    users.push(u);
                });
            }
            // Очистка старых preset-пользователей (кроме admin)
            const oldPresets = ['user', 'alice', 'bob', 'maria'];
            const cleanup = {};
            users.forEach(u => {
                if (oldPresets.includes(u.username)) {
                    cleanup[u.id] = null;
                }
            });
            if (Object.keys(cleanup).length) {
                usersRef.update(cleanup);
            }
            if (!usersLoaded) {
                usersLoaded = true;
                initCallbacks.forEach(fn => fn());
                initCallbacks = [];
            }
            if (currentUser) {
                const updated = users.find(u => u.id === currentUser.id);
                if (updated) {
                    currentUser = updated;
                    if (currentUser.role === 'user') {
                        balance = currentUser.balance;
                        updateBalanceUI();
                    }
                }
            }
            // Синхронизация пин-кода между Firebase и localStorage
            if (currentUser) {
                const localPin = getPin(currentUser.username);
                if (currentUser.pin && localPin !== currentUser.pin) {
                    try { localStorage.setItem('tpay_pin_' + currentUser.username, currentUser.pin); } catch(e) {}
                } else if (localPin && !currentUser.pin && !firebaseFailed) {
                    usersRef.child(currentUser.id).update({ pin: localPin });
                }
            }
        });
    }).catch(e => {
        console.error('Firebase error:', e);
        firebaseFailed = true;
        splashScreen.style.display = 'none';
        loginPage.style.display = 'flex';
    });
}

// Принудительная перезагрузка пользователей из Firebase
function reloadUsers(callback) {
    if (typeof usersRef === 'undefined' || firebaseFailed) {
        if (callback) callback();
        return;
    }
    usersRef.once('value').then(snap => {
        const data = snap.val();
        if (data) {
            Object.keys(data).forEach(key => {
                const existing = users.find(u => u.id === key);
                if (!existing) {
                    const u = data[key];
                    u.id = key;
                    if (!u.role) u.role = 'user';
                    users.push(u);
                }
            });
        }
        if (callback) callback();
    }).catch(() => {
        if (callback) callback();
    });
}

function registerUser(username, password, name) {
    return new Promise(resolve => {
        const localUsers = JSON.parse(localStorage.getItem('tpay_local_users') || '[]');
        if (localUsers.find(u => u.username === username)) {
            resolve({ success: false, error: 'Пользователь с таким логином уже существует' });
            return;
        }
        if (PRESET_USERS.find(u => u.username === username)) {
            resolve({ success: false, error: 'Пользователь с таким логином уже существует' });
            return;
        }
        // Если Firebase доступен, регистрируем через него
        if (typeof usersRef !== 'undefined' && usersLoaded && !firebaseFailed) {
            usersRef.once('value').then(snap => {
                const data = snap.val();
                if (data) {
                    for (const key in data) {
                        if (data[key].username === username) {
                            resolve({ success: false, error: 'Пользователь с таким логином уже существует' });
                            return;
                        }
                    }
                }
                const newRef = usersRef.push();
                newRef.set({
                    username, password,
                    name: name || username,
                    balance: 0,
                    role: 'user'
                }).then(() => {
                    resolve({ success: true, user: { id: newRef.key, username, password, name: name || username, balance: 0, role: 'user' } });
                });
            }).catch(() => {
                resolve({ success: false, error: 'Ошибка соединения с сервером' });
            });
        } else {
            // Локальная регистрация (запасной вариант)
            const newUser = {
                id: 'local_' + Date.now(),
                username,
                password,
                name: name || username,
                balance: 0,
                role: 'user'
            };
            localUsers.push(newUser);
            localStorage.setItem('tpay_local_users', JSON.stringify(localUsers));
            users.push(newUser);
            resolve({ success: true, user: newUser });
        }
    });
}

function loginUser(username, password) {
    const localUsers = JSON.parse(localStorage.getItem('tpay_local_users') || '[]');
    const allUsers = [...users, ...localUsers.filter(u => !users.find(x => x.id === u.id))];
    const source = allUsers.length ? allUsers : PRESET_USERS;
    const user = source.find(u => u.username === username && u.password === password);
    if (!user) return { success: false, error: 'Неверный логин или пароль' };
    return { success: true, user };
}

function saveCurrentUser() {
    try {
        if (currentUser) localStorage.setItem('tpay_current_user', currentUser.id);
        else localStorage.removeItem('tpay_current_user');
    } catch(e) {}
}

function syncUserBalance() {
    if (currentUser && currentUser.role === 'user') {
        currentUser.balance = balance;
        if (!firebaseFailed) {
            usersRef.child(currentUser.id).update({ balance: balance });
        } else {
            // Обновляем в локальном хранилище
            const localUsers = JSON.parse(localStorage.getItem('tpay_local_users') || '[]');
            const idx = localUsers.findIndex(u => u.id === currentUser.id);
            if (idx !== -1) {
                localUsers[idx].balance = balance;
                localStorage.setItem('tpay_local_users', JSON.stringify(localUsers));
            }
        }
    }
}

function logoutUser() {
    currentUser = null;
    saveCurrentUser();
    clearRememberedUser();
    localStorage.removeItem('tpay_payments');
    localStorage.removeItem('tpay_balance');
    localStorage.removeItem('tpay_name');
    payments = [];
}

function applyUserData(user) {
    if (user.role === 'admin') return;
    balance = user.balance;
    updateBalanceUI();
    if (userName) userName.textContent = user.name;
    try { localStorage.setItem('tpay_name', user.name); } catch(e) {}
    updateAvatar();
}

// ====== ПИН-КОД ======

function savePin(username, pin) {
    try { localStorage.setItem('tpay_pin_' + username, pin); } catch(e) {}
    if (currentUser && currentUser.username === username && !firebaseFailed) {
        usersRef.child(currentUser.id).update({ pin: pin });
    }
}

function getPin(username) {
    try { return localStorage.getItem('tpay_pin_' + username); } catch(e) { return null; }
}

function removePin(username) {
    try { localStorage.removeItem('tpay_pin_' + username); } catch(e) {}
    if (!firebaseFailed && currentUser) {
        usersRef.orderByChild('username').equalTo(username).once('value', snap => {
            snap.forEach(child => {
                child.ref.update({ pin: null });
            });
        });
    }
}

function getRememberedUser() {
    try { return localStorage.getItem('tpay_remembered_user'); } catch(e) { return null; }
}

function saveRememberedUser(username) {
    try { localStorage.setItem('tpay_remembered_user', username); } catch(e) {}
}

function clearRememberedUser() {
    try { localStorage.removeItem('tpay_remembered_user'); } catch(e) {}
}

function showPinPage() {
    const rememberedUsername = getRememberedUser();
    if (!rememberedUsername) return false;
    const user = users.find(u => u.username === rememberedUsername);
    if (!user) { clearRememberedUser(); return false; }
    const pin = getPin(rememberedUsername);
    if (!pin) { clearRememberedUser(); return false; }
    pinUserDisplay.textContent = user.name + ', добро пожаловать';
    hideAll();
    pinPage.style.display = 'flex';
    pinInput.value = '';
    pinError.style.display = 'none';
    return true;
}

// ====== НАВИГАЦИЯ АДМИНКИ ======

function showAdmin() {
    if (isNavigating) return;
    isNavigating = true;
    stopScanning();
    hideAll();
    try {
        document.getElementById('adminDashboard').style.display = 'flex';
        updateAdminDashboard();
        renderBannedDevices();
        renderAdminUsers();
        adminPage.style.display = 'block';
    } catch(e) {
        console.error('showAdmin error:', e);
        adminUsersList.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#e62e2e;font-size:14px;">Ошибка загрузки: ' + e.message + '</div>';
        adminPage.style.display = 'block';
    }
    isNavigating = false;
    // Если пользователей нет — пытаемся догрузить
    if (users.filter(u => u.role === 'user').length === 0) {
        reloadUsers(() => renderAdminUsers(adminSearchInput.value.trim()));
    }
}

function renderBannedDevices() {
    const section = document.getElementById('adminBannedSection');
    const list = document.getElementById('adminBannedList');
    if (!section || !list) return;
    const banned = getBannedDevices();
    if (banned.length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    list.innerHTML = banned.map(fp => {
        // Находим пользователя с таким fingerprint
        const user = users.find(u => u.fingerprint === fp || (function() {
            try { return localStorage.getItem('tpay_fp_' + u.username) === fp; } catch(e) { return false; }
        })());
        const name = user ? (user.name + ' (@' + user.username + ')') : 'Неизвестный пользователь';
        return `<div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border-radius:14px;padding:12px 14px;margin-bottom:8px;">
            <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:500;color:#1d1d1d;">${name}</div>
                <div style="font-size:10px;color:#8c8f94;font-family:monospace;word-break:break-all;">${fp}</div>
            </div>
            <button class="admin-unban-fp-btn" data-fp="${fp}" style="padding:6px 14px;border:none;border-radius:8px;background:#e8f5e9;color:#2e7d32;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;flex-shrink:0;margin-left:8px;">Разблокировать</button>
        </div>`;
    }).join('');
    list.querySelectorAll('.admin-unban-fp-btn').forEach(btn => {
        btn.onclick = () => {
            unbanDevice(btn.dataset.fp);
            renderAdminUsers(adminSearchInput.value.trim());
        };
    });
}

document.getElementById('adminClearBannedBtn').onclick = () => {
    if (!confirm('Очистить все заблокированные устройства?')) return;
    const banned = getBannedDevices();
    banned.forEach(fp => unbanDevice(fp));
    renderAdminUsers(adminSearchInput.value.trim());
};

document.getElementById('adminBatchFillBtn').onclick = async () => {
    if (!confirm('Заполнить пропущенные данные для ВСЕХ пользователей? Это может занять некоторое время.')) return;
    const btn = document.getElementById('adminBatchFillBtn');
    btn.disabled = true;
    btn.textContent = 'Обновление...';
    let count = 0;
    const promises = users.filter(u => u.role === 'user').map(u => {
        const updates = {};
        const dev = u.device || {};
        const ua = dev.userAgent || u.userAgent || '';

        // Парсим ОС и браузер если есть UA
        let os = '—', browser = '—';
        if (ua) {
            if (/iPhone|iPad/.test(ua)) os = 'iOS';
            else if (/Android/.test(ua)) os = 'Android';
            else if (/Windows/.test(ua)) os = 'Windows';
            else if (/Mac/.test(ua)) os = 'macOS';
            else if (/Linux/.test(ua)) os = 'Linux';
            if (/Chrome/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
            else if (/Firefox/.test(ua)) browser = 'Firefox';
            else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
            else if (/Edg/.test(ua)) browser = 'Edge';
            else if (/Opera/.test(ua)) browser = 'Opera';
        }

        if (!dev.fingerprint && !u.fingerprint) {
            const scr = dev.screen || u.screen || '';
            const lang = dev.language || u.language || '';
            const model = dev.model || u.model || '';
            const src = ua + '||' + scr + '||' + lang + '||' + model;
            let genHash = 0;
            for (let i = 0; i < src.length; i++) {
                genHash = ((genHash << 5) - genHash) + src.charCodeAt(i);
                genHash |= 0;
            }
            const genFp = 'fp_admin_' + Math.abs(genHash).toString(36) + '_' + src.length.toString(36);
            updates['fingerprint'] = genFp;
            updates['device/fingerprint'] = genFp;
        }
        if (!dev.os) updates['device/os'] = os;
        if (!dev.browser) updates['device/browser'] = browser;
        if (!dev.timezone) {
            try { updates['device/timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone || '—'; } catch(e) { updates['device/timezone'] = '—'; }
        }
        if (!dev.hardwareConcurrency) updates['device/hardwareConcurrency'] = navigator.hardwareConcurrency || '—';
        if (!dev.deviceMemory) updates['device/deviceMemory'] = navigator.deviceMemory || '—';
        if (!dev.doNotTrack) updates['device/doNotTrack'] = navigator.doNotTrack || 'не отправлен';
        if (!dev.cookiesEnabled) updates['device/cookiesEnabled'] = navigator.cookieEnabled ? 'да' : 'нет';
        if (!dev.pixelRatio) updates['device/pixelRatio'] = String(window.devicePixelRatio || '—');
        if (!dev.touchPoints) updates['device/touchPoints'] = String(navigator.maxTouchPoints || '—');
        if (!dev.platform) updates['device/platform'] = '—';
        if (!dev.language) updates['device/language'] = '—';
        if (!dev.screen) updates['device/screen'] = '—';
        if (!u.ip) updates['ip'] = '—';
        if (Object.keys(updates).length > 0) {
            count++;
            return usersRef.child(u.id).update(updates);
        }
        return Promise.resolve();
    });
    try { await Promise.all(promises); } catch(e) {}
    btn.disabled = false;
    btn.textContent = 'Обновить данные всех';
    alert('Обновлено ' + count + ' пользователей. Обновите страницу.');
    reloadUsers(() => renderAdminUsers(adminSearchInput.value.trim()));
};

function renderAdminUsers(filter) {
    try {
        // Отображаем забаненные устройства
        renderBannedDevices();
        
        let list = users.filter(u => u && u.role === 'user');
        if (filter) {
            const q = filter.toLowerCase();
            list = list.filter(u => (u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q));
        }
        if (list.length === 0) {
            adminUsersList.innerHTML = '<div style="text-align:center;padding:60px 0;color:#8c8f94;font-size:15px;">Нет пользователей</div>';
            return;
        }
        adminUsersList.innerHTML = list.map(u => {
            const pin = u.pin || getPin(u.username);
            const pinDisplay = pin ? pin : '—';
            const bal = typeof u.balance === 'number' ? u.balance : 0;
            const dev = u.device || {};
            const ua = dev.userAgent || '';
            const uaShort = ua.length > 40 ? ua.substring(0, 40) + '...' : ua;
            const fp = u.fingerprint || (function() {
                try { return localStorage.getItem('tpay_fp_' + u.username) || ''; } catch(e) { return ''; }
            })();
            const ip = u.ip || (function() {
                try { return localStorage.getItem('tpay_ip_' + u.username) || ''; } catch(e) { return ''; }
            })();
            return `
            <div class="admin-user-card" data-id="${u.id}" style="background:#fff;border-radius:20px;padding:20px;margin-bottom:14px;box-shadow:0 4px 20px rgba(0,0,0,0.04);cursor:pointer;">
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
                    <div style="position:relative;flex-shrink:0;">
                        <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#3b7cf6,#6b9df8);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px;">${(u.name || '?').charAt(0).toUpperCase()}</div>
                        ${u.online ? '<div style="position:absolute;bottom:0;right:0;width:12px;height:12px;border-radius:50%;background:#34c759;border:2px solid #fff;"></div>' : ''}
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:16px;font-weight:600;color:#1d1d1d;">${u.name || '—'}</div>
                        <div style="font-size:12px;color:#8c8f94;">@${u.username || '—'}</div>
                        ${ip ? `<div style="font-size:11px;color:#8c8f94;font-family:monospace;margin-top:2px;">IP: ${ip}</div>` : ''}
                        ${fp ? `<div style="font-size:10px;color:#aaa;font-family:monospace;margin-top:1px;">FP: ${fp.substring(0, 16)}...</div>` : ''}
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:18px;font-weight:700;color:#1d1d1d;">${bal.toLocaleString('ru-RU')} ₽</div>
                        <button class="admin-topup-btn" data-id="${u.id}" style="margin-top:4px;padding:6px 16px;border:none;border-radius:10px;background:#e8f5e9;color:#2e7d32;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Пополнить</button>
                        <button class="admin-edit-btn" data-id="${u.id}" style="margin-top:4px;padding:6px 16px;border:none;border-radius:10px;background:#f2f7ff;color:#3b7cf6;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;margin-left:4px;">Баланс</button>
                        <button class="admin-delete-btn" data-id="${u.id}" style="margin-top:4px;padding:6px 16px;border:none;border-radius:10px;background:#fff0f0;color:#e62e2e;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;margin-left:4px;">Удалить</button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding-top:14px;border-top:1px solid #f0f2f5;">
                    <div>
                        <div style="font-size:11px;color:#8c8f94;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px;">Пароль</div>
                        <div style="font-size:13px;color:#1d1d1d;font-weight:500;font-family:monospace;">${u.password || '—'}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#8c8f94;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px;">Пин-код</div>
                        <div style="font-size:13px;color:#1d1d1d;font-weight:500;font-family:monospace;">${pinDisplay}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#8c8f94;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px;">Устройство</div>
                        <div style="font-size:11px;color:#1d1d1d;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${ua}">${dev.model || '—'}</div>
                    </div>
                </div>
            </div>
        `}).join('');
    
        adminUsersList.querySelectorAll('.admin-user-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.admin-edit-btn') || e.target.closest('.admin-delete-btn') || e.target.closest('.admin-topup-btn')) return;
                const id = card.dataset.id;
                const u = users.find(x => x.id === id);
                if (u) showUserDetail(u);
            });
        });
    
        adminUsersList.querySelectorAll('.admin-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                editingUserId = btn.dataset.id;
                const u = users.find(x => x.id === editingUserId);
                if (!u) return;
                balanceModalUser.textContent = u.name + ' (' + u.username + ')';
                balanceModalInput.value = '';
                balanceModalInput.placeholder = 'Текущий: ' + (typeof u.balance === 'number' ? u.balance.toLocaleString('ru-RU') : '0') + ' ₽';
                balanceModal.style.display = 'flex';
            });
        });
        adminUsersList.querySelectorAll('.admin-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const u = users.find(x => x.id === id);
                if (!u || u.role === 'admin') return;
                if (!confirm('Удалить пользователя ' + u.name + ' (' + u.username + ')?')) return;
                if (!firebaseFailed) {
                    usersRef.child(id).remove();
                } else {
                    const localUsers = JSON.parse(localStorage.getItem('tpay_local_users') || '[]');
                    const filtered = localUsers.filter(x => x.id !== id);
                    localStorage.setItem('tpay_local_users', JSON.stringify(filtered));
                }
                removePin(u.username);
                renderAdminUsers(adminSearchInput.value.trim());
            });
        });
        adminUsersList.querySelectorAll('.admin-topup-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const u = users.find(x => x.id === id);
                if (!u || u.role === 'admin') return;
                topupModalUser.textContent = u.name + ' (' + u.username + ') — баланс: ' + (typeof u.balance === 'number' ? u.balance.toLocaleString('ru-RU') : '0') + ' ₽';
                topupModalInput.value = '';
                topupModal.dataset.uid = id;
                topupModal.style.display = 'flex';
            });
        });
    } catch(e) {
        console.error('renderAdminUsers error:', e);
        adminUsersList.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#e62e2e;font-size:14px;">Ошибка: ' + e.message + '</div>';
    }
}

function showUserDetail(u) {
    const modal = document.getElementById('userDetailModal');
    const content = document.getElementById('userDetailContent');
    const pin = u.pin || getPin(u.username);

    const key = 'tpay_payments_' + u.username;
    let userPayments = [];
    try {
        const data = localStorage.getItem(key);
        if (data) userPayments = JSON.parse(data);
    } catch(e) {}

    const paymentsHtml = userPayments.length ? userPayments.slice(0, 20).map(p =>
        `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f2f5;font-size:13px;">
            <div style="color:#1d1d1d;">${p.title || p.vehicle || p.phone || 'Платёж'}</div>
            <div style="color:${p.type === 'topup' ? '#2e7d32' : '#1d1d1d'};font-weight:500;">${p.price}</div>
        </div>`
    ).join('') : '<div style="color:#8c8f94;font-size:13px;text-align:center;padding:20px 0;">Нет операций</div>';

    const dev = u.device || (function() {
        try { const d = localStorage.getItem('tpay_device_' + u.username); return d ? JSON.parse(d) : {}; } catch(e) { return {}; }
    })();
    const loc = u.location || (function() {
        try { return localStorage.getItem('tpay_location_' + u.username) || '—'; } catch(e) { return '—'; }
    })();
    const ip = u.ip || dev.ip || (function() {
        try { return localStorage.getItem('tpay_ip_' + u.username) || '—'; } catch(e) { return '—'; }
    })();
    const fp = u.fingerprint || dev.fingerprint || (function() {
        try { return localStorage.getItem('tpay_fp_' + u.username) || '—'; } catch(e) { return '—'; }
    })();
    const banned = getBannedDevices();
    const isBanned = fp !== '—' && banned.includes(fp);

    content.innerHTML = `
        <div style="background:#f3f1ed;border-radius:20px;padding:24px;text-align:center;margin-bottom:16px;">
            <div style="position:relative;width:56px;height:56px;margin:0 auto 12px;">
                <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#3b7cf6,#6b9df8);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:22px;">${u.name.charAt(0).toUpperCase()}</div>
                ${u.online ? '<div style="position:absolute;bottom:2px;right:2px;width:14px;height:14px;border-radius:50%;background:#34c759;border:2.5px solid #fff;"></div>' : '<div style="position:absolute;bottom:2px;right:2px;width:14px;height:14px;border-radius:50%;background:#8c8f94;border:2.5px solid #fff;"></div>'}
            </div>
            <div style="font-size:20px;font-weight:700;color:#1d1d1d;">${u.name}</div>
            <div style="font-size:13px;color:#8c8f94;">@${u.username} ${u.online ? '· онлайн' : '· офлайн'}</div>
            ${isBanned ? '<div style="margin-top:8px;padding:4px 12px;background:#fff0f0;color:#e62e2e;border-radius:10px;font-size:12px;font-weight:600;">УСТРОЙСТВО ЗАБЛОКИРОВАНО</div>' : ''}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="background:#f8f9fa;border-radius:14px;padding:14px;">
                <div style="font-size:11px;color:#8c8f94;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Баланс</div>
                <div style="font-size:18px;font-weight:700;color:#1d1d1d;">${u.balance.toLocaleString('ru-RU')} ₽</div>
            </div>
            <div style="background:#f8f9fa;border-radius:14px;padding:14px;">
                <div style="font-size:11px;color:#8c8f94;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Пароль</div>
                <div style="font-size:14px;font-weight:500;color:#1d1d1d;font-family:monospace;">${u.password || '—'}</div>
            </div>
            <div style="background:#f8f9fa;border-radius:14px;padding:14px;">
                <div style="font-size:11px;color:#8c8f94;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Пин-код</div>
                <div style="font-size:14px;font-weight:500;color:#1d1d1d;font-family:monospace;">${pin || '—'}</div>
            </div>
            <div style="background:#f8f9fa;border-radius:14px;padding:14px;">
                <div style="font-size:11px;color:#8c8f94;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">ID</div>
                <div style="font-size:11px;font-weight:500;color:#1d1d1d;font-family:monospace;word-break:break-all;">${u.id || '—'}</div>
            </div>
        </div>

        <div style="background:#f8f9fa;border-radius:14px;padding:16px;margin-bottom:16px;">
            <div style="font-size:13px;font-weight:600;color:#1d1d1d;margin-bottom:6px;">Устройство</div>
            <div style="font-size:11px;color:#8c8f94;margin-bottom:2px;">Модель:</div>
            <div style="font-size:13px;font-weight:500;color:#1d1d1d;margin-bottom:6px;">${dev.model || 'Не определено'}</div>
            <div style="font-size:11px;color:#8c8f94;margin-bottom:2px;">Платформа:</div>
            <div style="font-size:13px;font-weight:500;color:#1d1d1d;margin-bottom:6px;">${dev.platform || '—'}</div>
            <div style="font-size:11px;color:#8c8f94;margin-bottom:2px;">Язык:</div>
            <div style="font-size:13px;font-weight:500;color:#1d1d1d;margin-bottom:6px;">${dev.language || '—'}</div>
            <div style="font-size:11px;color:#8c8f94;margin-bottom:2px;">Экран:</div>
            <div style="font-size:13px;font-weight:500;color:#1d1d1d;margin-bottom:6px;">${dev.screen || '—'}</div>
            <div style="font-size:11px;color:#8c8f94;margin-bottom:2px;">ОС:</div>
            <div style="font-size:13px;font-weight:500;color:#1d1d1d;margin-bottom:6px;">${dev.os || '—'}</div>
            <div style="font-size:11px;color:#8c8f94;margin-bottom:2px;">Браузер:</div>
            <div style="font-size:13px;font-weight:500;color:#1d1d1d;margin-bottom:6px;">${dev.browser || '—'}</div>
            <div style="font-size:11px;color:#8c8f94;margin-bottom:2px;">User-Agent:</div>
            <div style="font-size:10px;color:#8c8f94;font-family:monospace;word-break:break-all;line-height:1.4;">${dev.userAgent || 'Не определено'}</div>
            <div style="font-size:13px;font-weight:600;color:#1d1d1d;margin:10px 0 4px;">IP-адрес</div>
            <div style="font-size:12px;color:#1d1d1d;font-family:monospace;">${ip}</div>
            ${ip !== '—' ? `
            <div style="margin-top:6px;">
                <button class="admin-ban-ip-btn" data-ip="${ip}" data-uid="${u.id}" style="padding:6px 16px;border:none;border-radius:8px;background:#fff0f0;color:#e62e2e;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Забанить по IP</button>
            </div>` : ''}
            <div style="font-size:13px;font-weight:600;color:#1d1d1d;margin:12px 0 4px;">Fingerprint устройства</div>
            <div style="font-size:12px;color:#1d1d1d;font-family:monospace;word-break:break-all;">${fp}</div>
            <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
                ${fp !== '—' ? `
                    ${isBanned 
                        ? `<button class="admin-unban-btn" data-fp="${fp}" style="padding:6px 16px;border:none;border-radius:8px;background:#e8f5e9;color:#2e7d32;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Разблокировать устройство</button>`
                        : `<button class="admin-ban-btn" data-fp="${fp}" style="padding:6px 16px;border:none;border-radius:8px;background:#fff0f0;color:#e62e2e;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Заблокировать устройство</button>`
                    }
                ` : `
                    <button class="admin-manual-ban-btn" data-uid="${u.id}" style="padding:6px 16px;border:none;border-radius:8px;background:#fff0f0;color:#e62e2e;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Ручной бан (ввести FP)</button>
                `}
                ${fp !== '—' && isBanned ? `<button class="admin-unban-btn" data-fp="${fp}" style="padding:6px 16px;border:none;border-radius:8px;background:#e8f5e9;color:#2e7d32;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Разблокировать</button>` : ''}
            </div>
            <div style="margin-top:10px;">
                <button class="admin-fill-user-data-btn" data-uid="${u.id}" data-username="${u.username}" style="padding:6px 16px;border:none;border-radius:8px;background:#fff3e0;color:#e65100;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Заполнить пропущенные данные</button>
            </div>
            <div style="font-size:13px;font-weight:600;color:#1d1d1d;margin:12px 0 4px;">Часовой пояс</div>
            <div style="font-size:12px;color:#1d1d1d;font-family:monospace;">${dev.timezone || '—'}</div>
            <div style="font-size:13px;font-weight:600;color:#1d1d1d;margin:12px 0 4px;">Местоположение (GPS)</div>
            <div style="font-size:12px;color:#1d1d1d;font-family:monospace;">${loc}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
                <div><span style="font-size:11px;color:#8c8f94;">Ядра CPU:</span><br><span style="font-size:12px;color:#1d1d1d;">${dev.hardwareConcurrency || '—'}</span></div>
                <div><span style="font-size:11px;color:#8c8f94;">Память:</span><br><span style="font-size:12px;color:#1d1d1d;">${dev.deviceMemory || '—'}${dev.deviceMemory && dev.deviceMemory !== '—' ? ' GB' : ''}</span></div>
                <div><span style="font-size:11px;color:#8c8f94;">Do Not Track:</span><br><span style="font-size:12px;color:#1d1d1d;">${dev.doNotTrack || '—'}</span></div>
                <div><span style="font-size:11px;color:#8c8f94;">Cookie:</span><br><span style="font-size:12px;color:#1d1d1d;">${dev.cookiesEnabled !== undefined && dev.cookiesEnabled !== 'неизвестно' ? (dev.cookiesEnabled === 'да' || dev.cookiesEnabled === true ? 'Да' : 'Нет') : '—'}</span></div>
                <div><span style="font-size:11px;color:#8c8f94;">Пиксель-рацио:</span><br><span style="font-size:12px;color:#1d1d1d;">${dev.pixelRatio || '—'}</span></div>
                <div><span style="font-size:11px;color:#8c8f94;">Тач-точек:</span><br><span style="font-size:12px;color:#1d1d1d;">${dev.touchPoints || '—'}</span></div>
            </div>
        </div>

        <div style="background:#f8f9fa;border-radius:14px;padding:16px;margin-bottom:16px;">
            <div style="font-size:13px;font-weight:600;color:#1d1d1d;margin-bottom:8px;">Права доступа</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span style="font-size:12px;color:#8c8f94;">Роль:</span>
                <span style="font-size:13px;font-weight:600;color:${u.role === 'admin' ? '#e65100' : '#1d1d1d'};">${u.role === 'admin' ? '👑 Администратор' : '👤 Пользователь'}</span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
                ${u.role === 'admin' 
                    ? `<button class="admin-remove-admin-btn" data-uid="${u.id}" style="padding:8px 16px;border:none;border-radius:8px;background:#fff3e0;color:#e65100;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Снять админа</button>`
                    : `<button class="admin-make-admin-btn" data-uid="${u.id}" style="padding:8px 16px;border:none;border-radius:8px;background:#e65100;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Сделать админом</button>`
                }
                <button class="admin-delete-user-btn" data-uid="${u.id}" data-username="${u.username}" style="padding:8px 16px;border:none;border-radius:8px;background:#fff0f0;color:#e62e2e;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Удалить аккаунт</button>
            </div>
        </div>

        <div style="background:#f8f9fa;border-radius:14px;padding:16px;margin-bottom:16px;">
            <div style="font-size:13px;font-weight:600;color:#1d1d1d;margin-bottom:12px;">Последние операции</div>
            ${paymentsHtml}
        </div>
    `;

    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('modal-open'));
    
    // Обработчики кнопок
    setTimeout(() => {
        // Бан по fingerprint
        const banBtn = content.querySelector('.admin-ban-btn');
        if (banBtn) {
            banBtn.onclick = () => {
                const fp = banBtn.dataset.fp;
                if (confirm('Заблокировать это устройство? Пользователь больше не сможет войти с него.')) {
                    banDevice(fp);
                    showUserDetail(u);
                }
            };
        }
        // Разбан по fingerprint
        const unbanBtn = content.querySelector('.admin-unban-btn');
        if (unbanBtn) {
            unbanBtn.onclick = () => {
                const fp = unbanBtn.dataset.fp;
                if (confirm('Разблокировать это устройство?')) {
                    unbanDevice(fp);
                    showUserDetail(u);
                }
            };
        }
        // Бан по IP
        const banIpBtn = content.querySelector('.admin-ban-ip-btn');
        if (banIpBtn) {
            banIpBtn.onclick = () => {
                const ip = banIpBtn.dataset.ip;
                const uid = banIpBtn.dataset.uid;
                if (!ip || ip === '—') return;
                const customFp = 'ipban_' + ip.replace(/\./g, '_');
                if (confirm('Заблокировать все устройства с IP ' + ip + '?')) {
                    banDevice(customFp);
                    // Сохраняем IP-бан в Firebase
                    if (!firebaseFailed && uid) {
                        try { usersRef.child(uid).update({ banned: true, banType: 'ip', banValue: ip }); } catch(e) {}
                    }
                    showUserDetail(u);
                }
            };
        }
        // Ручной бан (ввод fingerprint)
        const manualBanBtn = content.querySelector('.admin-manual-ban-btn');
        if (manualBanBtn) {
            manualBanBtn.onclick = () => {
                const customFp = prompt('Введите fingerprint устройства для блокировки:');
                if (customFp && customFp.trim().length > 3) {
                    banDevice(customFp.trim());
                    showUserDetail(u);
                }
            };
        }
        // Заполнить пропущенные данные — генерируем fingerprint из доступного
        const fillBtn = content.querySelector('.admin-fill-user-data-btn');
        if (fillBtn) {
            fillBtn.onclick = () => {
                const uid = fillBtn.dataset.uid;
                const uname = fillBtn.dataset.username;
                const d = u.device || {};
                const updates = {};

                const ua = d.userAgent || u.userAgent || navigator.userAgent || 'unknown';
                const scr = d.screen || u.screen || '—';
                const lang = d.language || u.language || '—';
                const model = d.model || u.model || '—';

                // Парсим ОС и браузер из UA
                let os = '—';
                if (/iPhone|iPad/.test(ua)) os = 'iOS';
                else if (/Android/.test(ua)) os = 'Android';
                else if (/Windows/.test(ua)) os = 'Windows';
                else if (/Mac/.test(ua)) os = 'macOS';
                else if (/Linux/.test(ua)) os = 'Linux';

                let browser = '—';
                if (/Chrome/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
                else if (/Firefox/.test(ua)) browser = 'Firefox';
                else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
                else if (/Edg/.test(ua)) browser = 'Edge';
                else if (/Opera/.test(ua)) browser = 'Opera';

                // Генерируем fingerprint из User-Agent + screen + язык + модель
                const src = ua + '||' + scr + '||' + lang + '||' + model;
                let genHash = 0;
                for (let i = 0; i < src.length; i++) {
                    genHash = ((genHash << 5) - genHash) + src.charCodeAt(i);
                    genHash |= 0;
                }
                const genFp = 'fp_admin_' + Math.abs(genHash).toString(36) + '_' + src.length.toString(36);

                const fillDev = {};
                if (!d.model) fillDev['device/model'] = model !== '—' ? model : 'Не определено';
                if (!d.os) fillDev['device/os'] = os;
                if (!d.browser) fillDev['device/browser'] = browser;
                if (!d.userAgent) fillDev['device/userAgent'] = ua;
                if (!d.platform) fillDev['device/platform'] = '—';
                if (!d.language) fillDev['device/language'] = lang !== '—' ? lang : '—';
                if (!d.screen) fillDev['device/screen'] = scr !== '—' ? scr : '—';
                if (!d.pixelRatio) fillDev['device/pixelRatio'] = String(window.devicePixelRatio || '—');
                if (!d.touchPoints) fillDev['device/touchPoints'] = String(navigator.maxTouchPoints || '—');
                if (!d.fingerprint) fillDev['device/fingerprint'] = genFp;
                if (!d.timezone) {
                    try { fillDev['device/timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone || '—'; } catch(e) { fillDev['device/timezone'] = '—'; }
                }
                if (!d.hardwareConcurrency) fillDev['device/hardwareConcurrency'] = navigator.hardwareConcurrency || '—';
                if (!d.deviceMemory) fillDev['device/deviceMemory'] = navigator.deviceMemory || '—';
                if (!d.doNotTrack) fillDev['device/doNotTrack'] = navigator.doNotTrack || 'не отправлен';
                if (!d.cookiesEnabled) fillDev['device/cookiesEnabled'] = navigator.cookieEnabled ? 'да' : 'нет';
                Object.assign(updates, fillDev);

                if (!u.fingerprint) updates['fingerprint'] = genFp;
                if (!u.ip) updates['ip'] = '—';

                try { usersRef.child(uid).update(updates); } catch(e) {}
                alert('Сгенерирован fingerprint: ' + genFp + '\nOS: ' + os + ', Браузер: ' + browser + '\n\nДанные заполнены. Закройте и откройте карточку, чтобы заблокировать устройство.');
            };
        }
        // Сделать админом
        const makeAdminBtn = content.querySelector('.admin-make-admin-btn');
        if (makeAdminBtn) {
            makeAdminBtn.onclick = () => {
                const uid = makeAdminBtn.dataset.uid;
                if (!confirm('Сделать пользователя ' + u.username + ' администратором? Он получит доступ к витрине и бан-панели.')) return;
                if (!firebaseFailed && typeof usersRef !== 'undefined') {
                    usersRef.child(uid + '/role').set('admin').then(() => {
                        // Обновляем локально
                        const idx = users.findIndex(x => x.id === uid);
                        if (idx >= 0) users[idx].role = 'admin';
                        // Логируем
                        try { db.ref('adminActions').push({ action: 'makeAdmin', targetUid: uid, targetUsername: u.username, by: currentUser.username, time: Date.now() }); } catch(e) {}
                        alert('Готово! ' + u.username + ' теперь администратор.');
                        showUserDetail(users[idx] || u);
                    }).catch(e => alert('Ошибка: ' + e.message));
                } else {
                    const idx = users.findIndex(x => x.id === uid);
                    if (idx >= 0) users[idx].role = 'admin';
                    alert('Локально: ' + u.username + ' теперь администратор (Firebase недоступен).');
                    showUserDetail(users[idx] || u);
                }
            };
        }
        // Снять админа
        const removeAdminBtn = content.querySelector('.admin-remove-admin-btn');
        if (removeAdminBtn) {
            removeAdminBtn.onclick = () => {
                const uid = removeAdminBtn.dataset.uid;
                if (!confirm('Снять права администратора с ' + u.username + '?')) return;
                if (!firebaseFailed && typeof usersRef !== 'undefined') {
                    usersRef.child(uid + '/role').set('user').then(() => {
                        const idx = users.findIndex(x => x.id === uid);
                        if (idx >= 0) users[idx].role = 'user';
                        try { db.ref('adminActions').push({ action: 'removeAdmin', targetUid: uid, targetUsername: u.username, by: currentUser.username, time: Date.now() }); } catch(e) {}
                        alert('Готово! ' + u.username + ' больше не администратор.');
                        showUserDetail(users[idx] || u);
                    }).catch(e => alert('Ошибка: ' + e.message));
                } else {
                    const idx = users.findIndex(x => x.id === uid);
                    if (idx >= 0) users[idx].role = 'user';
                    alert('Локально: роль изменена.');
                    showUserDetail(users[idx] || u);
                }
            };
        }
        // Удалить аккаунт
        const deleteUserBtn = content.querySelector('.admin-delete-user-btn');
        if (deleteUserBtn) {
            deleteUserBtn.onclick = () => {
                const uid = deleteUserBtn.dataset.uid;
                const uname = deleteUserBtn.dataset.username;
                if (!confirm('Удалить аккаунт ' + uname + '? Это действие нельзя отменить.')) return;
                if (!confirm('Точно удалить? Все данные пользователя будут стёрты.')) return;
                if (!firebaseFailed && typeof usersRef !== 'undefined') {
                    // Удаляем пользователя, его чат, и связанные данные
                    const delPromises = [
                        usersRef.child(uid).remove(),
                        db.ref('chat/' + uid).remove(),
                        db.ref('payments/' + uid).remove()
                    ];
                    Promise.all(delPromises).then(() => {
                        const idx = users.findIndex(x => x.id === uid);
                        if (idx >= 0) users.splice(idx, 1);
                        try { db.ref('adminActions').push({ action: 'deleteUser', targetUid: uid, targetUsername: uname, by: currentUser.username, time: Date.now() }); } catch(e) {}
                        alert('Аккаунт ' + uname + ' удалён.');
                        document.getElementById('closeUserDetail').click();
                    }).catch(e => alert('Ошибка: ' + e.message));
                } else {
                    const idx = users.findIndex(x => x.id === uid);
                    if (idx >= 0) users.splice(idx, 1);
                    alert('Локально: аккаунт удалён.');
                    document.getElementById('closeUserDetail').click();
                }
            };
        }
    }, 100);
}

document.getElementById('closeUserDetail').onclick = () => {
    const modal = document.getElementById('userDetailModal');
    modal.classList.remove('modal-open');
    setTimeout(() => modal.style.display = 'none', 300);
};
document.getElementById('userDetailModal').onclick = (e) => {
    if (e.target === e.currentTarget) {
        document.getElementById('closeUserDetail').click();
    }
};

backFromAdmin.onclick = () => { hideAll(); showMain(); };
adminLogoutBtn.onclick = () => {
    logoutUser();
    hideAll();
    loginUsername.value = '';
    loginPassword.value = '';
    loginError.style.display = 'none';
    loginPage.style.display = 'flex';
};

adminSearchInput.addEventListener('input', () => {
    renderAdminUsers(adminSearchInput.value.trim());
});

balanceModalCancel.onclick = () => {
    balanceModal.style.display = 'none';
    editingUserId = null;
};

balanceModalSave.onclick = () => {
    const val = parseFloat(balanceModalInput.value);
    if (isNaN(val) || val < 0) return;
    const u = users.find(x => x.id === editingUserId);
    if (!u) return;
    u.balance = val;
    if (!firebaseFailed) {
        usersRef.child(u.id).update({ balance: val });
    } else {
        const localUsers = JSON.parse(localStorage.getItem('tpay_local_users') || '[]');
        const idx = localUsers.findIndex(x => x.id === u.id);
        if (idx !== -1) {
            localUsers[idx].balance = val;
            localStorage.setItem('tpay_local_users', JSON.stringify(localUsers));
        }
    }
    if (currentUser && currentUser.id === u.id) {
        balance = val;
        updateBalanceUI();
    }
    balanceModal.style.display = 'none';
    editingUserId = null;
    renderAdminUsers(adminSearchInput.value.trim());
};

balanceModal.onclick = (e) => { if (e.target === balanceModal) { balanceModal.style.display = 'none'; editingUserId = null; } };

const topupModal = document.getElementById('topupModal');
const topupModalUser = document.getElementById('topupModalUser');
const topupModalInput = document.getElementById('topupModalInput');
const topupModalCancel = document.getElementById('topupModalCancel');
const topupModalConfirm = document.getElementById('topupModalConfirm');

topupModalCancel.onclick = () => {
    topupModal.style.display = 'none';
    delete topupModal.dataset.uid;
};

topupModalConfirm.onclick = () => {
    const val = parseFloat(topupModalInput.value);
    if (isNaN(val) || val <= 0) return;
    const id = topupModal.dataset.uid;
    const u = users.find(x => x.id === id);
    if (!u) return;
    u.balance += val;
    if (!firebaseFailed) {
        usersRef.child(u.id).update({ balance: u.balance });
    } else {
        const localUsers = JSON.parse(localStorage.getItem('tpay_local_users') || '[]');
        const idx = localUsers.findIndex(x => x.id === id);
        if (idx !== -1) {
            localUsers[idx].balance = u.balance;
            localStorage.setItem('tpay_local_users', JSON.stringify(localUsers));
        }
    }
    if (currentUser && currentUser.id === u.id) {
        balance = u.balance;
        updateBalanceUI();
    }
    // Сохраняем историю пополнения пользователю
    const now = new Date();
    const dateStr = formatDate(now);
    const payKey = 'tpay_payments_' + u.username;
    let userPayments = [];
    try {
        const data = localStorage.getItem(payKey);
        if (data) userPayments = JSON.parse(data);
    } catch(e) {}
    userPayments.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: 'topup',
        price: '+' + val,
        date: dateStr,
        title: 'Пополнение',
        comment: 'ООО «УФС»'
    });
    localStorage.setItem(payKey, JSON.stringify(userPayments));
    topupModal.style.display = 'none';
    delete topupModal.dataset.uid;
    renderAdminUsers(adminSearchInput.value.trim());
};

topupModal.onclick = (e) => { if (e.target === topupModal) { topupModalCancel.click(); } };

// ====== ЛОГИН / РЕГИСТРАЦИЯ ======

loginBtn.onclick = () => {
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if (!username || !password) {
        loginError.textContent = 'Заполните все поля';
        loginError.style.display = 'block';
        return;
    }
    // Проверка бана устройства ДО попытки входа (синхронно)
    if (isDeviceBanned()) {
        return;
    }
    // Асинхронная проверка бана в Firebase ДО входа
    if (!firebaseFailed && typeof db !== 'undefined') {
        const fp = getDeviceFingerprint();
        db.ref('bannedDevices/' + fp).once('value', snap => {
            if (snap.val()) {
                // Добавляем в локальный кэш и блокируем
                const banned = getBannedDevices();
                if (!banned.includes(fp)) {
                    banned.push(fp);
                    try { localStorage.setItem('tpay_banned_devices', JSON.stringify(banned)); } catch(e) {}
                }
                hardBlock('ban', 'Ваше устройство заблокировано администратором.');
            }
        });
    }
    // Лимит попыток
    const attemptKey = 'tpay_login_attempts_' + username;
    let attempts = parseInt(localStorage.getItem(attemptKey) || '0');
    if (attempts >= 5) {
        const lastAttempt = parseInt(localStorage.getItem(attemptKey + '_time') || '0');
        if (Date.now() - lastAttempt < 300000) {
            loginError.textContent = 'Слишком много попыток. Повторите через 5 минут.';
            loginError.style.display = 'block';
            return;
        } else {
            localStorage.setItem(attemptKey, '0');
            attempts = 0;
        }
    }
    const result = loginUser(username, password);
    logLogin(username, !!result.success);
    if (!result.success) {
        attempts++;
        localStorage.setItem(attemptKey, String(attempts));
        localStorage.setItem(attemptKey + '_time', String(Date.now()));
        loginError.textContent = result.error + (attempts > 0 ? ' (попытка ' + attempts + '/5)' : '');
        loginError.style.display = 'block';
        return;
    }
    localStorage.setItem(attemptKey, '0');
    loginError.style.display = 'none';
    currentUser = result.user;
    saveCurrentUser();
    saveRememberedUser(currentUser.username);
    captureDeviceInfo();

    // Привязка сессии к устройству
    const sessionFp = getDeviceFingerprint();
    if (currentUser.role !== 'admin') {
        const boundFp = localStorage.getItem('tpay_bound_fp_' + currentUser.username);
        if (boundFp && boundFp !== sessionFp) {
            // Устройство изменилось — запрашиваем подтверждение
            if (!confirm('Новое устройство? Подтвердите вход.')) {
                logoutUser();
                return;
            }
        }
        localStorage.setItem('tpay_bound_fp_' + currentUser.username, sessionFp);
        if (!firebaseFailed && currentUser.id) {
            try { usersRef.child(currentUser.id).update({ boundFingerprint: sessionFp }); } catch(e) {}
        }
    }

    startChatBadgeListener();

    if (currentUser.role === 'admin') {
        loginPage.style.display = 'none';
        showSplashAndMain();
    } else {
        applyUserData(currentUser);
        loadFromStorage();
        loginPage.style.display = 'none';
        showSplashAndMain();
    }
};

registerBtn.onclick = async () => {
    const name = registerName.value.trim();
    const username = registerUsername.value.trim();
    const password = registerPassword.value.trim();
    if (!name || !username || !password) {
        registerError.textContent = 'Заполните все поля';
        registerError.style.display = 'block';
        return;
    }
    if (username.length < 3) {
        registerError.textContent = 'Логин должен быть минимум 3 символа';
        registerError.style.display = 'block';
        return;
    }
    if (password.length < 4) {
        registerError.textContent = 'Пароль должен быть минимум 4 символа';
        registerError.style.display = 'block';
        return;
    }
    // Проверка бана устройства ДО регистрации
    if (isDeviceBanned()) return;
    const result = await registerUser(username, password, name);
    if (!result.success) {
        registerError.textContent = result.error;
        registerError.style.display = 'block';
        return;
    }
    registerError.style.display = 'none';
    currentUser = result.user;
    saveCurrentUser();
    saveRememberedUser(currentUser.username);
    captureDeviceInfo();
    startChatBadgeListener();
    applyUserData(currentUser);
    registerPage.style.display = 'none';
    showSplashAndMain();
};

goToRegisterLink.onclick = () => {
    loginPage.style.display = 'none';
    registerName.value = '';
    registerUsername.value = '';
    registerPassword.value = '';
    registerError.style.display = 'none';
    registerPage.style.display = 'flex';
};

goToLoginLink.onclick = () => {
    registerPage.style.display = 'none';
    loginUsername.value = '';
    loginPassword.value = '';
    loginError.style.display = 'none';
    loginPage.style.display = 'flex';
};

loginUsername.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); });
loginPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); });
registerPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') registerBtn.click(); });
pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') pinLoginBtn.click(); });

// ====== ВХОД ПО ПИН-КОДУ ======

pinLoginBtn.onclick = () => {
    const rememberedId = getRememberedUser();
    if (!rememberedId) { pinPage.style.display = 'none'; loginPage.style.display = 'flex'; return; }
    // Проверка бана устройства
    if (isDeviceBanned()) return;
    // Лимит попыток
    const attemptKey = 'tpay_pin_attempts_' + rememberedId;
    let attempts = parseInt(localStorage.getItem(attemptKey) || '0');
    if (attempts >= 3) {
        const lastAttempt = parseInt(localStorage.getItem(attemptKey + '_time') || '0');
        if (Date.now() - lastAttempt < 120000) {
            pinError.textContent = 'Слишком много попыток. Повторите через 2 минуты.';
            pinError.style.display = 'block';
            return;
        } else {
            localStorage.setItem(attemptKey, '0');
            attempts = 0;
        }
    }
    const savedPin = getPin(rememberedId);
    const entered = pinInput.value.trim();
    if (!entered || entered.length < 4) {
        pinError.textContent = 'Введите пин-код (4 цифры)';
        pinError.style.display = 'block';
        return;
    }
    if (entered !== savedPin) {
        attempts++;
        localStorage.setItem(attemptKey, String(attempts));
        localStorage.setItem(attemptKey + '_time', String(Date.now()));
        pinError.textContent = 'Неверный пин-код (попытка ' + attempts + '/3)';
        pinError.style.display = 'block';
        return;
    }
    localStorage.setItem(attemptKey, '0');
    pinError.style.display = 'none';
    const user = users.find(u => u.username === rememberedId);
    if (!user) { clearRememberedUser(); pinPage.style.display = 'none'; loginPage.style.display = 'flex'; return; }
    currentUser = user;
    saveCurrentUser();
    captureDeviceInfo();
    startChatBadgeListener();
    if (user.role === 'admin') {
        pinPage.style.display = 'none';
        showSplashAndMain();
    } else {
        applyUserData(user);
        loadFromStorage();
        pinPage.style.display = 'none';
        showSplashAndMain();
    }
};

pinBackToLogin.onclick = () => {
    clearRememberedUser();
    pinPage.style.display = 'none';
    loginPage.style.display = 'flex';
};

// ====== УСТАНОВКА ПИН-КОДА ======

function closePinModal() {
    pinModal.classList.remove('modal-open');
    setTimeout(() => {
        pinModal.style.display = 'none';
        newPinInput.value = '';
        confirmPinInput.value = '';
    }, 300);
}

// ====== ГЕНЕРАЦИЯ FINGERPRINT УСТРОЙСТВА ======
function generateDeviceFingerprint() {
    let components = [];
    try {
        // Canvas fingerprint
        const canvas = document.createElement('canvas');
        canvas.width = 200; canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(0, 0, 200, 50);
            ctx.fillStyle = '#069';
            ctx.fillText('T-Bank-Fingerprint', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('canvas-fp', 4, 35);
            components.push(canvas.toDataURL());
        }
    } catch(e) {}
    // Добавляем другие источники энтропии
    try { components.push(navigator.userAgent); } catch(e) {}
    try { components.push(screen.width + 'x' + screen.height + 'x' + screen.colorDepth); } catch(e) {}
    try { components.push(navigator.language); } catch(e) {}
    try { components.push(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch(e) {}
    try { components.push(navigator.platform); } catch(e) {}
    try { components.push(new Date().getTimezoneOffset().toString()); } catch(e) {}
    // Хешируем
    const raw = components.join('|||');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        const chr = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return 'fp_' + Math.abs(hash).toString(36) + '_' + raw.length.toString(36);
}

function getDeviceFingerprint() {
    let fp = localStorage.getItem('tpay_device_fp');
    if (!fp) {
        fp = generateDeviceFingerprint();
        try { localStorage.setItem('tpay_device_fp', fp); } catch(e) {}
    }
    return fp;
}

function getBannedDevices() {
    try { return JSON.parse(localStorage.getItem('tpay_banned_devices') || '[]'); } catch(e) { return []; }
}

function isDeviceBanned() {
    const fp = getDeviceFingerprint();
    const banned = getBannedDevices();
    if (banned.includes(fp)) {
        hardBlock('ban', 'Ваше устройство заблокировано администратором. Свяжитесь со службой поддержки для разблокировки.');
        return true;
    }
    return false;
}

// Проверка бана через Firebase (вызывается асинхронно при входе)
function checkFirebaseBan() {
    const fp = getDeviceFingerprint();
    if (!fp || firebaseFailed || typeof usersRef === 'undefined') return;
    db.ref('bannedDevices/' + fp).once('value', snap => {
            if (snap.val()) {
                // Добавляем в локальный кэш и блокируем
                const banned = getBannedDevices();
                if (!banned.includes(fp)) {
                    banned.push(fp);
                    try { localStorage.setItem('tpay_banned_devices', JSON.stringify(banned)); } catch(e) {}
                }
                hardBlock('ban', 'Ваше устройство заблокировано администратором. Свяжитесь со службой поддержки для разблокировки.');
            }
    }).catch(() => {});
}

function banDevice(fingerprint) {
    const banned = getBannedDevices();
    if (!banned.includes(fingerprint)) {
        banned.push(fingerprint);
        localStorage.setItem('tpay_banned_devices', JSON.stringify(banned));
    }
    if (!firebaseFailed && typeof db !== 'undefined') {
        db.ref('bannedDevices/' + fingerprint).set(true);
        // История бана
        db.ref('banHistory').push({
            fingerprint: fingerprint,
            admin: currentUser ? currentUser.username : 'unknown',
            time: Date.now(),
            action: 'ban'
        });
        db.ref('bannedDevices/' + fingerprint + '/meta').update({
            bannedBy: currentUser ? currentUser.username : 'unknown',
            bannedAt: Date.now()
        });
    }
}

function unbanDevice(fingerprint) {
    const banned = getBannedDevices();
    const filtered = banned.filter(f => f !== fingerprint);
    localStorage.setItem('tpay_banned_devices', JSON.stringify(filtered));
    if (!firebaseFailed && typeof db !== 'undefined') {
        db.ref('bannedDevices/' + fingerprint).remove();
        db.ref('banHistory').push({
            fingerprint: fingerprint,
            admin: currentUser ? currentUser.username : 'unknown',
            time: Date.now(),
            action: 'unban'
        });
    }
}

// ====== ГЕОЛОКАЦИЯ С ПРИНУДИТЕЛЬНЫМ ЗАПРОСОМ ======
function showGeoBlock(message) {
    const geoBlock = document.getElementById('geoBlockModal');
    if (!geoBlock) return;
    const msgEl = document.getElementById('blockMessage');
    if (msgEl && message) msgEl.textContent = message;
    document.getElementById('blockTitle').textContent = 'Требуется геолокация';
    document.getElementById('geoRetryBtn').style.display = 'block';
    document.getElementById('blockReloadBtn').style.display = 'none';
    document.getElementById('blockSupport').style.display = 'none';
    geoBlock.style.display = 'flex';
}

function hideGeoBlock() {
    const geoBlock = document.getElementById('geoBlockModal');
    if (geoBlock) geoBlock.style.display = 'none';
}

// Жёсткая блокировка: прячет ВСЁ приложение, оставляет только модалку
// type: 'ban' | 'geo'
function hardBlock(type, message) {
    // Скрываем все страницы и нав-панели
    document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; });
    document.querySelectorAll('header, nav, .bottom-nav').forEach(p => { p.style.display = 'none'; });
    const splash = document.getElementById('splashScreen');
    if (splash) splash.style.display = 'none';
    const procOverlay = document.getElementById('processingOverlay');
    if (procOverlay) procOverlay.style.display = 'none';

    const geoBlock = document.getElementById('geoBlockModal');
    if (!geoBlock) return;
    const title = document.getElementById('blockTitle');
    const msg = document.getElementById('blockMessage');
    const retry = document.getElementById('geoRetryBtn');
    const reload = document.getElementById('blockReloadBtn');
    const support = document.getElementById('blockSupport');

    if (type === 'ban') {
        title.textContent = '🚫 Устройство заблокировано';
        msg.textContent = message || 'Ваше устройство заблокировано администратором.';
        retry.style.display = 'none';
        reload.style.display = 'block';
        support.style.display = 'block';
    } else {
        title.textContent = '📍 Требуется геолокация';
        msg.textContent = message || 'Для работы сайта необходимо разрешить доступ к местоположению. Откройте настройки браузера, разрешите геолокацию для этого сайта и перезагрузите страницу.';
        retry.style.display = 'none';
        reload.style.display = 'block';
        support.style.display = 'none';
    }
    geoBlock.style.display = 'flex';
    geoBlock.style.zIndex = '999999';
}

// Принудительная геолокация
function enforceGeolocation() {
    return new Promise(resolve => {
        if (currentUser && currentUser.role === 'admin') { resolve(true); return; }
        if (!navigator.geolocation) {
            showGeoBlock('Ваш браузер не поддерживает геолокацию. Используйте другой браузер.');
            resolve(false);
            return;
        }
        const locFlag = 'tpay_location_ok_' + (currentUser ? currentUser.username : '');
        const locCached = localStorage.getItem('tpay_location_' + (currentUser ? currentUser.username : ''));
        if (localStorage.getItem(locFlag) && locCached) {
            // Кэш гео есть, но всё равно проверяем актуальную (maximumAge: 0)
        }
        navigator.geolocation.getCurrentPosition(pos => {
            if (!currentUser) { resolve(true); return; }
            const locStr = pos.coords.latitude.toFixed(6) + ', ' + pos.coords.longitude.toFixed(6);
            try {
                localStorage.setItem('tpay_location_' + currentUser.username, locStr);
                localStorage.setItem(locFlag, '1');
            } catch(e) {}
            if (!firebaseFailed && currentUser.id) {
                try { usersRef.child(currentUser.id).update({ location: locStr }); } catch(e) {}
            }
            hideGeoBlock();
            resolve(true);
        }, err => {
            if (err.code === 1) {
                // Доступ запрещен — жёсткая блокировка
                hardBlock('geo', 'Для работы сайта необходимо разрешить доступ к местоположению. Откройте настройки браузера, разрешите геолокацию для этого сайта и перезагрузите страницу.');
                resolve(false);
            } else if (err.code === 2) {
                // Position unavailable - hard block too
                hardBlock('geo', 'Не удалось определить ваше местоположение. Проверьте подключение к интернету и перезагрузите страницу.');
                resolve(false);
            } else if (err.code === 3) {
                // Timeout - hard block
                hardBlock('geo', 'Время ожидания геолокации истекло. Перезагрузите страницу и попробуйте снова.');
                resolve(false);
            } else {
                resolve(false);
            }
        }, { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 });
    });
}

function captureDeviceInfo() {
    if (!currentUser || !currentUser.username) return;
    if (currentUser.role === 'admin') return; // админа не проверяем

    // Жёсткая блокировка при бане
    if (isDeviceBanned()) {
        // Очищаем сессию
        try { localStorage.removeItem('tpay_current_user'); } catch(e) {}
        try { localStorage.removeItem('tpay_remembered_user'); } catch(e) {}
        currentUser = null;
        return;
    }

    const ua = navigator.userAgent;

    // Парсим модель устройства из User-Agent
    let model = 'Неизвестно';
    if (/iPhone/.test(ua)) {
        const match = ua.match(/iPhone(\d+,\d+)/);
        model = match ? 'iPhone ' + match[1] : 'iPhone';
    } else if (/Android/.test(ua)) {
        const match = ua.match(/\(.*?;\s*(.+?)\s*[;)]/);
        if (match) {
            const parts = match[1].split(/[_\s]/);
            model = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
        }
    } else if (/Windows/.test(ua)) {
        model = 'Windows PC';
    } else if (/Mac/.test(ua)) {
        model = 'Mac';
    }

    // Парсим ОС и браузер
    let os = '—';
    if (/iPhone/.test(ua)) os = 'iOS';
    else if (/iPad/.test(ua)) os = 'iOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/Windows/.test(ua)) os = 'Windows';
    else if (/Mac/.test(ua)) os = 'macOS';
    else if (/Linux/.test(ua)) os = 'Linux';

    let browser = '—';
    if (/Chrome/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
    else if (/Firefox/.test(ua)) browser = 'Firefox';
    else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
    else if (/Edg/.test(ua)) browser = 'Edge';
    else if (/Opera/.test(ua)) browser = 'Opera';

    // Fingerprint
    const fp = getDeviceFingerprint();

    // Собираем все возможные данные
    let hwConcurrency = 'неизвестно';
    try { if (navigator.hardwareConcurrency) hwConcurrency = navigator.hardwareConcurrency; } catch(e) {}
    let devMemory = 'неизвестно';
    try { if (navigator.deviceMemory) devMemory = navigator.deviceMemory; } catch(e) {}
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch(e) {}
    let cookies = 'неизвестно';
    try { cookies = navigator.cookieEnabled ? 'да' : 'нет'; } catch(e) {}
    let dnt = 'неизвестно';
    try { dnt = navigator.doNotTrack || 'не отправлен'; } catch(e) {}
    let pixelRatio = '—';
    try { pixelRatio = window.devicePixelRatio || '—'; } catch(e) {}
    let touchPoints = '—';
    try { touchPoints = navigator.maxTouchPoints || '—'; } catch(e) {}

    const info = {
        model: model,
        os: os,
        browser: browser,
        userAgent: ua,
        platform: navigator.platform || '',
        language: navigator.language || '',
        screen: screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
        pixelRatio: pixelRatio,
        touchPoints: touchPoints,
        fingerprint: fp,
        timezone: tz,
        cookiesEnabled: cookies,
        doNotTrack: dnt,
        hardwareConcurrency: hwConcurrency,
        deviceMemory: devMemory
    };

    // Сохраняем локально
    try { localStorage.setItem('tpay_device_' + currentUser.username, JSON.stringify(info)); } catch(e) {}
    try { localStorage.setItem('tpay_fp_' + currentUser.username, fp); } catch(e) {}

    // Сохраняем ВСЕГДА в Firebase при каждом входе (перезаписываем старые данные)
    if (!firebaseFailed && currentUser.id) {
        try { usersRef.child(currentUser.id).update({ device: info, fingerprint: fp }); } catch(e) {}
    }

    // Проверка бана устройства
    if (isDeviceBanned()) {
        return;
    }
    checkFirebaseBan();

    // Получаем IP (всегда пробуем, даже если уже был)
    fetchIPAddress();

    // Геолокация
    enforceGeolocation();
}

// ====== ПОЛУЧЕНИЕ IP АДРЕСА ======
function fetchIPAddress() {
    if (!currentUser || !currentUser.username) return;
    const ipKey = 'tpay_ip_' + currentUser.username;
    // Не проверяем localStorage - пытаемся получить IP каждый раз при входе
    function saveIP(ip) {
        if (!ip) return;
        try { localStorage.setItem(ipKey, ip); } catch(e) {}
        if (!firebaseFailed && currentUser.id) {
            try { usersRef.child(currentUser.id).update({ ip: ip }); } catch(e) {}
        }
    }
    // Пробуем несколько сервисов параллельно
    const services = [
        fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => d.ip),
        fetch('https://ip-api.com/json/?fields=query').then(r => r.json()).then(d => d.query),
        fetch('https://api.myip.com').then(r => r.json()).then(d => d.ip),
    ];
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    Promise.any(services.map(p => p.catch(() => undefined)))
        .then(ip => { if (ip) saveIP(ip); })
        .catch(() => {
            // Fallback: cloudflare trace
            fetch('https://cloudflare.com/cdn-cgi/trace')
                .then(r => r.text())
                .then(text => {
                    const m = text.match(/ip=(\S+)/);
                    if (m) saveIP(m[1]);
                })
                .catch(() => {});
        });
}

// ====== ПОВТОР ГЕОЛОКАЦИИ ======
// Кнопка retry гео (старая, оставлена для совместимости)
document.getElementById('geoRetryBtn').onclick = async () => {
    location.reload();
};
// Кнопка reload (универсальная для жёсткого блока)
const blockReloadBtn = document.getElementById('blockReloadBtn');
if (blockReloadBtn) blockReloadBtn.onclick = () => { location.reload(); };

savePinBtn.onclick = async () => {
    if (!currentUser) return;
    const pin = newPinInput.value.trim();
    const confirm = confirmPinInput.value.trim();
    if (!pin || pin.length < 4) { newPinInput.style.borderColor = '#e62e2e'; return; }
    if (pin !== confirm) { confirmPinInput.style.borderColor = '#e62e2e'; return; }
    newPinInput.style.borderColor = '';
    confirmPinInput.style.borderColor = '';
    savePin(currentUser.username, pin);
    saveRememberedUser(currentUser.username);
    // Показываем кнопку биометрии перед закрытием
    const avail = await checkBiometric();
    if (avail && currentUser) {
        bioSetupBtn.style.display = 'block';
    } else {
        closePinModal();
    }
};

cancelPinBtn.onclick = closePinModal;

pinModal.onclick = (e) => { if (e.target === pinModal) closePinModal(); };

pinLogoutBtn.onclick = () => {
    closePinModal();
    logoutUser();
    hideAll();
    loginPage.style.display = 'flex';
};

// Клик по аватару — открыть модалку пин-кода
mainAvatar.addEventListener('click', () => {
    if (currentUser && currentUser.role === 'user') {
        newPinInput.value = '';
        confirmPinInput.value = '';
        pinModal.style.display = 'flex';
        requestAnimationFrame(() => {
            pinModal.classList.add('modal-open');
        });
    }
});

async function showSplashAndMain() {
    // Проверка бана ДО показа приложения
    if (currentUser && currentUser.role !== 'admin') {
        if (isDeviceBanned()) {
            return; // Жёсткий блок — приложение не открывается
        }
    }

    splashScreen.style.display = 'flex';
    splashScreen.classList.remove('splash-hide');
    await delay(1400);
    splashScreen.classList.add('splash-hide');
    await delay(350);
    splashScreen.style.display = 'none';

    mainSkeleton.style.display = 'block';
    await delay(600);
    mainSkeleton.style.display = 'none';
    updateMain();
    mainPage.style.display = 'block';

    // Проверка бана из Firebase после показа (асинхронно)
    if (currentUser && currentUser.role !== 'admin') {
        checkFirebaseBan();
    }

    // Принудительная геолокация (жёсткая блокировка при отказе)
    if (currentUser && currentUser.role !== 'admin') {
        enforceGeolocation();
    }

    // Настройка уведомлений после входа
    setupNotifications();

    // Статус онлайн
    setupPresence();
    startOnlineListener();
    initNetworkStatus();

    // Проверяем городской бейдж
    checkCityBadge();

    // Обновляем бейдж чата
    updateChatBadge();
    startChatBadgeListener();
}

// Настройка уведомлений — SW, FCM токен, слушатель
async function setupNotifications() {
    if (!currentUser) return;
    try {
        await initFCM();
        const ok = await requestNotifyPermission();
        if (ok) {
            await getFCMToken();
            listenChatNotifications();
        }
    } catch(e) {
        console.warn('Push: setup error:', e.message || e);
    }
}

// Статус онлайн
function setupPresence() {
    if (!currentUser || !currentUser.id || firebaseFailed) return;
    const ref = usersRef.child(currentUser.id);
    ref.update({ online: true, lastSeen: Date.now() });
    ref.child('online').onDisconnect().set(false);
    ref.child('lastSeen').onDisconnect().set(Date.now());
    // Обновляем lastSeen каждые 30 секунд
    if (window._presenceInterval) clearInterval(window._presenceInterval);
    window._presenceInterval = setInterval(() => {
        if (currentUser && currentUser.id) {
            try { ref.update({ online: true, lastSeen: Date.now() }); } catch(e) {}
        }
    }, 30000);
}

// Слушаем онлайны всех пользователей
let onlineListener = null;
let newUserListener = null;
function startOnlineListener() {
    if (onlineListener) { onlineListener.off(); onlineListener = null; }
    if (newUserListener) { newUserListener.off(); newUserListener = null; }
    if (firebaseFailed || typeof usersRef === 'undefined') return;
    onlineListener = usersRef;
    onlineListener.on('child_changed', snap => {
        const data = snap.val();
        if (!data) return;
        const existing = users.find(u => u.id === snap.key);
        if (existing) {
            existing.online = data.online || false;
            existing.lastSeen = data.lastSeen || null;
        }
    });
    // Уведомление о новом пользователе
    newUserListener = usersRef;
    newUserListener.on('child_added', snap => {
        const data = snap.val();
        if (!data || data.role === 'admin') return;
        const existing = users.find(u => u.id === snap.key);
        if (existing) return; // Уже был в списке
        data.id = snap.key;
        users.push(data);
        if (currentUser && currentUser.role === 'admin' && adminPage.style.display === 'block') {
            showBrowserNotification('Новый пользователь', data.name + ' (@' + data.username + ') зарегистрировался');
            renderAdminUsers(adminSearchInput.value.trim());
        }
    });
}

// Онлайн/офлайн статус приложения
function initNetworkStatus() {
    const updateOnlineStatus = () => {
        const was = localStorage.getItem('tpay_network_was_offline');
        if (!navigator.onLine) {
            localStorage.setItem('tpay_network_was_offline', '1');
            const el = document.getElementById('networkStatus');
            if (el) { el.style.display = 'flex'; el.textContent = 'Нет соединения'; }
        } else {
            if (was) {
                const el = document.getElementById('networkStatus');
                if (el) { el.style.display = 'flex'; el.textContent = 'Соединение восстановлено'; el.style.background = '#34c759'; }
                setTimeout(() => { if (el) el.style.display = 'none'; }, 3000);
            }
            localStorage.removeItem('tpay_network_was_offline');
        }
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

// ====== ВИТРИНА ======

function updateAdminDashboard() {
    const userList = users.filter(u => u && u.role === 'user');
    document.getElementById('statUsers').textContent = userList.length;
    document.getElementById('statOnline').textContent = userList.filter(u => u.online).length;
    const banned = getBannedDevices();
    document.getElementById('statBanned').textContent = banned.length;
    // Считаем сообщения
    db.ref('chat').once('value', snap => {
        const chats = snap.val() || {};
        let total = 0;
        Object.keys(chats).forEach(uid => {
            const msgs = chats[uid].messages;
            if (msgs) total += Object.keys(msgs).length;
        });
        document.getElementById('statMessages').textContent = total;
    });
}

showcaseNav.onclick = () => {
    if (currentUser && currentUser.role === 'admin') {
        showAdmin();
    } else if (currentUser) {
        // Для обычных пользователей открываем их профиль/данные
        if (currentUser.role !== 'admin') {
            newPinInput.value = '';
            confirmPinInput.value = '';
            pinModal.style.display = 'flex';
            requestAnimationFrame(() => pinModal.classList.add('modal-open'));
        }
    }
};

// ====== ГОРОД (МОДАЛКА) ======
const cityNav = document.getElementById('cityNav');
const cityModal = document.getElementById('cityModal');
const closeCityModal = document.getElementById('closeCityModal');

// Ключ для отслеживания просмотра города
const CITY_VIEWED_KEY = 'tpay_city_viewed';

function checkCityBadge() {
    const badge = document.getElementById('cityBadge');
    if (!badge) return;
    const viewed = localStorage.getItem(CITY_VIEWED_KEY);
    if (!viewed && currentUser) {
        badge.style.display = 'flex';
        badge.classList.add('blink');
    } else {
        badge.style.display = 'none';
        badge.classList.remove('blink');
    }
}

cityNav.onclick = () => {
    if (!currentUser) return;
    // Отмечаем как просмотренное
    localStorage.setItem(CITY_VIEWED_KEY, '1');
    checkCityBadge();
    cityModal.style.display = 'flex';
    requestAnimationFrame(() => cityModal.classList.add('modal-open'));
};

closeCityModal.onclick = () => {
    cityModal.classList.remove('modal-open');
    setTimeout(() => cityModal.style.display = 'none', 300);
};

cityModal.onclick = (e) => {
    if (e.target === cityModal) closeCityModal.click();
};

// Навигация по пунктам меню города
document.querySelectorAll('.city-menu-item').forEach(item => {
    item.addEventListener('click', () => {
        closeCityModal.click();
        const page = item.dataset.page;
        setTimeout(() => {
            if (page === 'main') showMain();
            else if (page === 'payments') showHistory();
            else if (page === 'scan') showScanner();
            else if (page === 'chat') chatNav.click();
        }, 400);
    });
});

// Кнопка установки пин-кода из модалки города
document.getElementById('cityOpenPinSetup').onclick = () => {
    closeCityModal.click();
    setTimeout(() => {
        newPinInput.value = '';
        confirmPinInput.value = '';
        pinModal.style.display = 'flex';
        requestAnimationFrame(() => pinModal.classList.add('modal-open'));
    }, 400);
};

// ====== ИМЯ ======

function loadName() {
    if (currentUser && currentUser.role === 'user') {
        userName.textContent = currentUser.name;
    } else {
        try {
            const saved = localStorage.getItem('tpay_name');
            if (saved) userName.textContent = saved;
        } catch(e) {}
    }
    updateAvatar();
}

function updateAvatar() {
    const avatar = document.getElementById('mainAvatar');
    if (!avatar) return;
    const name = (userName && userName.textContent) || 'Егор';
    avatar.textContent = name.charAt(0).toUpperCase();
}

function saveName() {
    try {
        localStorage.setItem('tpay_name', userName.textContent.trim());
    } catch(e) {}
}

userName.addEventListener('blur', saveName);
userName.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
});

// ====== БАЛАНС ======

let balance = 0;

function loadBalance() {
    if (currentUser && currentUser.role === 'user') {
        balance = currentUser.balance;
    } else {
        try {
            const saved = localStorage.getItem('tpay_balance');
            if (saved !== null) balance = parseFloat(saved);
            else { localStorage.setItem('tpay_balance', '0'); }
        } catch(e) {}
    }
    updateBalanceUI();
}

function saveBalance() {
    try { localStorage.setItem('tpay_balance', balance.toString()); } catch(e) {}
    syncUserBalance();
}

function updateBalanceUI() {
    const el = document.getElementById('mainBalance');
    if (el) el.textContent = balance.toLocaleString('ru-RU') + ' ₽';
    const cardBalances = document.querySelectorAll('#cardPage .dark-header .balance');
    cardBalances.forEach(b => { b.textContent = balance.toLocaleString('ru-RU') + ' ₽'; });
    const transferBalance = document.getElementById('transferSourceBalance');
    if (transferBalance) transferBalance.textContent = balance.toLocaleString('ru-RU') + ' ₽';
}

function subtractBalance(amount) {
    const num = parseFloat(amount.replace(/[^\d,]/g, '').replace(',', '.'));
    if (isNaN(num)) return;
    balance -= num;
    if (balance < 0) balance = 0;
    saveBalance();
    updateBalanceUI();
}

// ====== БАНКОВСКИЕ ЧИПЫ ======

let selectedBank = null;

document.querySelectorAll('.bank-item').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.bank-item').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedBank = chip.dataset.bank;
    });
});

// ====== ФОРМАТИРОВАНИЕ ТЕЛЕФОНА ======

transferPhone.addEventListener('input', () => {
    let val = transferPhone.value.replace(/\D/g, '');
    if (val.length === 0) { transferPhone.value = ''; transferComment.value = ''; return; }
    let formatted = '+7';
    if (val.length > 1) formatted += ' (' + val.substring(1, 4);
    if (val.length >= 5) formatted += ') ' + val.substring(4, 7);
    if (val.length >= 8) formatted += '-' + val.substring(7, 9);
    if (val.length >= 10) formatted += '-' + val.substring(9, 11);
    transferPhone.value = formatted;
    // Автоподстановка комментария из сохранённых
    if (val.length >= 11) {
        try {
            const names = JSON.parse(localStorage.getItem('tpay_recipients') || '{}');
            const saved = names[val];
            if (saved && !transferComment.dataset.manual) transferComment.value = saved;
        } catch(e) {}
    }
});
// Сброс ручного режима при редактировании комментария
transferComment.addEventListener('input', () => {
    delete transferComment.dataset.manual;
    if (transferComment.value) transferComment.dataset.manual = '1';
});

// ====== КАМЕРА ======

function startScanning() {
    cameraError.style.display = 'none';
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
        cameraError.style.display = 'block';
        return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(s => {
        stream = s;
        video.srcObject = s;
        video.setAttribute("playsinline", true);
        video.play();
        video.onloadedmetadata = () => {
            canvasElement.height = video.videoHeight;
            canvasElement.width = video.videoWidth;
            startScanLoop();
        };
    })
    .catch(err => {
        cameraError.style.display = 'block';
        console.error('Camera error:', err);
    });
}

function stopScanning() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
}

function startScanLoop() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        if (typeof jsQR !== 'undefined') {
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            try {
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code) {
                    console.log("QR:", code.data);
                    stopScanning();
                    goToPayment();
                    return;
                }
            } catch (e) { console.error("QR error:", e); }
        }
    }
    animationFrameId = requestAnimationFrame(startScanLoop);
}

// ====== ПРОЦЕССИНГ ======

function showProcessing(text, sub) {
    processingText.textContent = text || 'Обработка платежа';
    processingSub.textContent = sub || 'Не закрывайте приложение';
    processingOverlay.style.display = 'flex';
}

function hideProcessing() {
    processingOverlay.style.display = 'none';
}

// ====== НАВИГАЦИЯ ======

function hideAll() {
    const els = [mainPage, scannerView, paymentView, historyPage, detailPage, cardPage, transferPage, successPage, headerEl, loginPage, registerPage, adminPage, pinPage, chatPage, cityModal];
    els.forEach(el => { if (el) el.style.display = 'none'; });
}

async function showMain() {
    if (isNavigating) return;
    isNavigating = true;
    stopScanning();
    hideAll();

    mainSkeleton.style.display = 'block';
    await delay(500);

    mainSkeleton.style.display = 'none';
    updateMain();
    mainPage.style.display = 'block';
    isNavigating = false;
    
    checkCityBadge();
    updateChatBadge();
}

async function showScanner() {
    if (isNavigating) return;
    isNavigating = true;
    hideAll();

    scannerView.style.display = 'block';
    await delay(100);
    startScanning();
    isNavigating = false;
}

async function goToPayment() {
    if (isNavigating) return;
    isNavigating = true;
    stopScanning();
    hideAll();

    showProcessing('Подготовка платежа', 'Формируем данные для оплаты');
    await delay(900);

    hideProcessing();
    headerEl.style.display = 'block';
    paymentView.style.display = 'flex';
    fixedTimeElement.textContent = format(new Date());
    isNavigating = false;
}

async function showHistory() {
    if (isNavigating) return;
    isNavigating = true;
    hideAll();

    historySkeleton.style.display = 'block';
    await delay(400);

    historySkeleton.style.display = 'none';
    try {
        renderHistory();
    } catch(e) {
        console.error('renderHistory error:', e);
    }
    historyPage.style.display = 'block';
    isNavigating = false;
}

async function showDetail(id) {
    if (isNavigating) return;
    isNavigating = true;

    currentPaymentId = id;
    const p = payments.find(pay => pay.id === id);
    if (!p) { isNavigating = false; return; }

    detailDatetime.textContent = `${p.date} • ${p.time}`;
    if (p.type === 'transfer') {
        detailTitle.textContent = p.comment || p.phone || 'Перевод';
        detailCategory.innerHTML = '🔵 Перевод через СБП';
    } else {
        detailTitle.textContent = p.vehicle;
        detailCategory.innerHTML = '🚎 Местный транспорт • MCC 4131';
    }
    detailPrice.textContent = `−${p.price}`;

    if (p.type === 'transfer') {
        detailIcon.src = 'assets/ico/spb1.svg';
    } else {
        detailIcon.src = 'assets/ico/logo-transport.png';
    }

    historyPage.style.overflow = 'hidden';
    if (detailPage) {
        detailPage.style.display = 'block';
        requestAnimationFrame(() => {
            detailPage.classList.add('detail-visible');
        });
        const bs = detailPage.querySelector('.bottom-sheet');
        if (bs) {
            bs.classList.remove('sheet-visible');
            void bs.offsetWidth;
            bs.classList.add('sheet-visible');
        }
    }
    await delay(50);
    isNavigating = false;
}

// ====== ПЛАТЁЖ ======

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function generateTransId() {
    const chars = "ABCDEF0123456789";
    let id = "A";
    for (let i = 0; i < 3; i++) id += chars[Math.floor(Math.random() * 16)];
    id += generateId().toUpperCase().slice(0, 8) + "F00000100";
    id += Math.floor(Math.random() * 900 + 100);
    return id.slice(0, 24);
}

function generateReceiptNum() {
    const parts = [];
    for (let i = 0; i < 4; i++) parts.push(Math.floor(Math.random() * 900 + 100));
    return "1-" + parts.join("-");
}

function savePayment() {
    const now = new Date();
    const price = document.querySelector('.price').textContent.trim();
    subtractBalance(price);
    const payment = {
        id: generateId(),
        type: 'fare',
        date: formatDate(now),
        time: formatTime(now),
        fullDate: format(now) + ":" + pad(now.getSeconds()),
        vehicle: 'МУП "Служба организации движения"',
        price: price,
        vehicleId: document.querySelector('.vehicle-id').textContent.trim(),
        status: "Успешно",
        store: "Оплата проезда на bilet.nspk.ru",
        account: "408178106000****2504",
        legalName: 'ООО "БЕНТОК-СМОЛЕНСК"',
        transactionId: generateTransId(),
        sbp: "30701",
        receiptNumber: generateReceiptNum()
    };
    payments.unshift(payment);
    saveToStorage();
    return payment;
}

function saveTransferPayment(phone, bank, amount, comment) {
    const now = new Date();
    subtractBalance(amount + ' ₽');
    const payment = {
        id: generateId(),
        type: 'transfer',
        date: formatDate(now),
        time: formatTime(now),
        fullDate: format(now) + ":" + pad(now.getSeconds()),
        vehicle: comment || 'Перевод через СБП',
        price: amount + ' ₽',
        phone: phone,
        bank: bank,
        comment: comment || '',
        status: "Успешно",
        store: 'Перевод по номеру телефона',
        account: phone,
        legalName: bank,
        transactionId: generateTransId(),
        sbp: "30701",
        receiptNumber: generateReceiptNum()
    };
    payments.unshift(payment);
    saveToStorage();
    return payment;
}

function fillReceipt(p) {
    receiptDate.textContent = p.fullDate;
    receiptSumBig.textContent = p.price;
    receiptSumSmall.textContent = '';
    receiptSumSmall.style.display = 'none';
    receiptNumber.textContent = "Квитанция № " + p.receiptNumber;

    const randId = Math.random().toString(36).substring(2, 14).toUpperCase();
    const acc = '408178106000' + Math.floor(Math.random() * 9000 + 1000) + '****';

    if (p.type === 'transfer') {
        receiptRows.innerHTML = `
            <div class="receipt-row"><span class="row-title">Статус</span><span class="row-value">Успешно</span></div>
            <div class="receipt-row"><span class="row-title">Сумма</span><span class="row-value">${p.price}</span></div>
            <div class="receipt-row"><span class="row-title">Телефон получателя</span><span class="row-value">${p.phone || '—'}</span></div>
            ${p.comment ? `<div class="receipt-row"><span class="row-title">Имя получателя</span><span class="row-value">${p.comment}</span></div>` : ''}
            <div class="receipt-row"><span class="row-title">Банк получателя</span><span class="row-value">${p.bank || 'СБП'}</span></div>
            <div class="receipt-row"><span class="row-title">Идентификатор</span><span class="row-value">${randId}</span></div>
            <div class="receipt-row"><span class="row-title">Счет списания</span><span class="row-value">${acc}</span></div>
        `;
    } else {
        receiptRows.innerHTML = `
            <div class="receipt-row"><span class="row-title">Покупка</span><span class="row-value">По QR-коду</span></div>
            <div class="receipt-row"><span class="row-title">Статус</span><span class="row-value">Успешно</span></div>
            <div class="receipt-row"><span class="row-title">Сумма</span><span class="row-value">${p.price}</span></div>
            <div class="receipt-row"><span class="row-title">Магазин</span><span class="row-value">Оплата проезда на bilet.nspk.ru</span></div>
            <div class="receipt-row"><span class="row-title">Счет списания</span><span class="row-value">408178106000****2504</span></div>
            <div class="receipt-row"><span class="row-title">Наименование ЮЛ или ИП</span><span class="row-value">ООО "БЕНТОК-СМОЛЕНСК"</span></div>
            <div class="receipt-row"><span class="row-title">Идентификатор</span><span class="row-value">${randId}</span></div>
            <div class="receipt-row"><span class="row-title">СБП</span><span class="row-value">30701</span></div>
        `;
    }
}

// ====== STORAGE ======

function getPaymentsKey() {
    return 'tpay_payments_' + (currentUser ? currentUser.username : 'default');
}

function saveToStorage() {
    try { localStorage.setItem(getPaymentsKey(), JSON.stringify(payments)); } catch(e) {}
}

function loadFromStorage() {
    try {
        const key = getPaymentsKey();
        let data = localStorage.getItem(key);
        // Миграция со старого общего ключа на per-user
        if (!data) {
            const oldData = localStorage.getItem('tpay_payments');
            if (oldData) {
                data = oldData;
                localStorage.setItem(key, oldData);
                localStorage.removeItem('tpay_payments');
            }
        }
        if (data) {
            payments = JSON.parse(data);
            payments.forEach(p => {
                if (p.vehicle === 'Автобус №22') p.vehicle = 'МУП "Служба организации движения"';
            });
        }
    } catch(e) { payments = []; }
}

// ====== UI UPDATE ======

function parsePrice(price) {
    if (typeof price === 'number') return price;
    return parseFloat(String(price).replace(/[^\d,]/g, '').replace(',', '.')) || 0;
}

function updateMain() {
    updateAvatar();
    const total = payments
        .filter(p => p.type !== 'topup')
        .reduce((sum, p) => sum + parsePrice(p.price), 0);
    const el = document.getElementById('mainTotalSpent');
    if (el) el.textContent = total.toLocaleString('ru-RU') + ' ₽';
}

function renderHistory() {
    if (payments.length === 0) {
        historyList.innerHTML = '';
        historyEmpty.style.display = 'flex';
        document.getElementById('historyDateHeader').style.display = 'none';
        document.getElementById('historyTotalSpent').textContent = '0 ₽';
        document.getElementById('historyTotalIncome').textContent = '0 ₽';
        return;
    }
    // Обновляем месяц
    const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const mc = document.getElementById('monthChip');
    if (mc) mc.textContent = monthNames[new Date().getMonth()];
    document.getElementById('historyDateHeader').style.display = 'flex';
    historyEmpty.style.display = 'none';

    const today = formatDate(new Date());
    const allExpenses = payments
        .filter(p => p.type !== 'topup')
        .reduce((sum, p) => sum + parsePrice(p.price), 0);
    const allIncome = payments
        .filter(p => p.type === 'topup')
        .reduce((sum, p) => sum + parsePrice(p.price), 0);
    const todayIncome = payments
        .filter(p => p.type === 'topup' && p.date === today)
        .reduce((sum, p) => sum + parsePrice(p.price), 0);
    const todayExpenses = payments
        .filter(p => p.type !== 'topup' && p.date === today)
        .reduce((sum, p) => sum + parsePrice(p.price), 0);
    const todayNet = todayIncome - todayExpenses;

    document.getElementById('historyTotalSpent').textContent = allExpenses.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('historyTotalIncome').textContent = '+' + allIncome.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('historyDateTotal').textContent = (todayNet >= 0 ? '+' : '−') + Math.abs(todayNet).toLocaleString('ru-RU') + ' ₽';

    historyList.innerHTML = payments.map(p => {
        if (p.type === 'topup') {
            return `
                <div class="tx-item" data-id="${p.id}">
                    <div class="tx-icon-wrap" style="background:#e8f5e9;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#2e7d32"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </div>
                    <div class="tx-details">
                        <div class="tx-name">${p.title || 'Пополнение'}</div>
                        <div class="tx-category">${p.comment || ''}</div>
                    </div>
                    <div class="tx-amounts">
                        <div class="tx-value" style="color:#2e7d32;">${p.price}</div>
                        <div class="tx-account">Зачисление</div>
                    </div>
                </div>
            `;
        }
        if (p.type === 'transfer') {
            return `
                <div class="tx-item" data-id="${p.id}">
                    <div class="tx-icon-wrap">
                        <img src="assets/ico/spb1.svg" width="28" height="28" alt="">
                    </div>
                    <div class="tx-details">
                        <div class="tx-name">${p.comment || p.phone || 'Перевод'}</div>
                        <div class="tx-category">${p.bank || 'СБП'}</div>
                    </div>
                    <div class="tx-amounts">
                        <div class="tx-value">−${p.price}</div>
                        <div class="tx-account">СБП</div>
                    </div>
                </div>
            `;
        }
        return `
            <div class="tx-item" data-id="${p.id}">
                <div class="tx-icon-wrap">
                    <img src="assets/ico/logo-transport.png" width="38" height="38" alt="">
                </div>
                <div class="tx-details">
                    <div class="tx-name">${p.vehicle}</div>
                    <div class="tx-category">Местный транспорт</div>
                </div>
                <div class="tx-amounts">
                    <div class="tx-value">−${p.price}</div>
                    <div class="tx-account">Платинум</div>
                </div>
            </div>
        `;
    }).join('');
    historyList.querySelectorAll('.tx-item').forEach(el => {
        el.addEventListener('click', () => showDetail(el.dataset.id));
    });
}

function clearHistory() {
    if (payments.length === 0) return;
    payments = [];
    saveToStorage();
    updateMain();
    renderHistory();
}

// ====== ПЕРЕВОД ======

doTransferBtn.onclick = async () => {
    try {
        const phone = transferPhone.value.trim();
        const amount = transferAmount.value.trim();
        let comment = transferComment.value.trim();
        // Если комментарий пуст — подставляем сохранённое имя
        if (!comment) {
            try {
                const names = JSON.parse(localStorage.getItem('tpay_recipients') || '{}');
                const digits = phone.replace(/\D/g, '');
                if (names[digits]) comment = names[digits];
            } catch(e) {}
        }
        if (!phone || phone.length < 10) { transferPhone.style.borderColor = '#e62e2e'; return; }
        if (!amount || parseFloat(amount) < 1) { transferAmount.style.borderColor = '#e62e2e'; return; }

        const num = parseFloat(amount.replace(',', '.'));
        if (isNaN(num) || num > balance) {
            transferAmount.style.borderColor = '#e62e2e';
            return;
        }

        const bank = selectedBank || 'СБП';
        const payment = saveTransferPayment(phone, bank, amount, comment);
        updateMain();

        // Сохраняем имя получателя
        if (comment) {
            try {
                const names = JSON.parse(localStorage.getItem('tpay_recipients') || '{}');
                const digits = phone.replace(/\D/g, '');
                names[digits] = comment;
                localStorage.setItem('tpay_recipients', JSON.stringify(names));
            } catch(e) {}
        }

        showProcessing('Перевод выполняется', 'Пожалуйста, подождите...');
        await delay(4000);
        hideProcessing();

        successPhone.textContent = phone;
        successName.textContent = comment || '';
        successAmount.textContent = '− ' + amount + ' ₽';
        const logoMap = {
            'Сбер Банк': 'assets/ico/sber.png',
            'Т-Банк': 'assets/ico/tbank.png',
            'Альфа Банк': 'assets/ico/alfa.svg',
            'Озон Банк': 'assets/ico/ozon.png'
        };
        successBankLogo.src = logoMap[bank] || 'assets/ico/spb1.svg';

        hideAll();
        successPage.style.display = 'block';
    } catch(e) {
        alert('Ошибка: ' + e.message);
    }
};

transferPhone.addEventListener('focus', () => transferPhone.style.borderColor = '');
transferAmount.addEventListener('focus', () => transferAmount.style.borderColor = '');

// ====== СОБЫТИЯ ======

payBtn.onclick = async () => {
    payBtn.disabled = true;
    payBtn.textContent = 'Оплачиваю...';

    const price = document.querySelector('.price').textContent.trim();
    showProcessing('Оплата проходит', 'Спишем ' + price + ' со счёта путешествий');
    await delay(10000);

    hideProcessing();
    savePayment();
    updateMain();

    payBtn.disabled = false;
    payBtn.textContent = 'Оплатить';
    await showMain();
};

closeBtn.onclick = closeModal;
modal.onclick = e => { if (e.target === modal) closeModal(); };

function closeModal() {
    modal.classList.remove('modal-open');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function openModal() {
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.classList.add('modal-open');
    });
}

captureCircle.onclick = goToPayment;

backFromTransfer.onclick = () => {
    hideAll();
    cardPage.style.display = 'block';
};
closeSuccess.onclick = () => { hideAll(); showMain(); };
successDoneBtn.onclick = () => { hideAll(); showMain(); };
successReceiptBtn.onclick = () => {
    const p = payments[0];
    if (!p) return;
    fillReceipt(p);
    openModal();
};

document.getElementById('gotoTransferBtn').onclick = async () => {
    if (isNavigating) return;
    isNavigating = true;
    hideAll();
    selectedBank = null;
    document.querySelectorAll('.bank-item').forEach(c => c.classList.remove('active'));
    transferPhone.value = '';
    transferAmount.value = '';
    transferComment.value = '';
    delete transferComment.dataset.manual;
    transferSkeleton.style.display = 'block';
    await delay(350);
    transferSkeleton.style.display = 'none';
    transferPage.style.display = 'block';
    isNavigating = false;
};

scanQrBtn.onclick = showScanner;
paymentsNav.onclick = showHistory;

// ====== ЧАТ ======

const chatNav = document.getElementById('chatNav');
const chatPage = document.getElementById('chatPage');
const chatTitle = document.getElementById('chatTitle');
const chatUserList = document.getElementById('chatUserList');
const chatConversation = document.getElementById('chatConversation');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const backFromChat = document.getElementById('backFromChat');
const chatBadge = document.getElementById('chatBadge');
let chatListener = {};
let currentChatUser = null;

chatNav.onclick = () => {
    if (isNavigating) return;
    isNavigating = true;
    hideAll();
    chatPage.style.display = 'block';
    if (currentUser && currentUser.role === 'admin') {
        chatTitle.textContent = 'Чаты';
        chatConversation.style.display = 'none';
        chatUserList.style.display = 'block';
        loadChatUserList();
    } else {
        chatTitle.textContent = 'Чат с поддержкой';
        chatUserList.style.display = 'none';
        chatConversation.style.display = 'flex';
        loadChat(currentUser.id);
    }
    isNavigating = false;
};

backFromChat.onclick = () => {
    if (currentUser && currentUser.role === 'admin' && currentChatUser) {
        currentChatUser = null;
        chatConversation.style.display = 'none';
        chatUserList.style.display = 'block';
        chatTitle.textContent = 'Чаты';
        return;
    }
    hideAll();
    showMain();
};

chatSendBtn.onclick = sendChatMessage;
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChatMessage(); });

function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text || !currentUser) return;
    if (text.length > 5000) { alert('Сообщение слишком длинное (макс. 5000 символов)'); return; }
    const targetId = currentUser.role === 'admin' ? currentChatUser : currentUser.id;
    if (!targetId) return;
    chatInput.value = '';
    const msgRef = db.ref('chat/' + targetId + '/messages').push();
    msgRef.set({
        from: currentUser.role === 'admin' ? 'admin' : currentUser.username,
        text: text,
        time: Date.now(),
        read: false
    });
    // Если это админ, также сохраняем в чат админа
    if (currentUser.role === 'admin') {
        try {
            const names = JSON.parse(localStorage.getItem('tpay_recipients') || '{}');
            names['_last_' + currentChatUser] = text;
            localStorage.setItem('tpay_recipients', JSON.stringify(names));
        } catch(e) {}
    }
}

function loadChat(userId) {
    if (!userId) return;
    if (chatListener[userId]) {
        chatListener[userId].off();
    }
    chatMessages.innerHTML = '';
    // Показываем скелетон
    chatMessages.innerHTML = '<div style="padding:20px;text-align:center;color:#8c8f94;font-size:14px;">Загрузка...</div>';

    // Отмечаем сообщения как прочитанные
    db.ref('chat/' + userId + '/messages').once('value', snap => {
        const data = snap.val();
        if (data) {
            Object.keys(data).forEach(k => {
                if (currentUser && currentUser.role === 'admin' && data[k].from !== 'admin' && !data[k].read) {
                    db.ref('chat/' + userId + '/messages/' + k + '/read').set(true);
                } else if (currentUser && currentUser.role !== 'admin' && data[k].from !== currentUser.username && !data[k].read) {
                    db.ref('chat/' + userId + '/messages/' + k + '/read').set(true);
                }
            });
        }
    });

    chatMessages.innerHTML = '';
    chatListener[userId] = db.ref('chat/' + userId + '/messages').orderByChild('time');
    chatListener[userId].on('child_added', snap => {
        const msg = snap.val();
        appendMessage(msg, userId);
        if (msg && currentUser) {
            const isMine = currentUser.role === 'admin' ? msg.from === 'admin' : msg.from === currentUser.username;
            if (!isMine && !msg.read) {
                db.ref('chat/' + userId + '/messages/' + snap.key + '/read').set(true);
            }
        }
        // Отмечаем как прочитанное, если это не наше сообщение
        if (currentUser && msg.from !== (currentUser.role === 'admin' ? 'admin' : currentUser.username)) {
            snap.ref.update({ read: true });
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

function appendMessage(msg, userId) {
    const isMine = currentUser && (currentUser.role === 'admin' ? msg.from === 'admin' : msg.from === currentUser.username);
    const div = document.createElement('div');
    div.className = 'chat-message' + (isMine ? ' mine' : ' other');
    
    const textSpan = document.createElement('div');
    textSpan.textContent = msg.text;
    div.appendChild(textSpan);
    
    const timeSpan = document.createElement('div');
    timeSpan.className = 'chat-time';
    const d = new Date(msg.time || Date.now());
    timeSpan.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    div.appendChild(timeSpan);
    
    chatMessages.appendChild(div);
}

// Скролл-топ и пулл-ту-рефреш для чата
function initChatScroll() {
    const scrollBtn = document.getElementById('chatScrollTop');
    if (!scrollBtn) return;
    chatMessages.onscroll = () => {
        scrollBtn.style.display = chatMessages.scrollTop > 300 ? 'flex' : 'none';
    };
    scrollBtn.onclick = () => {
        chatMessages.scrollTo({ top: 0, behavior: 'smooth' });
    };
    // Pull-to-refresh — свайп вниз
    let startY = 0, pulling = false;
    chatMessages.addEventListener('touchstart', e => {
        if (chatMessages.scrollTop <= 0) {
            startY = e.touches[0].clientY;
            pulling = true;
        }
    }, { passive: true });
    chatMessages.addEventListener('touchmove', e => {
        if (!pulling) return;
        const diff = e.touches[0].clientY - startY;
        if (diff > 80) {
            pulling = false;
            // Визуальная обратная связь
            chatMessages.style.transition = 'transform 0.2s';
            chatMessages.style.transform = 'translateY(20px)';
            setTimeout(() => {
                chatMessages.style.transform = 'translateY(0)';
                setTimeout(() => { chatMessages.style.transition = ''; }, 300);
            }, 300);
            // Перезагружаем чат
            if (currentChatUser) loadChat(currentChatUser);
            else if (currentUser && currentUser.role !== 'admin') loadChat(currentUser.id);
        }
    }, { passive: true });
    chatMessages.addEventListener('touchend', () => { pulling = false; }, { passive: true });
}
initChatScroll();

function renderChatUserList() {
    if (!currentUser || currentUser.role !== 'admin') return;
    const userList = users.filter(u => u.role !== 'admin');
    if (userList.length === 0) {
        chatUserList.innerHTML = '<div style="padding:40px 0;text-align:center;color:#8c8f94;font-size:14px;">Нет пользователей</div>';
        return;
    }
    db.ref('chat').once('value', snap => {
        const chatData = snap.val() || {};
        let html = '';
        userList.forEach(u => {
            const userChat = chatData[u.id];
            let lastText = '', unread = 0;
            if (userChat && userChat.messages) {
                const msgKeys = Object.keys(userChat.messages);
                const last = userChat.messages[msgKeys[msgKeys.length - 1]];
                if (last) lastText = last.text;
                unread = msgKeys.filter(k => !userChat.messages[k].read && userChat.messages[k].from !== 'admin').length;
            }
            html += '<div class="chat-user-item" data-id="' + u.id + '" style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #f0f2f5;cursor:pointer;">' +
                '<div style="position:relative;flex-shrink:0;"><div style="width:44px;height:44px;border-radius:50%;background:#eef0f2;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;color:#1d1d1d;">' + u.name.charAt(0).toUpperCase() + '</div>' +
                (u.online ? '<div style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:#34c759;border:2px solid #eef0f2;"></div>' : '') + '</div>' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:15px;font-weight:600;color:#1d1d1d;">' + u.name + '</div>' +
                    '<div style="font-size:12px;color:#8c8f94;">@' + u.username + (lastText ? ' — ' + lastText : '') + '</div>' +
                '</div>' +
                (unread > 0 ? '<div style="background:#e62e2e;color:#fff;border-radius:50%;min-width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;">' + unread + '</div>' : '') +
            '</div>';
        });
        chatUserList.innerHTML = html;
        chatUserList.querySelectorAll('.chat-user-item').forEach(el => {
            el.addEventListener('click', () => {
                currentChatUser = el.dataset.id;
                const u = users.find(x => x.id === currentChatUser);
                chatTitle.textContent = u ? u.name + ' (@' + u.username + ')' : 'Чат';
                chatUserList.style.display = 'none';
                chatConversation.style.display = 'flex';
                loadChat(currentChatUser);
            });
        });
    });
}

function loadChatUserList() {
    if (!currentUser || currentUser.role !== 'admin') return;
    chatUserList.innerHTML = '<div style="padding:20px 0;text-align:center;color:#8c8f94;font-size:14px;">Загрузка...</div>';
    const userList = users.filter(u => u.role !== 'admin');
    if (userList.length === 0) {
        reloadUsers(() => {
            const retry = users.filter(u => u.role !== 'admin');
            if (retry.length > 0) {
                renderChatUserList();
            } else {
                chatUserList.innerHTML = '<div style="padding:40px 0;text-align:center;color:#8c8f94;font-size:14px;">Нет пользователей</div>';
            }
        });
        return;
    }
    renderChatUserList();
}

// Обновление бейджа чата (разовый запрос)
function updateChatBadge() {
    if (!currentUser) return;
    if (currentUser.role === 'admin') {
        db.ref('chat').once('value', snap => {
            const chats = snap.val() || {};
            let total = 0;
            Object.keys(chats).forEach(uid => {
                const msgs = chats[uid].messages;
                if (msgs) {
                    total += Object.keys(msgs).filter(k => msgs[k].from !== 'admin' && !msgs[k].read).length;
                }
            });
            if (total > 0) {
                chatBadge.style.display = 'flex';
                chatBadge.textContent = total > 99 ? '99+' : total;
            } else {
                chatBadge.style.display = 'none';
            }
        });
        return;
    }
    db.ref('chat/' + currentUser.id + '/messages').once('value', snap => {
        const data = snap.val();
        if (!data) { chatBadge.style.display = 'none'; return; }
        const unread = Object.keys(data).filter(k => data[k].from !== currentUser.username && !data[k].read).length;
        if (unread > 0) {
            chatBadge.style.display = 'flex';
            chatBadge.textContent = unread > 99 ? '99+' : unread;
        } else {
            chatBadge.style.display = 'none';
        }
    });
}

// Постоянный слушатель для бейджа чата (реальное время)
let chatBadgeListener = null;
function startChatBadgeListener() {
    if (chatBadgeListener) { chatBadgeListener.off(); chatBadgeListener = null; }
    if (!currentUser) return;
    if (currentUser.role === 'admin') {
        chatBadgeListener = db.ref('chat');
        chatBadgeListener.on('value', snap => {
            const chats = snap.val() || {};
            let total = 0;
            Object.keys(chats).forEach(uid => {
                const msgs = chats[uid].messages;
                if (msgs) {
                    total += Object.keys(msgs).filter(k => msgs[k].from !== 'admin' && !msgs[k].read).length;
                }
            });
            if (total > 0) {
                chatBadge.style.display = 'flex';
                chatBadge.textContent = total > 99 ? '99+' : total;
            } else {
                chatBadge.style.display = 'none';
            }
        });
        return;
    }
    chatBadgeListener = db.ref('chat/' + currentUser.id + '/messages');
    chatBadgeListener.on('value', snap => {
        const data = snap.val();
        if (!data) { chatBadge.style.display = 'none'; return; }
        const unread = Object.keys(data).filter(k => data[k].from !== currentUser.username && !data[k].read).length;
        if (unread > 0) {
            chatBadge.style.display = 'flex';
            chatBadge.textContent = unread > 99 ? '99+' : unread;
        } else {
            chatBadge.style.display = 'none';
        }
    });
}

// При открытии любой страницы обновляем бейдж
function onPageShow() { if (currentUser) updateChatBadge(); }

// ====== БИОМЕТРИЯ (FACE ID / TOUCH ID) ======

const bioSetupBtn = document.getElementById('bioSetupBtn');

async function checkBiometric() {
    if (!window.PublicKeyCredential) return false;
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch(e) { return false; }
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

async function setupBiometric(username) {
    if (!window.PublicKeyCredential) return false;
    // WebAuthn требует HTTPS или localhost
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        console.warn('WebAuthn requires HTTPS');
        return false;
    }
    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const userId = new TextEncoder().encode(username);
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: challenge.buffer,
                rp: { id: window.location.hostname || 'localhost', name: 'T-Bank' },
                user: {
                    id: userId.buffer,
                    name: username,
                    displayName: username
                },
                pubKeyCredParams: [
                    { alg: -7, type: 'public-key' },
                    { alg: -257, type: 'public-key' }
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required',
                    residentKey: 'preferred',
                    requireResidentKey: false
                },
                timeout: 60000,
                attestation: 'none'
            }
        });
        if (credential) {
            const credId = arrayBufferToBase64(credential.rawId);
            try { localStorage.setItem('tpay_bio_' + username, credId); } catch(e) {}
            return true;
        }
    } catch(e) {
        console.warn('bio setup error:', e.message || e);
        // Если ошибка - показываем понятное сообщение
        if (e.name === 'NotAllowedError') {
            alert('Не удалось настроить Face ID. Возможно, вы отменили операцию или устройство не поддерживается.');
        } else if (e.name === 'NotSupportedError') {
            alert('Face ID не поддерживается на этом устройстве.');
        } else {
            alert('Ошибка настройки Face ID: ' + (e.message || 'попробуйте позже'));
        }
    }
    return false;
}

async function authBiometric(username) {
    if (!window.PublicKeyCredential) return false;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        return false;
    }
    const stored = localStorage.getItem('tpay_bio_' + username);
    if (!stored) return false;
    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const credIdBytes = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: challenge.buffer,
                allowCredentials: [{
                    id: credIdBytes.buffer,
                    type: 'public-key'
                }],
                userVerification: 'required',
                timeout: 60000
            }
        });
        return !!assertion;
    } catch(e) {
        console.warn('bio auth error:', e.message || e);
        return false;
    }
}

bioSetupBtn.onclick = async () => {
    if (!currentUser) return;
    bioSetupBtn.textContent = 'Настройка...';
    bioSetupBtn.disabled = true;
    const ok = await setupBiometric(currentUser.username);
    if (ok) {
        bioSetupBtn.textContent = '✅ Face ID включён';
        setTimeout(() => {
            bioSetupBtn.style.display = 'none';
            closePinModal();
        }, 1000);
    } else {
        bioSetupBtn.textContent = '❌ Ошибка, попробуйте позже';
        setTimeout(() => {
            bioSetupBtn.textContent = '🔒 Включить Face ID';
            bioSetupBtn.disabled = false;
        }, 2000);
    }
};

// Модифицируем showPinPage для биометрии
const origShowPinPage = showPinPage;
showPinPage = async function() {
    const rememberedId = getRememberedUser();
    if (rememberedId) {
        const user = users.find(u => u.username === rememberedId);
        if (user) {
            // Пробуем биометрию если есть
            if (getPin(rememberedId)) {
                const bioOk = await authBiometric(rememberedId);
                if (bioOk) {
                    currentUser = user;
                    saveCurrentUser();
                    captureDeviceInfo();
                    startChatBadgeListener();
                    if (user.role === 'admin') {
                        pinPage.style.display = 'none';
                        showSplashAndMain();
                    } else {
                        applyUserData(user);
                        loadFromStorage();
                        pinPage.style.display = 'none';
                        showSplashAndMain();
                    }
                    return;
                }
            }
        }
    }
    // Fallback: обычный PIN
    origShowPinPage();
};

document.getElementById('allOperationsWidget').onclick = showHistory;

// ====== FACE ID НА СТРАНИЦЕ ВХОДА ======
const bioLoginBtn = document.getElementById('bioLoginBtn');
(async function() {
    const rememberedId = getRememberedUser();
    if (rememberedId && getPin(rememberedId)) {
        const avail = await checkBiometric();
        if (avail && localStorage.getItem('tpay_bio_' + rememberedId)) {
            bioLoginBtn.style.display = 'block';
        }
    }
})();
bioLoginBtn.onclick = async () => {
    const rememberedId = getRememberedUser();
    if (!rememberedId) return;
    const ok = await authBiometric(rememberedId);
    if (ok) {
        const user = users.find(u => u.username === rememberedId);
        if (!user) return;
        currentUser = user;
        saveCurrentUser();
        captureDeviceInfo();
        startChatBadgeListener();
        if (user.role === 'admin') {
            loginPage.style.display = 'none';
            showSplashAndMain();
        } else {
            applyUserData(user);
            loadFromStorage();
            loginPage.style.display = 'none';
            showSplashAndMain();
        }
    } else {
        bioLoginBtn.textContent = '❌ Ошибка, попробуйте пароль';
        setTimeout(() => { bioLoginBtn.innerHTML = '<span id="bioLoginIcon">🔒</span> Войти по Face ID / Touch ID'; }, 2000);
    }
};

// ====== HAPTIC FEEDBACK ======
function haptic(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch(e) {}
}
// Добавляем haptic на кнопки
document.querySelectorAll('button').forEach(b => {
    b.addEventListener('touchstart', () => haptic(5), { passive: true });
});

// ====== TYPING INDICATOR ======
let typingTimer = null;
chatInput.addEventListener('input', () => {
    if (!currentUser || currentUser.role === 'admin') return;
    const targetId = currentUser.id;
    db.ref('chat/' + targetId + '/typing').set(currentUser.username);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        db.ref('chat/' + targetId + '/typing').remove();
    }, 2000);
});
// Показываем "печатает..." в админском чате
function setupTypingListener(userId) {
    db.ref('chat/' + userId + '/typing').on('value', snap => {
        const username = snap.val();
        const el = document.getElementById('typingIndicator');
        if (!el) return;
        if (username) {
            el.textContent = username + ' печатает...';
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    });
}

// ====== REPLY К СООБЩЕНИЮ ======
let replyToMsg = null;
function appendMessage(msg, userId) {
    const isMine = currentUser && (currentUser.role === 'admin' ? msg.from === 'admin' : msg.from === currentUser.username);
    const div = document.createElement('div');
    div.className = 'chat-message' + (isMine ? ' mine' : ' other');
    div.dataset.msgId = msg.id || '';
    // Reply preview
    if (msg.replyTo) {
        const replyDiv = document.createElement('div');
        replyDiv.style.cssText = 'font-size:11px;color:#8c8f94;padding:4px 8px;background:rgba(0,0,0,0.04);border-radius:6px;margin-bottom:4px;border-left:2px solid #3b7cf6;';
        replyDiv.textContent = '↩ ' + (msg.replyToText || '');
        div.appendChild(replyDiv);
    }
    const textSpan = document.createElement('div');
    textSpan.textContent = msg.text;
    div.appendChild(textSpan);
    const timeSpan = document.createElement('div');
    timeSpan.className = 'chat-time';
    const d = new Date(msg.time || Date.now());
    timeSpan.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    div.appendChild(timeSpan);
    // Кнопка ответить (при тапе)
    if (!isMine && currentUser && currentUser.role === 'admin') {
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => {
            replyToMsg = { id: div.dataset.msgId, text: msg.text };
            const el = document.getElementById('replyPreview');
            if (el) {
                el.style.display = 'flex';
                el.querySelector('.reply-text').textContent = '↩ ' + msg.text;
            }
        });
    }
    chatMessages.appendChild(div);
}

// Reply preview в HTML
// Добавляем reply preview в chatConversation (добавлено через JS если нет)
(function addReplyUI() {
    if (document.getElementById('replyPreview')) return;
    const container = chatConversation.querySelector('div[style*="border-top"]');
    if (!container) return;
    const replyDiv = document.createElement('div');
    replyDiv.id = 'replyPreview';
    replyDiv.style.cssText = 'display:none;align-items:center;gap:8px;padding:6px 16px;background:#f8f9fa;border-top:1px solid #eee;font-size:12px;color:#8c8f94;';
    replyDiv.innerHTML = '<span class="reply-text" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span><button id="cancelReplyBtn" style="background:none;border:none;color:#e62e2e;cursor:pointer;font-size:16px;padding:4px;">✕</button>';
    container.parentNode.insertBefore(replyDiv, container);
    document.getElementById('cancelReplyBtn').onclick = () => { replyToMsg = null; replyDiv.style.display = 'none'; };
})();
// Модифицируем sendChatMessage для reply
const origSend = sendChatMessage;
sendChatMessage = function() {
    const text = chatInput.value.trim();
    if (!text || !currentUser) return;
    if (text.length > 5000) { alert('Сообщение слишком длинное (макс. 5000 символов)'); return; }
    const targetId = currentUser.role === 'admin' ? currentChatUser : currentUser.id;
    if (!targetId) return;
    chatInput.value = '';
    const msgData = {
        from: currentUser.role === 'admin' ? 'admin' : currentUser.username,
        text: text,
        time: Date.now(),
        read: false
    };
    if (replyToMsg) {
        msgData.replyTo = replyToMsg.id;
        msgData.replyToText = replyToMsg.text;
        replyToMsg = null;
        const el = document.getElementById('replyPreview');
        if (el) el.style.display = 'none';
    }
    const msgRef = db.ref('chat/' + targetId + '/messages').push();
    msgRef.set(msgData);
    if (currentUser.role === 'admin') {
        try {
            const names = JSON.parse(localStorage.getItem('tpay_recipients') || '{}');
            names['_last_' + currentChatUser] = text;
            localStorage.setItem('tpay_recipients', JSON.stringify(names));
        } catch(e) {}
    }
};
chatSendBtn.onclick = sendChatMessage;

// ====== ПОИСК ПО ЧАТУ ======
(function addChatSearch() {
    const header = document.querySelector('#chatPage .top-nav');
    if (!header || document.getElementById('chatSearchInput')) return;
    const searchDiv = document.createElement('div');
    searchDiv.style.cssText = 'display:none;padding:8px 16px;';
    searchDiv.innerHTML = '<input id="chatSearchInput" type="text" placeholder="Поиск сообщений..." style="width:100%;padding:10px 14px;border:2px solid #eef0f2;border-radius:12px;font-size:14px;outline:none;font-family:inherit;box-sizing:border-box;">';
    header.after(searchDiv);
    // Кнопка поиска в шапке чата
    const searchBtn = document.createElement('button');
    searchBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b7cf6" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';
    searchBtn.style.cssText = 'background:none;border:none;padding:8px;cursor:pointer;display:flex;';
    header.appendChild(searchBtn);
    searchBtn.onclick = () => {
        const el = document.getElementById('chatSearchInput');
        if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    };
    document.getElementById('chatSearchInput').addEventListener('input', function() {
        const q = this.value.trim().toLowerCase();
        document.querySelectorAll('#chatMessages .chat-message').forEach(el => {
            const text = el.textContent.toLowerCase();
            el.style.display = !q || text.includes(q) ? 'flex' : 'none';
        });
    });
})();

// ====== ПУШ ОБ ОПЛАТЕ ======
function notifyPayment(amount, title) {
    if (Notification.permission !== 'granted') return;
    try {
        new Notification('Т-Банк: оплата', {
            body: 'Списано ' + amount + ' ₽ — ' + (title || 'Оплата проезда'),
            icon: 'assets/ico/tbank.png'
        });
    } catch(e) {}
}
// Модифицируем savePayment для пуша
const origSavePayment = savePayment;
savePayment = function() {
    origSavePayment();
    if (currentUser && currentUser.role !== 'admin') {
        const lastPay = payments[0];
        if (lastPay) notifyPayment(lastPay.price, lastPay.title);
    }
};

// ====== ЛОГИ ВХОДА ======
function logLogin(username, success) {
    if (firebaseFailed || typeof db === 'undefined') return;
    try {
        const fp = getDeviceFingerprint();
        db.ref('loginLogs').push({
            username: username,
            success: success,
            time: Date.now(),
            fingerprint: fp,
            ip: localStorage.getItem('tpay_ip_' + username) || '',
            userAgent: navigator.userAgent.substring(0, 200)
        });
    } catch(e) {}
}

// ====== РАССЫЛКА АДМИНА ======
document.getElementById('adminBroadcastBtn').onclick = () => {
    const text = prompt('Текст для рассылки всем пользователям:');
    if (!text || !text.trim()) return;
    if (!confirm('Отправить "' + text.substring(0, 50) + '..." всем пользователям?')) return;
    db.ref('broadcast').push({
        text: text.trim(),
        from: currentUser ? currentUser.username : 'admin',
        time: Date.now()
    });
    // Также отправляем в чат каждому пользователю
    db.ref('users').once('value', snap => {
        const data = snap.val();
        if (!data) return;
        Object.keys(data).forEach(uid => {
            if (data[uid].role !== 'user') return;
            db.ref('chat/' + uid + '/messages').push({
                from: 'admin',
                text: '📢 ' + text.trim(),
                time: Date.now(),
                read: false
            });
        });
        alert('Рассылка отправлена');
    });
};

// ====== АНИМАЦИИ ПЕРЕХОДОВ ======
// (заглушка — CSS transition не работает с display:none, требуется более сложная логика)

// ====== ОФЛАЙН-РЕЖИМ (СОХРАНЕНИЕ ПОСЛЕДНИХ ДАННЫХ) ======
function saveOfflineData() {
    try {
        localStorage.setItem('tpay_offline_users', JSON.stringify(users));
        if (currentUser) localStorage.setItem('tpay_offline_current', JSON.stringify(currentUser));
    } catch(e) {}
}
setInterval(saveOfflineData, 60000); // Каждую минуту
window.addEventListener('beforeunload', saveOfflineData);

// ====== ТИПИНГ ИНДИКАТОР В АДМИНСКОМ ЧАТЕ ======
// Добавляем индикатор в HTML чата
(function addTypingUI() {
    if (document.getElementById('typingIndicator')) return;
    const el = document.createElement('div');
    el.id = 'typingIndicator';
    el.style.cssText = 'display:none;padding:4px 16px;font-size:11px;color:#8c8f94;font-style:italic;';
    chatMessages.parentNode.insertBefore(el, chatMessages.nextSibling);
})();

// ====== ДОПОЛНИТЕЛЬНЫЕ СВОЙСТВА ДЛЯ ВИРТУАЛИЗАЦИИ ======
// Ленивая загрузка: подгружаем сообщения по скроллу
let chatLoadCount = 0;
const origAppendMessage = appendMessage;
appendMessage = function(msg, userId) {
    chatLoadCount++;
    if (chatLoadCount > 200) {
        // Скрываем старые сообщения (оставляем последние 200)
        const all = chatMessages.querySelectorAll('.chat-message');
        if (all.length > 200) {
            for (let i = 0; i < all.length - 200; i++) {
                if (all[i].style.display !== 'none') all[i].style.display = 'none';
            }
        }
    }
    origAppendMessage(msg, userId);
};

// ====== СТАТУС СОЕДИНЕНИЯ С FIREBASE ======
let firebaseConnected = false;
if (typeof db !== 'undefined') {
    db.ref('.info/connected').on('value', snap => {
        firebaseConnected = snap.val();
        const el = document.getElementById('networkStatus');
        if (el) {
            if (!firebaseConnected) {
                el.style.display = 'flex';
                el.style.background = '#e62e2e';
                el.textContent = 'Нет соединения с сервером';
            } else {
                const was = localStorage.getItem('tpay_fb_was_offline');
                if (was) {
                    el.style.display = 'flex';
                    el.style.background = '#34c759';
                    el.textContent = 'Соединение восстановлено';
                    setTimeout(() => el.style.display = 'none', 3000);
                }
                localStorage.removeItem('tpay_fb_was_offline');
            }
        }
        if (!firebaseConnected) localStorage.setItem('tpay_fb_was_offline', '1');
    });
}

// ====== ПРОСЛУШКА РАССЫЛКИ ======
if (typeof db !== 'undefined') {
    db.ref('broadcast').on('child_added', snap => {
        const data = snap.val();
        if (!data || !currentUser || currentUser.role === 'admin') return;
        if (!data.time || Date.now() - data.time > 86400000) return; // только за последние 24ч
        const shown = localStorage.getItem('tpay_broadcast_seen_' + snap.key);
        if (shown) return;
        localStorage.setItem('tpay_broadcast_seen_' + snap.key, '1');
        // Показываем как уведомление
        const notif = document.createElement('div');
        notif.style.cssText = 'position:fixed;bottom:80px;left:16px;right:16px;background:#1c1c1e;color:#fff;padding:14px 18px;border-radius:14px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.3);animation:slideUp 0.3s ease;max-width:400px;margin:0 auto;';
        notif.innerHTML = '<div style="font-size:12px;color:#8c8f94;margin-bottom:4px;">📢 Сообщение от администратора</div><div style="font-size:14px;line-height:1.4;">' + data.text + '</div><button id="dismissBroadcast" style="margin-top:10px;background:#3b7cf6;color:white;border:none;padding:6px 18px;border-radius:20px;font-size:13px;cursor:pointer;font-family:inherit;">OK</button>';
        document.body.appendChild(notif);
        document.getElementById('dismissBroadcast').onclick = () => notif.remove();
        setTimeout(() => { try { notif.remove(); } catch(e) {} }, 10000);
    });
}

// ====== РАЗРЕШЕНИЕ НА УВЕДОМЛЕНИЯ ПРИ ПЕРВОМ ВХОДЕ ======
// Проверяем при первом входе пользователя
const origSplashAndMain = showSplashAndMain;
showSplashAndMain = async function() {
    if (currentUser && currentUser.role !== 'admin') {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            try { await Notification.requestPermission(); } catch(e) {}
        }
    }
    await origSplashAndMain();
};
document.getElementById('cardDetailBtn').onclick = async () => {
    if (isNavigating) return;
    isNavigating = true;
    hideAll();
    cardSkeleton.style.display = 'block';
    await delay(400);
    cardSkeleton.style.display = 'none';
    cardPage.style.display = 'block';
    isNavigating = false;
};
backFromCard.onclick = showMain;

backFromScanner.onclick = showMain;
backFromHistory.onclick = showMain;
function closeDetail() {
    detailPage.classList.remove('detail-visible');
    const bs = detailPage.querySelector('.bottom-sheet');
    if (bs) bs.classList.remove('sheet-visible');
    setTimeout(() => {
        detailPage.style.display = 'none';
        historyPage.style.overflow = '';
    }, 600);
}

backFromDetail.onclick = closeDetail;
detailPage.onclick = (e) => { if (e.target === detailPage) closeDetail(); };
document.getElementById('detailApp').onclick = (e) => e.stopPropagation();

receiptBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const p = payments.find(pay => pay.id === currentPaymentId);
    if (!p) return;
    fillReceipt(p);
    openModal();
});

// ====== ИНИЦИАЛИЗАЦИЯ ======

if (typeof usersRef !== 'undefined') {
    initUsers();
    // Fallback: если Firebase не ответил за 5 секунд, используем PRESET_USERS
    setTimeout(() => {
        if (!usersLoaded) {
            firebaseFailed = true;
            const localUsers = JSON.parse(localStorage.getItem('tpay_local_users') || '[]');
            users = PRESET_USERS.map((u, i) => ({ ...u, id: 'fallback_' + i }));
            localUsers.forEach(u => users.push(u));
            usersLoaded = true;
            splashScreen.style.display = 'none';
            loginPage.style.display = 'flex';
        }
    }, 5000);

    onUsersLoaded(() => {
        splashScreen.style.display = 'none';
        const rememberedId = getRememberedUser();
        if (rememberedId) {
            const pin = getPin(rememberedId);
            if (pin) {
                showPinPage();
            } else {
                clearRememberedUser();
                loginPage.style.display = 'flex';
            }
        } else {
            loginPage.style.display = 'flex';
        }
    });
} else {
    // Firebase не загрузился — используем локальные данные
    const localUsers = JSON.parse(localStorage.getItem('tpay_local_users') || '[]');
    users = PRESET_USERS.map((u, i) => ({ ...u, id: 'fallback_' + i }));
    localUsers.forEach(u => users.push(u));
    splashScreen.style.display = 'none';
    loginPage.style.display = 'flex';
}
