// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments, Vector3, DynamicDrawUsage } from 'three';
import { seed, type MoonfallConfig, type MoonQuality } from './AbyssalMoonfallConfig';
/** Fixed branching filament buffer. Coherent flashes connect the moving shell and satellites. */
export class MoonLightning {
  readonly root=new Group();private readonly positions=new Float32Array(8*24*2*3);private readonly geometry=new BufferGeometry();
  private readonly core=new LineBasicMaterial({color:'#dddcff',transparent:true,opacity:0,depthWrite:false,fog:false});
  private readonly glow=new LineBasicMaterial({color:'#8670ce',transparent:true,opacity:0,depthWrite:false,blending:AdditiveBlending,fog:false});
  private readonly start=new Vector3();private readonly end=new Vector3();private readonly prev=new Vector3();private readonly p=new Vector3();
  constructor(){this.geometry.setAttribute('position',new BufferAttribute(this.positions,3).setUsage(DynamicDrawUsage));
    for(const mat of [this.core,this.glow]){const line=new LineSegments(this.geometry,mat);line.frustumCulled=false;this.root.add(line);}}
  update(t:number,center:Vector3,c:Readonly<MoonfallConfig>,q:MoonQuality,impact:number,hand:Vector3):void{
    let k=0;const phase=t*c.lightningFrequency,cycle=Math.floor(phase),flash=Math.pow(Math.max(0,1-(phase-cycle)*5),2);
    const after=t-impact;this.root.visible=(t<1.5||t>3)&&(after<1);
    if(t<1.5){this.prev.copy(hand);for(let j=1;j<=18;j++){
      this.p.copy(hand).lerp(center,j/18);this.p.y-=c.moonRadius*j/18;this.p.x+=Math.sin(j*.9+t*2.)*Math.sin(j/18*Math.PI)*.8;
      this.positions[k++]=this.prev.x;this.positions[k++]=this.prev.y;this.positions[k++]=this.prev.z;
      this.positions[k++]=this.p.x;this.positions[k++]=this.p.y;this.positions[k++]=this.p.z;this.prev.copy(this.p);
    }}
    for(let bolt=0;t>=1.5&&bolt<q.lightning;bolt++){
      const a=bolt*2.39996+cycle*.8;this.start.set(Math.cos(a)*c.moonRadius*.65,Math.sin(a)*c.moonRadius*.5,Math.sin(a)*c.moonRadius*.65).add(center);
      this.end.set(center.x+Math.cos(a+.3)*c.moonRadius*1.55,center.y-c.moonRadius*(.8+seed(bolt)*.7),center.z+Math.sin(a+.3)*c.moonRadius*1.55);this.prev.copy(this.start);
      for(let j=1;j<=18;j++){
        this.p.copy(this.start).lerp(this.end,j/18);const amp=Math.sin(j/18*Math.PI)*3;
        this.p.x+=(seed(j+bolt*18+cycle*7)-.5)*amp;this.p.z+=(seed(j*7+bolt*8+cycle*3)-.5)*amp;
        this.positions[k++]=this.prev.x;this.positions[k++]=this.prev.y;this.positions[k++]=this.prev.z;
        this.positions[k++]=this.p.x;this.positions[k++]=this.p.y;this.positions[k++]=this.p.z;
        if(j%3===0){this.positions[k++]=this.p.x;this.positions[k++]=this.p.y;this.positions[k++]=this.p.z;
          this.positions[k++]=this.start.x+(this.p.x-this.start.x)*.8;this.positions[k++]=this.start.y+(this.p.y-this.start.y)*.8;this.positions[k++]=this.start.z+(this.p.z-this.start.z)*.8+2;}
        this.prev.copy(this.p);
      }
    }
    this.geometry.setDrawRange(0,k/3);this.geometry.getAttribute('position').needsUpdate=true;
    this.core.opacity=t<1.5?.16*Math.sin(t/1.5*Math.PI):flash*c.lightningIntensity*(after<0?1:Math.max(0,1-after));this.glow.opacity=this.core.opacity*.3;
  }
  dispose():void{this.geometry.dispose();this.core.dispose();this.glow.dispose();this.root.clear();}
}
