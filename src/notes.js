import {withinPlot} from './site-data.js';

export const MAX_NOTES=120;
const key='kerbukovo-notes-1';
export const documentFor=(notes)=>({project:'kerbukovo',version:1,notes});

export function readDocument(raw) {
    if(!raw || raw.project!=='kerbukovo' || raw.version!==1 || !Array.isArray(raw.notes) || raw.notes.length>MAX_NOTES)
        throw Error('Неподдерживаемый формат пометок.');
    const used=new Set();
    return raw.notes.map(n=>{
        if(!n || typeof n.id!=='string' || !/^[a-zA-Z0-9-]{1,75}$/.test(n.id) || used.has(n.id)
            || typeof n.title!=='string' || !n.title.trim() || n.title.length>90
            || typeof n.text!=='string' || n.text.length>600
            || !Number.isFinite(n.x) || !Number.isFinite(n.z) || !withinPlot(n.x,n.z)
            || n.offset!==undefined && (!Number.isFinite(n.offset)||n.offset<0||n.offset>17))
            throw Error('В файле есть некорректная пометка.');
        used.add(n.id);
        return {id:n.id,x:n.x,z:n.z,offset:n.offset||0,title:n.title.trim(),text:n.text};
    });
}
export function restore() {
    try {
        const stored=localStorage.getItem(key);
        return stored?readDocument(JSON.parse(stored)):[];
    } catch {return [];}
}
export function save(notes) {
    try {localStorage.setItem(key,JSON.stringify(documentFor(notes)));return true;}
    catch {return false;}
}
export function decodeLink(hash) {
    if(!hash.startsWith('#notes=')) return null;
    const value=hash.slice(7);
    if(!/^[a-zA-Z0-9_-]{1,14000}$/.test(value)) throw Error('Повреждена ссылка с пометками.');
    const bytes=Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
    return readDocument(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}
export function shareLink(notes,url) {
    if(!url) throw Error('В этой копии можно передать пометки через экспорт JSON.');
    const bytes=new TextEncoder().encode(JSON.stringify(documentFor(notes)));
    if(bytes.length>10390) throw Error('Для такого объёма пометок используйте экспорт JSON.');
    const encoded=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
    const target=new URL(url);
    target.hash='notes='+encoded;
    return target.href;
}
