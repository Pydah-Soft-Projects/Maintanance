const express = require('express');
const router = express.Router();
const DEFAULT_COLLEGES = [
    { id: 1, name: 'Pydah College of Engineering', code: 'PCE' },
    { id: 2, name: 'Pydah Degree College', code: 'PDC' },
    { id: 3, name: 'Pydah College of Pharmacy', code: 'PCP' },
    { id: 4, name: 'Pydah College of Education', code: 'PCOE' },
    { id: 5, name: 'Pydah Polytechnic', code: 'POLY' }
];

/**
 * GET /api/colleges/active or /api/colleges/public
 * Get all active colleges for dropdown selections
 */
const getActiveColleges = async (_req, res) => {
    res.json({ success: true, data: DEFAULT_COLLEGES });
};

router.get('/active', getActiveColleges);
router.get('/public', getActiveColleges);
router.get('/', getActiveColleges);

module.exports = router;
