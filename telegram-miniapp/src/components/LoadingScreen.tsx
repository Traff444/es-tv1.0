import { useState, useEffect } from 'react'

export function LoadingScreen() {
  console.log('⏳ LoadingScreen rendered')
  
  const [message, setMessage] = useState('Подключение к ЭлектроСервис...')
  
  useEffect(() => {
    const messages = [
      'Подключение к ЭлектроСервис...',
      'Аутентификация через Telegram...',
      'Получение данных пользователя...',
      'Проверка прав доступа...',
      'Загрузка рабочих задач...'
    ]
    
    let index = 0
    const interval = setInterval(() => {
      index = (index + 1) % messages.length
      setMessage(messages[index])
    }, 2000)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-tg-bg p-4">
      <div className="text-center max-w-sm">
        {/* ElectroService Logo */}
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto flex items-center justify-center mb-4">
            <span className="text-white text-2xl font-bold">⚡</span>
          </div>
          <h1 className="text-tg-text text-lg font-semibold">ЭлектроСервис</h1>
          <p className="text-tg-hint text-sm">Рабочее приложение</p>
        </div>
        
        {/* Loading Animation */}
        <div className="relative mb-6">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-tg-hint/20 border-t-blue-500 mx-auto"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
          </div>
        </div>
        
        {/* Dynamic Message */}
        <div className="space-y-2">
          <p className="text-tg-text text-sm font-medium">{message}</p>
          <div className="flex justify-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
        </div>
      </div>
    </div>
  )
}