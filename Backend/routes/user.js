const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { verifyToken, checkPermission } = require('../middleware/auth');

router.get('/', verifyToken, checkPermission('manage_user'), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT u.user_id, u.username, u.full_name, r.role_name, u.status
    FROM users u JOIN roles r ON u.role_id=r.role_id`);
  res.json(rows);
});

router.post('/', verifyToken, checkPermission('manage_user'), async (req, res) => {
  const { username, password, full_name, role_id } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO users (username, password_hash, full_name, role_id) VALUES (?,?,?,?)',
    [username, hash, full_name, role_id]
  );
  res.json({ message: 'สร้างผู้ใช้สำเร็จ' });
});

module.exports = router;