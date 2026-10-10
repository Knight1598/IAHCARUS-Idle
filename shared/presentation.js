// Cosmetic identifiers are shared by save validation and the procedural renderer.
export const dimensionThemes = [
 ['solar','Solar Crucible','เบ้าหลอมสุริยะ','#ffd06a',0,'วงโคจรและรังสีสุริยะ'],
 ['veil','Veil Between Worlds','ม่านระหว่างโลก','#79ffdb',1,'ประตูม่านมิติและเส้นแสงขาดช่วง'],
 ['wyrm','Wyrm Cathedral','มหาวิหารมังกร','#ff6c91',2,'รอยกรงเล็บและซี่โครงมังกร'],
 ['glacier','Frozen Infinity','อนันต์เยือกแข็ง','#9bdeff',3,'ผลึกหกเหลี่ยมและพื้นน้ำแข็ง'],
 ['machine','Machine Heart','หัวใจจักรกล','#ffae67',4,'กริดวงจรและเสาปฏิกรณ์'],
 ['nebula','Nebula Sea','ทะเลเนบิวลา','#c5a3ff',5,'เกลียวกาแล็กซีและสะพานดวงดาว'],
 ['sanctum','Royal Sanctum','บัลลังก์พิพากษา','#f4e6a1',6,'วงตราพิพากษาและเสาเรขาคณิต'],
 ['abyss','Silent Abyss','ห้วงลึกไร้เสียง','#758aff',7,'วงแหวนยุบตัวในความมืด'],
].map(([id,name,label,color,pattern,description])=>({id,name,label,color,pattern,description}));
export const finisherThemes = [
 ['sunburst','Solar Bloom','บุปผาสุริยะ','#ffcd68',0],['rift','Rift Collapse','มิติแตกสลาย','#82ffdc',1],
 ['claw','Wyrm Verdict','คำพิพากษามังกร','#ff729a',2],['crystal','Crystal Coffin','โลงผลึก','#9bdeff',3],
 ['grid','System Erasure','ลบจากระบบ','#ffb177',4],['orbit','Starfall Seal','ตราดาวตก','#cfb0ff',5],
 ['crown','Crownfall','มงกุฎล่มสลาย','#f4e6a1',6],['eclipse','Event Horizon','ขอบฟ้าเหตุการณ์','#93a3ff',7],
].map(([id,name,label,color,pattern])=>({id,name,label,color,pattern,description:'เอฟเฟกต์ปิดฉากเสริมท่าสังหารของสกิน'}));
export const profileFrames = ['อัศวินนีออน','ราชันสุริยะ','ม่านวิญญาณ','อสรพิษชาด','ผลึกเหมันต์','วงจรจักรกล','ดาราจักร','ตราพิพากษา','สุริยคราส','นักล่าค่าหัว','ผู้ยึดคลัง','จอมยุทธ์กระดาน'].map((label,pattern)=>({id:`frame-${pattern+1}`,name:`Signature ${pattern+1}`,label,color:['#7ee9ff','#ffd06a','#79ffdb','#ff6c91','#9bdeff','#ffae67','#c5a3ff','#f4e6a1','#758aff','#ef9cff','#8bffc0','#f5bebe'][pattern],pattern,description:'กรอบเรขาคณิตสำหรับตราผู้เล่นและหน้าสร้างตัวละคร'}));
finisherThemes.push(...[
 ['lance','Heaven Piercer','หอกทะลวงสวรรค์','#e0faff',8],['lotus','Blade Lotus','บัวดาบพิฆาต','#ffa8c9',9],
 ['meteor','Meteor Break','ฝนดาวพิฆาต','#ff9c67',10],['prison','Prismatic Prison','คุกปริซึม','#a6ffe9',11],
 ['cross','Judgment Cross','กางเขนพิพากษา','#fff3b0',12],['spiral','Spiral Requiem','เกลียวส่งวิญญาณ','#bf9cff',13],
 ['nova','Supernova Heart','หัวใจซูเปอร์โนวา','#ffdda0',14],['blade','Final Crescent','จันทร์เสี้ยวสุดท้าย','#87cdff',15],
].map(([id,name,label,color,pattern])=>({id,name,label,color,pattern,description:'ตราสังหารเรขาคณิตเฉพาะตัวในมิติต่อสู้'})));
export const boardThemes = [
 ['circuit','Circuit Matrix','กระดานวงจร','#80e9ff',0],['runes','Rune Vault','กระดานอักขระ','#dab3ff',1],
 ['hex','Hex Foundry','กระดานรังผึ้ง','#ffd280',2],['waves','Tidal Glass','กระดานคลื่นแก้ว','#96ffdc',3],
 ['stars','Star Atlas','กระดานแผนที่ดาว','#a3baff',4],['shards','Crystal Mosaic','กระดานโมเสกผลึก','#ffc3ed',5],
 ['sun','Solar Dial','กระดานนาฬิกาสุริยะ','#ffe0a0',6],['void','Void Compass','กระดานเข็มทิศมิติ','#c0adff',7],
].map(([id,name,label,color,pattern])=>({id,name,label,color,pattern,description:'ลายผิวช่องกระดานและราวแสง · ใช้ร่วมกับสนามเดิมได้'}));
export const skillThemes = [
 ['orbit','Orbital Charge','สกิลวงโคจร','#ffe0a0',0],['blades','Blade Dance','สกิลระบำดาบ','#91e8ff',1],
 ['crystal','Crystal Awakening','สกิลผลึกตื่น','#ddaaff',2],['gate','Rift Gate','สกิลประตูมิติ','#97ffd3',3],
 ['lightning','Thunder Crown','สกิลมงกุฎสายฟ้า','#ffd681',4],['helix','Helix Drive','สกิลขับเคลื่อนเกลียว','#ffafcb',5],
 ['sigil','Royal Sigil','สกิลตราราชัน','#fff0b8',6],['nova','Nova Core','สกิลแกนดาวระเบิด','#acc4ff',7],
].map(([id,name,label,color,pattern])=>({id,name,label,color,pattern,description:'เอฟเฟกต์ชาร์จและโจมตีทุกท่า · ไม่เพิ่มพลังหรือเปลี่ยนการเดิน'}));
export const cosmeticGroups = {dimension:dimensionThemes,finisher:finisherThemes,frame:profileFrames,board:boardThemes,skill:skillThemes};
export const rarityForPattern = pattern => ['common','common','rare','rare','rare','epic','epic','legendary'][pattern%8];
export const presentationCatalog = Object.entries(cosmeticGroups).flatMap(([kind,themes])=>themes.map((theme,i)=>({id:`${kind}-${theme.id}`,kind,cosmetic:theme.id,label:theme.label,name:theme.name,color:theme.color,pattern:theme.pattern,description:theme.description,rarity:rarityForPattern(theme.pattern),price:kind==='frame'?180+i*60:500+i*150,currency:'credits',shards:0,credits:0})));
