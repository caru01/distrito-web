import React from 'react';
import ReactDOM from 'react-dom/client';
import StoreFront from './App.jsx';
import Rastrear from './pages/Rastrear.jsx';
import './index.css';

// Routing simple por path: /rastrear/:id → Rastrear, resto → StoreFront
const isRastrear = window.location.pathname.startsWith('/rastrear/');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isRastrear ? <Rastrear /> : <StoreFront />}
  </React.StrictMode>
);
