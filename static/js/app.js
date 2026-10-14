/**
 * CraveCraft — Core Frontend Application Logic
 * Menu rendering, filtering, searching, add-to-cart, drawer, and checkout.
 */

// Global State
const CraveState = {
  menuItems: [],
  categories: [],
  cart: {}, // { [dishId]: { item, quantity } }
  activeCategory: 'all',
  activeDietFilter: 'all',
  searchQuery: '',
  activeSort: 'recommended',
  coupon: null, // { code: 'CRAVE50', discount: 50 }
  serverStatus: null
};

// Utilities
function formatINR(val) {
  return '₹' + Number(val).toLocaleString('en-IN');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Fetch Menu Data from Backend
async function initApp() {
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();
    if (data.success) {
      CraveState.menuItems = data.items;
      CraveState.categories = data.categories;

      renderCategoryTabs();
      filterAndRenderMenu();
    } else {
      showToast('Could not load menu items', 'error');
    }

    // Check system status
    fetchStatus();
  } catch (err) {
    console.error('Failed to init app:', err);
    showToast('Network error loading menu', 'error');
  }

  setupEventListeners();
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.success) {
      CraveState.serverStatus = data;
      const botLabel = document.getElementById('botEngineLabel');
      if (botLabel) {
        botLabel.textContent = data.openai_configured ? `OpenAI (${data.model || 'Live'})` : 'Smart Menu AI (Demo / Offline Mode)';
      }
      const evalTag = document.getElementById('liveEvalEngineTag');
      if (evalTag) {
        evalTag.textContent = data.openai_configured ? `OpenAI LLM-as-a-Judge (${data.model || 'Active'})` : 'Rule-Based Evaluator (Demo / Offline Mode)';
      }
    }
  } catch (e) {
    console.warn('Status fetch skipped:', e);
  }
}

// Render Category Tabs
function renderCategoryTabs() {
  const container = document.getElementById('categoryTabsContainer');
  if (!container) return;

  container.innerHTML = CraveState.categories.map(cat => {
    const count = cat.id === 'all' 
      ? CraveState.menuItems.length 
      : CraveState.menuItems.filter(i => i.category === cat.id).length;

    const isActive = cat.id === CraveState.activeCategory ? 'active' : '';
    return `
      <button type="button" class="category-tab ${isActive}" data-category="${cat.id}">
        <span>${cat.icon}</span>
        <span>${cat.name}</span>
        <span class="category-count-badge">${count}</span>
      </button>
    `;
  }).join('');

  // Attach tab events
  container.querySelectorAll('.category-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      CraveState.activeCategory = btn.getAttribute('data-category');
      filterAndRenderMenu();
    });
  });
}

