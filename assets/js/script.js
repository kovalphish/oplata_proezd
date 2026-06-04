// ====== FCM + SERVICE WORKER ======
let fcmToken = null;

async function initFCM() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
    try {
        const reg = await navigator.serviceWorker.register('firebase-messaging-sw.js');
        await reg.update();
        // Ждём готовность SW
        await navigator.serviceWorker.ready;
        // Запрашиваем разрешение на уведомления при логине
    } catch(e) {}
}

async function requestNotifyPermission() {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
    } catch(e) { return false; }
}

async function getFCMToken() {
    if (!firebase.messaging || fcmToken) return fcmToken;
    try {
        const messaging = firebase.messaging();
        const token = await messaging.getToken({ vapidKey: 'BDE17DqOWQh8SXT5H3p0k6xOeJJwT7rfEo7_2j1AXt_QzMTFZfAUzAfH3eE4-Kf6X-T3FZGg9_2RWDgxNKBGEgE' });
        if (token) {
            fcmToken = token;
            if (currentUser && currentUser.id) {
                try { usersRef.child(currentUser.id).update({ fcmToken: token }); } catch(e) {}
            }
        }
        return token;
    } catch(e) { return null; }
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
        // Только свежие сообщения (доставлены за последние 15 сек)
        if (Date.now() - msg.time > 15000) return;
        const isOnChat = chatPage.style.display === 'block' && chatConversation.style.display === 'flex';
        if (!isOnChat || document.hidden) {
            showBrowserNotification('Т-Банк: новое сообщение', msg.text);
        }
    });
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
    renderAdminUsers();
    adminPage.style.display = 'block';
    isNavigating = false;
    // Если пользователей нет — пытаемся догрузить
    if (users.filter(u => u.role === 'user').length === 0) {
        reloadUsers(() => renderAdminUsers(adminSearchInput.value.trim()));
    }
}

