import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Search, MapPin, Phone, Clock, AlertCircle, X, Calendar as CalendarIcon, Pencil, Trash2, AlertTriangle
} from 'lucide-react';
import { requestsApi, brigadesApi, type Request, type CreateRequestData, type UpdateRequestData, type Brigade } from '../api';
import { Loader, SkeletonCard } from '../components/ui/loader';
import { toast } from 'sonner';
import { AddressAutocomplete } from '../components/ui/address-autocomplete';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'new': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'assigned': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    case 'in_progress': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'completed': return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'cancelled': return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'new': return 'Новая';
    case 'assigned': return 'Назначена';
    case 'in_progress': return 'В работе';
    case 'completed': return 'Выполнена';
    case 'cancelled': return 'Отменена';
    default: return status;
  }
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

const emptyForm: CreateRequestData = {
  address: '',
  coordinates: undefined,
  workType: '',
  client: '',
  phone: '',
  desiredDatetime: '',
  plannedDuration: 60,
  priority: 'medium',
  description: '',
};

export function Requests() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<Request | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRequest, setDeletingRequest] = useState<Request | null>(null);

  const [formData, setFormData] = useState<CreateRequestData>({ ...emptyForm });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['requests', statusFilter, priorityFilter],
    queryFn: () => requestsApi.getAll({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      priority: priorityFilter !== 'all' ? priorityFilter : undefined,
    }),
  });

  const { data: brigades = [] } = useQuery({
    queryKey: ['brigades-qualifications'],
    queryFn: () => brigadesApi.getAll(),
  });

  // Build unique qualifications list from brigades
  const qualificationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const b of brigades) {
      if (b.qualification) set.add(b.qualification);
    }
    return Array.from(set).sort();
  }, [brigades]);

  const createMutation = useMutation({
    mutationFn: requestsApi.create,
    onSuccess: () => {
      toast.success('Заявка успешно создана');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Ошибка создания заявки');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateRequestData }) => requestsApi.update(id, data),
    onSuccess: () => {
      toast.success('Заявка успешно обновлена');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Ошибка обновления заявки');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: requestsApi.delete,
    onSuccess: () => {
      toast.success('Заявка удалена');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      setIsDeleteModalOpen(false);
      setDeletingRequest(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Ошибка удаления заявки');
    },
  });

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingRequest(null);
    setFormData({ ...emptyForm });
  }, []);

  const openCreate = useCallback(() => {
    setEditingRequest(null);
    setFormData({ ...emptyForm });
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((req: Request) => {
    setEditingRequest(req);
    // datetime-local expects YYYY-MM-DDTHH:mm (local machine time)
    // Extract from ISO directly without new Date() to avoid timezone shifts
    let dtValue = '';
    if (req.desired_datetime) {
      const iso = req.desired_datetime;
      const hasZone = iso.match(/[+-]\d{2}:\d{2}$/); // +00:00, -03:00, etc.
      if (hasZone || iso.endsWith('Z')) {
        // It's a real ISO timestamp; convert to local YYYY-MM-DDTHH:mm
        const d = new Date(iso);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        dtValue = `${y}-${m}-${day}T${h}:${min}`;
      } else {
        // Probably already YYYY-MM-DDTHH:mm:ss or similar without zone
        dtValue = iso.slice(0, 16);
      }
    }
    setFormData({
      address: req.address,
      coordinates: req.coordinates ?? undefined,
      workType: req.work_type,
      client: req.client,
      phone: req.phone || '',
      desiredDatetime: dtValue,
      plannedDuration: req.planned_duration,
      priority: req.priority,
      description: req.description || '',
    });
    setModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((req: Request) => {
    setDeletingRequest(req);
    setIsDeleteModalOpen(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.address || !formData.workType || !formData.client) {
      toast.error('Заполните все обязательные поля');
      return;
    }
    // Отправляем desiredDatetime как YYYY-MM-DDTHH:mm — backend parseLocalDateTime
    // парсит это как wall-clock время (без timezone shifts)
    const payload: CreateRequestData = {
      ...formData,
      desiredDatetime: formData.desiredDatetime
        ? `${formData.desiredDatetime}:00`
        : undefined,
    };
    if (editingRequest) {
      const data: UpdateRequestData = { ...payload };
      updateMutation.mutate({ id: editingRequest.id, data });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredRequests = requests.filter((req) => {
    const sq = searchQuery.toLowerCase();
    const matchesSearch =
      req.address.toLowerCase().includes(sq) ||
      req.client.toLowerCase().includes(sq) ||
      req.work_type.toLowerCase().includes(sq);
    return matchesSearch;
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Управление заявками</h1>
          <p className="text-muted-foreground">
            {isLoading ? 'Загрузка...' : `Всего заявок: ${filteredRequests.length} из ${requests.length}`}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={openCreate}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5" />
          Создать заявку
        </motion.button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Поиск по адресу, клиенту, типу работ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Все статусы</option>
              <option value="new">Новые</option>
              <option value="assigned">Назначенные</option>
              <option value="in_progress">В работе</option>
              <option value="completed">Выполненные</option>
              <option value="cancelled">Отмененные</option>
            </select>
          </div>
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Все приоритеты</option>
              <option value="urgent">Срочные</option>
              <option value="high">Высокий</option>
              <option value="medium">Средний</option>
              <option value="low">Низкий</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Клиент</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Адрес</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Тип работ</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Приоритет</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Статус</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Время</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Бригада</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">Загрузка...</td></tr>
              ) : filteredRequests.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">Заявки не найдены</td></tr>
              ) : (
                filteredRequests.map((req, idx) => (
                  <motion.tr
                    key={req.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-foreground">#{req.id}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-foreground">{req.client}</div>
                      {req.phone && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {req.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-foreground flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="max-w-xs truncate">{req.address}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-foreground">{req.work_type}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {req.planned_duration} мин
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-1 text-sm font-medium ${getPriorityColor(req.priority)}`}>
                        {req.priority === 'urgent' && <AlertCircle className="w-4 h-4" />}
                        {getPriorityLabel(req.priority)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(req.status)}`}>
                        {getStatusLabel(req.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {req.desired_datetime
                        ? new Date(req.desired_datetime).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {req.assigned_brigade_name || (req.assigned_brigade ? `Бригада #${req.assigned_brigade}` : '-')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(req)}
                          className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(req)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Request Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">
                  {editingRequest ? 'Редактировать заявку' : 'Создать новую заявку'}
                </h2>
                <button onClick={closeModal} className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">Клиент</label>
                    <input
                      type="text"
                      required
                      value={formData.client}
                      onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Иванов И.И."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Телефон</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="+7 927 123-45-67"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Приоритет</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as CreateRequestData['priority'] })}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="low">Низкий</option>
                      <option value="medium">Средний</option>
                      <option value="high">Высокий</option>
                      <option value="urgent">Срочный</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">Адрес</label>
                    <AddressAutocomplete
                      required
                      value={formData.address}
                      onChange={(address, coordinates) =>
                        setFormData({ ...formData, address, coordinates: coordinates ?? undefined })
                      }
                      placeholder="Начните вводить адрес..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Тип работ </label>
                    <select
                      required
                      value={formData.workType}
                      onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Выберите тип работ</option>
                      {qualificationOptions.map((q) => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Длительность (мин)</label>
                    <input
                      type="number"
                      min={5}
                      required
                      value={formData.plannedDuration}
                      onChange={(e) => setFormData({ ...formData, plannedDuration: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="90"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">Желаемая дата и время</label>
                    <input
                      type="datetime-local"
                      value={formData.desiredDatetime}
                      onChange={(e) => setFormData({ ...formData, desiredDatetime: e.target.value })}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">Описание проблемы</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      placeholder="Подробное описание проблемы..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-6 py-3 border border-border rounded-lg font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isPending ? (
                      <Loader text="Сохранение..." />
                    ) : (
                      <>
                        {editingRequest ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        {editingRequest ? 'Сохранить' : 'Создать заявку'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && deletingRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsDeleteModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Удалить заявку?</h2>
                <p className="text-muted-foreground mb-6">
                  Вы действительно хотите удалить заявку <strong>«{deletingRequest.work_type} — {deletingRequest.address}»</strong>?<br />
                  Это действие нельзя отменить.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setIsDeleteModalOpen(false); setDeletingRequest(null); }}
                    className="flex-1 px-6 py-3 border border-border rounded-lg font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(deletingRequest.id)}
                    disabled={deleteMutation.isPending}
                    className="flex-1 px-6 py-3 bg-destructive text-white rounded-lg font-medium hover:bg-destructive/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleteMutation.isPending ? <Loader text="Удаление..." /> : <><Trash2 className="w-5 h-5" /> Удалить</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
