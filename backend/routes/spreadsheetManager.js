const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const SpreadsheetManagerService = require('../services/spreadsheetManagerService');

const router = express.Router();
const spreadsheetManager = new SpreadsheetManagerService();

// Initialize the service
spreadsheetManager.initialize();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../data/spreadsheets'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/\.[^/.]+$/, ''); // Remove extension
    cb(null, `${timestamp}_${originalName}.csv`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Only allow CSV files
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// 1. UPLOAD AND IMPORT SPREADSHEET
router.post('/upload', upload.single('spreadsheet'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Please upload a CSV file'
      });
    }

    console.log(`📥 Processing uploaded file: ${req.file.filename}`);

    const filePath = req.file.path;
    const options = {
      validateSchema: req.body.validateSchema !== 'false',
      createBackup: req.body.createBackup !== 'false',
      generateMetadata: req.body.generateMetadata !== 'false',
      chunkSize: parseInt(req.body.chunkSize) || 1000
    };

    const result = await spreadsheetManager.importSpreadsheet(filePath, options);

    res.json({
      success: true,
      message: 'Spreadsheet uploaded and processed successfully',
      data: result,
      file: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        path: filePath
      }
    });

  } catch (error) {
    console.error('❌ Error uploading spreadsheet:', error);
    res.status(500).json({
      error: 'Failed to upload spreadsheet',
      message: error.message,
      details: error.stack
    });
  }
});

// 2. TRANSFORM AND SAVE TO DATABASE
router.post('/process/:databaseName', async (req, res) => {
  try {
    const { databaseName } = req.params;
    const { filePath, transformations = {}, saveOptions = {} } = req.body;

    if (!filePath) {
      return res.status(400).json({
        error: 'File path is required',
        message: 'Please provide the path to the CSV file to process'
      });
    }

    console.log(`🔄 Processing file for database: ${databaseName}`);

    // Import the spreadsheet
    const importResult = await spreadsheetManager.importSpreadsheet(filePath);
    
    // Transform the data
    const transformedData = await spreadsheetManager.transformData(
      importResult.data || [], 
      transformations
    );

    // Save to database
    const saveResult = await spreadsheetManager.saveToDatabase(
      transformedData, 
      databaseName, 
      saveOptions
    );

    res.json({
      success: true,
      message: 'Data processed and saved successfully',
      data: {
        import: importResult,
        transform: { recordCount: transformedData.length },
        save: saveResult
      }
    });

  } catch (error) {
    console.error('❌ Error processing spreadsheet:', error);
    res.status(500).json({
      error: 'Failed to process spreadsheet',
      message: error.message
    });
  }
});

// 3. UPDATE DATABASE
router.put('/update/:databaseName', async (req, res) => {
  try {
    const { databaseName } = req.params;
    const { updates, options = {} } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        error: 'Updates array is required',
        message: 'Please provide an array of records to update'
      });
    }

    console.log(`🔄 Updating database: ${databaseName} with ${updates.length} records`);

    const result = await spreadsheetManager.updateData(databaseName, updates, options);

    res.json({
      success: true,
      message: 'Database updated successfully',
      data: result
    });

  } catch (error) {
    console.error('❌ Error updating database:', error);
    res.status(500).json({
      error: 'Failed to update database',
      message: error.message
    });
  }
});

// 4. REMOVE DATA FROM DATABASE
router.delete('/remove/:databaseName', async (req, res) => {
  try {
    const { databaseName } = req.params;
    const { criteria, options = {} } = req.body;

    if (!criteria) {
      return res.status(400).json({
        error: 'Removal criteria is required',
        message: 'Please provide criteria for data removal'
      });
    }

    console.log(`🗑️ Removing data from database: ${databaseName}`);

    const result = await spreadsheetManager.removeData(databaseName, criteria, options);

    res.json({
      success: true,
      message: 'Data removed successfully',
      data: result
    });

  } catch (error) {
    console.error('❌ Error removing data:', error);
    res.status(500).json({
      error: 'Failed to remove data',
      message: error.message
    });
  }
});