// Filter, Sort and Render Menu Cards
function filterAndRenderMenu() {
  const grid = document.getElementById('menuGrid');
  if (!grid) return;

  let items = [...CraveState.menuItems];

  // 1. Category Filter
  if (CraveState.activeCategory !== 'all') {
    items = items.filter(item => item.category === CraveState.activeCategory);
  }

  // 2. Dietary / Quick Filter
  switch (CraveState.activeDietFilter) {
    case 'veg':
      items = items.filter(i => i.is_veg);
      break;
    case 'nonveg':
      items = items.filter(i => !i.is_veg);
      break;
    case 'spicy':
      items = items.filter(i => i.spice_index >= 2);
      break;
    case 'special':
      items = items.filter(i => i.dietary.some(d => d.toLowerCase().includes('special') || d.toLowerCase().includes('bestseller')));
      break;
    case 'budget':
      items = items.filter(i => i.price <= 300);
      break;
  }

  // 3. Search Query
  if (CraveState.searchQuery) {
    const q = CraveState.searchQuery.toLowerCase().trim();
    items = items.filter(i => {
      const nameMatch = i.name.toLowerCase().includes(q);
      const descMatch = i.description.toLowerCase().includes(q);
      const catMatch = i.category_name.toLowerCase().includes(q);
      const ingMatch = i.ingredients.some(ing => ing.toLowerCase().includes(q));
      return nameMatch || descMatch || catMatch || ingMatch;
    });
  }

  // 4. Sort
  switch (CraveState.activeSort) {
    case 'price-asc':
      items.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      items.sort((a, b) => b.price - a.price);
      break;
    case 'rating-desc':
      items.sort((a, b) => b.rating - a.rating);
      break;
    case 'recommended':
    default:
      items.sort((a, b) => (b.rating * b.reviews_count) - (a.rating * a.reviews_count));
      break;
  }

  // Render Grid
  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-menu-state">
        <div class="empty-icon">🍽️</div>
        <h3>No CraveCraft dishes found</h3>
        <p>Try clearing your search or switching filters to see more delicious choices.</p>
        <button type="button" class="btn-secondary" id="btnResetFilters">Reset All Filters</button>
      </div>
    `;
    const resetBtn = document.getElementById('btnResetFilters');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetAllFilters);
    }
    return;
  }

  grid.innerHTML = items.map(item => renderFoodCard(item)).join('');

  // Re-attach card button listeners
  attachCardListeners();
}

function renderFoodCard(item) {
  const cartEntry = CraveState.cart[item.id];
  const qty = cartEntry ? cartEntry.quantity : 0;
  const dietBadgeClass = item.is_veg ? 'veg' : 'nonveg';
  const spiceIcon = '🌶️'.repeat(Math.max(1, item.spice_index));

  // Primary tag pill
  const firstTag = item.dietary && item.dietary[0] ? item.dietary[0] : item.category_name;

  return `
    <article class="food-card" data-id="${item.id}">
      <div class="food-card-media">
        <img src="${item.image}" alt="${item.name}" class="food-card-img" loading="lazy" onerror="this.src='/static/images/hero-banner.jpg'">
        <div class="diet-badge ${dietBadgeClass}" title="${item.is_veg ? 'Pure Vegetarian' : 'Non-Vegetarian'}"></div>
        <div class="card-tag-pills">
          <span class="tag-pill">${firstTag}</span>
        </div>
      </div>

      <div class="food-card-body">
        <div class="card-header-row">
          <h3 class="dish-title">${item.name}</h3>
          <span class="dish-price">${formatINR(item.price)}</span>
        </div>

        <div class="dish-meta-row">
          <span class="meta-rating">★ ${item.rating} <span style="color:var(--text-muted);font-weight:400;">(${item.reviews_count})</span></span>
          <span>•</span>
          <span class="meta-spice" title="Spice level: ${item.spice_level}">${spiceIcon} ${item.spice_level}</span>
          <span>•</span>
          <span>⏱️ ${item.prep_time}</span>
        </div>

        <p class="dish-desc">${item.description}</p>

        <div class="dish-taste-box">
          <strong>Notes:</strong> ${item.taste_profile}
        </div>

        <div class="food-card-footer">
          <button type="button" class="btn-ask-cravebot" data-ask="${item.name}" title="Ask CraveBot about this dish">
            <span>🤖 Ask Bot</span>
          </button>

          <div class="cart-action-container" data-container-id="${item.id}">
            ${qty > 0 ? `
              <div class="stepper-box">
                <button type="button" class="stepper-btn btn-stepper-minus" data-id="${item.id}">−</button>
                <span class="stepper-count">${qty}</span>
                <button type="button" class="stepper-btn btn-stepper-plus" data-id="${item.id}">+</button>
              </div>
            ` : `
              <button type="button" class="btn-add-cart" data-id="${item.id}">
                <span>Add +</span>
              </button>
            `}
          </div>
        </div>
      </div>
    </article>
  `;
}

function attachCardListeners() {
  // Add to cart buttons
  document.querySelectorAll('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      addToCart(id);
    });
  });

  // Stepper plus buttons
  document.querySelectorAll('.btn-stepper-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      changeQuantity(id, 1);
    });
  });

  // Stepper minus buttons
  document.querySelectorAll('.btn-stepper-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      changeQuantity(id, -1);
    });
  });

  // Ask CraveBot buttons
  document.querySelectorAll('.btn-ask-cravebot').forEach(btn => {
    btn.addEventListener('click', () => {
      const dishName = btn.getAttribute('data-ask');
      if (window.CraveChat) {
        window.CraveChat.openWithPrompt(`Tell me more about ${dishName}. What makes it special and what should I pair it with?`);
      }
    });
  });
}

// Cart Operations
function addToCart(dishId) {
  const item = CraveState.menuItems.find(i => i.id === dishId);
  if (!item) return;

  if (CraveState.cart[dishId]) {
    CraveState.cart[dishId].quantity += 1;
  } else {
    CraveState.cart[dishId] = { item, quantity: 1 };
  }

  updateCartUI();
  updateCardActionState(dishId);
  showToast(`Added ${item.name} to cart!`, 'success');
}

function changeQuantity(dishId, delta) {
  if (!CraveState.cart[dishId]) return;

  CraveState.cart[dishId].quantity += delta;
  if (CraveState.cart[dishId].quantity <= 0) {
    delete CraveState.cart[dishId];
    showToast('Item removed from cart', 'info');
  }

  updateCartUI();
  updateCardActionState(dishId);
}

function updateCardActionState(dishId) {
  const container = document.querySelector(`.cart-action-container[data-container-id="${dishId}"]`);
  if (!container) return;

  const cartEntry = CraveState.cart[dishId];
  const qty = cartEntry ? cartEntry.quantity : 0;

  if (qty > 0) {
    container.innerHTML = `
      <div class="stepper-box">
        <button type="button" class="stepper-btn btn-stepper-minus" data-id="${dishId}">−</button>
        <span class="stepper-count">${qty}</span>
        <button type="button" class="stepper-btn btn-stepper-plus" data-id="${dishId}">+</button>
      </div>
    `;
    container.querySelector('.btn-stepper-minus').addEventListener('click', () => changeQuantity(dishId, -1));
    container.querySelector('.btn-stepper-plus').addEventListener('click', () => changeQuantity(dishId, 1));
  } else {
    container.innerHTML = `
      <button type="button" class="btn-add-cart" data-id="${dishId}">
        <span>Add +</span>
      </button>
    `;
    container.querySelector('.btn-add-cart').addEventListener('click', () => addToCart(dishId));
  }
}

function calculateCartTotals() {
  const items = Object.values(CraveState.cart);
  const totalCount = items.reduce((sum, entry) => sum + entry.quantity, 0);
  const subtotal = items.reduce((sum, entry) => sum + (entry.item.price * entry.quantity), 0);

  const deliveryFee = subtotal === 0 ? 0 : (subtotal >= 499 ? 0 : 40);
  const taxes = subtotal === 0 ? 0 : Math.round(subtotal * 0.05);

  let discount = 0;
  if (CraveState.coupon) {
    if (CraveState.coupon.code === 'CRAVE50' && subtotal >= 300) {
      discount = 50;
    } else if (CraveState.coupon.code === 'FEAST100' && subtotal >= 600) {
      discount = 100;
    }
  }

  const grandTotal = Math.max(0, subtotal + deliveryFee + taxes - discount);

  return { totalCount, subtotal, deliveryFee, taxes, discount, grandTotal };
}

function updateCartUI() {
  const { totalCount, subtotal, deliveryFee, taxes, discount, grandTotal } = calculateCartTotals();

  // Header Nav updates
  const navCount = document.getElementById('cartNavCount');
  const navTotal = document.getElementById('cartNavTotal');
  if (navCount) navCount.textContent = totalCount;
  if (navTotal) navTotal.textContent = formatINR(subtotal);

  // Cart Drawer counter
  const drawerCount = document.getElementById('cartDrawerCount');
  if (drawerCount) drawerCount.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;

  // Drawer Bill breakdown
  const billSubtotal = document.getElementById('billSubtotal');
  const billDelivery = document.getElementById('billDelivery');
  const billTaxes = document.getElementById('billTaxes');
  const billDiscountRow = document.getElementById('billDiscountRow');
  const billDiscount = document.getElementById('billDiscount');
  const billTotal = document.getElementById('billTotal');
  const freeHint = document.getElementById('freeDeliveryHint');

  if (billSubtotal) billSubtotal.textContent = formatINR(subtotal);
  if (billDelivery) billDelivery.textContent = deliveryFee === 0 ? (subtotal >= 499 ? 'FREE' : '₹0') : formatINR(deliveryFee);
  if (freeHint) freeHint.style.display = subtotal >= 499 ? 'inline' : 'inline';
  if (billTaxes) billTaxes.textContent = formatINR(taxes);

  if (discount > 0) {
    if (billDiscountRow) billDiscountRow.style.display = 'flex';
    if (billDiscount) billDiscount.textContent = `-${formatINR(discount)}`;
  } else {
    if (billDiscountRow) billDiscountRow.style.display = 'none';
  }

  if (billTotal) billTotal.textContent = formatINR(grandTotal);

  // Render items in drawer
  renderCartDrawerItems();
}

function renderCartDrawerItems() {
  const container = document.getElementById('cartItemsList');
  if (!container) return;

  const entries = Object.values(CraveState.cart);
  if (entries.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
        <div style="font-size: 2.8rem; margin-bottom: 12px;">🛒</div>
        <h4 style="color: var(--text-primary); margin-bottom: 6px;">Your CraveCraft Cart is Empty</h4>
        <p style="font-size: 0.85rem;">Add some mouth-watering kebabs, biryanis, or curries to get started!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map(({ item, quantity }) => {
    const dietIcon = item.is_veg ? '🟢' : '🔴';
    const itemTotal = item.price * quantity;

    return `
      <div class="cart-item-card" data-id="${item.id}">
        <img src="${item.image}" alt="${item.name}" class="cart-item-img" onerror="this.src='/static/images/hero-banner.jpg'">
        <div class="cart-item-info">
          <div class="cart-item-name">${dietIcon} ${item.name}</div>
          <div class="cart-item-unit-price">${formatINR(item.price)} each</div>
        </div>
        <div class="cart-item-controls">
          <span class="cart-item-subtotal">${formatINR(itemTotal)}</span>
          <div class="stepper-box" style="transform: scale(0.9); transform-origin: right center;">
            <button type="button" class="stepper-btn btn-drawer-minus" data-id="${item.id}">−</button>
            <span class="stepper-count">${quantity}</span>
            <button type="button" class="stepper-btn btn-drawer-plus" data-id="${item.id}">+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Drawer stepper listeners
  container.querySelectorAll('.btn-drawer-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      changeQuantity(id, 1);
    });
  });

  container.querySelectorAll('.btn-drawer-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      changeQuantity(id, -1);
    });
  });
}

