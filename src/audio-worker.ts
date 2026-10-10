import {renderSoundRecipe,renderAmbience} from './audio-synthesis';
import {renderMusic} from './audio-music';
import {processBedPCM,readProcessingMode} from './audio-processing';
self.onmessage=event=>{
 const {state,ambience,recipe,seed,key,processing}=event.data,mode=readProcessingMode(processing);
 const pcm=recipe?renderSoundRecipe(recipe,24000,seed,mode,key):processBedPCM(ambience?renderAmbience(seed,12000,31.7,ambience):renderMusic(state,seed),mode);
 self.postMessage(pcm,{transfer:[pcm.left.buffer,pcm.right.buffer]});
};
