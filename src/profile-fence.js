import * as T from 'three';

export function profileFence(parent, a, b, heightAt, colors) {
    const dx=b.x-a.x,dz=b.z-a.z;
    const length=Math.hypot(dx,dz);
    const nx=-dz/length,nz=dx/length;
    const height=1.68,sections=Math.ceil(length/.036);
    const inside=new T.MeshStandardMaterial({color:colors.inside,metalness:.24,roughness:.62,side:T.DoubleSide});
    const outside=new T.MeshStandardMaterial({color:colors.outside,metalness:.23,roughness:.65,side:T.DoubleSide});
    const createSheet=(side,mat)=>{
        const vertices=[],indices=[];
        for(let i=0;i<=sections;i++) {
            const k=i/sections;
            const baseX=a.x+dx*k,baseZ=a.z+dz*k;
            const y=heightAt(baseX);
            const corrugation=.011*Math.cos(k*length/.17*2*Math.PI);
            const offset=corrugation+side*.011;
            vertices.push(baseX+nx*offset,y+.07,baseZ+nz*offset,baseX+nx*offset,y+height,baseZ+nz*offset);
            if(i) {
                const l=i*2-2;
                if(side>0) indices.push(l,l+2,l+1,l+1,l+2,l+3);
                else indices.push(l,l+1,l+2,l+1,l+3,l+2);
            }
        }
        const geo=new T.BufferGeometry();
        geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
        geo.setIndex(indices);geo.computeVertexNormals();
        const sheet=new T.Mesh(geo,mat);
        sheet.castShadow=sheet.receiveShadow=true;
        parent.add(sheet);
    };
    createSheet(1,inside);
    createSheet(-1,outside);
}
