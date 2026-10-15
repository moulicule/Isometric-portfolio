const navigation = document.querySelector('.chapter-nav');
const scroller = navigation.querySelector('.wrap');
const progress = document.querySelector('.reading-progress span');
const chapters = [...navigation.querySelectorAll('a')].map(link => ({
  link,
  section: document.querySelector(link.hash),
}));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeLink = null;
let framePending = false;

function updateReadingPosition() {
  framePending = false;
  const distance = document.documentElement.scrollHeight - window.innerHeight;
  const fraction = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
  const threshold = navigation.getBoundingClientRect().height + 32;
  let nextLink = null;

  for (const { link, section } of chapters) {
    if (section.getBoundingClientRect().top <= threshold) nextLink = link;
  }
  if (fraction >= 1) nextLink = chapters.at(-1).link;
  progress.style.transform = `scaleX(${fraction})`;

  if (nextLink !== activeLink) {
    activeLink?.removeAttribute('aria-current');
    activeLink = nextLink;
    activeLink?.setAttribute('aria-current', 'location');
  }
  if (!activeLink) return;

  // Keep the current chapter reachable in the horizontal navigation on phones.
  const linkBounds = activeLink.getBoundingClientRect();
  const navBounds = scroller.getBoundingClientRect();
  if (linkBounds.left < navBounds.left || linkBounds.right > navBounds.right) {
    scroller.scrollTo({
      left: scroller.scrollLeft + linkBounds.left - navBounds.left
        - (scroller.clientWidth - linkBounds.width) / 2,
      behavior: reducedMotion.matches ? 'instant' : 'smooth',
    });
  }
}

function scheduleUpdate() {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(updateReadingPosition);
}

window.addEventListener('scroll', scheduleUpdate, { passive: true });
window.addEventListener('resize', scheduleUpdate);
document.addEventListener('toggle', scheduleUpdate, true);
document.fonts.ready.then(scheduleUpdate);
scheduleUpdate();
