// Mobile nav toggle
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');

if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// Share buttons — use the Web Share API when available, otherwise copy the link
async function shareSite() {
  const shareData = {
    title: "Kidney For Antonio",
    text: "Antonio is fighting kidney failure and needs a kidney transplant. Help us find his match.",
    url: window.location.href
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      // user cancelled or share failed — fall through to copy link
    }
  }

  try {
    await navigator.clipboard.writeText(window.location.href);
    alert("Link copied! Share it anywhere you'd like.");
  } catch (err) {
    prompt("Copy this link to share:", window.location.href);
  }
}

['share-btn', 'share-btn-2'].forEach((id) => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      shareSite();
    });
  }
});
