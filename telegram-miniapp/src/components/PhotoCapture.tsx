import { useState, useRef, useEffect } from 'react'
import { twa } from '../lib/telegram'
import { uploadTaskPhoto } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import type { TaskPhoto, PhotoType } from '../types'

interface PhotoCaptureProps {
  taskId: string
  photoType: PhotoType
  onPhotoTaken: (photo: TaskPhoto) => void
  onCancel: () => void
}

export function PhotoCapture({ taskId, photoType, onPhotoTaken, onCancel }: PhotoCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Set up back button
    twa.showBackButton(onCancel)
    
    // Set main button for photo capture
    twa.showMainButton('Сделать фото', openCamera)
    
    return () => {
      twa.hideBackButton()
      twa.hideMainButton()
      // Clean up preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [onCancel, previewUrl])

  const openCamera = () => {
    twa.impactOccurred('light')
    fileInputRef.current?.click()
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение')
      twa.notificationOccurred('error')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Файл слишком большой (макс. 10MB)')
      twa.notificationOccurred('error')
      return
    }

    // Create preview
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setCapturedFile(file)
    
    // Update main button for confirmation
    twa.showMainButton('Подтвердить фото', confirmPhoto)
    
    twa.impactOccurred('medium')
  }

  const confirmPhoto = async () => {
    if (!capturedFile) return

    setIsCapturing(true)
    setUploadProgress(0)
    twa.impactOccurred('heavy')

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const next = prev + 10
          return next > 90 ? 90 : next
        })
      }, 100)

      // Upload photo
      const uploadedPhoto = await uploadTaskPhoto(taskId, capturedFile, photoType)
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      toast.success('Фото загружено успешно!')
      twa.notificationOccurred('success')
      
      // Clean up
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      
      onPhotoTaken(uploadedPhoto)
    } catch (error) {
      console.error('Error uploading photo:', error)
      toast.error('Ошибка загрузки фото')
      twa.notificationOccurred('error')
    } finally {
      setIsCapturing(false)
      setUploadProgress(0)
    }
  }

  const retakePhoto = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setCapturedFile(null)
    twa.showMainButton('Сделать фото', openCamera)
    twa.impactOccurred('light')
  }

  const getPhotoTypeLabel = () => {
    switch (photoType) {
      case 'before':
        return 'Фото "до" работы'
      case 'after':
        return 'Фото "после" работы'
      default:
        return 'Фото'
    }
  }

  const getPhotoTypeDescription = () => {
    switch (photoType) {
      case 'before':
        return 'Сфотографируйте состояние до начала работы'
      case 'after':
        return 'Сфотографируйте результат выполненной работы'
      default:
        return 'Сделайте фото для отчета'
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--tg-theme-section-separator-color)]">
        <h1 className="text-lg font-semibold text-center">
          {getPhotoTypeLabel()}
        </h1>
        <p className="text-sm text-[var(--tg-theme-hint-color)] text-center mt-1">
          {getPhotoTypeDescription()}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col">
        {previewUrl ? (
          // Photo Preview
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            
            {isCapturing && (
              <div className="mt-4">
                <div className="text-sm text-center mb-2">
                  Загрузка... {uploadProgress}%
                </div>
                <div className="w-full bg-[var(--tg-theme-section-separator-color)] rounded-full h-2">
                  <div 
                    className="bg-[var(--tg-theme-button-color)] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            
            {!isCapturing && (
              <button
                onClick={retakePhoto}
                className="mt-4 w-full py-3 bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)] rounded-lg border border-[var(--tg-theme-section-separator-color)] active:bg-[var(--tg-theme-section-separator-color)]"
              >
                Переснять
              </button>
            )}
          </div>
        ) : (
          // Camera Instructions
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 mb-6 rounded-full bg-[var(--tg-theme-button-color)] flex items-center justify-center">
              <svg 
                className="w-12 h-12 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
                />
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
                />
              </svg>
            </div>
            
            <h2 className="text-lg font-medium mb-2">
              Готово к съемке
            </h2>
            
            <p className="text-sm text-[var(--tg-theme-hint-color)] mb-6 max-w-xs">
              Нажмите кнопку "Сделать фото" для запуска камеры
            </p>
            
            <div className="text-xs text-[var(--tg-theme-hint-color)] space-y-1">
              <div>📸 Максимальный размер: 10MB</div>
              <div>🔧 Автоматическое сжатие</div>
              <div>📱 Поддерживаются все форматы изображений</div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  )
}