# Balanço — diagnóstico e plano de ações

Finanças pessoais em Next.js 15 + React 19 + Firebase. Este documento reúne o que foi observado no código e uma lista priorizada do que melhorar.

> **Como foi feito:** li o código (estrutura, `domain.js`, `cloud.js`, `store.jsx`, `Nav.jsx`, `Dashboard.jsx`, `ui.jsx`, CSS, regras do Firestore) e rodei os testes (`node --test`: **28 de 28 passando**). **Não** rodei o app no navegador, então o que se refere a aparência e uso no celular vem do código e precisa ser conferido na tela.

---

## 0. Plano de ação — siga esta ordem

**Regras para não nos perdermos**
1. **Uma versão por vez.** Cada versão termina com: testes passando, item no **Novidades** (changelog), README atualizado e um ZIP novo.
2. **Portão de teste.** Só começamos a versão seguinte depois que você testou a anterior (roteiro em [`docs/ROTEIRO-DE-TESTES.md`](docs/ROTEIRO-DE-TESTES.md)) e me disse "ok" ou quais problemas apareceram.
3. **Se algo quebrar**, me mande o que estava fazendo e a mensagem de erro (no navegador: tecla F12, aba *Console*; ou o texto que aparecer no terminal).
4. As fases da seção 3 são o **estoque** de ideias. Esta seção 0 é a **ordem** em que elas são feitas.

| Versão | Tema | O que entra | Está pronto quando |
| --- | --- | --- | --- |
| **1.7.0** *(feita)* | Folga e categoria automática | Folga do mês no Painel · categoria automática pela descrição · `npm run check` · testes da fatura na virada de ano | — |
| **1.8.0** *(feita)* | Funções novas | Compromissos dos próximos meses · "Repetir todo mês" · sugestões de contas fixas · alerta de gasto fora do normal · textos do saldo previsto reescritos | Roteiro de testes (seção 1.8) todo marcado |
| **1.9.0** | Arrumação do código | Dividir o `Dialogs.jsx` (um arquivo por janela) · organizar o `globals.css` em seções · ESLint (exige `npm install`) · testes do armazenamento e da restauração de backup. **Nada muda na tela.** | `npm run check` passa e o roteiro continua todo ok |
| **2.0.0** | Segurança dos dados | Resumo "vai apagar X e gravar Y" antes de restaurar/sincronizar · verificação de e-mail e senha mais forte · regras do Firestore com validação dos campos | Restaurar backup mostra o resumo; gravar lançamentos continua funcionando depois de publicar as regras (testar no *Rules Playground* do Firebase) |
| **2.1.0** | Metas de poupança | Meta com nome, valor, prazo e conta ligada · progresso no Painel · entra no backup e na nuvem · testes | Criar, editar, concluir e excluir meta; progresso bate com o saldo da conta |
| **2.2.0** | Conciliação | Marcar lançamentos como "conferidos" · informar o saldo real do banco e ver a diferença · filtro "não conferidos" | A diferença mostrada bate com a conta feita à mão |
| **2.3.0** | Acessibilidade | Gráficos acessíveis por teclado (tabela com os mesmos valores) | Dá para ler todos os valores sem mouse |

**Pequenos extras** que podem entrar em qualquer versão, sem mudar a ordem: usar o seletor de período também na Agenda e no Importar.

**Fora do plano** (só se você pedir): etiquetas/centros de custo, anexos de comprovantes, lembretes por e-mail e compartilhar com a família. São grandes e pedem servidor ou armazenamento extra.

**Onde estamos agora:** versão 1.8.0 pronta. Próximo passo: você roda o roteiro de testes (`docs/ROTEIRO-DE-TESTES.md`, seções 1.7 e 1.8) e seguimos para a 1.9.0.

---

## 1. Estado atual

> **Versão 1.8.3** (12/10/2026): o "Ver" dos avisos leva direto à fatura (rolagem + destaque), cartão com fatura urgente destacado na tela Contas e contas que vencem hoje destacadas na Agenda. A 1.8.2 trouxe: faixa vermelha de urgência para fatura/conta que vence hoje ou está atrasada, e avisos de fatura por nível de urgência. A 1.8.1 trouxe: correção do formulário de lançamento (rótulo escondido) e nova faixa de atalhos abaixo da Descrição. A 1.8.0 trouxe: compromissos dos próximos meses, "Repetir todo mês", sugestões de contas fixas, alerta de gasto fora do normal e textos do saldo previsto reescritos. A 1.7.0 trouxe folga do mês e categoria automática. A 1.6.0 trouxe: novo seletor de período em Lançamentos e Relatórios (atalhos + calendário de intervalo). A 1.5.0 trouxe: orçamento com sobra acumulada, cor por conta e documentação atualizada. O Balanço é **só web** (sem app/PWA). A 1.4.0 trouxe: busca global (`/`), PDF dos relatórios, cópia de segurança automática antes de apagar/substituir dados e rolagem travada atrás das janelas. A 1.3.0 trouxe: formulários não fecham mais ao clicar fora (Esc pergunta antes de descartar) e atalhos "Mais usados" no lançamento. A 1.2.0 trouxe: "Salvar e novo", "Repetir último lançamento", atalhos `N` e `/`, comparação com o mês anterior no Painel e contraste dos títulos de banco. A 1.1.0 trouxe conta Principal, campo Banco, Contas agrupadas por banco e a tela **Novidades** (changelog). O que mudou em cada versão está no menu, em *Novidades*, e no arquivo `src/lib/changelog.js`. **Para registrar uma mudança nova, é só acrescentar uma entrada no topo desse arquivo.**

