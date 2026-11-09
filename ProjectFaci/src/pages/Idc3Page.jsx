import { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import './Idc3Page.css';

// จับคู่หัวคอลัมน์ในไฟล์ (ไม่สนตัวพิมพ์เล็ก/ใหญ่ และสัญลักษณ์)
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const FIELD_ALIASES = {
    hostname: ['hostname'],
    location: ['locationrack', 'location', 'rack'],
    position_u: ['u', 'positionu', 'position'],
    brand: ['brand'],
    model: ['model'],
    serial_number: ['sn', 'serialnumber', 'serial'],
};

function mapRow(raw) {
    const out = {};
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        const key = Object.keys(raw).find((k) => aliases.includes(norm(k)));
        out[field] = key ? String(raw[key] ?? '').trim() : '';
    }
    return out;
}

export default function Idc3Page({ site }) {
    const { canWrite } = useAuth();
    const fileRef = useRef(null);

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [preview, setPreview] = useState(null); // แถวที่อ่านจากไฟล์ รอยืนยัน
    const [importing, setImporting] = useState(false);
    const [message, setMessage] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/idc3?site=${site}`);
            setItems(Array.isArray(res.data) ? res.data : []);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPreview(null);
        setMessage(null);
        setKeyword('');
        load();
    }, [site]);

    const filtered = useMemo(() => {
        const k = keyword.trim().toLowerCase();
        if (!k) return items;
        return items.filter((d) =>
            [d.hostname, d.location, d.position_u, d.brand, d.model, d.serial_number]
                .join(' ')
                .toLowerCase()
                .includes(k)
        );
    }, [items, keyword]);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setMessage(null);
        try {
            const wb = XLSX.read(await file.arrayBuffer());
            const ws = wb.Sheets[wb.SheetNames[0]];
            const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
            const rows = raw.map(mapRow).filter((r) => r.hostname || r.serial_number);
            if (rows.length === 0) {
                setMessage({ type: 'error', text: 'ไม่พบข้อมูล ตรวจสอบว่าแถวแรกเป็นหัวตาราง (Hostname, Location, U, Brand, Model, S/N)' });
                return;
            }
            setPreview(rows);
        } catch {
            setMessage({ type: 'error', text: 'อ่านไฟล์ไม่สำเร็จ' });
        } finally {
            e.target.value = '';
        }
    };

    const confirmImport = async () => {
        setImporting(true);
        try {
            const res = await api.post('/idc3/import', { site, rows: preview });
            setMessage({
                type: 'ok',
                text: `นำเข้าสำเร็จ ${res.data.imported} รายการ (ไม่มี S/N ${res.data.withoutSn} รายการ, ข้าม ${res.data.skipped} รายการที่ไม่มี Hostname หรือซ้ำ)`,
            });
            setPreview(null);
            await load();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'นำเข้าไม่สำเร็จ' });
        } finally {
            setImporting(false);
        }
    };

    const handleDelete = async (d) => {
        if (!window.confirm(`ลบ ${d.hostname} ใช่หรือไม่?`)) return;
        try {
            await api.delete(`/idc3/${d.id}?site=${site}`);
            setItems((prev) => prev.filter((x) => x.id !== d.id));
        } catch {
            alert('ลบไม่สำเร็จ');
        }
    };

    const handleSave = async (id, form) => {
        try {
            const res = await api.put(`/idc3/${id}?site=${site}`, form);
            setItems((prev) => prev.map((x) => (x.id === id ? res.data : x)));
            return true;
        } catch (err) {
            alert(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
            return false;
        }
    };

    return (
        <div className="idc3">
            <div className="idc3__head">
                <h2>
                    {site} <span className="idc3__count">{items.length} รายการ</span>
                    {items.some((d) => !d.serial_number) && (
                        <span className="idc3__count idc3__count--warn">
                            ยังไม่มี S/N {items.filter((d) => !d.serial_number).length} รายการ
                        </span>
                    )}
                </h2>
                {canWrite && (
                    <>
                        <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
                            Import Excel / CSV
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFile}
                            style={{ display: 'none' }}
                        />
                    </>
                )}
            </div>

            <input
                className="idc3__search"
                placeholder="ค้นหา Hostname / Rack / Model / S/N"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
            />

            {message && <div className={`idc3__msg idc3__msg--${message.type}`}>{message.text}</div>}

            {preview && (
                <div className="idc3__preview">
                    <div className="idc3__preview-head">
                        <strong>ตัวอย่างข้อมูลที่จะนำเข้า {preview.length} แถว ไปยัง {site}</strong>
                        <div>
                            <button type="button" className="btn-primary" onClick={confirmImport} disabled={importing}>
                                {importing ? 'กำลังนำเข้า...' : 'ยืนยันนำเข้า'}
                            </button>
                            <button type="button" className="btn-ghost" onClick={() => setPreview(null)} disabled={importing}>
                                ยกเลิก
                            </button>
                        </div>
                    </div>
                    <IdcTable rows={preview} maxHeight={380} />
                    <p className="idc3__more">ทั้งหมด {preview.length} แถว เลื่อนเมาส์ในตารางเพื่อดูแถวที่เหลือ</p>
                </div>
            )}

            {loading ? (
                <p>กำลังโหลด...</p>
            ) : (
                <IdcTable
                    rows={filtered}
                    onDelete={canWrite ? handleDelete : null}
                    onSave={canWrite ? handleSave : null}
                    maxHeight={520}
                />
            )}
        </div>
    );
}

const EMPTY_FORM = { hostname: '', location: '', position_u: '', brand: '', model: '', serial_number: '' };

function IdcTable({ rows, onDelete, onSave, maxHeight }) {
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  if (rows.length === 0) return <div className="idc3__empty">ไม่มีข้อมูล</div>;

  const hasActions = Boolean(onDelete || onSave);

  const startEdit = (d) => {
    setEditId(d.id);
    setForm({
      hostname: d.hostname || '',
      location: d.location || '',
      position_u: d.position_u || '',
      brand: d.brand || '',
      model: d.model || '',
      serial_number: d.serial_number || '',
    });
  };

  const cancelEdit = () => setEditId(null);

  const submitEdit = async () => {
    setSaving(true);
    const ok = await onSave(editId, form);
    setSaving(false);
    if (ok) setEditId(null);
  };

  const change = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const onKey = (e) => {
    if (e.key === 'Enter') submitEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  return (
    <div className="idc3__table-wrap" style={maxHeight ? { maxHeight } : undefined}>
      <table className="idc3__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Hostname</th>
            <th>Location (Rack)</th>
            <th>U</th>
            <th>Brand</th>
            <th>Model</th>
            <th>S/N</th>
            {hasActions && <th></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => {
            const editing = editId === d.id;
            return (
              <tr key={d.id || `${d.serial_number}-${i}`} className={editing ? 'idc3__row--edit' : ''}>
                <td>{i + 1}</td>
                {editing ? (
                  <>
                    <td><input className="idc3__input" value={form.hostname} onChange={change('hostname')} onKeyDown={onKey} /></td>
                    <td><input className="idc3__input" value={form.location} onChange={change('location')} onKeyDown={onKey} /></td>
                    <td><input className="idc3__input idc3__input--sm" value={form.position_u} onChange={change('position_u')} onKeyDown={onKey} /></td>
                    <td><input className="idc3__input" value={form.brand} onChange={change('brand')} onKeyDown={onKey} /></td>
                    <td><input className="idc3__input" value={form.model} onChange={change('model')} onKeyDown={onKey} /></td>
                    <td><input className="idc3__input" value={form.serial_number} onChange={change('serial_number')} onKeyDown={onKey} placeholder="เว้นว่างได้" /></td>
                    <td className="idc3__actions">
                      <button type="button" className="mini-btn mini-btn--save" onClick={submitEdit} disabled={saving}>
                        {saving ? '...' : 'บันทึก'}
                      </button>
                      <button type="button" className="mini-btn" onClick={cancelEdit} disabled={saving}>ยกเลิก</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{d.hostname}</td>
                    <td>{d.location}</td>
                    <td>{d.position_u}</td>
                    <td>{d.brand}</td>
                    <td>{d.model}</td>
                    <td>
                      {d.serial_number || (onSave ? <span className="idc3__missing">ยังไม่มี S/N</span> : '')}
                    </td>
                    {hasActions && (
                      <td className="idc3__actions">
                        {onSave && (
                          <button type="button" className="mini-btn mini-btn--edit" onClick={() => startEdit(d)}>แก้ไข</button>
                        )}
                        {onDelete && (
                          <button type="button" className="mini-btn mini-btn--del" onClick={() => onDelete(d)}>ลบ</button>
                        )}
                      </td>
                    )}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}