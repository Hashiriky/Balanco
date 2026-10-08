# Balanço — diagnóstico e plano de ações

Finanças pessoais em Next.js 15 + React 19 + Firebase. Este documento reúne o que foi observado no código e uma lista priorizada do que melhorar.

> **Como foi feito:** li o código (estrutura, `domain.js`, `cloud.js`, `store.jsx`, `Nav.jsx`, `Dashboard.jsx`, `ui.jsx`, CSS, regras do Firestore) e rodei os testes (`node --test`: **28 de 28 passando**). **Não** rodei o app no navegador, então o que se refere a aparência e uso no celular vem do código e precisa ser conferido na tela.

---

## 1. Estado atual

> **Versão 1.2.0** (08/10/2026): "Salvar e novo", "Repetir último lançamento", atalhos `N` e `/`, comparação com o mês anterior no Painel e contraste dos títulos de banco. A 1.1.0 trouxe conta Principal, campo Banco, Contas agrupadas por banco e a tela **Novidades** (changelog). O que mudou em cada versão está no menu, em *Novidades*, e no arquivo `src/lib/changelog.js`. **Para registrar uma mudança nova, é só acrescentar uma entrada no topo desse arquivo.**

O app está mais completo do que o planejamento sugere. Já existem:

- Contas, lançamentos (receita, despesa, transferência), parcelamento, edição em lote e **Desfazer** em exclusões e ações em lote.
- Cartão de crédito com fatura por mês, fechamento/vencimento, dívida inicial atribuída a uma fatura, pagamento de fatura e **alertas de fatura** (fecha hoje, vence em até 7 dias, atrasada).
- Agenda com recorrências, orçamento com alerta, relatórios, carteira de investimentos, importação CSV/OFX com regras e detecção de duplicados, backup/restauração em JSON.
- Valores em centavos, regras do Firestore isolando cada usuário, janelas com `<dialog>` nativo (foco e Esc tratados), link "pular para o conteúdo", gráficos com `role="img"`.

**Divergências entre o `docs/PLANEJAMENTO.md` e o código:**

| Planejamento diz | Código faz |
| --- | --- |
| Navegação em barra inferior fixa, sem menu lateral | Barra lateral retrátil no computador e gaveta no celular |
| Metas, PWA offline, relatório PDF na V2 | Ainda não existem (ver plano) |

---

## 2. Pontos de atenção (verificados no código)

1. **Sem modo offline de verdade.** Não há service worker nem cache local do Firestore. O `manifest.js` só tem ícone SVG, e a instalação como app costuma pedir PNG 192/512.
2. **Restaurar/importar backup pode apagar dados na nuvem.** `syncAll` deixa o Firestore idêntico ao estado local, apagando o que não estiver nele. Além disso, grava em lotes de 400, que não são atômicos: uma falha no meio deixa o estado misturado. A confirmação existe, mas não há cópia automática antes.
3. **Alertas só aparecem dentro do app.** Se você não abrir o Painel, não é avisado de fatura nem de conta atrasada.
4. **Regras do Firestore só checam o usuário.** Não validam tipo nem tamanho dos campos.
5. **`.env.example` é citado em `cloud.js`, mas não veio no zip.**
6. **Gráficos dependem de ponteiro** (hover/toque) para mostrar valores. Quem usa só teclado não acessa os números.
7. **Testes cobrem só `domain` e `importers`.** Store, sincronização e telas não têm teste.

---

## 3. Plano de ações

Legenda de esforço: **P** pequeno (até 1 sessão) · **M** médio · **G** grande.

### Fase 1 — Segurança e confiança nos dados
- [ ] **(P)** Criar o `.env.example` (as chaves do Firebase hoje ficam como padrão dentro de `cloud.js`).
- [ ] **(P)** Baixar um backup automático (ou guardar em memória para "Desfazer") antes de **Restaurar** e antes de **Apagar tudo**.
- [ ] **(M)** Reforçar `firestore.rules`: validar tipos dos campos (`amount` inteiro, `date` no formato `AAAA-MM-DD`, tamanho máximo de texto).
- [ ] **(P)** Exigir verificação de e-mail no cadastro e senha mais forte que o mínimo de 6.
- [ ] **(M)** Tornar `syncAll` mais seguro: comparar antes de apagar e mostrar um resumo ("vai apagar X e gravar Y") antes de confirmar.

### Fase 2 — Uso no dia a dia
- [x] **(P)** Botão **"Salvar e novo"** no lançamento e **"Repetir último"**.
- [x] **(P)** Atalhos de teclado discretos (`N` = novo lançamento, `/` = busca). Sem paleta de comandos.
- [ ] **(M)** **Modelos de lançamento** (café, mercado, combustível) para preencher em um toque.
- [ ] **(M)** **Busca global** (descrição, valor, categoria) acessível de qualquer tela.
- [x] **(P)** No Painel, comparar com o **mês anterior** (receitas, despesas, resultado).
- [ ] **(M)** **Orçamento por mês com sobra acumulada** (já previsto na V2).

