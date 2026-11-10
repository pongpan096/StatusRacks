import { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import './Idc3Page.css';

/* ★ ปรับให้ตรงโปรเจกต์ (คัดลอกจากไฟล์เดิมได้) ★ */
import api from '../api';
import { useAuth } from '../hooks/useAuth';

const SYNC_LABEL = {
    synced: ['ผูกกับตู้แล้ว', 'ok'],
    no_location: ['ไม่มี Location', 'warn'],
    bad_location: ['รหัสตู้ไม่ถูกรูปแบบ', 'warn'],
    rack_not_found: ['ไม่พบตู้', 'warn'],
    no_unit: ['ไม่มีตำแหน่ง U', 'warn'],
    overlap: ['U ชนกับอุปกรณ์อื่น', 'err'],
    error: ['ผิดพลาด', 'err'],
};

const HEADER_MAP = {
    hostname: ['hostname', 'host', 'devicename', 'name'],
    location: ['location', 'locationrack', 'rack', 'rackno'],
    position_u: ['u', 'unit', 'position', 'positionu', 'ตำแหน่ง'],
    brand: ['brand', 'vendor', 'manufacturer'],
    model: ['model'],
    serial_number: ['sn', 'serial', 'serialnumber', 'serialno', 'serialnum'],
};

const normHeader = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
const str = (v) => String(v ?? '').trim();

function mapRow(raw) {
    const out = { hostname: '', location: '', position_u: '', brand: '', model: '', serial_number: '' };
    for (const [key, val] of Object.entries(raw)) {
        const nk = normHeader(key);
        for (const [field, aliases] of Object.entries(HEADER_MAP)) {
            if (aliases.includes(nk) && !out[field]) out[field] = str(val);
        }
    }
    return out;
}

async function parseFile(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
    return json
        .map(mapRow)
        .filter((r) => Object.values(r).some((v) => v !== ''));
}

export default function Idc3Page({ site = 'IDC3-1' }) {
    const { user } = useAuth();
    console.log('Current User Role ', user);
    const canWrite = true;

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [message, setMessage] = useState(null);

    const [preview, setPreview] = useState(null);
    const [fileName, setFileName] = useState('');
    const [importing, setImporting] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // State สำหรับควบคุม Modal ยืนยันลบทั้งหมด
    const [showClearModal, setShowClearModal] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [clearing, setClearing] = useState(false);

    const fileRef = useRef(null);

    const loadItems = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/idc3?site=${site}`);
            setItems(res.data || []);
        } catch (err) {
            setMessage({ type: 'err', text: err.response?.data?.message || 'โหลดข้อมูลไม่สำเร็จ' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setItems([]);
        setPreview(null);
        setFileName('');
        setSearch('');
        setMessage(null);
        loadItems();
    }, [site]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter((d) =>
            [d.hostname, d.location, d.position_u, d.brand, d.model, d.serial_number]
                .some((v) => String(v ?? '').toLowerCase().includes(q))
        );
    }, [items, search]);

    const missingSn = useMemo(() => items.filter((d) => !d.serial_number).length, [items]);

    const previewStats = useMemo(() => {
        if (!preview) return null;
        return {
            noHostname: preview.filter((r) => !r.hostname).length,
            noSn: preview.filter((r) => !r.serial_number).length,
        };
    }, [preview]);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        setMessage(null);
        try {
            const rows = await parseFile(file);
            if (rows.length === 0) {
                setPreview(null);
                setMessage({ type: 'err', text: 'ไม่พบข้อมูลในไฟล์ ตรวจสอบว่าแถวแรกเป็นหัวคอลัมน์' });
                return;
            }
            setFileName(file.name);
            setPreview(rows);
        } catch (err) {
            setPreview(null);
            setMessage({ type: 'err', text: 'อ่านไฟล์ไม่สำเร็จ: ' + err.message });
        }
    };

    const cancelImport = () => {
        setPreview(null);
        setFileName('');
    };

    const confirmImport = async () => {
        if (!preview || preview.length === 0) return;
        setImporting(true);
        setMessage(null);
        try {
            const res = await api.post('/idc3/import', { site, rows: preview });
            const d = res.data;
            setMessage({
                type: 'ok',
                text:
                    `นำเข้า ${d.imported} รายการ (ไม่มี S/N ${d.withoutSn ?? 0}, ข้าม ${d.skipped} ที่ไม่มี Hostname หรือซ้ำ)` +
                    ` | ผูกกับ FaceRack แล้ว ${d.synced ?? 0}, ยังไม่ผูก ${d.notSynced ?? 0}` +
                    (d.syncError ? ` | ซิงก์ผิดพลาด: ${d.syncError}` : ''),
            });
            setPreview(null);
            setFileName('');
            await loadItems();
        } catch (err) {
            setMessage({ type: 'err', text: err.response?.data?.message || 'นำเข้าไม่สำเร็จ' });
        } finally {
            setImporting(false);
        }
    };

    const handleSyncAll = async () => {
        if (!window.confirm(`ซิงก์ Location ของ ${site} ไปที่ FaceRack ทั้งหมด?`)) return;
        setSyncing(true);
        setMessage(null);
        try {
            const res = await api.post(`/idc3/sync?site=${site}`);
            await loadItems();
            setMessage({
                type: 'ok',
                text: `ซิงก์สำเร็จ ${res.data.synced} รายการ, ยังไม่ผูก ${res.data.notSynced} รายการ`,
            });
        } catch (err) {
            setMessage({ type: 'err', text: err.response?.data?.message || 'ซิงก์ไม่สำเร็จ' });
        } finally {
            setSyncing(false);
        }
    };

    const handleConfirmClearAll = async (e) => {
        e.preventDefault();
        if (confirmText !== site) return;

        setClearing(true);
        setMessage(null);
        try {
            await api.delete(`/idc3/clear?site=${site}`);
            setItems([]);
            setMessage({ type: 'ok', text: `ลบอุปกรณ์ทั้งหมดใน ${site} เรียบร้อยแล้ว` });
            setShowClearModal(false);
            setConfirmText('');
        } catch (err) {
            setMessage({ type: 'err', text: err.response?.data?.message || 'ลบข้อมูลทั้งหมดไม่สำเร็จ' });
        } finally {
            setClearing(false);
        }
    };

    const handleDelete = async (d) => {
        if (!window.confirm(`ลบ ${d.hostname} ?\n(อุปกรณ์ใน FaceRack จะไม่ถูกลบ)`)) return;
        try {
            await api.delete(`/idc3/${d.id}?site=${site}`);
            setItems((prev) => prev.filter((x) => x.id !== d.id));
        } catch (err) {
            alert(err.response?.data?.message || 'ลบไม่สำเร็จ');
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
                    {missingSn > 0 && (
                        <span className="idc3__count idc3__count--warn">ยังไม่มี S/N {missingSn} รายการ</span>
                    )}
                </h2>

                <div className="idc3__toolbar">
                    <input
                        type="search"
                        className="idc3__search"
                        placeholder="ค้นหา Hostname / Rack / Model / S/N"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.target.blur(); // ซ่อนคีย์บอร์ดหรือเอาฟกัสออกเมื่อกด Enter
                            }
                        }}
                    />

                    {canWrite && (
                        <>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFile}
                                style={{ display: 'none' }}
                            />
                            <button type="button" className="idc3__btn" onClick={() => fileRef.current?.click()}>
                                Import Excel / CSV
                            </button>
                            <button
                                type="button"
                                className="idc3__btn idc3__btn--ghost"
                                onClick={handleSyncAll}
                                disabled={syncing || items.length === 0}
                            >
                                {syncing ? 'กำลังซิงก์...' : 'ซิงก์ไป FaceRack'}
                            </button>
                            <button
                                type="button"
                                className="idc3__btn"
                                style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
                                onClick={() => { setConfirmText(''); setShowClearModal(true); }}
                                disabled={items.length === 0}
                            >
                                ลบทั้งหมด
                            </button>
                        </>
                    )}
                </div>
            </div>

            {message && (
                <div className={`idc3__msg idc3__msg--${message.type}`}>
                    <span>{message.text}</span>
                    <button type="button" className="idc3__msg-close" onClick={() => setMessage(null)}>×</button>
                </div>
            )}

            {preview && (
                <div className="idc3__preview">
                    <div className="idc3__preview-head">
                        <div>
                            <strong>ตัวอย่างก่อนนำเข้า</strong>
                            <span className="idc3__file"> {fileName}</span>
                        </div>
                        <div className="idc3__preview-actions">
                            <button type="button" className="idc3__btn idc3__btn--ghost" onClick={cancelImport} disabled={importing}>
                                ยกเลิก
                            </button>
                            <button type="button" className="idc3__btn idc3__btn--ok" onClick={confirmImport} disabled={importing}>
                                {importing ? 'กำลังนำเข้า...' : `ยืนยันนำเข้า ${preview.length} แถว`}
                            </button>
                        </div>
                    </div>

                    <IdcTable rows={preview} />

                    <p className="idc3__more">
                        ทั้งหมด {preview.length} แถว
                        {previewStats.noSn > 0 && ` | ไม่มี S/N ${previewStats.noSn} แถว`}
                        {previewStats.noHostname > 0 && ` | ไม่มี Hostname ${previewStats.noHostname} แถว (จะถูกข้าม)`}
                    </p>
                </div>
            )}

            {loading ? (
                <div className="idc3__empty">กำลังโหลด...</div>
            ) : (
                <IdcTable
                    rows={filtered}
                    onDelete={canWrite ? handleDelete : null}
                    onSave={canWrite ? handleSave : null}
                    showSync
                />
            )}

            {/* Modal ยืนยันการลบทั้งหมด */}
            {showClearModal && (
                <div className="rf-overlay">
                    <div className="rf-modal" style={{ maxWidth: '420px' }}>
                        <h3 className="rf-modal-title" style={{ color: '#dc2626' }}>⚠️ ยืนยันลบข้อมูลทั้งหมด</h3>
                        <p className="rf-modal-desc">
                            คุณกำลังจะลบอุปกรณ์ทั้งหมด ({items.length} รายการ) ใน <strong>{site}</strong> ออกจากระบบ ข้อมูลที่ลบแล้วจะไม่สามารถกู้คืนได้
                        </p>
                        <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '12px' }}>
                            โปรดพิมพ์คำว่า <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', color: '#0f172a' }}>{site}</code> เพื่อยืนยัน:
                        </p>

                        <form onSubmit={handleConfirmClearAll}>
                            <div className="rf-field" style={{ marginBottom: '20px' }}>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder={`พิมพ์ ${site} ที่นี่`}
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="rf-modal-actions">
                                <button
                                    type="button"
                                    className="btn-ghost"
                                    onClick={() => setShowClearModal(false)}
                                    disabled={clearing}
                                    style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer' }}
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="idc3__btn"
                                    style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff', padding: '8px 16px', borderRadius: '8px', opacity: confirmText !== site ? 0.5 : 1, cursor: confirmText !== site ? 'not-allowed' : 'pointer' }}
                                    disabled={confirmText !== site || clearing}
                                >
                                    {clearing ? 'กำลังลบ...' : 'ยืนยันลบทั้งหมด'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═════════════════ ตารางพร้อมระบบเรียงลำดับ ═════════════════ */
const EMPTY_FORM = { hostname: '', location: '', position_u: '', brand: '', model: '', serial_number: '' };

function IdcTable({ rows, onDelete, onSave, showSync }) {
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const [sortField, setSortField] = useState('hostname');
    const [sortDirection, setSortDirection] = useState('asc');

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedRows = useMemo(() => {
        if (!sortField) return rows;
        return [...rows].sort((a, b) => {
            const valA = String(a[sortField] || '').toLowerCase();
            const valB = String(b[sortField] || '').toLowerCase();
            const cmp = valA.localeCompare(valB, 'th', { numeric: true, sensitivity: 'base' });
            return sortDirection === 'asc' ? cmp : -cmp;
        });
    }, [rows, sortField, sortDirection]);

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

    const renderSortIcon = (field) => {
        if (sortField !== field) return <span style={{ opacity: 0.3, marginLeft: 6 }}>↕</span>;
        return <span style={{ marginLeft: 6, color: '#60a5fa' }}>{sortDirection === 'asc' ? '▲' : '▼'}</span>;
    };

    const sortableTh = (field, label, extraClass = '') => (
        <th
            className={extraClass}
            onClick={() => handleSort(field)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
        >
            {label} {renderSortIcon(field)}
        </th>
    );

    return (
        <div className="idc3__table-wrap">
            <table className="idc3__table">
                <thead>
                    <tr>
                        <th className="idc3__col-num">#</th>
                        {sortableTh('hostname', 'Hostname')}
                        {sortableTh('location', 'Location (Rack)')}
                        {sortableTh('position_u', 'U')}
                        {sortableTh('brand', 'Brand', 'idc3__col-brand')}
                        {sortableTh('model', 'Model')}
                        {sortableTh('serial_number', 'S/N')}
                        {showSync && <th>FaceRack</th>}
                        {hasActions && <th></th>}
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.map((d, i) => {
                        const editing = editId === d.id;
                        const sync = SYNC_LABEL[d.sync_status];
                        return (
                            <tr key={d.id || `row-${i}`} className={editing ? 'idc3__row--edit' : ''}>
                                <td className="idc3__col-num">{i + 1}</td>

                                {editing ? (
                                    <>
                                        <td data-label="Hostname"><input className="idc3__input idc3__input--lg" value={form.hostname} onChange={change('hostname')} onKeyDown={onKey} autoFocus /></td>
                                        <td data-label="Location"><input className="idc3__input" value={form.location} onChange={change('location')} onKeyDown={onKey} /></td>
                                        <td data-label="U"><input className="idc3__input idc3__input--sm" value={form.position_u} onChange={change('position_u')} onKeyDown={onKey} /></td>
                                        <td data-label="Brand" className="idc3__col-brand"><input className="idc3__input" value={form.brand} onChange={change('brand')} onKeyDown={onKey} /></td>
                                        <td data-label="Model"><input className="idc3__input idc3__input--lg" value={form.model} onChange={change('model')} onKeyDown={onKey} /></td>
                                        <td data-label="S/N"><input className="idc3__input" value={form.serial_number} onChange={change('serial_number')} onKeyDown={onKey} placeholder="เว้นว่างได้" /></td>
                                        {showSync && <td data-label="FaceRack">-</td>}
                                        <td className="idc3__actions">
                                            <button type="button" className="mini-btn mini-btn--save" onClick={submitEdit} disabled={saving}>
                                                {saving ? '...' : 'บันทึก'}
                                            </button>
                                            <button type="button" className="mini-btn" onClick={cancelEdit} disabled={saving}>ยกเลิก</button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td data-label="Hostname">{d.hostname}</td>
                                        <td data-label="Location">{d.location}</td>
                                        <td data-label="U">{d.position_u}</td>
                                        <td data-label="Brand" className="idc3__col-brand">{d.brand}</td>
                                        <td data-label="Model">{d.model}</td>
                                        <td data-label="S/N">
                                            {d.serial_number || (
                                                <span className="idc3__missing">{onSave ? 'ยังไม่มี S/N' : ''}</span>
                                            )}
                                        </td>

                                        {showSync && (
                                            <td data-label="FaceRack">
                                                {d.sync_status ? (
                                                    <span
                                                        className={`idc3__sync idc3__sync--${sync ? sync[1] : 'err'}`}
                                                        title={d.sync_note || ''}
                                                    >
                                                        {sync ? sync[0] : d.sync_status}
                                                    </span>
                                                ) : (
                                                    <span className="idc3__sync">ยังไม่ซิงก์</span>
                                                )}
                                            </td>
                                        )}

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