import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/auth/AuthProvider';
import type { CRMProfile } from '../types';

async function fetchProfiles(): Promise<CRMProfile[]> {
  const { data, error } = await supabase.from('crm_profiles').select('*');
  if (error) throw error;
  return data as CRMProfile[];
}

async function fetchMyProfile(userId: string): Promise<CRMProfile | null> {
  const { data, error } = await supabase
    .from('crm_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as CRMProfile | null;
}

export function useCRMProfiles() {
  return useQuery({
    queryKey: ['crm-profiles'],
    queryFn: fetchProfiles,
  });
}

export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['crm-profile', user?.id],
    queryFn: () => fetchMyProfile(user!.id),
    enabled: !!user,
  });
}

export function useUpsertProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: { id: string; rep_name: string }) => {
      const { data, error } = await supabase
        .from('crm_profiles')
        .upsert(profile, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data as CRMProfile;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['crm-profiles'] });
      qc.invalidateQueries({ queryKey: ['crm-profile', vars.id] });
    },
  });
}
