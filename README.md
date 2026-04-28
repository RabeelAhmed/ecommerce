# NOMADICA E-commerce Platform

A full-featured, robust, and beautifully designed e-commerce web application built with Node.js, Express, PostgreSQL, and EJS. Nomadica focuses on providing a seamless shopping experience for handcrafted goods from around the world.

## ✨ Features

- **User Authentication:** Secure registration and login using bcrypt and JWT.
- **Product Catalog:** Browse, filter, and view detailed product pages.
- **Shopping Cart:** Persistent, authenticated shopping cart.
- **Checkout Process:** Multi-step checkout with form validation and AJAX submission.
- **Order Management:** View order history in the user dashboard.
- **Admin Dashboard:** Dedicated admin interface to manage products and orders.
- **Responsive Design:** Mobile-first approach using Tailwind CSS.
- **Security:** Helmet, CORS, Rate Limiting, and custom CSRF protection built-in.
- **Professional UI:** Toast notifications, skeleton loading states, branded 404/error pages, and rich empty states.

## 🛠 Technologies Used

- **Backend:** Node.js, Express.js (v5)
- **Database:** PostgreSQL (`pg`)
- **Frontend/Views:** EJS, express-ejs-layouts, Tailwind CSS
- **Authentication:** jsonwebtoken, bcryptjs
- **Security:** helmet, cors, express-rate-limit, custom CSRF
- **Validation:** express-validator
- **Tooling:** concurrently, nodemon, autoprefixer

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd ecommerce
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Rename `.env.example` to `.env` and update the credentials:
   ```env
   PORT=3000
   DATABASE_URL=postgres://user:password@localhost:5432/ecommerce
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN=90d
   COOKIE_SECRET=your_cookie_secret
   CORS_ORIGIN=*
   NODE_ENV=development
   ```

4. **Database Setup:**
   Run the migrations and seed the database:
   ```bash
   node db/run-migrations.js
   node db/seed.js
   ```

5. **Start the Application:**
   For development (watches CSS and JS changes):
   ```bash
   npm run dev
   ```
   For production:
   ```bash
   npm start
   ```

---

## 📸 Application Flow & Screenshots

### 1. Home Page
Welcome to Nomadica, where you can discover featured artisan treasures.
![Home Page](./public/images/screenshots/01-home.png)

### 2. Shop Page
Browse all our carefully curated categories and products.
![Shop Page](./public/images/screenshots/02-shop.png)

### 3. Product Details
View specific details about an item, including its origin and history.
![Product Details](./public/images/screenshots/03-product.png)

### 4. Checkout
Fill in your shipping details through a sleek, validated checkout form.
![Checkout Page](./public/images/screenshots/08-checkout.png)

---

## 📁 Project Structure

```
├── db/
│   ├── migrations/      # SQL schema definitions
│   ├── run-migrations.js# Migration runner
│   └── seed.js          # Initial database seeder
├── public/
│   ├── images/          # Static assets and screenshots
│   ├── output.css       # Compiled Tailwind CSS
│   └── styles.css       # Tailwind entry point
├── src/
│   ├── config/          # Database & app configuration
│   ├── controllers/     # Route logic (if separated)
│   ├── middleware/      # Auth, error handling, CSRF, etc.
│   ├── routes/          # Express route definitions
│   ├── services/        # Business logic & DB queries
│   ├── utils/           # Helper functions (AppError, etc.)
│   └── app.js           # Main Express application
├── views/
│   ├── layouts/         # Base EJS templates
│   ├── pages/           # Individual views (home, shop, cart, admin)
│   └── partials/        # Reusable UI components (header, footer)
├── .env.example         # Template for environment variables
├── package.json         # Dependencies and scripts
├── postcss.config.js    # PostCSS configuration
└── tailwind.config.js   # Tailwind CSS configuration
```

## 📄 License
This project is licensed under the ISC License.
