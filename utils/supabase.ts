import { createClient } from "@supabase/supabase-js";

// Supabase credentials - using the anon key from your project
const supabaseUrl = "https://ttsgeniubfkcexitfqsd.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0c2dlbml1YmZrY2V4aXRmcXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjQzMTEsImV4cCI6MjA5MzU0MDMxMX0.9zmGPUoxRnkRuLsC0-w9C-6p5q034o9-vi_q2i7QUy8";

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to get user role name from role_id
export async function getUserRole(roleId: number): Promise<string> {
  const { data, error } = await supabase
    .from('roles')
    .select('role_name')
    .eq('role_id', roleId)
    .single();

  if (error) {
    console.error('Error fetching role:', error);
    return 'resident';
  }
  return data?.role_name || 'resident';
}

// Helper to fetch user with role details
export async function getUserWithRole(userId: number) {
  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      roles (role_name, description),
      barangays (barangay_name, municipality, province)
    `)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  return data;
}