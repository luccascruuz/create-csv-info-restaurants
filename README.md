# Prospecção de restaurantes → CSV / Excel

Busca restaurantes numa cidade e gera, para cada um, uma **mensagem de prospecção personalizada**
para uma agência de marketing digital (fictícia), exportando tudo para **CSV e Excel**.

**Por padrão não custa nada:** os dados vêm do OpenStreetMap e as mensagens são geradas por uma
IA local (Ollama) ou, se ela não estiver instalada, por templates. Google Places e OpenAI
continuam disponíveis como opções pagas.

## Início rápido

Requer **Node.js 22.18+** (roda TypeScript nativamente, sem build).

```bash
npm install
npm start -- --cidade "Lagarto, SE"
```

Arquivos gerados em `output/restaurantes.csv` e `output/restaurantes.xlsx`.

### Mensagens com IA grátis (recomendado)

Instale o [Ollama](https://ollama.com) e baixe um modelo (~3 GB, roda no seu computador):

```bash
brew install ollama        # ou o instalador do site
ollama serve &             # deixa o servidor rodando
ollama pull gemma3:4b
npm start -- --cidade "Lagarto, SE"   # detecta o Ollama sozinho
```

## Exemplos

```bash
# Raio de 5 km, 40 lugares, incluindo lanchonetes e cafés
npm start -- -c "Aracaju, SE" -r 5000 -l 40 --tipos restaurant,fast_food,cafe

# Por coordenadas, só Excel, assinando com seu nome
SENDER_NAME="Ana Souza" SENDER_ROLE="consultora" npm start -- --lat -10.9172 --lng -37.65 --formato xlsx

# Forçar um provedor de mensagens
npm start -- -c "Lagarto, SE" --ia template          # sem IA, offline
npm start -- -c "Lagarto, SE" --ia gemini            # camada gratuita, exige GEMINI_API_KEY
npm start -- -c "Lagarto, SE" --ia openai            # PAGO

# Ver todas as opções
npm start -- --help
```

As mensagens ficam em cache (`.cache/mensagens.db`): rodar de novo não gera nem cobra outra vez.
Use `--sem-cache` para gerar tudo do zero.

## Fontes e custos

| | Opção | Custo | Observação |
|---|---|---|---|
| Dados | `osm` (padrão) | Grátis | OpenStreetMap; tem menos telefones e não tem notas |
| | `google` | **Pago** | Google Places API (New); exige `GOOGLE_MAPS_API_KEY` |
| Mensagens | `template` | Grátis | Sem IA, determinístico |
| | `ollama` | Grátis | IA local, sem limite de uso |
| | `gemini` | Grátis* | *Camada gratuita com limite por minuto; os dados podem ser usados para treino |
| | `openai` | **Pago** | `gpt-5-mini` por padrão |

Todas as configurações podem ficar num `.env` (veja [.env.example](.env.example)).

## Colunas da planilha

`nome, tipo, endereco, telefone, site, instagram, avaliacao, qtd_avaliacao, distancia_m, link_mapa, canal_sugerido, assunto, mensagem`

## Desenvolvimento

```bash
npm test            # testes (vitest), sem rede
npm run typecheck   # TypeScript
npm run lint        # Biome (lint + formatação)
npm run check       # tudo acima (o mesmo que roda no CI)
```

```
src/
  cli.ts             # linha de comando (commander) e orquestração
  config.ts          # CLI + .env + padrões, validado com zod
  geocode.ts         # cidade → coordenadas (Nominatim/OSM)
  sources/osm.ts     # busca grátis (Overpass API)
  sources/google.ts  # busca paga (Google Places API New)
  llm/               # geradores de mensagem: template, ollama, gemini, openai
  cache.ts           # cache SQLite nativo do Node
  pipeline.ts        # geração com concorrência limitada (p-limit) + exportação
  export/            # CSV (RFC 4180 + BOM) e Excel (exceljs)
tests/               # vitest
```

## Uso responsável

Os dados do OpenStreetMap são © colaboradores do OSM (licença ODbL). Os servidores públicos do
Overpass e do Nominatim são gratuitos sob uso justo: evite rodar buscas grandes em sequência.
Se for enviar as mensagens de verdade, respeite a LGPD: identifique-se e ofereça uma forma de
a pessoa pedir para não receber mais contatos.
