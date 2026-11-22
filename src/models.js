import * as T from 'three';
import {boundary, gate, house, porchDepth, bath, cabin, containerA, containerB, heightAt, center,
    trees, surfaces, pole, electricEnd, well, entry, water} from './site-data.js';
import {profileFence} from './profile-fence.js';

const V = (x,y,z) => new T.Vector3(x,y,z);
const standard = (color, roughness=.82, metalness=0) => new T.MeshStandardMaterial({color,roughness,metalness});
const seed = (n) => () => {
    n = (Math.imul(n,1664525) + 1013904223) >>> 0;
    return n / 4294967296;
};

function texture(kind) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const rand = seed({gravel:53,soil:182,sand:273,wood:281,deck:102,meadow:620}[kind]);
    const palettes = {
        sand: ['#ad9b79','#c2ae87','#9a8a69','#a89069','#cbb68b'],
        soil: ['#63523e','#716047','#4c3d2d','#77644c','#5a4a37'],
        gravel: ['#b5b8b1','#afb2ab','#858d87','#c9ccc2','#9a9e96','#9a9c94'],
        wood: ['#d9b683','#c8a374','#e0bf93','#aa885f','#d4a877','#ead0a7'],
        deck: ['#a9855d','#926f4d','#b48b62','#ca9d71','#ae885f'],
        meadow: ['#9ca88b','#a7ae92','#9ba488','#a7af94','#a8ad96'],
    };
    const palette = palettes[kind];
    ctx.fillStyle = palette[0];
    ctx.fillRect(0,0,256,256);
    if (kind === 'wood' || kind === 'deck') {
        for (let y=0; y<256; y+=32) {
            ctx.fillStyle = palette[Math.floor(rand()*palette.length)];
            ctx.fillRect(0,y,256,31);
            ctx.fillStyle = '#634a34';
            ctx.fillRect(0,y+31,256,1);
        }
        for (let i=0; i<720; i++) {
            ctx.fillStyle = rand()<.5?'#75533419':'#fff4d634';
            ctx.fillRect(rand()*256,rand()*256,5+40*rand(),1);
        }
    } else {
        for (let i=0; i<6000; i++) {
            ctx.fillStyle = palette[Math.floor(rand()*palette.length)];
            const x=rand()*256,y=rand()*256;
            const size=kind==='gravel'?1+rand()*3.6:0.4+rand()*1.65;
            ctx.beginPath();
            ctx.ellipse(x,y,size,size*(.48+rand()*.37),rand()*Math.PI,0,Math.PI*2);
            ctx.fill();
        }
    }
    const map = new T.CanvasTexture(canvas);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 8;
    return map;
}

function stretchUV(geometry, dims) {
    const uv = geometry.attributes.uv;
    for (let n=0;n<6;n++) {
        const length=n<2?dims[2]:dims[0];
        const height=n===2||n===3?dims[2]:dims[1];
        for (let j=0;j<4;j++) {
            const i=n*4+j;
            uv.setXY(i,uv.getX(i)*length/2.25,uv.getY(i)*height/1.22);
        }
    }
}

const boxCache = new Map();
function box(parent,mat,x,y,z,w,h,d,{cast=true,receive=true,angle=0,repeat=false}={}) {
    const name = [w,h,d,repeat].join('/');
    if (!boxCache.has(name)) {
        const g = new T.BoxGeometry(w,h,d);
        if (repeat) stretchUV(g,[w,h,d]);
        boxCache.set(name,g);
    }
    const m = new T.Mesh(boxCache.get(name),mat);
    m.position.set(x,y,z); m.rotation.y=angle;
    m.castShadow=cast; m.receiveShadow=receive;
    parent.add(m);
    return m;
}

function beam(parent,mat,a,b,width,thickness=width,cast=true) {
    const d = b.clone().sub(a);
    const m = new T.Mesh(new T.BoxGeometry(width,d.length(),thickness),mat);
    m.position.copy(a).lerp(b,.5);
    m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());
    m.castShadow=cast; m.receiveShadow=true;
    parent.add(m);
    return m;
}

