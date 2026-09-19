import { useState, useEffect } from 'react';

const THEME_KEY = 'khata_theme';
const LANG_KEY = 'khata_lang';

export const translations = {
  EN: {
    dashboard: 'Dashboard',
    parties: 'Parties',
    transactions: 'Transactions',
    backup: 'Backup',
    profile: 'Profile',
    goodMorning: 'Good morning',
    netBalanceGet: 'NET BALANCE (YOU WILL GET)',
    netBalanceGive: 'NET BALANCE (YOU WILL GIVE)',
    youWillGet: 'YOU WILL GET',
    youWillGive: 'YOU WILL GIVE',
    contacts: 'Contacts',
    cloudBackup: 'Cloud Backup',
    topSpending: 'TOP SPENDING',
    recentLedgerEntries: 'Recent Ledger Entries',
    seeAll: 'SEE ALL',
    smartEntry: 'Smart Entry',

    partiesLedger: 'Parties Ledger',
    allParties: 'All Parties',
    customers: 'Customers (Receivable)',
    suppliers: 'Suppliers (Payable)',
    addParty: 'Add Party',
    addNewParty: 'Add New Party',
    searchPartyPlaceholder: 'Search by party name, phone...',
    youGet: 'YOU GET',
    youGive: 'YOU GIVE',
    settled: 'Settled',

    fullName: 'Full Name',
    phone: 'Phone Number',
    partyType: 'Party Type',
    customer: 'Customer',
    supplier: 'Supplier',
    openingBalance: 'Opening Balance',
    createParty: 'Create Party',

    callDirect: 'Call Direct',
    whatsApp: 'WhatsApp',
    paymentReminder: 'Payment Due Reminder SMS/WhatsApp',
    netRunningBalance: 'NET RUNNING BALANCE',
    youGaveDebit: 'YOU GAVE ₹ (Debit)',
    youGotCredit: 'YOU GOT ₹ (Credit)',
    searchTimelinePlaceholder: 'Search within party timeline...',
    allEntries: 'All Entries',
    debitGave: 'Debit (Gave)',
    creditGot: 'Credit (Got)',
    withReceipts: 'With Receipts 📎',
    statementTimeline: 'Statement Timeline',
    addEntry: 'Add Entry',

    editPartyDetails: 'Edit Party Details',
    exportPdfStatement: 'Export PDF Statement',
    shareViaWhatsApp: 'Share via WhatsApp',
    toggleCurrency: 'Toggle Currency',
    enableBiometric: 'Enable Biometric Lock',

    profileSettings: 'Profile Settings',
    backToDashboard: 'Back to Dashboard',
    editableDetails: 'Editable Profile Details',
    emailAddress: 'Email Address',
    phoneNumber: 'Phone Number',
    roleDesignation: 'Role / Designation',
    saveChanges: 'Save Changes',
    accountMetadata: 'Account & Ledger Metadata',
    signOut: 'Sign Out of Khata Account',

    preferences: 'Preferences & Settings',
    themeSetting: 'App Theme',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    languageSetting: 'App Language',
    englishLang: 'English',
    hindiLang: 'हिंदी'
  },
  HI: {
    dashboard: 'डैशबोर्ड',
    parties: 'पार्टी लेजर',
    transactions: 'लेनदेन',
    backup: 'बैकअप',
    profile: 'प्रोफाइल',
    goodMorning: 'शुभ प्रभात',
    netBalanceGet: 'कुल बकाया (आपको मिलेगा)',
    netBalanceGive: 'कुल देय (आपको देना है)',
    youWillGet: 'आपको मिलेगा',
    youWillGive: 'आपको देना है',
    contacts: 'संपर्क',
    cloudBackup: 'क्लाउड बैकअप',
    topSpending: 'प्रमुख खर्च',
    recentLedgerEntries: 'हाल के लेजर प्रविष्टियां',
    seeAll: 'सभी देखें',
    smartEntry: 'स्मार्ट एंट्री',

    partiesLedger: 'पार्टी लेजर',
    allParties: 'सभी पार्टियां',
    customers: 'ग्राहक (देने वाले)',
    suppliers: 'आपूर्तिकर्ता (लेने वाले)',
    addParty: 'पार्टी जोड़ें',
    addNewParty: 'नया पार्टी जोड़ें',
    searchPartyPlaceholder: 'नाम, फोन से खोजें...',
    youGet: 'आपको मिलेगा',
    youGive: 'आपको देना है',
    settled: 'चुका दिया',

    fullName: 'पूरा नाम',
    phone: 'फोन नंबर',
    partyType: 'पार्टी का प्रकार',
    customer: 'ग्राहक',
    supplier: 'सप्लायर',
    openingBalance: 'प्रारंभिक शेष',
    createParty: 'पार्टी बनाएं',

    callDirect: 'सीधा कॉल करें',
    whatsApp: 'व्हाट्सएप',
    paymentReminder: 'भुगतान अनुस्मारक एसएमएस/व्हाट्सएप',
    netRunningBalance: 'कुल बकाया राशि',
    youGaveDebit: 'आपने दिया ₹ (डेबिट)',
    youGotCredit: 'आपको मिला ₹ (क्रेडिट)',
    searchTimelinePlaceholder: 'टाइमलाइन में खोजें...',
    allEntries: 'सभी प्रविष्टियां',
    debitGave: 'डेबिट (दिया)',
    creditGot: 'क्रेडिट (मिला)',
    withReceipts: 'रसीद के साथ 📎',
    statementTimeline: 'स्टेटमेंट टाइमलाइन',
    addEntry: 'प्रविष्टि जोड़ें',

    editPartyDetails: 'पार्टी विवरण बदलें',
    exportPdfStatement: 'पीडीएफ स्टेटमेंट डाउनलोड करें',
    shareViaWhatsApp: 'व्हाट्सएप पर शेयर करें',
    toggleCurrency: 'मुद्रा बदलें',
    enableBiometric: 'बायोमेट्रिक लॉक चालू करें',

    profileSettings: 'प्रोफाइल एवं सेटिंग्स',
    backToDashboard: 'डैशबोर्ड पर वापस जाएं',
    editableDetails: 'संपादनीय प्रोफाइल विवरण',
    emailAddress: 'ईमेल पता',
    phoneNumber: 'फोन नंबर',
    roleDesignation: 'पद / भूमिका',
    saveChanges: 'बदलाव सहेजें',
    accountMetadata: 'खाता एवं लेजर मेटाडेटा',
    signOut: 'खाते से लॉग आउट करें',

    preferences: 'पसंद एवं सेटिंग्स',
    themeSetting: 'ऐप थीम',
    darkMode: 'डार्क मोड',
    lightMode: 'लाइट मोड',
    languageSetting: 'ऐप भाषा',
    englishLang: 'English',
    hindiLang: 'हिंदी'
  }
};

