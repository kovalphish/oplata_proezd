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
const mainSkeleton = document.getElementById('mainSkeleton');
const processingOverlay = document.getElementById('processingOverlay');
const processingText = document.getElementById('processingText');
const processingSub = document.getElementById('processingSub');

const mainPage = document.getElementById('mainPage');
const scanQrBtn = document.getElementById('scanQrBtn');
const paymentsNav = document.getElementById('paymentsNav');
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
const detailDatetime = document.getElementById('detailDatetime');
const detailTitle = document.getElementById('detailTitle');
const detailCategory = document.getElementById('detailCategory');
const detailCardName = document.getElementById('detailCardName');
const detailBalance = document.getElementById('detailBalance');
const receiptBtn = document.getElementById('receiptBtn');

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

    detailDatetime.textContent = `${p.date} • ${p.time}`;
    detailTitle.textContent = p.vehicle;
    detailPrice.textContent = `−${p.price}`;

    historyPage.style.overflow = 'hidden';
    detailPage.style.display = 'block';
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
    const payment = {
        id: generateId(),
        date: formatDate(now),
        time: formatTime(now),
        fullDate: format(now) + ":" + pad(now.getSeconds()),
        vehicle: 'МУП "Служба организации движения"',
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
        if (data) {
            payments = JSON.parse(data);
            payments.forEach(p => {
                if (p.vehicle === 'Автобус №22') p.vehicle = 'МУП "Служба организации движения"';
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
    historyList.innerHTML = payments.map(p => `
        <div class="tx-item" data-id="${p.id}">
            <div class="tx-icon-wrap green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="4" y="5" width="16" height="14" rx="2"/><rect x="6" y="8" width="4" height="3" rx="1"/><rect x="12" y="8" width="4" height="3" rx="1"/><circle cx="8" cy="17" r="1.5" fill="#333"/><circle cx="16" cy="17" r="1.5" fill="#333"/></svg>
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
    `).join('');
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

scanQrBtn.onclick = showScanner;
paymentsNav.onclick = showHistory;
document.getElementById('allOperationsWidget').onclick = showHistory;

backFromScanner.onclick = showMain;
backFromHistory.onclick = showMain;
function closeDetail() {
    detailPage.style.display = 'none';
    historyPage.style.overflow = '';
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
