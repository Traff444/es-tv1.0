import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, getCurrentLocation, formatLocation, hasValidCredentials } from '../lib/supabase';
import { Task, User, Material } from '../types';
import { MapButton } from './MapDisplay';
import { TaskPhotoChecklist } from './TaskPhotoChecklist';
import { TaskApproval } from './TaskApproval';
import { 
  Plus, 
  CheckSquare, 
  Clock, 
  AlertCircle, 
  User as UserIcon,
  Package,
  Filter,
  Search,
  Edit3,
  Trash2,
  Check,
  X,
  MapPin,
  Play,
  Square,
  Loader2,
  Pause,
  Home,
  ArrowLeft,
  Camera,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Add these imports at the top of the file, along with other React imports
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});



// Map Selector Modal Component
interface MapSelectorModalProps {
  center: [number, number];
  onSelect: (lat: number, lng: number) => void;
  onClose: () => void;
}

interface AddressSuggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

interface TaskUpdateData {
  status: Task['status'];
  updated_at: string;
  start_location?: string | null;
  end_location?: string | null;
  started_at?: string;
  completed_at?: string;
  paused_at?: string | null;
  total_pause_duration?: number;
}

const MapSelectorModal: React.FC<MapSelectorModalProps> = ({ center, onSelect, onClose }) => {
  const [selectedCoords, setSelectedCoords] = useState<[number, number]>(center);
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Helper component to handle map clicks and get map reference
  const MapEvents = () => {
    const map = useMapEvents({
      click: async (e) => {
        const newCoords: [number, number] = [e.latlng.lat, e.latlng.lng];
        setSelectedCoords(newCoords);
        
        // Reverse geocode to get address
        try { // Add countrycodes=by for reverse geocoding
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}&zoom=18&addressdetails=1&countrycodes=by`);
          const data = await response.json();
          if (data && data.display_name) {
            setAddress(data.display_name);
          }
        } catch (error) {
          console.warn('Reverse geocoding failed:', error);
        }
      },
    });
    
    // Store map reference for programmatic control
    React.useEffect(() => {
      if (map) {
        mapRef.current = map;
      }
    }, [map]);
    
    return null;
  };
  
  const mapRef = React.useRef<L.Map | null>(null);

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedCoords([lat, lng]);
  };

  const handleSuggestionClick = (suggestion: AddressSuggestion) => {
    const newCoords: [number, number] = [parseFloat(suggestion.lat), parseFloat(suggestion.lon)];
    setSelectedCoords(newCoords);
    setAddress(suggestion.display_name);
    setShowSuggestions(false);
    setSuggestions([]); // Clear suggestions
    if (mapRef.current) {
      mapRef.current.setView(newCoords, 15); // Zoom in a bit on selection
    }
  };

  const searchAddress = async () => {
    if (!address.trim()) return;
    
    setIsSearching(true);
    try {
      // Используем Nominatim API для геокодирования
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5&addressdetails=1&countrycodes=by` // Add countrycodes=by for manual search
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        setSuggestions(data);
        setShowSuggestions(true);
        
        // Auto-select first result if only one
        if (data.length === 1) {
          const newCoords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          setSelectedCoords(newCoords);
          setAddress(data[0].display_name); // Update address to full display name
          if (mapRef.current) {
            mapRef.current.setView(newCoords, 15);
          }
        }
      } else {
        alert('Адрес не найден. Попробуйте другой запрос.');
      }
    } catch (error) {
      alert('Ошибка поиска адреса. Проверьте подключение к интернету.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Выберите местоположение</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Address Search */}
          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (e.target.value.length <= 2) {
                    setShowSuggestions(false);
                    setSuggestions([]);
                  }
                }}
                placeholder="Поиск по адресу..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && searchAddress()}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding suggestions to allow clicking
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
              />
              <button
                onClick={searchAddress}
                disabled={isSearching}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSearching ? 'Поиск...' : 'Найти'}
              </button>
            </div>
            {showSuggestions && suggestions.length > 0 && !isSearching && (
              <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.place_id}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                  >
                    {suggestion.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        {/* Interactive Map */}
        <div className="h-[500px] w-full rounded-lg overflow-hidden border border-gray-200">
          <MapContainer
            center={selectedCoords} // Use selectedCoords for initial center
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapEvents />
            <Marker position={selectedCoords}>
              <Popup>
                <div className="text-center">
                  <strong>Выбранное место</strong>
                  <br />
                  <span className="text-sm text-gray-600">
                    {selectedCoords[0].toFixed(6)}, {selectedCoords[1].toFixed(6)}
                  </span>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>
        
        {/* Selected coordinates display */}
        <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
          <strong>Выбранные координаты:</strong> {selectedCoords[0].toFixed(6)}, {selectedCoords[1].toFixed(6)}
          {address && (
            <div className="mt-1"><strong>Адрес:</strong> {address}</div>
          )}
        </div>
        
        {/* Actions */}
        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => onSelect(selectedCoords[0], selectedCoords[1])}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Выбрать это место
          </button>
        </div>
      </div>
    </div>
  );
};

interface TaskManagerProps {
  onNavigate?: (view: string) => void;
}

export const TaskManager: React.FC<TaskManagerProps> = ({ onNavigate }) => {
  const { profile } = useAuth();

  if (!hasValidCredentials || !supabase) {
    return (
      <div className="text-center py-12">
        <div className="text-xl font-semibold text-gray-900 mb-2">Ошибка конфигурации</div>
        <p className="text-gray-600">Система не настроена для работы с базой данных</p>
      </div>
    );
  }

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [taskTypes, setTaskTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Task['status']>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const [showPhotoChecklist, setShowPhotoChecklist] = useState(false);
  const [selectedTaskForChecklist, setSelectedTaskForChecklist] = useState<Task | null>(null);
  const [showTaskApproval, setShowTaskApproval] = useState(false);

  useEffect(() => {
    fetchTasks();
    if (profile?.role === 'manager') {
      fetchUsers();
      fetchMaterials();
      fetchTaskTypes();
    }
  }, [profile]);

  const fetchTasks = async () => {
    if (!profile) return;

    let query = supabase
      .from('tasks')
      .select(`
        *,
        assignee:assigned_to(id, full_name, email),
        creator:created_by(id, full_name, email),
        task_materials(
          id,
          quantity_needed,
          quantity_used,
          material:material_id(id, name, unit, cost_per_unit)
        )
      `)
      .order('created_at', { ascending: false });

    // Workers only see their own tasks
    if (profile.role === 'worker') {
      query = query.eq('assigned_to', profile.id);
    }

    const { data, error } = await query;

    if (!error && data) {
      setTasks(data);
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('role', ['worker', 'manager'])
      .order('full_name');

    if (!error && data) {
      setUsers(data);
    }
  };

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('name');

    if (!error && data) {
      setMaterials(data);
    }
  };

  const fetchTaskTypes = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('task_types')
        .select('*')
        .eq('is_active', true)
        .order('display_name');

      if (error) {
        console.error('Error fetching task types:', error);
        return;
      }

      if (data) {
        setTaskTypes(data);
      } else {
        setTaskTypes([]);
      }
    } catch (err) {
      console.error('Exception in fetchTaskTypes:', err);
    }
  };

  const updateTaskStatus = async (taskId: string, status: Task['status']) => {
    setUpdatingTask(taskId);
    
    try {
      const task = tasks.find(t => t.id === taskId);
      let updateData: TaskUpdateData = {
        status,
        updated_at: new Date().toISOString()
      };

      // Получаем геолокацию для начала или завершения задачи
      if (status === 'in_progress' || status === 'completed') {
        try {
          const position = await getCurrentLocation();
          const location = formatLocation(position);
          
          if (status === 'in_progress') {
            // Если задача была на паузе, не перезаписываем start_location
            if (!task?.start_location) {
              updateData.start_location = location;
              updateData.started_at = new Date().toISOString();
            } else if (task?.paused_at) {
              // Возобновляем приостановленную задачу
              let totalPauseDuration = task.total_pause_duration || 0;
              const pauseStart = new Date(task.paused_at);
              const now = new Date();
              const currentPauseDuration = Math.floor((now.getTime() - pauseStart.getTime()) / 1000);
              totalPauseDuration += currentPauseDuration;
              
              updateData.total_pause_duration = totalPauseDuration;
            }
            // Сбрасываем время паузы при возобновлении
            updateData.paused_at = null;
          } else if (status === 'completed') {
            updateData.end_location = location;
            updateData.completed_at = new Date().toISOString();
            
            // Если задача была на паузе, добавляем последнюю длительность паузы
            if (task?.paused_at) {
              let totalPauseDuration = task.total_pause_duration || 0;
              const pauseStart = new Date(task.paused_at);
              const now = new Date();
              const currentPauseDuration = Math.floor((now.getTime() - pauseStart.getTime()) / 1000);
              totalPauseDuration += currentPauseDuration;
              
              updateData.total_pause_duration = totalPauseDuration;
              updateData.paused_at = null;
            }
          }
        } catch (locationError) {
          console.warn('Не удалось получить геолокацию:', locationError);
          // Продолжаем без геолокации, но предупреждаем пользователя
          if (!confirm('Не удалось определить местоположение. Продолжить без GPS-координат?')) {
            return;
          }
        }
      } else if (status === 'paused') {
        // При постановке на паузу сохраняем время паузы
        updateData.paused_at = new Date().toISOString();
      }

      const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

      if (error) throw error;
      
      await fetchTasks();
    } catch (error) {
      console.error('Ошибка обновления задачи:', error);
      alert('Ошибка при обновлении статуса задачи');
    } finally {
      setUpdatingTask(null);
    }
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (!error) {
      fetchTasks();
      setDeletingTask(null);
    } else {
      alert('Ошибка при удалении задачи');
    }
  };

  // Функции для работы с фото-чек-листом
  const handlePhotoChecklist = (task: Task) => {
    setSelectedTaskForChecklist(task);
    setShowPhotoChecklist(true);
  };

  const handlePhotoChecklistSubmit = () => {
    setShowPhotoChecklist(false);
    setSelectedTaskForChecklist(null);
    fetchTasks(); // Обновляем список задач
  };

  const handleTaskApproval = () => {
    setShowTaskApproval(true);
  };

  const handleTaskApprovalClose = () => {
    setShowTaskApproval(false);
    fetchTasks(); // Обновляем список задач
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-800 border-green-200';
      case 'awaiting_approval': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'awaiting_photos': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesFilter = filter === 'all' || task.status === filter;
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center space-x-4">
            {profile?.role === 'manager' && onNavigate && (
              <button
                onClick={() => onNavigate('dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Назад к дашборду</span>
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {profile?.role === 'worker' ? 'Мои задачи' : 'Управление задачами'}
              </h1>
              <p className="text-gray-600 mt-1">
                {profile?.role === 'worker' 
                  ? 'Ваши назначенные задачи и их статус' 
                  : 'Создание и управление задачами команды'
                }
              </p>
            </div>
          </div>
        
          {profile?.role === 'manager' && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Создать задачу</span>
              </button>
              <button
                onClick={handleTaskApproval}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors flex items-center space-x-2"
              >
                <Eye className="w-4 h-4" />
                <span>Приёмка задач</span>
              </button>
            </div>
          )}
        </div>


        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFilter(e.target.value as 'all' | Task['status'])
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Все задачи</option>
              <option value="pending">Ожидают</option>
              <option value="in_progress">В работе</option>
              <option value="paused">На паузе</option>
              <option value="awaiting_photos">Ожидают фото</option>
              <option value="awaiting_approval">На приёмке</option>
              <option value="done">Готово</option>
              <option value="completed">Завершены</option>
            </select>
          </div>

          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск задач..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Tasks Grid */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12">
          <CheckSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Нет задач</h3>
          <p className="text-gray-500">
            {filter === 'all' ? 'Задачи не найдены' : `Нет задач со статусом "${filter}"`}
          </p>
        </div>
      ) : (
        <div className={`grid gap-6 ${
          profile?.role === 'worker' 
            ? 'grid-cols-1 lg:grid-cols-2' 
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow ${
                profile?.role === 'worker' ? 'border-l-4' : 'border-gray-200'
              } ${
                profile?.role === 'worker' && task.status === 'pending' ? 'border-l-yellow-400' :
                profile?.role === 'worker' && task.status === 'in_progress' ? 'border-l-blue-400' :
               profile?.role === 'worker' && task.status === 'paused' ? 'border-l-yellow-400' :
                profile?.role === 'worker' && task.status === 'completed' ? 'border-l-green-400' :
                'border-l-gray-200'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className={`font-semibold text-gray-900 mb-2 ${
                    profile?.role === 'worker' ? 'text-lg' : ''
                  }`}>
                    {task.title}
                  </h3>
                  <p className={`text-gray-600 line-clamp-3 ${
                    profile?.role === 'worker' ? 'text-base' : 'text-sm'
                  }`}>
                    {task.description}
                  </p>
                </div>
                <div className={`flex flex-col space-y-2 ml-4 ${
                  profile?.role === 'worker' ? 'items-end' : ''
                }`}>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(task.priority)}`}>
                    {task.priority === 'high' ? 'Высокий' : 
                     task.priority === 'medium' ? 'Средний' : 'Низкий'}
                  </span>
                  <span className={`px-2 py-1 font-medium rounded-full border ${getStatusColor(task.status)} ${
                    profile?.role === 'worker' ? 'text-sm px-3 py-1' : 'text-xs'
                  }`}>
                    {task.status === 'done' ? 'Готово' :
                     task.status === 'awaiting_approval' ? 'На приёмке' :
                     task.status === 'awaiting_photos' ? 'Ожидает фото' :
                     task.status === 'completed' ? 'Завершена' :
                     task.status === 'in_progress' ? 'В работе' :
                     task.status === 'paused' ? 'На паузе' : 'Ожидает'}
                  </span>
                </div>
              </div>

              {/* Worker-specific info */}
              {profile?.role === 'worker' && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Оценка времени:</span>
                    <span className="font-medium text-gray-900">
                      {task.estimated_hours ? `${task.estimated_hours} ч` : 'Не указано'}
                    </span>
                  </div>
                  {task.start_location && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-gray-600 flex items-center space-x-1">
                        <MapPin className="w-3 h-3" />
                        <span>Начато:</span>
                      </span>
                      <span className="text-green-600 font-medium">
                        {task.started_at && format(new Date(task.started_at), 'dd.MM HH:mm', { locale: ru })}
                      </span>
                    </div>
                  )}
                  {task.end_location && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-gray-600 flex items-center space-x-1">
                        <MapPin className="w-3 h-3" />
                        <span>Завершено:</span>
                      </span>
                      <span className="text-blue-600 font-medium">
                        {task.completed_at && format(new Date(task.completed_at), 'dd.MM HH:mm', { locale: ru })}
                      </span>
                    </div>
                  )}
                  {task.paused_at && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-gray-600 flex items-center space-x-1">
                        <Pause className="w-3 h-3" />
                        <span>Приостановлено:</span>
                      </span>
                      <span className="text-yellow-600 font-medium">
                        {format(new Date(task.paused_at), 'dd.MM HH:mm', { locale: ru })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Assignee */}
              {task.assignee && profile?.role !== 'worker' && (
                <div className="flex items-center space-x-2 mb-3">
                  <UserIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{task.assignee.full_name}</span>
                </div>
              )}

              {/* Location info for managers */}
              {profile?.role === 'manager' && (task.start_location || task.end_location) && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>Геолокация</span>
                  </div>
                  
                  {task.start_location && task.started_at && (
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">Начато:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600 font-medium">
                          {format(new Date(task.started_at), 'dd.MM HH:mm', { locale: ru })}
                        </span>
                        <MapButton
                          coordinates={task.start_location}
                          title={`Начало работы: ${task.title}`}
                          variant="start"
                        />
                      </div>
                    </div>
                  )}
                  
                  {task.end_location && task.completed_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Завершено:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-blue-600 font-medium">
                          {format(new Date(task.completed_at), 'dd.MM HH:mm', { locale: ru })}
                        </span>
                        <MapButton
                          coordinates={task.end_location}
                          title={`Завершение работы: ${task.title}`}
                          variant="end"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Materials */}
              {task.materials && task.materials.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className={`font-medium text-gray-700 ${
                      profile?.role === 'worker' ? 'text-base' : 'text-sm'
                    }`}>
                      Материалы
                    </span>
                  </div>
                  <div className="space-y-1">
                    {task.materials.map((tm) => (
                      <div key={tm.id} className={`text-gray-600 flex justify-between ${
                        profile?.role === 'worker' ? 'text-sm' : 'text-xs'
                      }`}>
                        <span>{tm.material?.name}</span>
                        <span>{tm.quantity_needed} {tm.material?.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className={`flex space-x-2 mb-3 ${
                profile?.role === 'worker' ? 'flex-col space-x-0 space-y-2' : ''
              }`}>
                {/* Manager actions */}
                {profile?.role === 'manager' && (
                  <>
                    <button
                      onClick={() => setEditingTask(task)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Изменить</span>
                    </button>
                    {deletingTask === task.id ? (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="flex items-center space-x-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          <span>Да</span>
                        </button>
                        <button
                          onClick={() => setDeletingTask(null)}
                          className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                        >
                          <X className="w-3 h-3" />
                          <span>Нет</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingTask(task.id)}
                        className="flex items-center space-x-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Удалить</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Worker actions */}
              {profile?.role === 'worker' && task.assigned_to === profile.id && (
                <div className="space-y-2">
                  {task.status === 'pending' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'in_progress')}
                      disabled={updatingTask === task.id}
                      className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                    >
                      {updatingTask === task.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          <span>Начать работу</span>
                        </>
                      )}
                    </button>
                  )}
                  {task.status === 'paused' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'in_progress')}
                      disabled={updatingTask === task.id}
                      className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                    >
                      {updatingTask === task.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          <span>Продолжить работу</span>
                        </>
                      )}
                    </button>
                  )}
                  {task.status === 'in_progress' && (
                    <>
                      <button
                        onClick={() => updateTaskStatus(task.id, 'paused')}
                        disabled={updatingTask === task.id}
                        className="w-full bg-yellow-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                      >
                        {updatingTask === task.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Pause className="w-4 h-4" />
                            <span>Приостановить</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handlePhotoChecklist(task)}
                        disabled={updatingTask === task.id}
                        className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                      >
                        {updatingTask === task.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-5 h-5" />
                            <span>Фото-отчёт</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                  {task.status === 'awaiting_photos' && (
                    <button
                      onClick={() => handlePhotoChecklist(task)}
                      disabled={updatingTask === task.id}
                      className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                    >
                      {updatingTask === task.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-5 h-5" />
                          <span>Дополнить фото</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Timestamp */}
              <div className={`mt-4 pt-3 border-t border-gray-100 ${
                profile?.role === 'worker' ? 'text-center' : ''
              }`}>
                <div className={`flex items-center space-x-2 text-gray-500 ${
                  profile?.role === 'worker' ? 'text-sm justify-center' : 'text-xs'
                }`}>
                  <Clock className="w-3 h-3" />
                  <span>
                    Создана {format(new Date(task.created_at), 'dd MMM, HH:mm', { locale: ru })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateForm && (
        <TaskFormModal
          users={users}
          materials={materials}
          taskTypes={taskTypes}
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => {
            setShowCreateForm(false);
            fetchTasks();
          }}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskFormModal
          task={editingTask}
          users={users}
          materials={materials}
          taskTypes={taskTypes}
          onClose={() => setEditingTask(null)}
          onSuccess={() => {
            setEditingTask(null);
            fetchTasks();
          }}
        />
      )}

      {/* Photo Checklist Modal */}
      {showPhotoChecklist && selectedTaskForChecklist && (
        <TaskPhotoChecklist
          task={selectedTaskForChecklist}
          isOpen={showPhotoChecklist}
          onClose={() => {
            setShowPhotoChecklist(false);
            setSelectedTaskForChecklist(null);
          }}
          onSubmit={handlePhotoChecklistSubmit}
        />
      )}

      {/* Task Approval Modal */}
      {showTaskApproval && (
        <TaskApproval
          isOpen={showTaskApproval}
          onClose={handleTaskApprovalClose}
          onRefresh={fetchTasks}
        />
      )}
    </div>
  );
};

// Task Form Modal Component (Create/Edit)
interface TaskFormModalProps {
  task?: Task;
  users: User[];
  materials: Material[];
  taskTypes: any[];
  onClose: () => void;
  onSuccess: () => void;
}

const TaskFormModal: React.FC<TaskFormModalProps> = ({
  task,
  users,
  materials,
  taskTypes,
  onClose,
  onSuccess,
}) => {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    priority: (task?.priority || 'medium') as Task['priority'],
    assigned_to: task?.assigned_to || '',
    estimated_hours: task?.estimated_hours?.toString() || '',
    target_location: task?.target_location || '',
    task_type_id: task?.task_type_id || '',
  });
  const [selectedMaterials, setSelectedMaterials] = useState<Array<{
    id?: string;
    material_id: string;
    quantity_needed: number;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([55.7558, 37.6173]); // Москва по умолчанию

  useEffect(() => {
    if (task?.materials) {
      setSelectedMaterials(
        task.materials.map(tm => ({
          id: tm.id,
          material_id: tm.material_id,
          quantity_needed: tm.quantity_needed,
        }))
      );
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);
    try {
      let taskData;
      
      if (task) {
        // Update existing task
        const { data, error: taskError } = await supabase
          .from('tasks')
          .update({
            ...formData,
            estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
            updated_at: new Date().toISOString(),
            target_location: formData.target_location || null,
            task_type_id: formData.task_type_id || null,
          })
          .eq('id', task.id)
          .select()
          .single();

        if (taskError) throw taskError;
        taskData = data;

        // Delete existing task materials
        await supabase
          .from('task_materials')
          .delete()
          .eq('task_id', task.id);
      } else {
        // Create new task
        const { data, error: taskError } = await supabase
          .from('tasks')
          .insert({
            ...formData,
            created_by: profile.id,
            estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
            target_location: formData.target_location || null,
            task_type_id: formData.task_type_id || null,
          })
          .select()
          .single();

        if (taskError) throw taskError;
        taskData = data;
      }

      // Add materials if present
      if (selectedMaterials.length > 0) {
        const { error: materialsError } = await supabase
          .from('task_materials')
          .insert(
            selectedMaterials.map(m => ({
              task_id: taskData.id,
              material_id: m.material_id,
              quantity_needed: m.quantity_needed,
            }))
          );

        if (materialsError) throw materialsError;
      }

      onSuccess();
    } catch (error) {
      console.error('Error creating task:', error);
      alert(task ? 'Ошибка при обновлении задачи' : 'Ошибка при создании задачи');
    } finally {
      setLoading(false);
    }
  };

  const addMaterial = () => {
    setSelectedMaterials([...selectedMaterials, { material_id: '', quantity_needed: 1 }]);
  };

  const removeMaterial = (index: number) => {
    setSelectedMaterials(selectedMaterials.filter((_, i) => i !== index));
  };

  const updateMaterial = <K extends 'material_id' | 'quantity_needed'>(
    index: number,
    field: K,
    value: typeof selectedMaterials[number][K]
  ) => {
    const updated = [...selectedMaterials];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedMaterials(updated);
  };

  const getCurrentLocationForTask = async () => {
    try {
      const position = await getCurrentLocation();
      const coords = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
      setFormData({ ...formData, target_location: coords });
      alert('Координаты получены и добавлены в поле адреса');
    } catch (error) {
      alert('Не удалось получить местоположение. Проверьте разрешения браузера.');
    }
  };

  const openMapSelector = () => {
    // Если есть текущий адрес, попробуем его распарсить как координаты
    if (formData.target_location) {
      const coords = formData.target_location.split(',').map(c => parseFloat(c.trim()));
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        setMapCenter([coords[0], coords[1]]);
      }
    }
    setShowMapModal(true);
  };

  const handleMapSelect = (lat: number, lng: number) => {
    const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    setFormData({ ...formData, target_location: coords });
    setShowMapModal(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {task ? 'Редактировать задачу' : 'Создать задачу'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название задачи
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Введите название задачи"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Описание
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Опишите задачу подробнее"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Приоритет
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as Task['priority'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Низкий</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тип задачи
                </label>
                <select
                  value={formData.task_type_id}
                  onChange={(e) => setFormData({ ...formData, task_type_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Выберите тип задачи</option>
                  {taskTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Исполнитель
                </label>
                <select
                  required
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Выберите исполнителя</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Оценка времени (ч)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.estimated_hours}
                  onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Адрес объекта *
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={formData.target_location}
                  onChange={(e) => setFormData({ ...formData, target_location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Введите адрес (например: ул. Пушкина, 10, Москва)"
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => getCurrentLocationForTask()}
                    className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                  >
                    📍 Моё местоположение
                  </button>
                  <button
                    type="button"
                    onClick={() => openMapSelector()}
                    className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded hover:bg-green-100 transition-colors"
                  >
                    🗺️ Выбрать на карте
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  💡 Можно ввести обычный адрес, использовать GPS или выбрать на карте
                </p>
              </div>
            </div>

            {/* Materials */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Материалы
                </label>
                <button
                  type="button"
                  onClick={addMaterial}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  + Добавить материал
                </button>
              </div>

              {selectedMaterials.map((material, index) => (
                <div key={index} className="flex items-center space-x-3 mb-3">
                  <select
                    value={material.material_id}
                    onChange={(e) => updateMaterial(index, 'material_id', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Выберите материал</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={material.quantity_needed}
                    onChange={(e) => updateMaterial(index, 'quantity_needed', parseInt(e.target.value))}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Кол-во"
                  />
                  <button
                    type="button"
                    onClick={() => removeMaterial(index)}
                    className="text-red-600 hover:text-red-700 px-2"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (task ? 'Сохранение...' : 'Создание...') : (task ? 'Сохранить изменения' : 'Создать задачу')}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Map Selector Modal */}
      {showMapModal && (
        <MapSelectorModal
          center={mapCenter}
          onSelect={handleMapSelect}
          onClose={() => setShowMapModal(false)}
        />
      )}
    </div>
  );
};