const fs = require('fs');
const path = require('path');

// Function to extract text from Word document XML
function extractTextFromWordXML(xmlContent) {
    // Remove XML tags and extract text content
    let text = xmlContent
        // Remove XML declarations and processing instructions
        .replace(/<\?xml[^>]*\?>/g, '')
        .replace(/<!DOCTYPE[^>]*>/g, '')
        // Remove all XML tags
        .replace(/<[^>]*>/g, '')
        // Decode common XML entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        // Clean up whitespace
        .replace(/\s+/g, ' ')
        .trim();
    
    return text;
}

// Function to extract text from Word document
function extractFromWordDocument(docxPath) {
    try {
        // Read the Word document as a ZIP file
        const data = fs.readFileSync(docxPath);
        
        // Look for the document.xml content
        const documentXmlMatch = data.toString('binary').match(/word\/document\.xml[^>]*>([\s\S]*?)<\/w:document>/);
        
        if (documentXmlMatch) {
            const xmlContent = documentXmlMatch[1];
            return extractTextFromWordXML(xmlContent);
        } else {
            // Fallback: try to extract any readable text
            const text = data.toString('utf8')
                .replace(/[^\x20-\x7E\n\r\t]/g, '') // Keep only printable ASCII
                .replace(/\s+/g, ' ')
                .trim();
            
            return text;
        }
    } catch (error) {
        console.error('Error extracting text from Word document:', error.message);
        return null;
    }
}

// Main execution
if (require.main === module) {
    console.log('📄 Word Document Text Extractor');
    console.log('================================\n');
    
    const docxPath = path.join(__dirname, 'filter-debug.docx');
    const outputPath = path.join(__dirname, 'filter-debug.log');
    
    if (!fs.existsSync(docxPath)) {
        console.log('❌ Word document not found at:', docxPath);
        console.log('\n📝 Please ensure filter-debug.docx is in the backend directory');
        process.exit(1);
    }
    
    console.log('🔍 Extracting text from Word document...');
    const extractedText = extractFromWordDocument(docxPath);
    
    if (extractedText) {
        // Save as plain text log file
        fs.writeFileSync(outputPath, extractedText, 'utf8');
        console.log('✅ Text extracted and saved to:', outputPath);
        console.log(`📊 Extracted ${extractedText.length} characters`);
        
        // Show preview
        console.log('\n📋 Preview of extracted content:');
        console.log('='.repeat(50));
        console.log(extractedText.substring(0, 500) + '...');
        console.log('='.repeat(50));
        
        console.log('\n🎯 Next steps:');
        console.log('1. Review the extracted content above');
        console.log('2. Run the analyzer: node analyze-filter-rejections.js');
        
    } else {
        console.log('❌ Failed to extract text from Word document');
        console.log('\n💡 Alternative approach:');
        console.log('1. Open the Word document manually');
        console.log('2. Copy all the debug text content');
        console.log('3. Paste it into a new file named filter-debug.log');
        console.log('4. Run: node analyze-filter-rejections.js');
    }
}

module.exports = { extractFromWordDocument, extractTextFromWordXML };
