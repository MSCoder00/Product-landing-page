/**
 * MS Skincare - Animations Module
 * PRD & Aesthetics Specs:
 * - Staggered hero entrance (headline, subhead, rating, buttons: 100ms stagger)
 * - Main hero image fade & scale-in (0.96 to 1)
 * - IntersectionObserver scroll reveals (fade up 24px, 500ms ease-out, 80ms sibling stagger)
 * - Header blur & shadow at 50px scroll
 * - Thin scroll-progress bar (2px) synced with page scroll
 * - Animated number counters (1.5s easeOutCubic)
 * - Review star distribution bars fill from 0% on reveal
 * - Strict prefers-reduced-motion compliance
 */

export function initAnimations() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Hero / Page Load Entrance (600ms, 100ms stagger)
  const heroEntranceElements = document.querySelectorAll('.hero-entrance');
  const heroImageWrapper = document.querySelector('.hero__image-wrapper');

  if (prefersReducedMotion) {
    heroEntranceElements.forEach(el => {
      el.classList.add('is-visible');
      el.classList.add('is-revealed');
    });
    if (heroImageWrapper) {
      heroImageWrapper.classList.add('is-visible');
      heroImageWrapper.classList.add('is-revealed');
    }
  } else {
    // Staggered hero entrance
    setTimeout(() => {
      heroEntranceElements.forEach((el, index) => {
        setTimeout(() => {
          el.classList.add('is-visible');
          el.classList.add('is-revealed');
        }, index * 100);
      });

      // Main product image fades and scales in from 0.96 to 1
      if (heroImageWrapper) {
        setTimeout(() => {
          heroImageWrapper.classList.add('is-visible');
          heroImageWrapper.classList.add('is-revealed');
        }, 200);
      }
    }, 80);
  }

  // 2. IntersectionObserver for Scroll Reveals (fade up 24px, 500ms, 80ms sibling stagger)
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  if (revealElements.length > 0) {
    if (prefersReducedMotion) {
      revealElements.forEach(el => {
        el.classList.add('is-visible');
        el.classList.add('is-revealed');
      });
    } else {
      const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            // Calculate sibling stagger if inside a grid/row container
            const siblings = Array.from(el.parentElement?.children || []).filter(c => c.classList.contains('reveal-on-scroll'));
            const siblingIndex = siblings.indexOf(el);
            const staggerDelay = siblingIndex > 0 ? siblingIndex * 80 : 0;

            setTimeout(() => {
              el.classList.add('is-visible');
              el.classList.add('is-revealed');
            }, staggerDelay);

            observer.unobserve(el);
          }
        });
      }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
      });

      revealElements.forEach(el => revealObserver.observe(el));
    }
  }

  // 3. Animated Number Counters (1.5s easeOutCubic)
  const counterElements = document.querySelectorAll('[data-counter-target]');
  if (counterElements.length > 0) {
    const counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.counterTarget, 10);
          const suffix = el.dataset.counterSuffix || '%';
          
          if (prefersReducedMotion) {
            el.textContent = `${target}${suffix}`;
          } else {
            animateCounter(el, target, suffix, 1500);
          }
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.25 });

    counterElements.forEach(el => counterObserver.observe(el));
  }

  // 4. Rating Star Distribution Bars Reveal (animate from 0 to width)
  const starBars = document.querySelectorAll('.star-bar-fill');
  if (starBars.length > 0) {
    const barObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          starBars.forEach(bar => {
            const pct = bar.dataset.percentage;
            bar.style.width = `${pct}%`;
          });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    const aggregateBox = document.querySelector('.reviews-aggregate-box');
    if (aggregateBox) {
      barObserver.observe(aggregateBox);
    }
  }

  // 5. Header Scroll Blur & 2px Scroll-Progress Bar
  const siteHeader = document.querySelector('.site-header');
  const progressBar = document.getElementById('scroll-progress-bar');

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrollY = window.scrollY;

        // Translucent blur & shadow after 50px scroll
        if (siteHeader) {
          if (scrollY > 50) {
            siteHeader.classList.add('is-scrolled');
          } else {
            siteHeader.classList.remove('is-scrolled');
          }
        }

        // Thin scroll-progress bar (2px)
        if (progressBar) {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          if (maxScroll > 0) {
            const progress = Math.min(100, Math.max(0, (scrollY / maxScroll) * 100));
            progressBar.style.width = `${progress}%`;
          }
        }

        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/**
 * Helper to animate numbers smoothly using cubic easing
 */
function animateCounter(element, target, suffix, duration) {
  let startTimestamp = null;
  const start = 0;

  function step(timestamp) {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    
    // Smooth easeOutCubic
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(easeProgress * (target - start) + start);

    element.textContent = `${current}${suffix}`;

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.textContent = `${target}${suffix}`;
    }
  }

  window.requestAnimationFrame(step);
}
