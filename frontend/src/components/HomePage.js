import React from 'react';
import { HeaderAd, InContentAd } from './AdSense';
import FeaturedEbayRotator from './FeaturedEbayRotator';

const HomePage = () => {
  return (
    <div className="home-page">
      {/* Main Content */}
      <main className="home-main">
        {/* Featured eBay Items - Moved to TOP */}
        <section className="featured-ebay-section" style={{ marginTop: '0', paddingTop: '2rem' }}>
          <h2 className="section-title">Welcome to ManCave Sports Cards LLC!</h2>
          <p style={{ color: '#333', fontSize: '1.1rem', margin: '0.5rem 0 1.5rem 0', textAlign: 'center' }}>
            Your destination for all things trading cards—specializing in sports cards and Pokémon! We offer a diverse range of high-quality cards for collectors of all levels.
          </p>
          <h3 className="section-title" style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Featured Items from Our eBay Store</h3>
          <FeaturedEbayRotator />
        </section>

        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">
              Track <span className="highlight">Sports Card</span> Values Like a Pro
            </h1>
            <p className="hero-subtitle">
              Get real-time pricing data, market trends, and auction insights for your sports card collection. 
              Make informed buying and selling decisions with our comprehensive analytics platform.
            </p>
            <div className="hero-cta">
              <a href="/search" className="cta-button large">Search Cards</a>
              <a href="/card-set-analysis" className="cta-button" style={{ marginLeft: '1rem' }}>Card Set Analysis</a>
              <p className="cta-note">Free to use • No registration required</p>
            </div>
          </div>
          <div className="hero-image">
            <div className="mockup-card">
              <div className="mockup-header">220 Panini Prizm</div>
              <div className="mockup-content">
                <div className="mockup-price">$1,250</div>
                <div className="mockup-trend">↗️ +15% this week</div>
              </div>
            </div>
          </div>
        </section>

        {/* Header Ad */}
        <HeaderAd />

        {/* Features Section */}
        <section className="features-section">
          <h2 className="section-title">Why Choose Scorecard?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Real-Time Search</h3>
              <p>Search across multiple platforms including eBay, 130point, and more to get comprehensive pricing data.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Market Analytics</h3>
              <p>Track price trends, market movements, and historical data to make informed decisions.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Mobile Optimized</h3>
              <p>Access your card data anywhere with our responsive design that works on all devices.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Lightning Fast</h3>
              <p>Get results instantly with our optimized search algorithms and caching system.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Live Listings</h3>
              <p>Monitor active auctions and listings to track real-time market activity.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🃏</div>
              <h3>Card Set Analysis</h3>
              <p>Discover the most valuable and best-selling cards from specific sets like Topps 2025 Series One.</p>
            </div>
          </div>
        </section>

        {/* In-Content Ad */}
        <InContentAd />

        {/* How It Works */}
        <section className="how-it-works">
          <h2 className="section-title">How It Works</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Search Your Card</h3>
              <p>Enter the card name, player, or set to find current market data and pricing information.</p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Analyze Results</h3>
              <p>Review sold listings, current auctions, and price trends to understand market value.</p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Make Decisions</h3>
              <p>Use the comprehensive data to make informed buying, selling, or trading decisions.</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <h2>Ready to Start?</h2>
          <p>Join thousands of collectors who trust Scorecard for their sports card research.</p>
          <a href="/search" className="cta-button">Search Cards Now</a>
        </section>
      </main>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Connect With Us</h4>
            <div className="social-links">
              <a href="https://twitter.com/scorecard" className="social-link" target="_blank" rel="noopener noreferrer">
                <span>𝕏</span> Follow on X
              </a>
              <a href="https://instagram.com/scorecard" className="social-link" target="_blank" rel="noopener noreferrer">
                <span>📷</span> Instagram
              </a>
              <a href="https://facebook.com/scorecard" className="social-link" target="_blank" rel="noopener noreferrer">
                <span>📘</span> Facebook
              </a>
            </div>
          </div>
          <div className="footer-section">
            <h4>Shop on eBay</h4>
            <div className="ebay-promo">
              <p>Find great deals on sports cards!</p>
              <a href="https://ebay.com" className="ebay-store-btn" target="_blank" rel="noopener noreferrer">             Visit eBay Store
              </a>
            </div>
          </div>
        </div>
        <p style={{marginTop: '2rem', color: '#666'}}>
          © 224recard. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default HomePage; 