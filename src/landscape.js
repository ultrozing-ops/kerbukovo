import * as T from 'three';
import {heightAt,road} from './site-data.js';

const randomFor = value => () => {
    value = (Math.imul(value,1664525) + 1013904223) >>> 0;
    return value / 4294967296;
};
const earth = (color,options={}) => new T.MeshStandardMaterial({color,roughness:.95,...options});

export function skyTexture() {
    const canvas=document.createElement('canvas');
    canvas.width=1024;canvas.height=512;
    const ctx=canvas.getContext('2d');
    const gradient=ctx.createLinearGradient(0,0,0,canvas.height);
    for(const [at,color] of [[0,'#4d91cc'],[.26,'#7eb9e4'],[.475,'#c8e8fa'],[.53,'#d6e7ee'],[1,'#e0e9d8']]) {
        gradient.addColorStop(at,color);
    }
    ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height);
    const random=randomFor(232);
    for(let i=0;i<13;i++) {
        const x=(i+.39)*canvas.width/13, y=143+random()*87;
        const width=36+random()*65, lift=8+random()*12;
        for(let j=0;j<11;j++) {
            const offset=(-.49+j/10)*width;
            const elevation=Math.sin(j*Math.PI/10)*lift;
            const radius=9+random()*16;
            for(const shift of [-canvas.width,0,canvas.width]) {
                ctx.save();
                ctx.translate(x+offset+shift,y-elevation+(random()-.5)*6);
                ctx.scale(1.28,.55+random()*.19);
                const haze=ctx.createRadialGradient(0,-2,2,0,0,radius);
                haze.addColorStop(0,'rgba(255,255,255,.91)');
                haze.addColorStop(.51,'rgba(255,255,255,.73)');
                haze.addColorStop(1,'rgba(240,250,255,0)');
                ctx.fillStyle=haze;ctx.fillRect(-radius,-radius,radius*2,radius*2);
                ctx.restore();
            }
        }
    }
    const texture=new T.CanvasTexture(canvas);
    texture.colorSpace=T.SRGBColorSpace;
    texture.mapping=T.EquirectangularReflectionMapping;
    return texture;
}

function wheatMaterial() {
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d'), random=randomFor(475);
    ctx.fillStyle='#c6a351';ctx.fillRect(0,0,128,128);
    for(let x=0;x<128;x+=16) {
        ctx.fillStyle='#a88136';ctx.fillRect(x,0,3,128);
        ctx.fillStyle='#d5b365';ctx.fillRect(x+5,0,8,128);
    }
    const colors=['#b59045','#e0bf72','#c69f53','#dfbd6c'];
    for(let i=0;i<4200;i++) {
        ctx.fillStyle=colors[Math.floor(random()*colors.length)];
        ctx.fillRect(random()*128,random()*128,1+random(),1+random()*3);
    }
    const map=new T.CanvasTexture(canvas);
    map.wrapS=map.wrapT=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;
    map.anisotropy=4;
    return earth('#ffffff',{map});
}

function instanced(parent, geometry, material, points, apply) {
    const meshes=new T.InstancedMesh(geometry,material,points.length);
    const object=new T.Object3D();
    points.forEach((p,i)=>{
        apply(object,p);
        object.updateMatrix();
        meshes.setMatrixAt(i,object.matrix);
        if (p.color) meshes.setColorAt(i,p.color);
    });
    parent.add(meshes);
}

function wheat(parent) {
    const random=randomFor(1884),points=[];
    const palette=['#ad8336','#d3b154','#e3c472','#ceb25e'].map(c=>new T.Color(c));
    for(let row=0;row<42;row++) {
        const x=-56.35-row*.66;
        for(let j=0;j<78;j++) {
            if(random()<.19) continue;
            const z=-36+j*.9+(random()-.5)*.66;
            points.push({x:x+(random()-.5)*.28,z,h:.62+random()*.42,tilt:(random()-.5)*.26,
                color:palette[Math.floor(random()*palette.length)]});
        }
    }
    instanced(parent,new T.CylinderGeometry(.012,.015,1,4),earth('#ffffff'),points,(obj,p)=>{
        obj.position.set(p.x,heightAt(p.x)+p.h*.46,p.z);
        obj.rotation.z=p.tilt;obj.scale.set(1,p.h,1);
    });
    instanced(parent,new T.IcosahedronGeometry(1,0),earth('#f4ddb4'),points,(obj,p)=>{
        obj.position.set(p.x-p.h*.43*Math.sin(p.tilt),heightAt(p.x)+p.h*.94,p.z);
        obj.rotation.z=p.tilt;obj.scale.set(.044,.142,.044);
    });
}

function forest(parent) {
    const random=randomFor(731), trunks=[], broad=[], conifers=[];
    const greens=['#284b39','#375c42','#456b50','#537657','#355a50','#5d784e'].map(c=>new T.Color(c));
    for(let row=0;row<5;row++) for(let col=0;col<10;col++) {
        const x=road.x+road.width+3.0+row*6.2+(random()-.5)*4.5, z=-27+col*6.7+(random()-.5)*5.5;
        if(random()<.13) continue;
        const h=5.7+random()*7;
        const ground=heightAt(x)-.019, color=greens[Math.floor(random()*greens.length)];
        trunks.push({x,z,y:ground+h*.26,h:h*.57});
        if (random()<.49) {
            for(let level=0;level<3;level++) {
                conifers.push({x,z,y:ground+h*(.42+.194*level),h:h*(.55-.049*level),
                    radius:h*(.176-.041*level),color,turn:random()*6.28});
            }
        } else {
            for(let j=0;j<3;j++) {
                const angle=j*2.094+random(), spread=.6+random()*.9;
                broad.push({x:x+Math.cos(angle)*spread,z:z+Math.sin(angle)*spread,
                    y:ground+h*(.70+random()*.135),radius:h*(.20+random()*.064),color,turn:angle});
            }
        }
    }
    instanced(parent,new T.CylinderGeometry(.12,.18,1,7),earth('#655440'),trunks,(obj,p)=>{
        obj.position.set(p.x,p.y,p.z);obj.scale.set(1,p.h,1);
    });
    instanced(parent,new T.ConeGeometry(1,1,8,1),earth('#ffffff'),conifers,(obj,p)=>{
        obj.position.set(p.x,p.y,p.z);obj.rotation.y=p.turn;
        obj.scale.set(p.radius,p.h,p.radius);
    });
    instanced(parent,new T.IcosahedronGeometry(1,1),earth('#ffffff',{flatShading:true}),broad,(obj,p)=>{
        obj.position.set(p.x,p.y,p.z);obj.rotation.y=p.turn;
        obj.scale.set(p.radius,p.radius*1.07,p.radius);
    });
}

function makeRoad(parent,horizontal) {
    const z0=-95,z1=95;
    const strip=(x0,x1,offset,material)=>horizontal([{x:x0,z:z0},{x:x1,z:z0},{x:x1,z:z1},{x:x0,z:z1}],
        x=>heightAt(x)+offset,material,parent);
    strip(road.x,road.x+road.width,-.012,earth('#949185'));
    const track=earth('#9f9c8e');
    for(const offset of [1.0,2.38,4.65,6.01]) {
        strip(road.x+offset,road.x+offset+.34,-.006,track);
    }
}

export function addLandscape(parent, horizontal) {
    makeRoad(parent,horizontal);
    horizontal([{x:-165,z:-105},{x:-55.8,z:-105},{x:-55.8,z:100},{x:-165,z:100}],
        x=>heightAt(x)-.020,wheatMaterial(),parent);
    wheat(parent);
    forest(parent);
}