// Drawer Visibility
function openCartDrawer() {
  const overlay = document.getElementById('cartOverlay');
  if (overlay) overlay.classList.add('open');
}

function closeCartDrawer() {
  const overlay = document.getElementById('cartOverlay');
  if (overlay) overlay.classList.remove('open');
}

// Coupon Handling
function applyCoupon() {
  const input = document.getElementById('promoInput');
  const notice = document.getElementById('promoNotice');
  if (!input) return;

  const code = input.value.trim().toUpperCase();
  const { subtotal } = calculateCartTotals();

  if (!code) {
    showToast('Please enter a coupon code', 'error');
    return;
  }

  if (code === 'CRAVE50') {
    if (subtotal < 300) {
      notice.innerHTML = `<span style="color:#ef4444;font-size:0.75rem;">Add items worth ₹${300 - subtotal} more to use CRAVE50</span>`;
      return;
    }
    CraveState.coupon = { code: 'CRAVE50', discount: 50 };
    notice.innerHTML = `<div class="promo-tag-applied"><span>🎉 CRAVE50 Applied (₹50 OFF)</span><button onclick="removeCoupon()" style="background:none;border:none;color:#ef4444;cursor:pointer;">✕</button></div>`;
    showToast('Coupon CRAVE50 applied successfully! ₹50 OFF', 'success');
  } else if (code === 'FEAST100') {
    if (subtotal < 600) {
      notice.innerHTML = `<span style="color:#ef4444;font-size:0.75rem;">Add items worth ₹${600 - subtotal} more to use FEAST100</span>`;
      return;
    }
    CraveState.coupon = { code: 'FEAST100', discount: 100 };
    notice.innerHTML = `<div class="promo-tag-applied"><span>🎉 FEAST100 Applied (₹100 OFF)</span><button onclick="removeCoupon()" style="background:none;border:none;color:#ef4444;cursor:pointer;">✕</button></div>`;
    showToast('Coupon FEAST100 applied successfully! ₹100 OFF', 'success');
  } else {
    notice.innerHTML = `<span style="color:#ef4444;font-size:0.75rem;">Invalid coupon code. Try CRAVE50 or FEAST100</span>`;
  }

  updateCartUI();
}

