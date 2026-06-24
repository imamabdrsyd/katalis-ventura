# Project Agent Personas — AXION Agent System

> Terakhir diupdate: 17 Juni 2026

Dokumentasi sistem multi-persona sub-agent AXION. Semua persona beroperasi di atas infrastruktur AI provider yang sama (`src/lib/ai/provider.ts`), tapi masing-masing punya system prompt, mesin, dan tab UI yang berbeda.

---

## Arsitektur Overview

```
┌─────────────────────────────────────────────────────────┐
│                    AIChatPanel (FAB)                     │
│                                                         │
│   ┌─── Tab Entry (Catat) ───┐  ┌─── Tab Ask (Tanya) ──┐│
│   │  Persona: Bianca        │  │  Persona: Stanley     ││
│   │  Mesin: Parser transaksi │  │    atau Sri Mulyani   ││
│   │  Route: /api/ai/         │  │  Mesin: Agent Vertex  ││
│   │    parse-transaction     │  │  Route: /api/ai/      ││
│   │                          │  │    agent-query        ││
│   │  Fallback (Vertex aktif):│  │    (tool-calling,     ││
│   │    Bianca chat LLM       │  │     SSE streaming)    ││
│   └──────────────────────────┘  └───────────────────────┘│
│                                                         │
│   ┌─── Provider Selector ──────────────────────────────┐│
│   │  AXION Auto (Gemini→Groq) │ Gemini Vertex │ Claude ││
│   └────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              Concierge-Pro (Customer-Facing)             │
│   Persona: Adaptif per sektor bisnis                    │
│   Mesin: Vertex AI (Gemini 3.5 Flash)                   │
│   Route: /api/leads/ai/reply                            │
│   3 sub-persona: consultative_sales, hospitality,       │
│                  service_booking                         │
└─────────────────────────────────────────────────────────┘
```

---

## Persona Owner-Facing (AIChatPanel)

### 1. Bianca — Spesialis Pembukuan

| Atribut | Detail |
|---------|--------|
| **Tab** | Entry (Catat) |
| **Identitas** | Bianca, asisten pembukuan ramah |
| **Mesin** | Parser transaksi (`extractTransactionFromText`) — bukan agent |
| **Route** | `POST /api/ai/parse-transaction` |
| **Provider chain** | Vertex (jika dipilih) → Gemini AI Studio → Groq → regex rule-based |
| **System prompt** | `PARSE_SYSTEM_PROMPT` (input → JSON terstruktur) |
| **Fallback chat** | `BIANCA_CHAT_PROMPT` — aktif saat Vertex dipilih + input bukan transaksi |

**Perilaku:**
- User mengetik transaksi natural language (mis. "bayar listrik 500rb")
- Parser mengekstrak `name`, `amount`, `date`, `category_hint` → resolve ke akun debit/kredit
- Kalau nominal belum disebut → Bianca tanya "Berapa nominalnya?"
- Kalau input bukan transaksi DAN Vertex aktif → Bianca merespons komunikatif via LLM
- Kalau input bukan transaksi DAN AXION Auto → error statis (hemat kuota gratis)

**Desain keputusan:**
- Bianca **bukan** agent (tidak punya tool-calling). Parser transaksi cukup ringan dan tidak butuh reasoning/tools.
- Persona Bianca di tab Entry murni **labeling header/greeting** — mesinnya tetap parser transaksi existing.
- Conversational fallback (via `BIANCA_CHAT_PROMPT`) hanya diaktifkan saat Vertex dipilih, karena model gratis punya kuota ketat.

**File terkait:**
- `src/lib/ai/prompts.ts` — `PARSE_SYSTEM_PROMPT`, `BIANCA_CHAT_PROMPT`
- `src/lib/ai/parseTransaction.ts` — `extractTransactionFromText()`
- `app/api/ai/parse-transaction/route.ts`

---

### 2. Stanley — Analis Keuangan & FP&A

| Atribut | Detail |
|---------|--------|
| **Tab** | Ask (Tanya) — **default persona** |
| **Identitas** | Stanley, analis keuangan |
| **Mesin** | Agent Vertex (tool-calling + SSE streaming) |
| **Route** | `POST /api/ai/agent-query` |
| **Provider** | Gemini 3.5 Flash via Vertex AI |
| **System prompt** | `buildAgentSystemPrompt('analis_fpna')` |

**Perilaku:**
- Mengubah data jadi insight strategis: tren, margin, burn rate, perbandingan periode
- Punya akses 8 tools: `query_transactions`, `get_financial_summary`, `get_contacts`, `get_business_info`, `navigate_to`, `search_knowledge_base` (RAG dok upload), `run_olap_analytics` (agregasi GROUP BY ke replika OLAP GCP), `recall_memory` (semantic recall memori lampau: Vault + ringkasan sesi, dari GCP `agent_memories`)
- Selalu sertakan angka spesifik dari data — tidak mengarang
- Akhiri dengan 1 insight utama + maks 1 rekomendasi actionable

**Contoh pertanyaan:**
- "Kenapa bulan ini rugi?"
- "Kategori beban terbesar apa?"
- "Bagaimana tren revenue 3 bulan terakhir?"
- "Berapa burn rate saat ini?"

**File terkait:**
- `src/lib/ai/financialPersonas.ts` — overlay persona `analis_fpna`
- `app/api/ai/agent-query/route.ts`
- `src/lib/ai/agentTools.ts` — definisi & eksekusi 8 tools
- `src/lib/ai/semanticMemory.ts` — ingestion (Vault + ringkasan sesi) & vector recall ke GCP `agent_memories`

---

### 3. Sri Mulyani — Penasihat Pajak UKM

