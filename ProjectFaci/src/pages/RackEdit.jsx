import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { RACK_STATUS_LIST, getRackColor, getRackLabel } from '../constants/status';
import RackFace from './RackFace';
import './RackEdit.css';
import './RackFace.css';

/* ═══════════════ ค่าคงที่และฟังก์ชันช่วยเหลือ ═══════════════ */

const MIN_SERIAL_LENGTH = 4;

function getZone(rack) {
  return String(rack?.zone_name ?? rack?.zone ?? '').trim();
}

/**
 * ป้ายชื่อตู้แบบอ่านง่าย
 *  - Zone 1 Row 9  → Zone 1 • Row 9 • Rack 1
 *  - NET-1 / TEL-2 → NET-1 • Rack 6
 */
function formatRackLabel(rack) {
  const zone = getZone(rack);
  const num = rack?.rack_number;
  const m = zone.match(/zone\s*(\d+)\s*row\s*(\d+)/i);
  if (m) return `Zone ${Number(m[1])} • Row ${Number(m[2])} • Rack ${num}`;
  return `${zone.toUpperCase()} • Rack ${num}`;
}

/**
 * ถอดรหัสคำค้นหาเป็นตำแหน่งตู้
 * รองรับ:
 *  - 1-9-1, 01-09-01, 1/9/1, 1 9 1  → Zone 1 Row 9 Rack 1
 *  - 1-9                            → ทุกตู้ใน Zone 1 Row 9
 *  - N1-R6, N1-6, N1R6, NET1-6, NET-1-R6 → NET-1 Rack 6
 *  - T2-R3, TEL2-3, TEL-2-3, t2r3   → TEL-2 Rack 3
 *  - N1, NET-2, T1, TEL2            → ทุกตู้ในโซนนั้น
 * คืนค่า null ถ้าไม่ใช่รูปแบบ Location (จะไปค้นหาเป็น Serial Number แทน)
 */
function parseRackCode(input) {
  const raw = String(input || '').trim().toUpperCase();
  if (!raw) return null;

  // 1) แบบตัวเลข Zone-Row-Rack หรือ Zone-Row
  const parts = raw.split(/[-_/\s]+/).filter(Boolean);
  if ((parts.length === 3 || parts.length === 2) && parts.every((p) => /^\d+$/.test(p))) {
    const zoneNum = Number(parts[0]);
    const rowNum = Number(parts[1]);
    const rackNum = parts[2] !== undefined ? String(Number(parts[2])) : null;
    return {
      zoneName: `zone ${zoneNum} row ${rowNum}`,
      rack: rackNum,
      displayLabel: rackNum ? `Zone ${zoneNum} • Row ${rowNum} • Rack ${rackNum}` : null,
    };
  }

  // 2) แบบ NET / TEL
  const compact = raw.replace(/\s+/g, '');
  const m = compact.match(/^(NET|N|TEL|T)[-_]?(\d{1,2})(?:[-_]?R?(\d{1,3}))?$/);
  if (m) {
    const type = m[1].startsWith('N') ? 'NET' : 'TEL';
    const num = Number(m[2]);
    const rackNum = m[3] ? String(Number(m[3])) : null;
    return {
      zoneName: `${type}-${num}`.toLowerCase(),
      rack: rackNum,
      displayLabel: rackNum ? `${type}-${num} • Rack ${rackNum}` : null,
    };
  }

  return null;
}

/* ═══════════════ คอมโพเนนต์หลัก ═══════════════ */

