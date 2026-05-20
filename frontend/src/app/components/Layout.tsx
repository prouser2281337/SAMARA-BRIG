import { Link, useLocation } from 'react-router';
import { LayoutDashboard, Calendar, FileText, Users, LogOut, Truck, Menu, X, MapPin } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logout } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
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
      <aside className="hidden lg:flex lg:flex-col lg:w-72 bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
          <div className="relative">
            <div className="absolute inset-0 bg-accent/30 rounded-xl blur-md"></div>
            <div className="relative w-12 h-12 bg-gradient-to-br from-accent to-accent/80 rounded-xl flex items-center justify-center">
              <Truck className="w-7 h-7 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-sidebar-foreground">SAMARA BRIG</h1>
            <p className="text-xs text-sidebar-foreground/60">Диспетчерская</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                isActive(item.href)
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <item.icon className={`w-5 h-5 ${
                isActive(item.href) ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground'
              }`} />
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Выйти</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">SAMARA BRIG</h1>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-sidebar-foreground" />
            ) : (
              <Menu className="w-6 h-6 text-sidebar-foreground" />
            )}
          </button>
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
              <nav className="p-4 space-y-2 bg-sidebar">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive(item.href)
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                ))}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Выйти</span>
                </button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto lg:pt-0 pt-16">
        {children}
      </main>
    </div>
  );
}
