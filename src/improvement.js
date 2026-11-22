import * as T from 'three';
import {center,heightAt} from './site-data.js';
import {lawn,pitch,playground,grill,canopy,cars,paths,hedge,treePositions,walkwayLights} from './improvement-data.js';

const v=(x,y,z)=>new T.Vector3(x,y,z);
const p=(x,z,dy=0)=>v(x,heightAt(x)+dy,z);
const solid=(color,roughness=.8,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const randFrom = n => () => {
    n=(Math.imul(n,1664525)+1013904223)>>>0;
    return n/4294967296;
};

function surfaceTexture(kind) {
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d'), random=randFrom(kind==='paver'?106:77);
    if(kind==='paver') {
        ctx.fillStyle='#978c7b';ctx.fillRect(0,0,128,128);
        for(let row=0;row<4;row++) {
            for(let col=-1;col<3;col++) {
                ctx.fillStyle=['#bcad96','#d1c0a4','#c6bba4','#c1b19c','#c7b69d'][Math.floor(random()*5)];
                ctx.fillRect(col*64+(row%2)*32+1,row*32+1,62,30);
            }
        }
    } else {
        ctx.fillStyle='#789150';ctx.fillRect(0,0,128,128);
    }
    for(let i=0;i<2400;i++) {
        const x=random()*128,y=random()*128;
        ctx.fillStyle=kind==='paver'
            ?(random()<.5?'#64574325':'#ffffff22')
            :['#667e46','#819d54','#8ca560','#a3ae72','#6c8848'][Math.floor(random()*5)];
        ctx.fillRect(x,y,1+random()*2,.7+random()*2);
    }
    const map=new T.CanvasTexture(canvas);
    map.wrapS=map.wrapT=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;
    map.anisotropy=8;
    return map;
}

function haloMap() {
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d');
    const fade=ctx.createRadialGradient(32,32,1,32,32,32);
    for(const [stop,color] of [[0,'#ffc270bc'],[.3,'#e9a84a75'],[.62,'#de907e22'],[1,'#ffab3800']]) fade.addColorStop(stop,color);
    ctx.fillStyle=fade;ctx.fillRect(0,0,64,64);
    const texture=new T.CanvasTexture(canvas);
    texture.colorSpace=T.SRGBColorSpace;
    return texture;
}

function pathBand(horizontal,parent,points,width,y,material) {
    const spline=new T.CatmullRomCurve3(points.map(([x,z])=>v(x,0,z)));
    const count=Math.max(9,Math.ceil(spline.getLength()*2));
    const left=[],right=[];
    for(let i=0;i<=count;i++) {
        const t=i/count, c=spline.getPointAt(t), d=spline.getTangentAt(t);
        left.push({x:c.x-d.z*width/2,z:c.z+d.x*width/2});
        right.push({x:c.x+d.z*width/2,z:c.z-d.x*width/2});
    }
    const surface=horizontal([...left,...right.reverse()],x=>heightAt(x)+y,material,parent);
    const geometry=surface.geometry;
    const positions=geometry.attributes.position, uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++) uv.setXY(i,positions.getX(i)/1.9,positions.getZ(i)/1.3);
    return surface;
}

function groundRect(horizontal,parent,rect,dy,mat) {
    const {x,z,w,d}=rect;
    const obj=horizontal([{x,z},{x:x+w,z},{x:x+w,z:z+d},{x,z:z+d}],x=>heightAt(x)+dy,mat,parent);
    if(mat.map&&mat.userData.paver) {
        const uv=obj.geometry.attributes.uv;
        for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*2.1,uv.getY(i)*2.9);
    }
    return obj;
}

function rod(parent,mat,a,b,r) {
    const d=b.clone().sub(a);
    const obj=new T.Mesh(new T.CylinderGeometry(r,r,d.length(),8),mat);
    obj.position.copy(a).lerp(b,.5);
    obj.quaternion.setFromUnitVectors(v(0,1,0),d.clone().normalize());
    obj.castShadow=true;obj.receiveShadow=true;
    parent.add(obj);
    return obj;
}

function orb(parent,mat,x,y,z,sx,sy,sz,detail=1) {
    const obj=new T.Mesh(new T.IcosahedronGeometry(1,detail),mat);
    obj.position.set(x,y,z);
    obj.scale.set(sx,sy,sz);
    obj.castShadow=true;obj.receiveShadow=true;
    parent.add(obj);
    return obj;
}

