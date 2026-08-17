# Open Deck DJ School — Спецификация приложения (один файл)

> Этот документ — полное описание архитектуры, данных и логики приложения Open Deck DJ School (Telegram Mini App + бэкенд + бот + CRM).
> По нему можно **полностью переписать проект с нуля**, скормив раздел «ПРОМТ ДЛЯ ПЕРЕПИСЫВАНИЯ» (в конце) языковой модели.

---

## 1. Обзор продукта

**Open Deck DJ School** — edtech TMA (Telegram Mini App) для обучения диджеингу.
Поток ценности:
1. Юзер открывает Mini App через бота `@OpenDeck_bot` (кнопка «🎧 Открыть курс DJ») или по прямой ссылке `https://baronantonov.github.io/opendeck/?v=<hash>`.
2. Смотрит бесплатные уроки (tripwire-вход), проходит короткий курс.
3. Покупает доступ: tripwire (уроки 1–4, ~500⭐), полный курс (2100⭐), или менторство (4 сессии 1-на-1, floor 23400⭐ / $230 через Tribute).
4. Зарабатывает Groove Points (GP) за уроки → тратит на скидку менторства (1 GP = 1 Star, max 4600).
5. Реферальная петля: приглашённый получает +100⭐ за signup, инвайтер +100⭐ за signup и +200⭐ за покупку приглашённым.

**Ключевые бизнес-правила (источник истины — `backend/db.py` и `backend/main.py`):**
- Комиссия Telegram Stars = 40% (30% платёж + 10% вывод). Net Фриды после Stars = 60%.
- Комиссия Tribute = 10% (flat). Net Фриды ≈ $207 с $230.
- Floor менторства (net Фриды ≥ $200): **23400⭐** (через Stars) или **$230** (через Tribute).
- Менторство Stars-цена: `final = max(23400, 28000 − min(gp, 4600))`.
- GP-скидка применяется ТОЛЬКО в Stars-канале. Tribute — фикс-цена (динамическая цена через Tribute REST API недоступна).

---

## 2. Технологический стек

| Слой | Технология |
|---|---|
| Бэкенд | Python 3.11, FastAPI, uvicorn, SQLite (файл `dj_school.db`) |
| Фронтенд | Однофайловый `index.html` (~137KB): vanilla JS, inline CSS, mobile-first (390px), Telegram WebApp JS SDK. Без сборки. |
| Бот | Python 3.11, aiogram 3.x |
| Платежи | Telegram Stars (native invoice), Tribute (карта/СБП/USDT, фикс-продукт), Prodamus (РФ карты/СБП, опционально), TON (опционально) |
| Хостинг | GitHub Pages (фронт) + либо Docker (docker-compose: backend/bot/caddy), либо systemd + Caddy (deploy.sh) |
| Туннель (dev) | serveo.net (SSH `-R`) через `tunnel-keys/id_ed25519` |

**ЗАПРЕТ:** в UI-тексте — длинное тире (U+2014). Только короткое (U+2013). Em-dash допустим только в JS-комментариях.

**Дизайн-система (CSS `:root` в `index.html`):**
- Фон `#2b302e`, акцент `#c0a0a8`, мята `#8ce2c8`, коралл `#f5926e`.
- Заголовки: шрифт `Unbounded`. Body: `Inter`.
- Модалки: `.modal-mask` (position:fixed; inset:0; background:rgba(10,12,11,0.7)) + `.modal` (bottom-sheet).

---

## 3. Файловая структура

