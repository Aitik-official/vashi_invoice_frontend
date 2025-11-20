/**
 * Advanced Phonetic Transliteration for English to Marathi
 * Handles any word/name accurately using phonetic rules
 * Similar to Google Transliteration approach
 */

/**
 * Phonetic mapping for English to Marathi Devanagari
 * Based on common phonetic patterns
 */
const PHONETIC_MAP: { [key: string]: string } = {
  // Vowels
  'a': 'अ', 'aa': 'आ', 'A': 'आ', 'AA': 'आ',
  'i': 'इ', 'ee': 'ई', 'ii': 'ई', 'I': 'ई', 'EE': 'ई', 'II': 'ई',
  'u': 'उ', 'oo': 'ऊ', 'uu': 'ऊ', 'U': 'ऊ', 'OO': 'ऊ', 'UU': 'ऊ',
  'e': 'ए', 'E': 'ए', 'ai': 'ऐ', 'AI': 'ऐ', 'ay': 'ऐ', 'AY': 'ऐ',
  'o': 'ओ', 'O': 'ओ', 'au': 'औ', 'AU': 'औ', 'ow': 'औ', 'OW': 'औ',
  
  // Consonants with common patterns
  'k': 'क', 'kh': 'ख', 'g': 'ग', 'gh': 'घ', 'ng': 'ङ',
  'K': 'क', 'KH': 'ख', 'G': 'ग', 'GH': 'घ', 'NG': 'ङ',
  'c': 'च', 'ch': 'छ', 'j': 'ज', 'jh': 'झ', 'ny': 'ञ',
  'C': 'च', 'CH': 'छ', 'J': 'ज', 'JH': 'झ', 'NY': 'ञ',
  't': 'त', 'th': 'थ', 'd': 'द', 'dh': 'ध', 'n': 'न',
  'T': 'त', 'TH': 'थ', 'D': 'द', 'DH': 'ध', 'N': 'न',
  'p': 'प', 'ph': 'फ', 'b': 'ब', 'bh': 'भ', 'm': 'म',
  'P': 'प', 'PH': 'फ', 'B': 'ब', 'BH': 'भ', 'M': 'म',
  'y': 'य', 'r': 'र', 'l': 'ल', 'v': 'व', 'w': 'व',
  'Y': 'य', 'R': 'र', 'L': 'ल', 'V': 'व', 'W': 'व',
  'sh': 'श', 'shh': 'ष', 's': 'स', 'h': 'ह',
  'SH': 'श', 'SHH': 'ष', 'S': 'स', 'H': 'ह',
  'x': 'क्ष', 'X': 'क्ष',
  
  // Special patterns for common English sounds
  'mb': 'म्ब', 'MB': 'म्ब',
  'nd': 'न्द', 'ND': 'न्द',
  'ng': 'ङ्ग', 'NG': 'ङ्ग',
  'ai': 'ऐ', 'AI': 'ऐ',
  'au': 'औ', 'AU': 'औ',
  'ou': 'औ', 'OU': 'औ',
};

/**
 * Vowel matras (diacritics) for consonants
 */
const VOWEL_MATRAS: { [key: string]: string } = {
  'a': '', 'aa': 'ा', 'A': 'ा', 'AA': 'ा',
  'i': 'ि', 'ee': 'ी', 'ii': 'ी', 'I': 'ी', 'EE': 'ी', 'II': 'ी',
  'u': 'ु', 'oo': 'ू', 'uu': 'ू', 'U': 'ू', 'OO': 'ू', 'UU': 'ू',
  'e': 'े', 'E': 'े',
  'ai': 'ै', 'AI': 'ै',
  'o': 'ो', 'O': 'ो',
  'au': 'ौ', 'AU': 'ौ', 'ou': 'ौ', 'OU': 'ौ',
};

/**
 * Advanced phonetic transliteration
 * Handles English text more accurately with better pattern matching
 */