// 5. SEARCH DATABASE
router.get('/search/:databaseName', async (req, res) => {
  try {
    const { databaseName } = req.params;
    const { 
      query, 
      limit = 100, 
      offset = 0, 
      sortBy, 
      sortOrder = 'asc' 
    } = req.query;

    console.log(`🔍 Searching database: ${databaseName}`);

    const result = await spreadsheetManager.searchData(databaseName, query, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Error searching database:', error);
    res.status(500).json({
      error: 'Failed to search database',
      message: error.message
    });
  }
});

// 6. GET DATABASE ANALYTICS
router.get('/analytics/:databaseName', async (req, res) => {
  try {
    const { databaseName } = req.params;

    console.log(`📊 Generating analytics for database: ${databaseName}`);

    const analytics = await spreadsheetManager.generateAnalytics(databaseName);

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('❌ Error generating analytics:', error);
    res.status(500).json({
      error: 'Failed to generate analytics',
      message: error.message
    });
  }
});

// 7. LIST ALL DATABASES
router.get('/databases', async (req, res) => {
  try {
    const processedDir = path.join(__dirname, '../data/processed');
    
    try {
      const files = await fs.readdir(processedDir);
      const databases = [];

      for (const file of files) {
        if (file.endsWith('.json') && !file.includes('_analytics') && !file.includes('_indexes')) {
          const filePath = path.join(processedDir, file);
          const stats = await fs.stat(filePath);
          
          try {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            
            databases.push({
              name: file.replace('.json', ''),
              recordCount: data.metadata?.recordCount || data.data?.length || 0,
              created: data.metadata?.created || stats.birthtime.toISOString(),
              lastModified: stats.mtime.toISOString(),
              size: stats.size,
              version: data.metadata?.version || '1.0'
            });
          } catch (parseError) {
            console.warn(`⚠️ Could not parse database file: ${file}`);
          }
        }
      }

      res.json({
        success: true,
        data: {
          databases,
          total: databases.length
        }
      });

    } catch (dirError) {
      // Directory doesn't exist yet
      res.json({
        success: true,
        data: {
          databases: [],
          total: 0
        }
      });
    }

  } catch (error) {
    console.error('❌ Error listing databases:', error);
    res.status(500).json({
      error: 'Failed to list databases',
      message: error.message
    });
  }
});

// 8. GET DATABASE METADATA
router.get('/metadata/:databaseName', async (req, res) => {
  try {
    const { databaseName } = req.params;

    console.log(`📋 Getting metadata for database: ${databaseName}`);

    const database = await spreadsheetManager.loadDatabase(databaseName);

    res.json({
      success: true,
      data: database.metadata
    });

  } catch (error) {
    console.error('❌ Error getting metadata:', error);
    res.status(500).json({
      error: 'Failed to get metadata',
      message: error.message
    });
  }
});

// 9. VALIDATE DATA
router.post('/validate', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        error: 'Data array is required',
        message: 'Please provide an array of records to validate'
      });
    }

    console.log(`✅ Validating ${data.length} records`);

    const validation = await spreadsheetManager.validateData(data);

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    console.error('❌ Error validating data:', error);
    res.status(500).json({
      error: 'Failed to validate data',
      message: error.message
    });
  }
});

// 10. EXPORT DATABASE TO CSV
router.get('/export/:databaseName', async (req, res) => {
  try {
    const { databaseName } = req.params;
    const { format = 'csv' } = req.query;

    console.log(`📤 Exporting database: ${databaseName} as ${format}`);

    const database = await spreadsheetManager.loadDatabase(databaseName);
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvData = await spreadsheetManager.convertToCsv(database.data);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${databaseName}.csv"`);
      res.send(csvData);
    } else {
      res.json({
        success: true,
        data: database
      });
    }

  } catch (error) {
    console.error('❌ Error exporting database:', error);
    res.status(500).json({
      error: 'Failed to export database',
      message: error.message
    });
  }
});

// 11. BULK OPERATIONS
router.post('/bulk/:operation', async (req, res) => {
  try {
    const { operation } = req.params;
    const { databases, data, options = {} } = req.body;

    console.log(`🔄 Performing bulk operation: ${operation}`);

    const results = [];

    switch (operation) {
      case 'update':
        for (const dbName of databases) {
          try {
            const result = await spreadsheetManager.updateData(dbName, data, options);
            results.push({ database: dbName, success: true, data: result });
          } catch (error) {
            results.push({ database: dbName, success: false, error: error.message });
          }
        }
        break;

      case 'remove':
        for (const dbName of databases) {
          try {
            const result = await spreadsheetManager.removeData(dbName, data, options);
            results.push({ database: dbName, success: true, data: result });
          } catch (error) {
            results.push({ database: dbName, success: false, error: error.message });
          }
        }
        break;

      case 'analytics':
        for (const dbName of databases) {
          try {
            const analytics = await spreadsheetManager.generateAnalytics(dbName);
            results.push({ database: dbName, success: true, data: analytics });
          } catch (error) {
            results.push({ database: dbName, success: false, error: error.message });
          }
        }
        break;

      default:
        return res.status(400).json({
          error: 'Invalid operation',
          message: 'Supported operations: update, remove, analytics'
        });
    }

    res.json({
      success: true,
      data: {
        operation,
        results,
        summary: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error performing bulk operation:', error);
    res.status(500).json({
      error: 'Failed to perform bulk operation',
      message: error.message
    });
  }
});

// 12. HEALTH CHECK
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'SpreadsheetManager',
      version: '1.0.0',
      directories: {
        data: await checkDirectory(spreadsheetManager.dataDirectory),
        processed: await checkDirectory(spreadsheetManager.processedDirectory),
        backup: await checkDirectory(spreadsheetManager.backupDirectory)
      }
    };

    res.json(health);

  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to check directory status
async function checkDirectory(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    return {
      exists: true,
      readable: true,
      writable: true,
      size: stats.size
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

module.exports = router; 