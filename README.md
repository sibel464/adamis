# Cunda Adamis — Zeytinyağlı Ev Yemekleri web sitesi

**Depo:** https://github.com/sibel464/adamis
**Önizleme:** https://sibel464.github.io/adamis/ (GitHub Pages açıldıktan sonra)

Tek sayfalık, statik site (derleme gerekmez). Kardias Cunda sitesinin kopyasından üretildi;
Kardias deposuyla ve `adamis-cunda` deposuyla bağlantısı yoktur.

```
index.html        Sayfa (Türkçe metinler burada)
css/style.css     Tasarım (renkler en üstte :root içinde)
js/i18n.js        İngilizce çeviriler
js/main.js        Site davranışları
data/menu.json    Menü (ürünler, fiyatlar, kategoriler, fiks menü)
data/site.json    Site içeriği (iletişim, saatler, fotoğraflar, galeri, yorum, duyuru, metinler)
admin.html        Yönetim paneli (js/admin.js, css/admin.css)
```

## Yönetim paneli
Adres: https://sibel464.github.io/adamis/admin.html (footer'daki "Yönetim" bağlantısı da oraya gider).
Giriş için bir kez GitHub erişim anahtarı oluşturulur (adımlar giriş ekranında yazıyor).
Anahtar oluştururken yalnızca `adamis` deposuna izin verin.
"Kaydet ve yayınla" değişiklikleri GitHub'a yazar, site 1–2 dakikada güncellenir.
Panel kullanıldıktan sonra bilgisayarda kod düzenleyecekseniz önce `git pull` yapın.

Panelden yapılabilenler:
- Menü: ürün/kategori/bölüm ekleme-silme-sıralama, fiyat, fotoğraf, etiketler, tüm menüde arama,
  ürünü kopyalama ve başka kategoriye taşıma, "Bugün yok" işareti, ürünü/kategoriyi gizleme
- Galeri, yorumlar ve puan
- İletişim bilgileri, çalışma saatleri, ana fotoğraflar, sitedeki tüm başlık ve metinler (TR/EN)
- Duyuru şeridi ve bölümleri (hikâye, galeri, yorumlar) sitede gizleme/gösterme
- Fotoğraflar: giriş arka planı, giriş tabağındaki yemek, hikâye polaroidleri

## Yerelde çalıştırma
Menü `fetch` ile yüklendiği için dosyayı çift tıklayarak değil, bir sunucuyla açın:

    python -m http.server 8000      # sonra http://localhost:8000

## Yayına almadan önce kontrol edin
İletişim bilgileri internetteki işletme kayıtlarından alındı; kaynaklar birbirini tutmuyor:
- Telefon: sabit hat 0266 327 10 64; WhatsApp için 0507 055 49 38 yazıldı. Hangisi doğru, teyit edin.
- Saatler: 09:00 – 22:30 yazıldı (başka kaynaklarda 10:30 – 23:00 ve 11:30 – 21:00 da geçiyor).
- Adres: Mithatpaşa Mah., Halk Caddesi No:4-6, Cunda.
- Instagram: instagram.com/adamis_cunda
- Google puanı 4.2 / 800+ yorum: güncel değeri kontrol edin.

Örnek olanlar (gerçekleriyle değiştirin):
- `data/menu.json` içindeki yemekler ve fiyatlar örnektir.
- Yorumlar örnektir; gerçek Google yorumlarını ekleyince "Örnek içerik" notunu panelden kapatın.
- Yemek görselleri Unsplash örnekleridir. Kendi fotoğrafınızı img/menu/ klasörüne koyup ürünün
  "image" alanına "img/menu/sarma.jpg" gibi yazmanız yeterli (kare, en az 440x440 px önerilir).

## Önizlemeyi güncellemek
Değişiklikleri kaydedip GitHub'a göndermeniz yeterli; GitHub Pages 1–2 dakikada yeni sürümü yayınlar:

    git add -A
    git commit -m "Menü fiyatları güncellendi"
    git push

## Gerçek yayına geçmeden önce
- index.html içindeki `<meta name="robots" content="noindex, nofollow">` satırını silin (önizleme arama motorlarında çıkmasın diye eklendi).
- Footer'daki "Fotoğraf künyesi" Cunda fotoğraflarının lisansı gereğidir; o fotoğrafları kullandıkça kaldırmayın.
