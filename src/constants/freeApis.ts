export type FreeApiCategory =
  | 'All'
  | 'Mock Data'
  | 'IP & Utilities'
  | 'Live Data & Weather'
  | 'Crypto & Finance'
  | 'Fun & Trivia'
  | 'AI & LLM';

export interface FreeApiPreset {
  id: string;
  name: string;
  category: Exclude<FreeApiCategory, 'All'>;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: { id?: string; key: string; value: string; enabled: boolean }[];
  body?: { type: 'json' | 'none'; rawJson?: string };
  extractPath?: string;
  responseFormat?: 'auto' | 'json' | 'markdown' | 'text';
  badge?: string;
}

export const FREE_API_CATEGORIES: FreeApiCategory[] = [
  'All',
  'Mock Data',
  'IP & Utilities',
  'Live Data & Weather',
  'Crypto & Finance',
  'Fun & Trivia',
  'AI & LLM',
];

export const FREE_API_PRESETS: FreeApiPreset[] = [
  // --- IP & UTILITIES ---
  {
    id: 'ipify-json',
    name: 'IPify Public IP',
    category: 'IP & Utilities',
    description: 'Returns your current public IP address in clean JSON format.',
    method: 'GET',
    url: 'https://api.ipify.org?format=json',
    extractPath: 'ip',
    badge: 'IP',
  },
  {
    id: 'ipwhois-geo',
    name: 'IP Geolocation (ipwho.is)',
    category: 'IP & Utilities',
    description: 'Detailed geolocation for client IP: city, country, postal, timezone, ISP & coordinates.',
    method: 'GET',
    url: 'https://ipwho.is/',
    badge: 'Geo IP',
  },
  {
    id: 'httpbin-get',
    name: 'HTTPBin Request Inspector',
    category: 'IP & Utilities',
    description: 'Inspects and echoes client IP, request headers, user agent and query args.',
    method: 'GET',
    url: 'https://httpbin.org/get',
    badge: 'Echo',
  },
  {
    id: 'httpbin-post-echo',
    name: 'HTTPBin POST Echo',
    category: 'IP & Utilities',
    description: 'Echoes back arbitrary JSON payload, query parameters and request headers.',
    method: 'POST',
    url: 'https://httpbin.org/post',
    headers: [
      { id: 'hb1', key: 'Content-Type', value: 'application/json', enabled: true },
    ],
    body: {
      type: 'json',
      rawJson: JSON.stringify(
        {
          source: 'Visualizer API Node',
          timestamp: Date.now(),
          status: 'online',
        },
        null,
        2
      ),
    },
    badge: 'POST Echo',
  },

  // --- MOCK DATA ---
  {
    id: 'jsonplaceholder-todo',
    name: 'JSONPlaceholder Todos',
    category: 'Mock Data',
    description: 'Single sample task item with ID, title, and completed status.',
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/todos/1',
    badge: 'Popular',
  },
  {
    id: 'jsonplaceholder-posts',
    name: 'JSONPlaceholder 100 Posts',
    category: 'Mock Data',
    description: 'Array of 100 mock blog posts with author IDs, titles, and body text.',
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/posts',
    badge: 'Array',
  },
  {
    id: 'jsonplaceholder-create-post',
    name: 'JSONPlaceholder Create Post',
    category: 'Mock Data',
    description: 'Simulate creating a new blog post via POST with JSON payload (returns 201).',
    method: 'POST',
    url: 'https://jsonplaceholder.typicode.com/posts',
    headers: [
      { id: 'h1', key: 'Content-Type', value: 'application/json; charset=UTF-8', enabled: true },
    ],
    body: {
      type: 'json',
      rawJson: JSON.stringify(
        {
          title: 'Testing Free API Node',
          body: 'Hello from Visualizer! This is a test POST request.',
          userId: 1,
        },
        null,
        2
      ),
    },
    badge: 'POST Demo',
  },
  {
    id: 'dummyjson-product',
    name: 'DummyJSON Product',
    category: 'Mock Data',
    description: 'E-commerce product with brand, rating, dimensions, reviews & images.',
    method: 'GET',
    url: 'https://dummyjson.com/products/1',
    badge: 'E-Commerce',
  },
  {
    id: 'dummyjson-user',
    name: 'DummyJSON User Profile',
    category: 'Mock Data',
    description: 'Realistic user profile record with contact, address, avatar, and crypto wallet.',
    method: 'GET',
    url: 'https://dummyjson.com/users/1',
    badge: 'Profile',
  },
  {
    id: 'dummyjson-recipe',
    name: 'DummyJSON Recipe',
    category: 'Mock Data',
    description: 'Culinary recipe with prep time, ingredients list, instructions, and nutrition tags.',
    method: 'GET',
    url: 'https://dummyjson.com/recipes/1',
  },
  {
    id: 'reqres-users',
    name: 'ReqRes Users List',
    category: 'Mock Data',
    description: 'Paginated user directory with avatar images, names, and email addresses.',
    method: 'GET',
    url: 'https://reqres.in/api/users?page=1',
  },
  {
    id: 'randomuser-profile',
    name: 'RandomUser.me Identity',
    category: 'Mock Data',
    description: 'Random realistic citizen identity with picture, location coordinates, and login info.',
    method: 'GET',
    url: 'https://randomuser.me/api/',
    badge: 'Random',
  },
  {
    id: 'github-user',
    name: 'GitHub User (Octocat)',
    category: 'Mock Data',
    description: 'Public GitHub developer profile details, repo counts, followers, and avatar.',
    method: 'GET',
    url: 'https://api.github.com/users/octocat',
    headers: [
      { id: 'gh1', key: 'User-Agent', value: 'Visualizer', enabled: true },
    ],
    badge: 'GitHub',
  },

  // --- LIVE DATA & WEATHER ---
  {
    id: 'open-meteo-weather',
    name: 'Open-Meteo Live Weather',
    category: 'Live Data & Weather',
    description: 'Real-time temperature, wind speed, elevation, and weather status (No key required).',
    method: 'GET',
    url: 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true',
    badge: 'Live',
  },

  // --- CRYPTO & FINANCE ---
  {
    id: 'coinbase-exchange-rates',
    name: 'Coinbase Exchange Rates',
    category: 'Crypto & Finance',
    description: 'Real-time USD exchange rates against world fiat currencies and top cryptocurrencies.',
    method: 'GET',
    url: 'https://api.coinbase.com/v2/exchange-rates?currency=USD',
    badge: 'Finance',
  },
  {
    id: 'coingecko-crypto-prices',
    name: 'CoinGecko Crypto Price',
    category: 'Crypto & Finance',
    description: 'Live Bitcoin and Ethereum USD market prices with 24-hour price change %.',
    method: 'GET',
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
    badge: 'BTC & ETH',
  },

  // --- FUN & TRIVIA ---
  {
    id: 'pokeapi-ditto',
    name: 'PokéAPI (Ditto)',
    category: 'Fun & Trivia',
    description: 'Comprehensive Pokémon data including sprites, base stats, types, and moves.',
    method: 'GET',
    url: 'https://pokeapi.co/api/v2/pokemon/ditto',
    badge: 'Pokémon',
  },
  {
    id: 'official-joke',
    name: 'Official Joke API',
    category: 'Fun & Trivia',
    description: 'Random clean joke with setup and punchline.',
    method: 'GET',
    url: 'https://official-joke-api.appspot.com/random_joke',
    badge: 'Humor',
  },
  {
    id: 'catfact-ninja',
    name: 'Cat Facts Trivia',
    category: 'Fun & Trivia',
    description: 'Random cat trivia fact with character length information.',
    method: 'GET',
    url: 'https://catfact.ninja/fact',
    extractPath: 'fact',
    badge: 'Trivia',
  },
  {
    id: 'dummyjson-quotes',
    name: 'DummyJSON Quotes',
    category: 'Fun & Trivia',
    description: 'Random inspirational quote with author information.',
    method: 'GET',
    url: 'https://dummyjson.com/quotes/random',
    extractPath: 'quote',
    badge: 'Quote',
  },

  // --- AI & LOCAL LLM ---
  {
    id: 'ollama-chat',
    name: 'Ollama Local AI (Chat)',
    category: 'AI & LLM',
    description: 'Run local LLM prompt via Ollama API (requires Ollama running on localhost:11434).',
    method: 'POST',
    url: 'http://localhost:11434/api/chat',
    headers: [
      { id: 'ol1', key: 'Content-Type', value: 'application/json', enabled: true },
    ],
    body: {
      type: 'json',
      rawJson: JSON.stringify(
        {
          model: 'llama3.2',
          messages: [
            {
              role: 'user',
              content: 'Explain why the sky is blue in 2 short sentences.',
            },
          ],
          stream: false,
        },
        null,
        2
      ),
    },
    extractPath: 'message.content',
    responseFormat: 'markdown',
    badge: 'Local AI',
  },
];
