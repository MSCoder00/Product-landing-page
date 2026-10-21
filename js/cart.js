/**
 * MS Skincare - Cart Module
 * PRD Specs: Isolated state, localStorage with in-memory fallback,
 * pub/sub event bus, free shipping tier calculator, Shopify adapter pattern.
 */

const STORAGE_KEY = 'ms_skincare_cart_v1';
const FREE_SHIPPING_THRESHOLD = 50.00;

class CartStore {
  constructor() {
    this.subscribers = new Set();
    this.items = this.loadCart();
  }

  // Safe localStorage with memory fallback
  loadCart() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('LocalStorage unavailable, using in-memory store:', e);
    }
    // Default initial cart state (empty or pre-populated)
    return [];
  }

  saveCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch (e) {
      console.warn('LocalStorage write failed:', e);
    }
    this.notify();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getState());
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const state = this.getState();
    this.subscribers.forEach(cb => {
      try {
        cb(state);
      } catch (err) {
        console.error('Cart subscriber error:', err);
      }
    });
  }

  getState() {
    const itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const originalTotal = this.items.reduce((sum, item) => sum + ((item.compareAtPrice || item.price) * item.quantity), 0);
    const savings = Math.max(0, originalTotal - subtotal);
    const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
    const freeShippingPercent = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

    return {
      items: [...this.items],
      itemCount,
      subtotal,
      savings,
      amountToFreeShipping,
      freeShippingPercent,
      hasFreeShipping: subtotal >= FREE_SHIPPING_THRESHOLD
    };
  }

  addItem(product) {
    // product: { id, title, variantId, variantName, price, compareAtPrice, isSubscription, image, quantity }
    const existingIndex = this.items.findIndex(item => 
      item.variantId === product.variantId && item.isSubscription === product.isSubscription
    );

    if (existingIndex > -1) {
      this.items[existingIndex].quantity = Math.min(10, this.items[existingIndex].quantity + (product.quantity || 1));
    } else {
      this.items.push({
        ...product,
        quantity: Math.min(10, Math.max(1, product.quantity || 1))
      });
    }

    this.saveCart();

    // Emit analytics event
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'add_to_cart',
        ecommerce: {
          items: [{
            item_name: product.title,
            item_variant: product.variantName,
            price: product.price,
            quantity: product.quantity || 1
          }]
        }
      });
    }
  }

  updateQuantity(variantId, isSubscription, newQty) {
    const item = this.items.find(i => i.variantId === variantId && i.isSubscription === isSubscription);
    if (!item) return;

    if (newQty <= 0) {
      this.removeItem(variantId, isSubscription);
    } else {
      item.quantity = Math.min(10, newQty);
      this.saveCart();
    }
  }

  removeItem(variantId, isSubscription) {
    this.items = this.items.filter(i => !(i.variantId === variantId && i.isSubscription === isSubscription));
    this.saveCart();
  }

  clear() {
    this.items = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('LocalStorage remove failed:', e);
    }
    this.notify();
  }
}

export const cart = new CartStore();

// Cart Drawer UI Controller
export class CartDrawerUI {
  constructor(cartInstance) {
    this.cart = cartInstance;
    this.backdrop = document.getElementById('cart-backdrop');
    this.drawer = document.getElementById('cart-drawer');
    this.closeBtn = document.getElementById('cart-drawer-close');
    this.itemsContainer = document.getElementById('cart-items-container');
    this.subtotalEl = document.getElementById('cart-subtotal');
    this.shippingTextEl = document.getElementById('shipping-tier-text');
    this.shippingFillEl = document.getElementById('shipping-tier-fill');
    this.cartCountPills = document.querySelectorAll('.cart-count-pill');
    this.checkoutBtn = document.getElementById('cart-checkout-btn');
    this.previouslyFocusedElement = null;

    // Order Success Modal elements
    this.orderSuccessBackdrop = document.getElementById('order-success-backdrop');
    this.orderSuccessModal = document.getElementById('order-success-modal');
    this.orderSuccessCloseBtn = document.getElementById('order-success-close-btn');
    this.orderSuccessContinueBtn = document.getElementById('order-success-continue-btn');
    this.orderSuccessNumber = document.getElementById('order-success-number');
    this.orderSuccessItems = document.getElementById('order-success-items');
    this.orderSuccessTotal = document.getElementById('order-success-total');
    this.orderSuccessLiveRegion = document.getElementById('order-success-live-region');

    this.init();
  }

  init() {
    if (!this.backdrop || !this.drawer) return;

    // Cart Open Triggers
    document.querySelectorAll('[data-open-cart]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
    });

