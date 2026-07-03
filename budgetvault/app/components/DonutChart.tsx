import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

interface Props {
  spent: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSub?: string;
}

export function DonutChart({
  spent,
  total,
  size = 160,
  strokeWidth = 18,
  centerLabel,
  centerSub,
}: Props) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  const pct = total > 0 ? Math.min(spent / total, 1) : 0;
  const dash = pct * circumference;

  const arcColor =
    pct > 1 ? '#EF4444' : pct > 0.9 ? '#F97316' : pct > 0.75 ? '#EAB308' : '#1A3C5E';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${cx},${cy}`}>
          <Circle
            cx={cx} cy={cy} r={r}
            stroke="#E5E7EB" strokeWidth={strokeWidth} fill="none"
          />
          {pct > 0 && (
            <Circle
              cx={cx} cy={cy} r={r}
              stroke={arcColor} strokeWidth={strokeWidth} fill="none"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeLinecap="round"
            />
          )}
        </G>
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={s.center}>
          {centerLabel !== undefined && (
            <Text style={s.label}>{centerLabel}</Text>
          )}
          {centerSub !== undefined && (
            <Text style={s.sub}>{centerSub}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 20, fontWeight: '800', color: '#1F2937' },
  sub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
});
