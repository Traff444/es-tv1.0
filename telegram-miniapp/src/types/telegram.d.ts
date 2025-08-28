// Telegram WebApp типы
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready(): void;
        expand(): void;
        close(): void;
        sendData(data: string): void;
        
        // User data  
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            is_bot?: boolean;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
            photo_url?: string;
          };
          chat_type?: string;
          chat_instance?: string;
          auth_date?: number;
          hash?: string;
        };
        
        // Theme
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        
        // Main Button
        MainButton: {
          text: string;
          color?: string;
          textColor?: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText(text: string): void;
          onClick(callback: () => void): void;
          offClick(callback: () => void): void;
          show(): void;
          hide(): void;
          enable(): void;
          disable(): void;
          showProgress(leaveActive?: boolean): void;
          hideProgress(): void;
          setParams(params: {
            text?: string;
            color?: string;
            text_color?: string;
            is_active?: boolean;
            is_visible?: boolean;
          }): void;
        };
        
        // Back Button
        BackButton: {
          isVisible: boolean;
          onClick(callback: () => void): void;
          offClick(callback: () => void): void;
          show(): void;
          hide(): void;
        };
        
        // Haptic Feedback
        HapticFeedback: {
          impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
          notificationOccurred(type: 'error' | 'success' | 'warning'): void;
          selectionChanged(): void;
        };
        
        // Platform
        platform: string;
        version: string;
        
        // Viewport
        viewportHeight: number;
        viewportStableHeight: number;
        isExpanded: boolean;
        
        // Events
        onEvent(eventType: string, callback: Function): void;
        offEvent(eventType: string, callback: Function): void;
      };
    };
  }
}

export {};
