import React, { useEffect, useState } from 'react';
import './App.css';
import HomePage from './components/HomePage';
import SearchPage from './components/SearchPage';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
        setIsLoggedIn(true);
      } catch (error) {
        setUser(null);
        setIsLoggedIn(false);
        localStorage.removeItem('authToken');
      }
    } else {
      setUser(null);
      setIsLoggedIn(false);
    }
  }, []);

  const handleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
    setIsLoggedIn(false);
    window.location.reload();
  };

  return (
    <Router>
      <div className="App">
        {/* Global Header */}
        <header className="global-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', background: '#000', color: '#ffd700' }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>Scorecard</div>
          <div>
            {!isLoggedIn ? (
              <button onClick={handleLogin} style={{ background: '#ffd700', color: '#000', border: 'none', borderRadius: '5px', padding: '0.5rem 1.2rem', fontWeight: 'bold', cursor: 'pointer' }}>Log in</button>
            ) : (
              <span style={{ marginRight: '1rem' }}>
                {user?.displayName} ({user?.email})
              </span>
            )}
            {isLoggedIn && (
              <button onClick={handleLogout} style={{ background: '#ffd700', color: '#000', border: 'none', borderRadius: '5px', padding: '0.5rem 1.2rem', fontWeight: 'bold', cursor: 'pointer' }}>Log out</button>
            )}
          </div>
        </header>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
