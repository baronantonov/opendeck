export interface Lesson {
  id?: number;
  t: string;
  video?: string;
  d: string[];
}

export interface User {
  name: string;
  archetype: string;
  groovePoints: number;
  referralCode: string;
  referralFriends: number;
  referralGpEarned: number;
  bonusLessons: number;
  photoUrl: string;
}

export interface CourseProgress {
  currentLessonId: number | null;
  completedLessons: number[];
  freeLessons: number;
}

export interface InitResponse {
  user: {
    groove_points: number;
    referral_code: string;
    referral_friends?: number;
    referral_gp_earned?: number;
    bonus_lessons?: number;
    archetype?: string;
    first_name?: string;
    username?: string;
    photo_url?: string;
  };
  course: {
    course_id: string;
    completed_lessons: number[];
    total_lessons: number;
    current_lesson_id: number | null;
    free_lessons?: number;
  };
  paid?: boolean;
  paid_full?: boolean;
  bonus?: { type: string; amount: number; message: string } | null;
}

export interface LessonsResponse {
  lessons: Lesson[];
  completed: number[];
  paid: boolean;
}

export interface InvoiceResponse {
  invoice_link?: string;
  pay_url?: string;
  error?: string;
  detail?: string;
}

export interface MentorPrice {
  final: number;
  discount: number;
}
