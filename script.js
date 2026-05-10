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
const headerEl = document.querySelector('.header');
const captureCircle = document.getElementById('captureCircle');
const cameraError = document.getElementById('cameraError');
const video = document.getElementById('webcam');
const canvasElement = document.getElementById('qrCanvas');
const canvas = canvasElement.getContext('2d');

const splashScreen = document.getElementById('splashScreen');
const mainSkeleton = document.getElementById('mainSkeleton');
const processingOverlay = document.getElementById('processingOverlay');
const processingText = document.getElementById('processingText');
const processingSub = document.getElementById('processingSub');

const mainPage = document.getElementById('mainPage');
const qrPayBtn = document.getElementById('qrPayBtn');
const historyBtn = document.getElementById('historyBtn');
const goHistoryBtn = document.getElementById('goHistoryBtn');
const totalPaymentsLabel = document.getElementById('totalPaymentsLabel');
const mainCardAmount = document.getElementById('mainCardAmount');
const userName = document.getElementById('userName');

const backFromScanner = document.getElementById('backFromScanner');
const backFromHistory = document.getElementById('backFromHistory');
const backFromDetail = document.getElementById('backFromDetail');

const historyPage = document.getElementById('historyPage');
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

const detailPage = document.getElementById('detailPage');
const detailPrice = document.getElementById('detailPrice');
const detailStatus = document.getElementById('detailStatus');
const detailRows = document.getElementById('detailRows');
const receiptBtn = document.getElementById('receiptBtn');

const recentList = document.getElementById('recentList');
const recentEmpty = document.getElementById('recentEmpty');

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
    const els = [mainPage, scannerView, paymentView, historyPage, detailPage, headerEl];
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

    mainSkeleton.style.display = 'block';
    await delay(400);

    mainSkeleton.style.display = 'none';
    renderHistory();
    historyPage.style.display = 'block';
    isNavigating = false;
}

