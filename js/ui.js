/**
 * MS Skincare - UI Components & Interactive Modules
 * PRD Specs: Announcement bar rotation, accessible accordions,
 * variant selector & purchase plan sync, ingredient spotlight tabs,
 * review carousel & JSON load-more, newsletter validation, and sticky buy bar.
 */

import { cart } from './cart.js';

/**
 * Announcement Bar Rotation & Dismiss
 */
export function initAnnouncementBar() {
  const bar = document.getElementById('announcement-bar');
  const messages = document.querySelectorAll('.announcement-bar__message');
  const closeBtn = document.getElementById('announcement-close');

  if (!bar || messages.length === 0) return;

  let currentIndex = 0;
  let intervalId = null;
  let isPaused = false;

  function showNextMessage() {
    if (isPaused) return;
    messages[currentIndex].classList.remove('is-active');
    currentIndex = (currentIndex + 1) % messages.length;
    messages[currentIndex].classList.add('is-active');
  }

  function startRotation() {
    intervalId = setInterval(showNextMessage, 4000);
  }

  function stopRotation() {
    clearInterval(intervalId);
  }

  bar.addEventListener('mouseenter', () => { isPaused = true; });
  bar.addEventListener('mouseleave', () => { isPaused = false; });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      stopRotation();
      bar.classList.add('is-hidden');
    });
  }

  startRotation();
}

/**
 * Mobile Navigation Drawer
 */
export function initMobileNav() {
  const openBtn = document.getElementById('mobile-menu-open');
  const drawer = document.getElementById('mobile-nav-drawer');
  const closeBtn = document.getElementById('mobile-nav-close');
  const navLinks = document.querySelectorAll('.mobile-nav-link');

  if (!openBtn || !drawer) return;

  const openDrawer = () => {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus();
  };

  const closeDrawer = () => {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    openBtn.focus();
  };

  openBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

  drawer.addEventListener('click', (e) => {
    if (e.target === drawer) closeDrawer();
  });

  navLinks.forEach(link => {
    link.addEventListener('click', closeDrawer);
  });
}

/**
 * Accessible Accordions (PRD 65, 82, 121, 182)
 */
export function initAccordions() {
  const accordions = document.querySelectorAll('.accordion');

  accordions.forEach(acc => {
    const triggers = acc.querySelectorAll('.accordion-trigger');

    triggers.forEach(trigger => {
      trigger.addEventListener('click', () => {
        const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
        const panelId = trigger.getAttribute('aria-controls');
        const panel = document.getElementById(panelId);

        if (!panel) return;

        // If one open at a time within group
        if (!isExpanded && acc.dataset.singleOpen === 'true') {
          triggers.forEach(otherTrigger => {
            if (otherTrigger !== trigger) {
              otherTrigger.setAttribute('aria-expanded', 'false');
              const otherPanel = document.getElementById(otherTrigger.getAttribute('aria-controls'));
              if (otherPanel) otherPanel.style.maxHeight = null;
            }
          });
        }

        if (isExpanded) {
          trigger.setAttribute('aria-expanded', 'false');
          panel.style.maxHeight = null;
        } else {
          trigger.setAttribute('aria-expanded', 'true');
          panel.style.maxHeight = panel.scrollHeight + 'px';

          // Emit analytics event
          if (window.dataLayer) {
            window.dataLayer.push({
              event: 'faq_expand',
              question: trigger.textContent.trim()
            });
          }
        }
      });
    });
  });
}

/**
 * Product Purchase Controller: Variants, Subscriptions, Pricing & Stepper
 */
