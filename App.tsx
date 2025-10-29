import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

type Suggestion = { symbol: string; name: string };

interface ChartPoint {
  value: number;
  x: number;
  y: number;
  index: number;
}

export default function App(): React.ReactElement {
  const [ticker, setTicker] = useState('');
  const [result, setResult] = useState<{ nextPrice: number; currentPrice: number; projectionLine: number[]; confidence?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<number[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [tooltipData, setTooltipData] = useState<{ value: number; x: number; y: number; visible: boolean }>({ value: 0, x: 0, y: 0, visible: false });
  const searchTimeout = useRef<number | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyDomain, setCompanyDomain] = useState<string | null>(null);
  const [news, setNews] = useState<Array<{ title: string; link?: string }>>([]);
  const [localNewsLoaded, setLocalNewsLoaded] = useState(false);

  // Use Yahoo Finance API (no key needed)
  const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

  type Candle = { date: string; close: number; volume: number };

  // Return array of candles (date, close, volume) newest last
  const fetchStockData = useCallback(async (symbol: string): Promise<Candle[]> => {
    const period2 = Math.floor(Date.now() / 1000);
    const period1 = period2 - 60 * 60 * 24 * 100; // last 100 days
    const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.chart?.result?.[0]?.indicators?.quote?.[0]) {
      try {
        console.warn('Yahoo Finance unexpected response for', symbol, json);
      } catch (e) {}
      throw new Error('Could not fetch stock data from Yahoo Finance');
    }
    const result = json.chart.result[0];
    const quote = result.indicators.quote[0];
    const timestamps = result.timestamp;
    const entries: Candle[] = [];
    
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.close[i] != null) {
        entries.push({
          date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
          close: quote.close[i],
          volume: quote.volume[i] || 0
        });
      }
    }
    return entries.reverse();
  }, []);

  // ---- Feature helpers and small linear ridge regression -----
  const sma = (arr: number[], period: number) => {
    if (arr.length < period) return NaN;
    const slice = arr.slice(arr.length - period);
    return slice.reduce((a, b) => a + b, 0) / period;
  };

  const ema = (arr: number[], period: number) => {
    if (arr.length === 0) return NaN;
    const k = 2 / (period + 1);
    let prev = arr[0];
    for (let i = 1; i < arr.length; i++) {
      prev = arr[i] * k + prev * (1 - k);
    }
    return prev;
  };

  const stddev = (arr: number[]) => {
    if (arr.length === 0) return NaN;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / arr.length;
    return Math.sqrt(variance);
  };

  // simple matrix helpers
  const transpose = (m: number[][]) => m[0].map((_, i) => m.map(r => r[i]));
  const matMul = (A: number[][], B: number[][]) => {
    const n = A.length, p = B[0].length, m = B.length;
    const out = Array.from({ length: n }, () => Array(p).fill(0));
    for (let i = 0; i < n; i++) for (let k = 0; k < m; k++) for (let j = 0; j < p; j++) out[i][j] += A[i][k] * B[k][j];
    return out;
  };

  // invert small matrix using Gauss-Jordan
  const invertMatrix = (m: number[][]) => {
    const n = m.length;
    const A = m.map(row => row.slice());
    const I = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[maxRow][i])) maxRow = r;
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [I[i], I[maxRow]] = [I[maxRow], I[i]];
      const pivot = A[i][i];
      if (Math.abs(pivot) < 1e-12) return null;
      for (let c = 0; c < n; c++) { A[i][c] /= pivot; I[i][c] /= pivot; }
      for (let r = 0; r < n; r++) if (r !== i) {
        const factor = A[r][i];
        for (let c = 0; c < n; c++) { A[r][c] -= factor * A[i][c]; I[r][c] -= factor * I[i][c]; }
      }
    }
    return I;
  };

  const linearRidge = (X: number[][], y: number[], lambda = 1e-3) => {
    // X: samples x features
    const Xt = transpose(X); // features x samples
    const XtX = matMul(Xt, X); // features x features
    // add ridge
    for (let i = 0; i < XtX.length; i++) XtX[i][i] += lambda;
    const XtXinv = invertMatrix(XtX);
    if (!XtXinv) return null;
    const Xty = matMul(Xt, y.map(v => [v])); // features x 1
    const betaMat = matMul(XtXinv, Xty); // features x 1
    return betaMat.map(r => r[0]);
  };

  const improvedPredict = (candles: Candle[]) => {
    if (!candles || candles.length < 30) {
      // fallback to simple projection
      const closes = candles.map(c => c.close);
      const simple = predict(closes);
      return { ...simple, confidence: 0.2 };
    }
    const closes = candles.map(c => c.close);
    // compute returns in percent
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) returns.push(((closes[i] - closes[i - 1]) / closes[i - 1]) * 100);

    // build features and targets
    const features: number[][] = [];
    const targets: number[] = [];
    for (let i = 20; i < closes.length - 1; i++) {
      const windowCloses = closes.slice(0, i + 1);
      const r = returns[i - 1];
      const f = [
        1, // bias
        r ?? 0,
        sma(windowCloses, 5) ?? 0,
        sma(windowCloses, 20) ?? 0,
        ema(windowCloses, 12) ?? 0,
        ema(windowCloses, 26) ?? 0,
        stddev(returns.slice(Math.max(0, i - 19), i)) ?? 0,
  (windowCloses[windowCloses.length - 1] - (sma(windowCloses, 20) || 0)) || 0,
      ];
      features.push(f);
      targets.push(returns[i]); // next day's return
    }

    const beta = linearRidge(features, targets, 1e-2);
    if (!beta) {
      const closesOnly = candles.map(c => c.close);
      const s = predict(closesOnly);
      return { ...s, confidence: 0.1 };
    }

    // compute in-sample predictions to get R^2
    const preds: number[] = features.map(f => f.reduce((acc, v, j) => acc + v * beta[j], 0));
    const meanT = targets.reduce((a, b) => a + b, 0) / targets.length;
    const ssRes = targets.reduce((a, b, i) => a + (b - preds[i]) * (b - preds[i]), 0);
    const ssTot = targets.reduce((a, b) => a + (b - meanT) * (b - meanT), 0);
    const r2 = 1 - (ssRes / (ssTot || 1));

    // Backtest-based confidence: walk-forward evaluation (sampled) to estimate MAPE
    const n = closes.length;
    const errors: number[] = [];
    const step = 3; // sampling step to limit compute
    for (let split = 30; split < n - 1; split += step) {
      // build train features/targets up to split
      const trFeatures: number[][] = [];
      const trTargets: number[] = [];
      for (let i = 20; i < split; i++) {
        const windowCloses = closes.slice(0, i + 1);
        const r = ((closes[i] - closes[i - 1]) / closes[i - 1]) * 100;
        const f = [
          1,
          r ?? 0,
          sma(windowCloses, 5) || 0,
          sma(windowCloses, 20) || 0,
          ema(windowCloses, 12) || 0,
          ema(windowCloses, 26) || 0,
          stddev(closes.slice(Math.max(0, i - 19), i).map((_, idx) => {
            // placeholder for returns-derived stddev (we use closes window elsewhere)
            return 0;
          })) || 0,
          (windowCloses[windowCloses.length - 1] - (sma(windowCloses, 20) || 0)) || 0,
        ];
        trFeatures.push(f);
        trTargets.push(((closes[i + 1] - closes[i]) / closes[i]) * 100); // next day's return
      }
      if (trFeatures.length < 5) continue;
      const betaT = linearRidge(trFeatures, trTargets, 1e-2);
      if (!betaT) continue;
      // build features for day 'split' to predict split+1
      const windowCloses = closes.slice(0, split + 1);
      const lastRet = ((windowCloses[windowCloses.length - 1] - windowCloses[windowCloses.length - 2]) / windowCloses[windowCloses.length - 2]) * 100;
      const fNext = [
        1,
        lastRet || 0,
        sma(windowCloses, 5) || 0,
        sma(windowCloses, 20) || 0,
        ema(windowCloses, 12) || 0,
        ema(windowCloses, 26) || 0,
        stddev(closes.slice(Math.max(0, split - 19), split)) || 0,
        (windowCloses[windowCloses.length - 1] - (sma(windowCloses, 20) || 0)) || 0,
      ];
      const predRet = fNext.reduce((acc, v, j) => acc + v * betaT[j], 0);
      const predictedPrice = closes[split] * (1 + predRet / 100);
      const actualPrice = closes[split + 1];
      if (actualPrice && actualPrice > 0) {
        errors.push(Math.abs((predictedPrice - actualPrice) / actualPrice));
      }
    }

    let backtestConf = 0;
    if (errors.length > 0) {
      const mape = errors.reduce((a, b) => a + b, 0) / errors.length; // e.g., 0.02 = 2%
      const threshold = 0.1; // 10% MAPE -> zero confidence
      backtestConf = Math.max(0, 1 - Math.min(1, mape / threshold));
    }

    const finalConf = Math.max(0, Math.min(1, 0.8 * backtestConf + 0.2 * Math.max(0, Math.min(1, r2))));

    // now predict next 5 days iteratively
    let lastCloses = closes.slice();
    let lastReturns = returns.slice();
    const projection: number[] = [];
    for (let step = 0; step < 5; step++) {
      const fNext = [
        1,
        lastReturns[lastReturns.length - 1] ?? 0,
        sma(lastCloses, 5) ?? 0,
        sma(lastCloses, 20) ?? 0,
        ema(lastCloses, 12) ?? 0,
        ema(lastCloses, 26) ?? 0,
        stddev(lastReturns.slice(Math.max(0, lastReturns.length - 20))) ?? 0,
  (lastCloses[lastCloses.length - 1] - (sma(lastCloses, 20) || 0)) || 0,
      ];
      const predReturn = fNext.reduce((acc, v, j) => acc + v * beta[j], 0); // percent
      const nextPrice = lastCloses[lastCloses.length - 1] * (1 + predReturn / 100);
      projection.push(nextPrice);
      // update arrays
      const impliedReturn = predReturn;
      lastReturns.push(impliedReturn);
      lastCloses.push(nextPrice);
    }

    return { nextPrice: projection[projection.length - 1], projectionLine: projection, confidence: finalConf };
  };

  const symbolSearch = useCallback(async (keywords: string): Promise<Suggestion[]> => {
    if (!keywords) return [];
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(keywords)}&quotesCount=6&newsCount=0`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.quotes) return [];
      return json.quotes.map((q: any) => ({ 
        symbol: q.symbol, 
        name: q.longname || q.shortname || q.symbol 
      }));
    } catch (err) {
      console.warn('symbolSearch error', err);
      return [];
    }
  }, []);

  const fetchNews = useCallback(async (company: string) => {
    if (!company) return [];
    try {
      const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(company)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(rss);
      const text = await res.text();
      // crude parsing: extract <item> blocks and then <title> and <link>
      const items = Array.from(text.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, 6);
      const parsed = items.map((m) => {
        const block = m[1];
        const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
        const linkMatch = block.match(/<link>(.*?)<\/link>/i);
        const title = titleMatch ? (titleMatch[1] || titleMatch[2]) : 'No title';
        const link = linkMatch ? linkMatch[1] : undefined;
        return { title, link };
      });
  setNews(parsed);
      return parsed;
    } catch (err) {
      console.warn('fetchNews error', err);
      setNews([]);
      return [];
    }
  }, []);

  // Try to load locally scraped JSON (created by scripts/scrape_news.py) as a fallback
  useEffect(() => {
    const tryLoadLocal = async (company?: string | null, tickerArg?: string | null) => {
      try {
        const name = (company || companyName || (tickerArg || ticker || '').trim()).toString();
        if (!name) return;
        const candidates = new Set<string>();
        // company slug
        candidates.add(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
        // ticker slug
        const t = (tickerArg || ticker || '').toString().trim();
        if (t) candidates.add(t.toLowerCase());

        for (const slug of Array.from(candidates)) {
          const path = `./assets/news/${slug}.json`;
          const resp = await fetch(path).catch(() => null);
          if (resp && resp.ok) {
            const j = await resp.json();
            if (j && j.items && Array.isArray(j.items) && j.items.length > 0) {
              setNews(j.items.map((it: any) => ({ title: it.title, link: it.link })));
              setLocalNewsLoaded(true);
              return;
            }
          }
        }
      } catch (err) {
        // ignore
      }
    };
    void tryLoadLocal();
  }, [companyName, ticker]);

  const makeLogoFor = async (name: string) => {
    if (!name) return null;
    // Try to extract or guess a domain from company name
    const cleanName = name.toLowerCase()
      .replace(/\binc\.?\b|\bcorp\.?\b|\bltd\.?\b|\bcompany\b|\bindustries\b|\btechnologies\b|\bholdings?\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter(s => s.length > 0)
      .slice(0, 2)
      .join('');
    
    if (cleanName) {
      const domain = `${cleanName}.com`;
      setCompanyDomain(domain);

      try {
        // Try Clearbit Logo API first
        const clearbitUrl = `https://logo.clearbit.com/${domain}`;
        const response = await fetch(clearbitUrl);
        if (response.ok) {
          return clearbitUrl;
        }
      } catch (error) {
        // Ignore fetch errors and fall back to ui-avatars
      }
    }
    
    // Fall back to ui-avatars
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=000000&color=ffffff&size=128`;
  };

  const predict = useCallback((values: number[]) => {
    if (!values || values.length < 2) return { nextPrice: values[values.length - 1] ?? 0, projectionLine: [] };
    const last = values[values.length - 1];
    const pct: number[] = [];
    for (let i = 1; i < values.length; i++) {
      pct.push(((values[i] - values[i - 1]) / values[i - 1]) * 100);
    }
    const avg = pct.length ? pct.reduce((a, b) => a + b, 0) / pct.length : 0;
    const projection = [last];
    for (let i = 0; i < 5; i++) {
      projection.push(projection[i] * (1 + avg / 100));
    }
    return { nextPrice: projection[projection.length - 1], projectionLine: projection.slice(1) };
  }, []);

  const handleStockPrediction = useCallback(async (manualTicker?: string) => {
    try {
      setError(null);
      const tickerToUse = (manualTicker ?? ticker).toString().trim();
      const upper = tickerToUse.toUpperCase();
      setSuggestions([]);
      if (!upper) {
        setError('Please enter a stock ticker.');
        return;
      }
      // Attempt to resolve company name via symbolSearch so we can show title/logo/news
      try {
        const matches = await symbolSearch(upper);
        if (matches && matches.length > 0) {
          setCompanyName(matches[0].name || upper);
          void makeLogoFor(matches[0].name || upper).then(logo => {
            if (logo) setCompanyLogoUrl(logo);
          });
          // fetch news in background
          void fetchNews(matches[0].name || upper);
        } else {
          setCompanyName(upper);
            void makeLogoFor(upper).then(logo => {
              if (logo) setCompanyLogoUrl(logo);
            });
          void fetchNews(upper);
        }
      } catch (e) {
        setCompanyName(upper);
          void makeLogoFor(upper).then(logo => {
            if (logo) setCompanyLogoUrl(logo);
          });
        void fetchNews(upper);
      }
      const stockData = await fetchStockData(upper);
      if (!stockData || stockData.length === 0) {
        setError('Could not fetch stock data.');
        return;
      }
  // set numeric closes for charting
  setData(stockData.map(d => d.close));
  const p = improvedPredict(stockData);
  setResult({ nextPrice: p.nextPrice, currentPrice: stockData[stockData.length - 1].close, projectionLine: p.projectionLine, confidence: p.confidence });
    } catch (err: any) {
      setError(err.message || String(err));
    }
  }, [fetchStockData, predict, ticker]);

  const getChartData = (historicalData: number[] | null = data, projectionLine: number[] | null = result?.projectionLine || null) => {
    const empty = { labels: [''], datasets: [{ data: [0] }, { data: [0] }], legend: ['Historical', 'Projection'] };
    if (!historicalData) return empty;
    const historicalDataset = [...historicalData, ...Array(5).fill(null)];
    const projectionDataset = [...Array(historicalData.length).fill(null), historicalData[historicalData.length - 1], ...(projectionLine ?? []).slice(1)];
    return {
      labels: Array(historicalDataset.length).fill(''),
      datasets: [
        // Historical: use a neutral/white line
        {
          data: historicalDataset,
          strokeWidth: 2,
          color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
        },
        // Projection: make this green so it's visually distinct
        {
          data: projectionDataset,
          strokeWidth: 2,
          // A pleasant green (#22C55E) with adjustable opacity
          color: (opacity = 1) => `rgba(34,197,94,${opacity})`,
        },
      ],
      legend: ['Historical', 'Projection'],
    };
  };

  const onChangeText = (text: string) => {
    setTicker(text);
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
      searchTimeout.current = null;
    }
    if (!text) {
      setSuggestions([]);
      return;
    }
    // debounce
    searchTimeout.current = (setTimeout(async () => {
      const res = await symbolSearch(text);
      setSuggestions(res.slice(0, 6));
    }, 400) as unknown) as number;
  };

  const formatNumber = (n: number) => n.toFixed(2);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090E34" translucent />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          {/* decorative accents */}
          <View style={styles.accentTopRight} />
          <View style={styles.accentBottomLeft} />

          <Text style={styles.title}>Stock Predictor</Text>
          <Text style={styles.subtitle}>Data-driven short-term projections with backtested confidence</Text>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.input}
              value={ticker}
              onChangeText={onChangeText}
              placeholder="Enter stock ticker or company (e.g., AAPL or Apple)"
              placeholderTextColor="#666"
              autoCapitalize="characters"
            />

            {suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s.symbol}
                    style={styles.suggestionItem}
                    onPress={() => {
                      setTicker(s.symbol);
                      setSuggestions([]);
                      void handleStockPrediction(s.symbol);
                    }}
                  >
                    <Text style={styles.suggestionText}>{`${s.symbol} — ${s.name}`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={() => void handleStockPrediction()} activeOpacity={0.9}>
              <View style={styles.buttonInner}>
                <Text style={styles.buttonText}>Predict</Text>
              </View>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.resultContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : data && result ? (
            <View style={styles.resultContainer}>
              {/* Company header */}
              {companyLogoUrl && (
                <View style={styles.companyHeader}>
                  <Image source={{ uri: companyLogoUrl }} style={styles.companyLogo} />
                  <Text style={styles.companyTitle}>{companyName ?? ticker}</Text>
                </View>
              )}
              <Text style={styles.resultText}>Current Price: ${formatNumber(result.currentPrice)}</Text>
              <Text style={styles.resultText}>Predicted Price: ${formatNumber(result.nextPrice)}</Text>
              <Text style={styles.resultText}>
                {result.nextPrice > result.currentPrice ? '📈' : '📉'} Predicted Change: {formatNumber(((result.nextPrice - result.currentPrice) / result.currentPrice) * 100)}%
              </Text>

              {/* Model info card */}
              <View style={styles.modelCard}>
                <Text style={styles.modelTitle}>Model Confidence</Text>
                <Text
                  style={[
                    styles.modelConfidence,
                    { color: (result.confidence ?? 0) > 0.6 ? '#22C55E' : (result.confidence ?? 0) > 0.3 ? '#F59E0B' : '#FF6B6B' },
                  ]}
                >
                  {Math.round((result.confidence ?? 0) * 100)}%
                </Text>
                <Text style={styles.modelSubtitle}>Features used</Text>
                <View style={styles.featureList}>
                  <Text style={styles.featureItem}>• Recent daily return — last day % change</Text>
                  <Text style={styles.featureItem}>• SMA(5) / SMA(20) — short/medium moving averages</Text>
                  <Text style={styles.featureItem}>• EMA(12) / EMA(26) — exponential trends</Text>
                  <Text style={styles.featureItem}>• Volatility (std dev of returns)</Text>
                  <Text style={styles.featureItem}>• Momentum (price vs SMA20)</Text>
                </View>
              </View>

              <View style={styles.chartContainer}>
                <LineChart
                  data={getChartData()}
                  width={Platform.OS === 'web' ? 600 : 350}
                  height={220}
                  chartConfig={{
                    backgroundColor: '#071023',
                    backgroundGradientFrom: '#071023',
                    backgroundGradientTo: '#071023',
                    decimalPlaces: 2,
                    color: (opacity = 1) => `rgba(255,255,255,${0.9 * opacity})`,
                    labelColor: (opacity = 1) => `rgba(203,213,225,${0.8 * opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: { r: '3', strokeWidth: '0' },
                  }}
                  bezier
                  style={{ marginVertical: 8, borderRadius: 16 }}
                  onDataPointClick={({ value, x, y }: ChartPoint) => setTooltipData({ value, x, y, visible: true })}
                />

                {tooltipData.visible && (
                  <View style={[styles.tooltip, { left: tooltipData.x - 40, top: tooltipData.y - 40 }]}>
                    <Text style={styles.tooltipText}>${formatNumber(tooltipData.value)}</Text>
                  </View>
                )}
              </View>

              {/* News / Articles */}
              <View style={styles.newsContainer}>
                <Text style={styles.newsTitle}>Latest Articles</Text>
                {news.length === 0 ? (
                  <Text style={styles.newsEmpty}>{localNewsLoaded ? 'No local articles found.' : 'Loading articles...'}</Text>
                ) : (
                  news.slice(0, 6).map((a, i) => (
                    <TouchableOpacity key={`${a.title}-${i}`} onPress={() => { if (a.link) void (require('react-native').Linking.openURL(a.link)); }} style={styles.articleItem}>
                      <Text style={styles.articleTitle}>{a.title}</Text>
                      {a.link ? <Text style={styles.articleLink}>Open article</Text> : null}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          ) : null}
          <Text style={styles.footer}>Built with care — backtests are for informational use only.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // make the app theme darker and more modern
  safeArea: {
    flex: 1,
    backgroundColor: '#05060a', // near-black
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContent: { flexGrow: 1 },
  // container spacing and a subtle centered layout
  container: { flex: 1, padding: 22, alignItems: 'center', width: '100%' },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E6EEF8',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  searchContainer: { width: '100%', maxWidth: 400, alignItems: 'center' },
  // modern input
  input: {
    width: '100%',
    height: 52,
    backgroundColor: '#0f1724',
    borderRadius: 28,
    paddingHorizontal: 20,
    fontSize: 16,
    marginBottom: 14,
    color: '#E6EEF8',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  // button (outer) — subtle shadow and pill
  button: {
    marginTop: 6,
    borderRadius: 30,
    // subtle outer band to simulate gradient layering
    backgroundColor: '#0f3b2f',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  // buttonInner gives the bright green band and padding
  buttonInner: {
    paddingVertical: 14,
    paddingHorizontal: 42,
    borderRadius: 28,
    backgroundColor: '#16A34A', // bright green
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  // updated card appearance for results
  resultContainer: {
    marginTop: 24,
    padding: 20,
    backgroundColor: '#0b1220', // deep navy/black card
    borderRadius: 18,
    width: '100%',
    maxWidth: 720,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  resultText: { color: '#FFFFFF', fontSize: 18, marginBottom: 10, textAlign: 'center' },
  errorText: { color: '#FF6B6B', fontSize: 16, textAlign: 'center' },
  chartContainer: { marginTop: 20, alignItems: 'center', width: '100%' },
  tooltip: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, borderRadius: 5 },
  tooltipText: { color: '#FFF', fontSize: 14 },
  suggestionsContainer: { position: 'absolute', top: 60, width: '100%', backgroundColor: '#FFF', borderRadius: 10, zIndex: 1000 },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  suggestionText: { color: '#000', fontSize: 15 },
  // company header
  companyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  companyLogo: { width: 44, height: 44, borderRadius: 22, marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  companyTitle: { color: '#E6EEF8', fontSize: 18, fontWeight: '700' },
  // model card colors adjusted for dark theme
  modelCard: { marginTop: 12, width: '100%', padding: 14, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12 },
  modelTitle: { color: '#9FB0C8', fontSize: 12, fontWeight: '600' },
  modelConfidence: { color: '#22C55E', fontSize: 24, fontWeight: '700', marginTop: 6 },
  modelSubtitle: { color: '#CFE6FF', fontSize: 14, marginTop: 10, fontWeight: '600' },
  featureList: { marginTop: 8 },
  featureItem: { color: '#CFE6FF', fontSize: 12, marginTop: 6 },
  // accents (decorative circles)
  accentTopRight: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  accentBottomLeft: {
    position: 'absolute',
    left: -60,
    bottom: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(99,102,241,0.06)',
  },
  // news
  newsContainer: { marginTop: 18, width: '100%', paddingHorizontal: 6 },
  newsTitle: { color: '#CFE6FF', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  newsEmpty: { color: '#9FB0C8', fontSize: 13, marginBottom: 8 },
  articleItem: { paddingVertical: 12, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, marginBottom: 8 },
  articleTitle: { color: '#E6EEF8', fontSize: 14 },
  articleLink: { color: '#60A5FA', fontSize: 12, marginTop: 6 },
  // header subtitle and footer
  subtitle: { color: '#9FB0C8', fontSize: 14, marginBottom: 6 },
  footer: { marginTop: 28, color: '#8b98a8', fontSize: 12 },
});