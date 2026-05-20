import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Truck, Mail, Lock, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { ThemeToggle } from './ui/ThemeToggle';

const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setIsLoading(true);

    try {
      await login(data.email, data.password);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка входа в систему');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-background">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.15, 1], rotate: [0, 45, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-primary/[0.03] rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1.15, 1, 1.15], rotate: [45, 0, 45] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-accent/[0.03] rounded-full blur-3xl"
        />
      </div>

      {/* Left panel — branding */}
      <motion.div
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:flex lg:w-1/2 bg-sidebar relative overflow-hidden flex-col justify-between p-12"
      >
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10">
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex items-center gap-3 mb-10"
          >
            <div className="w-12 h-12 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Truck className="w-6 h-6 text-sidebar-primary-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-sidebar-foreground tracking-tight">Самарские Бригады</h1>
              <p className="text-xs text-sidebar-foreground/50 font-medium tracking-wide uppercase mt-0.5">Аварийно-ремонтная служба</p>
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 space-y-6">
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
          >
            <h2 className="text-4xl font-bold text-sidebar-foreground mb-4 leading-tight tracking-tight">
              Умное управление
              <br />
              <span className="text-sidebar-primary">аварийными бригадами</span>
            </h2>
            <p className="text-sidebar-foreground/60 text-base leading-relaxed max-w-md">
              Автоматизированное планирование маршрутов, оптимизация загрузки и контроль выполнения заявок в режиме реального времени
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="relative z-10 flex items-center justify-between"
        >
          <p className="text-xs text-sidebar-foreground/40">© 2026 АРС Диспетчер</p>
          <div className="flex items-center gap-2">
            <ThemeToggle className="text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent" />
          </div>
        </motion.div>
      </motion.div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        <motion.div
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Truck className="w-5 h-5 text-primary-foreground" strokeWidth={1.5} />
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold text-foreground tracking-tight">Самарские Бригады</h1>
                <p className="text-muted-foreground text-xs">Диспетчерская система</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">С возвращением</h2>
            <p className="text-muted-foreground text-sm">Введите учетные данные для продолжения работы</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <div className="text-sm text-destructive font-medium">{error}</div>
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/50" strokeWidth={1.5} />
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="dispatcher@samara-brig.ru"
                  className="w-full pl-10 pr-4 py-3 bg-input-background border border-border rounded-lg
                             text-sm text-foreground placeholder:text-muted-foreground/40
                             focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring
                             transition-all duration-150"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive font-medium">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/50" strokeWidth={1.5} />
                <input
                  id="password"
                  type="password"
                  {...register('password')}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-input-background border border-border rounded-lg
                             text-sm text-foreground placeholder:text-muted-foreground/40
                             focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring
                             transition-all duration-150"
                />
              </div>
              {errors.password && (
                <p className="text-xs text-destructive font-medium">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold
                         text-sm tracking-wide
                         hover:bg-primary/90 active:bg-primary/95
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-150
                         flex items-center justify-center gap-2 shadow-sm"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                  />
                  Вход...
                </span>
              ) : (
                <>
                  Войти в систему
                  <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                </>
              )}
            </button>

            <div className="pt-4 border-t border-border">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                  Демо доступ
                </p>
                <div className="flex flex-col gap-1">
                  <code className="text-xs bg-background px-3 py-1.5 rounded-md font-mono border text-foreground">
                    demo@samara-brig.ru
                  </code>
                  <code className="text-xs bg-background px-3 py-1.5 rounded-md font-mono border text-foreground">
                    demo123
                  </code>
                </div>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
