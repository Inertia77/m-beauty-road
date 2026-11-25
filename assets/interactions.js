'use strict';
// Supplemental keyboard and pointer interactions; app.js owns all application state.
(() => {
  const $ = s => document.querySelector(s);
  const lightbox = $('#lightbox');
  let pointer = null;
  lightbox.addEventListener('click', e => { if(e.target === lightbox) lightbox.close(); });
  lightbox.addEventListener('pointerdown', e => {
    if(e.pointerType !== 'touch' && e.button === 0 && !e.target.closest('button')) pointer={id:e.pointerId,x:e.clientX,y:e.clientY};
  });
  lightbox.addEventListener('pointerup', e => {
    if(!pointer || pointer.id !== e.pointerId) return;
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
    pointer=null;
    if(Math.abs(dx)>55 && Math.abs(dx)>Math.abs(dy)*1.2) $(dx>0?'#prevPhoto':'#nextPhoto').click();
  });
  lightbox.addEventListener('pointercancel', () => {pointer=null;});
  lightbox.addEventListener('close', () => {pointer=null;});
  const help=$('#installHelp');
  help.addEventListener('click', e => {if(e.target===help)help.close();});
  $('.mobile-tabs')?.addEventListener('keydown', e => {
    if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
    const tabs=[...document.querySelectorAll('.mobile-tab')];
    const i=tabs.indexOf(document.activeElement);
    if(i<0)return;
    e.preventDefault();
    const next=tabs[(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];
    next.focus();next.click();
  });
})();
