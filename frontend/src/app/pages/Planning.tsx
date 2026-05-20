import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Clock, MapPin, AlertCircle, ChevronLeft, ChevronRight,
  FileText, X, CheckCircle, Trash2, Play
} from 'lucide-react';
import { assignmentsApi, type ScheduleDay, type Assignment, type Request } from '../api';
import { Loader } from '../components/ui/loader';
import { toast } from 'sonner';

const WORK_START = 9;
const WORK_END = 18;
const HOURS = Array.from({ length: WORK_END - WORK_START + 1 }, (_, i) => WORK_START + i);

const formatDateISO = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const formatDateRu = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Convert a timestamp to a "minutes since 09:00" value for the day
// Parses HH:MM directly from ISO string to avoid timezone shifts
type TimePoint = { h: number; m: number };
const parseTime = (iso: string): TimePoint => {
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return { h: 0, m: 0 };
  return { h: parseInt(match[1], 10), m: parseInt(match[2], 10) };
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'text-destructive';
    case 'high': return 'text-orange-600';
    case 'medium': return 'text-blue-600';
    case 'low': return 'text-gray-600';
    default: return 'text-gray-600';
  }
};

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'Срочно';
    case 'high': return 'Высокий';
    case 'medium': return 'Средний';
    case 'low': return 'Низкий';
    default: return priority;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'scheduled': return 'bg-purple-500';
    case 'in_progress': return 'bg-blue-500';
    case 'completed': return 'bg-green-500';
    default: return 'bg-purple-500';
  }
};

