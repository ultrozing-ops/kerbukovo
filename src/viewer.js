import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createSite} from './models.js';
import {skyTexture} from './landscape.js';
import {withinScene,boundary,contains,heightAt,house,porchDepth,bath,cabin,toilet,containerA,containerB,gate,pole} from './site-data.js';

const vectors={KeyW:[0,1],ArrowUp:[0,1],KeyA:[-1,0],ArrowLeft:[-1,0],KeyS:[0,-1],ArrowDown:[0,-1],
    KeyD:[1,0],ArrowRight:[1,0]};
const walkBoxes=[{...house,d:house.d-porchDepth},bath,cabin,containerA,containerB,
    {x:pole.x-.22,z:pole.z-.22,w:.44,d:.44}];
const porch={...house,z:house.z+house.d-porchDepth,d:porchDepth};
const fmt = new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});

const perimeter=boundary.flatMap((a,i)=>{
    const b=boundary[(i+1)%boundary.length];
    return i===4?[[a,gate[0]],[gate[1],b]]:[[a,b]];
});

function nearFence(x,z) {
    return perimeter.some(([a,b])=>{
        const dx=b.x-a.x,dz=b.z-a.z;
        const t=T.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
        return Math.hypot(x-a.x-dx*t,z-a.z-dz*t)<.24;
    });
}
function validStep(x,z) {
    return withinScene(x,z) && !nearFence(x,z) && !walkBoxes.some(b=>contains(b,x,z,.24));
}

function pinMaterial(number,selected) {
    const canvas = document.createElement('canvas');
    canvas.width=canvas.height=96;
    const ctx=canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(32,56);ctx.lineTo(48,85);ctx.lineTo(64,56);ctx.closePath();
    ctx.fillStyle='#244737';ctx.fill();
    ctx.beginPath();
    ctx.arc(48,41,30,0,Math.PI*2);
    ctx.fillStyle=selected?'#d9efb8':'#355a41';ctx.fill();
    ctx.strokeStyle='#f8fcf4';ctx.lineWidth=5;ctx.stroke();
    ctx.fillStyle=selected?'#243a2a':'#fff';
    ctx.font='bold 31px Segoe UI';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(number),48,42);
    const texture=new T.CanvasTexture(canvas);
    texture.colorSpace=T.SRGBColorSpace;
    return new T.SpriteMaterial({map:texture,depthWrite:false});
}

