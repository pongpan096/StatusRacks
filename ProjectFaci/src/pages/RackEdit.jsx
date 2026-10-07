import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { RACK_STATUS, RACK_STATUS_LIST, getRackColor, getRackLabel } from '../constants/status';
import RackFace from './RackFace';
import './RackEdit.css';
import './RackFace.css';



// ลำดับโซน → ชื่อ category ในฐานข้อมูล (แก้เพิ่มที่เดียวจบถ้ามีโซนใหม่)
const ZONE_BY_CODE = {
  '1': 'net',
  '2': 'tel',
};

// แผนที่ย้อนกลับ: ชื่อ category → ลำดับโซน (ใช้ตอนแสดงผล)
const CODE_BY_ZONE = Object.entries(ZONE_BY_CODE)
  .reduce((acc, [code, name]) => ({ ...acc, [name]: code }), {});

/**
 * ถอดรหัสค้นหา 3 ส่วน → คืนค่าเป้าหมายที่จะเอาไปเทียบกับฐานข้อมูล
 * รองรับตัวคั่นทั้ง "-", "_" และช่องว่าง
 * คืน null เมื่อรูปแบบไม่ถูกต้อง หรือพิมพ์ไม่ครบ 3 ส่วน
 */
function parseRackCode(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return null;

  const parts = raw.split(/[-_\s]+/).filter(Boolean);

  // กติกาเหล็ก: ต้องครบ 3 ส่วนเท่านั้น
  if (parts.length !== 3) return null;

  const [p1, p2, p3] = parts;

  // ส่วนที่ 2 และ 3 ต้องเป็นตัวเลขเสมอ
  if (!/^\d+$/.test(p2) || !/^\d+$/.test(p3)) return null;

  const row = String(Number(p2));  // "02" → "2"
  const rack = String(Number(p3));  // "03" → "3"

  const isNumericZone = /^\d+$/.test(p1);
  const zoneCode = isNumericZone ? String(Number(p1)) : CODE_BY_ZONE[p1];
  const category = isNumericZone ? ZONE_BY_CODE[String(Number(p1))] : p1;

  if (!category) return null;  // รหัสโซนที่ไม่มีอยู่จริง

  return {
    category,                        // "net" / "tel"
    zoneName: `${category}-${row}`,  // "net-2"
    row,
    rack,
    isNumericZone,                   // พิมพ์มาเป็นตัวเลขหรือตัวอักษร
    zoneCode,                        // "1" / "2"
    // ข้อความที่จะไปโชว์บนหัวตู้
    displayLabel: isNumericZone
      ? `Zone ${zoneCode} • Row ${row} • Rack ${rack}`
      : `${category.toUpperCase()}-${row} • Rack ${rack}`,
  };
}


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

  // ถอดรหัสครั้งเดียว แล้วใช้ร่วมกันทั้งการกรองและการแสดงผล
  const parsed = useMemo(() => parseRackCode(search), [search]);

  const filtered = useMemo(() => {
    if (!parsed) return [];   // ไม่ครบ 3 ส่วน → ไม่แสดงอะไรเลย

    return racks.filter((rack) => {
      const zone = String(rack.zone_name || '').trim().toLowerCase();
      const num = String(rack.rack_number ?? '').trim();

      // เทียบแบบ === เป๊ะทั้งคู่ ไม่ใช้ includes เด็ดขาด
      return zone === parsed.zoneName && num === parsed.rack;
    });
  }, [racks, parsed]);

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
          type="text"
          className="rackedit__search"
          placeholder="พิมพ์รหัสให้ครบ เช่น 01-02-03 หรือ TEL-2-2"
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
          กรุณาพิมพ์คำค้นหา Rack ที่ต้องการ (เช่น 01-01-02)
        </div>
      ) : filtered.length > 0 ? (
        <div className="rack-face-container">
          {filtered.map((rack) => (
            <RackFace
              key={rack.id}
              rack={rack}
              displayLabel={parsed?.displayLabel}
            />
          ))}
        </div>
      ) : (
        <div className="rackedit__empty">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
      )}
    </div>
  );
}
