import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Truck, Users as UsersIcon, X, CheckCircle, Circle, Pencil, Trash2, Route, AlertTriangle } from 'lucide-react';
import { brigadesApi, type Brigade, type CreateBrigadeData, type UpdateBrigadeData } from '../api';
import { Loader, SkeletonCard, SkeletonStats } from '../components/ui/loader';
import { toast } from 'sonner';

const qualificationOptions = [
  'Сантехнические работы',
  'Электротехнические работы',
  'Универсальные работы',
  'Строительные работы',
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'on_route': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'inactive': return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'active': return 'Готова к работе';
    case 'on_route': return 'На маршруте';
    case 'inactive': return 'Неактивна';
    default: return status;
  }
};

const filterOptions = [
  { value: 'all', label: 'Все бригады', icon: Truck, color: 'from-blue-500 to-blue-600', ring: 'ring-blue-500/50' },
  { value: 'active', label: 'Готовы к работе', icon: CheckCircle, color: 'from-green-500 to-green-600', ring: 'ring-green-500/50' },
  { value: 'on_route', label: 'На маршруте', icon: Circle, color: 'from-purple-500 to-purple-600', ring: 'ring-purple-500/50' },
  { value: 'inactive', label: 'Неактивные', icon: Circle, color: 'from-gray-500 to-gray-600', ring: 'ring-gray-500/50' },
];

