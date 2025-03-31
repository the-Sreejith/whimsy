
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://swqpnuzuypabcnbqjqdh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cXBudXp1eXBhYmNuYnFqcWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzOTk2ODAsImV4cCI6MjA1ODk3NTY4MH0.sr4O6WKdLxW82tGf0OoIk2ZoJC3DUshHy5-0RQjGrYU";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});
