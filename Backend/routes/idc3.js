const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

const TABLES = {
  'IDC3-1': 'idc3_1_inventory',
  'IDC3-2': 'idc3_2_inventory',
};
const getTable = (site) => TABLES[site] || null;
const clean = (v) => String(v ?? '').trim();

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
        serial_number: clean(r.serial_number) || null, // ว่าง = NULL
      };

      // ต้องมี Hostname อย่างน้อย
      if (!item.hostname) { skipped++; continue; }

      if (item.serial_number) {
        const key = item.serial_number.toUpperCase();
        if (seenSn.has(key)) { skipped++; continue; }
        seenSn.add(key);
        withSn.push(item);
      } else {
        // ไม่มี S/N: ใช้ Hostname + Rack + U เป็นตัวกันซ้ำ
        const key = [item.hostname, item.location, item.position_u].join('|').toUpperCase();
        if (seenNoSn.has(key)) { skipped++; continue; }
        seenNoSn.add(key);
        noSn.push({ ...item, _key: key });
      }
    }

    // 1) แถวที่มี S/N: เพิ่มใหม่ หรืออัปเดตตาม S/N
    if (withSn.length > 0) {
      const { error } = await supabase
        .from(table)
        .upsert(withSn, { onConflict: 'serial_number' });
      if (error) throw error;
    }

    // 2) แถวที่ไม่มี S/N: เพิ่มเฉพาะที่ยังไม่มีในตาราง
    let insertedNoSn = 0;
    if (noSn.length > 0) {
      const { data: existing, error: exErr } = await supabase
        .from(table)
        .select('hostname, location, position_u')
        .is('serial_number', null);
      if (exErr) throw exErr;

      const existKeys = new Set(
        (existing || []).map((e) =>
          [clean(e.hostname), clean(e.location), clean(e.position_u)].join('|').toUpperCase()
        )
      );

      const toInsert = noSn
        .filter((x) => !existKeys.has(x._key))
        .map(({ _key, ...rest }) => rest);

      skipped += noSn.length - toInsert.length;

      if (toInsert.length > 0) {
        const { error } = await supabase.from(table).insert(toInsert);
        if (error) throw error;
        insertedNoSn = toInsert.length;
      }
    }

    res.json({
      message: 'นำเข้าสำเร็จ',
      imported: withSn.length + insertedNoSn,
      withoutSn: insertedNoSn,
      skipped,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/idc3/:id?site=IDC3-1  (แก้ไขรายการ)
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
        serial_number: clean(b.serial_number) || null,
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
    res.json(data);
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