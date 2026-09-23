import { SummaryCell } from '../utils/StatusHelpers';

export default function RackSummaryCard({ racks }) {
  const summary = { total: racks.length, on: 0, off: 0, notInstalled: 0, byCategory: {} };
  racks.forEach(r => {
    if (r.power_status === 'POWER_ON') summary.on++;
    else if (r.power_status === 'POWER_OFF') summary.off++;
    else summary.notInstalled++;
    if (!summary.byCategory[r.category]) {
      summary.byCategory[r.category] = { total: 0, on: 0, off: 0, notInstalled: 0 };
    }
    summary.byCategory[r.category].total++;
    if (r.power_status === 'POWER_ON') summary.byCategory[r.category].on++;
    else if (r.power_status === 'POWER_OFF') summary.byCategory[r.category].off++;
    else summary.byCategory[r.category].notInstalled++;
  });

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #f0f0f0'
      }}>
        <span style={{ fontSize: 18 }}>🖥️</span>
        <span style={{ fontWeight: 'bold', fontSize: 15 }}>สรุปสถานะ Server Rack</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <SummaryCell bg="#f3f4f6" color="#374151" label={`ทั้งหมด: ${summary.total}`} bold />
        <SummaryCell bg="#dcfce7" color="#166534" label={`On ไฟแล้ว: ${summary.on}`} bold />
        <SummaryCell bg="#fee2e2" color="#991b1b" label={`ยังไม่ On: ${summary.off}`} bold />
        <SummaryCell bg="#f3f4f6" color="#374151" label={`ยังไม่ติดตั้ง: ${summary.notInstalled}`} bold />
      </div>

      {Object.entries(summary.byCategory).map(([cat, val]) => (
        <div key={cat} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <SummaryCell bg="#f9fafb" color="#374151" label={cat} align="left" />
          <SummaryCell bg="#f0fdf4" color="#166534" label={val.on} />
          <SummaryCell bg="#fef2f2" color="#991b1b" label={val.off} />
          <SummaryCell bg="#f9fafb" color="#374151" label={val.notInstalled} />
        </div>
      ))}
    </div>
  );
}