function football(site,pr,m) {
    const {x,z,w,d}=pitch;
    groundRect(pr.horizontal,site,pitch,.039,m.pitchBorder);
    const field={x:x+.775,z:z+.375,w:20,d:10};
    for(let i=0;i<10;i++) {
        groundRect(pr.horizontal,site,{x:field.x+i*2,z:field.z,w:2,d:field.d},.047,i%2?m.pitchA:m.pitchB);
    }
    const line=(a,b,width=.065)=>pathBand(pr.horizontal,site,[a,b],width,.061,m.fieldMark);
    const fx=field.x,fz=field.z,ex=fx+20,ez=fz+10,mid=fx+10,cz=fz+5;
    for(const [a,b] of [[[fx,fz],[ex,fz]],[[ex,fz],[ex,ez]],[[ex,ez],[fx,ez]],[[fx,ez],[fx,fz]],[[mid,fz],[mid,ez]]]) line(a,b);
    const ring=Array.from({length:45},(_,i)=>[mid+1.52*Math.cos(i*2*Math.PI/44),cz+1.52*Math.sin(i*2*Math.PI/44)]);
    pathBand(pr.horizontal,site,ring,.062,.064,m.fieldMark);
    for(const [edge,direction] of [[fx,1],[ex,-1]]) {
        const xa=edge+2.65*direction;
        line([edge,cz-2.35],[xa,cz-2.35]);
        line([xa,cz-2.35],[xa,cz+2.35]);
        line([xa,cz+2.35],[edge,cz+2.35]);
        const rear=edge-.67*direction, left=cz-1.45, right=cz+1.45;
        const points = [[p(edge,left,.08),p(edge,left,1.84)],[p(edge,left,1.84),p(edge,right,1.84)],
            [p(edge,right,1.84),p(edge,right,.08)],[p(edge,left,1.84),p(rear,left,.08)],
            [p(edge,right,1.84),p(rear,right,.08)],[p(rear,left,.08),p(rear,right,.08)]];
        for(const [a,b] of points) rod(site,m.fieldMark,a,b,.037);
        for(let i=1;i<12;i++) {
            const z=left+(right-left)*i/12;
            rod(site,m.net,p(edge,z,1.83),p(rear,z,.08),.010);
        }
        for(let i=1;i<7;i++) {
            const t=i/7, x=T.MathUtils.lerp(edge,rear,t), y=T.MathUtils.lerp(1.84,.08,t);
            rod(site,m.net,p(x,left,y),p(x,right,y),.010);
        }
    }
}

