# 🎉 Tug'ilgan kun sayti

Yulduzlardan yasalgan interaktiv tabrik: ortga sanash → ism → so'zlar → zarrachalardan yig'iladigan surat → 3D galereya → salyut va tabrik.

## Ishga tushirish

Faqat Node.js kerak (16 yoki undan yangi versiya). Hech qanday `npm install` qilish shart emas.

```bash
node server.js
```

Keyin brauzerda oching: **http://localhost:3000**

## O'zingizga moslash (faqat 2 ta ish)

### 1. Suratlarni qo'shing
Suratlarni `public/photos/` papkasiga tashlang, masalan `1.jpg`, `2.jpg`, ... `6.jpg`.
U yerdagi `1.svg ... 6.svg` fayllari namuna, ularni o'chirib tashlasangiz bo'ladi.

> 💡 **Asosiy surat** zarrachalardan yig'iladi. Buning uchun yuzi yaqindan, aniq ko'ringan va foni oddiy suratni tanlang.
> 💡 Telefon suratlari juda katta bo'lsa (5–10 MB), sayt sekin ochiladi. Ularni ~1500px gacha kichraytirib oling.

### 2. `config.json` faylini to'ldiring

```json
{
  "ism": "Malika",                       // ekranda chiqadigan ism
  "kimdan": "Do'sting",                  // tabrik tagidagi imzo
  "sozlar": ["Aqlli", "Faol", "Notiq", "Ilhomlantiruvchi"],  // navbat bilan chiqadigan so'zlar
  "tabrik": "Tabrik matni...",           // oxirida harfma-harf yoziladigan matn
  "asosiyRasm": "photos/1.jpg",          // zarrachalardan yig'iladigan surat
  "rasmlar": [                           // 3D galereyadagi suratlar
    { "fayl": "photos/2.jpg", "izoh": "Birinchi xotira ✨" },
    { "fayl": "photos/3.jpg", "izoh": "O'sha kulgili kun 😂" }
  ],
  "musiqa": "music.mp3"                  // ixtiyoriy: public/ ichiga mp3 qo'ying, bo'sh qolsa musiqa yo'q
}
```

⚠️ JSON ichida izoh (`//`) yozib bo'lmaydi. Yuqoridagi izohlar faqat tushuntirish uchun berilgan, `config.json` faylining o'ziga ularni yozmang.
⚠️ Matn ichida qo'shtirnoq `"` ishlatmang. Tutuq belgisi `'` ishlatsa bo'ladi (masalan, `Tug'ilgan`).

O'zgartirgandan keyin sahifani yangilang (F5). Serverni qayta ishga tushirish shart emas.

## Internetga joylash (link qilib yuborish uchun)

Eng osoni **Render.com** (bepul):
1. Loyihani GitHub'ga yuklang.
2. Render'da **New → Web Service** ni tanlab, repozitoriyni ulang.
3. Build command maydonini bo'sh qoldiring. Start command: `node server.js`
4. Tayyor bo'lgach berilgan linkni Telegram orqali yuboring 🎁

Railway yoki Glitch ham xuddi shunday ishlaydi. Loyiha `PORT` muhit o'zgaruvchisini o'zi o'qiydi.

## Fayllar

```
tugilgan-kun/
├── server.js        ← Node.js server
├── config.json      ← ✏️ ism, matn, suratlar shu yerda
├── package.json
└── public/
    ├── index.html
    ├── style.css
    ├── app.js       ← animatsiyalar (zarrachalar, galereya, salyut)
    └── photos/      ← 📸 suratlaringiz shu yerga
```

## Interaktiv imkoniyatlar
- 👆 Barmoq yoki sichqonchani yurgizsangiz, yulduzlar undan qochadi.
- 🔄 Galereyani surib aylantirish, suratni bosib kattalashtirish mumkin.
- 🎆 Oxirgi ekranda istalgan joyni bossangiz, o'sha yerda salyut otiladi.
