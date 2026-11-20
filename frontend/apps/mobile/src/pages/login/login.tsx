import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { OperationsDashboard } from '../dashboard/operations-dashboard';

type Profile = {
  id: string;
  full_name: string;
  role: 'parent' | 'supervisor' | 'school_admin' | 'platform_owner';
  language: 'en' | 'sn' | 'nd';
};

export default function HomeScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let mounted = true;
    void client.auth.getSession().then(async ({ data }) => {
      if (!data.session || !mounted) return;
      const { data: row } = await client
        .from('profiles')
        .select('id,full_name,role,language')
        .eq('id', data.session.user.id)
        .single();
      if (mounted && row) setProfile(row as Profile);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) setProfile(null);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn() {
    const client = supabase;
    if (!client) {
      setError('Connect the Supabase environment before signing in.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: authError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      if (!data.user) throw new Error('Sign-in did not return a user.');
      const { data: row, error: profileError } = await client
        .from('profiles')
        .select('id,full_name,role,language')
        .eq('id', data.user.id)
        .single();
      if (profileError)
        throw new Error(
          'Your account profile is not configured. Contact your school administrator.',
        );
      setProfile(row as Profile);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setProfile(null);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>p</Text>
          </View>
          <Text style={styles.brand}>preDrive</Text>
          {/* <Text style={styles.region}>ZIMBABWE</Text> */}
        </View>
        {profile ? (
          <OperationsDashboard profile={profile} onSignOut={() => void signOut()} />
        ) : (
          <>
            <View style={styles.hero}>
              {/* <Text style={styles.eyebrow}>SCHOOL TRANSPORT, WITH CARE</Text> */}
              <Text style={styles.heading}>
                Every journey.{'\n'}Every child.{'\n'}Accounted for.
              </Text>
              {/* <Text style={styles.subheading}>
                A safer, clearer way to manage school transport across Zimbabwe.
              </Text> */}
            </View>
            <View style={styles.form}>
              {/* <Text style={styles.formTitle}>Welcome back</Text> */}
              <Text style={styles.formHint}>Sign in with the account provided by your school.</Text>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                style={styles.input}
                placeholder="you@school.co.zw"
                placeholderTextColor="#91A19B"
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#91A19B"
              />
              {error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                style={[styles.primaryButton, busy && styles.disabled]}
                onPress={() => void signIn()}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign in securely</Text>
                )}
              </Pressable>
              {/* <Text style={styles.footnote}>
                Access is managed by your school. If you need help, contact your school
                administrator.
              </Text> */}
            </View>
          </>
        )}
        {/* <Text style={styles.footer}>Built for safer school journeys · Zimbabwe</Text> */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F8F7' },
  page: {
    padding: 24,
    paddingTop: 18,
    paddingBottom: 40,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 38 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#0B6B58',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#FFFFFF', fontSize: 25, fontWeight: '800' },
  brand: { fontSize: 21, fontWeight: '800', color: '#102D27', letterSpacing: -0.7 },
  region: {
    marginLeft: 'auto',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#77918A',
  },
  hero: { paddingVertical: 18 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#0B8067',
    marginBottom: 15,
  },
  heading: {
    fontSize: 39,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -1.6,
    color: '#112F28',
  },
  subheading: { fontSize: 15, lineHeight: 23, color: '#647A73', marginTop: 12, maxWidth: 360 },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    marginTop: 22,
    borderWidth: 1,
    borderColor: '#E4ECE8',
  },
  formTitle: { fontSize: 21, fontWeight: '800', color: '#15362E' },
  formHint: { fontSize: 13, color: '#758780', marginTop: 5, marginBottom: 23 },
  label: { fontSize: 12, fontWeight: '700', color: '#35544A', marginBottom: 8, marginTop: 13 },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE7E2',
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#17382F',
    backgroundColor: '#FBFDFC',
  },
  primaryButton: {
    height: 53,
    marginTop: 22,
    borderRadius: 13,
    backgroundColor: '#0B6B58',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.65 },
  error: { color: '#B42318', fontSize: 12, marginTop: 12 },
  footnote: { fontSize: 11, lineHeight: 17, color: '#82928C', textAlign: 'center', marginTop: 17 },
  statusCard: {
    marginTop: 26,
    padding: 19,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4ECE8',
    flexDirection: 'row',
    gap: 13,
    alignItems: 'flex-start',
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#A5B7B0', marginTop: 5 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#183B31' },
  cardBody: { fontSize: 13, lineHeight: 20, color: '#70837B', marginTop: 5 },
  panel: { marginTop: 15, backgroundColor: '#E8F3EF', borderRadius: 18, padding: 19 },
  panelTitle: { fontSize: 15, fontWeight: '800', color: '#17483B' },
  panelBody: { fontSize: 13, lineHeight: 20, color: '#58746A', marginTop: 7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 15 },
  chip: {
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    fontSize: 10,
    fontWeight: '700',
    color: '#397262',
  },
  secondaryButton: {
    marginTop: 18,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8D8D1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { fontWeight: '700', color: '#34594D' },
  footer: {
    fontSize: 10,
    color: '#9AA9A3',
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: 36,
  },
});