export function initPurchaseModule(productData, cartDrawerUI) {
  if (!productData) return;

  const variantCards = document.querySelectorAll('.variant-card');
  const planRadios = document.querySelectorAll('input[name="purchase-plan"]');
  const planOptions = document.querySelectorAll('.plan-option');

  const currentPriceEl = document.getElementById('product-price');
  const comparePriceEl = document.getElementById('product-compare-price');
  const savingsBadgeEl = document.getElementById('product-savings-badge');
  const variantLabelEl = document.getElementById('selected-variant-label');
  const qtyInput   = document.getElementById('product-qty-input');
  const qtyMinus   = document.getElementById('product-qty-minus');
  const qtyPlus    = document.getElementById('product-qty-plus');
  const addToCartBtn = document.getElementById('product-add-to-cart');

  // Sticky Buy Bar elements
  const stickyNameEl  = document.getElementById('sticky-bar-name');
  const stickyPriceEl = document.getElementById('sticky-bar-price');
  const stickyAddBtn  = document.getElementById('sticky-bar-add-btn');

  let selectedVariant = productData.variants.find(v => v.isDefault) || productData.variants[1];
  let isSubscription = false;
  let quantity = 1;

  // ─── Currency formatter ────────────────────────────────────────────────────
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Single source of truth for pricing (all math in integer cents) ────────
  function getPricing({ variant, purchaseType, qty }) {
    const DISCOUNT       = productData.subscriptionDiscountPercent || 15;
    const unitCents      = Math.round(variant.price * 100);
    const compareUnitCents = Math.round(variant.compareAtPrice * 100);

    // subscription price rounds per-unit then multiplies by qty
    const rawUnitCents = purchaseType === 'subscription'
      ? Math.round(unitCents * (1 - DISCOUNT / 100))
      : unitCents;

    const totalCents         = rawUnitCents * qty;
    const originalTotalCents = unitCents    * qty;   // one-time total for strikethrough
    const savingsCents       = originalTotalCents - totalCents;

    // badge savings are always compare-at vs one-time unit (static per-unit info)
    const unitSavingsCents = compareUnitCents - unitCents;
    const savingsPct       = Math.round((unitSavingsCents / compareUnitCents) * 100);

    return { unitCents: rawUnitCents, totalCents, originalTotalCents, savingsCents,
             compareUnitCents, unitSavingsCents, savingsPct };
  }

  // ─── Single render function – updates every price surface ─────────────────
  function updatePriceUI() {
    const p = getPricing({
      variant:      selectedVariant,
      purchaseType: isSubscription ? 'subscription' : 'onetime',
      qty:          quantity
    });

    const totalStr  = fmt.format(p.totalCents / 100);
    const unitStr   = fmt.format(p.unitCents  / 100);

    // Quick fade animation (respects prefers-reduced-motion)
    function pulse(el) {
      if (!el || reducedMotion) return;
      el.classList.remove('price-pulse');
      void el.offsetWidth; // force reflow
      el.classList.add('price-pulse');
    }

    // 1. Header price / compare / badge
    if (currentPriceEl) { pulse(currentPriceEl); currentPriceEl.textContent = totalStr; }
    if (comparePriceEl) {
      comparePriceEl.textContent = fmt.format((p.compareUnitCents * quantity) / 100);
    }
    if (savingsBadgeEl) {
      savingsBadgeEl.textContent =
        `Save ${p.savingsPct}% (${fmt.format(p.unitSavingsCents / 100)})`;
    }
    if (variantLabelEl) {
      variantLabelEl.textContent = `${selectedVariant.size} (${selectedVariant.supply})`;
    }

    // 2. Plan-option card prices
    const oneTimePriceEl = document.getElementById('plan-price-onetime');
    const subPriceEl     = document.getElementById('plan-price-sub');
    const subCompareEl   = document.getElementById('plan-compare-sub');

    const DISC            = productData.subscriptionDiscountPercent || 15;
    const oneTimeTotalC   = Math.round(selectedVariant.price * 100) * quantity;
    const subUnitC        = Math.round(Math.round(selectedVariant.price * 100) * (1 - DISC / 100));
    const subTotalC       = subUnitC * quantity;

    if (oneTimePriceEl) { pulse(oneTimePriceEl); oneTimePriceEl.textContent = fmt.format(oneTimeTotalC / 100); }
    if (subPriceEl)     { pulse(subPriceEl);     subPriceEl.textContent     = fmt.format(subTotalC     / 100); }
    if (subCompareEl)   { subCompareEl.textContent = fmt.format(oneTimeTotalC / 100); }

    // 3. "ADD TO BAG • $X" button price preview
    const addPricePreview = document.getElementById('add-to-cart-price-preview');
    if (addPricePreview) { pulse(addPricePreview); addPricePreview.textContent = totalStr; }

    // 4. Sticky bar
    if (stickyNameEl)  stickyNameEl.textContent = `AURA 15% Vitamin C (${selectedVariant.size})`;
    if (stickyPriceEl) { pulse(stickyPriceEl); stickyPriceEl.textContent = totalStr; }

    // 5. Final CTA price in guarantee section
    const finalPriceEl = document.getElementById('final-cta-price');
    if (finalPriceEl) finalPriceEl.textContent = totalStr;

    // 6. Unit-price hint visible only when qty > 1
    const unitEachEl = document.getElementById('unit-price-each');
    if (unitEachEl) {
      if (quantity > 1) {
        unitEachEl.textContent  = `${unitStr} each`;
        unitEachEl.style.display = 'inline';
      } else {
        unitEachEl.style.display = 'none';
      }
    }

    // 7. Quantity-button disabled states
    if (qtyMinus) qtyMinus.disabled = quantity <= 1;
    if (qtyPlus)  qtyPlus.disabled  = quantity >= 10;

    // 8. Aria-live for screen readers
    const liveRegion = document.getElementById('price-live-region');
    if (liveRegion) {
      liveRegion.textContent =
        `Total ${totalStr} for ${quantity} item${quantity !== 1 ? 's' : ''}`;
    }
  }

  // ─── Variant click handlers ────────────────────────────────────────────────
  variantCards.forEach(card => {
    card.addEventListener('click', () => {
      const variantId = card.dataset.variantId;
      const found = productData.variants.find(v => v.id === variantId);
      if (!found) return;

      variantCards.forEach(c => c.classList.remove('is-selected'));
      card.classList.add('is-selected');
      selectedVariant = found;
      updatePriceUI();

      if (window.dataLayer) {
        window.dataLayer.push({
          event: 'select_variant',
          variant_id: variantId,
          variant_name: found.name,
          price: found.price
        });
      }
    });
  });

  // ─── Purchase plan selection ───────────────────────────────────────────────
  planRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      isSubscription = e.target.value === 'subscription';
      planOptions.forEach(opt => opt.classList.remove('is-selected'));
      const parentOption = radio.closest('.plan-option');
      if (parentOption) parentOption.classList.add('is-selected');
      updatePriceUI();
    });
  });

  // ─── Quantity stepper ─────────────────────────────────────────────────────
  function clampQty(val) {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n < 1) return 1;
    if (n > 10) return 10;
    return n;
  }

  function setQty(val) {
    quantity = clampQty(val);
    if (qtyInput) qtyInput.value = quantity;
    updatePriceUI();
  }

  if (qtyMinus && qtyPlus && qtyInput) {
    qtyMinus.addEventListener('click',  () => setQty(quantity - 1));
    qtyPlus.addEventListener('click',   () => setQty(quantity + 1));
    qtyInput.addEventListener('input',  () => setQty(qtyInput.value)); // per keystroke
    qtyInput.addEventListener('change', () => setQty(qtyInput.value)); // on blur / Enter
  }

  // ─── Add To Cart ──────────────────────────────────────────────────────────
  function handleAddToCart(btnElement) {
    if (!btnElement) return;

    btnElement.classList.add('is-loading');
    btnElement.disabled = true;

    const unitPrice = isSubscription
      ? selectedVariant.price * (1 - (productData.subscriptionDiscountPercent / 100))
      : selectedVariant.price;

    setTimeout(() => {
      cart.addItem({
        id:            productData.id,
        title:         productData.title,
        variantId:     selectedVariant.id,
        variantName:   `${selectedVariant.name} - ${selectedVariant.size}`,
        price:         unitPrice,
        compareAtPrice: selectedVariant.compareAtPrice,
        isSubscription: isSubscription,
        image:         'assets/hero_product.jpg',
        quantity:      quantity
      });

      btnElement.classList.remove('is-loading');
      btnElement.classList.add('is-success');

      const originalText = btnElement.querySelector('.btn__text');
      const prevText = originalText ? originalText.textContent : '';
      if (originalText) originalText.textContent = '✓ Added to Bag';

      if (cartDrawerUI) cartDrawerUI.open();

      showToast(`Added ${quantity}x ${selectedVariant.size} to your bag!`);

      setTimeout(() => {
        btnElement.classList.remove('is-success');
        btnElement.disabled = false;
        if (originalText) originalText.textContent = prevText;
        // Reset quantity to 1 after adding
        setQty(1);
      }, 1500);
    }, 450);
  }

  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', (e) => { e.preventDefault(); handleAddToCart(addToCartBtn); });
  }
  if (stickyAddBtn) {
    stickyAddBtn.addEventListener('click', (e) => { e.preventDefault(); handleAddToCart(stickyAddBtn); });
  }

  const finalCtaBtn = document.getElementById('final-add-to-cart');
  if (finalCtaBtn) {
    finalCtaBtn.addEventListener('click', (e) => { e.preventDefault(); handleAddToCart(finalCtaBtn); });
  }

  // Initialize prices on load
  updatePriceUI();
}


