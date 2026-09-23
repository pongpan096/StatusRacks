import { useEffect, useState, useMemo } from 'react';
import api from '../api';
import CrahSummaryCard from '../components/CrahSummaryCard';
import { crahNextStatus, crahStatusColor, crahStatusText } from '../utils/StatusHelpers';

const GROUP_ORDER = ['CRAH-1 (01-11)', 'CRAH-2 (22-12)', 'NET-1 (25-26)', 'NET-2 (27-28)', 'TEL-1 (23-24)', 'TEL-2 (29-30)'];

export default function CrahStatus() {
  const [crahList, setCrahList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCrah(); }, []);

  const loadCrah = async () => {
    try {
      const res = await api.get('/crah');
      setCrahList(res.data);
    } catch (err) {
      console.error('โหลดข้อมูล CRAH ไม่สำเร็จ:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClickCrah = async (crah) => {
    const newStatus = crahNextStatus[crah.status];
    setCrahList(prev => prev.map(c => c.id === crah.id ? { ...c, status: newStatus } : c));
    try {
      await api.patch(`/crah/${crah.id}/status`, { status: newStatus });
    } catch (err) {
      alert('อัปเดตสถานะไม่สำเร็จ กรุณาลองใหม่');
      loadCrah();
    }
  };

  const groupedCrah = useMemo(() => {
    const grouped = {};
    crahList.forEach(c => {
      if (!grouped[c.crah_group]) grouped[c.crah_group] = [];
      grouped[c.crah_group].push(c);
    });
    Object.keys(grouped).forEach(g => grouped[g].sort((a, b) => a.crah_number - b.crah_number));
    return grouped;
  }, [crahList]);

  if (loading) return <div style={{ padding: 20 }}>กำลังโหลดข้อมูล...</div>;

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <CrahSummaryCard crahList={crahList} />

      <h3 style={{ marginTop: 24 }}>รายการเครื่อง CRAH (คลิกเพื่อเปลี่ยนสถานะ)</h3>
      {GROUP_ORDER.map(group => groupedCrah[group] && (
        <div key={group} style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>{group}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {groupedCrah[group].map(crah => (
              <button
                key={crah.id}
                onClick={() => handleClickCrah(crah)}
                title={`${crah.crah_code} - ${crahStatusText[crah.status]}`}
                style={{
                  minWidth: 80, padding: '8px 10px',
                  backgroundColor: crahStatusColor[crah.status],
                  color: 'white', fontSize: 12, fontWeight: 'bold',
                  border: 'none', borderRadius: 6, cursor: 'pointer'
                }}
              >
                {crah.crah_code}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}