# Creator Stats Dashboard — Podsumowanie Projektu

## Cel projektu
Osobisty dashboard do śledzenia wyświetleń 3 ostatnich filmów z wielu kanałów YouTube i TikTok.

## Tech Stack
- **Frontend:** React 19 (Vite 8) + JavaScript
- **Stylizacja:** Tailwind CSS v4 (CSS custom properties, dark mode via `html.dark` class)
- **Ikony:** Lucide React
- **HTTP:** axios
- **Dane:** localStorage (kanały, cache, klucze API, preferencje motywu)
- **API:** YouTube Data API v3, RapidAPI "Tiktok Scraper" (tiktok-scraper7.p.rapidapi.com)

## Design System
- Light/Dark mode (przełącznik Sun/Moon/Monitor w headerze)
- Kolory akcentowe: niebieski (#3B82F6) → indigo (#6366F1)
- Zaokrąglone rogi 20px, glassmorphism-lite, subtelne cienie
- Responsywny layout (mobile-first)
- Polski język w UI

## Zrealizowane funkcjonalności (Status: ✅)

### 1. Integracja YouTube
- Pełna obsługa YouTube Data API v3
- Rozwiązywanie handle (@nazwa) i linków URL na Channel ID
- Pobieranie 3 ostatnich filmów z miniaturami i statystykami
- Pobieranie statystyk kanału (subscriberCount, viewCount) — dodane `part=statistics` do channels request
- Mapowanie likeCount i commentCount z videos/statistics
- Brak limitu odświeżania (można odświeżać dowolnie często)

### 2. Integracja TikTok
- API: RapidAPI "Tiktok Scraper" (tiktok-scraper7.p.rapidapi.com)
- Endpoint: GET /user/posts?unique_id=USERNAME&count=3&cursor=0
- Darmowy plan: 300 req/miesiąc bez karty płatniczej
- Tryb automatyczny (username) + tryb ręczny (wklejanie do 3 URL-ów filmów)
- Rate limit: max 1 odświeżenie TikToka na 60 minut (persystowany w localStorage)
- Mapowanie digg_count → likeCount, comment_count → commentCount
- Pobieranie statystyk kanału (follower_count, heart_count) z pola author lub fallback do /user/info

### 3. Panel Ustawień (klucze API)
- Modal dostępny przez ikonę ⚙️ w headerze
- Dwa pola: YouTube API Key + TikTok RapidAPI Key
- Maskowanie kluczy (Eye/EyeOff toggle)
- Walidacja kluczy przed zapisem (testowe zapytanie do API)
- Instrukcje krok po kroku pod każdym polem
- Klucze w localStorage mają priorytet nad .env (Key Resolution Service)
- Partial save: jeśli jeden klucz jest OK a drugi nie — zapisuje ten poprawny

### 4. Licznik API TikTok
- Badge "API TikTok: X / 300" w headerze
- Odczyt nagłówków x-ratelimit-requests-remaining z odpowiedzi RapidAPI
- Fallback: lokalna dekrementacja gdy nagłówki niedostępne
- Miesięczny reset (automatyczny)
- Trzy stany wizualne: neutralny (>50), ostrzegawczy (11-50), krytyczny (≤10)

### 5. Dark Mode
- Trzy tryby: Light / Dark / System (podąża za OS)
- Przełącznik w headerze (Sun/Moon/Monitor)
- CSS variables pod `html.dark` — zero zmian w komponentach
- Blocking inline script w index.html (brak flashu przy ładowaniu)
- Preferencja persystowana w localStorage
- React Context + useTheme hook
- Płynna tranzycja 200ms

### 6. Ręczne odświeżanie z rate limitem
- Usunięty auto-refresh timer (brak automatycznego odświeżania)
- Przycisk 🔄 do ręcznego odświeżenia
- YouTube: odświeża się zawsze
- TikTok: max raz na 60 min (cooldown persystowany w localStorage, przetrwa reload)
- Wyświetlanie "Ostatnio: X min temu" zamiast odliczania
- Info "TikTok: odśwież za X min" gdy cooldown aktywny

### 7. Zarządzanie kanałami
- Dodawanie/edycja/usuwanie kanałów przez boczny panel (ChannelManager)
- Obsługa: username, @handle, pełne URL-e (YouTube i TikTok)
- TikTok: przełącznik "Automatyczne" / "Ręczne" (3 pola na URL-e)
- Dane kanałów w localStorage
- Przy usunięciu kanału — automatyczne czyszczenie historii wyświetleń (view history)

### 8. Sparkline — wykresy trendu wyświetleń
- Pure SVG (bez biblioteki chartingowej) — 0 KB dodatkowych zależności
- Wykres liniowy pod każdym filmem (100% × 32px)
- Kolorowy wskaźnik trendu: zielony (wzrost ≥1%), czerwony (spadek ≥1%), szary (stagnacja)
- Gradient fill pod linią (opacity 0.1)
- Animacja rysowania linii (stroke-dashoffset, 300ms ease-out)
- Tooltip pod wykresem przy hoverze (viewCount + data DD.MM.YYYY HH:mm)
- Legenda kolorów nad filmami (wzrost / stabilnie / spadek)
- Przełącznik zakresu czasowego: 1h / 12h / 24h / Wszystko
- Komunikat "Zbieranie danych trendu…" gdy brak wystarczających danych
- Snapshoty zapisywane przy każdym odświeżeniu (max 50 na film)
- Usunięty seed point — pierwszy zapis to prawdziwy odczyt z API (nie viewCount=0)
- Cleanup seed pointów przy starcie aplikacji (automatyczne usuwanie viewCount=0 z localStorage)
- Procent zmiany liczony między najstarszym a najnowszym snapshotem w wybranym zakresie
- Badge procentowy obok sparkline (+12,3% / -3,1% / 0%) w kolorze trendu
- Obsługa QuotaExceededError (prune 25% najstarszych punktów, retry max 3×)

### 9. Statystyki kanału i metryki filmów
- Statystyki kanału w nagłówku ChannelCard:
  - YouTube: subskrybenci + łączne wyświetlenia
  - TikTok: obserwujący + polubienia
  - Ikony Users + Eye, formatowanie formatViewCount
  - Graceful degradation (brak sekcji gdy dane niedostępne)
- Polubienia i komentarze na kartach filmów:
  - Ikony ThumbsUp + MessageCircle
  - Formatowanie formatViewCount, fallback do "0" gdy null
- Badge procentowej zmiany:
  - Format polski (przecinek jako separator dziesiętny): "+12,3%", "-3,1%", "0%"
  - Kolory: zielony (≥1%), czerwony (≤-1%), szary (neutralny)
  - Wyświetlany tylko gdy ≥2 snapshoty w wybranym zakresie czasowym

## Architektura plików

```
src/
├── App.jsx                    — główny komponent, stan aplikacji
├── main.jsx                   — entry point, ThemeProvider, cleanupSeedPoints
├── index.css                  — CSS variables (light + dark), globalne style, animacje sparkline
├── components/
│   ├── Header.jsx             — nagłówek z akcjami
│   ├── Layout.jsx             — wrapper layoutu
│   ├── ChannelCard.jsx        — karta kanału z filmami + statystyki kanału + przełącznik zakresu
│   ├── ChannelManager.jsx     — modal dodawania/edycji kanałów
│   ├── VideoCard.jsx          — karta filmu (views, likes, comments, sparkline, badge %)
│   ├── SparklineChart.jsx     — pure SVG sparkline z tooltipem i animacją
│   ├── RefreshStatus.jsx      — "Ostatnio: X min temu" + przycisk refresh
│   ├── ApiUsageCounter.jsx    — badge "API TikTok: X / 300"
│   ├── ThemeToggle.jsx        — przełącznik motywu
│   ├── SettingsPanel.jsx      — modal ustawień kluczy API
│   ├── EmptyState.jsx         — widok gdy brak kanałów
│   ├── ErrorBanner.jsx        — banner błędów
│   └── LoadingSkeleton.jsx    — skeleton loading
├── hooks/
│   ├── useChannelData.js      — fetch danych kanału + channelStats + rate limit TikTok
│   ├── useChannels.js         — CRUD kanałów (localStorage) + cleanup view history
│   ├── useViewHistory.js      — ładowanie historii wyświetleń + trend
│   └── useApiUsage.js         — reaktywny stan licznika API
├── context/
│   └── ThemeContext.jsx       — React Context dla dark mode
├── test/
│   └── setup.js               — @testing-library/jest-dom setup
└── utils/
    ├── youtube.js             — YouTube Data API v3 client (videos + channel stats)
    ├── tiktok.js              — TikTok RapidAPI client (videos + channel stats)
    ├── viewHistory.js         — History Store (snapshoty w localStorage, max 50/film)
    ├── trendCalculator.js     — obliczanie trendu (up/down/neutral, % change)
    ├── apiKeys.js             — Key Resolution Service (localStorage > .env)
    ├── apiTracker.js          — śledzenie zużycia API TikTok
    ├── rateLimiter.js         — TikTok 60-min cooldown
    ├── storage.js             — localStorage helpers
    └── formatters.js          — formatowanie liczb, dat, czasu, procentów
```

## Klucze API (localStorage)
- `creator-dashboard-youtube-api-key` — klucz YouTube
- `creator-dashboard-tiktok-api-key` — klucz TikTok RapidAPI
- `creator-dashboard-tiktok-api-usage` — dane o zużyciu API (remaining, limit, month, year)
- `creator-dashboard-tiktok-last-refresh` — timestamp ostatniego fetcha TikTok
- `creator-dashboard-last-refresh` — timestamp ostatniego odświeżenia ogólnego
- `creator-dashboard-theme` — preferencja motywu (light/dark/system)
- `creator-dashboard-channels` — lista kanałów
- `creator-dashboard-data-{channelId}` — cache danych kanału (videos + channelStats)
- `creator-dashboard-view-history-{videoId}` — historia wyświetleń filmu (max 50 snapshotów)

## Testy
- **Framework:** Vitest + fast-check + @testing-library/react
- **Pokrycie:** 83+ testów (formatters, trendCalculator, viewHistory, SparklineChart)
- **Uruchomienie:** `npm test`

## Deployment
- **Repozytorium:** https://github.com/ReformedPepe/creator-dashboard
- **Hosting:** Render.com (połączone z GitHub)

## Co dalej (następne kroki)
1. **Backend (Node.js + Express + SQLite + node-cron)** — serwer w folderze `/server` zbierający snapshoty co godzinę w tle, niezależnie od tego czy użytkownik ma otwartą aplikację
2. Porównanie kanałów — podsumowanie na górze (łączne views, najlepszy film)
3. Sortowanie i filtrowanie filmów
4. Powiadomienia o milestones (10k, 100k, 1M)
5. Eksport danych (CSV/JSON)
6. Widok "Best of" — ranking filmów ze wszystkich kanałów
