const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const API_ENDPOINTS = {
    BASE: API_BASE_URL,
    DEVICES: `${API_BASE_URL}/api/devices`,
    GPS: `${API_BASE_URL}/api/gps`,
    ALERTS: `${API_BASE_URL}/api/alerts`,
    ANALYTICS: `${API_BASE_URL}/api/analytics`,
    DISCOVERY: `${API_BASE_URL}/api/discovery`,
    SNMP: `${API_BASE_URL}/api/snmp`,
    TELTONIKA: `${API_BASE_URL}/api/teltonika`,
    USERS: `${API_BASE_URL}/api/users`,
    HEALTH: `${API_BASE_URL}/health`,
};

export const fetchWithCORS = async (url: string, options: RequestInit = {}) => {
    const defaultOptions: RequestInit = {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    };

    try {
        const response = await fetch(url, defaultOptions);
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
};
