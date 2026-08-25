'use strict';

let database = null;
let activePhotos = [];
let activeIndex = 0;
let installPrompt = null;
let toastTimer = null;
let swipeStartX = null;

const $ = (selector) => document.querySelector(selector);
const entriesEl = $('#entries');
const lightbox = $('#lightbox');
const installHelp = $('#installHelp');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));
}

function safeAsset(value = '') {
  const path = String(value).trim().replaceAll('\\', '/');
  if (!path || path.includes('..') || !/^assets\/[A-Za-z0-9._/@-]+(?:\/[A-Za-z0-9._/@-]+)*$/.test(path)) return '';
  return path;
}

function primaryTime(entry) {
  return entry?.capturedAt || entry?.sourceTime || entry?.importedAt || '';
}

function timeValue(entry) {
  const value = Date.parse(primaryTime(entry));
  return Number.isFinite(value) ? value : 0;
}

function formatWallTime(iso) {
  if (!iso) return '未知';
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
  return escapeHtml(String(iso));
}

function formatDate(iso) {
  if (!iso) return '日期未知';
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
  return '日期未知';
}

function yearOf(entry) {
  const match = String(primaryTime(entry)).match(/^(\d{4})/);
  return match?.[1] || null;
}

function showToast(message, duration = 3200) {
  const toast = $('#toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { toast.hidden = true; }, 180);
  }, duration);
}

async function loadDatabase() {
  const response = await fetch('data/photos.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`数据请求失败（${response.status}）`);
  const data = await response.json();
  if (!data || !Array.isArray(data.entries)) throw new Error('照片数据格式不正确');
  return data;
}

async function boot() {
  database = await loadDatabase();
  render();
  registerServiceWorker();
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    registration.update().catch(() => {});
  } catch (error) {
    console.warn('Service Worker 注册失败：', error);
  }
}

function render() {
  const entries = [...(database.entries || [])].sort((a, b) => timeValue(b) - timeValue(a));
  const photos = entries.flatMap((entry) => Array.isArray(entry.photos) ? entry.photos : []);
  const years = new Set(entries.map(yearOf).filter(Boolean));

  $('#photoCount').textContent = String(photos.length);
  $('#entryCount').textContent = String(entries.length);
  $('#yearCount').textContent = String(years.size);
  $('#updatedAt').textContent = database.updatedAt ? `最后更新 ${formatWallTime(database.updatedAt)}` : '最后更新未知';

  renderHero(entries);
  entriesEl.innerHTML = entries.length ? entries.map(renderEntry).join('') : '<p class="empty-state">还没有照片记录。</p>';
  entriesEl.setAttribute('aria-busy', 'false');
}

function renderHero(entries) {
  const hero = $('#heroCard');
  const entry = entries.find((item) => Array.isArray(item.photos) && item.photos.length > 0);
  if (!entry) {
    hero.hidden = true;
    return;
  }

  const requestedCoverIndex = Number.isInteger(entry.coverIndex) ? entry.coverIndex : 0;
  const coverIndex = Math.min(Math.max(requestedCoverIndex, 0), entry.photos.length - 1);
  const photo = entry.photos[coverIndex];
  const thumb = safeAsset(entry.coverThumb || photo.thumb || entry.cover || photo.src);
  const full = safeAsset(entry.cover || photo.src || thumb);
  if (!thumb) {
    hero.hidden = true;
    return;
  }

  hero.dataset.entry = entry.id || '';
  hero.dataset.index = String(coverIndex);
  const srcset = full && full !== thumb ? ` srcset="${escapeHtml(thumb)} 360w, ${escapeHtml(full)} 800w" sizes="(max-width: 820px) 92vw, 44vw"` : '';
  hero.innerHTML = `<img src="${escapeHtml(thumb)}"${srcset} alt="${escapeHtml(entry.title || photo.alt || '最新记录')}" width="${Number(photo.thumbWidth || 360)}" height="${Number(photo.thumbHeight || 540)}" decoding="async" fetchpriority="high">`;
  hero.hidden = false;
}

