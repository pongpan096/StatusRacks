import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';

const TOTAL_U = 42;

const EMPTY_FORM = { hostname: '', model: '', serial_number: '', start_unit: '', unit_size: '1', note: '' };

export default function RackFace({ rack, displayLabel, highlightIds = [], onDataChanged }) {
  const { canWrite } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingDevice, setEditingDevice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(null);

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
    } catch (err) {
      console.error('โหลดตู้ทั้งหมดไม่สำเร็จ:', err);
      setAllRacks([]);
    }
  };

  useEffect(() => {
    loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rack?.id]);

  /* 
    ปรับปรุงการแมปตำแหน่ง: 
    สนับสนุนการติดตั้งแบบ Start Unit อยู่ล่าง แล้วกินพื้นที่ขึ้นบน (เช่น Start 32, Size 11 -> กินช่วง 32 ถึง 42)
  */
  const occupiedMap = {};
  devices.forEach((d) => {
    const size = Number(d.unit_size) || 1;
    const start = Number(d.start_unit); // เช่น 32
    
    for (let i = 0; i < size; i++) {
      const currentU = start + i; // 32, 33, 34, ... 42
      // บันทึกให้ยูนิตล่างสุด (start) เป็นตัวคุมหัว (isTop หรือจุดเริ่มต้นการแสดงผล)
      occupiedMap[currentU] = { 
        device: d, 
        isBottom: i === 0, // จุดเริ่มต้นด้านล่าง
        topUnit: start + size - 1, // จุดสิ้นสุดด้านบน (เช่น 42)
        startUnit: start 
      };
    }
  });

  const usedU = devices.reduce((acc, d) => acc + (Number(d.unit_size) || 1), 0);

  const handleEdit = (d) => {
    setEditError(null);
    setEditingDevice(d);
    setFormData({
      hostname: d.hostname || '',
      model: d.model || '',
      serial_number: d.serial_number || '',
      start_unit: String(d.start_unit || ''),
      unit_size: String(d.unit_size || '1'),
      note: d.note || '',
    });
  };

  const closeEdit = () => {
    setEditingDevice(null);
    setFormData(EMPTY_FORM);
    setEditError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canWrite || !editingDevice) return;

    const start = Number(formData.start_unit);
    const size = Number(formData.unit_size);

    if (!formData.model.trim()) {
      setEditError('กรุณากรอก Model');
      return;
    }
    if (!start || start < 1 || start > TOTAL_U) {
      setEditError(`ตำแหน่งเริ่มต้นต้องอยู่ระหว่าง 1 - ${TOTAL_U}`);
      return;
    }
    if (!size || size < 1 || start + size - 1 > TOTAL_U) {
      setEditError(`ขนาด ${size}U เริ่มที่ U${start} แล้วเกินเพดานตู้ (สูงกว่า U42)`);
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      await api.put(`/rack-devices/${editingDevice.id}`, formData);
      closeEdit();
      await loadDevices();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      setEditError(err.response?.data?.message || 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
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

  const openMoveModal = (d) => {
    setMovingDevice(d);
    setTargetRackId(String(rack.id));
    setTargetStartUnit(String(d.start_unit));
    setErrorMsg(null);
    loadAllRacksForMove();
  };

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
    <div className="rf">
      <div className="rf-header">
        <h2 className="rf-title">{displayLabel || `Rack ${rack.rack_number}`}</h2>
        <span className="rf-sub">
          ใช้งานแล้ว {usedU} U / ว่าง {Math.max(0, TOTAL_U - usedU)} U (ทั้งหมด {TOTAL_U} U)
        </span>
      </div>

      <div className="rf-cabinet">
        {loading && devices.length === 0 && <div className="rf-loading">กำลังโหลดอุปกรณ์...</div>}

        {/* วาดตู้แร็คจาก U42 ลงมาถึง U1 */}
        {Array.from({ length: TOTAL_U }, (_, i) => TOTAL_U - i).map((u) => {
          const cell = occupiedMap[u];

          if (!cell) {
            return (
              <div key={u} className="rf-unit">
                <span className="rf-unit-no">U{u}</span>
                <span className="rf-unit-empty">ว่าง</span>
              </div>
            );
          }

          // ให้เรนเดอร์บล็อกอุปกรณ์เฉพาะที่ตำแหน่งล่างสุด (isBottom) เพื่อไม่ให้บล็อกถูกวาดซ้ำซ้อนตามจำนวน U
          if (!cell.isBottom) return null;

          const d = cell.device;
          const size = Math.min(Number(d.unit_size) || 1, TOTAL_U - cell.startUnit + 1);
          const topU = cell.topUnit; // จุดสูงสุด (เช่น 42)
          const bottomU = cell.startUnit; // จุดเริ่มต้นด้านล่าง (เช่น 32)
          const isHit = highlightIds.includes(d.id);

          return (
            <div
              key={`dev-${d.id}`}
              className={`rf-device${isHit ? ' rf-device--hit' : ''}`}
              style={{ '--rf-size': size }}
            >
              <div className="rf-range">
                <span>U{topU}</span>
                {size > 1 && <span className="rf-range-line" />}
                {size > 1 && <span>U{bottomU}</span>}
              </div>

              <div className="rf-info">
                <strong className="rf-model">
                  {d.hostname ? `${d.hostname} — ` : ''}{d.model}
                  {isHit && <span className="rf-badge">ตรงกับที่ค้นหา</span>}
                </strong>
                <small className="rf-detail">
                  S/N: {d.serial_number || '-'} • ขนาด {size}U
                  {size > 1 ? ` (ช่วง U${bottomU} ถึง U${topU})` : ''}
                  {d.note ? ` • ${d.note}` : ''}
                </small>
              </div>

              {canWrite && (
                <div className="rf-actions">
                  <button type="button" className="mini-btn mini-btn--move" onClick={() => openMoveModal(d)}>
                    ย้ายตู้
                  </button>
                  <button type="button" className="mini-btn mini-btn--edit" onClick={() => handleEdit(d)}>
                    แก้ไข
                  </button>
                  <button type="button" className="mini-btn mini-btn--del" onClick={() => handleDelete(d)}>
                    ลบ
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Popup แก้ไขอุปกรณ์ */}
      {editingDevice && (
        <div className="rf-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeEdit()}>
          <div className="rf-modal">
            <h3 className="rf-modal-title">แก้ไขอุปกรณ์</h3>
            <p className="rf-modal-desc">
              ตำแหน่งเริ่มต้น: U{editingDevice.start_unit} • ขนาด {editingDevice.unit_size || 1}U
            </p>

            {editError && <div className="rf-modal-error">{editError}</div>}

            <form onSubmit={handleSubmit}>
              <label className="rf-field">
                <span>Hostname</span>
                <input
                  type="text"
                  value={formData.hostname}
                  onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                />
              </label>

              <label className="rf-field">
                <span>Model *</span>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  required
                />
              </label>

              <label className="rf-field">
                <span>Serial Number (S/N)</span>
                <input
                  type="text"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                />
              </label>

              <div className="rf-field-row">
                <label className="rf-field">
                  <span>ตำแหน่งเริ่มต้น (U) *</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.start_unit}
                    onChange={(e) =>
                      setFormData({ ...formData, start_unit: e.target.value.replace(/\D/g, '') })
                    }
                    required
                  />
                </label>

                <label className="rf-field">
                  <span>ขนาด (U) *</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.unit_size}
                    onChange={(e) =>
                      setFormData({ ...formData, unit_size: e.target.value.replace(/\D/g, '') })
                    }
                    required
                  />
                </label>
              </div>

              <label className="rf-field">
                <span>หมายเหตุ</span>
                <input
                  type="text"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </label>

              <div className="rf-modal-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button type="button" className="btn-ghost" onClick={closeEdit} disabled={saving}>
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup ย้ายอุปกรณ์ */}
      {movingDevice && (
        <div className="rf-overlay">
          <div className="rf-modal">
            <h3 className="rf-modal-title">ย้ายอุปกรณ์ข้ามตู้แร็ค</h3>
            <p className="rf-modal-desc">
              กำลังย้าย: <strong>{movingDevice.model}</strong> (S/N: {movingDevice.serial_number || '-'})
            </p>

            {errorMsg && <div className="rf-modal-error">{errorMsg}</div>}

            <form onSubmit={handleConfirmMove}>
              <label className="rf-field">
                <span>เลือกตู้แร็คปลายทาง:</span>
                <select value={targetRackId} onChange={(e) => setTargetRackId(e.target.value)} required>
                  {allRacks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.zone_name ?? r.zone} • Rack {r.rack_number}
                    </option>
                  ))}
                </select>
              </label>

              <label className="rf-field">
                <span>ตำแหน่ง Unit เริ่มต้น (1-{TOTAL_U}):</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={targetStartUnit}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val === '' || (Number(val) >= 1 && Number(val) <= TOTAL_U)) {
                      setTargetStartUnit(val);
                    }
                  }}
                  placeholder="พิมพ์เลข Unit เช่น 3"
                  required
                />
              </label>

              <div className="rf-modal-actions">
                <button type="submit" className="btn-primary" disabled={moveLoading}>
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