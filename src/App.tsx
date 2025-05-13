import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Host from './components/Host/Host';
import Participant from './components/Participant/Participant';
import Home from './components/Home';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/host" element={<Host />} />
          <Route path="/participant" element={<Participant />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
