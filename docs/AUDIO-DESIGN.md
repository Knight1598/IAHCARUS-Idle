# IAHCARUS audio direction

เสียงต้องบอกว่าเกิดอะไรขึ้นก่อนบอกว่าเอฟเฟกต์ใหญ่แค่ไหน แนวทางรอบนี้คือ cinematic sci-fi / anime combat ที่ยังอ่านเกมกระดานได้ ไม่เพิ่มเสียงดังทุกครั้งที่ UI เปลี่ยน

## Research boundary

เมื่อพัฒนาใน cloud environment รอบนี้ ลองเปิดคู่มือทางการ Wwise เรื่อง HDR mixing / random containers และ FMOD Studio mixing แล้ว HTTP proxy ตอบ `403 Forbidden` จึงไม่ได้อ่านหรือยืนยันเนื้อหาออนไลน์จากแหล่งเหล่านั้น รายการด้านล่างเป็นแหล่งอ่านเพิ่มเติม ไม่ใช่หลักฐานว่าได้ค้นเว็บสำเร็จ การออกแบบและข้อกำหนดในไฟล์นี้มาจากความรู้เรื่องการออกแบบเสียงเกมและการตรวจระบบเดิมของโปรเจกต์

- [Wwise documentation](https://www.audiokinetic.com/en/public-library/) — random / shuffle playback, voice limits, HDR mixing and ducking
- [FMOD Studio mixing](https://www.fmod.com/docs/2.03/studio/mixing.html) — buses, snapshots and mix control

## Sound map

| หน้าที่ | เสียงที่ใช้ | ข้อจำกัด |
| --- | --- | --- |
| เลือก / กลับ / ยืนยัน | เสียงกลไกสั้นและแห้ง ยืนยันเพิ่ม glass accent | UI cooldown 65 ms, ไม่ใช้คอร์ดแจ้งเตือนยาว |
| ซื้อของ / สวมของ | purchase flourish / selection tick | เล่นหลังธุรกรรมสำเร็จเท่านั้น |
| เดินหมาก | pressure intake → class movement → landing | การลงช่องว่างเงียบกว่าการกินหมาก |
| เตรียมต่อสู้ | draw, charge, release | ชาร์จเป็น envelope ขึ้น เสียงพุ่งเป็น broadband sweep |
| คู่ต่อสู้ตอบโต้ | clash, counter, armor | โลหะสำหรับปัดอาวุธ เวทมีเนื้อเสียงและ room แยก |
| สังหาร | anticipation silence → impact → disintegration | ตรงกับ contact clock, tail ยกเลิกพร้อมคัตซีน |
| เข้าสู่มิติ / กลับกระดาน | vacuum swell / reverse pressure | ลด ambience ระหว่างมิติ, คืน gain เมื่อกลับ |
| รุก / หมายหัว / รุกฆาต | ความกดดันต่ำ / สองจุดปะทะ / closing score | มีลำดับความสำคัญสูงกว่า UI และเสียงตกแต่ง |
| เวลาฝ่ายเราใกล้หมด | warning pulse เมื่อเข้า 10 และ 3 วินาที | เตือนครั้งเดียวต่อช่วงต่อเทิร์น, ไม่ดังในเมนูหรือแท็บที่ซ่อน |
| ถึงตาเราหลังบอต | short turn cue | เล่นหลังจบภาพ ไม่ดังระหว่างท่าสังหาร |
| เพลง | evolving modal pad, pressure rhythm, resolved ending | ลด motif ที่เหมือนเสียงปิ๊ง เพิ่ม grain และ phrase swells |
| บรรยากาศ | crackle / crystal resonance / reactor pulse / wind pressure | เสียงเบา แยก bus ไม่แย่ง transient ของการปะทะ |

## Identity

หมากมี class accent ที่รักษารูปแบบของอาวุธ: เบี้ยเป็นหอก ม้าเป็นคมดาบ บิชอปเป็นเวท เรือเป็นกลไกหนัก ควีนเป็นผลึก และคิงเป็นแรงปะทะต่ำ

Nova ใช้ energy riser, plasma release และ solar resonance; Phantom ใช้ reverse swell, detuned void และเสียงลมตัด; Dragon ใช้แรงสั่นต่ำ เสียงเกราะ และ layered claw crack ไม่ใช้เพียง pitch shift ของสกินต้นแบบ ทุกชุดมี 4 takes สลับแบบ shuffle bag ที่ไม่ซ้ำติดกัน เปลี่ยนจังหวะ/ชั้นเสียงด้วย ไม่ได้เปลี่ยนแค่ความถี่

## Mix and performance

- แยก master / music / ambience / sfx / cinematic รักษาค่ามิกซ์ที่ผู้เล่นบันทึก
- วงจรจำกัดเสียง 32 PCM voices และ cache 24 MiB; overflow เลือกตัดเสียง priority ต่ำก่อน จึงไม่ให้ปุ่มเมนูแย่งเสียงรุกหรือแรงปะทะสำคัญ
- ลดเพลงก่อน contact, ลด ambience ในมิติ และคืนมิกซ์เมื่อจบ; การกดข้ามหยุด delayed layers และ room tail ทั้งชุด
- mechanical feedback ใช้ damped inharmonic resonances; glass และ void มี oscillator texture ของตนเอง room amount แยกตามหน้าที่
- body มีฮาร์มอนิกกลางเพื่อได้ยินบนลำโพงโทรศัพท์ ไม่พึ่ง sub bass อย่างเดียว ใช้ compressor / limiter กับ mix และทดสอบ finite PCM, headroom และการยกเลิก
- synthesis ใช้ worker เตรียมคัตซีนล่วงหน้า และ cache take หลีกเลี่ยงสร้าง oscillator graph ต่อเฟรม
- ระบบยังเป็น procedural synthesis ไม่มีการดาวน์โหลดหรือใช้เสียงที่สิทธิ์ไม่ชัดเจน การตรวจ waveform/peak ไม่แทนการฟังจริงบนหูฟังและโทรศัพท์เพื่อประเมินรสนิยมและความล้า

## Scope

มิติและ finisher ในร้านใช้กับคัตซีนการกินหมากของโหมดหมากรุกที่เปิด cinematic; Battleground ใช้ฉากพร้อมกันหลายคู่และยังไม่ได้ตัดเป็นมิติรายคู่ สินค้าเป็น cosmetic trial และ wallet เดิม ไม่ใช่ระบบรับเงินจริงหรือยอดที่ตรวจสอบจากเซิร์ฟเวอร์
