import { createClient } from '@supabase/supabase-js'
import type { TaskPhoto, PhotoType, TaskWithPhotoRequirements, PhotoValidationResult, TaskChecklistItem } from '../types'

// Cloud Supabase Configuration
const supabaseUrl = 'https://enyewzeskpiqueogmssp.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueWV3emVza3BpcXVlb2dtc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTA4MDcsImV4cCI6MjA3MTg2NjgwN30.KdkzBPdw6lrCE2LW2epl9JDtcOjSccW8rkon4DVrINE'

console.log('🌐 Cloud Supabase configuration:')
console.log('  - URL:', supabaseUrl)
console.log('  - Environment: Production Cloud')

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
})

// Direct HTTP API for CORS bypass
export const directApiCall = async (
  endpoint: string,
  options: {
    method?: string
    body?: any
    headers?: Record<string, string>
  } = {},
  customUrl?: string
): Promise<any> => {
  const { method = 'GET', body, headers = {} } = options
  
  const url = customUrl || `${supabaseUrl}/rest/v1/${endpoint}`
  const requestOptions: RequestInit = {
    method,
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...headers
    }
  }
  
  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    requestOptions.body = JSON.stringify(body)
  }
  
  console.log('🔗 Direct API call:', url)
  
  try {
    const response = await fetch(url, requestOptions)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error:', response.status, errorText)
      throw new Error(`API Error: ${response.status} ${errorText}`)
    }
    
    const data = await response.json()
    console.log('✅ Direct API success:', data)
    return data
  } catch (error) {
    console.error('❌ Direct API failed:', error)
    throw error
  }
}

// Utility functions for location handling
export const getCurrentLocation = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    )
  })
}

export const formatLocation = (coords: GeolocationCoordinates): string => {
  return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
}

export const parseCoordinates = (location: string): { lat: number; lng: number } | null => {
  const match = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/)
  if (!match) return null
  
  return {
    lat: parseFloat(match[1]),
    lng: parseFloat(match[2])
  }
}

export const calculateDistance = (
  lat1: number, lon1: number, 
  lat2: number, lon2: number
): number => {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180
  const φ2 = lat2 * Math.PI/180
  const Δφ = (lat2-lat1) * Math.PI/180
  const Δλ = (lon2-lon1) * Math.PI/180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c
}

// Format time utilities
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}ч ${minutes}м`
  } else {
    return `${minutes}м`
  }
}

// Photo Storage Utilities
export const compressImage = (file: File, maxWidth: number = 1024, quality: number = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    
    img.onload = () => {
      const { width, height } = img
      let { width: newWidth, height: newHeight } = img
      
      // Calculate new dimensions
      if (width > maxWidth) {
        newWidth = maxWidth
        newHeight = (height * maxWidth) / width
      }
      
      canvas.width = newWidth
      canvas.height = newHeight
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, newWidth, newHeight)
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            resolve(file)
          }
        },
        'image/jpeg',
        quality
      )
    }
    
    img.src = URL.createObjectURL(file)
  })
}

export const uploadTaskPhoto = async (
  taskId: string,
  file: File,
  photoType: PhotoType
): Promise<TaskPhoto> => {
  try {
    // Compress image before upload
    const compressedFile = await compressImage(file, 1024, 0.8)
    
    // Generate unique filename
    const fileName = `${taskId}/${photoType}_${Date.now()}.jpg`
    
    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('task-photos')
      .upload(fileName, compressedFile)

    if (error) throw error

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('task-photos')
      .getPublicUrl(fileName)

    // Save to database
    const { data: photoData, error: dbError } = await supabase
      .from('task_photos')
      .insert({
        task_id: taskId,
        photo_url: publicUrl,
        photo_type: photoType,
        file_size: compressedFile.size
      })
      .select()
      .single()

    if (dbError) throw dbError

    return {
      ...photoData,
      is_synced: true,
      created_at: photoData.uploaded_at
    } as TaskPhoto
  } catch (error) {
    console.error('Error uploading photo:', error)
    throw error
  }
}

export const getTaskPhotos = async (taskId: string): Promise<TaskPhoto[]> => {
  try {
    const { data, error } = await supabase
      .from('task_photos')
      .select('*')
      .eq('task_id', taskId)
      .order('uploaded_at', { ascending: true })

    if (error) throw error
    
    return (data || []).map(photo => ({
      ...photo,
      is_synced: true,
      created_at: photo.uploaded_at
    } as TaskPhoto))
  } catch (error) {
    console.error('Error loading photos:', error)
    return []
  }
}

export const getTaskType = async (taskTypeId?: string): Promise<TaskWithPhotoRequirements['task_type'] | null> => {
  if (!taskTypeId) return null
  
  try {
    const { data, error } = await supabase
      .from('task_types')
      .select('*')
      .eq('id', taskTypeId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error loading task type:', error)
    return null
  }
}

export const validatePhotoRequirements = (
  photos: TaskPhoto[],
  taskType?: TaskWithPhotoRequirements['task_type'],
  requiresBeforeOverride?: boolean,
  photoMinOverride?: number
): PhotoValidationResult => {
  const effectiveRequiresBefore = requiresBeforeOverride ?? taskType?.requires_before_photos ?? false
  const effectivePhotoMin = photoMinOverride ?? taskType?.photo_min ?? 2
  
  const beforePhotos = photos.filter(p => p.photo_type === 'before')
  const totalPhotos = photos.length
  
  const hasRequiredBefore = !effectiveRequiresBefore || beforePhotos.length > 0
  const hasEnoughPhotos = totalPhotos >= effectivePhotoMin
  
  const errors: string[] = []
  
  if (effectiveRequiresBefore && beforePhotos.length === 0) {
    errors.push('Требуется фото "до" начала работы')
  }
  
  if (totalPhotos < effectivePhotoMin) {
    errors.push(`Требуется минимум ${effectivePhotoMin} фото (загружено ${totalPhotos})`)
  }
  
  return {
    isValid: hasRequiredBefore && hasEnoughPhotos,
    hasRequiredBefore,
    totalPhotos,
    requiredPhotos: effectivePhotoMin,
    missingPhotos: Math.max(0, effectivePhotoMin - totalPhotos),
    errors
  }
}

export const getTaskChecklist = async (taskId: string): Promise<TaskChecklistItem[]> => {
  try {
    const { data, error } = await supabase
      .from('task_checklist')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error loading checklist:', error)
    return []
  }
}

export const createTaskChecklist = async (
  taskId: string,
  items: string[]
): Promise<TaskChecklistItem[]> => {
  try {
    const checklistItems = items.map(item => ({
      task_id: taskId,
      item_text: item,
      is_completed: false
    }))

    const { data, error } = await supabase
      .from('task_checklist')
      .insert(checklistItems)
      .select()

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error creating checklist:', error)
    throw error
  }
}

export const updateChecklistItem = async (
  itemId: string,
  isCompleted: boolean
): Promise<void> => {
  try {
    const updateData: any = { is_completed: isCompleted }
    if (isCompleted) {
      updateData.completed_at = new Date().toISOString()
    } else {
      updateData.completed_at = null
    }

    const { error } = await supabase
      .from('task_checklist')
      .update(updateData)
      .eq('id', itemId)

    if (error) throw error
  } catch (error) {
    console.error('Error updating checklist item:', error)
    throw error
  }
}