# Balanço — planejamento do produto

Aplicativo web de **finanças pessoais** para o Brasil. Este documento define o que um app financeiro precisa ter, o que entra na primeira versão e o que fica para depois.

## 1. Para quem e para quê

**Quem usa:** uma pessoa (ou casal, numa versão futura) que quer saber, sem planilha, quatro coisas: *quanto tenho*, *para onde foi o dinheiro*, *o que ainda vou pagar/receber* e *se estou dentro do planejado*.

**Princípios do produto**
1. **Exatidão antes de tudo.** Dinheiro em centavos inteiros (sem erro de arredondamento); saldos sempre calculados a partir dos lançamentos.
2. **Padrão de mercado.** Contas, lançamentos, categorias, cartão de crédito com fatura, contas a pagar e receber, orçamento, relatórios, importação de extrato.
3. **Interface sóbria.** Fundo liso, tabelas e números claros, sem efeitos. A informação é a estrela.
4. **Seus dados são seus.** Login, dados isolados por usuário, exportação completa a qualquer momento.

## 2. Conceitos do domínio

| Conceito | Regra |
| --- | --- |
| **Conta** | Onde o dinheiro está: corrente, poupança, dinheiro (carteira), investimento ou **cartão de crédito**. Tem saldo inicial. |
| **Lançamento** | Receita, despesa ou **transferência** entre contas. Tem data, valor, conta, categoria (exceto transferência) e **situação**: *realizado* (já aconteceu) ou *previsto* (pendente). |
| **Saldo atual** | Saldo inicial + lançamentos **realizados** até hoje. Previstos não entram. |
| **Saldo previsto** | Saldo atual + previstos (a receber − a pagar) até o fim do mês. |
| **Transferência** | Move dinheiro entre contas; **não é receita nem despesa** (não entra em relatórios de resultado). |
| **Cartão de crédito** | Conta com limite, dia de fechamento e dia de vencimento. Compras entram na **fatura** conforme o fechamento; pagar a fatura é uma transferência da conta corrente para o cartão. |
| **Recorrência** | Regra que gera vencimentos (mensal, semanal, anual). Cada vencimento vira lançamento previsto até ser **efetivado**. |
| **Categoria** | Dois níveis (ex.: Moradia → Energia). Relatórios e orçamento somam os filhos no pai. |
| **Orçamento** | Limite mensal por categoria; compara com o que foi gasto (realizado + previsto). |
| **Regra de categorização** | "Se a descrição contém X, categoria Y". Usada ao importar extratos. |

## 3. Funcionalidades

### Versão 1 (esta entrega)
1. **Conta e acesso**: cadastro, login, recuperação de senha, sair; uso sem conta (dados no aparelho) com junção ao entrar; regras de segurança do Firestore.
2. **Contas**: criar/editar/arquivar; saldo atual e previsto por conta; patrimônio (ativos − dívidas de cartão).
3. **Lançamentos**: receita, despesa, transferência; realizado/previsto; parcelamento; tabela com busca, filtros (período, conta, categoria, tipo, situação), ordenação, paginação, seleção em lote (categoria, situação, excluir), exportação CSV.
4. **Contas a pagar e receber (Agenda)**: vencimentos do mês, atrasados, efetivar com um clique, recorrências (mensal/semanal/anual) com início e fim.
5. **Cartões de crédito**: limite, fechamento, vencimento; faturas por mês com itens, total e situação; pagar fatura; limite disponível.
6. **Categorias**: padrão brasileiro de dois níveis; criar, renomear (atualiza o histórico), arquivar.
7. **Orçamento mensal** por categoria, com alerta ao passar de 85% e ao estourar.
8. **Relatórios**: fluxo de caixa (12 meses), despesas por categoria, evolução do patrimônio, tabela mensal por categoria (com exportação CSV).
9. **Importação de extrato**: CSV (com mapeamento de colunas) e OFX; regras de categorização; detecção de duplicados; revisão antes de importar.
10. **Painel**: saldo em contas, receitas/despesas/resultado do mês (realizado e previsto), próximos vencimentos, alertas (atrasos, fatura a vencer), orçamento, últimas movimentações.
11. **Dados**: backup completo (JSON) e restauração, exportação CSV, apagar todos os dados.

### Versão 2 (planejada)
Metas de poupança ligadas a contas · Carteira de investimentos com cotações · Anexos (comprovantes) · Etiquetas e centros de custo · Conciliação bancária (marcar "conferido") · Orçamento por mês (com sobra acumulada) · Lembretes por e-mail · Relatório em PDF · Multiusuário/compartilhar com família · Aplicativo instalável (PWA offline).

### Fora do escopo
Multimoeda · Open Finance (integração direta com bancos) · Emissão de boletos/pagamentos · Declaração de imposto de renda.

## 4. Telas e navegação

Navegação em **barra inferior fixa**, sólida, com rótulos (sem menu lateral e sem barra no topo):

`Painel · Lançamentos · Agenda · Contas · Orçamento · Relatórios · Mais (Importar, Ajustes, Sair)`

Cada tela tem título, seletor de mês quando faz sentido e o botão principal à direita. Formulários em janela central; validação abaixo de cada campo; confirmação para tudo que apaga.

## 5. Modelo de dados (Firestore: `users/{uid}/{coleção}/{id}`)

- `accounts`: id, name, type, initialBalance (centavos), limit, closingDay, dueDay (só cartão), archived
- `categories`: id, name, type (`expense`/`income`), parentId, color, archived
- `transactions`: id, type, amount (centavos, sempre positivo), date, description, accountId, toAccountId, categoryId, status (`paid`/`pending`), notes, installment {group, number, total}, recurrenceId, recurrenceMonth, invoiceMonth, externalId
- `recurrences`: id, description, amount, type, accountId, categoryId, freq, day, startMonth, endMonth, active
- `budgets`: id (= id da categoria), categoryId, amount
- `rules`: id, contains, categoryId

## 6. Regras de negócio importantes

- Valores em **centavos inteiros**; formatação só na tela.
- Excluir/arquivar conta com lançamentos: só arquivar. Excluir categoria em uso: só arquivar.
- Datas de calendário guardadas como texto `AAAA-MM-DD` (sem fuso horário).
- Fatura: compra até o dia de fechamento entra na fatura do mês; depois, na seguinte. Vencimento no mês da fatura se o dia de vencimento for maior que o de fechamento; senão, no mês seguinte.
- Recorrência no dia 31 vale o último dia de meses curtos.
- Importação: duplicado = mesma conta, data e valor (e descrição parecida) ou mesmo identificador OFX.

## 7. Requisitos não funcionais

Segurança (regras do Firestore, nada de segredo no código, dados apagáveis) · Acessibilidade (teclado, rótulos, contraste AA) · Desempenho (listas paginadas; cálculos em memória) · Confiabilidade (testes automatizados da lógica; gravação por documento; aviso quando falha a sincronização) · Português do Brasil, moeda BRL.

## 8. Qualidade

Testes unitários da lógica financeira (saldos, faturas, recorrências, orçamento, relatórios, importação) e testes de ponta a ponta dos fluxos principais.
