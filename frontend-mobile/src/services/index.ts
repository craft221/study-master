/**
 * Study Master - Services Index
 * Export centralisé de tous les services
 */

export { default as api } from './api';
export { notificationService } from './notifications';
export { offlineService } from './offline';

// Re-export types
export type { NotificationSettings } from './notifications';
