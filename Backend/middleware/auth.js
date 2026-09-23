const supabase = require('../config/supabase');

// ตรวจสอบว่ามี Token และดึง Role ผู้ใช้ปัจจุบัน
async function checkAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ message: 'Token ไม่ถูกต้อง' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  req.user = profile; // แนบข้อมูล user + role ไปกับ request
  next();
}

// เฉพาะ Admin เท่านั้น
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'เฉพาะ Admin เท่านั้น' });
  }
  next();
}

module.exports = { checkAuth, adminOnly };