'use strict';

let beauty = { entries: [] };
let journeyDb = { journeys: [] };
let lightboxItems = [];
let lightboxIndex = 0;
let installPrompt = null;
let swipeStart = null;
let activeView = null;
let lightboxOpener = null;
const scrollByView = { beauty: 0, journeys: 0 };

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (v = '') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const asset = (v = '') => {
  const p = String(v).trim().replaceAll('\\', '/');
  return p && !p.includes('..') && /^assets\/[A-Za-z0-9._/@-]+(?:\/[A-Za-z0-9._/@-]+)*$/.test(p) ? p : '';
};
const primaryTime = (e) => e?.capturedAt || e?.sourceTime || e?.importedAt || '';
const ts = (v) => Number.isFinite(Date.parse(v || '')) ? Date.parse(v) : 0;
const fmtWall = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : '未知';
};
const fmtDate = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : '日期未知';
};

function srcset(thumb, full, tw, fw, sizes) {
  tw = Number(tw); fw = Number(fw);
  if (!thumb || !full || thumb === full || !tw || !fw || fw <= tw) return '';
  return ` srcset="${esc(thumb)} ${tw}w, ${esc(full)} ${fw}w" sizes="${esc(sizes)}"`;
}

async function readJson(path, key) {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(path + ': ' + r.status);
  const data = await r.json();
  if (!Array.isArray(data?.[key])) throw new Error('数据格式不正确');
  return data;
}

function loadError(selector, error) {
  const el = $(selector);
  el.setAttribute('aria-busy', 'false');
  el.innerHTML = '<div class="error-state"><strong>加载失败</strong><p>请检查网络后重试。</p><button type="button" data-retry>重新加载</button></div>';
  el.querySelector('[data-retry]').addEventListener('click', () => location.reload());
  console.error(error);
}

async function boot() {
  setView(location.hash === '#journeys' ? 'journeys' : 'beauty', false);
  registerSW();
  await Promise.all([
    readJson('data/photos.json', 'entries').then(d => { beauty = d; renderBeauty(); }).catch(e => loadError('#entries', e)),
    readJson('data/journeys.json', 'journeys').then(d => { journeyDb = d; renderJourneys(); }).catch(e => loadError('#journeys', e))
  ]);
}

