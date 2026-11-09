const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { syncRows } = require('../utils/idc3Sync');

const TABLES = {
  'IDC3-1': 'idc3_1_inventory',
  'IDC3-2': 'idc3_2_inventory',
};
const getTable = (site) => TABLES[site] || null;
const clean = (v) => String(v ?? '').trim();

const PLACEHOLDER = new Set(['-', '--', 'N/A', 'NA', 'TBD', 'NONE', 'NULL', 'UNKNOWN']);
const cleanSn = (v) => {
  const s = clean(v);
  return s && !PLACEHOLDER.has(s.toUpperCase()) ? s.toUpperCase() : null;
};
const keyOf = (x) =>
  [clean(x.hostname), clean(x.location), clean(x.position_u)].join('|').toUpperCase();

// GET /api/idc3?site=IDC3-1
router.get('/', async (req, res) => {
  try {
    const table = getTable(req.query.site);
    if (!table) return res.status(400).json({ message: 'site ไม่ถูกต้อง' });

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/idc3/import  { site, rows: [...] }
router.post('/import', async (req, res) => {
  try {
    const { site, rows } = req.body;
    const table = getTable(site);
    if (!table) return res.status(400).json({ message: 'site ไม่ถูกต้อง' });
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: 'ไม่มีข้อมูลสำหรับนำเข้า' });
    }

    const seenSn = new Set();
    const seenNoSn = new Set();
    const withSn = [];
    const noSn = [];
    let skipped = 0;

    for (const r of rows) {
      const item = {
        hostname: clean(r.hostname),
        location: clean(r.location),
        position_u: clean(r.position_u),
        brand: clean(r.brand),
        model: clean(r.model),
        serial_number: cleanSn(r.serial_number),
      };

      if (!item.hostname) { skipped++; continue; }

      if (item.serial_number) {
        if (seenSn.has(item.serial_number)) { skipped++; continue; }
        seenSn.add(item.serial_number);
        withSn.push(item);
      } else {
        const key = keyOf(item);
        if (seenNoSn.has(key)) { skipped++; continue; }
        seenNoSn.add(key);
        noSn.push({ ...item, _key: key });
      }
    }

    const touched = []; // แถวที่เพิ่ง เพิ่ม/แก้ ในรอบนี้ (ใช้ซิงก์ต่อ)

    // 1) แถวที่มี S/N: จับคู่กับแถวเก่าที่ยังไม่มี S/N ก่อน
    const { data: pending, error: pErr } = await supabase
      .from(table)
      .select('id, hostname, location, position_u')
      .is('serial_number', null);
    if (pErr) throw pErr;

    const pendingMap = new Map();
    for (const p of pending || []) {
      if (!pendingMap.has(keyOf(p))) pendingMap.set(keyOf(p), p.id);
    }

    const toUpsert = [];
    let filled = 0;

    for (const item of withSn) {
      const pid = pendingMap.get(keyOf(item));
      if (pid) {
        const { data, error } = await supabase
          .from(table).update(item).eq('id', pid).select().single();
        if (!error) { pendingMap.delete(keyOf(item)); filled++; touched.push(data); continue; }
        if (error.code !== '23505') throw error;
      }
      toUpsert.push(item);
    }

    if (toUpsert.length > 0) {
      const { data, error } = await supabase
        .from(table)
        .upsert(toUpsert, { onConflict: 'serial_number' })
        .select();
      if (error) throw error;
      touched.push(...(data || []));
    }

    // 2) แถวที่ไม่มี S/N: เพิ่มเฉพาะที่ยังไม่มีในตาราง
    let insertedNoSn = 0;
    if (noSn.length > 0) {
      const { data: existing, error: exErr } = await supabase
        .from(table)
        .select('hostname, location, position_u')
        .is('serial_number', null);
      if (exErr) throw exErr;

      const existKeys = new Set((existing || []).map(keyOf));
      const toInsert = noSn
        .filter((x) => !existKeys.has(x._key))
        .map(({ _key, ...rest }) => rest);

      skipped += noSn.length - toInsert.length;

      if (toInsert.length > 0) {
        const { data, error } = await supabase.from(table).insert(toInsert).select();
        if (error) throw error;
        insertedNoSn = toInsert.length;
        touched.push(...(data || []));
      }
    }

    // 3) ซิงก์ไป FaceRack (ถ้าพัง ไม่ให้การนำเข้าล้มไปด้วย)
    let sync = { synced: 0, failed: [] };
    let syncError = null;
    try {
      sync = await syncRows(table, touched);
    } catch (e) {
      syncError = e.message;
      console.error('sync error:', e.message);
    }

    res.json({
      message: 'นำเข้าสำเร็จ',
      imported: withSn.length + insertedNoSn,
      filled,
      withoutSn: insertedNoSn,
      skipped,
      synced: sync.synced,
      notSynced: sync.failed.length,
      syncError,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/idc3/sync?site=IDC3-1  (ซิงก์ทุกแถวไป FaceRack ใหม่)
router.post('/sync', async (req, res) => {
  try {
    const table = getTable(req.query.site);
    if (!table) return res.status(400).json({ message: 'site ไม่ถูกต้อง' });

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const result = await syncRows(table, data || []);
    res.json({
      message: 'ซิงก์เสร็จ',
      synced: result.synced,
      notSynced: result.failed.length,
      failed: result.failed.slice(0, 50),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/idc3/:id?site=IDC3-1  (แก้ไข แล้วซิงก์ไป FaceRack)
router.put('/:id', async (req, res) => {
  try {
    const table = getTable(req.query.site);
    if (!table) return res.status(400).json({ message: 'site ไม่ถูกต้อง' });

    const b = req.body || {};
    if (!clean(b.hostname)) {
      return res.status(400).json({ message: 'ต้องกรอก Hostname' });
    }

    const { data, error } = await supabase
      .from(table)
      .update({
        hostname: clean(b.hostname),
        location: clean(b.location),
        position_u: clean(b.position_u),
        brand: clean(b.brand),
        model: clean(b.model),
        serial_number: cleanSn(b.serial_number),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'S/N นี้มีอยู่ในตารางแล้ว' });
      }
      throw error;
    }

    let out = data;
    try {
      await syncRows(table, [data]);
      const { data: fresh } = await supabase.from(table).select('*').eq('id', data.id).single();
      if (fresh) out = fresh;
    } catch (e) {
      console.error('sync error:', e.message);
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/idc3/:id?site=IDC3-1
router.delete('/:id', async (req, res) => {
  try {
    const table = getTable(req.query.site);
    if (!table) return res.status(400).json({ message: 'site ไม่ถูกต้อง' });

    const { error } = await supabase.from(table).delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'ลบสำเร็จ' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;