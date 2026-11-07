# Módulo Avaliação de Bens (Mantenedor)

Levantamento in loco de máquinas e equipamentos, cálculo do valor de mercado e laudo imprimível. Módulo isolado (como o Caspere): login próprio, tabelas `avl_*`, funciona offline e sincroniza com o Supabase.

## Instalação

1. **Banco:** no Supabase (SQL Editor), execute `migracao_avaliacao.sql`. É idempotente, pode rodar mais de uma vez.
2. **Site:** copie a pasta `avaliacao/` para a raiz do repositório. Após o deploy no Cloudflare Pages, o módulo fica em `/avaliacao/`.
3. **Acesso:** entre com a mesma conta do Mantenedor. Cada usuário enxerga apenas as próprias avaliações (RLS por `owner_id`).

## Uso

- **Lista** (`index.html`): cria e abre avaliações.
- **Avaliação** (`avaliacao.html`): abas Bens, Resumo e cálculo, Dados da avaliação.
- **Bem** (`bem.html`): ficha de campo (identificação, estado, NR-12, propriedade e ônus, fotos, método) com resultado ao vivo e pesquisa de mercado (ofertas, transações, novo).
- **Laudo** (`laudo.html`): layout A4 com papel timbrado; use Imprimir / Salvar como PDF. Inclui Anexo A com a memória de cálculo.
- **Offline:** os dados ficam no IndexedDB do aparelho e sincronizam quando há conexão (barra de sincronização no topo). Abra o módulo uma vez com internet antes de ir a campo, para o service worker guardar os arquivos.
- **Fotos:** só se registra a quantidade e o nome dos arquivos.

## Métodos

Custo de reedição (curva IBAPE e Ross-Heidecke), método comparativo direto com homogeneização e saneamento ±30%, fator de obsolescência, NR-12, valor de liquidação forçada (informativo), campo de arbítrio ±15% e grau de fundamentação conforme ABNT NBR 14653-1 e 14653-5.

## Testes

```
node avaliacao/tests/test_calc.js
node avaliacao/tests/test_sync.js
node avaliacao/tests/test_contrato_banco.js
node avaliacao/tests/e2e_playwright.js   # requer playwright + chromium
```

## Ressalvas

- A curva IBAPE está em passos de 0,10 com interpolação linear; confira com a tabela completa.
- Os coeficientes de Heidecke vêm de edificações.
- As tabelas da NBR vieram de fontes secundárias; confirme no texto oficial.
- Ff 0,90, faixa de fatores 0,5–2,0 e limite de 15% para reparos são práticas profissionais, não prescrições da norma.
- O módulo não está ligado ao menu principal do Mantenedor e está só em português.