/**
 * Interactive Ingredients Spotlight (PRD 7.7)
 */
export function initIngredientsSpotlight() {
  const chips = document.querySelectorAll('.ingredient-chip');
  const nameEl = document.getElementById('active-ing-name');
  const pctEl = document.getElementById('active-ing-pct');
  const inciEl = document.getElementById('active-ing-inci');
  const descEl = document.getElementById('active-ing-desc');

  if (chips.length === 0 || !nameEl) return;

  const ingredientsData = {
    'l-ascorbic': {
      name: 'Stabilized L-Ascorbic Acid',
      pct: '15.0%',
      inci: 'Ascorbic Acid (Pure Bio-available Vitamin C)',
      desc: 'The purest, most clinically substantiated form of Vitamin C. Formulated at the optimal pH of 3.1 for deep dermal penetration. Neutralizes cell-damaging free radicals, stimulates natural pro-collagen synthesis, and halts excess melanin production at the enzymatic source.'
    },
    'vitamin-e': {
      name: 'Alpha-Tocopherol',
      pct: '1.0%',
      inci: 'd-Alpha-Tocopherol (Pure Plant-Derived Vitamin E)',
      desc: 'A lipid-soluble antioxidant that replenishes skin lipids and works in direct synergy with Vitamin C. When paired, Vitamin E multiplies the photoprotective efficacy of Vitamin C four-fold, preventing lipid peroxidation and reinforcing the cutaneous moisture barrier.'
    },
    'ferulic-acid': {
      name: 'Plant-Sourced Ferulic Acid',
      pct: '0.5%',
      inci: 'Ferulic Acid (Organic Rice Germ Extract)',
      desc: 'The biochemical stabilizer that holds the entire formula intact. Ferulic acid doubles the photoprotective power of Vitamins C and E while preventing formula oxidation. It also targets existing ultraviolet damage, fading hyperpigmentation and discoloration.'
    },
    'botanicals': {
      name: 'Kakadu Plum & Japanese Yuzu',
      pct: 'Complex',
      inci: 'Terminalia Ferdinandiana Fruit Extract & Citrus Junos Peel Extract',
      desc: 'Kakadu plum possesses the highest documented concentration of natural Vitamin C on Earth (55x that of oranges). Combined with cold-pressed Japanese Yuzu, it calms sensitive micro-capillaries, imparts an uplifting sensory experience, and provides deep dewy hydration.'
    }
  };

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => {
        c.classList.remove('is-active');
        c.setAttribute('aria-selected', 'false');
      });

      chip.classList.add('is-active');
      chip.setAttribute('aria-selected', 'true');

      const key = chip.dataset.ingredientKey;
      const data = ingredientsData[key];
      if (!data) return;

      nameEl.textContent = data.name;
      pctEl.textContent = data.pct;
      inciEl.textContent = data.inci;
      descEl.textContent = data.desc;
    });
  });
}

