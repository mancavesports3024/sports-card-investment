import React, { useState, useEffect } from 'react';
import './AdminCardDatabase.css';

// Edit Card Modal Component
const EditCardModal = ({ card, loading, error, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    year: '',
    card_set: '',
    card_type: '',
    player_name: '',
    card_number: '',
    print_run: '',
    is_rookie: false,
    is_autograph: false,
    sport: ''
  });

  useEffect(() => {
    if (card) {
      setFormData({
        year: card.year || '',
        card_set: card.card_set || '',
        card_type: card.card_type || '',
        player_name: card.player_name || '',
        card_number: card.card_number || '',
        print_run: card.print_run || '',
        is_rookie: card.is_rookie || false,
        is_autograph: card.is_autograph || false,
        sport: card.sport || ''
      });
    }
  }, [card]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: card.id,
      ...formData
    });
  };

  if (!card) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Edit Card Details</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Original Title:</label>
            <div className="original-title">{card.title}</div>
          </div>

          <div className="form-group">
            <label>Current Summary Title:</label>
            <div className="current-summary">{card.summary_title}</div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="year">Year:</label>
              <input
                type="number"
                id="year"
                value={formData.year}
                onChange={(e) => handleInputChange('year', e.target.value)}
                placeholder="2024"
              />
            </div>

            <div className="form-group">
              <label htmlFor="card_set">Card Set:</label>
              <input
                type="text"
                id="card_set"
                value={formData.card_set}
                onChange={(e) => handleInputChange('card_set', e.target.value)}
                placeholder="Topps Chrome"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="card_type">Card Type:</label>
              <input
                type="text"
                id="card_type"
                value={formData.card_type}
                onChange={(e) => handleInputChange('card_type', e.target.value)}
                placeholder="Base"
              />
            </div>

            <div className="form-group">
              <label htmlFor="sport">Sport:</label>
              <select
                id="sport"
                value={formData.sport}
                onChange={(e) => handleInputChange('sport', e.target.value)}
              >
                <option value="">Select Sport</option>
                <option value="Baseball">Baseball</option>
                <option value="Basketball">Basketball</option>
                <option value="Football">Football</option>
                <option value="Hockey">Hockey</option>
                <option value="Soccer">Soccer</option>
                <option value="Racing">Racing</option>
                <option value="UFC">UFC</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="player_name">Player Name:</label>
              <input
                type="text"
                id="player_name"
                value={formData.player_name}
                onChange={(e) => handleInputChange('player_name', e.target.value)}
                placeholder="Mike Trout"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="card_number">Card Number:</label>
              <input
                type="text"
                id="card_number"
                value={formData.card_number}
                onChange={(e) => handleInputChange('card_number', e.target.value)}
                placeholder="123"
              />
            </div>

            <div className="form-group">
              <label htmlFor="print_run">Print Run:</label>
              <input
                type="text"
                id="print_run"
                value={formData.print_run}
                onChange={(e) => handleInputChange('print_run', e.target.value)}
                placeholder="/150"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.is_rookie}
                  onChange={(e) => handleInputChange('is_rookie', e.target.checked)}
                />
                Rookie Card
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.is_autograph}
                  onChange={(e) => handleInputChange('is_autograph', e.target.checked)}
                />
                Autograph
              </label>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

function isAdminUser() {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email === 'mancavesportscardsllc@gmail.com';
  } catch {
    return false;
  }
}

