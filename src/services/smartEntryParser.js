/**
 * SmartEntryParser.js
 * Rule-based Natural Language Processing (NLP) parser for Khata Voice & Text Smart Entry
 */

export function parseNaturalLanguageEntry(textInput) {
  if (!textInput || typeof textInput !== 'string' || !textInput.trim()) {
    return {
      amount: 0,
      type: 'GAVE', // 'GAVE' (Debit) | 'GOT' (Credit)
      category: 'General',
      party: '',
      confidence: 'LOW',
      rawInput: textInput || ''
    };
  }

  const raw = textInput.trim();
  const lower = raw.toLowerCase();

  // 1. Amount Regex
  // Matches: ₹500, Rs. 1,000, 250.50, rs 500, rupees 500, etc.
  const amountRegex = /(?:₹|rs\.?\s*|rupees?\s*|rupaye\s*|rupaya\s*)?((?:\d{1,3}(?:\s*,\s*\d{3})+|\d+)(?:\.\d{1,2})?)/i;
  const amountMatch = raw.match(amountRegex);

  let amount = 0;
  if (amountMatch && amountMatch[1]) {
    const cleanNumStr = amountMatch[1].replace(/,/g, '').trim();
    amount = parseFloat(cleanNumStr) || 0;
  }

  // 2. Type Detection (Debit vs Credit). Includes Hinglish (Hindi in Latin
  // script) and Devanagari verbs, since Hindi voice input transcribes to
  // either depending on the recognizer/keyboard.
  const debitKeywords = [
    'spent', 'paid', 'bought', 'cost', 'debited', 'bill', 'charged', 'purchased', 'gave', 'paid out', 'debit',
    'diya', 'diye', 'de diya', 'diya hai', 'kharch', 'kharcha', 'kharche', 'kiya kharch', 'udhaar diya',
    'दिया', 'दिए', 'खर्च', 'खर्चा', 'उधार दिया'
  ];
  const creditKeywords = [
    'received', 'got', 'earned', 'credited', 'salary', 'income', 'returned', 'paid back', 'credit', 'borrowed',
    'mila', 'mile', 'mil gaya', 'aaya', 'aa gaya', 'wapas mila', 'liya',
    'मिला', 'मिले', 'आया', 'वापस मिला', 'लिया'
  ];

  let isCredit = false;
  let isDebit = false;

  for (const kw of creditKeywords) {
    if (lower.includes(kw)) {
      isCredit = true;
      break;
    }
  }

  for (const kw of debitKeywords) {
    if (lower.includes(kw)) {
      isDebit = true;
      break;
    }
  }

  // Default type: GAVE (Debit) if paid/spent, GOT (Credit) if received/got
  let type = 'GAVE';
  if (isCredit && !isDebit) {
    type = 'GOT';
  } else if (isDebit) {
    type = 'GAVE';
  }

  // 3. Category Mapping
  const categoryRules = [
    { cat: 'Dining & Food', keywords: ['food', 'restaurant', 'lunch', 'dinner', 'cafe', 'zomato', 'swiggy', 'chai', 'coffee', 'tea', 'snack', 'hotel', 'meal', 'eating', 'dining'] },
    { cat: 'Logistics & Fuel', keywords: ['uber', 'ola', 'auto', 'petrol', 'fuel', 'cab', 'train', 'flight', 'bus', 'metro', 'diesel', 'toll', 'transport', 'logistics'] },
    { cat: 'General', keywords: ['shopping', 'amazon', 'flipkart', 'clothes', 'grocery', 'groceries', 'market', 'mall', 'shop', 'dress', 'shoes'] },
    { cat: 'Rent & Utilities', keywords: ['electricity', 'wifi', 'internet', 'recharge', 'rent', 'water', 'bill', 'maintenance', 'utilities'] },
    { cat: 'Salary / Wage', keywords: ['salary', 'stipend', 'wage', 'bonus', 'payout'] },
    { cat: 'Invoice Payment', keywords: ['invoice', 'settlement', 'payment', 'transfer', 'upi', 'bank', 'gpay', 'phonepe', 'paytm'] },
    { cat: 'Raw Supplies', keywords: ['raw', 'materials', 'supplies', 'stock', 'inventory', 'vendor'] }
  ];

  let detectedCategory = 'General';
  for (const rule of categoryRules) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      detectedCategory = rule.cat;
      break;
    }
  }

  // 4. Party Detection (Extract name after prepositions: to, from, with, by)
  let detectedParty = '';
  const partyRegex = /\b(?:to|from|with|by|for)\s+([A-Za-z0-9\s]+?)(?:\s+(?:for|on|via|rs|inr|₹|\d)|$)/i;
  const partyMatch = raw.match(partyRegex);

  if (partyMatch && partyMatch[1]) {
    const candidate = partyMatch[1].trim();
    // Exclude common category or keyword noise from party name
    const noisyWords = ['food', 'petrol', 'uber', 'ola', 'rent', 'bill', 'dinner', 'lunch', 'salary', 'cash', 'upi', 'gpay', 'phonepe'];
    if (!noisyWords.includes(candidate.toLowerCase())) {
      // Clean and capitalize party name
      detectedParty = candidate.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  // Fallback: If no party match after preposition, look for proper nouns or trailing words
  if (!detectedParty) {
    // Try matching pattern like "Ram 500" or "500 Shyam"
    const nameAmountRegex = /^([A-Z][a-z]+)\s+\d+|^[A-Za-z]+\s+(?:paid|got|gave|received)\s+\d+/i;
    const nameMatch = raw.match(nameAmountRegex);
    if (nameMatch && nameMatch[1]) {
      detectedParty = nameMatch[1].trim();
    }
  }

  // 5. Confidence Scoring
  let confidence = 'LOW';
  const hasAmount = amount > 0;
  const hasType = isCredit || isDebit;
  const hasPartyOrCat = Boolean(detectedParty) || detectedCategory !== 'General';

  if (hasAmount && hasType && hasPartyOrCat) {
    confidence = 'HIGH';
  } else if (hasAmount && (hasType || hasPartyOrCat)) {
    confidence = 'MEDIUM';
  } else if (hasAmount) {
    confidence = 'LOW';
  }

  return {
    amount,
    type,
    category: detectedCategory,
    party: detectedParty,
    confidence,
    rawInput: raw
  };
}
