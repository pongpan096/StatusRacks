export const RACK_STATUS = {
  ON: { value: 'on', label: 'On ไฟแล้ว', color: '#22c55e', textColor: '#ffffff' },
  OFF: { value: 'off', label: 'ยังไม่ On', color: '#ef4444', textColor: '#ffffff' },
  NOT_INSTALLED: { value: 'not_installed', label: 'ยังไม่ติดตั้ง', color: '#6b7280', textColor: '#ffffff' }
};

export const RACK_STATUS_LIST = Object.values(RACK_STATUS);

export function getRackColor(status) {
  const found = RACK_STATUS_LIST.find((s) => s.value === status);
  return found?.color || '#6b7280';
}

export function getRackLabel(status) {
  const found = RACK_STATUS_LIST.find((s) => s.value === status);
  return found?.label || 'ไม่ระบุ';
}