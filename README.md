# BLB Authenticator

Google Authenticator benzeri web tabanlı TOTP kasası — birden fazla servis (GitHub, Gmail, vb.) için 2FA kodlarını tek yerde saklayın ve web üzerinden görüntüleyin. Kayıt/giriş yalnızca kasanıza erişmek içindir.

Monorepo yapısı: **React (Vite)** frontend + **Node.js (Fastify)** API + **MySQL**.

## Teknoloji yığını

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 19, TypeScript, Vite 8, React Router 7 |
| Backend | Node.js 22, Fastify 5, TypeScript 5 |
| OTP | otplib 13 (RFC 6238 TOTP) |
| Veritabanı | MySQL 8.4 |
| Deploy | Docker, CapRover |

## Proje yapısı

```
BLBAuthenticator/
├── api/                 # Fastify REST API
│   ├── src/
│   ├── Dockerfile
│   └── captain-definition
├── web/                 # React SPA
│   ├── src/
│   ├── Dockerfile
│   └── captain-definition
├── docker-compose.yml   # Yerel tam stack (MySQL + API + Web)
└── package.json         # npm workspaces
```

## Gereksinimler

- **Node.js** >= 20 (önerilen: 22 LTS)
- **npm** >= 10
- **MySQL** 8.x (yerel XAMPP veya Docker)

## Hızlı başlangıç (geliştirme)

### 1. Bağımlılıkları kur

```bash
npm install
```

### 2. MySQL veritabanını hazırla

XAMPP veya yerel MySQL üzerinde:

```sql
CREATE DATABASE blb_authenticator CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'blb_auth'@'localhost' IDENTIFIED BY 'blb_auth_secret';
GRANT ALL PRIVILEGES ON blb_authenticator.* TO 'blb_auth'@'localhost';
FLUSH PRIVILEGES;
```

Docker ile sadece MySQL:

```bash
docker compose up mysql -d
```

### 3. API ortam değişkenleri

```bash
cp api/.env.example api/.env
```

`api/.env` içinde en az şunları güncelleyin:

- `JWT_SECRET` — en az 32 karakter, rastgele
- `ENCRYPTION_KEY` — 64 karakter hex (32 byte)

Anahtar üretmek için:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Geliştirme sunucularını başlat

İki ayrı terminal:

```bash
# Terminal 1 — API (port 3000)
npm run dev:api

# Terminal 2 — Web (port 5173, /api proxy)
npm run dev:web
```

- Web: http://localhost:5173  
- API health: http://localhost:3000/api/health  

Tablolar API ilk açılışta otomatik oluşturulur (`users`, `totp_entries`). Docker MySQL port çakışması varsa `docker-compose.yml` içinde `3307:3306` ve `api/.env` → `DB_PORT=3307`.

## API uç noktaları

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/health` | Sağlık kontrolü |
| POST | `/api/auth/register` | Vault hesabı oluştur |
| POST | `/api/auth/login` | Giriş (JWT) |
| GET | `/api/auth/me` | Oturum bilgisi |
| GET | `/api/entries` | TOTP kayıt listesi |
| GET | `/api/entries/codes` | Tüm kayıtlar + anlık kodlar |
| POST | `/api/entries/generate` | Yeni secret + QR önizleme |
| POST | `/api/entries` | Kayıt ekle (secret + doğrulama kodu) |
| DELETE | `/api/entries/:id` | Kayıt sil |

## Docker ile yerel çalıştırma

Tüm stack (MySQL + API + Web):

```bash
docker compose up --build
```

- Web: http://localhost:8080  
- API: http://localhost:3000  

## CapRover deploy

İki ayrı CapRover uygulaması oluşturun (aynı Git reposu).

### 1) `blb-auth-api`

| Ayar | Değer |
|------|--------|
| Root Directory | `api` |
| captain-definition | `captain-definition` (varsayılan) |
| Port | `3000` |
| HTTP | Aktif |

**Ortam değişkenleri** (`api/.env.example` referans):

```
NODE_ENV=production
PORT=3000
JWT_SECRET=<güçlü-secret>
ENCRYPTION_KEY=<64-hex>
DB_HOST=srv-captain--mysql   # CapRover MySQL app adı
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=blb_authenticator
CORS_ORIGIN=https://blb-auth-web.yourdomain.com
APP_NAME=BLB Authenticator
```

MySQL’i CapRover one-click veya harici sunucu olarak bağlayın. İlk deploy sonrası tablolar API başlangıcında oluşur.

### 2) `blb-auth-web`

| Ayar | Değer |
|------|--------|
| Root Directory | `web` |
| Build arg / env | `VITE_API_URL=https://blb-auth-api.yourdomain.com` |

Production build sırasında `VITE_API_URL` API’nin public URL’si olmalıdır.

### SSL

Her iki app için CapRover **Enable HTTPS** + Let’s Encrypt.

## npm komutları

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | API + Web dev (paralel) |
| `npm run dev:api` | Sadece API |
| `npm run dev:web` | Sadece Web |
| `npm run build` | Production build (her iki workspace) |
| `npm run start:api` | Derlenmiş API |

## Güvenlik notları

- TOTP secret’ları veritabanında **AES-256-GCM** ile şifrelenir.
- Login OTP doğrulaması **yalnızca sunucuda** yapılır.
- Production’da `JWT_SECRET` ve `ENCRYPTION_KEY` değerlerini asla repoya eklemeyin.
- `api/.env` ve `web/.env` `.gitignore` içindedir.

## Lisans

Özel proje — BLB Authenticator.
