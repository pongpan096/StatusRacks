// ---------- สถานะ Server Rack ----------
export const rackNextStatus = {
  NOT_INSTALLED: 'POWER_ON',
  POWER_ON: 'POWER_OFF',
  POWER_OFF: 'NOT_INSTALLED'
};

export const rackStatusColor = {
  NOT_INSTALLED: '#6b7280',
  POWER_ON: '#22c55e',
  POWER_OFF: '#ef4444'
};

// ---------- สถานะ CRAH ----------
export const crahNextStatus = {
  STANDBY: 'ON',
  ON: 'OFF',
  OFF: 'STANDBY'
};

export const crahStatusColor = {
  ON: '#22c55e',
  OFF: '#ef4444',
  STANDBY: '#f97316'
};

export const crahStatusText = {
  ON: 'ON',
  OFF: 'OFF',
  STANDBY: 'Stand By'
};

// ---------- ช่องสี่เหลี่ยมสรุป ใช้ร่วมกันทุกหน้า ----------
export function SummaryCell({ bg, color, label, bold, align = 'center' }) {
  return (
    <div style={{
      flex: 1, background: bg, color, padding: '10px 8px',
      borderRadius: 6, textAlign: align, fontSize: 13,
      fontWeight: bold ? 'bold' : 'normal'
    }}>
      {label}
    </div>
  );
}