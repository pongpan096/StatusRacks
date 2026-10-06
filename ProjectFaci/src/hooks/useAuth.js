import { useMemo } from 'react';

export function useAuth() {
  return useMemo(() => {
    const raw = localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;

    return {
      user,
      role: user?.role || null,
      isAdmin: user?.role === 'admin',
      canWrite: true, // ปรับให้เป็น true ไว้ก่อน เพื่อให้เทสกดปุ่มแก้ไขได้ง่าย
      isLoggedIn: Boolean(user)
    };
  }, []);
}