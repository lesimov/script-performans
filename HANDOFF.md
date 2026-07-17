# Script Performans — Handoff

**Tarih:** 2026-07-17  
**Proje yolu:** `C:/Users/Mert/Documents/Kisisel/script_performans`  
**Git branch:** `master`  
**Remote:** `https://github.com/lesimov/script-performans.git`  
**Railway URL:** `https://script-performans-production.up.railway.app/`

## Proje özeti

Next.js 14 + TypeScript uygulaması. 5metrics kaynaklarından script performans verileri çekiliyor, PostgreSQL'e günlük snapshot olarak kaydediliyor ve arayüzde izleniyor. Railway üzerinde deploy ediliyor.

Temel akış:

- `src/lib/crawl.ts`: Playwright ile script sayfasını crawl eder.
- `src/lib/db.ts`: PostgreSQL bağlantısı.
- `src/lib/migrate.ts`: `scripts` ve `snapshots` tablolarını oluşturur.
- `src/cron/daily-snapshot.ts`: günlük crawl/snapshot akışı.
- `src/app/api/health/route.ts`: DB bağlantısı gerektirmeyen health endpoint.
- `src/app/page.tsx`: ana arayüz.

## Son çözülen Railway 502 sorunu

İlk 502 nedeni, web sunucusu başlamadan önce `npm run db:migrate && npm start` zincirinin çalıştırılmasıydı. PostgreSQL migration beklerken veya hata verirken Next.js `PORT` üzerinde listener açamıyordu.

Güncel `railway.json` akışı:

```json
{
  "deploy": {
    "preDeployCommand": "npm run db:migrate",
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300
  }
}
```

Migration artık pre-deploy aşamasında, web prosesi ayrı başlıyor. Startup loglarında port ve healthcheck bilgisi yazılıyor.

## Son çözülen Playwright crawl sorunu

### Kök neden

Railway build logu şunu gösterdi:

```text
[internal] load build definition from Dockerfile
```

Dolayısıyla Railway pratikte `nixpacks.toml` değil `Dockerfile` kullanıyordu. Dockerfile sistem Chromium kuruyor ve şu değişkenleri tanımlıyor:

```dockerfile
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
```

Ancak `src/lib/crawl.ts` bu değişkeni kullanmadan Playwright'ın default browser cache'ini arıyordu:

```text
/root/.cache/ms-playwright/chromium_headless_shell-1228/...
```

### Kalıcı çözüm

`src/lib/crawl.ts` artık Dockerfile tarafından kurulan sistem Chromium'u kullanıyor:

```ts
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
```

Dockerfile Chromium'u `/usr/bin/chromium` konumuna kuruyor. Böylece Playwright runtime sırasında `/root/.cache/ms-playwright` altında browser aramıyor.

Dockerfile CMD de web başlangıcıyla tutarlı olacak şekilde sadeleştirildi:

```dockerfile
CMD ["npm", "start"]
```

`nixpacks.toml` artık yalnızca fallback Nixpacks yapılandırması olarak minimal npm install/build/start akışını içeriyor; etkisiz Playwright cache kurulum adımları kaldırıldı.

## Son commitler

- `821295e` — `Fix Railway startup and migration diagnostics`
- `7669f1c` — `Install Playwright Chromium during Railway build`
- `d11a7ae` — `Keep Playwright browser in runtime image`
- `d123889` — `Use system Chromium for crawl runtime` (**en güncel commit**)

Son düzeltme `d123889` ile `origin/master`'a pushlandı. Kullanıcı sonrasında sorunun düzeldiğini bildirdi.

## Doğrulamalar

Yerelde başarılı:

```bash
npm run build
```

Production health smoke testinde `/api/health` HTTP 200 döndü.

Sistem Chromium stratejisinin yerel Playwright launch testi başarılı oldu. Railway loglarında migration ve healthcheck başarılı görüldü; önceki crawl hatası Docker sistem Chromium executable'ına yönlendirilerek düzeltildi.

## Railway loglarında beklenen durum

Deploy loglarında:

```text
[migration] Complete attempts=1 ...
[startup] host=0.0.0.0 port=8080 healthcheck=/api/health ...
Next.js ... Ready
```

Crawl sırasında artık şu path'in aranması beklenmez:

```text
/root/.cache/ms-playwright/...
```

Bunun yerine Docker image içindeki:

```text
/usr/bin/chromium
```

kullanılır.

## Önemli ortam değişkenleri

Gerekli Railway değişkenleri:

- `DATABASE_URL`: Railway PostgreSQL bağlantı değişkeni.
- `CRON_SECRET`: cron endpoint güvenlik secret'ı.
- `PORT`: Railway tarafından otomatik sağlanır; uygulama bunu kullanır.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE`: Dockerfile içinde `/usr/bin/chromium` olarak tanımlı.
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`: Dockerfile içinde `1`; sistem Chromium kullanıldığı için Playwright browser indirilmez.

Secret değerleri bu belgeye yazılmadı.

## Yeni chatte ilk kontrol listesi

1. `git status --short --branch` ile çalışma ağacını kontrol et.
2. Railway canlı URL'sini ve `/api/health` endpoint'ini kontrol et.
3. Yeni crawl çalıştırıp Railway deploy logunda browser launch sonucunu kontrol et.
4. Sorun tekrarlarsa önce build logunda Dockerfile kullanılıp kullanılmadığını kontrol et.
5. `Dockerfile` içindeki `/usr/bin/chromium` ile `src/lib/crawl.ts` içindeki `PLAYWRIGHT_CHROMIUM_EXECUTABLE` bağlantısının korunup korunmadığını kontrol et.
6. Dockerfile ve Railway start komutlarını tekrar `npm run db:migrate && npm start` biçiminde birleştirme.

## Bilinen notlar

- Railway build loglarında build sırasında `DATABASE_URL is not set!` uyarıları görülebilir; Next.js static generation sırasında DB modülünün import edilmesinden kaynaklanır. Runtime migration bağlantısı Railway PostgreSQL ile başarılı olduğu için bu uyarı tek başına deploy hatası değildir.
- `railway.json` Railway deployment komutlarını override eder. Dockerfile yalnızca image build/runtime default'larını sağlar.
- Code-review agent denemeleri kredi limiti (`402`) nedeniyle tamamlanamadı. Teknik doğrulamalar build, healthcheck, migration logları ve Chromium launch smoke testleriyle yapıldı.
- Ana çalışma ortamındaki model metadata: `openai-codex/gpt-5.6-luna`. Önceki coder agent kendisini `openai-codex/gpt-5.6-sol` olarak bildirdi; code-review agent modeli gözlemlenemedi.
