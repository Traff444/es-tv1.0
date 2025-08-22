import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAllUsers, updateUserRole, getRoleChangeLogs, signOut, hasValidCredentials, supabase } from '../lib/supabase';
import { User, RoleChangeLog } from '../types';
import { EmployeeForm } from './EmployeeForm';
import {
  Users,
  Shield,
  Edit3,
  Check,
  X,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ChevronDown,
  History,
  UserPlus
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const ConfigError: React.FC = () => (
  <div className="text-center py-12">
    <div className="text-xl font-semibold text-gray-900 mb-2">Ошибка конфигурации</div>
    <p className="text-gray-600">Система не настроена для работы с базой данных</p>
  </div>
);

export const AdminPanel: React.FC = () => {
  const { profile } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [roleLogs, setRoleLogs] = useState<RoleChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  const [updating, setUpdating] = useState(false);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);

  useEffect(() => {
    if (!hasValidCredentials || !supabase) return;
    if (profile?.role === 'admin') {
      fetchUsers();
      fetchRoleLogs();
    }
  }, [profile]);

  if (!hasValidCredentials || !supabase) {
    return <ConfigError />;
  }

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await getAllUsers();
    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const fetchRoleLogs = async () => {
    const { data, error } = await getRoleChangeLogs();
    if (!error && data) {
      setRoleLogs(data);
    }
  };

  const handleRoleUpdate = async (userId: string, role: string) => {
    setUpdating(true);
    try {
      const { error } = await updateUserRole(userId, role);
      if (error) throw error;
      
      // Force refresh all data after successful update
      console.log('Принудительное обновление списка пользователей...');
      await fetchUsers();
      await fetchRoleLogs();
      
      setEditingUser(null);
      setNewRole('');
      
      // Show success message
      alert(`Роль пользователя успешно изменена на "${getRoleDisplayName(role)}"`);
    } catch (error) {
      console.error('Error updating role:', error);
      
      // Check if the error is due to authentication issues
      if (error instanceof Error && 
          (error.message.includes('Пользователь не аутентифицирован') || 
           error.message.includes('session_not_found') ||
           error.message.includes('Session from session_id claim in JWT does not exist'))) {
        // Force logout to clear invalid session
        await signOut();
        // The useAuth hook will handle redirecting to login
      } else {
        alert(`Ошибка при обновлении роли: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      }
    } finally {
      setUpdating(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      
      await fetchUsers();
      
      const statusText = !currentStatus ? 'активирован' : 'деактивирован';
      console.log(`Пользователь ${statusText}`);
      alert(`Пользователь успешно ${statusText}`);
    } catch (error) {
      console.error('Error updating user status:', error);
      alert(`Ошибка при изменении статуса пользователя: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setUpdating(false);
    }
  };

  const startEditing = (userId: string, currentRole: string) => {
    setEditingUser(userId);
    setNewRole(currentRole);
  };

  const cancelEditing = () => {
    setEditingUser(null);
    setNewRole('');
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'worker': return 'Рабочий';
      case 'manager': return 'Менеджер';
      case 'director': return 'Директор';
      case 'admin': return 'Администратор';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'worker': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'manager': return 'bg-green-100 text-green-800 border-green-200';
      case 'director': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (profile?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Доступ запрещен</h2>
        <p className="text-gray-600">У вас нет прав для доступа к административной панели</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Административная панель</h1>
            <p className="text-gray-600">Управление пользователями и ролями системы</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Пользователи</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'logs'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>История изменений</span>
          </button>
        </div>
      </div>

      {activeTab === 'users' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setShowEmployeeForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Добавить сотрудника</span>
              </button>

              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Поиск по имени или email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Все роли</option>
                  <option value="worker">Рабочие</option>
                  <option value="manager">Менеджеры</option>
                  <option value="director">Директора</option>
                  <option value="admin">Администраторы</option>
                </select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Пользователи не найдены</h3>
                <p className="text-gray-500">Попробуйте изменить параметры поиска</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Пользователь
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Роль
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Статус
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ставка
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Паспорт
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Дата регистрации
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="py-4 px-6">
                          <div>
                            <div className="font-medium text-gray-900">{user.full_name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          {editingUser === user.id ? (
                            <div className="flex items-center space-x-2">
                              <select
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value)}
                                className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="worker">Рабочий</option>
                                <option value="manager">Менеджер</option>
                                <option value="director">Директор</option>
                                <option value="admin">Администратор</option>
                              </select>
                              <button
                                onClick={() => handleRoleUpdate(user.id, newRole)}
                                disabled={updating}
                                className="text-green-600 hover:text-green-700 disabled:opacity-50"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={updating}
                                className="text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}>
                              {getRoleDisplayName(user.role)}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.is_active && user.role !== 'inactive'
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.is_active && user.role !== 'inactive' ? 'Активен' : 'Неактивен'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-900">
                          {user.hourly_rate ? `${user.hourly_rate} BYN/ч` : '—'}
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-900">
                          {user.passport_series && user.passport_number 
                            ? `${user.passport_series} ${user.passport_number}` 
                            : '—'
                          }
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-500">
                          {format(new Date(user.created_at), 'dd MMM yyyy', { locale: ru })}
                        </td>
                        <td className="py-4 px-6">
                          {editingUser !== user.id && user.id !== profile?.id && (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setEditingEmployee(user)}
                                disabled={updating}
                                className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                              >
                                <Edit3 className="w-4 h-4" />
                                <span className="text-sm">Редактировать</span>
                              </button>
                              <button
                                onClick={() => startEditing(user.id, user.role)}
                                disabled={updating}
                                className="text-purple-600 hover:text-purple-700 flex items-center space-x-1"
                              >
                                <Shield className="w-4 h-4" />
                                <span className="text-sm">Роль</span>
                              </button>
                              <button
                                onClick={() => toggleUserStatus(user.id, user.role !== 'inactive')}
                                disabled={updating}
                                className={`text-sm px-2 py-1 rounded transition-colors ${
                                  user.is_active && user.role !== 'inactive'
                                    ? 'text-red-600 hover:text-red-700 hover:bg-red-50' 
                                    : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {user.is_active && user.role !== 'inactive' ? 'Деактивировать' : 'Активировать'}
                              </button>
                            </div>
                          )}
                          {user.id === profile?.id && (
                            <span className="text-xs text-gray-400">Это вы</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">История изменений ролей</h3>
            <p className="text-sm text-gray-600 mt-1">Последние 50 изменений ролей пользователей</p>
          </div>
          
          {roleLogs.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет записей</h3>
              <p className="text-gray-500">История изменений ролей пуста</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {roleLogs.map((log) => (
                <div key={log.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-medium text-gray-900">
                          {log.user?.full_name || 'Неизвестный пользователь'}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-sm text-gray-600">{log.user?.email}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(log.old_role)}`}>
                          {getRoleDisplayName(log.old_role)}
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-400 rotate-[-90deg]" />
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(log.new_role)}`}>
                          {getRoleDisplayName(log.new_role)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Изменено: {log.admin?.full_name || 'Система'} • {' '}
                        {format(new Date(log.changed_at), 'dd MMM yyyy, HH:mm', { locale: ru })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Employee Form Modal */}
      {showEmployeeForm && (
        <EmployeeForm
          onClose={() => setShowEmployeeForm(false)}
          onSuccess={() => {
            setShowEmployeeForm(false);
            fetchUsers();
          }}
        />
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <EmployeeForm
          user={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSuccess={() => {
            setEditingEmployee(null);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
};