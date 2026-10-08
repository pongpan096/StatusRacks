import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';

export default function RackFace({ rack, displayLabel, highlightIds = [], onDataChanged }) {
  const { canWrite } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // State สำหรับฟอร์มเพิ่ม/แก้ไข
  const [formData, setFormData] = useState({ model: '', serial_number: '', start_unit: '', unit_size: '1', note: '' });
  const [editingDevice, setEditingDevice] = useState(null);

  // State สำหรับ Modal ย้ายอุปกรณ์ (Relocate)
  const [movingDevice, setMovingDevice] = useState(null);
  const [allRacks, setAllRacks] = useState([]);
  const [targetRackId, setTargetRackId] = useState('');
  const [targetStartUnit, setTargetStartUnit] = useState('1');
  const [moveLoading, setMoveLoading] = useState(false);

  const loadDevices = async () => {
    if (!rack?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/rack-devices?rack_id=${rack.id}`);
      setDevices(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAllRacksForMove = async () => {
    try {
      const res = await api.get('/racks');
      const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setAllRacks(list);
      if (list.length > 0) {
        setTargetRackId(String(list[0].id));
      }
    } catch (err) {
      console.error('โหลดตู้ทั้งหมดไม่สำเร็จ:', err);
      setAllRacks([]);
    }
  };

  useEffect(() => {
    loadDevices();
  }, [rack?.id]);

  const occupiedMap = {};
  devices.forEach((d) => {
    const size = Number(d.unit_size) || 1;
    const start = Number(d.start_unit);
    for (let i = 0; i < size; i++) {
      const uNum = start - i;
      occupiedMap[uNum] = { device: d, isTop: i === 0 };
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canWrite) return;

    try {
      if (editingDevice) {
        await api.put(`/rack-devices/${editingDevice.id}`, formData);
      } else {
        await api.post('/rack-devices', { ...formData, rack_id: rack.id });
      }
      setFormData({ model: '', serial_number: '', start_unit: '', unit_size: '1', note: '' });
      setEditingDevice(null);
      await loadDevices();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      alert(err.response?.data?.message || 'บันทึกข้อมูลไม่สำเร็จ');
    }
  };

  const handleEdit = (d) => {
    setEditingDevice(d);
    setFormData({
      model: d.model || '',
      serial_number: d.serial_number || '',
      start_unit: d.start_unit || '',
      unit_size: d.unit_size || '1',
      note: d.note || '',
    });
  };

  const handleDelete = async (d) => {
    if (!canWrite || !window.confirm(`ต้องการลบอุปกรณ์ ${d.model} ใช่หรือไม่?`)) return;
    try {
      await api.delete(`/rack-devices/${d.id}`);
      await loadDevices();
      if (onDataChanged) onDataChanged();
    } catch {
      alert('ลบอุปกรณ์ไม่สำเร็จ');
    }
  };

  // ฟังก์ชันเปิด Modal ย้ายอุปกรณ์
  const openMoveModal = (d) => {
    setMovingDevice(d);
    setTargetRackId(String(rack.id));
    setTargetStartUnit(String(d.start_unit));
    setErrorMsg(null);
    loadAllRacksForMove();
  };

  // ฟังก์ชันยืนยันการย้ายอุปกรณ์ไปตู้ใหม่
  const handleConfirmMove = async (e) => {
    e.preventDefault();
    if (!movingDevice || !targetRackId) return;

    setMoveLoading(true);
    setErrorMsg(null);
    try {
      await api.put(`/rack-devices/${movingDevice.id}/relocate`, {
        target_rack_id: targetRackId,
        new_start_unit: targetStartUnit,
      });
      setMovingDevice(null);
      await loadDevices();
      if (onDataChanged) onDataChanged();
      alert('ย้ายอุปกรณ์สำเร็จเรียบร้อยแล้ว');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'ย้ายอุปกรณ์ไม่สำเร็จ');
    } finally {
      setMoveLoading(false);
    }
  };

  return (
    <div className="rackface">
      <div className="rackface__header">
        <h2>{displayLabel || `Rack ${rack.rack_number}`}</h2>
        <span className="rackface__sub">
          ใช้งานแล้ว {devices.reduce((acc, d) => acc + (Number(d.unit_size) || 1), 0)} U / ว่าง {42 - devices.reduce((acc, d) => acc + (Number(d.unit_size) || 1), 0)} U (ทั้งหมด 42 U)
        </span>
      </div>

      {canWrite && (
        <form className="rack-form" onSubmit={handleSubmit}>
          <h3>{editingDevice ? `แก้ไขอุปกรณ์ (U${editingDevice.start_unit})` : 'เพิ่มอุปกรณ์ใหม่'}</h3>
          <div className="rack-form__grid">
            <input
              type="text"
              placeholder="Model Switch *"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Serial Number (S/N)"
              value={formData.serial_number}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
            />
            <input
              type="number"
              placeholder="ตำแหน่งเริ่มต้น (U) *"
              min="1"
              max="42"
              value={formData.start_unit}
              onChange={(e) => setFormData({ ...formData, start_unit: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="ขนาด (กี่ U) *"
              min="1"
              max="42"
              value={formData.unit_size}
              onChange={(e) => setFormData({ ...formData, unit_size: e.target.value })}
              required
            />
          </div>
          <input
            type="text"
            className="rack-form__note"
            placeholder="หมายเหตุ (เช่น ไม่จ่ายไฟ / รอติดตั้ง)"
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          />
          <div className="rack-form__actions">
            <button type="submit" className="btn-primary">
              {editingDevice ? 'บันทึกการแก้ไข' : '+ เพิ่มลงตู้'}
            </button>
            {editingDevice && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setEditingDevice(null);
                  setFormData({ model: '', serial_number: '', start_unit: '', unit_size: '1', note: '' });
                }}
              >
                ยกเลิก
              </button>
            )}
          </div>
        </form>
      )}

      {/* ผังตู้ 42 U */}
      <div className="rack-grid">
        {Array.from({ length: 42 }, (_, i) => 42 - i).map((u) => {
          const cell = occupiedMap[u];
          if (!cell) {
            return (
              <div key={u} className="unit-row unit-row--empty">
                <span className="unit-no">U{u}</span>
                <span className="unit-empty-text">ว่าง — คลิกเพิ่มอุปกรณ์ด้านบน</span>
              </div>
            );
          }
          if (!cell.isTop) return null;

          const d = cell.device;
          const size = Number(d.unit_size) || 1;
          const start = Number(d.start_unit) || u;
          const isHit = highlightIds.includes(d.id);

          return (
            <div
              key={u}
              className={`unit-row unit-row--multi${isHit ? ' unit-row--hit' : ''}`}
              style={{ height: `${size * 40 + (size - 1) * 4}px` }}
            >
              <span className="unit-no">U{u}</span>

              <div className="unit-info">
                <strong>
                  {d.model}
                  {isHit && <span className="hit-badge">ตรงกับที่ค้นหา</span>}
                </strong>
                <small>
                  S/N: {d.serial_number || '-'} • ขนาด {size}U
                  {d.note ? ` • ${d.note}` : ''}
                </small>
              </div>

              <div className="unit-actions">
                {canWrite && (
                  <>
                    <button type="button" className="mini-btn mini-btn--move" onClick={() => openMoveModal(d)}>
                      ย้ายตู้
                    </button>
                    <button type="button" className="mini-btn mini-btn--edit" onClick={() => handleEdit(d)}>
                      แก้ไข
                    </button>
                    <button type="button" className="mini-btn mini-btn--del" onClick={() => handleDelete(d)}>
                      ลบ
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* Modal ย้ายตู้ (เขียนแบบบังคับแสดงผลทับหน้าจอทันที) */}
      {/* ═══════════════════════════════════════════════ */}
      {movingDevice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999
        }}>
          <div style={{
            background: '#ffffff',
            padding: '24px 28px',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '450px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            boxSizing: 'border-box'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.2rem', color: '#111827' }}>
              ย้ายอุปกรณ์ข้ามตู้แร็ค
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '20px' }}>
              กำลังย้าย: <strong>{movingDevice.model}</strong> (S/N: {movingDevice.serial_number || '-'})
            </p>

            {errorMsg && (
              <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.9rem' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleConfirmMove}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  เลือกตู้แร็คปลายทาง:
                </label>
                <select
                  value={targetRackId}
                  onChange={(e) => setTargetRackId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #94a3b8', borderRadius: '8px', fontSize: '0.92rem', background: '#fff' }}
                  required
                >
                  {allRacks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.zone_name ?? r.zone} • Rack {r.rack_number}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  ตำแหน่ง Unit เริ่มต้น (1-42):
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={targetStartUnit}
                  onChange={(e) => {
                    // อนุญาตให้พิมพ์เฉพาะตัวเลข และจำกัดค่าไม่ให้เกิน 42 หรือปล่อยว่างได้
                    const val = e.target.value.replace(/\D/g, '');
                    if (val === '' || (Number(val) >= 1 && Number(val) <= 42)) {
                      setTargetStartUnit(val);
                    }
                  }}
                  placeholder="พิมพ์เลข Unit เช่น 14"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #94a3b8', borderRadius: '8px', fontSize: '0.92rem', background: '#fff', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={moveLoading}
                >
                  {moveLoading ? 'กำลังย้าย...' : 'ยืนยันการย้าย'}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setMovingDevice(null)}
                  disabled={moveLoading}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}