O app está mais completo do que o planejamento sugere. Já existem:

- Contas, lançamentos (receita, despesa, transferência), parcelamento, edição em lote e **Desfazer** em exclusões e ações em lote.
- Cartão de crédito com fatura por mês, fechamento/vencimento, dívida inicial atribuída a uma fatura, pagamento de fatura e **alertas de fatura** (fecha hoje, vence em até 7 dias, atrasada).
- Agenda com recorrências, orçamento com alerta, relatórios, carteira de investimentos, importação CSV/OFX com regras e detecção de duplicados, backup/restauração em JSON.
- Valores em centavos, regras do Firestore isolando cada usuário, janelas com `<dialog>` nativo (foco e Esc tratados), link "pular para o conteúdo", gráficos com `role="img"`.

**Divergências entre o `docs/PLANEJAMENTO.md` e o código:**

| Planejamento diz | Código faz |
| --- | --- |
| Navegação em barra inferior fixa, sem menu lateral | Barra lateral retrátil no computador e gaveta no celular |
| Metas, PWA offline, relatório PDF na V2 | Parte já existe (ver plano) |

---

## 2. Pontos de atenção (verificados no código)

1. **Restaurar/importar backup pode apagar dados na nuvem.** `syncAll` deixa o Firestore idêntico ao estado local, apagando o que não estiver nele. Além disso, grava em lotes de 400, que não são atômicos: uma falha no meio deixa o estado misturado. Desde a 1.4.0 o app baixa uma cópia de segurança automática antes de substituir ou apagar tudo; falta só a pré-visualização do que será apagado.
2. **Alertas só aparecem dentro do app.** Se você não abrir o Painel, não é avisado de fatura nem de conta atrasada.
3. **Regras do Firestore só checam o usuário.** Não validam tipo nem tamanho dos campos.
4. **Gráficos dependem de ponteiro** (hover/toque) para mostrar valores. Quem usa só teclado não acessa os números.
5. **Testes cobrem `domain`, `importers`, contas e orçamento (38 testes).** Store, sincronização e telas ainda não têm teste.

---

## 3. Plano de ações

Legenda de esforço: **P** pequeno (até 1 sessão) · **M** médio · **G** grande.

### Fase 1 — Segurança e confiança nos dados
- [x] **(P)** Criar o `.env.example` (as chaves do Firebase hoje ficam como padrão dentro de `cloud.js`). *Feito na 1.5.0.*
- [x] **(P)** Baixar um backup automático (ou guardar em memória para "Desfazer") antes de **Restaurar** e antes de **Apagar tudo**. *Feito na 1.4.0.*
- [ ] **(M)** Reforçar `firestore.rules`: validar tipos dos campos (`amount` inteiro, `date` no formato `AAAA-MM-DD`, tamanho máximo de texto).
- [ ] **(P)** Exigir verificação de e-mail no cadastro e senha mais forte que o mínimo de 6.
- [ ] **(M)** Tornar `syncAll` mais seguro: comparar antes de apagar e mostrar um resumo ("vai apagar X e gravar Y") antes de confirmar.

### Fase 2 — Uso no dia a dia
- [x] **(P)** Botão **"Salvar e novo"** no lançamento e **"Repetir último"**.
- [x] **(P)** Atalhos de teclado discretos (`N` = novo lançamento, `/` = busca). Sem paleta de comandos.
- [x] **(M)** **Modelos de lançamento** (café, mercado, combustível) para preencher em um toque. *Feito na 1.3.0 de forma automática: os lançamentos que você mais repete viram botões "Mais usados". Modelos salvos à mão ficam para depois.*
- [x] **(M)** **Busca global** (descrição, valor, categoria) acessível de qualquer tela. *Feito na 1.4.0.*
- [x] **(M)** **Seletor de período** (atalhos + calendário de intervalo) em Lançamentos e Relatórios, que antes só tinham opções fixas. *Feito na 1.6.0.*
- [x] **(P)** No Painel, comparar com o **mês anterior** (receitas, despesas, resultado).
- [x] **(M)** **Orçamento por mês com sobra acumulada** (já previsto na V2). *Feito na 1.5.0 (opcional em cada orçamento).*

