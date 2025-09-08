const API_BASE_URL = 'http://localhost:8000/api';

// Helper function to get auth headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Helper function to refresh token
export const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh: refreshToken
      }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('access_token', data.access);
      return data.access;
    } else {
      throw new Error('Failed to refresh token');
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    // Clear tokens and redirect to login
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    throw error;
  }
};

// Helper function for API calls with automatic token refresh
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // First attempt with current token
  let response = await fetch(url, {
    ...options,
    headers: getAuthHeaders(),
  });

  // If 401 unauthorized, try refreshing token
  if (response.status === 401) {
    try {
      await refreshAccessToken();
      // Retry with new token
      response = await fetch(url, {
        ...options,
        headers: getAuthHeaders(),
      });
    } catch (error) {
      // Refresh failed, user needs to login again
      window.location.href = '/login';
      throw error;
    }
  }

  return response;
};

// Logout function
export const logout = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  
  if (refreshToken) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          refresh: refreshToken
        }),
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  // Clear local storage
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return localStorage.getItem('access_token') !== null;
};

// Get current user
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};