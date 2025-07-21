# 🚀 Sports Card Tracker - Deployment Guide

This guide will help you deploy your Sports Card Tracker to the web using Vercel (frontend) and Railway (backend).

## 📋 Prerequisites

- GitHub account
- Vercel account (free)
- Railway account (free)
- eBay API credentials

## 🛠️ Step 1: Prepare Your Repository

1. **Push your code to GitHub** (if not already done)
2. **Ensure your `.env` file is in `.gitignore`** (API keys should never be committed)

## 🎯 Step 2: Deploy Backend to Railway

### 2.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Create a new project

### 2.2 Deploy Backend
1. **Connect your GitHub repository**
2. **Select the repository** containing your backend code (now in `ScoreCard/backend`)
3. **Railway will auto-detect** it's a Node.js app
4. **Add environment variables** in Railway dashboard:
   ```
   EBAY_AUTH_TOKEN=your_ebay_token_here
   PORT=3001
   NODE_ENV=production
   ```
5. **Deploy** - Railway will build and deploy automatically

### 2.3 Get Your Backend URL
- Railway will provide a URL like: `https://your-app-name.railway.app`
- **Save this URL** - you'll need it for the frontend

## 🌐 Step 3: Deploy Frontend to Vercel

### 3.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Import your repository

### 3.2 Configure Frontend
1. **Set build settings**:
   - Framework Preset: `Create React App`
   - Root Directory: `ScoreCard/frontend`
   - Build Command: `npm run build`
   - Output Directory: `build`

### 3.3 Add Environment Variables
In Vercel dashboard, add:
```
REACT_APP_API_URL=https://your-railway-app-name.railway.app
```

### 3.4 Deploy
- Vercel will build and deploy automatically
- You'll get a URL like: `https://your-app-name.vercel.app`

## 🔧 Step 4: Test Your Deployment

1. **Visit your Vercel URL**
2. **Try searching for a card**
3. **Check that results load** from your Railway backend
4. **Verify search history works**

## 🛡️ Security Notes

- ✅ **API keys are secure** in Railway environment variables
- ✅ **No sensitive data** in your code repository
- ✅ **HTTPS enabled** on both platforms

## 🔄 Step 5: Custom Domain (Optional)

### Vercel (Frontend)
1. Go to your Vercel project settings
2. Add custom domain
3. Configure DNS records

### Railway (Backend)
1. Go to your Railway project settings
2. Add custom domain
3. Configure DNS records

## 📊 Monitoring

### Railway
- Monitor API usage
- Check logs for errors
- Set up alerts

### Vercel
- Monitor frontend performance
- Check analytics
- Review deployment logs

## 🆘 Troubleshooting

### Common Issues:
1. **CORS errors**: Ensure Railway URL is correct in Vercel environment variables
2. **API not responding**: Check Railway logs and environment variables
3. **Build failures**: Check Vercel build logs

### Support:
- Railway: [docs.railway.app](https://docs.railway.app)
- Vercel: [vercel.com/docs](https://vercel.com/docs)

## 🎉 Success!

Your Sports Card Tracker is now live on the web! Share your Vercel URL with others to let them search for sports card sales data.

---

**Remember**: Keep your API keys secure and never commit them to your repository! 