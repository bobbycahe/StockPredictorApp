# Stock Predictor App

A small React Native app that fetches historical stock data and produces short-term projections using a lightweight ML model. This repo is prepared for demos and resume use.

Key points
- Uses Yahoo Finance endpoints (no API key) for symbol search and historical daily prices.
- Predictive model: lightweight in-app ridge regression and rule-based fallbacks.
- Includes basic unit tests and linting.

Quick start (development)

1. Install dependencies

```powershell
cd StockPreditorJawn
npm install
```

2. Run in an Android emulator

```powershell
npx react-native run-android
```

3. Generate an Android JS bundle (optional — useful for offline builds)

```powershell
npm run bundle-android
```

Tests & CI
- Lint: `npm run lint`
- Tests: `npm test`

Notes for reviewers
- This project intentionally uses the Yahoo Finance JSON endpoints to avoid free-tier API rate limits.
- Company logos are loaded via Clearbit Logo service with a generated avatar fallback.

Want changes? Create an issue or open a PR.Stock Predictor Pro (React Native App)

Description

Stock Predictor Pro is a mobile application built with React Native that fetches recent historical stock data and provides a simple 5-day price projection using linear regression. It displays the historical data and the projection on an interactive line chart.

This project was developed as a proof-of-concept and uses the Alpha Vantage API for fetching real-time stock data.

Features

Real-time Data: Fetches recent daily closing prices for a given stock ticker using the Alpha Vantage API.

Simple Prediction: Calculates a 5-day price projection based on linear regression of the fetched historical data.

Interactive Chart: Displays historical data and the projected trend on a line chart using react-native-chart-kit.

Tap for Details: Allows users to tap on data points on the chart to see the specific price via a tooltip.

Loading & Error States: Provides feedback to the user while data is being fetched or if an error occurs (e.g., invalid ticker, API issues).

Technology Stack

Framework: React Native

Charting: react-native-chart-kit

SVG Rendering (for chart): react-native-svg

Data Source: Alpha Vantage API (Free Tier)

Language: TypeScript

Setup & Running

Prerequisites:

Node.js and npm/yarn installed.

React Native development environment set up (including Android Studio for emulator or a physical device configured for debugging). Follow the official React Native Environment Setup guide.

An Android emulator created or a physical Android device connected.

Get Alpha Vantage API Key:

Sign up for a free API key at https://www.alphavantage.co/support/#api-key.

Clone/Download the Project: (Assuming you have the App.tsx file and project structure)

Ensure you have the project files, including package.json and the App.tsx file.

Install Dependencies:

Open your terminal/PowerShell in the project's root directory (StockPredictorApp).

Run: npm install (or yarn install)

Add API Key:

Open the App.tsx file.

Find the line: const ALPHA_VANTAGE_API_KEY = "YOUR_API_KEY";

Replace "YOUR_API_KEY" with the actual API key you obtained from Alpha Vantage.

Run the Metro Bundler:

In your terminal (in the project root), run: npx react-native start

Keep this terminal window open.

Run the App on Android:

Open another terminal window (in the project root).

Ensure your emulator is running or your device is connected and recognized (adb devices).

Run: npx react-native run-android

How to Use

Launch the app on your emulator or device.

Enter a valid stock ticker symbol (e.g., AAPL, MSFT, NVDA) into the input field.

Tap the "Predict Price" button.

The app will fetch the latest data, calculate the projection, and display the results along with the chart.

Tap on data points (dots) on the chart to view the exact price for that point.

Limitations

Prediction Model: Uses a very basic linear regression model. This is NOT financial advice and should not be used for making investment decisions. Real stock prediction is far more complex.

API Limits: Relies on the Alpha Vantage free tier, which has daily request limits (currently 25 requests per day). Exceeding the limit will result in errors until the next day.

Data Accuracy: Data is provided by Alpha Vantage; accuracy depends on their service.

Limited Data: Fetches only the 'compact' (last ~100 points) daily data and uses ~30 points for the chart/prediction. More sophisticated models would use much more data.

API Key in Code: For simplicity, the API key is stored directly in the source code. This is insecure and not recommended for production applications. A backend service should typically handle API key management.

Disclaimer

This application is for educational and demonstration purposes only. The stock predictions generated are based on a simplistic model and should NOT be considered financial advice. Do not base any investment decisions on the output of this application.

This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

---
# Stock Predictor App

[![CI](https://github.com/bobbycahe/StockPredictorApp/actions/workflows/ci.yml/badge.svg)](https://github.com/bobbycahe/StockPredictorApp/actions)

A compact React Native demo app that fetches historical daily stock prices and produces short-term projections. The app is intended for demos and resume use: it runs locally, does not require an API key, and is easy to build.

## Quick highlights

- Data source: Yahoo Finance JSON endpoints (no API key, no per-key/free-tier rate limits).
- Prediction: in-app ridge-regression model with sensible fallbacks for short histories.
- Logos: Clearbit Logo service with an avatar fallback.
- Tooling: ESLint + Jest and a small GitHub Actions workflow for CI.

## Screenshot

Add a screenshot at `assets/demo-screenshot.png` and it will display here.

![demo](assets/demo-screenshot.png)

## Quick start (development)

1. Install dependencies

```powershell
cd StockPreditorJawn
npm install
```

2. Run on Android emulator / device

```powershell
npx react-native run-android
```

3. Optional: produce an Android JS bundle for offline APK builds

```powershell
npm run bundle-android
```

## Useful scripts

- `npm run android` — build & run on Android
- `npm run ios` — build & run on iOS (macOS only)
- `npm run bundle-android` — generate the JS bundle under `android/app/src/main/assets`
- `npm run lint` — run ESLint
- `npm test` — run Jest tests

## Notes about data & logos

- Stock data: fetched from the Yahoo Finance `chart` API. No key required.
- Logos: `makeLogoFor` attempts to guess a domain from the company name and fetch `https://logo.clearbit.com/<domain>`. If that fails, the app falls back to `ui-avatars.com`.

## CI

A minimal GitHub Actions workflow runs linting and tests on pushes and PRs to `main` (`.github/workflows/ci.yml`).

## License

MIT — see `LICENSE`.

---

If you want, I can add a short demo GIF, CI badge to the README header, or a polished one-paragraph description for your resume.
