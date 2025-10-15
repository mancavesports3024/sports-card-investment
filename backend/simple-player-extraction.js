class SimplePlayerExtractor {
    constructor() {
        // Minimal viable centralized extractor to satisfy imports and production use
        // These lists should mirror the documented categories at a basic level
        this.yearRegex = /\b(19|20)\d{2}\b/g;
        this.cardSetTerms = [
            'topps','panini','donruss','bowman','upper deck','fleer','score','leaf',
            'chrome','prizm','optic','mosaic','select','heritage','stadium club','contenders','immaculate','national treasures','flawless','obsidian'
        ];
        this.cardTypeTerms = [
            'rookie','rc','auto','autograph','patch','relic','parallel','insert','base','short print','ssp','sp',
            'blue ice','gold','silver','black','red','blue','green','yellow','refractor','holo','die-cut','cracked ice','stained glass'
        ];
        this.gradingTerms = [
            'psa','bgs','sgc','csg','hga','gma','gem mint','gem mt','mint','graded','ungraded','pop','population','cert','certificate','grade'
        ];
        this.numberTermsRegex = /(#\s?[A-Za-z0-9\-]+|\/[0-9]+|\bNo\.?\s?[A-Za-z0-9\-]+)/gi;
        this.teamLeagueCityTerms = [
            'nfl','mlb','nba','nhl','ufc','mma','wwe','nascar',
            // Common teams/cities subset
            'new york','los angeles','chicago','dallas','boston','miami','san francisco','seattle','philadelphia','houston','yankees','dodgers','lakers','celtics','patriots','cowboys','packers','steelers'
        ];
    }

    extractPlayerName(title) {
        if (!title || typeof title !== 'string') return '';
        let working = ` ${title.toLowerCase()} `;

        // Step 1: remove year
        working = working.replace(this.yearRegex, ' ');

        // Step 2: remove card set terms
        this.cardSetTerms.forEach(term => {
            const rx = new RegExp(`\\b${this.escape(term)}\\b`, 'gi');
            working = working.replace(rx, ' ');
        });

        // Step 3: remove card type terms
        this.cardTypeTerms.forEach(term => {
            const rx = new RegExp(`\\b${this.escape(term)}\\b`, 'gi');
            working = working.replace(rx, ' ');
        });

        // Step 4: remove team/league/city terms
        this.teamLeagueCityTerms.forEach(term => {
            const rx = new RegExp(`\\b${this.escape(term)}\\b`, 'gi');
            working = working.replace(rx, ' ');
        });

        // Step 5: remove grading terms
        this.gradingTerms.forEach(term => {
            const rx = new RegExp(`\\b${this.escape(term)}\\b`, 'gi');
            working = working.replace(rx, ' ');
        });

        // Step 6: remove numbers / print runs / hashes
        working = working.replace(this.numberTermsRegex, ' ');

        // Cleanup
        working = working.replace(/[^a-z\s'\-]/gi, ' ');
        working = working.replace(/\s+/g, ' ').trim();

        // Heuristic: take up to first 3 words as a name candidate
        const words = working.split(' ').filter(Boolean);
        const candidate = words.slice(0, 3).join(' ');
        return this.toTitleCase(candidate);
    }

    escape(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    toTitleCase(s) {
        return s.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ').trim();
    }
}

module.exports = SimplePlayerExtractor;


