// Essential types for Telegram Mini App MVP
export interface Profile {
  id: string
  email: string
  full_name: string
  role: 'worker' | 'manager' | 'director' | 'admin'
  hourly_rate?: number
  is_active?: boolean
  telegram_id?: number
  created_at: string
  updated_at: string
}

export type TaskStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'paused' 
  | 'awaiting_photos' 
  | 'awaiting_approval' 
  | 'completed' 
  | 'done' 
  | 'returned'

export interface Task {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  status: TaskStatus
  assigned_to: string
  created_by: string
  estimated_hours?: number
  start_location?: string
  end_location?: string
  target_location?: string
  started_at?: string
  completed_at?: string
  submitted_at?: string
  approved_at?: string
  paused_at?: string
  total_pause_duration?: number
  created_at: string
  updated_at: string
  task_type_id?: string
}

export interface WorkSession {
  id: string
  user_id: string
  start_time: string
  end_time?: string
  start_location?: string
  end_location?: string
  total_hours?: number
  earnings?: number
  created_at: string
}

// Photo system types
export type PhotoType = 'before' | 'after'

export interface TaskPhoto {
  id: string
  task_id: string
  photo_url: string
  photo_type: PhotoType
  uploaded_at: string
  is_synced: boolean
  file_size: number
  local_path?: string // For offline support
  created_at: string
}

export interface TaskType {
  id: string
  slug: string // e.g. 'outlet_install'
  display_name: string // e.g. 'Outlet Installation'
  risk_level: 'low' | 'medium' | 'high'
  requires_before_photos: boolean
  photo_min: number // Minimum photos required
  default_checklist: string[] // Default checklist items
  allow_auto_accept: boolean // Auto-approval for low risk
  created_at: string
  updated_at: string
}

export interface TaskChecklistItem {
  id: string
  task_id: string
  item_text: string
  is_completed: boolean
  completed_at?: string
  created_at: string
}

// Extended Task interface with photo requirements
export interface TaskWithPhotoRequirements extends Task {
  task_type?: TaskType
  task_type_id?: string
  requires_before_override?: boolean
  photo_min_override?: number
  checklist_override?: string[]
  // Computed properties
  effective_requires_before?: boolean
  effective_photo_min?: number
  photos?: TaskPhoto[]
  checklist?: TaskChecklistItem[]
}

// Photo validation result
export interface PhotoValidationResult {
  isValid: boolean
  hasRequiredBefore: boolean
  totalPhotos: number
  requiredPhotos: number
  missingPhotos: number
  errors: string[]
}