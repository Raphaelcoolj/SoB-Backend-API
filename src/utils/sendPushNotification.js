import webpush from '../config/webpush.js';
import { Expo } from 'expo-server-sdk';
import User from '../models/User.js';

const expo = new Expo();

/**
 * Sends a push notification (Web Push or Expo).
 * @param {string} userId - The ID of the user.
 * @param {Object} pushSubscription - The subscription object.
 * @param {Object} payload - { title, body, url }
 */
const sendPushNotification = async (userId, pushSubscription, payload) => {
  if (!pushSubscription) return;

  if (pushSubscription.tokenType === 'expo') {
    return await sendExpoNotification(userId, pushSubscription, payload);
  }
  return await sendWebNotification(userId, pushSubscription, payload);
};

const sendWebNotification = async (userId, sub, payload) => {
  if (!sub.endpoint) return;
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (error) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      await clearPushSubscription(userId);
    }
  }
};

const sendExpoNotification = async (userId, sub, payload) => {
  if (!sub.token || !Expo.isExpoPushToken(sub.token)) return;

  const messages = [{
    to: sub.token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: { url: payload.url },
  }];

  try {
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (error) {
    console.error('Expo push error:', error);
  }
};

const clearPushSubscription = async (userId) => {
  await User.findByIdAndUpdate(userId, { 
    $set: { pushSubscription: { tokenType: 'web', endpoint: null, token: null } } 
  });
};

export default sendPushNotification;
