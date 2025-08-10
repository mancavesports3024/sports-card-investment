// Test the price calculation that's causing NaN
const rawPrices = [2.50, 42.00, 2.00, 6.36, 1.99];

console.log('🔍 Debugging price calculation...');
console.log('Raw prices:', rawPrices);
console.log('Type of first price:', typeof rawPrices[0]);

// Test the reduce function
const sum = rawPrices.reduce((acc, price) => {
    console.log(`Adding ${price} (type: ${typeof price}) to sum ${acc}`);
    return acc + price;
}, 0);

console.log('Sum:', sum);
console.log('Average:', sum / rawPrices.length);

// Test with string prices (this might be the issue)
const stringPrices = ['2.50', '42.00', '2.00', '6.36', '1.99'];
console.log('\n🔍 Testing with string prices...');
console.log('String prices:', stringPrices);

const stringSum = stringPrices.reduce((acc, price) => {
    const numPrice = parseFloat(price);
    console.log(`Converting "${price}" to ${numPrice} (type: ${typeof numPrice})`);
    return acc + numPrice;
}, 0);

console.log('String sum:', stringSum);
console.log('String average:', stringSum / stringPrices.length);
