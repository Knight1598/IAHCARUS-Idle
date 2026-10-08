/** Cosmetic battlefields; never alter legal moves or piece strength. */
export const arenas = {
  citadel: { name: "ราชวังดารา", subtitle: "Star Citadel", icon: "♜", description: "เสาราชวังและวงตราราชัน แผ่ตราพลังเมื่อปะทะ", effect: "วงตราราชัน", color: "#73e1ff", dark: 0x172a40, light: 0x68869b, background: 0x080f1c, floor: 0x101c2c, stone: 0x26394f, glow: 0x73e1ff, sky: 0xc8e8ff },
  ember: { name: "เตาหลอมอัคนี", subtitle: "Ember Forge", icon: "♨", description: "ปล่องภูเขาไฟ สะเก็ดลาวาและคลื่นไฟแตกกระจาย", effect: "ระเบิดลาวา", color: "#ff9b4a", dark: 0x35252c, light: 0x998076, background: 0x170b14, floor: 0x23141c, stone: 0x4d2830, glow: 0xff9b4a, sky: 0xffd8be },
  frost: { name: "วิหารเหมันต์", subtitle: "Frost Sanctum", icon: "❄", description: "เสาผลึกหิมะ วงน้ำแข็งแตกเป็นแฉกเมื่อโจมตี", effect: "ผลึกเยือกแข็ง", color: "#91deff", dark: 0x1c344a, light: 0x90acba, background: 0x0a1523, floor: 0x162b3d, stone: 0x416784, glow: 0x91deff, sky: 0xdcf5ff },
  astral: { name: "รอยแยกจักรวาล", subtitle: "Astral Rift", icon: "✧", description: "วงแหวนดาวลอยเหนือห้วงอวกาศ คลื่นมิติบิดเป็นเกลียว", effect: "คลื่นรอยแยก", color: "#ca9fff", dark: 0x2a2545, light: 0x8c829e, background: 0x0e0b21, floor: 0x1a1734, stone: 0x433760, glow: 0xca9fff, sky: 0xe2d2ff },
  storm: { name: "ยอดผาอัสนี", subtitle: "Storm Spire", icon: "ϟ", description: "หอคอยสายฟ้าและประกายไฟฟ้า ปล่อยอัสนีตามจังหวะปะทะ", effect: "สายฟ้าแตกแขนง", color: "#88acff", dark: 0x1d2d47, light: 0x758ba9, background: 0x090e22, floor: 0x141e34, stone: 0x2c3d62, glow: 0x88acff, sky: 0xd0dbff },
  grove: { name: "พงไพรจันทรา", subtitle: "Moonlit Grove", icon: "❋", description: "ต้นไม้เรืองแสงและหิ่งห้อย ใบไม้หมุนเป็นวงพลังธรรมชาติ", effect: "เกลียวพฤกษา", color: "#84eab1", dark: 0x203c36, light: 0x8dada0, background: 0x071a19, floor: 0x122b26, stone: 0x335648, glow: 0x84eab1, sky: 0xc4ffe0 },
  reactor: { name: "แกนปฏิกรณ์นีออน", subtitle: "Neon Reactor", icon: "⌘", description: "เสาพลังงานไซไฟ ประจุวิ่งตามสนามและพัลส์กริดตอนโจมตี", effect: "พัลส์ปฏิกรณ์", color: "#ff7ecb", dark: 0x28253d, light: 0x8c8ba1, background: 0x10091e, floor: 0x1a142b, stone: 0x36304f, glow: 0xff7ecb, sky: 0xffd5ed },
  eclipse: { name: "สุสานสุริยคราส", subtitle: "Eclipse Dunes", icon: "◉", description: "พีระมิดและดวงสุริยคราส พายุทรายทองคำล้อมจุดปะทะ", effect: "พายุทรายสุริยะ", color: "#f4c776", dark: 0x3b3030, light: 0xb2a08b, background: 0x17101c, floor: 0x2b2226, stone: 0x6a5046, glow: 0xf4c776, sky: 0xffe8b9 },
} as const;
export type ArenaId = keyof typeof arenas;
export const arenaIds = Object.keys(arenas) as ArenaId[];
export function isArena(value: unknown): value is ArenaId { return typeof value === "string" && Object.hasOwn(arenas, value); }
export function arenaOptions() { return arenaIds.map((id) => `<option value="${id}">${arenas[id].icon} ${arenas[id].name}</option>`).join(""); }
