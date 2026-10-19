# Kardias Cunda — web sitesi

Tek sayfalık, statik site (derleme gerekmez).

```
index.html        Sayfa (Türkçe metinler burada)
css/style.css     Tasarım (renkler en üstte :root içinde)
js/i18n.js        İngilizce çeviriler
js/main.js        Davranışlar + AYARLAR (telefon, WhatsApp, Instagram, galeri, yorumlar)
data/menu.json    Menü — ürün, fiyat ve etiketleri buradan düzenleyin
```

## Yerelde çalıştırma
Menü `fetch` ile yüklendiği için dosyayı çift tıklayarak değil, bir sunucuyla açın:

    python -m http.server 8000      # sonra http://localhost:8000

## Yayına almadan önce
- `js/main.js` → `CONFIG.whatsapp`: WhatsApp hattının cep numarası (şu an sabit hat yazılı).
- `CONFIG.instagram`: gerçek Instagram adresi.
- `REVIEWS` ve `index.html` içindeki 4.7 / 1.200+ yorum: örnek veridir, gerçek Google verisiyle değiştirin.
- Görseller Unsplash örnekleridir; kendi fotoğraflarınızla değiştirin.
- Ürün fotoğrafları: data/menu.json içinde her ürünün "image" alanı. Kendi fotoğrafınızı img/menu/ klasörüne koyup
  "image": "img/menu/margherita.jpg" yazmanız yeterli (kare, en az 440x440 px önerilir).
- `data/menu.json` fiyatları örnektir.