/**
 * Reviews Carousel & Load More (PRD 7.10)
 */
export function initReviewsSection(reviewsData) {
  const carousel = document.getElementById('reviews-carousel');
  const prevBtn = document.getElementById('review-prev-btn');
  const nextBtn = document.getElementById('review-next-btn');
  const loadMoreBtn = document.getElementById('load-more-reviews-btn');

  if (!carousel || !reviewsData) return;

  // Carousel Prev / Next Controls
  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      carousel.scrollBy({ left: -360, behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
      carousel.scrollBy({ left: 360, behavior: 'smooth' });
    });
  }

  // Mouse Drag-to-Scroll Support
  let isDown = false;
  let startX = 0;
  let scrollLeftPos = 0;

  carousel.addEventListener('mousedown', (e) => {
    isDown = true;
    carousel.classList.add('is-dragging');
    startX = e.pageX - carousel.offsetLeft;
    scrollLeftPos = carousel.scrollLeft;
  });

  carousel.addEventListener('mouseleave', () => {
    isDown = false;
    carousel.classList.remove('is-dragging');
  });

  carousel.addEventListener('mouseup', () => {
    isDown = false;
    carousel.classList.remove('is-dragging');
  });

  carousel.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - carousel.offsetLeft;
    const walk = (x - startX) * 1.5;
    carousel.scrollLeft = scrollLeftPos - walk;
  });

  // Load More Reviews Handler
  if (loadMoreBtn && reviewsData.reviews) {
    let currentlyRendered = 6;

    loadMoreBtn.addEventListener('click', () => {
      const nextBatch = reviewsData.reviews.slice(currentlyRendered, currentlyRendered + 4);
      if (nextBatch.length === 0) {
        loadMoreBtn.style.display = 'none';
        return;
      }

      nextBatch.forEach(rev => {
        const card = document.createElement('div');
        card.className = 'review-card';
        card.innerHTML = `
          <div class="review-header">
            <div>
              <div class="review-author">
                ${rev.author}
                ${rev.verified ? '<span class="verified-badge" title="Verified Buyer">✓</span>' : ''}
              </div>
              <span class="review-date">${rev.date}</span>
            </div>
            <div class="rating-stars">
              ${'★'.repeat(rev.rating)}${'☆'.repeat(5 - rev.rating)}
            </div>
          </div>
          <h4 class="review-title">${rev.title}</h4>
          <p class="review-content">${rev.content}</p>
          <div class="review-meta">
            Skin: <strong>${rev.skinType || 'All skin types'}</strong> • Size: ${rev.sizePurchased || '30ml'}
          </div>
        `;
        carousel.appendChild(card);
      });

      currentlyRendered += nextBatch.length;

      if (currentlyRendered >= reviewsData.reviews.length) {
        loadMoreBtn.textContent = 'All Reviews Loaded';
        loadMoreBtn.disabled = true;
      }

      if (window.dataLayer) {
        window.dataLayer.push({ event: 'review_load_more', count: currentlyRendered });
      }
    });
  }
}

