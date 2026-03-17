const express = require('express');
const router = express.Router();

router.get('/polling', (req, res) => {
    res.json({ message: 'SNMP polling endpoint' });
});

router.get('/metrics', (req, res) => {
    res.json({ message: 'SNMP metrics endpoint' });
});

router.get('/devices', (req, res) => {
    res.json({ message: 'SNMP devices endpoint' });
});

module.exports = router;
