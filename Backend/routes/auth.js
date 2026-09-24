const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// สมัคร/สร้าง Sub User (เฉพาะ Admin เท่านั้นเรียกได้)
router.post('/create-sub-user', async (req, res) => {
  const { email, password, full_name, adminId } = req.body;

  // เช็คสิทธิ์ก่อนว่าเป็น admin
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', adminId)
    .single();

  if (!adminProfile || adminProfile.role !== 'admin') {
    return res.status(403).json({ message: 'ไม่มีสิทธิ์ทำสิ่งนี้' });
  }

  // สร้างผู้ใช้ใหม่ผ่าน Supabase Auth
  const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
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

// เข้าสู่ระบบ (Login) — เพิ่มใหม่
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }

  res.json({
    token: data.session.access_token,
    user: data.user,
  });
});

module.exports = router;