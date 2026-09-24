const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ดึงข้อมูล CRAH ทั้งหมด
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('crah_units')
    .select('*')
    .order('crah_number', { ascending: true });

  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

// ดึงข้อมูล CRAH รายตัวตาม id — เพิ่มใหม่
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('crah_units')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return res.status(500).json({ message: error.message });
  if (!data) return res.status(404).json({ message: 'ไม่พบข้อมูล CRAH นี้' });
  res.json(data);
});

// อัปเดตสถานะ CRAH
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const { data, error } = await supabase
    .from('crah_units')
    .update({ status })
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ message: error.message });
  if (!data || data.length === 0) {
    return res.status(404).json({ message: 'ไม่พบข้อมูล CRAH ที่ต้องการอัปเดต' });
  }
  res.json(data[0]);
});

module.exports = router;