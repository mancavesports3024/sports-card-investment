import React, { useEffect, useState } from 'react';
import config from '../config';
import tokenService from '../services/tokenService';

const SavedSearches = ({ onSearchAgain, refetchTrigger, forceOpen }) => {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(!!tokenService.getAccessToken());
  const [open, setOpen] = useState(true);
  const [gemrateData, setGemrateData] = useState({}); // Store GemRate data by search ID

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
        const loadedSearches = data.searches || [];
        setSearches(loadedSearches);
        setOpen(loadedSearches.length > 0);
        
        // Use stored GemRate data if available, otherwise fetch it
        const gemrateMap = {};
        loadedSearches.forEach(search => {
          const searchId = search.id || search._id;
          if (search.gemrateData) {
            // Use stored GemRate data
            gemrateMap[searchId] = search.gemrateData;
            console.log(`[SAVED SEARCHES] Using stored GemRate data for search ${searchId}`);
          } else {
            // Fetch GemRate data if not stored
            fetchGemrateForSearch(search);
          }
        });
        if (Object.keys(gemrateMap).length > 0) {
          setGemrateData(gemrateMap);
        }
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

  const fetchGemrateForSearch = async (search) => {
    const searchQuery = search.query || search.searchQuery;
    if (!searchQuery) return;
    
    try {
      // Clean the search query - remove exclusions for GemRate
      let cleanQuery = searchQuery;
      const exclusionIndex = cleanQuery.indexOf(' -(');
      if (exclusionIndex !== -1) {
        cleanQuery = cleanQuery.substring(0, exclusionIndex).trim();
      }
      
      const response = await fetch(`${config.API_BASE_URL}/api/gemrate/search/${encodeURIComponent(cleanQuery)}`);
      const data = await response.json();
      
      if (data.success && data.data && data.data.success && data.data.population) {
        setGemrateData(prev => ({
          ...prev,
          [search.id || search._id]: data.data.population
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch GemRate data for search ${search.id}:`, err);
    }
  };

  if (loading) return <div style={{ color: '#ffd700', textAlign: 'center', margin: '2rem' }}>Loading saved searches...</div>;
  if (!isLoggedIn) return <div style={{ color: '#fff', textAlign: 'center', margin: '2rem' }}><div style={{ color: 'red', marginBottom: 12 }}>{error}</div><button onClick={handleLogin} style={{ background: '#ffd700', color: '#000', border: 'none', borderRadius: 4, padding: '0.5rem 1.2rem', fontWeight: 'bold', cursor: 'pointer' }}>Log in to view saved searches</button></div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', margin: '2rem' }}>{error}</div>;

  return (
    <div style={{ maxWidth: '100%', margin: '2rem auto 0 auto', background: '#222', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '2rem', border: '1.5px solid #ffd700', color: '#fff' }}>
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
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
          gap: '1rem',
          listStyle: 'none',
          padding: 0
        }}>
          {searches.map((search) => {
            const searchId = search.id || search._id;
            const gemrate = gemrateData[searchId];
            
            const getAveragePrice = (cards) => {
              if (!cards || !Array.isArray(cards) || cards.length === 0) return 'N/A';
              const validPrices = cards
                .filter(card => card.price?.value && !isNaN(Number(card.price?.value)) && Number(card.price?.value) > 0)
                .map(card => Number(card.price.value));
              if (validPrices.length === 0) return 'N/A';
              const avg = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
              return `$${avg.toFixed(2)}`;
            };
            
            const rawAvg = search.results ? getAveragePrice(search.results.raw) : 'N/A';
            const psa9Avg = search.results ? getAveragePrice(search.results.psa9) : 'N/A';
            const psa10Avg = search.results ? getAveragePrice(search.results.psa10) : 'N/A';
            
            const totalPop = gemrate?.total || gemrate?.total_population || null;
            const gemRate = gemrate?.gemRate || null;
            
            return (
              <div 
                key={searchId} 
                style={{ 
                  background: '#333', 
                  borderRadius: 6, 
                  padding: '0.75rem', 
                  border: '1px solid #ffd700',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#ffd700', fontSize: '0.9rem', wordBreak: 'break-word' }}>
                  {search.query || search.searchQuery}
                </div>
                
                {/* Prices */}
                {search.results && (
                  <div style={{ fontSize: '0.8em', color: '#bbb' }}>
                    <div>Raw: {rawAvg}</div>
                    <div>PSA 9: {psa9Avg}</div>
                    <div>PSA 10: {psa10Avg}</div>
                  </div>
                )}
                
                {/* GemRate Data */}
                {(totalPop || gemRate !== null) && (
                  <div style={{ fontSize: '0.8em', color: '#ffd700', borderTop: '1px solid #555', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                    {gemRate !== null && <div>Gem Rate: {gemRate.toFixed(1)}%</div>}
                    {totalPop && <div>Total Pop: {totalPop.toLocaleString()}</div>}
                  </div>
                )}
                
                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => onSearchAgain(search)} 
                    style={{ 
                      background: '#ffd700', 
                      color: '#000', 
                      border: 'none', 
                      borderRadius: 4, 
                      padding: '0.25rem 0.75rem', 
                      fontWeight: 'bold', 
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    Search
                  </button>
                  <button 
                    onClick={() => handleDelete(searchId)} 
                    style={{ 
                      background: '#b00', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: 4, 
                      padding: '0.25rem 0.75rem', 
                      fontWeight: 'bold', 
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default SavedSearches; 