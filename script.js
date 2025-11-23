// --- ЛОГИКА ВРЕМЕНИ И ОПЛАТЫ ---

function pad(n) { return n.toString().padStart(2, "0"); }

function format(d) {
    return pad(d.getDate()) + "." +
           pad(d.getMonth()+1) + "." +
           d.getFullYear() + " " +
           pad(d.getHours()) + ":" +
           pad(d.getMinutes());
}

const enterTime = format(new Date());
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

closeBtn.onclick = () => {
    modal.style.display = "none";
};

modal.onclick = e => {
    if (e.target === modal) modal.style.display = "none";
};


// --- ЛОГИКА СКАНИРОВАНИЯ QR И УПРАВЛЕНИЯ РЕЖИМАМИ ---

const scannerView = document.getElementById('scannerView');
const paymentView = document.getElementById('paymentView');
const header = document.querySelector('.header');
const showScannerBtn = document.getElementById('showScannerBtn'); // Кнопка "Назад к сканеру"
const captureCircle = document.getElementById('captureCircle'); // Центральный круг-кнопка

const video = document.getElementById('webcam');
const canvasElement = document.getElementById('qrCanvas');
const canvas = canvasElement.getContext('2d');

let stream = null;
let animationFrameId = null;

// ФУНКЦИЯ 1: Запуск камеры
function startScanning() {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
        console.error('Ошибка: Ваш браузер не поддерживает камеру.');
        // Вместо scanMessage, можно вывести ошибку в консоль или в скрытый элемент
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
                startScanLoop(); // Запускаем цикл сканирования
            };
        })
        .catch(err => {
            console.error('Ошибка доступа к камере:', err);
            // Можно показать заглушку или сообщение об ошибке, если камера недоступна
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
    stopScanning(); // Останавливаем камеру
    scannerView.style.display = 'none'; 
    header.style.display = 'block'; 
    paymentView.style.display = 'flex'; 
    fixedTimeElement.textContent = format(new Date()); // Обновляем время при переходе
};


// ФУНКЦИЯ 4: Переключение назад к сканеру
showScannerBtn.onclick = () => {
    header.style.display = 'none'; 
    paymentView.style.display = 'none'; 
    scannerView.style.display = 'flex'; 
    startScanning(); 
};


// ФУНКЦИЯ 5: Цикл сканирования (работает в фоне)
function startScanLoop() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
            // QR-код СЧИТАН!
            console.log("QR Code detected:", code.data);
            // Здесь вы можете добавить логику, если хотите использовать данные QR-кода.
            // Например, заполнить поле с номером автобуса:
            // document.querySelector(".vehicle").textContent = "QR: " + code.data;
        }
    }
    animationFrameId = requestAnimationFrame(startScanLoop);
}


// --- При загрузке страницы: СРАЗУ ЗАПУСКАЕМ СКАНИРОВАНИЕ ---
window.onload = () => {
    // Убеждаемся, что все скрыто, кроме сканера
    header.style.display = 'none';
    paymentView.style.display = 'none';
    modal.style.display = 'none';
    scannerView.style.display = 'flex'; // Показываем сканер по умолчанию
    
    startScanning(); 
};