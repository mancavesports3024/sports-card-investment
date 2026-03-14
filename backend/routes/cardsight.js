const express = require('express');
const router = express.Router();
const multer = require('multer');
const cardsight = require('../services/cardsightService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

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

function handleError(res, err) {
  console.error('CardSight route error:', err);
  const isAuth = err.message && err.message.includes('CARDSIGHT_API_KEY');
  res.status(500).json({
    success: false,
    error: isAuth ? 'CardSight API not configured' : 'Internal server error',
    details: err.message || null,
    timestamp: new Date().toISOString(),
  });
}

// POST /api/cardsight/identify – identify card from uploaded image
router.post('/identify', upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        error: 'No image uploaded. Send multipart/form-data with field "image".',
        timestamp: new Date().toISOString(),
      });
    }
    const result = await cardsight.identifyCard(req.file.buffer, req.file.originalname || 'image.jpg');
    return sendResult(res, result, 'Identification failed');
  } catch (err) {
    return handleError(res, err);
  }
});

// POST /api/cardsight/detect – detect card presence in image
router.post('/detect', upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        error: 'No image uploaded. Send multipart/form-data with field "image".',
        timestamp: new Date().toISOString(),
      });
    }
    const result = await cardsight.detectCard(req.file.buffer, req.file.originalname || 'image.jpg');
    return sendResult(res, result, 'Detection failed');
  } catch (err) {
    return handleError(res, err);
  }
});

// GET /api/cardsight/catalog/search – catalog search (query params passed through)
router.get('/catalog/search', async (req, res) => {
  try {
    const result = await cardsight.searchCatalog(req.query);
    return sendResult(res, result, 'Catalog search failed');
  } catch (err) {
    return handleError(res, err);
  }
});

// GET /api/cardsight/catalog/statistics
router.get('/catalog/statistics', async (req, res) => {
  try {
    const result = await cardsight.getCatalogStatistics();
    return sendResult(res, result, 'Failed to fetch statistics');
  } catch (err) {
    return handleError(res, err);
  }
});

// GET /api/cardsight/catalog/segments
router.get('/catalog/segments', async (req, res) => {
  try {
    const result = await cardsight.getSegments();
    return sendResult(res, result, 'Failed to fetch segments');
  } catch (err) {
    return handleError(res, err);
  }
});

// GET /api/cardsight/subscription – usage / plan info
router.get('/subscription', async (req, res) => {
  try {
    const result = await cardsight.getSubscription();
    return sendResult(res, result, 'Failed to fetch subscription');
  } catch (err) {
    return handleError(res, err);
  }
});

// GET /api/cardsight/health – validate API key
router.get('/health', async (req, res) => {
  try {
    const result = await cardsight.getHealthAuth();
    return sendResult(res, result, 'Health check failed');
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;
