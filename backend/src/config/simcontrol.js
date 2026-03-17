module.exports = {
  apiUrl: process.env.SIMCONTROL_API_URL || 'https://app.simcontrol.co.za/api',
  apiKey: process.env.SIMCONTROL_API_KEY || '',
  webhookSecret: process.env.SIMCONTROL_WEBHOOK_SECRET || '',
  syncInterval: parseInt(process.env.SIMCONTROL_SYNC_INTERVAL || '3600', 10) * 1000,
  balanceThreshold: parseFloat(process.env.SIMCONTROL_BALANCE_THRESHOLD || '500'),
  webhookUrl: process.env.SIMCONTROL_WEBHOOK_URL || '',
};
