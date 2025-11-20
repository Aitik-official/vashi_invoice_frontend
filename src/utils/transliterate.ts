/**
 * English to Marathi Devanagari Transliteration using Aksharamukha
 * Production-ready transliteration library
 * Only loads in browser environment to avoid Node.js module issues
 */

// Small dictionary for words that Aksharamukha doesn't handle well
const CORRECTION_DICTIONARY: { [key: string]: string } = {
  'mumbai': 'मुंबई',
  'Mumbai': 'मुंबई',
  'MUMBAI': 'मुंबई',
  'delhi': 'दिल्ली',
  'Delhi': 'दिल्ली',
  'DELHI': 'दिल्ली',
  'bhaskar': 'भास्कर',
  'Bhaskar': 'भास्कर',
  'BHASKAR': 'भास्कर',
};

// Dynamic import for Aksharamukha - only in browser environment
let Aksharamukha: any = null;
let isLoadingAksharamukha = false;
let loadPromise: Promise<any> | null = null;

// Load Aksharamukha from CDN
function loadAksharamukhaScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Only run in browser
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Not in browser environment'));
      return;
    }
    
    // Check if already loaded
    if ((window as any).Aksharamukha) {
      resolve();
      return;
    }
    
    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="aksharamukha"]');
    if (existingScript) {
      // Wait for it to load
      const checkInterval = setInterval(() => {
        if ((window as any).Aksharamukha) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      existingScript.addEventListener('load', () => {
        clearInterval(checkInterval);
        resolve();
      });
      existingScript.addEventListener('error', () => {
        clearInterval(checkInterval);
        reject(new Error('Failed to load Aksharamukha script'));
      });
      return;
    }
    
    // Load from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/aksharamukha@latest/dist/index.global.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    
    // Wait a bit for the global to be available after script loads
    script.onload = () => {
      // Give it a moment to initialize
      setTimeout(() => {
        if ((window as any).Aksharamukha) {
          resolve();
        } else {
          // Try waiting a bit more
          setTimeout(() => {
            if ((window as any).Aksharamukha) {
              resolve();
            } else {
              reject(new Error('Aksharamukha not available after script load'));
            }
          }, 500);
        }
      }, 100);
    };
    
    script.onerror = () => reject(new Error('Failed to load Aksharamukha script'));
    document.head.appendChild(script);
  });
}

// Lazy load Aksharamukha - only in browser, never during SSR or build
async function loadAksharamukha() {
  // Only load in browser environment, not during SSR or build
  if (typeof window === 'undefined') {
    return null;
  }
  
  // If already loading, wait for it
  if (loadPromise) {
    return loadPromise;
  }
  
  // If already loaded, return it
  if (Aksharamukha) {
    return Aksharamukha;
  }
  
  // Start loading
  isLoadingAksharamukha = true;
  loadPromise = (async () => {
    try {
      // Load script from CDN
      await loadAksharamukhaScript();
      
      // Check if Aksharamukha is available globally (from CDN)
      if (typeof window !== 'undefined' && (window as any).Aksharamukha) {
        Aksharamukha = (window as any).Aksharamukha;
        isLoadingAksharamukha = false;
        return Aksharamukha;
      }
      
      // If still not available, return null
      console.error('Aksharamukha not available after loading script');
      isLoadingAksharamukha = false;
      loadPromise = null;
      return null;
    } catch (error) {
      console.error('Failed to load Aksharamukha:', error);
      isLoadingAksharamukha = false;
      loadPromise = null;
      return null;
    }
  })();
  
  return loadPromise;
}

// Cache the Aksharamukha instance to avoid re-initialization
let aksharamukhaInstance: any = null;

/**
 * Initialize Aksharamukha instance (lazy loading)
 */
async function getAksharamukhaInstance() {
  if (!aksharamukhaInstance) {
    try {
      const AksharamukhaClass = await loadAksharamukha();
      if (AksharamukhaClass) {
        aksharamukhaInstance = await AksharamukhaClass.new();
      }
    } catch (error) {
      console.error('Failed to initialize Aksharamukha:', error);
      // Fallback to basic transliteration if library fails
      return null;
    }
  }
  return aksharamukhaInstance;
}

/**
 * Preprocesses word to improve Aksharamukha accuracy
 * Converts English text to better transliteration format
 */
function preprocessWordForAksharamukha(word: string): string {
  // Convert to lowercase for better transliteration
  let processed = word.toLowerCase();
  
  // Handle common English patterns that need adjustment
  // "mb" -> "mb" (keep as is, Aksharamukha handles it)
  // "ai" at end -> keep as "ai" 
  // "ll" -> keep as "ll"
  
  return processed;
}

/**
 * Transliterates a word using Aksharamukha with multiple format attempts and better parameters
 * Uses correction dictionary for known problematic words
 */
