import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Debug logging for white screen issues
console.log('🚀 Mini App starting...')
console.log('📱 User Agent:', navigator.userAgent)
console.log('🌐 Location:', window.location.href)
console.log('📺 Screen:', screen.width + 'x' + screen.height)

// Check if we're in Telegram
if (window.Telegram?.WebApp) {
  console.log('✅ Telegram WebApp detected')
  console.log('📋 WebApp data:', window.Telegram.WebApp)
} else {
  console.warn('⚠️ Telegram WebApp not detected')
}

try {
  const root = createRoot(document.getElementById('root')!)
  console.log('✅ Root element found, rendering App...')
  
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  
  console.log('✅ App rendered successfully')
} catch (error) {
  console.error('❌ Error rendering app:', error)
  
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  const errorStack = error instanceof Error ? error.stack : 'No stack trace'
  
  // Fallback display for errors
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: Arial; text-align: center;">
      <h1>⚠️ Error Loading App</h1>
      <p>Error: ${errorMessage}</p>
      <p>Please contact support</p>
      <pre style="text-align: left; background: #f0f0f0; padding: 10px; margin: 10px 0;">${errorStack}</pre>
    </div>
  `
}
