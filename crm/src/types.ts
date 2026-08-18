// CRM API types — mirror legacy crm.html contract (backend unchanged).
export type StudentStatus = 'free' | 'paid' | 'vip';

export interface StudentRow {
  user_id: number;
  first_name?: string;
  username?: string;
  photo_url?: string;
  archetype?: string;
  status: StudentStatus;
  groove_points: number;
  lessons_done: number;
  refers_count: number;
  bonus_unlocked: number;
  bonus_done: number;
  referral_code?: string;
  last_seen?: string;
  created_at?: string;
}

export interface Stats {
  total_users: number;
  active_today: number;
  new_week: number;
  paid_any: number;
  paid_full: number;
  paid_tripwire: number;
  paid_mentor: number;
  revenue_stars: number;
  referrals_total: number;
  total_gp: number;
}

export interface StudentsResp {
  students: StudentRow[];
  total: number;
  page: number;
  per_page: number;
}

export interface LessonProgress {
  course_id: string;
  lesson_id: number;
  completed: boolean;
  gp_earned?: number;
}

export interface Payment {
  course_id: string;
  provider?: string;
  status: string;
  amount?: number;
  created_at?: string;
}

export interface GpTx {
  action_type: string;
  amount: number;
  timestamp?: string;
}

export interface Referral {
  user_id: number;
  first_name?: string;
  username?: string;
  groove_points?: number;
  created_at?: string;
}

export interface StudentDetail {
  user: StudentRow;
  gp: number;
  paid_mentor: boolean;
  paid_full: boolean;
  paid_tripwire: boolean;
  referrals_count: number;
  lessons?: LessonProgress[];
  payments?: Payment[];
  referrals?: Referral[];
  transactions?: GpTx[];
  badges?: string[];
  inviter?: { first_name?: string; user_id: number };
  error?: string;
}

export interface TestAccount {
  user_id: number;
  first_name?: string;
  username?: string;
  groove_points: number;
}
