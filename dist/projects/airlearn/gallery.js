const batchSize = 24;
const grid = document.querySelector('#imageGrid');
const search = document.querySelector('#imageSearch');
const category = document.querySelector('#imageCategory');
const status = document.querySelector('#archiveStatus');
const empty = document.querySelector('#archiveEmpty');
const more = document.querySelector('#loadMore');
const dialog = document.querySelector('#imageDialog');
const preview = document.querySelector('#dialogImage');
const previous = document.querySelector('#previousImage');
const next = document.querySelector('#nextImage');
const title = document.querySelector('#imageTitle');
const source = document.querySelector('#imageSource');
const counter = document.querySelector('#imageCounter');
const fullImageLink = document.querySelector('#fullImageLink');
let images = [];
let matches = [];
let shown = 0;
let current = 0;

function showImage(index) {
  if (index < 0 || index >= matches.length) return;
  current = index;
  const item = matches[index];
  title.textContent = `Visual ${String(item.number).padStart(4, '0')}`;
  preview.src = `assets/visuals/${item.id}.webp`;
  preview.alt = `Midjourney visual ${item.number}: ${item.name}`;
  source.textContent = item.source;
  counter.textContent = `${index + 1} / ${matches.length}`;
  fullImageLink.href = preview.src;
  previous.disabled = index === 0;
  next.disabled = index === matches.length - 1;
  if (!dialog.open) dialog.showModal();
}

function appendImages() {
  const start = shown;
  const fragment = document.createDocumentFragment();
  matches.slice(start, start + batchSize).forEach((item, offset) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'archive-item';
    button.dataset.imageId = item.id;
    button.setAttribute('aria-haspopup', 'dialog');
    const image = document.createElement('img');
    image.src = `assets/thumbs/${item.id}.webp`;
    const scale = Math.min(360 / item.width, 360 / item.height, 1);
    image.width = Math.round(item.width * scale);
    image.height = Math.round(item.height * scale);
    image.loading = 'lazy';
    image.alt = `Midjourney visual ${item.number}: ${item.name}`;
    const caption = document.createElement('span');
    caption.append(`Visual ${String(item.number).padStart(4, '0')}`);
    const family = document.createElement('span');
    family.textContent = item.category;
    caption.append(family);
    button.append(image, caption);
    button.addEventListener('click', () => showImage(start + offset));
    fragment.append(button);
  });
  grid.append(fragment);
  shown = Math.min(start + batchSize, matches.length);
  more.hidden = shown === matches.length;
  empty.hidden = matches.length > 0;
  const total = matches.length.toLocaleString();
  status.textContent = `Showing ${shown.toLocaleString()} of ${total} images${matches.length !== images.length ? ` · ${images.length.toLocaleString()} in the full archive` : ''}`;
}

function filterImages() {
  const query = search.value.trim().toLowerCase();
  matches = images.filter(item => (category.value === 'all' || item.category === category.value)
    && `${item.source} ${item.name} ${item.number} ${String(item.number).padStart(4, '0')}`.toLowerCase().includes(query));
  shown = 0;
  grid.replaceChildren();
  appendImages();
}

function openLinkedImage() {
  const index = matches.findIndex(item => item.id === location.hash.slice(1));
  if (index !== -1) showImage(index);
}

document.querySelector('#archiveFilters').addEventListener('submit', event => event.preventDefault());
document.querySelector('#archiveFilters').addEventListener('reset', () => {
  search.value = '';
  category.value = 'all';
  filterImages();
});
search.addEventListener('input', filterImages);
category.addEventListener('change', filterImages);
window.addEventListener('hashchange', openLinkedImage);
more.addEventListener('click', () => {
  const start = shown;
  appendImages();
  grid.children[start]?.focus();
});
document.querySelector('#closeImage').addEventListener('click', () => dialog.close());
previous.addEventListener('click', () => showImage(current - 1));
next.addEventListener('click', () => showImage(current + 1));
dialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    showImage(current + (event.key === 'ArrowLeft' ? -1 : 1));
  }
});
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right
    || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});

async function loadImages() {
  try {
    const response = await fetch('assets/gallery.json');
    if (!response.ok) throw new Error('Image index unavailable');
    images = (await response.json()).images;
    filterImages();
    openLinkedImage();
  } catch {
    status.textContent = 'The image index could not load. Please reload the page to try again.';
  }
}

loadImages();
