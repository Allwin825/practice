import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDb } from '../../src/db';
import { upsertAccount } from '../../src/db/queries';
import { setSetting } from '../../src/db/queries';
import { useTheme } from '../../src/theme/ThemeContext';
import type { AccountKind } from '../../src/types';

type Step = 'welcome' | 'account' | 'done';

interface Props {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>('welcome');
  const [accountName, setAccountName] = useState('');
  const [accountKind, setAccountKind] = useState<AccountKind>('bank');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function createAccount() {
    const name = accountName.trim();
    if (!name) { setError('Please enter an account name.'); return; }
    setSaving(true);
    setError('');
    try {
      const db = await getDb();
      await upsertAccount(db, { name, bank: 'generic_csv', kind: accountKind });
      setStep('done');
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    try {
      const db = await getDb();
      await setSetting(db, 'onboarding_complete', 'true');
    } catch { /* non-fatal */ }
    onComplete();
  }

  const s = makeStyles(colors);

  if (step === 'welcome') {
    return (
      <View style={s.screen}>
        <View style={s.content}>
          <Text style={s.logo}>💰</Text>
          <Text style={s.heading}>Welcome to BudgetVault</Text>
          <Text style={s.subtitle}>
            Your privacy-first finance tracker.{'\n'}
            All data stays on your device — always.
          </Text>

          <View style={s.featureList}>
            {[
              ['📥', 'Import bank statements (CSV / XLSX)'],
              ['🔒', 'Zero network calls — completely offline'],
              ['📊', 'Budget tracking & spending insights'],
              ['🛡️', 'Biometric lock & encrypted storage'],
            ].map(([icon, text]) => (
              <View key={text} style={s.featureRow}>
                <Text style={s.featureIcon}>{icon}</Text>
                <Text style={[s.featureText, { color: colors.textSecondary }]}>{text}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => setStep('account')}
          accessibilityRole="button"
          accessibilityLabel="Get started"
        >
          <Text style={s.primaryBtnText}>Get Started →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'account') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.screen}>
          <View style={s.stepIndicator}>
            <Text style={[s.stepDot, s.stepDotActive]} />
            <Text style={s.stepDot} />
          </View>

          <View style={s.content}>
            <Text style={s.heading}>Add Your First Account</Text>
            <Text style={s.subtitle}>
              Give your bank account a name so imported transactions are organised correctly.
            </Text>

            <Text style={s.label}>Account name</Text>
            <TextInput
              style={[s.input, { borderColor: error ? colors.danger : colors.border }]}
              value={accountName}
              onChangeText={(t) => { setAccountName(t); setError(''); }}
              placeholder="e.g. HDFC Savings, ICICI Credit Card"
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="next"
              accessibilityLabel="Account name"
            />
            {!!error && <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text>}

            <Text style={[s.label, { marginTop: 20 }]}>Account type</Text>
            <View style={s.kindRow}>
              {([
                ['bank', 'Bank'],
                ['credit_card', 'Credit Card'],
                ['wallet', 'Wallet'],
              ] as [AccountKind, string][]).map(([kind, label]) => (
                <TouchableOpacity
                  key={kind}
                  style={[
                    s.kindChip,
                    accountKind === kind && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}
                  onPress={() => setAccountKind(kind)}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: accountKind === kind }}
                >
                  <Text style={[
                    s.kindChipText,
                    { color: accountKind === kind ? '#fff' : colors.textSecondary },
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[s.primaryBtn, saving && { opacity: 0.6 }]}
            onPress={createAccount}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Create account and continue"
          >
            <Text style={s.primaryBtnText}>{saving ? 'Saving…' : 'Create Account →'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // step === 'done'
  return (
    <View style={s.screen}>
      <View style={s.content}>
        <Text style={s.logo}>✅</Text>
        <Text style={s.heading}>You're all set!</Text>
        <Text style={s.subtitle}>
          Your account is ready. Here's how to get started:
        </Text>

        <View style={s.tipList}>
          {[
            ['1', 'Import Tab', 'Pick a CSV or XLSX bank statement to import your transactions.'],
            ['2', 'Budget Tab', 'Set monthly budgets per category to track your spending.'],
            ['3', 'Dashboard', 'See spending trends, savings rate, and a budget snapshot.'],
          ].map(([num, title, desc]) => (
            <View key={num} style={[s.tipCard, { backgroundColor: colors.surface }]}>
              <View style={[s.tipNum, { backgroundColor: colors.accent }]}>
                <Text style={s.tipNumText}>{num}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.tipTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[s.tipDesc, { color: colors.textMuted }]}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={s.primaryBtn}
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel="Start using BudgetVault"
      >
        <Text style={s.primaryBtnText}>Start Using BudgetVault</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('../../src/theme/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: 24,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 40,
    },
    stepIndicator: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 32,
    },
    stepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    stepDotActive: {
      backgroundColor: colors.accent,
    },
    content: { flex: 1 },
    logo: { fontSize: 56, textAlign: 'center', marginBottom: 16 },
    heading: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
    },
    featureList: { gap: 16 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    featureIcon: { fontSize: 20, width: 32 },
    featureText: { fontSize: 14, flex: 1 },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1.5,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    errorText: { fontSize: 13, marginTop: 6 },
    kindRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    kindChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    kindChipText: { fontSize: 14, fontWeight: '600' },
    tipList: { gap: 12, marginTop: 8 },
    tipCard: {
      flexDirection: 'row',
      borderRadius: 12,
      padding: 14,
      gap: 12,
      alignItems: 'flex-start',
    },
    tipNum: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipNumText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    tipTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
    tipDesc: { fontSize: 12, lineHeight: 17 },
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
}
