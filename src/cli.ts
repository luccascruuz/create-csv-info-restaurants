import { Command, Option } from 'commander';
import { type Cache, noCache, openCache } from './cache.ts';
import { apiKeyFor, type CliOptions, type Config, resolveConfig } from './config.ts';
import { geocodeCity } from './geocode.ts';
import { createGenerator, isOllamaRunning, PRESETS, PROVIDERS, type ResolvedProvider } from './llm/index.ts';
import { exportRows, generateRows } from './pipeline.ts';
import { searchGoogle } from './sources/google.ts';
import { searchOsm } from './sources/osm.ts';
import type { Coordinates, Place } from './types.ts';

// Carrega o .env se existir (o .env é opcional: os padrões já funcionam sem custo)
try {
  process.loadEnvFile();
} catch {
  // sem .env: segue com variáveis de ambiente e padrões
}

const program = new Command()
  .name('restaurantes')
  .description('Busca restaurantes numa região e gera mensagens de prospecção personalizadas.')
  .option('-c, --cidade <nome>', 'cidade para buscar, ex.: "Lagarto, SE" (geocoding gratuito via OSM)')
  .option('--lat <latitude>', 'latitude do centro da busca (alternativa a --cidade)')
  .option('--lng <longitude>', 'longitude do centro da busca')
  .option('-r, --raio <metros>', 'raio de busca em metros (padrão 10000)')
  .option('-l, --limite <n>', 'máximo de estabelecimentos (padrão 20)')
  .addOption(new Option('-f, --fonte <fonte>', 'fonte dos dados (osm = grátis)').choices(['osm', 'google']))
  .option('--tipos <lista>', 'tipos do OSM separados por vírgula (padrão restaurant), ex.: restaurant,fast_food,cafe')
  .option('-q, --busca <termo>', 'termo de busca (só fonte google)')
  .addOption(new Option('--ia <provedor>', 'gerador das mensagens (auto = ollama se disponível, senão template)').choices(PROVIDERS))
  .option('-m, --modelo <nome>', 'modelo do provedor de IA')
  .option('--concorrencia <n>', 'gerações simultâneas')
  .addOption(new Option('--formato <formato>', 'formato de saída (padrão ambos)').choices(['csv', 'xlsx', 'ambos']))
  .option('-o, --saida <caminho>', 'arquivo de saída, sem extensão (padrão output/restaurantes)')
  .option('--sem-cache', 'ignora o cache e gera todas as mensagens de novo')
  .showHelpAfterError();

async function resolveProvider(requested: string, ollamaUrl: string): Promise<ResolvedProvider> {
  if (requested !== 'auto') return requested as ResolvedProvider;
  if (await isOllamaRunning(ollamaUrl)) return 'ollama';
  console.warn('⚠ Ollama não encontrado: usando mensagens por template (sem IA). Veja o README para ativar a IA grátis.');
  return 'template';
}

async function main() {
  const opts = program.parse().opts();
  const cli: CliOptions = {
    city: opts.cidade,
    latitude: opts.lat,
    longitude: opts.lng,
    radius: opts.raio,
    limit: opts.limite,
    source: opts.fonte,
    amenities: opts.tipos,
    query: opts.busca,
    provider: opts.ia,
    model: opts.modelo,
    concurrency: opts.concorrencia,
    format: opts.formato,
    output: opts.saida,
    cache: opts.semCache ? false : undefined,
  };
  const cfg = resolveConfig(cli);
  const cache = cfg.cache ? openCache(cfg.cacheFile) : noCache;
  try {
    await run(cfg, cache);
  } finally {
    cache.close();
  }
}

async function run(cfg: Config, cache: Cache) {
  // 1. Localização
  let center: Coordinates;
  if (cfg.city) {
    let geo = cache.getGeocode(cfg.city);
    if (!geo) {
      geo = await geocodeCity(cfg.city);
      cache.setGeocode(cfg.city, geo);
    }
    center = geo;
    console.log(`📍 ${geo.label}`);
  } else {
    center = { latitude: cfg.latitude as number, longitude: cfg.longitude as number };
    console.log(`📍 ${center.latitude}, ${center.longitude}`);
  }

  // 2. Estabelecimentos
  const search = { ...center, radius: cfg.radius, limit: cfg.limit, query: cfg.query };
  console.log(`🔎 Buscando em ${cfg.radius / 1000} km via ${cfg.source === 'osm' ? 'OpenStreetMap (grátis)' : 'Google Places (pago)'}...`);
  const places: Place[] =
    cfg.source === 'google' ? await searchGoogle(search, cfg.googleMapsApiKey as string) : await searchOsm(search, cfg.amenities);
  console.log(`   ${places.length} estabelecimentos encontrados.`);
  if (places.length === 0) {
    console.log('Nada para exportar. Tente aumentar o --raio ou incluir mais --tipos.');
    return;
  }

  // 3. Mensagens
  const provider = await resolveProvider(cfg.provider, cfg.ollamaUrl);
  const preset = PRESETS[provider];
  const generator = createGenerator({
    provider,
    model: cfg.model ?? (provider === 'ollama' ? cfg.ollamaModel : undefined) ?? preset.defaultModel,
    sender: { company: cfg.company, name: cfg.senderName, role: cfg.senderRole },
    apiKey: apiKeyFor(cfg, provider),
    ollamaUrl: cfg.ollamaUrl,
  });
  console.log(`✍️  Gerando mensagens com ${generator.id}${preset.free ? ' (grátis)' : ' (PAGO)'}...`);

  const result = await generateRows(places, generator, cache, cfg.concurrency ?? preset.concurrency);

  // 4. Exportação
  const files = await exportRows(result.rows, cfg.output, cfg.format);
  console.log(`\n✅ ${result.generated} geradas, ${result.cached} do cache, ${result.failed} com erro.`);
  for (const file of files) console.log(`   → ${file}`);
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
