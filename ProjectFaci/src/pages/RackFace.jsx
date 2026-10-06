import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import './RackFace.css';

const TOTAL_UNITS = 42;
const EMPTY_FORM = { id: null, model: '', serial_number: '', start_unit: 1, unit_size: 1, note: '' };

export default function RackFace({ rack }) {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState('');

    // ---------- โหลดอุปกรณ์ของแร็คนี้ ----------
    const loadDevices = async () => {
        if (!rack?.id) return;
        setLoading(true);
        try {
            const res = await api.get('/rack-devices', { params: { rack_id: rack.id } });
            setDevices(Array.isArray(res.data) ? res.data : res.data?.data || []);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'โหลดข้อมูลไม่สำเร็จ');
            setDevices([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setForm(EMPTY_FORM);
        loadDevices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rack?.id]);

    // ---------- map ยูนิต -> อุปกรณ์ ----------
    const unitMap = useMemo(() => {
        const map = {};
        devices.forEach((d) => {
            const size = Number(d.unit_size) || 1;
            const start = Number(d.start_unit);
            for (let i = 0; i < size; i++) {
                const u = start + i;
                if (u >= 1 && u <= TOTAL_UNITS) {
                    map[u] = { device: d, isHead: i === 0, size };
                }
            }
        });
        return map;
    }, [devices]);

    const usedUnits = devices.reduce((sum, d) => sum + (Number(d.unit_size) || 1), 0);

    // ---------- ตรวจยูนิตทับซ้อน ----------
    const hasOverlap = (start, size, ignoreId) => {
        for (let i = 0; i < size; i++) {
            const u = start + i;
            const cell = unitMap[u];
            if (cell && String(cell.device.id) !== String(ignoreId)) return u;
        }
        return null;
    };

    // ---------- บันทึก (เพิ่ม / อัปเดต) ----------
    const handleSave = async (e) => {
        e.preventDefault();
        setError('');

        const start = Number(form.start_unit);
        const size = Number(form.unit_size) || 1;

        if (!form.model.trim()) return setError('กรุณากรอก Model ของอุปกรณ์');
        if (start < 1 || start > TOTAL_UNITS) return setError('ตำแหน่ง U ต้องอยู่ระหว่าง 1 - 42');
        if (start + size - 1 > TOTAL_UNITS) return setError('ขนาดอุปกรณ์เกินขอบตู้ (เกิน U42)');

        const clash = hasOverlap(start, size, form.id);
        if (clash) return setError(`ตำแหน่ง U${clash} ถูกใช้งานอยู่แล้ว กรุณาเลือกตำแหน่งอื่น`);

        setSaving(true);
        const payload = {
            rack_id: rack.id,
            model: form.model.trim(),
            serial_number: form.serial_number.trim() || null,
            start_unit: start,
            unit_size: size,
            note: form.note.trim() || null,
        };

        try {
            if (form.id) {
                await api.put(`/rack-devices/${form.id}`, payload);
            } else {
                await api.post('/rack-devices', payload);
            }
            setForm(EMPTY_FORM);
            await loadDevices();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'บันทึกไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    // ---------- ลบ ----------
    const handleDelete = async (device) => {
        if (!window.confirm(`ลบอุปกรณ์ "${device.model}" ที่ U${device.start_unit} ใช่หรือไม่?`)) return;
        try {
            await api.delete(`/rack-devices/${device.id}`);
            if (form.id === device.id) setForm(EMPTY_FORM);
            await loadDevices();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'ลบไม่สำเร็จ');
        }
    };

    // ---------- กดแก้ไข ----------
    const handleEdit = (device) => {
        setForm({
            id: device.id,
            model: device.model || '',
            serial_number: device.serial_number || '',
            start_unit: device.start_unit,
            unit_size: device.unit_size || 1,
            note: device.note || '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ---------- คลิกช่องว่างเพื่อเพิ่มที่ U นั้น ----------
    const handleClickEmptyUnit = (u) => setForm({ ...EMPTY_FORM, start_unit: u });

    const units = Array.from({ length: TOTAL_UNITS }, (_, i) => TOTAL_UNITS - i);

    return (
        <div className="rackface">
            <div className="rackface__head">
                <div>
                    <h2>Face Rack — {rack.zone_name} • Rack {rack.rack_number}</h2>
                    <p className="rackface__sub">
                        ใช้งานแล้ว <strong>{usedUnits}</strong> U / ว่าง <strong>{TOTAL_UNITS - usedUnits}</strong> U
                        (ทั้งหมด {TOTAL_UNITS} U)
                    </p>
                </div>
                <button className="btn-ghost" onClick={loadDevices}>โหลดข้อมูลใหม่</button>
            </div>

            <form className="device-form" onSubmit={handleSave}>
                <div className="device-form__title">
                    {form.id ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์ใหม่'}
                </div>

                <div className="device-form__grid">
                    <label>
                        <span>Model Switch *</span>
                        <input
                            value={form.model}
                            onChange={(e) => setForm({ ...form, model: e.target.value })}
                            placeholder="เช่น Cisco Catalyst 2960X Series"
                        />
                    </label>

                    <label>
                        <span>Serial Number (S/N)</span>
                        <input
                            value={form.serial_number}
                            onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                            placeholder="เช่น FCW2202B170"
                        />
                    </label>

                    <label>
                        <span>ตำแหน่งเริ่มต้น (U)</span>
                        <select
                            value={form.start_unit}
                            onChange={(e) => setForm({ ...form, start_unit: Number(e.target.value) })}
                        >
                            {units.map((u) => (
                                <option key={u} value={u}>U{u}</option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span>ขนาด (กี่ U)</span>
                        <input
                            type="number"
                            min="1"
                            max="42"
                            value={form.unit_size}
                            onChange={(e) => setForm({ ...form, unit_size: Number(e.target.value) })}
                        />
                    </label>

                    <label className="device-form__full">
                        <span>หมายเหตุ</span>
                        <input
                            value={form.note}
                            onChange={(e) => setForm({ ...form, note: e.target.value })}
                            placeholder="เช่น ไม่จ่ายไฟ / รอติดตั้ง"
                        />
                    </label>
                </div>

                {error && <div className="device-form__error">{error}</div>}

                <div className="device-form__actions">
                    <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? 'กำลังบันทึก...' : form.id ? 'อัปเดตอุปกรณ์' : 'เพิ่มลงตู้'}
                    </button>
                    {form.id && (
                        <button type="button" className="btn-ghost" onClick={() => setForm(EMPTY_FORM)}>
                            ยกเลิกการแก้ไข
                        </button>
                    )}
                </div>
            </form>

            <div className="rackface__cabinet">
                <div className="rackface__cabinet-head">
                    <span>Unit</span>
                    <span>Model / Serial Number</span>
                    <span>จัดการ</span>
                </div>

                {loading ? (
                    <div className="rackface__loading">กำลังโหลดอุปกรณ์...</div>
                ) : (
                    <div className="rackface__units">
                        {units.map((u) => {
                            const cell = unitMap[u];
                            // ถ้าเป็นยูนิตส่วนต่อขยาย (เช่น U5 ของอุปกรณ์ 2U ที่เริ่มที่ U4) ให้ข้ามการวาดซ้ำไปก่อน
                            if (cell && !cell.isHead) {
                                return null;
                            }
                            if (cell) {
                                const d = cell.device;
                                const size = Number(d.unit_size) || 1;

                                // คำนวณความสูงรวมตามจำนวน U (เช่น 2U จะสูงเป็น 2 เท่าโดยประมาณ)
                                const heightStyle = { height: `${size * 38}px` };
                                return (
                                    <div key={u} className="unit-row unit-row--multi" style={heightStyle}>
                                        <div className="unit-no-stack">
                                            {Array.from({ length: size }, (_, i) => d.start_unit - i).map((subU) => (
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
                                            <button className="mini-btn mini-btn--edit" onClick={() => handleEdit(d)}>แก้ไข</button>
                                            <button className="mini-btn mini-btn--del" onClick={() => handleDelete(d)}>ลบ</button>
                                        </div>
                                    </div>
                                );
                            }
                            // ยูนิตว่างปกติ
                            return (
                                <div key={u} className="unit-row unit-row--empty" onClick={() => handleClickEmptyUnit(u)}>
                                    <div className="unit-no">U{u}</div>
                                    <div className="unit-info unit-info--empty">ว่าง — คลิกเพื่อเพิ่มอุปกรณ์</div>
                                    <div className="unit-actions"><span className="plus-hint">+</span></div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}