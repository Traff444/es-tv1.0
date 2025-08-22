import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, hasValidCredentials } from '../lib/supabase';
import { User, TariffType, UserTariff, Holiday } from '../types';
import { 
  DollarSign, 
  Calendar, 
  Clock, 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  Search,
  Filter,
  ArrowLeft,
  AlertCircle,
  Check,
  X,
  TrendingUp,
  CalendarDays,
  Settings
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TariffManagerProps {
  onNavigate?: (view: string) => void;
}

interface TariffFormData {
  user_id: string;
  weekday_rate: number;
  weekend_rate: number;
  holiday_rate: number;
  valid_from: string;
  valid_to?: string;
}

export const TariffManager: React.FC<TariffManagerProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [tariffTypes, setTariffTypes] = useState<TariffType[]>([]);
  const [userTariffs, setUserTariffs] = useState<UserTariff[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTariffForm, setShowTariffForm] = useState(false);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [editingTariff, setEditingTariff] = useState<UserTariff | null>(null);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'tariffs' | 'holidays'>('tariffs');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!supabase) return;

    try {
      setLoading(true);
      await Promise.all([
        fetchUsers(),
        fetchTariffTypes(),
        fetchUserTariffs(),
        fetchHolidays()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'worker')
      .eq('is_active', true)
      .order('full_name');

    if (!error && data) {
      setUsers(data);
    }
  };

  const fetchTariffTypes = async () => {
    const { data, error } = await supabase
      .from('tariff_types')
      .select('*')
      .eq('is_active', true)
      .order('type');

    if (!error && data) {
      setTariffTypes(data);
    }
  };

  const fetchUserTariffs = async () => {
    const { data, error } = await supabase
      .from('user_tariffs')
      .select(`
        *,
        user:users(full_name, email),
        tariff_type:tariff_types(name, type)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUserTariffs(data);
    }
  };

  const fetchHolidays = async () => {
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .eq('is_active', true)
      .order('date');

    if (!error && data) {
      setHolidays(data);
    }
  };

  const handleCreateTariff = async (formData: TariffFormData) => {
    if (!supabase) return;

    try {
      const tariffTypeIds = tariffTypes.reduce((acc, type) => {
        acc[type.type] = type.id;
        return acc;
      }, {} as Record<string, string>);

      const tariffs = [
        {
          user_id: formData.user_id,
          tariff_type_id: tariffTypeIds.weekday,
          rate_per_minute: formData.weekday_rate / 60, // Конвертируем в минуты
          valid_from: formData.valid_from,
          valid_to: formData.valid_to || null
        },
        {
          user_id: formData.user_id,
          tariff_type_id: tariffTypeIds.weekend,
          rate_per_minute: formData.weekend_rate / 60,
          valid_from: formData.valid_from,
          valid_to: formData.valid_to || null
        },
        {
          user_id: formData.user_id,
          tariff_type_id: tariffTypeIds.holiday,
          rate_per_minute: formData.holiday_rate / 60,
          valid_from: formData.valid_from,
          valid_to: formData.valid_to || null
        }
      ];

      const { error } = await supabase
        .from('user_tariffs')
        .insert(tariffs);

      if (error) throw error;

      await fetchUserTariffs();
      setShowTariffForm(false);
    } catch (error) {
      console.error('Error creating tariff:', error);
      alert('Ошибка при создании тарифа');
    }
  };

  const handleCreateHoliday = async (holidayData: Partial<Holiday>) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('holidays')
        .insert([holidayData]);

      if (error) throw error;

      await fetchHolidays();
      setShowHolidayForm(false);
    } catch (error) {
      console.error('Error creating holiday:', error);
      alert('Ошибка при создании праздника');
    }
  };

  const handleDeleteTariff = async (tariffId: string) => {
    if (!supabase) return;

    if (!confirm('Вы уверены, что хотите удалить этот тариф?')) return;

    try {
      const { error } = await supabase
        .from('user_tariffs')
        .update({ is_active: false })
        .eq('id', tariffId);

      if (error) throw error;

      await fetchUserTariffs();
    } catch (error) {
      console.error('Error deleting tariff:', error);
      alert('Ошибка при удалении тарифа');
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    if (!supabase) return;

    if (!confirm('Вы уверены, что хотите удалить этот праздник?')) return;

    try {
      const { error } = await supabase
        .from('holidays')
        .update({ is_active: false })
        .eq('id', holidayId);

      if (error) throw error;

      await fetchHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      alert('Ошибка при удалении праздника');
    }
  };

  const getTariffTypeName = (type: string) => {
    switch (type) {
      case 'weekday': return 'Будние дни';
      case 'weekend': return 'Выходные дни';
      case 'holiday': return 'Праздничные дни';
      default: return type;
    }
  };

  const getTariffTypeColor = (type: string) => {
    switch (type) {
      case 'weekday': return 'bg-blue-100 text-blue-800';
      case 'weekend': return 'bg-orange-100 text-orange-800';
      case 'holiday': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTariffs = userTariffs.filter(tariff => {
    const matchesSearch = tariff.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tariff.tariff_type?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUser = selectedUser === 'all' || tariff.user_id === selectedUser;
    return matchesSearch && matchesUser;
  });

  if (!hasValidCredentials || !supabase) {
    return (
      <div className="text-center py-12">
        <div className="text-xl font-semibold text-gray-900 mb-2">Ошибка конфигурации</div>
        <p className="text-gray-600">Система не настроена для работы с базой данных</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            {onNavigate && (
              <button
                onClick={() => onNavigate('dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Назад к дашборду</span>
              </button>
            )}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Управление тарифами</h1>
                <p className="text-gray-600">Настройка ставок для будних, выходных и праздничных дней</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('tariffs')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'tariffs'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Тарифы</span>
          </button>
          <button
            onClick={() => setActiveTab('holidays')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'holidays'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Праздники</span>
          </button>
        </div>
      </div>

      {/* Tariffs Tab */}
      {activeTab === 'tariffs' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Поиск по имени или типу тарифа..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Все сотрудники</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setShowTariffForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить тариф</span>
              </button>
            </div>
          </div>

          {/* Tariffs List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Тарифы сотрудников</h2>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Загрузка тарифов...</p>
              </div>
            ) : filteredTariffs.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Тарифы не найдены</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTariffs.map((tariff) => (
                  <div key={tariff.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {tariff.user?.full_name?.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{tariff.user?.full_name}</div>
                        <div className="text-sm text-gray-500">{tariff.user?.email}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTariffTypeColor(tariff.tariff_type?.type || '')}`}>
                        {getTariffTypeName(tariff.tariff_type?.type || '')}
                      </span>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {(tariff.rate_per_minute * 60).toFixed(2)} BYN/час
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(parseISO(tariff.valid_from), 'dd.MM.yyyy')}
                          {tariff.valid_to && ` - ${format(parseISO(tariff.valid_to), 'dd.MM.yyyy')}`}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDeleteTariff(tariff.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Holidays Tab */}
      {activeTab === 'holidays' && (
        <>
          {/* Holidays Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Праздничные дни Беларуси</h2>
                <p className="text-gray-600">Управление государственными праздниками</p>
              </div>
              <button
                onClick={() => setShowHolidayForm(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить праздник</span>
              </button>
            </div>

            {/* Holidays List */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Загрузка праздников...</p>
              </div>
            ) : holidays.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Праздники не найдены</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {holidays.map((holiday) => (
                  <div key={holiday.id} className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{holiday.name}</div>
                        <div className="text-sm text-gray-600">
                          {format(parseISO(holiday.date), 'dd MMMM yyyy', { locale: ru })}
                        </div>
                        {holiday.description && (
                          <div className="text-xs text-gray-500 mt-1">{holiday.description}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteHoliday(holiday.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-100 p-2 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Tariff Form Modal */}
      {showTariffForm && (
        <TariffFormModal
          users={users}
          onClose={() => setShowTariffForm(false)}
          onSubmit={handleCreateTariff}
        />
      )}

      {/* Holiday Form Modal */}
      {showHolidayForm && (
        <HolidayFormModal
          onClose={() => setShowHolidayForm(false)}
          onSubmit={handleCreateHoliday}
        />
      )}
    </div>
  );
};

// Tariff Form Modal Component
interface TariffFormModalProps {
  users: User[];
  onClose: () => void;
  onSubmit: (data: TariffFormData) => void;
}

const TariffFormModal: React.FC<TariffFormModalProps> = ({ users, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<TariffFormData>({
    user_id: '',
    weekday_rate: 0,
    weekend_rate: 0,
    holiday_rate: 0,
    valid_from: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Добавить тариф</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Сотрудник
            </label>
            <select
              value={formData.user_id}
              onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Выберите сотрудника</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ставка за будние дни (BYN/час)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.weekday_rate}
              onChange={(e) => setFormData({ ...formData, weekday_rate: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ставка за выходные (BYN/час)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.weekend_rate}
              onChange={(e) => setFormData({ ...formData, weekend_rate: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ставка за праздники (BYN/час)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.holiday_rate}
              onChange={(e) => setFormData({ ...formData, holiday_rate: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата начала действия
            </label>
            <input
              type="date"
              value={formData.valid_from}
              onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата окончания действия (необязательно)
            </label>
            <input
              type="date"
              value={formData.valid_to || ''}
              onChange={(e) => setFormData({ ...formData, valid_to: e.target.value || undefined })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Holiday Form Modal Component
interface HolidayFormModalProps {
  onClose: () => void;
  onSubmit: (data: Partial<Holiday>) => void;
}

const HolidayFormModal: React.FC<HolidayFormModalProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    date: '',
    name: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Добавить праздник</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название праздника
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание (необязательно)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
