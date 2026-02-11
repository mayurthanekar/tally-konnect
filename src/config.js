require('dotenv').config();

module.exports = {
  konnect: {
    baseUrl: process.env.KONNECT_BASE_URL || 'https://api.konnect.network',
    apiKey: process.env.KONNECT_API_KEY || '',
    historyPath: process.env.KONNECT_HISTORY_PATH || '/v1/transactions',
  },
  tally: {
    url: process.env.TALLY_URL || 'http://localhost:9000',
    cloudUrl: process.env.TALLY_CLOUD_URL || '',
    konnectLedger: process.env.TALLY_KONNECT_LEDGER || 'Konnect Bank',
    defaultCreditLedger: process.env.TALLY_DEFAULT_CREDIT_LEDGER || 'Cash',
  },
};
