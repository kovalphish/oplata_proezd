// --- ЛОГИКА ВРЕМЕНИ И ОПЛАТЫ ---

function pad(n) { return n.toString().padStart(2, "0"); }

function format(d) {
    return pad(d.getDate()) + "." +
           pad(d.getMonth()+1) + "." +
           d.getFullYear() + " " +
           pad(d.getHours()) + ":" +
           pad(d.getMinutes());
}

// Элементы DOM
const fixedTimeElement = document.getElementById("fixedTime");
const modal = document.getElementById("modal");
const payBtn = document.getElementById("payBtn");
const closeBtn = document.getElementById("closeBtn");
const mainPrice = document.querySelector(".price"); 
const receiptDate = document.getElementById("receiptDate");
const receiptSumBig = document.getElementById("receiptSumBig");
const receiptSumSmall = document.getElementById("receiptSumSmall");


payBtn.onclick = () => {
    const currentPrice = mainPrice.innerText;
    receiptSumBig.innerText = currentPrice;
    receiptSumSmall.innerText = currentPrice;

    const seconds = pad(new Date().getSeconds());
    receiptDate.textContent = fixedTimeElement.textContent + ":" + seconds;

    modal.style.display = "flex";
};

closeBtn.onclick = () => { modal.style.display = "none"; };
modal.onclick = e => { if (e.target === modal) modal.style.display = "none"; };


// --- ЛОГИКА СКАНИРОВАНИЯ QR И УПРАВЛЕНИЯ РЕЖИМАМИ ---

const scannerView = document.getElementById('scannerView');
const paymentView = document.getElementById('paymentView');
const header = document.querySelector('.header');
const showScannerBtn = document.getElementById('showScannerBtn'); 
const captureCircle = document.getElementById('captureCircle'); 
const cameraError = document.getElementById('cameraError'); // Элемент ошибки

const video = document.getElementById('webcam');
const canvasElement = document.getElementById('qrCanvas');
const canvas = canvasElement.getContext('2d');

let stream = null;
let animationFrameId = null;

// ФУНКЦИЯ 1: Запуск камеры
function startScanning() {
    // Скрываем ошибку при попытке запуска
    cameraError.style.display = 'none';

    // Проверка поддержки API
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
        cameraError.style.display = 'block';
        return;
    }
    
    // ИСПРАВЛЕНИЕ: Запрашиваем ЗАДНЮЮ камеру (facingMode: "environment")
    navigator.mediaDevices.getUserMedia({ 
        video: {
            facingMode: "environment" 
        } 
    }) 
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
            // Если доступ запрещен или произошла ошибка
            cameraError.style.display = 'block'; 
            console.error('Ошибка доступа к камере (возможно, нет HTTPS или запрещено):', err);
        });
}


// ФУНКЦИЯ 2: Остановка сканирования
function stopScanning() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}


// ФУНКЦИЯ 3: Переключение в режим оплаты (по нажатию на центральный круг)
captureCircle.onclick = () => {
    stopScanning(); 
    scannerView.style.display = 'none'; 
    header.style.display = 'block'; 
    paymentView.style.display = 'flex'; 
    
    fixedTimeElement.textContent = format(new Date()); 
};


// ФУНКЦИЯ 4: Переключение назад к сканеру
// ИСПРАВЛЕНИЕ: Проверяем, существует ли кнопка, чтобы избежать ошибок ReferenceError
if (showScannerBtn) {
    showScannerBtn.onclick = () => {
        header.style.display = 'none'; 
        paymentView.style.display = 'none'; 
        scannerView.style.display = 'block'; 
        startScanning(); 
    };
}


// ФУНКЦИЯ 5: Цикл сканирования (работает в фоне)
function startScanLoop() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // ДОБАВЛЕННАЯ ПРОВЕРКА: Проверяем, что библиотека jsQR загружена
        if (typeof jsQR === 'undefined') {
            console.error("ОШИБКА: Библиотека jsQR не загружена. Проверьте подключение в index.html.");
            // Продолжаем пытаться, но не обрабатываем QR-код, чтобы не вызывать ошибку
        } else {
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            
            try {
                const code = jsQR(imageData.data, imageData.width, imageData.height);

                if (code) {
                    // QR-код СЧИТАН!
                    console.log("QR Code detected:", code.data);
                    
                    // Если вы хотите, чтобы код переходил на оплату ТОЛЬКО после сканирования:
                    // captureCircle.onclick(); 
                }
            } catch (e) {
                console.error("Ошибка при обработке QR-кода:", e);
            }
        }
    }
    animationFrameId = requestAnimationFrame(startScanLoop);
}


// --- При загрузке страницы: СРАЗУ ЗАПУСКАЕМ СКАНИРОВАНИЕ ---
window.onload = () => {
    header.style.display = 'none';
    paymentView.style.display = 'none';
    modal.style.display = 'none';
    scannerView.style.display = 'block'; 
    
    startScanning(); 
};