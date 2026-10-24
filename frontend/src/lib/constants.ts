import type { Lesson } from '../types';

// Course lessons (mirrors backend/seed; captions come from the backend too,
// but we keep a local fallback so the UI never blanks out).
export const COURSE_LESSONS: Lesson[] = [
  // Урок 1: Вводный (бесплатный)
  {
    t: 'Интерфейс на телефоне: твой первый контроллер',
    video: 'https://www.youtube.com/embed/_x8ONg58GeU',
    d: [
      'Обзор программы на телефоне и из чего состоит контроллер.',
      'Дека, частоты, кнопка плей, фейдеры, фильтр — что делает каждая ручка.',
      'Перестань бояться экрана: всё логично, когда разобрал по частям.',
    ],
  },
  // Урок 2: Знакомство с FREEDA (бесплатный, после Урока 1)
  {
    t: 'Знакомство с FREEDA: кто такой диджей',
    video: 'https://www.youtube.com/embed/_x8ONg58GeU',
    d: [
      'Знакомство с Ташей (FREEDA DJ): путь от первого бита до клубных фестивалей.',
      'Кто такой диджей, его функция на вечеринке и где применяется диджеинг сегодня.',
      'Диджей — это не избранные, а любой, кто ведёт энергию через музыку.',
    ],
  },
  // === ГРАНИЦА ПЕЙВОЛА (Уроки 3–10 требуют покупки курса) ===
  // Урок 3: Направления и оборудование
  {
    t: 'Направления и оборудование: где найти себя',
    d: [
      'Виды диджеинга: коммерческий, ивент, андерграунд, фестивальный, радио.',
      'Какое бывает оборудование и в каких сферах используется.',
      'Выбери своё направление — это снимет страх «а я не такой, как все».',
    ],
  },
  // Урок 4: Музыкальная теория
  {
    t: 'Музыкальная теория: бит, ритм и колесо Камелота',
    d: [
      'Из чего строится музыка: бит, ритм, тональности, дорожки в треке.',
      'Колесо Камелота — как подбирать треки, что звучат гармонично.',
      'Строение трека: интро, ямы, дропы, аутро — читаем музыку как книгу.',
    ],
  },
  // Урок 5: Основы сведения
  {
    t: 'Основы сведения: BPM, темп и кнопка Sync',
    d: [
      'Процесс сведения двух треков: BPM, темп, микширование.',
      'Как сводить в одной тональности, стиле и темпе — и зачем нужна кнопка Sync.',
      'Первый реальный микс: два трека становятся единым потоком.',
    ],
  },
  // Урок 6: Кроссфейдер и темпо
  {
    t: 'Кроссфейдер и нюансы темпо',
    d: [
      'Техника сведения через кроссфейдер — плавный переход между деками.',
      'Нюансы темпо: режимы Wide, 6, 10, 16 и когда их применять.',
      'Поймёшь, как держать энергию ровной, без рывков.',
    ],
  },
  // Урок 7: Лупы и Beat Jump
  {
    t: 'Лупы и Beat Jump: лёгкое сведение',
    d: [
      'Лупы (петли) — простой способ зациклить кусок и свести без спешки.',
      'Beat Jump: прыжки по битам для точного попадания.',
      'Приёмы, которые делают сведение расслабленным и точным.',
    ],
  },
  // Урок 8: Эффекты и фильтр
  {
    t: 'Эффекты и фильтр: краски твоего сета',
    d: [
      'Что такое эффекты и обзор доступных в бесплатной версии.',
      'Простое применение эффекта при сведении, работа с падами.',
      'Фильтр — аккуратно, чтобы украсить, а не сломать момент.',
    ],
  },
  // Урок 9: История диджеинга
  {
    t: 'История: от диско до наших дней',
    d: [
      'Краткая история появления диджеинга и как он менялся десятилетиями.',
      'Путь электронной музыки: от диско-эры до современных стилей.',
      'Поймёшь контекст — откуда растут ноги у того, что крутишь сегодня.',
    ],
  },
  // Урок 10: Финальный микс
  {
    t: 'Твой первый микс из 4–5 треков',
    d: [
      'Особенности построения микса и основы композиции.',
      'Сводим микс из 4–5 треков, комбинируя все способы сведения.',
      'Финал курса: готов первый сет и точка опоры в диджеинге.',
    ],
  },
];

export const BONUS_LESSONS: Lesson[] = [];

