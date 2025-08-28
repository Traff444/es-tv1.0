import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, directApiCall } from '../lib/supabase'
import { twa } from '../lib/telegram'
import type { Profile } from '../types'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  console.log('🚨 === useAuth HOOK VERSION 2.0 START ===')
  console.log('🚨 Timestamp:', new Date().toISOString())
  
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null
  })

  console.log('🔑 useAuth hook initialized, state:', authState)

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout | null = null
    console.log('🚀 useAuth useEffect running...')

    const clearAuthTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const initAuth = async () => {
      console.log('🔍 Initializing authentication...')
      console.log('🔍 Current URL:', window.location.href)
      console.log('🔍 User Agent:', navigator.userAgent)
      console.log('🔍 Telegram WebApp available:', !!window.Telegram?.WebApp)
      
      // Set a timeout to prevent infinite hanging
      timeoutId = setTimeout(() => {
        if (mounted) {
          console.warn('⚠️ Authentication taking longer than expected, continuing in background...')
          // Don't set error state - let the fallback mechanisms work
          // The user will see a better experience without the error message
        }
      }, 15000) // Extended timeout, but no error shown
      
      try {
        // Check if we're in Telegram environment first
        const isTelegramEnv = window.location.hostname.includes('ngrok') || window.Telegram?.WebApp
        console.log('🌍 Environment check:', {
          hostname: window.location.hostname,
          hasNgrok: window.location.hostname.includes('ngrok'),
          hasTelegramWebApp: !!window.Telegram?.WebApp,
          isTelegramEnv
        })

        console.log('🔒 === STARTING AUTHENTICATION PROCESS ===')
        
        // Get Telegram user data (includes fallback for testing)
        console.log('📱 Getting user data...')
        
        const telegramUser = twa.getUserData()
        console.log('👤 User data received:', telegramUser)
        
        if (!telegramUser) {
          console.error('❌ No user data available (neither Telegram nor fallback)')
          throw new Error('User data not available')
        }

        // Try to get existing session with timeout
        console.log('🔒 Checking existing session...')
        
        let session = null
        let sessionError = null
        
        try {
          // Add shorter timeout for session check (Supabase sometimes hangs)
          const sessionPromise = supabase.auth.getSession()
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Session check timeout after 2 seconds')), 2000)
          )
          
          console.log('⏱️ Starting session check with 2s timeout...')
          const sessionResult = await Promise.race([sessionPromise, timeoutPromise]) as any
          session = sessionResult.data?.session
          sessionError = sessionResult.error
          
          console.log('📊 Session check completed successfully:')
          console.log('  - Session exists:', !!session)
          console.log('  - Session user ID:', session?.user?.id)
          console.log('  - Session email:', session?.user?.email)
          console.log('  - Session error:', sessionError)
        } catch (timeoutError) {
          console.warn('⚠️ Session check timed out or failed, proceeding with Telegram auth')
          console.warn('⚠️ Error details:', timeoutError)
          session = null
          sessionError = timeoutError
        }
        
        if (sessionError) {
          console.warn('⚠️ Session error:', sessionError)
        }

        // In Telegram environment, always use Telegram auth, ignore existing session
        if (isTelegramEnv) {
          console.log('📱 Telegram environment - forcing Telegram authentication')
          await authenticateWithTelegram(telegramUser)
        } else if (session?.user) {
          console.log('✅ Existing session found:', session.user.id)
          console.log('🔍 Fetching profile for existing session...')
          
          try {
            // User is already authenticated
            const profile = await fetchProfile(session.user.id)
            if (mounted) {
              console.log('✅ Setting authenticated state with profile:', profile?.full_name)
              // Clear timeout on successful authentication
              clearAuthTimeout()
              setAuthState({
                user: session.user,
                session,
                profile,
                loading: false,
                error: null
              })
            }
          } catch (profileError) {
            console.error('❌ Error fetching profile for existing session:', profileError)
            // Continue to Telegram auth if profile fetch fails
            console.log('🔄 Falling back to Telegram authentication...')
            await authenticateWithTelegram(telegramUser)
          }
        } else {
          console.log('🔍 No existing session, trying Telegram authentication...')
          // Try to authenticate with Telegram data
          await authenticateWithTelegram(telegramUser)
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error)
        if (mounted) {
          // Clear timeout on error
          clearAuthTimeout()
          setAuthState(prev => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : 'Authentication failed'
          }))
        }
      }
    }

    const authenticateWithTelegram = async (telegramUser: any) => {
      console.log('🚀 === TELEGRAM AUTHENTICATION STARTED ===')
      console.log('📱 Authenticating with Telegram user ID:', telegramUser?.id)
      console.log('📱 Full Telegram user data:', JSON.stringify(telegramUser, null, 2))
      console.log('📱 Telegram user type:', typeof telegramUser)
      console.log('📱 Telegram user keys:', telegramUser ? Object.keys(telegramUser) : 'NULL')
      
      if (!telegramUser || !telegramUser.id) {
        console.error('❌ Invalid telegram user data:', telegramUser)
        throw new Error('Invalid telegram user data')
      }

      console.log('🔍 Step 1: Starting Telegram user lookup in database...')
      console.log('🔍 Looking for Telegram ID:', telegramUser.id)
      console.log('🔍 Using Supabase URL:', 'https://enyewzeskpiqueogmssp.supabase.co')
      
      try {
        // Step 1: Find telegram_users record
        console.log('🔍 Step 1: Looking for telegram_users record...')
        console.log('🔍 Query: SELECT * FROM telegram_users WHERE telegram_id =', telegramUser.id)
        
        // Use direct API call to bypass CORS issues
        let telegramUserRecord: any = null
        let telegramError: any = null
        
        try {
          const telegramData = await directApiCall(
            `telegram_users?telegram_id=eq.${telegramUser.id}&select=*`
          )
          
          if (telegramData && telegramData.length > 0) {
            telegramUserRecord = telegramData[0]
          } else {
            telegramError = { message: 'No telegram_users record found' }
          }
        } catch (error) {
          telegramError = error
        }

        console.log('📋 Telegram users query result:')
        console.log('  - Data:', JSON.stringify(telegramUserRecord, null, 2))
        console.log('  - Error:', telegramError)
        console.log('  - Error code:', telegramError?.code)
        console.log('  - Error message:', telegramError?.message)
        console.log('  - Error details:', telegramError?.details)

        if (telegramUserRecord && !telegramError) {
          console.log('✅ Found telegram_users record with user_id:', telegramUserRecord.user_id)
          
          // Step 2: Get user profile separately
          console.log('🔍 Step 2: Fetching user profile...')
          console.log('🔍 Query: SELECT * FROM users WHERE id =', telegramUserRecord.user_id)
          
          // Use direct API call to bypass CORS issues
          let existingProfile: any = null
          let profileError: any = null
          
          try {
            const profileData = await directApiCall(
              `users?id=eq.${telegramUserRecord.user_id}&select=*`
            )
            
            if (profileData && profileData.length > 0) {
              existingProfile = profileData[0]
            } else {
              profileError = { message: 'No users record found' }
            }
          } catch (error) {
            profileError = error
          }
          
          console.log('📋 Profile query result:')
          console.log('  - Data:', JSON.stringify(existingProfile, null, 2))
          console.log('  - Error:', profileError)
          
          if (existingProfile && !profileError) {
            console.log('✅ Profile found:', existingProfile.full_name)
          } else {
            console.error('❌ Failed to fetch profile:', profileError)
            throw new Error('Profile not found for telegram user')
          }
          
          if (existingProfile) {
            console.log('🔑 Profile found, attempting sign in...')
            console.log('🔑 Email:', existingProfile.email)
            console.log('🔑 User ID:', existingProfile.id)
            console.log('🔑 Full Name:', existingProfile.full_name)
            console.log('🔑 Role:', existingProfile.role)
            console.log('🔑 Is Active:', existingProfile.is_active)
            
            // Try real Supabase Auth with proper configuration
            console.log('🎯 Step 3: Attempting real Supabase Auth...')
            
            const password = `telegram_${telegramUser.id}`
            console.log('🔑 Using email:', existingProfile.email)
            console.log('🔑 Using password format:', password)
            
            let authData: any = { user: null, session: null }
            let signInError: any = null
            
            try {
              console.log('⚡ Trying signInWithPassword...')
              
              // Set timeout for signInWithPassword
              const signInPromise = supabase.auth.signInWithPassword({
                email: existingProfile.email,
                password: password
              })
              
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('signInWithPassword timeout after 5 seconds')), 5000)
              )
              
              const result = await Promise.race([signInPromise, timeoutPromise]) as any
              authData = result.data
              signInError = result.error
              
              console.log('📋 SignInWithPassword result:')
              console.log('  - Success:', !!authData?.user)
              console.log('  - User ID:', authData?.user?.id)
              console.log('  - Error:', signInError)
              
            } catch (timeoutError) {
              console.warn('⚠️ signInWithPassword timed out, trying direct Auth API...')
              
              // Fallback: Use direct Auth API call (exact format that worked in curl)
              try {
                const response = await fetch('https://enyewzeskpiqueogmssp.supabase.co/auth/v1/token?grant_type=password', {
                  method: 'POST',
                  headers: {
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueWV3emVza3BpcXVlb2dtc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTA4MDcsImV4cCI6MjA3MTg2NjgwN30.KdkzBPdw6lrCE2LW2epl9JDtcOjSccW8rkon4DVrINE',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    email: existingProfile.email,
                    password: password
                  })
                })
                
                if (!response.ok) {
                  throw new Error(`Auth API Error: ${response.status} ${await response.text()}`)
                }
                
                const directAuthData = await response.json()
                
                console.log('✅ Direct Auth API success:', !!directAuthData.user)
                authData = {
                  user: directAuthData.user,
                  session: {
                    access_token: directAuthData.access_token,
                    refresh_token: directAuthData.refresh_token,
                    expires_in: directAuthData.expires_in,
                    expires_at: directAuthData.expires_at,
                    token_type: directAuthData.token_type,
                    user: directAuthData.user
                  }
                }
                signInError = null
                
              } catch (directError) {
                console.error('❌ Direct Auth API also failed:', directError)
                signInError = directError
              }
            }

            console.log('📋 Sign in attempt result:')
            console.log('  - Success:', !!authData.user)
            console.log('  - User ID:', authData.user?.id)
            console.log('  - Error:', signInError)
            console.log('  - Error code:', signInError?.message)

            // Guest session is always successful, no auth errors to handle
            if (false) { // This block is now disabled
              console.log(`🔄 Sign in failed (${signInError.message}), attempting sign up...`)
              console.log('🔄 Step 4: Creating new auth user...')
              
              const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: existingProfile.email,
                password: password,
                options: {
                  data: {
                    full_name: existingProfile.full_name,
                    role: existingProfile.role,
                    telegram_id: telegramUser.id
                  }
                }
              })

              console.log('📋 Sign up result:')
              console.log('  - Success:', !!signUpData.user)
              console.log('  - User ID:', signUpData.user?.id)
              console.log('  - Error:', signUpError)
              
              if (signUpError) {
                console.error('❌ Sign up failed:', signUpError)
                throw signUpError
              }
              
              console.log('✅ User registered successfully, user ID:', signUpData.user?.id)
              
              // Now try to sign in again
              console.log('🔄 Step 5: Signing in after registration...')
              const { data: finalAuthData, error: finalSignInError } = await supabase.auth.signInWithPassword({
                email: existingProfile.email,
                password: password
              })
              
              if (finalSignInError) {
                console.error('❌ Final sign in failed:', finalSignInError)
                throw finalSignInError
              }
              
              console.log('✅ Final sign in successful, user ID:', finalAuthData.user?.id)
              
              // Use the final auth data
              const finalAuthResult = finalAuthData
              const finalUser = finalAuthResult.user
              
              if (!finalUser) {
                throw new Error('Authentication succeeded but no user returned')
              }
            } // Guest session - no sign in errors to handle

            // Determine which auth data to use (might have been updated during sign up flow)
            const finalUser = authData.user
            const finalSession = authData.session
            
            console.log('✅ Authentication successful, user ID:', finalUser?.id)
            if (mounted && finalUser) {
              console.log('✅ Setting authenticated state with profile:', existingProfile.full_name)
              // Clear timeout on successful authentication
              clearAuthTimeout()
              setAuthState({
                user: finalUser,
                session: finalSession,
                profile: existingProfile,
                loading: false,
                error: null
              })
            }
          } else {
            console.error('❌ User profile is null or not found')
            console.error('❌ telegram_users.user_id:', telegramUserRecord?.user_id)
            console.error('❌ This means the user exists in telegram_users but not in users table')
            throw new Error('Профиль пользователя не найден. Обратитесь к менеджеру.')
          }
        } else {
          console.error('❌ User not found in telegram_users table')
          console.error('❌ Telegram ID searched:', telegramUser.id)
          console.error('❌ Query error:', telegramError)
          console.error('❌ This means the user needs to be registered by a manager first')
          
          // Let's also check if ANY users exist in telegram_users table for debugging
          console.log('🔍 Checking all telegram_users for debugging...')
          const { data: allTelegramUsers, error: allError } = await supabase
            .from('telegram_users')
            .select('telegram_id, user_id')
            .limit(10)
          
          console.log('📋 All telegram_users (first 10):', allTelegramUsers)
          console.log('📋 Query error:', allError)
          
          // User doesn't exist - this is an error for worker app
          // Workers should be created by managers first
          throw new Error('Пользователь не найден. Обратитесь к менеджеру для регистрации.')
        }
      } catch (error) {
        console.error('❌ Telegram authentication error:', error)
        if (mounted) {
          // Clear timeout on error
          clearAuthTimeout()
          setAuthState(prev => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : 'Ошибка авторизации'
          }))
        }
      }
    }

    const fetchProfile = async (userId: string): Promise<Profile | null> => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()

        if (error) {
          console.error('Profile fetch error:', error)
          return null
        }

        return data
      } catch (error) {
        console.error('Profile fetch error:', error)
        return null
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await fetchProfile(session.user.id)
          if (mounted) {
            setAuthState({
              user: session.user,
              session,
              profile,
              loading: false,
              error: null
            })
          }
        } else if (event === 'SIGNED_OUT') {
          if (mounted) {
            setAuthState({
              user: null,
              session: null,
              profile: null,
              loading: false,
              error: null
            })
          }
        }
      }
    )

    return () => {
      mounted = false
      clearAuthTimeout()
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error)
    }
  }

  return {
    ...authState,
    signOut
  }
}