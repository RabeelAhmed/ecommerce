const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Shared ioredis client — auto-reconnects, no startup "not ready" window.
// BullMQ and cartService both import this same instance.
const client = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,   // required by BullMQ
    enableReadyCheck: false,
    lazyConnect: false,
    retryStrategy(times) {
        if (times > 20) return null;
        return Math.min(times * 100, 3000);
    },
    reconnectOnError() { return true; },
});

client.on('error',  (err) => console.warn('Redis Client Error:', err.message));
client.on('connect',  () => console.log('Redis client connected'));
client.on('ready',    () => console.log('Redis client ready'));
client.on('reconnecting', () => console.log('Redis client reconnecting...'));

module.exports = {
    client,
    get isConnected() {
        // 'ready' means connection is established and the client is usable
        return client.status === 'ready';
    }
};