    // Close Button & Backdrop
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.close();
      }
    });

    // Order Success Modal Close Events
    if (this.orderSuccessCloseBtn) {
      this.orderSuccessCloseBtn.addEventListener('click', () => this.closeOrderSuccess());
    }

    if (this.orderSuccessContinueBtn) {
      this.orderSuccessContinueBtn.addEventListener('click', () => this.closeOrderSuccess());
    }

    if (this.orderSuccessBackdrop) {
      this.orderSuccessBackdrop.addEventListener('click', (e) => {
        if (e.target === this.orderSuccessBackdrop) {
          this.closeOrderSuccess();
        }
      });
    }

    // Keyboard handlers (Escape & Focus Trap)
    document.addEventListener('keydown', (e) => {
      // 1. Order Success Modal handling
      if (this.isOrderSuccessOpen()) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeOrderSuccess();
          return;
        }

        if (e.key === 'Tab' && this.orderSuccessModal) {
          const focusable = this.orderSuccessModal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
              if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
              }
            } else {
              if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }
        return;
      }

      // 2. Cart Drawer Escape
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    // Checkout Button
    if (this.checkoutBtn) {
      this.checkoutBtn.addEventListener('click', () => {
        const state = this.cart.getState();
        if (state.itemCount === 0) {
          this.checkoutBtn.classList.remove('btn--shake');
          void this.checkoutBtn.offsetWidth;
          this.checkoutBtn.classList.add('btn--shake');
          setTimeout(() => {
            this.checkoutBtn.classList.remove('btn--shake');
          }, 500);
          return;
        }

        // Show loading state
        const originalContent = this.checkoutBtn.innerHTML;
        this.checkoutBtn.classList.add('btn--loading');
        this.checkoutBtn.disabled = true;
        this.checkoutBtn.innerHTML = `
          <span class="btn-spinner" aria-hidden="true"></span>
          <span>Processing...</span>
        `;

        if (window.dataLayer) {
          window.dataLayer.push({
            event: 'begin_checkout',
            ecommerce: {
              value: state.subtotal,
              items: state.items
            }
          });
        }

        // Simulate 1s checkout processing then open popup
        setTimeout(() => {
          this.checkoutBtn.classList.remove('btn--loading');
          this.checkoutBtn.disabled = false;
          this.checkoutBtn.innerHTML = originalContent;

          // Open Order Success Modal with cart snapshot
          this.openOrderSuccess(state);

          // Clear cart
          this.cart.clear();
        }, 1000);
      });
    }

    // Subscribe to cart updates
    this.cart.subscribe(this.render.bind(this));
  }

  isOpen() {
    return this.backdrop.classList.contains('is-open');
  }

  isOrderSuccessOpen() {
    return this.orderSuccessBackdrop && this.orderSuccessBackdrop.classList.contains('is-open');
  }

  open() {
    this.previouslyFocusedElement = document.activeElement;
    this.backdrop.classList.add('is-open');
    this.drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Focus close button for accessibility
    setTimeout(() => {
      if (this.closeBtn) this.closeBtn.focus();
    }, 100);

    if (window.dataLayer) {
      window.dataLayer.push({ event: 'open_cart' });
    }
  }

  close() {
    this.backdrop.classList.remove('is-open');
    this.drawer.setAttribute('aria-hidden', 'true');
    if (!this.isOrderSuccessOpen()) {
      document.body.style.overflow = '';
    }

    if (this.previouslyFocusedElement && !this.isOrderSuccessOpen()) {
      this.previouslyFocusedElement.focus();
    }
  }

  openOrderSuccess(state) {
    if (!this.orderSuccessBackdrop || !this.orderSuccessModal) return;

    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const orderNumberStr = `Order #MS-${randomDigits}`;

    if (this.orderSuccessNumber) {
      this.orderSuccessNumber.textContent = orderNumberStr;
    }

    if (this.orderSuccessItems) {
      this.orderSuccessItems.innerHTML = state.items.map(item => `
        <div class="order-success-item-row">
          <span class="order-success-item-name">${item.title} (${item.variantName}) × ${item.quantity}</span>
          <span class="order-success-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
        </div>
      `).join('');
    }

    if (this.orderSuccessTotal) {
      this.orderSuccessTotal.textContent = `$${state.subtotal.toFixed(2)}`;
    }

    if (this.orderSuccessLiveRegion) {
      this.orderSuccessLiveRegion.textContent = `Order successful! ${orderNumberStr} placed for $${state.subtotal.toFixed(2)}.`;
    }

    // Smoothly close cart drawer
    this.close();

    // Open success modal
    this.previouslyFocusedElement = document.activeElement;
    this.orderSuccessBackdrop.classList.add('is-open');
    this.orderSuccessBackdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Move focus into modal
    setTimeout(() => {
      if (this.orderSuccessContinueBtn) {
        this.orderSuccessContinueBtn.focus();
      } else if (this.orderSuccessModal) {
        this.orderSuccessModal.focus();
      }
    }, 100);

    // Light confetti burst
    this.launchConfetti();

    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'purchase',
        ecommerce: {
          transaction_id: `MS-${randomDigits}`,
          value: state.subtotal,
          items: state.items
        }
      });
    }
  }

  closeOrderSuccess() {
    if (!this.orderSuccessBackdrop) return;
    this.orderSuccessBackdrop.classList.remove('is-open');
    this.orderSuccessBackdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    // Return focus to page
    if (this.previouslyFocusedElement && typeof this.previouslyFocusedElement.focus === 'function') {
      this.previouslyFocusedElement.focus();
    }

    // Scroll to top of product section
    const productSection = document.getElementById('purchase-module') || document.querySelector('.product-section');
    if (productSection) {
      productSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  launchConfetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'order-confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const colors = ['#b8833e', '#d4af37', '#16a34a', '#10b981', '#f59e0b', '#141413'];
    const particles = [];
    const count = 42;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: width * 0.5 + (Math.random() - 0.5) * 140,
        y: height * 0.45 + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 7,
        vy: Math.random() * -5 - 3,
        size: Math.random() * 5 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10
      });
    }

    const startTime = performance.now();
    const duration = 1500;

    function render(now) {
      const elapsed = now - startTime;
      if (elapsed > duration) {
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      const progress = elapsed / duration;
      const alpha = progress > 0.65 ? 1 - (progress - 0.65) / 0.35 : 1;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22;
        p.vx *= 0.985;
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }


  render(state) {
    // 1. Update Count Pills in header with bounce animation
    this.cartCountPills.forEach(pill => {
      const prevCount = parseInt(pill.textContent, 10) || 0;
      pill.textContent = state.itemCount;
      pill.style.display = state.itemCount > 0 ? 'flex' : 'none';
      if (state.itemCount !== prevCount) {
        pill.classList.remove('cart-pill-bounce');
        void pill.offsetWidth;
        pill.classList.add('cart-pill-bounce');
      }
    });

    // 2. Free Shipping Progress
    if (this.shippingTextEl && this.shippingFillEl) {
      if (state.hasFreeShipping) {
        this.shippingTextEl.innerHTML = '✨ <strong>Free Express Shipping</strong> unlocked!';
        this.shippingFillEl.style.width = '100%';
      } else {
        this.shippingTextEl.innerHTML = `Add <strong>$${state.amountToFreeShipping.toFixed(2)}</strong> more for <strong>Free Express Shipping</strong>`;
        this.shippingFillEl.style.width = `${state.freeShippingPercent}%`;
      }
    }

    // 3. Subtotal
    if (this.subtotalEl) {
      this.subtotalEl.textContent = `$${state.subtotal.toFixed(2)}`;
    }

    // 4. Items List
    if (!this.itemsContainer) return;

    if (state.items.length === 0) {
      this.itemsContainer.innerHTML = `
        <div class="cart-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 01-8 0"></path>
          </svg>
          <p style="font-size: var(--text-base); font-weight: 600; color: var(--color-text-main);">Your radiant cart is empty</p>
          <p style="font-size: var(--text-xs); color: var(--color-text-subtle);">Discover the transformative glow of AURA 15% Vitamin C.</p>
          <button class="btn btn-primary btn-sm" id="empty-cart-shop-btn" style="min-height: 42px; margin-top: 0.5rem;">
            Explore Formula
          </button>
        </div>
      `;
      const shopBtn = document.getElementById('empty-cart-shop-btn');
      if (shopBtn) {
        shopBtn.addEventListener('click', () => {
          this.close();
          const target = document.getElementById('purchase-module');
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
      }
      return;
    }

    this.itemsContainer.innerHTML = `
      <div class="cart-items-list">
        ${state.items.map(item => `
          <div class="cart-item" data-variant-id="${item.variantId}" data-subscription="${item.isSubscription}">
            <img class="cart-item__image" src="${item.image || 'assets/hero_product.jpg'}" alt="${item.title}">
            <div class="cart-item__details">
              <h4 class="cart-item__title">${item.title}</h4>
              <span class="cart-item__meta">${item.variantName} ${item.isSubscription ? '• Auto-Delivery (15% Off)' : '• One-Time'}</span>
              <span class="cart-item__price">$${(item.price * item.quantity).toFixed(2)}</span>
              <div class="cart-item__actions">
                <div class="qty-stepper" style="height: 34px;">
                  <button class="qty-btn" data-cart-minus aria-label="Decrease quantity">−</button>
                  <span class="qty-input" style="width: 28px; line-height: 34px; font-size: 13px;">${item.quantity}</span>
                  <button class="qty-btn" data-cart-plus aria-label="Increase quantity">+</button>
                </div>
                <button class="cart-item__remove" data-cart-remove>Remove</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Bind item buttons
    this.itemsContainer.querySelectorAll('.cart-item').forEach(itemEl => {
      const variantId = itemEl.dataset.variantId;
      const isSubscription = itemEl.dataset.subscription === 'true';
      const item = state.items.find(i => i.variantId === variantId && i.isSubscription === isSubscription);
      if (!item) return;

      const minusBtn = itemEl.querySelector('[data-cart-minus]');
      const plusBtn = itemEl.querySelector('[data-cart-plus]');
      const removeBtn = itemEl.querySelector('[data-cart-remove]');

      if (minusBtn) {
        minusBtn.addEventListener('click', () => {
          this.cart.updateQuantity(variantId, isSubscription, item.quantity - 1);
        });
      }

      if (plusBtn) {
        plusBtn.addEventListener('click', () => {
          this.cart.updateQuantity(variantId, isSubscription, item.quantity + 1);
        });
      }

      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          this.cart.removeItem(variantId, isSubscription);
        });
      }
    });
  }
}