export function setupViewer({stage,viewport,compass,cameraLabel,touch,onPoint,onPin}) {
    const scene=new T.Scene();
    scene.background=skyTexture();
    scene.fog=new T.Fog('#c2dbe8',96,245);
    const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    const mobile=matchMedia('(pointer: coarse), (max-width: 700px)').matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.8));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate=false;
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.16;
    renderer.domElement.setAttribute('aria-label','Трёхмерная модель участка');
    stage.appendChild(renderer.domElement);
    scene.add(new T.HemisphereLight('#f0f6ff','#aa9472',2.05));
    const sun=new T.DirectionalLight('#fff0d6',2.35);
    sun.position.set(-36,77,36);
    sun.castShadow=true;
    const shadowSize=mobile?1024:2048;
    sun.shadow.mapSize.set(shadowSize,shadowSize);
    Object.assign(sun.shadow.camera,{left:-73,right:73,top:67,bottom:-67,near:2,far:175});
    sun.shadow.bias=-.00025;
    sun.shadow.normalBias=.035;
    sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun,sun.target);

    const site=createSite(scene);
    const overview=new T.OrthographicCamera(-60,60,36,-36,.1,600);
    const walk=new T.PerspectiveCamera(61,1,.07,230);
    const ctl=new OrbitControls(overview,renderer.domElement);
    ctl.enableDamping=true;
    ctl.maxPolarAngle=1.505;
    ctl.minZoom=.58;
    ctl.maxZoom=14;
    ctl.zoomSpeed=.80;
    ctl.zoomToCursor=true;
    ctl.rotateSpeed=.65;
    ctl.panSpeed=.85;
    const rs=new ResizeObserver(resize);
    const ray=new T.Raycaster();
    const pointer=new T.Vector2(), eyeDirection=new T.Vector3();
    const keys=new Set();
    let camera=overview, mode='orbit', yaw=-Math.PI/2,pitch=-.075,placing=false,drag=null,move=false,render=true;
    let last=performance.now(), oldZoom=NaN;
    let pinMap=new Map();
    let lastHeading=NaN,lastWalkLabel='';
    const canvas=renderer.domElement;
    

    function resize() {
        const w=Math.max(stage.clientWidth,1),h=Math.max(stage.clientHeight,1),aspect=w/h;
        const half=Math.max(125/aspect,46)/2;
        Object.assign(overview,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});
        overview.updateProjectionMatrix();
        walk.aspect=aspect;
        walk.updateProjectionMatrix();
        renderer.setSize(w,h,false);
        render=true;
    }

    function snapOrbit() {
        ctl.target.set(0,0,1.1);
        overview.zoom=1;
        overview.up.set(0,1,0);
        if(mode==='plan') overview.position.set(0,132,1.101);
        else overview.position.set(13,79,100);
        overview.updateProjectionMatrix();
        ctl.update();
    }

    function resetWalk() {
        walk.position.set(51.4,heightAt(51.4)+1.66,(gate[0].z+gate[1].z)/2);
        yaw=-Math.PI/2+.047;
        pitch=-.070;
        aim();
    }

    function aim() {
        walk.rotation.order='YXZ';
        walk.rotation.set(pitch,yaw+Math.PI,0);
    }

    function setMode(name) {
        mode=name;
        keys.clear();
        camera=(mode==='walk')?walk:overview;
        ctl.enabled=mode!=='walk';
        ctl.enableRotate=mode==='orbit';
        if(mode==='plan') ctl.minPolarAngle=ctl.maxPolarAngle=.00001;
        else {ctl.minPolarAngle=.04;ctl.maxPolarAngle=1.505;}
        if(mode==='walk') resetWalk(); else snapOrbit();
        oldZoom=NaN;
        render=true;
    }

    function focus(at,size=8,approach) {
        if (mode==='walk') {
            const offsets=[[.65,1],[1,.42],[.12,1],[-.72,1],[-.85,-.47],[.48,-.78],[.9,-1],[-1,.1]];
            if (approach) offsets.unshift(approach);
            const found=offsets.map(([x,z])=>({x:at.x+x*size*.75,z:at.z+z*size*.75})).find(p=>validStep(p.x,p.z));
            if(!found) return;
            walk.position.set(found.x,heightAt(found.x)+1.66,found.z);
            yaw=Math.atan2(at.x-found.x,at.z-found.z);
            pitch=-.12;
            aim();
        } else {
            const offset=overview.position.clone().sub(ctl.target);
            ctl.target.set(at.x,heightAt(at.x)+.4,at.z);
            overview.position.copy(ctl.target).add(offset);
            overview.zoom=T.MathUtils.clamp(72/Math.max(17,size*2.7),1.4,4.5);
            overview.updateProjectionMatrix();
            ctl.update();
        }
        render=true;
    }

    function pick(e) {
        const rect=canvas.getBoundingClientRect();
        pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
        ray.setFromCamera(pointer,camera);
        if(!placing) {
            const hit=ray.intersectObjects([...pinMap.values()])[0];
            if (hit) onPin(hit.object.userData.noteId);
            return;
        }
        const hit=ray.intersectObjects([...site.surfaceMeshes,site.structures],true)[0];
        if(hit && withinScene(hit.point.x,hit.point.z)) onPoint({x:+hit.point.x.toFixed(2),z:+hit.point.z.toFixed(2),offset:+T.MathUtils.clamp(hit.point.y-heightAt(hit.point.x),0,17).toFixed(2)});
        else onPoint(null);
    }

    canvas.addEventListener('pointerdown',e=>{
        if(e.button!==0 && e.pointerType!=='touch') return;
        if(drag && e.pointerId!==drag.id) {drag.moved=true;return;}
        drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};
        if(mode==='walk') canvas.setPointerCapture(e.pointerId);
        viewport.focus({preventScroll:true});
    });
    canvas.addEventListener('pointermove',e=>{
        if(!drag || drag.id!==e.pointerId) return;
        if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4) drag.moved=true;
        if(mode==='walk' && drag.moved && !placing) {
            yaw-=(e.clientX-drag.lastX)*.0052;
            pitch=T.MathUtils.clamp(pitch-(e.clientY-drag.lastY)*.0045,-1.24,1.04);
            aim();render=true;
        }
        drag.lastX=e.clientX;drag.lastY=e.clientY;
    });
    canvas.addEventListener('pointerup',e=>{
        if(!drag || drag.id!==e.pointerId) return;
        if(!drag.moved) pick(e);
        drag=null;
    });
    canvas.addEventListener('pointercancel',()=>{drag=null;});
    window.addEventListener('keydown',e=>{
        if(mode!=='walk'||document.activeElement!==viewport) return;
        if(e.code in vectors||e.code==='ShiftLeft'||e.code==='ShiftRight') {e.preventDefault();keys.add(e.code);}
    });
    window.addEventListener('keyup',e=>keys.delete(e.code));
    window.addEventListener('blur',()=>keys.clear());
    viewport.addEventListener('blur',()=>keys.clear());
    touch.querySelectorAll('button').forEach(btn=>{
        btn.addEventListener('pointerdown',e=>{
            e.preventDefault();viewport.focus({preventScroll:true});
            btn.setPointerCapture(e.pointerId);keys.add(btn.dataset.key);
        });
        for (const event of ['pointerup','pointercancel','lostpointercapture']) btn.addEventListener(event,()=>keys.delete(btn.dataset.key));
    });

    function walkFrame(dt) {
        let lateral=0,forward=0;
        for(const code of keys) if(vectors[code]) {
            lateral+=vectors[code][0];
            forward+=vectors[code][1];
        }
        if(lateral||forward) {
            const p=walk.position, speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?8.0:4.4;
            const length=Math.hypot(lateral,forward);
            const step=dt*speed/length;
            const dx=(Math.sin(yaw)*forward-Math.cos(yaw)*lateral)*step;
            const dz=(Math.cos(yaw)*forward+Math.sin(yaw)*lateral)*step;
            if(validStep(p.x+dx,p.z)) p.x+=dx;
            if(validStep(p.x,p.z+dz)) p.z+=dz;
            render=true;
        }
        const p=walk.position;
        const floor=contains(porch,p.x,p.z)?site.deckY:heightAt(p.x);
        const y=T.MathUtils.lerp(p.y,floor+1.66,Math.min(1,dt*10));
        if(Math.abs(y-p.y)>.0006) {p.y=y;render=true;}
    }

    function loop(now) {
        const dt=Math.min(.045,(now-last)/1000);
        last=now;
        if(mode==='walk') walkFrame(dt); else ctl.update(dt);
        if(Number.isNaN(oldZoom) || camera===overview && Math.abs(overview.zoom-oldZoom)>.025) {
            oldZoom=overview.zoom;
            const size=mode==='walk'?1.2:1.85/Math.sqrt(Math.max(1,overview.zoom));
            for(const pin of pinMap.values()) pin.scale.setScalar(size);
        }
        if(render) {
            camera.getWorldDirection(eyeDirection);
            const heading=mode==='plan'?0:Math.atan2(-eyeDirection.x,-eyeDirection.z)*180/Math.PI;
            if(Math.abs(lastHeading-heading)>.3 || Number.isNaN(lastHeading)){compass.style.transform='rotate('+heading+'deg)';lastHeading=heading;}
            if(mode==='walk') {
                const at='Отметка '+fmt.format(heightAt(walk.position.x))+' м';
                if(at!==lastWalkLabel || cameraLabel.textContent!==at){cameraLabel.textContent=at;lastWalkLabel=at;}
            }
            renderer.render(scene,camera);
            render=false;
        }
        requestAnimationFrame(loop);
    }
    ctl.addEventListener('change',()=>{render=true;});
    rs.observe(stage);
    resize();
    snapOrbit();
    renderer.shadowMap.needsUpdate=true;
    requestAnimationFrame(loop);

    return {
        setMode,focus,
        reset(){mode==='walk'?resetWalk():snapOrbit();render=true;},
        setLayer(id,visible) {(id==='water'?site.waterLayer:site.powerLayer).visible=visible;render=true;},
        setPlacing(value){placing=value;},
        setPins(notes,selected) {
            for(const s of pinMap.values()) {
                site.marking.remove(s);s.material.map.dispose();s.material.dispose();
            }
            pinMap=new Map();
            notes.forEach((note,index)=>{
                const sprite=new T.Sprite(pinMaterial(index+1,note.id===selected));
                sprite.position.set(note.x,heightAt(note.x)+Math.max(1.03,(note.offset||0)+.60),note.z);
                sprite.userData.noteId=note.id;
                site.marking.add(sprite);
                pinMap.set(note.id,sprite);
            });
            oldZoom=NaN;render=true;
        },
    };
}





