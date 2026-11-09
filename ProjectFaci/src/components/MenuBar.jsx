import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import './MenuBarCustom.css'; // ต้องใช้ชื่อนี้ให้ตรงกับไฟล์จริงในโฟลเดอร์ components ครับ


/* ═══════════ ลิงก์เมนูปกติ ═══════════ */
const linkClass = ({ isActive }) =>
  `menubar__link ${isActive ? 'menubar__link--active' : ''}`;

/* ═══════════ เมนูแบบ Dropdown ═══════════ */
function NavDropdown({ label, items }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // ปุ่มแม่สว่างเมื่ออยู่หน้าใดหน้าหนึ่งในเมนูย่อย
  const isActive = items.some((it) => location.pathname === it.to);

  // ปิดเมนูเมื่อเปลี่ยนหน้า
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // ปิดเมนูเมื่อคลิกที่อื่น (สำหรับมือถือ / แท็บเล็ต)
  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div
      ref={ref}
      className="menubar__dropdown"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`menubar__link menubar__dropdown-toggle ${isActive ? 'menubar__link--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {label}
        <span className={`menubar__caret ${open ? 'menubar__caret--open' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="menubar__dropdown-menu">
          <div className="menubar__dropdown-panel">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end
                className={({ isActive: active }) =>
                  `menubar__dropdown-item ${active ? 'menubar__dropdown-item--active' : ''}`
                }
              >
                {it.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════ แถบเมนูหลัก ═══════════ */
export default function MenuBar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  return (
    <header className="menubar">
      {/* โลโก้ */}
      <div className="menubar__brand">
        <span className="menubar__logo">DC</span>
        <span className="menubar__title">Data Center Status</span>
      </div>

      {/* เมนู */}
      <nav className="menubar__nav">
        <NavLink to="/floorplan" className={linkClass}>
          Floor Plan
        </NavLink>

        <NavLink to="/rack-edit" className={linkClass}>
          FaceRack
        </NavLink>

        <NavDropdown
          label="IDC3-1"
          items={[
            { to: '/idc3-1', label: 'ตารางอุปกรณ์ IDC3-1' },
            { to: '/facerack-1', label: 'FaceRack 3-1' },
          ]}
        />

        <NavDropdown
          label="IDC3-2"
          items={[
            { to: '/idc3-2', label: 'ตารางอุปกรณ์ IDC3-2' },
            { to: '/facerack-2', label: 'FaceRack 3-2' },
          ]}
        />
      </nav>

      {/* ออกจากระบบ */}
      <button type="button" className="menubar__logout" onClick={handleLogout}>
        ออกจากระบบ
      </button>
    </header>
  );
}