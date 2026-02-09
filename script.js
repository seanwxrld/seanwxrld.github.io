const menuButton = document.querySelector('[data-menu-button]');
const navDrawer = document.querySelector('[data-nav-drawer]');
const cookieBanner = document.querySelector('[data-cookie-banner]');
const cookieAccept = document.querySelector('[data-cookie-accept]');
const cookieDecline = document.querySelector('[data-cookie-decline]');
const contactForm = document.querySelector('[data-contact-form]');
const subscribeForm = document.querySelector('[data-subscribe-form]');

const toggleMenu = () => {
  const isOpen = navDrawer.classList.toggle('is-open');
  menuButton.classList.toggle('is-open', isOpen);
  menuButton.setAttribute('aria-expanded', String(isOpen));
};

if (menuButton && navDrawer) {
  menuButton.addEventListener('click', toggleMenu);
  document.addEventListener('click', (event) => {
    if (!navDrawer.contains(event.target) && !menuButton.contains(event.target)) {
      navDrawer.classList.remove('is-open');
      menuButton.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });
}

const COOKIE_KEY = 'seanmosikili-cookie-consent';
if (cookieBanner && !localStorage.getItem(COOKIE_KEY)) {
  cookieBanner.classList.remove('hidden');
}

const handleCookieChoice = (value) => {
  localStorage.setItem(COOKIE_KEY, value);
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
    openMailClient(contactForm, 'Booking / Collaboration Request');
  });
}

if (subscribeForm) {
  subscribeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    openMailClient(subscribeForm, 'Swarm Newsletter Signup');
  });
}

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
