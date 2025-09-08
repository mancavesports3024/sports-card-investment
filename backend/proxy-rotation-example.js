// Example of rotating proxy implementation
class ProxyRotator {
    constructor() {
        this.proxies = [
            'http://user:pass@proxy1.com:8080',
            'http://user:pass@proxy2.com:8080', 
            'http://user:pass@proxy3.com:8080'
        ];
        this.currentIndex = 0;
        this.failedProxies = new Set();
    }
    
    getNextProxy() {
        // Skip failed proxies
        let attempts = 0;
        while (attempts < this.proxies.length) {
            const proxy = this.proxies[this.currentIndex];
            this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
            
            if (!this.failedProxies.has(proxy)) {
                return proxy;
            }
            attempts++;
        }
        
        // If all proxies failed, reset and try again
        this.failedProxies.clear();
        return this.proxies[0];
    }
    
    markProxyFailed(proxy) {
        this.failedProxies.add(proxy);
        console.log(`❌ Marking proxy as failed: ${proxy}`);
    }
}

// Usage in eBay scraper:
const proxyRotator = new ProxyRotator();

async function makeRequestWithRotation(url) {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        const proxy = proxyRotator.getNextProxy();
        const httpsAgent = new HttpsProxyAgent(proxy);
        
        try {
            const response = await axios.get(url, {
                httpsAgent: httpsAgent,
                timeout: 15000
            });
            
            if (response.data.includes('Pardon Our Interruption')) {
                throw new Error('CAPTCHA detected');
            }
            
            return response;
            
        } catch (error) {
            proxyRotator.markProxyFailed(proxy);
            attempts++;
            
            if (attempts >= maxAttempts) {
                throw error;
            }
            
            // Wait between attempts
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

console.log('🔄 This shows how to rotate through multiple proxies automatically');