function tube(parent, mat, coords, radius, segments=18) {
    const spline = new T.CatmullRomCurve3(coords);
    const mesh = new T.Mesh(new T.TubeGeometry(spline,segments,radius,6,false),mat);
    mesh.castShadow=false;
    parent.add(mesh);
    return mesh;
}

function cylinder(parent,mat,x,y,z,radius,height,sections=12,topRadius=radius) {
    const m=new T.Mesh(new T.CylinderGeometry(topRadius,radius,height,sections),mat);
    m.position.set(x,y,z);
    m.castShadow=true; m.receiveShadow=true;
    parent.add(m);
    return m;
}

function clipX(poly, line, keepGreater) {
    const result=[];
    for (let i=0;i<poly.length;i++) {
        const a=poly[i],b=poly[(i+1)%poly.length];
        const keep=(p)=>keepGreater?p.x>=line:p.x<=line;
        if(keep(a)) result.push(a);
        if(keep(a)!==keep(b)) {
            const k=(line-a.x)/(b.x-a.x);
            result.push({x:line,z:T.MathUtils.lerp(a.z,b.z,k)});
        }
    }
    return result;
}

function horizontal(poly, y, material, parent) {
    const geom = new T.BufferGeometry();
    geom.setAttribute('position',new T.Float32BufferAttribute(poly.flatMap(({x,z})=>[x,y(x,z),z]),3));
    geom.setAttribute('uv',new T.Float32BufferAttribute(poly.flatMap(({x,z})=>[x/4,z/4]),2));
    const triangles = T.ShapeUtils.triangulateShape(poly.map(({x,z})=>new T.Vector2(x,z)),[]);
    const order = triangles.flatMap(([i,j,k])=>{
        const a=poly[i],b=poly[j],c=poly[k];
        return (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)<0?[i,j,k]:[k,j,i];
    });
    geom.setIndex(order);
    geom.computeVertexNormals();
    const mesh=new T.Mesh(geom,material);
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
}

function wallCap(parent,mat,x,y0,a,b,peak) {
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute([x,y0,a,x,y0,b,x,peak,(a+b)/2],3));
    g.setAttribute('uv',new T.Float32BufferAttribute([0,0,(b-a)/2.25,0,(b-a)/4.5,(peak-y0)/1.22],2));
    g.computeVertexNormals();
    const cap = new T.Mesh(g,mat);
    cap.castShadow=cap.receiveShadow=true;
    parent.add(cap);
}

function roof(parent,mat,trim,l,r,z0,z1,y0,y1,period=.19) {
    const coords=[], idx=[], sx=Math.max(50,Math.ceil((r-l)/.042)), sz=Math.ceil(Math.abs(z1-z0)/.085);
    for (let j=0;j<=sz;j++) {
        const p=j/sz, z=T.MathUtils.lerp(z0,z1,p);
        for (let i=0;i<=sx;i++) {
            const x=T.MathUtils.lerp(l,r,i/sx);
            const ripple=.020*Math.cos((x-l)/period*2*Math.PI);
            const tile=.009*Math.pow(Math.cos((z-z0)/.34*2*Math.PI),7);
            coords.push(x,T.MathUtils.lerp(y0,y1,p)+ripple+tile,z);
        }
    }
    for (let j=0;j<sz;j++) {
        for(let i=0;i<sx;i++) {
            const a=j*(sx+1)+i,b=a+sx+1;
            idx.push(a,b,a+1,b,b+1,a+1);
        }
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(coords,3));
    g.setIndex(idx); g.computeVertexNormals();
    const m=new T.Mesh(g,mat);
    m.castShadow=m.receiveShadow=true;
    parent.add(m);
    for (const x of [l,r]) beam(parent,trim,V(x,y0,z0),V(x,y1,z1),.08,.07);
}

