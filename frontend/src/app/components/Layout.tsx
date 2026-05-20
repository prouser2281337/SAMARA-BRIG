import { Link, useLocation } from 'react-router';
import { LayoutDashboard, Calendar, FileText, Users, LogOut, Truck, Menu, X, MapPin } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ui/ThemeToggle';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logout } = useAuth();

  const navigation = [
    { name: 'Главная', href: '/', icon: LayoutDashboard },
    { name: 'Планирование', href: '/planning', icon: Calendar },
    { name: 'Заявки', href: '/requests', icon: FileText },
    { name: 'Бригады', href: '/brigades', icon: Users },
    { name: 'Маршруты', href: '/routes', icon: MapPin },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[280px] bg-sidebar border-r border-sidebar-border shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Truck className="w-5 h-5 text-sidebar-primary-foreground" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-sidebar-foreground tracking-tight truncate">Самарские Бригады</h1>
            <p className="text-[11px] text-sidebar-foreground/50 font-medium tracking-wide uppercase">Управление бригадами</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
                ${isActive(item.href)
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }
              `}
            >
              <item.icon
                className={`w-[18px] h-[18px] shrink-0 ${
                  isActive(item.href) ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/40 group-hover:text-sidebar-accent-foreground'
                }`}
                strokeWidth={1.5}
              />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg">
            <span className="text-xs text-sidebar-foreground/40 font-medium uppercase tracking-wider">Тема</span>
            <ThemeToggle />
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={1.5} />
            <span className="font-medium text-sm">Выйти</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Truck className="w-5 h-5 text-sidebar-primary-foreground" strokeWidth={1.5} />
            </div>
            <h1 className="text-base font-bold text-sidebar-foreground tracking-tight">Самарские Бригады</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-sidebar-foreground" strokeWidth={1.5} />
              ) : (
                <Menu className="w-5 h-5 text-sidebar-foreground" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-sidebar-border overflow-hidden"
            >
              <nav className="px-3 py-3 space-y-1 bg-sidebar">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                      ${isActive(item.href)
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      }
                    `}
                  >
                    <item.icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                    <span className="font-medium text-sm">{item.name}</span>
                  </Link>
                ))}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <LogOut className="w-[18px] h-[18px]" strokeWidth={1.5} />
                  <span className="font-medium text-sm">Выйти</span>
                </button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto lg:pt-0 pt-14">
        {children}
      </main>
    </div>
  );
}