```
dj-school-tma/
├── backend/
│   ├── main.py            # FastAPI app, ВСЕ эндпоинты, платёжная логика, webhook-роуты
│   ├── db.py              # SQLite-слой: схема, миграции, CRUD, GP/рефералки
│   ├── auth.py            # verify_init_data (HMAC-SHA256 подпись Telegram)
│   ├── crm.py             # CRM-админка: логин, статистика, студенты
│   ├── prodamus_sign.py   # Подпись Prodamus (HMAC заголовок Sign)
│   └── PLAY-API.md        # Референс по эндпоинтам
├── bot/
│   ├── main.py            # aiogram-бот: команды, кнопки, обработка successful_payment, GP/реф
│   ├── config.py          # Конфиги из .env + mini_app_url() с version-bust
│   ├── config.example.py  # Шаблон
│   └── payments/
│       ├── base.py        # ABC PaymentProvider + dataclass PaymentInvoice
│       ├── stars.py       # StarsProvider (createInvoiceLink через TG API)
│       ├── tribute.py     # TributeProvider (прямая ссылка на продукт)
│       ├── prodamus.py    # ProdamusProvider (платёжная ссылка + verify)
│       ├── ton.py         # TonProvider (заглушка/опционально)
│       └── __init__.py    # Фабрика get_provider(name)
├── index.html             # TMA-фронтенд (один файл)
├── crm.html               # Дашборд CRM (отдельная страница)
├── tests/
│   ├── conftest.py        # Изоляция БД (temp + db.init до импорта backend.main)
│   ├── test_backend.py    # API + GP/рефералка (self-managed temp DB)
│   ├── test_bot.py        # Логика бота (mock aiogram)
│   ├── test_crm.py        # CRM-админка
│   ├── test_economy.py    # Реферальная экономика
│   ├── test_prodamus_real.py   # Живой Prodamus (исключён из pytest -k not real)
│   └── test_prodamus_live_demo.py
├── bump-version.sh        # Авто-version-bust (пуш + вшивание маркера версии в index.html)
├── start-app.sh           # One-click: бэкенд + serveo-туннель
├── deploy.sh              # systemd + Caddy (VPS)
├── docker-compose.yml     # backend/bot/caddy
├── Caddyfile / nginx/nginx.conf
├── requirements.txt       # fastapi, uvicorn, aiogram, python-dotenv, httpx, pytest, pygments
├── .env.example           # Шаблон секретов
└── AGENTS.md / PROJECT_BRIEF.md / README.md
```

**Git-воркфлоу:** ветка `master` → удалённая `origin/main`. Push ТОЛЬКО `git push origin master:main`. Формат коммита `[<area>] <Title>`.

---

## 4. База данных (SQLite, `backend/db.py`)

### 4.1 Схема (таблицы)
```sql
users (
  user_id INTEGER PRIMARY KEY,
  first_name TEXT, username TEXT, photo_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_seen TEXT DEFAULT (datetime('now')),
  referral_code TEXT,          -- sha256(user_id)[:8], UNIQUE
  referred_by TEXT,             -- чей referral_code привёл
  groove_points INTEGER DEFAULT 0,
  archetype TEXT DEFAULT 'Куратор Вайба'
)
progress (
  user_id INTEGER NOT NULL, course_id TEXT NOT NULL DEFAULT 'dj-basics',
  lesson_id INTEGER NOT NULL, completed INTEGER NOT NULL DEFAULT 1,
  gp_earned INTEGER NOT NULL DEFAULT 0, completed_at TEXT,
  PRIMARY KEY (user_id, course_id, lesson_id)
)
payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  course_id TEXT NOT NULL, provider TEXT, amount INTEGER,
  currency TEXT, status TEXT, raw TEXT, created_at TEXT
)
badges (
  user_id INTEGER NOT NULL, course_id TEXT NOT NULL DEFAULT 'dj-basics',
  badge TEXT NOT NULL, granted_at TEXT, PRIMARY KEY (user_id, course_id, badge)
)
transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL, action_type TEXT NOT NULL,
  ref_user_id INTEGER, charge_id TEXT, ab_variant TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
)
webhook_processed ( order_id TEXT PRIMARY KEY, processed_at TEXT )  -- идемпотентность
ab_assignments ( user_id INTEGER PRIMARY KEY, experiment TEXT, variant TEXT, assigned_at TEXT )
```

### 4.2 Логика (`db.py`)
- `DB_PATH = Path(__file__).parent.parent / "dj_school.db"` (переопределяется в тестах).
- `init()` — создаёт таблицы (idempotent), миграции (ALTER COLUMN), уникальный индекс `idx_users_refcode`, backfill `referral_code` и `groove_points`.
- `groove_points` = сумма `gp_earned` из `progress`.
- GP-транзакции пишутся в `transactions` с `charge_id` (идемпотентность списания по `successful_payment`).
- Рефералка: `referred_by` связывает юзеров; при signup приглашённый +100⭐, инвайтер +100⭐; при purchase инвайтер +200⭐.