function makeBuilding(group,foot,opts,m) {
    const {x,z,w,d}=foot;
    const roofMat=opts.roof||m.roof, bodyMat=opts.body||m.wood;
    const openDepth=opts.porch||0;
    const back=z, front=z+d-openDepth;
    const base=heightAt(x+w/2)+(opts.base??.54);
    const top=base+(opts.wall??2.58);
    const ridge=top+(opts.rise??1.64);
    const mid=(back+front)/2;
    const floors=opts.piles?[x+.22,x+w/2,x+w-.22]:[x+.29,x+w-.29];
    for (const ix of floors) for (const iz of [z+.24,(z+front)/2,z+d-.18]) {
        const gy=heightAt(ix), h=base-gy;
        box(group,m.pile,ix,gy+h/2-.015,iz,.22,h,.23);
    }
    box(group,m.deck,x+w/2,base-.075,z+d/2,w,.17,d,{repeat:true});
    box(group,bodyMat,x+w/2,(base+top)/2,(front+back)/2,w,top-base,front-back,{repeat:true});
    for (const side of [x-.004,x+w+.004]) wallCap(group,bodyMat,side,top,back,front,ridge);
    for (const corner of [[x,back],[x+w,back],[x,front],[x+w,front]]) {
        box(group,m.trim,corner[0],(base+top)/2,corner[1],.105,top-base,.105);
    }
    const e=opts.overhang??.31;
    const outerTop=top-.10;
    roof(group,roofMat,m.dark,x-e,x+w+e,back-e,mid,outerTop,ridge+.13);
    if (openDepth) {
        roof(group,roofMat,m.dark,x-e,x+w+e,mid,front-.20,ridge+.13,top+.23);
        roof(group,roofMat,m.dark,x-e,x+w+e,front-.20,z+d+e,top+.23,top-.26);
        box(group,m.trim,x+w/2,top-.324,z+d+e,w+2*e,.14,.13);
        for (const ix of [x+.15,x+w*.345,x+w*.675,x+w-.15]) {
            box(group,m.trim,ix,(base+top-.30)/2,z+d-.15,.17,top-.30-base,.19);
        }
        const steps=4;
        for (let i=0;i<steps;i++) {
            const ix=x+1.32, iz=z+d+.14+(steps-i-1)*.24, gy=heightAt(ix);
            const h=(base-gy+.01)*(i+1)/(steps+1);
            box(group,m.deck,ix,gy+h*.5,iz,1.55,h,.28,{repeat:true});
        }
    } else {
        roof(group,roofMat,m.dark,x-e,x+w+e,mid,front+e,ridge+.13,outerTop);
        box(group,m.trim,x+w/2,outerTop-.07,front+e,w+2*e,.14,.106);
    }
    box(group,m.trim,x+w/2,outerTop-.07,back-e,w+2*e,.14,.106);
    beam(group,m.dark,V(x-e-.045,ridge+.17,mid),V(x+w+e+.045,ridge+.17,mid),.097,.114);
    const frame = (side, offset, bottom, width, height, door=false) => {
        const winY=base+bottom+height/2;
        const project=(ds) => side==='east' ? [x+w+ds,z+offset] : side==='north' ? [x+offset,back-ds] : [x+offset,front+ds];
        const angle=side==='east'?Math.PI/2:0;
        const panel=(mat,dy,w0,h0,d0)=>{
            const [cx,cz]=project(dy);
            box(group,mat,cx,winY,cz,w0,h0,d0,{angle});
        };
        panel(m.trim,.022,width+.17,height+.16,.065);
        panel(m.dark,.062,width,height,.05);
        panel(door?m.door:m.glass,.090,width-.095,height-.115,.025);
        if (!door && width>.8) panel(m.dark,.107,.043,height,.035);
        if (door) {
            const [cx,cz]=project(.124);
            box(group,m.trim,cx+(side==='east'?0:width*.34),winY-.10,cz+(side==='east'?width*.34:0),.105,.035,.045,{angle});
        }
    };
    if (opts.kind==='house') {
        frame('south',w*.58,.065,.88,1.96,true);
        frame('south',w*.82,1.00,1.17,1.04);
        frame('east',1.75,1.02,.74,1.05);
        frame('east',4.65,1.02,.78,1.05);
        frame('north',w*.32,1.0,.92,1.03);
        frame('north',w*.72,1.0,.85,1.03);
    } else {
        frame('south',w*.28,.051,opts.kind==='cabin'?.67:.76,opts.kind==='cabin'?1.72:1.78,true);
        frame('south',w*.73,.99,opts.kind==='cabin'?.76:.64,.64);
        if (opts.kind==='bath') {
            cylinder(group,m.dark,x+w*.72,ridge+.29,mid-.47,.105,.86,14);
            cylinder(group,m.dark,x+w*.72,ridge+.72,mid-.47,.15,.05,14);
        }
    }
    return base;
}

