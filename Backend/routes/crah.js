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
  res.json(data[0]);
});

module.exports = router;