### Fase 3 — Recursos novos (V2 do planejamento)
- [ ] **(M)** **Metas de poupança** ligadas a contas, com progresso e prazo.
- [ ] **(M)** **Conciliação:** marcar lançamentos como "conferidos" e comparar com o saldo real do banco.
- [ ] **(P)** **Relatório em PDF** usando o CSS de impressão que já existe (`@media print`), com um botão "Imprimir/Salvar PDF".
- [ ] **(M)** **Etiquetas / centros de custo** além das categorias.
- [ ] **(G)** **Anexos** (comprovantes) com Firebase Storage.
- [ ] **(G)** **Lembretes por e-mail ou notificação** de fatura e vencimentos (resolve o ponto 4).
- [ ] **(G)** **Compartilhar com família** (multiusuário).

### Fase 4 — PWA e offline
- [ ] **(P)** Ícones PNG 192/512 e `maskable` no manifest.
- [ ] **(M)** Ativar o cache local do Firestore (persistência offline) e mostrar "Sem conexão, alterações serão enviadas depois".
- [ ] **(M)** Service worker para abrir o app sem internet.

### Fase 5 — Acessibilidade e UI
- [ ] **(M)** Dar acesso por teclado aos gráficos (foco nas barras ou uma tabela alternativa com os mesmos valores).
- [x] **(P)** Aumentar o contraste dos títulos de banco na tela Contas (estavam quase da cor do fundo). *Feito na 1.2.0.*
- [ ] **(P)** Respeitar `prefers-reduced-motion` e conferir contraste AA nas cores de status.
- [ ] **(M)** Conferir no celular real: tabelas largas (Lançamentos, Relatórios) devem virar lista de cartões ou rolar sem quebrar a página.
- [ ] **(P)** Tela de **primeiros passos** também nas telas vazias de Agenda, Orçamento e Carteira (hoje só o Painel tem).

### Fase 6 — Qualidade e manutenção
- [ ] **(M)** Dividir `Dialogs.jsx` (~50 KB) em um arquivo por janela.
- [ ] **(M)** Organizar `globals.css` (~29 KB) em seções ou módulos.
- [ ] **(M)** Testes para `store.jsx` e `storage.js` (mesclar dados, restaurar backup) e para fatura com mudança de mês e ano.
- [ ] **(P)** Atualizar o `docs/PLANEJAMENTO.md` (navegação lateral, o que já saiu da V2).
- [ ] **(P)** Adicionar lint (ESLint) e rodar `npm test` + `next build` antes de publicar.

---

## 4. Sugestão de ordem

1. **Fase 1** primeiro: protege seus dados.
2. **Fase 2** em seguida: ganhos rápidos que você sente todo dia.
3. **Fase 3** na ordem **metas → PDF → conciliação**, o que dá mais valor com menos esforço.
4. **Fases 4, 5 e 6** em paralelo, conforme o tempo.

## 5. Ideias suas

### Conta "Principal" e contas organizadas por banco

**Situação hoje (no código):**
- Ao abrir **Novo lançamento**, a conta escolhida é a **primeira conta não arquivada e que não seja investimento**, na ordem de criação. Pode ser um cartão de crédito, e não há como definir qual é a principal.
- As contas **não têm campo de banco**. Só têm nome e tipo (corrente, poupança, dinheiro, investimento, cartão), então não dá para agrupar por banco.
- O seletor de conta é uma lista simples: `Nome (Tipo)`.

**Proposta:**
- [x] **(P) Campo "Principal"** na conta (marcar como principal no cadastro/edição; só uma por vez). O lançamento novo abre nela. Se não houver principal, mantém o comportamento atual.
- [x] **(P) Campo "Banco / instituição"** na conta (texto livre com sugestões: Nubank, Itaú, Mercado Pago, etc.). Contas antigas ficam sem banco e continuam funcionando.
- [x] **(P) Seletor de conta com grupos:** a principal primeiro (com uma estrela), depois as outras agrupadas por banco; cartões em um grupo próprio.
- [x] **(M) Tela Contas agrupada por banco**, com o total de cada banco e o selo "Principal" bem visível. Um banco pode ter conta corrente e cartão juntos.
- [ ] **(P) Cor ou ícone por conta/banco** para reconhecer rápido nas listas e nos lançamentos.
- [x] **Loja e pessoal:** decidido que não precisa separar. Tudo que entra da loja é seu, então basta uma **categoria de receita** (por exemplo "Loja") e, se quiser, outra para o freelance. Nada de etiquetas ou centros de custo por enquanto.

**Detalhes a decidir:**
- Cartão de crédito pode ser "Principal"? Sugestão: não, a principal é sempre conta corrente, dinheiro ou poupança.
- O que acontece ao arquivar a conta principal? Sugestão: perguntar qual passa a ser a principal.

### Outras ideias

- [ ] …
- [ ] …
