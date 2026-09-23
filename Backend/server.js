require('dotenv').config();

const express = require('express');
const cors = require('cors');
const supabase = require('./config/supabase');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Data Center Floor Plan Backend is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ message: 'Backend ทำงานปกติ' });
});

app.get('/api/test-racks', async (req, res) => {
  const { data, error } = await supabase.from('server_racks').select('*');
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

app.use('/api/racks', require('./routes/rack'));
app.use('/api/crah', require('./routes/crah'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/audit', require('./routes/audit'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started: http://localhost:${PORT}`));