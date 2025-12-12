import React, { useState, useEffect, useRef } from 'react';
import './TCDBBrowser.css';
import ScoreCardSummary from './ScoreCardSummary';
import Tesseract from 'tesseract.js';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';

const TCDBBrowser = () => {
  // Step tracking - only player search and summary
  const [currentStep, setCurrentStep] = useState('player-search');
  
  // Selected values
  const [selectedCardForSummary, setSelectedCardForSummary] = useState(null);
  const [selectedCardSetInfo, setSelectedCardSetInfo] = useState(null);

  // GemRate player search states
  const [playerSearchName, setPlayerSearchName] = useState('');
  const [playerSearchCategory, setPlayerSearchCategory] = useState('all');
  const [playerSearchGrader, setPlayerSearchGrader] = useState('psa');
  const [playerSearchResults, setPlayerSearchResults] = useState([]);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [playerSearchError, setPlayerSearchError] = useState('');
  const [playerSearchFilterSet, setPlayerSearchFilterSet] = useState('');
  const [playerSearchFilterCardNumber, setPlayerSearchFilterCardNumber] = useState('');
  const [selectedCardGemrateData, setSelectedCardGemrateData] = useState(null);
  const [playerSearchSortField, setPlayerSearchSortField] = useState('totalGrades');
  const [playerSearchSortDirection, setPlayerSearchSortDirection] = useState('desc'); // 'asc' | 'desc'
  
  // Image recognition states
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const ocrProcessedRef = useRef(false);
  
  // Database info
  const [dbInfo, setDbInfo] = useState({ total: 0 });

  // Fetch database count on mount
  useEffect(() => {
    fetchDbInfo();
  }, []);

  const fetchDbInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/cards?limit=1`);
      const data = await response.json();
      if (data.success && data.pagination) {
        setDbInfo({ total: data.pagination.total?.total || 0 });
      }
    } catch (err) {
      console.error('Error fetching DB info:', err);
    }
  };

  const handleCardClick = (card) => {
    console.log('[TCDBBrowser] Card clicked:', {
      player: card.player,
      set: card.set,
      parallel: card.parallel,
      number: card.number,
      gemrateId: card.gemrateId,
      year: card.year
    });
    setSelectedCardForSummary(card);
    setCurrentStep('score-card-summary');
    
    // Scroll to scorecard summary after a brief delay to allow render
    setTimeout(() => {
      const summaryElement = document.querySelector('.score-card-summary');
      if (summaryElement) {
        summaryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleClearDatabase = async () => {
    if (!window.confirm(`Are you sure you want to clear all ${dbInfo.total} cards from the database? This cannot be undone!`)) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/cards/clear-all`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        alert(`Successfully cleared ${data.deletedCount} cards from database`);
        fetchDbInfo();
      } else {
        alert(data.error || 'Failed to clear database');
      }
    } catch (err) {
      alert('Error clearing database: ' + err.message);
    }
  };

  const handleBack = () => {
    if (currentStep === 'score-card-summary') {
      setCurrentStep('player-search');
      setSelectedCardForSummary(null);
      setSelectedCardSetInfo(null);
      setSelectedCardGemrateData(null);
    }
  };

  // Extract player name from OCR text
  const extractPlayerName = (ocrText) => {
    if (!ocrText) return null;
    
    // Check if text contains Japanese characters (hiragana, katakana, kanji)
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(ocrText);
    
    if (hasJapanese) {
      console.log('[OCR] Detected Japanese text in OCR output');
      // For Japanese text, try to extract katakana names (often used for foreign player names)
      // Pattern: Katakana characters (2-10 characters, often player names)
      const katakanaPattern = /[\u30A0-\u30FF]{2,10}/g;
      const katakanaMatches = ocrText.match(katakanaPattern);
      
      if (katakanaMatches && katakanaMatches.length > 0) {
        // Return the longest katakana sequence (likely the player name)
        const longestKatakana = katakanaMatches.reduce((a, b) => a.length > b.length ? a : b);
        console.log('[OCR] Extracted Japanese (Katakana) name:', longestKatakana);
        // Note: This returns Japanese text - translation would require a separate API
        return longestKatakana;
      }
      
      // Also try kanji patterns (for Japanese player names)
      const kanjiPattern = /[\u4E00-\u9FAF]{2,6}/g;
      const kanjiMatches = ocrText.match(kanjiPattern);
      if (kanjiMatches && kanjiMatches.length > 0) {
        const longestKanji = kanjiMatches.reduce((a, b) => a.length > b.length ? a : b);
        console.log('[OCR] Extracted Japanese (Kanji) name:', longestKanji);
        return longestKanji;
      }
    }
    
    // First, try to extract names directly using regex patterns
    // Look for patterns like "BO NIX", "JAYDEN DANIELS", "MACKLIN CELEBRINI"
    // Pattern 1: All caps names with 2-3 words, allowing some special chars between
    const allCapsPattern = /\b([A-Z]{2,12}\s+[A-Z]{2,12}(?:\s+[A-Z]{2,12})?)\b/g;
    
    // Pattern 1b: Single word all caps (for Pokemon names like "GROUDON", "PIKACHU")
    const singleWordAllCapsPattern = /\b([A-Z]{4,15})\b/g;
    
    // Pattern 2: Mixed case names
    const mixedCasePattern = /\b([A-Z][a-z]{2,12}\s+[A-Z][a-z]{2,12}(?:\s+[A-Z][a-z]{2,12})?)\b/g;
    
    // Pattern 2b: Single word capitalized (for Pokemon names like "Groudon", "Pikachu", "Charizard")
    // Also handle cases with special chars immediately after (like "Charizard(E@L +330)")
    const singleWordCapitalizedPattern = /\b([A-Z][a-z]{4,15})(?:[^a-z]|$)/g;
    
    // Pattern 3: Names that might have special chars between words (like "JAYDEN DANIELS" with "|" or "=" nearby)
    // This handles cases like "| JAYDEN DANIELS VY =" by extracting just the name part
    const nameWithSpecialChars = /[|=\-_\s]*([A-Z]{2,12})[|=\-_\s]+([A-Z]{2,12})(?:[|=\-_\s]+([A-Z]{2,12}))?[|=\-_\s]*/g;
    
    const extractedNames = [];
    
    // Common words to exclude (team names, card terms, OCR artifacts, etc.)
    // Define this early so it can be used in all patterns
    const excludeWords = new Set([
      'panini', 'topps', 'donruss', 'upper', 'deck', 'fleer', 'score',
      'rookie', 'rc', 'auto', 'autograph', 'patch', 'relic',
      'psa', 'bgs', 'sgc', 'cgc', 'grade', 'graded', 'gem', 'mint',
      'card', 'cards', 'trading', 'sports', 'collectible',
      'year', 'set', 'number', 'parallel', 'insert',
      'football', 'baseball', 'basketball', 'hockey', 'soccer',
      'prizm', 'chrome', 'select', 'optic', 'downtown', 'broncos',
      'denver', 'team', 'nfl', 'nba', 'mlb', 'nhl', 'commanders',
      'washington', 'vikings', 'packers', 'chiefs', 'bills', 'patriots',
      'cowboys', 'giants', 'eagles', 'steelers', 'ravens', 'bengals',
      'browns', 'titans', 'jaguars', 'texans', 'colts', 'dolphins',
      'jets', 'falcons', 'panthers', 'saints', 'buccaneers', 'rams',
      'seahawks', 'cardinals', '49ers', 'raiders', 'chargers', 'sharks',
      'lists', 'vy', 'te', 'ase', 'ses', 'det', 'ok', 'ang', 'am',
      'ncate', 'ng', 'pal', 'sla', 'ti', 'nn', 'ex', 'is', 'nss',
      'ls', 'ey', 'by', 'as', 'ia', 'jil', 'hit', 'nn', 'vl', 'es',
      'or', 'be', 'eo', 'los', 'see', 'on', 'la', 'aaa', 'cte', 'es',
      'ixy', 'sees', 'ih', 'vee', 'ny', 'fo', 'gh', 'ke', 'ila', 'c7',
      'agi', 'of', 'j', 'ond', 'oy', 'fe', 'h', 'vy', 'me', 'y', 'ch',
      'a', 'r', 'g', '0', '5', 'mania', 'a', '7', 'v4', '3a', 'e', '4',
      'vb', 'n', 'by', 's', 'j', 'w', 'pr', '8', '18', '3', 'ie', 'r',
      'pokemon', 'nintendo', 'creatures', 'game', 'freak', 'pokemon', 'ninte',
      'poken', 'ninte', 'pokémon', 'pokédex', 'basic', 'hp', 'energy', 'fire',
      'water', 'grass', 'electric', 'psychic', 'fighting', 'darkness', 'metal',
      'fairy', 'dragon', 'colorless', 'weakness', 'resistance', 'retreat',
      'attack', 'damage', 'illus', 'illustrator', 'par', 'swelling', 'power', 'swellingi',
      'swellingipow', 'pattachlalbasiclwal', 'enengylcard', 'fromiyour', 'hand',
      'magmalburge', 'energy', 'fiom', 'pokémc', 'eid', 'fore', 'cde', 'you',
      'disc', 'rim', 'ns', 'sh', 'ance', 'be', 'lent', 'ny', 'tm', 'lis',
      'fle', 'tire', 're', 'ix', 'eit', 'lc', 'lee', 'pa', 'ot', 'g', 'he',
      'dap', 'oo', 'wp', 'brs', 'foleo', 'hiotendo', 'creat', 'me', 'freak',
      'magma', 'purge', 'attach', 'discard', 'card', 'hand', 'pokémon',
      'awrrig', 'se', 'yc', 'pe', 'f', 'gd', 'bh', 'wh', 'ed', 'swellingipowe',
      'paccsetaibas', 'icles', 'enengylcard', 'fromtyour', 'pokeén', 'pom',
      'ded', 'oly', 'corde', 'you', 'disc', 'deal', 'wn', 'wages',
      'fess', 'cance', 'eleat', 'mn', 'na', 'wises', 'lle', 'ba',
      'hubs', 'dshs', 'iat', 'wenttostee', 'plait', 'arn', 'gz', 'si',
      'b2023', 'me', 'fre', 'hig', 'snr', 'peay', 'eal', 'oal', 'sap',
      'nan', 're', 'tn', 'sen', 'ss', 'xi', 'ar', 'bg', 'oh', 'ese',
      'poli', 'er', 'trey', 'ts', 'he', 'yi', 'oi', 'as', 'eo', 'l',
      'ial', 'ik', 'ni', 'ww', 'fi', 'ff', 'se', 'sim', 'sha', 'brn',
      'by', 'ye', 'nin', 'wo', 'aee', 'tr', 'ny', 'or', 'ny', 'sl',
      'os', 'so', 're', 'ol', 'saf', 'cl', 'gog', 'ability', 'sane',
      'gm', 'ret', 'pig', 'wp', 'ra', 'lad', 'age', 'co', 'ag', 'ss',
      'oad', 'pa', 'rd', 'lor', 'tl', 'toa', 'te', 'ts', 'rp', 'lc',
      'fd', 'tre', 'wr', 'ee', 'peor', 'as', 'et', 'burninoi', 'darkness',
      'pv', 'yeni', 'anne', 'sne', 'ji', 'io', 'rd', 'le', 'an', 'knocked',
      'out', 'opponent', 'takes', 'prize', 'cards', 'ubf', 'in', 'pin',
      'ge', 'hn', 'poi', 'zl', 'li', 'ey', 'rn', 'ds', 'on', 'sharkse',
      'em', 'ye', 'er', 'rr', 'ba', 'erin', 'uc', 'rw', 'tn', 'be',
      'pal', 'sa', 'shc', 'mpa', 'nl', 'fo', 'ye', 'ta', 'nyu', 'ei',
      'lo', 'll', 'et', 'ns', 'flyers', 'stetreereer', 'lil', 'or',
      'ati', 'io'
    ]);
    
    // Try pattern 1: Standard all caps names (2-3 words)
    let match;
    while ((match = allCapsPattern.exec(ocrText)) !== null) {
      const candidate = match[1].trim();
      const words = candidate.split(/\s+/).filter(w => w.length >= 2 && /^[A-Z]+$/.test(w));
      
      if (words.length >= 2 && words.length <= 3) {
        extractedNames.push({
          name: candidate,
          words: words,
          position: match.index,
          source: 'allCaps'
        });
      }
    }
    
    // Try pattern 1b: Single word all caps (Pokemon names)
    while ((match = singleWordAllCapsPattern.exec(ocrText)) !== null) {
      const candidate = match[1].trim();
      
      // Must be reasonable length and not in exclude list
      if (candidate.length >= 4 && candidate.length <= 15 && /^[A-Z]+$/.test(candidate)) {
        // Check exclude list before adding
        if (!excludeWords.has(candidate.toLowerCase())) {
          extractedNames.push({
            name: candidate,
            words: [candidate],
            position: match.index,
            source: 'singleWordAllCaps'
          });
        }
      }
    }
    
    // Try pattern 2: Mixed case names (2-3 words)
    while ((match = mixedCasePattern.exec(ocrText)) !== null) {
      const candidate = match[1].trim();
      const words = candidate.split(/\s+/).filter(w => w.length >= 2 && /^[A-Z][a-z]+$/.test(w));
      
      if (words.length >= 2 && words.length <= 3) {
        extractedNames.push({
          name: candidate,
          words: words,
          position: match.index,
          source: 'mixedCase'
        });
      }
    }
    
    // Try pattern 2b: Single word capitalized (Pokemon names like "Groudon")
    while ((match = singleWordCapitalizedPattern.exec(ocrText)) !== null) {
      const candidate = match[1].trim();
      
      // Must be reasonable length and not in exclude list
      if (candidate.length >= 4 && candidate.length <= 15 && /^[A-Z][a-z]+$/.test(candidate)) {
        // Check exclude list before adding
        if (!excludeWords.has(candidate.toLowerCase())) {
          extractedNames.push({
            name: candidate,
            words: [candidate],
            position: match.index,
            source: 'singleWordCapitalized'
          });
        }
      }
    }
    
    // Try pattern 3: Names with special characters (like "| JAYDEN DANIELS VY =")
    // But be more strict - only match if words are reasonable length (3+ chars) to avoid false positives
    while ((match = nameWithSpecialChars.exec(ocrText)) !== null) {
      const words = [match[1], match[2]];
      if (match[3]) words.push(match[3]);
      
      // Filter out words that are too short (require at least 3 chars to avoid "SES", "ASE", etc.)
      const validWords = words.filter(w => w.length >= 3 && w.length <= 12 && /^[A-Z]+$/.test(w));
      
      // Also check that at least one word is 4+ chars (typical for names)
      const hasLongWord = validWords.some(w => w.length >= 4);
      
      if (validWords.length >= 2 && validWords.length <= 3 && hasLongWord) {
        extractedNames.push({
          name: validWords.join(' '),
          words: validWords,
          position: match.index,
          source: 'specialChars'
        });
      }
    }
    
    
    // Try pattern 3: Names with special characters (like "| JAYDEN DANIELS VY =")
    // But be more strict - only match if words are reasonable length (3+ chars) to avoid false positives
    while ((match = nameWithSpecialChars.exec(ocrText)) !== null) {
      const words = [match[1], match[2]];
      if (match[3]) words.push(match[3]);
      
      // Filter out words that are too short (require at least 3 chars to avoid "SES", "ASE", etc.)
      const validWords = words.filter(w => w.length >= 3 && w.length <= 12 && /^[A-Z]+$/.test(w));
      
      // Also check that at least one word is 4+ chars (typical for names)
      const hasLongWord = validWords.some(w => w.length >= 4);
      
      // Exclude if any word is in the exclude list
      const hasExcluded = validWords.some(w => excludeWords.has(w.toLowerCase()));
      
      if (validWords.length >= 2 && validWords.length <= 3 && hasLongWord && !hasExcluded) {
        extractedNames.push({
          name: validWords.join(' '),
          words: validWords,
          position: match.index,
          source: 'specialChars'
        });
      }
    }
    
    // Pattern 4: Handle names that might be split across lines (like "MACKLIN" on one line, "CELEBRINI" on next)
    // Look for single uppercase words that might be part of a name
    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    for (let i = 0; i < lines.length - 1; i++) {
      const line1 = lines[i];
      const line2 = lines[i + 1];
      
      // Look for pattern like "MACKLIN" followed by "CELEBRINI" on next line
      const word1Match = line1.match(/\b([A-Z]{4,12})\b/);
      const word2Match = line2.match(/\b([A-Z]{4,12})\b/);
      
      if (word1Match && word2Match) {
        const word1 = word1Match[1];
        const word2 = word2Match[1];
        
        // Check if these look like name parts (not in exclude list, reasonable length)
        if (word1.length >= 4 && word2.length >= 4 && 
            !excludeWords.has(word1.toLowerCase()) && 
            !excludeWords.has(word2.toLowerCase())) {
          extractedNames.push({
            name: `${word1} ${word2}`,
            words: [word1, word2],
            position: ocrText.indexOf(line1),
            source: 'splitLines'
          });
        }
      }
    }
    
    // Also look for 2-word all-caps patterns within individual lines (in case OCR reads it as one line)
    // This helps with cases where "MATVEI MICHKOV" might be on one line but OCR has errors
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Look for two uppercase words on the same line, even if there are some OCR errors
      const twoWordMatch = line.match(/\b([A-Z]{4,12})\s+([A-Z]{4,12})\b/);
      if (twoWordMatch) {
        const word1 = twoWordMatch[1];
        const word2 = twoWordMatch[2];
        
        if (word1.length >= 4 && word2.length >= 4 &&
            !excludeWords.has(word1.toLowerCase()) &&
            !excludeWords.has(word2.toLowerCase())) {
          extractedNames.push({
            name: `${word1} ${word2}`,
            words: [word1, word2],
            position: ocrText.indexOf(line),
            source: 'sameLineTwoWords'
          });
        }
      }
    }
    
    // Score each extracted name
    const scoredNames = extractedNames.map((item, index) => {
      const { name, words, position, source } = item;
      let score = 0;
      
      // Prefer 2-word names (most common: "First Last")
      if (words.length === 2) {
        score += 25;
      } else if (words.length === 3) {
        score += 20; // "First Middle Last" also common
      } else if (words.length === 1) {
        // Single word names (Pokemon) - give them a good score but slightly lower
        score += 20;
      }
      
      // Position scoring depends on source
      const textLength = ocrText.length;
      const positionRatio = position / textLength;
      
      if (source === 'singleWordAllCaps' || source === 'singleWordCapitalized') {
        // Pokemon names are usually at the TOP of the card
        if (positionRatio < 0.1) { // Top 10% of text - very high priority
          score += 40;
        } else if (positionRatio < 0.2) { // Top 20% of text
          score += 35;
        } else if (positionRatio < 0.3) { // Top 30% of text
          score += 25;
        } else if (positionRatio < 0.5) { // Top half
          score += 15;
        }
      } else {
        // Player names are often at the bottom of the card
        if (positionRatio > 0.6) { // Bottom 40% of text
          score += 20;
        } else if (positionRatio > 0.4) { // Middle section
          score += 10;
        }
      }
      
      // Prefer all uppercase (common on cards: "BO NIX", "JAYDEN DANIELS", "MACKLIN CELEBRINI")
      const allUppercase = words.every(w => /^[A-Z]+$/.test(w));
      if (allUppercase) {
        score += 15;
      }
      
      // Prefer capitalized (mixed case: "Bo Nix")
      const allCapitalized = words.every(w => /^[A-Z]/.test(w));
      if (allCapitalized && !allUppercase) {
        score += 10;
      }
      
      // Prefer longer words (real names are usually 4+ chars, not 2-3 char abbreviations)
      const hasLongWords = words.some(w => w.length >= 5);
      if (hasLongWords) {
        score += 10; // Bonus for longer words like "MACKLIN", "CELEBRINI"
      }
      
      // Penalize very short words (2-3 chars are often OCR artifacts)
      const hasVeryShortWords = words.some(w => w.length <= 3);
      if (hasVeryShortWords) {
        score -= 20; // Penalty for short words like "ZL", "LI"
      }
      
      // Penalize if any word is in exclude list
      const hasExcluded = words.some(w => excludeWords.has(w.toLowerCase()));
      if (hasExcluded) {
        score -= 50; // Heavy penalty
      }
      
      // Prefer reasonable word lengths (2-12 chars typical for names)
      const reasonableLength = words.every(w => w.length >= 2 && w.length <= 12);
      if (reasonableLength) {
        score += 5;
      }
      
      return { name, score, words, position };
    });
    
    // Also process lines for fallback
    // (lines variable was already created above for pattern 4, reuse it)
    const scoredLines = lines.map((line, index) => {
      // Extract just the name part from lines with special characters
      const nameMatch = line.match(/([A-Z][A-Z\s]{2,20})/);
      if (!nameMatch) return { line, score: -100, words: [] };
      
      const cleanName = nameMatch[1].trim();
      const words = cleanName.split(/\s+/).filter(w => w.length > 1 && /^[A-Za-z]+$/.test(w));
      
      if (words.length < 2 || words.length > 3) {
        return { line: cleanName, score: -50, words: [] };
      }
      
      let score = 0;
      
      if (words.length === 2 || words.length === 3) {
        score += 15;
      }
      
      if (index >= lines.length - 3) {
        score += 10;
      }
      
      const allUppercase = words.every(w => /^[A-Z]+$/.test(w));
      if (allUppercase) {
        score += 10;
      }
      
      const hasExcluded = words.some(w => excludeWords.has(w.toLowerCase()));
      if (hasExcluded) {
        score -= 40;
      }
      
      return { line: cleanName, score, words, originalLine: line };
    });
    
    // Combine and sort all candidates
    const allCandidates = [
      ...scoredNames.map(item => ({ ...item, type: 'pattern' })),
      ...scoredLines.map(item => ({ ...item, type: 'line' }))
    ];
    
    allCandidates.sort((a, b) => b.score - a.score);
    
    console.log('[OCR] Top 5 scored candidates:', allCandidates.slice(0, 5).map(item => ({
      name: item.name || item.line,
      score: item.score,
      words: item.words?.length || 0,
      type: item.type
    })));
    
    // Find the best match (allow single word for Pokemon, 2-3 words for players)
    const bestMatch = allCandidates.find(item => 
      item.score > 15 && 
      item.words && 
      item.words.length >= 1 && 
      item.words.length <= 3
    );
    
    if (bestMatch) {
      return bestMatch.name || bestMatch.line;
    }
    
    // Fallback: any 1-3 word capitalized name
    const fallback = allCandidates.find(item => 
      item.words && 
      item.words.length >= 1 && 
      item.words.length <= 3 &&
      item.words.every(w => /^[A-Z]/.test(w)) &&
      !item.words.some(w => excludeWords.has(w.toLowerCase()))
    );
    
    if (fallback) {
      return fallback.name || fallback.line;
    }
    
    return null;
  };

  // Preprocess image to improve OCR accuracy
  const preprocessImage = (imageFile, options = {}) => {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        // Upscale image for better OCR (2x if original is small)
        const scale = options.upscale ? (img.width < 1000 ? 2 : 1) : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Use high-quality image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw original image (scaled up if needed)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Apply image enhancements
        for (let i = 0; i < data.length; i += 4) {
          // Convert to grayscale for better contrast detection
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          
          // Increase contrast more aggressively
          const contrast = options.aggressiveContrast ? 2.0 : 1.5;
          const adjusted = Math.min(255, Math.max(0, ((gray - 128) * contrast) + 128));
          
          // Apply to all channels (grayscale)
          data[i] = adjusted;     // R
          data[i + 1] = adjusted; // G
          data[i + 2] = adjusted; // B
          // Alpha stays the same
        }
        
        // Put enhanced image data back
        ctx.putImageData(imageData, 0, 0);
        
        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            const processedFile = new File([blob], imageFile.name, { type: 'image/jpeg' });
            resolve(processedFile);
          } else {
            resolve(imageFile); // Fallback to original
          }
        }, 'image/jpeg', 0.98); // Higher quality
      };
      
      img.onerror = () => {
        resolve(imageFile); // Fallback to original on error
      };
      
      img.src = URL.createObjectURL(imageFile);
    });
  };

  // Process image with OCR
  const processImageWithOCR = async (imageFile) => {
    setOcrLoading(true);
    setOcrError('');
    
    try {
      console.log('[OCR] Starting image recognition...');
      
      // Try multiple OCR passes with different settings
      // Pass 1: Original image with AUTO mode (good for general text)
      // Try both English and Japanese (for Japanese cards like Pokemon, One Piece)
      console.log('[OCR] Running OCR Pass 1: Original image with AUTO mode (English + Japanese)...');
      const { data: { text: text1 } } = await Tesseract.recognize(
        imageFile,
        'eng+jpn', // Support both English and Japanese
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`[OCR] Pass 1 Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
          tessedit_pageseg_mode: '3', // AUTO
        }
      );
      
      console.log('[OCR] Pass 1 Extracted text:', text1);
      let finalText = text1;
      let bestPlayerName = extractPlayerName(text1);
      
      // Pass 2: Preprocessed image with SINGLE_BLOCK mode (better for stylized fonts)
      console.log('[OCR] Running OCR Pass 2: Preprocessed image with SINGLE_BLOCK mode (English + Japanese)...');
      const processedImage1 = await preprocessImage(imageFile, { upscale: true, aggressiveContrast: false });
      const { data: { text: text2 } } = await Tesseract.recognize(
        processedImage1,
        'eng+jpn', // Support both English and Japanese
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`[OCR] Pass 2 Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
          tessedit_pageseg_mode: '6', // SINGLE_BLOCK - treats entire image as one text block
        }
      );
      
      console.log('[OCR] Pass 2 Extracted text:', text2);
      const playerName2 = extractPlayerName(text2);
      if (playerName2 && playerName2.length >= 4 && (!bestPlayerName || playerName2.length > bestPlayerName.length)) {
        console.log('[OCR] Pass 2 found better result:', playerName2);
        finalText = text2;
        bestPlayerName = playerName2;
      }
      
      // Pass 3: Aggressively preprocessed image with SINGLE_UNIFORM_BLOCK mode
      if (!bestPlayerName || bestPlayerName.length < 4) {
        console.log('[OCR] Running OCR Pass 3: Aggressively preprocessed image with SINGLE_UNIFORM_BLOCK mode (English + Japanese)...');
        const processedImage2 = await preprocessImage(imageFile, { upscale: true, aggressiveContrast: true });
        const { data: { text: text3 } } = await Tesseract.recognize(
          processedImage2,
          'eng+jpn', // Support both English and Japanese
          {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                console.log(`[OCR] Pass 3 Progress: ${Math.round(m.progress * 100)}%`);
              }
            },
            tessedit_pageseg_mode: '8', // SINGLE_WORD - treats image as single word (good for names)
          }
        );
        
        console.log('[OCR] Pass 3 Extracted text:', text3);
        const playerName3 = extractPlayerName(text3);
        if (playerName3 && playerName3.length >= 4 && (!bestPlayerName || playerName3.length > bestPlayerName.length)) {
          console.log('[OCR] Pass 3 found better result:', playerName3);
          finalText = text3;
          bestPlayerName = playerName3;
        }
      }
      
      // Extract player name from OCR text (use best result from all passes)
      const playerName = bestPlayerName || extractPlayerName(finalText);
      
      if (playerName) {
        console.log('[OCR] Final extracted player name:', playerName);
        console.log('[OCR] All OCR text from best pass:', finalText);
        setPlayerSearchName(playerName);
        setOcrError('');
        ocrProcessedRef.current = true;
        // Auto-run search after a short delay
        setTimeout(() => {
          handlePlayerSearch();
          ocrProcessedRef.current = false;
        }, 500);
      } else {
        setOcrError('Could not find player name in image. Please try a clearer photo or enter the name manually.');
        console.log('[OCR] Could not extract player name from:', finalText);
      }
    } catch (err) {
      console.error('[OCR] Error processing image:', err);
      setOcrError('Error processing image: ' + err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setOcrError('Please select an image file');
      return;
    }
    
    setImageFile(file);
    setOcrError('');
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
    
    // Process image
    processImageWithOCR(file);
  };

  // Handle camera capture
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setOcrError('Could not access camera. Please use file upload instead.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' });
        setImageFile(file);
        setImagePreview(URL.createObjectURL(blob));
        stopCamera();
        processImageWithOCR(file);
      }
    }, 'image/jpeg', 0.9);
  };


  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handlePlayerSearch = async () => {
    if (!playerSearchName.trim()) {
      setPlayerSearchError('Please enter a player name');
      return;
    }

    setPlayerSearchLoading(true);
    setPlayerSearchError('');

    try {
      const params = new URLSearchParams({
        grader: playerSearchGrader,
        category: playerSearchCategory,
        player: playerSearchName.trim()
      });

      const response = await fetch(`${API_BASE_URL}/api/gemrate/player?${params.toString()}`);
      const data = await response.json();

      if (data.success && data.data && Array.isArray(data.data.cards)) {
        // Debug: Log parallel data for first few cards
        const cardsWithNonBaseParallel = data.data.cards.filter(c => 
          c.parallel && 
          c.parallel !== 'N/A' && 
          c.parallel.toLowerCase() !== 'base' &&
          c.parallel.trim() !== ''
        );
        console.log('[TCDBBrowser] Player search results:', {
          totalCards: data.data.cards.length,
          firstCardParallel: data.data.cards[0]?.parallel,
          firstCardData: data.data.cards[0],
          cardsWithParallel: data.data.cards.filter(c => c.parallel && c.parallel !== 'N/A' && c.parallel.toLowerCase() !== 'base').length,
          cardsWithNonBaseParallel: cardsWithNonBaseParallel.length,
          sampleNonBaseParallels: cardsWithNonBaseParallel.slice(0, 5).map(c => ({
            parallel: c.parallel,
            player: c.player,
            set: c.set,
            number: c.number
          }))
        });
        setPlayerSearchResults(data.data.cards);
      } else {
        setPlayerSearchResults([]);
        setPlayerSearchError(data.error || 'No cards found for this player');
      }
    } catch (err) {
      console.error('Error searching GemRate player cards:', err);
      setPlayerSearchResults([]);
      setPlayerSearchError('Error searching player cards: ' + err.message);
    } finally {
      setPlayerSearchLoading(false);
    }
  };

  return (
    <div className="tcdb-browser">
      <div className="tcdb-header">
        <h1>📚 Card Database Browser</h1>
        <div className="db-info">
          <span>Current Database: {dbInfo.total} cards</span>
          {dbInfo.total > 0 && (
            <button onClick={handleClearDatabase} className="clear-db-btn">
              🗑️ Clear Database
            </button>
          )}
        </div>
      </div>

      {/* Player Search Section */}
      <div className="player-search-section">
        <h2>Player Search</h2>
        
        {/* Image Recognition Section */}
        <div className="image-recognition-section">
          <h3 style={{ color: '#ffd700', marginBottom: '10px', fontSize: '1.1em' }}>
            📸 Take a Photo or Upload Image
          </h3>
          <div className="image-recognition-controls">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrLoading}
              className="upload-btn"
            >
              📁 Upload Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            {imagePreview && (
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                  setOcrError('');
                }}
                className="clear-image-btn"
              >
                ✕ Clear Image
              </button>
            )}
          </div>
          
          {imagePreview && (
            <div className="captured-image-container">
              <img src={imagePreview} alt="Card preview" className="captured-image" />
              {ocrLoading && (
                <div className="analysis-loading">
                  <div className="loading-spinner"></div>
                  <p>Reading card text...</p>
                </div>
              )}
            </div>
          )}
          
          {ocrError && (
            <div className="error-message" style={{ marginTop: '10px' }}>
              {ocrError}
            </div>
          )}
        </div>
        
        <div className="player-search-form">
          <input
            type="text"
            placeholder="Player name (e.g., Bo Nix)"
            value={playerSearchName}
            onChange={(e) => setPlayerSearchName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !playerSearchLoading && playerSearchName.trim()) {
                e.preventDefault();
                handlePlayerSearch();
              }
            }}
            className="player-search-input"
          />
          <select
            value={playerSearchCategory}
            onChange={(e) => setPlayerSearchCategory(e.target.value)}
            className="player-search-select"
          >
            <option value="all">All Categories</option>
            <option value="football-cards">Football</option>
            <option value="baseball-cards">Baseball</option>
            <option value="basketball-cards">Basketball</option>
            <option value="hockey-cards">Hockey</option>
            <option value="soccer-cards">Soccer</option>
            <option value="boxing-wrestling-cards">Boxing/Wrestling</option>
            <option value="golf-cards">Golf</option>
            <option value="misc-cards">Misc</option>
            <option value="multi-sport-cards">Multi-Sport</option>
            <option value="non-sport-cards">Non-Sport</option>
            <option value="packs">Packs</option>
            <option value="tcg-cards">TCG</option>
            <option value="tickets">Tickets</option>
          </select>
          <select
            value={playerSearchGrader}
            onChange={(e) => setPlayerSearchGrader(e.target.value)}
            className="player-search-select"
          >
            <option value="psa">PSA</option>
            <option value="bgs">BGS</option>
            <option value="sgc">SGC</option>
            <option value="cgc">CGC</option>
          </select>
          <button
            onClick={handlePlayerSearch}
            disabled={playerSearchLoading}
            className="player-search-button"
          >
            {playerSearchLoading ? 'Searching...' : 'Search Player'}
          </button>
        </div>
        {playerSearchError && (
          <div className="error-message">{playerSearchError}</div>
        )}
        {playerSearchResults.length > 0 && (() => {
          // Apply filters
          const filteredResults = playerSearchResults.filter((card) => {
            if (playerSearchFilterSet && !(card.set || '').toLowerCase().includes(playerSearchFilterSet.toLowerCase())) return false;
            if (playerSearchFilterCardNumber && !(card.number || '').toString().includes(playerSearchFilterCardNumber)) return false;
            return true;
          });

          // Apply sorting
          const sortedResults = [...filteredResults].sort((a, b) => {
            const dir = playerSearchSortDirection === 'asc' ? 1 : -1;

            const getValue = (card) => {
              switch (playerSearchSortField) {
                case 'year':
                  return card.year || '';
                case 'set':
                  return card.set || '';
                case 'player':
                  return card.player || '';
                case 'parallel':
                  return card.parallel || '';
                case 'number':
                  return card.number || '';
                case 'gems':
                  return typeof card.gems === 'number' ? card.gems : (card.gems ? Number(card.gems) || 0 : 0);
                case 'totalGrades':
                  return typeof card.totalGrades === 'number'
                    ? card.totalGrades
                    : (card.totalGrades ? Number(card.totalGrades) || 0 : 0);
                case 'gemRate':
                  if (card.gemRate === null || card.gemRate === undefined || card.gemRate === '') return -Infinity;
                  return typeof card.gemRate === 'number' ? card.gemRate : (Number(card.gemRate) || 0);
                default:
                  return '';
              }
            };

            const aVal = getValue(a);
            const bVal = getValue(b);

            // Numeric comparison when both are numbers
            if (typeof aVal === 'number' && typeof bVal === 'number') {
              if (aVal === bVal) return 0;
              return aVal > bVal ? dir : -dir;
            }

            // String comparison
            const aStr = (aVal || '').toString().toLowerCase();
            const bStr = (bVal || '').toString().toLowerCase();
            if (aStr === bStr) return 0;
            return aStr > bStr ? dir : -dir;
          });

          const handleSortClick = (field) => {
            if (playerSearchSortField === field) {
              // Toggle direction
              setPlayerSearchSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
            } else {
              setPlayerSearchSortField(field);
              // Default: numbers desc, strings asc
              if (['gems', 'totalGrades', 'gemRate', 'number', 'year'].includes(field)) {
                setPlayerSearchSortDirection('desc');
              } else {
                setPlayerSearchSortDirection('asc');
              }
            }
          };

          const renderSortIndicator = (field) => {
            if (playerSearchSortField !== field) return null;
            return playerSearchSortDirection === 'asc' ? ' ▲' : ' ▼';
          };

          return (
          <div className="player-search-results">
            <h3>
              Results for {playerSearchName} ({filteredResults.length} of {playerSearchResults.length} cards)
            </h3>
            {/* Filter inputs */}
            <div style={{ marginBottom: '15px', display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="filter-set" style={{ fontWeight: 600 }}>Filter by Set:</label>
                <input
                  id="filter-set"
                  type="text"
                  value={playerSearchFilterSet}
                  onChange={(e) => setPlayerSearchFilterSet(e.target.value)}
                  placeholder="Enter set name..."
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    minWidth: '200px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="filter-card-number" style={{ fontWeight: 600 }}>Filter by Card #:</label>
                <input
                  id="filter-card-number"
                  type="text"
                  value={playerSearchFilterCardNumber}
                  onChange={(e) => setPlayerSearchFilterCardNumber(e.target.value)}
                  placeholder="Enter card number..."
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    minWidth: '150px'
                  }}
                />
              </div>
              {(playerSearchFilterSet || playerSearchFilterCardNumber) && (
                <button
                  onClick={() => {
                    setPlayerSearchFilterSet('');
                    setPlayerSearchFilterCardNumber('');
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#f0f0f0',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
            {/* Mobile Card View */}
            <div className="mobile-card-list">
              {sortedResults.map((card, index) => {
                // Debug: Log card data for first card
                if (index === 0) {
                  console.log('[TCDBBrowser] First card data:', {
                    gems: card.gems,
                    totalGrades: card.totalGrades,
                    gemRate: card.gemRate,
                    card: card
                  });
                }
                
                // Format gems and totalGrades - ensure they're always numbers
                const gemsValue = typeof card.gems === 'number' 
                  ? card.gems 
                  : (card.gems ? parseInt(card.gems) || 0 : 0);
                const totalGradesValue = typeof card.totalGrades === 'number'
                  ? card.totalGrades
                  : (card.totalGrades ? parseInt(card.totalGrades) || 0 : 0);
                
                const gems = gemsValue.toLocaleString();
                const totalGrades = totalGradesValue.toLocaleString();
                // Format gem rate as percentage
                let gemRate = 'N/A';
                if (card.gemRate !== null && card.gemRate !== undefined && card.gemRate !== '') {
                  const gemRateNum = typeof card.gemRate === 'number' ? card.gemRate : parseFloat(card.gemRate);
                  if (!isNaN(gemRateNum)) {
                    gemRate = `${(gemRateNum * 100).toFixed(2)}%`;
                  }
                }

                const sportFromCategory = () => {
                  switch (playerSearchCategory) {
                    case 'football-cards':
                      return 'Football';
                    case 'baseball-cards':
                      return 'Baseball';
                    case 'basketball-cards':
                      return 'Basketball';
                    case 'hockey-cards':
                      return 'Hockey';
                    default:
                      return null;
                  }
                };

                const handleMobileCardClick = () => {
                  // Map GemRate row data into a format ScoreCardSummary understands
                  const initialGemrateData = {
                    total: typeof card.totalGrades === 'number'
                      ? card.totalGrades
                      : (card.totalGrades ? Number(card.totalGrades) || 0 : 0),
                    perfect: typeof card.gems === 'number'
                      ? card.gems
                      : (card.gems ? Number(card.gems) || 0 : 0),
                    // We don't have a clean PSA 9 population from the row; leave grade9 undefined
                    grade9: undefined,
                    // card.gemRate from GemRate is a decimal (0-1); ScoreCardSummary will handle converting to %
                    gemRate: card.gemRate !== null && card.gemRate !== undefined && card.gemRate !== ''
                      ? (typeof card.gemRate === 'number' ? card.gemRate : Number(card.gemRate) || 0)
                      : null,
                  };

                  setSelectedCardGemrateData(initialGemrateData);
                  setSelectedCardSetInfo({
                    sport: sportFromCategory(),
                    year: card.year || null,
                    setName: card.set || null,
                    parallel: card.parallel || null
                  });
                  handleCardClick(card);
                };

                return (
                  <div
                    key={index}
                    className="mobile-card-item"
                    onClick={handleMobileCardClick}
                  >
                    {/* Unified Information Box - All data visible */}
                    <div className="mobile-card-unified-box">
                      {/* Header Row: Year, Total, Gems, and Gem Rate */}
                      <div className="mobile-card-header">
                        <div className="mobile-card-year-section">
                          <span className="mobile-card-year-label">Year</span>
                          <span className="mobile-card-year">{card.year || 'N/A'}</span>
                        </div>
                        <div className="mobile-card-header-stats">
                          <div className="mobile-card-header-stat">
                            <span className="mobile-card-header-stat-label">Total</span>
                            <span className="mobile-card-header-stat-value">{totalGrades}</span>
                          </div>
                          <div className="mobile-card-header-stat">
                            <span className="mobile-card-header-stat-label">Gems</span>
                            <span className="mobile-card-header-stat-value">{gems}</span>
                          </div>
                        </div>
                        <div className="mobile-card-gem-rate-section">
                          <span className="mobile-card-gem-rate-label">Gem Rate</span>
                          <span className="mobile-card-gem-rate">{gemRate}</span>
                        </div>
                      </div>
                      
                      {/* Set Name - Always visible */}
                      <div className="mobile-card-set">{card.set || 'N/A'}</div>
                      
                      {/* Parallel - Display if exists and not base */}
                      {(() => {
                        const parallel = card.parallel;
                        const shouldShow = parallel && typeof parallel === 'string' && parallel.trim() !== '' && 
                            parallel.trim() !== 'N/A' && parallel.trim().toLowerCase() !== 'base';
                        
                        // Debug logging for cards with non-base parallels
                        if (shouldShow && index < 10) {
                          console.log(`[TCDBBrowser] Card ${index} showing parallel:`, {
                            parallel: parallel.trim(),
                            cardData: { year: card.year, set: card.set, number: card.number, player: card.player }
                          });
                        }
                        
                        // Show parallel if it exists, is a non-empty string, and not 'base' or 'N/A'
                        if (shouldShow) {
                          return (
                            <div className="mobile-card-detail-item" style={{ display: 'flex', visibility: 'visible', opacity: 1, marginTop: '4px', marginBottom: '4px' }}>
                              <span className="mobile-card-label">Parallel:</span>
                              <span className="mobile-card-value">{parallel.trim()}</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Card Number and Player Name - Same Row */}
                      <div className="mobile-card-number-player-row">
                        {card.number && card.number !== 'N/A' && (
                          <div className="mobile-card-detail-item">
                            <span className="mobile-card-label">Card #:</span>
                            <span className="mobile-card-value">{card.number}</span>
                          </div>
                        )}
                        <div className="mobile-card-player">{card.player || 'N/A'}</div>
                      </div>
                      
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="checklist-container">
              <table className="checklist-table">
                <thead>
                  <tr>
                    <th
                      style={{ width: '80px', cursor: 'pointer' }}
                      onClick={() => handleSortClick('year')}
                    >
                      Year{renderSortIndicator('year')}
                    </th>
                    <th
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSortClick('set')}
                    >
                      Set{renderSortIndicator('set')}
                    </th>
                    <th
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSortClick('player')}
                    >
                      Player{renderSortIndicator('player')}
                    </th>
                    <th
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSortClick('parallel')}
                    >
                      Parallel{renderSortIndicator('parallel')}
                    </th>
                    <th
                      style={{ width: '90px', cursor: 'pointer' }}
                      onClick={() => handleSortClick('number')}
                    >
                      Card #{renderSortIndicator('number')}
                    </th>
                    <th
                      style={{ width: '110px', cursor: 'pointer' }}
                      onClick={() => handleSortClick('gems')}
                    >
                      Gems{renderSortIndicator('gems')}
                    </th>
                    <th
                      style={{ width: '130px', cursor: 'pointer' }}
                      onClick={() => handleSortClick('totalGrades')}
                    >
                      Total Grades{renderSortIndicator('totalGrades')}
                    </th>
                    <th
                      style={{ width: '90px', cursor: 'pointer' }}
                      onClick={() => handleSortClick('gemRate')}
                    >
                      Gem %{renderSortIndicator('gemRate')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((card, index) => {
                    const gems =
                      typeof card.gems === 'number'
                        ? card.gems.toLocaleString()
                        : 'N/A';
                    const totalGrades =
                      typeof card.totalGrades === 'number'
                        ? card.totalGrades.toLocaleString()
                        : 'N/A';
                    // Format gem rate as percentage
                    let gemRate = 'N/A';
                    if (card.gemRate !== null && card.gemRate !== undefined && card.gemRate !== '') {
                      const gemRateNum = typeof card.gemRate === 'number' ? card.gemRate : parseFloat(card.gemRate);
                      if (!isNaN(gemRateNum)) {
                        gemRate = `${(gemRateNum * 100).toFixed(2)}%`;
                      }
                    }

                    const sportFromCategory = () => {
                      switch (playerSearchCategory) {
                        case 'football-cards':
                          return 'Football';
                        case 'baseball-cards':
                          return 'Baseball';
                        case 'basketball-cards':
                          return 'Basketball';
                        case 'hockey-cards':
                          return 'Hockey';
                        default:
                          return null;
                      }
                    };

                    return (
                      <tr
                        key={index}
                        onClick={() => {
                          // Map GemRate row data into a format ScoreCardSummary understands
                          const initialGemrateData = {
                            total: typeof card.totalGrades === 'number'
                              ? card.totalGrades
                              : (card.totalGrades ? Number(card.totalGrades) || 0 : 0),
                            perfect: typeof card.gems === 'number'
                              ? card.gems
                              : (card.gems ? Number(card.gems) || 0 : 0),
                            // We don't have a clean PSA 9 population from the row; leave grade9 undefined
                            grade9: undefined,
                            // card.gemRate from GemRate is a decimal (0-1); ScoreCardSummary will handle converting to %
                            gemRate: card.gemRate !== null && card.gemRate !== undefined && card.gemRate !== ''
                              ? (typeof card.gemRate === 'number' ? card.gemRate : Number(card.gemRate) || 0)
                              : null,
                          };

                          setSelectedCardGemrateData(initialGemrateData);
                          setSelectedCardSetInfo({
                            sport: sportFromCategory(),
                            year: card.year || null,
                            setName: card.set || null,
                            parallel: card.parallel || null
                          });
                          handleCardClick(card);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{card.year || 'N/A'}</td>
                        <td>{card.set || 'N/A'}</td>
                        <td>{card.player || 'N/A'}</td>
                        <td>{card.parallel || 'N/A'}</td>
                        <td>{card.number || 'N/A'}</td>
                        <td>{gems}</td>
                        <td>{totalGrades}</td>
                        <td>{gemRate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          );
        })()}
      </div>


      {/* Score Card Summary View */}
      {currentStep === 'score-card-summary' && selectedCardForSummary && (
        <ScoreCardSummary
          card={selectedCardForSummary}
          setInfo={
            selectedCardSetInfo || {
              sport: null,
              year: null,
              setName: null,
              parallel: null
            }
          }
          initialGemrateData={selectedCardGemrateData}
          onBack={() => {
            setCurrentStep('player-search');
            setSelectedCardForSummary(null);
            setSelectedCardSetInfo(null);
            setSelectedCardGemrateData(null);
          }}
        />
      )}

    </div>
  );
};

export default TCDBBrowser;