window.removeCoupon = function() {
  CraveState.coupon = null;
  const notice = document.getElementById('promoNotice');
  const input = document.getElementById('promoInput');
  if (notice) notice.innerHTML = '';
  if (input) input.value = '';
  updateCartUI();
  showToast('Coupon removed', 'info');
};

// Checkout Modal
function openCheckoutModal() {
  const { totalCount, grandTotal } = calculateCartTotals();
  if (totalCount === 0) {
    showToast('Your cart is empty. Add dishes first!', 'error');
    return;
  }

  closeCartDrawer();
  const overlay = document.getElementById('checkoutModalOverlay');
  const payable = document.getElementById('modalPayableTotal');
  const form = document.getElementById('checkoutForm');
  const receipt = document.getElementById('receiptView');
  const heading = document.getElementById('modalHeading');

  if (payable) payable.textContent = formatINR(grandTotal);
  if (form) form.style.display = 'flex';
  if (receipt) receipt.style.display = 'none';
  if (heading) heading.textContent = 'Complete Your CraveCraft Order';
  if (overlay) overlay.classList.add('open');
}

function closeCheckoutModal() {
  const overlay = document.getElementById('checkoutModalOverlay');
  if (overlay) overlay.classList.remove('open');
}

async function handleOrderSubmission(e) {
  e.preventDefault();
  const btn = document.getElementById('btnPlaceOrder');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Cooking Order... 🍳</span>';
  }

  const { grandTotal, discount } = calculateCartTotals();
  const items = Object.values(CraveState.cart).map(c => ({
    id: c.item.id,
    name: c.item.name,
    price: c.item.price,
    quantity: c.quantity
  }));

  const payload = {
    name: document.getElementById('custName').value,
    phone: document.getElementById('custPhone').value,
    address: document.getElementById('custAddress').value,
    payment_method: document.querySelector('input[name="paymentMethod"]:checked')?.value || 'UPI',
    discount: discount,
    items: items
  };

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      // Clear Cart
      CraveState.cart = {};
      CraveState.coupon = null;
      updateCartUI();
      document.querySelectorAll('.cart-action-container').forEach(c => {
        const id = c.getAttribute('data-container-id');
        if (id) updateCardActionState(id);
      });

      // Show Receipt Screen
      displayReceipt(data);
    } else {
      showToast(data.error || 'Failed to place order', 'error');
    }
  } catch (err) {
    showToast('Network error processing checkout', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>Place Order Now 🚀</span>';
    }
  }
}

