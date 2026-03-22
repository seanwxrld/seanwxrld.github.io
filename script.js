const menuButton = document.querySelector('[data-menu-button]');
const navDrawer = document.querySelector('[data-nav-drawer]');
const cookieBanner = document.querySelector('[data-cookie-banner]');
const cookieAccept = document.querySelector('[data-cookie-accept]');
const cookieDecline = document.querySelector('[data-cookie-decline]');
const contactForm = document.querySelector('[data-contact-form]');
const subscribeForms = document.querySelectorAll('[data-subscribe-form]');

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

const buildEmail = () => {
  const user = 'seanrunsthemedia';
  const domain = 'icloud.com';
  return `${user}@${domain}`;
};

const openMailClient = (form, subject) => {
  const formData = new FormData(form);
  const email = buildEmail();
  const name = formData.get('name') || '';
  const message = formData.get('message') || '';
  const interest = formData.get('interest') || '';
  const sender = formData.get('email') || '';
  const body = `Name: ${name}\nEmail: ${sender}\nInterest: ${interest}\n\n${message}`;
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
};

if (contactForm) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!contactForm.reportValidity()) {
      return;
    }

    setFormStatus(contactForm, 'Opening your email app…', 'pending');
    openMailClient(contactForm, 'Booking / Collaboration Request');
  });
}

const firebaseConfig = {
  apiKey: 'AIzaSyCg8ESTI4q5NSlzG_pm_5wZPNEdSqQR4kU',
  authDomain: 'sean-mosikili-official-website.firebaseapp.com',
  projectId: 'sean-mosikili-official-website',
  storageBucket: 'sean-mosikili-official-website.firebasestorage.app',
  messagingSenderId: '553905440133',
  appId: '1:553905440133:web:9ee90d720f3d45dce270ec',
  measurementId: 'G-67YTCJ2CSZ'
};

let firebaseDbPromise;

const getFirebaseDb = async () => {
  if (!firebaseDbPromise) {
    firebaseDbPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js')
    ]).then(([firebaseApp, firestore]) => {
      const app = firebaseApp.initializeApp(firebaseConfig);
      return {
        addDoc: firestore.addDoc,
        collection: firestore.collection,
        db: firestore.getFirestore(app),
        serverTimestamp: firestore.serverTimestamp
      };
    });
  }

  return firebaseDbPromise;
};

subscribeForms.forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const originalLabel = form.dataset.submitLabel || (submitButton ? submitButton.textContent : 'Submit');
    const formData = new FormData(form);
    const email = (formData.get('email') || '').toString().trim().toLowerCase();
    const interest = (formData.get('interest') || '').toString().trim();

    if (!email || !email.includes('@')) {
      setFormStatus(form, 'Please enter a valid email address.', 'error');
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Saving...';
    }
    setFormStatus(form, 'Saving your signup...', 'pending');

    try {
      const firebase = await getFirebaseDb();
      await firebase.addDoc(firebase.collection(firebase.db, 'newsletter_signups'), {
        email,
        interest,
        source: form.dataset.source || 'unknown',
        page: window.location.pathname,
        createdAt: firebase.serverTimestamp()
      });

      form.reset();
      setFormStatus(form, 'You are in. Welcome to the SWARM.', 'success');
    } catch (error) {
      console.error('Newsletter signup failed', error);
      setFormStatus(form, 'Signup failed. Please try again in a moment.', 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    }
  });
});

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
