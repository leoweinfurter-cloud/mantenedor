-- ═══════════════════════════════════════════════════════════════════════
--  MIGRAÇÃO — Módulo de Avaliação de Máquinas e Equipamentos (/avaliacao)
--
--  Módulo isolado do Mantenedor (mesmo padrão do Caspere): tabelas
--  próprias com prefixo avl_ e RLS por dono (owner_id = auth.uid()).
--  NÃO usa tenant_id nem toca nas tabelas do Mantenedor.
--
--  Como aplicar: Supabase > SQL Editor > colar tudo > Run.
--  É idempotente: pode rodar mais de uma vez sem problema.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Trigger genérico: carimba atualizado_em com o relógio do servidor ───
-- (usado na sincronização incremental do modo offline)
DROP FUNCTION IF EXISTS public.avl_touch() CASCADE;
CREATE FUNCTION public.avl_touch() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
BEGIN
  NEW.atualizado_em := clock_timestamp();
  RETURN NEW;
END;
$func$;

-- ── 1. AVALIAÇÕES (uma por processo / contratante) ──────────────────────
CREATE TABLE IF NOT EXISTS public.avl_avaliacoes (
  id               uuid PRIMARY KEY,
  owner_id         uuid NOT NULL DEFAULT auth.uid(),
  titulo           text NOT NULL DEFAULT '',
  processo         text DEFAULT '',          -- nº do processo / referência
  cliente          text DEFAULT '',          -- escritório / contratante
  empresa_avaliada text DEFAULT '',
  local_vistoria   text DEFAULT '',
  data_base        date,                     -- data da resolução (CPC art. 605)
  data_vistoria    date,
  finalidade       text DEFAULT 'Partilha de bens na dissolução da sociedade',
  tipo_valor       text DEFAULT 'mercado_em_uso',
  art_numero       text DEFAULT '',
  ff_padrao        numeric DEFAULT 0.90,     -- fator de oferta padrão
  margem_arbitrio  numeric DEFAULT 15,       -- campo de arbítrio (±%)
  vlf_ativo        boolean DEFAULT false,    -- calcular liquidação forçada (informativo)
  vlf_custos       numeric DEFAULT 7,        -- custos de venda (%)
  vlf_juros_mensal numeric DEFAULT 1.2,      -- taxa mensal (%)
  vlf_meses        numeric DEFAULT 6,        -- prazo de comercialização
  pressupostos     text DEFAULT '',
  ressalvas        text DEFAULT '',
  observacoes      text DEFAULT '',
  excluido         boolean NOT NULL DEFAULT false,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. BENS (uma linha por máquina / equipamento) ───────────────────────
CREATE TABLE IF NOT EXISTS public.avl_bens (
  id                 uuid PRIMARY KEY,
  avaliacao_id       uuid NOT NULL REFERENCES public.avl_avaliacoes(id) ON DELETE CASCADE,
  owner_id           uuid NOT NULL DEFAULT auth.uid(),
  numero             integer,
  quantidade         integer DEFAULT 1,
  tag                text DEFAULT '',
  cod_contabil       text DEFAULT '',
  descricao          text DEFAULT '',
  fabricante         text DEFAULT '',
  modelo             text DEFAULT '',
  serie              text DEFAULT '',
  ano_fabricacao     integer,
  ano_aquisicao      integer,
  capacidade         text DEFAULT '',
  comando            text DEFAULT '',
  horimetro          text DEFAULT '',
  localizacao        text DEFAULT '',
  integracao         text DEFAULT 'isolada',        -- isolada | linha
  funcionamento      text DEFAULT 'nao_observado',  -- nao_observado | observado | completo
  estado             text DEFAULT '',               -- a..i (Heidecke)
  manutencao         text DEFAULT '',               -- nenhuma | corretiva | preventiva | preditiva
  regime             text DEFAULT '',
  ambiente           text DEFAULT 'normal',         -- normal | agressivo
  retrofit           text DEFAULT '',
  idade_aparente     numeric,
  nr12               text DEFAULT 'nao_avaliado',   -- conforme | nao_conforme | nao_avaliado | nao_aplica
  nr12_custo         numeric,
  custo_reparos      numeric,
  obsolescencia      text DEFAULT '',
  fobs               numeric DEFAULT 1,
  liquidez           text DEFAULT '',               -- alta | media | baixa
  propriedade        text DEFAULT 'propria',        -- propria | leasing | comodato | terceiro | socio
  onus               text DEFAULT 'nenhum',         -- nenhum | alienacao_fiduciaria | reserva_dominio | penhora | outro
  onus_credor        text DEFAULT '',
  onus_saldo         numeric,
  valor_aquisicao    numeric,
  valor_contabil     numeric,
  vida_util_ref      text DEFAULT '',
  vida_util_anos     numeric,
  residual_pct       numeric DEFAULT 10,
  valor_novo         numeric,
  custos_adicionais  numeric,
  valor_novo_fonte   text DEFAULT '',
  metodo             text DEFAULT 'comparativo',
  valor_manual       numeric,
  justificativa_manual text DEFAULT '',
  peso_kg            numeric,
  preco_sucata_kg    numeric,
  fotos_qtd          integer DEFAULT 0,
  fotos_nomes        jsonb DEFAULT '[]'::jsonb,     -- nomes dos arquivos (as fotos ficam fora do sistema)
  observacoes        text DEFAULT '',
  excluido           boolean NOT NULL DEFAULT false,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  atualizado_em      timestamptz NOT NULL DEFAULT now()
);

-- ── 3. COTAÇÕES / DADOS DE MERCADO ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.avl_cotacoes (
  id            uuid PRIMARY KEY,
  avaliacao_id  uuid NOT NULL REFERENCES public.avl_avaliacoes(id) ON DELETE CASCADE,
  bem_id        uuid NOT NULL REFERENCES public.avl_bens(id) ON DELETE CASCADE,
  owner_id      uuid NOT NULL DEFAULT auth.uid(),
  tipo          text DEFAULT 'oferta',      -- oferta | transacao | novo
  fonte         text DEFAULT '',
  referencia    text DEFAULT '',            -- URL, contato, nº do lote
  data_coleta   date,
  descricao     text DEFAULT '',
  ano           integer,
  preco         numeric,
  ff            numeric,
  fid           numeric,                    -- nulo = calculado pela curva IBAPE
  fest          numeric,
  fcap          numeric,
  fop           numeric,
  curva         text DEFAULT 'bom',         -- bom | regular (estado do dado de mercado)
  direta        boolean DEFAULT false,      -- cotação direta no fabricante
  incluido      boolean DEFAULT true,
  observacoes   text DEFAULT '',
  excluido      boolean NOT NULL DEFAULT false,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- ── Índices ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS avl_avaliacoes_owner_idx ON public.avl_avaliacoes (owner_id, atualizado_em);
CREATE INDEX IF NOT EXISTS avl_bens_owner_idx       ON public.avl_bens (owner_id, atualizado_em);
CREATE INDEX IF NOT EXISTS avl_bens_avaliacao_idx   ON public.avl_bens (avaliacao_id);
CREATE INDEX IF NOT EXISTS avl_cotacoes_owner_idx   ON public.avl_cotacoes (owner_id, atualizado_em);
CREATE INDEX IF NOT EXISTS avl_cotacoes_bem_idx     ON public.avl_cotacoes (bem_id);

-- ── Triggers de atualizado_em ───────────────────────────────────────────
DROP TRIGGER IF EXISTS avl_avaliacoes_touch ON public.avl_avaliacoes;
CREATE TRIGGER avl_avaliacoes_touch BEFORE INSERT OR UPDATE ON public.avl_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.avl_touch();
DROP TRIGGER IF EXISTS avl_bens_touch ON public.avl_bens;
CREATE TRIGGER avl_bens_touch BEFORE INSERT OR UPDATE ON public.avl_bens
  FOR EACH ROW EXECUTE FUNCTION public.avl_touch();
DROP TRIGGER IF EXISTS avl_cotacoes_touch ON public.avl_cotacoes;
CREATE TRIGGER avl_cotacoes_touch BEFORE INSERT OR UPDATE ON public.avl_cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.avl_touch();

-- ── RLS: cada usuário só enxerga e altera o que é dele ──────────────────
ALTER TABLE public.avl_avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avl_bens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avl_cotacoes   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS avl_avaliacoes_dono ON public.avl_avaliacoes;
CREATE POLICY avl_avaliacoes_dono ON public.avl_avaliacoes
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS avl_bens_dono ON public.avl_bens;
CREATE POLICY avl_bens_dono ON public.avl_bens
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.avl_avaliacoes a WHERE a.id = avaliacao_id AND a.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS avl_cotacoes_dono ON public.avl_cotacoes;
CREATE POLICY avl_cotacoes_dono ON public.avl_cotacoes
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.avl_bens b WHERE b.id = bem_id AND b.owner_id = auth.uid())
  );

-- Sem acesso anônimo: nenhuma tabela é pública.
REVOKE ALL ON public.avl_avaliacoes, public.avl_bens, public.avl_cotacoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avl_avaliacoes, public.avl_bens, public.avl_cotacoes TO authenticated;

-- Conferência rápida (opcional):
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'avl_%';