function makePlay(site,pr,m) {
    const play=playground;
    groundRect(pr.horizontal,site,play,.039,m.rubberLight);
    groundRect(pr.horizontal,site,{x:play.x+7.15,z:play.z+.18,w:4.65,d:play.d-.36},.045,m.rubberDark);
    const tx=-23.1,tz=6.00,ground=heightAt(tx);
    const show=(mat,x,z,h,w,b,depth)=>pr.box(site,mat,x,ground+h,z,w,b,depth);
    for(const x of [tx-.73,tx+.73]) for(const z of [tz-.65,tz+.65]) show(m.wood,x,z,1.18,.13,2.34,.13);
    show(m.wood,tx,tz,1.44,1.58,.15,1.43);
    for(const x of [tx-.72,tx+.72]) for(const z of [tz-.65,tz+.65]) show(m.wood,x,z,2.08,.105,1.36,.105);
    for(const x of [tx-.72,tx+.72]) show(m.teal,x,tz,2.02,.075,.34,1.36);
    const ridge=ground+3.07,eave=ground+2.62,l=tx-1.01,r=tx+1.01;
    for(const [a,b] of [[tz-.96,tz],[tz,tz+.96]]) {
        const z0=a===tz?ridge:eave,z1=a===tz?eave:ridge;
        const roof=new T.BufferGeometry();
        roof.setAttribute('position',new T.Float32BufferAttribute([l,z0,a,r,z0,a,r,z1,b,l,z1,b],3));
        roof.setIndex([0,2,1,0,3,2]);roof.computeVertexNormals();
        const mesh=new T.Mesh(roof,m.playRoof);mesh.castShadow=true;mesh.receiveShadow=true;site.add(mesh);
    }
    for(const x of [tx-.46,tx+.46]) rod(site,m.dark,v(x,ground+.10,tz-2.03),v(x,ground+1.47,tz-.70),.027);
    for(let k=0;k<6;k++) {
        const n=(k+.67)/6;
        rod(site,m.dark,v(tx-.45,ground+.15+n*1.29,tz-2.03+n*1.33),v(tx+.45,ground+.15+n*1.29,tz-2.03+n*1.33),.027);
    }
    const slideCurve=new T.CatmullRomCurve3([v(tx,ground+1.46,tz+.61),v(tx,ground+1.21,tz+1.29),v(tx,ground+.51,tz+2.13),v(tx,ground+.16,tz+3.00)]);
    const slideVertices=[],slideFaces=[];
    for(const [i,pt] of slideCurve.getPoints(28).entries()) {
        slideVertices.push(pt.x-.39,pt.y,pt.z,pt.x+.39,pt.y,pt.z);
        if(i>0) {const k=2*(i-1);slideFaces.push(k,k+2,k+1,k+1,k+2,k+3);}
    }
    const slideGeometry=new T.BufferGeometry();
    slideGeometry.setAttribute('position',new T.Float32BufferAttribute(slideVertices,3));
    slideGeometry.setIndex(slideFaces);slideGeometry.computeVertexNormals();
    const slide=new T.Mesh(slideGeometry,m.slide);slide.receiveShadow=slide.castShadow=true;site.add(slide);
    for(const side of [-.39,.39]) pr.tube(site,m.slideTrim,slideCurve.getPoints(22).map(pt=>pt.add(v(side,.042,0))),.040,27);
    const sx=-17.64,sz=7.03,sy=heightAt(sx);
    for(const x of [sx-1.78,sx+1.78]) {
        for(const z of [sz-.98,sz+.98]) rod(site,m.wood,p(x,z,.04),v(x,sy+2.65,sz),.075);
    }
    rod(site,m.dark,v(sx-1.88,sy+2.63,sz),v(sx+1.88,sy+2.63,sz),.074);
    for(const x of [sx-.84,sx+.84]) {
        for(const dx of [-.24,.24]) rod(site,m.dark,v(x+dx,sy+.53,sz),v(x+dx,sy+2.59,sz),.014);
        pr.box(site,m.teal,x,sy+.53,sz,.53,.077,.36);
    }
    const bx=-25.12,bz=10.44,base=heightAt(bx);
    groundRect(pr.horizontal,site,{x:bx-.96,z:bz-.74,w:1.92,d:1.48},.079,m.sand);
    for(const a of [-1,1]) {
        pr.box(site,m.wood,bx+a*.97,base+.13,bz,.14,.19,1.65);
        pr.box(site,m.wood,bx,base+.13,bz+a*.77,2.03,.19,.137);
    }
}

