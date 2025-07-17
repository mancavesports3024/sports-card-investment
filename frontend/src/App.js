import React, { useEffect, useState } from 'react';
import './App.css';
import HomePage from './components/HomePage';
import SearchPage from './components/SearchPage';
import AuthSuccess from './components/AuthSuccess';
import SavedSearches from './components/SavedSearches';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  const checkAuthStatus = () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        // Decode JWT token to get user info
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
        setIsLoggedIn(true);
      } catch (error) {
        console.error('Invalid token:', error);
        localStorage.removeItem('authToken');
        setUser(null);
        setIsLoggedIn(false);
      }
    } else {
      setUser(null);
      setIsLoggedIn(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const handleLogin = () => {
    window.location.href = 'https://web-production-9efa.up.railway.app/api/auth/google';
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
        <header className="global-header" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem 2rem', background: '#000', color: '#ffd700', position: 'relative' }}>
          {/* Social Media Left */}
          <div style={{ position: 'absolute', left: 32, display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
            <a href="https://twitter.com/scorecard" target="_blank" rel="noopener noreferrer" style={{ color: '#ffd700', fontSize: '1.4rem', textDecoration: 'none' }} title="Follow on X">𝕏</a>
            <a href="https://instagram.com/scorecard" target="_blank" rel="noopener noreferrer" style={{ color: '#ffd700', fontSize: '1.4rem', textDecoration: 'none' }} title="Instagram">📷</a>
          </div>
          {/* Centered Title */}
          <div style={{ fontWeight: 'bold', fontSize: '1.5rem', textAlign: 'center', flex: 1 }}>Scorecard</div>
          {/* Login/Logout/User Right */}
          <div style={{ position: 'absolute', right: 32, display: 'flex', alignItems: 'center' }}>
            {!isLoggedIn ? (
              <button onClick={handleLogin} style={{ background: '#ffd700', color: '#000', border: 'none', borderRadius: '5px', padding: '0.5rem 1.2rem', fontWeight: 'bold', cursor: 'pointer' }}>Log in</button>
            ) : (
              <span style={{ marginRight: '1rem' }}>
                {user?.displayName || user?.name || ((user?.given_name || user?.givenName) && (user?.family_name || user?.familyName) ? `${user.given_name || user.givenName} ${user.family_name || user.familyName}` : '')}
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
          <Route path="/auth-success" element={<AuthSuccess onAuthSuccess={checkAuthStatus} />} />
          <Route path="/saved-searches" element={<SavedSearches />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
