function pad(n) { return n.toString().padStart(2, "0"); }

function format(d) {
    return pad(d.getDate()) + "." +
           pad(d.getMonth()+1) + "." +
           d.getFullYear() + " " +
           pad(d.getHours()) + ":" +
           pad(d.getMinutes());
}

// 1. Устанавливаем время на главной странице
const enterTime = format(new Date());
const fixedTimeElement = document.getElementById("fixedTime");
fixedTimeElement.textContent = enterTime;

// 2. Получаем элементы
const modal = document.getElementById("modal");
const payBtn = document.getElementById("payBtn");
const closeBtn = document.getElementById("closeBtn");

// Элементы внутри чека
const receiptDate = document.getElementById("receiptDate");
const receiptSumBig = document.getElementById("receiptSumBig");
const receiptSumSmall = document.getElementById("receiptSumSmall");
const mainPrice = document.querySelector(".price"); // Цена на главной

// 3. Логика кнопки "Оплатить"
payBtn.onclick = () => {
    // Копируем цену с главной в чек
    // (на случай если вы её отредактировали руками)
    const currentPrice = mainPrice.innerText;
    receiptSumBig.innerText = currentPrice;
    receiptSumSmall.innerText = currentPrice;

    // Копируем время с главной и добавляем секунды для чека
    const seconds = pad(new Date().getSeconds());
    receiptDate.textContent = fixedTimeElement.textContent + ":" + seconds;

    // Показываем окно
    modal.style.display = "flex";
};

// Закрытие окна
closeBtn.onclick = () => {
    modal.style.display = "none";
};

modal.onclick = e => {
    if (e.target === modal) modal.style.display = "none";
};