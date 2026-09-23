const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// สมัคร/สร้าง Sub User (เฉพาะ Admin เท่านั้นที่เรียกได้)
router.post('/create-sub-user', async (req, res) => {
  const { email, password, full_name, adminId } = req.body;

  // เช็คก่อนว่าคนเรียกเป็น admin จริง
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', adminId)
    .single();

  if (!adminProfile || adminProfile.role !== 'admin') {
    return res.status(403).json({ message: 'ไม่มีสิทธิ์สร้างผู้ใช้' });
  }

  // สร้างบัญชีผู้ใช้ใหม่ผ่าน Supabase Auth
  const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authError) return res.status(400).json({ message: authError.message });

  // เพิ่มข้อมูลลง profiles พร้อมผูกกับ admin ที่สร้าง
  const { error: profileError } = await supabase.from('profiles').insert({
    id: newUser.user.id,
    email,
    full_name,
    role: 'sub_user',
    created_by: adminId
  });

  if (profileError) return res.status(400).json({ message: profileError.message });

  res.json({ message: 'สร้าง Sub User สำเร็จ', user: newUser.user });
});

// ดึงรายชื่อ Sub User ทั้งหมดของ Admin คนนี้
router.get('/sub-users/:adminId', async (req, res) => {
  const { adminId } = req.params;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('created_by', adminId);

  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

module.exports = router;