export interface Brigade {
  id: number;
  name: string;
  qualification: string;
  car: {
    id: number;
    licensePlate: string;
    model: string;
  };
  specialists: string[];
  status: 'active' | 'inactive' | 'on_route';
}

export interface Request {
  id: number;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  workType: string;
  client: string;
  phone: string;
  desiredDatetime: string;
  plannedDuration: number;
  status: 'new' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  createdAt: string;
  assignedBrigade?: number;
}

export interface Assignment {
  id: number;
  requestId: number;
  brigadeId: number;
  startTime: string;
  endTime: string;
  travelTime: number;
  status: 'scheduled' | 'in_progress' | 'completed';
}

export const mockBrigades: Brigade[] = [
  {
    id: 1,
    name: 'Бригада №1 (Сантехники)',
    qualification: 'Сантехнические работы',
    car: { id: 1, licensePlate: 'А123ВС63', model: 'ГАЗель Next' },
    specialists: ['Иванов И.И.', 'Петров П.П.'],
    status: 'active',
  },
  {
    id: 2,
    name: 'Бригада №2 (Электрики)',
    qualification: 'Электротехнические работы',
    car: { id: 2, licensePlate: 'В456ЕК63', model: 'Ford Transit' },
    specialists: ['Сидоров С.С.', 'Кузнецов К.К.', 'Васильев В.В.'],
    status: 'on_route',
  },
  {
    id: 3,
    name: 'Бригада №3 (Универсалы)',
    qualification: 'Универсальные работы',
    car: { id: 3, licensePlate: 'С789МН63', model: 'Mercedes Sprinter' },
    specialists: ['Михайлов М.М.', 'Николаев Н.Н.'],
    status: 'active',
  },
  {
    id: 4,
    name: 'Бригада №4 (Электрики)',
    qualification: 'Электротехнические работы',
    car: { id: 4, licensePlate: 'Е012ОР63', model: 'ГАЗель Next' },
    specialists: ['Александров А.А.', 'Дмитриев Д.Д.'],
    status: 'active',
  },
  {
    id: 5,
    name: 'Бригада №5 (Сантехники)',
    qualification: 'Сантехнические работы',
    car: { id: 5, licensePlate: 'К345ТУ63', model: 'Peugeot Boxer' },
    specialists: ['Андреев А.А.', 'Сергеев С.С.'],
    status: 'inactive',
  },
];

