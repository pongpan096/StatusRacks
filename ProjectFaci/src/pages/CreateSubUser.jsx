import { useState } from 'react';
import api from '../api';

export default function CreateSubUser() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '' });
  const [message, setMessage] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    const adminId = localStorage.getItem('userId');
    try {
      const res = await api.post('/auth/create-sub-user', { ...form, adminId });
      setMessage('สร้างผู้ใช้สำเร็จ: ' + res.data.user.email);
      setForm({ email: '', password: '', full_name: '' });
    } catch (err) {
      setMessage('เกิดข้อผิดพลาด: ' + err.response?.data?.message);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>สร้าง Sub User</h2>
      <form onSubmit={handleCreate} style={{ maxWidth: 400 }}>
        <input placeholder="ชื่อ-นามสกุล" value={form.full_name}
          onChange={e => setForm({ ...form, full_name: e.target.value })}
          style={{ width: '100%', padding: 8, marginBottom: 8 }} required />
        <input placeholder="อีเมล" value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          style={{ width: '100%', padding: 8, marginBottom: 8 }} required />
        <input placeholder="รหัสผ่าน" type="password" value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          style={{ width: '100%', padding: 8, marginBottom: 8 }} required />
        <button type="submit">สร้างผู้ใช้</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}