let listeners = [];
let prefsState = {
  theme: localStorage.getItem(THEME_KEY) || 'dark', // 'dark' | 'light'
  lang: localStorage.getItem(LANG_KEY) || 'EN'       // 'EN' | 'HI'
};

function applyThemeAttribute(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

// Initial theme apply
applyThemeAttribute(prefsState.theme);

export function usePreferencesStore() {
  const [store, setStore] = useState(prefsState);

  useEffect(() => {
    listeners.push(setStore);
    return () => {
      listeners = listeners.filter(l => l !== setStore);
    };
  }, []);

  const setTheme = (newTheme) => {
    localStorage.setItem(THEME_KEY, newTheme);
    applyThemeAttribute(newTheme);
    prefsState = { ...prefsState, theme: newTheme };
    listeners.forEach(l => l(prefsState));
  };

  const setLang = (newLang) => {
    localStorage.setItem(LANG_KEY, newLang);
    prefsState = { ...prefsState, lang: newLang };
    listeners.forEach(l => l(prefsState));
  };

  const t = (key) => {
    if (!key) return '';
    const langDict = translations[store.lang] || translations.EN;
    if (langDict[key]) return langDict[key];
    if (translations.EN[key]) return translations.EN[key];
    // Fallback human-readable text for any missing key
    return String(key)
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return {
    theme: store.theme,
    lang: store.lang,
    setTheme,
    setLang,
    t
  };
}
