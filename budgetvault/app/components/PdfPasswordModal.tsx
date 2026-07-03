import { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../src/theme/ThemeContext';

interface Props {
  visible: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export function PdfPasswordModal({ visible, onSubmit, onCancel }: Props) {
  const { colors } = useTheme();
  const [password, setPassword] = useState('');

  function handleSubmit() {
    if (!password.trim()) return;
    onSubmit(password);
    setPassword('');
  }

  function handleCancel() {
    setPassword('');
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={s.overlay}>
        <View style={[s.modal, { backgroundColor: colors.surface }]}>
          <Text style={[s.title, { color: colors.text }]}>PDF Password Required</Text>
          <Text style={[s.body, { color: colors.textMuted }]}>
            This PDF is password-protected. Enter the password to import it.
          </Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border }]}
            placeholder="Enter password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSubmit}
            autoFocus
          />
          <View style={s.btnRow}>
            <TouchableOpacity style={[s.btn, s.cancelBtn, { borderColor: colors.border }]} onPress={handleCancel}>
              <Text style={[s.btnText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.submitBtn, { backgroundColor: colors.accent }]}
              onPress={handleSubmit}
            >
              <Text style={[s.btnText, { color: '#fff' }]}>Unlock</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    elevation: 8,
  },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 20,
  },
  btnRow: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { borderWidth: 1 },
  submitBtn: {},
  btnText: { fontSize: 15, fontWeight: '600' },
});
