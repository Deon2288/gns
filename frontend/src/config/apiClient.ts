import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://197.242.150.120:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export default apiClient;
