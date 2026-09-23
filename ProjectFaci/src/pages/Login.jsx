import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setErrorMessage('');

    // 💡 ระบบจำลองการเข้าสู่ระบบ: กด Enter หรือคลิกปุ่มแล้วพาไปหน้า Floor Plan ทันที
    if (email && password) {
      // ถ้าต้องการเก็บสถานะผู้ใช้เบื้องต้น สามารถเก็บใส่ localStorage ได้ที่นี่
      localStorage.setItem('isLoggedIn', 'true');
      navigate('/floorplan'); // เปลี่ยนเส้นทางไปหน้า Floor Plan
    } else {
      setErrorMessage('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      background: '#f8fafc',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ 
        background: '#ffffff', 
        padding: '30px', 
        borderRadius: '8px', 
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)', 
        width: '350px',
        border: '1px solid #e2e8f0'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#1e3a8a', fontSize: '20px' }}>
          เข้าสู่ระบบ
        </h2>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
              อีเมล
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="กรอกอีเมลของคุณ"
              style={{ 
                width: '100%', 
                padding: '10px', 
                boxSizing: 'border-box', 
                borderRadius: '4px', 
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                outline: 'none'
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
              รหัสผ่าน
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="กรอกรหัสผ่าน"
              style={{ 
                width: '100%', 
                padding: '10px', 
                boxSizing: 'border-box', 
                borderRadius: '4px', 
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                outline: 'none'
              }}
              required
            />
          </div>

          {errorMessage && (
            <div style={{ color: '#ef4444', fontSize: '12px', textAlign: 'center', fontWeight: '500' }}>
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            style={{
              background: '#2563eb',
              color: '#fff',
              padding: '10px',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '6px',
              fontSize: '14px',
              transition: 'background 0.2s'
            }}
          >
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
}