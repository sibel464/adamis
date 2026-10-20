# Kardias Cunda — web sitesi

**Önizleme:** https://sibel464.github.io/kardias-cunda/


Tek sayfalık, statik site (derleme gerekmez).

```
index.html        Sayfa (Türkçe metinler burada)
css/style.css     Tasarım (renkler en üstte :root içinde)
js/i18n.js        İngilizce çeviriler
js/main.js        Site davranışları
data/menu.json    Menü (ürünler, fiyatlar, kategoriler, fiks menü)
data/site.json    Site içeriği (iletişim, saatler, fotoğraflar, galeri, etkinlik, yorum, duyuru, metinler)
admin.html        Yönetim paneli (js/admin.js, css/admin.css)
```

## Yönetim paneli
Adres: https://sibel464.github.io/kardias-cunda/admin.html (footer'daki "Yönetim" bağlantısı da oraya gider).
Giriş için bir kez GitHub erişim anahtarı oluşturulur (adımlar giriş ekranında yazıyor).
"Kaydet ve yayınla" değişiklikleri GitHub'a yazar, site 1–2 dakikada güncellenir.
Panel kullanıldıktan sonra bilgisayarda kod düzenleyecekseniz önce `git pull` yapın.

Panelden yapılabilenler:
- Menü: ürün/kategori/bölüm ekleme-silme-sıralama, fiyat, fotoğraf, etiketler, tüm menüde arama,
  ürünü kopyalama ve başka kategoriye taşıma, "Bugün yok" işareti, ürünü/kategoriyi gizleme
- Fiks menü (gizlenebilir), galeri, etkinlikler, yorumlar ve puan
- İletişim bilgileri, çalışma saatleri, ana fotoğraflar, sitedeki tüm başlık ve metinler (TR/EN)
- Duyuru şeridi ve bölümleri (galeri, konaklama vb.) sitede gizleme/gösterme

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

## Önizlemeyi güncellemek
Değişiklikleri kaydedip GitHub'a göndermeniz yeterli; GitHub Pages 1–2 dakikada yeni sürümü yayınlar:

    git add -A
    git commit -m "Menü fiyatları güncellendi"
    git push

## Gerçek yayına geçmeden önce
- index.html içindeki `<meta name="robots" content="noindex, nofollow">` satırını silin (önizleme arama motorlarında çıkmasın diye eklendi).
- Yorumlar bölümündeki "Örnek içerik" notunu, gerçek yorumları ekledikten sonra kaldırın.
- Footer'daki "Fotoğraf künyesi" Cunda fotoğraflarının lisansı gereğidir; o fotoğrafları kullandıkça kaldırmayın.
