import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Truck, Users as UsersIcon, X, CheckCircle, Circle, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { brigadesApi, type Brigade, type CreateBrigadeData, type UpdateBrigadeData } from '../api';
import { Loader, SkeletonCard, SkeletonStats } from '../components/ui/loader';
import { toast } from 'sonner';

const qualificationOptions = [
  'Сантехнические работы',
  'Электротехнические работы',
  'Универсальные работы',
  'Строительные работы',
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return {
        base: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
        label: 'Готова к работе',
      };
    case 'on_route':
      return {
        base: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500',
        label: 'На маршруте',
      };
    case 'inactive':
      return {
        base: 'bg-slate-100 text-slate-600 border-slate-200',
        dot: 'bg-slate-400',
        label: 'Неактивна',
      };
    default:
      return {
        base: 'bg-slate-100 text-slate-600 border-slate-200',
        dot: 'bg-slate-400',
        label: status,
      };
  }
};

const filterOptions = [
  { value: 'all', label: 'Все бригады', icon: Truck },
  { value: 'active', label: 'Готовы к работе', icon: CheckCircle },
  { value: 'on_route', label: 'На маршруте', icon: Circle },
  { value: 'inactive', label: 'Неактивные', icon: Circle },
];

export function Brigades() {
  const queryClient = useQueryClient();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingBrigade, setEditingBrigade] = useState<Brigade | null>(null);
  const [deletingBrigade, setDeletingBrigade] = useState<Brigade | null>(null);

  // Raw strings for specialist editing
  const [createSpecialistsRaw, setCreateSpecialistsRaw] = useState('');
  const [editSpecialistsRaw, setEditSpecialistsRaw] = useState('');

  const [createForm, setCreateForm] = useState<CreateBrigadeData>({
    name: '', qualification: '', carModel: '', licensePlate: '',
    specialists: [], status: 'active', color: '#2563eb',
  });
  const [editForm, setEditForm] = useState<UpdateBrigadeData>({});

  const { data: brigades = [], isLoading: isLoadingBrigades } = useQuery({
    queryKey: ['brigades', selectedFilter],
    queryFn: () => brigadesApi.getAll(selectedFilter),
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['brigades-stats'],
    queryFn: () => brigadesApi.getStats(),
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateBrigadeData) => {
      if (createSpecialistsRaw.trim()) {
        data.specialists = createSpecialistsRaw.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return brigadesApi.create(data);
    },
    onSuccess: () => {
      toast.success('Бригада успешно создана');
      queryClient.invalidateQueries({ queryKey: ['brigades'] });
      queryClient.invalidateQueries({ queryKey: ['brigades-stats'] });
      setIsCreateModalOpen(false);
      resetCreateForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Ошибка создания бригады');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateBrigadeData }) => {
      if (editSpecialistsRaw.trim()) {
        data.specialists = editSpecialistsRaw.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return brigadesApi.update(id, data);
    },
    onSuccess: () => {
      toast.success('Бригада успешно обновлена');
      queryClient.invalidateQueries({ queryKey: ['brigades'] });
      queryClient.invalidateQueries({ queryKey: ['brigades-stats'] });
      setIsEditModalOpen(false);
      setEditingBrigade(null);
      setEditSpecialistsRaw('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Ошибка обновления бригады');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => brigadesApi.delete(id),
    onSuccess: () => {
      toast.success('Бригада успешно удалена');
      queryClient.invalidateQueries({ queryKey: ['brigades'] });
      queryClient.invalidateQueries({ queryKey: ['brigades-stats'] });
      setIsDeleteModalOpen(false);
      setDeletingBrigade(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Ошибка удаления бригады');
    },
  });

  const resetCreateForm = useCallback(() => {
    setCreateForm({
      name: '', qualification: '', carModel: '', licensePlate: '',
      specialists: [], status: 'active', color: '#2563eb',
    });
    setCreateSpecialistsRaw('');
  }, []);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.qualification || !createForm.carModel || !createForm.licensePlate) {
      toast.error('Заполните все обязательные поля');
      return;
    }
    const data = { ...createForm };
    if (createSpecialistsRaw.trim()) {
      data.specialists = createSpecialistsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    }
    createMutation.mutate(data);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrigade) return;
    const data = { ...editForm };
    if (editSpecialistsRaw.trim()) {
      data.specialists = editSpecialistsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    }
    updateMutation.mutate({ id: editingBrigade.id, data });
  };

  const handleEditClick = useCallback((brigade: Brigade) => {
    setEditingBrigade(brigade);
    setEditForm({
      name: brigade.name,
      qualification: brigade.qualification,
      carModel: brigade.car_model,
      licensePlate: brigade.license_plate,
      specialists: brigade.specialists || [],
      status: brigade.status,
      color: brigade.color,
    });
    setEditSpecialistsRaw(brigade.specialists?.join(', ') || '');
    setIsEditModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((brigade: Brigade) => {
    setDeletingBrigade(brigade);
    setIsDeleteModalOpen(true);
  }, []);

  const handleDeleteConfirm = () => {
    if (!deletingBrigade) return;
    deleteMutation.mutate(deletingBrigade.id);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Управление бригадами</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoadingStats ? 'Загрузка...' : `Всего бригад: ${stats?.total || 0}`}
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground
                     rounded-lg font-semibold text-sm shadow-sm
                     hover:bg-primary/90 active:bg-primary/95
                     transition-all duration-150 shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Добавить бригаду
        </button>
      </div>

      {/* Stats Filter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoadingStats ? (
          <SkeletonStats />
        ) : (
          filterOptions.map((filter) => {
            const isSelected = selectedFilter === filter.value;
            const count =
              filter.value === 'all'
                ? Number(stats?.total || 0)
                : filter.value === 'active'
                ? Number(stats?.active || 0)
                : filter.value === 'on_route'
                ? Number(stats?.on_route || 0)
                : Number(stats?.inactive || 0);
            return (
              <button
                key={filter.value}
                onClick={() => setSelectedFilter(filter.value)}
                className={`
                  relative rounded-lg border p-4 text-left transition-all duration-150
                  cursor-pointer outline-none group
                  ${isSelected
                    ? 'border-primary bg-primary/[0.04] ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-primary/30 hover:bg-primary/[0.02]'
                  }
                `}
              >
                <input
                  type="radio"
                  name="brigade-filter"
                  value={filter.value}
                  checked={isSelected}
                  onChange={() => setSelectedFilter(filter.value)}
                  className="sr-only"
                />
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`
                      w-8 h-8 rounded-md flex items-center justify-center shrink-0
                      transition-colors duration-150
                      ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-foreground'}
                    `}
                  >
                    <filter.icon className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-primary ml-auto" />
                  )}
                </div>
                <div className="text-2xl font-bold text-foreground tracking-tight">{count}</div>
                <div className="text-xs text-muted-foreground font-medium mt-0.5">{filter.label}</div>
              </button>
            );
          })
        )}
      </div>

      {/* Content */}
      {isLoadingBrigades ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : brigades.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center mx-auto mb-4">
            <Truck className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Бригады не найдены</h3>
          <p className="text-sm text-muted-foreground mb-6">Создайте первую бригаду для начала работы</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground
                       rounded-lg font-semibold text-sm shadow-sm
                       hover:bg-primary/90 transition-all duration-150"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Добавить бригаду
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {brigades.map((brigade: Brigade) => {
              const status = getStatusBadge(brigade.status);
              return (
                <motion.div
                  key={brigade.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-card border border-border rounded-lg p-5
                             hover:shadow-md hover:-translate-y-0.5
                             transition-all duration-200 group"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: brigade.color }}
                      >
                        <Truck className="w-5 h-5 text-white" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-foreground truncate">{brigade.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">{brigade.qualification}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0 ${status.base}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 p-2.5 bg-muted/40 rounded-md">
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${brigade.color}15` }}
                      >
                        <Truck className="w-3.5 h-3.5" style={{ color: brigade.color }} strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{brigade.car_model}</div>
                        <div className="text-xs text-muted-foreground">{brigade.license_plate}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-2.5 bg-muted/40 rounded-md">
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${brigade.color}15` }}
                      >
                        <UsersIcon className="w-3.5 h-3.5" style={{ color: brigade.color }} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground mb-1.5">
                          Состав бригады
                          <span className="text-muted-foreground font-normal"> — {brigade.specialists?.length || 0} чел.</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {brigade.specialists && brigade.specialists.length > 0 ? (
                            brigade.specialists.map((specialist, i) => (
                              <span
                                key={i}
                                className="text-[11px] px-2 py-0.5 rounded border font-medium"
                                style={{
                                  backgroundColor: `${brigade.color}10`,
                                  borderColor: `${brigade.color}25`,
                                  color: brigade.color,
                                }}
                              >
                                {specialist}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">Нет специалистов</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                    <button
                      onClick={() => handleEditClick(brigade)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2
                                 text-sm font-medium text-foreground
                                 hover:bg-muted rounded-md transition-colors duration-150"
                    >
                      <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDeleteClick(brigade)}
                      className="inline-flex items-center justify-center px-3 py-2
                                 text-sm font-medium text-destructive
                                 hover:bg-destructive/10 rounded-md transition-colors duration-150"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/**** Create Modal ****/}
      <AnimatePresence>
        {isCreateModalOpen && (
          <Modal onClose={() => { setIsCreateModalOpen(false); resetCreateForm(); }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                <Plus className="w-4 h-4 text-primary-foreground" strokeWidth={2} />
              </div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">Новая бригада</h2>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <FormField label="Название бригады" required>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="input-field"
                  placeholder="Бригада №6 (Сантехники)"
                />
              </FormField>

              <FormField label="Квалификация" required>
                <select
                  required
                  value={createForm.qualification}
                  onChange={(e) => setCreateForm({ ...createForm, qualification: e.target.value })}
                  className="input-field"
                >
                  <option value="">Выберите квалификацию</option>
                  {qualificationOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Модель авто" required>
                  <input
                    type="text"
                    required
                    value={createForm.carModel}
                    onChange={(e) => setCreateForm({ ...createForm, carModel: e.target.value })}
                    className="input-field"
                    placeholder="ГАЗель Next"
                  />
                </FormField>
                <FormField label="Гос. номер" required>
                  <input
                    type="text"
                    required
                    value={createForm.licensePlate}
                    onChange={(e) => setCreateForm({ ...createForm, licensePlate: e.target.value })}
                    className="input-field"
                    placeholder="А123ВС63"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Цвет на карте">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={createForm.color}
                      onChange={(e) => setCreateForm({ ...createForm, color: e.target.value })}
                      className="w-10 h-10 rounded-md cursor-pointer border-0 p-0 overflow-hidden"
                    />
                    <span className="text-sm text-muted-foreground font-mono">{createForm.color}</span>
                  </div>
                </FormField>

                <FormField label="Статус">
                  <select
                    value={createForm.status}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        status: e.target.value as 'active' | 'on_route' | 'inactive',
                      })
                    }
                    className="input-field"
                  >
                    <option value="active">Активна</option>
                    <option value="on_route">На маршруте</option>
                    <option value="inactive">Неактивна</option>
                  </select>
                </FormField>
              </div>

              <FormField label="Состав бригады (ФИО через запятую)">
                <input
                  type="text"
                  value={createSpecialistsRaw}
                  onChange={(e) => setCreateSpecialistsRaw(e.target.value)}
                  className="input-field"
                  placeholder="Иванов И.И., Петров П.П., Сидоров С.С."
                />
              </FormField>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); resetCreateForm(); }}
                  className="flex-1 px-5 py-2.5 border border-border rounded-lg
                             font-semibold text-sm text-foreground
                             hover:bg-muted transition-colors duration-150"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 px-5 py-2.5 bg-primary text-primary-foreground
                             rounded-lg font-semibold text-sm shadow-sm
                             hover:bg-primary/90 active:bg-primary/95
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-all duration-150
                             inline-flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? (
                    <Loader text="Создание..." />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" strokeWidth={2} />
                      Создать
                    </>
                  )}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/**** Edit Modal ****/}
      <AnimatePresence>
        {isEditModalOpen && editingBrigade && (
          <Modal onClose={() => { setIsEditModalOpen(false); setEditingBrigade(null); }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                <Pencil className="w-4 h-4 text-primary-foreground" strokeWidth={2} />
              </div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">Редактировать бригаду</h2>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <FormField label="Название бригады">
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input-field"
                />
              </FormField>

              <FormField label="Квалификация">
                <select
                  value={editForm.qualification || ''}
                  onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })}
                  className="input-field"
                >
                  <option value="">Выберите квалификацию</option>
                  {qualificationOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Модель авто">
                  <input
                    type="text"
                    value={editForm.carModel || ''}
                    onChange={(e) => setEditForm({ ...editForm, carModel: e.target.value })}
                    className="input-field"
                  />
                </FormField>
                <FormField label="Гос. номер">
                  <input
                    type="text"
                    value={editForm.licensePlate || ''}
                    onChange={(e) => setEditForm({ ...editForm, licensePlate: e.target.value })}
                    className="input-field"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Цвет на карте">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={editForm.color || '#2563eb'}
                      onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                      className="w-10 h-10 rounded-md cursor-pointer border-0 p-0 overflow-hidden"
                    />
                    <span className="text-sm text-muted-foreground font-mono">{editForm.color || '#2563eb'}</span>
                  </div>
                </FormField>

                <FormField label="Статус">
                  <select
                    value={editForm.status || 'active'}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        status: e.target.value as 'active' | 'on_route' | 'inactive',
                      })
                    }
                    className="input-field"
                  >
                    <option value="active">Активна</option>
                    <option value="on_route">На маршруте</option>
                    <option value="inactive">Неактивна</option>
                  </select>
                </FormField>
              </div>

              <FormField label="Состав бригады (ФИО через запятую)">
                <input
                  type="text"
                  value={editSpecialistsRaw}
                  onChange={(e) => setEditSpecialistsRaw(e.target.value)}
                  className="input-field"
                  placeholder="Иванов И.И., Петров П.П."
                />
              </FormField>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditingBrigade(null); }}
                  className="flex-1 px-5 py-2.5 border border-border rounded-lg
                             font-semibold text-sm text-foreground
                             hover:bg-muted transition-colors duration-150"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 px-5 py-2.5 bg-primary text-primary-foreground
                             rounded-lg font-semibold text-sm shadow-sm
                             hover:bg-primary/90 active:bg-primary/95
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-all duration-150
                             inline-flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? (
                    <Loader text="Сохранение..." />
                  ) : (
                    <>
                      <Pencil className="w-4 h-4" strokeWidth={2} />
                      Сохранить
                    </>
                  )}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/**** Delete Modal ****/}
      <AnimatePresence>
        {isDeleteModalOpen && deletingBrigade && (
          <Modal onClose={() => { setIsDeleteModalOpen(false); setDeletingBrigade(null); }}>
            <div className="text-center">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-2">Удалить бригаду?</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Вы действительно хотите удалить бригаду
                <strong className="text-foreground"> «{deletingBrigade.name}»</strong>?
                <br />
                Это действие нельзя отменить.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setIsDeleteModalOpen(false); setDeletingBrigade(null); }}
                  className="flex-1 px-5 py-2.5 border border-border rounded-lg
                             font-semibold text-sm text-foreground
                             hover:bg-muted transition-colors duration-150"
                >
                  Отмена
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-5 py-2.5 bg-destructive text-white
                             rounded-lg font-semibold text-sm shadow-sm
                             hover:bg-destructive/90 active:bg-destructive/95
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-all duration-150
                             inline-flex items-center justify-center gap-2"
                >
                  {deleteMutation.isPending ? (
                    <Loader text="Удаление..." />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" strokeWidth={2} />
                      Удалить
                    </>
                  )}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────── Shared Components ────────── */

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-lg shadow-xl
                   w-full max-w-lg max-h-[90vh] overflow-y-auto relative"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-muted-foreground
                     hover:text-foreground hover:bg-muted rounded-md transition-colors"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function FormField({
  children,
  label,
  required,
}: {
  children: React.ReactNode;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold text-foreground uppercase tracking-wider">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// Input field styles are defined in theme.css via @layer components