---

## 5. Бэкенд API (`backend/main.py`)

Базовый URL фронта: `API_BASE` (в `index.html` захардкожен ngrok-туннель dev; в проде = публичный HTTPS бэкенда).
Все защищённые эндпоинты принимают заголовок `X-Init-Data: <tg.initData>` → `verify_init_data()` извлекает `user_id`.

### 5.1 Эндпоинты
| Method | Path | Назначение |
|---|---|---|
| GET | `/api/health` | Healthcheck |
| GET | `/` | Отдаёт `index.html` (no-cache) |
| POST | `/api/init` | Инициализация: проверка init_data, создание юзера, возврат `referral_code`, `free_lessons` |
| GET | `/api/profile` | Профиль: GP, архетип, реф-код, реф-друзья |
| GET | `/api/lessons?course_id=dj-basics` | Уроки курса + прогресс |
| GET | `/api/lessons-bonus` | Бонусные уроки |
| POST | `/api/progress` | Отметить урок пройденным (+GP) |
| POST | `/api/referral/purchase` | Начислить инвайтеру +200⭐ за покупку реферала |
| POST | `/api/gp/apply` | Списать GP (используется ботом, не фронтом) |
| POST | `/api/gp/spend` | Потратить GP на скидку |
| POST | `/api/gp/earn` | Начислить GP |
| POST | `/api/archetype/share` | Поделиться архетипом |
| POST | `/api/create-invoice` | **Создать счёт.** Body: `{course_id, price, provider?}`. Без `provider` → Stars (возврат `invoice_link`). `provider:"tribute"` → возврат `pay_url` (ссылка на продукт). `provider:"prodamus"` → `pay_url`. |
| GET | `/api/ab/assign` | A/B-назначение (эксперименты по ценам) |
| POST | `/api/ab/track` | Трек A/B |
| POST | `/api/grant` | Выдать доступ (внутренний, INTERNAL_API_KEY) |
| POST | `/webhooks/prodamus` | Webhook Prodamus (подпись HMAC Sign → грант доступа) |
| POST | `/webhooks/tribute` | Webhook Tribute (`new_digital_product` → грант менторства, idempotent) |

### 5.2 Цены (константы `backend/main.py`)
```python
FREE_LESSONS = 1
TRIPWIRE_PRICE = 500       # 500⭐ (~$7)
FULL_COURSE_PRICE = 2100   # 2100⭐ (~$30)
MENTOR_PRICE = 28000       # 28000⭐ gross ($400)
MENTOR_FLOOR = 23400       # floor net $200 (после 40% Stars)
MENTOR_GP_CAP = 4600       # max GP-скидка (28000-4600=23400)
GP_PER_LESSON = 50
GP_PER_BONUS = 200
```

### 5.3 Платёжный флоу (`/api/create-invoice`)
- **Stars** (default): `POST https://api.telegram.org/bot<BOT_TOKEN>/createInvoiceLink` с ценой в XTR. Возврат `{invoice_link}`. Фронт зовёт `tg.openInvoice(link, cb)`.
- **Tribute**: возврат `{pay_url: "https://web.tribute.tg/p/<slug>"}`. Фронт зовёт `tg.openLink(url)` (внешний браузер). Подтверждение — webhook.
- **Prodamus**: возврат `{pay_url}` (платёжная ссылка). Webhook подтверждает.

**ВАЖНО:** списание GP и реф-бонус инвайтеру фиксирует БОТ по `successful_payment` (idempotent по `charge_id`), НЕ фронт (во избежание двойного списания/накрутки).

---

## 6. Платёжные провайдеры (`bot/payments/`)

### 6.1 Интерфейс (`base.py`)
```python
@dataclass
class PaymentInvoice:
    provider: str
    url_or_payload: str   # Stars: payload для openInvoice; TON/Prodamus/Tribute: URL
    meta: dict = None

class PaymentProvider(ABC):
    @property
    def name(self) -> str: ...
    async def create_invoice(self, user_id, course_id, amount_label) -> PaymentInvoice: ...
    async def verify(self, payload) -> bool: ...
```

