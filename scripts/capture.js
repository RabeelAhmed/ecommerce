const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../public/images/screenshots');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const baseUrl = 'http://localhost:3005';

    try {
        console.log('Capturing Home...');
        await page.goto(`${baseUrl}/`);
        await page.screenshot({ path: path.join(outDir, '01-home.png'), fullPage: true });

        console.log('Capturing Shop...');
        await page.goto(`${baseUrl}/shop`);
        await page.screenshot({ path: path.join(outDir, '02-shop.png'), fullPage: true });

        console.log('Capturing Product...');
        await page.goto(`${baseUrl}/shop/berber-hand-woven-throw`);
        await page.screenshot({ path: path.join(outDir, '03-product.png'), fullPage: true });

        console.log('Capturing Empty Cart...');
        await page.goto(`${baseUrl}/cart`);
        await page.screenshot({ path: path.join(outDir, '04-cart.png'), fullPage: true });

        console.log('Adding product to cart...');
        await page.goto(`${baseUrl}/shop/berber-hand-woven-throw`);
        
        // Wait for the form and add to cart
        await page.waitForSelector('form[action="/cart/add"] button');
        await Promise.all([
            page.waitForNavigation(),
            page.click('form[action="/cart/add"] button')
        ]);
        
        console.log('Capturing Filled Cart...');
        await page.screenshot({ path: path.join(outDir, '05-cart-filled.png'), fullPage: true });

        console.log('Capturing Login/Register...');
        await page.goto(`${baseUrl}/api/auth/register`);
        await page.screenshot({ path: path.join(outDir, '06-register.png'), fullPage: true });

        console.log('Registering test user...');
        const testEmail = `test${Date.now()}@example.com`;
        await page.type('input[name="name"]', 'Test User');
        await page.type('input[name="email"]', testEmail);
        await page.type('input[name="password"]', 'password123');
        await page.type('input[name="passwordConfirm"]', 'password123');

        await Promise.all([
            page.waitForNavigation(),
            page.click('form button[type="submit"]')
        ]);

        console.log('Capturing Account...');
        await page.goto(`${baseUrl}/account`);
        await page.screenshot({ path: path.join(outDir, '07-account.png'), fullPage: true });

        console.log('Capturing Checkout...');
        await page.goto(`${baseUrl}/checkout`);
        await page.screenshot({ path: path.join(outDir, '08-checkout.png'), fullPage: true });

        console.log('Submitting Checkout...');
        await page.type('input[name="fullName"]', 'Test User');
        await page.type('input[name="addressLine1"]', '123 Test St');
        await page.type('input[name="city"]', 'Test City');
        await page.type('input[name="postalCode"]', '12345');
        await page.type('input[name="country"]', 'Test Country');

        await Promise.all([
            page.waitForNavigation(),
            page.click('form#checkoutForm button[type="submit"]')
        ]);

        console.log('Capturing Order Confirmation...');
        await page.screenshot({ path: path.join(outDir, '09-order-confirmation.png'), fullPage: true });

        console.log('Screenshots captured successfully!');
    } catch (e) {
        console.error('Error taking screenshots', e);
    } finally {
        await browser.close();
    }
})();
