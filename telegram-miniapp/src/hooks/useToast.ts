import { useState, useCallback } from 'react'
import { twa } from '../lib/telegram'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9)
    
    const toast: Toast = {
      id,
      message,
      type,
      duration
    }

    setToasts(prev => [...prev, toast])

    // Use Telegram's native notifications when possible
    if (type === 'error') {
      twa.notificationOccurred('error')
      twa.showAlert(message)
    } else if (type === 'success') {
      twa.notificationOccurred('success')
    } else if (type === 'warning') {
      twa.notificationOccurred('warning')
    }

    // Auto remove toast after duration
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    return addToast(message, type)
  }, [addToast])

  // Convenience methods
  const toastWithMethods = Object.assign(toast, {
    success: useCallback((message: string) => addToast(message, 'success'), [addToast]),
    error: useCallback((message: string) => addToast(message, 'error'), [addToast]),
    warning: useCallback((message: string) => addToast(message, 'warning'), [addToast]),
    info: useCallback((message: string) => addToast(message, 'info'), [addToast])
  })

  return {
    toast: toastWithMethods,
    toasts,
    addToast,
    removeToast
  }
}