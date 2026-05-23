import axios from 'axios';

const api = axios.create({
  baseURL:         '/api',
  withCredentials: true,
});

// Injeta access token em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Trata expiração do access token com refresh automático
let refreshing = false;
let queue      = [];

const flush = (token) =>
  queue.forEach(({ resolve, reject, config }) => {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      resolve(api(config));
    } else {
      reject(new Error('Sessão expirada'));
    }
  });

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status !== 401 || original._retry) return Promise.reject(err);

    if (refreshing) {
      return new Promise((resolve, reject) => queue.push({ resolve, reject, config: original }));
    }

    original._retry = true;
    refreshing      = true;

    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) throw new Error('Sem refresh token');

      const { data } = await axios.post('/api/auth/refresh', { refreshToken });
      localStorage.setItem('accessToken',  data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      original.headers.Authorization = `Bearer ${data.accessToken}`;
      flush(data.accessToken);
      return api(original);
    } catch {
      flush(null);
      localStorage.clear();
      window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      refreshing = false;
      queue      = [];
    }
  },
);

export default api;
