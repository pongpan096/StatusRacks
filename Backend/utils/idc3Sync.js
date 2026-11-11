const supabase = require('../config/supabase');

const AUTO_MARK_INSTALLED = true;

const clean = (v) => String(v ?? '').trim();

function parseLocation(text) {
  const s = clean(text).toUpperCase().replace(/\s+/g, '');
  if (!s) return null;

  // 1) แบบ Zone-Row-Rack เช่น 02-03-04 หรือ 2-3-4
  let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{1,3})$/);
  if (m) {
    return {
      zone_name: `Zone ${Number(m[1])} Row ${Number(m[2])}`,
      rack_number: Number(m[3])
    };
  }

  // 2) แบบ N1-03 หรือ NET-1-3 ให้แปลงเป็น NET-1
  m = s.match(/^N(\d)-?R?(\d{1,3})$/);
  if (m) {
    return {
      zone_name: `NET-${m[1]}`,
      rack_number: Number(m[2])
    };
  }

  // 3) แบบ T1-02 หรือ TEL-1-2 ให้แปลงเป็น TEL-1
  m = s.match(/^T(\d)-?R?(\d{1,3})$/);
  if (m) {
    return {
      zone_name: `TEL-${m[1]}`,
      rack_number: Number(m[2])
    };
  }

  return null;
}

function parseUnit(text) {
  const s = clean(text).toUpperCase();
  if (!s) return null;

  const mU = s.match(/^U?(\d+)(?:[-–]U?(\d+))?$/);
  if (mU) {
    const start = Number(mU[1]);
    const end = mU[2] ? Number(mU[2]) : start;
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    return { start: min, size: max - min + 1, explicit: true };
  }
  return null;
}

async function syncRows(table, rows, site = 'IDC3-1') {
  const summary = { synced: 0, failed: [] };
  if (!rows || rows.length === 0) return summary;

  // 1. ดึงเฉพาะตู้ของ site นี้
  const { data: racks, error: rErr } = await supabase
    .from('server_racks')
    .select('id, zone_name, rack_number, power_status, site')
    .eq('site', site);

  if (rErr) throw rErr;

  // 2. Map Key รูปแบบ `${r.site}|${zone_name}|${rack_number}`
  const rackMap = new Map(
    (racks || []).map((r) => [
      `${r.site}|${String(r.zone_name ?? '').trim().toUpperCase()}|${String(r.rack_number ?? '').trim()}`,
      r
    ])
  );
  
  const devCache = new Map();

  const loadDevices = async (rackId) => {
    if (!devCache.has(rackId)) {
      const { data, error } = await supabase
        .from('rack_devices')
        .select('id, start_unit, unit_size, model')
        .eq('rack_id', rackId);
      if (error) throw error;
      devCache.set(rackId, data || []);
    }
    return devCache.get(rackId);
  };

  const mark = async (id, status, note, deviceId) => {
    const patch = { sync_status: status, sync_note: note || null };
    if (deviceId !== undefined) patch.rack_device_id = deviceId;
    const { error } = await supabase.from(table).update(patch).eq('id', id);
    if (error) console.error('mark error:', error.message);
  };

  for (const row of rows) {
    const fail = async (status, note) => {
      await mark(row.id, status, note);
      summary.failed.push({ hostname: row.hostname, status, note });
    };

    try {
      const locText = clean(row.location);
      if (!locText) { await fail('no_location', 'ยังไม่ได้ระบุ Location'); continue; }

      const loc = parseLocation(locText);
      if (!loc) { await fail('bad_location', `อ่านรหัส "${locText}" ไม่ได้`); continue; }

      // 3. แก้ไขให้ค้นหาโดยใส่ site นำหน้าให้ตรงกับ Key ใน Map
      const searchKey = `${site}|${loc.zone_name.toUpperCase()}|${String(loc.rack_number).trim()}`;
      const rack = rackMap.get(searchKey);
      
      if (!rack) { 
        await fail('rack_not_found', `ไม่พบตู้ ${loc.zone_name} หมายเลข ${loc.rack_number} ใน Site ${site}`); 
        continue; 
      }

      const unit = parseUnit(row.position_u);
      if (!unit) { await fail('no_unit', 'ยังไม่ได้ระบุตำแหน่ง U'); continue; }

      let existing = null;
      if (row.rack_device_id) {
        const { data } = await supabase
          .from('rack_devices')
          .select('id, rack_id, unit_size')
          .eq('id', row.rack_device_id)
          .maybeSingle();
        existing = data || null;
      }
      if (!existing && clean(row.serial_number)) {
        const { data } = await supabase
          .from('rack_devices')
          .select('id, rack_id, unit_size')
          .eq('serial_number', clean(row.serial_number))
          .limit(1)
          .maybeSingle();
        existing = data || null;
      }

      const size = unit.explicit ? unit.size : (existing?.unit_size || 1);

      const devices = await loadDevices(rack.id);
      const clash = devices.find(
        (d) =>
          d.id !== existing?.id &&
          d.start_unit != null &&
          unit.start < d.start_unit + (d.unit_size || 1) &&
          d.start_unit < unit.start + size
      );
      if (clash) {
        await fail('overlap', `U${unit.start} ชนกับ ${clash.model || 'อุปกรณ์อื่น'} ที่ U${clash.start_unit}`);
        continue;
      }

      const payload = {
        rack_id: rack.id,
        start_unit: unit.start,
        unit_size: size,
        model: clean(row.model) || null,
        serial_number: clean(row.serial_number) || null,
        hostname: clean(row.hostname) || null,
        brand: clean(row.brand) || null,
      };

      let deviceId;
      if (existing) {
        const { error } = await supabase.from('rack_devices').update(payload).eq('id', existing.id);
        if (error) throw error;
        deviceId = existing.id;
      } else {
        const { data, error } = await supabase.from('rack_devices').insert(payload).select('id').single();
        if (error) throw error;
        deviceId = data.id;
      }

      for (const [rid, list] of devCache) {
        devCache.set(rid, list.filter((d) => d.id !== deviceId));
      }
      devCache.get(rack.id).push({ id: deviceId, start_unit: unit.start, unit_size: size, model: payload.model });

      if (AUTO_MARK_INSTALLED && rack.power_status === 'NOT_INSTALLED') {
        const { error } = await supabase.from('server_racks').update({ power_status: 'POWER_ON' }).eq('id', rack.id);
        if (!error) rack.power_status = 'POWER_ON';
      }

      await mark(row.id, 'synced', null, deviceId);
      summary.synced++;
    } catch (err) {
      await fail('error', err.message);
    }
  }

  return summary;
}

module.exports = { syncRows, parseLocation, parseUnit };