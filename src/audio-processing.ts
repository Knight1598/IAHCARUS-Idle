import {biquadHP,biquadLP,biquadPeak} from '@thi.ng/dsp/biquad';
import {filterFeedbackDelay} from '@thi.ng/dsp/filter-delay';
import type {SoundRecipe} from './sound.ts';
import type {StereoPCM} from './audio-synthesis.ts';
export type AudioProcessingMode='cinematic'|'focused'|'dry';
export const AUDIO_DSP_ADDON={name:'@thi.ng/dsp',version:'4.7.123',license:'Apache-2.0'} as const;
export function readProcessingMode(mode:unknown):AudioProcessingMode{return mode==='dry'||mode==='focused'?mode:'cinematic';}
type Material={cutoff:number;body:number;boost:number;room:number;delays:[number,number];feedback:number;width:number};
const materials:Record<string,Material>={
 classic:{cutoff:4200,body:680,boost:1.3,room:.13,delays:[.031,.043],feedback:.22,width:1},
 ember:{cutoff:3100,body:380,boost:2.4,room:.1,delays:[.021,.037],feedback:.19,width:.92},
 frost:{cutoff:4900,body:1800,boost:1.4,room:.19,delays:[.049,.071],feedback:.29,width:1.1},
 astral:{cutoff:3800,body:900,boost:1.4,room:.24,delays:[.067,.089],feedback:.3,width:1.14},
 royal:{cutoff:2800,body:290,boost:2.6,room:.19,delays:[.043,.059],feedback:.25,width:.9},
 storm:{cutoff:4400,body:1300,boost:1.5,room:.09,delays:[.017,.029],feedback:.16,width:1.1},
 void:{cutoff:2400,body:460,boost:1.9,room:.27,delays:[.079,.103],feedback:.3,width:1.18},
 prism:{cutoff:4700,body:2200,boost:1.6,room:.2,delays:[.041,.061],feedback:.28,width:1.12},
 nova:{cutoff:3900,body:760,boost:2.2,room:.17,delays:[.023,.047],feedback:.25,width:1.06},
 phantom:{cutoff:2500,body:580,boost:1.5,room:.26,delays:[.061,.097],feedback:.31,width:1.17},
 dragon:{cutoff:2900,body:250,boost:2.8,room:.12,delays:[.029,.053],feedback:.23,width:.94},
};
export function processingIdentity(recipe:SoundRecipe,key=''){
 const named=key.split(':').find(part=>Object.hasOwn(materials,part));if(named)return named;
 const texture=recipe.find(layer=>layer.kind==='tone')?.texture;
 return texture==='void'?'void':texture==='glass'?'prism':texture==='choir'?'astral':texture==='brass'?'royal':texture==='plasma'?'ember':'classic';
}
/** Bounded per-cue DSP. Every echo belongs to the same buffer and stops with its source.
 * No live feedback graph, extra AudioContext, ScriptProcessor or external impulse file. */
export function processEffectPCM(pcm:StereoPCM,recipe:SoundRecipe,mode:AudioProcessingMode='cinematic',key=''):StereoPCM{
 if(mode==='dry')return pcm;
 const rate=pcm.sampleRate,m=materials[processingIdentity(recipe,key)],focused=mode==='focused';
 const feedback=/^event:(ui|ui-|turn|timer-low|join|leave|ready)/.test(key)||recipe.every(v=>(v.room??.18)<.06);
 const room=feedback?0:m.room*(focused?.24:1),extra=room?Math.round(rate*(focused?.06:.18)):0;
 const left=new Float32Array(pcm.left.length+extra),right=new Float32Array(left.length);
 const lanes=Array.from({length:2},()=>({hp:biquadHP(36/rate,.71),lp:biquadLP(Math.min(m.cutoff,rate*.2)/rate,.68),body:biquadPeak(m.body/rate,.75,m.boost),echo:filterFeedbackDelay(Math.round(rate*m.delays[0]),biquadLP(2300/rate,.7),focused?.08:m.feedback),late:filterFeedbackDelay(Math.round(rate*m.delays[1]),biquadLP(1700/rate,.7),focused?.07:m.feedback*.85)}));
 let power=0;for(let i=0;i<pcm.left.length;i++)power+=(pcm.left[i]**2+pcm.right[i]**2)*.5;
 const rms=Math.sqrt(power/Math.max(1,pcm.left.length));
 const action=key.split(':').find(v=>['impact','clash','release','dash','death','disintegrate','charge','finisher','draw','lock','armor','check'].includes(v));
 const quietLanding=action==='impact'&&!key.startsWith('combat:')&&key.split(':').at(-2)==='false';
 const target=quietLanding?.018:feedback?Math.min(rms,.018):action==='impact'||action==='clash'?.056:action==='release'||action==='dash'?.04:action==='draw'||action==='lock'||action==='armor'?.019:.03;
 // Lift thin bodies rather than normalize all cues to the same loudness. UI never boosted.
 const gain=rms>1e-8?Math.min(feedback?1:3.8,Math.max(.72,target/rms)):1;
 const endFade=Math.min(Math.round(rate*.025),left.length),width=focused?Math.min(m.width,1):m.width;
 for(let i=0;i<left.length;i++){
  const dryL=lanes[0].lp.next(lanes[0].body.next(lanes[0].hp.next((pcm.left[i]||0)*gain)));
  const dryR=lanes[1].lp.next(lanes[1].body.next(lanes[1].hp.next((pcm.right[i]||0)*gain)));
  const echoL=room?lanes[0].echo.next(dryL)+lanes[0].late.next(dryL)*.5:0;
  const echoR=room?lanes[1].echo.next(dryR)+lanes[1].late.next(dryR)*.5:0;
  const a=dryL+room*(echoR+echoL*.25),b=dryR+room*(echoL+echoR*.25),mid=(a+b)*.5,side=(a-b)*.5*width;
  const fade=i>=left.length-endFade?(left.length-1-i)/endFade:1;
  left[i]=Math.tanh((mid+side)/.6)*.6*fade;right[i]=Math.tanh((mid-side)/.6)*.6*fade;
 }
 return {left,right,sampleRate:rate,duration:left.length/rate};
}
/** Beds receive only gentle tonal shaping; loop duration and silence at seams stay intact. */
export function processBedPCM(pcm:StereoPCM,mode:AudioProcessingMode):StereoPCM{
 if(mode==='dry')return pcm;
 const filters=Array.from({length:2},()=>({hp:biquadHP(30/pcm.sampleRate),lp:biquadLP(Math.min(mode==='focused'?3400:4400,pcm.sampleRate*.25)/pcm.sampleRate,.7)}));
 const left=new Float32Array(pcm.left.length),right=new Float32Array(pcm.right.length);
 for(let i=0;i<left.length;i++){left[i]=filters[0].lp.next(filters[0].hp.next(pcm.left[i]));right[i]=filters[1].lp.next(filters[1].hp.next(pcm.right[i]));}
 return {...pcm,left,right};
}
