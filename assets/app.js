let database;
let activePhotos=[];
let activeIndex=0;
let installPrompt=null;

const $=(s)=>document.querySelector(s);
const fmt=(iso)=>new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Tokyo'}).format(new Date(iso)).replaceAll('/','-');

async function boot(){
  const res=await fetch('data/photos.json',{cache:'no-cache'});
  database=await res.json();
  render();
  if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{});}
}

function render(){
  const entries=database.entries||[];
  const photos=entries.flatMap(e=>e.photos||[]);
  $('#photoCount').textContent=photos.length;
  $('#entryCount').textContent=entries.length;
  $('#yearCount').textContent=new Set(entries.map(e=>String(e.sourceTime||e.importedAt).slice(0,4))).size;
  $('#updatedAt').textContent=`最后更新 ${fmt(database.updatedAt)}`;
  if(entries[0]) $('#heroCard').innerHTML=`<img src="${entries[0].cover}" alt="${escapeHtml(entries[0].title)}" fetchpriority="high">`;
  $('#entries').innerHTML=entries.map(renderEntry).join('');
  document.querySelectorAll('[data-entry]').forEach(btn=>btn.addEventListener('click',()=>openPhoto(btn.dataset.entry,Number(btn.dataset.index))));
  document.querySelectorAll('[data-source]').forEach(btn=>btn.addEventListener('click',()=>openSource(btn.dataset.source)));
}

function renderEntry(e){
  const captureText=e.capturedAt?fmt(e.capturedAt):'原图无 EXIF 时间';
  return `<article class="entry">
    <div class="entry-head">
      <div class="entry-title"><h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(e.note||'')}</p><div class="tags">${(e.tags||[]).map(t=>`<span class="tag"># ${escapeHtml(t)}</span>`).join('')}</div></div>
      <div class="date-block"><strong>${escapeHtml(e.dateLabel)}</strong><span>${escapeHtml(e.location||'')}</span></div>
    </div>
    <div class="gallery">${e.photos.map((p,i)=>`<button class="photo" data-entry="${e.id}" data-index="${i}" aria-label="查看 ${escapeHtml(p.caption)}"><img src="${p.src}" alt="${escapeHtml(p.alt)}" loading="${i>1?'lazy':'eager'}"><span class="photo-label">${escapeHtml(p.caption)}</span></button>`).join('')}</div>
    <div class="meta-row">
      <div class="meta-card"><strong>时间记录</strong><span>${escapeHtml(e.sourceTimeLabel)}：${fmt(e.sourceTime)} · 拍摄时间：${captureText} · 导入：${fmt(e.importedAt)}</span></div>
      <div class="source-card"><div><strong>记录来源</strong><span>${escapeHtml(e.source?.label||'来源资料')}</span></div>${e.source?.src?`<button class="source-link" data-source="${e.id}">查看来源</button>`:''}</div>
    </div>
  </article>`;
}

function openPhoto(entryId,index){
  const e=database.entries.find(x=>x.id===entryId); if(!e)return;
  activePhotos=e.photos.map(p=>({...p,meta:`${e.title} · ${e.dateLabel}`})); activeIndex=index; showActive(); $('#lightbox').showModal();
}
function openSource(entryId){
  const e=database.entries.find(x=>x.id===entryId); if(!e?.source?.src)return;
  activePhotos=[{src:e.source.src,alt:e.source.label,caption:e.source.label,meta:`${e.sourceTimeLabel} · ${fmt(e.sourceTime)}`}]; activeIndex=0; showActive(); $('#lightbox').showModal();
}
function showActive(){const p=activePhotos[activeIndex];$('#lightboxImg').src=p.src;$('#lightboxImg').alt=p.alt||'';$('#lightboxCaption').textContent=p.caption||'';$('#lightboxMeta').textContent=p.meta||'';$('#prevPhoto').hidden=activePhotos.length<2;$('#nextPhoto').hidden=activePhotos.length<2;}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}

$('#closeLightbox').addEventListener('click',()=>$('#lightbox').close());
$('#prevPhoto').addEventListener('click',()=>{activeIndex=(activeIndex-1+activePhotos.length)%activePhotos.length;showActive();});
$('#nextPhoto').addEventListener('click',()=>{activeIndex=(activeIndex+1)%activePhotos.length;showActive();});
$('#lightbox').addEventListener('click',e=>{if(e.target===$('#lightbox'))$('#lightbox').close();});
$('#howToInstall').addEventListener('click',()=>$('#installHelp').showModal());
$('#closeInstallHelp').addEventListener('click',()=>$('#installHelp').close());
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#installBtn').hidden=false;});
$('#installBtn').addEventListener('click',async()=>{if(!installPrompt){$('#installHelp').showModal();return;}installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#installBtn').hidden=true;});
window.addEventListener('appinstalled',()=>{$('#installBtn').hidden=true;});
boot().catch(err=>{$('#entries').innerHTML=`<p>加载失败：${escapeHtml(err.message)}</p>`;});
