/** Size delivered after browser layout, instead of a synchronous layout read
 * after the HUD has changed hundreds of styles. These layers live with the HUD.
 * Fallback dimensions cover the first frame and display:none transitions. */
export class ObservedSize {
  width=0;
  height=0;
  private readonly observer:ResizeObserver;
  constructor(element:Element){
    this.observer=new ResizeObserver(entries=>{
      for(const {target,contentRect} of entries)if(target===element){
        this.width=contentRect.width;this.height=contentRect.height;
      }
    });
    this.observer.observe(element);
  }
  dispose(){this.observer.disconnect();}
}
