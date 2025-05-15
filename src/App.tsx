import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/Home/Home';
import Host from './components/Host/Host';
import Participant from './components/Participant/Participant';
import { API_URL } from './config';
import './App.css';

function App() {
  useEffect(() => {
    console.log('App initialized');
    console.log('Environment:', {
      API_URL: API_URL,
      NODE_ENV: process.env.NODE_ENV,
      REACT_APP_OPENROUTER_API_KEY: process.env.REACT_APP_OPENROUTER_API_KEY ? 'exists' : 'missing',
      REACT_APP_PUSHER_KEY: process.env.REACT_APP_PUSHER_KEY ? 'exists' : 'missing',
      REACT_APP_PUSHER_CLUSTER: process.env.REACT_APP_PUSHER_CLUSTER ? 'exists' : 'missing'
    });
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/host" element={<Host />} />
          <Route path="/participant" element={<Participant />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
