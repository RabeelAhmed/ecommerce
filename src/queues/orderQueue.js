const { Queue } = require('bullmq');
const { client } = require('../config/redis');

// Re-use the shared ioredis client — avoids opening extra TCP connections to Redis
const orderQueue = new Queue('order-processing', { connection: client });

module.exports = { orderQueue };
