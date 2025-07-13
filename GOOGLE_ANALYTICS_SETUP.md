# Google Analytics Setup Guide for Scorecard

## Overview
Google Analytics has been integrated into your Scorecard app to track user behavior and provide insights into how users interact with your trading card tracking platform.

## What's Being Tracked

### 1. Page Views
- Home page visits
- Dashboard page visits
- Automatic tracking of page navigation

### 2. Search Events
- Search queries performed
- Search filters used (player, manufacturer, year, etc.)
- Advanced search usage
- Search exclusions

### 3. Card Interactions
- Card detail views (when users click "View on eBay")
- Live listings views
- Card category interactions (Raw, PSA 9, PSA 10)

### 4. Error Tracking
- Search failures
- API errors
- User-facing error messages

### 5. Live Listings
- Live listings views by category
- Filter usage (All, Auction, Buy It Now)
- Item count tracking

## Setup Instructions

### Step 1: Create Google Analytics Account
1. Go to [Google Analytics](https://analytics.google.com)
2. Click "Start measuring"
3. Follow the setup wizard to create your account
4. Create a new property for your website

### Step 2: Get Your Measurement ID
1. In your Google Analytics property, go to Admin → Data Streams
2. Click "Add stream" → Web
3. Enter your website URL: `https://www.mancavesportscardsllc.com`
4. Give it a name like "Scorecard Website"
5. Copy the Measurement ID (starts with "G-")

### Step 3: Update the Tracking Code
1. Open `frontend/public/index.html`
2. Find the Google Analytics section (around line 8-15)
3. Replace `G-XXXXXXXXXX` with your actual Measurement ID
4. Save the file

### Step 4: Deploy and Test
1. Commit and push your changes
2. Wait for deployment to complete
3. Visit your website and perform some actions
4. Check Google Analytics Real-Time reports to verify tracking

## Viewing Analytics Data

### Real-Time Reports
- Go to Google Analytics → Reports → Realtime
- See current visitors and their actions
- Verify that events are being tracked

### Standard Reports
- **Audience**: Who visits your site
- **Acquisition**: How users find your site
- **Behavior**: What users do on your site
- **Conversions**: Track specific goals (optional)

### Custom Events
The following custom events are tracked:
- `search`: When users perform searches
- `view_item`: When users click on card links
- `view_live_listings`: When users view live listings
- `exception`: When errors occur

## Privacy Considerations

### GDPR Compliance
- Google Analytics respects user privacy settings
- Users can opt out via browser settings
- Consider adding a privacy policy to your site

### Data Retention
- Google Analytics data is retained according to your settings
- Default retention is 26 months
- You can adjust this in property settings

## Troubleshooting

### No Data Appearing
1. Check that your Measurement ID is correct
2. Verify the tracking code is in the `<head>` section
3. Check browser console for JavaScript errors
4. Ensure your site is accessible to Google's servers

### Missing Events
1. Check that the `useAnalytics` hook is properly imported
2. Verify event tracking calls are being made
3. Check browser console for errors
4. Test with browser developer tools

### Performance Impact
- Google Analytics is loaded asynchronously
- Minimal impact on page load times
- Consider implementing consent management for EU users

## Next Steps

### Advanced Analytics
1. Set up conversion goals (e.g., successful searches)
2. Create custom dashboards
3. Set up email reports
4. Configure audience segments

### Integration Opportunities
1. Connect with Google Search Console
2. Set up Google Ads integration
3. Implement enhanced ecommerce tracking
4. Add custom dimensions for better insights

## Support
- [Google Analytics Help Center](https://support.google.com/analytics)
- [Google Analytics Community](https://support.google.com/analytics/community)
- [Google Analytics YouTube Channel](https://www.youtube.com/user/googleanalytics)

---

**Note**: This setup provides basic analytics tracking. For more advanced features, consider implementing Google Analytics 4 enhanced features or Google Tag Manager for more complex tracking scenarios. 