import { NavLink, useNavigate } from 'react-router-dom';
import './MenuBarCustom.css';

export default function MenuBar() {
  const navigate = useNavigate();
  
  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  return (
    <header className="menubar">
      <div className="menubar__brand">
        <span className="menubar__logo">DC</span>
        <span className="menubar__title">Data Center Status</span>
      </div>

      <nav className="menubar__nav">
        <NavLink to="/floorplan" className={({ isActive }) => `menubar__link ${isActive ? 'menubar__link--active' : ''}`}>
          Floor Plan
        </NavLink>
        
        {/* ★ เพิ่มเมนูนี้ เพื่อกดเข้าไปหน้าแก้ไขสถานะ Rack */}
        <NavLink to="/rack-edit" className={({ isActive }) => `menubar__link ${isActive ? 'menubar__link--active' : ''}`}>
          Rack Edit
        </NavLink>

        <NavLink to="/crah-status" className={({ isActive }) => `menubar__link ${isActive ? 'menubar__link--active' : ''}`}>
          CRAH Status
        </NavLink>
      </nav>

      <div className="menubar__right">
        {user && <span className="menubar__username">{user.name || user.email}</span>}
        <button onClick={handleLogout} className="menubar__logout">
          ออกจากระบบ
        </button>
      </div>
    </header>
  );
}