/**
 * Логика строгой последовательной разблокировки курса Pocket DJ (10 уроков).
 * - Урок 1 (idx=0): открыт бесплатно всегда.
 * - Урок 2 (idx=1): открыт бесплатно, если пройден Урок 1.
 * - Уроки 3–10 (idx=2..9): требуют покупки курса И прохождения предыдущего урока.
 */
export function isLessonUnlocked(
  lessonIndex: number,
  completedLessons: number[],
  isPaid: boolean,
  adminMode = false,
): { unlocked: boolean; reason: 'ok' | 'needs_paywall' | 'needs_prev_lesson' } {
  if (adminMode) return { unlocked: true, reason: 'ok' };
  if (lessonIndex === 0) return { unlocked: true, reason: 'ok' };
  if (lessonIndex === 1) {
    return completedLessons.includes(1)
      ? { unlocked: true, reason: 'ok' }
      : { unlocked: false, reason: 'needs_prev_lesson' };
  }
  if (!isPaid) {
    return { unlocked: false, reason: 'needs_paywall' };
  }
  const prevLessonNumber = lessonIndex; // для урока 3 (idx 2) предыдущий номер 2
  return completedLessons.includes(prevLessonNumber)
    ? { unlocked: true, reason: 'ok' }
    : { unlocked: false, reason: 'needs_prev_lesson' };
}

export const ARCHETYPES: Record<string, string> = {
  'Куратор Вайба': 'Твой вайб – собирать сеты под настроение',
  'Техничный Сеттер': 'Техника – твой конёк. Сведение ждёт',
  'Открыватель Звука': 'Ищи новое звучание. Эксперименты впереди',
  'Хранитель Атмосферы': 'Создавай атмосферу. Глубина – твоё',
};

// Pricing constants mirror backend/main.py
export const PRICES = {
  course: { stars: 2500, rub: '≈ 4 250 ₽', usd: '$30' },
  'dj-basics': { stars: 2500, rub: '≈ 4 250 ₽', usd: '$30' },
  tripwire: { stars: 2500, rub: '≈ 4 250 ₽', usd: '$30' },
  mentor: {
    grossUsd: 250,
    floorUsd: 200, // чистыми $190 после комиссии Tribute (5%)
    grossRub: 23900,
    floorRub: 19800, // чистыми ~19 100 ₽ после комиссии Prodamus (3.5%)
    gpCap: 500,      // макс скидка 500 GP = $50 / 4 100 ₽
    gpRateUsd: 0.1,  // 1 GP = $0.10
    gpRateRub: 8.2,  // 500 GP * 8.2 = 4 100 ₽ (23 900 - 4 100 = 19 800 ₽)
  },
};

export function mentorPrices(gp: number) {
  const cappedGp = Math.min(Math.max(gp, 0), PRICES.mentor.gpCap);
  const discountUsd = Math.round(cappedGp * PRICES.mentor.gpRateUsd);
  const discountRub = Math.round(cappedGp * PRICES.mentor.gpRateRub);
  return {
    discountUsd,
    discountRub,
    finalUsd: PRICES.mentor.grossUsd - discountUsd,
    finalRub: PRICES.mentor.grossRub - discountRub,
    cappedGp,
  };
}

// Совместимость для экранов: возвращает итоговую цену в USD
export function mentorStarsPrice(gp: number): number {
  return mentorPrices(gp).finalUsd;
}

export const ADMIN_ID = 285754501;

export interface RankDef {
  title: string;
  minGp: number;
  tag: string;
  desc: string;
}

export const DJ_RANKS: RankDef[] = [
  { title: 'Bedroom DJ', minGp: 0, tag: 'LVL 1', desc: 'Первые шаги за деками и знакомство с софтом' },
  { title: 'Beatmatcher', minGp: 100, tag: 'LVL 2', desc: 'Чувствуешь BPM, сетку и синхронизацию' },
  { title: 'Groove Selector', minGp: 250, tag: 'LVL 3', desc: 'Мастер лупов, Beat Jump и переходов' },
  { title: 'Club Resident', minGp: 450, tag: 'LVL 4', desc: 'Собрал свой первый сет и держишь танцпол' },
  { title: 'Festival Headliner', minGp: 700, tag: 'LVL 5', desc: 'Высший ранг Open Deck DJ School' },
];

export function getUserRank(gp: number): RankDef {
  let rank = DJ_RANKS[0];
  for (const r of DJ_RANKS) {
    if (gp >= r.minGp) {
      rank = r;
    }
  }
  return rank;
}
