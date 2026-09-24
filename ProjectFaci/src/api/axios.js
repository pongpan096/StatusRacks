import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`
});

// เพิ่ม Interceptor เพื่อแนบ Token อัตโนมัติทุกครั้งที่ยิง Request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // หรือชื่อตัวแปรที่คุณใช้เก็บ Token ใน localStorage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;