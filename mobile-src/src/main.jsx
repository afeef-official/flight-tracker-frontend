import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { getToken } from './api.js';
import { setSplash } from './loader.js';
import './styles.css';

setSplash(Boolean(getToken())); // signed-in users see the loading screen straight away; everyone else the login form

createRoot(document.getElementById('root')).render(<App />);

