importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAhsdhKdvsoneIykp9taxhUWKWBTMlCvT4",
    authDomain: "tibank-7756b.firebaseapp.com",
    databaseURL: "https://tibank-7756b-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "tibank-7756b",
    storageBucket: "tibank-7756b.firebasestorage.app",
    messagingSenderId: "916227472657",
    appId: "1:916227472657:web:b27aa449c3ad6a5c3c60b0"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
    const data = payload.data || {};
    const title = data.title || 'Т-Банк';
    const body = data.body || 'Новое сообщение';
    self.registration.showNotification(title, {
        body: body,
        icon: 'assets/ico/tbank.png',
        badge: 'assets/ico/tbank.png',
        data: { clickAction: data.clickAction || '/' }
    });
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.openWindow('/'));
});
