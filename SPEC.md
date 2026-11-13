# Patika — mobil yol bulmaca oyunu (ortak sözleşme)

Özgün isim ve görünüm. LinkedIn markası, adı, renkleri veya görselleri KULLANILMAZ; sadece tür mekaniği (sıralı noktalardan geçen, tüm hücreleri dolduran tek yol) alınır.

## Kurallar
- N×N ızgara (kolay 5, orta 6, zor 7).
- Oyuncu parmağıyla 1 numaralı hücreden başlayıp yatay/dikey komşu hücrelere giderek tek bir yol çizer.
- Yol her hücreden tam bir kez geçer, numaralı hücrelere sırayla (1,2,3…K) uğrar, K'da biter.
- Duvar olan iki komşu hücre arasından geçilemez.
- Tüm hücreler dolu + sıra doğru = kazandın.

## Dosyalar (build yok, framework yok, dış bağımlılık yok)
- `index.html` — tek sayfa, `<script src="js/generator.js">` sonra `<script src="js/game.js">` (ES module DEĞİL; file:// üzerinden de çalışmalı)
- `css/style.css`
- `js/generator.js` — SAHİBİ: Generator ajanı
- `js/game.js`, `index.html`, `css/style.css` — SAHİBİ: UI ajanı
- `tests/generator.test.js` — SAHİBİ: QA ajanı (`node tests/generator.test.js` ile çalışır)

## generator.js arayüzü
Tarayıcıda `window.PatikaGen`, Node'da `module.exports` olarak aynı nesne:

```
PatikaGen.generate(size, seed) -> Puzzle      // seed: tamsayı, aynı seed = aynı bulmaca
PatikaGen.validate(puzzle, path) -> { complete: bool, error: string|null }
PatikaGen.canMove(puzzle, [r1,c1], [r2,c2]) -> bool   // komşu mu + duvar yok mu

Puzzle = {
  size: number,
  numbers: { "r,c": n, ... },        // n = 1..K, 1 başlangıç, K bitiş
  walls:   ["r1,c1|r2,c2", ...],      // komşu iki hücre arası duvar, küçük hücre önce (satır, sonra sütun)
  solution: [[r,c], ...]              // size*size uzunluğunda
}
```
- Bulmacanın çözümü TEK olmalı (generator kendi solver'ı ile doğrular).
- size 7 için üretim mobilde < 1 sn.

## UI gereksinimleri
- Dikey telefon ekranı (360–430px), dokunmatik: pointer events ile sürükleyerek çizim, sürüklerken sayfa kaymaz.
- Geri sürükleyince yol geri alınır; yolun herhangi bir hücresine dokununca oradan kesilir.
- Butonlar: Geri al, Temizle, İpucu (çözümün sıradaki doğru hücresini gösterir), Yeni bulmaca, zorluk seçimi.
- Süre sayacı, kazanınca kutlama ekranı + süre.
- Günlük bulmaca: seed = YYYYMMDD; en iyi süre localStorage'da (try/catch).
- Açık/koyu tema `prefers-color-scheme` ile.