function renderEntry(entry) {
  const entryId = escapeHtml(entry.id || '');
  const photos = Array.isArray(entry.photos) ? entry.photos : [];
  const dateLabel = entry.dateLabel || formatDate(primaryTime(entry));
  const captureText = entry.capturedAt ? formatWallTime(entry.capturedAt) : '原图无 EXIF 时间';
  const timeParts = [
    `拍摄：${captureText}`,
    entry.sourceTime ? `${entry.sourceTimeLabel || '来源时间'}：${formatWallTime(entry.sourceTime)}` : null,
    entry.importedAt ? `导入：${formatWallTime(entry.importedAt)}` : null
  ].filter(Boolean);

  const gallery = photos.map((photo, index) => {
    const thumb = safeAsset(photo.thumb || photo.src);
    const full = safeAsset(photo.src || thumb);
    if (!thumb) return '';
    const caption = photo.caption || `照片 ${index + 1}`;
    const sizes = index === 0 ? '(max-width: 820px) calc(100vw - 40px), 40vw' : '(max-width: 820px) 48vw, 33vw';
    const srcset = full && full !== thumb ? ` srcset="${escapeHtml(thumb)} 360w, ${escapeHtml(full)} 800w" sizes="${sizes}"` : '';
    return `<button class="photo" type="button" data-entry="${entryId}" data-index="${index}" aria-label="查看 ${escapeHtml(caption)}">
      <img src="${escapeHtml(thumb)}"${srcset} alt="${escapeHtml(photo.alt || caption)}" loading="lazy" decoding="async" width="${Number(photo.thumbWidth || 360)}" height="${Number(photo.thumbHeight || 540)}">
      <span class="photo-label">${escapeHtml(caption)}</span>
    </button>`;
  }).join('');

  const tags = (entry.tags || []).map((tag) => `<span class="tag"># ${escapeHtml(tag)}</span>`).join('');
  const sourceButton = entry.source?.src ? `<button class="source-link" type="button" data-source="${entryId}">查看来源</button>` : '';

  return `<article class="entry" id="entry-${entryId}">
    <div class="entry-head">
      <div class="entry-title">
        <h3>${escapeHtml(entry.title || '未命名记录')}</h3>
        ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ''}
        ${tags ? `<div class="tags">${tags}</div>` : ''}
      </div>
      <div class="date-block"><strong>${escapeHtml(dateLabel)}</strong>${entry.location ? `<span>${escapeHtml(entry.location)}</span>` : ''}</div>
    </div>
    ${gallery ? `<div class="gallery">${gallery}</div>` : '<p class="empty-state">这条记录还没有照片。</p>'}
    <div class="meta-row">
      <div class="meta-card"><strong>时间记录</strong><span>${escapeHtml(timeParts.join(' · '))}</span></div>
      <div class="source-card"><div><strong>记录来源</strong><span>${escapeHtml(entry.source?.label || '来源资料')}</span></div>${sourceButton}</div>
    </div>
  </article>`;
}

function findEntry(entryId) {
  return database?.entries?.find((entry) => String(entry.id) === String(entryId));
}

function openPhoto(entryId, index) {
  const entry = findEntry(entryId);
  if (!entry || !Array.isArray(entry.photos) || !entry.photos[index]) return;
  activePhotos = entry.photos.map((photo) => ({
    src: safeAsset(photo.src || photo.thumb),
    alt: photo.alt || '',
    caption: photo.caption || '',
    meta: `${entry.title || ''} · ${entry.dateLabel || formatDate(primaryTime(entry))}`
  })).filter((photo) => photo.src);
  activeIndex = Math.min(index, activePhotos.length - 1);
  if (activeIndex < 0) return;
  showActive();
  if (!lightbox.open) lightbox.showModal();
}

