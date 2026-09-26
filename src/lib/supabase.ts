import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
});

export type CandidateDomain = 'Civil' | 'Mechanical' | 'Commerce';

export interface Candidate {
  id: number;
  code: string;
  name: string;
  mobile: string;
  place: string;
  category: 'Fresher' | 'Experienced';
  domain: CandidateDomain;
  created_at: string;
}

export type FeedbackValue =
  | 'Below 70%'
  | 'Above 70%'
  | 'Teaching Interested'
  | 'Course Interested'
  | 'Both'
  | 'N/A';

export interface TimeEntry {
  id: number;
  user_email: string;
  department: string;
  task_code: string;
  start_time: string;
  stop_time: string | null;
  duration_minutes: number | null;
  feedback: FeedbackValue | null;
  created_at: string;
}
