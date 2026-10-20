/**
 * MS Skincare - Gallery & Interactive Slider Module
 * PRD Specs: Image gallery thumbnail switcher with crossfade,
 * hover zoom magnifier, and fully accessible touch/mouse/keyboard Before/After slider.
 */

export function initProductGallery() {
  const mainImage = document.getElementById('gallery-main-img');
  const mainView = document.getElementById('gallery-main-view');
  const thumbButtons = document.querySelectorAll('.gallery-thumb-btn');

  if (!mainImage || !mainView || thumbButtons.length === 0) return;

  // Thumbnail crossfade switcher
  thumbButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const newSrc = btn.dataset.imageSrc;
      const newAlt = btn.dataset.imageAlt || mainImage.alt;

      if (!newSrc || btn.classList.contains('is-active')) return;

      thumbButtons.forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });

      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');

      // Crossfade animation
      mainImage.style.opacity = '0';
      setTimeout(() => {
        mainImage.src = newSrc;
        mainImage.alt = newAlt;
        mainImage.style.opacity = '1';
      }, 150);
    });
  });

  // Hover zoom lens effect on desktop
  mainView.addEventListener('mousemove', (e) => {
    const rect = mainView.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    mainImage.style.transformOrigin = `${x}% ${y}%`;
  });

  mainView.addEventListener('mouseleave', () => {
    mainImage.style.transformOrigin = 'center center';
  });
}

/**
 * Before / After Image Slider Controller
 * Supports mouse drag, touch swipe, and WCAG keyboard arrow control.
 */
export function initBeforeAfterSlider() {
  const container = document.getElementById('ba-slider');
  const afterLayer = document.getElementById('ba-after-layer');
  const handle = document.getElementById('ba-handle');

  if (!container || !afterLayer || !handle) return;

  let isDragging = false;
  let currentPercentage = 50;

  function updateSlider(percentage) {
    const clamped = Math.max(0, Math.min(100, percentage));
    currentPercentage = clamped;

    requestAnimationFrame(() => {
      afterLayer.style.clipPath = `polygon(0 0, ${clamped}% 0, ${clamped}% 100%, 0 100%)`;
      handle.style.left = `${clamped}%`;
      handle.setAttribute('aria-valuenow', Math.round(clamped));
    });
  }

  function getPercentageFromEvent(e) {
    const rect = container.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const offsetX = clientX - rect.left;
    return (offsetX / rect.width) * 100;
  }

  // Mouse Listeners
  const onMouseDown = (e) => {
    isDragging = true;
    container.classList.add('is-dragging');
    updateSlider(getPercentageFromEvent(e));
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    updateSlider(getPercentageFromEvent(e));
  };

  const onMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      container.classList.remove('is-dragging');
    }
  };

  // Touch Listeners
  const onTouchStart = (e) => {
    isDragging = true;
    container.classList.add('is-dragging');
    updateSlider(getPercentageFromEvent(e));
  };

  const onTouchMove = (e) => {
    if (!isDragging) return;
    updateSlider(getPercentageFromEvent(e));
  };

  const onTouchEnd = () => {
    isDragging = false;
    container.classList.remove('is-dragging');
  };

  // Keyboard Navigation (WCAG 2.1 AA)
  const onKeyDown = (e) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      updateSlider(currentPercentage - step);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      updateSlider(currentPercentage + step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      updateSlider(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      updateSlider(100);
    }
  };

  handle.addEventListener('mousedown', onMouseDown);
  container.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  handle.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd);

  handle.addEventListener('keydown', onKeyDown);

  // Initial position
  updateSlider(50);
}
