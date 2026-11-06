const webpush = require('web-push');
const { masterPool } = require('../config/database');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

exports.getVapidPublicKey = (_req, res) => {
    res.status(200).json({ success: true, publicKey: process.env.VAPID_PUBLIC_KEY });
};

exports.subscribe = async (req, res) => {
    const subscription = req.body;
    const userId = (req.user || req.student)?.id;
    if (!subscription?.endpoint || !subscription?.keys || !userId) {
        return res.status(400).json({ success: false, message: 'A valid subscription and signed-in user are required' });
    }

    try {
        const [rows] = await masterPool.query(
            'SELECT push_subscriptions FROM users WHERE id = ? AND is_active = 1',
            [userId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
        const rawSubscriptions = rows[0].push_subscriptions;
        const subscriptions = typeof rawSubscriptions === 'string'
            ? JSON.parse(rawSubscriptions)
            : rawSubscriptions || [];
        const nextSubscriptions = subscriptions.filter((item) => item.endpoint !== subscription.endpoint);
        nextSubscriptions.push({
            endpoint: subscription.endpoint,
            keys: {
                auth: subscription.keys.auth || '',
                p256dh: subscription.keys.p256dh || ''
            }
        });
        await masterPool.query(
            'UPDATE users SET push_subscriptions = ?, updated_at = NOW() WHERE id = ?',
            [JSON.stringify(nextSubscriptions), userId]
        );
        res.status(201).json({ success: true, message: 'Subscription added successfully' });
    } catch (error) {
        console.error('Error saving subscription:', error);
        res.status(500).json({ success: false, message: 'Failed to save subscription' });
    }
};

exports.sendNotificationToStudent = async (studentId, payload) => {
    try {
        const [rows] = await masterPool.query(
            'SELECT push_subscriptions FROM users WHERE id = ?',
            [studentId]
        );
        if (!rows.length) return { success: false, message: 'User not found' };
        const subscriptions = typeof rows[0].push_subscriptions === 'string'
            ? JSON.parse(rows[0].push_subscriptions)
            : rows[0].push_subscriptions || [];
        if (!subscriptions.length) return { success: false, message: 'No subscriptions found' };
        await Promise.all(subscriptions.map((subscription) =>
            webpush.sendNotification(subscription, JSON.stringify(payload))
                .catch((error) => console.error('Push notification failed:', error))
        ));
        return { success: true };
    } catch (error) {
        console.error('Error sending notification:', error);
        return { success: false, error };
    }
};
