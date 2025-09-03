import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { 
  MessageCircle, 
  Check, 
  X, 
  Copy, 
  ExternalLink, 
  Bell, 
  BellOff,
  Loader2,
  Info
} from 'lucide-react';

interface TelegramUser {
  id: string;
  telegram_id: string;
  telegram_username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  notifications_enabled: boolean;
  created_at: string;
}

export const TelegramIntegration: React.FC = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [telegramData, setTelegramData] = useState<TelegramUser | null>(null);
  const [telegramId, setTelegramId] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Загружаем существующие данные Telegram
  useEffect(() => {
    if (user) {
      fetchTelegramData();
    }
  }, [user]);

  const fetchTelegramData = async () => {
    try {
      const { data, error } = await supabase
        .from('telegram_users')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Ошибка загрузки данных Telegram:', error);
        return;
      }

      setTelegramData(data);
    } catch (error) {
      console.error('Ошибка при загрузке данных Telegram:', error);
    } finally {
      setLoading(false);
    }
  };

  const linkTelegramAccount = async () => {
    if (!telegramId.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Введите ваш Telegram ID"
      });
      return;
    }

    // Проверяем, что введено число
    const numericId = parseInt(telegramId.trim());
    if (isNaN(numericId)) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Telegram ID должен быть числом"
      });
      return;
    }

    setIsLinking(true);

    try {
      // Проверяем, не занят ли этот Telegram ID
      const { data: existingUser } = await supabase
        .from('telegram_users')
        .select('user_id')
        .eq('telegram_id', numericId)
        .eq('is_active', true)
        .maybeSingle();

      if (existingUser && existingUser.user_id && existingUser.user_id !== user?.id) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: `Этот Telegram ID уже используется другим пользователем`
        });
        return;
      }

      // Если уже есть запись у текущего пользователя, обновляем её, иначе создаём новую
      const { data: existingByUser } = await supabase
        .from('telegram_users')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      let error: any = null;
      if (existingByUser?.id) {
        const { error: updateError } = await supabase
          .from('telegram_users')
          .update({
            telegram_id: numericId,
            chat_id: numericId,
            is_active: true,
            notifications_enabled: true
          })
          .eq('id', existingByUser.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('telegram_users')
          .insert({
            user_id: user?.id as string,
            telegram_id: numericId,
            chat_id: numericId,
            is_active: true,
            notifications_enabled: true
          });
        error = insertError;
      }

      if (error) {
        console.error('Ошибка связывания аккаунта:', error);
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: `Не удалось связать аккаунт: ${error.message}`
        });
        return;
      }

      toast({
        title: "Успешно!",
        description: "Telegram аккаунт успешно привязан. Вы будете получать уведомления о завершенных задачах."
      });

      setTelegramId('');
      await fetchTelegramData();

    } catch (error) {
      console.error('Ошибка при связывании аккаунта:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Произошла ошибка при связывании аккаунта"
      });
    } finally {
      setIsLinking(false);
    }
  };

  const toggleNotifications = async () => {
    if (!telegramData) return;

    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('telegram_users')
        .update({
          notifications_enabled: !telegramData.notifications_enabled
        })
        .eq('id', telegramData.id);

      if (error) {
        console.error('Ошибка обновления настроек:', error);
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Не удалось обновить настройки уведомлений"
        });
        return;
      }

      toast({
        title: "Настройки обновлены",
        description: `Уведомления ${!telegramData.notifications_enabled ? 'включены' : 'отключены'}`
      });

      await fetchTelegramData();

    } catch (error) {
      console.error('Ошибка при обновлении настроек:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Произошла ошибка при обновлении настроек"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const unlinkTelegramAccount = async () => {
    if (!telegramData || !confirm('Вы уверены, что хотите отвязать Telegram аккаунт?')) {
      return;
    }

    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('telegram_users')
        .update({ is_active: false })
        .eq('id', telegramData.id);

      if (error) {
        console.error('Ошибка отвязки аккаунта:', error);
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Не удалось отвязать аккаунт"
        });
        return;
      }

      toast({
        title: "Аккаунт отвязан",
        description: "Telegram аккаунт успешно отвязан"
      });

      setTelegramData(null);

    } catch (error) {
      console.error('Ошибка при отвязке аккаунта:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Произошла ошибка при отвязке аккаунта"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Скопировано",
        description: "Telegram ID скопирован в буфер обмена"
      });
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Загрузка настроек Telegram...</span>
      </div>
    );
  }

  // Показываем интеграцию только для менеджеров и выше
  if (!profile || !['manager', 'director', 'admin'].includes(profile.role)) {
    return (
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <Info className="w-5 h-5 text-blue-500 mr-2" />
          <h3 className="text-lg font-semibold">Интеграция с Telegram</h3>
        </div>
        <p className="text-gray-600">
          Интеграция с Telegram доступна только для менеджеров, директоров и администраторов.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и описание */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center mb-4">
          <MessageCircle className="w-6 h-6 text-blue-500 mr-3" />
          <h3 className="text-xl font-semibold">Интеграция с Telegram</h3>
        </div>
        
        <p className="text-gray-600 mb-4">
          Получайте мгновенные уведомления о завершенных задачах прямо в Telegram. 
          Вы сможете принимать или отклонять работы, запрашивать дополнительные фото 
          прямо из мессенджера.
        </p>

        {/* Статус подключения */}
        {telegramData ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Check className="w-5 h-5 text-green-600 mr-2" />
                <div>
                  <p className="font-medium text-green-800">Telegram подключен</p>
                  <p className="text-sm text-green-600">
                    ID: {telegramData.telegram_id}
                    {telegramData.telegram_username && ` (@${telegramData.telegram_username})`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(telegramData.telegram_id)}
                className="text-green-600 hover:text-green-700 p-1"
                title="Скопировать ID"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <X className="w-5 h-5 text-yellow-600 mr-2" />
              <p className="font-medium text-yellow-800">Telegram не подключен</p>
            </div>
            <p className="text-sm text-yellow-600 mt-1">
              Для получения уведомлений подключите ваш Telegram аккаунт
            </p>
          </div>
        )}
      </div>

      {/* Инструкция по подключению */}
      {!telegramData && (
        <div className="bg-white rounded-lg border p-6">
          <h4 className="font-semibold mb-3">Как подключить Telegram:</h4>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mr-2 mt-0.5">1</span>
              <span>Найдите бота <strong>@ElectroServiceManagerBot</strong> в Telegram</span>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mr-2 mt-0.5">2</span>
              <span>Отправьте команду <code className="bg-gray-100 px-1 rounded">/start</code></span>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mr-2 mt-0.5">3</span>
              <span>Скопируйте ваш Telegram ID из сообщения бота</span>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mr-2 mt-0.5">4</span>
              <span>Введите ID в поле ниже и нажмите "Связать аккаунт"</span>
            </li>
          </ol>
        </div>
      )}

      {/* Форма подключения */}
      {!telegramData && (
        <div className="bg-white rounded-lg border p-6">
          <h4 className="font-semibold mb-4">Связать Telegram аккаунт</h4>
          
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ваш Telegram ID
              </label>
              <input
                type="text"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value.replace(/\D/g, ''))}
                placeholder="123456789"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Получите ваш ID у бота @ElectroServiceManagerBot
              </p>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={linkTelegramAccount}
                disabled={isLinking || !telegramId.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isLinking ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <MessageCircle className="w-4 h-4 mr-2" />
                )}
                {isLinking ? 'Подключение...' : 'Связать аккаунт'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Настройки уведомлений */}
      {telegramData && (
        <div className="bg-white rounded-lg border p-6">
          <h4 className="font-semibold mb-4">Настройки уведомлений</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Уведомления о завершенных задачах</p>
                <p className="text-sm text-gray-600">
                  Получать уведомления в Telegram когда рабочие завершают задачи
                </p>
              </div>
              <button
                onClick={toggleNotifications}
                disabled={isUpdating}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  telegramData.notifications_enabled ? 'bg-blue-600' : 'bg-gray-300'
                } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    telegramData.notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center pt-4 border-t">
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  Связанный аккаунт: <strong>ID {telegramData.telegram_id}</strong>
                  {telegramData.first_name && (
                    <span> ({telegramData.first_name})</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  Подключено {new Date(telegramData.created_at).toLocaleDateString('ru')}
                </p>
              </div>
              
              <button
                onClick={unlinkTelegramAccount}
                disabled={isUpdating}
                className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
              >
                {isUpdating ? 'Отвязка...' : 'Отвязать аккаунт'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Информация о функциях */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 mb-3">Что вы получите:</h4>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-center">
            <Bell className="w-4 h-4 mr-2" />
            Мгновенные уведомления о завершенных задачах
          </li>
          <li className="flex items-center">
            <MessageCircle className="w-4 h-4 mr-2" />
            Фото-отчеты и детали прямо в Telegram
          </li>
          <li className="flex items-center">
            <Check className="w-4 h-4 mr-2" />
            Возможность принимать или отклонять работы одним нажатием
          </li>
          <li className="flex items-center">
            <ExternalLink className="w-4 h-4 mr-2" />
            Запрос дополнительных фотографий у рабочих
          </li>
        </ul>
      </div>
    </div>
  );
};