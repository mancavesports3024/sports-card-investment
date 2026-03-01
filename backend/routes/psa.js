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

// --- Population (SpecID from cert lookup; official API only has this) ---
// GET /api/psa/pop/spec/:specId - Population by spec (use SpecID from cert response, e.g. 14158474)
router.get('/pop/spec/:specId', async (req, res) => {
  try {
    const result = await psaService.getSpecPopulation(req.params.specId);
    return sendResult(res, result, 'Failed to fetch spec population');
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// --- Order progress ---
// GET /api/psa/order/progress/:orderNumber
router.get('/order/progress/:orderNumber', async (req, res) => {
  try {
    const result = await psaService.getOrderProgress(req.params.orderNumber);
    return sendResult(res, result, 'Failed to fetch order progress');
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// GET /api/psa/order/submission/:submissionNumber
router.get('/order/submission/:submissionNumber', async (req, res) => {
  try {
    const result = await psaService.getSubmissionProgress(req.params.submissionNumber);
    return sendResult(res, result, 'Failed to fetch submission progress');
  } catch (error) {
    return handleRouteError(res, error);
  }
});

// --- Cert images ---
// GET /api/psa/cert/:certNumber/images
router.get('/cert/:certNumber/images', async (req, res) => {
  try {
    const result = await psaService.getCertImages(req.params.certNumber);
    return sendResult(res, result, 'Failed to fetch cert images');
  } catch (error) {
    return handleRouteError(res, error);
  }
});

module.exports = router;

