# Requirements Document

## Introduction

Sparkline / mini-wykresy pod filmami — wizualizacja trendu wyświetleń w czasie. Funkcja przechowuje historię view count w localStorage (snapshot przy każdym odświeżeniu danych) i wyświetla mały wykres liniowy (sparkline) pod każdym filmem w VideoCard. Użytkownik widzi od razu, czy film rośnie, stagnuje, czy traci wyświetlenia.

## Glossary

- **Sparkline_Chart**: Mały wykres liniowy (bez osi, etykiet ani legendy) wyświetlany pod statystykami filmu, wizualizujący trend wyświetleń w czasie
- **View_History**: Tablica obiektów `{ timestamp, viewCount }` przechowywana w localStorage dla każdego filmu, reprezentująca historyczne snapshoty liczby wyświetleń
- **Snapshot**: Pojedynczy zapis aktualnej liczby wyświetleń filmu wraz z timestampem, tworzony przy każdym odświeżeniu danych kanału
- **VideoCard**: Komponent React wyświetlający kartę pojedynczego filmu z miniaturą, tytułem i statystykami
- **Trend_Indicator**: Wizualny wskaźnik (kolor linii sparkline) informujący czy film rośnie (zielony), stagnuje (szary) czy traci wyświetlenia (czerwony)
- **Data_Point**: Pojedynczy punkt na wykresie sparkline odpowiadający jednemu snapshotowi z View_History — para: timestamp odświeżenia (Unix ms) + liczba wyświetleń w tym momencie
- **History_Store**: Moduł odpowiedzialny za zapis, odczyt i zarządzanie View_History w localStorage

## Requirements

### Requirement 1: Zapis historii wyświetleń

**User Story:** Jako twórca treści, chcę aby dashboard zapisywał historię wyświetleń moich filmów przy każdym odświeżeniu, abym mógł śledzić trendy w czasie.

#### Acceptance Criteria

1. WHEN dane kanału zostają odświeżone (fetch zakończony sukcesem), THE History_Store SHALL zapisać Data_Point zawierający timestamp (Unix ms z Date.now()) oraz viewCount dla każdego filmu w odpowiedzi i dopisać go do View_History danego filmu
2. THE History_Store SHALL przechowywać View_History w localStorage pod kluczem `creator-dashboard-view-history-{videoId}`
3. WHEN Snapshot ma identyczny viewCount jak ostatni zapisany Data_Point dla danego filmu, THE History_Store SHALL pominąć zapis duplikatu
4. THE History_Store SHALL przechowywać maksymalnie 50 Data_Points na film (najstarsze usuwane przy przekroczeniu limitu)
5. IF localStorage jest pełny (QuotaExceededError), THEN THE History_Store SHALL usunąć najstarsze 25% Data_Points ze wszystkich filmów i ponowić zapis maksymalnie 3 razy, po czym jeśli zapis nadal się nie powiedzie, porzucić operację bez utraty istniejących danych
6. WHEN kanał zostaje usunięty przez użytkownika, THE History_Store SHALL odczytać listę videoId z ostatniego cache kanału (`creator-dashboard-data-{channelId}`) i usunąć View_History dla każdego z tych filmów

### Requirement 2: Wyświetlanie sparkline pod filmem

**User Story:** Jako twórca treści, chcę widzieć mini-wykres trendu wyświetleń pod każdym filmem, abym od razu wiedział czy film rośnie czy stagnuje.

#### Acceptance Criteria

1. WHEN View_History dla danego filmu zawiera 2 lub więcej Data_Points, THE Sparkline_Chart SHALL wyświetlić wykres liniowy pod sekcją statystyk w VideoCard, prezentując maksymalnie 30 najnowszych Data_Points
2. WHEN View_History zawiera dokładnie 1 Data_Point, THE Sparkline_Chart SHALL wyświetlić pojedynczą kropkę (okrąg o średnicy 4px) wycentrowaną w obszarze wykresu z etykietą tekstową "Za mało danych" wyświetloną obok kropki
3. WHEN View_History jest pusta (brak danych historycznych), THE VideoCard SHALL nie wyświetlać sekcji sparkline
4. THE Sparkline_Chart SHALL renderować się jako element SVG o szerokości 100% kontenera i stałej wysokości 32px
5. THE Sparkline_Chart SHALL wyświetlać linię o grubości 1.5px w kolorze akcentowym bez osi X, osi Y, etykiet ani legendy
6. WHEN wszystkie wartości w View_History są identyczne (min równe max), THE Sparkline_Chart SHALL wyświetlić poziomą linię wycentrowaną pionowo w obszarze wykresu
7. WHEN View_History zawiera różne wartości, THE Sparkline_Chart SHALL skalować oś Y automatycznie do zakresu min-max wartości w View_History z marginesem 10% powyżej i poniżej

### Requirement 3: Wskaźnik trendu (kolorystyka)

**User Story:** Jako twórca treści, chcę aby kolor wykresu informował mnie o kierunku trendu, abym mógł szybko ocenić kondycję filmu bez analizowania liczb.

#### Acceptance Criteria

