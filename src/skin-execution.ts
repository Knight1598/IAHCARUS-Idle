import type { SkinId } from './profile.ts';
import { CAPTURE_CONTACT, CAPTURE_DEATH } from './combat.ts';
const ramp=(x:number,a:number,b:number)=>Math.max(0,Math.min(1,(x-a)/(b-a)));
/** Uses the capture clock: no timers, outcome changes, or additional delay. */
export function executionFrame(skin:SkinId,t:number) {
  const special=['storm','void','prism','nova','phantom','dragon'].includes(skin);
  const gather=ramp(t,1.5/2.6,1.7/2.6),release=ramp(t,1.7/2.6,CAPTURE_CONTACT);
  const dissolve=ramp(t,CAPTURE_CONTACT,CAPTURE_DEATH+.09);
  return {special,gather,release,dissolve,quiet:special&&t>=1.7/2.6&&t<CAPTURE_CONTACT,
    strength:gather*(1-dissolve),collapse:['void','phantom'].includes(skin)?dissolve:0,
    echo:['prism','dragon'].includes(skin)?gather*(1-release):0,
    phase:!special?'signature':t<1.5/2.6?'duel':t<1.7/2.6?'gather':t<CAPTURE_CONTACT?'anticipation':t<CAPTURE_DEATH?'execute':'dissolve'};
}
