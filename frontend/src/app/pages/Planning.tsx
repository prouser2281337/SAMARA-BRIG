import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Clock, MapPin, AlertCircle, ChevronLeft, ChevronRight,
  FileText, X, CheckCircle, Trash2, Play, Route, Download,
  Truck, ArrowLeft, ArrowRight, Home, Wrench, Flag
} from 'lucide-react';
import { assignmentsApi, type ScheduleDay, type Assignment, type Request } from '../api';
import { calculateRouteSheet, exportRouteSheetToCSV, exportRouteSheetToText, exportRouteSheetToPDF, type RouteSheet } from '../hooks/useRouteCalculation';
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
  const [selectedBrigadeId, setSelectedBrigadeId] = useState<number | null>(null);
  const [showRouteSheet, setShowRouteSheet] = useState(false);

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

  // Route sheets per brigade
  const routeSheets = useMemo(() => {
    const sheets: RouteSheet[] = [];
    if (!schedule?.brigades) return sheets;
    for (const brigade of schedule.brigades) {
      const assignments = brigadeAssignments[brigade.id] || [];
      if (assignments.length > 0) {
        sheets.push(calculateRouteSheet(brigade, assignments, selectedDate));
      }
    }
    return sheets;
  }, [schedule, brigadeAssignments, selectedDate]);

  const selectedRouteSheet = useMemo(() => {
    if (!selectedBrigadeId) return null;
    return routeSheets.find((s) => s.brigade.id === selectedBrigadeId) || null;
  }, [routeSheets, selectedBrigadeId]);

  const handleExportCSV = (sheet: RouteSheet) => {
    const csv = exportRouteSheetToCSV(sheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Маршрутный_лист_${sheet.brigade.name}_${sheet.date}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Маршрутный лист экспортирован в CSV');
  };

  const handleExportText = (sheet: RouteSheet) => {
    const text = exportRouteSheetToText(sheet);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Маршрутный_лист_${sheet.brigade.name}_${sheet.date}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Маршрутный лист экспортирован в TXT');
  };

  const handleExportPDF = async (sheet: RouteSheet) => {
    await exportRouteSheetToPDF(sheet);
    toast.success('Маршрутный лист экспортирован в PDF');
  };

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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Планирование маршрутов</h1>
          <p className="text-sm text-muted-foreground mt-1">Распределение заявок по бригадам</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 hover:bg-muted rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" strokeWidth={1.5} />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2 py-1.5 bg-transparent border-0 text-sm font-medium text-foreground
                         focus:outline-none focus:ring-0"
            />
            <button
              onClick={() => changeDate(1)}
              className="p-2 hover:bg-muted rounded-md transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-foreground" strokeWidth={1.5} />
            </button>
          </div>

          <button
            onClick={() => autoPlanMutation.mutate()}
            disabled={autoPlanMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground
                       rounded-lg font-semibold text-sm shadow-sm
                       hover:bg-accent/90 active:bg-accent/95
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-150"
          >
            {autoPlanMutation.isPending ? (
              <span className="flex items-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full"
                />
                Планирование...
              </span>
            ) : (
              <>
                <Play className="w-4 h-4" strokeWidth={2} />
                Автоплан
              </>
            )}
          </button>
        </div>
      </div>

      {/* Route Sheet Modal */}
      <AnimatePresence>
        {showRouteSheet && selectedRouteSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRouteSheet(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-lg shadow-2xl
                         w-full max-w-2xl max-h-[90vh] overflow-y-auto relative"
            >
              <div className="p-6">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: selectedRouteSheet.brigade.color }}
                    >
                      <Truck className="w-5 h-5 text-white" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground tracking-tight">
                        Маршрутный лист
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedRouteSheet.brigade.name} · {formatDateRu(selectedDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExportCSV(selectedRouteSheet)}
                      className="inline-flex items-center gap-1.5 px-3 py-2
                                 text-sm font-medium text-foreground
                                 hover:bg-muted rounded-lg transition-colors"
                      title="Экспорт CSV"
                    >
                      <Download className="w-4 h-4" strokeWidth={1.5} />
                      CSV
                    </button>
                    <button
                      onClick={() => handleExportText(selectedRouteSheet)}
                      className="inline-flex items-center gap-1.5 px-3 py-2
                                 text-sm font-medium text-foreground
                                 hover:bg-muted rounded-lg transition-colors"
                      title="Экспорт TXT"
                    >
                      <FileText className="w-4 h-4" strokeWidth={1.5} />
                      TXT
                    </button>
                    <button
                      onClick={() => handleExportPDF(selectedRouteSheet)}
                      className="inline-flex items-center gap-1.5 px-3 py-2
                                 text-sm font-medium text-foreground
                                 hover:bg-muted rounded-lg transition-colors"
                      title="Экспорт PDF"
                    >
                      <FileText className="w-4 h-4" strokeWidth={1.5} />
                      PDF
                    </button>
                    <button
                      onClick={() => setShowRouteSheet(false)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Выезд</p>
                    <p className="text-base font-bold text-foreground">{selectedRouteSheet.departureTime}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Возврат</p>
                    <p className="text-base font-bold text-foreground">{selectedRouteSheet.returnTime}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Работа</p>
                    <p className="text-base font-bold text-foreground">{Math.floor(selectedRouteSheet.totalWorkTime / 60)}ч {selectedRouteSheet.totalWorkTime % 60}м</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">В пути</p>
                    <p className="text-base font-bold text-foreground">{selectedRouteSheet.totalTravelTime} мин</p>
                  </div>
                </div>

                {selectedRouteSheet.warning && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-6 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span className="text-sm text-destructive font-medium">{selectedRouteSheet.warning}</span>
                  </div>
                )}

                {/* Timeline */}
                <div className="space-y-1">
                  {selectedRouteSheet.points.map((point, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      {/* Timeline connector */}
                      <div className="flex flex-col items-center shrink-0">
                        <div
                          className={`w-8 h-8 rounded-md flex items-center justify-center ${
                            point.type === 'departure'
                              ? 'bg-primary text-primary-foreground'
                              : point.type === 'return'
                              ? 'bg-primary text-primary-foreground'
                              : point.type === 'travel'
                              ? 'bg-muted text-muted-foreground'
                              : point.type === 'arrival'
                              ? 'bg-accent text-accent-foreground'
                              : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {point.type === 'departure' && <Home className="w-4 h-4" strokeWidth={1.5} />}
                          {point.type === 'return' && <Home className="w-4 h-4" strokeWidth={1.5} />}
                          {point.type === 'travel' && <ArrowRight className="w-4 h-4" strokeWidth={1.5} />}
                          {point.type === 'arrival' && <Flag className="w-4 h-4" strokeWidth={1.5} />}
                          {point.type === 'work' && <Wrench className="w-4 h-4" strokeWidth={1.5} />}
                        </div>
                        {idx < selectedRouteSheet.points.length - 1 && (
                          <div className="w-px h-4 bg-border mt-1" />
                        )}
                      </div>

                      <div className="flex-1 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{point.time}</span>
                          <span className="text-sm font-medium text-muted-foreground">{point.label}</span>
                          {point.duration > 0 && (
                            <span className="text-xs text-muted-foreground">({point.duration} мин)</span>
                          )}
                        </div>
                        {point.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">{point.description}</p>
                        )}
                        {point.client && point.type === 'arrival' && (
                          <p className="text-xs text-muted-foreground mt-0.5">Клиент: {point.client}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" strokeWidth={1.5} />
            <h2 className="text-base font-bold text-foreground">
              Расписание на {formatDateRu(selectedDate)}
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Time Header */}
            <div className="flex border-b border-border bg-muted/30">
              <div className="w-56 p-4 text-sm font-semibold text-foreground border-r border-border flex-shrink-0">
                Бригада
              </div>
              <div className="flex-1 flex">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 p-3 text-center text-xs text-muted-foreground border-r border-border last:border-r-0"
                  >
                    {hour}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Brigade Rows */}
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader text="Загрузка расписания..." />
              </div>
            ) : brigades.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Нет бригад для отображения</div>
            ) : (
              brigades.map((brigade, idx) => {
                const items = brigadeAssignments[brigade.id] || [];
                const routeSheet = routeSheets.find((s) => s.brigade.id === brigade.id);
                return (
                  <motion.div
                    key={brigade.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.3 }}
                    className="flex border-b border-border hover:bg-muted/20 transition-colors"
                  >
                    <div className="w-56 p-3 border-r border-border flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                          style={{ backgroundColor: brigade.color }}
                        >
                          <Truck className="w-4 h-4 text-white" strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">{brigade.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{brigade.license_plate}</div>
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1.5 truncate">{brigade.qualification}</div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            brigade.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : brigade.status === 'on_route'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {brigade.status === 'active'
                            ? 'Готова'
                            : brigade.status === 'on_route'
                            ? 'На маршруте'
                            : 'Неактивна'}
                        </span>
                        {routeSheet && (
                          <button
                            onClick={() => {
                              setSelectedBrigadeId(brigade.id);
                              setShowRouteSheet(true);
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]
                                       font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            <Route className="w-3 h-3" strokeWidth={1.5} />
                            Маршрут
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Timeline area drop target */}
                    <div
                      className="flex-1 relative h-24"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, brigade.id)}
                    >
                      {/* Hour divisions */}
                      {HOURS.map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-r border-border/40"
                          style={{
                            left: `${(i / HOURS.length) * 100}%`,
                            width: `${100 / HOURS.length}%`,
                          }}
                        />
                      ))}

                      {/* Drag hint */}
                      {draggedRequest && (
                        <div className="absolute inset-0 bg-primary/[0.03] border-2 border-dashed border-primary/20 flex items-center justify-center pointer-events-none">
                          <span className="text-xs text-primary font-medium">Перетащите сюда</span>
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
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.01, zIndex: 10 }}
                            className={`absolute top-1 bottom-1 rounded-md shadow-sm cursor-pointer group ${getStatusColor(
                              a.status
                            )}`}
                            style={{
                              left: `${left}%`,
                              width: `${Math.max(2, width)}%`,
                            }}
                          >
                            <div className="h-full flex flex-col justify-center px-2 text-white overflow-hidden">
                              <div className="font-medium text-[11px] truncate">{a.work_type}</div>
                              <div className="text-[10px] opacity-90 truncate flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={1.5} />
                                {a.address}
                              </div>
                              <div className="text-[10px] opacity-75 flex items-center gap-0.5 mt-0.5">
                                <Clock className="w-2.5 h-2.5" strokeWidth={1.5} />
                                {start.h.toString().padStart(2, '0')}:{start.m.toString().padStart(2, '0')} -
                                {end.h.toString().padStart(2, '0')}:{end.m.toString().padStart(2, '0')}
                              </div>
                            </div>

                            {/* Hover actions */}
                            <div className="absolute top-1 right-1 hidden group-hover:flex items-center">
                              <button
                                onClick={() => handleDeleteAssignment(a.id)}
                                className="p-1 bg-white/20 hover:bg-white/40 rounded text-white"
                                title="Отменить назначение"
                              >
                                <Trash2 className="w-3 h-3" strokeWidth={1.5} />
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
        <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-purple-500"></div>
            <span className="text-muted-foreground">Запланировано</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="text-muted-foreground">В процессе</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-muted-foreground">Завершено</span>
          </div>
        </div>
      </div>

      {/* Route Sheets Summary */}
      {routeSheets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-foreground">Маршрутные листы</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {routeSheets.map((sheet) => (
              <div
                key={sheet.brigade.id}
                className={`bg-card border rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer ${
                  sheet.isFeasible ? 'border-border' : 'border-destructive/50'
                }`}
                onClick={() => {
                  setSelectedBrigadeId(sheet.brigade.id);
                  setShowRouteSheet(true);
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: sheet.brigade.color }}
                  >
                    <Truck className="w-4 h-4 text-white" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{sheet.brigade.name}</div>
                    <div className="text-[11px] text-muted-foreground">{sheet.brigade.license_plate}</div>
                  </div>
                  {!sheet.isFeasible && (
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 ml-auto" strokeWidth={1.5} />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-muted/40 rounded-md p-2">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Выезд</p>
                    <p className="text-sm font-bold text-foreground">{sheet.departureTime}</p>
                  </div>
                  <div className="bg-muted/40 rounded-md p-2">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Возврат</p>
                    <p className={`text-sm font-bold ${sheet.isFeasible ? 'text-foreground' : 'text-destructive'}`}>
                      {sheet.returnTime}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{sheet.points.filter((p) => p.type === 'work').length} объектов</span>
                  <span>{Math.floor(sheet.totalWorkTime / 60)}ч работы</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-blue-500/[0.06] border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{totalAssignments}</div>
              <div className="text-xs text-muted-foreground">Назначений на день</div>
            </div>
          </div>
        </div>

        <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-emerald-600" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{utilization}%</div>
              <div className="text-xs text-muted-foreground">Загрузка бригад</div>
            </div>
          </div>
        </div>

        <div className="bg-orange-500/[0.06] border border-orange-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-orange-500/10 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-orange-600" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{unassigned.length}</div>
              <div className="text-xs text-muted-foreground">Не распределено</div>
            </div>
          </div>
        </div>
      </div>

      {/* Unassigned Requests Toggle */}
      <div className="flex justify-center">
        <button
          onClick={() => setShowRequests((s) => !s)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-card border border-border
                     rounded-lg font-semibold text-sm text-foreground
                     hover:bg-muted transition-colors duration-150"
        >
          <FileText className="w-4 h-4 text-primary" strokeWidth={1.5} />
          {showRequests ? 'Скрыть заявки' : 'Нераспределённые заявки'}
          {unassigned.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-destructive/10 text-destructive rounded-full text-xs font-medium">
              {unassigned.length}
            </span>
          )}
        </button>
      </div>

      {/* Unassigned Requests Panel */}
      <AnimatePresence>
        {showRequests && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-lg overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                Нераспределённые заявки на {formatDateRu(selectedDate)}
              </h3>
              <button
                onClick={() => setShowRequests(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              </button>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader text="Загрузка..." />
              </div>
            ) : unassigned.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Все заявки распределены ✅</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Клиент / Адрес</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Тип работ</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Приоритет</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Время</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Длит.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Действие</th>
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
                          <div className="flex flex-wrap gap-1">
                            {brigades.map((b) => (
                              <button
                                key={b.id}
                                onClick={() => handleQuickAssign(req, b.id)}
                                disabled={createAssignmentMutation.isPending}
                                className="px-2 py-1 text-[11px] bg-primary/10 text-primary hover:bg-primary/20
                                           rounded border border-primary/20 transition-colors disabled:opacity-50"
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
