import React, { useState, useEffect } from 'react';
import './TCDBBrowser.css';
import ScoreCardSummary from './ScoreCardSummary';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';

const TCDBBrowser = () => {
  // Step tracking - simplified flow: category -> sets -> checklist
  const [currentStep, setCurrentStep] = useState('category');
  
  // Data states
  const [categories, setCategories] = useState([]); // Categories (sports) from GemRate
  const [sets, setSets] = useState([]);
  const [checklist, setChecklist] = useState([]);
  
  // Selected values
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [selectedCardForSummary, setSelectedCardForSummary] = useState(null);
  const [selectedCardSetInfo, setSelectedCardSetInfo] = useState(null);
  
  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');

  // GemRate player search states
  const [playerSearchName, setPlayerSearchName] = useState('');
  const [playerSearchCategory, setPlayerSearchCategory] = useState('football-cards');
  const [playerSearchGrader, setPlayerSearchGrader] = useState('psa');
  const [playerSearchResults, setPlayerSearchResults] = useState([]);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [playerSearchError, setPlayerSearchError] = useState('');
  
  // Database info
  const [dbInfo, setDbInfo] = useState({ total: 0 });

  // Fetch database count on mount
  useEffect(() => {
    fetchDbInfo();
    fetchCategories();
  }, []);

  const fetchDbInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/cards?limit=1`);
      const data = await response.json();
      if (data.success && data.pagination) {
        setDbInfo({ total: data.pagination.total?.total || 0 });
      }
    } catch (err) {
      console.error('Error fetching DB info:', err);
    }
  };

  const fetchCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/gemrate/universal-pop-report`);
      const data = await response.json();
      if (data.success && data.data && data.data.categories) {
        // Convert categories object to array for display
        const categoryList = Object.keys(data.data.categories).map(categoryName => ({
          name: categoryName,
          sets: data.data.categories[categoryName]
        }));
        setCategories(categoryList);
      } else {
        setError(data.error || 'Failed to fetch categories');
      }
    } catch (err) {
      setError('Error fetching categories: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setSets(category.sets);
    setCurrentStep('set');
  };

  const fetchChecklist = async (set) => {
    setLoading(true);
    setError('');
    try {
      // Build set path: {set_id}-{year} {set_name}-{category}
      // Handle null/undefined year and remove emojis
      const year = set.year || '';
      let setName = (set.name || set.set_name || '').trim();
      const category = set.category || '';
      const setId = set.set_id || set.id || '';
      
      // Remove emojis and special characters from set name for URL
      setName = setName.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      
      // Build path: {set_id}-{year} {set_name}-{category}
      // If year is null/empty, try to extract from set name or skip it
      let setPath;
      if (year) {
        setPath = `${setId}-${year} ${setName}-${category}`;
      } else {
        // Try to extract year from set name (e.g., "2024 Prizm" -> "2024")
        const yearMatch = setName.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          setPath = `${setId}-${yearMatch[0]} ${setName.replace(/\b(19|20)\d{2}\b\s*/, '').trim()}-${category}`;
        } else {
          setPath = `${setId}-${setName}-${category}`;
        }
      }
      
      const encodedPath = encodeURIComponent(setPath);
      
      const response = await fetch(`${API_BASE_URL}/api/gemrate/universal-pop-report/checklist/${encodedPath}`);
      const data = await response.json();
      
      if (data.success && data.data && data.data.cards) {
        setChecklist(data.data.cards);
        setCurrentStep('checklist');
      } else {
        setError(data.error || 'Failed to fetch checklist');
      }
    } catch (err) {
      setError('Error fetching checklist: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetSelect = (set) => {
    setSelectedSet(set);
    fetchChecklist(set);
  };

  const handleCardToggle = (card) => {
    setSelectedCards(prev => {
      const exists = prev.find(c => c.number === card.number && c.player === card.player);
      if (exists) {
        return prev.filter(c => !(c.number === card.number && c.player === card.player));
      } else {
        return [...prev, card];
      }
    });
  };

  const handleCardClick = (card) => {
    setSelectedCardForSummary(card);
    setCurrentStep('score-card-summary');
  };

  const handleSelectAll = () => {
    if (selectedCards.length === checklist.length) {
      setSelectedCards([]);
    } else {
      setSelectedCards([...checklist]);
    }
  };

  const handleClearDatabase = async () => {
    if (!window.confirm(`Are you sure you want to clear all ${dbInfo.total} cards from the database? This cannot be undone!`)) {
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/cards/clear-all`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        alert(`Successfully cleared ${data.deletedCount} cards from database`);
        fetchDbInfo();
      } else {
        setError(data.error || 'Failed to clear database');
      }
    } catch (err) {
      setError('Error clearing database: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 'set') {
      setCurrentStep('category');
      setSelectedCategory(null);
      setSets([]);
    } else if (currentStep === 'checklist') {
      setCurrentStep('set');
      setSelectedSet(null);
      setChecklist([]);
      setSelectedCards([]);
    } else if (currentStep === 'score-card-summary') {
      setCurrentStep('checklist');
      setSelectedCardForSummary(null);
      setSelectedCardSetInfo(null);
    }
  };

  const handlePlayerSearch = async () => {
    if (!playerSearchName.trim()) {
      setPlayerSearchError('Please enter a player name');
      return;
    }

    setPlayerSearchLoading(true);
    setPlayerSearchError('');

    try {
      const params = new URLSearchParams({
        grader: playerSearchGrader,
        category: playerSearchCategory,
        player: playerSearchName.trim()
      });

      const response = await fetch(`${API_BASE_URL}/api/gemrate/player?${params.toString()}`);
      const data = await response.json();

      if (data.success && data.data && Array.isArray(data.data.cards)) {
        setPlayerSearchResults(data.data.cards);
      } else {
        setPlayerSearchResults([]);
        setPlayerSearchError(data.error || 'No cards found for this player');
      }
    } catch (err) {
      console.error('Error searching GemRate player cards:', err);
      setPlayerSearchResults([]);
      setPlayerSearchError('Error searching player cards: ' + err.message);
    } finally {
      setPlayerSearchLoading(false);
    }
  };

  return (
    <div className="tcdb-browser">
      <div className="tcdb-header">
        <h1>📚 Card Database Browser</h1>
        <div className="db-info">
          <span>Current Database: {dbInfo.total} cards</span>
          {dbInfo.total > 0 && (
            <button onClick={handleClearDatabase} className="clear-db-btn">
              🗑️ Clear Database
            </button>
          )}
        </div>
      </div>

      {/* Player Search Section */}
      <div className="player-search-section">
        <h2>Player Search</h2>
        <div className="player-search-form">
          <input
            type="text"
            placeholder="Player name (e.g., Bo Nix)"
            value={playerSearchName}
            onChange={(e) => setPlayerSearchName(e.target.value)}
            className="player-search-input"
          />
          <select
            value={playerSearchCategory}
            onChange={(e) => setPlayerSearchCategory(e.target.value)}
            className="player-search-select"
          >
            <option value="football-cards">Football</option>
            <option value="baseball-cards">Baseball</option>
            <option value="basketball-cards">Basketball</option>
            <option value="hockey-cards">Hockey</option>
          </select>
          <select
            value={playerSearchGrader}
            onChange={(e) => setPlayerSearchGrader(e.target.value)}
            className="player-search-select"
          >
            <option value="psa">PSA</option>
            <option value="bgs">BGS</option>
            <option value="sgc">SGC</option>
            <option value="cgc">CGC</option>
          </select>
          <button
            onClick={handlePlayerSearch}
            disabled={playerSearchLoading}
            className="player-search-button"
          >
            {playerSearchLoading ? 'Searching...' : 'Search Player'}
          </button>
        </div>
        {playerSearchError && (
          <div className="error-message">{playerSearchError}</div>
        )}
        {playerSearchResults.length > 0 && (
          <div className="player-search-results">
            <h3>
              Results for {playerSearchName} ({playerSearchResults.length} cards)
            </h3>
            <div className="checklist-container">
              <table className="checklist-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Year</th>
                    <th>Set</th>
                    <th>Player</th>
                    <th>Parallel</th>
                    <th style={{ width: '90px' }}>Card #</th>
                    <th style={{ width: '110px' }}>Gems</th>
                    <th style={{ width: '130px' }}>Total Grades</th>
                    <th style={{ width: '90px' }}>Gem %</th>
                  </tr>
                </thead>
                <tbody>
                  {playerSearchResults.map((card, index) => {
                    const gems =
                      typeof card.gems === 'number'
                        ? card.gems.toLocaleString()
                        : 'N/A';
                    const totalGrades =
                      typeof card.totalGrades === 'number'
                        ? card.totalGrades.toLocaleString()
                        : 'N/A';
                    const gemRate = card.gemRate || '';

                    const sportFromCategory = () => {
                      switch (playerSearchCategory) {
                        case 'football-cards':
                          return 'Football';
                        case 'baseball-cards':
                          return 'Baseball';
                        case 'basketball-cards':
                          return 'Basketball';
                        case 'hockey-cards':
                          return 'Hockey';
                        default:
                          return null;
                      }
                    };

                    return (
                      <tr
                        key={index}
                        onClick={() => {
                          setSelectedCardSetInfo({
                            sport: sportFromCategory(),
                            year: card.year || null,
                            setName: card.set || null,
                            parallel: card.parallel || null
                          });
                          handleCardClick(card);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{card.year || 'N/A'}</td>
                        <td>{card.set || 'N/A'}</td>
                        <td>{card.player || 'N/A'}</td>
                        <td>{card.parallel || 'N/A'}</td>
                        <td>{card.number || 'N/A'}</td>
                        <td>{gems}</td>
                        <td>{totalGrades}</td>
                        <td>{gemRate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Step 1: Category Selection */}
      {currentStep === 'category' && (
        <div className="step-container">
          <h2>Step 1: Select a Category</h2>
          {loading ? (
            <div className="loading">Loading categories...</div>
          ) : (
            <div className="sports-grid">
              {categories.map((category, index) => (
                <button
                  key={index}
                  className="sport-card"
                  onClick={() => handleCategorySelect(category)}
                >
                  <div className="category-name">{category.name}</div>
                  <div className="category-count">{category.sets.length} sets</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Set Selection */}
      {currentStep === 'set' && (
        <div className="step-container">
          <div className="step-header">
            <button onClick={handleBack} className="back-btn">← Back</button>
            <h2>Step 2: Select a Set ({selectedCategory?.name})</h2>
          </div>
          {loading ? (
            <div className="loading">Loading sets...</div>
          ) : (
            <div className="sets-list">
              {sets.length === 0 ? (
                <div className="no-results">No sets found for this category</div>
              ) : (
                sets.map((set, index) => (
                  <button
                    key={index}
                    className="set-item"
                    onClick={() => handleSetSelect(set)}
                  >
                    <div className="set-name">{set.name}</div>
                    <div className="set-info">
                      {set.year && <span>Year: {set.year}</span>}
                      {set.total_grades > 0 && <span>Total Grades: {set.total_grades.toLocaleString()}</span>}
                      {set.checklist_size > 0 && <span>Checklist Size: {set.checklist_size.toLocaleString()}</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Checklist View */}
      {currentStep === 'checklist' && (
        <div className="step-container">
          <div className="step-header">
            <button onClick={handleBack} className="back-btn">← Back</button>
            <h2 className="checklist-title">Step 3: Checklist - {selectedSet?.name}</h2>
            <div className="checklist-actions">
              <button onClick={handleSelectAll} className="select-all-btn">
                {selectedCards.length === checklist.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="selected-count">
                {selectedCards.length} of {checklist.length} selected
              </span>
            </div>
          </div>
          {loading ? (
            <div className="loading">Loading checklist...</div>
          ) : (
            <div className="checklist-container">
              <div className="checklist-toolbar">
                <input
                  type="text"
                  placeholder="Search player..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="checklist-search-input"
                />
              </div>
              <table className="checklist-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>Select</th>
                    <th style={{ width: '100px' }}>Card #</th>
                    <th>Player</th>
                    <th>Parallel</th>
                    <th style={{ width: '140px' }}>PSA Graded</th>
                  </tr>
                </thead>
                <tbody>
                  {checklist
                    .filter(card =>
                      !playerSearch ||
                      (card.player || '').toLowerCase().includes(playerSearch.toLowerCase())
                    )
                    .map((card, index) => {
                    const isSelected = selectedCards.some(c => c.number === card.number && c.player === card.player);
                    const psaGraded = typeof card.psaGraded === 'number'
                      ? card.psaGraded.toLocaleString()
                      : 'N/A';
                    return (
                      <tr 
                        key={index} 
                        className={isSelected ? 'selected' : ''}
                        onClick={() => {
                          setSelectedCardSetInfo(null);
                          handleCardClick(card);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleCardToggle(card)}
                          />
                        </td>
                        <td>{card.number || 'N/A'}</td>
                        <td>{card.player || 'N/A'}</td>
                        <td>{card.team || 'N/A'}</td>
                        <td>{psaGraded}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Score Card Summary View */}
      {currentStep === 'score-card-summary' && selectedCardForSummary && (
        <ScoreCardSummary
          card={selectedCardForSummary}
          setInfo={
            selectedCardSetInfo || {
              sport: selectedCategory?.name
                ? selectedCategory.name.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()
                : null,
              year: selectedSet?.year,
              setName: selectedSet?.name
                ? selectedSet.name.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()
                : null,
              parallel: null
            }
          }
          onBack={() => {
            setCurrentStep('checklist');
            setSelectedCardForSummary(null);
            setSelectedCardSetInfo(null);
          }}
        />
      )}

      {/* Selected Cards Panel */}
      {selectedCards.length > 0 && currentStep !== 'score-card-summary' && (
        <div className="selected-cards-panel">
          <h3>Selected Cards ({selectedCards.length})</h3>
          <div className="selected-cards-list">
            {selectedCards.map((card, index) => (
              <div key={index} className="selected-card-item">
                #{card.number} - {card.player || 'N/A'} {card.team ? `(${card.team})` : ''}
              </div>
            ))}
          </div>
          <button className="fetch-sales-btn" disabled>
            🔍 Fetch Sales Data (Coming Soon)
          </button>
        </div>
      )}
    </div>
  );
};

export default TCDBBrowser;

