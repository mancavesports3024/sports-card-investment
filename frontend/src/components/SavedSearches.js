import React, { useEffect, useState } from 'react';
import config from '../config';
import tokenService from '../services/tokenService';

const SavedSearches = ({ onSearchAgain, refetchTrigger, forceOpen }) => {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(!!tokenService.getAccessToken());
  const [open, setOpen] = useState(true);

  // Sync open state with forceOpen prop (counter: fold when it changes)
  useEffect(() => {
    setOpen(false);
  }, [forceOpen]);

  // Expose a refetch function for parent
  const refetchSavedSearches = async () => {
    setLoading(true);
    setError(null);
    
    const token = tokenService.getAccessToken();
    setIsLoggedIn(!!token);
    
    if (!token) {
      setError('You must be logged in to view saved searches.');
      setLoading(false);
      setOpen(false);
      return;
    }
    
    try {
      // Use the token service for automatic token refresh
      const response = await tokenService.authenticatedFetch(config.getSearchHistoryUrl(), {
        cache: 'no-store'
      });
      
      let text, data;
      try {
        text = await response.text();
        data = JSON.parse(text);
        console.log('Loaded saved searches:', data);
      } catch (jsonErr) {
        console.error('Failed to parse JSON. Response text:', text);
        setError('Failed to load saved searches: Invalid JSON. See console for details.');
        setLoading(false);
        setOpen(false);
        return;
      }
      
      if (!data.success) {
        setError(data.error || 'Failed to load saved searches.');
        setOpen(false);
      } else {
        setSearches(data.searches || []);
        setOpen((data.searches || []).length > 0);
      }
    } catch (err) {
      console.error('Failed to load saved searches:', err);
      if (err.message.includes('Authentication failed')) {
        setError('Authentication failed. Please log in again.');
        setIsLoggedIn(false);
      } else {
        setError('Failed to load saved searches: ' + (err.message || err.toString()));
      }
      setOpen(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    refetchSavedSearches();
    // Optionally refetch when parent triggers
    // eslint-disable-next-line
  }, [refetchTrigger]);

  const handleDelete = async (searchId) => {
    try {
      const response = await tokenService.authenticatedFetch(config.getDeleteSearchUrl(searchId), {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await refetchSavedSearches();
      } else {
        console.error('Delete failed:', response.status);
      }
    } catch (err) {
      console.error('Delete error:', err);
      if (err.message.includes('Authentication failed')) {
        setError('Authentication failed. Please log in again.');
        setIsLoggedIn(false);
      }
    }
  };

  const handleClearAll = async () => {
    try {
      const response = await tokenService.authenticatedFetch(config.getClearHistoryUrl(), {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await refetchSavedSearches();
      } else {
        console.error('Clear all failed:', response.status);
      }
    } catch (err) {
      console.error('Clear all error:', err);
      if (err.message.includes('Authentication failed')) {
        setError('Authentication failed. Please log in again.');
        setIsLoggedIn(false);
      }
    }
  };

  const handleLogin = () => {
    window.location.href = 'https://web-production-9efa.up.railway.app/api/auth/google';
  };

  if (loading) return <div style={{ color: '#ffd700', textAlign: 'center', margin: '2rem' }}>Loading saved searches...</div>;
  if (!isLoggedIn) return <div style={{ color: '#fff', textAlign: 'center', margin: '2rem' }}><div style={{ color: 'red', marginBottom: 12 }}>{error}</div><button onClick={handleLogin} style={{ background: '#ffd700', color: '#000', border: 'none', borderRadius: 4, padding: '0.5rem 1.2rem', fontWeight: 'bold', cursor: 'pointer' }}>Log in to view saved searches</button></div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', margin: '2rem' }}>{error}</div>;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto 0 auto', background: '#222', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '2rem', border: '1.5px solid #ffd700', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ color: '#ffd700', marginBottom: 0 }}>My Saved Searches</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setOpen(o => !o)} style={{ background: '#ffd700', color: '#000', border: 'none', borderRadius: 4, padding: '0.3rem 1rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>{open ? 'Hide Saved Searches' : 'Show Saved Searches'}</button>
          {open && searches.length > 0 && (
            <button onClick={handleClearAll} style={{ background: '#b00', color: '#fff', border: 'none', borderRadius: 4, padding: '0.3rem 1rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>Clear All</button>
          )}
        </div>
      </div>
      {open && (searches.length === 0 ? (
        <div style={{ color: '#fff', textAlign: 'center' }}>No saved searches found.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {searches.map((search) => (
            <li key={search.id || search._id} style={{ marginBottom: 18, background: '#333', borderRadius: 6, padding: '1rem 1.5rem', border: '1px solid #ffd700' }}>
              <div style={{ fontWeight: 'bold', color: '#ffd700' }}>{search.query || search.searchQuery}</div>
              {/* Show average prices for Raw, PSA 9, PSA 10 */}
              {search.results && (
                <div style={{ fontSize: '0.92em', color: '#bbb', marginTop: 2 }}>
                  {(() => {
                    const getAveragePrice = (cards) => {
                      if (!cards || !Array.isArray(cards) || cards.length === 0) return 'N/A';
                      const validPrices = cards
                        .filter(card => card.price?.value && !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0)
                        .map(card => Number(card.price.value));
                      if (validPrices.length === 0) return 'N/A';
                      const avg = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
                      return `$${avg.toFixed(2)}`;
                    };
                    
                    const rawAvg = getAveragePrice(search.results.raw);
                    const psa9Avg = getAveragePrice(search.results.psa9);
                    const psa10Avg = getAveragePrice(search.results.psa10);
                    
                    return `Raw: ${rawAvg}, PSA 9: ${psa9Avg}, PSA 10: ${psa10Avg}`;
                  })()}
                </div>
              )}
              <div style={{ marginTop: 10, display: 'flex', gap: '1rem' }}>
                <button onClick={() => onSearchAgain(search)} style={{ background: '#ffd700', color: '#000', border: 'none', borderRadius: 4, padding: '0.3rem 1rem', fontWeight: 'bold', cursor: 'pointer' }}>Search Again</button>
                <button onClick={() => handleDelete(search.id || search._id)} style={{ background: '#b00', color: '#fff', border: 'none', borderRadius: 4, padding: '0.3rem 1rem', fontWeight: 'bold', cursor: 'pointer' }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
};

export default SavedSearches; 