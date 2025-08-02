const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { createReadStream, createWriteStream } = require('fs');

class SpreadsheetManagerService {
  constructor() {
    this.dataDirectory = path.join(__dirname, '../data/spreadsheets');
    this.processedDirectory = path.join(__dirname, '../data/processed');
    this.backupDirectory = path.join(__dirname, '../data/backups');
    this.metadataFile = path.join(__dirname, '../data/spreadsheet-metadata.json');
  }

  async initialize() {
    // Create necessary directories
    const directories = [this.dataDirectory, this.processedDirectory, this.backupDirectory];
    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    }
  }

  // 1. SPREADSHEET IMPORT & VALIDATION
  async importSpreadsheet(filePath, options = {}) {
    const {
      validateSchema = true,
      createBackup = true,
      generateMetadata = true,
      chunkSize = 1000
    } = options;

    console.log(`📥 Importing spreadsheet: ${filePath}`);

    // Create backup
    if (createBackup) {
      await this.createBackup(filePath);
    }

    // Read and validate
    const data = await this.readSpreadsheet(filePath, chunkSize);
    
    if (validateSchema) {
      const validation = await this.validateData(data);
      if (!validation.isValid) {
        throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Generate metadata
    if (generateMetadata) {
      await this.generateMetadata(filePath, data);
    }

    return {
      success: true,
      recordCount: data.length,
      metadata: await this.getMetadata(filePath)
    };
  }

  // 2. DATA VALIDATION & CLEANING
  async validateData(data) {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(data) || data.length === 0) {
      errors.push('Data must be a non-empty array');
      return { isValid: false, errors, warnings };
    }

    // Check for required fields (customize based on your schema)
    const requiredFields = ['id', 'name']; // Example required fields
    const sampleRecord = data[0];
    
    for (const field of requiredFields) {
      if (!sampleRecord.hasOwnProperty(field)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Data type validation
    data.forEach((record, index) => {
      if (record.id && typeof record.id !== 'string' && typeof record.id !== 'number') {
        errors.push(`Invalid ID type at row ${index + 1}`);
      }
    });

    // Duplicate detection
    const duplicates = this.findDuplicates(data, 'id');
    if (duplicates.length > 0) {
      warnings.push(`Found ${duplicates.length} duplicate records`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      duplicates
    };
  }

  // 3. DATA TRANSFORMATION & ENRICHMENT
  async transformData(data, transformations = {}) {
    const {
      addTimestamps = true,
      generateIds = false,
      normalizeFields = true,
      enrichWithExternalData = false
    } = transformations;

    let transformedData = [...data];

    // Add timestamps
    if (addTimestamps) {
      const timestamp = new Date().toISOString();
      transformedData = transformedData.map(record => ({
        ...record,
        importedAt: timestamp,
        lastUpdated: timestamp
      }));
    }

    // Generate IDs if needed
    if (generateIds) {
      transformedData = transformedData.map((record, index) => ({
        ...record,
        id: record.id || `auto_${Date.now()}_${index}`
      }));
    }

    // Normalize fields
    if (normalizeFields) {
      transformedData = transformedData.map(record => this.normalizeRecord(record));
    }

    // Enrich with external data (example)
    if (enrichWithExternalData) {
      transformedData = await this.enrichData(transformedData);
    }

    return transformedData;
  }

  // 4. DATABASE STORAGE & INDEXING
  async saveToDatabase(data, databaseName, options = {}) {
    const {
      createIndexes = true,
      compressData = false,
      splitLargeFiles = false,
      maxFileSize = 10 * 1024 * 1024 // 10MB
    } = options;

    const databasePath = path.join(this.processedDirectory, `${databaseName}.json`);
    
    // Split large datasets if needed
    let filesToSave = [data];
    if (splitLargeFiles && JSON.stringify(data).length > maxFileSize) {
      filesToSave = this.splitData(data, maxFileSize);
    }

    // Save data
    for (let i = 0; i < filesToSave.length; i++) {
      const fileName = i === 0 ? databaseName : `${databaseName}_part${i}`;
      const filePath = path.join(this.processedDirectory, `${fileName}.json`);
      
      const databaseObject = {
        metadata: {
          name: fileName,
          recordCount: filesToSave[i].length,
          created: new Date().toISOString(),
          version: '1.0',
          source: 'spreadsheet-import'
        },
        data: filesToSave[i]
      };

      await fs.writeFile(filePath, JSON.stringify(databaseObject, null, 2));
      console.log(`💾 Saved ${filesToSave[i].length} records to ${filePath}`);
    }

    // Create indexes
    if (createIndexes) {
      await this.createIndexes(databaseName, data);
    }

    return {
      success: true,
      filesCreated: filesToSave.length,
      totalRecords: data.length
    };
  }

  // 5. UPDATE MANAGEMENT
  async updateData(databaseName, updates, options = {}) {
    const {
      updateStrategy = 'merge', // 'merge', 'replace', 'append'
      validateUpdates = true,
      createBackup = true
    } = options;

    const databasePath = path.join(this.processedDirectory, `${databaseName}.json`);
    
    // Load existing data
    const existingData = await this.loadDatabase(databaseName);
    
    // Create backup
    if (createBackup) {
      await this.createDatabaseBackup(databaseName);
    }

    let updatedData;
    switch (updateStrategy) {
      case 'merge':
        updatedData = this.mergeData(existingData.data, updates);
        break;
      case 'replace':
        updatedData = updates;
        break;
      case 'append':
        updatedData = [...existingData.data, ...updates];
        break;
      default:
        throw new Error(`Unknown update strategy: ${updateStrategy}`);
    }

    // Validate updates
    if (validateUpdates) {
      const validation = await this.validateData(updatedData);
      if (!validation.isValid) {
        throw new Error(`Update validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Save updated data
    await this.saveToDatabase(updatedData, databaseName, { createIndexes: false });

    return {
      success: true,
      originalCount: existingData.data.length,
      updatedCount: updatedData.length,
      changes: updatedData.length - existingData.data.length
    };
  }

  // 6. DATA REMOVAL & ARCHIVING
  async removeData(databaseName, criteria, options = {}) {
    const {
      archiveRemoved = true,
      softDelete = false,
      batchSize = 1000
    } = options;

    const databasePath = path.join(this.processedDirectory, `${databaseName}.json`);
    const existingData = await this.loadDatabase(databaseName);

    let filteredData = existingData.data;
    let removedData = [];

    // Apply removal criteria
    if (typeof criteria === 'function') {
      const results = this.filterDataWithCallback(existingData.data, criteria);
      filteredData = results.kept;
      removedData = results.removed;
    } else if (typeof criteria === 'object') {
      const results = this.filterDataByCriteria(existingData.data, criteria);
      filteredData = results.kept;
      removedData = results.removed;
    }

    // Handle removed data
    if (removedData.length > 0) {
      if (archiveRemoved) {
        await this.archiveData(removedData, databaseName);
      }
      
      if (softDelete) {
        // Mark as deleted instead of removing
        filteredData = existingData.data.map(record => ({
          ...record,
          deletedAt: removedData.some(r => r.id === record.id) ? new Date().toISOString() : record.deletedAt
        }));
      }
    }

    // Save updated data
    await this.saveToDatabase(filteredData, databaseName);

    return {
      success: true,
      originalCount: existingData.data.length,
      remainingCount: filteredData.length,
      removedCount: removedData.length
    };
  }

  // 7. SEARCH & QUERY CAPABILITIES
  async searchData(databaseName, query, options = {}) {
    const {
      limit = 100,
      offset = 0,
      sortBy = null,
      sortOrder = 'asc'
    } = options;

    const database = await this.loadDatabase(databaseName);
    let results = database.data;

    // Apply search query
    if (query) {
      results = this.searchRecords(results, query);
    }

    // Apply sorting
    if (sortBy) {
      results = this.sortRecords(results, sortBy, sortOrder);
    }

    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total: results.length,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(results.length / limit),
      hasMore: offset + limit < results.length
    };
  }

  // 8. ANALYTICS & REPORTING
  async generateAnalytics(databaseName) {
    const database = await this.loadDatabase(databaseName);
    const data = database.data;

    const analytics = {
      totalRecords: data.length,
      fieldStats: this.calculateFieldStats(data),
      dataQuality: this.assessDataQuality(data),
      trends: this.analyzeTrends(data),
      generatedAt: new Date().toISOString()
    };

    // Save analytics
    const analyticsPath = path.join(this.processedDirectory, `${databaseName}_analytics.json`);
    await fs.writeFile(analyticsPath, JSON.stringify(analytics, null, 2));

    return analytics;
  }

  // HELPER METHODS
  async readSpreadsheet(filePath, chunkSize = 1000) {
    return new Promise((resolve, reject) => {
      const results = [];
      const stream = createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          results.push(data);
          if (results.length % chunkSize === 0) {
            console.log(`📊 Processed ${results.length} records...`);
          }
        })
        .on('end', () => {
          console.log(`✅ Finished reading ${results.length} records from ${filePath}`);
          resolve(results);
        })
        .on('error', reject);
    });
  }

  normalizeRecord(record) {
    const normalized = {};
    
    for (const [key, value] of Object.entries(record)) {
      // Normalize field names
      const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
      
      // Normalize values
      let normalizedValue = value;
      if (typeof value === 'string') {
        normalizedValue = value.trim();
        if (normalizedValue === '') normalizedValue = null;
      }
      
      normalized[normalizedKey] = normalizedValue;
    }
    
    return normalized;
  }

  findDuplicates(data, field) {
    const seen = new Set();
    const duplicates = [];
    
    data.forEach(record => {
      const value = record[field];
      if (seen.has(value)) {
        duplicates.push(record);
      } else {
        seen.add(value);
      }
    });
    
    return duplicates;
  }

  splitData(data, maxSize) {
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;
    
    for (const record of data) {
      const recordSize = JSON.stringify(record).length;
      
      if (currentSize + recordSize > maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [record];
        currentSize = recordSize;
      } else {
        currentChunk.push(record);
        currentSize += recordSize;
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  async createIndexes(databaseName, data) {
    // Create search indexes for better performance
    const indexes = {
      byId: new Map(),
      byField: new Map()
    };

    data.forEach((record, index) => {
      // Index by ID
      if (record.id) {
        indexes.byId.set(record.id, index);
      }

      // Index by other fields
      for (const [field, value] of Object.entries(record)) {
        if (!indexes.byField.has(field)) {
          indexes.byField.set(field, new Map());
        }
        indexes.byField.get(field).set(value, index);
      }
    });

    // Save indexes
    const indexPath = path.join(this.processedDirectory, `${databaseName}_indexes.json`);
    await fs.writeFile(indexPath, JSON.stringify(indexes, null, 2));
  }

  async loadDatabase(databaseName) {
    const databasePath = path.join(this.processedDirectory, `${databaseName}.json`);
    const data = await fs.readFile(databasePath, 'utf8');
    return JSON.parse(data);
  }

  mergeData(existing, updates) {
    const merged = [...existing];
    const existingIds = new Set(existing.map(record => record.id));

    updates.forEach(update => {
      const existingIndex = merged.findIndex(record => record.id === update.id);
      
      if (existingIndex >= 0) {
        // Update existing record
        merged[existingIndex] = {
          ...merged[existingIndex],
          ...update,
          lastUpdated: new Date().toISOString()
        };
      } else {
        // Add new record
        merged.push({
          ...update,
          importedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }
    });

    return merged;
  }

  searchRecords(data, query) {
    return data.filter(record => {
      return Object.values(record).some(value => 
        String(value).toLowerCase().includes(query.toLowerCase())
      );
    });
  }

  sortRecords(data, field, order = 'asc') {
    return [...data].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      
      if (order === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }

  calculateFieldStats(data) {
    const stats = {};
    
    if (data.length === 0) return stats;

    const fields = Object.keys(data[0]);
    
    fields.forEach(field => {
      const values = data.map(record => record[field]).filter(v => v !== null && v !== undefined);
      const uniqueValues = new Set(values);
      
      stats[field] = {
        total: values.length,
        unique: uniqueValues.size,
        nullCount: data.length - values.length,
        sampleValues: Array.from(uniqueValues).slice(0, 5)
      };
    });

    return stats;
  }

  assessDataQuality(data) {
    if (data.length === 0) return { score: 0, issues: ['No data'] };

    const issues = [];
    let score = 100;

    // Check for null values
    const nullFields = Object.keys(data[0]).filter(field => 
      data.some(record => record[field] === null || record[field] === undefined)
    );
    
    if (nullFields.length > 0) {
      issues.push(`Null values found in fields: ${nullFields.join(', ')}`);
      score -= 10;
    }

    // Check for duplicates
    const duplicates = this.findDuplicates(data, 'id');
    if (duplicates.length > 0) {
      issues.push(`${duplicates.length} duplicate records found`);
      score -= 15;
    }

    // Check data consistency
    const inconsistentFields = this.findInconsistentFields(data);
    if (inconsistentFields.length > 0) {
      issues.push(`Inconsistent data types in fields: ${inconsistentFields.join(', ')}`);
      score -= 10;
    }

    return { score: Math.max(0, score), issues };
  }

  findInconsistentFields(data) {
    const fieldTypes = {};
    const inconsistent = [];

    data.forEach(record => {
      Object.entries(record).forEach(([field, value]) => {
        if (!fieldTypes[field]) {
          fieldTypes[field] = new Set();
        }
        fieldTypes[field].add(typeof value);
      });
    });

    Object.entries(fieldTypes).forEach(([field, types]) => {
      if (types.size > 1) {
        inconsistent.push(field);
      }
    });

    return inconsistent;
  }

  analyzeTrends(data) {
    // Basic trend analysis - customize based on your data
    const trends = {
      recordCount: data.length,
      dateRange: null,
      topValues: {}
    };

    // Find date range if date fields exist
    const dateFields = Object.keys(data[0]).filter(field => 
      field.includes('date') || field.includes('created') || field.includes('updated')
    );

    if (dateFields.length > 0) {
      const dates = data
        .map(record => record[dateFields[0]])
        .filter(date => date)
        .map(date => new Date(date))
        .sort((a, b) => a - b);

      if (dates.length > 0) {
        trends.dateRange = {
          start: dates[0].toISOString(),
          end: dates[dates.length - 1].toISOString(),
          span: dates[dates.length - 1] - dates[0]
        };
      }
    }

    return trends;
  }

  async createBackup(filePath) {
    const fileName = path.basename(filePath);
    const backupPath = path.join(this.backupDirectory, `${Date.now()}_${fileName}`);
    await fs.copyFile(filePath, backupPath);
    console.log(`💾 Created backup: ${backupPath}`);
  }

  async createDatabaseBackup(databaseName) {
    const databasePath = path.join(this.processedDirectory, `${databaseName}.json`);
    const backupPath = path.join(this.backupDirectory, `${Date.now()}_${databaseName}.json`);
    await fs.copyFile(databasePath, backupPath);
    console.log(`💾 Created database backup: ${backupPath}`);
  }

  async archiveData(data, databaseName) {
    const archivePath = path.join(this.backupDirectory, `${Date.now()}_${databaseName}_archived.json`);
    await fs.writeFile(archivePath, JSON.stringify(data, null, 2));
    console.log(`📦 Archived ${data.length} records to ${archivePath}`);
  }

  async generateMetadata(filePath, data) {
    const metadata = {
      fileName: path.basename(filePath),
      filePath: filePath,
      recordCount: data.length,
      fields: data.length > 0 ? Object.keys(data[0]) : [],
      importedAt: new Date().toISOString(),
      fileSize: (await fs.stat(filePath)).size,
      checksum: await this.calculateChecksum(filePath)
    };

    // Load existing metadata
    let allMetadata = {};
    try {
      const existingMetadata = await fs.readFile(this.metadataFile, 'utf8');
      allMetadata = JSON.parse(existingMetadata);
    } catch {
      // File doesn't exist, start fresh
    }

    // Update metadata
    allMetadata[path.basename(filePath)] = metadata;
    await fs.writeFile(this.metadataFile, JSON.stringify(allMetadata, null, 2));

    return metadata;
  }

  async getMetadata(filePath) {
    try {
      const allMetadata = await fs.readFile(this.metadataFile, 'utf8');
      const metadata = JSON.parse(allMetadata);
      return metadata[path.basename(filePath)] || null;
    } catch {
      return null;
    }
  }

  async calculateChecksum(filePath) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5');
    const data = await fs.readFile(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  filterDataWithCallback(data, callback) {
    const kept = [];
    const removed = [];

    data.forEach(record => {
      if (callback(record)) {
        kept.push(record);
      } else {
        removed.push(record);
      }
    });

    return { kept, removed };
  }

  filterDataByCriteria(data, criteria) {
    const kept = [];
    const removed = [];

    data.forEach(record => {
      let shouldKeep = true;

      for (const [field, value] of Object.entries(criteria)) {
        if (record[field] !== value) {
          shouldKeep = false;
          break;
        }
      }

      if (shouldKeep) {
        kept.push(record);
      } else {
        removed.push(record);
      }
    });

    return { kept, removed };
  }

  async enrichData(data) {
    // Example enrichment - customize based on your needs
    return data.map(record => ({
      ...record,
      enriched: true,
      enrichmentDate: new Date().toISOString()
    }));
  }

  // Convert data to CSV format
  async convertToCsv(data) {
    if (!data || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Add header row
    csvRows.push(headers.join(','));

    // Add data rows
    for (const record of data) {
      const row = headers.map(header => {
        const value = record[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      });
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }
}

module.exports = SpreadsheetManagerService; 