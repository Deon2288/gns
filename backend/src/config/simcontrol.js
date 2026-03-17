// SimControl API Configuration
const simcontrolConfig = {
    // Base API URL
    apiUrl: process.env.SIMCONTROL_API_URL || 'https://app.simcontrol.co.za/api',

    // Authentication
    apiKey: process.env.SIMCONTROL_API_KEY || '',
    apiSecret: process.env.SIMCONTROL_API_SECRET || '',

    // Webhook
    webhookSecret: process.env.SIMCONTROL_WEBHOOK_SECRET || '',

    // Sync interval in seconds (default: 1 hour)
    syncInterval: parseInt(process.env.SIMCONTROL_SYNC_INTERVAL || '3600', 10),

    // HTTP request settings
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second base delay (exponential backoff applied)

    // Cache TTL in seconds
    cacheTtl: 300, // 5 minutes

    // Rate limiting
    rateLimit: {
        maxRequests: 100,
        windowMs: 60000, // per minute
    },

    // GraphQL endpoint
    graphqlUrl: process.env.SIMCONTROL_API_URL
        ? `${process.env.SIMCONTROL_API_URL}/graphql`
        : 'https://app.simcontrol.co.za/api/graphql',

    // REST endpoints
    endpoints: {
        sims: '/sims',
        simDetails: '/sims/:id',
        simUsage: '/sims/:id/usage',
        simHistory: '/sims/:id/history',
        simBalance: '/sims/:id/balance',
        simSuspend: '/sims/:id/suspend',
        simReactivate: '/sims/:id/reactivate',
        simEvents: '/sims/:id/events',
    },
};

module.exports = simcontrolConfig;
