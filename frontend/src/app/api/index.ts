import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Brigades API
export interface Brigade {
  id: number;
  name: string;
  qualification: string;
  car_model: string;
  license_plate: string;
  specialists: string[];
  status: 'active' | 'on_route' | 'inactive';
  color: string;
  created_at: string;
  updated_at: string;
}

export interface BrigadeStats {
  total: string;
  active: string;
  on_route: string;
  inactive: string;
}

export interface CreateBrigadeData {
  name: string;
  qualification: string;
  carModel: string;
  licensePlate: string;
  specialists: string[];
  status?: 'active' | 'on_route' | 'inactive';
  color?: string;
}

export interface UpdateBrigadeData {
  name?: string;
  qualification?: string;
  carModel?: string;
  licensePlate?: string;
  specialists?: string[];
  status?: 'active' | 'on_route' | 'inactive';
  color?: string;
}

export const brigadesApi = {
  getAll: async (status?: string) => {
    const response = await api.get('/brigades', {
      params: status && status !== 'all' ? { status } : undefined,
    });
    return response.data as Brigade[];
  },
  getById: async (id: number) => {
    const response = await api.get(`/brigades/${id}`);
    return response.data as Brigade;
  },
  create: async (data: CreateBrigadeData) => {
    const response = await api.post('/brigades', data);
    return response.data as Brigade;
  },
  update: async (id: number, data: UpdateBrigadeData) => {
    const response = await api.put(`/brigades/${id}`, data);
    return response.data as Brigade;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/brigades/${id}`);
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/brigades/stats');
    return response.data as BrigadeStats;
  },
};

// ============================================================
// DASHBOARD API
// ============================================================

export interface DashboardStats {
  brigades: {
    total: string;
    active: string;
    on_route: string;
    inactive: string;
  };
  requests: {
    total: string;
    new: string;
    assigned: string;
    completed: string;
    urgent: string;
  };
  todayAssignments: number;
}

export const dashboardApi = {
  getStats: async () => {
    const response = await api.get('/dashboard/stats');
    return response.data as DashboardStats;
  },
};

// ============================================================
// REQUESTS API
// ============================================================

export interface Request {
  id: number;
  address: string;
  coordinates: { lat: number; lng: number } | null;
  work_type: string;
  client: string;
  phone: string;
  desired_datetime: string;
  planned_duration: number;
  status: 'new' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  assigned_brigade: number | null;
  assigned_brigade_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRequestData {
  address: string;
  coordinates?: { lat: number; lng: number } | null;
  workType: string;
  client: string;
  phone?: string;
  desiredDatetime?: string;
  plannedDuration?: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  description?: string;
}

export interface UpdateRequestData {
  address?: string;
  coordinates?: { lat: number; lng: number } | null;
  workType?: string;
  client?: string;
  phone?: string;
  desiredDatetime?: string;
  plannedDuration?: number;
  status?: 'new' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  description?: string;
}

export const requestsApi = {
  getAll: async (filters?: { status?: string; priority?: string }) => {
    const response = await api.get('/requests', {
      params: filters,
    });
    return response.data as Request[];
  },
  getById: async (id: number) => {
    const response = await api.get(`/requests/${id}`);
    return response.data as Request;
  },
  create: async (data: CreateRequestData) => {
    const response = await api.post('/requests', data);
    return response.data as Request;
  },
  update: async (id: number, data: UpdateRequestData) => {
    const response = await api.put(`/requests/${id}`, data);
    return response.data as Request;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/requests/${id}`);
    return response.data;
  },
};

// ============================================================
// ASSIGNMENTS / PLANNING API
// ============================================================

export interface Assignment {
  id: number;
  request_id: number;
  brigade_id: number;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  travel_time: number;
  status: string;
  address: string;
  work_type: string;
  client: string;
  phone: string;
  priority: string;
  description: string;
  planned_duration: number;
}

export interface ScheduleDay {
  date: string;
  brigades: Brigade[];
  assignments: Assignment[];
  unassigned: Request[];
}

export interface CreateAssignmentData {
  requestId: number;
  brigadeId: number;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  travelTime?: number;
}

export const routesApi = {
  getRoutes: async (date: string) => {
    const response = await api.get(`/routes/${date}`);
    return response.data;
  },
  geocode: async (q: string) => {
    const response = await api.get('/geocode', { params: { q } });
    return response.data;
  },
};

export const assignmentsApi = {
  getSchedule: async (date: string) => {
    const response = await api.get(`/schedule/${date}`);
    return response.data as ScheduleDay;
  },
  getUnassigned: async (date?: string) => {
    const response = await api.get('/requests/unassigned', {
      params: date ? { date } : undefined,
    });
    return response.data as Request[];
  },
  create: async (data: CreateAssignmentData) => {
    const response = await api.post('/assignments', data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/assignments/${id}`);
    return response.data;
  },
  autoPlan: async (date: string) => {
    const response = await api.post(`/schedule/${date}/auto-plan`);
    return response.data as { date: string; planned: number; unplanned: number; details: any };
  },
};
