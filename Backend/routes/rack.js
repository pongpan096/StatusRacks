const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { checkAuth } = require('../middleware/auth');

// ดึงข้อมูล Rack ทั้งหมด
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('server_racks').select('*');
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

// อัปเดตสถานะ Rack พร้อมบันทึก Log
router.patch('/:id/status', checkAuth, async (req, res) => {
  const { id } = req.params;
  const { power_status } = req.body;

  const { data: oldRack } = await supabase
    .from('server_racks')
    .select('power_status')
    .eq('id', id)
    .single();

  const { data, error } = await supabase
    .from('server_racks')
    .update({
      power_status,
      updated_at: new Date(),
      updated_by: req.user.id
    })
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ message: error.message });

  await supabase.from('audit_logs').insert({
    user_id: req.user.id,
    user_email: req.user.email,
    action: 'UPDATE_RACK_STATUS',
    target_table: 'server_racks',
    target_id: id.toString(),
    old_value: oldRack?.power_status,
    new_value: power_status
  });

  res.json(data[0]);
});

module.exports = router;