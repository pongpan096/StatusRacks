// routes/rackDevices.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/', async (req, res) => {
    const { data, error } = await supabase
        .from('rack_devices')
        .select('*')
        .eq('rack_id', req.query.rack_id)
        .order('start_unit', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
});

router.post('/', async (req, res) => {
    const { data, error } = await supabase
        .from('rack_devices').insert(req.body).select().single();
    if (error) return res.status(500).json({ message: error.message });
    res.status(201).json(data);
});

router.put('/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('rack_devices').update(req.body).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
});

router.delete('/:id', async (req, res) => {
    const { error } = await supabase
        .from('rack_devices').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ success: true });
});

module.exports = router;