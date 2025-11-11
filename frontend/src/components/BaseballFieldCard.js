import React from "react";
import "./BaseballFieldCard.css";

const formatPrice = (price) => {
  const numeric = Number(price);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "N/A";
  }
  return `$${numeric.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch (e) {
    return "";
  }
};

const extractCardInfo = (title, cardData = {}, gemrateData = {}) => {
  const info = {
    name: "",
    set: "",
    year: "",
    cardNumber: "",
    player: "",
  };

  info.name = gemrateData.cardName || gemrateData.player || "";
  info.set = gemrateData.set || "";
  info.year = gemrateData.year ? String(gemrateData.year) : "";
  info.cardNumber = gemrateData.cardNumber || gemrateData.card_number || "";
  info.player = gemrateData.player || "";

  const fallbackTitle = cardData.summaryTitle || title || "";

  if (!info.name && fallbackTitle) {
    info.name = fallbackTitle.replace(/\s*#\S+/, "").trim();
  }

  if (!info.set && (cardData.set || cardData.cardSet)) {
    info.set = cardData.set || cardData.cardSet || "";
  }

  if (!info.year) {
    const yearCandidate =
      (cardData.year && String(cardData.year)) ||
      (cardData.cardYear && String(cardData.cardYear)) ||
      (cardData.searchQuery && (cardData.searchQuery.match(/\b(19|20)\d{2}\b/) || [])[0]) ||
      (fallbackTitle && (fallbackTitle.match(/\b(19|20)\d{2}\b/) || [])[0]);
    if (yearCandidate) {
      info.year = yearCandidate;
    }
  }

  if (!info.cardNumber) {
    info.cardNumber =
      cardData.cardNumber ||
      cardData.card_number ||
      (fallbackTitle && (fallbackTitle.match(/#\s*([A-Za-z0-9-]+)/) || [])[1]) ||
      "";
  }

  if (!info.player && cardData.playerName) {
    info.player = cardData.playerName;
  }

  return info;
};

const resolveTrend = (basePrice, gradedPrice) => {
  if (!Number.isFinite(basePrice) || !Number.isFinite(gradedPrice) || basePrice <= 0) {
    return null;
  }
  const diff = ((gradedPrice - basePrice) / basePrice) * 100;
  return Number.isFinite(diff) ? diff : null;
};

const TrendBadge = ({ value }) => {
  if (value === null) return null;
  const sign = value >= 0 ? "+" : "";
  return (
    <span className={`trend-badge ${value >= 0 ? "up" : "down"}`}>
      {`${sign}${value.toFixed(1)}% vs Raw`}
    </span>
  );
};

const resolveCardImage = (card) => {
  const sources = [
    card.imageUrl,
    card.image?.imageUrl,
    typeof card.image === "string" ? card.image : null,
    card.image?.url,
    card.thumbnail,
    card.thumbnailUrl,
  ];

  return sources.find(
    (src) => typeof src === "string" && (src.startsWith("http://") || src.startsWith("https://"))
  );
};

const BaseballFieldCard = ({ card }) => {
  if (!card) return null;

  const rawPrice = Number(card.rawAveragePrice || card.raw?.averagePrice || 0);
  const psa9Price = Number(card.psa9AveragePrice || card.psa9?.averagePrice || 0);
  const psa10Price = Number(card.psa10Price || card.psa10?.averagePrice || 0);

  const gemrateData = card.gemrateData || card.population || {};
  const cardInfo = extractCardInfo(card.title || card.summaryTitle || "", card, gemrateData);

  const gemRateValue =
    typeof gemrateData.gemRate === "number" ? gemrateData.gemRate : null;
  const totalPopulation =
    gemrateData.total ||
    gemrateData.total_population ||
    gemrateData.population ||
    gemrateData.totalPopulation ||
    null;

  const psa10Pop =
    gemrateData.perfect ||
    gemrateData.gemMint ||
    gemrateData.grades?.g10 ||
    gemrateData.psa10Population ||
    null;
  const psa9Pop =
    gemrateData.grade9 ||
    gemrateData.grades?.g9 ||
    gemrateData.psa9Population ||
    null;

  const psa10Trend = resolveTrend(rawPrice, psa10Price);
  const psa9Trend = resolveTrend(rawPrice, psa9Price);

  const cardImage = resolveCardImage(card);

  return (
    <div className="scorecard-summary">
      <div className="summary-card">
        <header className="summary-header">
          <div className="card-title-block">
            {(cardInfo.year || cardInfo.set) && (
              <span className="card-set-year">
                {[cardInfo.year, cardInfo.set].filter(Boolean).join(" · ")}
              </span>
            )}
            <h2>{cardInfo.name || card.summaryTitle || "Card Summary"}</h2>
            {(cardInfo.player || cardInfo.cardNumber) && (
              <div className="card-meta">
                {[cardInfo.player, cardInfo.cardNumber ? `#${cardInfo.cardNumber}` : null]
                  .filter(Boolean)
                  .join(" • ")}
              </div>
            )}
          </div>
          {(gemRateValue !== null || totalPopulation) && (
            <div className="header-stat-chip">
              <span className="label">Gem Rate</span>
              <span className="value">
                {gemRateValue !== null ? `${gemRateValue.toFixed(1)}%` : "N/A"}
              </span>
              {totalPopulation ? (
                <span className="caption">Total Pop: {totalPopulation.toLocaleString()}</span>
              ) : null}
            </div>
          )}
        </header>

        <div className="summary-body">
          <div className="price-card">
            <span className="label">PSA 9</span>
            <span className="price">{formatPrice(psa9Price)}</span>
            {psa9Pop ? <span className="subtext">Pop: {psa9Pop.toLocaleString()}</span> : null}
            <TrendBadge value={psa9Trend} />
          </div>

          <div className="card-image-panel">
            {cardImage ? (
              <img
                src={cardImage}
                alt={card.summaryTitle || card.title || 'Graded card'}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="card-placeholder">
                <span>Card Image</span>
                <span>Not Available</span>
              </div>
            )}
          </div>

          <div className="price-card">
            <span className="label">PSA 10</span>
            <span className="price">{formatPrice(psa10Price)}</span>
            {psa10Pop ? <span className="subtext">Pop: {psa10Pop.toLocaleString()}</span> : null}
            <TrendBadge value={psa10Trend} />
          </div>
        </div>

        <div className="summary-bottom">
          <div className="raw-card">
            <div className="label">Raw</div>
            <div className="price">{formatPrice(rawPrice)}</div>
            <div className="details">Average recent ungraded sale price</div>
          </div>
          <div className="summary-footer">
            {card.createdAt && (
              <div>Created: {formatTimestamp(card.createdAt)}</div>
            )}
            <div className="footer-site">mancavesportscardsllc.com</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BaseballFieldCard;
