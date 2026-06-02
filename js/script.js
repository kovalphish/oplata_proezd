// ====== ПРИНУДИТЕЛЬНОЕ УДАЛЕНИЕ SERVICE WORKER ======
(function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for (var sw of registrations) {
                sw.unregister();
            }
        });
    }
    if ('caches' in window) {
        caches.keys().then(function(names) {
            for (var name of names) {
                caches.delete(name);
            }
        });
    }
})();

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
        });
    }).catch(e => {
        console.error('Firebase error:', e);
        firebaseFailed = true;
        splashScreen.style.display = 'none';
        loginPage.style.display = 'flex';
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
}

function getPin(username) {
    try { return localStorage.getItem('tpay_pin_' + username); } catch(e) { return null; }
}

function removePin(username) {
    try { localStorage.removeItem('tpay_pin_' + username); } catch(e) {}
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
        const pin = getPin(u.username);
        const pinDisplay = pin ? pin : '—';
        return `
        <div style="background:#fff;border-radius:20px;padding:20px;margin-bottom:14px;box-shadow:0 4px 20px rgba(0,0,0,0.04);">
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
                <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#3b7cf6,#6b9df8);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px;flex-shrink:0;">${u.name.charAt(0).toUpperCase()}</div>
                <div style="flex:1;">
                    <div style="font-size:16px;font-weight:600;color:#1d1d1d;">${u.name}</div>
                    <div style="font-size:12px;color:#8c8f94;">@${u.username}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:18px;font-weight:700;color:#1d1d1d;">${u.balance.toLocaleString('ru-RU')} ₽</div>
                    <button class="admin-edit-btn" data-id="${u.id}" style="margin-top:4px;padding:6px 16px;border:none;border-radius:10px;background:#f2f7ff;color:#3b7cf6;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Изменить</button>
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
}

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

savePinBtn.onclick = () => {
    if (!currentUser) return;
    const pin = newPinInput.value.trim();
    const confirm = confirmPinInput.value.trim();
    if (!pin || pin.length < 4) { newPinInput.style.borderColor = '#e62e2e'; return; }
    if (pin !== confirm) { confirmPinInput.style.borderColor = '#e62e2e'; return; }
    newPinInput.style.borderColor = '';
    confirmPinInput.style.borderColor = '';
    savePin(currentUser.username, pin);
    saveRememberedUser(currentUser.username);
    closePinModal();
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
    if (val.length === 0) { transferPhone.value = ''; return; }
    let formatted = '+7';
    if (val.length > 1) formatted += ' (' + val.substring(1, 4);
    if (val.length >= 5) formatted += ') ' + val.substring(4, 7);
    if (val.length >= 8) formatted += '-' + val.substring(7, 9);
    if (val.length >= 10) formatted += '-' + val.substring(9, 11);
    transferPhone.value = formatted;
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
    const els = [mainPage, scannerView, paymentView, historyPage, detailPage, cardPage, transferPage, successPage, headerEl, loginPage, registerPage, adminPage, pinPage];
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
    const total = payments.reduce((sum, p) => sum + parsePrice(p.price), 0);
    const el = document.getElementById('mainTotalSpent');
    if (el) el.textContent = total.toLocaleString('ru-RU') + ' ₽';
}

function renderHistory() {
    if (payments.length === 0) {
        historyList.innerHTML = '';
        historyEmpty.style.display = 'flex';
        document.getElementById('historyDateHeader').style.display = 'none';
        document.getElementById('historyTotalSpent').textContent = '0 ₽';
        return;
    }
    document.getElementById('historyDateHeader').style.display = 'flex';
    historyEmpty.style.display = 'none';

    const today = formatDate(new Date());
    const todayTotal = payments
        .filter(p => p.date === today)
        .reduce((sum, p) => sum + parsePrice(p.price), 0);
    const allTotal = payments.reduce((sum, p) => sum + parsePrice(p.price), 0);

    document.getElementById('historyDateTotal').textContent = '−' + todayTotal.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('historyTotalSpent').textContent = allTotal.toLocaleString('ru-RU') + ' ₽';

    historyList.innerHTML = payments.map(p => {
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
        const comment = transferComment.value.trim();
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
    transferSkeleton.style.display = 'block';
    await delay(350);
    transferSkeleton.style.display = 'none';
    transferPage.style.display = 'block';
    isNavigating = false;
};

scanQrBtn.onclick = showScanner;
paymentsNav.onclick = showHistory;
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