/**
 * Sticky Mobile Buy Bar Observer (PRD 7.15)
 */
export function initStickyBuyBar() {
  const purchaseModule = document.getElementById('purchase-module');
  const stickyBar = document.getElementById('sticky-buy-bar');
  const footer = document.querySelector('.site-footer');

  if (!purchaseModule || !stickyBar) return;

  let isPurchaseVisible = true;
  let isFooterVisible = false;

  const updateBarVisibility = () => {
    if (!isPurchaseVisible && !isFooterVisible) {
      stickyBar.classList.add('is-visible');
    } else {
      stickyBar.classList.remove('is-visible');
    }
  };

  const purchaseObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      isPurchaseVisible = entry.isIntersecting;
      updateBarVisibility();
    });
  }, { threshold: 0.1 });

  purchaseObserver.observe(purchaseModule);

  if (footer) {
    const footerObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isFooterVisible = entry.isIntersecting;
        updateBarVisibility();
      });
    }, { threshold: 0 });

    footerObserver.observe(footer);
  }
}

/**
 * Newsletter Form Validation (PRD 7.14)
 */
export function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  const input = document.getElementById('newsletter-email');
  const feedback = document.getElementById('newsletter-feedback');

  if (!form || !input || !feedback) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = input.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      feedback.textContent = 'Please enter a valid email address.';
      feedback.className = 'newsletter-feedback is-error';
      input.focus();
      return;
    }

    feedback.textContent = '🎉 You\'re on the list! Use code RADIANCE10 for 10% off your order.';
    feedback.className = 'newsletter-feedback is-success';
    input.value = '';

    showToast('Promo code RADIANCE10 copied to clipboard!');

    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'newsletter_signup',
        user_email: email
      });
    }
  });
}

/**
 * Global Toast Helper
 */
export function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>✨</span><span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