### 6.2 Реализации
- **StarsProvider** (`stars.py`): `create_invoice` → `createInvoiceLink` через TG API. `verify` → проверка `successful_payment`.
- **TributeProvider** (`tribute.py`): НЕ делает сетевой запрос (динамическая цена недоступна API). Возвращает прямую ссылку `https://web.tribute.tg/p/<TRIBUTE_MENTOR_PRODUCT_ID>`. `verify` → `payload.get("purchase_id")`. Конфиг из `.env`: `TRIBUTE_API_KEY`, `TRIBUTE_WEBHOOK_URL`, `TRIBUTE_MENTOR_PRODUCT_ID`.
- **ProdamusProvider** (`prodamus.py`): `create_invoice` → платёжная ссылка через Prodamus REST. `verify` → HMAC подпись заголовка `Sign`.
- **TonProvider** (`ton.py`): заглушка/опционально.
- **Фабрика** (`__init__.py`): `get_provider(name)` → `stars|ton|prodamus|tribute`.

---

## 7. Фронтенд (`index.html`)

### 7.1 Состояние (`const state`)
```js
state = {
  isPaid: false,          // куплен ли доступ (tripwire/full) — для пейвола
  paidFull: false,
  freeLessons: 1,         // порог бесплатных уроков (с бэкенда FREE_LESSONS)
  ab: {},                 // A/B-варианты
  user: { name, archetype:"Куратор Вайба", groovePoints:0, referralCode:'', referralFriends:0, referralGpEarned:0 },
  courseProgress: { currentLessonId:null, completedLessons:[] },
  lessons: [ {t, video, d:[...]} x6 ],     // основной курс (YouTube embed)
  bonusLessons: [ {id, t, video, d:[...]} x4 ]  // бонусные
}
```

### 7.2 Экраны (навигация `#nav button[data-tab]`)
- `home` — лендинг, реф-блок, CTA.
- `course` — уроки курса (платные заблокированы пейволом).
- `bonus` — бонусные уроки.
- `mentor` — блок менторства (цена, скидка GP, кнопка).
- `profile` — GP, реф-код, приглашения.

### 7.3 Модалки выбора способа оплаты
- `#paywall` (`showPaywall(courseId)`) — курс: Stars (цена со скидкой) / Карта-СБП (Prodamus).
- `#mentor-pay` (`showMentorPay()`) — менторство: **Stars** (цена `max(23400, 28000−min(gp,4600))`, динамика в `#mp-stars-price`) / **Tribute** ($230, USDT-вывод).

### 7.4 Ключевые функции
- `bookPay(courseId)` — Stars-инвойс через `tg.openInvoice`.
- `bookPayProdamus(courseId)` — Prodamus через `tg.openLink`.
- `bookMentor()` — Stars-инвойс менторства (guard на `tg.openInvoice` вне TG).
- `bookMentorTribute()` — Tribute: `POST /api/create-invoice {provider:"tribute"}` → `tg.openLink(pay_url)`.
- `showMentorPay()` / `hideMentorPay()` — модалка выбора.
- `showToast(icon, text)` — тосты (НЕ сырой код/HTML).
- `haptic(type)` — TG haptic feedback.

### 7.5 Version-bust
- В `<head>`: `<!--opendeck-version:HASH-->`.
- При загрузке JS читает маркер, через `localStorage` сравнивает с предыдущим; если отличается — `location.reload(true)` (сброс кэша TG).
- `bump-version.sh` вшивает маркер + печатает свежую ссылку `?v=HASH`.

### 7.6 Auth-флоу
- `tg = window.Telegram.WebApp`. `user = tg.initDataUnsafe.user`.
- `POST /api/init` с `X-Init-Data: tg.initData` → профиль.
- Admin-режим (`@baronantonov`, id=285754501): тоггл `ADMIN_MODE` открывает весь контент для теста UI.

---

## 8. Бот (`bot/main.py`)

- Команда `/start` с кнопкой `InlineKeyboardButton("🎧 Открыть курс DJ", web_app=WebAppInfo(url=config.mini_app_url()))`.
- `mini_app_url()` добавляет `?v=<git-hash HEAD>` (version-bust).
- Обработка `successful_payment`:
  - Начисляет GP (за курс/менторство).
  - Списывает GP-скидку (idempotent по `charge_id`).
  - Начисляет реф-бонус инвайтеру (+200⭐ за покупку).
