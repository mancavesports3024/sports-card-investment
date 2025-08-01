import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './EbayItemLookup.css';

const EbayItemLookup = () => {
    const [itemId, setItemId] = useState('');
    const [itemInfo, setItemInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [savedItems, setSavedItems] = useState([]);
    const [config, setConfig] = useState({
        maxBidAmount: 100,
        bidBuffer: 30,
        autoBidEnabled: false
    });

    useEffect(() => {
        loadConfig();
        loadSavedItems();
    }, []);

    const loadConfig = async () => {
        try {
            const response = await axios.get('/api/ebay-bidding/config');
            setConfig(response.data);
        } catch (error) {
            console.error('Error loading config:', error);
        }
    };

    const loadSavedItems = async () => {
        try {
            const response = await axios.get('/api/ebay-bidding/saved-items');
            setSavedItems(response.data);
        } catch (error) {
            console.error('Error loading saved items:', error);
        }
    };

    const handleSearch = async () => {
        if (!itemId.trim()) {
            setError('Please enter an eBay item ID');
            return;
        }

        setLoading(true);
        setError('');
        setItemInfo(null);

        try {
            const response = await axios.get(`/api/ebay-bidding/auction-info/${itemId.trim()}`);
            setItemInfo(response.data);
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to fetch item information');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveItem = async () => {
        if (!itemInfo) return;

        try {
            await axios.post('/api/ebay-bidding/save-item', {
                itemId: itemInfo.itemId,
                title: itemInfo.title,
                currentPrice: itemInfo.currentPrice,
                timeRemaining: itemInfo.timeRemaining,
                url: itemInfo.url
            });
            loadSavedItems();
        } catch (error) {
            console.error('Error saving item:', error);
        }
    };

    const handleRemoveSavedItem = async (savedItemId) => {
        try {
            await axios.delete(`/api/ebay-bidding/saved-items/${savedItemId}`);
            loadSavedItems();
        } catch (error) {
            console.error('Error removing saved item:', error);
        }
    };

    const formatTimeRemaining = (timeString) => {
        if (!timeString || timeString === 'Buy It Now' || timeString === 'Auction ended') {
            return timeString;
        }
        return timeString;
    };

    return (
        <div className="ebay-item-lookup">
            <div className="container">
                <h1>🔍 eBay Item Lookup</h1>
                <p className="subtitle">Search for any eBay item by its item ID</p>

                {/* Search Section */}
                <div className="search-section">
                    <div className="search-input-group">
                        <input
                            type="text"
                            value={itemId}
                            onChange={(e) => setItemId(e.target.value)}
                            placeholder="Enter eBay Item ID (e.g., 277300416493)"
                            className="search-input"
                        />
                        <button 
                            onClick={handleSearch} 
                            disabled={loading}
                            className="search-button"
                        >
                            {loading ? '🔍 Searching...' : '🔍 Search Item'}
                        </button>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="error-message">
                        ❌ {error}
                    </div>
                )}

                {/* Item Information Display */}
                {itemInfo && (
                    <div className="item-info-card">
                        <div className="item-header">
                            <h2>{itemInfo.title}</h2>
                            <button 
                                onClick={handleSaveItem}
                                className="save-button"
                                title="Save this item for later"
                            >
                                💾 Save Item
                            </button>
                        </div>

                        <div className="item-details">
                            <div className="detail-row">
                                <span className="label">Current Price:</span>
                                <span className="value price">{itemInfo.currentPrice}</span>
                            </div>
                            
                            <div className="detail-row">
                                <span className="label">Time Remaining:</span>
                                <span className="value time">{formatTimeRemaining(itemInfo.timeRemaining)}</span>
                            </div>
                            
                            <div className="detail-row">
                                <span className="label">Bid Count:</span>
                                <span className="value">{itemInfo.bidCount}</span>
                            </div>
                            
                            <div className="detail-row">
                                <span className="label">Condition:</span>
                                <span className="value">{itemInfo.condition}</span>
                            </div>
                            
                            <div className="detail-row">
                                <span className="label">Seller:</span>
                                <span className="value">{itemInfo.seller}</span>
                            </div>
                            
                            <div className="detail-row">
                                <span className="label">Location:</span>
                                <span className="value">{itemInfo.location}</span>
                            </div>
                            
                            <div className="detail-row">
                                <span className="label">Shipping:</span>
                                <span className="value">{itemInfo.shippingCost || 'Free'}</span>
                            </div>
                            
                            <div className="detail-row">
                                <span className="label">Listing Type:</span>
                                <span className="value">{itemInfo.listingType}</span>
                            </div>
                        </div>

                        <div className="item-actions">
                            <a 
                                href={itemInfo.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="view-on-ebay-button"
                            >
                                🛒 View on eBay
                            </a>
                        </div>

                        {/* Additional Info */}
                        {itemInfo.shortDescription && (
                            <div className="additional-info">
                                <h3>Description</h3>
                                <p>{itemInfo.shortDescription}</p>
                            </div>
                        )}

                        {itemInfo.categoryPath && (
                            <div className="additional-info">
                                <h3>Category</h3>
                                <p>{itemInfo.categoryPath}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Saved Items Section */}
                {savedItems.length > 0 && (
                    <div className="saved-items-section">
                        <h2>💾 Saved Items</h2>
                        <div className="saved-items-grid">
                            {savedItems.map((item) => (
                                <div key={item.id} className="saved-item-card">
                                    <div className="saved-item-header">
                                        <h3>{item.title}</h3>
                                        <button 
                                            onClick={() => handleRemoveSavedItem(item.id)}
                                            className="remove-button"
                                            title="Remove from saved items"
                                        >
                                            ❌
                                        </button>
                                    </div>
                                    <div className="saved-item-details">
                                        <div className="detail-row">
                                            <span className="label">Price:</span>
                                            <span className="value">{item.currentPrice}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="label">Time:</span>
                                            <span className="value">{item.timeRemaining}</span>
                                        </div>
                                    </div>
                                    <a 
                                        href={item.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="view-button"
                                    >
                                        View Item
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Info Section */}
                <div className="info-section">
                    <h3>ℹ️ How to Use</h3>
                    <ul>
                        <li>Enter any eBay item ID to get detailed information</li>
                        <li>Item IDs can be found in eBay URLs (e.g., ebay.com/itm/277300416493)</li>
                        <li>Save interesting items for quick access later</li>
                        <li>View items directly on eBay with the "View on eBay" button</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default EbayItemLookup; 