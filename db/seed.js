require('dotenv').config();
const pool = require('../src/config/db');

const categories = [
  { name: 'Textiles',  slug: 'textiles'  },
  { name: 'Ceramics',  slug: 'ceramics'  },
  { name: 'Jewellery', slug: 'jewellery' },
  { name: 'Baskets',   slug: 'baskets'   },
];

const products = [
  {
    name:        'Berber Hand-Woven Throw',
    slug:        'berber-hand-woven-throw',
    description: 'A luxurious hand-woven throw crafted by Berber artisans in the Atlas Mountains. Each thread carries centuries of tradition and care.',
    price:       89.00,
    stock:       12,
    category:    'textiles',
    image_url:   'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop&q=80',
  },
  {
    name:        'Indigo Block-Print Cushion',
    slug:        'indigo-block-print-cushion',
    description: 'Hand block-printed using natural indigo dye on 100% organic cotton. A statement piece for any living space.',
    price:       42.00,
    stock:       8,
    category:    'textiles',
    image_url:   'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop&q=80',
  },
  {
    name:        'Oaxacan Clay Vessel',
    slug:        'oaxacan-clay-vessel',
    description: 'Fired in a traditional wood kiln, this vessel is shaped entirely by hand by master potters from Oaxaca, Mexico.',
    price:       54.50,
    stock:       5,
    category:    'ceramics',
    image_url:   'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&auto=format&fit=crop&q=80',
  },
  {
    name:        'Raku-Fired Tea Bowl',
    slug:        'raku-fired-tea-bowl',
    description: 'An authentic raku tea bowl made using the centuries-old Japanese technique. No two are alike — each one is a unique creation.',
    price:       78.00,
    stock:       3,
    category:    'ceramics',
    image_url:   'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=80',
  },
  {
    name:        'Tuareg Silver Cuff',
    slug:        'tuareg-silver-cuff',
    description: 'A bold silver cuff bracelet hand-stamped with geometric Tuareg symbols. Sourced directly from artisans in the Sahara.',
    price:       120.00,
    stock:       0,
    category:    'jewellery',
    image_url:   'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop&q=80',
  },
  {
    name:        'Ethiopian Beaded Necklace',
    slug:        'ethiopian-beaded-necklace',
    description: 'A vibrant multi-strand necklace hand-beaded by women artisans from the Omo Valley. Bold colour, bold heritage.',
    price:       65.00,
    stock:       10,
    category:    'jewellery',
    image_url:   'https://images.unsplash.com/photo-1611085583191-a3b181a88552?w=800&auto=format&fit=crop&q=80',
  },
  {
    name:        'Ghanaian Kente Basket',
    slug:        'ghanaian-kente-basket',
    description: 'A versatile storage basket hand-woven with Kente-inspired patterns from natural grasses and bright threads.',
    price:       38.00,
    stock:       15,
    category:    'baskets',
    image_url:   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop&q=80',
  },
  {
    name:        'Moroccan Straw Market Tote',
    slug:        'moroccan-straw-market-tote',
    description: 'A spacious hand-woven straw tote from Marrakech\'s medina craftswomen. Perfect for the market or beach.',
    price:       47.50,
    stock:       7,
    category:    'baskets',
    image_url:   'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=800&auto=format&fit=crop&q=80',
  },
];

async function seed() {
  console.log('🌱  Starting seed…');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert categories
    const catMap = {};
    for (const cat of categories) {
      const res = await client.query(
        `INSERT INTO categories (name, slug)
         VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [cat.name, cat.slug]
      );
      catMap[cat.slug] = res.rows[0].id;
      console.log(`  ✔ Category: ${cat.name}`);
    }

    // Upsert products
    for (const p of products) {
      await client.query(
        `INSERT INTO products (name, slug, description, price, stock, category_id, image_url, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT (slug) DO UPDATE SET
           name        = EXCLUDED.name,
           description = EXCLUDED.description,
           price       = EXCLUDED.price,
           stock       = EXCLUDED.stock,
           category_id = EXCLUDED.category_id,
           image_url   = EXCLUDED.image_url`,
        [p.name, p.slug, p.description, p.price, p.stock, catMap[p.category], p.image_url]
      );
      console.log(`  ✔ Product: ${p.name}`);
    }

    await client.query('COMMIT');
    console.log('\n✅  Seed complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
