import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Floorplan from './pages/Floorplan';   // หรือชื่อไฟล์ Floor Plan ของคุณ
import RackEdit from './pages/RackEdit';     // ★ 1. นำเข้าหน้า RackEdit ที่เพิ่งสร้าง
import CrahStatus from './pages/CrahStatus'; // หน้าแอร์ (ถ้ามี)

// ฟังก์ชันเช็กการล็อกอิน
function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* ครอบทุกหน้าที่มีเมนูด้านบน */}
        <Route element={<PrivateRoute><MainLayout /></PrivateRoute>}>
          <Route path="/floorplan" element={<Floorplan />} />

          {/* ★ 2. เพิ่ม Route ตรงนี้ เพื่อให้แสดงผลใน MainLayout */}
          <Route path="/rack-edit" element={<RackEdit />} />

          <Route path="/crah-status" element={<CrahStatus />} />
        </Route>

        <Route path="*" element={<Navigate to="/floorplan" replace />} />
      </Routes>
    </BrowserRouter>
  );
}