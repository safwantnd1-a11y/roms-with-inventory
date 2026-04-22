import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import axios from 'axios';

// For standalone clients (APK / Kitchen exe), use explicit API URL if available
const customUrl = localStorage.getItem('__roms_server_ip');
if (customUrl) {
  axios.defaults.baseURL = customUrl;
}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
