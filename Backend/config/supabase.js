const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // ← เปลี่ยนจาก SECRET_KEY เป็น KEY

console.log('ตรวจสอบ SUPABASE_URL:', !!supabaseUrl);
console.log('ตรวจสอบ SUPABASE_KEY:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  throw new Error('ไม่พบ SUPABASE_URL หรือ SUPABASE_KEY ในไฟล์ .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;