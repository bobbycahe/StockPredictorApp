declare module 'react-native-chart-kit' {
  import { ViewStyle } from 'react-native';
  import { ReactNode } from 'react';

  interface ChartConfig {
    backgroundColor?: string;
    backgroundGradientFrom?: string;
    backgroundGradientTo?: string;
    decimalPlaces?: number;
    color?: (opacity?: number) => string;
    style?: ViewStyle;
    [key: string]: any;
  }

  interface Dataset {
    data: Array<number | null>;
    color?: (opacity?: number) => string;
    strokeWidth?: number;
    [key: string]: any;
  }

  interface AbstractChart {
    width: number;
    height: number;
    data: {
      labels: string[];
      datasets: Dataset[];
      legend?: string[];
    };
    chartConfig: ChartConfig;
    [key: string]: any;
  }

  interface LineChartProps extends AbstractChart {
    bezier?: boolean;
    onDataPointClick?: (data: {
      value: number;
      x: number;
      y: number;
      index: number;
    }) => void;
    getDotColor?: (dataPoint: number | null, index: number) => string;
    decorator?: (props: {
      x: number;
      y: number;
      index: number;
      value: number | null;
    }) => ReactNode;
  }

  export class LineChart extends React.Component<LineChartProps> {}
}