const timeToMinutes = (t: TimePoint) => t.h * 60 + t.m;
const toLocalISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}:${s}`;
};
const minutesToDayOffset = (mins: number) => Math.max(0, Math.min((WORK_END - WORK_START) * 60, mins - WORK_START * 60));
const dayOffsetPercent = (mins: number) => (minutesToDayOffset(mins) / ((WORK_END - WORK_START) * 60)) * 100;

export function Planning() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(formatDateISO(new Date()));
  const [showRequests, setShowRequests] = useState(false);
  const [draggedRequest, setDraggedRequest] = useState<Request | null>(null);

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['schedule', selectedDate],
    queryFn: () => assignmentsApi.getSchedule(selectedDate),
    enabled: !!selectedDate,
  });

  const autoPlanMutation = useMutation({
    mutationFn: () => assignmentsApi.autoPlan(selectedDate),
    onSuccess: (data) => {
      toast.success(
        data.planned > 0
          ? `Запланировано ${data.planned} заявок. Не удалось: ${data.unplanned}.`
          : 'Нет заявок для планирования'
      );
      queryClient.invalidateQueries({ queryKey: ['schedule', selectedDate] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Ошибка автопланирования');
    },
  });

  const createAssignmentMutation = useMutation({
    mutationFn: assignmentsApi.create,
    onSuccess: () => {
      toast.success('Заявка назначена');
      queryClient.invalidateQueries({ queryKey: ['schedule', selectedDate] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Ошибка назначения');
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: assignmentsApi.delete,
    onSuccess: () => {
      toast.success('Назначение отменено');
      queryClient.invalidateQueries({ queryKey: ['schedule', selectedDate] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Ошибка отмены');
    },
  });

  const changeDate = useCallback((deltaDays: number) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + deltaDays);
    setSelectedDate(formatDateISO(d));
  }, [selectedDate]);

  // Build per-brigade assignment lookup
  const brigadeAssignments = useMemo(() => {
    const map: Record<number, Assignment[]> = {};
    if (!schedule) return map;
    for (const a of schedule.assignments) {
      if (!map[a.brigade_id]) map[a.brigade_id] = [];
      map[a.brigade_id].push(a);
    }
    // sort each list
    for (const k of Object.keys(map)) {
      map[Number(k)].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }
    return map;
  }, [schedule]);

  // Check if brigade qualification matches request work type
  const isBrigadeQualifiedForRequest = (brigade: any, request: Request): boolean => {
    const reqLower = request.work_type.toLowerCase();
    const brigLower = brigade.qualification.toLowerCase();
    if (brigLower.includes('универсал')) return true;
    return (
      (reqLower.includes('сантех') && brigLower.includes('сантех')) ||
      (reqLower.includes('электр') && brigLower.includes('электр')) ||
      (reqLower.includes('канализац') && brigLower.includes('сантех')) ||
      (reqLower.includes('счетчик') && brigLower.includes('сантех')) ||
      (reqLower.includes('розетк') && brigLower.includes('электр')) ||
      (reqLower.includes('смесител') && brigLower.includes('сантех')) ||
      (reqLower.includes('люстр') && brigLower.includes('электр')) ||
      (reqLower.includes('автомат') && brigLower.includes('электр')) ||
      (reqLower.includes('протечк') && brigLower.includes('сантех'))
    );
  };

  // Check if exact time slot is free for a brigade
  const checkExactSlotFree = (brigadeId: number, startStr: string, endStr: string): boolean => {
    const slots = brigadeAssignments[brigadeId] || [];
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    for (const slot of slots) {
      const s = new Date(slot.start_time).getTime();
      const e = new Date(slot.end_time).getTime();
      if (!(end <= s || start >= e)) {
        return false;
      }
    }
    return true;
  };

  const handleDragStart = (req: Request) => {
    setDraggedRequest(req);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, brigadeId: number) => {
    e.preventDefault();
    if (!draggedRequest || !schedule) return;

    const brigade = brigades.find((b) => b.id === brigadeId);
    if (!brigade) return;

    // 1. Validate qualification
    if (!isBrigadeQualifiedForRequest(brigade, draggedRequest)) {
      toast.error('Бригада не подходит по квалификации для этого типа работ');
      setDraggedRequest(null);
      return;
    }

    // 2. Build exact start/end from desired_datetime
    const desiredTime = parseTime(draggedRequest.desired_datetime);
    const duration = draggedRequest.planned_duration || 60;
    const startStr = `${selectedDate}T${String(desiredTime.h).padStart(2, '0')}:${String(desiredTime.m).padStart(2, '0')}:00`;
    const endDate = new Date(`${selectedDate}T${String(desiredTime.h).padStart(2, '0')}:${String(desiredTime.m).padStart(2, '0')}:00`);
    endDate.setMinutes(endDate.getMinutes() + duration);
    const endStr = toLocalISO(endDate);

    // 3. Validate exact slot is free
    if (!checkExactSlotFree(brigadeId, startStr, endStr)) {
      toast.error('В это время у бригады уже есть назначение');
      setDraggedRequest(null);
      return;
    }

    createAssignmentMutation.mutate({
      requestId: draggedRequest.id,
      brigadeId,
      scheduledDate: selectedDate,
      startTime: startStr,
      endTime: endStr,
      travelTime: 15,
    });
    setDraggedRequest(null);
  };

  const handleDeleteAssignment = (id: number) => {
    deleteAssignmentMutation.mutate(id);
  };

  const handleQuickAssign = (req: Request, brigadeId: number) => {
    const brigade = brigades.find((b) => b.id === brigadeId);
    if (!brigade) return;

    // 1. Validate qualification
    if (!isBrigadeQualifiedForRequest(brigade, req)) {
      toast.error('Бригада не подходит по квалификации');
      return;
    }

    // 2. Build exact start/end from desired_datetime
    const desiredTime = parseTime(req.desired_datetime);
    const duration = req.planned_duration || 60;
    const startStr = `${selectedDate}T${String(desiredTime.h).padStart(2, '0')}:${String(desiredTime.m).padStart(2, '0')}:00`;
    const endDate = new Date(`${selectedDate}T${String(desiredTime.h).padStart(2, '0')}:${String(desiredTime.m).padStart(2, '0')}:00`);
    endDate.setMinutes(endDate.getMinutes() + duration);
    const endStr = toLocalISO(endDate);

    // 3. Validate exact slot is free
    if (!checkExactSlotFree(brigadeId, startStr, endStr)) {
      toast.error('В это время у бригады уже есть назначение');
      return;
    }

    createAssignmentMutation.mutate({
      requestId: req.id,
      brigadeId,
      scheduledDate: selectedDate,
      startTime: startStr,
      endTime: endStr,
      travelTime: 15,
    });
  };

  const brigades = schedule?.brigades || [];
  const unassigned = schedule?.unassigned || [];
  const totalAssignments = schedule?.assignments?.length || 0;
  const utilization = useMemo(() => {
    if (!brigades.length || !schedule?.assignments?.length) return 0;
    const totalWorkTime = schedule.assignments.reduce((sum, a) => {
      const s = new Date(a.start_time).getTime();
      const e = new Date(a.end_time).getTime();
      return sum + Math.max(0, (e - s) / 60000);
    }, 0);
    const availableTime = brigades.length * (WORK_END - WORK_START) * 60;
    return Math.min(100, Math.round((totalWorkTime / availableTime) * 100));
  }, [schedule, brigades.length]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Планирование маршрутов</h1>
          <p className="text-muted-foreground">Распределение заявок по бригадам</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => changeDate(-1)}
            className="p-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => changeDate(1)}
            className="p-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => autoPlanMutation.mutate()}
            disabled={autoPlanMutation.isPending}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-accent to-accent/80 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
          >
            {autoPlanMutation.isPending ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
                Планирование...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Автопланирование
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              Расписание на {formatDateRu(selectedDate)}
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Time Header */}
            <div className="flex border-b border-border bg-muted/30">
              <div className="w-48 p-4 font-semibold text-foreground border-r border-border flex-shrink-0">
                Бригада
              </div>
              <div className="flex-1 flex relative">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 p-4 text-center text-sm text-muted-foreground border-r border-border last:border-r-0"
                  >
                    {hour}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Brigade Rows */}
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground"><Loader text="Загрузка расписания..." /></div>
            ) : brigades.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Нет бригад для отображения</div>
            ) : (
              brigades.map((brigade, idx) => {
                const items = brigadeAssignments[brigade.id] || [];
                return (
                  <motion.div
                    key={brigade.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex border-b border-border hover:bg-muted/20 transition-colors"
                  >
                    <div className="w-48 p-4 border-r border-border flex-shrink-0">
                      <div className="font-medium text-foreground">{brigade.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{brigade.license_plate}</div>
                      <div className="text-xs text-muted-foreground">{brigade.qualification}</div>
                      <div
                        className={`inline-block mt-2 px-2 py-1 rounded-full text-xs ${
                          brigade.status === 'active'
                            ? 'bg-green-500/10 text-green-600'
                            : brigade.status === 'on_route'
                            ? 'bg-blue-500/10 text-blue-600'
                            : 'bg-gray-500/10 text-gray-600'
                        }`}
                      >
                        {brigade.status === 'active'
                          ? 'Готова'
                          : brigade.status === 'on_route'
                          ? 'На маршруте'
                          : 'Неактивна'}
                      </div>
                    </div>

                    {/* Timeline area drop target */}
                    <div
                      className="flex-1 relative h-28"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, brigade.id)}
                    >
                      {/* Hour divisions */}
                      {HOURS.map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-r border-border/50"
                          style={{ left: `${(i / HOURS.length) * 100}%`, width: `${100 / HOURS.length}%` }}
                        />
                      ))}

                      {/* Drag hint */}
                      {draggedRequest && (
                        <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary/30 flex items-center justify-center pointer-events-none">
                          <span className="text-sm text-primary font-medium">Перетащите сюда</span>
                        </div>
                      )}

                      {/* Assignments */}
                      {items.map((a) => {
                        const start = parseTime(a.start_time);
                        const end = parseTime(a.end_time);
                        const startMin = timeToMinutes(start);
                        const endMin = timeToMinutes(end);
                        const left = dayOffsetPercent(startMin);
                        const right = dayOffsetPercent(endMin);
                        const width = right - left;

                        return (
                          <motion.div
                            key={a.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.02, zIndex: 10 }}
                            className={`absolute top-0 bottom-2 rounded-lg shadow-md cursor-pointer group ${getStatusColor(
                              a.status
                            )}`}
                            style={{
                              left: `${left}%`,
                              width: `${Math.max(2, width)}%`,
                            }}
                          >
                            <div className="h-full flex flex-col justify-center px-3 text-white overflow-hidden">
                              <div className="font-medium text-xs truncate">{a.work_type}</div>
                              <div className="text-xs opacity-90 truncate flex items-center gap-1">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                {a.address}
                              </div>
                              <div className="text-xs opacity-75 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {start.h.toString().padStart(2, '0')}:{start.m.toString().padStart(2, '0')} -
                                {end.h.toString().padStart(2, '0')}:{end.m.toString().padStart(2, '0')}
                              </div>
                            </div>

                            {/* Hover actions */}
                            <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-1">
                              <button
                                onClick={() => handleDeleteAssignment(a.id)}
                                className="p-1 bg-white/20 hover:bg-white/40 rounded text-white"
                                title="Отменить назначение"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 w-56">
                              <div className="bg-foreground text-background px-3 py-2 rounded-lg shadow-xl text-xs">
                                <div className="font-medium">{a.client}</div>
                                <div className="opacity-75">{a.phone}</div>
                                <div className="mt-1 truncate">{a.description}</div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-purple-500"></div>
            <span className="text-muted-foreground">Запланировано</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500"></div>
            <span className="text-muted-foreground">В процессе</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-muted-foreground">Завершено</span>
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{totalAssignments}</div>
              <div className="text-sm text-muted-foreground">Назначений на день</div>
            </div>
          </div>
        </div>

        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-500/20 p-2 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{utilization}%</div>
              <div className="text-sm text-muted-foreground">Загрузка бригад</div>
            </div>
          </div>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500/20 p-2 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{unassigned.length}</div>
              <div className="text-sm text-muted-foreground">Не распределено</div>
            </div>
          </div>
        </div>
      </div>

      {/* Unassigned Requests Toggle */}
      <div className="flex justify-center">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowRequests((s) => !s)}
          className="flex items-center gap-2 px-6 py-3 bg-card border border-border rounded-xl font-medium text-foreground hover:bg-muted transition-all"
        >
          <FileText className="w-5 h-5 text-primary" />
          {showRequests ? 'Скрыть заявки' : 'Заявки'}
          {unassigned.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-destructive/10 text-destructive rounded-full text-xs font-medium">
              {unassigned.length}
            </span>
          )}
        </motion.button>
      </div>

      {/* Unassigned Requests Panel */}
      <AnimatePresence>
        {showRequests && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">
                Неназначенные заявки на {formatDateRu(selectedDate)}
              </h3>
              <button onClick={() => setShowRequests(false)} className="p-2 hover:bg-muted rounded-lg">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground"><Loader text="Загрузка..." /></div>
            ) : unassigned.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Все заявки распределены ✅</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Клиент / Адрес</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Тип работ</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Приоритет</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Время</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Длит.</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Действие</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {unassigned.map((req) => (
                      <tr
                        key={req.id}
                        draggable
                        onDragStart={() => handleDragStart(req)}
                        className="hover:bg-muted/30 transition-colors cursor-grab active:cursor-grabbing"
                      >
                        <td className="px-4 py-3 text-sm font-medium">#{req.id}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium">{req.client}</div>
                          <div className="text-xs text-muted-foreground">{req.address}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">{req.work_type}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${getPriorityColor(req.priority)}`}>
                            {getPriorityLabel(req.priority)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {req.desired_datetime
                            ? new Date(req.desired_datetime).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">{req.planned_duration} мин</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {brigades.map((b) => (
                              <button
                                key={b.id}
                                onClick={() => handleQuickAssign(req, b.id)}
                                disabled={createAssignmentMutation.isPending}
                                className="px-2 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded border border-primary/20 transition-colors disabled:opacity-50"
                              >
                                {b.name.split(' ')[0]}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
