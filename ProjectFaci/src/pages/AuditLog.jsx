import { useEffect, useState } from 'react';
import api from '../api';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    api.get('/audit', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setLogs(res.data));
  }, []);

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('th-TH', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>ประวัติการแก้ไขทั้งหมด</h2>
      <table border="1" cellPadding="8" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>เวลา</th>
            <th>ผู้แก้ไข</th>
            <th>การกระทำ</th>
            <th>เปลี่ยนจาก</th>
            <th>เปลี่ยนเป็น</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>{formatTime(log.created_at)}</td>
              <td>{log.user_email}</td>
              <td>{log.action}</td>
              <td style={{ color: 'red' }}>{log.old_value}</td>
              <td style={{ color: 'green' }}>{log.new_value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}