function displayReceipt(order) {
  const form = document.getElementById('checkoutForm');
  const receipt = document.getElementById('receiptView');
  const heading = document.getElementById('modalHeading');

  if (form) form.style.display = 'none';
  if (heading) heading.textContent = 'Order Receipt & Tracking';
  if (receipt) receipt.style.display = 'block';

  document.getElementById('receiptOrderId').textContent = `Order ID: ${order.order_id}`;
  document.getElementById('receiptEta').textContent = `${order.eta_mins} Minutes`;
  document.getElementById('receiptAddress').textContent = order.customer.address;
  document.getElementById('receiptPayment').textContent = order.payment_method;

  const itemsSummary = document.getElementById('receiptItemsSummary');
  if (itemsSummary) {
    itemsSummary.innerHTML = order.items.map(it => `
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.85rem;">
        <span>${it.quantity}x ${it.name}</span>
        <strong>${formatINR(it.price * it.quantity)}</strong>
      </div>
    `).join('') + `
      <div style="display:flex;justify-content:space-between;padding-top:8px;margin-top:6px;border-top:1px dashed var(--border-subtle);font-size:0.95rem;font-weight:700;">
        <span>Grand Total Paid:</span>
        <span style="color:var(--accent-primary);">${formatINR(order.totals.grand_total)}</span>
      </div>
    `;
  }
}

