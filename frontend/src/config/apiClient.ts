import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '${REACT_APP_API_URL}';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export default apiClient;
