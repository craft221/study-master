/**
 * Study Master - Notification Service
 * Service de gestion des notifications push et in-app
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import type { Notification, NotificationType, NotificationPriority } from '@/types';

// ============================================
// CONSTANTS
// ============================================

const PUSH_TOKEN_KEY = '@study_master_push_token';
const NOTIFICATION_SETTINGS_KEY = '@study_master_notification_settings';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ============================================
// NOTIFICATION SETTINGS
// ============================================

export interface NotificationSettings {
  pushEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  streakReminders: boolean;
  studyReminders: boolean;
  duelNotifications: boolean;
  achievementNotifications: boolean;
  socialNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: number; // 0-23
  quietHoursEnd: number; // 0-23
}

const DEFAULT_SETTINGS: NotificationSettings = {
  pushEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  streakReminders: true,
  studyReminders: true,
  duelNotifications: true,
  achievementNotifications: true,
  socialNotifications: true,
  quietHoursEnabled: false,
  quietHoursStart: 22,
  quietHoursEnd: 7,
};

// ============================================
// NOTIFICATION CHANNELS (Android)
// ============================================

const NOTIFICATION_CHANNELS = {
  default: {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  },
  streak: {
    name: 'Streak Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 500, 200, 500],
    sound: 'streak.wav',
  },
  duel: {
    name: 'Duels',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 100, 300, 100, 300],
    sound: 'duel.wav',
  },
  achievement: {
    name: 'Achievements',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 400, 200, 400],
    sound: 'achievement.wav',
  },
  study: {
    name: 'Study Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    sound: 'study.wav',
  },
  social: {
    name: 'Social',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
    sound: 'social.wav',
  },
};

// ============================================
// SERVICE CLASS
// ============================================

class NotificationService {
  private settings: NotificationSettings = DEFAULT_SETTINGS;
  private pushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  // Initialize the notification service
  async initialize(): Promise<boolean> {
    try {
      // Load settings
      await this.loadSettings();

      // Setup Android channels
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('Notification permissions not granted');
        return false;
      }

      // Get push token
      await this.registerForPushNotifications();

      // Setup listeners
      this.setupListeners();

      return true;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  }

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  // Setup Android notification channels
  private async setupAndroidChannels(): Promise<void> {
    for (const [channelId, config] of Object.entries(NOTIFICATION_CHANNELS)) {
      await Notifications.setNotificationChannelAsync(channelId, {
        name: config.name,
        importance: config.importance,
        vibrationPattern: config.vibrationPattern,
        sound: config.sound,
      });
    }
  }

  // Register for push notifications
  async registerForPushNotifications(): Promise<string | null> {
    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PROJECT_ID,
      });

      this.pushToken = token.data;

      // Save token locally
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token.data);

      // Send token to backend
      await this.sendTokenToBackend(token.data);

      return token.data;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  // Send token to backend
  private async sendTokenToBackend(token: string): Promise<void> {
    try {
      await api.post('/notifications/register-device', {
        push_token: token,
        platform: Platform.OS,
        device_name: Device.deviceName,
      });
    } catch (error) {
      console.error('Failed to register push token with backend:', error);
    }
  }

  // Setup notification listeners
  private setupListeners(): void {
    // Handle notification received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        this.handleReceivedNotification(notification);
      }
    );

    // Handle notification response (user tapped notification)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        this.handleNotificationResponse(response);
      }
    );
  }

  // Handle received notification
  private handleReceivedNotification(
    notification: Notifications.Notification
  ): void {
    const data = notification.request.content.data;
    console.log('Notification received:', data);

    // Check quiet hours
    if (this.isQuietHours()) {
      return;
    }

    // Handle based on type
    const type = data?.type as NotificationType;
    if (type && !this.shouldShowNotification(type)) {
      return;
    }
  }

  // Handle notification tap response
  private handleNotificationResponse(
    response: Notifications.NotificationResponse
  ): void {
    const data = response.notification.request.content.data;
    const actionUrl = data?.action_url as string;

    if (actionUrl) {
      // Navigate to the specified URL
      // This would typically use the router to navigate
      console.log('Navigate to:', actionUrl);
    }
  }

  // Check if notification should be shown based on settings
  private shouldShowNotification(type: NotificationType): boolean {
    if (!this.settings.pushEnabled) return false;

    switch (type) {
      case 'streak_reminder':
      case 'streak_lost':
      case 'streak_milestone':
        return this.settings.streakReminders;

      case 'flashcard_review':
      case 'quiz_reminder':
      case 'event_reminder':
      case 'exam_reminder':
        return this.settings.studyReminders;

      case 'duel_challenge':
      case 'duel_accepted':
      case 'duel_declined':
      case 'duel_completed':
      case 'duel_won':
      case 'duel_lost':
        return this.settings.duelNotifications;

      case 'achievement_unlocked':
      case 'level_up':
      case 'xp_gained':
        return this.settings.achievementNotifications;

      case 'group_invite':
      case 'group_message':
        return this.settings.socialNotifications;

      default:
        return true;
    }
  }

  // Check if currently in quiet hours
  private isQuietHours(): boolean {
    if (!this.settings.quietHoursEnabled) return false;

    const now = new Date();
    const currentHour = now.getHours();

    const { quietHoursStart, quietHoursEnd } = this.settings;

    // Handle overnight quiet hours (e.g., 22:00 - 07:00)
    if (quietHoursStart > quietHoursEnd) {
      return currentHour >= quietHoursStart || currentHour < quietHoursEnd;
    }

    return currentHour >= quietHoursStart && currentHour < quietHoursEnd;
  }

  // Schedule a local notification
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>,
    options?: {
      trigger?: Notifications.NotificationTriggerInput;
      channelId?: string;
      priority?: NotificationPriority;
    }
  ): Promise<string | null> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: this.settings.soundEnabled ? 'default' : undefined,
          ...(Platform.OS === 'android' && {
            channelId: options?.channelId || 'default',
          }),
        },
        trigger: options?.trigger || null,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return null;
    }
  }

  // Schedule streak reminder
  async scheduleStreakReminder(hour: number = 20, minute: number = 0): Promise<void> {
    // Cancel existing streak reminders
    await this.cancelNotificationsByTag('streak_reminder');

    if (!this.settings.streakReminders) return;

    await this.scheduleLocalNotification(
      'Ne perdez pas votre streak ! 🔥',
      'Vous n\'avez pas encore étudié aujourd\'hui. Gardez votre série active !',
      { type: 'streak_reminder', tag: 'streak_reminder' },
      {
        trigger: {
          hour,
          minute,
          repeats: true,
        },
        channelId: 'streak',
      }
    );
  }

  // Schedule study reminder
  async scheduleStudyReminder(
    hour: number,
    minute: number,
    weekdays: number[] = [1, 2, 3, 4, 5] // Mon-Fri
  ): Promise<void> {
    await this.cancelNotificationsByTag('study_reminder');

    if (!this.settings.studyReminders) return;

    for (const weekday of weekdays) {
      await this.scheduleLocalNotification(
        'C\'est l\'heure d\'étudier ! 📚',
        'Spark vous attend pour une session de révision.',
        { type: 'study_reminder', tag: 'study_reminder' },
        {
          trigger: {
            weekday,
            hour,
            minute,
            repeats: true,
          },
          channelId: 'study',
        }
      );
    }
  }

  // Schedule flashcard review reminder
  async scheduleFlashcardReminder(
    dueCount: number,
    delay: number = 3600000 // 1 hour default
  ): Promise<void> {
    if (!this.settings.studyReminders || dueCount === 0) return;

    await this.scheduleLocalNotification(
      `${dueCount} flashcards à réviser ! 🎴`,
      'Maintenez votre progression avec une session de révision.',
      { type: 'flashcard_review' },
      {
        trigger: {
          seconds: delay / 1000,
        },
        channelId: 'study',
      }
    );
  }

  // Show immediate notification
  async showImmediateNotification(
    title: string,
    body: string,
    type: NotificationType,
    data?: Record<string, unknown>
  ): Promise<void> {
    if (!this.shouldShowNotification(type)) return;

    const channelId = this.getChannelForType(type);

    await this.scheduleLocalNotification(
      title,
      body,
      { ...data, type },
      { channelId }
    );
  }

  // Get notification channel for type
  private getChannelForType(type: NotificationType): string {
    if (type.includes('streak')) return 'streak';
    if (type.includes('duel')) return 'duel';
    if (type.includes('achievement') || type.includes('level') || type.includes('xp')) {
      return 'achievement';
    }
    if (type.includes('group') || type.includes('social')) return 'social';
    if (type.includes('study') || type.includes('review') || type.includes('quiz') || type.includes('flashcard')) {
      return 'study';
    }
    return 'default';
  }

  // Cancel notification by ID
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  // Cancel notifications by tag
  async cancelNotificationsByTag(tag: string): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.content.data?.tag === tag) {
        await this.cancelNotification(notification.identifier);
      }
    }
  }

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // Get pending notifications
  async getPendingNotifications(): Promise<Notifications.NotificationRequest[]> {
    return Notifications.getAllScheduledNotificationsAsync();
  }

  // Update badge count
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  // Get badge count
  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  }

  // Load settings from storage
  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }

  // Save settings to storage
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        NOTIFICATION_SETTINGS_KEY,
        JSON.stringify(this.settings)
      );
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }

  // Get current settings
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  // Update settings
  async updateSettings(updates: Partial<NotificationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();

    // Update scheduled notifications based on new settings
    if ('streakReminders' in updates && !updates.streakReminders) {
      await this.cancelNotificationsByTag('streak_reminder');
    }
    if ('studyReminders' in updates && !updates.studyReminders) {
      await this.cancelNotificationsByTag('study_reminder');
    }
  }

  // Get push token
  getPushToken(): string | null {
    return this.pushToken;
  }

  // Cleanup listeners
  cleanup(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const notificationService = new NotificationService();
export default notificationService;