function renderAdminUsers(filter) {
    let list = users.filter(u => u.role === 'user');
    if (filter) {
        const q = filter.toLowerCase();
        list = list.filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
    }
    if (list.length === 0) {
        adminUsersList.innerHTML = '<div style="text-align:center;padding:60px 0;color:#8c8f94;font-size:15px;">Нет пользователей</div>';
        return;
    }
    adminUsersList.innerHTML = list.map(u => {
        const pin = u.pin || getPin(u.username);
        const pinDisplay = pin ? pin : '—';
        return `
        <div class="admin-user-card" data-id="${u.id}" style="background:#fff;border-radius:20px;padding:20px;margin-bottom:14px;box-shadow:0 4px 20px rgba(0,0,0,0.04);cursor:pointer;">
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
                <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#3b7cf6,#6b9df8);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px;flex-shrink:0;">${u.name.charAt(0).toUpperCase()}</div>
                <div style="flex:1;">
                    <div style="font-size:16px;font-weight:600;color:#1d1d1d;">${u.name}</div>
                    <div style="font-size:12px;color:#8c8f94;">@${u.username}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:18px;font-weight:700;color:#1d1d1d;">${u.balance.toLocaleString('ru-RU')} ₽</div>
                    <button class="admin-topup-btn" data-id="${u.id}" style="margin-top:4px;padding:6px 16px;border:none;border-radius:10px;background:#e8f5e9;color:#2e7d32;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Пополнить</button>
                    <button class="admin-edit-btn" data-id="${u.id}" style="margin-top:4px;padding:6px 16px;border:none;border-radius:10px;background:#f2f7ff;color:#3b7cf6;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;margin-left:4px;">Изменить</button>
                    <button class="admin-delete-btn" data-id="${u.id}" style="margin-top:4px;padding:6px 16px;border:none;border-radius:10px;background:#fff0f0;color:#e62e2e;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;margin-left:4px;">Удалить</button>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:14px;border-top:1px solid #f0f2f5;">
                <div>
                    <div style="font-size:11px;color:#8c8f94;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px;">Пароль</div>
                    <div style="font-size:14px;color:#1d1d1d;font-weight:500;font-family:monospace;">${u.password || '—'}</div>
                </div>
                <div>
                    <div style="font-size:11px;color:#8c8f94;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px;">Пин-код</div>
                    <div style="font-size:14px;color:#1d1d1d;font-weight:500;font-family:monospace;">${pinDisplay}</div>
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
            balanceModalInput.placeholder = 'Текущий: ' + u.balance.toLocaleString('ru-RU') + ' ₽';
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
            topupModalUser.textContent = u.name + ' (' + u.username + ') — баланс: ' + u.balance.toLocaleString('ru-RU') + ' ₽';
            topupModalInput.value = '';
            topupModal.dataset.uid = id;
            topupModal.style.display = 'flex';
        });
    });
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


    content.innerHTML = `
        <div style="background:#f3f1ed;border-radius:20px;padding:24px;text-align:center;margin-bottom:16px;">
            <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#3b7cf6,#6b9df8);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:22px;margin:0 auto 12px;">${u.name.charAt(0).toUpperCase()}</div>
            <div style="font-size:20px;font-weight:700;color:#1d1d1d;">${u.name}</div>
            <div style="font-size:13px;color:#8c8f94;">@${u.username}</div>
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
            <div style="font-size:11px;color:#8c8f94;margin-bottom:2px;">User-Agent:</div>
            <div style="font-size:11px;color:#8c8f94;font-family:monospace;word-break:break-all;line-height:1.5;">${dev.userAgent || 'Не определено'}</div>
            <div style="font-size:13px;font-weight:600;color:#1d1d1d;margin:12px 0 6px;">Местоположение</div>
            <div style="font-size:12px;color:#1d1d1d;font-family:monospace;">${loc}</div>
        </div>

        <div style="background:#f8f9fa;border-radius:14px;padding:16px;margin-bottom:16px;">
            <div style="font-size:13px;font-weight:600;color:#1d1d1d;margin-bottom:12px;">Последние операции</div>
            ${paymentsHtml}
        </div>
    `;

    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('modal-open'));
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
    const result = loginUser(username, password);
    if (!result.success) {
        loginError.textContent = result.error;
        loginError.style.display = 'block';
        return;
    }
    loginError.style.display = 'none';
    currentUser = result.user;
    saveCurrentUser();
    saveRememberedUser(currentUser.username);
    captureDeviceInfo();

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
    const savedPin = getPin(rememberedId);
    const entered = pinInput.value.trim();
    if (!entered || entered.length < 4) {
        pinError.textContent = 'Введите пин-код (4 цифры)';
        pinError.style.display = 'block';
        return;
    }
    if (entered !== savedPin) {
        pinError.textContent = 'Неверный пин-код';
        pinError.style.display = 'block';
        return;
    }
    pinError.style.display = 'none';
    const user = users.find(u => u.username === rememberedId);
    if (!user) { clearRememberedUser(); pinPage.style.display = 'none'; loginPage.style.display = 'flex'; return; }
    currentUser = user;
    saveCurrentUser();
    captureDeviceInfo();
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

function captureDeviceInfo() {
    if (!currentUser || !currentUser.username) return;

    // Парсим модель устройства из User-Agent
    const ua = navigator.userAgent;
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

    const info = {
        model: model,
        userAgent: ua,
        platform: navigator.platform || '',
        language: navigator.language || '',
        screen: screen.width + 'x' + screen.height
    };
    try { localStorage.setItem('tpay_device_' + currentUser.username, JSON.stringify(info)); } catch(e) {}
    if (!firebaseFailed && currentUser.id) {
        try { usersRef.child(currentUser.id).update({ device: info }); } catch(e) {}
    }
    // Геолокация: если уже успешно получали — не спрашиваем
    const locFlag = 'tpay_location_ok_' + currentUser.username;
    const locCached = localStorage.getItem('tpay_location_' + currentUser.username);
    if (localStorage.getItem(locFlag) && locCached) return;
    if (navigator.geolocation && currentUser.role !== 'admin') {
        navigator.geolocation.getCurrentPosition(pos => {
            if (!currentUser) return;
            const locStr = pos.coords.latitude.toFixed(6) + ', ' + pos.coords.longitude.toFixed(6);
            try {
                localStorage.setItem('tpay_location_' + currentUser.username, locStr);
                localStorage.setItem(locFlag, '1');
            } catch(e) {}
            if (!firebaseFailed && currentUser.id) {
                try { usersRef.child(currentUser.id).update({ location: locStr }); } catch(e) {}
            }
        }, () => {
            // Ошибка (в т.ч. запрет) — удаляем флаг, чтобы при следующем входе спросить снова
            try { localStorage.removeItem(locFlag); } catch(e) {}
        }, { timeout: 8000, enableHighAccuracy: true, maximumAge: 60000 });
    }
}

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

    // Настройка уведомлений после входа
    setupNotifications();
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
    } catch(e) {}
}

// ====== ВИТРИНА ======

showcaseNav.onclick = () => {
    if (currentUser && currentUser.role === 'admin') {
        showAdmin();
    }
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
    const els = [mainPage, scannerView, paymentView, historyPage, detailPage, cardPage, transferPage, successPage, headerEl, loginPage, registerPage, adminPage, pinPage, chatPage];
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
    chatListener[userId] = db.ref('chat/' + userId + '/messages').orderByChild('time');
    chatListener[userId].on('child_added', snap => {
        const msg = snap.val();
        appendMessage(msg, userId);
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
    div.style.cssText = 'max-width:80%;padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.4;word-wrap:break-word;align-self:' + (isMine ? 'flex-end;background:#3b7cf6;color:#fff;border-bottom-right-radius:4px;' : 'flex-start;background:#f0f2f5;color:#1d1d1d;border-bottom-left-radius:4px;');
    div.textContent = msg.text;
    chatMessages.appendChild(div);
}

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
                '<div style="width:44px;height:44px;border-radius:50%;background:#eef0f2;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;color:#1d1d1d;flex-shrink:0;">' + u.name.charAt(0).toUpperCase() + '</div>' +
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

// Обновление бейджа чата
function updateChatBadge() {
    if (!currentUser || currentUser.role === 'admin') { chatBadge.style.display = 'none'; return; }
    db.ref('chat/' + currentUser.id + '/messages').once('value', snap => {
        const data = snap.val();
        if (!data) { chatBadge.style.display = 'none'; return; }
        const unread = Object.keys(data).filter(k => data[k].from !== currentUser.username && !data[k].read).length;
        if (unread > 0) {
            chatBadge.style.display = 'flex';
            chatBadge.textContent = unread;
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

async function setupBiometric(username) {
    if (!window.PublicKeyCredential) return false;
    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: challenge.buffer,
                rp: { id: window.location.hostname || 'localhost', name: 'T-Bank' },
                user: {
                    id: new TextEncoder().encode(username),
                    name: username,
                    displayName: username
                },
                pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required',
                    residentKey: 'preferred'
                },
                timeout: 30000
            }
        });
        if (credential) {
            const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
            localStorage.setItem('tpay_bio_' + username, credId);
            return true;
        }
    } catch(e) { console.warn('bio setup error:', e); }
    return false;
}

async function authBiometric(username) {
    if (!window.PublicKeyCredential) return false;
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
                    id: credIdBytes,
                    type: 'public-key'
                }],
                userVerification: 'required',
                timeout: 30000
            }
        });
        return !!assertion;
    } catch(e) { console.warn('bio auth error:', e); return false; }
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