export default function RackEdit({ site = 'IDC3-1' }) {
  const { canWrite } = useAuth();

  const [racks, setRacks] = useState([]);
  const [serialHits, setSerialHits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [search, setSearch] = useState(''); // ค่าที่พิมพ์ในช่อง input
  const [query, setQuery] = useState('');   // ค่าจริงที่ใช้ค้นหา (อัปเดตเมื่อกดปุ่มหรือ Enter)

  /* ───── โหลดข้อมูล Rack ทั้งหมด ───── */
  const loadRacks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/racks');
      const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setRacks(list);
    } catch {
      setMessage({ type: 'error', text: 'โหลดข้อมูล Rack ไม่สำเร็จ' });
    } finally {
      setLoading(false);
    }
  };

  // โหลดใหม่และล้างคำค้นหาทุกครั้งที่สลับ FaceRack 3-1 ↔ 3-2
  useEffect(() => {
    setSearch('');
    setQuery('');
    setSerialHits([]);
    setMessage(null);
    loadRacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

  // ข้อความแจ้งเตือนหายเองใน 3 วินาที
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  /* ───── ชั้นที่ 1: ถอดรหัสจากคำค้นหา ───── */
  const parsed = useMemo(() => parseRackCode(query), [query]);

  /* ───── ชั้นที่ 2: ค้นหา S/N (เฉพาะเมื่อไม่ใช่รูปแบบ Location) ───── */
  useEffect(() => {
    const raw = query.trim();
    if (parsed || raw.length < MIN_SERIAL_LENGTH) {
      setSerialHits([]);
      return;
    }

    const fetchSerial = async () => {
      try {
        const res = await api.get(`/rack-devices/search-serial?serial=${encodeURIComponent(raw)}`);
        const devices = Array.isArray(res.data) ? res.data : [];

        const hits = devices
          .map((d) => {
            const owner = racks.find((r) => String(r.id) === String(d.rack_id));
            return { device: d, rack: owner || null };
          })
          .filter((hit) => hit.rack !== null);

        setSerialHits(hits);
      } catch (err) {
        console.error('ค้นหา S/N ไม่สำเร็จ:', err);
        setSerialHits([]);
      }
    };

    fetchSerial();
  }, [query, parsed, racks]);

  /* ───── ชั้นที่ 3: สรุปว่าจะแสดง Rack ไหนบ้าง ───── */
  const filtered = useMemo(() => {
    if (!query.trim()) return [];

    if (parsed) {
      return racks
        .filter((rack) => {
          const zone = getZone(rack).toLowerCase().replace(/\s+/g, ' ');
          const num = String(rack.rack_number ?? '').trim();
          return zone === parsed.zoneName && (parsed.rack === null || num === parsed.rack);
        })
        .sort((a, b) => Number(a.rack_number) - Number(b.rack_number));
    }

    if (serialHits.length > 0) {
      const seen = new Set();
      return serialHits
        .map((hit) => hit.rack)
        .filter((r) => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });
    }

    return [];
  }, [racks, parsed, serialHits, query]);

  /* ───── id ของอุปกรณ์ที่ต้องไฮไลต์ ───── */
  const highlightIds = useMemo(
    () => serialHits.map((hit) => hit.device.id),
    [serialHits]
  );

  /* ───── ป้ายกำกับหัวตู้ ───── */
  const getLabelFor = (rack) => {
    if (parsed?.displayLabel) return parsed.displayLabel;
    return formatRackLabel(rack);
  };

  /* ───── สั่งค้นหา / ล้างคำค้นหา ───── */
  const handleSearchClick = () => {
    setQuery(search);
  };

  const handleClear = () => {
    setSearch('');
    setQuery('');
    setSerialHits([]);
  };

  /* ───── เปลี่ยนสถานะ Rack ───── */
  const handleStatusChange = async (rack, newStatus) => {
    if (!canWrite) {
      setMessage({ type: 'error', text: 'บัญชีของคุณไม่มีสิทธิ์แก้ไขข้อมูล' });
      return;
    }

    setSaving(true);
    try {
      await api.put(`/racks/${rack.id}`, { status: newStatus });
      setRacks((prev) =>
        prev.map((r) => (r.id === rack.id ? { ...r, status: newStatus } : r))
      );
      setMessage({ type: 'success', text: 'อัปเดตสถานะเรียบร้อยแล้ว' });
    } catch {
      setMessage({ type: 'error', text: 'อัปเดตสถานะไม่สำเร็จ' });
    } finally {
      setSaving(false);
    }
  };

  const isSerialTooShort =
    !parsed && query.trim().length > 0 && query.trim().length < MIN_SERIAL_LENGTH;

  return (
    <div className="rackedit">
      {/* ═══ หัวข้อหน้า ═══ */}
      <div className="rackedit__head">
        <h1>แก้ไขสถานะ Rack ({site})</h1>
        <button type="button" className="btn-ghost" onClick={loadRacks}>
          รีเฟรช
        </button>
      </div>

      {/* ═══ ข้อความแจ้งเตือน ═══ */}
      {message && (
        <div className={`rackedit__message rackedit__message--${message.type}`}>
          {message.text}
        </div>
      )}

      {!canWrite && (
        <div className="rackedit__message rackedit__message--warn">
          บัญชีนี้เข้าชมได้อย่างเดียว ไม่สามารถแก้ไขข้อมูลได้
        </div>
      )}

      {/* ═══ ช่องค้นหาและปุ่มกด ═══ */}
      <div className="rackedit__searchbar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearchClick();
          }}
          placeholder="ค้นหารหัส Rack (เช่น 1-11-12, N1-R6, TEL2-3, N1) หรือ Serial Number"
        />

        {query ? (
          <button type="button" className="btn-ghost" onClick={handleClear}>
            ล้างคำค้นหา
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={handleSearchClick}>
            ค้นหา
          </button>
        )}
      </div>

      {/* ═══ แถบแจ้งผลการค้นหา S/N ═══ */}
      {!parsed && serialHits.length > 0 && (
        <div className="serial-result">
          <span className="serial-result__icon">OK</span>
          <div>
            พบ <strong>{serialHits.length}</strong> อุปกรณ์ที่ตรงกับ Serial Number นี้
            <ul className="serial-result__list">
              {serialHits.map((hit) => (
                <li key={hit.device.id}>
                  <code>{hit.device.serial_number}</code> — {hit.device.model}
                  {' → '}
                  <strong>
                    {formatRackLabel(hit.rack)} • U{hit.device.start_unit}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ═══ ผลลัพธ์ ═══ */}
      {loading ? (
        <div className="loading-box">กำลังโหลดข้อมูล...</div>
      ) : !query.trim() ? (
        <div className="loading-box" style={{ color: '#6b7280' }}>
          กรุณากรอกรหัส Rack หรือ Serial Number แล้วคลิกปุ่ม "ค้นหา"
        </div>
      ) : isSerialTooShort ? (
        <div className="loading-box" style={{ color: '#6b7280' }}>
          พิมพ์ต่ออีกอย่างน้อย {MIN_SERIAL_LENGTH} ตัวอักษรเพื่อค้นหา Serial Number
        </div>
      ) : filtered.length > 0 ? (
        <div className="rack-face-container">
          {filtered.map((rack) => (
            <div key={rack.id} className="rack-face-block">
              {/* แถบเปลี่ยนสถานะของ Rack ตัวนี้ */}
              <div className="rack-status-bar">
                <span
                  className="rack-status-dot"
                  style={{ background: getRackColor(rack.status) }}
                />
                <span className="rack-status-text">
                  สถานะปัจจุบัน: <strong>{getRackLabel(rack.status)}</strong>
                </span>
                <select
                  className="rack-status-select"
                  value={rack.status ?? RACK_STATUS_LIST[0]?.value ?? ''}
                  disabled={!canWrite || saving}
                  onChange={(e) => handleStatusChange(rack, e.target.value)}
                >
                  {RACK_STATUS_LIST.map((s) => (
                    <option key={s.value ?? s} value={s.value ?? s}>
                      {s.label ?? getRackLabel(s)}
                    </option>
                  ))}
                </select>
              </div>

              <RackFace
                rack={rack}
                displayLabel={getLabelFor(rack)}
                highlightIds={highlightIds}
                onDataChanged={loadRacks}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rackedit__empty">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
      )}
    </div>
  );
}