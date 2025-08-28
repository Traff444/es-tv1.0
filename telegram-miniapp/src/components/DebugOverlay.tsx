import { useState, useEffect } from 'react'

interface DebugLog {
  id: string
  timestamp: string
  message: string
  type: 'log' | 'error' | 'warn'
}

export function DebugOverlay() {
  const [isVisible, setIsVisible] = useState(false)
  const [logs, setLogs] = useState<DebugLog[]>([])

  useEffect(() => {
    // Intercept console.log, console.error, console.warn
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn

    console.log = (...args) => {
      originalLog(...args)
      // Use setTimeout to avoid updating component during render
      setTimeout(() => addLog(args.join(' '), 'log'), 0)
    }

    console.error = (...args) => {
      originalError(...args)
      // Use setTimeout to avoid updating component during render
      setTimeout(() => addLog(args.join(' '), 'error'), 0)
    }

    console.warn = (...args) => {
      originalWarn(...args)
      // Use setTimeout to avoid updating component during render
      setTimeout(() => addLog(args.join(' '), 'warn'), 0)
    }

    // Show debug overlay in ngrok environment
    if (window.location.hostname.includes('ngrok') || window.location.search.includes('debug=true')) {
      setIsVisible(true)
    }

    return () => {
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
    }
  }, [])

  const addLog = (message: string, type: 'log' | 'error' | 'warn') => {
    const timestamp = new Date().toISOString().slice(11, 23)
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const newLog: DebugLog = {
      id: uniqueId,
      timestamp,
      message,
      type
    }
    
    setLogs(prevLogs => [...prevLogs.slice(-50), newLog]) // Keep only last 50 logs
  }

  const clearLogs = () => {
    setLogs([])
  }

  if (!isVisible) {
    return (
      <div 
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          width: '50px',
          height: '50px',
          backgroundColor: '#007aff',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '20px',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        }}
        onClick={() => setIsVisible(true)}
      >
        🐛
      </div>
    )
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.9)',
        color: 'white',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}
    >
      {/* Header */}
      <div 
        style={{
          padding: '10px',
          backgroundColor: '#333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>🐛 Debug Console ({logs.length} logs)</span>
        <div>
          <button 
            style={{
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '3px',
              marginRight: '5px',
              cursor: 'pointer'
            }}
            onClick={clearLogs}
          >
            Clear
          </button>
          <button 
            style={{
              backgroundColor: '#ff4444',
              color: 'white',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
            onClick={() => setIsVisible(false)}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Logs */}
      <div 
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '10px'
        }}
      >
        {logs.map(log => (
          <div 
            key={log.id}
            style={{
              marginBottom: '5px',
              padding: '5px',
              borderRadius: '3px',
              backgroundColor: log.type === 'error' ? '#660000' : 
                             log.type === 'warn' ? '#664400' : '#004400',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            <span style={{ opacity: 0.7 }}>[{log.timestamp}] </span>
            {log.message}
          </div>
        ))}
        {logs.length === 0 && (
          <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '50px' }}>
            No logs yet...
          </div>
        )}
      </div>

      {/* Environment Info */}
      <div 
        style={{
          padding: '10px',
          backgroundColor: '#222',
          borderTop: '1px solid #555'
        }}
      >
        <div><strong>URL:</strong> {window.location.href}</div>
        <div><strong>Hostname:</strong> {window.location.hostname}</div>
        <div><strong>User Agent:</strong> {navigator.userAgent.slice(0, 60)}...</div>
        <div><strong>Telegram:</strong> {window.Telegram ? '✅ Available' : '❌ Not Available'}</div>
        <div><strong>WebApp:</strong> {window.Telegram?.WebApp ? '✅ Available' : '❌ Not Available'}</div>
        {window.Telegram?.WebApp && (
          <>
            <div><strong>initData:</strong> {window.Telegram.WebApp.initData ? '✅ Has Data' : '❌ Empty'}</div>
            <div><strong>User:</strong> {window.Telegram.WebApp.initDataUnsafe?.user ? 
              `ID: ${window.Telegram.WebApp.initDataUnsafe.user.id}` : '❌ No User'}</div>
          </>
        )}
      </div>
    </div>
  )
}
