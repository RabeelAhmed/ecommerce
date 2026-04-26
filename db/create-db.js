require('dotenv').config();
const { Client } = require('pg');

async function createDatabase() {
    // Connect to the default 'postgres' database
    const client = new Client({
        user: 'postgres',
        password: 'Honda@125',
        host: 'localhost',
        port: 5432,
        database: 'postgres'
    });

    try {
        await client.connect();
        console.log('Connected to default postgres database.');
        
        // Check if database already exists
        const res = await client.query("SELECT datname FROM pg_catalog.pg_database WHERE datname = 'ecommerce'");
        if (res.rowCount === 0) {
            console.log('Creating database "ecommerce"...');
            await client.query('CREATE DATABASE ecommerce');
            console.log('Database "ecommerce" created successfully!');
        } else {
            console.log('Database "ecommerce" already exists.');
        }
    } catch (err) {
        console.error('Error creating database:', err);
    } finally {
        await client.end();
    }
}

createDatabase();