function makeGrill(site,pr,m,fittings,lightAt) {
    groundRect(pr.horizontal,site,grill,.043,m.paver);
    const {x,z,w,d}=grill;
    const x0=x+.64,x1=x+4.80,z0=z+.65,z1=z+d-.71;
    const y=heightAt((x0+x1)/2), eave=y+2.67;
    for(const x of [x0,x1]) for(const z of [z0,z1]) {
        pr.box(site,m.wood,x,(heightAt(x)+eave)/2,z,.15,eave-heightAt(x),.15);
    }
    for(const z of [z0,z1]) pr.beam(site,m.wood,v(x0-.15,eave,z),v(x1+.15,eave,z),.16,.15);
    for(let i=0;i<10;i++) {
        const x=x0-.08+i*(x1-x0+.16)/9;
        pr.beam(site,m.wood,v(x,eave+.12,z0-.14),v(x,eave+.12,z1+.14),.086,.115);
    }
    const tx=x+2.75,tz=z+3.03;
    for(const offset of [-.70,.70,0]) {
        const bench=offset!==0,dy=bench?.48:.80;
        pr.box(site,m.wood,tx,y+dy,tz+offset,2.21,.093,bench?.34:.88);
        for(const xx of [tx-.84,tx+.84]) {
            pr.box(site,m.dark,xx,y+dy/2,tz+offset,.09,dy,.25);
        }
    }
    const gx=x+6.92,gz=z+2.42,gy=heightAt(gx);
    groundRect(pr.horizontal,site,{x:gx-.98,z:gz-.86,w:1.95,d:1.72},.050,m.paverDark);
    pr.box(site,m.dark,gx,gy+.92,gz,1.18,.36,.65);
    pr.box(site,m.grillLid,gx,gy+1.18,gz,1.17,.18,.61);
    pr.box(site,m.rim,gx,gy+1.14,gz-.339,.33,.038,.045);
    for(const xx of [gx-.43,gx+.43]) for(const zz of [gz-.23,gz+.23]) {
        pr.box(site,m.dark,xx,gy+.49,zz,.049,.85,.049);
    }
    const xline=[x0+.18,x1-.18];
    for(const z of [z0+.28,z1-.28]) {
        const bulbs=Array.from({length:8},(_,i)=>{
            const t=i/7;
            return v(T.MathUtils.lerp(...xline,t),eave-.14-.28*Math.sin(Math.PI*t),z);
        });
        pr.tube(site,m.dark,bulbs,.011,24);
        for(const b of bulbs.slice(1,-1)) {
            orb(site,m.warm,b.x,b.y-.053,b.z,.05,.067,.05,1);
        }
    }
    lightAt((x0+x1)/2,tz,2.27,15,8);
    const trim=pr.box(site,m.dark,x1+.02,eave-.18,z1-.46,.08,.12,.15);
    trim.rotation.y=.18;
    orb(site,m.warm,x1-.025,eave-.28,z1-.46,.064,.038,.068);
    pr.box(site,m.wood,gx-.10,gy+.36,z+5.35,2.21,.11,.48);
    for(const xx of [gx-.84,gx+.61]) pr.box(site,m.dark,xx,gy+.18,z+5.35,.075,.36,.31);
    fittings.push({x:tx-1.13,z:tz-1.00,w:2.26,d:2.00},{x:gx-.65,z:gz-.35,w:1.30,d:.70});
}

function shapeHull(parent,material,x,z,base,rings) {
    const vertices=[],triangles=[];
    for(const [y,length,width,shift] of rings) {
        const bevel=Math.min(.18,width*.33),l=length/2,w=width/2;
        const points=[[-l+bevel,-w],[l-bevel,-w],[l,-w+bevel],[l,w-bevel],
            [l-bevel,w],[-l+bevel,w],[-l,w-bevel],[-l,-w+bevel]];
        for(const [dx,dz] of points) vertices.push(x+dx+shift,base+y,z+dz);
    }
    for(let r=0;r<rings.length-1;r++) for(let i=0;i<8;i++) {
        const a=r*8+i,b=r*8+(i+1)%8;
        triangles.push(a,a+8,b,b,a+8,b+8);
    }
    const last=(rings.length-1)*8;
    for(let i=1;i<7;i++) triangles.push(last,last+i+1,last+i);
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    g.setIndex(triangles);g.computeVertexNormals();
    const obj=new T.Mesh(g,material);
    obj.castShadow=obj.receiveShadow=true;
    parent.add(obj);
    return obj;
}

function car(site,pr,m,vehicle,i) {
    const {x,z,color}=vehicle, base=heightAt(x), sport=i===0;
    const paint=solid(color,.265,.36);
    shapeHull(site,paint,x,z,base,[[.34,4.22,1.70,0],[.55,4.63,1.87,0],[.75,4.56,1.82,0],[.83,4.25,1.70,-.02]]);
    const roofH=sport?1.42:1.53;
    shapeHull(site,m.glass,x,z,base,[[.81,2.59,1.58,-.18],[roofH-.05,1.76,1.42,-.18]]);
    shapeHull(site,paint,x,z,base,[[roofH-.065,1.78,1.425,-.18],[roofH,1.64,1.39,-.19]]);
    for(const dz of [-.96,.96]) {
        for(const dx of [-1.49,1.48]) {
            const wheel=pr.cylinder(site,m.tyre,x+dx,base+.325,z+dz,.326,.22,20);
            wheel.rotation.x=Math.PI/2;
            const rim=pr.cylinder(site,m.rim,x+dx,base+.325,z+dz+Math.sign(dz)*.107,.206,.024,14);
            rim.rotation.x=Math.PI/2;
            const hub=pr.cylinder(site,m.dark,x+dx,base+.325,z+dz+Math.sign(dz)*.121,.076,.023,12);
            hub.rotation.x=Math.PI/2;
        }
        pr.box(site,paint,x+.72,base+1.025,z+dz,.26,.135,.15);
        pr.box(site,m.dark,x-.31,base+.77,z+dz*.931,.24,.032,.018);
    }
    for(const d of [-.66,.66]) {
        pr.box(site,m.head,x+2.253,base+.69,z+d,.052,.105,.33);
        pr.box(site,m.tail,x-2.245,base+.68,z+d,.042,.094,.35);
    }
    pr.box(site,m.dark,x+2.277,base+.55,z,.07,.145,1.07);
    pr.box(site,m.rim,x+2.317,base+.55,z,.017,.074,.27);
}

