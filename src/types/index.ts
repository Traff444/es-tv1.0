export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'worker' | 'manager' | 'director' | 'admin';
  hourly_rate?: number;
  is_active?: boolean;
  passport_series?: string;
  passport_number?: string;
  passport_issue_date?: string;
  passport_issued_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'paused';
  assigned_to: string;
  created_by: string;
  estimated_hours?: number;
  start_location?: string;
  end_location?: string;
  target_location?: string;
  started_at?: string;
  completed_at?: string;
  paused_at?: string;
  total_pause_duration?: number;
  created_at: string;
  updated_at: string;
  assignee?: User;
  creator?: User;
  task_materials?: TaskMaterial[];
}

export interface TaskMaterial {
  id: string;
  task_id: string;
  material_id: string;
  quantity_needed: number;
  quantity_used?: number;
  material?: Material;
}

export interface WorkSession {
  id: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  start_location?: string;
  end_location?: string;
  total_hours?: number;
  earnings?: number;
  created_at: string;
  user?: User;
}

export interface Material {
  id: string;
  name: string;
  default_unit: string;
  cost_per_unit: number;
  min_stock_quantity: number;
  category_id?: string;
  created_at: string;
  updated_at: string;
  category?: MaterialCategory;
  inventory?: MaterialInventory[];
  supplier_prices?: MaterialSupplierPrice[];
}

export interface MaterialCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  address: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MaterialInventory {
  id: string;
  material_id: string;
  warehouse_id?: string;
  task_id?: string;
  quantity: number;
  location_type: 'warehouse' | 'on_site';
  last_updated: string;
  notes?: string;
  warehouse?: Warehouse;
  task?: Task;
}

export interface MaterialSupplierPrice {
  id: string;
  material_id: string;
  supplier_id: string;
  price: number;
  unit: string;
  last_updated: string;
  notes?: string;
  supplier?: Supplier;
}

export interface MaterialUsage {
  id: string;
  task_id: string;
  material_id: string;
  quantity_used: number;
  used_by: string;
  used_at: string;
  task?: Task;
  material?: Material;
  user?: User;
}

export interface RoleChangeLog {
  id: string;
  user_id: string;
  old_role: string;
  new_role: string;
  changed_by: string;
  changed_at: string;
  user?: User;
  admin?: User;
}

export interface TariffType {
  id: string;
  name: string;
  type: 'weekday' | 'weekend' | 'holiday';
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserTariff {
  id: string;
  user_id: string;
  tariff_type_id: string;
  rate_per_minute: number;
  currency: string;
  is_active: boolean;
  valid_from: string;
  valid_to?: string;
  created_at: string;
  updated_at: string;
  user?: User;
  tariff_type?: TariffType;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Система фото-чек-листов и приёмки
export type RiskLevel = 'low' | 'medium' | 'high';
export type PhotoType = 'before' | 'after';
export type TaskStatus = 'ready' | 'in_progress' | 'awaiting_photos' | 'awaiting_approval' | 'done';

export interface TaskType {
  id: string;
  slug: string;
  display_name: string;
  service_domain: string;
  risk_level: RiskLevel;
  requires_before_photos: boolean;
  photo_min: number;
  allow_auto_accept: boolean;
  default_checklist: string[];
  default_norm_minutes: number;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskPhoto {
  id: string;
  task_id: string;
  photo_url: string;
  photo_type: PhotoType;
  uploaded_at: string;
  is_synced: boolean;
  local_path?: string;
  file_size?: number;
  created_at: string;
}

export interface TaskChecklist {
  id: string;
  task_id: string;
  checklist_item: string;
  is_completed: boolean;
  completed_at?: string;
  is_synced: boolean;
  created_at: string;
}

export interface UserReliabilityScore {
  id: string;
  user_id: string;
  score: number;
  tasks_completed: number;
  tasks_returned: number;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

// Обновленный интерфейс Task с новыми полями
export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: TaskStatus;
  assigned_to: string;
  created_by: string;
  estimated_hours?: number;
  start_location?: string;
  end_location?: string;
  target_location?: string;
  started_at?: string;
  completed_at?: string;
  paused_at?: string;
  total_pause_duration?: number;
  created_at: string;
  updated_at: string;
  assignee?: User;
  creator?: User;
  task_materials?: TaskMaterial[];
  // Новые поля для системы приёмки
  task_type_id?: string;
  requires_before_override?: boolean;
  photo_min_override?: number;
  checklist_override?: string[];
  risk_override?: RiskLevel;
  effective_norm_minutes?: number;
  effective_checklist_version?: number;
  effective_photo_min?: number;
  effective_requires_before?: boolean;
  submitted_at?: string;
  approved_at?: string;
  approved_by?: string;
  approval_comment?: string;
  returned_for_revision_at?: string;
  revision_comment?: string;
  task_type?: TaskType;
  photos?: TaskPhoto[];
  checklist?: TaskChecklist[];
}