function makeContainer(group,foot,m) {
    const {x,z,w,d}=foot;
    const gy=heightAt(x+w/2);
    const base=gy+.16, h=2.59;
    for(const bx of [x+.24,x+w-.24]) for(const bz of [z+.20,z+d-.20]) {
        const local=heightAt(bx);
        box(group,m.pile,bx,(local+base)/2,bz,.34,base-local+.02,.32);
    }
    box(group,m.container,x+w/2,base+h/2,z+d/2,w,h,d);
    const flutes=new T.InstancedMesh(new T.BoxGeometry(.07,h-.23,.065),m.blueLight,2*46);
    const matrix=new T.Matrix4();
    for(let j=0;j<2;j++) for(let i=0;i<46;i++) {
        matrix.makeTranslation(x+.26+(w-.52)*i/45,base+h/2,z+(j?d+.021:-.021));
        flutes.setMatrixAt(j*46+i,matrix);
    }
    flutes.castShadow=flutes.receiveShadow=true;
    group.add(flutes);
    for(const az of [z,z+d]) {
        for(const yy of [base+.105,base+h-.086]) box(group,m.blueDark,x+w/2,yy,az,w+.05,.14,.112);
        for(const ax of [x,x+w]) box(group,m.blueDark,ax,base+h/2,az,.145,h+.04,.14);
    }
    for(let i=0;i<4;i++) {
        box(group,m.blueDark,x+w+.035,base+h/2,z+.34+i*.59,.045,h-.22,.049);
    }
    for(let i=0;i<8;i++) box(group,m.blueLight,x+w/2,base+h+.01,z+.14+i*.32,w-.16,.038,.045);
    return base+h;
}

function fence(parent,mat,plot,gate,zBias=.008) {
    const runs=[];
    for(let i=0;i<plot.length;i++) {
        const a=plot[i],b=plot[(i+1)%plot.length];
        if(i===4) runs.push([a,gate[0],false],[gate[1],b,false]);
        else runs.push([a,b,i===0||i===7]);
    }
    const postGeometry = new T.BoxGeometry(.091,1.40,.095);
    const fineGeometry = new T.BoxGeometry(.038,1.17,.031);
    const pieces=[],post=[];
    for (const [a,b,solid] of runs) {
        const len=Math.hypot(b.x-a.x,b.z-a.z);
        const pos=(t)=>({x:T.MathUtils.lerp(a.x,b.x,t),z:T.MathUtils.lerp(a.z,b.z,t)+zBias});
        const step=Math.max(1,Math.round(len/2.8));
        for(let k=0;k<=step;k++) post.push(pos(k/step));
        if(solid) {
            profileFence(parent,a,b,heightAt,{inside:'#d3d6d5',outside:'#4a704f'});
            continue;
        }
        const n=Math.round(len/.38);
        for(let i=1;i<n;i++) pieces.push(pos(i/n));
        for(const y of [.31,1.18]) beam(parent,mat,V(a.x,heightAt(a.x)+y,a.z),V(b.x,heightAt(b.x)+y,b.z),.037,.044,false);
    }
    for(const [items,geo,dy] of [[post,postGeometry,.70],[pieces,fineGeometry,.70]]) {
        const mesh=new T.InstancedMesh(geo,mat,items.length), tr=new T.Matrix4();
        items.forEach(({x,z},i)=>mesh.setMatrixAt(i,tr.makeTranslation(x,heightAt(x)+dy,z)));
        parent.add(mesh);
    }
}

