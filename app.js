/* Гріндей — автономний архів Telegram. Без API, трекерів та залежностей. */
(() => {
  'use strict';
  const archive = window.ARCHIVE_DATA;
  if (!archive || !Array.isArray(archive.messages)) { document.body.textContent='Не вдалося прочитати архів. Перевір, чи archive-data.js лежить поряд із index.html.'; return; }
  const messages=archive.messages, report=archive.report;
  const byId=new Map(messages.map(m=>[m.id,m]));
  const mediaItems=messages.flatMap(m=>m.media.map((a,i)=>({...a,uid:m.id+':'+i,messageId:m.id,sender:m.sender,date:m.date,messageText:m.text,service:m.service})));
  const mediaMap=new Map(mediaItems.map(a=>[a.uid,a]));
  const pictureItems=mediaItems.filter(a=>a.feature && ['photo','sticker'].includes(a.kind));
  const indexedDays=[...new Set(messages.filter(m=>m.date).map(m=>m.date))].sort();
  const participants=Object.entries(report.authors).sort((a,b)=>b[1]-a[1]).map(([name])=>name);
  const body=document.body;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('uk-UA').replace(/\s+/g,' ').trim();
  const srcFor=p=>window.INLINE_ASSETS?.[p] || p;
  const dateLabel=s=>{if(!s)return 'Без дати';const [y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d)).toLocaleDateString('uk-UA',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});};
  const dateShort=s=>{if(!s)return '—';const [y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d)).toLocaleDateString('uk-UA',{day:'numeric',month:'short',timeZone:'UTC'});};
  const initials=name=>name.split(/\s+/).map(x=>[...x][0]||'').slice(0,2).join('').toUpperCase();
  const palette=['#e4e8c9|#547247','#e5edda|#547c54','#e6e6e1|#626b60','#f3e9d9|#8a714e','#e1eccc|#5d7d42','#f1e4de|#a47a72'];
  const authorColors=new Map(participants.map((name,i)=>[name,palette[i%palette.length].split('|')]));
  const STORAGE='grindey-archive-bookmarks-v1';
  let saved=[];
  try{const val=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(Array.isArray(val))saved=val.filter(id=>byId.has(id));}catch{}
  let toastTimer=null;
  const state={view:'chat',query:'',author:'all',type:'all',day:'all',sort:'asc',quick:new Set(),loaded:70,galleryMedia:'all',galleryQuery:'',similar:null,lightboxIndex:-1,lightboxList:[]};
  const kindNames={photo:'ФОТО',sticker:'СТІКЕР',video:'ВІДЕО',audio:'ГОЛОСОВЕ',file:'ФАЙЛ'};
  const kindIcons={photo:'📷',sticker:'🐸',video:'▶',audio:'🎙',file:'📎'};
  const notes={chat:'Уся розмова',gallery:'Медіатека',chronicle:'Хроніка',saved:'Закладки',about:'Про архів'};
  function notice(txt){const el=$('toast');el.textContent=txt;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3200);}
  function writeSaved(){try{localStorage.setItem(STORAGE,JSON.stringify(saved));}catch{}$('navSaved').textContent=saved.length;}
  function toggleSaved(id){saved=saved.includes(id)?saved.filter(v=>v!==id):[...saved,id];writeSaved();document.querySelectorAll('[data-save]').forEach(b=>{if(b.dataset.save===id){const active=saved.includes(id);b.classList.toggle('is-saved',active);b.textContent=active?'♥':'♡';b.setAttribute('aria-label',active?'Видалити із закладок':'Додати до закладок');}});if(state.view==='saved')renderSaved();}
  function setView(view, opts={}){
    if(!notes[view])return;
    state.view=view;
    ['chat','gallery','chronicle','saved','about'].forEach(v=>$(v+'View').hidden=v!==view);
    $('hero').hidden=view!=='chat';document.querySelector('.stat-strip').hidden=view!=='chat';
    $('currentSection').textContent=notes[view];
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    document.title='Гріндей · '+notes[view]+' 🐸';
    $('sidebar').classList.remove('open');$('menuOverlay').hidden=true;
    if(view==='chat')renderChat();else if(view==='gallery')renderGallery();else if(view==='saved')renderSaved();
    if(opts.scroll!==false)window.scrollTo({top:0,behavior:'instant'});
  }
  function selectDay(day){state.day=day;state.loaded=70;$('dayFilter').value=day;state.type='all';$('typeFilter').value='all';state.quick.clear();document.querySelectorAll('.filter-chip').forEach(x=>x.classList.remove('active'));setView('chat');document.getElementById('chatView').scrollIntoView({behavior:'smooth',block:'start'});}
  function populate(){
    $('statEntries').textContent=report.total_entries.toLocaleString('uk-UA');
    $('statMembers').textContent=participants.length;
    $('statPhotos').textContent=mediaItems.filter(a=>a.kind==='photo'||a.kind==='sticker').length;
    $('statDays').textContent=indexedDays.length;
    $('navMessages').textContent=report.messages;
    $('navMedia').textContent=mediaItems.length;
    writeSaved();
    for(const p of participants){const o=new Option(p,p);$('authorFilter').append(o);}
    for(const d of indexedDays){$('dayFilter').add(new Option(dateLabel(d),d));}
    const counts=new Map(indexedDays.map(d=>[d,messages.filter(m=>m.date===d&&m.kind==='message').length]));
    $('sidebarDates').innerHTML=indexedDays.map(d=>`<button class="date-jump" type="button" data-day="${d}"><b>${esc(dateShort(d))}</b><span>${counts.get(d)} ↗</span></button>`).join('');
    const max=Math.max(...counts.values());
    $('dayTimeline').innerHTML=indexedDays.map(d=>{const n=counts.get(d);return `<div class="day-entry"><div class="day-leaf">${n>=70?'🐸':n>=30?'🪷':'🍃'}</div><button class="day-card" data-day="${d}" type="button"><span class="day-date">${esc(dateShort(d))}<small>2026 · листопад</small></span><span class="day-bar"><span style="width:${(n/max*100).toFixed(1)}%"></span></span><span class="day-num">${n}</span></button></div>`;}).join('');
    $('memberBars').innerHTML=Object.entries(report.authors).sort((a,b)=>b[1]-a[1]).map(([name,n])=>`<div class="member-bar-row"><span class="member-name">${esc(name)}</span><span class="member-track"><span style="width:${(n/report.messages*100).toFixed(1)}%"></span></span><span class="member-value">${n}</span></div>`).join('');
    $('coverageText').textContent=`Збережено ${report.total_entries} записів: ${report.messages} повідомлень та ${report.service} службових подій. Також ${mediaItems.length} вкладень, ${report.reply_messages} відповідей на повідомлення й ${report.reaction_messages} повідомлень із реакціями.`;
    if(window.INLINE_ASSETS){
      $('originalLink').removeAttribute('href');$('originalLink').textContent='Оригінал — у ZIP ↗';$('originalLink').addEventListener('click',e=>{e.preventDefault();notice('Повний оригінал Telegram міститься у ZIP-версії архіву.');});
    }
  }
  function filters(){
    let out=messages.filter(m=>{
      if(state.author!=='all' && m.sender!==state.author)return false;
      if(state.day!=='all' && m.date!==state.day)return false;
      if(state.query&&!norm(m.search).includes(norm(state.query)))return false;
      if(state.type==='message' && m.kind!=='message')return false;
      if(state.type==='service' && m.kind!=='service')return false;
      if(state.type==='reply' && !m.reply)return false;
      if(['photo','sticker','video','audio','file'].includes(state.type)&&!m.media.some(a=>a.kind===state.type))return false;
      if(state.quick.has('photo')&&!m.media.some(a=>a.kind==='photo'))return false;
      if(state.quick.has('reactions')&&!m.reactions.length)return false;
      if(state.quick.has('reply')&&!m.reply)return false;
      if(state.quick.has('favorites')&&!saved.includes(m.id))return false;
      return true;
    });
    if(state.sort==='desc')out.reverse();
    return out;
  }
  function hilite(root,query){
    if(!query||query.length>140)return;
    const t=norm(query);
    if(!t)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){return node.parentElement.closest('a,button,mark,style,script')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){const val=node.textContent,at=norm(val).indexOf(t);if(at<0)continue;
      // Index on the original lower-cased string to keep accents and Unicode composed text intact.
      const lower=val.toLocaleLowerCase('uk-UA');const pos=lower.indexOf(query.toLocaleLowerCase('uk-UA'));if(pos<0)continue;
      const span=document.createElement('span'),before=val.slice(0,pos),word=val.slice(pos,pos+query.length),after=val.slice(pos+query.length);
      span.append(document.createTextNode(before));const mark=document.createElement('mark');mark.textContent=word;span.append(mark,document.createTextNode(after));node.parentNode.replaceChild(span,node);
    }
  }
  function mediaMarkup(a){
    const url=esc(srcFor(a.path));const label=esc(a.name);const uid=esc(a.uid);
    if(a.kind==='photo'||a.kind==='sticker')return `<img tabindex="0" role="button" data-open-media="${uid}" class="media-image ${a.kind==='sticker'?'sticker-image':''}" loading="lazy" alt="${esc(a.tags||a.name)}" src="${url}">`;
    if(a.kind==='video')return `<div class="video-inline"><video controls playsinline preload="none" ${a.thumb?'poster="'+esc(srcFor(a.thumb))+'"':''}><source src="${url}" type="${a.path.endsWith('.webm')?'video/webm':'video/mp4'}">Відео не підтримується браузером.</video><small>🎞 ${label}${a.detail?' · '+esc(a.detail):''}</small></div>`;
    if(a.kind==='audio')return `<div class="audio-box"><span class="audio-icon">🎙</span><div><div class="file-name">Голосове повідомлення · ${esc(a.detail)}</div><audio controls preload="none"><source src="${url}" type="audio/ogg">Аудіо не підтримується браузером.</audio></div></div>`;
    return `<a class="file-box" href="${url}" download="${esc(a.path.split('/').pop())}" title="Зберегти вкладення"><span class="file-icon">📎</span><span><span class="file-name">${label}</span><span class="file-detail">${esc(a.detail||'Вкладений файл')}</span></span><span class="file-download">↓</span></a>`;
  }
  function reactionMarkup(m){return m.reactions.length?`<div class="react-row">${m.reactions.map(r=>`<span class="reaction-pill" title="${esc(r.people.join(', '))}"><span class="emoji">${esc(r.emoji)}</span><small>${r.people.length}</small></span>`).join('')}</div>`:'';}
  function msgMarkup(m){
    const id=esc(m.id);const allMedia=m.media.map((a,i)=>mediaMarkup({...a,uid:m.id+':'+i})).join('');
    if(m.kind==='service')return `<div class="service-row" id="m-${id}" data-record="${id}"><div class="service-point">✳</div><div class="service-bubble">${esc(m.service)}${m.media.length?'<div class="media-display">'+allMedia+'</div>':''}</div></div>`;
    const colors=authorColors.get(m.sender)||['#e5edda','#4e7a53'];
    const reply=byId.get(m.reply);
    const pollHTML=m.poll?`<div class="poll-card"><div class="poll-overline">📊 ${esc(m.poll.label||'Опитування')}</div><h4>${esc(m.poll.question)}</h4>${m.poll.options.map(o=>`<div class="poll-option"><span>${esc(o.text)}</span>${o.detail?`<small>${esc(o.detail)}</small>`:''}</div>`).join('')}<div class="poll-total">${esc(m.poll.total)}</div></div>`:'';
    const replyLabel=reply?(reply.text||reply.service||reply.media.map(a=>a.name).join(', ')||'Медіафайл').slice(0,110):'Повідомлення поза доступною частиною експорту';
    return `<div class="message-row" id="m-${id}" data-record="${id}"><div class="timeline-point"></div><article class="message-card"><div class="message-head"><div class="author-part"><span class="avatar" style="--avatar-bg:${colors[0]};--avatar-ink:${colors[1]}">${esc(initials(m.sender))}</span><div class="author-data"><strong>${esc(m.sender||'Невідомий автор')}</strong><small>${esc(m.date?dateShort(m.date):'Без дати')}</small></div></div><div class="message-actions"><span class="time-label" title="${esc(m.timestamp)}">${esc(m.clock)}</span><button class="save-button ${saved.includes(m.id)?'is-saved':''}" type="button" data-save="${id}" aria-label="${saved.includes(m.id)?'Видалити із закладок':'Додати до закладок'}">${saved.includes(m.id)?'♥':'♡'}</button><button class="permalink-button" type="button" data-permalink="${id}" aria-label="Скопіювати посилання на повідомлення" title="Посилання на повідомлення">↗</button></div></div><div class="message-body">${m.reply?`<button class="reply-link" type="button" data-jump="${esc(m.reply)}">↩ У відповідь на повідомлення<span>${esc(replyLabel)}</span></button>`:''}${m.forwarded?`<div class="fwd-label">⇢ Переслано від <strong>${esc(m.forwarded.sender||'—')}</strong></div>`:''}${m.html?`<div class="message-text">${m.html}</div>`:''}${allMedia?`<div class="media-display">${allMedia}</div>`:''}${pollHTML}${reactionMarkup(m)}</div></article></div>`;
  }
  function renderChat(){
    const filtered=filters();$('resultsNumber').textContent=filtered.length.toLocaleString('uk-UA');$('resultsLabel').textContent='записів';$('resultsSub').textContent=state.query?'Знайдено за запитом: «'+state.query+'»':'Повний архів · листопад 2026';
    const end=Math.min(state.loaded,filtered.length);let current='';const chunks=[];
    for(const m of filtered.slice(0,end)){
      if(m.date!==current){current=m.date;const count=filtered.filter(x=>x.date===current).length;chunks.push(`<div class="day-divider"><span>${esc(dateLabel(current))}</span><small>${count} записів</small></div>`);}
      chunks.push(msgMarkup(m));
    }
    const target=$('messageStream');target.innerHTML=chunks.join('');if(state.query){target.querySelectorAll('.message-text,.service-bubble').forEach(el=>hilite(el,state.query));}
    $('loadMore').hidden=end>=filtered.length;$('emptyChat').hidden=filtered.length!==0;
  }
  function resetFilters(){state.query='';state.day='all';state.author='all';state.type='all';state.sort='asc';state.quick.clear();state.loaded=70;$('searchInput').value='';$('authorFilter').value='all';$('typeFilter').value='all';$('dayFilter').value='all';$('sortFilter').value='asc';document.querySelectorAll('.filter-chip').forEach(b=>b.classList.remove('active'));renderChat();}
  function jumpToMessage(id){
    const rec=byId.get(id);if(!rec){notice('Цього повідомлення немає в наданому експорті.');return;}
    // Ensure the message remains visible even if previous filters hid it.
    state.query='';state.author='all';state.day='all';state.type='all';state.sort='asc';state.quick.clear();state.loaded=Math.max(70,rec.seq+30);$('searchInput').value='';$('authorFilter').value='all';$('typeFilter').value='all';$('dayFilter').value='all';$('sortFilter').value='asc';document.querySelectorAll('.filter-chip').forEach(b=>b.classList.remove('active'));
    closeLightbox();setView('chat',{scroll:false});
    requestAnimationFrame(()=>{const el=$('m-'+id);if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('jump-target');setTimeout(()=>el.classList.remove('jump-target'),1700);});
  }
  function galleryFilter(){
    let arr=mediaItems.filter(a=>state.galleryMedia==='all'||a.kind===state.galleryMedia);
    if(state.galleryQuery){const q=norm(state.galleryQuery);arr=arr.filter(a=>norm([a.name,a.tags,a.path,a.sender,a.messageText,a.service,a.date].join(' ')).includes(q));}
    if(state.similar){arr=pictureItems.map(a=>({...a,match:compareFeatures(state.similar,a.feature)})).filter(a=>state.galleryMedia==='all'||state.galleryMedia===a.kind).filter(a=>!state.galleryQuery||norm([a.name,a.tags,a.path,a.sender,a.messageText,a.date].join(' ')).includes(norm(state.galleryQuery))).sort((a,b)=>b.match-a.match).slice(0,14);}
    return arr;
  }
  function galleryCard(a){
    const title=esc(a.kind==='photo'?(a.tags.split(' ').slice(0,6).join(' ')||a.name):a.name);
    const poster=a.thumb||a.path;
    const image=['photo','sticker'].includes(a.kind),video=a.kind==='video';
    const art=image||video?`<img loading="lazy" src="${esc(srcFor(image?a.path:(a.thumb||'')))}" ${!image&&!a.thumb?'hidden':''} alt="${esc(a.tags||a.name)}">${!image&&!a.thumb?'<span class="media-glyph">🎞</span>':''}`:`<span class="media-glyph">${kindIcons[a.kind]}</span>`;
    const label=(a.kind==='photo'||a.kind==='sticker')?(a.tags||a.name):a.name;
    return `<article class="gallery-item ${a.match!=null?'similar-match':''}"><button class="gallery-art" data-gallery-uid="${esc(a.uid)}" type="button" title="Відкрити файл">${art}<span class="art-kind">${esc(kindNames[a.kind])}</span>${a.match!=null?'<span class="match-badge">≈ '+a.match+'% схожості</span>':''}</button><div class="gallery-body"><strong title="${esc(label)}">${esc(label||a.name)}</strong><p>${esc(a.sender||'Подія чату')} · ${esc(dateShort(a.date))}</p><div class="gallery-bottom"><span>${a.kind==='file'?'📎 Вкладення':'↗ Історія'}</span><button type="button" data-jump="${esc(a.messageId)}">До повідомлення ↗</button></div></div></article>`;
  }
  function renderGallery(){const items=galleryFilter();$('galleryCount').textContent=items.length.toLocaleString('uk-UA');$('galleryNote').textContent=state.similar?'візуальних збігів — від найближчих до найвіддаленіших':'файлів у колекції';$('galleryGrid').innerHTML=items.map(galleryCard).join('');$('emptyGallery').hidden=items.length!==0;}
  function renderSaved(){const items=saved.map(id=>byId.get(id)).filter(Boolean).sort((a,b)=>a.seq-b.seq);$('savedEmpty').hidden=items.length>0;let current='';$('savedStream').innerHTML=items.map(m=>{let intro='';if(m.date!==current){current=m.date;intro=`<div class="day-divider"><span>${esc(dateLabel(current))}</span></div>`;}return intro+msgMarkup(m);}).join('');}
  function openMedia(uid){let list=galleryFilter();if(!list.some(x=>x.uid===uid))list=mediaItems;const idx=list.findIndex(x=>x.uid===uid);if(idx<0)return;state.lightboxList=list;state.lightboxIndex=idx;drawLightbox();$('lightbox').hidden=false;body.style.overflow='hidden';}
  function drawLightbox(){const a=state.lightboxList[state.lightboxIndex];if(!a)return;const url=srcFor(a.path);$('lightboxCounter').textContent=(state.lightboxIndex+1)+' / '+state.lightboxList.length;$('lightboxName').textContent=a.name;$('lightboxDescription').textContent=(a.sender||'Подія чату')+' · '+dateLabel(a.date)+' · '+(a.tags||kindNames[a.kind]);$('downloadMedia').href=url;$('downloadMedia').download=a.path.split('/').pop();$('goToMediaMessage').dataset.jump=a.messageId;$('lightboxPrev').disabled=state.lightboxIndex<=0;$('lightboxNext').disabled=state.lightboxIndex>=state.lightboxList.length-1;const el=$('lightboxMedia');el.replaceChildren();let node;
    if(a.kind==='photo'||a.kind==='sticker'){node=document.createElement('img');node.src=url;node.alt=a.tags||a.name;}
    else if(a.kind==='audio'){node=document.createElement('audio');node.controls=true;node.autoplay=false;node.src=url;}
    else if(a.kind==='video'){node=document.createElement('video');node.controls=true;node.playsInline=true;node.preload='metadata';node.src=url;if(a.thumb)node.poster=srcFor(a.thumb);}
    else{node=document.createElement('a');node.textContent='↓ Зберегти '+a.name;node.href=url;node.download=a.path.split('/').pop();}
    el.append(node);
  }
  function closeLightbox(){if(!$('lightbox').hidden){$('lightbox').hidden=true;$('lightboxMedia').replaceChildren();body.style.overflow='';}}
  function nextMedia(step){const n=state.lightboxIndex+step;if(n>=0&&n<state.lightboxList.length){state.lightboxIndex=n;drawLightbox();}}
  function featureFromFile(file){return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);const image=new Image();image.onload=()=>{try{
      function pixels(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,w,h);return ctx.getImageData(0,0,w,h).data;}
      const gray=(v,i)=>.299*v[i]+.587*v[i+1]+.114*v[i+2];
      const nine=pixels(9,8),d=[];for(let y=0;y<8;y++){for(let x=0;x<8;x++){const j=(y*9+x)*4;d.push(gray(nine,j)>gray(nine,j+4)?'1':'0');}}
      const eight=pixels(8,8);let sum=0;const lum=[];for(let i=0;i<64;i++){const q=gray(eight,i*4);lum.push(q);sum+=q;}const avg=sum/64;
      const four=pixels(4,4),c=[];for(let i=0;i<16;i++)for(let k=0;k<3;k++)c.push(Math.round(four[i*4+k]/255*1000)/1000);
      resolve({d:d.join(''),a:lum.map(x=>x>=avg?'1':'0').join(''),c,w:image.naturalWidth,h:image.naturalHeight});
    }catch(e){reject(e);}finally{URL.revokeObjectURL(url);}};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Не вдалося прочитати картинку.'));};image.src=url;
  });}
  function compareFeatures(a,b){if(a.fingerprint && b.fingerprint && a.fingerprint===b.fingerprint)return 100;if(a.sha256 && b.sha256 && a.sha256===b.sha256)return 100;let d=0,ah=0;for(let i=0;i<64;i++){d+=a.d[i]===b.d[i]?0:1;ah+=a.a[i]===b.a[i]?0:1;}let color=0;for(let i=0;i<48;i++)color+=Math.abs(a.c[i]-b.c[i]);color/=48;const ar1=a.w/a.h,ar2=b.w/b.h,ratio=Math.min(1,Math.abs(Math.log(ar1/ar2))/2);const distance=.54*d/64+.2*ah/64+.19*color+.07*ratio;return Math.max(0,Math.min(100,Math.round((1-distance)*100)));}
  async function searchImage(file){if(!file||!file.type.startsWith('image/')){notice('Обери зображення у форматі JPG, PNG, WebP тощо.');return;}if(file.size>30*1024*1024){notice('Зображення надто велике (понад 30 МБ).');return;}
    $('imageSearchStatus').textContent='Порівнюю зі світлинами…';try{state.similar=await featureFromFile(file);
    try{let h=2166136261>>>0;for(const byte of new Uint8Array(await file.arrayBuffer()))h=Math.imul(h^byte,16777619)>>>0;state.similar.fingerprint=h.toString(16).padStart(8,'0');}catch{}
    try{if(globalThis.crypto?.subtle){const digest=await globalThis.crypto.subtle.digest('SHA-256',await file.arrayBuffer());state.similar.sha256=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');}}catch{}
    const url=URL.createObjectURL(file);const preview=$('imageSearchPreview');preview.replaceChildren();const img=document.createElement('img');img.className='image-search-preview-thumb';img.alt='Завантажений зразок';img.src=url;img.onload=()=>URL.revokeObjectURL(url);const span=document.createElement('span');span.className='image-search-notice';span.textContent='Зразок: '+file.name+' · приблизна візуальна схожість';preview.append(img,span);preview.hidden=false;$('clearImageSearch').hidden=false;$('imageSearchStatus').textContent='Порівняння виконане лише на цьому пристрої';renderGallery();}catch(e){$('imageSearchStatus').textContent='Помилка читання зображення';notice(String(e.message||e));}}
  function clearImageSearch(){state.similar=null;$('imageInput').value='';$('clearImageSearch').hidden=true;$('imageSearchPreview').hidden=true;$('imageSearchStatus').textContent='Працює навіть без інтернету';renderGallery();}
  function onClick(e){
    const view=e.target.closest('[data-view]');if(view){setView(view.dataset.view);return;}
    const day=e.target.closest('[data-day]');if(day){selectDay(day.dataset.day);return;}
    const save=e.target.closest('[data-save]');if(save){toggleSaved(save.dataset.save);return;}
    const jump=e.target.closest('[data-jump]');if(jump){jumpToMessage(jump.dataset.jump);return;}
    const goto=e.target.closest('[data-gallery-uid],[data-open-media]');if(goto){const uid=goto.dataset.galleryUid||goto.dataset.openMedia;const a=mediaMap.get(uid);if(a?.kind==='file'){const anchor=document.createElement('a');anchor.href=srcFor(a.path);anchor.download=a.path.split('/').pop();anchor.click();}else openMedia(uid);return;}
    const permalink=e.target.closest('[data-permalink]');if(permalink){const id=permalink.dataset.permalink;const url=location.href.split('#')[0]+'#m-'+encodeURIComponent(id);if(navigator.clipboard?.writeText){navigator.clipboard.writeText(url).then(()=>notice('Посилання на повідомлення скопійоване!')).catch(()=>{location.hash='m-'+encodeURIComponent(id);notice('Посилання з’явилося в адресному рядку.');});}else{location.hash='m-'+encodeURIComponent(id);notice('Посилання з’явилося в адресному рядку.');}return;}
  }
  function setup(){
    populate();$('sidebarNav').addEventListener('click',onClick);document.querySelector('.mobile-bottom').addEventListener('click',onClick);$('sidebarDates').addEventListener('click',onClick);$('dayTimeline').addEventListener('click',onClick);$('messageStream').addEventListener('click',onClick);$('savedStream').addEventListener('click',onClick);$('galleryGrid').addEventListener('click',onClick);$('lightbox').addEventListener('click',onClick);
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setView('chat');$('chatView').scrollIntoView({behavior:'smooth'});$('searchInput').focus();}if(e.key==='Escape'){closeLightbox();$('sidebar').classList.remove('open');$('menuOverlay').hidden=true;}if(!$('lightbox').hidden&&e.key==='ArrowRight')nextMedia(1);if(!$('lightbox').hidden&&e.key==='ArrowLeft')nextMedia(-1);});
    $('searchInput').addEventListener('input',e=>{state.query=e.target.value;state.loaded=70;renderChat();});
    for(const [id,key] of [['authorFilter','author'],['typeFilter','type'],['dayFilter','day'],['sortFilter','sort']])$(id).addEventListener('change',e=>{state[key]=e.target.value;state.loaded=70;renderChat();});
    $('clearFilters').addEventListener('click',resetFilters);$('emptyReset').addEventListener('click',resetFilters);$('loadMore').addEventListener('click',()=>{state.loaded+=80;renderChat();});
    document.querySelectorAll('.filter-chip').forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.quick;if(state.quick.has(key))state.quick.delete(key);else state.quick.add(key);btn.classList.toggle('active',state.quick.has(key));state.loaded=70;renderChat();}));
    document.querySelectorAll('.gallery-chip').forEach(btn=>btn.addEventListener('click',()=>{state.galleryMedia=btn.dataset.media;document.querySelectorAll('.gallery-chip').forEach(x=>x.classList.toggle('active',x===btn));renderGallery();}));
    $('gallerySearch').addEventListener('input',e=>{state.galleryQuery=e.target.value;renderGallery();});
    $('imageInput').addEventListener('change',e=>searchImage(e.target.files?.[0]));$('clearImageSearch').addEventListener('click',clearImageSearch);
    const dropPanel=document.querySelector('.image-search-panel');dropPanel.addEventListener('dragover',e=>{e.preventDefault();dropPanel.classList.add('drag-over');});dropPanel.addEventListener('dragleave',()=>dropPanel.classList.remove('drag-over'));dropPanel.addEventListener('drop',e=>{e.preventDefault();dropPanel.classList.remove('drag-over');searchImage(e.dataTransfer?.files?.[0]);});
    $('closeLightbox').addEventListener('click',closeLightbox);$('lightboxPrev').addEventListener('click',()=>nextMedia(-1));$('lightboxNext').addEventListener('click',()=>nextMedia(1));
    $('diveButton').addEventListener('click',()=>$('chatView').scrollIntoView({behavior:'smooth',block:'start'}));
    $('openGalleryButton').addEventListener('click',()=>setView('gallery'));
    $('randomButton').addEventListener('click',()=>{const pool=messages.filter(m=>m.kind==='message');jumpToMessage(pool[Math.floor(Math.random()*pool.length)].id);});
    $('savedGoChat').addEventListener('click',()=>setView('chat'));
    $('backToTop').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
    $('menuButton').addEventListener('click',()=>{$('sidebar').classList.add('open');$('menuOverlay').hidden=false;});$('menuOverlay').addEventListener('click',()=>{$('sidebar').classList.remove('open');$('menuOverlay').hidden=true;});
    $('homeBrand').addEventListener('click',e=>{e.preventDefault();setView('chat');});
    // Inline images also accept Enter/Space, not only pointer input.
    document.addEventListener('keydown',e=>{if(e.target.matches('[data-open-media]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openMedia(e.target.dataset.openMedia);}});
    setView('chat',{scroll:false});
    if(location.hash.startsWith('#m-')){const id=decodeURIComponent(location.hash.slice(3));setTimeout(()=>jumpToMessage(id),150);}
    window.ARCHIVE_DIAGNOSTICS={entries:messages.length,media:mediaItems.length,photos:mediaItems.filter(x=>x.kind==='photo').length,replies:messages.filter(m=>m.reply).length,service:messages.filter(m=>m.kind==='service').length,missingReferences:report.missing_referenced_assets.length};
  }
  setup();
})();
