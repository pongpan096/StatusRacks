const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

console.log('ตรวจพบ SUPABASE_URL:', !!supabaseUrl);
console.log('ตรวจพบ SUPABASE_SECRET_KEY:', !!supabaseSecretKey);

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('ไม่พบ SUPABASE_URL หรือ SUPABASE_SECRET_KEY ในไฟล์ .env');
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

module.exports = supabase;