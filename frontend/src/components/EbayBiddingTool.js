import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './EbayBiddingTool.css';

const EbayBiddingTool = () => {
    const [itemId, setItemId] = useState('');
    const [maxBidAmount, setMaxBidAmount] = useState('');
    const [bidBuffer, setBidBuffer] = useState(30);
    const [auctionInfo, setAuctionInfo] = useState(null);
    const [biddingTasks, setBiddingTasks] = useState([]);
    const [savedItems, setSavedItems] = useState([]);
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    useEffect(() => {
        loadBiddingTasks();
        loadSavedItems();
        loadConfig();
    }, []);

    const loadBiddingTasks = async () => {
        try {
            const response = await axios.get(`${API_BASE}/api/ebay-bidding/tasks`);
            if (response.data.success) {
                setBiddingTasks(response.data.data);
            }
        } catch (error) {
            console.error('Error loading bidding tasks:', error);
        }
    };

    const loadSavedItems = async () => {
        try {
            const response = await axios.get(`${API_BASE}/api/ebay-bidding/saved-items`);
            if (response.data.success) {
                setSavedItems(response.data.data);
            }
        } catch (error) {
            console.error('Error loading saved items:', error);
        }
    };

    const loadConfig = async () => {
        try {
            const response = await axios.get(`${API_BASE}/api/ebay-bidding/config`);
            if (response.data.success) {
                setConfig(response.data.data);
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
    };

    const getAuctionInfo = async () => {
        if (!itemId.trim()) {
            setError('Please enter an eBay item ID');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await axios.get(`${API_BASE}/api/ebay-bidding/auction/${itemId.trim()}`);
            if (response.data.success) {
                setAuctionInfo(response.data.data);
                setSuccess('Auction information loaded successfully');
            }
        } catch (error) {
            setError(error.response?.data?.error || 'Failed to get auction information');
        } finally {
            setLoading(false);
        }
    };

    const scheduleBid = async () => {
        if (!itemId.trim() || !maxBidAmount.trim()) {
            setError('Please enter both item ID and maximum bid amount');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await axios.post(`${API_BASE}/api/ebay-bidding/schedule-bid`, {
                itemId: itemId.trim(),
                maxBidAmount: parseFloat(maxBidAmount),
                bidBuffer: parseInt(bidBuffer)
            });

            if (response.data.success) {
                setSuccess('Bid scheduled successfully!');
                setItemId('');
                setMaxBidAmount('');
                setAuctionInfo(null);
                loadBiddingTasks();
            }
        } catch (error) {
            setError(error.response?.data?.error || 'Failed to schedule bid');
        } finally {
            setLoading(false);
        }
    };

    const cancelBid = async (taskId) => {
        try {
            const response = await axios.delete(`${API_BASE}/api/ebay-bidding/cancel-bid/${taskId}`);
            if (response.data.success) {
                setSuccess('Bid cancelled successfully');
                loadBiddingTasks();
            }
        } catch (error) {
            setError('Failed to cancel bid');
        }
    };

    const addSavedItem = async () => {
        if (!itemId.trim() || !maxBidAmount.trim()) {
            setError('Please enter both item ID and maximum bid amount');
            return;
        }

        try {
            const response = await axios.post(`${API_BASE}/api/ebay-bidding/saved-items`, {
                itemId: itemId.trim(),
                maxBidAmount: parseFloat(maxBidAmount)
            });

            if (response.data.success) {
                setSuccess('Item saved successfully');
                setItemId('');
                setMaxBidAmount('');
                loadSavedItems();
            }
        } catch (error) {
            setError(error.response?.data?.error || 'Failed to save item');
        }
    };

    const removeSavedItem = async (itemId) => {
        try {
            const response = await axios.delete(`${API_BASE}/api/ebay-bidding/saved-items/${itemId}`);
            if (response.data.success) {
                setSuccess('Item removed successfully');
                loadSavedItems();
            }
        } catch (error) {
            setError('Failed to remove item');
        }
    };

    const formatTimeRemaining = (timeString) => {
        if (!timeString) return 'Unknown';
        return timeString;
    };

    const formatPrice = (price) => {
        if (!price) return 'Unknown';
        return price;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'scheduled': return '#ffa500';
            case 'executing': return '#007bff';
            case 'completed': return '#28a745';
            case 'failed': return '#dc3545';
            default: return '#6c757d';
        }
    };

    return (
        <div className="ebay-bidding-tool">
            <div className="bidding-header">
                <h1>🚀 eBay Last-Second Bidding Tool</h1>
                <p>Monitor auctions and place strategic last-second bids</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="bidding-container">
                {/* Input Section */}
                <div className="input-section">
                    <h2>📋 Auction Information</h2>
                    <div className="input-group">
                        <label htmlFor="itemId">eBay Item ID:</label>
                        <input
                            type="text"
                            id="itemId"
                            value={itemId}
                            onChange={(e) => setItemId(e.target.value)}
                            placeholder="e.g., 123456789012"
                        />
                        <button 
                            onClick={getAuctionInfo} 
                            disabled={loading}
                            className="btn btn-primary"
                        >
                            {loading ? 'Loading...' : 'Get Auction Info'}
                        </button>
                    </div>

                    {auctionInfo && (
                        <div className="auction-info">
                            <h3>📊 Current Auction Details</h3>
                            <div className="auction-details">
                                <div className="detail-row">
                                    <span className="label">Title:</span>
                                    <span className="value">{auctionInfo.title || 'N/A'}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Current Price:</span>
                                    <span className="value price">{formatPrice(auctionInfo.currentPrice)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Time Remaining:</span>
                                    <span className="value time">{formatTimeRemaining(auctionInfo.timeRemaining)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Bid Count:</span>
                                    <span className="value">{auctionInfo.bidCount || 'N/A'}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">URL:</span>
                                    <a href={auctionInfo.url} target="_blank" rel="noopener noreferrer" className="value link">
                                        View on eBay
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bidding Section */}
                <div className="bidding-section">
                    <h2>💰 Schedule Bid</h2>
                    <div className="input-group">
                        <label htmlFor="maxBidAmount">Maximum Bid Amount ($):</label>
                        <input
                            type="number"
                            id="maxBidAmount"
                            value={maxBidAmount}
                            onChange={(e) => setMaxBidAmount(e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="bidBuffer">Bid Buffer (seconds before auction ends):</label>
                        <input
                            type="number"
                            id="bidBuffer"
                            value={bidBuffer}
                            onChange={(e) => setBidBuffer(e.target.value)}
                            placeholder="30"
                            min="5"
                            max="300"
                        />
                    </div>

                    <div className="button-group">
                        <button 
                            onClick={scheduleBid} 
                            disabled={loading || !itemId || !maxBidAmount}
                            className="btn btn-success"
                        >
                            {loading ? 'Scheduling...' : '🚀 Schedule Last-Second Bid'}
                        </button>
                        <button 
                            onClick={addSavedItem} 
                            disabled={loading || !itemId || !maxBidAmount}
                            className="btn btn-secondary"
                        >
                            💾 Save Item
                        </button>
                    </div>
                </div>

                {/* Active Bids Section */}
                <div className="tasks-section">
                    <h2>⏰ Active Bidding Tasks</h2>
                    {biddingTasks.length === 0 ? (
                        <p className="no-tasks">No active bidding tasks</p>
                    ) : (
                        <div className="tasks-list">
                            {biddingTasks.map((task) => (
                                <div key={task.taskId} className="task-item">
                                    <div className="task-header">
                                        <span className="task-id">Task: {task.taskId}</span>
                                        <span 
                                            className="task-status"
                                            style={{ color: getStatusColor(task.status) }}
                                        >
                                            {task.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="task-details">
                                        <div className="task-info">
                                            <span><strong>Item ID:</strong> {task.itemId}</span>
                                            <span><strong>Max Bid:</strong> ${task.maxBidAmount}</span>
                                            <span><strong>Bid Time:</strong> {task.bidTime}s before end</span>
                                        </div>
                                        {task.auctionInfo && (
                                            <div className="task-auction-info">
                                                <span><strong>Title:</strong> {task.auctionInfo.title}</span>
                                                <span><strong>Current Price:</strong> {task.auctionInfo.currentPrice}</span>
                                            </div>
                                        )}
                                        {task.result && (
                                            <div className="task-result">
                                                <strong>Result:</strong> {task.result}
                                            </div>
                                        )}
                                    </div>
                                    {task.status === 'scheduled' && (
                                        <button 
                                            onClick={() => cancelBid(task.taskId)}
                                            className="btn btn-danger btn-sm"
                                        >
                                            Cancel Bid
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Saved Items Section */}
                <div className="saved-items-section">
                    <h2>💾 Saved Items</h2>
                    {savedItems.length === 0 ? (
                        <p className="no-saved-items">No saved items</p>
                    ) : (
                        <div className="saved-items-list">
                            {savedItems.map((item) => (
                                <div key={item.itemId} className="saved-item">
                                    <div className="saved-item-info">
                                        <span><strong>Item ID:</strong> {item.itemId}</span>
                                        <span><strong>Max Bid:</strong> ${item.maxBidAmount}</span>
                                        <span><strong>Added:</strong> {new Date(item.addedAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="saved-item-actions">
                                        <button 
                                            onClick={() => {
                                                setItemId(item.itemId);
                                                setMaxBidAmount(item.maxBidAmount.toString());
                                            }}
                                            className="btn btn-primary btn-sm"
                                        >
                                            Load
                                        </button>
                                        <button 
                                            onClick={() => removeSavedItem(item.itemId)}
                                            className="btn btn-danger btn-sm"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EbayBiddingTool; 