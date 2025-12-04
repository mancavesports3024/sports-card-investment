import React, { useState, useEffect } from 'react';
import './TCDBBrowser.css';
import ScoreCardSummary from './ScoreCardSummary';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';

const TCDBBrowser = () => {
  // Step tracking - only player search and summary
  const [currentStep, setCurrentStep] = useState('player-search');
  
  // Selected values
  const [selectedCardForSummary, setSelectedCardForSummary] = useState(null);
  const [selectedCardSetInfo, setSelectedCardSetInfo] = useState(null);

  // GemRate player search states
  const [playerSearchName, setPlayerSearchName] = useState('');
  const [playerSearchCategory, setPlayerSearchCategory] = useState('all');
  const [playerSearchGrader, setPlayerSearchGrader] = useState('psa');
  const [playerSearchResults, setPlayerSearchResults] = useState([]);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [playerSearchError, setPlayerSearchError] = useState('');
  const [playerSearchFilterSet, setPlayerSearchFilterSet] = useState('');
  const [playerSearchFilterCardNumber, setPlayerSearchFilterCardNumber] = useState('');
  const [selectedCardGemrateData, setSelectedCardGemrateData] = useState(null);
  const [playerSearchSortField, setPlayerSearchSortField] = useState('totalGrades');
  const [playerSearchSortDirection, setPlayerSearchSortDirection] = useState('desc'); // 'asc' | 'desc'
  
  // Database info
  const [dbInfo, setDbInfo] = useState({ total: 0 });

  // Fetch database count on mount
  useEffect(() => {
    fetchDbInfo();
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

  const handleCardClick = (card) => {
    console.log('[TCDBBrowser] Card clicked:', {
      player: card.player,
      set: card.set,
      parallel: card.parallel,
      number: card.number,
      gemrateId: card.gemrateId,
      year: card.year
    });
    setSelectedCardForSummary(card);
    setCurrentStep('score-card-summary');
  };

  const handleClearDatabase = async () => {
    if (!window.confirm(`Are you sure you want to clear all ${dbInfo.total} cards from the database? This cannot be undone!`)) {
      return;
    }
    
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
        alert(data.error || 'Failed to clear database');
      }
    } catch (err) {
      alert('Error clearing database: ' + err.message);
    }
  };

  const handleBack = () => {
    if (currentStep === 'score-card-summary') {
      setCurrentStep('player-search');
      setSelectedCardForSummary(null);
      setSelectedCardSetInfo(null);
      setSelectedCardGemrateData(null);
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
            <option value="all">All Categories</option>
            <option value="football-cards">Football</option>
            <option value="baseball-cards">Baseball</option>
            <option value="basketball-cards">Basketball</option>
            <option value="hockey-cards">Hockey</option>
            <option value="soccer-cards">Soccer</option>
            <option value="boxing-wrestling-cards">Boxing/Wrestling</option>
            <option value="golf-cards">Golf</option>
            <option value="misc-cards">Misc</option>
            <option value="multi-sport-cards">Multi-Sport</option>
            <option value="non-sport-cards">Non-Sport</option>
            <option value="packs">Packs</option>
            <option value="tcg-cards">TCG</option>
            <option value="tickets">Tickets</option>
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
        {playerSearchResults.length > 0 && (() => {
          // Apply filters
          const filteredResults = playerSearchResults.filter((card) => {
            if (playerSearchFilterSet && !(card.set || '').toLowerCase().includes(playerSearchFilterSet.toLowerCase())) return false;
            if (playerSearchFilterCardNumber && !(card.number || '').toString().includes(playerSearchFilterCardNumber)) return false;
            return true;
          });

          // Apply sorting
          const sortedResults = [...filteredResults].sort((a, b) => {
            const dir = playerSearchSortDirection === 'asc' ? 1 : -1;

            const getValue = (card) => {
              switch (playerSearchSortField) {
                case 'year':
                  return card.year || '';
                case 'set':
                  return card.set || '';
                case 'player':
                  return card.player || '';
                case 'parallel':
                  return card.parallel || '';
                case 'number':
                  return card.number || '';
                case 'gems':
                  return typeof card.gems === 'number' ? card.gems : (card.gems ? Number(card.gems) || 0 : 0);
                case 'totalGrades':
                  return typeof card.totalGrades === 'number'
                    ? card.totalGrades
                    : (card.totalGrades ? Number(card.totalGrades) || 0 : 0);
                case 'gemRate':
                  if (card.gemRate === null || card.gemRate === undefined || card.gemRate === '') return -Infinity;
                  return typeof card.gemRate === 'number' ? card.gemRate : (Number(card.gemRate) || 0);
                default:
                  return '';
              }
            };

            const aVal = getValue(a);
            const bVal = getValue(b);

            // Numeric comparison when both are numbers
            if (typeof aVal === 'number' && typeof bVal === 'number') {
              if (aVal === bVal) return 0;
              return aVal > bVal ? dir : -dir;
            }

            // String comparison
            const aStr = (aVal || '').toString().toLowerCase();
            const bStr = (bVal || '').toString().toLowerCase();
            if (aStr === bStr) return 0;
            return aStr > bStr ? dir : -dir;
          });

          const handleSortClick = (field) => {
            if (playerSearchSortField === field) {
              // Toggle direction
              setPlayerSearchSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
            } else {
              setPlayerSearchSortField(field);
              // Default: numbers desc, strings asc
              if (['gems', 'totalGrades', 'gemRate', 'number', 'year'].includes(field)) {
                setPlayerSearchSortDirection('desc');
              } else {
                setPlayerSearchSortDirection('asc');
              }
            }
          };

          const renderSortIndicator = (field) => {
            if (playerSearchSortField !== field) return null;
            return playerSearchSortDirection === 'asc' ? ' ▲' : ' ▼';
          };

          return (
          <div className="player-search-results">
            <h3>
              Results for {playerSearchName} ({filteredResults.length} of {playerSearchResults.length} cards)
            </h3>
            {/* Filter inputs */}
            <div style={{ marginBottom: '15px', display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="filter-set" style={{ fontWeight: 600 }}>Filter by Set:</label>
                <input
                  id="filter-set"
                  type="text"
                  value={playerSearchFilterSet}
                  onChange={(e) => setPlayerSearchFilterSet(e.target.value)}
                  placeholder="Enter set name..."
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    minWidth: '200px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="filter-card-number" style={{ fontWeight: 600 }}>Filter by Card #:</label>
                <input
                  id="filter-card-number"
                  type="text"
                  value={playerSearchFilterCardNumber}
                  onChange={(e) => setPlayerSearchFilterCardNumber(e.target.value)}
                  placeholder="Enter card number..."
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    minWidth: '150px'
                  }}
                />
              </div>
              {(playerSearchFilterSet || playerSearchFilterCardNumber) && (
                <button
                  onClick={() => {
                    setPlayerSearchFilterSet('');
                    setPlayerSearchFilterCardNumber('');
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#f0f0f0',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
            <div className="checklist-container">
              <table className="checklist-table">
                <thead>
                  <tr>
                    <th
                      style={{ width: '80px', cursor: 'pointer' }}
                      onClick={() => handleSortClick('year')}
                    >
                      Year{renderSortIndicator('year')}
                    </th>
                    <th
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSortClick('set')}
                    >
                      Set{renderSortIndicator('set')}
                    </th>
                    <th
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSortClick('player')}
                    >
                      Player{renderSortIndicator('player')}
                    </th>
                    <th
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSortClick('parallel')}
                    >
                      Parallel{renderSortIndicator('parallel')}
                    </th>
                    <th
                      style={{ width: '90px', cursor: 'pointer' }}
                      onClick={() => handleSortClick('number')}
                    >
                      Card #{renderSortIndicator('number')}
                    </th>
                    <th
                      style={{ width: '110px', cursor: 'pointer' }}
                      onClick={() => handleSortClick('gems')}
                    >
                      Gems{renderSortIndicator('gems')}
                    </th>
                    <th
                      style={{ width: '130px', cursor: 'pointer' }}
                      onClick={() => handleSortClick('totalGrades')}
                    >
                      Total Grades{renderSortIndicator('totalGrades')}
                    </th>
                    <th
                      style={{ width: '90px', cursor: 'pointer' }}
                      onClick={() => handleSortClick('gemRate')}
                    >
                      Gem %{renderSortIndicator('gemRate')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((card, index) => {
                    const gems =
                      typeof card.gems === 'number'
                        ? card.gems.toLocaleString()
                        : 'N/A';
                    const totalGrades =
                      typeof card.totalGrades === 'number'
                        ? card.totalGrades.toLocaleString()
                        : 'N/A';
                    // Format gem rate as percentage
                    let gemRate = 'N/A';
                    if (card.gemRate !== null && card.gemRate !== undefined && card.gemRate !== '') {
                      const gemRateNum = typeof card.gemRate === 'number' ? card.gemRate : parseFloat(card.gemRate);
                      if (!isNaN(gemRateNum)) {
                        gemRate = `${(gemRateNum * 100).toFixed(2)}%`;
                      }
                    }

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
                          // Map GemRate row data into a format ScoreCardSummary understands
                          const initialGemrateData = {
                            total: typeof card.totalGrades === 'number'
                              ? card.totalGrades
                              : (card.totalGrades ? Number(card.totalGrades) || 0 : 0),
                            perfect: typeof card.gems === 'number'
                              ? card.gems
                              : (card.gems ? Number(card.gems) || 0 : 0),
                            // We don't have a clean PSA 9 population from the row; leave grade9 undefined
                            grade9: undefined,
                            // card.gemRate from GemRate is a decimal (0-1); ScoreCardSummary will handle converting to %
                            gemRate: card.gemRate !== null && card.gemRate !== undefined && card.gemRate !== ''
                              ? (typeof card.gemRate === 'number' ? card.gemRate : Number(card.gemRate) || 0)
                              : null,
                          };

                          setSelectedCardGemrateData(initialGemrateData);
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
          );
        })()}
      </div>


      {/* Score Card Summary View */}
      {currentStep === 'score-card-summary' && selectedCardForSummary && (
        <ScoreCardSummary
          card={selectedCardForSummary}
          setInfo={
            selectedCardSetInfo || {
              sport: null,
              year: null,
              setName: null,
              parallel: null
            }
          }
          initialGemrateData={selectedCardGemrateData}
          onBack={() => {
            setCurrentStep('player-search');
            setSelectedCardForSummary(null);
            setSelectedCardSetInfo(null);
            setSelectedCardGemrateData(null);
          }}
        />
      )}

    </div>
  );
};

export default TCDBBrowser;

