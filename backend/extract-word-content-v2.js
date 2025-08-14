const fs = require('fs');
const path = require('path');

// Function to extract text from Word document using ZIP structure
function extractFromWordDocumentV2(docxPath) {
    try {
        const data = fs.readFileSync(docxPath);
        const dataStr = data.toString('binary');
        
        // Look for the actual document content in the XML
        // This pattern looks for text content between <w:t> tags
        const textMatches = dataStr.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
        
        if (textMatches && textMatches.length > 0) {
            let extractedText = '';
            
            textMatches.forEach(match => {
                // Extract text content from <w:t> tags
                const textMatch = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
                if (textMatch && textMatch[1]) {
                    extractedText += textMatch[1] + ' ';
                }
            });
            
            // Clean up the extracted text
            extractedText = extractedText
                .replace(/\s+/g, ' ')
                .trim();
            
            return extractedText;
        }
        
        // Fallback: try to find any readable text patterns
        const readableText = dataStr
            .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Replace non-printable with spaces
            .replace(/\s+/g, ' ')
            .trim();
        
        // Look for debug log patterns
        const debugPatterns = [
            /DEBUG FILTER:[^]*?REJECTED:[^]*?PSA 10/g,
            /REJECTED:[^]*?PSA 10/g,
            /DEBUG:[^]*?PSA 10/g
        ];
        
        for (const pattern of debugPatterns) {
            const matches = readableText.match(pattern);
            if (matches && matches.length > 0) {
                return matches.join('\n');
            }
        }
        
        return readableText;
        
    } catch (error) {
        console.error('Error extracting text from Word document:', error.message);
        return null;
    }
}

// Main execution
if (require.main === module) {
    console.log('📄 Word Document Text Extractor V2');
    console.log('==================================\n');
    
    const docxPath = path.join(__dirname, 'filter-debug.docx');
    const outputPath = path.join(__dirname, 'filter-debug.log');
    
    if (!fs.existsSync(docxPath)) {
        console.log('❌ Word document not found at:', docxPath);
        console.log('\n📝 Please ensure filter-debug.docx is in the backend directory');
        process.exit(1);
    }
    
    console.log('🔍 Extracting text from Word document (V2)...');
    const extractedText = extractFromWordDocumentV2(docxPath);
    
    if (extractedText && extractedText.length > 100) {
        // Save as plain text log file
        fs.writeFileSync(outputPath, extractedText, 'utf8');
        console.log('✅ Text extracted and saved to:', outputPath);
        console.log(`📊 Extracted ${extractedText.length} characters`);
        
        // Show preview
        console.log('\n📋 Preview of extracted content:');
        console.log('='.repeat(50));
        console.log(extractedText.substring(0, 800) + '...');
        console.log('='.repeat(50));
        
        console.log('\n🎯 Next steps:');
        console.log('1. Review the extracted content above');
        console.log('2. Run the analyzer: node analyze-filter-rejections.js');
        
    } else {
        console.log('❌ Failed to extract meaningful text from Word document');
        console.log('\n💡 Manual approach needed:');
        console.log('1. Open the Word document manually');
        console.log('2. Copy all the debug text content (the actual log output)');
        console.log('3. Create a new file: filter-debug.log');
        console.log('4. Paste the debug content into filter-debug.log');
        console.log('5. Run: node analyze-filter-rejections.js');
        
        if (extractedText) {
            console.log('\n📋 Raw extracted content (for reference):');
            console.log('='.repeat(50));
            console.log(extractedText.substring(0, 500));
            console.log('='.repeat(50));
        }
    }
}

module.exports = { extractFromWordDocumentV2 };
