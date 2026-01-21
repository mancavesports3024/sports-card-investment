/**
 * Script to verify which files are actually imported/used in the codebase
 * This helps identify unused code before deletion
 */

const fs = require('fs');
const path = require('path');

// Get all JS files in backend directory
function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules
      if (file !== 'node_modules' && !file.startsWith('.')) {
        getAllJsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Extract require/import statements from a file
function extractImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = [];
    
    // Match require() statements
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    // Match import statements (for future ES6 support)
    const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  } catch (error) {
    return [];
  }
}

// Resolve import path to actual file
function resolveImport(importPath, fromFile) {
  // Skip node_modules and built-ins
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, importPath);
    
    // Try with .js extension
    if (fs.existsSync(resolved + '.js')) {
      return resolved + '.js';
    }
    // Try without extension
    if (fs.existsSync(resolved)) {
      return resolved;
    }
    // Try as directory with index.js
    if (fs.existsSync(path.join(resolved, 'index.js'))) {
      return path.join(resolved, 'index.js');
    }
  }
  
  return null;
}

// Main analysis
function analyzeCodebase() {
  const backendDir = path.join(__dirname, '..');
  const allFiles = getAllJsFiles(backendDir);
  
  console.log(`📊 Analyzing ${allFiles.length} JavaScript files...\n`);
  
  // Map of file -> files that import it
  const fileUsage = new Map();
  
  // Initialize all files
  allFiles.forEach(file => {
    fileUsage.set(file, []);
  });
  
  // Track all imports
  allFiles.forEach(file => {
    const imports = extractImports(file);
    imports.forEach(importPath => {
      const resolved = resolveImport(importPath, file);
      if (resolved && fileUsage.has(resolved)) {
        fileUsage.get(resolved).push(file);
      }
    });
  });
  
  // Categorize files
  const unused = [];
  const used = [];
  const entryPoints = [
    path.join(backendDir, 'index.js'),
    ...allFiles.filter(f => f.includes('routes/')),
    ...allFiles.filter(f => f.includes('services/') && f.includes('Service.js'))
  ];
  
  fileUsage.forEach((importers, file) => {
    const relativePath = path.relative(backendDir, file);
    
    // Skip entry points
    if (entryPoints.some(ep => file === ep)) {
      used.push({ file: relativePath, importers: importers.length, type: 'entry' });
      return;
    }
    
    if (importers.length === 0) {
      unused.push({ file: relativePath, type: 'unused' });
    } else {
      used.push({ file: relativePath, importers: importers.length, type: 'used' });
    }
  });
  
  // Print results
  console.log('🔴 UNUSED FILES (Not imported anywhere):\n');
  unused
    .sort((a, b) => a.file.localeCompare(b.file))
    .forEach(item => {
      console.log(`  ❌ ${item.file}`);
    });
  
  console.log(`\n✅ USED FILES (${used.length} files):\n`);
  used
    .filter(item => item.type === 'used')
    .sort((a, b) => b.importers - a.importers)
    .slice(0, 20) // Show top 20 most used
    .forEach(item => {
      console.log(`  ✅ ${item.file} (imported by ${item.importers} files)`);
    });
  
  console.log(`\n📊 Summary:`);
  console.log(`  Total files: ${allFiles.length}`);
  console.log(`  Unused: ${unused.length}`);
  console.log(`  Used: ${used.length}`);
  console.log(`  Entry points: ${entryPoints.length}`);
  
  // Save detailed report
  const report = {
    generated: new Date().toISOString(),
    totalFiles: allFiles.length,
    unused: unused.map(u => u.file),
    used: used.map(u => ({ file: u.file, importers: u.importers })),
    entryPoints: entryPoints.map(ep => path.relative(backendDir, ep))
  };
  
  fs.writeFileSync(
    path.join(backendDir, 'unused-code-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log(`\n📄 Detailed report saved to: unused-code-report.json`);
}

// Run analysis
if (require.main === module) {
  analyzeCodebase();
}

module.exports = { analyzeCodebase };

