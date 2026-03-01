const express = require('express');
const router = express.Router();
const psaService = require('../services/psaService');

// GET /api/psa/cert/:certNumber - Look up a PSA cert by number
router.get('/cert/:certNumber', async (req, res) => {
  try {
    const { certNumber } = req.params;

    const result = await psaService.getCertByNumber(certNumber);

    if (!result.success) {
      const status = result.status || 400;
      return res.status(status).json({
        success: false,
        error: result.error || 'Failed to fetch PSA cert',
        details: result.details || null,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: result.data,
      status: result.status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ PSA route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while calling PSA API',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;

