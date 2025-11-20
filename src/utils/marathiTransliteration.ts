/**
 * Utility functions for converting English text and numbers to Marathi
 * Uses Aksharamukha for production-ready transliteration
 */

import { englishToMarathi } from './marathiDigits';
import { transliterateEnglishToMarathi, transliterateToMarathiAsync } from './transliterate';

/**
 * Checks if text contains Marathi characters
 */
export function isMarathi(text: string): boolean {
  if (!text) return false;
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Converts numbers in a string to Marathi digits
 * Example: "Price: 100" -> "Price: १००"
 */
export function convertNumbersToMarathi(text: string): string {
  if (!text) return text;
  
  // Replace all English digits with Marathi digits
  return text.replace(/\d/g, (digit) => {
    const marathiDigits: { [key: string]: string } = {
      '0': '०', '1': '१', '2': '२', '3': '३', '4': '४',
      '5': '५', '6': '६', '7': '७', '8': '८', '9': '९'
    };
    return marathiDigits[digit] || digit;
  });
}

/**
 * Basic English to Marathi transliteration mapping
 * This is a simplified transliteration - for production, consider using a library
 */
const TRANSLITERATION_MAP: { [key: string]: string } = {
  // Vowels
  'a': 'अ', 'aa': 'आ', 'A': 'आ', 'AA': 'आ',
  'i': 'इ', 'ee': 'ई', 'I': 'ई', 'EE': 'ई',
  'u': 'उ', 'oo': 'ऊ', 'U': 'ऊ', 'OO': 'ऊ',
  'e': 'ए', 'E': 'ए', 'ai': 'ऐ', 'AI': 'ऐ',
  'o': 'ओ', 'O': 'ओ', 'au': 'औ', 'AU': 'औ',
  
  // Consonants
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
  
  // Common words
  'name': 'नाव', 'place': 'स्थान', 'city': 'शहर',
  'number': 'क्रमांक', 'no': 'नं', 'yes': 'होय',
};

/**
 * Transliterates text: converts English text to Marathi Devanagari
 * Uses Aksharamukha for production-ready transliteration
 * This is an async function that properly handles transliteration
 */
async function transliterateTextAsync(text: string): Promise<string> {
  if (!text) return text;
  
  // If already in Marathi, return as is
  if (isMarathi(text)) {
    return text;
  }
  
  // First convert numbers to Marathi
  let result = convertNumbersToMarathi(text);
  
  // Then transliterate English text to Marathi using Aksharamukha
  try {
    const transliterated = await transliterateEnglishToMarathi(result);
    return transliterated || result;
  } catch (error) {
    console.error('Transliteration error:', error);
    // Return with numbers converted if transliteration fails
    return result;
  }
}

/**
 * Synchronous version - returns text with numbers converted
 * For full transliteration, use the async version
 */
function transliterateText(text: string): string {
  if (!text) return text;
  
  // If already in Marathi, return as is
  if (isMarathi(text)) {
    return text;
  }
  
  // Convert numbers to Marathi
  return convertNumbersToMarathi(text);
}

/**
 * Converts a value to Marathi - handles text with numbers
 * Converts all English digits to Marathi digits
 * For text, converts to Marathi transliteration using Aksharamukha
 * 
 * Note: This is a synchronous wrapper. For full transliteration,
 * use convertToMarathiAsync for better results.
 */
export function convertToMarathi(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  
  const str = String(value);
  
  // If already contains Marathi characters, check if it has English digits
  if (isMarathi(str)) {
    // Still convert any English digits that might be mixed in
    return convertNumbersToMarathi(str);
  }
  
  // Convert numbers to Marathi (synchronous)
  // For full text transliteration, the async version will be used in components
  return transliterateText(str);
}

/**
 * Async version that uses Aksharamukha for full transliteration
 * This is the production-ready version
 */
export async function convertToMarathiAsync(value: string | number | null | undefined): Promise<string> {
  if (value === null || value === undefined) return '';
  
  const str = String(value);
  
  // If already contains Marathi characters, check if it has English digits
  if (isMarathi(str)) {
    // Still convert any English digits that might be mixed in
    return convertNumbersToMarathi(str);
  }
  
  // Use async transliteration with Aksharamukha
  return await transliterateTextAsync(str);
}

/**
 * Converts text input to Marathi for display
 * This converts numbers to Marathi digits and transliterates text
 * Synchronous version - converts numbers immediately
 */
export function convertInputToMarathi(text: string): string {
  if (!text) return text;
  
  // Convert numbers to Marathi (synchronous)
  return transliterateText(text);
}

/**
 * Async version that uses Aksharamukha for full transliteration
 * This is the production-ready version for input conversion
 */
export async function convertInputToMarathiAsync(text: string): Promise<string> {
  if (!text) return text;
  
  // Use async transliteration with Aksharamukha
  return await transliterateTextAsync(text);
}