function carport(site,roofGroup,pr,m,lightAt) {
    const {x,z,w,d}=canopy;
    const x0=x+.17,x1=x+w-.17,z0=z+.047,z1=z+d-.047;
    const roofY0=.33+heightAt(x+w/2)+2.98,roofY1=roofY0-.27;
    for(const x of [x0,(x0+x1)/2,x1]) {
        for(const [z,y] of [[z0,roofY0],[z1,roofY1]]) {
            const base=heightAt(x);
            pr.box(site,m.dark,x,(base+y)/2,z,.105,y-base,.105);
            pr.box(site,m.rim,x,base+.04,z,.17,.08,.17);
        }
        pr.beam(site,m.dark,v(x,roofY0-.035,z0),v(x,roofY1-.035,z1),.115,.115);
    }
    for(const [z,y] of [[z0,roofY0],[z1,roofY1]]) {
        pr.beam(site,m.dark,v(x0-.13,y,z),v(x1+.13,y,z),.12,.12);
    }
    const sections=9;
    for(let i=0;i<sections;i++) {
        const a=x+i*w/sections,b=x+(i+1)*w/sections;
        const coords=[a,roofY0+.085,z0-.04,b-.015,roofY0+.085,z0-.04,b-.015,roofY1+.079,z1+.04,a,roofY1+.079,z1+.04];
        const g=new T.BufferGeometry();
        g.setAttribute('position',new T.Float32BufferAttribute(coords,3));
        g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();
        const cover=new T.Mesh(g,m.canopy);
        cover.receiveShadow=true;
        roofGroup.add(cover);
        pr.beam(site,m.roofFrame,v(a,roofY0+.042,z0),v(a,roofY1+.042,z1),.036,.029,false);
    }
    const centerZ=z+d/2;
    for(const cx of [x+w*.25,x+w*.75]) {
        const y=(roofY0+roofY1)/2-.075;
        pr.box(site,m.dark,cx,y+.025,centerZ,1.67,.071,.16);
        pr.box(site,m.warm,cx,y-.022,centerZ,1.44,.026,.105);
        lightAt(cx,centerZ,y-heightAt(cx)-.19,14,6);
    }
    cars.forEach((vehicle,i)=>car(site,pr,m,vehicle,i));
}

function planting(site,pr,m) {
    const random=randFrom(675);
    for(const [i,[x,z,h]] of treePositions.entries()) {
        const y=heightAt(x);
        pr.cylinder(site,i%3===0?m.birch:m.bark,x,y+h*.37,z,.105,h*.74,10,.034);
        for(let q=0;q<7;q++) {
            const a=q*2.399, spread=q===0?.08:.48+random()*.35, cy=y+h*(.68+random()*.18);
            orb(site,m.foliage[(i+q)%m.foliage.length],x+Math.cos(a)*spread,cy,z+Math.sin(a)*spread,
                .60+random()*.44,.68+random()*.47,.59+random()*.41,1);
        }
    }
    for(const strip of hedge) {
        const steps=Math.floor((strip.to-strip.from)/.68);
        groundRect(pr.horizontal,site,{x:strip.x-.68,z:strip.from-.26,w:1.18,d:strip.to-strip.from+.53},.046,m.mulch);
        for(let i=0;i<=steps;i++) {
            const x=strip.x+(random()-.5)*.21, z=T.MathUtils.lerp(strip.from,strip.to,i/steps);
            for(let c=0;c<4;c++) {
                const a=c*2.4, y=heightAt(x)+.43+random()*.29;
                orb(site,m.hedge[(c+i)%m.hedge.length],x+Math.cos(a)*.26,y,z+Math.sin(a)*.25,
                    .31+random()*.15,.36+random()*.18,.33+random()*.14,1);
            }
        }
    }
}

