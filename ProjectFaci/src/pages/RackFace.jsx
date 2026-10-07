import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api/axios';
import './RackFace.css';

const TOTAL_UNITS = 42;

// ค่าเริ่มต้นของฟอร์ม ใช้ซ้ำทั้งตอนเปิดหน้าและตอนล้างฟอร์ม
const EMPTY_FORM = {
  model: '',
  serial_number: '',
  start_unit: '',
  unit_size: '1',
  note: '',
};

export default function RackFace({ rack, displayLabel }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  /* ─────────── โหลดข้อมูลอุปกรณ์ในตู้ ─────────── */
  const loadDevices = useCallback(async () => {
    if (!rack?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/rack-devices?rack_id=${rack.id}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setDevices(list);
    } catch (err) {
      setError('โหลดข้อมูลอุปกรณ์ไม่สำเร็จ: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, [rack?.id]);

  useEffect(() => {
    loadDevices();
    setForm(EMPTY_FORM);
    setEditingId(null);
  }, [loadDevices]);

  /* ─────────── สร้างแผนที่ยูนิต 42 ช่อง ─────────── */
  // key = เลข U, value = { device, isHead }
  // isHead = true คือยูนิตบนสุดของอุปกรณ์ (จุดที่วาดกล่องจริง)
  const unitMap = useMemo(() => {
    const map = {};
    devices.forEach((d) => {
      const start = Number(d.start_unit) || 1;
      const size = Number(d.unit_size) || 1;
      for (let i = 0; i < size; i++) {
        const u = start - i;
        if (u >= 1 && u <= TOTAL_UNITS) {
          map[u] = { device: d, isHead: i === 0 };
        }
      }
    });
    return map;
  }, [devices]);

  // รายการ U เรียงจากบนลงล่าง (U42 อยู่บนสุด)
  const units = useMemo(
    () => Array.from({ length: TOTAL_UNITS }, (_, i) => TOTAL_UNITS - i),
    []
  );

  const usedUnits = useMemo(
    () => devices.reduce((sum, d) => sum + (Number(d.unit_size) || 1), 0),
    [devices]
  );

  /* ─────────── ตรวจสอบความถูกต้องก่อนบันทึก ─────────── */
  const validate = (start, size) => {
    if (!form.model.trim()) return 'กรุณากรอกชื่อรุ่นอุปกรณ์ (Model)';
    if (!start || !size || start < 1 || size < 1)
      return 'กรุณากรอกตำแหน่งเริ่มต้นและขนาดเป็นตัวเลขที่มากกว่า 0';
    if (start > TOTAL_UNITS) return `ตำแหน่งเริ่มต้นต้องไม่เกิน U${TOTAL_UNITS}`;
    if (start - size + 1 < 1)
      return `อุปกรณ์ขนาด ${size}U วางที่ U${start} ไม่ได้ เพราะพื้นที่ด้านล่างไม่พอ`;

    // เช็กการทับซ้อนกับอุปกรณ์ตัวอื่น (ข้ามตัวที่กำลังแก้ไขอยู่)
    for (let i = 0; i < size; i++) {
      const u = start - i;
      const cell = unitMap[u];
      if (cell && cell.device.id !== editingId) {
        return `ตำแหน่ง U${u} ถูกใช้งานโดย "${cell.device.model}" อยู่แล้ว`;
      }
    }
    return '';
  };

  /* ─────────── บันทึก (เพิ่ม / แก้ไข) ─────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const start = Number(form.start_unit);
    const size = Number(form.unit_size);

    const msg = validate(start, size);
    if (msg) {
      setError(msg);
      return;
    }

    const payload = {
      rack_id: rack.id,
      model: form.model.trim(),
      serial_number: form.serial_number.trim(),
      start_unit: start,
      unit_size: size,
      note: form.note.trim(),
    };

    setSubmitting(true);
    setError('');
    try {
      if (editingId) {
        await api.put(`/rack-devices/${editingId}`, payload);
      } else {
        await api.post('/rack-devices', payload);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadDevices();
    } catch (err) {
      setError('บันทึกไม่สำเร็จ: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  /* ─────────── คลิกช่องว่างเพื่อเติมตำแหน่งอัตโนมัติ ─────────── */
  const handleClickEmptyUnit = (u) => {
    setEditingId(null);
    setError('');
    setForm({ ...EMPTY_FORM, start_unit: String(u) });
  };

  /* ─────────── กดแก้ไข ─────────── */
  const handleEdit = (d) => {
    setEditingId(d.id);
    setError('');
    setForm({
      model: d.model || '',
      serial_number: d.serial_number || '',
      start_unit: String(d.start_unit || ''),
      unit_size: String(d.unit_size || 1),
      note: d.note || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ─────────── กดลบ ─────────── */
  const handleDelete = async (d) => {
    if (!window.confirm(`ต้องการลบ "${d.model}" ออกจากตู้ใช่หรือไม่?`)) return;
    try {
      await api.delete(`/rack-devices/${d.id}`);
      if (editingId === d.id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      await loadDevices();
    } catch (err) {
      setError('ลบไม่สำเร็จ: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  /* ─────────── ข้อความหัวตู้ ─────────── */
  const headLabel =
    displayLabel || `${rack?.zone_name ?? '-'} • Rack ${rack?.rack_number ?? '-'}`;

  return (
    <div className="rackface">
      {/* ===== หัวตู้ ===== */}
      <div className="rackface__head">
        <div>
          <h2>
            Face Rack
            <span className="rackface__zone-target">{headLabel}</span>
          </h2>
          <p className="rackface__sub">
            ใช้งานแล้ว <strong>{usedUnits}</strong> U / ว่าง{' '}
            <strong>{TOTAL_UNITS - usedUnits}</strong> U (ทั้งหมด {TOTAL_UNITS} U)
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={loadDevices}>
          โหลดข้อมูลใหม่
        </button>
      </div>

      {/* ===== ฟอร์มเพิ่ม / แก้ไขอุปกรณ์ ===== */}
      <form className="device-form" onSubmit={handleSubmit}>
        <div className="device-form__title">
          {editingId ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์ใหม่'}
        </div>

        <div className="device-form__grid">
          <label>
            <span>Model Switch *</span>
            <input
              type="text"
              placeholder="เช่น Cisco Catalyst 2960X Series"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </label>

          <label>
            <span>Serial Number (S/N)</span>
            <input
              type="text"
              placeholder="เช่น FCW2202B170"
              value={form.serial_number}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
            />
          </label>

          <label>
            <span>ตำแหน่งเริ่มต้น (U) *</span>
            <input
              type="number"
              min="1"
              max={TOTAL_UNITS}
              placeholder="เช่น 40"
              value={form.start_unit}
              onChange={(e) => setForm({ ...form, start_unit: e.target.value })}
              onWheel={(e) => e.target.blur()}
            />
          </label>

          <label>
            <span>ขนาด (กี่ U) *</span>
            <input
              type="number"
              min="1"
              max={TOTAL_UNITS}
              placeholder="เช่น 1, 2, 4"
              value={form.unit_size}
              onChange={(e) => setForm({ ...form, unit_size: e.target.value })}
              onWheel={(e) => e.target.blur()}
            />
          </label>

          <label className="device-form__full">
            <span>หมายเหตุ</span>
            <input
              type="text"
              placeholder="เช่น ไม่จ่ายไฟ / รอติดตั้ง"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
        </div>

        {error && <div className="device-form__error">{error}</div>}

        <div className="device-form__actions">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มลงตู้'}
          </button>
          {editingId && (
            <button type="button" className="btn-ghost" onClick={handleCancelEdit}>
              ยกเลิก
            </button>
          )}
        </div>
      </form>

      {/* ===== ตู้แร็ค ===== */}
      <div className="rackface__cabinet">
        <div className="rackface__cabinet-head">
          <span>ตำแหน่ง</span>
          <span>รายละเอียดอุปกรณ์</span>
          <span>จัดการ</span>
        </div>

        {loading ? (
          <div className="rackface__loading">กำลังโหลดอุปกรณ์...</div>
        ) : (
          <div className="rackface__units">
            {units.map((u) => {
              const cell = unitMap[u];

              // ยูนิตที่เป็นส่วนต่อขยายของอุปกรณ์ตัวบน → ข้ามไป ไม่วาดซ้ำ
              if (cell && !cell.isHead) return null;

              // ยูนิตที่เป็นหัวของอุปกรณ์ → วาดกล่องรวมตามขนาด U
              if (cell) {
                const d = cell.device;
                const size = Number(d.unit_size) || 1;
                const start = Number(d.start_unit) || u;

                return (
                  <div
                    key={u}
                    className="unit-row unit-row--multi"
                    style={{ height: `${size * 38 + (size - 1) * 2}px` }}
                  >
                    <div className="unit-no-stack">
                      {Array.from({ length: size }, (_, i) => start - i).map((subU) => (
                        <span key={subU} className="sub-u-badge">U{subU}</span>
                      ))}
                    </div>

                    <div className="unit-info">
                      <strong>{d.model}</strong>
                      <small>
                        S/N: {d.serial_number || '-'} • ขนาด {size}U
                        {d.note ? ` • ${d.note}` : ''}
                      </small>
                    </div>

                    <div className="unit-actions">
                      <button
                        type="button"
                        className="mini-btn mini-btn--edit"
                        onClick={() => handleEdit(d)}
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        className="mini-btn mini-btn--del"
                        onClick={() => handleDelete(d)}
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                );
              }

              // ยูนิตว่าง → คลิกเพื่อเติมตำแหน่งในฟอร์ม
              return (
                <div
                  key={u}
                  className="unit-row unit-row--empty"
                  onClick={() => handleClickEmptyUnit(u)}
                >
                  <div className="unit-no">U{u}</div>
                  <div className="unit-info unit-info--empty">
                    ว่าง — คลิกเพื่อเพิ่มอุปกรณ์
                  </div>
                  <div className="unit-actions">
                    <span className="plus-hint">+</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}