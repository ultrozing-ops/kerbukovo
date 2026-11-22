import {objects} from './site-data.js';
import {setupViewer} from './viewer.js';
import {MAX_NOTES,documentFor,readDocument,restore,save,decodeLink,shareLink} from './notes.js';

const $=id=>document.getElementById(id);
const form=$('note-form'), title=$('note-title'), detail=$('note-detail'), toast=$('toast');
const viewport=$('viewport'), hint=$('mode-hint'), cameraLabel=$('camera-label');
const modeButtons=[...document.querySelectorAll('button[data-mode]')];
const tabButtons=[...document.querySelectorAll('button[data-panel]')];
const svg=(name,cls='icon')=>'<svg class="'+cls+'" aria-hidden="true"><use href="#i-'+name+'"/></svg>';
const hints={
    orbit:'Перетаскивание — поворот · Колесо — масштаб',
    walk:matchMedia('(pointer: coarse)').matches ? 'Кнопки — идти · Перетаскивание — взгляд' : 'W A S D или стрелки — идти · Мышь с нажатой кнопкой — взгляд',
    plan:'Вид сверху · Колесо — масштаб · Правая кнопка — сдвиг',
};
const labels={orbit:'Вид участка',walk:'Прогулка',plan:'План · север сверху'};
let notes=restore(), selected=null, draft=null, editId=null, mode='orbit', panel='objects', isPlacing=false, viewer, toastTimer;

function tell(text) {
    clearTimeout(toastTimer);
    toast.textContent=text;
    toast.hidden=false;
    toastTimer=setTimeout(()=>{toast.hidden=true;},4100);
}

function panelTo(newPanel) {
    panel=newPanel;
    tabButtons.forEach(b=>{
        const active=b.dataset.panel===panel;
        b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);
    });
    for (const name of ['objects','notes']) $(name+'-panel').hidden=panel!==name;
}

function hintText() {
    hint.textContent=isPlacing?'Выберите точку на участке · Esc — отмена':hints[mode];
}

function place(value) {
    if(value&&!viewer) return;
    isPlacing=value;
    viewport.classList.toggle('placing',value);
    $('add-note').setAttribute('aria-pressed',value);
    $('add-note').querySelector('span').textContent=value?'Отменить':'Пометка';
    viewer?.setPlacing(value);
    hintText();
}

function resetForm() {
    form.hidden=true;
    draft=null;
    editId=null;
    selected=null;
    form.reset();
}

function onPoint(point) {
    if(!point) {tell('Выберите точку внутри границы участка.');return;}
    place(false);
    resetForm();
    draft=point;
    panelTo('notes');
    $('note-form-heading').textContent='Новая пометка';
    $('delete-note').hidden=true;
    form.hidden=false;
    refresh();
    title.focus();
    if(innerWidth<=850) form.scrollIntoView({block:'nearest',behavior:'smooth'});
}

function edit(id,getCloser=false) {
    const note=notes.find(n=>n.id===id);
    if(!note) return;
    place(false);
    draft={x:note.x,z:note.z,offset:note.offset};
    selected=editId=id;
    panelTo('notes');
    $('note-form-heading').textContent='Редактирование пометки';
    title.value=note.title;
    detail.value=note.text;
    $('delete-note').hidden=false;
    form.hidden=false;
    refresh();
    if(getCloser) viewer?.focus(note,4);
    if(innerWidth<=850 && !getCloser) form.scrollIntoView({block:'nearest',behavior:'smooth'});
}

function refresh() {
    $('note-count').textContent=String(notes.length);
    $('notes-empty').hidden=notes.length>0||!form.hidden;
    $('export-notes').disabled=notes.length===0;
    $('share-notes').hidden=notes.length===0;
    $('notes-list').replaceChildren(...notes.map((note,i)=>{
        const button=document.createElement('button');
        button.type='button';button.className='note-row';
        button.classList.toggle('active',selected===note.id);
        const number=document.createElement('span');
        number.className='note-index';number.textContent=String(i+1);
        const line=document.createElement('span');
        const name=document.createElement('strong');
        name.textContent=note.title;line.appendChild(name);
        if (note.text) {
            const p=document.createElement('p');p.textContent=note.text;line.appendChild(p);
        }
        button.append(number,line);
        button.addEventListener('click',()=>edit(note.id,true));
        return button;
    }));
    viewer?.setPins(notes,selected);
}

function persist(message) {
    const ok=save(notes);
    refresh();
    tell(ok?message:message+' Память браузера недоступна, сохраните JSON.');
}

function merge(incoming) {
    const current=new Set(notes.map(n=>n.id));
    const added=incoming.filter(n=>!current.has(n.id));
    if(notes.length+added.length>MAX_NOTES) throw Error('В проекте помещается до '+MAX_NOTES+' пометок.');
    notes=[...notes,...added];
    panelTo('notes');
    persist(added.length?'Добавлено пометок: '+added.length:'Эти пометки уже открыты.');
}

