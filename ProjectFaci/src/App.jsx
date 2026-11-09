import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Floorplan from './pages/Floorplan';
import RackEdit from './pages/RackEdit';
import Idc3Page from './pages/Idc3Page';

// ฟังก์ชันเช็กการล็อกอิน
function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<div className="login-bg"> <Login /> </div>} />

        {/* ครอบทุกหน้าที่มีเมนูด้านบน */}
        <Route element={<PrivateRoute><MainLayout /></PrivateRoute>}>
          <Route path="/floorplan" element={<Floorplan />} />
          <Route path="/rack-edit" element={<RackEdit />} />
          <Route path="/idc3-1" element={<Idc3Page site="IDC3-1" />} />
          <Route path="/idc3-2" element={<Idc3Page site="IDC3-2" />} />
          <Route path="/facerack-1" element={<RackEdit site="IDC3-1" />} />
          <Route path="/facerack-2" element={<RackEdit site="IDC3-2" />} />

        </Route>

        <Route path="*" element={<Navigate to="/floorplan" replace />} />
      </Routes>
    </BrowserRouter>
  );
}