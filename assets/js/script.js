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
const receiptRows = document.getElementById("receiptRows");
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

const processingOverlay = document.getElementById('processingOverlay');
const processingText = document.getElementById('processingText');
const processingSub = document.getElementById('processingSub');

const mainPageSkeleton = document.getElementById('mainPageSkeleton');
const historySkeleton = document.getElementById('historySkeleton');
const cardPageSkeleton = document.getElementById('cardPageSkeleton');
const transferSkeleton = document.getElementById('transferSkeleton');
const mainPage = document.getElementById('mainPage');
const scanQrBtn = document.getElementById('scanQrBtn');
const paymentsNav = document.getElementById('paymentsNav');
const userName = document.getElementById('userName');

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
const doTransferBtn = document.getElementById('doTransferBtn');
const backFromTransfer = document.getElementById('backFromTransfer');
const closeSuccess = document.getElementById('closeSuccess');
const successDoneBtn = document.getElementById('successDoneBtn');
const successPhone = document.getElementById('successPhone');
const successAmount = document.getElementById('successAmount');
const successBankAbbr = document.getElementById('successBankAbbr');
const successName = document.getElementById('successName');
const successReceiptBtn = document.getElementById('successReceiptBtn');

// ====== СОСТОЯНИЕ ======

let stream = null;
let animationFrameId = null;
let payments = [];
let currentPaymentId = null;
let isNavigating = false;

// ====== ИМЯ ======