const AdminCardDatabase = () => {
  // Always call hooks first!
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    search: '',
    sport: 'all',
    minPrice: '',
    maxPrice: '',
    sortBy: 'lastUpdated',
    sortOrder: 'DESC'
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Edit modal state
  const [editModal, setEditModal] = useState({
    isOpen: false,
    card: null,
    loading: false,
    error: null
  });

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';

  useEffect(() => {
    fetchCards();
  }, [currentPage, filters]);

  const fetchCards = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        ...filters
      });

      const response = await fetch(`${API_BASE_URL}/api/admin/cards?${params}`);
      const data = await response.json();

      if (data.success) {
        setCards(data.cards);
        setPagination(data.pagination);
      } else {
        setError('Failed to fetch cards: ' + data.error);
      }
    } catch (err) {
      setError('Error fetching cards: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchCards();
  };

  const handleEditCard = async (cardId) => {
    setEditModal(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/card/${cardId}`);
      const data = await response.json();
      
      if (data.success) {
        setEditModal({
          isOpen: true,
          card: data.card,
          loading: false,
          error: null
        });
      } else {
        setEditModal(prev => ({ 
          ...prev, 
          loading: false, 
          error: data.message || 'Failed to load card details' 
        }));
      }
    } catch (err) {
      setEditModal(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Error loading card details: ' + err.message 
      }));
    }
  };

  const handleSaveCard = async (updatedCard) => {
    setEditModal(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/card/${updatedCard.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedCard)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setEditModal({ isOpen: false, card: null, loading: false, error: null });
        // Refresh the cards list
        fetchCards();
      } else {
        setEditModal(prev => ({ 
          ...prev, 
          loading: false, 
          error: data.message || 'Failed to update card' 
        }));
      }
    } catch (err) {
      setEditModal(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Error updating card: ' + err.message 
      }));
    }
  };

  const handleCloseEditModal = () => {
    setEditModal({ isOpen: false, card: null, loading: false, error: null });
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const formatPrice = (price) => {
    if (!price || price === 0) return 'N/A';
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const formatMultiplier = (multiplier) => {
    if (!multiplier || multiplier === 0) return 'N/A';
    return parseFloat(multiplier).toFixed(2) + 'x';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // Generate eBay search URL for live listings
  const generateEbaySearchUrl = (searchQuery) => {
    if (!searchQuery) return '#';
    
    // Clean up the search query for eBay, but preserve # and - for card numbers
    const cleanQuery = searchQuery
      .replace(/[^\w\s#-]/g, ' ') // Remove special characters but keep #, -, and alphanumeric
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    // Add terms to exclude graded cards and focus on raw cards
    const rawQuery = `${cleanQuery} -psa -bgs -sgc -cgc -tag -graded -gem -mint`;
    
    // Build eBay search URL with affiliate tracking parameters
    const baseUrl = 'https://www.ebay.com/sch/i.html';
    const params = new URLSearchParams({
      '_nkw': rawQuery,
      '_sacat': '0', // All categories
      '_sop': '12', // Sort by newly listed
      // eBay Partner Network affiliate tracking
      'mkevt': '1',
      'mkcid': '1',
      'mkrid': '711-53200-19255-0',
      'siteid': '0',
      'campid': '5338333097',
      'toolid': '10001',
      'customid': 'mancavesportscards-admin'
    });
    
    return `${baseUrl}?${params.toString()}`;
  };

  const getPaginationButtons = () => {
    const buttons = [];
    const { page = 1, totalPages = 1, hasPrevPage = false, hasNextPage = false } = pagination;
    
    // Previous button
    if (hasPrevPage) {
      buttons.push(
        <button key="prev" onClick={() => handlePageChange(page - 1)} className="pagination-btn">
          ← Previous
        </button>
      );
    }
    
    // Page numbers (show current and 2 pages on each side)
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages || 1, page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`pagination-btn ${i === page ? 'active' : ''}`}
        >
          {i}
        </button>
      );
    }
    
    // Next button
    if (hasNextPage) {
      buttons.push(
        <button key="next" onClick={() => handlePageChange(page + 1)} className="pagination-btn">
          Next →
        </button>
      );
    }
    
    return buttons;
  };

  // Admin check in render return
  if (!isAdminUser()) {
    return (
      <div className="admin-only-message">
        <h2>Access Denied</h2>
        <p>This page is only available to administrators.</p>
      </div>
    );
  }

  return (
    <div className="admin-card-database">
      <div className="page-header">
        <h1>🎯 Admin Card Database</h1>
        <p>Manage and view all cards in the database</p>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filter-row">
          <div className="filter-group">
            <label>Search Cards:</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search by title or summary..."
              className="filter-input"
            />
          </div>
          
          <div className="filter-group">
            <label>Sport:</label>
            <select
              value={filters.sport}
              onChange={(e) => handleFilterChange('sport', e.target.value)}
              className="filter-select"
            >
              <option value="all">All Sports</option>
              <option value="Basketball">Basketball</option>
              <option value="Football">Football</option>
              <option value="Baseball">Baseball</option>
              <option value="Hockey">Hockey</option>
              <option value="Soccer">Soccer</option>
              <option value="Golf">Golf</option>
              <option value="Racing">Racing</option>
              <option value="Wrestling">Wrestling</option>
              <option value="Pokemon">Pokemon</option>
              <option value="Magic">Magic</option>
              <option value="Yu-Gi-Oh">Yu-Gi-Oh</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Min Price:</label>
            <input
              type="number"
              value={filters.minPrice}
              onChange={(e) => handleFilterChange('minPrice', e.target.value)}
              placeholder="0"
              className="filter-input price-input"
            />
          </div>
          
          <div className="filter-group">
            <label>Max Price:</label>
            <input
              type="number"
              value={filters.maxPrice}
              onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
              placeholder="No limit"
              className="filter-input price-input"
            />
          </div>
        </div>
        
        <div className="filter-row">
          <div className="filter-group">
            <label>Sort By:</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="filter-select"
            >
              <option value="lastUpdated">Date Added</option>
              <option value="title">Title</option>
              <option value="psa10Price">PSA 10 Price</option>
              <option value="rawAveragePrice">Raw Price</option>
              <option value="psa9AveragePrice">PSA 9 Price</option>
              <option value="multiplier">Multiplier</option>
              <option value="sport">Sport</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Order:</label>
            <select
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
              className="filter-select"
            >
              <option value="DESC">Descending</option>
              <option value="ASC">Ascending</option>
            </select>
          </div>
          
          <button onClick={handleSearch} className="search-btn">
            🔍 Search
          </button>
        </div>
      </div>

      {/* Results Section */}
      {loading && <div className="loading">Loading cards...</div>}
      {error && <div className="error">Error: {error}</div>}

      {!loading && !error && (
        <>
          {/* Results Info */}
          <div className="results-info">
            <span>
              Showing {cards.length} of {pagination.total?.total || 0} cards 
              (Page {pagination.page} of {pagination.totalPages || 1})
            </span>
          </div>

          {/* Cards Table */}
          <div className="cards-table-container">
            <table className="cards-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Sport</th>
                  <th>PSA 10</th>
                  <th>PSA 9</th>
                  <th>Raw</th>
                  <th>Multiplier</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <tr key={card.id}>
                    <td className="card-title">
                      <div className="title-main">
                        {(() => {
                          const rawTitle = card.summaryTitle || card.title || '';
                          return rawTitle
                            .replace(/\s*#unknown\b.*$/i, '')
                            .replace(/\s*#Unknown\b.*$/i, '')
                            .replace(/\s*#UNKNOWN\b.*$/i, '')
                            .replace(/\s+unknown\s*$/i, '')
                            .replace(/\s+Unknown\s*$/i, '')
                            .replace(/\s+UNKNOWN\s*$/i, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                        })()}
                        <button 
                          className="ebay-link-btn"
                          onClick={() => window.open(generateEbaySearchUrl(card.summaryTitle || card.title), '_blank')}
                          title="View eBay Live Listings"
                        >
                          🔍 eBay
                        </button>
                        <button 
                          className="edit-btn"
                          onClick={() => handleEditCard(card.id)}
                          title="Edit card details"
                        >
                          ✏️ Edit
                        </button>
                      </div>
                      {card.summaryTitle && card.title !== card.summaryTitle && (
                        <div className="title-original">{(() => {
                          const rawTitle = card.title || '';
                          return rawTitle
                            .replace(/\s*#unknown\b.*$/i, '')
                            .replace(/\s*#Unknown\b.*$/i, '')
                            .replace(/\s*#UNKNOWN\b.*$/i, '')
                            .replace(/\s+unknown\s*$/i, '')
                            .replace(/\s+Unknown\s*$/i, '')
                            .replace(/\s+UNKNOWN\s*$/i, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                        })()}</div>
                      )}
                    </td>
                    <td className="card-sport">
                      <span className={`sport-badge sport-${card.sport || 'unknown'}`}>
                        {(card.sport || 'Unknown').toUpperCase()}
                      </span>
                    </td>
                    <td className="card-price psa10">
                      {formatPrice(card.psa10Price)}
                    </td>
                    <td className="card-price psa9">
                      {formatPrice(card.psa9AveragePrice)}
                    </td>
                    <td className="card-price raw">
                      {formatPrice(card.rawAveragePrice)}
                    </td>
                    <td className="card-multiplier">
                      {formatMultiplier(card.multiplier)}
                    </td>
                    <td className="card-date">
                      {formatDate(card.lastUpdated)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(pagination.totalPages || 0) > 1 && (
            <div className="pagination">
              {getPaginationButtons()}
            </div>
          )}
        </>
      )}

      {/* Edit Card Modal */}
      {editModal.isOpen && (
        <EditCardModal
          card={editModal.card}
          loading={editModal.loading}
          error={editModal.error}
          onSave={handleSaveCard}
          onClose={handleCloseEditModal}
        />
      )}
    </div>
  );
};

export default AdminCardDatabase;
