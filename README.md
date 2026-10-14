# CraveCraft — Smart Food Ordering & AI Dining Concierge

A modern, responsive gourmet restaurant web application built with **HTML5, Vanilla CSS, Vanilla JavaScript, and a Python Flask backend**. Features a dark obsidian theme with warm orange accents, 15 handcrafted Indian culinary dishes priced in INR (₹), an interactive cart drawer, instant checkout simulation, and **CraveBot** — a floating conversational AI concierge with zero-hallucination menu grounding and built-in **AI Response Quality Evaluation**.

---

## ✨ Features Overview

### 1. Modern Dark Luxury Design & Branding
- **Color Palette:** Deep obsidian luxury dark (`#0a0d14`), midnight card surfaces (`#151a26`), vibrant flame orange accents (`#ff6b35`, `#f7931e`), emerald veg indicators (`#10b981`), and crimson non-veg tags (`#ef4444`).
- **Typography & Effects:** Google Fonts (`Outfit` for display headings & `Plus Jakarta Sans` for body text), glassmorphism backdrops, subtle glows, and interactive hover micro-animations.
- **Hero Showcase:** High-resolution culinary hero banner, trust indicators (25-35 min delivery, 100% verified dietary badges, 4.9★ rating), and floating special badges.

### 2. Comprehensive Menu Catalog (15 Authentic Dishes)
- All prices strictly in **Indian Rupees (INR ₹)**.
- Standard **Veg (🟢)** and **Non-Veg (🔴)** square-dot badges.
- **7 Categories:** All Dishes, Starters & Small Plates, Signature Mains, Royal Biryanis, Artisanal Breads, Decadent Desserts, Craft Beverages.
- Rich item metadata: Rating, review count, spice index (🌶️), prep time, portion, calorie count, key ingredients, and culinary tasting profile.

### 3. Instant Search & Multi-Criteria Filtering
- Real-time search bar that filters by dish name, category, or ingredients (e.g. *truffle*, *paneer*, *biryani*).
- Dietary toggles: **All Items**, **🟢 Veg Only**, **🔴 Non-Veg Only**, **🌶️ Spicy Picks**, **⭐ Chef's Specials**, and **💵 Under ₹300**.
- Sort options: Recommended, Price Low to High, Price High to Low, Highest Rated.

### 4. Interactive Cart Drawer & Checkout
- Slide-out offcanvas cart with animated count badge in the navbar.
- Quantity adjustment steppers (`[ − ] [ qty ] [ + ]`) with automatic card synchronization.
- Coupon discount engine supporting **`CRAVE50`** (₹50 OFF on ₹300+) and **`FEAST100`** (₹100 OFF on ₹600+).
- Transparent bill breakdown: Item Subtotal, Express Delivery Fee (FREE above ₹499), 5% GST & Packaging, and Total.
- Checkout modal with delivery details form, payment method selector, and interactive order confirmation receipt with a 4-step live kitchen status tracker.

### 5. Floating "CraveBot" AI Dining Concierge
- Floating launcher at bottom-right with pulsing status indicator.
- Conversational support for:
  - Budget-constrained meals (e.g., *"dinner for 2 under ₹800"*, *"lunch under ₹400"*).
  - Dietary preferences (pure veg, high protein, keto, mild, fiery spicy).
  - Dish deep dives (explains ingredients, portion sizes, spice levels, and pairings).
- **Inline Order Buttons:** Recommended dishes include direct **"Add +"** action buttons that instantly insert the dish into your cart without closing the chat!
- Pre-loaded suggestion chips for one-click prompts.

### 6. Dual-Mode Bot Architecture (Works Without Any API Key!)
- **OpenAI Integration:** If `OPENAI_API_KEY` is present in your environment or `.env` file, CraveBot leverages `gpt-4o-mini` with strict menu grounding rules.
- **Intelligent Local Heuristic Fallback Engine:** If no API key is provided, CraveBot runs completely offline using a local NLP recommender that calculates budget combinations, parses dietary preferences, matches ingredients, and formats delicious responses with zero hallucinations.

### 7. AI Response Quality & Evaluation Benchmark (Requirements 9 & 10)
- **3-Dimensional Evaluation Rubric (Scores 1 to 5):**
  1. **Prompt Relevance (1–5):** Verifies adherence to user constraints (budget, veg/non-veg, occasion).
  2. **Factual Consistency with Menu (1–5):** Cross-checks every mentioned dish and price against the official catalog database (detects hallucinations and incorrect prices).
  3. **Clarity & Tone (1–5):** Evaluates conciseness, formatting, and helpfulness.
