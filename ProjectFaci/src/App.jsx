import { BrowserRouter, Routes, Route } from 'react-router-dom';
import FloorPlan from './pages/Floorplan';
import Login from './pages/Login';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/floorplan" element={<FloorPlan />} />
        <Route path="/login" element={<Login />} />

      </Routes>
    </BrowserRouter>
  );
}