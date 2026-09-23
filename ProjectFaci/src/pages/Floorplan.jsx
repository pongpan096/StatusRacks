import { useEffect, useState, useMemo } from 'react';
import api from '../api';
import { rackNextStatus, rackStatusColor, crahNextStatus, crahStatusColor } from '../utils/StatusHelpers';

// ---------- ป้าย G-Code เล็กๆ มุมบนกล่อง ----------
function GBadge({ code }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 'bold', color: '#2563eb',
      border: '1px solid #93c5fd', borderRadius: 4,
      padding: '1px 6px', marginBottom: 3, background: '#eff6ff'
    }}>
      {code}
    </div>
  );
}

// ---------- กล่อง Label ธรรมดา (ไม่มี Rack) ----------
function StaticBox({ gCode, title }) {
  return (
    <div style={{
      border: '1px solid #93c5fd', borderRadius: 6, padding: 8,
      textAlign: 'center', background: '#fff', marginBottom: 8
    }}>
      <GBadge code={gCode} />
      <div style={{ fontSize: 11, fontWeight: 'bold', color: '#2563eb' }}>{title}</div>
    </div>
  );
}

// ---------- แถบ CRAH บน/ล่าง (กดได้จริง เชื่อมกับ Database) ----------
const CrahBar = ({ gCode, title, group, crahList, onClickCrah }) => {
  const units = crahList[group] || [];
  return (
    <fieldset style={{
      border: '1px solid #cbd5e1',
      borderRadius: 6,
      padding: '10px 12px 12px 12px',
      background: '#f8fafc',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      boxSizing: 'border-box',
      margin: 0
    }}>
      <legend style={{
        padding: '0 8px',
        background: '#f8fafc',
        marginLeft: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#1e3a8a'
      }}>
        <span style={{ 
          fontSize: '9px', 
          background: '#e2e8f0', 
          padding: '1px 4px', 
          borderRadius: 3, 
          fontWeight: 'bold', 
          color: '#475569', 
          border: '1px solid #cbd5e1' 
        }}>
          {gCode}
        </span>
        {title}
      </legend>

        {units.map(c => {
        // 💡 กำหนดค่าสีเริ่มต้นเป็นสีขาวหรือค่าสำรอง
        let bgColor = '#ffffff';
        let textColor = '#0f172a';
        let borderColor = '#cbd5e1';

        // เช็คสถานะ (สามารถปรับชื่อฟิลด์ c.status หรือ c.state ให้ตรงกับฐานข้อมูลจริงของคุณได้เลยครับ)
        const currentStatus = (c.status || c.state || '').toUpperCase();

        if (c.crah_code.includes('ISO')) {
          bgColor = '#e2e8f0'; // สีสำหรับช่อง ISO
          borderColor = '#64748b';
        } else if (currentStatus === 'ON' || currentStatus === 'RUNNING' || currentStatus === 'ACTIVE') {
          bgColor = '#22c55e'; // สีเขียว: ON
          textColor = '#ffffff';
          borderColor = '#16a34a';
        } else if (currentStatus === 'OFF' || currentStatus === 'STOP' || currentStatus === 'FAULT') {
          bgColor = '#ef4444'; // สีแดง: OFF
          textColor = '#ffffff';
          borderColor = '#dc2626';
        } else if (currentStatus === 'STANDBY' || currentStatus === 'IDLE') {
          bgColor = '#f97316'; // สีส้ม: Standby
          textColor = '#ffffff';
          borderColor = '#ea580c';
        }

        return (
          <div
            key={c.id || c.crah_code}
            onClick={() => onClickCrah && onClickCrah(c)}
            style={{
              border: c.crah_code.includes('ISO') ? '1px dashed #64748b' : `1px solid ${borderColor}`,
              borderRadius: 4,
              padding: '4px 6px',
              background: bgColor,
              color: textColor,
              fontSize: '9px',
              fontWeight: 'bold',
              cursor: 'pointer',
              textAlign: 'center',
              flex: '1 1 auto',
              minWidth: '45px',
              maxWidth: '80px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              transition: 'background 0.2s ease'
            }}
          >
            {c.crah_code}
          </div>
        );
      })}
    </fieldset>
  );
};