function spruce(parent,{x,z,h},seedValue,m) {
    const random = seed(seedValue);
    const y=heightAt(x);
    cylinder(parent,m.bark,x,y+h*.47,z,.24,h*.94,9,.06);
    const geometry=new T.BufferGeometry(), vertices=[], colors=[];
    const tones=['#274634','#365642','#405f47','#4d694b'].map(c=>new T.Color(c));
    const add=(coords,color)=>{vertices.push(...coords.flat());for(let p=0;p<3;p++) colors.push(color.r,color.g,color.b);};
    for (let tier=0;tier<17;tier++) {
        const t=tier/17, k=Math.floor(1+17*(1-t)), y0=y+h*(.105+.83*t);
        const radius=(1-t)**.87*(2.4+random()*.37);
        const tips=[];
        for(let i=0;i<k;i++) {
            const a=i/k*Math.PI*2+tier*.57, r=radius*(.75+.31*random());
            tips.push([x+Math.cos(a)*r,y0+(random()-.7)*h*.063,z+Math.sin(a)*r]);
        }
        for(let i=0;i<k;i++) {
            const a=tips[i],b=tips[(i+1)%k];
            add([a,b,[x+(random()-.5)*.24,y0+h*(.11+.06*random()),z]],tones[Math.floor(random()*tones.length)]);
            add([b,a,[x,y0+h*.013,z]],tones[0]);
        }
    }
    vertices.push(x-.22,y+h*.86,z,x+.24,y+h*.87,z,x,y+h,z);
    for(let i=0;i<3;i++) colors.push(tones[1].r,tones[1].g,tones[1].b);
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    const tree=new T.Mesh(geometry,m.leaf);
    tree.castShadow=tree.receiveShadow=true;
    parent.add(tree);
}

