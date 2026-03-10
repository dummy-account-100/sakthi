import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import axios from 'axios';

// Add a request interceptor to attach JWT token to all requests
axios.interceptors.request.use(
  (config) => {
    // 1. Try to get the token if stored directly
    let token = localStorage.getItem("token");

    // 2. If not found, try to get it from the user object
    if (!token) {
      const userData = localStorage.getItem("user");
      if (userData) {
        try {
          const user = JSON.parse(userData);
          token = user?.token;
        } catch (e) {
          console.error("Error parsing user data from localStorage", e);
        }
      }
    }

    // 3. Apply the token to the headers
    if (token) {
      // Safe fallback for different Axios versions
      if (config.headers && typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // 🔥 CRITICAL FIX FOR PRODUCTION: Allows cross-origin requests to send Authorization
    config.withCredentials = true;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();