- **"Evaluate Response" Button on Every Chat Bubble:** Users can click `⚡ Evaluate Response` on any CraveBot reply to inspect its live evaluation card.
- **Dual-Mode Evaluator:** Uses OpenAI LLM-as-a-judge if API key is set; otherwise operates with a transparent **Rule-Based Evaluator Demo** that verifies database matches.
- **Sample Benchmark Report:** Pre-loaded report showing a test question, response, perfect 5.0/5.0 scores, verified dishes, and strengths.
- **Live Playground:** Interactive form to audit custom questions and bot answers on the fly.

---

## 🛠️ Tech Stack & Directory Structure

- **Frontend:** Semantic HTML5, Vanilla CSS3 (Custom Properties & Animations), Vanilla JavaScript (ES6+ Modules, Fetch API).
- **Backend:** Python 3.10+ with Flask and Flask-CORS.
- **AI Integrations:** OpenAI API (optional) with built-in heuristic NLP fallback engine.

```
CraveCraft/
├── app.py                     # Flask application & REST API routes
├── menu_data.py               # 15 sample dishes catalog with INR pricing
├── bot_engine.py              # CraveBot recommender + OpenAI + Fallback engine
├── evaluator_engine.py        # 3-criteria AI response evaluation engine
├── test_server.py             # Automated unit & integration test suite
├── requirements.txt           # Minimal Python dependencies
├── .env.example               # Environment variables template
├── static/
│   ├── css/
│   │   └── style.css          # Dark obsidian luxury theme & micro-animations
│   ├── js/
│   │   ├── app.js             # Menu rendering, cart drawer, checkout
│   │   ├── chatbot.js         # CraveBot chat widget & in-chat ordering
│   │   └── evaluator.js       # Benchmark report & live response auditor
│   └── images/
│       ├── hero-banner.jpg    # Feast banner photography
│       ├── cravecraft-logo.jpg # Brand logo
│       └── cravebot-avatar.jpg # CraveBot AI mascot
└── templates/
    └── index.html             # Single-page application structure
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.8 or higher installed on your system.

### 2. Install Dependencies
```bash
python -m pip install -r requirements.txt
```

### 3. (Optional) Configure OpenAI API Key
If you wish to use OpenAI for CraveBot and the LLM Evaluator, copy `.env.example` to `.env` and insert your key:
```bash
cp .env.example .env
```
Edit `.env`:
```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
PORT=5000
```
> **Note:** If no key is set, the application automatically uses the built-in Smart Local Heuristic Engine and Rule-Based Evaluator demo. Everything works 100% out of the box!

### 4. Run Integration Tests
Verify all API endpoints, menu loading, chatbot responses, and evaluation logic:
```bash
python test_server.py
```

### 5. Launch the Server
```bash
python app.py
```
Open your browser and navigate to:
**[http://127.0.0.1:5000](https://cravecraft-smart-food-ordering.onrender.com/)**

---

## 🧪 Testing the Core Features

1. **Menu Browsing & Search:** Type *"Truffle"* or *"Biryani"* in the search input to see instant filtering.
2. **Dietary Toggles:** Click `🟢 Veg Only` to view only pure vegetarian dishes; click `Under ₹300` to see budget bites.
3. **Add to Cart:** Click `Add +` on any dish. Observe the quantity stepper and cart badge increment.
4. **Cart Drawer & Coupons:** Open the cart drawer via the top-right button. Enter coupon `CRAVE50` to see the ₹50 discount applied.
5. **Simulate Checkout:** Click *Proceed to Checkout*, enter delivery details, and click *Place Order Now* to view the generated Order ID and live preparation tracker.
6. **Chat with CraveBot:** Click the floating bot icon in the bottom right corner. Click the prompt pill *"Dinner for 2 under ₹800"*. Observe the item breakdown, pricing, and click the in-chat `Add +` button to add recommended dishes directly to your cart!
7. **Evaluate Response:** Click the `⚡ Evaluate Response` button on any CraveBot reply to view the modal breakdown of Relevance, Factual Consistency, and Clarity with scores from 1 to 5.
8. **Live Evaluation Playground:** Scroll down to the *AI Response Quality & Evaluation Engine* section to view the benchmark report or test custom prompts in the live auditor playground.
