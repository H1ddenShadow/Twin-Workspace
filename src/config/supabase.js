// Supabase Client Configuration
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = localStorage.getItem('sb_url') || 'https://slevlpenkuzzgvyxbpjn.supabase.co';
const SUPABASE_KEY = localStorage.getItem('sb_key') || 'sb_publishable_rsOEwkC5oH_vBlvYO5gJlA_thtT8icj';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
