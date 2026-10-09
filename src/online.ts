/** Only secure public origins (or local development) can host a duel. */
export function duelEndpoint(raw:unknown):string|null {
  if(typeof raw!=='string'||!raw.trim())return null;
  try {
    const u=new URL(raw.trim());
    if(!['http:','https:','ws:','wss:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||!['/','/ws',''].includes(u.pathname))return null;
    const local=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
    if(['http:','ws:'].includes(u.protocol)&&!local)return null;
    u.protocol=['https:','wss:'].includes(u.protocol)?'wss:':'ws:';u.pathname='/ws';return u.href;
  }catch{return null;}
}
export function duelInvite(page:string,code:string,endpoint:string){
  if(!/^[A-F0-9]{6}$/.test(code))throw Error('Invalid room code');
  const server=duelEndpoint(endpoint);if(!server)throw Error('Invalid duel server');
  const u=new URL(page);u.searchParams.delete('token');u.searchParams.set('room',code);u.searchParams.set('server',server);return u.href;
}
export function invitationCode(search:string){const raw=new URLSearchParams(search).get('room')?.toUpperCase();return raw&&/^[A-F0-9]{6}$/.test(raw)?raw:null;}
