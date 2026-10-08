const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// 1. GET /api/rack-devices — รองรับทั้งดึงทั้งหมด หรือกรองตาม rack_id
router.get('/', async (req, res) => {
  try {
    const { rack_id } = req.query;
    let query = supabase.from('rack_devices').select('*');

    if (rack_id) {
      query = query.eq('rack_id', rack_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. GET /api/rack-devices/search-serial — ค้นหาด้วย Serial Number
router.get('/search-serial', async (req, res) => {
  try {
    const { serial } = req.query;
    if (!serial || serial.trim().length === 0) {
      return res.json([]);
    }

    const { data, error } = await supabase
      .from('rack_devices')
      .select('*')
      .ilike('serial_number', `%${serial.trim()}%`);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. PUT /api/rack-devices/:id/relocate — ย้ายอุปกรณ์ไปตู้แร็คอื่น
router.put('/:id/relocate', async (req, res) => {
  const { id } = req.params;
  const { target_rack_id, new_start_unit } = req.body;

  try {
    if (!target_rack_id || !new_start_unit) {
      return res.status(400).json({ message: 'กรุณาระบุตู้ปลายทางและ Unit เริ่มต้นให้ครบถ้วน' });
    }

    const { data: targetDevice, error: fetchErr } = await supabase
      .from('rack_devices')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !targetDevice) {
      return res.status(404).json({ message: 'ไม่พบอุปกรณ์ที่ต้องการย้าย' });
    }

    const deviceSize = Number(targetDevice.unit_size) || 1;
    const startU = Number(new_start_unit);
    const endU = startU - deviceSize + 1;

    if (startU > 42 || endU < 1) {
      return res.status(400).json({ message: 'ตำแหน่ง Unit เริ่มต้นหรือขนาดอุปกรณ์เกินขอบเขตตู้แร็ค (1-42)' });
    }

    const { data: existingDevices, error: checkErr } = await supabase
      .from('rack_devices')
      .select('*')
      .eq('rack_id', target_rack_id)
      .neq('id', id);

    if (checkErr) throw checkErr;

    for (const d of existingDevices) {
      const dStart = Number(d.start_unit);
      const dSize = Number(d.unit_size) || 1;
      const dEnd = dStart - dSize + 1;

      const isOverlap = startU >= dEnd && endU <= dStart;
      if (isOverlap) {
        return res.status(400).json({ 
          message: `ไม่สามารถย้ายได้ เนื่องจากทับซ้อนกับอุปกรณ์ ${d.model} (ช่วง U${dStart} - U${dEnd})` 
        });
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from('rack_devices')
      .update({
        rack_id: target_rack_id,
        start_unit: startU,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ message: 'ย้ายอุปกรณ์สำเร็จ', data: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. POST /api/rack-devices — เพิ่มอุปกรณ์ใหม่
router.post('/', async (req, res) => {
  try {
    const { rack_id, model, serial_number, start_unit, unit_size, note } = req.body;
    const { data, error } = await supabase
      .from('rack_devices')
      .insert([{ rack_id, model, serial_number, start_unit, unit_size, note }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. PUT /api/rack-devices/:id — แก้ไขอุปกรณ์
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { model, serial_number, start_unit, unit_size, note } = req.body;
    const { data, error } = await supabase
      .from('rack_devices')
      .update({ model, serial_number, start_unit, unit_size, note })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. DELETE /api/rack-devices/:id — ลบอุปกรณ์
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('rack_devices').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'ลบอุปกรณ์สำเร็จ' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;