export function Brigades() {
  const queryClient = useQueryClient();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingBrigade, setEditingBrigade] = useState<Brigade | null>(null);
  const [deletingBrigade, setDeletingBrigade] = useState<Brigade | null>(null);

  // Raw strings for specialist editing (fixes comma issue #1)
  const [createSpecialistsRaw, setCreateSpecialistsRaw] = useState('');
  const [editSpecialistsRaw, setEditSpecialistsRaw] = useState('');

  const [createForm, setCreateForm] = useState<CreateBrigadeData>({
    name: '', qualification: '', carModel: '', licensePlate: '',
    specialists: [], status: 'active', color: '#3b82f6',
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
      // Parse specialists from string to array before sending
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
      specialists: [], status: 'active', color: '#3b82f6',
    });
    setCreateSpecialistsRaw('');
  }, []);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.qualification || !createForm.carModel || !createForm.licensePlate) {
      toast.error('Заполните все обязательные поля');
      return;
    }
    // Parse specialists before mutation
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
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Управление бригадами</h1>
          <p className="text-muted-foreground">
            {isLoadingStats ? 'Загрузка...' : `Всего бригад: ${stats?.total || 0}`}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5" />
          Добавить бригаду
        </motion.button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingStats ? <SkeletonStats /> : filterOptions.map((filter) => {
          const isSelected = selectedFilter === filter.value;
          const count = filter.value === 'all' ? Number(stats?.total || 0)
            : filter.value === 'active' ? Number(stats?.active || 0)
            : filter.value === 'on_route' ? Number(stats?.on_route || 0)
            : Number(stats?.inactive || 0);
          return (
            <button key={filter.value} onClick={() => setSelectedFilter(filter.value)}
              className={`relative rounded-xl p-5 border-2 text-left transition-all duration-200 cursor-pointer outline-none
                ${isSelected ? `border-primary bg-primary/5 ${filter.ring} ring-2` : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5'}`}
            >
              <input type="radio" name="brigade-filter" value={filter.value} checked={isSelected} onChange={() => setSelectedFilter(filter.value)} className="sr-only" />
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${filter.color} flex items-center justify-center mb-3`}>
                <filter.icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">{count}</div>
              <div className="text-sm text-muted-foreground">{filter.label}</div>
              {isSelected && (<div className="absolute top-3 right-3 w-3 h-3 bg-primary rounded-full" />)}
            </button>
          );
        })}
      </div>

      {isLoadingBrigades ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2,3,4].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : brigades.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Truck className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">Бригады не найдены</h3>
          <button onClick={() => setIsCreateModalOpen(true)} className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors">
            Добавить бригаду
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {brigades.map((brigade: Brigade) => (
              <motion.div key={brigade.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: brigade.color }}>
                      <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{brigade.name}</h3>
                      <p className="text-sm text-muted-foreground">{brigade.qualification}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(brigade.status)}`}>
                    {getStatusLabel(brigade.status)}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brigade.color}33` }}>
                      <Truck className="w-4 h-4" style={{ color: brigade.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{brigade.car_model}</div>
                      <div className="text-xs text-muted-foreground">Гос. номер: {brigade.license_plate}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ backgroundColor: `${brigade.color}33` }}>
                      <UsersIcon className="w-4 h-4" style={{ color: brigade.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground mb-2">
                        Состав бригады ({brigade.specialists?.length || 0} чел.)
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {brigade.specialists && brigade.specialists.length > 0 ? (
                          brigade.specialists.map((specialist, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-md border"
                              style={{ backgroundColor: `${brigade.color}1a`, borderColor: `${brigade.color}33`, color: brigade.color }}
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

                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <button onClick={() => handleEditClick(brigade)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" /> Редактировать
                  </button>
                  <button onClick={() => handleDeleteClick(brigade)} className="px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/**** Create Modal ****/}
      <AnimatePresence>
        {isCreateModalOpen && (
          <Modal onClose={() => { setIsCreateModalOpen(false); resetCreateForm(); }}>
            <h2 className="text-2xl font-bold text-foreground mb-6">Добавить новую бригаду</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-5">
              <FormField label="Название бригады" required>
                <input type="text" required value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Бригада №6 (Сантехники)" />
              </FormField>

              <FormField label="Квалификация" required>
                <select required value={createForm.qualification}
                  onChange={(e) => setCreateForm({ ...createForm, qualification: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Выберите квалификацию</option>
                  {qualificationOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </FormField>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Модель авто" required>
                  <input type="text" required value={createForm.carModel}
                    onChange={(e) => setCreateForm({ ...createForm, carModel: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="ГАЗель Next" />
                </FormField>
                <FormField label="Гос. номер" required>
                  <input type="text" required value={createForm.licensePlate}
                    onChange={(e) => setCreateForm({ ...createForm, licensePlate: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="А123ВС63" />
                </FormField>
              </div>

              <FormField label="Цвет на карте">
                <input type="color" value={createForm.color}
                  onChange={(e) => setCreateForm({ ...createForm, color: e.target.value })}
                  className="w-full h-10 rounded-lg cursor-pointer" />
              </FormField>

              <FormField label="Состав бригады (ФИО через запятую)">
                <input type="text" value={createSpecialistsRaw}
                  onChange={(e) => setCreateSpecialistsRaw(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Иванов И.И., Петров П.П., Сидоров С.С." />
              </FormField>

              <FormField label="Статус">
                <select value={createForm.status}
                  onChange={(e) => setCreateForm({ ...createForm, status: e.target.value as 'active' | 'on_route' | 'inactive' })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="active">Активна</option>
                  <option value="on_route">На маршруте</option>
                  <option value="inactive">Неактивна</option>
                </select>
              </FormField>

              <div className="flex gap-3 pt-4">
                <button type="button"
                  onClick={() => { setIsCreateModalOpen(false); resetCreateForm(); }}
                  className="flex-1 px-6 py-3 border border-border rounded-lg font-medium text-foreground hover:bg-muted transition-colors"
                >Отмена</button>
                <button type="submit" disabled={createMutation.isPending}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? (
                    <Loader text="Создание..." />
                  ) : (
                    <><Plus className="w-5 h-5" /> Создать бригаду</>
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
            <h2 className="text-2xl font-bold text-foreground mb-6">Редактировать бригаду</h2>
            <form onSubmit={handleEditSubmit} className="space-y-5">
              <FormField label="Название бригады">
                <input type="text" value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              </FormField>

              <FormField label="Квалификация">
                <select value={editForm.qualification || ''}
                  onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Выберите квалификацию</option>
                  {qualificationOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </FormField>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Модель авто">
                  <input type="text" value={editForm.carModel || ''}
                    onChange={(e) => setEditForm({ ...editForm, carModel: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
                </FormField>
                <FormField label="Гос. номер">
                  <input type="text" value={editForm.licensePlate || ''}
                    onChange={(e) => setEditForm({ ...editForm, licensePlate: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
                </FormField>
              </div>

              <FormField label="Цвет на карте">
                <input type="color" value={editForm.color || '#3b82f6'}
                  onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                  className="w-full h-10 rounded-lg cursor-pointer" />
              </FormField>

              <FormField label="Состав бригады (ФИО через запятую)">
                <input type="text" value={editSpecialistsRaw}
                  onChange={(e) => setEditSpecialistsRaw(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Иванов И.И., Петров П.П." />
              </FormField>

              <FormField label="Статус">
                <select value={editForm.status || 'active'}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'active' | 'on_route' | 'inactive' })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="active">Активна</option>
                  <option value="on_route">На маршруте</option>
                  <option value="inactive">Неактивна</option>
                </select>
              </FormField>

              <div className="flex gap-3 pt-4">
                <button type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditingBrigade(null); }}
                  className="flex-1 px-6 py-3 border border-border rounded-lg font-medium text-foreground hover:bg-muted transition-colors"
                >Отмена</button>
                <button type="submit" disabled={updateMutation.isPending}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? (
                    <Loader text="Сохранение..." />
                  ) : (
                    <><Pencil className="w-5 h-5" /> Сохранить</>
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
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Удалить бригаду?</h2>
              <p className="text-muted-foreground mb-6">
                Вы действительно хотите удалить бригаду <strong>«{deletingBrigade.name}»</strong>?<br />
                Это действие нельзя отменить.
              </p>
              <div className="flex gap-3">
                <button onClick={() => { setIsDeleteModalOpen(false); setDeletingBrigade(null); }}
                  className="flex-1 px-6 py-3 border border-border rounded-lg font-medium text-foreground hover:bg-muted transition-colors"
                >Отмена</button>
                <button onClick={handleDeleteConfirm} disabled={deleteMutation.isPending}
                  className="flex-1 px-6 py-3 bg-destructive text-white rounded-lg font-medium hover:bg-destructive/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteMutation.isPending ? (
                    <Loader text="Удаление..." />
                  ) : (
                    <><Trash2 className="w-5 h-5" /> Удалить</>
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

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}
    >
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-muted rounded-lg transition-colors">
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}

function FormField({ children, label, required }: { children: React.ReactNode; label: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