export function phoneticTransliterate(text: string): string {
  if (!text) return text;
  
  // If already in Marathi, return as is
  if (/[\u0900-\u097F]/.test(text)) {
    return text;
  }
  
  const lowerText = text.toLowerCase();
  let result = '';
  let i = 0;
  
  while (i < lowerText.length) {
    const char = lowerText[i];
    const nextChar = i + 1 < lowerText.length ? lowerText[i + 1] : '';
    const thirdChar = i + 2 < lowerText.length ? lowerText[i + 2] : '';
    const twoChars = char + nextChar;
    const threeChars = twoChars + thirdChar;
    
    // Special handling for common patterns
    // "mb" -> "म्ब" (as in Mumbai)
    if (char === 'm' && nextChar === 'b') {
      result += 'म्ब';
      i += 2;
      continue;
    }
    
    // "ai" at end -> "ई" (as in Mumbai)
    if (char === 'a' && nextChar === 'i' && i + 2 >= lowerText.length) {
      result += 'ई';
      i += 2;
      continue;
    }
    
    // "ai" in middle -> "ऐ"
    if (char === 'a' && nextChar === 'i') {
      result += 'ऐ';
      i += 2;
      continue;
    }
    
    // "ll" -> "ल्ल" (as in Delhi)
    if (char === 'l' && nextChar === 'l') {
      result += 'ल्ल';
      i += 2;
      continue;
    }
    
    // "sk" -> "स्क" (as in Bhaskar)
    if (char === 's' && nextChar === 'k') {
      result += 'स्क';
      i += 2;
      continue;
    }
    
    // "sh" -> "श"
    if (char === 's' && nextChar === 'h') {
      result += 'श';
      i += 2;
      continue;
    }
    
    // "ch" -> "च"
    if (char === 'c' && nextChar === 'h') {
      result += 'च';
      i += 2;
      continue;
    }
    
    // "th" -> "थ"
    if (char === 't' && nextChar === 'h') {
      result += 'थ';
      i += 2;
      continue;
    }
    
    // "kh" -> "ख"
    if (char === 'k' && nextChar === 'h') {
      result += 'ख';
      i += 2;
      continue;
    }
    
    // "gh" -> "घ"
    if (char === 'g' && nextChar === 'h') {
      result += 'घ';
      i += 2;
      continue;
    }
    
    // "bh" -> "भ"
    if (char === 'b' && nextChar === 'h') {
      result += 'भ';
      i += 2;
      continue;
    }
    
    // "ph" -> "फ"
    if (char === 'p' && nextChar === 'h') {
      result += 'फ';
      i += 2;
      continue;
    }
    
    // "dh" -> "ध"
    if (char === 'd' && nextChar === 'h') {
      result += 'ध';
      i += 2;
      continue;
    }
    
    // "jh" -> "झ"
    if (char === 'j' && nextChar === 'h') {
      result += 'झ';
      i += 2;
      continue;
    }
    
    // Handle vowels
    if (char === 'a') {
      result += 'अ';
      i++;
      continue;
    }
    if (char === 'i') {
      result += 'इ';
      i++;
      continue;
    }
    if (char === 'u') {
      result += 'उ';
      i++;
      continue;
    }
    if (char === 'e') {
      result += 'ए';
      i++;
      continue;
    }
    if (char === 'o') {
      result += 'ओ';
      i++;
      continue;
    }
    
    // Handle consonants
    if (char === 'm') {
      result += 'म';
      i++;
      continue;
    }
    if (char === 'b') {
      result += 'ब';
      i++;
      continue;
    }
    if (char === 'd') {
      result += 'द';
      i++;
      continue;
    }
    if (char === 'l') {
      result += 'ल';
      i++;
      continue;
    }
    if (char === 'h') {
      result += 'ह';
      i++;
      continue;
    }
    if (char === 'k') {
      result += 'क';
      i++;
      continue;
    }
    if (char === 'r') {
      result += 'र';
      i++;
      continue;
    }
    if (char === 's') {
      result += 'स';
      i++;
      continue;
    }
    if (char === 'c') {
      result += 'च';
      i++;
      continue;
    }
    if (char === 't') {
      result += 'त';
      i++;
      continue;
    }
    if (char === 'p') {
      result += 'प';
      i++;
      continue;
    }
    if (char === 'g') {
      result += 'ग';
      i++;
      continue;
    }
    if (char === 'j') {
      result += 'ज';
      i++;
      continue;
    }
    if (char === 'n') {
      result += 'न';
      i++;
      continue;
    }
    if (char === 'y') {
      result += 'य';
      i++;
      continue;
    }
    if (char === 'v' || char === 'w') {
      result += 'व';
      i++;
      continue;
    }
    
    // Keep spaces, punctuation, and numbers
    if (/[\s\.,;:!?\-_()\[\]{}'"]/.test(char)) {
      result += text[i]; // Preserve original case for punctuation
      i++;
      continue;
    }
    
    // For unknown characters, keep as-is
    result += text[i];
    i++;
  }
  
  return result;
}

/**
 * Improved transliteration with better handling of common English patterns
 */
export function transliterateEnglishToMarathiPhonetic(text: string): string {
  if (!text) return text;
  
  // If already in Marathi, return as is
  if (/[\u0900-\u097F]/.test(text)) {
    return text;
  }
  
  // Process word by word for better accuracy
  const words = text.split(/(\s+|[.,;:!?\-_()\[\]{}'"])/);
  const transliteratedWords = words.map(word => {
    // Skip whitespace and punctuation
    if (/^\s*$/.test(word) || /^[.,;:!?\-_()\[\]{}'"]+$/.test(word)) {
      return word;
    }
    
    // Skip if already contains Marathi
    if (/[\u0900-\u097F]/.test(word)) {
      return word;
    }
    
    // Skip pure numbers
    if (/^\d+$/.test(word.trim())) {
      return word;
    }
    
    // Use phonetic transliteration
    return phoneticTransliterate(word);
  });
  
  return transliteratedWords.join('');
}

