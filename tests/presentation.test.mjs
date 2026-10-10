import test from 'node:test';
import assert from 'node:assert/strict';
import {readEconomy,buyShopItem,equipShopItem,shopCatalog} from '../shared/economy.js';
import {readProfile} from '../src/profile.ts';
import {presentationCatalog} from '../shared/presentation.js';

test('cosmetic shop contains distinct purchasable dimensions, finishers and player frames',()=>{
 assert.equal(presentationCatalog.length,52);assert.equal(shopCatalog.length,76);
 assert.equal(new Set(shopCatalog.map(v=>v.id)).size,76);
 for(const [kind,count] of [['dimension',8],['finisher',16],['frame',12],['board',8],['skill',8]])assert.equal(presentationCatalog.filter(v=>v.kind===kind).length,count);
});
test('cosmetics spend once, equip independently, toggle off and survive saves without affecting skin or rules',()=>{
 let wallet={...readEconomy(),credits:5000};
 for(const [id,kind] of [['dimension-solar','dimension'],['finisher-sunburst','finisher'],['frame-frame-1','frame']]){
  const before=wallet.credits;wallet=buyShopItem(wallet,id);assert.equal(wallet.credits,before-shopCatalog.find(v=>v.id===id).price);
  assert.throws(()=>buyShopItem(wallet,id),/มีสินค้านี้แล้ว/);wallet=equipShopItem(wallet,id);assert.equal(wallet.equipped[kind],id);
 }
 assert.equal(wallet.premium,0);assert.deepEqual(wallet.owned,[]);assert.equal(wallet.credits,3820);
 const profile=readProfile(JSON.stringify({economy:wallet}));assert.deepEqual(profile.economy,readEconomy(wallet));assert.equal(profile.skin,'classic');
 wallet=equipShopItem(wallet,'dimension-solar');assert.equal(wallet.equipped.dimension,undefined);assert.equal(wallet.equipped.finisher,'finisher-sunburst');
 assert.throws(()=>equipShopItem(wallet,'dimension-abyss'),/ยังไม่มี/);
});
test('old wallets migrate and invalid or unowned equipped products cannot survive normalization',()=>{
 assert.deepEqual(readEconomy({credits:77}).inventory,[]);assert.equal(readEconomy({credits:77}).credits,77);
 const bad=readEconomy({inventory:['bad','dimension-solar','dimension-solar'],equipped:{dimension:'dimension-abyss',frame:'dimension-solar',finisher:'bad'}});
 assert.deepEqual(bad.inventory,['dimension-solar']);assert.deepEqual(bad.equipped,{});
 assert.deepEqual(readEconomy({inventory:'dimension-solar',equipped:{dimension:'dimension-solar'}}).equipped,{});
});

test('account cosmetic backup retains purchased items and validates equipped slots',async()=>{
 const {cosmeticProgression}=await import('../server/accounts.mjs');
 let wallet={...readEconomy(),credits:2000};wallet=equipShopItem(buyShopItem(wallet,'dimension-solar'),'dimension-solar');
 const profile=readProfile(JSON.stringify({economy:wallet}));
 assert.deepEqual(cosmeticProgression(profile).economy,profile.economy);
});