1. WHEN ostatni Data_Point w serii ma viewCount wyższy o co najmniej 1% od pierwszego Data_Point w serii, THE Sparkline_Chart SHALL renderować linię w kolorze zielonym (#22C55E w light mode, #4ADE80 w dark mode)
2. WHEN ostatni Data_Point w serii ma viewCount niższy o co najmniej 1% od pierwszego Data_Point w serii, THE Sparkline_Chart SHALL renderować linię w kolorze czerwonym (#EF4444 w light mode, #F87171 w dark mode)
3. WHEN różnica procentowa viewCount między ostatnim a pierwszym Data_Point w serii wynosi mniej niż 1% wartości bezwzględnej, THE Sparkline_Chart SHALL renderować linię w kolorze szarym (#6B7280 w light mode, #9CA3AF w dark mode)
4. THE Sparkline_Chart SHALL stosować gradient fill pod linią z opacity 0.1 w tym samym kolorze co linia
5. IF seria zawiera mniej niż 2 Data_Points, THEN THE Sparkline_Chart SHALL renderować linię w kolorze szarym (#6B7280 w light mode, #9CA3AF w dark mode) bez wskazania trendu
6. WHEN procent zmiany jest obliczany, THE System SHALL stosować formułę: ((ostatni_viewCount - pierwszy_viewCount) / pierwszy_viewCount) * 100, gdzie "pierwszy" oznacza najstarszy Data_Point chronologicznie, a "ostatni" oznacza najnowszy Data_Point chronologicznie w ramach dostępnej serii pomiarów

### Requirement 4: Kompatybilność z design systemem

**User Story:** Jako użytkownik dashboardu, chcę aby sparkline wyglądał spójnie z resztą interfejsu, abym miał jednolite doświadczenie wizualne.

#### Acceptance Criteria

1. THE Sparkline_Chart SHALL stosować zaokrąglone rogi kontenera z wartością CSS variable `--radius-video` (14px)
2. THE Sparkline_Chart SHALL stosować kolory linii i tła wyłącznie z CSS variables design systemu, tak aby automatycznie dostosowywały się do aktywnego trybu (jasnego lub ciemnego) bez dodatkowej logiki
3. WHEN Sparkline_Chart jest renderowany po raz pierwszy, THE Sparkline_Chart SHALL animować rysowanie linii od lewej do prawej (stroke-dashoffset reveal) z czasem trwania 300ms i funkcją easingu ease-out
4. THE Sparkline_Chart SHALL mieć margines górny 8px od sekcji statystyk w VideoCard
5. WHILE tryb ciemny jest aktywny (klasa `html.dark`), THE Sparkline_Chart SHALL renderować linię i tło z kolorami odpowiadającymi wartościom dark mode zdefiniowanym w CSS variables (bez hardkodowanych wartości kolorów)

### Requirement 5: Obsługa obu platform (YouTube i TikTok)

**User Story:** Jako twórca treści publikujący na YouTube i TikTok, chcę widzieć sparkline dla filmów z obu platform, abym mógł porównywać trendy niezależnie od źródła.

#### Acceptance Criteria

1. THE History_Store SHALL zapisywać Snapshoty dla filmów YouTube identyfikowanych przez `videoId` z YouTube Data API
2. THE History_Store SHALL zapisywać Snapshoty dla filmów TikTok identyfikowanych przez `id` z TikTok Scraper API
3. THE Sparkline_Chart SHALL renderować się identycznie (ten sam rozmiar SVG, grubość linii, kolory trendu, animacja) niezależnie od platformy źródłowej filmu
4. WHEN film TikTok jest pobrany w trybie ręcznym (przez URL), THE History_Store SHALL zapisać Snapshot używając tego samego klucza localStorage (`creator-dashboard-view-history-{videoId}`) i formatu Data_Point co tryb automatyczny

### Requirement 6: Tooltip z detalami

**User Story:** Jako twórca treści, chcę móc najechać na sparkline i zobaczyć dokładne dane punktu, abym mógł sprawdzić konkretne wartości bez opuszczania widoku.

#### Acceptance Criteria

1. WHEN użytkownik najedzie kursorem na Sparkline_Chart, THE Sparkline_Chart SHALL wyświetlić tooltip z viewCount i datą Data_Point najbliższego pozycji kursora na osi X (snap do punktu o najmniejszej odległości poziomej od kursora)
2. WHILE użytkownik utrzymuje kursor nad Sparkline_Chart, THE Sparkline_Chart SHALL wyświetlić tooltip w formacie: "{viewCount sformatowany zgodnie z formatViewCount, np. 1,2K / 45,3K / 1,2M} — {data w formacie DD.MM.YYYY HH:mm}"
3. WHILE użytkownik utrzymuje kursor nad Sparkline_Chart, THE Sparkline_Chart SHALL wyświetlić pionową linię wskaźnika na pozycji kursora na osi X
4. WHEN użytkownik opuści obszar Sparkline_Chart, THE Sparkline_Chart SHALL ukryć tooltip i wskaźnik w ciągu 150ms
5. IF Sparkline_Chart nie zawiera żadnych Data_Point, THEN THE Sparkline_Chart SHALL nie wyświetlać tooltipa ani wskaźnika w odpowiedzi na najechanie kursorem
6. THE Sparkline_Chart SHALL pozycjonować tooltip tak, aby nie wychodził poza widoczny obszar wykresu — jeśli tooltip nie mieści się po prawej stronie kursora, SHALL wyświetlić go po lewej stronie
