import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from './notificationStore';

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], toasts: [] });
  });

  it('adds a notification', () => {
    useNotificationStore.getState().addNotification('Test message', 'info');
    const notifications = useNotificationStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toBe('Test message');
    expect(notifications[0].type).toBe('info');
  });

  it('removes a notification', () => {
    const { addNotification, removeNotification } = useNotificationStore.getState();
    addNotification('Test', 'success');
    const id = useNotificationStore.getState().notifications[0].id;
    removeNotification(id);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('clears all notifications', () => {
    const { addNotification, clearNotifications } = useNotificationStore.getState();
    addNotification('A', 'info');
    addNotification('B', 'error');
    clearNotifications();
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });
});
