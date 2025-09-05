import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, hasValidCredentials } from '../lib/supabase';
import { User } from '../types';
import logger from '../lib/logger';
import {
  User as UserIcon,
  Save,
  X,
  Calendar,
  CreditCard,
  Mail,
  MapPin,
  DollarSign
} from 'lucide-react';

interface EmployeeFormProps {
  user?: User;
  onClose: () => void;
  onSuccess: () => void;
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({
  user,
  onClose,
  onSuccess,
}) => {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    role: user?.role || 'worker',
    hourly_rate: user?.hourly_rate?.toString() || '',
    passport_series: user?.passport_series || '',
    passport_number: user?.passport_number || '',
    passport_issue_date: user?.passport_issue_date || '',
    passport_issued_by: user?.passport_issued_by || '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const showError = !hasValidCredentials || !supabase;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'ФИО обязательно';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Некорректный email';
    }

    if (formData.hourly_rate && (isNaN(Number(formData.hourly_rate)) || Number(formData.hourly_rate) < 0)) {
      newErrors.hourly_rate = 'Ставка должна быть положительным числом';
    }

    // Валидация паспортных данных (если заполнены)
    if (formData.passport_series && !/^\d{4}$/.test(formData.passport_series)) {
      newErrors.passport_series = 'Серия паспорта должна содержать 4 цифры';
    }

    if (formData.passport_number && !/^\d{6}$/.test(formData.passport_number)) {
      newErrors.passport_number = 'Номер паспорта должен содержать 6 цифр';
    }

    if (formData.passport_issue_date && new Date(formData.passport_issue_date) > new Date()) {
      newErrors.passport_issue_date = 'Дата выдачи не может быть в будущем';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      interface UpdateData extends Partial<User> {
        hourly_rate: number | null;
        passport_series: string | null;
        passport_number: string | null;
        passport_issue_date: string | null;
        passport_issued_by: string | null;
        updated_at: string;
      }

      const updateData: UpdateData = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        hourly_rate: formData.hourly_rate ? Number(formData.hourly_rate) : null,
        passport_series: formData.passport_series || null,
        passport_number: formData.passport_number || null,
        passport_issue_date: formData.passport_issue_date || null,
        passport_issued_by: formData.passport_issued_by || null,
        updated_at: new Date().toISOString(),
      };

      if (user) {
        // Обновление существующего пользователя
        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', user.id);

        if (error) throw error;
      } else {
        // Создание нового пользователя (только для админов)
        if (profile?.role !== 'admin') {
          throw new Error('Только администраторы могут создавать новых пользователей');
        }

        // Для создания нового пользователя нужно использовать Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: 'temp123456', // Временный пароль
          email_confirm: true,
          user_metadata: {
            full_name: formData.full_name,
          }
        });

        if (authError) throw authError;

        // Обновляем профиль пользователя
        const { error: profileError } = await supabase
          .from('users')
          .update({
            ...updateData,
            id: authData.user.id,
          })
          .eq('id', authData.user.id);

        if (profileError) throw profileError;
      }

      onSuccess();
    } catch (error) {
      logger.error('Error saving employee:', error);
      alert(`Ошибка при сохранении: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  return showError ? (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Ошибка конфигурации</h2>
        <p className="text-gray-600 mb-4">Система не настроена для работы с базой данных</p>
        <button
          onClick={onClose}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Закрыть
        </button>
      </div>
    </div>
  ) : (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {user ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
                </h2>
                <p className="text-sm text-gray-600">
                  {user ? 'Изменение данных сотрудника' : 'Создание нового сотрудника'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Основная информация */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Основная информация</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ФИО *
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.full_name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Иванов Иван Иванович"
                  />
                  {errors.full_name && (
                    <p className="text-red-500 text-sm mt-1">{errors.full_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.email ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="ivan@company.com"
                      disabled={!!user} // Email нельзя изменить для существующих пользователей
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Роль
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={profile?.role !== 'admin' && formData.role === 'admin'}
                  >
                    <option value="worker">Рабочий</option>
                    <option value="manager">Менеджер</option>
                    <option value="director">Директор</option>
                    {profile?.role === 'admin' && <option value="admin">Администратор</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Часовая ставка (BYN)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                      className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.hourly_rate ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="500.00"
                    />
                  </div>
                  {errors.hourly_rate && (
                    <p className="text-red-500 text-sm mt-1">{errors.hourly_rate}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Паспортные данные */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
                <CreditCard className="w-5 h-5" />
                <span>Паспортные данные</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Серия паспорта
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formData.passport_series}
                    onChange={(e) =>
                      setFormData({ ...formData, passport_series: e.target.value.replace(/\D/g, '') })
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.passport_series ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="1234"
                  />
                  {errors.passport_series && (
                    <p className="text-red-500 text-sm mt-1">{errors.passport_series}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Номер паспорта
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.passport_number}
                    onChange={(e) =>
                      setFormData({ ...formData, passport_number: e.target.value.replace(/\D/g, '') })
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.passport_number ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="567890"
                  />
                  {errors.passport_number && (
                    <p className="text-red-500 text-sm mt-1">{errors.passport_number}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Дата выдачи
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="date"
                      value={formData.passport_issue_date}
                      onChange={(e) => setFormData({ ...formData, passport_issue_date: e.target.value })}
                      className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.passport_issue_date ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {errors.passport_issue_date && (
                    <p className="text-red-500 text-sm mt-1">{errors.passport_issue_date}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Кем выдан
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="text"
                      value={formData.passport_issued_by}
                      onChange={(e) => setFormData({ ...formData, passport_issued_by: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="ОУФМС России по г. Москве"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex space-x-3 pt-4 border-t border-gray-200">
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
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{user ? 'Сохранить изменения' : 'Создать сотрудника'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};