function loadName() {
    try {
        const saved = localStorage.getItem('tpay_name');
        if (saved) userName.textContent = saved;
    } catch(e) {}
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

let balance = 20000;

function loadBalance() {
    try {
        const saved = localStorage.getItem('tpay_balance');
        if (saved !== null) balance = parseFloat(saved);
        else { localStorage.setItem('tpay_balance', '20000'); }
    } catch(e) {}
    updateBalanceUI();
}

function saveBalance() {
    try { localStorage.setItem('tpay_balance', balance.toString()); } catch(e) {}
}

function updateBalanceUI() {
    const el = document.getElementById('mainBalance');
    if (el) el.textContent = balance.toLocaleString('ru-RU') + ' ₽';
    const cardBalances = document.querySelectorAll('#cardPage .dark-header .balance');
    cardBalances.forEach(b => { b.textContent = balance.toLocaleString('ru-RU') + ' ₽'; });
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
    const els = [mainPage, scannerView, paymentView, historyPage, detailPage, cardPage, transferPage, successPage, headerEl];
    els.forEach(el => { if (el) el.style.display = 'none'; });
}

async function showWithSkeleton(page, skeleton, delayMs) {
    if (isNavigating) return;
    isNavigating = true;
    stopScanning();
    hideAll();

    if (skeleton) skeleton.style.display = 'block';
    page.style.display = 'block';

    await delay(delayMs || 300);

    if (skeleton) skeleton.style.display = 'none';
    isNavigating = false;
}

async function showMain() {
    if (isNavigating) return;
    isNavigating = true;
    stopScanning();
    hideAll();

    mainPageSkeleton.style.display = 'block';
    mainPage.style.display = 'block';
    await delay(400);

    mainPageSkeleton.style.display = 'none';
    updateMain();
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
    historyPage.style.display = 'block';
    renderHistory();
    await delay(250);

    historySkeleton.style.display = 'none';
    isNavigating = false;
}

async function showDetail(id) {
    if (isNavigating) return;
    isNavigating = true;

    currentPaymentId = id;
    const p = payments.find(pay => pay.id === id);
    if (!p) { isNavigating = false; return; }

    detailDatetime.textContent = `${p.date} • ${p.time}`;
    const detailIcon = document.getElementById('detailIcon');
    const iconContainer = document.querySelector('#detailPage .tx-icon-container');
    if (p.type === 'transfer') {
        detailTitle.textContent = p.phone || 'Перевод';
        detailCategory.innerHTML = '🔵 Перевод через СБП';
        detailIcon.src = 'assets/ico/spb1.svg';
        detailIcon.style.width = '48px';
        detailIcon.style.height = '48px';
        iconContainer.style.background = '#d1d5db';
    } else {
        detailTitle.textContent = p.vehicle;
        detailCategory.innerHTML = '🚎 Местный транспорт • MCC 4131';
        detailIcon.src = 'assets/ico/logo-transport.png';
        detailIcon.style.width = '64px';
        detailIcon.style.height = '64px';
        iconContainer.style.background = 'transparent';
    }
    detailPrice.textContent = `−${p.price}`;

    historyPage.style.overflow = 'hidden';
    detailPage.style.display = 'block';
    const sheet = document.querySelector('#detailPage .bottom-sheet');
    sheet.classList.remove('sheet-visible');
    void sheet.offsetHeight;
    sheet.classList.add('sheet-visible');
    await delay(350);
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

function generateRecipientId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "";
    for (let i = 0; i < 12; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
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

function saveTransferPayment(phone, bank, amount) {
    const now = new Date();
    subtractBalance(amount + ' ₽');
    const payment = {
        id: generateId(),
        type: 'transfer',
        date: formatDate(now),
        time: formatTime(now),
        fullDate: format(now) + ":" + pad(now.getSeconds()),
        vehicle: 'Перевод через СБП',
        price: amount + ' ₽',
        phone: phone,
        bank: bank,
        commission: '0 ₽',
        recipientId: generateRecipientId(),
        status: "Успешно",
        store: 'Перевод по номеру телефона',
        account: "2837 9374 **** 0433",
        legalName: bank,
        transactionId: generateTransId(),
        sbp: "30701",
        receiptNumber: generateReceiptNum()
    };
    payments.unshift(payment);
    saveToStorage();
    return payment;
}

function calculateTotalSpent() {
    let total = 0;
    payments.forEach(p => {
        const num = parseFloat(p.price.replace(/[^\d,]/g, '').replace(',', '.'));
        if (!isNaN(num)) total += num;
    });
    const el = document.getElementById('mainTotalSpent');
    if (el) el.textContent = total.toLocaleString('ru-RU') + ' ₽';
    const el2 = document.getElementById('historyTotalSpent');
    if (el2) el2.textContent = total.toLocaleString('ru-RU') + ' ₽';
}

function fillReceipt(p) {
    receiptDate.textContent = p.fullDate;
    receiptSumBig.textContent = p.price;
    receiptRows.innerHTML = '';

    if (p.type === 'transfer') {
        const rows = [
            { label: 'Перевод по номеру телефона', value: '' },
            { label: 'Статус', value: p.status },
            { label: 'Сумма', value: p.price },
            { label: 'Комиссия', value: p.commission || '0 ₽' },
            { label: 'Телефон получателя', value: p.phone },
            { label: 'Банк получателя', value: p.bank },
            { label: 'Идентификатор получателя', value: p.recipientId || 'B428J384777489324HG' },
            { label: 'Счет списания', value: p.account }
        ];
        rows.forEach(r => {
            const div = document.createElement('div');
            div.className = 'receipt-row';
            if (r.label === 'Перевод по номеру телефона') {
                div.innerHTML = `<span class="row-title" style="font-weight:600;">${r.label}</span>`;
            } else {
                div.innerHTML = `<span class="row-title">${r.label}</span><span class="row-value">${r.value}</span>`;
            }
            receiptRows.appendChild(div);
        });
    } else {
        const rows = [
            { label: 'Покупка', value: 'По QR-коду' },
            { label: 'Статус', value: p.status },
            { label: 'Сумма', value: p.price },
            { label: 'Магазин', value: p.store },
            { label: 'Счет списания', value: p.account },
            { label: 'Наименование ЮЛ или ИП', value: p.legalName },
            { label: 'Идентификатор операции', value: p.transactionId },
            { label: 'СБП', value: p.sbp }
        ];
        rows.forEach(r => {
            const div = document.createElement('div');
            div.className = 'receipt-row';
            div.innerHTML = `<span class="row-title">${r.label}</span><span class="row-value">${r.value}</span>`;
            receiptRows.appendChild(div);
        });
    }
    receiptNumber.textContent = "Квитанция № " + p.receiptNumber;
}

// ====== STORAGE ======

function saveToStorage() {
    try { localStorage.setItem('tpay_payments', JSON.stringify(payments)); } catch(e) {}
}

function loadFromStorage() {
    try {
        const data = localStorage.getItem('tpay_payments');
        if (data) {
            payments = JSON.parse(data);
            payments.forEach(p => {
                if (p.vehicle === 'Автобус №22') p.vehicle = 'МУП "Служба организации движения"';
                if (p.type === 'transfer' && (!p.account || p.account === '9284 9483 **** 2930')) p.account = '2837 9374 **** 0433';
                if (p.type === 'transfer' && !p.commission) p.commission = '0 ₽';
            });
        }
    } catch(e) { payments = []; }
}

// ====== UI UPDATE ======

function updateMain() {
}

function renderHistory() {
    if (payments.length === 0) {
        historyList.innerHTML = '';
        historyEmpty.style.display = 'flex';
        document.getElementById('historyDateHeader').style.display = 'none';
        return;
    }
    document.getElementById('historyDateHeader').style.display = 'flex';
    historyEmpty.style.display = 'none';
    historyList.innerHTML = payments.map(p => {
        if (p.type === 'transfer') {
            return `
                <div class="tx-item" data-id="${p.id}">
                    <div class="tx-icon-wrap" style="background:#d1d5db;">
                        <img src="assets/ico/spb1.svg" width="28" height="28" alt="">
                    </div>
                    <div class="tx-details">
                        <div class="tx-name">${p.phone || 'Перевод'}</div>
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
                <div class="tx-icon-wrap" style="background:transparent;">
                        <img src="assets/ico/logo-transport.png" width="44" height="44" alt="">
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
    calculateTotalSpent();
}

// ====== ПЕРЕВОД ======

doTransferBtn.onclick = async () => {
    const phone = transferPhone.value.trim();
    const amount = transferAmount.value.trim();
    if (!phone || phone.length < 10) { transferPhone.style.borderColor = '#e62e2e'; return; }
    if (!amount || parseFloat(amount) < 1) { transferAmount.style.borderColor = '#e62e2e'; return; }
    if (!selectedBank) return;

    const payment = saveTransferPayment(phone, selectedBank, amount);
    updateMain();
    calculateTotalSpent();

    successPhone.textContent = phone;
    successAmount.textContent = '− ' + amount + ' ₽';
    successBankAbbr.textContent = selectedBank === 'Сбер Банк' ? 'Сбер' : selectedBank === 'Т-Банк' ? 'Т-Банк' : selectedBank === 'Альфа Банк' ? 'Альфа' : selectedBank === 'Озон Банк' ? 'Озон' : selectedBank;
    const names = ['Анна', 'Борис', 'Виктор', 'Галина', 'Дмитрий', 'Елена', 'Жанна', 'Захар', 'Ирина', 'Константин', 'Леонид', 'Марина', 'Наталья', 'Ольга', 'Павел', 'Роман', 'Светлана', 'Татьяна', 'Ульяна', 'Фёдор'];
    const nameIndex = Math.floor(Math.random() * names.length);
    const userName = names[nameIndex];
    const firstLetter = userName.charAt(0);
    successName.textContent = userName;
    const avatar = document.getElementById('successUserAvatar');
    avatar.textContent = firstLetter;
    const colors = ['#e31e24', '#3b7cf6', '#21a038', '#f5a623', '#8e44ad', '#e67e22', '#1abc9c', '#e74c3c', '#3498db', '#2ecc71'];
    avatar.style.background = colors[userName.charCodeAt(0) % colors.length];

    hideAll();
    successPage.style.display = 'block';
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
    calculateTotalSpent();

    payBtn.disabled = false;
    payBtn.textContent = 'Оплатить';
    await showMain();
};

closeBtn.onclick = () => { modal.style.display = 'none'; };
modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };

captureCircle.onclick = goToPayment;

backFromTransfer.onclick = async () => {
    await showWithSkeleton(cardPage, cardPageSkeleton, 150);
};
closeSuccess.onclick = () => { hideAll(); showMain(); };
successDoneBtn.onclick = () => { hideAll(); showMain(); };
successReceiptBtn.onclick = () => {
    const p = payments[0];
    if (!p) return;
    fillReceipt(p);
    modal.style.display = 'flex';
};

document.getElementById('gotoTransferBtn').onclick = async () => {
    selectedBank = null;
    document.querySelectorAll('.bank-item').forEach(c => c.classList.remove('active'));
    transferPhone.value = '';
    transferAmount.value = '';
    const srcBalance = document.getElementById('transferSourceBalance');
    if (srcBalance) srcBalance.textContent = balance.toLocaleString('ru-RU') + ' ₽';
    await showWithSkeleton(transferPage, transferSkeleton, 250);
};

scanQrBtn.onclick = showScanner;
document.getElementById('transferActionBtn').onclick = async () => {
    selectedBank = null;
    document.querySelectorAll('.bank-item').forEach(c => c.classList.remove('active'));
    transferPhone.value = '';
    transferAmount.value = '';
    const srcBalance = document.getElementById('transferSourceBalance');
    if (srcBalance) srcBalance.textContent = balance.toLocaleString('ru-RU') + ' ₽';
    await showWithSkeleton(transferPage, transferSkeleton, 250);
};
paymentsNav.onclick = showHistory;
document.getElementById('allOperationsWidget').onclick = showHistory;
document.getElementById('cardDetailBtn').onclick = async () => {
    await showWithSkeleton(cardPage, cardPageSkeleton, 250);
};
backFromCard.onclick = showMain;

backFromScanner.onclick = showMain;
backFromHistory.onclick = showMain;
function closeDetail() {
    const sheet = document.querySelector('#detailPage .bottom-sheet');
    sheet.classList.remove('sheet-visible');
    setTimeout(() => {
        detailPage.style.display = 'none';
        historyPage.style.overflow = '';
    }, 350);
}

backFromDetail.onclick = closeDetail;
detailPage.onclick = (e) => { if (e.target === detailPage) closeDetail(); };
document.getElementById('detailApp').onclick = (e) => e.stopPropagation();

receiptBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const p = payments.find(pay => pay.id === currentPaymentId);
    if (!p) return;
    fillReceipt(p);
    modal.style.display = 'flex';
});

// ====== ИНИЦИАЛИЗАЦИЯ ======

loadName();
loadFromStorage();
loadBalance();

(async function init() {
    await delay(1400);

    splashScreen.classList.add('splash-hide');
    await delay(350);
    splashScreen.style.display = 'none';

    mainPageSkeleton.style.display = 'block';
    mainPage.style.display = 'block';
    await delay(500);

    mainPageSkeleton.style.display = 'none';
    updateMain();
    calculateTotalSpent();
})();
