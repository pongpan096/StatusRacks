import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { RACK_STATUS, RACK_STATUS_LIST, getRackColor, getRackLabel } from '../constants/status';
import RackFace from './RackFace';
import './RackEdit.css';
import './RackFace.css';





export default function RackEdit() {
  const { canWrite } = useAuth();

  const [racks, setRacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [filterZone, setFilterZone] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const loadRacks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/racks');
      setRacks(res.data);
    } catch {
      setMessage({ type: 'error', text: 'โหลดข้อมูล Rack ไม่สำเร็จ' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRacks(); }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  const zones = useMemo(
    () => [...new Set(racks.map((r) => r.zone).filter(Boolean))].sort(),
    [racks]
  );

const filtered = useMemo(() => {
  if (!search.trim()) return [];
  const keyword = search.toLowerCase().trim();

  return racks.filter((rack) => {
    const zone = String(rack.zone_name || '').toLowerCase(); // เช่น "net-1" หรือ "tel-1"
    const num = String(rack.rack_number || '');             // เช่น "3"
    
    // 1. รูปแบบมาตรฐาน เช่น "net-1-3"
    const standardCode = `${zone}-${num}`;
    
    // 2. แปลงรูปแบบ "01-02-03" ให้เทียบเคียงได้
    // สมมติ 01 คือรหัสโซน, 02 คือแถว, 03 คือ rack_number ตัวท้าย
    const parts = keyword.split('-');
    let matchCustom = false;
    if (parts.length === 3) {
      const searchRackNum = String(Number(parts[2])); // แปลง "03" เป็น "3" เพื่อให้ตรงกับ rack_number
      // เช็กว่าลงท้ายด้วยโซนที่พิมพ์มา และเลขแร็คตรงกันไหม
      if (zone.includes(parts[0]) && num === searchRackNum) {
        matchCustom = true;
      }
    }

    return (
      keyword === standardCode ||
      matchCustom ||
      keyword === zone ||
      keyword === num
    );
  });
}, [racks, search]);

  const summary = useMemo(() => ({
    total: filtered.length,
    on: filtered.filter((r) => r.power_status === 'POWER_ON' || r.power_status === 'on').length,
    off: filtered.filter((r) => r.power_status === 'OFF' || r.power_status === 'off').length,
    notInstalled: filtered.filter((r) => r.power_status === 'NOT_INSTALL' || r.power_status === 'NOT_INSTALLED').length
  }), [filtered]);


  const updateStatus = async (rack, newStatus) => {
    if (!canWrite || rack.status === newStatus) return;

    const prevStatus = rack.status;
    setRacks((prev) => prev.map((r) => (r.id === rack.id ? { ...r, status: newStatus } : r)));

    try {
      await api.patch(`/racks/${rack.id}/status`, { status: newStatus });
      setMessage({ type: 'success', text: `อัปเดต ${rack.name} เป็น "${getRackLabel(newStatus)}" แล้ว` });
    } catch (err) {
      setRacks((prev) => prev.map((r) => (r.id === rack.id ? { ...r, status: prevStatus } : r)));
      setMessage({ type: 'error', text: err.response?.data?.message || 'บันทึกไม่สำเร็จ' });
    }
  };

  const bulkUpdate = async (newStatus) => {
    if (selectedIds.length === 0) {
      setMessage({ type: 'error', text: 'กรุณาเลือก Rack ก่อน' });
      return;
    }
    if (!window.confirm(`ยืนยันเปลี่ยน ${selectedIds.length} Rack เป็น "${getRackLabel(newStatus)}"?`)) return;

    setSaving(true);
    try {
      await api.patch('/racks/bulk-status', { ids: selectedIds, status: newStatus });
      setRacks((prev) =>
        prev.map((r) => (selectedIds.includes(r.id) ? { ...r, status: newStatus } : r))
      );
      setMessage({ type: 'success', text: `อัปเดต ${selectedIds.length} Rack เรียบร้อย` });
      setSelectedIds([]);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'อัปเดตไม่สำเร็จ' });
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map((r) => r.id));

  if (!canWrite) {
    return <div className="no-permission">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  return (
    <div className="page-container">
      <div className="page-head">
        <h1>แก้ไขสถานะ Rack</h1>
        <button onClick={loadRacks} className="btn-ghost">รีเฟรช</button>
      </div>

      {message && (
        <div className={`toast toast--${message.type}`}>{message.text}</div>
      )}

      <div className="filter-bar">
        <input
          placeholder="ค้นหา เช่น 01-01-02 หรือชื่อ Rack..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-ghost" onClick={() => setSearch('')}>
          ล้างคำค้นหา
        </button>
      </div>

      {loading ? (
        <div className="loading-box">กำลังโหลดข้อมูล...</div>
      ) : !search.trim() ? (
        <div className="loading-box" style={{ color: '#6b7280' }}>
          กรุณาพิมพ์ค้นหา Rack ที่ต้องการ (เช่น 01-01-02)
        </div>
      ) : filtered.length === 0 ? (
        <div className="loading-box">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
      ) : (
        <div className="rack-face-container">
          {filtered.map((rack) => (
            <RackFace key={rack.id} rack={rack} />
          ))}
        </div>
      )}
    </div>
  );
}
