import api from './api';

// ─── Auth ────────────────────────────────────────────────────
export const authService = {
  login:          (data) => api.post('/auth/login', data),
  register:       (data) => api.post('/auth/register', data),
  logout:         ()     => api.post('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') }),
  me:             ()     => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

// ─── Patient ─────────────────────────────────────────────────
export const patientService = {
  getProfile:    ()     => api.get('/patient'),
  updateProfile: (data) => api.put('/patient', data),
  updateAvatar:  (file) => { const fd = new FormData(); fd.append('avatar', file); return api.patch('/patient/avatar', fd); },
  getDashboard:  ()     => api.get('/patient/dashboard'),
  getVitals:     (p)    => api.get('/patient/vitals', { params: p }),
  getLatestVitals: ()   => api.get('/patient/vitals/latest'),
  addVital:      (data) => api.post('/patient/vitals', data),
};

// ─── Doctor ──────────────────────────────────────────────────
export const doctorService = {
  getProfile:       ()     => api.get('/doctor'),
  updateProfile:    (data) => api.put('/doctor', data),
  getDashboard:     ()     => api.get('/doctor/dashboard'),
  getPatients:      (p)    => api.get('/doctor/patients', { params: p }),
  getPatientDetail: (id)   => api.get(`/doctor/patients/${id}`),
  linkPatient:      (id)   => api.post('/doctor/patients', { patientId: id }),
  unlinkPatient:    (id)   => api.delete(`/doctor/patients/${id}`),
  getConsolidated:  (id)   => api.get(`/doctor/patients/${id}/consolidated`),
  getHistory:       (id)   => api.get(`/doctor/patients/${id}/history`),
};

// ─── Exams ───────────────────────────────────────────────────
export const examService = {
  upload: (file, meta) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', meta.title);
    if (meta.description) fd.append('description', meta.description);
    return api.post('/exams', fd);
  },
  list:   (p)   => api.get('/exams', { params: p }),
  getOne: (id)  => api.get(`/exams/${id}`),
  remove: (id)  => api.delete(`/exams/${id}`),
};

// ─── Triage ──────────────────────────────────────────────────
export const triageService = {
  getQuestions: ()     => api.get('/triage/questions'),
  submit:       (data) => api.post('/triage', { answers: data }),
  getHistory:   (p)    => api.get('/triage', { params: p }),
  getOne:       (id)   => api.get(`/triage/${id}`),
};

// ─── AI Reports ──────────────────────────────────────────────
export const aiReportService = {
  list:         (p)  => api.get('/ai-reports', { params: p }),
  getOne:       (id) => api.get(`/ai-reports/my/${id}`),
  generate:     (patientId) => api.post(`/ai-reports/generate/${patientId}`),
};

// ─── Appointments ────────────────────────────────────────────
export const appointmentService = {
  create:       (data) => api.post('/appointments', data),
  listMy:       (p)    => api.get('/appointments/my', { params: p }),
  listDoctor:   (p)    => api.get('/appointments/doctor', { params: p }),
  updateStatus: (id, data) => api.patch(`/appointments/${id}/status`, data),
};

// ─── Notifications ───────────────────────────────────────────
export const notificationService = {
  list:        (p)   => api.get('/notifications', { params: p }),
  unreadCount: ()    => api.get('/notifications/unread-count'),
  markRead:    (id)  => api.patch(`/notifications/${id}/read`),
  markAllRead: ()    => api.patch('/notifications/read-all'),
};

// ─── Wearables ───────────────────────────────────────────────
export const wearableService = {
  listDevices:    ()     => api.get('/wearables/devices'),
  addDevice:      (data) => api.post('/wearables/devices', data),
  removeDevice:   (id)   => api.delete(`/wearables/devices/${id}`),
  ingest:         (data) => api.post('/wearables/ingest', data),
  getHistory:     (p)    => api.get('/wearables/history', { params: p }),
};

// ─── Gamificação ─────────────────────────────────────────────
export const goalService = {
  list:           (status) => api.get('/goals', { params: status ? { status } : {} }),
  create:         (data)   => api.post('/goals', data),
  updateProgress: (id, current) => api.patch(`/goals/${id}/progress`, { current }),
};

export const coinService = {
  balance:        ()       => api.get('/goals/coins/balance'),
  transactions:   ()       => api.get('/goals/coins/transactions'),
};

export const rewardService = {
  list:           ()       => api.get('/rewards'),
  redeem:         (id)     => api.post(`/rewards/${id}/redeem`),
  myRedemptions:  ()       => api.get('/rewards/my/redemptions'),
};
