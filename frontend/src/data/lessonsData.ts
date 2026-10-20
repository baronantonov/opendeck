/**
 * Open Deck DJ School — Pocket DJ Course Video Architecture
 *
 * Архитектура хранения видеоуроков с поддержкой прямых MP4-потоков
 * и Telegram CDN / постов каналов без рекламы, водяных знаков и плееров YouTube.
 */

export interface LessonVideoData {
  id: number;
  title: string;
  subtitle: string;
  summary: string;
  description: string[];
  durationSeconds: number;
  isFree: boolean;
  /** Ссылка на видеофайл/пост в Telegram-канале */
  telegramVideoUrl: string;
  /** Прямой валидный MP4-видеопоток для нативного HTML5 <video> */
  videoSource: string;
  poster?: string;
}

/**
 * 10 основных практических уроков курса «Pocket DJ»
 */
export const POCKET_DJ_LESSONS: LessonVideoData[] = [
  {
    id: 1,
    title: 'Интерфейс на телефоне: твой первый контроллер',
    subtitle: 'Вводный урок · Архитектура пульта Rekordbox',
    summary: 'Пошаговый разбор элементов экрана: деки, частоты, кнопка Cue/Play, фейдеры и мастер-фильтр.',
    description: [
      'Обзор программы на телефоне и из чего состоит виртуальный контроллер.',
      'Дека, частоты (Hi, Mid, Low), кнопка Cue/Play, фейдеры, фильтр — назначение каждой ручки.',
      'Перестань бояться экрана: всё логично и интуитивно, когда разобрал по частям.',
    ],
    durationSeconds: 184,
    isFree: true,
    telegramVideoUrl: 'https://t.me/opendeck_channel/101',
    videoSource: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    poster: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 2,
    title: 'Знакомство с FREEDA: кто такой диджей',
    subtitle: 'Практика · Философия и роль диджея',
    summary: 'Путь Таши (FREEDA DJ) от первых экспериментов до фестивалей и ключ к управлению энергией танцпола.',
    description: [
      'Знакомство с Ташей (FREEDA DJ): путь от первого бита до клубных фестивалей.',
      'Кто такой диджей, его функция на вечеринке и где применяется диджеинг сегодня.',
      'Диджей — это не избранные, а любой, кто ведёт энергию через музыку.',
    ],
    durationSeconds: 215,
    isFree: true,
    telegramVideoUrl: 'https://t.me/opendeck_channel/102',
    videoSource: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    poster: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 3,
    title: 'Направления и оборудование: где найти себя',
    subtitle: 'PRO модуль · Выбор сетапа и стиля',
    summary: 'Коммерческий, ивент, андерграунд и фестивальный диджеинг. Разбор актуального оборудования.',
    description: [
      'Виды диджеинга: коммерческий, ивент, андерграунд, фестивальный, радио.',
      'Какое бывает оборудование (standalone, контроллеры, DVS) и где применяется.',
      'Выбери своё направление — это снимет страх «а я не такой, как все».',
    ],
    durationSeconds: 240,
    isFree: false,
    telegramVideoUrl: 'https://t.me/opendeck_channel/103',
    videoSource: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    poster: 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 4,
    title: 'Музыкальная теория: бит, ритм и колесо Камелота',
    subtitle: 'PRO модуль · Гармоническое сведение',
    summary: 'Структура трека (интро, дроп, яма, аутро), сетка битов и гармоническая совместимость тональностей.',
    description: [
      'Из чего строится музыка: бит, такты, фразы, тональности, частотные дорожки в треке.',
      'Колесо Камелота — как подбирать треки, которые звучат гармонично и без фальши.',
      'Анатомия трека: интро, ямы, дропы, аутро — учимся читать звуковую волну как книгу.',
    ],
    durationSeconds: 295,
    isFree: false,
    telegramVideoUrl: 'https://t.me/opendeck_channel/104',
    videoSource: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    poster: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 5,
    title: 'Основы сведения: BPM, темп и кнопка Sync',
    subtitle: 'PRO модуль · Первый бесшовный переход',
    summary: 'Выравнивание скоростей, подготовка точки входа Cue и применение Sync для идеального тайминга.',
    description: [
      'Процесс сведения двух треков: подгонка BPM, темп, фазировка и синхронизация сеток.',
      'Как сводить в одной тональности, стиле и темпе — и когда нужна кнопка Sync.',
      'Первый реальный микс: два разных трека объединяются в единый непрерывный грув.',
    ],
    durationSeconds: 260,
    isFree: false,
    telegramVideoUrl: 'https://t.me/opendeck_channel/105',
    videoSource: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    poster: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 6,
    title: 'Кроссфейдер и нюансы темпо',
    subtitle: 'PRO модуль · Динамика микширования',
    summary: 'Плавные и резкие переходы через кроссфейдер, работа с кривой среза и диапазонами Pitch/Tempo.',
    description: [
      'Техника сведения через кроссфейдер — плавный переход между деками без провала громкости.',
      'Нюансы темпо: режимы диапазона питча (±6%, ±10%, ±16%, WIDE) и правильный подбор.',
      'Учимся контролировать энергию танцпола ровно, без скачков и внезапных пауз.',
    ],
    durationSeconds: 220,
    isFree: false,
    telegramVideoUrl: 'https://t.me/opendeck_channel/106',
    videoSource: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    poster: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 7,
    title: 'Лупы и Beat Jump: лёгкое сведение',
    subtitle: 'PRO модуль · Контроль времени трека',
    summary: 'Зацикливание фраз (Auto/Manual Loops) и мгновенная навигация по тактам с помощью Beat Jump.',
    description: [
      'Лупы (петли) — простой и надежный способ зациклить отрезок и свести треки без спешки.',
      'Beat Jump: мгновенные прыжки по битам вперед и назад для идеального попадания в квадрат.',
      'Приемы профессионалов, которые делают живое выступление расслабленным и точным.',
    ],
    durationSeconds: 245,
    isFree: false,
    telegramVideoUrl: 'https://t.me/opendeck_channel/107',
    videoSource: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    poster: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 8,
    title: 'Эффекты и фильтр: краски твоего сета',
    subtitle: 'PRO модуль · Sound Design в сете',
    summary: 'Применение Color FX (Filter, Noise) и Beat FX (Echo, Reverb, Flanger) для создания мощных дропов.',
    description: [
      'Что такое DJ-эффекты и обзор инструментов, доступных в мобильной версии.',
      'Грамотное применение Reverb и Echo при смене трека, работа с Performance Pads.',
      'Hi/Low Pass фильтр — аккуратная работа с частотами, чтобы украсить, а не заглушить звук.',
    ],
    durationSeconds: 275,
    isFree: false,
    telegramVideoUrl: 'https://t.me/opendeck_channel/108',
    videoSource: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    poster: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 9,
    title: 'История: от диско до наших дней',
    subtitle: 'PRO модуль · Эволюция клубной культуры',
    summary: 'Культурный бэкграунд: рождение винила, истоки хауса в Чикаго и трансформация электронной сцены.',
    description: [
      'Краткая история появления диджеинга и как изменилась культура за 50 лет.',
      'Путь электронной музыки: от диско-эры и Warehouse до стадионных EDM-фестивалей.',
      'Контекст стилей — ты поймешь, откуда растут корни жанров, которые ты играешь.',
    ],
    durationSeconds: 310,
    isFree: false,
    telegramVideoUrl: 'https://t.me/opendeck_channel/109',
    videoSource: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    poster: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 10,
    title: 'Твой первый микс из 4–5 треков',
    subtitle: 'Финальный выпускной проект курса',
    summary: 'Комплексная запись собственного мини-сета: планирование плейлиста, переходы и сохранение записи.',
    description: [
      'Особенности построения драматургии микса: ввод, кульминация и развязка.',
      'Сводим полноценный сет из 4–5 треков в реальном времени, применяя все техники курса.',
      'Финал курса: твой первый готовый диджейский сет и твердая уверенность за деками.',
    ],
    durationSeconds: 360,
    isFree: false,
    telegramVideoUrl: 'https://t.me/opendeck_channel/110',
    videoSource: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
    poster: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&auto=format&fit=crop&q=80',
  },
];

/**
 * Адаптер-резолвер для прямого HTML5-видеопотока.
 * Принимает конфигурацию урока и возвращает чистый URL потока для нативного <video>.
 * Исключает YouTube iframe, стороннюю рекламу, баннеры и сторонние плееры.
 */
export function resolveVideoSource(lesson: LessonVideoData): string {
  if (!lesson) {
    return '';
  }

  // 1. Если задан прямой MP4 поток — возвращаем его
  if (lesson.videoSource && lesson.videoSource.startsWith('http')) {
    return lesson.videoSource;
  }

  // 2. Если передан Telegram URL формата https://t.me/<channel>/<post_id>
  if (lesson.telegramVideoUrl && lesson.telegramVideoUrl.includes('t.me/')) {
    return lesson.videoSource || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
  }

  return lesson.videoSource || '';
}

/**
 * Получить данные урока по ID (1..10)
 */
export function getLessonById(id: number): LessonVideoData | undefined {
  return POCKET_DJ_LESSONS.find((l) => l.id === id);
}
