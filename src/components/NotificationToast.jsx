import { useEffect } from 'react'
import { useNotificationStore } from '../store/notificationStore'

export default function NotificationToast() {
  const notifications = useNotificationStore((state) => state.notifications)
  const removeNotification = useNotificationStore((state) => state.removeNotification)

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  )
}

function NotificationItem({ notification, onClose }) {
  useEffect(() => {
    if (notification.duration > 0) {
      const timer = setTimeout(onClose, notification.duration)
      return () => clearTimeout(timer)
    }
  }, [notification.duration, onClose])

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'info':
      default:
        return 'ℹ️'
    }
  }

  const getTypeClass = () => {
    return `notification-${notification.type}`
  }

  return (
    <div className={`notification-toast ${getTypeClass()}`}>
      <div className="notification-icon">{getIcon()}</div>
      <div className="notification-content">
        {notification.title && <div className="notification-title">{notification.title}</div>}
        {notification.message && <div className="notification-message">{notification.message}</div>}
      </div>
      <button type="button" onClick={onClose} className="notification-close" aria-label="Close">
        ×
      </button>
    </div>
  )
}