export function createImprovement(pr) {
    const group=new T.Group(), roof=new T.Group(), glow=new T.Group();
    group.name='Благоустройство';
    group.add(roof,glow);
    group.visible=false;glow.visible=false;
    const colliders=[];
    const lamps=[];
    const turfMap=surfaceTexture('lawn'), paverMap=surfaceTexture('paver');
    const m={
        lawn:new T.MeshStandardMaterial({map:turfMap,color:'#c8e1ad',roughness:.96}),
        paver:new T.MeshStandardMaterial({map:paverMap,roughness:.97}),
        paverDark:new T.MeshStandardMaterial({map:paverMap,color:'#a8a192',roughness:.95}),
        edging:solid('#cbb99e'),pitchBorder:solid('#4e7345'),
        pitchA:solid('#628c49'),pitchB:solid('#719c54'),fieldMark:solid('#efefe0'),net:solid('#dfdfce'),
        rubberLight:solid('#bc9f77'),rubberDark:solid('#a89b78'),sand:solid('#c7a675'),
        wood:solid('#ae8456'),teal:solid('#3c7672'),slide:solid('#3686a1',.54),slideTrim:solid('#286784',.61),
        playRoof:solid('#2f6665'),dark:solid('#3d4c43',.53,.28),roofFrame:solid('#6b877e',.59,.47),
        rim:solid('#afb5ae',.46,.40),tyre:solid('#242622',.9),glass:solid('#263f48',.25,.30),
        head:solid('#e7eddf',.23),tail:solid('#a33832',.35),grillLid:solid('#242d2b',.42,.32),
        canopy:new T.MeshPhysicalMaterial({color:'#acc7bc',roughness:.37,metalness:.10,side:T.DoubleSide,
            transparent:true,opacity:.54,depthWrite:false}),
        warm:new T.MeshStandardMaterial({color:'#ffe3ab',emissive:'#ff9c42',emissiveIntensity:.28,roughness:.40}),
        mulch:solid('#674f35'),bark:solid('#6e583d'),birch:solid('#b5b8a2'),
        foliage:['#526f3d','#6d8b4b','#829657','#688345'].map(c=>solid(c)),
        hedge:['#3c6948','#477b50','#64854b','#72934f'].map(c=>solid(c)),
    };
    m.slide.side=m.playRoof.side=T.DoubleSide;
    m.paver.userData.paver=m.paverDark.userData.paver=true;
    const lightAt=(x,z,h,power,range)=>{
        const light=new T.PointLight('#ffb46f',0,range,2);
        light.position.set(x,heightAt(x)+h,z);
        light.userData.power=power;
        group.add(light);lamps.push(light);
    };
    pr.horizontal(lawn.map(([x,z])=>({x,z})),x=>heightAt(x)+.019,m.lawn,group);
    for(const path of paths) {
        pathBand(pr.horizontal,group,path.points,path.width+.14,.043,m.edging);
        pathBand(pr.horizontal,group,path.points,path.width,.052,m.paver);
    }
    football(group,pr,m);
    makePlay(group,pr,m);
    makeGrill(group,pr,m,colliders,lightAt);
    carport(group,roof,pr,m,lightAt);
    planting(group,pr,m);
    const halo=new T.MeshBasicMaterial({map:haloMap(),transparent:true,depthWrite:false,opacity:.74,
        blending:T.AdditiveBlending,color:'#edb96c'});
    for(const [x,z] of walkwayLights) {
        const y=heightAt(x);
        pr.cylinder(group,m.dark,x,y+.28,z,.064,.56,10);
        pr.cylinder(group,m.warm,x,y+.54,z,.084,.083,10);
        pr.cylinder(group,m.dark,x,y+.60,z,.097,.049,10);
        const pool=new T.Mesh(new T.PlaneGeometry(3.6,3.6),halo);
        pool.rotation.x=-Math.PI/2;
        pool.position.set(x,y+.084,z);
        glow.add(pool);
    }
    for(const vehicle of cars) colliders.push({x:vehicle.x-2.24,z:vehicle.z-.99,w:4.48,d:1.98});
    return {
        group,roof,colliders,
        setEvening(value) {
            m.warm.emissiveIntensity=value?2.9:.20;
            glow.visible=value;
            lamps.forEach(light=>{light.intensity=value?light.userData.power:0;});
        },
    };
}
