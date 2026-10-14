# Mantenedor — Geração e leitura de QR Codes dos ativos

Documenta como o QR Code de cada ativo é gerado, impresso e lido no Mantenedor (`mantenedor.app.br`). Segue o mesmo modelo do Caspere, com as adaptações necessárias para o app multi-empresa.

---

## 1. Visão geral

Cada ativo tem um **QR Code único**, impresso numa etiqueta colada na máquina. O QR não guarda dados do ativo: ele guarda **apenas um link** com um **token aleatório**. Todo o resto (nome, OS, histórico) é buscado no Supabase no momento da leitura.

```
Etiqueta (QR) ──► câmera do celular ──► qr.html?t=<token> ──┬─► equipe logada (ativo do seu tenant) → OS em aberto do ativo
                                                            └─► sem login / outro caso               → visão pública enxuta
```

### Diferença para o Caspere

| | Caspere | Mantenedor |
|---|---|---|
| Identificador no QR | UUID do equipamento | `ativos.qr_token` (UUID próprio, separado do `id`) |
| Por que | `id` já é UUID | `ativos.id` é inteiro sequencial (1, 2, 3…): se fosse no QR, daria para varrer ativos de todas as empresas |
| Leitura sem login | Tabelas com leitura pública por RLS | **Nenhuma tabela pública.** Só duas funções `SECURITY DEFINER` |
| Multi-empresa | Não (uma empresa) | Sim — o isolamento por tenant continua valendo para a equipe logada |

---

## 2. Geração do QR Code

**Onde:** `ativos.html` → ficha do ativo → botão **QR Code** (ao lado de "Voltar").

**Biblioteca:** `qrcodejs 1.0.0` via cdnjs (a mesma do Caspere). Roda 100% no navegador.

**Conteúdo do QR** — montado por `mxUrlQrAtivo()` em `_shared.js`:

```js
function mxUrlQrAtivo(token, origem){
  var base = origem || window.location.origin;
  return base + "/qr.html?t=" + encodeURIComponent(token);
}
```

Exemplo: `https://mantenedor.app.br/qr.html?t=0f3c9a1e-5b7d-4c2a-9e8f-1a2b3c4d5e6f`

**Fluxo ao clicar em "QR Code":**

1. `mostrarQr(id)` busca `qr_token` do ativo no Supabase (`ativos?id=eq.<id>&select=qr_token`). O token **não** é guardado no `localStorage` nem no array local de ativos.
2. `preencherEtiquetaQr()` preenche a etiqueta e gera o QR (220 px).
3. Abre o modal da etiqueta.

> **Atenção:** o QR usa `window.location.origin`. Gere a etiqueta **a partir de `mantenedor.app.br`**. Em `localhost` ou outro domínio o QR aponta para lá. Nesses casos o modal mostra um aviso amarelo.

---

## 3. Layout da etiqueta

| Bloco | Conteúdo |
|---|---|
| Cabeçalho | Ícone + "Mantenedor" (linha azul abaixo) |
| Categoria | Categoria do ativo |
| Nome | Nome do ativo, grande e em negrito |
| Local | Tag • Localização |
| Empresa | Empresa • Unidade |
| QR Code | Centralizado, 220 px |
| Legenda | "Aponte a câmera para ver as OS ou solicitar manutenção" |
| Rodapé | `ID: <id do ativo>` (útil para suporte) |

A etiqueta tem **fundo branco fixo**, igual nos temas claro e escuro e na impressão.

---

## 4. Impressão

- Botão **Imprimir** chama `imprimirEtiqueta()`, que adiciona `mx-printing-label` ao `<body>` e executa `window.print()`.
- O CSS `@media print` em `ativos.html` esconde tudo menos `#modal-qr` (e os botões `.qr-no-print`); a etiqueta sai com 80 mm de largura.
- O evento `afterprint` remove a classe.

---

## 5. Leitura do QR Code

Não há leitor dentro do sistema: o QR é lido pela **câmera nativa do celular**, que abre o link no navegador. Tudo passa por `qr.html`.

### 5.1 Roteamento em `qr.html`

```
Abriu qr.html?t=...
 ├─ token ausente ou fora do formato UUID ........ "QR Code inválido" (sem consultar o banco)
 ├─ sem sessão ................................... visão pública
 └─ com sessão
     ├─ ativo encontrado pelo RLS (é do seu tenant) → visão da equipe
     ├─ não encontrado (ativo de outro tenant) ..... visão pública
     └─ 401 (token de sessão vencido) .............. limpa a sessão e mostra a visão pública
```

### 5.2 Visão da equipe (logado)

- Dados do ativo e **OS em aberto** (Aberta / Em Andamento) do ativo.
- **Executar / Continuar** → `ordens.html?exec=<id>`. A página de OS move a OS para "Em Andamento" e abre a execução (mesma lógica do botão da lista). Coordenador executa qualquer OS; técnico, só as suas ou as sem responsável.
- **Ver** → detalhe da OS.
- **+ Nova OS Corretiva** (só Coordenador) → `ordens.html?nova=<ativo_id>`, abrindo o modal já com o ativo escolhido.