// ---------- กล่อง Rack ฝั่งข้าง พร้อม CRAH บน-ล่าง ----------
function SidePanel({ gCode, title, crahTopGroup, crahBottomGroup, crahList, racks, onClickRack, onClickCrah }) {
  const topCrah = (crahList[crahTopGroup] || [])[0];
  const bottomCrah = (crahList[crahBottomGroup] || [])[1] || (crahList[crahBottomGroup] || [])[0];

  return (
    <div style={{
      border: '1px solid #93c5fd', borderRadius: 6, padding: 8,
      textAlign: 'center', background: '#fff', marginBottom: 8
    }}>
      <GBadge code={gCode} />
      <div style={{ fontSize: 11, fontWeight: 'bold', color: '#2563eb', marginBottom: 6 }}>{title}</div>

      <div style={{ border: '1px dashed #94a3b8', borderRadius: 4, padding: 4 }}>
        {topCrah && (
          <button
            onClick={() => onClickCrah(topCrah)}
            title={`${topCrah.crah_code} - ${topCrah.status}`}
            style={{
              width: '100%', fontSize: 8, color: 'white',
              backgroundColor: crahStatusColor[topCrah.status] || '#94a3b8',
              border: 'none', borderRadius: 3, padding: 3, marginBottom: 4, cursor: 'pointer'
            }}
          >
            {topCrah.crah_code}
          </button>
        )}

        <div style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 4 }}>{title}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {racks.map(rack => (
            <button
              key={rack.id}
              onClick={() => onClickRack(rack)}
              title={`${rack.zone_name} - ${rack.rack_number} - ${rack.power_status}`}
              style={{
                width: '100%', height: 16,
                backgroundColor: rackStatusColor[rack.power_status],
                color: 'white', fontSize: 8, fontWeight: 'bold',
                border: 'none', borderRadius: 3, cursor: 'pointer'
              }}
            >
              {rack.rack_number}
            </button>
          ))}
        </div>

        {bottomCrah && (
          <button
            onClick={() => onClickCrah(bottomCrah)}
            title={`${bottomCrah.crah_code} - ${bottomCrah.status}`}
            style={{
              width: '100%', fontSize: 8, color: 'white',
              backgroundColor: crahStatusColor[bottomCrah.status] || '#94a3b8',
              border: 'none', borderRadius: 3, padding: 3, marginTop: 4, cursor: 'pointer'
            }}
          >
            {bottomCrah.crah_code}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- กลุ่ม Zone หลัก (Zone 1 หรือ Zone 2) ----------
function ZoneGroup({ zoneNames, racksByZone, onClickRack, reverse }) {
  return (
    <div style={{ display: 'flex', gap: 4, width: '100%', marginBottom: 6 }}>
      {zoneNames.map(zone => {
        const list = reverse ? [...racksByZone[zone]].reverse() : racksByZone[zone];
        return (
          <div key={zone} style={{
            flex: 1, minWidth: 0, border: '1px solid #93c5fd', borderRadius: 4,
            padding: '4px 2px', background: '#fff'
          }}>
            <div style={{
              fontSize: 9, fontWeight: 'bold', textAlign: 'center', marginBottom: 4,
              color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {zone}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {list.map(rack => (
                <button
                  key={rack.id}
                  onClick={() => onClickRack(rack)}
                  title={`${zone} - Rack ${rack.rack_number} - ${rack.power_status}`}
                  style={{
                    width: '100%', height: 17,
                    backgroundColor: rackStatusColor[rack.power_status],
                    color: 'white', fontSize: 8, fontWeight: 'bold',
                    border: 'none', borderRadius: 3, cursor: 'pointer'
                  }}
                >
                  {rack.rack_number}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CRAH_GROUP_ORDER = [
  'CRAH-1 (01-11)', 
  'CRAH-2 (22-12)', 
  'NET-1 (25-26)', 
  'NET-2 (27-28)', 
  'TEL-1 (23-24)', 
  'TEL-2 (29-30)'
];

export default function FloorPlan() {
  const [racks, setRacks] = useState([]);
  const [crahUnits, setCrahUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [rackRes, crahRes] = await Promise.all([
        api.get('/racks'),
        api.get('/crah')
      ]);
      setRacks(rackRes.data);
      setCrahUnits(crahRes.data);
    } catch (err) {
      console.error('โหลดข้อมูลไม่สำเร็จ:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClickRack = async (rack) => {
    const newStatus = rackNextStatus[rack.power_status];
    setRacks(prev => prev.map(r => r.id === rack.id ? { ...r, power_status: newStatus } : r));
    try {
      await api.patch(`/racks/${rack.id}/status`, { power_status: newStatus });
    } catch (err) {
      alert('อัปเดตสถานะไม่สำเร็จ กรุณาลองใหม่');
      loadAll();
    }
  };

  const handleClickCrah = async (crah) => {
    const newStatus = crahNextStatus[crah.status];
    setCrahUnits(prev => prev.map(c => c.id === crah.id ? { ...c, status: newStatus } : c));
    try {
      await api.patch(`/crah/${crah.id}/status`, { status: newStatus });
    } catch (err) {
      alert('อัปเดตสถานะ CRAH ไม่สำเร็จ กรุณาลองใหม่');
      loadAll();
    }
  };

  // ---------- สรุปยอดรวม Server Rack ----------
  const summary = useMemo(() => {
    const result = { total: racks.length, on: 0, off: 0, notInstalled: 0, byCategory: {} };
    racks.forEach(r => {
      if (r.power_status === 'POWER_ON') result.on++;
      else if (r.power_status === 'POWER_OFF') result.off++;
      else result.notInstalled++;
      if (!result.byCategory[r.category]) {
        result.byCategory[r.category] = { total: 0, on: 0, off: 0, notInstalled: 0 };
      }
      result.byCategory[r.category].total++;
      if (r.power_status === 'POWER_ON') result.byCategory[r.category].on++;
      else if (r.power_status === 'POWER_OFF') result.byCategory[r.category].off++;
      else result.byCategory[r.category].notInstalled++;
    });
    return result;
  }, [racks]);

  // ---------- สรุปยอดรวม CRAH ----------
  const crahSummary = useMemo(() => {
    const result = { total: crahUnits.length, on: 0, off: 0, standby: 0, byGroup: {} };
    CRAH_GROUP_ORDER.forEach(g => {
      result.byGroup[g] = { total: 0, on: 0, off: 0, standby: 0 };
    });
    crahUnits.forEach(c => {
      const status = (c.status || "").toUpperCase().trim();
      const group = (c.crah_group || "").trim();

      if (status === 'ON') result.on++;
      else if (status === 'OFF') result.off++;
      else if (status === 'STANDBY') result.standby++;

      if (result.byGroup[group]) {
        result.byGroup[group].total++;
        if (status === 'ON') result.byGroup[group].on++;
        else if (status === 'OFF') result.byGroup[group].off++;
        else if (status === 'STANDBY') result.byGroup[group].standby++;
      }
    });
    return result;
  }, [crahUnits]);

  // ---------- จัดกลุ่ม Rack ตาม zone_name ----------
  const racksByZone = useMemo(() => {
    const grouped = {};
    racks.forEach(r => {
      if (!grouped[r.zone_name]) grouped[r.zone_name] = [];
      grouped[r.zone_name].push(r);
    });
    Object.keys(grouped).forEach(zone => {
      grouped[zone].sort((a, b) => a.rack_number - b.rack_number);
    });
    return grouped;
  }, [racks]);

  const sortAllZones = (prefix) => {
    return Object.keys(racksByZone)
      .filter(z => z.startsWith(prefix))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+$/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+$/)?.[0] || 0);
        return numA - numB;
      });
  };

  const zone1Names = useMemo(() => sortAllZones('Zone 1'), [racksByZone]);
  const zone2Names = useMemo(() => sortAllZones('Zone 2'), [racksByZone]);
  const getSideRacks = (zoneName) => racksByZone[zoneName] || [];

  // ---------- จัดกลุ่ม CRAH ตาม crah_group ----------
  const crahByGroup = useMemo(() => {
    const grouped = {};
    crahUnits.forEach(c => {
      if (!grouped[c.crah_group]) grouped[c.crah_group] = [];
      grouped[c.crah_group].push(c);
    });
    Object.keys(grouped).forEach(g => {
      grouped[g].sort((a, b) => {
        if (g === 'CRAH-2 (22-12)') {
          return b.crah_number - a.crah_number;
        }
        return a.crah_number - b.crah_number;
      });
    });
    return grouped;
  }, [crahUnits]);

  if (loading) return <div style={{ padding: 20 }}>กำลังโหลดข้อมูล...</div>;

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      
      {/* ---------- ส่วนสรุปสถานะการ์ดโค้งมน (วางคู่กัน 50% ขนาดเท่ากัน) ---------- */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: 24, width: '100%' }}>
        
        {/* 1. การ์ดสรุป Server Rack */}
        <div style={{ flex: 1, width: '50%', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#1f2937' }}>💻 สรุปสถานะ Server Rack</h4>
          
          {/* แถวหัวข้อหลัก */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1.2, background: '#f3f4f6', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>ทั้งหมด: {summary.total}</div>
            <div style={{ flex: 1.2, background: '#d1fae5', color: '#065f46', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>On ไฟแล้ว: {summary.on}</div>
            <div style={{ flex: 1.2, background: '#fed7aa', color: '#9a3412', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>ยังไม่ On: {summary.off}</div>
            <div style={{ flex: 1.2, background: '#f3f4f6', color: '#4b5563', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>ยังไม่ติดตั้ง: {summary.notInstalled}</div>
          </div>

          {/* แถวแยกตาม Category */}
          {Object.entries(summary.byCategory).map(([cat, val]) => (
            <div key={cat} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <div style={{ flex: 1.2, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: '#374151' }}>{cat}</div>
              <div style={{ flex: 1.2, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '6px', textAlign: 'center', fontSize: '12px', color: '#047857' }}>{val.on}</div>
              <div style={{ flex: 1.2, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '6px', textAlign: 'center', fontSize: '12px', color: '#c2410c' }}>{val.off}</div>
              <div style={{ flex: 1.2, background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px', textAlign: 'center', fontSize: '12px', color: '#4b5563' }}>{val.notInstalled}</div>
            </div>
          ))}
        </div>

        {/* 2. การ์ดสรุป CRAH (ดีไซน์และขนาดเท่ากันเป๊ะ) */}
        <div style={{ flex: 1, width: '50%', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#1f2937' }}>❄️ สรุปสถานะ เครื่องปรับอากาศ CRAH</h4>
          
          {/* แถวหัวข้อหลัก */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1.2, background: '#f3f4f6', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>ทั้งหมด: {crahSummary.total}</div>
            <div style={{ flex: 1.2, background: '#d1fae5', color: '#065f46', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>On: {crahSummary.on}</div>
            <div style={{ flex: 1.2, background: '#fed7aa', color: '#9a3412', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>Off: {crahSummary.off}</div>
            <div style={{ flex: 1.2, background: '#fef08a', color: '#854d0e', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>Stand By: {crahSummary.standby}</div>
          </div>

          {/* แถวแยกตาม Group CRAH */}
          {CRAH_GROUP_ORDER.map(group => {
            const val = crahSummary.byGroup[group] || { total: 0, on: 0, off: 0, standby: 0 };
            return (
              <div key={group} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <div style={{ flex: 1.2, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group}</div>
                <div style={{ flex: 1.2, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '6px', textAlign: 'center', fontSize: '12px', color: '#047857' }}>{val.on}</div>
                <div style={{ flex: 1.2, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '6px', textAlign: 'center', fontSize: '12px', color: '#c2410c' }}>{val.off}</div>
                <div style={{ flex: 1.2, background: '#fefce8', border: '1px solid #fef08a', borderRadius: '6px', padding: '6px', textAlign: 'center', fontSize: '12px', color: '#854d0e' }}>{val.standby}</div>
              </div>
            );
          })}
        </div>

      </div>

      {/* ---------- Floor Plan เต็มรูปแบบ ---------- */}
      <h2>Floor Plan</h2>
            <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, 150px) 1fr minmax(120px, 150px)',
        gridTemplateRows: 'auto auto 1fr auto auto',
        gap: 8,
        border: '2px solid #1e3a8a',
        padding: 10,
        background: '#ffffff',
        borderRadius: 8,
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'auto' // ป้องกันหน้าเว็บพังเวลาหน้าจอแคบเกินไป
      }}>
        {/* แถวบน */}
        <div><StaticBox gCode="G02" title="RECEPTION" /></div>
        <div>
          <CrahBar gCode="G05" title="CRAH-1" group="CRAH-1 (01-11)" crahList={crahByGroup} onClickCrah={handleClickCrah} />
        </div>
        <div><StaticBox gCode="G12" title="BUILDING POWER" /></div>

        {/* แถวกลางซ้าย */}
        <div>
          <StaticBox gCode="G03" title="SECURITY & CONTROL" />
          <SidePanel gCode="G01" title="NET-1" crahTopGroup="NET-1 (25-26)" crahBottomGroup="NET-1 (25-26)"
            crahList={crahByGroup} racks={getSideRacks('NET-1')} onClickRack={handleClickRack} onClickCrah={handleClickCrah} />
          <SidePanel gCode="G04" title="TEL-1" crahTopGroup="TEL-1 (23-24)" crahBottomGroup="TEL-1 (23-24)"
            crahList={crahByGroup} racks={getSideRacks('TEL-1')} onClickRack={handleClickRack} onClickCrah={handleClickCrah} />
        </div>

        {/* แถวกลางกลาง: Zone 1 + Zone 2 */}
        <div>
          <ZoneGroup zoneNames={zone1Names} racksByZone={racksByZone} onClickRack={handleClickRack} reverse={false} />
          <ZoneGroup zoneNames={zone2Names} racksByZone={racksByZone} onClickRack={handleClickRack} reverse={true} />
        </div>

        {/* แถวกลางขวา */}
        <div>
          <StaticBox gCode="G13" title="LOADING BUILD & TEST" />
          <SidePanel gCode="G14" title="NET-2" crahTopGroup="NET-2 (27-28)" crahBottomGroup="NET-2 (27-28)"
            crahList={crahByGroup} racks={getSideRacks('NET-2')} onClickRack={handleClickRack} onClickCrah={handleClickCrah} />
          <SidePanel gCode="G15" title="TEL-2" crahTopGroup="TEL-2 (29-30)" crahBottomGroup="TEL-2 (29-30)"
            crahList={crahByGroup} racks={getSideRacks('TEL-2')} onClickRack={handleClickRack} onClickCrah={handleClickCrah} />
        </div>

        {/* แถวล่าง: CRAH-2 เต็มความกว้าง */}
        <div style={{ gridColumn: '1 / span 3'  }}>
          <CrahBar gCode="G09" title="CRAH-2" group="CRAH-2 (22-12)" crahList={crahByGroup} onClickCrah={handleClickCrah} />
        </div>

        {/* ป้าย Fire Suppression ล่างสุด */}
        <div style={{
          gridColumn: '1 / span 3', textAlign: 'center',
          borderTop: '2px solid #1e3a8a', paddingTop: 6,
          fontSize: 12, fontWeight: 'bold', color: '#2563eb'
        }}>
          FIRE SUPPRESSION
        </div>
      </div>
    </div>
  );
}