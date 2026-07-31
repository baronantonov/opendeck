# PLAY · API Contract
## Groove Points + Viral Referral System

**Base URL:** `https://opendeck-tma.serveousercontent.com`
**Auth:** Header `X-Init-Data: <tg.initData>` (Telegram Web App init data)
**Format:** JSON · UTF-8
**Errors:** `{ "error": "message" }` + HTTP 400/401/404

---

## `POST /api/init` — точка входа (заменяет два старых GET)

Вызывается при **каждом открытии** Mini App. Создаёт пользователя, проверяет рефссылку, возвращает профиль и прогресс.

**Request:**
```json
{
  "init_data": "query_id=...&user=...&auth_date=...&hash=...",
  "start_param": "ref_a1b2c3d4"
}
```
`start_param` — берётся из `tg.initDataUnsafe.start_param`. Если пользователь зашёл без рефссылки → `null`.

**Response:**
```json
{
  "user": {
    "id": "12345",
    "name": "John",
    "photo_url": "",
    "referral_code": "a1b2c3d4",
    "referred_by": null,
    "archetype": "Куратор Вайба",
    "groove_points": 150
  },
  "course": {
    "course_id": "dj-basics",
    "completed_lessons": [1, 2],
    "total_lessons": 10,
    "current_lesson_id": 3
  },
  "bonus": null
}
```

**Bonus-уведомление** — возвращается ТОЛЬКО при первом заходе по реферальной ссылке:
```json
{
  "bonus": {
    "type": "referral_signup",
    "amount": 50,
    "message": "🎁 Подарок от друга! Тебе начислено 50 GP"
  }
}
```

**Backend-логика:**
1. Валидировать `init_data` (Telegram hash)
2. Найти пользователя по `telegram_id` из init_data
3. Если НЕ найден → создать: `referral_code = sha256(id)[:8]`, `groove_points = 0`
4. Если найден и `start_param` есть → проверить, не привязан ли уже `referred_by`
   - Если `referred_by IS NULL` → найти Inviter'а по `ref_XXXX`, записать `referred_by`
   - Начислить Invitee +50 GP, Inviter +30 GP (если Inviter существует)
   - Создать записи в `transactions`
   - Вернуть `bonus` в ответе
5. Если пользователь существует и `referred_by` уже есть → bonus = null (не показывать повторно)

---

## `GET /api/profile` — существующий, расширенный

**Request header:** `X-Init-Data: <tg.initData>`

**Response:**
```json
{
  "gp": 150,
  "completed": [1, 2],
  "referral_code": "a1b2c3d4",
  "referred_by": null
}
```

---

## `POST /api/progress` — существующий, без изменений

**Request header:** `X-Init-Data: <tg.initData>`
```json
{
  "course_id": "dj-basics",
  "lesson_id": 3
}
```

**Response:**
```json
{
  "gp": 200,
  "completed": [1, 2, 3]
}
```
Backend начисляет +50 GP за урок, создаёт `transaction`.

---

## `POST /api/referral/purchase` — покупка Invitee

Вызывается, когда приглашённый пользователь покупает Pocket DJ ($37).

**Request header:** `X-Init-Data: <tg.initData>`

**Response:**
```json
{
  "inviter_bonus": 200,
  "inviter_code": "a1b2c3d4",
  "gp": 200
}
```

**Backend-логика:**
1. Найти пользователя
2. Проверить `referred_by` — если null, вернуть `{ "inviter_bonus": 0 }`
3. Начислить Inviter +200 GP (Action: `referral_purchase`)
4. Создать `transaction`
5. Вернуть результат

---

## `POST /api/gp/apply` — списание GP на скидку MENTOR

**Request header:** `X-Init-Data: <tg.initData>`
```json
{
  "amount": 200
}
```

**Response:**
```json
{
  "groove_points": 50,
  "discount": 20,
  "final_price": 280
}
```

**Backend-логика:**
- Проверить `groove_points >= amount`
- `discount = amount` (1 GP = 1 Star, 1:1)
- `final_price = max(14000, 21000 - discount)`
- Макс. списание: **7000 GP** (достигает 14000 Stars)
- Идемпотентность: если передан `charge_id` и транзакция `gp_spend` с ним уже есть — повторно не списываем
- Создать `transaction` (Action: `gp_spend`)
- Списать GP, сохранить

---

## Дискаунт-математика (актуально)

- **1 GP = 1 Star** (скидка 1:1)
- Базовая цена MENTOR: **21000 Stars** ($300)
- Минимальная цена (флор): **14000 Stars**
- Макс. списание: **7000 GP** (достигает 14000 Stars)
- `final_price = max(14000, 21000 - discount)`, где `discount = min(gp, 7000)`

> Примечание: цена инвойса на сервере УЖЕ снижена на `discount` Stars
> (см. `/api/create-invoice`, course_id=`mentoring`). Клиентский `body.price`
> игнорируется. Списание GP фиксирует **бот** по `successful_payment`
> (endpoint `/api/gp/apply` с `charge_id`), поэтому фронт НЕ должен звать
> `/api/gp/apply` самостоятельно — иначе GP сгорят дважды.

---

## Расширение таблицы users

```sql
ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN referred_by TEXT;       -- referral_code Inviter'а
ALTER TABLE users ADD COLUMN groove_points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN archetype TEXT DEFAULT 'Куратор Вайба';
```

## Таблица transactions (актуально)

```sql
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,       -- Telegram ID
  amount INTEGER NOT NULL,        -- +50 начисление, -200 списание
  action_type TEXT NOT NULL,      -- referral_signup | referral_signup_bonus | referral_purchase | lesson_complete | gp_spend
  ref_user_id INTEGER,            -- ID Inviter'а (для реферальных действий)
  charge_id TEXT,                 -- id платежа (идемпотентность gp_spend)
  timestamp TEXT DEFAULT (datetime('now'))
);
```

## Groove Points — таблица начислений

| Событие | Кому | GP | action_type |
|---|---|---|---|
| Регистрация по рефссылке | Invitee | +50 | `referral_signup` |
| Регистрация по рефссылке | Inviter | +30 | `referral_signup_bonus` |
| Invitee покупает курс/менторство | Inviter | +200 | `referral_purchase` (**1 раз на invitee**) |
| Урок пройден | User | +50 | `lesson_complete` |
| Списание на скидку MENTOR | User | −N | `gp_spend` (идемпотентно по charge_id) |

> **Защита от фрода:** `referral_purchase` начисляет +200 инвайтеру только
> один раз на invitee (повторный вызов возвращает inviter_id, но GP не
> накручивает). `gp_spend` идемпотентен по `charge_id` — двойной вызов
> ботом + фронтом не списывает GP повторно.

---

## История версий

| Дата | Версия | Изменения |
|---|---|---|
| 2026-07-29 | PLAY v1 | Первый релиз — реферальная система + GP |
