import type { SkinId } from './profile.ts';
import { CAPTURE_DURATION, CAPTURE_CONTACT, CAPTURE_DEATH } from './combat.ts';
const ramp=(x:number,a:number,b:number)=>Math.max(0,Math.min(1,(x-a)/(b-a)));
/** Uses the capture clock: no timers, outcome changes, or additional delay. */
export function executionFrame(skin:SkinId,t:number) {
  const special=['storm','void','prism','nova','phantom','dragon'].includes(skin);
  const duration=CAPTURE_DURATION/1000,gatherAt=3.12/duration,releaseAt=3.55/duration,quietAt=3.7/duration;
  const gather=ramp(t,gatherAt,releaseAt),release=ramp(t,releaseAt,CAPTURE_CONTACT);
  const dissolve=ramp(t,CAPTURE_CONTACT,CAPTURE_DEATH+.08);
  return {special,gather,release,dissolve,quiet:special&&t>=quietAt&&t<CAPTURE_CONTACT,
    strength:gather*(1-dissolve),collapse:['void','phantom'].includes(skin)?dissolve:0,
    echo:['prism','dragon'].includes(skin)?gather*(1-release):0,
    phase:!special?'signature':t<gatherAt?'duel':t<releaseAt?'gather':t<CAPTURE_CONTACT?'anticipation':t<CAPTURE_DEATH?'execute':'dissolve'};
}
