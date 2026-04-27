const http = require('http');

async function runTest() {
  try {
    // 1. Login
    const loginRes = await fetch('http://localhost:3005/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'checkout_test@nomadica.com', password: 'TestPass123' })
    });
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];
    console.log('Login Status:', loginRes.status);

    // 2. Add to cart
    const cartRes = await fetch('http://localhost:3005/api/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ productId: '99dec55a-7a64-47ce-b6c1-ba80c4d06b1c', quantity: 1 })
    });
    console.log('Cart Status:', cartRes.status);
    
    // 3. Checkout
    const orderRes = await fetch('http://localhost:3005/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        name: 'John Smith',
        address: '123 Main Street',
        city: 'New York',
        zip: '10001',
        country: 'US'
      })
    });
    
    const text = await orderRes.text();
    console.log('Order Status:', orderRes.status);
    console.log('Order Body:', text);
    
  } catch (err) {
    console.error('Test Error:', err);
  }
}

runTest();