export function createSite(scene) {
    const m = {
        sand:new T.MeshStandardMaterial({map:texture('sand'),roughness:.98}),
        meadow:new T.MeshStandardMaterial({map:texture('meadow'),roughness:.99}),
        soil:new T.MeshStandardMaterial({map:texture('soil'),roughness:.98}),
        gravel:new T.MeshStandardMaterial({map:texture('gravel'),roughness:.95}),
        wood:new T.MeshStandardMaterial({map:texture('wood'),roughness:.83,side:T.DoubleSide}),
        cabinWood:new T.MeshStandardMaterial({color:'#d4b988',map:texture('wood'),roughness:.85,side:T.DoubleSide}),
        bathWood:new T.MeshStandardMaterial({color:'#cba982',map:texture('wood'),roughness:.85,side:T.DoubleSide}),
        deck:new T.MeshStandardMaterial({map:texture('deck'),roughness:.84}),
        cut:standard('#766351'),trim:standard('#cda77a'),roof:standard('#243848',.44,.32),
        roofGreen:standard('#3b6549',.48,.31),pile:standard('#92958d'),dark:standard('#37453e',.54,.28),
        fence:standard('#69796b',.66,.25),glass:standard('#263b43',.23,.29),
        door:standard('#384149',.53),bark:standard('#6d543e'),
        leaf:new T.MeshStandardMaterial({vertexColors:true,roughness:.97,side:T.DoubleSide}),
        container:standard('#255783',.54,.37),blueLight:standard('#346d9b',.5,.37),blueDark:standard('#1d486e',.5,.32),
        water:new T.MeshBasicMaterial({color:'#087e7c'}),waterRing:new T.MeshBasicMaterial({color:'#f7fffc'}),
        power:new T.MeshBasicMaterial({color:'#8058a3'}),black:standard('#302c2b',.62)
    };
    m.roof.side=m.roofGreen.side=T.DoubleSide;
    const ground=new T.Group(), structures=new T.Group(), waterLayer=new T.Group(), powerLayer=new T.Group(), marking=new T.Group();
    scene.add(ground,structures,waterLayer,powerLayer,marking);
    const surroundings=horizontal([{x:-450,z:-450},{x:450,z:-450},{x:450,z:450},{x:-450,z:450}],
        x=>heightAt(x)-.036,m.meadow,ground);
    const surfaceMeshes=[
        horizontal(clipX(boundary,surfaces.black,false),heightAt,m.sand,ground),
        horizontal(clipX(clipX(boundary,surfaces.black,true),surfaces.gravel,false),heightAt,m.soil,ground),
        horizontal(clipX(boundary,surfaces.gravel,true),heightAt,m.gravel,ground),
    ];
    for (let i=0;i<boundary.length;i++) {
        const a=boundary[i],b=boundary[(i+1)%boundary.length],g=new T.BufferGeometry();
        g.setAttribute('position',new T.Float32BufferAttribute([a.x,heightAt(a.x),a.z,b.x,heightAt(b.x),b.z,
            b.x,-2.32,b.z,a.x,-2.32,a.z],3));
        g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
        const cut=new T.Mesh(g,m.cut);cut.material.side=T.DoubleSide;ground.add(cut);
    }
    fence(structures,m.fence,boundary,gate);
    const deckY=makeBuilding(structures,house,{kind:'house',piles:true,porch:porchDepth},m);
    makeBuilding(structures,bath,{kind:'bath',body:m.bathWood,base:.35,wall:2.30,rise:1.13},m);
    makeBuilding(structures,cabin,{kind:'cabin',body:m.cabinWood,roof:m.roofGreen,base:.29,wall:2.05,rise:.42,overhang:.20},m);
    const containerRoof=makeContainer(structures,containerA,m);
    makeContainer(structures,containerB,m);
    for(const [i,tree] of trees.entries()) spruce(structures,tree,350+i*57,m);
    const wellY=heightAt(well.x);
    cylinder(structures,m.pile,well.x,wellY+.057,well.z,.31,.115,24);
    cylinder(structures,m.black,well.x,wellY+.225,well.z,.124,.332,16);
    cylinder(structures,m.water,well.x,wellY+.40,well.z,.18,.096,24);
    const poleY=heightAt(pole.x), poleH=6.7;
    cylinder(structures,m.pile,pole.x,poleY+poleH/2,pole.z,.16,poleH,10,.108);
    beam(structures,m.dark,V(pole.x-.29,poleY+poleH-.26,pole.z),V(pole.x+.29,poleY+poleH-.26,pole.z),.08,.08);
    const from=V(pole.x,poleY+poleH-.39,pole.z);
    const to=V(electricEnd.x,containerRoof+.065,electricEnd.z);
    const line=[from,from.clone().lerp(to,.5).add(V(0,-.47,0)),to];
    tube(structures,m.black,line,.031);
    tube(powerLayer,m.power,line,.082);
    cylinder(powerLayer,m.power,pole.x,poleY+.05,pole.z,.38,.035,24);
    cylinder(powerLayer,m.power,to.x,to.y,to.z,.18,.098,16);
    const linePoints=water.map(({x,z})=>V(x,heightAt(x)+.037,z));
    for(let i=0;i<linePoints.length-1;i++) {
        const a=linePoints[i],b=linePoints[i+1],len=a.distanceTo(b);
        for(let j=0;j<len;j+=1.1) {
            const start=a.clone().lerp(b,j/len),end=a.clone().lerp(b,Math.min(len,j+.73)/len);
            beam(waterLayer,m.waterRing,start,end,.420,.038,false);
            beam(waterLayer,m.water,start.clone().add(V(0,.015,0)),end.clone().add(V(0,.015,0)),.270,.035,false);
        }
    }
    for(const p of [well,entry]) {
        const y=heightAt(p.x);
        const z=p===entry?p.z-.13:p.z;
        cylinder(waterLayer,m.waterRing,p.x,y+.040,z,.35,.036,28);
        cylinder(waterLayer,m.water,p.x,y+.068,z,.247,.018,28);
    }
    return {structures,ground,surfaceMeshes:[...surfaceMeshes,surroundings],waterLayer,powerLayer,marking,deckY};
}




