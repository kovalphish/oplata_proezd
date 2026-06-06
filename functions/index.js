const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendChatPushNotification = functions.database
  .ref('chat/{userId}/messages/{msgId}')
  .onCreate(async (snap, context) => {
    const msg = snap.val();
    const { userId, msgId } = context.params;
    if (!msg || !msg.text) return;

    const db = admin.database();

    // Сообщение от админа → шлём пользователю
    if (msg.from === 'admin') {
      const userSnap = await db.ref('users/' + userId).once('value');
      const user = userSnap.val();
      if (!user) return;

      const token = user.fcmToken;
      if (!token) {
        console.log('No FCM token for user', userId);
        return;
      }

      const payload = {
        notification: {
          title: 'Т-Банк: поддержка',
          body: msg.text
        },
        data: {
          clickAction: '/',
          chatUserId: userId
        },
        token: token
      };

      try {
        await admin.messaging().send(payload);
        console.log('Push sent to user', userId);
      } catch (e) {
        console.error('Push send error:', e.message);
      }
      return;
    }

    // Сообщение от обычного пользователя → шлём всем админам
    const adminsSnap = await db.ref('users')
      .orderByChild('role')
      .equalTo('admin')
      .once('value');
    const admins = adminsSnap.val();
    if (!admins) return;

    const tokens = [];
    Object.keys(admins).forEach(id => {
      const a = admins[id];
      if (a.fcmToken) tokens.push(a.fcmToken);
    });

    if (tokens.length === 0) return;

    const username = msg.from || 'Пользователь';
    const payload = {
      notification: {
        title: username + ' написал(а)',
        body: msg.text
      },
      data: {
        clickAction: '/'
      }
    };

    try {
      const result = await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        ...payload
      });
      console.log('Push sent to', result.successCount, 'admins');
    } catch (e) {
      console.error('Push multicast error:', e.message);
    }
  });
