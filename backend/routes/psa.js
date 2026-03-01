const express = require('express');
const router = express.Router();
const psaService = require('../services/psaService');

function sendResult(res, result, fallbackError = 'Request failed') {
  if (!result.success) {
    const status = result.status || 400;
    return res.status(status).json({
      success: false,
      error: result.error || fallbackError,
      details: result.details ?? null,
      timestamp: new Date().toISOString(),
    });
  }
  return res.json({
    success: true,
    data: result.data,
    status: result.status,
    timestamp: new Date().toISOString(),
  });
}

function handleRouteError(res, error) {
  console.error('❌ PSA route error:', error);
  const isAuthError = error.message && error.message.includes('PSA_API_TOKEN');
  res.status(500).json({
    success: false,
    error: isAuthError ? 'PSA API not configured' : 'Internal server error while calling PSA API',
    details: error.message || null,
    timestamp: new Date().toISOString(),
  });
}

// --- Cert lookup ---
// GET /api/psa/cert/:certNumber
router.get('/cert/:certNumber', async (req, res) => {
  try {
    const result = await psaService.getCertByNumber(req.params.certNumber);
    return sendResult(res, result, 'Failed to fetch PSA cert');
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// GET /api/psa/cert/order/:orderNumber - Cards by PSA order number
router.get('/cert/order/:orderNumber', async (req, res) => {
  try {
    const result = await psaService.getCardsByOrder(req.params.orderNumber);
    return sendResult(res, result, 'Failed to fetch order');
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// --- Population Report ---
// GET /api/psa/pop/sports
router.get('/pop/sports', async (req, res) => {
  try {
    const result = await psaService.getSports();
    return sendResult(res, result, 'Failed to fetch sports');
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// GET /api/psa/pop/brands
router.get('/pop/brands', async (req, res) => {
  try {
    const result = await psaService.getBrands();
    return sendResult(res, result, 'Failed to fetch brands');
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// GET /api/psa/pop/sets/year/:year
router.get('/pop/sets/year/:year', async (req, res) => {
  try {
    const result = await psaService.getSetsByYear(req.params.year);
    return sendResult(res, result, 'Failed to fetch sets by year');
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// GET /api/psa/pop/sets/brand/:brandId
router.get('/pop/sets/brand/:brandId', async (req, res) => {
  try {
    const result = await psaService.getSetsByBrand(req.params.brandId);
    return sendResult(res, result, 'Failed to fetch sets by brand');
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// GET /api/psa/pop/set/:setId - Set info
router.get('/pop/set/:setId', async (req, res) => {
  try {
    const result = await psaService.getSetInfo(req.params.setId);
    return sendResult(res, result, 'Failed to fetch set info');
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// GET /api/psa/pop/report/:setId - Population report for set (grades, etc.)
router.get('/pop/report/:setId', async (req, res) => {
  try {
    const result = await psaService.getPopulationReport(req.params.setId);
    return sendResult(res, result, 'Failed to fetch population report');
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// --- SMR Pricing ---
// GET /api/psa/smr/price/:certNumber
router.get('/smr/price/:certNumber', async (req, res) => {
  try {
    const result = await psaService.getSMRPriceByCertNumber(req.params.certNumber);
    return sendResult(res, result, 'Failed to fetch SMR price');
  } catch (error) {
    return handleRouteError(res, error);
  }
});

module.exports = router;