function openSource(entryId) {
  const entry = findEntry(entryId);
  const src = safeAsset(entry?.source?.src || entry?.source?.thumb);
  if (!entry || !src) return;
  activePhotos = [{
    src,
    alt: entry.source.label || '记录来源',
    caption: entry.source.label || '记录来源',
    meta: entry.sourceTime ? `${entry.sourceTimeLabel || '来源时间'} · ${formatWallTime(entry.sourceTime)}` : ''
  }];
  activeIndex = 0;
  showActive();
  if (!lightbox.open) lightbox.showModal();
}

function showActive() {
  const photo = activePhotos[activeIndex];
  if (!photo) return;
  $('#lightboxImg').src = photo.src;
  $('#lightboxImg').alt = photo.alt || '';
  $('#lightboxCaption').textContent = photo.caption || '';
  $('#lightboxMeta').textContent = photo.meta || '';
  const multiple = activePhotos.length > 1;
  $('#prevPhoto').hidden = !multiple;
  $('#nextPhoto').hidden = !multiple;
  preloadAdjacent();
}

function movePhoto(delta) {
  if (activePhotos.length < 2) return;
  activeIndex = (activeIndex + delta + activePhotos.length) % activePhotos.length;
  showActive();
}

function preloadAdjacent() {
  if (activePhotos.length < 2) return;
  const indexes = [
    (activeIndex + 1) % activePhotos.length,
    (activeIndex - 1 + activePhotos.length) % activePhotos.length
  ];
  indexes.forEach((index) => {
    const image = new Image();
    image.src = activePhotos[index].src;
  });
}

entriesEl.addEventListener('click', (event) => {
  const photoButton = event.target.closest('[data-entry][data-index]');
  if (photoButton) {
    openPhoto(photoButton.dataset.entry, Number(photoButton.dataset.index));
    return;
  }
  const sourceButton = event.target.closest('[data-source]');
  if (sourceButton) openSource(sourceButton.dataset.source);
});

$('#heroCard').addEventListener('click', (event) => {
  const button = event.currentTarget;
  if (button.dataset.entry) openPhoto(button.dataset.entry, Number(button.dataset.index || 0));
});

$('#closeLightbox').addEventListener('click', () => lightbox.close());
$('#prevPhoto').addEventListener('click', () => movePhoto(-1));
$('#nextPhoto').addEventListener('click', () => movePhoto(1));
lightbox.addEventListener('click', (event) => { if (event.target === lightbox) lightbox.close(); });
lightbox.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') movePhoto(-1);
  if (event.key === 'ArrowRight') movePhoto(1);
});
lightbox.addEventListener('touchstart', (event) => {
  swipeStartX = event.changedTouches[0]?.clientX ?? null;
}, { passive: true });
lightbox.addEventListener('touchend', (event) => {
  if (swipeStartX === null) return;
  const endX = event.changedTouches[0]?.clientX ?? swipeStartX;
  const delta = endX - swipeStartX;
  swipeStartX = null;
  if (Math.abs(delta) > 48) movePhoto(delta > 0 ? -1 : 1);
}, { passive: true });
lightbox.addEventListener('close', () => {
  $('#lightboxImg').removeAttribute('src');
  activePhotos = [];
});

$('#howToInstall').addEventListener('click', () => installHelp.showModal());
$('#closeInstallHelp').addEventListener('click', () => installHelp.close());
installHelp.addEventListener('click', (event) => { if (event.target === installHelp) installHelp.close(); });

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  $('#installBtn').hidden = false;
});

$('#installBtn').addEventListener('click', async () => {
  if (!installPrompt) {
    installHelp.showModal();
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('#installBtn').hidden = true;
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  $('#installBtn').hidden = true;
  showToast('已安装到设备 ✨');
});
window.addEventListener('offline', () => showToast('当前离线：正在使用已缓存内容'));
window.addEventListener('online', () => showToast('网络已恢复'));

boot().catch((error) => {
  console.error(error);
  entriesEl.setAttribute('aria-busy', 'false');
  entriesEl.innerHTML = `<div class="error-state"><strong>加载失败</strong><span>${escapeHtml(error.message)}</span><button type="button" id="retryLoad">重新加载</button></div>`;
  $('#retryLoad')?.addEventListener('click', () => location.reload());
});
