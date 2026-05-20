import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Truck, Mail, Lock, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

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
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], rotate: [90, 0, 90] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-accent/5 rounded-full blur-3xl"
        />
      </div>

      {/* Left panel - branding */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#0f172a] p-12 flex-col justify-between relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_40%,transparent_100%)]" />

        <div className="relative z-10">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex items-center gap-4 mb-8"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-accent/50 rounded-2xl blur-xl" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-accent to-accent/80 rounded-2xl flex items-center justify-center shadow-2xl">
                <Truck className="w-9 h-9 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white tracking-tight">SAMARA BRIG</h1>
              <p className="text-blue-200 text-sm">Диспетчерская система управления</p>
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 space-y-8">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <h2 className="text-5xl font-bold text-white mb-6 leading-tight">
              Умное управление<br />
              <span className="bg-gradient-to-r from-accent to-yellow-300 bg-clip-text text-transparent">
                аварийными бригадами
              </span>
            </h2>
            <p className="text-blue-100 text-lg leading-relaxed">
              Автоматизированное планирование маршрутов, оптимизация загрузки и контроль выполнения заявок
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="relative z-10"
        >
          <p className="text-blue-200 text-sm">© 2026 SAMARA BRIG. Аварийно-ремонтная служба</p>
        </motion.div>
      </motion.div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background relative">
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden mb-10 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="relative w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-3xl font-bold text-foreground">SAMARA BRIG</h1>
                <p className="text-muted-foreground text-sm">Диспетчерская система</p>
              </div>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-4xl font-bold text-foreground mb-3">С возвращением!</h2>
            <p className="text-muted-foreground text-lg">
              Введите учетные данные для продолжения работы
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/30 rounded-xl p-4 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-sm text-destructive font-medium">{error}</div>
              </motion.div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-foreground">
                Email адрес
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="dispatcher@samara-brig.ru"
                  className="w-full pl-12 pr-4 py-4 bg-card border-2 border-border rounded-xl focus:outline-none focus:border-primary transition-all"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-foreground">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  {...register('password')}
                  placeholder="••••••••••"
                  className="w-full pl-12 pr-4 py-4 bg-card border-2 border-border rounded-xl focus:outline-none focus:border-primary transition-all"
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-primary to-secondary text-white py-4 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Вход в систему...
                </span>
              ) : (
                <>
                  Войти в систему
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="pt-6 border-t border-border">
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  Демо доступ для тестирования:
                </p>
                <div className="flex flex-col gap-1">
                  <code className="text-xs bg-background px-3 py-2 rounded-lg font-mono border">
                    demo@samara-brig.ru
                  </code>
                  <code className="text-xs bg-background px-3 py-2 rounded-lg font-mono border">
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
