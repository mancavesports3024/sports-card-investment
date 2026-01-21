# Local Testing Checklist

Test these features before and after cleanup to ensure nothing breaks.

## ✅ Pre-Cleanup Testing

### 1. Homepage
- [ ] Homepage loads correctly
- [ ] Navigation links work
- [ ] "Search Cards" button works

### 2. Search Functionality
- [ ] Search for a card (e.g., "Mike Trout 2011 Topps Update")
- [ ] Results display correctly
- [ ] Prices show in USD
- [ ] Card titles don't have "USD" or "Sale Price" in them
- [ ] Click on a card to see details

### 3. Card Set Analysis
- [ ] Navigate to "Card Set Analysis"
- [ ] Search for a card set
- [ ] Results show with correct pricing
- [ ] Grades are categorized correctly (PSA 10, PSA 9, Raw)

### 4. Release Calendar / News Page
- [ ] Navigate to "News" page
- [ ] Release calendar displays
- [ ] Can navigate between months
- [ ] Click on a release to see details
- [ ] Legend appears above calendar

### 5. eBay Item Lookup
- [ ] Navigate to "eBay Item Lookup"
- [ ] Search for an eBay item number
- [ ] Results display correctly

### 6. Authentication (if applicable)
- [ ] Try to log in (if you have Google OAuth set up locally)
- [ ] Search history saves (if logged in)

### 7. Admin Features (if applicable)
- [ ] Admin card database accessible (if logged in as admin)

## 🔧 Things to Check

### Console Errors
- Open browser DevTools (F12)
- Check Console tab for any red errors
- Check Network tab for failed API calls

### API Connections
- All API calls should go to: `https://web-production-9efa.up.railway.app`
- No CORS errors
- No 404 or 500 errors

### Visual Issues
- Layout looks correct
- No broken images
- Colors/styling matches production site

## 📝 After Cleanup Testing

Run the same checklist again after cleanup to ensure:
- Nothing broke
- All features still work
- No new errors appeared

## 🚨 Red Flags (Stop if you see these)

- Blank pages
- 404 errors on main routes
- Console errors related to missing files
- API calls failing
- Navigation not working
