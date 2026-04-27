const http = require('http');

async function createTestOrder() {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: 'postgresql://postgres:Honda@125@localhost:5432/ecommerce' });
    
    // Get first user
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');
    const userId = userRes.rows[0].id;
    
    // create fake order
    const orderRes = await pool.query(
        INSERT INTO orders (user_id, status, total, shipping_address)
        VALUES ( + "'"+userId+"'" + , 'confirmed', 15.99, '{"name":"John Doe", "address":"123 Main St", "city":"NY", "zip":"10001", "country":"US"}')
        RETURNING id
    );
    
    const orderId = orderRes.rows[0].id;
    
    // add fake order item
    await pool.query(
        INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
        VALUES ('+orderId+', null, 'Test Product', 15.99, 1)
    );
    
    console.log(orderId);
    process.exit(0);
}

createTestOrder().catch(console.error);
