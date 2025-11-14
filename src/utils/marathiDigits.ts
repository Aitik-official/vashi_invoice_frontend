/**
 * Utility functions for converting between Marathi and English digits
 * 
 * Marathi digits mapping:
 * ० = 0, १ = 1, २ = 2, ३ = 3, ४ = 4, ५ = 5, ६ = 6, ७ = 7, ८ = 8, ९ = 9
 */

// Mapping of Marathi digits to English digits
const MARATHI_TO_ENGLISH: { [key: string]: string } = {
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
};

// Mapping of English digits to Marathi digits
const ENGLISH_TO_MARATHI: { [key: string]: string } = {
  '0': '०',
  '1': '१',
  '2': '२',
  '3': '३',
  '4': '४',
  '5': '५',
  '6': '६',
  '7': '७',
  '8': '८',
  '9': '९',
};

/**
 * Converts Marathi digits to English digits
 * Example: "१२७" -> "127"
 */
export function marathiToEnglish(text: string): string {
  if (!text) return text;
  
  return text.split('').map(char => {
    return MARATHI_TO_ENGLISH[char] || char;
  }).join('');
}

/**
 * Converts English digits to Marathi digits
 * Example: "127" -> "१२७"
 */
export function englishToMarathi(text: string): string {
  if (!text) return text;
  
  return text.split('').map(char => {
    return ENGLISH_TO_MARATHI[char] || char;
  }).join('');
}

/**
 * Converts a number to Marathi digits string
 * Example: 127 -> "१२७"
 */
export function numberToMarathi(num: number | null | undefined): string {
  if (num === null || num === undefined) return '';
  return englishToMarathi(num.toString());
}

/**
 * Parses a string (with Marathi or English digits) to a number
 * Example: "१२७" -> 127, "127" -> 127
 */
export function parseMarathiNumber(text: string): number {
  if (!text) return 0;
  
  // First convert Marathi to English, then parse
  const englishText = marathiToEnglish(text.toString().trim());
  const parsed = parseFloat(englishText.replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formats a number with Marathi digits, including decimal support
 * Example: 127.50 -> "१२७.५०"
 */
export function formatMarathiNumber(num: number | null | undefined, decimals: number = 2): string {
  if (num === null || num === undefined) return '';
  
  const formatted = num.toFixed(decimals);
  return englishToMarathi(formatted);
}

/**
 * Formats currency with Marathi digits (for display)
 * Example: 127.50 -> "१२७.५०"
 */
export function formatMarathiCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '';
  return formatMarathiNumber(value, 2);
}

/**
 * Checks if a string contains Marathi digits
 */
export function containsMarathiDigits(text: string): boolean {
  if (!text) return false;
  return /[०-९]/.test(text);
}

/**
 * Normalizes input: converts Marathi to English for calculations
 * This should be used when processing user input
 */
export function normalizeInputForCalculation(text: string): string {
  return marathiToEnglish(text);
}

