import React, { createContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../services/authService';
import useLocalStorage from '../hooks/useLocalStorage';
import API_BASE_URL from '../services/api';
import axios from 'axios';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useLocalStorage('accessToken', null);
  const [refreshToken, setRefreshToken] = useLocalStorage('refreshToken', null);

  const login = useCallback(async (email, password) => {
    const res = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
    setUser(res.data.user);
    setAccessToken(res.data.accessToken);
    setRefreshToken(res.data.refreshToken);
    return res.data;
  }, [setAccessToken, setRefreshToken]);

  const register = useCallback(async (username, email, password) => {
    const res = await axios.post(`${API_BASE_URL}/api/auth/register`, { username, email, password });
    setUser(res.data.user);
    setAccessToken(res.data.accessToken);
    setRefreshToken(res.data.refreshToken);
    return res.data;
  }, [setAccessToken, setRefreshToken]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch {}
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, [setAccessToken, setRefreshToken]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    const checkAuth = async () => {
      try {
        const res = await apiClient.get('/api/auth/profile');
        setUser(res.data.user);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []); // intentionally run only on mount

  const value = { user, loading, login, logout, register, isAuthenticated: !!user };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
