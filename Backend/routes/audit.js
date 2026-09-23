const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { checkAuth, adminOnly } = require('../middleware/auth');

// Admin ดูประวัติการแก้ไขทั้งหมดของ Sub User ตัวเอง
router.get('/', checkAuth, adminOnly, async (req, res) => {
  // ดึงรายชื่อ sub user ที่ admin คนนี้สร้าง
  const { data: subUsers } = await supabase
    .from('profiles')
    .select('id')
    .eq('created_by', req.user.id);

  const userIds = [req.user.id, ...(subUsers?.map(u => u.id) || [])];

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .in('user_id', userIds)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

module.exports = router;