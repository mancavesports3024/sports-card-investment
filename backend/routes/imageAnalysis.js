const express = require('express');
const multer = require('multer');
const imageAnalysisService = require('../services/imageAnalysisService');

const router = express.Router();

// Configure multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * POST /api/analyze-image
 * Analyze an uploaded image to extract card information
 */
router.post('/analyze-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No image file provided' 
      });
    }

    console.log('Analyzing uploaded image:', req.file.originalname);
    
    // Analyze the image
    const result = await imageAnalysisService.analyzeCardImage(req.file.buffer);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error in image analysis route:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to analyze image' 
    });
  }
});

/**
 * POST /api/analyze-base64
 * Analyze a base64 encoded image
 */
router.post('/analyze-base64', async (req, res) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ 
        success: false, 
        error: 'No image data provided' 
      });
    }

    console.log('Analyzing base64 image data');
    
    // Analyze the base64 image
    const result = await imageAnalysisService.analyzeBase64Image(imageData);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error in base64 image analysis route:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to analyze image' 
    });
  }
});

module.exports = router; 