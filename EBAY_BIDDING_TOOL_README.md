# 🚀 eBay Last-Second Bidding Tool

A powerful local tool for monitoring eBay auctions and placing strategic last-second bids to maximize your chances of winning auctions at the best possible price.

## ✨ Features

- **Real-time Auction Monitoring**: Get live auction information including current price, time remaining, and bid count
- **Strategic Bid Scheduling**: Schedule bids to execute automatically seconds before auction ends
- **Smart Time Parsing**: Automatically parses eBay's time format (e.g., "2d 5h 30m 15s")
- **Saved Items Management**: Save items for quick access and future bidding
- **Task Management**: View and manage all scheduled bidding tasks
- **Modern UI**: Beautiful, responsive interface with your brand colors (black and yellow)
- **Local Operation**: Runs entirely on your local machine for privacy and control

## 🛠️ Setup Instructions

### Prerequisites

1. **Node.js** (version 18 or higher)
2. **Chrome/Chromium browser** (for Puppeteer automation)
3. **eBay account** (must be logged in for bidding functionality)

### Installation

1. **Clone/Download the project** (if not already done)
2. **Install backend dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   ```

4. **Start the backend server**:
   ```bash
   cd backend
   npm run dev
   ```

5. **Start the frontend development server**:
   ```bash
   cd frontend
   npm start
   ```

6. **Access the tool**: Navigate to `http://localhost:3000/ebay-bidding`

## 🎯 How to Use

### 1. Get Auction Information
1. Find an eBay auction item ID (the number in the URL: `https://www.ebay.com/itm/123456789012`)
2. Enter the item ID in the "eBay Item ID" field
3. Click "Get Auction Info" to retrieve current auction details

### 2. Schedule a Last-Second Bid
1. After getting auction information, enter your maximum bid amount
2. Set the bid buffer (seconds before auction ends - default: 30 seconds)
3. Click "🚀 Schedule Last-Second Bid"
4. The system will automatically place your bid at the specified time

### 3. Manage Saved Items
1. Save items for quick access by clicking "💾 Save Item"
2. Load saved items by clicking "Load" on any saved item
3. Remove items you no longer want to track

### 4. Monitor Active Tasks
- View all scheduled bidding tasks in the "Active Bidding Tasks" section
- Cancel scheduled bids if needed
- Track the status of each task (scheduled, executing, completed, failed)

## ⚙️ Configuration

The tool stores configuration in `backend/data/bidding-config.json`:

```json
{
  "maxBidAmount": 100,
  "bidBuffer": 30,
  "autoBidEnabled": false,
  "savedItems": []
}
```

### Configuration Options:
- **maxBidAmount**: Default maximum bid amount
- **bidBuffer**: Default seconds before auction ends to place bid
- **autoBidEnabled**: Enable/disable automatic bidding features
- **savedItems**: Array of saved auction items

## 🔧 Testing

Run the test script to verify functionality:

```bash
cd backend
node test-ebay-bidding.js
```

This will test:
- Auction information retrieval
- Time parsing functionality
- Configuration management
- Saved items management
- Service health check

## ⚠️ Important Notes

### Security & Privacy
- **Local Operation**: This tool runs entirely on your local machine
- **Browser Automation**: Uses Puppeteer to automate browser interactions
- **Login Required**: You must be logged into eBay in the automated browser for bidding to work
- **No Data Sharing**: All data is stored locally on your machine

### eBay Terms of Service
- **Use Responsibly**: Ensure your use complies with eBay's Terms of Service
- **Rate Limiting**: The tool includes delays to avoid overwhelming eBay's servers
- **User Agent**: Uses realistic browser user agents to avoid detection

### Technical Considerations
- **Browser Instance**: The tool opens a Chrome browser instance (visible by default)
- **Network Dependencies**: Requires internet connection to access eBay
- **Time Accuracy**: Relies on your system clock for bid timing
- **Error Handling**: Includes comprehensive error handling and logging

## 🚨 Troubleshooting

### Common Issues

1. **"Bid button not found"**
   - Ensure you're logged into eBay
   - The auction may have ended or changed format
   - Try refreshing the auction page

2. **"User not logged in to eBay"**
   - Log into eBay in the automated browser window
   - The browser session may have expired

3. **"Could not parse time remaining"**
   - eBay may have changed their time format
   - The auction may have ended

4. **Browser not opening**
   - Ensure Chrome/Chromium is installed
   - Check if another instance is already running

### Debug Mode

To run in debug mode with visible browser:

```javascript
// In ebayBiddingService.js, ensure headless is set to false:
headless: false
```

## 📁 File Structure

```
backend/
├── services/
│   └── ebayBiddingService.js    # Core bidding service
├── routes/
│   └── ebayBidding.js           # API routes
├── data/
│   └── bidding-config.json      # Configuration storage
└── test-ebay-bidding.js         # Test script

frontend/
├── src/
│   ├── components/
│   │   ├── EbayBiddingTool.js   # Main React component
│   │   └── EbayBiddingTool.css  # Styling
│   └── App.js                   # Updated with new route
```

## 🔄 API Endpoints

- `GET /api/ebay-bidding/auction/:itemId` - Get auction information
- `POST /api/ebay-bidding/schedule-bid` - Schedule a bid
- `GET /api/ebay-bidding/tasks` - Get all bidding tasks
- `DELETE /api/ebay-bidding/cancel-bid/:taskId` - Cancel a scheduled bid
- `GET /api/ebay-bidding/config` - Get configuration
- `PUT /api/ebay-bidding/config` - Update configuration
- `GET /api/ebay-bidding/saved-items` - Get saved items
- `POST /api/ebay-bidding/saved-items` - Add saved item
- `DELETE /api/ebay-bidding/saved-items/:itemId` - Remove saved item

## 🎨 Customization

### Brand Colors
The tool uses your brand colors (black and yellow):
- Primary: `#ffd700` (golden yellow)
- Background: `#1a1a1a` to `#2d2d2d` (dark gradient)
- Accents: Various shades of yellow and black

### Styling
Modify `frontend/src/components/EbayBiddingTool.css` to customize the appearance.

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the console logs for error messages
3. Test with the provided test script
4. Ensure all dependencies are properly installed

## 🔮 Future Enhancements

Potential improvements:
- Multiple auction monitoring
- Advanced bid strategies
- Price trend analysis
- Email notifications
- Mobile app version
- Integration with other auction sites

---

**Disclaimer**: This tool is for educational and personal use. Users are responsible for complying with eBay's Terms of Service and applicable laws. Use at your own risk. 