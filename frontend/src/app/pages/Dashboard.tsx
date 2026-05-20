import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Users, FileText, CheckCircle, Clock, TrendingUp, AlertCircle, MapPin, Wrench } from 'lucide-react';
import { dashboardApi, brigadesApi, requestsApi } from '../api';
import { Skeleton } from '../components/ui/skeleton';
import { Link } from 'react-router';

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 30000,
  });

  const { data: brigades, isLoading: brigadesLoading } = useQuery({
    queryKey: ['brigades'],
    queryFn: () => brigadesApi.getAll(),
  });

  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['requests'],
    queryFn: () => requestsApi.getAll(),
  });

  const isLoading = statsLoading || brigadesLoading || requestsLoading;

  const activeBrigades = parseInt(stats?.brigades.active || '0', 10) + parseInt(stats?.brigades.on_route || '0', 10);
  const totalBrigades = parseInt(stats?.brigades.total || '0', 10);
  const totalRequests = parseInt(stats?.requests.total || '0', 10);
  const completedRequests = parseInt(stats?.requests.completed || '0', 10);
  const pendingRequests = parseInt(stats?.requests.new || '0', 10);
  const urgentRequests = parseInt(stats?.requests.urgent || '0', 10);
  const todayAssignments = stats?.todayAssignments || 0;

  const completionRate = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;

  const dashboardStats = [
    {
      title: 'Активные бригады',
      value: activeBrigades,
      total: totalBrigades,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-600',
    },
    {
      title: 'Всего заявок',
      value: totalRequests,
      icon: FileText,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/10',
      textColor: 'text-purple-600',
    },
    {
      title: 'Выполнено',
      value: completedRequests,
      percentage: completionRate,
      icon: CheckCircle,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-600',
    },
    {
      title: 'Ожидают назначения',
      value: pendingRequests,
      urgent: urgentRequests,
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/10',
      textColor: 'text-orange-600',
    },
  ];

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-600',
    on_route: 'bg-blue-500/10 text-blue-600',
    inactive: 'bg-gray-500/10 text-gray-600',
  };

  const statusLabels: Record<string, string> = {
    active: 'Готова',
    on_route: 'На маршруте',
    inactive: 'Неактивна',
  };

  const requestStatusColors: Record<string, string> = {
    new: 'bg-orange-500',
    assigned: 'bg-purple-500',
    in_progress: 'bg-blue-500',
    completed: 'bg-green-500',
    cancelled: 'bg-gray-500',
  };

  const requestStatusLabels: Record<string, string> = {
    new: 'Новая',
    assigned: 'Назначена',
    in_progress: 'В работе',
    completed: 'Выполнена',
    cancelled: 'Отменена',
  };

  // Последние заявки (сортируем по created_at desc, берем 5)
  const recentRequests = requests
    ? [...requests].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
    : [];

  const today = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Обзор работы диспетчерской службы</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Сегодня</div>
          <div className="text-lg font-semibold text-foreground">{today}</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6">
                <Skeleton className="h-12 w-12 rounded-xl mb-4" />
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))
          : dashboardStats.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative group"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity`}></div>
                <div className="relative bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`${stat.bgColor} p-3 rounded-xl`}>
                      <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
                    </div>
                    {todayAssignments > 0 && stat.title === 'Выполнено' && (
                      <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <TrendingUp className="w-4 h-4" />
                        +{todayAssignments}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-3xl font-bold text-foreground">
                      {stat.value}
                      {stat.total !== undefined && <span className="text-lg text-muted-foreground">/{stat.total}</span>}
                    </div>
                    <div className="text-sm text-muted-foreground">{stat.title}</div>
                    {stat.percentage !== undefined && (
                      <div className="text-xs text-muted-foreground">{stat.percentage}% выполнения</div>
                    )}
                    {stat.urgent !== undefined && stat.urgent > 0 && (
                      <div className="flex items-center gap-1 text-destructive text-xs font-medium mt-2">
                        <AlertCircle className="w-3 h-3" />
                        {stat.urgent} срочных
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Requests */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Последние заявки</h2>
            <Link to="/requests" className="text-sm text-primary hover:underline">
              Все заявки →
            </Link>
          </div>
          <div className="space-y-3">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-muted/30">
                    <Skeleton className="h-2 w-2 rounded-full mt-2" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))
              : recentRequests.length === 0
                ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Нет заявок</p>
                  </div>
                )
                : recentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 ${requestStatusColors[req.status] || 'bg-gray-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground flex items-center gap-2">
                        <Wrench className="w-3 h-3 text-muted-foreground" />
                        {req.work_type}
                      </div>
                      <div className="text-sm text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {req.address}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {req.client} · {requestStatusLabels[req.status] || req.status}
                        {req.priority === 'urgent' && (
                          <span className="ml-2 text-destructive font-medium">СРОЧНО</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(req.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                ))}
          </div>
        </motion.div>

        {/* Brigade Status */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Статус бригад</h2>
            <Link to="/brigades" className="text-sm text-primary hover:underline">
              Все бригады →
            </Link>
          </div>
          <div className="space-y-3">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                ))
              : brigades?.length === 0
                ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Нет бригад</p>
                  </div>
                )
                : brigades?.slice(0, 6).map((brigade) => (
                  <div
                    key={brigade.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: brigade.color || '#3b82f6' }}
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{brigade.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {brigade.license_plate} · {brigade.qualification}
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[brigade.status] || 'bg-gray-500/10 text-gray-600'}`}>
                      {statusLabels[brigade.status] || brigade.status}
                    </span>
                  </div>
                ))}
          </div>
        </motion.div>
      </div>

      {/* Urgent Requests Alert */}
      {!isLoading && urgentRequests > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/30 rounded-2xl p-6"
        >
          <div className="flex items-start gap-4">
            <div className="bg-destructive/20 p-3 rounded-xl">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground mb-1">Срочные заявки требуют внимания</h3>
              <p className="text-sm text-muted-foreground">
                {urgentRequests} {urgentRequests === 1 ? 'заявка требует' : 'заявки требуют'} срочного назначения бригады
              </p>
            </div>
            <Link
              to="/requests"
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors text-sm font-medium"
            >
              Просмотреть
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
