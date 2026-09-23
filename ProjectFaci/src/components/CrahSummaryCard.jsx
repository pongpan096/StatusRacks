import React from 'react';

const GROUP_ORDER = [
  'CRAH-1 (01-11)', 
  'CRAH-2 (22-12)', 
  'NET-1 (25-26)', 
  'NET-2 (27-28)', 
  'TEL-1 (23-24)', 
  'TEL-2 (29-30)'
];

export default function CrahSummaryCard({ crahList = [] }) {
  // คำนวณยอดรวมทั้งหมด
  const totalSummary = { total: crahList.length, on: 0, off: 0, standby: 0 };
  const byGroup = {};

  GROUP_ORDER.forEach(group => {
    byGroup[group] = { total: 0, on: 0, off: 0, standby: 0 };
  });

  crahList.forEach(c => {
    const status = (c.status || c.power_status || "").toUpperCase().trim();
    const group = (c.crah_group || "").trim();

    if (status === 'ON') totalSummary.on++;
    else if (status === 'OFF') totalSummary.off++;
    else if (status === 'STANDBY') totalSummary.standby++;

    if (byGroup[group]) {
      byGroup[group].total++;
      if (status === 'ON') byGroup[group].on++;
      else if (status === 'OFF') byGroup[group].off++;
      else if (status === 'STANDBY') byGroup[group].standby++;
    }
  });

  return (
    <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
      <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 'bold' }}>❄️ สรุปสถานะ เครื่องปรับอากาศ CRAH</h3>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <thead>
          <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
            <th style={{ padding: '10px', border: '1px solid #e5e7eb' }}>หมวดหมู่</th>
            <th style={{ padding: '10px', border: '1px solid #e5e7eb' }}>ทั้งหมด</th>
            <th style={{ padding: '10px', border: '1px solid #e5e7eb', color: '#166534' }}>On</th>
            <th style={{ padding: '10px', border: '1px solid #e5e7eb', color: '#991b1b' }}>Off</th>
            <th style={{ padding: '10px', border: '1px solid #e5e7eb', color: '#9a3412' }}>Stand By</th>
          </tr>
        </thead>
        <tbody>
          {/* แถวสรุปยอดรวมทั้งหมด */}
          <tr style={{ background: '#f9fafb', fontWeight: 'bold', borderBottom: '2px solid #d1d5db' }}>
            <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'left', paddingLeft: '12px' }}>ทั้งหมด</td>
            <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{totalSummary.total}</td>
            <td style={{ padding: '8px', border: '1px solid #e5e7eb', color: '#166534' }}>{totalSummary.on}</td>
            <td style={{ padding: '8px', border: '1px solid #e5e7eb', color: '#991b1b' }}>{totalSummary.off}</td>
            <td style={{ padding: '8px', border: '1px solid #e5e7eb', color: '#9a3412' }}>{totalSummary.standby}</td>
          </tr>

          {/* แถวแยกตามกลุ่ม CRAH */}
          {GROUP_ORDER.map(group => {
            const data = byGroup[group];
            return (
              <tr key={group} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'left', paddingLeft: '12px' }}>{group}</td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{data.total}</td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{data.on}</td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{data.off}</td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{data.standby}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}