### Fase 3 — Recursos novos (V2 do planejamento)
- [ ] **(M)** **Metas de poupança** ligadas a contas, com progresso e prazo.
- [ ] **(M)** **Conciliação:** marcar lançamentos como "conferidos" e comparar com o saldo real do banco.
- [x] **(P)** **Relatório em PDF** usando o CSS de impressão que já existe (`@media print`), com um botão "Imprimir/Salvar PDF". *Feito na 1.4.0.*
- [ ] **(M)** **Etiquetas / centros de custo** além das categorias.
- [ ] **(G)** **Anexos** (comprovantes) com Firebase Storage.
- [ ] **(G)** **Lembretes por e-mail ou notificação** de fatura e vencimentos (resolve o ponto 4).
- [ ] **(G)** **Compartilhar com família** (multiusuário).


### Fase 5 — Acessibilidade e UI
- [ ] **(M)** Dar acesso por teclado aos gráficos (foco nas barras ou uma tabela alternativa com os mesmos valores).
- [x] **(P)** Travar a rolagem da página de trás quando há janela aberta. *Feito na 1.4.0.*
- [x] **(P)** Aumentar o contraste dos títulos de banco na tela Contas (estavam quase da cor do fundo). *Feito na 1.2.0.*
- [x] **(P)** Formulários não fecham mais ao clicar fora; o Esc pergunta antes de descartar o que foi digitado. *Feito na 1.3.0.*
- [x] **(P)** Respeitar `prefers-reduced-motion` (animações desligadas para quem pede). *Feito na 1.4.0.*
- [x] **(P)** Conferir contraste AA nas cores de status. *Feito na 1.5.0: todas passam (mínimo 4,5).*
- [ ] **(M)** Conferir no celular real: tabelas largas (Lançamentos, Relatórios) devem virar lista de cartões ou rolar sem quebrar a página.
- [x] **(P)** Telas vazias de Agenda, Orçamento e Carteira. *Já existiam, com explicação e botão de ação; nada a fazer.*

### Fase 6 — Qualidade e manutenção
- [ ] **(M)** Dividir `Dialogs.jsx` (~50 KB) em um arquivo por janela.
- [ ] **(M)** Organizar `globals.css` (~29 KB) em seções ou módulos.
- [ ] **(M)** Testes para `store.jsx` e `storage.js` (mesclar dados, restaurar backup) e para fatura com mudança de mês e ano.
- [x] **(P)** Atualizar o `docs/PLANEJAMENTO.md` (navegação lateral, o que já saiu da V2). *Feito na 1.5.0.*
- [ ] **(P)** Adicionar lint (ESLint) e rodar `npm test` + `next build` antes de publicar.

---

## 4. Sugestão de ordem

A ordem oficial está na **seção 0** (plano por versão).

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
- [x] **(P) Cor ou ícone por conta/banco** para reconhecer rápido nas listas e nos lançamentos. *Feito na 1.5.0 (cor).*
- [x] **Loja e pessoal:** decidido que não precisa separar. Tudo que entra da loja é seu, então basta uma **categoria de receita** (por exemplo "Loja") e, se quiser, outra para o freelance. Nada de etiquetas ou centros de custo por enquanto.

**Detalhes a decidir:**
- Cartão de crédito pode ser "Principal"? Sugestão: não, a principal é sempre conta corrente, dinheiro ou poupança.
- O que acontece ao arquivar a conta principal? Sugestão: perguntar qual passa a ser a principal.

### Funções novas pensadas pelo Claude (ainda não feitas)

- [x] **Folga do mês** no Painel (quanto dá para gastar por dia). *Feito na 1.7.0.*
- [x] **Categoria automática** pela descrição já usada antes. *Feito na 1.7.0.*
- [x] **(M) Compromissos futuros:** quanto já está comprometido nos próximos meses (parcelas do cartão + recorrências + faturas), em uma visão só. *Feito na 1.8.0.*
- [x] **(P) "Repetir todo mês":** botão no detalhe de um lançamento que abre o cadastro de recorrência já preenchido. *Feito na 1.8.0.*
- [x] **(M) Detectar contas fixas:** o app percebe que uma descrição se repete todo mês e sugere criar a recorrência. *Feito na 1.8.0.*
- [x] **(M) Alerta de gasto fora do normal:** aviso quando uma categoria passa muito da média dos últimos meses. *Feito na 1.8.0.*

### Outras ideias

- [ ] …
- [ ] …