async function showDetail(id) {
    if (isNavigating) return;
    isNavigating = true;

    currentPaymentId = id;
    const p = payments.find(pay => pay.id === id);
    if (!p) { isNavigating = false; return; }

    detailPrice.textContent = p.price;
    detailStatus.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        Успешно
    `;
    detailRows.innerHTML = `
        <div class="detail-row"><span class="detail-label">Дата</span><span class="detail-value">${p.date}</span></div>
        <div class="detail-row"><span class="detail-label">Время</span><span class="detail-value">${p.time}</span></div>
        <div class="detail-row"><span class="detail-label">Транспорт</span><span class="detail-value">${p.vehicle}</span></div>
        <div class="detail-row"><span class="detail-label">Т/С</span><span class="detail-value">${p.vehicleId}</span></div>
        <div class="detail-row"><span class="detail-label">Сумма</span><span class="detail-value" style="color:#333;font-weight:600;">${p.price}</span></div>
        <div class="detail-row"><span class="detail-label">Статус</span><span class="detail-value" style="color:#4CAF50;">Успешно</span></div>
        <div class="detail-row"><span class="detail-label">Магазин</span><span class="detail-value">${p.store}</span></div>
        <div class="detail-row"><span class="detail-label">Счет списания</span><span class="detail-value">${p.account}</span></div>
        <div class="detail-row"><span class="detail-label">ЮЛ / ИП</span><span class="detail-value">${p.legalName}</span></div>
        <div class="detail-row"><span class="detail-label">ID операции</span><span class="detail-value">${p.transactionId}</span></div>
        <div class="detail-row"><span class="detail-label">СБП</span><span class="detail-value">${p.sbp}</span></div>
        <div class="detail-row"><span class="detail-label">Квитанция</span><span class="detail-value">${p.receiptNumber}</span></div>
    `;

    hideAll();
    mainSkeleton.style.display = 'block';
    await delay(350);

    mainSkeleton.style.display = 'none';
    detailPage.style.display = 'block';
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
    const payment = {
        id: generateId(),
        date: formatDate(now),
        time: formatTime(now),
        fullDate: format(now) + ":" + pad(now.getSeconds()),
        vehicle: document.querySelector('.vehicle').textContent.trim(),
        price: document.querySelector('.price').textContent.trim(),
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

function fillReceipt(p) {
    receiptDate.textContent = p.fullDate;
    receiptSumBig.textContent = p.price;
    receiptSumSmall.textContent = p.price;
    receiptStore.textContent = p.store;
    receiptAccount.textContent = p.account;
    receiptLegal.textContent = p.legalName;
    receiptTransId.textContent = p.transactionId;
    receiptSbp.textContent = p.sbp;
    receiptNumber.textContent = "Квитанция № " + p.receiptNumber;
}

// ====== STORAGE ======

function saveToStorage() {
    try { localStorage.setItem('tpay_payments', JSON.stringify(payments)); } catch(e) {}
}

function loadFromStorage() {
    try {
        const data = localStorage.getItem('tpay_payments');
        if (data) payments = JSON.parse(data);
    } catch(e) { payments = []; }
}

// ====== UI UPDATE ======

function calcTotal() {
    return payments.reduce((sum, p) => {
        const num = parseFloat(p.price.replace(/[^\d,]/g, '').replace(',', '.'));
        return sum + (isNaN(num) ? 0 : num);
    }, 0);
}

function pluralize(n, forms) {
    n = Math.abs(n) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return forms[2];
    if (n1 > 1 && n1 < 5) return forms[1];
    if (n1 === 1) return forms[0];
    return forms[2];
}

function updateMain() {
    const count = payments.length;
    totalPaymentsLabel.textContent = count === 0 ? 'Нет платежей' : (count + ' ' + pluralize(count, ['платёж', 'платежа', 'платежей']));
    mainCardAmount.textContent = calcTotal();
    renderRecent();
}

function renderRecent() {
    if (payments.length === 0) {
        recentList.innerHTML = '';
        recentEmpty.style.display = 'flex';
        return;
    }
    recentEmpty.style.display = 'none';
    const latest = payments.slice(0, 5);
    recentList.innerHTML = latest.map(p => `
        <div class="operation-item" data-id="${p.id}">
            <div class="op-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
            </div>
            <div class="op-info">
                <div class="op-title">${p.vehicle}</div>
                <div class="op-date">${p.date}</div>
            </div>
            <div class="op-amount">
                ${p.price}
                <span class="op-status">Успешно</span>
            </div>
        </div>
    `).join('');
    recentList.querySelectorAll('.operation-item').forEach(el => {
        el.addEventListener('click', () => showDetail(el.dataset.id));
    });
}

function renderHistory() {
    if (payments.length === 0) {
        historyList.innerHTML = '';
        historyEmpty.style.display = 'flex';
        return;
    }
    historyEmpty.style.display = 'none';
    historyList.innerHTML = payments.map(p => `
        <div class="history-item" data-id="${p.id}">
            <div class="hist-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
            </div>
            <div class="hist-info">
                <div class="hist-title">${p.vehicle}</div>
                <div class="hist-sub">${p.date} ${p.time}</div>
            </div>
            <div class="hist-right">
                <div class="hist-price">${p.price}</div>
                <div class="hist-status">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    </svg>
                    Успешно
                </div>
            </div>
        </div>
    `).join('');
    historyList.querySelectorAll('.history-item').forEach(el => {
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

// ====== СОБЫТИЯ ======

payBtn.onclick = async () => {
    payBtn.disabled = true;
    payBtn.textContent = 'Оплачиваю...';

    showProcessing('Оплата проходит', 'Спишем 44 ₽ со счёта путешествий');
    await delay(10000);

    hideProcessing();
    savePayment();
    updateMain();

    payBtn.disabled = false;
    payBtn.textContent = 'Оплатить';
    await showMain();
};

closeBtn.onclick = () => { modal.style.display = 'none'; };
modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };

captureCircle.onclick = goToPayment;

qrPayBtn.onclick = showScanner;
historyBtn.onclick = showHistory;
goHistoryBtn.onclick = showHistory;

backFromScanner.onclick = showMain;
backFromHistory.onclick = showMain;
backFromDetail.onclick = showHistory;

clearHistoryBtn.onclick = clearHistory;

receiptBtn.onclick = () => {
    const p = payments.find(pay => pay.id === currentPaymentId);
    if (!p) return;
    fillReceipt(p);
    modal.style.display = 'flex';
};

// ====== ИНИЦИАЛИЗАЦИЯ ======

loadName();
loadFromStorage();

(async function init() {
    await delay(1400);

    splashScreen.classList.add('splash-hide');
    await delay(350);
    splashScreen.style.display = 'none';

    mainSkeleton.style.display = 'block';
    await delay(600);

    mainSkeleton.style.display = 'none';
    updateMain();
    mainPage.style.display = 'block';
})();