| Atribut | Detail |
|---------|--------|
| **Tab** | Ask (Tanya) — pilihan dropdown |
| **Identitas** | Sri Mulyani, penasihat pajak |
| **Mesin** | Agent Vertex (sama dengan Stanley) |
| **Route** | `POST /api/ai/agent-query` |
| **Provider** | Gemini 3.5 Flash via Vertex AI |
| **System prompt** | `buildAgentSystemPrompt('pajak')` |

**Perilaku:**
- Membantu estimasi kewajiban pajak UKM Indonesia
- PPh Final UMKM (0,5% omzet), PPN, PPh 21/23, kalender kewajiban
- **WAJIB** beri disclaimer: estimasi indikatif, bukan nasihat hukum/pajak resmi
- Hati-hati SETTLE vs EARN — jangan double-count omzet

**Contoh pertanyaan:**
- "Berapa estimasi PPh final saya bulan ini?"
- "Apa saja kewajiban pajak bisnis saya?"
- "Bagaimana cara hitung PPh final UMKM 0,5%?"

**File terkait:**
- `src/lib/ai/financialPersonas.ts` — overlay persona `pajak`

---

### 4. AXION Agent (Generalis)

| Atribut | Detail |
|---------|--------|
| **Tab** | Ask (Tanya) — fallback saat persona null |
| **Mesin** | SSE streaming (Gemini / Groq, tanpa tool-calling) |
| **Route** | `POST /api/ai/chat` |
| **Provider chain** | Gemini AI Studio → Groq (mode AXION Auto) |
| **System prompt** | `CHAT_SYSTEM_PROMPT` |

**Perilaku:**
- Dipakai saat provider = AXION Auto (chain gratis)
- Tidak ada tool-calling — hanya menjawab dari konteks keuangan yang di-inject
- Konteks disiapkan dari 6 bulan laba rugi per bulan + snapshot neraca

**File terkait:**
- `src/lib/ai/prompts.ts` — `CHAT_SYSTEM_PROMPT`
- `app/api/ai/chat/route.ts`

---

## Persona Customer-Facing (Concierge-Pro)

### Concierge — Adaptif per Sektor Bisnis

| Atribut | Detail |
|---------|--------|
| **Konteks** | Lead Management / Instagram DM automation |
| **Mesin** | Vertex AI (Gemini 3.5 Flash) |
| **Route** | `POST /api/leads/ai/reply` |
| **Pemilihan persona** | Deterministik berdasar `business_sector` |

**3 Sub-Persona:**

| Persona | Sektor Bisnis | Gaya |
|---------|---------------|------|
| `consultative_sales` | food_and_beverage, agribusiness, personal_care | Penjual konsultatif — gali kebutuhan → rekomendasi produk |
| `hospitality` | accommodation, short_term_rental | Concierge penginapan — reservasi, fasilitas, check-in |
| `service_booking` | real_estate, property_management, creative_agency | Asisten booking layanan — jadwal, scope, pemesanan |

**Perbedaan vs Owner-Facing:**
- **Target audience**: calon pelanggan (bukan pemilik bisnis)
- **Data yang diakses**: katalog produk/layanan, business knowledge, FAQ (bukan keuangan)
- **Format output**: JSON `{"reply": "..."}` (dipakai oleh lead automation pipeline)
- **Tidak ada tool-calling**: sepenuhnya prompt-driven

**File terkait:**
- `src/lib/ai/concierge/personas.ts` — `buildConciergeSystemPrompt()`, `pickConciergePersona()`
- `src/lib/ai/concierge/index.ts` — orchestrator
- `src/lib/ai/concierge/tier.ts` — tier gratis vs Pro

---

## Provider & Model Matrix

| Pilihan di UI | Label | Mesin Tab Ask | Mesin Tab Entry | Biaya |
|---------------|-------|---------------|-----------------|-------|
| AXION Auto | AXION Auto | SSE chat (Gemini→Groq) | Parser (Gemini→Groq→regex) | Gratis (kuota terbatas) |
| Gemini Vertex | Gemini | Agent (Gemini 3.5 Flash Vertex) | Parser (Vertex→fallback) + Bianca chat | GCP billing |
| Claude | Claude | Agent / SSE (Claude Sonnet 4.6 Vertex) | Parser (Vertex→fallback) + Bianca chat | GCP billing |

**Triase model (mode Ask + Gemini Vertex):**
- Sebelum panggil agent, ada triase 2-tahap (`triageVertexModel`) yang memutuskan:
  - Pertanyaan ringan → Gemini 3.5 Flash (cepat/murah)
  - Pertanyaan berat → Gemini 2.5 Pro (reasoning lebih dalam)

---

## Desain Prinsip

1. **Persona overlay deterministik** — Persona hanya mengubah system prompt (nol biaya LLM). Mesin, model, dan tools tidak berubah.

2. **Parser ≠ Agent** — Tab Entry (Bianca) pakai parser transaksi yang ringan; Agent (Stanley/Sri Mulyani) pakai tool-calling yang lebih berat. Ini disengaja agar pencatatan tetap cepat.

3. **Fallback graceful** — Setiap chain punya fallback: Vertex → Gemini gratis → Groq → regex rule-based. Tidak ada dead-end.

4. **Hemat kuota gratis** — Fitur yang butuh LLM ekstra (Bianca chat, Concierge-Pro, full-LLM import) hanya aktif saat Vertex dipilih. Mode AXION Auto dijaga se-efisien mungkin.

5. **Pemisahan owner-facing vs customer-facing** — Persona keuangan (Bianca/Stanley/Sri Mulyani) TIDAK pernah terpapar ke pelanggan akhir. Concierge-Pro TIDAK pernah melihat data keuangan internal.
