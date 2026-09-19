const menuButton = document.querySelector('[data-menu-button]');
const navDrawer = document.querySelector('[data-nav-drawer]');
const cookieBanner = document.querySelector('[data-cookie-banner]');
const cookieAccept = document.querySelector('[data-cookie-accept]');
const cookieDecline = document.querySelector('[data-cookie-decline]');
const RELEASE_POPUP_KEY = 'seanmosikili-release-popup-dismissed';

const closeMenu = () => {
  if (!menuButton || !navDrawer) {
    return;
  }

  navDrawer.classList.remove('is-open');
  menuButton.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
};

const toggleMenu = () => {
  if (!menuButton || !navDrawer) {
    return;
  }

  const isOpen = navDrawer.classList.toggle('is-open');
  menuButton.classList.toggle('is-open', isOpen);
  menuButton.setAttribute('aria-expanded', String(isOpen));
  document.body.classList.toggle('menu-open', isOpen);
};

if (menuButton && navDrawer) {
  menuButton.addEventListener('click', toggleMenu);

  document.addEventListener('click', (event) => {
    if (!navDrawer.contains(event.target) && !menuButton.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });
}

if (!localStorage.getItem(RELEASE_POPUP_KEY)) {
  const popup = document.createElement('aside');
  popup.className = 'release-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-live', 'polite');
  popup.innerHTML = `
    <button class="release-popup-close" type="button" aria-label="Close popup" data-release-popup-dismiss>×</button>
    <p class="release-popup-copy">LOST LOVER'S AVENUE, the debut album by SĒAN MOSIKILI, drops Friday, 12 June 2026. Join the pre-save waitlist now.</p>
    <div class="release-popup-actions">
      <a class="release-popup-button" href="https://seanwxrld.com/releases/#lost-lovers-avenue" target="_blank" rel="noopener noreferrer">READ NOTES</a>
      <a class="release-popup-button" href="https://seanwxrld.com/presave" target="_blank" rel="noopener noreferrer">PRE-SAVE</a>
    </div>
  `;

  document.body.appendChild(popup);

  const dismissButton = popup.querySelector('[data-release-popup-dismiss]');
  if (dismissButton) {
    dismissButton.addEventListener('click', () => {
      localStorage.setItem(RELEASE_POPUP_KEY, 'true');
      popup.remove();
    });
  }
}

const storeRoot = document.querySelector('[data-store-root]');
const storeShell = document.querySelector('[data-store-shell]');
const storeGate = document.querySelector('[data-store-gate]');
const storeForm = document.querySelector('[data-store-form]');
const storePasswordInput = document.querySelector('[data-store-password]');
const storeStatus = document.querySelector('[data-store-status]');
const STORE_PASSWORD_KEY = 'seanmosikili-store-access';
const STORE_PASSWORD_VALUE = 'FRAGILE-EXHIBITION';

const unlockStore = () => {
  if (!storeShell) {
    return;
  }

  storeShell.classList.remove('is-locked');
  storeShell.classList.add('is-unlocked');
  storeShell.setAttribute('aria-hidden', 'false');

  if (storeGate) {
    storeGate.classList.add('hidden');
  }

  if (storeRoot) {
    storeRoot.dataset.storeUnlocked = 'true';
  }
};

const lockStore = () => {
  if (!storeShell) {
    return;
  }

  storeShell.classList.add('is-locked');
  storeShell.classList.remove('is-unlocked');
  storeShell.setAttribute('aria-hidden', 'true');
};

const setStoreStatus = (message, statusType = 'pending') => {
  if (!storeStatus) {
    return;
  }

  storeStatus.textContent = message;
  storeStatus.dataset.statusType = statusType;
};

const hasStoreAccess = sessionStorage.getItem(STORE_PASSWORD_KEY) === 'granted';
if (storeShell && hasStoreAccess) {
  unlockStore();
} else if (storeShell) {
  lockStore();
}

if (storeForm) {
  storeForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!storePasswordInput) {
      return;
    }

    const enteredPassword = storePasswordInput.value.trim();
    if (enteredPassword === STORE_PASSWORD_VALUE) {
      sessionStorage.setItem(STORE_PASSWORD_KEY, 'granted');
      unlockStore();
      setStoreStatus('Access granted. Welcome inside the official store preview.', 'success');
      storeForm.reset();
      return;
    }

    sessionStorage.removeItem(STORE_PASSWORD_KEY);
    lockStore();
    setStoreStatus('Incorrect password. Please try again.', 'error');
  });
}

const COOKIE_KEY = 'seanmosikili-cookie-consent';

const getCookieValue = (name) => {
  const prefixed = `; ${document.cookie}`;
  const parts = prefixed.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null;
};

const setCookieValue = (name, value, days) => {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
};

const hasCookieConsent = getCookieValue(COOKIE_KEY) || localStorage.getItem(COOKIE_KEY);
if (cookieBanner && !hasCookieConsent) {
  cookieBanner.classList.remove('hidden');
}

const handleCookieChoice = (value) => {
  localStorage.setItem(COOKIE_KEY, value);
  setCookieValue(COOKIE_KEY, value, 365);
  if (cookieBanner) {
    cookieBanner.classList.add('hidden');
  }
};

if (cookieAccept) {
  cookieAccept.addEventListener('click', () => handleCookieChoice('accepted'));
}

if (cookieDecline) {
  cookieDecline.addEventListener('click', () => handleCookieChoice('declined'));
}

const setFormStatus = (form, message, statusType = 'pending') => {
  const statusEl = form.querySelector('[data-form-status]');
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.dataset.statusType = statusType;
};

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach((el) => {
    el.classList.add('is-visible');
  });
}


const countdownEl = document.querySelector('[data-countdown]');
if (countdownEl) {
  const target = new Date(countdownEl.dataset.countdownTarget).getTime();
  const d = countdownEl.querySelector('[data-days]');
  const h = countdownEl.querySelector('[data-hours]');
  const m = countdownEl.querySelector('[data-minutes]');
  const sec = countdownEl.querySelector('[data-seconds]');
  const pad = (n) => String(n).padStart(2, '0');
  const tick = () => {
    const diff = Math.max(0, target - Date.now());
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (d) d.textContent = pad(days);
    if (h) h.textContent = pad(hours);
    if (m) m.textContent = pad(minutes);
    if (sec) sec.textContent = pad(seconds);
  };
  tick();
  setInterval(tick, 1000);
}
