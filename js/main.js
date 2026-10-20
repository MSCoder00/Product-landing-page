/**
 * MS Skincare - Main Entry Point
 * PRD Specs: Initializes all modules, sets up analytics dataLayer,
 * tracks scroll depth (25, 50, 75, 100), handles CTA tracking.
 */

import { cart, CartDrawerUI } from './cart.js';
import { initProductGallery, initBeforeAfterSlider } from './gallery.js';
import { initAnimations } from './animations.js';
import {
  initAnnouncementBar,
  initMobileNav,
  initAccordions,
  initPurchaseModule,
  initIngredientsSpotlight,
  initReviewsSection,
  initStickyBuyBar,
  initNewsletter
} from './ui.js';

// Setup dataLayer for GA4 / Meta / Shopify Analytics
window.dataLayer = window.dataLayer || [];

function trackEvent(name, payload = {}) {
  window.dataLayer.push({
    event: name,
    timestamp: new Date().toISOString(),
    ...payload
  });
}

// Track Scroll Depth Milestones (25%, 50%, 75%, 100%)
function setupScrollDepthTracking() {
  const milestones = [25, 50, 75, 100];
  const reached = new Set();

  window.addEventListener('scroll', () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollHeight <= 0) return;

    const currentPercentage = Math.round((window.scrollY / scrollHeight) * 100);

    milestones.forEach(m => {
      if (currentPercentage >= m && !reached.has(m)) {
        reached.add(m);
        trackEvent('scroll_depth', { depth: m });
      }
    });
  }, { passive: true });
}

// Track CTA Button clicks with location tags
function setupCtaTracking() {
  document.querySelectorAll('[data-cta-location]').forEach(btn => {
    btn.addEventListener('click', () => {
      trackEvent('cta_click', {
        location: btn.dataset.ctaLocation,
        text: btn.textContent.trim()
      });
    });
  });
}

// Dynamic Estimated Delivery Date Calculation
function setupDeliveryEstimate() {
  const deliveryEl = document.getElementById('delivery-date-text');
  if (!deliveryEl) return;

  const now = new Date();
  const deliveryDate = new Date();
  deliveryDate.setDate(now.getDate() + 3);

  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  const formattedDate = deliveryDate.toLocaleDateString('en-US', options);

  deliveryEl.textContent = `Order within 3 hrs for estimated delivery by ${formattedDate}`;
}

// Initialize Application
async function initApp() {
  // 1. Initial Page View
  trackEvent('page_view', { page_title: 'AURA 15% Vitamin C + E + Ferulic Radiance Serum' });

  // 2. Fetch or load data files
  let productData = null;
  let reviewsData = null;

  try {
    const [prodRes, revRes] = await Promise.all([
      fetch('data/products.json'),
      fetch('data/reviews.json')
    ]);
    if (prodRes.ok) productData = await prodRes.json();
    if (revRes.ok) reviewsData = await revRes.json();
  } catch (err) {
    console.warn('Direct fetch failed (likely local file:// protocol), using embedded fallback state:', err);
  }

  // Fallback defaults if opened directly as file:// or fetch fails
  if (!productData) {
    productData = {
      id: "ms-c-radiance-serum",
      title: "AURA 15% Vitamin C + E + Ferulic Radiance Serum",
      rating: 4.92,
      reviewCount: 1482,
      subscriptionDiscountPercent: 15,
      variants: [
        { id: "ms-c-15ml", name: "Discovery Size", size: "15ml / 0.5 fl oz", supply: "3-week supply", price: 38.00, compareAtPrice: 48.00 },
        { id: "ms-c-30ml", name: "Standard Size", size: "30ml / 1.0 fl oz", supply: "2-month supply", price: 68.00, compareAtPrice: 85.00, isDefault: true },
        { id: "ms-c-50ml", name: "Luxury Jumbo", size: "50ml / 1.7 fl oz", supply: "3.5-month supply", price: 98.00, compareAtPrice: 135.00 }
      ]
    };
  }

  // 3. Initialize Core UI & Interactions
  const cartDrawer = new CartDrawerUI(cart);
  initProductGallery();
  initBeforeAfterSlider();
  initAnimations();
  initAnnouncementBar();
  initMobileNav();
  initAccordions();
  initPurchaseModule(productData, cartDrawer);
  initIngredientsSpotlight();
  if (reviewsData) {
    initReviewsSection(reviewsData);
  }
  initStickyBuyBar();
  initNewsletter();
  setupScrollDepthTracking();
  setupCtaTracking();
  setupDeliveryEstimate();
}

// Boot on DOM Ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
