import React, { useEffect, useState } from 'react';
import './App.css';
import HomePage from './components/HomePage';
import SearchPage from './components/SearchPage';
import AuthSuccess from './components/AuthSuccess';
import SavedSearches from './components/SavedSearches';
import CardSetAnalysis from './components/CardSetAnalysis';
import NewsPage from './components/NewsPage';
import EbayItemLookup from './pages/EbayItemLookup';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import tokenService from './services/tokenService';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const token = tokenService.getAccessToken();
      
      if (!token) {
        setUser(null);
        setIsLoggedIn(false);
        return;
      }

      // Check if token is expired and refresh if needed
      if (tokenService.isTokenExpired(token)) {
        try {
          await tokenService.refreshToken();
        } catch (error) {
          console.error('Token refresh failed:', error);
          tokenService.clearTokens();
          setUser(null);
          setIsLoggedIn(false);
          return;
        }
      }

      // Validate token with backend
      const validation = await tokenService.validateToken();
      if (validation.valid) {
        setUser(validation.user);
        setIsLoggedIn(true);
      } else {
        console.error('Token validation failed:', validation.error);
        tokenService.clearTokens();
        setUser(null);
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      tokenService.clearTokens();
      setUser(null);
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const handleLogin = () => {
    window.location.href = 'https://web-production-9efa.up.railway.app/api/auth/google';
  };

  const handleLogout = () => {
    tokenService.clearTokens();
    setUser(null);
    setIsLoggedIn(false);
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#000',
        color: '#ffd700'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        {/* Global Header */}
        <header className="global-header responsive-header">
          {/* First row: Scorecard title only, centered and larger */}
          <div className="header-row header-row-top" style={{ justifyContent: 'center' }}>
            <span className="header-title main-title">Scorecard</span>
          </div>
          {/* Second row: navigation, social left, login/logout right */}
          <div className="header-row header-row-bottom" style={{ justifyContent: 'space-between' }}>
            <div className="header-nav-group">
              <a href="/" className="header-nav-link">Home</a>
              <a href="/search" className="header-nav-link">Search Cards</a>
              <a href="/card-set-analysis" className="header-nav-link">Card Set Analysis</a>
              <a href="/news" className="header-nav-link">News</a>
              <a href="/ebay-bidding" className="header-nav-link">eBay Item Lookup</a>
            </div>
            <div className="header-social-group">
              <a href="https://x.com/Mancavesportsc1" target="_blank" rel="noopener noreferrer" className="header-social">𝕏</a>
              <a href="https://www.instagram.com/mancavesportscardllc?igsh=NWoxOHJycGdrYzZk&utm_source=qr" target="_blank" rel="noopener noreferrer" className="header-social">📷</a>
              <a href="https://www.facebook.com/profile.php?id=100062665574017" target="_blank" rel="noopener noreferrer" className="header-social">📘</a>
            </div>
            <div className="header-user-actions">
              {!isLoggedIn ? (
                <button onClick={handleLogin} className="header-login-btn">Log in</button>
              ) : (
                <span className="header-username">
                  {user?.displayName || user?.name || ((user?.given_name || user?.givenName) && (user?.family_name || user?.familyName) ? `${user.given_name || user.givenName} ${user.family_name || user.familyName}` : '')}
                </span>
              )}
              {isLoggedIn && (
                <button onClick={handleLogout} className="header-login-btn">Log out</button>
              )}
            </div>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/card-set-analysis" element={<CardSetAnalysis />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/ebay-bidding" element={<EbayItemLookup />} />
          <Route path="/auth-success" element={<AuthSuccess onAuthSuccess={checkAuthStatus} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
