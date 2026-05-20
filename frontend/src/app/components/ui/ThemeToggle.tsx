import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        flex items-center justify-center w-9 h-9 rounded-lg
        transition-all duration-200
        text-sidebar-foreground/60 hover:text-sidebar-foreground
        hover:bg-sidebar-accent
        focus:outline-none focus:ring-2 focus:ring-sidebar-primary/50
        ${className}
      `}
      title={theme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'}
    >
      {theme === 'light' ? (
        <Moon className="w-[18px] h-[18px]" strokeWidth={1.5} />
      ) : (
        <Sun className="w-[18px] h-[18px]" strokeWidth={1.5} />
      )}
    </button>
  );
}
