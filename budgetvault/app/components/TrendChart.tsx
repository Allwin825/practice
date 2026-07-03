import { Text, View } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';

export interface TrendPoint {
  month: string;
  total_debit: number;
  total_credit: number;
}

interface Props {
  data: TrendPoint[];
  currentMonth: string;
  width: number;
  height?: number;
}

export function TrendChart({ data, currentMonth, width, height = 100 }: Props) {
  if (data.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#9CA3AF', fontSize: 13 }}>No data yet</Text>
      </View>
    );
  }

  const chartH = height - 22;
  const maxVal = Math.max(...data.map((d) => d.total_debit), 1);
  const slotW = width / data.length;
  const barW = slotW * 0.55;
  const gap = (slotW - barW) / 2;

  return (
    <Svg width={width} height={height}>
      {data.map((d, i) => {
        const barH = Math.max((d.total_debit / maxVal) * chartH, 2);
        const x = i * slotW + gap;
        const y = chartH - barH;
        const isCurrent = d.month === currentMonth;
        const label = d.month.slice(5); // 'MM'

        return (
          <G key={d.month}>
            <Rect
              x={x} y={y} width={barW} height={barH}
              fill={isCurrent ? '#1A3C5E' : '#BFDBFE'}
              rx={3}
            />
            <SvgText
              x={x + barW / 2}
              y={height - 4}
              fontSize={10}
              fill={isCurrent ? '#1A3C5E' : '#9CA3AF'}
              textAnchor="middle"
              fontWeight={isCurrent ? 'bold' : 'normal'}
            >
              {label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
