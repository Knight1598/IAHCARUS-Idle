import test from 'node:test';
import {readProfile} from '../src/profile.ts';
import assert from 'node:assert/strict';
import {readEconomy,shopCatalog,gachaBanners,bannerPool,bannerOdds,rollCapsules,forgeCosmetic,equipShopItem,cosmeticForgeCosts,lootRarity} from '../shared/economy.js';
const funded=()=>({...readEconomy(),credits:100000,shards:2000});
test('all four banners include usable items and publish normalized odds for their available rarities',()=>{
 for(const banner of gachaBanners){const pool=bannerPool(banner.id),odds=bannerOdds(banner.id,readEconomy());assert.ok(pool.length>=10);assert.ok(Math.abs(odds.reduce((s,v)=>s+v.chance,0)-100)<1e-9);assert.deepEqual([...new Set(odds.map(v=>v.rarity))].sort(),banner.id==='army'?['epic','legendary','rare']:['common','epic','legendary','rare']);for(const v of odds)assert.ok(shopCatalog.some(item=>item.id===v.product));}
 assert.equal(bannerPool('army').length,10);assert.equal(bannerPool('combat').length,24);assert.equal(bannerPool('arena').length,16);
 assert.throws(()=>bannerPool('bad'));
});
test('ten draws are atomic, same price as singles, and grant a rare on tenth with independent banner counters',()=>{
 const original=funded(),copy=structuredClone(original),{wallet,rewards}=rollCapsules(original,'combat',10,[],()=>0);
 assert.deepEqual(original,copy);assert.equal(wallet.credits,98800);assert.equal(rewards.length,10);assert.equal(rewards[9].rarity,'rare');assert.equal(rewards[9].guaranteed,true);assert.equal(wallet.bannerPity.combat.legend,10);assert.equal(wallet.bannerPity.combat.rare,0);assert.equal(wallet.bannerPity.arena.legend,0);
 const single=Array.from({length:10}).reduce(w=>rollCapsules(w,'combat',1,[],()=>0).wallet,original);assert.deepEqual(wallet,single);
 let calls=0;assert.throws(()=>rollCapsules(original,'combat',10,[],()=>++calls===6?NaN:0),/สุ่ม/);assert.deepEqual(original,copy);
 assert.throws(()=>rollCapsules({...original,credits:1199},'combat',10),/เครดิต/);assert.throws(()=>rollCapsules(original,'combat',2));
});
test('twentieth draw guarantees legendary and actual next-draw odds reflect both guarantees',()=>{
 let wallet=funded();for(let i=0;i<19;i++)wallet=rollCapsules(wallet,'arena',1,[],()=>0).wallet;
 const odds=bannerOdds('arena',wallet);assert.ok(odds.filter(v=>v.rarity!=='legendary').every(v=>v.chance===0));
 const result=rollCapsules(wallet,'arena',1,[],()=>0);assert.equal(result.rewards[0].rarity,'legendary');assert.equal(result.rewards[0].guaranteed,true);assert.deepEqual(result.wallet.bannerPity.arena,{legend:0,rare:0});
});
test('duplicate cosmetics and level-unlocked skins convert to fragments, capped rewards are truthful',()=>{
 let wallet=rollCapsules(funded(),'combat',1,[],()=>0).wallet;
 const second=rollCapsules(wallet,'combat',1,[],()=>0);assert.equal(second.rewards[0].duplicate,true);assert.equal(second.rewards[0].shards,15);assert.equal(second.wallet.inventory.length,1);
 const capped=rollCapsules({...wallet,shards:9999997},'combat',1,[],()=>0);assert.equal(capped.rewards[0].shards,3);assert.equal(capped.wallet.shards,10000000);
 const skin=rollCapsules(funded(),'army',1,['nova'],()=>0);assert.equal(skin.rewards[0].duplicate,true);assert.equal(skin.rewards[0].shards,80);
});
test('new equipment slots and fragments forge a chosen cosmetic, preserve wallet and account saves',()=>{
 let wallet=funded();for(const id of ['board-circuit','skill-orbit']){const cost=cosmeticForgeCosts[lootRarity(shopCatalog.find(v=>v.id===id))],before=wallet.shards;wallet=forgeCosmetic(wallet,id);assert.equal(wallet.shards,before-cost);wallet=equipShopItem(wallet,id);assert.throws(()=>forgeCosmetic(wallet,id),/มีสินค้า/);}
 assert.equal(wallet.equipped.board,'board-circuit');assert.equal(wallet.equipped.skill,'skill-orbit');assert.equal(wallet.credits,100000);assert.deepEqual(readEconomy(JSON.parse(JSON.stringify(wallet))),wallet);
 assert.throws(()=>forgeCosmetic({...wallet,shards:0},'board-void'),/ไม่พอ/);
});
test('loot receipts and banner counters migrate safely, bounded history cannot invent products or equip ownership',()=>{
 const old=readEconomy({credits:400,pity:7,pulls:80});assert.equal(old.pity,7);assert.equal(old.pulls,80);assert.deepEqual(old.bannerPity.combat,{legend:0,rare:0});
 let wallet=funded();for(let i=0;i<70;i++)wallet=rollCapsules(wallet,'collection',1,[],()=>0).wallet;
 assert.equal(wallet.lootHistory.length,60);assert.deepEqual(readEconomy(wallet),wallet);
 const bad=readEconomy({bannerPity:{combat:{legend:999,rare:-3}},lootHistory:[{id:'x',banner:'combat',product:'unknown',rarity:'legendary'}],equipped:{board:'board-circuit'}});assert.deepEqual(bad.bannerPity.combat,{legend:19,rare:0});assert.deepEqual(bad.lootHistory,[]);assert.deepEqual(bad.equipped,{});
});

test('account backups retain receipts, independent guarantees and the original eight-draw pity',async()=>{
 const {cosmeticProgression}=await import('../server/accounts.mjs');
 const wallet=rollCapsules({...funded(),pity:7},'collection',10,[],()=>0).wallet;
 const backup=cosmeticProgression({...readProfile(null),economy:wallet});assert.deepEqual(backup.economy,wallet);assert.equal(wallet.pity,7);
});