// Reset Filters
function resetAllFilters() {
  CraveState.activeCategory = 'all';
  CraveState.activeDietFilter = 'all';
  CraveState.searchQuery = '';
  CraveState.activeSort = 'recommended';

  const searchInput = document.getElementById('menuSearchInput');
  const searchClear = document.getElementById('menuSearchClear');
  if (searchInput) searchInput.value = '';
  if (searchClear) searchClear.classList.remove('visible');

  const sortSelect = document.getElementById('menuSortSelect');
  if (sortSelect) sortSelect.value = 'recommended';

  document.querySelectorAll('.dietary-pill').forEach(b => b.classList.remove('active'));
  const allPill = document.querySelector('.dietary-pill[data-filter="all"]');
  if (allPill) allPill.classList.add('active');

  renderCategoryTabs();
  filterAndRenderMenu();
}

// Event Listeners Setup
function setupEventListeners() {
  // Cart Nav Trigger
  const btnOpenCart = document.getElementById('btnOpenCart');
  if (btnOpenCart) btnOpenCart.addEventListener('click', openCartDrawer);

  const btnCloseCart = document.getElementById('btnCloseCart');
  if (btnCloseCart) btnCloseCart.addEventListener('click', closeCartDrawer);

  const cartOverlay = document.getElementById('cartOverlay');
  if (cartOverlay) {
    cartOverlay.addEventListener('click', (e) => {
      if (e.target === cartOverlay) closeCartDrawer();
    });
  }

  // Checkout Triggers
  const btnProceedCheckout = document.getElementById('btnProceedCheckout');
  if (btnProceedCheckout) btnProceedCheckout.addEventListener('click', openCheckoutModal);

  const btnCloseModal = document.getElementById('btnCloseModal');
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeCheckoutModal);

  const checkoutOverlay = document.getElementById('checkoutModalOverlay');
  if (checkoutOverlay) {
    checkoutOverlay.addEventListener('click', (e) => {
      if (e.target === checkoutOverlay) closeCheckoutModal();
    });
  }

  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) checkoutForm.addEventListener('submit', handleOrderSubmission);

  const btnContinue = document.getElementById('btnContinueShopping');
  if (btnContinue) {
    btnContinue.addEventListener('click', () => {
      closeCheckoutModal();
      window.location.hash = '#menuSection';
    });
  }

  // Promo coupon
  const btnApplyPromo = document.getElementById('btnApplyPromo');
  if (btnApplyPromo) btnApplyPromo.addEventListener('click', applyCoupon);

  // Search input with instant filtering
  const searchInput = document.getElementById('menuSearchInput');
  const searchClear = document.getElementById('menuSearchClear');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      CraveState.searchQuery = e.target.value;
      if (searchClear) {
        if (e.target.value.length > 0) searchClear.classList.add('visible');
        else searchClear.classList.remove('visible');
      }
      filterAndRenderMenu();
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      CraveState.searchQuery = '';
      searchClear.classList.remove('visible');
      filterAndRenderMenu();
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('menuSortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      CraveState.activeSort = e.target.value;
      filterAndRenderMenu();
    });
  }

  // Dietary filter pills
  document.querySelectorAll('.dietary-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dietary-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      CraveState.activeDietFilter = btn.getAttribute('data-filter');
      filterAndRenderMenu();
    });
  });

  // Hero Bot trigger
  const heroBtnAskBot = document.getElementById('heroBtnAskBot');
  if (heroBtnAskBot) {
    heroBtnAskBot.addEventListener('click', () => {
      if (window.CraveChat) window.CraveChat.toggleBot(true);
    });
  }

  // Benchmark navigation button
  const btnOpenBenchmarkNav = document.getElementById('btnOpenBenchmarkNav');
  if (btnOpenBenchmarkNav) {
    btnOpenBenchmarkNav.addEventListener('click', () => {
      const section = document.getElementById('evaluatorSection');
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    });
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initApp);

// Export for other scripts
window.CraveApp = {
  addToCart,
  openCartDrawer,
  showToast,
  formatINR
};