- Фабрика провайдеров: `get_provider(name)` для логики онпей.

---

## 9. CRM (`backend/crm.py` + `crm.html`)

- `POST /crm/login` (form: `admin_key`) → cookie `crm_session`.
- `GET /crm/stats` — статистика (пользователи, платежи, GP).
- `GET /crm/students` — список студентов.
- `GET /crm/student/{user_id}` — профиль студента (прогресс, платежи, GP).
- `GET/POST /crm/student/{user_id}/gp` — ручное начисление/списание GP.
- `crm.html` — дашборд (отдельная страница, не в TMA).

---

## 10. Переменные окружения (`.env`)

```
BOT_TOKEN=...
MINI_APP_URL=https://baronantonov.github.io/opendeck
INTERNAL_API_KEY=...
ADMIN_KEY=...                      # для CRM-логина
PRODAMUS_PAYFORM_URL=...
PRODAMUS_SECRET_KEY=...            # HMAC Sign
PRODAMUS_SYS_CODE=...
PRODAMUS_API_KEY=...
TRIBUTE_API_KEY=...
TRIBUTE_WEBHOOK_URL=...            # куда Tribute шлёт webhook
TRIBUTE_MENTOR_PRODUCT_ID=BNP      # slug продукта менторства
TON_MERCHANT_WALLET=...            # опционально
TON_NETWORK=mainnet
BACKEND_URL=http://localhost:8000
```

**Никогда не коммитить `.env`.** Шаблон — `.env.example`.

---

## 11. Деплой

### 11.1 GitHub Pages (фронт)
- `index.html` на ветке `main` → `https://baronantonov.github.io/opendeck/`.
- `bump-version.sh`: push + вшивание `<!--opendeck-version:HASH-->` + печать `?v=HASH`.

### 11.2 Бэкенд + бот
- **Docker:** `docker-compose.yml` (сервисы backend/bot/caddy).
- **systemd:** `deploy.sh` (VPS: python3-venv, Caddy, юнит djapp).
- **Dev (локально):** `start-app.sh` → uvicorn + serveo-туннель (`tunnel-keys/id_ed25519`).

### 11.3 Тестирование
- Канонический рецепт: `.venv/bin/pytest -q tests/` (или `hermes verify`).
- `conftest.py` изолирует БД (temp + `db.init` до импорта `backend.main`).
- `pytest.ini`: `addopts = -k "not real"` (исключает `test_prodamus_real`, требующий живой API).

---

## 12. Границы и конвенции

- ✅ Писать в `backend/`, `bot/`, `tests/`, `*.py`, `*.html`, `*.sh`.
- ⚠️ Спрашивать перед: изменением схемы БД, добавлением зависимостей, правкой `.env`, деплоя (docker-compose/Caddyfile/deploy.sh), правкой `index.html`.
- 🚫 Никогда: коммитить секреты, `git push origin HEAD`, force-push, править `.venv`/`node_modules`/`dj_school.db`.
- Русские комментарии допустимы. Type hints обязательны. Python 3.11, PEP 8.

---

## 13. ПРОМТ ДЛЯ ПЕРЕПИСЫВАНИЯ (скопируй в LLM)

