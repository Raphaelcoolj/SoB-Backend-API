import webpush from '../config/webpush.js';
import User from '../models/User.js';

/**
 * Sends a push notification to a user.
 * @param {string} userId - The ID of the user to send the notification to.
 * @param {Object} pushSubscription - The user's push subscription object { endpoint, keys: { p256dh, auth } }
 * @param {Object} payload - The notification payload { title, body, url }
 */
const sendPushNotification = async (userId, pushSubscription, payload) => {
  if (!pushSubscription || !pushSubscription.endpoint) {
    return;
  }

  try {
    const payloadString = JSON.stringify(payload);
    await webpush.sendNotification(pushSubscription, payloadString);
    console.log(`Push notification sent to ${pushSubscription.endpoint}`);
  } catch (error) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.warn(`Push subscription for user ${userId} has expired or is no longer valid. Removing...`);
      try {
        await User.findByIdAndUpdate(userId, { 
          $set: { 
            pushSubscription: { endpoint: null, keys: { p256dh: null, auth: null } } 
          } 
        });
      } catch (dbError) {
        console.error('Error removing invalid push subscription from database:', dbError.message);
      }
    } else {
      console.error('Error sending push notification:', error.message);
    }
  }
};

export default sendPushNotification;
