import React, { useState, useEffect } from 'react';
import './TCDBBrowser.css';
import ScoreCardSummary from './ScoreCardSummary';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';

const TCDBBrowser = () => {
  // Step tracking
  const [currentStep, setCurrentStep] = useState('sport'); // sport -> year -> set -> checklist-section -> parallel -> checklist
  
  // Data states
  const [sports, setSports] = useState([]);
  const [years, setYears] = useState([]);
  const [sets, setSets] = useState([]);
  const [checklistSections, setChecklistSections] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [parallelTypes, setParallelTypes] = useState([]);
  
  // Selected values
  const [selectedSport, setSelectedSport] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedParallel, setSelectedParallel] = useState(null);
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
    fetchSports();
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

  const fetchSports = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/tcdb/sports`);
      const data = await response.json();
      if (data.success) {
        setSports(data.sports);
      } else {
        setError(data.error || 'Failed to fetch sports');
      }
    } catch (err) {
      setError('Error fetching sports: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchYears = async (sport) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/tcdb/years/${encodeURIComponent(sport)}`);
      const data = await response.json();
      if (data.success) {
        setYears(data.years);
        setCurrentStep('year');
      } else {
        setError(data.error || 'Failed to fetch years');
      }
    } catch (err) {
      setError('Error fetching years: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSets = async (sport, year) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/tcdb/sets/${encodeURIComponent(sport)}/${year}`);
      const data = await response.json();
      if (data.success) {
        setSets(data.sets);
        setCurrentStep('set');
      } else {
        setError(data.error || 'Failed to fetch sets');
      }
    } catch (err) {
      setError('Error fetching sets: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchChecklist = async (setId, sport, year, sectionId = null) => {
    console.log('🔍 [DEBUG] fetchChecklist called:', { setId, sport, year, sectionId });
    setLoading(true);
    setError('');
    try {
      const url = sectionId 
        ? `${API_BASE_URL}/api/tcdb/checklist/${setId}?sport=${encodeURIComponent(sport)}&year=${year}&section=${encodeURIComponent(sectionId)}`
        : `${API_BASE_URL}/api/tcdb/checklist/${setId}?sport=${encodeURIComponent(sport)}&year=${year}`;
      console.log('🔍 [DEBUG] Fetching URL:', url);
      const response = await fetch(url);
      console.log('🔍 [DEBUG] Response status:', response.status, response.statusText);
      const data = await response.json();
      console.log('🔍 [DEBUG] Response data:', data);
      if (data.success) {
        console.log('🔍 [DEBUG] Checklist fetched successfully, cards count:', data.checklist?.length || 0);
        setChecklist(data.checklist);
        setParallelTypes(data.parallelTypes || []);
        // If parallel types exist, go to parallel selection step, otherwise go directly to checklist
        if (data.parallelTypes && data.parallelTypes.length > 0) {
          setCurrentStep('parallel');
        } else {
          setCurrentStep('checklist');
        }
      } else {
        console.error('❌ [DEBUG] Failed to fetch checklist:', data.error);
        setError(data.error || 'Failed to fetch checklist');
      }
    } catch (err) {
      console.error('❌ [DEBUG] Error fetching checklist:', err);
      setError('Error fetching checklist: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSportSelect = (sport) => {
    setSelectedSport(sport);
    fetchYears(sport.value);
  };

  const handleYearSelect = (year) => {
    setSelectedYear(year);
    fetchSets(selectedSport.value, year.year);
  };

  const fetchChecklistSections = async (setId) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/tcdb/checklist-sections/${setId}`);
      const data = await response.json();
      if (data.success) {
        setChecklistSections(data.sections);
        setCurrentStep('checklist-section');
      } else {
        setError(data.error || 'Failed to fetch checklist sections');
      }
    } catch (err) {
      setError('Error fetching checklist sections: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetSelect = (set) => {
    setSelectedSet(set);
    fetchChecklistSections(set.id);
  };

  const handleSectionSelect = (section) => {
    console.log('🔍 [DEBUG] handleSectionSelect called:', {
      section: section,
      selectedSet: selectedSet,
      selectedSport: selectedSport,
      selectedYear: selectedYear
    });
    setSelectedSection(section);
    setSelectedParallel(null); // Reset parallel selection
    fetchChecklist(selectedSet.id, selectedSport.value, selectedYear.year, section.id);
  };

  const handleParallelSelect = (parallel) => {
    console.log('🔍 [DEBUG] handleParallelSelect called:', parallel);
    setSelectedParallel(parallel);
    setCurrentStep('checklist');
  };

  const handleCardToggle = (card) => {
    setSelectedCards(prev => {
      const exists = prev.find(c => c.tcdbId === card.tcdbId && c.number === card.number);
      if (exists) {
        return prev.filter(c => !(c.tcdbId === card.tcdbId && c.number === card.number));
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
    if (currentStep === 'year') {
      setCurrentStep('sport');
      setSelectedSport(null);
      setYears([]);
    } else if (currentStep === 'set') {
      setCurrentStep('year');
      setSelectedYear(null);
      setSets([]);
    } else if (currentStep === 'checklist-section') {
      setCurrentStep('set');
      setSelectedSet(null);
      setChecklistSections([]);
    } else if (currentStep === 'parallel') {
      setCurrentStep('checklist-section');
      setSelectedSection(null);
      setParallelTypes([]);
      setChecklist([]);
    } else if (currentStep === 'checklist') {
      // If we have parallel types, go back to parallel selection, otherwise go to section selection
      if (parallelTypes && parallelTypes.length > 0) {
        setCurrentStep('parallel');
        setSelectedParallel(null);
      } else {
        setCurrentStep('checklist-section');
        setSelectedSection(null);
      }
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

      {/* Step 1: Sport Selection */}
      {currentStep === 'sport' && (
        <div className="step-container">
          <h2>Step 1: Select a Sport</h2>
          {loading ? (
            <div className="loading">Loading sports...</div>
          ) : (
            <div className="sports-grid">
              {sports.map((sport, index) => (
                <button
                  key={index}
                  className="sport-card"
                  onClick={() => handleSportSelect(sport)}
                >
                  {sport.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Year Selection */}
      {currentStep === 'year' && (
        <div className="step-container">
          <div className="step-header">
            <button onClick={handleBack} className="back-btn">← Back</button>
            <h2>Step 2: Select a Year ({selectedSport?.name})</h2>
          </div>
          {loading ? (
            <div className="loading">Loading years...</div>
          ) : (
            <div className="years-grid">
              {years.map((year, index) => (
                <button
                  key={index}
                  className="year-card"
                  onClick={() => handleYearSelect(year)}
                >
                  {year.display}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Set Selection */}
      {currentStep === 'set' && (
        <div className="step-container">
          <div className="step-header">
            <button onClick={handleBack} className="back-btn">← Back</button>
            <h2>Step 3: Select a Set ({selectedSport?.name} {selectedYear?.display})</h2>
          </div>
          {loading ? (
            <div className="loading">Loading sets...</div>
          ) : (
            <div className="sets-list">
              {sets.length === 0 ? (
                <div className="no-results">No sets found for this year</div>
              ) : (
                sets.map((set, index) => (
                  <button
                    key={index}
                    className="set-item"
                    onClick={() => handleSetSelect(set)}
                  >
                    <div className="set-name">{set.name}</div>
                    <div className="set-id">Set ID: {set.id}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Checklist Section Selection */}
      {currentStep === 'checklist-section' && (
        <div className="step-container">
          <div className="step-header">
            <button onClick={handleBack} className="back-btn">← Back</button>
            <h2>Step 4: Select Checklist Section - {selectedSet?.name}</h2>
          </div>
          {loading ? (
            <div className="loading">Loading checklist sections...</div>
          ) : (
            <div className="sections-list">
              {checklistSections.length === 0 ? (
                <div className="no-results">No checklist sections found</div>
              ) : (
                checklistSections.map((section, index) => (
                  <button
                    key={index}
                    className="section-item"
                    onClick={() => handleSectionSelect(section)}
                  >
                    <div className="section-name">{section.name}</div>
                    {section.description && (
                      <div className="section-description">{section.description}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 5: Parallel Type Selection */}
      {currentStep === 'parallel' && (
        <div className="step-container">
          <div className="step-header">
            <button onClick={handleBack} className="back-btn">← Back</button>
            <h2>Step 5: Select Parallel/Variation Type - {selectedSection?.name}</h2>
          </div>
          {loading ? (
            <div className="loading">Loading parallel types...</div>
          ) : (
            <div className="sections-list">
              {parallelTypes.length === 0 ? (
                <div className="no-results">No parallel types found</div>
              ) : (
                parallelTypes.map((parallel, index) => (
                  <button
                    key={index}
                    className="section-item"
                    onClick={() => handleParallelSelect(parallel)}
                  >
                    <div className="section-name">{parallel}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 6: Checklist View */}
      {currentStep === 'checklist' && (
        <div className="step-container">
          <div className="step-header">
            <button onClick={handleBack} className="back-btn">← Back</button>
            <h2>Step 6: Checklist - {selectedSet?.name}{selectedSection ? ` - ${selectedSection.name}` : ''}{selectedParallel ? ` - ${selectedParallel}` : ''}</h2>
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
                    const isSelected = selectedCards.some(c => c.tcdbId === card.tcdbId && c.number === card.number);
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
                        <td>{card.number}</td>
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
            sport: selectedSport?.name || selectedSport?.value,
            year: selectedYear?.year || selectedYear?.display,
            setName: selectedSet?.name,
            parallel: selectedParallel
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