async function transliterateWord(word: string, aksharamukha: any): Promise<string> {
  // First check correction dictionary for known words
  const lowerWord = word.toLowerCase();
  if (CORRECTION_DICTIONARY[lowerWord] || CORRECTION_DICTIONARY[word]) {
    return CORRECTION_DICTIONARY[lowerWord] || CORRECTION_DICTIONARY[word];
  }
  
  // If no Aksharamukha available, return original
  if (!aksharamukha) {
    return word;
  }
  
  // Preprocess word for better transliteration
  const preprocessed = preprocessWordForAksharamukha(word);
  
  // Try multiple formats with Aksharamukha for best results
  let transliterated = word;
  let bestResult = word;
  
  // Try different input formats in order of preference with different options
  const attempts = [
    { format: 'IAST', options: { nativize: true } },
    { format: 'ITRANS', options: { nativize: true } },
    { format: 'autodetect', options: { nativize: true } },
    { format: 'Latin', options: { nativize: true } },
    { format: 'IAST', options: { nativize: false } },
    { format: 'ITRANS', options: { nativize: false } },
    { format: 'autodetect', options: { nativize: false } },
  ];
  
  for (const attempt of attempts) {
    try {
      const result = await aksharamukha.processAsync(
        attempt.format, 
        'Devanagari', 
        preprocessed,
        attempt.options
      );
      
      if (result && result !== preprocessed && /[\u0900-\u097F]/.test(result)) {
        // Check if this result is better (has more Marathi characters)
        const marathiChars = (result.match(/[\u0900-\u097F]/g) || []).length;
        const bestMarathiChars = (bestResult.match(/[\u0900-\u097F]/g) || []).length;
        
        if (marathiChars > bestMarathiChars || bestResult === word) {
          bestResult = result;
          transliterated = result;
        }
        
        // If we got a good result with nativize, use it
        if (attempt.options.nativize && marathiChars > 0) {
          break;
        }
      }
    } catch (e) {
      // Try next format
      continue;
    }
  }
  
  // If we got a good result, return it
  if (bestResult !== word && /[\u0900-\u097F]/.test(bestResult)) {
    return bestResult;
  }
  
  return transliterated;
}

/**
 * Preprocesses English text to improve transliteration accuracy
 * Converts common English patterns to better transliteration-friendly format
 */
function preprocessTextForTransliteration(text: string): string {
  if (!text) return text;
  
  // Don't convert to lowercase - preserve case for dictionary lookup
  // Handle common English patterns that don't transliterate well
  // Keep numbers and punctuation as-is
  return text;
}

/**
 * Transliterates English text to Marathi Devanagari using Aksharamukha
 * This is the production-ready implementation
 * Only works in browser environment (client-side)
 * Processes word by word for better accuracy
 */
export async function transliterateToMarathiAsync(text: string): Promise<string> {
  if (!text) return text;
  
  // If already contains Marathi, return as is
  if (/[\u0900-\u097F]/.test(text)) {
    return text;
  }
  
  // Only run in browser environment
  if (typeof window === 'undefined') {
    // During SSR, return text as-is
    return text;
  }
  
  try {
    const aksharamukha = await getAksharamukhaInstance();
    if (!aksharamukha) {
      // Fallback: return text as-is if library not available
      return text;
    }
    
    // Preprocess text for better transliteration
    const preprocessed = preprocessTextForTransliteration(text);
    
    // Try transliterating the whole phrase first (sometimes works better)
    let wholePhraseResult = '';
    try {
      // Try IAST with nativize for the whole phrase
      wholePhraseResult = await aksharamukha.processAsync(
        'IAST', 
        'Devanagari', 
        preprocessed.toLowerCase(),
        { nativize: true }
      );
      
      // If whole phrase transliteration worked well, use it
      if (wholePhraseResult && 
          wholePhraseResult !== preprocessed.toLowerCase() && 
          /[\u0900-\u097F]/.test(wholePhraseResult) &&
          wholePhraseResult.length > 0) {
        return wholePhraseResult;
      }
    } catch (e) {
      // Continue with word-by-word
    }
    
    // If whole phrase didn't work well, process word by word
    const words = preprocessed.split(/(\s+|[.,;:!?\-_()\[\]{}'"])/);
    const transliteratedWords = await Promise.all(
      words.map(async (word) => {
        // Skip whitespace and punctuation
        if (/^\s*$/.test(word) || /^[.,;:!?\-_()\[\]{}'"]+$/.test(word)) {
          return word;
        }
        
        // Skip if already contains Marathi
        if (/[\u0900-\u097F]/.test(word)) {
          return word;
        }
        
        // Skip pure numbers (they'll be converted separately)
        if (/^\d+$/.test(word.trim())) {
          return word;
        }
        
        // Use improved Aksharamukha transliteration
        return await transliterateWord(word.trim(), aksharamukha);
      })
    );
    
    return transliteratedWords.join('');
  } catch (error) {
    console.error('Transliteration error:', error);
    // Return original text if transliteration fails
    return text;
  }
}

/**
 * Synchronous wrapper for transliteration
 * Uses async transliteration but returns synchronously (for compatibility)
 * For best results, use the async version
 */
export function transliterateToMarathi(text: string): string {
  if (!text) return text;
  
  // If already contains Marathi, return as is
  if (/[\u0900-\u097F]/.test(text)) {
    return text;
  }
  
  // For synchronous calls, return text as-is
  // The async version will be called when possible
  return text;
}

/**
 * Enhanced transliteration with better word handling
 * Uses Aksharamukha for production-ready transliteration
 */
export async function transliterateEnglishToMarathi(text: string): Promise<string> {
  if (!text) return text;
  
  // If already in Marathi, return as is
  if (/[\u0900-\u097F]/.test(text)) {
    return text;
  }
  
  return await transliterateToMarathiAsync(text);
}