```
Создай проект Open Deck DJ School — Telegram Mini App (TMA) для обучения диджеингу.
Стек: Python 3.11 FastAPI + SQLite (бэкенд), однофайловый vanilla-JS index.html (фронт, mobile-first 390px,
Telegram WebApp SDK, БЕЗ сборки), aiogram 3 (бот), GitHub Pages (фронт) + Docker/systemd (бэкенд+бот).

АРХИТЕКТУРА (файлы):
- backend/main.py — FastAPI app со ВСЕМИ эндпоинтами (см. раздел 5.1): /api/init, /api/profile, /api/lessons,
  /api/lessons-bonus, /api/progress, /api/create-invoice (возврат invoice_link для Stars / pay_url для Tribute/Prodamus),
  /api/gp/spend, /api/referral/purchase, /webhooks/prodamus, /webhooks/tribute. Читает index.html с диска (GET /).
- backend/db.py — SQLite: таблицы users/progress/payments/badges/transactions/webhook_processed/ab_assignments.
  Поля users: user_id, first_name, username, referral_code (sha256(id)[:8], UNIQUE), referred_by, groove_points, archetype.
  init() создаёт таблицы idempotent + миграции + уникальный индекс referral_code.
- backend/auth.py — verify_init_data (HMAC-SHA256 подпись tg.initData).
- backend/crm.py — CRM: POST /crm/login (cookie crm_session), /crm/stats, /crm/students, /crm/student/{id}.
- backend/prodamus_sign.py — HMAC подпись заголовка Sign.
- bot/main.py — aiogram: команда /start с WebAppInfo(mini_app_url()), обработка successful_payment
  (начисление GP, списание скидки idempotent по charge_id, реф-бонус +200 инвайтеру).
- bot/config.py — конфиги из .env; mini_app_url() добавляет ?v=<git-short-hash HEAD>.
- bot/payments/base.py — ABC PaymentProvider + dataclass PaymentInvoice(provider, url_or_payload, meta).
- bot/payments/stars.py — createInvoiceLink через TG API.
- bot/payments/tribute.py — возвращает прямую ссылку https://web.tribute.tg/p/<slug> (фикс-цена, динамика недоступна API).
- bot/payments/prodamus.py — платёжная ссылка + verify(HMAC Sign).
- bot/payments/__init__.py — фабрика get_provider(name): stars|ton|prodamus|tribute.
- index.html — однофайловый фронт: state (isPaid, user{groovePoints,referralCode}, lessons[6], bonusLessons[4]),
  экраны home/course/bonus/mentor/profile, модалки #paywall (курс) и #mentor-pay (менторство: Stars/Tribute),
  функции bookPay/bookPayProdamus/bookMentor/bookMentorTribute/showMentorPay/showToast/haptic.
  Version-bust: маркер <!--opendeck-version:HASH--> в <head> + localStorage-перезагрузка при смене.

БИЗНЕС-ПРАВИЛА:
- Цены (XTR): TRIPWIRE 500, FULL_COURSE 2100, MENTOR 28000 (gross). MENTOR_FLOOR 23400 (net $200 после 40% Stars).
- Менторство Stars-final = max(23400, 28000 - min(gp, 4600)). Tribute-фикс $230 (net ~$207 после 10%).
- GP: +50 за урок, +200 за бонус. Рефералка: invitee +100 за signup, inviter +100 за signup, inviter +200 за purchase реферала.
- GP-скидка ТОЛЬКО в Stars-канале. Tribute — фикс (динамическая цена Tribute API недоступна).
- Комиссия Stars 40% (30% платёж+10% вывод), Tribute 10%.

ДИЗАЙН-СИСТЕМА: фон #2b302e, акцент #c0a0a8, мята #8ce2c8, коралл #f5926e. Заголовки Unbounded, body Inter.
Модалки bottom-sheet (.modal-mask fixed inset:0 + .modal). ЗАПРЕТ длинного тире (U+2014) в UI — только короткое (U+2013).

ТЕСТЫ: tests/conftest.py (temp DB + db.init до импорта backend.main), test_backend/test_bot/test_crm/test_economy
(линейные скрипты, обёрнутые в def test_* + nonlocal для check, возврат (passed,failed), if __name__ вызывает функцию).
pytest.ini: addopts = -k "not real"./bump-version.sh: push + вшивание маркера версии + печать ?v=HASH.

ДЕПЛОЙ: index.html на GitHub Pages (ветка main). Бэкенд+бот через docker-compose (backend/bot/caddy) или systemd.
Git: master -> origin/main, push ТОЛЬКО git push origin master:main. Коммиты [area] Title. Секреты в .env (не коммитить).

РЕАЛИЗУЙ всё выше, соблюдая структуру файлов, бизнес-правила и дизайн-систему. Код должен проходить
.venv/bin/pytest -q tests/ (3 passed, 3 deselected) и JS-парс index.html без ошибок.
```

---

*Документ сгенерирован как единый источник истины для переписывания проекта. Актуально на момент написания:
ветка master, backend/db.py — SQLite-слой, backend/main.py — 30+ эндпоинтов, index.html ~2000 строк.*