function setView(view, writeHash = true) {
  const next = view === 'journeys' ? 'journeys' : 'beauty';
  const previous = activeView;
  if (previous && previous !== next) scrollByView[previous] = window.scrollY;
  activeView = next;
  document.body.dataset.view = next;
  $('#beautyView').hidden = next !== 'beauty';
  $('#journeyView').hidden = next !== 'journeys';
  $$('[data-view-target]').forEach(btn => {
    const on = btn.dataset.viewTarget === next;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', String(on));
    if (on) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
  if (writeHash) history.replaceState(null, '', next === 'journeys' ? '#journeys' : '#beauty');
  if (previous && previous !== next) requestAnimationFrame(() => window.scrollTo({ top: scrollByView[next], behavior: 'instant' }));
}

function renderBeauty() {
  const entries = [...(beauty.entries || [])].sort((a,b) => ts(primaryTime(b)) - ts(primaryTime(a)));
  const allPhotos = entries.flatMap(e => e.photos || []);
  const years = new Set(entries.map(e => String(primaryTime(e)).slice(0,4)).filter(Boolean));
  $('#photoCount').textContent = allPhotos.length;
  $('#entryCount').textContent = entries.length;
  $('#yearCount').textContent = years.size;
  $('#updatedAt').textContent = beauty.updatedAt ? `最后更新 ${fmtWall(beauty.updatedAt)}` : '最后更新未知';
  renderHero(entries[0]);
  $('#entries').innerHTML = entries.length ? entries.map(beautyCard).join('') : '<div class="empty-state">还没有美女记录。</div>';
  $('#entries').setAttribute('aria-busy', 'false');
}

function renderHero(entry) {
  const hero = $('#heroCard');
  if (!entry?.photos?.length) return void (hero.hidden = true);
  const i = Math.min(Math.max(Number(entry.coverIndex) || 0, 0), entry.photos.length - 1);
  const p = entry.photos[i];
  const thumb = asset(entry.coverThumb || p.thumb || p.src);
  const full = asset(entry.cover || p.src || thumb);
  if (!thumb) return void (hero.hidden = true);
  hero.dataset.entry = entry.id;
  hero.dataset.index = i;
  hero.innerHTML = `<img src="${esc(thumb)}"${srcset(thumb, full, p.thumbWidth, p.width, '(max-width:820px) 92vw,44vw')} alt="${esc(entry.title || p.alt || '')}" width="${Number(p.thumbWidth || p.width || 360)}" height="${Number(p.thumbHeight || p.height || 540)}" decoding="async" fetchpriority="high">`;
  hero.hidden = false;
}

function beautyCard(entry) {
  const id = esc(entry.id || '');
  const photos = (entry.photos || []).map((p,i) => {
    const thumb = asset(p.thumb || p.src), full = asset(p.src || thumb);
    if (!thumb) return '';
    const caption = p.caption || `照片 ${i+1}`;
    const sizes = i === 0 ? '(max-width:820px) calc(100vw - 40px),40vw' : '(max-width:820px) 48vw,33vw';
    return `<button class="photo" type="button" data-entry="${id}" data-index="${i}" aria-label="查看 ${esc(caption)}"><img src="${esc(thumb)}"${srcset(thumb,full,p.thumbWidth,p.width,sizes)} alt="${esc(p.alt || caption)}" loading="lazy" decoding="async" width="${Number(p.thumbWidth || p.width || 360)}" height="${Number(p.thumbHeight || p.height || 540)}"><span class="photo-label">${esc(caption)}</span></button>`;
  }).join('');
  const tags = (entry.tags || []).map(t => `<span class="tag"># ${esc(t)}</span>`).join('');
  const times = [`拍摄：${entry.capturedAt ? fmtWall(entry.capturedAt) : '原图无 EXIF 时间'}`, entry.sourceTime ? `${entry.sourceTimeLabel || '来源时间'}：${fmtWall(entry.sourceTime)}` : '', entry.importedAt ? `导入：${fmtWall(entry.importedAt)}` : ''].filter(Boolean).join(' · ');
  return `<article class="entry"><div class="entry-head"><div class="entry-title"><h3>${esc(entry.title || '未命名记录')}</h3>${entry.note ? `<p>${esc(entry.note)}</p>` : ''}${tags ? `<div class="tags">${tags}</div>` : ''}</div><div class="date-block"><strong>${esc(entry.dateLabel || fmtDate(primaryTime(entry)))}</strong>${entry.location ? `<span>${esc(entry.location)}</span>` : ''}</div></div><div class="gallery">${photos}</div><div class="meta-row"><div class="meta-card"><strong>时间记录</strong><span>${esc(times)}</span></div><div class="source-card"><div><strong>记录来源</strong><span>${esc(entry.source?.label || '来源资料')}</span></div>${entry.source?.src ? `<button class="source-link" type="button" data-source="${id}">查看来源</button>` : ''}</div></div></article>`;
}

const feelingEmoji = {'很幸福':'🥰','很舒服':'😌','很好笑':'🤣','很惊喜':'✨','有点狼狈':'🌧️','很难忘':'🥹'};
const feelingChip = (f) => `<span class="feeling-chip">${feelingEmoji[f] || '♡'} ${esc(f)}</span>`;
const journeyPlace = (j) => j.location?.name || j.location?.city || j.location?.country || '地点待记录';
const journeyDate = (j) => j.dateLabel || (j.startAt ? (j.endAt && String(j.endAt).slice(0,10) !== String(j.startAt).slice(0,10) ? `${fmtDate(j.startAt)} — ${fmtDate(j.endAt)}` : fmtDate(j.startAt)) : '日期待记录');

function renderJourneys() {
  const list = [...(journeyDb.journeys || [])].sort((a,b) => ts(b.startAt || b.importedAt) - ts(a.startAt || a.importedAt));
  $('#journeyCount').textContent = list.length;
  $('#cityCount').textContent = new Set(list.map(j => j.location?.city || j.location?.name).filter(Boolean)).size;
  $('#countryCount').textContent = new Set(list.map(j => j.location?.country).filter(Boolean)).size;
  $('#stopCount').textContent = list.reduce((n,j) => n + (j.stops?.length || 0), 0);
  $('#journeyUpdatedAt').textContent = journeyDb.updatedAt ? `最后更新 ${fmtWall(journeyDb.updatedAt)}` : '还没有记录';
  $('#journeys').innerHTML = list.length ? list.map(journeyCard).join('') : journeyEmpty();
  $('#journeys').setAttribute('aria-busy', 'false');
}

function journeyPhoto(j, p, i) {
  if (!p) return '';
  const thumb = asset(p.thumb || p.src), full = asset(p.src || thumb);
  if (!thumb) return '';
  const caption = p.caption || '照片 ' + (i + 1);
  return '<button class="journey-photo" type="button" data-journey-photo="' + esc(j.id) + '" data-index="' + i + '" aria-label="查看 ' + esc(caption) + '"><img src="' + esc(thumb) + '"' + srcset(thumb, full, p.thumbWidth, p.width, '(max-width: 820px) 45vw, 25vw') + ' alt="' + esc(p.alt || caption) + '" loading="lazy" decoding="async"><span>' + esc(caption) + '</span></button>';
}

function journeyCard(j) {
  const cover = asset(j.coverThumb || j.cover || j.photos?.[0]?.thumb || j.photos?.[0]?.src || '');
  const feelings = (j.feelings || []).slice(0,3).map(feelingChip).join('');
  const gallery = (j.photos || []).map((p,i) => journeyPhoto(j,p,i)).join('');
  const stops = (j.stops || []).map((s,i) => `<li><span>${String(i+1).padStart(2,'0')}</span><div><strong>${esc(s.name || '停靠点')}</strong>${s.visitedAt ? `<p>${esc(fmtWall(s.visitedAt))}</p>` : ''}${s.feeling ? `<p>${esc(s.feeling)}</p>` : ''}${s.note ? `<p>${esc(s.note)}</p>` : ''}${s.photoIndexes?.length ? `<div class="journey-gallery">${s.photoIndexes.map(n => journeyPhoto(j,j.photos?.[n],n)).join('')}</div>` : ''}</div></li>`).join('');
  return `<article class="journey-card"><button class="journey-card-button" type="button" data-journey="${esc(j.id || '')}" aria-expanded="false"><div class="journey-cover ${cover ? '' : 'journey-cover-empty'}">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy">` : '<span class="mini-route"><i></i><i></i><i></i></span>'}</div><div class="journey-card-content"><div class="journey-kicker"><span>${esc(journeyDate(j))}</span><span>📍 ${esc(journeyPlace(j))}</span></div><h3>${esc(j.title || '未命名旅程')}</h3><p class="journey-quote">${j.feeling ? `“${esc(j.feeling)}”` : '这次的感觉还没有写下来。'}</p>${feelings ? `<div class="feeling-row compact">${feelings}</div>` : ''}<div class="journey-card-meta"><span>${j.stops?.length || 0} 个停靠点</span><span>${j.photos?.length || 0} 张照片</span><span>查看记录 →</span></div></div></button><div class="journey-inline-detail" data-detail="${esc(j.id || '')}" hidden>${j.favoriteMoment ? `<section><small>最记得的瞬间</small><p>${esc(j.favoriteMoment)}</p></section>` : ''}${j.note ? `<section><small>旅程备注</small><p>${esc(j.note)}</p></section>` : ''}${stops ? `<ol class="stops-list">${stops}</ol>` : ''}${gallery ? `<section><small>旅程相册</small><div class="journey-gallery">${gallery}</div></section>` : '<p>还没有旅程照片。</p>'}</div></article>`;
}

function journeyEmpty() {
  return `<div class="journey-empty"><div class="journey-empty-copy"><p class="eyebrow">READY FOR OUR FIRST MEMORY</p><h3>这里已经准备好，<br>等第一段共同回忆。</h3><p>之后每一条记录都可以是一趟旅行，也可以只是一次周末散步。数据还没放进来，所以现在不会虚构任何你们没去过的地方。</p></div><div class="journey-preview"><div class="journey-preview-cover"><span class="preview-badge">卡片预览</span><span class="mini-route large"><i></i><i></i><i></i></span></div><div class="journey-preview-body"><div class="journey-kicker"><span>某一天</span><span>📍 某个一起去过的地方</span></div><h4>一次值得记住的出行</h4><p>“以后这里会放你们当时真正想留下来的感觉。”</p><div class="feeling-row compact"><span>🥰 感觉</span><span>📷 照片</span><span>⌁ 停靠点</span></div></div></div><div class="journey-principles"><div><span>01</span><strong>地点与停靠</strong><p>长旅行可以有多个 stop，不拆成一堆孤立打卡。</p></div><div><span>02</span><strong>当时的感觉</strong><p>不是评分，而是以后真的会想重新读到的话。</p></div><div><span>03</span><strong>照片与瞬间</strong><p>媒体只依赖 URL，未来换存储方案也不用推翻页面。</p></div></div></div>`;
}

function openBeauty(entryId, index) {
  const e = beauty.entries.find(x => String(x.id) === String(entryId));
  if (!e) return;
  openLightbox((e.photos || []).map(p => ({src:asset(p.src || p.thumb),alt:p.alt || '',caption:p.caption || '',meta:`${e.title || ''} · ${p.capturedAt ? fmtWall(p.capturedAt) : (e.dateLabel || fmtDate(primaryTime(e)))}`})), index);
}
function openJourney(id, index) {
  const j = journeyDb.journeys.find(x => String(x.id) === String(id));
  if (!j) return;
  openLightbox((j.photos || []).map(p => ({src:asset(p.src || p.thumb),alt:p.alt || '',caption:p.caption || '',meta:[j.title, p.capturedAt ? fmtWall(p.capturedAt) : journeyDate(j)].filter(Boolean).join(' · ')})), index);
}
function openSource(entryId) {
  const e = beauty.entries.find(x => String(x.id) === String(entryId));
  const src = asset(e?.source?.src || e?.source?.thumb);
  if (src) openLightbox([{src,alt:e.source?.label || '',caption:e.source?.label || '',meta:e.sourceTime ? fmtWall(e.sourceTime) : ''}],0);
}
function openLightbox(items, index=0) {
  lightboxOpener = document.activeElement;
  const selected = items[index];
  lightboxItems = items.filter(x => x.src);
  if (!lightboxItems.length) return;
  lightboxIndex = Math.max(0, lightboxItems.indexOf(selected));
  showLightbox();
  if (!$('#lightbox').open) $('#lightbox').showModal();
}
function showLightbox() {
  const p = lightboxItems[lightboxIndex];
  $('#lightboxImg').src = p.src; $('#lightboxImg').alt = p.alt;
  $('#lightboxCaption').textContent = p.caption; $('#lightboxMeta').textContent = [p.meta, (lightboxIndex + 1) + ' / ' + lightboxItems.length].filter(Boolean).join(' · ');
  $('#prevPhoto').hidden = $('#nextPhoto').hidden = lightboxItems.length < 2;
}
function move(delta) { if (lightboxItems.length > 1) { lightboxIndex = (lightboxIndex + delta + lightboxItems.length) % lightboxItems.length; showLightbox(); } }

$$('[data-view-target]').forEach(b => b.addEventListener('click', () => setView(b.dataset.viewTarget)));
$('#entries').addEventListener('click', e => { const p=e.target.closest('[data-entry][data-index]'); if(p) return openBeauty(p.dataset.entry,Number(p.dataset.index)); const s=e.target.closest('[data-source]'); if(s) openSource(s.dataset.source); });
$('#journeys').addEventListener('click', e => {
  const p = e.target.closest('[data-journey-photo]');
  if (p) return openJourney(p.dataset.journeyPhoto, Number(p.dataset.index));
  const b = e.target.closest('[data-journey]');
  if (!b) return;
  const d = $$( '[data-detail]' ).find(el => el.dataset.detail === b.dataset.journey);
  if (d) { d.hidden = !d.hidden; b.setAttribute('aria-expanded', String(!d.hidden)); }
});
$('#heroCard').addEventListener('click', e => openBeauty(e.currentTarget.dataset.entry, Number(e.currentTarget.dataset.index || 0)));
$('#closeLightbox').addEventListener('click', () => $('#lightbox').close());
$('#prevPhoto').addEventListener('click', () => move(-1)); $('#nextPhoto').addEventListener('click', () => move(1));
$('#lightbox').addEventListener('keydown', e => { if(e.key==='ArrowLeft') move(-1); if(e.key==='ArrowRight') move(1); });
$('#lightbox').addEventListener('touchstart', e => { const t=e.changedTouches[0]; swipeStart=e.touches.length===1 && t ? {x:t.clientX,y:t.clientY,id:t.identifier} : null; },{passive:true});
$('#lightbox').addEventListener('touchend', e => { if(!swipeStart)return; const t=[...e.changedTouches].find(t=>t.identifier===swipeStart.id); if(t){const dx=t.clientX-swipeStart.x,dy=t.clientY-swipeStart.y;if(Math.abs(dx)>48 && Math.abs(dx)>Math.abs(dy)*1.2)move(dx>0?-1:1);} swipeStart=null; },{passive:true});
$('#lightbox').addEventListener('touchcancel', () => { swipeStart=null; });
$('#lightbox').addEventListener('close', () => { $('#lightboxImg').removeAttribute('src'); lightboxItems=[]; swipeStart=null; lightboxOpener?.focus?.({preventScroll:true}); lightboxOpener=null; });
$('#howToInstall').addEventListener('click', () => $('#installHelp').showModal()); $('#closeInstallHelp').addEventListener('click', () => $('#installHelp').close());
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt=e; $('#installBtn').hidden=false; });
$('#installBtn').addEventListener('click', async () => { if(!installPrompt) return $('#installHelp').showModal(); installPrompt.prompt(); await installPrompt.userChoice; installPrompt=null; $('#installBtn').hidden=true; });
window.addEventListener('appinstalled', () => { installPrompt=null; $('#installBtn').hidden=true; });
window.addEventListener('hashchange', () => setView(location.hash==='#journeys'?'journeys':'beauty', false));

async function registerSW(){ if('serviceWorker' in navigator){ try{ const r=await navigator.serviceWorker.register('./sw.js'); r.update().catch(()=>{}); }catch(e){ console.warn(e); } } }
boot().catch(e => { loadError('#entries', e); loadError('#journeys', e); });