export const mockRequests: Request[] = [
  {
    id: 1,
    address: 'ул. Ленинградская, 35, кв. 42',
    coordinates: { lat: 53.1950, lng: 50.1069 },
    workType: 'Устранение протечки',
    client: 'Смирнова О.А.',
    phone: '+7 927 123-45-67',
    desiredDatetime: '2026-05-12T10:00:00',
    plannedDuration: 90,
    status: 'assigned',
    priority: 'high',
    description: 'Течет труба под раковиной на кухне',
    createdAt: '2026-05-11T14:30:00',
    assignedBrigade: 1,
  },
  {
    id: 2,
    address: 'пр. Кирова, 158, офис 201',
    coordinates: { lat: 53.2001, lng: 50.1500 },
    workType: 'Замена электропроводки',
    client: 'ООО "Техсервис"',
    phone: '+7 846 234-56-78',
    desiredDatetime: '2026-05-12T11:30:00',
    plannedDuration: 180,
    status: 'assigned',
    priority: 'medium',
    description: 'Необходима полная замена проводки в офисе',
    createdAt: '2026-05-10T09:15:00',
    assignedBrigade: 2,
  },
  {
    id: 3,
    address: 'ул. Молодогвардейская, 67, кв. 15',
    coordinates: { lat: 53.2150, lng: 50.1400 },
    workType: 'Ремонт розеток',
    client: 'Козлов В.П.',
    phone: '+7 927 345-67-89',
    desiredDatetime: '2026-05-12T14:00:00',
    plannedDuration: 60,
    status: 'new',
    priority: 'low',
    description: 'Не работают 2 розетки в спальне',
    createdAt: '2026-05-12T08:00:00',
  },
  {
    id: 4,
    address: 'ул. Советской Армии, 144, кв. 89',
    coordinates: { lat: 53.1850, lng: 50.0950 },
    workType: 'Прочистка канализации',
    client: 'Морозова Е.И.',
    phone: '+7 927 456-78-90',
    desiredDatetime: '2026-05-12T09:00:00',
    plannedDuration: 120,
    status: 'assigned',
    priority: 'urgent',
    description: 'Засор в ванной комнате, вода не уходит',
    createdAt: '2026-05-11T18:45:00',
    assignedBrigade: 1,
  },
  {
    id: 5,
    address: 'ул. Вольская, 75',
    coordinates: { lat: 53.2100, lng: 50.1600 },
    workType: 'Установка счетчика',
    client: 'Романов П.С.',
    phone: '+7 927 567-89-01',
    desiredDatetime: '2026-05-13T10:00:00',
    plannedDuration: 90,
    status: 'new',
    priority: 'medium',
    description: 'Установка нового счетчика воды',
    createdAt: '2026-05-12T07:30:00',
  },
  {
    id: 6,
    address: 'пр. Металлургов, 56, кв. 112',
    coordinates: { lat: 53.2300, lng: 50.2000 },
    workType: 'Замена автоматов',
    client: 'Федорова Т.Н.',
    phone: '+7 927 678-90-12',
    desiredDatetime: '2026-05-12T15:30:00',
    plannedDuration: 75,
    status: 'new',
    priority: 'high',
    description: 'Выбивает автомат в щитке',
    createdAt: '2026-05-11T20:00:00',
  },
  {
    id: 7,
    address: 'ул. Победы, 89, кв. 3',
    coordinates: { lat: 53.1750, lng: 50.0850 },
    workType: 'Ремонт смесителя',
    client: 'Григорьев А.М.',
    phone: '+7 927 789-01-23',
    desiredDatetime: '2026-05-13T11:00:00',
    plannedDuration: 60,
    status: 'new',
    priority: 'low',
    description: 'Капает кран в ванной',
    createdAt: '2026-05-12T09:20:00',
  },
  {
    id: 8,
    address: 'ул. Стара-Загора, 156А',
    coordinates: { lat: 53.1900, lng: 50.1200 },
    workType: 'Установка люстры',
    client: 'ТЦ "Самара"',
    phone: '+7 846 890-12-34',
    desiredDatetime: '2026-05-12T16:00:00',
    plannedDuration: 45,
    status: 'assigned',
    priority: 'medium',
    description: 'Установка люстры в холле',
    createdAt: '2026-05-11T12:00:00',
    assignedBrigade: 2,
  },
];

export const mockAssignments: Assignment[] = [
  {
    id: 1,
    requestId: 4,
    brigadeId: 1,
    startTime: '2026-05-12T09:00:00',
    endTime: '2026-05-12T11:00:00',
    travelTime: 20,
    status: 'scheduled',
  },
  {
    id: 2,
    requestId: 1,
    brigadeId: 1,
    startTime: '2026-05-12T11:30:00',
    endTime: '2026-05-12T13:00:00',
    travelTime: 15,
    status: 'scheduled',
  },
  {
    id: 3,
    requestId: 2,
    brigadeId: 2,
    startTime: '2026-05-12T11:30:00',
    endTime: '2026-05-12T14:30:00',
    travelTime: 25,
    status: 'in_progress',
  },
  {
    id: 4,
    requestId: 8,
    brigadeId: 2,
    startTime: '2026-05-12T15:00:00',
    endTime: '2026-05-12T15:45:00',
    travelTime: 10,
    status: 'scheduled',
  },
];

export const getRequestById = (id: number) => mockRequests.find(r => r.id === id);
export const getBrigadeById = (id: number) => mockBrigades.find(b => b.id === id);
export const getAssignmentsByBrigade = (brigadeId: number) =>
  mockAssignments.filter(a => a.brigadeId === brigadeId);
