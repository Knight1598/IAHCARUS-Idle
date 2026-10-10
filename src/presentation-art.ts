import type {ShopItem} from '../shared/economy.js';
/** Unique contours generated from polygons, blades and orbital glyphs; no font icons. */
export function cosmeticArt(item:Pick<ShopItem,'color'|'pattern'|'kind'>) {
 const p=item.pattern??0,n=3+p%6,color=item.color??'#81e9ff';
 const points=item.kind==='frame'&&p>=6?n*2:n;
 const vertices=Array.from({length:points},(_,i)=>{const a=i*Math.PI*2/points-Math.PI/2,r=points!==n&&i%2?24:36;return `${50+Math.cos(a)*r},${50+Math.sin(a)*r}`;}).join(' ');
 const glyphs=Array.from({length:n},(_,i)=>`<path transform="rotate(${i*360/n} 50 50)" d="M47 7 50 2 53 7 50 18Z" fill="currentColor" opacity=".7"/>`).join('');
 const centre=item.kind==='dimension'?`<ellipse cx="50" cy="50" rx="${14+p}" ry="29" stroke="currentColor" transform="rotate(${p*23} 50 50)"/>`:item.kind==='finisher'?'<path d="m27 69 40-40-23 43 29-11" stroke="currentColor" stroke-width="4"/>':'<path d="M36 58V38l14-9 14 9v20l-14 14Z" fill="currentColor" opacity=".25"/>';
 return `<svg class="cosmetic-sigil" viewBox="0 0 100 100" fill="none" style="color:${color}" aria-hidden="true"><polygon points="${vertices}" stroke="currentColor" stroke-width="1.5"/><circle cx="50" cy="50" r="${23+p%5}" stroke="currentColor" opacity=".3" stroke-dasharray="${2+p} ${4+p%3}"/>${glyphs}${centre}</svg>`;
}
