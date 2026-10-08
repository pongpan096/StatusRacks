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
 * รองรับการพิมพ์รูปแบบ: 1-11-12 (หมายถึง Zone 1, Row 11, Rack 12)
 * หรือพิมพ์เต็มๆ เช่น Zone 1 Row 11
 */
function parseRackCode(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const parts = raw.split(/[-_\s]+/).filter(Boolean);
  
  if (parts.length === 3) {
    const [p1, p2, p3] = parts;
    if (/^\d+$/.test(p1) && /^\d+$/.test(p2) && /^\d+$/.test(p3)) {
      const zoneNum = Number(p1);
      const rowNum = Number(p2);
      const rackNum = String(Number(p3));

      const targetZoneName = `Zone ${zoneNum} Row ${rowNum}`.toLowerCase();

      return {
        zoneName: targetZoneName,
        rack: rackNum,
        displayLabel: `Zone ${zoneNum} • Row ${rowNum} • Rack ${rackNum}`,
      };
    }
  }

  return null;
}

/* ═══════════════ คอมโพเนนต์หลัก ═══════════════ */

export default function RackEdit() {
  const { canWrite } = useAuth();

  const [racks, setRacks] = useState([]);
  const [serialHits, setSerialHits] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  
  const [search, setSearch] = useState('');   // ค่าที่พิมพ์ในช่อง input
  const [query, setQuery] = useState('');     // ค่าจริงที่จะใช้ค้นหา (อัปเดตเมื่อกดปุ่มหรือกด Enter)

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

  useEffect(() => {
    loadRacks();
  }, []);

  // ข้อความแจ้งเตือนหายเองใน 3 วินาที
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  /* ───── ชั้นที่ 1: ถอดรหัสจากคำค้นหาที่กดปุ่มแล้ว ───── */
  const parsed = useMemo(() => parseRackCode(query), [query]);

  /* ───── ชั้นที่ 2: ค้นหา S/N เฉพาะเมื่อกดปุ่มค้นหาแล้ว ───── */
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
        
        const hits = devices.map((d) => {
          const owner = racks.find((r) => String(r.id) === String(d.rack_id));
          return { device: d, rack: owner || null };
        }).filter((hit) => hit.rack !== null);

        setSerialHits(hits);
      } catch (err) {
        console.error('ค้นหา S/N ไม่สำเร็จ:', err);
        setSerialHits([]);
      }
    };

    fetchSerial();
  }, [query, parsed, racks]);

  /* ───── ชั้นที่ 3: สรุปว่าจะแสดง Rack ไหนบ้าง (อิงจาก query) ───── */
  const filtered = useMemo(() => {
    if (!query.trim()) return [];

    if (parsed) {
      return racks.filter((rack) => {
        const zone = getZone(rack).toLowerCase();
        const num = String(rack.rack_number ?? '').trim();
        return zone === parsed.zoneName && num === parsed.rack;
      });
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
    if (parsed) return parsed.displayLabel;
    return `${getZone(rack)} • Rack ${rack.rack_number}`;
  };

  /* ───── ฟังก์ชันสั่งค้นหา ───── */
  const handleSearchClick = () => {
    setQuery(search);
  };

  /* ───── ฟังก์ชันล้างคำค้นหา ───── */
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
        <h1>แก้ไขสถานะ Rack</h1>
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
            if (e.key === 'Enter') {
              handleSearchClick();
            }
          }}
          placeholder="ค้นหาด้วยรหัส Rack (เช่น 1-11-12) หรือ Serial Number"
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
                    {getZone(hit.rack)} • Rack {hit.rack.rack_number} • U{hit.device.start_unit}
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