### 5.3 Visão pública (sem login)

- Nome, categoria, tag, local, empresa/unidade e status do ativo.
- Últimas 10 OS **concluídas** (só número, tipo e data — sem título, descrição, técnico ou custos).
- Formulário **Solicitar manutenção** (nome, contato, descrição). Cria uma linha em `solicitacoes_qr`.
- Botão **"Sou da equipe"** → `login.html?next=qr.html?t=<token>`; depois do login volta para o mesmo ativo.

### 5.4 Solicitações (para o Coordenador)

`ordens.html` mostra, só para o Coordenador, o painel **Solicitações via QR Code** com as pendentes:

- **Criar OS** → OS corretiva (prioridade Normal, `origem = "qr"`), com a descrição e os dados do solicitante; a solicitação vira `Convertida` e guarda o `os_id`.
- **Descartar** → vira `Descartada`.

Se a OS for salva mas a marcação da solicitação falhar, a OS permanece, aparece um aviso e a solicitação sai da tela (para não gerar OS duplicada por clique repetido). Ela reaparece no próximo carregamento: descarte-a manualmente.

---

## 6. Segurança e limites

- O token é um **UUID v4** gerado no banco (`gen_random_uuid()`), único (índice `ativos_qr_token_key`). Quem **não** tem o QR não consegue adivinhar nem enumerar.
- **Não existe leitura pública por RLS.** Sem login, só duas funções são executáveis: `qr_ativo_publico(token)` e `qr_abrir_solicitacao(token, nome, contato, descricao)`. Ambas são `SECURITY DEFINER` com `search_path` fixo e `REVOKE ALL FROM PUBLIC` + `GRANT` explícito para `anon` e `authenticated`.
- `solicitacoes_qr` tem RLS por tenant (`get_tenant_id()`) e **nenhuma policy de INSERT para `anon`**: a criação só acontece pela função, que valida tamanhos e limita abuso (máx. 10 solicitações pendentes por ativo na última hora).
- Quem tem o QR vê o que a visão pública mostra. Se uma etiqueta vazar, **rotacione o token** (invalida a etiqueta antiga; é preciso imprimir a nova):

  ```sql
  update ativos set qr_token = gen_random_uuid() where id = <id do ativo>;
  ```
- O parâmetro `?next=` do login só aceita **nomes de página do próprio app** (`^[A-Za-z0-9_-]+\.html(\?[A-Za-z0-9=&%_.-]*)?$`): sem barra, esquema ou `//`, para não virar redirecionamento aberto. A regra existe em `_shared.js` (`mxProximoSeguro`) e, duplicada, em `login.html` (`destinoPosLogin`), porque o login não carrega `_shared.js`. O `test_qr.js` garante que as duas se comportam igual.
- Todo texto vindo do banco ou do solicitante passa por `esc()` antes de ir para o HTML.
- Ler o QR **não valida** que o técnico está na máquina certa; por isso a etiqueta e a tela mostram os dados do ativo em destaque.

---

## 7. Arquivos envolvidos

| Arquivo | Papel |
|---|---|
| `migracao_qrcode_ativos.sql` | `ativos.qr_token`, tabela `solicitacoes_qr`, funções públicas, permissões |
| `_shared.js` | `mxUrlQrAtivo()`, `mxOrigemQrOficial()`, `mxProximoSeguro()` |
| `ativos.html` | Botão QR Code, modal da etiqueta, geração, impressão |
| `qr.html` | Destino do QR: roteamento, visão da equipe, visão pública, solicitação |
| `login.html` | Respeita `?next=` e volta ao `qr.html` após o login |
| `ordens.html` | `?exec=` e `?nova=`, painel de solicitações (criar OS / descartar) |
| `_lang.js` | Chaves `qr_*` em PT/EN/ES |
| `sw.js` | `qr.html` no app shell; `CACHE_VERSION` → `mx-shell-v2` |
| `test_qr.js` | 30 testes (jsdom): helpers, `qr.html`, `ordens.html`, `ativos.html`, regras do SQL |

---

## 8. Pontos de atenção para o futuro

- Se o domínio mudar, os QRs já impressos deixam de funcionar. Considere manter um redirecionamento no domínio antigo.
- Ativo **desativado** ainda abre pelo QR antigo (a visão pública mostra o status "Desativado"). Avaliar se deve esconder o formulário de solicitação nesse caso.
- A etiqueta é gerada **uma por vez**; ainda não existe tela para imprimir várias de uma vez.
- Ativos de usuário com escopo restrito a certas empresas (`get_user_empresas()`) que leem o QR de um ativo fora do escopo caem na visão pública.
- Um endpoint público sempre pode receber spam. O limite de 10 pendentes/hora por ativo reduz, mas não impede; se virar problema, adicionar captcha ou limite por IP em uma Edge Function.
