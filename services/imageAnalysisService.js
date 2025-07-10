const vision = require('@google-cloud/vision');

class ImageAnalysisService {
  constructor() {
    // Initialize the Vision API client
    this.client = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE || undefined,
      credentials: process.env.GOOGLE_CLOUD_CREDENTIALS ? 
        JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS) : undefined
    });
  }

  /**
   * Analyze an image and extract card information
   * @param {Buffer} imageBuffer - The image buffer
   * @returns {Object} Extracted card information
   */
  async analyzeCardImage(imageBuffer) {
    try {
      // Perform text detection
      const [result] = await this.client.textDetection(imageBuffer);
      const detections = result.textAnnotations;
      
      if (!detections || detections.length === 0) {
        return {
          success: false,
          error: 'No text detected in image'
        };
      }

      // Get all detected text
      const fullText = detections[0].description;
      console.log('Detected text:', fullText);

      // Extract card information using patterns
      const cardInfo = this.extractCardInfo(fullText);
      
      return {
        success: true,
        fullText: fullText,
        cardInfo: cardInfo
      };

    } catch (error) {
      console.error('Error analyzing image:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract card information from detected text
   * @param {string} text - The full text detected in the image
   * @returns {Object} Structured card information
   */
  extractCardInfo(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let cardInfo = {
      playerName: null,
      year: null,
      set: null,
      grade: null,
      cardNumber: null,
      brand: null,
      suggestedSearch: null
    };

    // Look for common card patterns
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Extract year (4-digit year, often at start of line)
      if (!cardInfo.year) {
        const yearMatch = line.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          cardInfo.year = yearMatch[0];
        }
      }

      // Extract player names (common patterns)
      if (!cardInfo.playerName) {
        // Look for common player name patterns
        const playerPatterns = [
          /^([A-Z][a-z]+ [A-Z][a-z]+)/, // First Last
          /^([A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+)/, // First M. Last
          /^([A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+)/, // First Middle Last
        ];
        
        for (const pattern of playerPatterns) {
          const match = line.match(pattern);
          if (match && match[1].length > 3) {
            cardInfo.playerName = match[1];
            break;
          }
        }
      }

      // Extract grades (PSA, BGS, etc.)
      if (!cardInfo.grade) {
        const gradeMatch = line.match(/\b(PSA|BGS|SGC|CGC)\s*(\d+(?:\.\d+)?)\b/i);
        if (gradeMatch) {
          cardInfo.grade = `${gradeMatch[1]} ${gradeMatch[2]}`;
        }
      }

      // Extract card numbers
      if (!cardInfo.cardNumber) {
        const numberMatch = line.match(/\b(\d{1,3})\s*\/\s*\d{1,3}\b/);
        if (numberMatch) {
          cardInfo.cardNumber = numberMatch[0];
        }
      }

      // Extract brands/sets
      if (!cardInfo.brand) {
        const brandPatterns = [
          /(Topps|Panini|Upper Deck|Fleer|Donruss|Bowman|Leaf|Score|Pinnacle)/i,
          /(Base Set|Chrome|Finest|Prizm|Select|Optic|Contenders|National Treasures)/i,
          /(Magic: The Gathering|Pokemon|Yu-Gi-Oh!)/i
        ];
        
        for (const pattern of brandPatterns) {
          const match = line.match(pattern);
          if (match) {
            cardInfo.brand = match[1];
            break;
          }
        }
      }
    }

    // Generate suggested search query
    cardInfo.suggestedSearch = this.generateSearchQuery(cardInfo);
    
    return cardInfo;
  }

  /**
   * Generate a search query from extracted card information
   * @param {Object} cardInfo - The extracted card information
   * @returns {string} Suggested search query
   */
  generateSearchQuery(cardInfo) {
    const parts = [];
    
    if (cardInfo.year) {
      parts.push(cardInfo.year);
    }
    
    if (cardInfo.playerName) {
      parts.push(cardInfo.playerName);
    }
    
    if (cardInfo.brand) {
      parts.push(cardInfo.brand);
    }
    
    if (cardInfo.grade) {
      parts.push(cardInfo.grade);
    }
    
    if (cardInfo.cardNumber) {
      parts.push(`#${cardInfo.cardNumber.split('/')[0]}`);
    }
    
    return parts.join(' ');
  }

  /**
   * Analyze base64 image data
   * @param {string} base64Data - Base64 encoded image data
   * @returns {Object} Analysis results
   */
  async analyzeBase64Image(base64Data) {
    try {
      // Remove data URL prefix if present
      const base64Image = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      
      // Convert to buffer
      const imageBuffer = Buffer.from(base64Image, 'base64');
      
      return await this.analyzeCardImage(imageBuffer);
    } catch (error) {
      console.error('Error analyzing base64 image:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ImageAnalysisService(); 