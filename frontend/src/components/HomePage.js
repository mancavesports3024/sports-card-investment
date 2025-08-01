import React from 'react';
import { HeaderAd, InContentAd } from './AdSense';
import FeaturedEbayRotator from './FeaturedEbayRotator';
import PageLayout from './PageLayout';

const HomePage = () => {
  return (
    <div className="home-page">
      {/* Main Content */}
      <main className="App-main">
        <PageLayout
          title="Home"
          subtitle="Welcome to your trading card destination - find the best deals and track card values"
          icon="🏠"
        >
          {/* Welcome Message with eBay Items */}
          <div className="welcome-section" style={{
            background: 'linear-gradient(135deg, #000 0%, #333 100%)',
            color: '#ffd700',
            padding: '1rem',
            borderRadius: 12,
            marginBottom: '2rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '2px solid #ffd700',
            maxWidth: '600px',
            margin: '0 auto 2rem auto'
          }}>
            <p style={{ 
              fontSize: '0.95rem', 
              lineHeight: '1.4', 
              marginBottom: '1rem',
              textAlign: 'center',
              color: '#fff'
            }}>
              Your destination for all things trading cards—specializing in sports cards and Pokémon!
            </p>
            <h3 style={{ 
              margin: '0 0 0.75rem 0', 
              fontSize: '1.2rem', 
              fontWeight: 600,
              textAlign: 'center',
              color: '#ffd700'
            }}>
              Featured Items from Our eBay Store
            </h3>
            <FeaturedEbayRotator />
          </div>



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
              <div className="feature-card">
                <div className="feature-icon">📰</div>
                <h3>Release Calendar</h3>
                <p>Stay updated on the latest card releases with our comprehensive calendar and industry news.</p>
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
        </PageLayout>
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
        
      </footer>
    </div>
  );
};

export default HomePage; 