for(const item of objects) {
    const row=document.createElement('button');
    row.className='object-row';row.type='button';row.dataset.object=item.id;
    row.innerHTML='<span class="object-glyph '+item.icon+'">'+svg(item.icon)+'</span>'
        +'<span><strong>'+item.name+'</strong><small>'+item.detail+'</small></span>'+svg('chevron','icon row-arrow');
    row.addEventListener('click',()=>{
        document.querySelector('.object-row.active')?.classList.remove('active');
        row.classList.add('active');
        viewer?.focus(item.at,item.size);
        if(mode==='walk') viewport.focus({preventScroll:true});
        if(innerWidth<=850) viewport.scrollIntoView({block:'nearest',behavior:'smooth'});
    });
    $('objects-list').appendChild(row);
}

for(const btn of tabButtons) btn.addEventListener('click',()=>panelTo(btn.dataset.panel));
for(const btn of modeButtons) btn.addEventListener('click',()=>{
    if(!viewer || mode===btn.dataset.mode) return;
    mode=btn.dataset.mode;
    for (const b of modeButtons) {
        const active=b.dataset.mode===mode;
        b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);
    }
    $('touch-controls').hidden=mode!=='walk';
    cameraLabel.textContent=labels[mode];
    document.querySelector('.object-row.active')?.classList.remove('active');
    viewer.setMode(mode);
    hintText();
    viewport.focus({preventScroll:true});
});
$('reset-view').addEventListener('click',()=>{
    document.querySelector('.object-row.active')?.classList.remove('active');
    viewer?.reset();
    viewport.focus({preventScroll:true});
});
for(const id of ['water','power']) {
    const btn=$(id+'-layer');
    btn.addEventListener('click',()=>{
        const value=btn.getAttribute('aria-pressed')!=='true';
        btn.setAttribute('aria-pressed',value);btn.classList.toggle('active',value);
        viewer?.setLayer(id,value);
    });
}
$('add-note').addEventListener('click',()=>{
    if(!isPlacing&&notes.length>=MAX_NOTES) {tell('Достигнут предел пометок.');return;}
    place(!isPlacing);
    if(isPlacing) viewport.focus({preventScroll:true});
});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&isPlacing) place(false);});
$('cancel-note').addEventListener('click',()=>{resetForm();refresh();});
form.addEventListener('submit',e=>{
    e.preventDefault();
    if(!draft) return;
    const name=title.value.trim();
    if(!name) {title.focus();tell('Введите название пометки.');return;}
    const id=editId||(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
    const note={...draft,id,title:name,text:detail.value.trim()};
    if(editId) notes=notes.map(n=>n.id===editId?note:n);
    else if(notes.length<MAX_NOTES) notes=[...notes,note];
    else {tell('Достигнут предел пометок.');return;}
    resetForm();selected=id;
    persist('Пометка сохранена.');
});
$('delete-note').addEventListener('click',()=>{
    if(!editId || !confirm('Удалить эту пометку из браузера?')) return;
    notes=notes.filter(n=>n.id!==editId);
    resetForm();persist('Пометка удалена.');
});
$('export-notes').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(documentFor(notes),null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='kerbukovo-notes.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('import-notes').addEventListener('click',()=>$('notes-file').click());
$('notes-file').addEventListener('change',async e=>{
    const file=e.target.files[0];
    e.target.value='';
    if(!file) return;
    try {
        if(file.size>350000) throw Error('Файл слишком большой для пометок.');
        merge(readDocument(JSON.parse(await file.text())));
    } catch(error) {tell(error instanceof SyntaxError?'Файл не похож на JSON с пометками.':error.message);}
});
$('share-notes').addEventListener('click',async ()=>{
    try {
        const base=document.documentElement.dataset.shareUrl || (location.protocol==='https:'?location.href:'');
        const link=shareLink(notes,base);
        try {
            await navigator.clipboard.writeText(link);
            tell('Ссылка с пометками скопирована.');
        } catch {
            const dialog=$('share-dialog');
            $('share-url').value=link;dialog.showModal();$('share-url').select();
        }
    } catch (error) {tell(error.message);}
});
if(location.protocol==='file:') $('download').hidden=true;
try {
    viewer=setupViewer({
        stage:$('stage'),viewport,compass:$('compass-arrow'),cameraLabel,touch:$('touch-controls'),
        onPoint,onPin:(id)=>edit(id)
    });
    $('loading').hidden=true;
} catch(error) {
    console.error(error);
    $('loading').textContent='Для 3D-режима нужен браузер с поддержкой WebGL 2.';
    for(const b of [...modeButtons,$('reset-view'),$('add-note')]) b.disabled=true;
}
refresh();
function loadHash() {
    try {
        const imported=decodeLink(location.hash);
        if(imported) { merge(imported); try { history.replaceState(null,'',location.pathname+location.search); } catch {} }
    } catch {tell('Ссылка с пометками повреждена. Попробуйте импортировать JSON.');}
}
window.addEventListener('hashchange',loadHash);
loadHash();

