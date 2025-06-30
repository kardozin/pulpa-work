import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Profile } from '../types';
import { User } from '@supabase/supabase-js';

export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at'>>;

export const useProfile = (user: User | null) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error, status } = await supabase
        .from('profiles')
        .select(`*`)
        .eq('id', user.id)
        .single();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (profileData: ProfileUpdate) => {
    if (!user) {
      console.error('Cannot update profile without a user.');
      return;
    }
    
    setLoading(true);
    try {
      const updates = {
        ...profileData,
        id: user.id,
        updated_at: new Date().toISOString(),
      };

      // Don't send an empty string for voice_id
      if (updates.preferred_voice_id === '') {
        delete updates.preferred_voice_id;
      }

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) {
        throw error;
      }
      
      await fetchProfile();

    } catch (error) {
      console.error('Error updating profile:', error);
    } 
  };

  return { profile, loading, fetchProfile, updateProfile };
};
