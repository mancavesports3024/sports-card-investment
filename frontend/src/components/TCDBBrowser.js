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
  
  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
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
      const setPath = `${set.set_id || set.id}-${set.year} ${set.name}-${set.category}`;
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
            <h2>Step 3: Checklist - {selectedSet?.name}</h2>
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
              <table className="checklist-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>Select</th>
                    <th style={{ width: '100px' }}>Card #</th>
                    <th>Player</th>
                    <th>Team</th>
                  </tr>
                </thead>
                <tbody>
                  {checklist.map((card, index) => {
                    const isSelected = selectedCards.some(c => c.number === card.number && c.player === card.player);
                    return (
                      <tr 
                        key={index} 
                        className={isSelected ? 'selected' : ''}
                        onClick={() => handleCardClick(card)}
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
          setInfo={{
            sport: selectedCategory?.name,
            year: selectedSet?.year,
            setName: selectedSet?.name,
            parallel: null
          }}
          onBack={() => {
            setCurrentStep('checklist');
            setSelectedCardForSummary(null);
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

