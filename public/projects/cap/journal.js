const bar = document.querySelector('#reading-progress');
const chapterNav = document.querySelector('.journal-nav');
const chapterList = chapterNav?.querySelector('.journal-chapters');
const highlight = chapterNav?.querySelector('.journal-chapter-highlight');
const gsap = chapterNav && window.gsap;
const entries = document.querySelector('.journal-entries');
const sections = [...(entries?.querySelectorAll('.journal-section') ?? [])];
const chapterLinks = new Map(
  [...(chapterList?.querySelectorAll('a') ?? [])].map(link => [link.hash.slice(1), link])
);
const reducedMotion = chapterNav && matchMedia('(prefers-reduced-motion: reduce)');

let activeLink;
let navWidth;
let listWidth;
let updatePending = false;

function updateChapter() {
  const readingLine = Math.min(innerHeight / 2, chapterNav.offsetHeight + 48);
  const currentSection = sections.find(section => {
    const { top, bottom } = section.getBoundingClientRect();
    return top <= readingLine && bottom > readingLine;
  });
  const currentLink = chapterLinks.get(currentSection?.id);
  const visibleWidth = chapterNav.clientWidth;
  const scrollWidth = chapterNav.scrollWidth;
  const resized = visibleWidth !== navWidth || scrollWidth !== listWidth;
  navWidth = visibleWidth;
  listWidth = scrollWidth;

  if (currentLink !== activeLink) {
    activeLink?.removeAttribute('aria-current');
    activeLink = currentLink;
    activeLink?.setAttribute('aria-current', 'location');
  } else if (!resized) {
    return;
  }

  if (!activeLink) {
    if (gsap && highlight) {
      gsap.killTweensOf(highlight);
      highlight.hidden = true;
    }
    return;
  }

  const navLeft = chapterNav.getBoundingClientRect().left;
  const { left, right, width, height } = activeLink.getBoundingClientRect();
  const x = chapterNav.scrollLeft + left - navLeft;
  if (gsap && highlight) {
    const animate = !highlight.hidden && !resized && !reducedMotion.matches;
    highlight.hidden = false;
    gsap.to(highlight, {
      x, width, height,
      duration: animate ? 0.32 : 0,
      ease: 'power2.out',
      overwrite: true,
    });
  }

  if (scrollWidth <= visibleWidth) return;
  const alreadyVisible = left >= navLeft && right <= navLeft + visibleWidth;
  const centeredOffset = x - (visibleWidth - width) / 2;

  // Cancel an earlier reveal if the new chapter already fits.
  chapterNav.scrollTo({
    left: alreadyVisible ? chapterNav.scrollLeft : centeredOffset,
    behavior: alreadyVisible || reducedMotion.matches ? 'auto' : 'smooth',
  });
}

function updateReadingState() {
  updatePending = false;
  if (chapterNav) updateChapter();
  if (!bar) return;
  const max = document.documentElement.scrollHeight - innerHeight;
  const progress = max > 0 ? Math.max(0, Math.min(1, scrollY / max)) : 0;
  bar.style.width = `${progress * 100}%`;
}

function scheduleReadingUpdate() {
  if (updatePending) return;
  updatePending = true;
  requestAnimationFrame(updateReadingState);
}

function setupPdfButton() {
  const button = document.querySelector('.journal-summary .button.outline');
  if (!gsap || !button) return;

  const style = getComputedStyle(button);
  const ink = style.getPropertyValue('--ink').trim();
  const paper = style.getPropertyValue('--paper').trim();
  const inversion = gsap.fromTo(
    button,
    { backgroundColor: paper, color: ink },
    { backgroundColor: ink, color: 'white', duration: 0.2, ease: 'power2.out', paused: true },
  );
  let hovered = false;

  function updateInversion() {
    const active = hovered || button.matches(':focus-visible');
    if (reducedMotion.matches) {
      inversion.pause().progress(Number(active));
    } else if (active) {
      inversion.play();
    } else {
      inversion.reverse();
    }
  }

  button.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    hovered = true;
    updateInversion();
  });
  button.addEventListener('pointerleave', () => {
    hovered = false;
    updateInversion();
  });
  button.addEventListener('focus', updateInversion);
  button.addEventListener('blur', updateInversion);
  reducedMotion.addEventListener('change', updateInversion);
}

addEventListener('scroll', scheduleReadingUpdate, { passive: true });
addEventListener('resize', scheduleReadingUpdate);
addEventListener('pageshow', scheduleReadingUpdate);
if (chapterNav) {
  addEventListener('hashchange', scheduleReadingUpdate);
  const layoutObserver = new ResizeObserver(scheduleReadingUpdate);
  layoutObserver.observe(entries);
  layoutObserver.observe(chapterList);
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches || !gsap || !highlight) return;
    gsap.killTweensOf(highlight);
    highlight.hidden = true;
    navWidth = undefined;
    scheduleReadingUpdate();
  });
  setupPdfButton();
}
scheduleReadingUpdate();
