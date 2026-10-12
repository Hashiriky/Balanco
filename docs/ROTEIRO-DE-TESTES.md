# Roteiro de testes (versões 1.1 a 1.8.3)

Como usar: rode `npm run dev`, abra o site e vá marcando. Se algo não se comportar como descrito, anote **o que fez**, **o que esperava** e **o que aconteceu** (e a mensagem de erro, se houver: tecla F12, aba *Console*) e me envie.

> Dica: antes de testar, baixe um backup em Ajustes. Os testes de "Apagar tudo" e "Substituir tudo" só devem ser feitos com dados de teste.

## Contas (1.1 e 1.5)
- [ ] Criar uma conta corrente com **Banco** (ex.: Nubank) e uma **cor**. A cor aparece ao lado do nome nas listas.
- [ ] Marcar a conta como **Principal**. Marcar outra como principal desmarca a primeira.
- [ ] Um cartão de crédito **não** mostra a opção "Conta principal".
- [ ] Na tela **Contas**, as contas aparecem **agrupadas por banco**, com os títulos bem visíveis e o total de cada banco.
- [ ] Contas sem banco ficam no grupo "Sem banco", no fim.
- [ ] Arquivar a conta principal: o novo lançamento deixa de abrir nela.

## Lançamentos (1.2, 1.3 e 1.4)
- [ ] **Novo lançamento** abre com a conta principal já escolhida.
- [ ] Com erros em vermelho (tente salvar vazio), o rótulo **Descrição** continua visível, sem ficar atrás de Despesa/Receita.
- [ ] Os **Atalhos** ficam numa linha abaixo da Descrição; ao digitar, mostram só os parecidos, sem o formulário pular.
- [ ] **Salvar e novo** salva e deixa o formulário pronto, mantendo tipo, conta e data.
- [ ] **Repetir último** preenche descrição, valor, conta e categoria do lançamento mais recente.
- [ ] Depois de repetir uma descrição 2 vezes, ela aparece como botão em **Mais usados**.
- [ ] **Clicar fora** do formulário não fecha a janela.
- [ ] Digitar algo e apertar **Esc** pergunta se quer descartar. Sem digitar nada, o Esc fecha direto.
- [ ] Com uma janela aberta, a **roda do mouse não rola a tela de trás**.
- [ ] Tecla **N** (fora de campos de texto) abre uma despesa nova.

## Busca (1.4)
- [ ] Tecla **/** em uma tela sem campo de busca abre a **Busca global**.
- [ ] Buscar por descrição, por valor (ex.: `50`) e por duas palavras (ex.: `mercado 50`).
- [ ] Clicar em um resultado abre o detalhe do lançamento.
- [ ] Na tela Lançamentos, a tecla **/** leva ao campo de busca da própria tela.

## Seletor de período (1.6)
- [ ] Em **Lançamentos**, o botão de período mostra o mês atual e as setas de mês continuam no topo.
- [ ] Abrir o seletor e clicar em **Mês passado**, depois **Aplicar**: a lista muda e as setas de mês somem.
- [ ] No calendário, clicar no dia inicial e depois no final: o intervalo fica marcado e o resumo mostra o total de dias.
- [ ] Clicar o dia final **antes** do inicial: os dois se invertem sozinhos.
- [ ] Digitar as datas nos campos **De** e **Até** atualiza o calendário.
- [ ] **Cancelar** fecha sem mudar nada. **Voltar ao mês selecionado** restaura o comportamento antigo.
- [ ] Em **Relatórios**, os atalhos funcionam e um intervalo escolhido no calendário atualiza gráficos e tabelas.
- [ ] Em Relatórios, **Todo o período** com mais de 36 meses mostra o aviso "últimos 36 meses".
- [ ] Um período de 1 dia ou de poucos dias em Relatórios não quebra a tela.

## Painel e Novidades (1.1, 1.2)
- [ ] Receitas, despesas e resultado mostram a **comparação com o mês anterior**.
- [ ] O item **Novidades** do menu mostra um ponto azul quando há versão não vista, e o ponto some ao abrir.

## Orçamento (1.5)
- [ ] Editar um orçamento e marcar **Levar a sobra para o mês seguinte**.
- [ ] No mês seguinte, o limite mostra "inclui R$ X de sobra" quando sobrou dinheiro.

## Relatórios e impressão (1.4)
- [ ] **Imprimir / salvar PDF** abre a impressão; no PDF os gráficos mantêm as cores e os cartões não são cortados.

## Ajustes e backup (1.4)
- [ ] **Substituir tudo** (restaurar backup) baixa antes um arquivo de cópia de segurança.
- [ ] **Apagar tudo** baixa antes um arquivo de cópia de segurança.

## Folga do mês e categoria automática (1.7)
- [ ] No **Painel**, abaixo do saldo previsto, aparece "dá para gastar, em média, R$ X por dia" (ou o aviso de que não há folga).
- [ ] O valor por dia faz sentido: saldo previsto dividido pelos dias que faltam no mês (hoje conta como um dia).
- [ ] Ao lançar uma descrição que **já usou antes** (ex.: "Mercado") e sair do campo, a **categoria** é preenchida sozinha com a nota "Sugerida pelo seu histórico".
- [ ] Se você já escolheu uma categoria, ela **não** é trocada. Trocar a categoria na mão tira a nota.
- [ ] Descrição nova (nunca usada) não preenche categoria.

## Painel: previsão e compromissos (1.8)
- [ ] O bloco de **saldo previsto** mostra o valor em destaque, a conta explicada em uma linha e a folga por dia separada, sem textos embolados.
- [ ] O card **Compromissos dos próximos meses** lista 6 meses com Contas, Faturas, Total a pagar e A receber.
- [ ] Uma compra parcelada no cartão aparece só em **Faturas** (não também em Contas).
- [ ] Pagar uma fatura faz o valor dela sair do mês correspondente.

## Repetir todo mês e contas fixas (1.8)
- [ ] No detalhe de um lançamento comum, o botão **Repetir todo mês** abre a recorrência preenchida (descrição, valor, conta, categoria, dia) começando no mês seguinte.
- [ ] O botão **não aparece** em transferências, parcelas e lançamentos que já vêm de uma recorrência.
- [ ] Na **Agenda**, uma conta que você lançou 3 meses seguidos (mesmo valor, mesmo dia) aparece em **Sugestões de contas fixas**.
- [ ] **Criar recorrência** abre o cadastro preenchido; **Agora não** esconde a sugestão e ela não volta ao recarregar a página.
- [ ] Depois de criar a recorrência, a sugestão some.

## Alerta de gasto fora do normal (1.8)
- [ ] Quando uma categoria passa 50% da média dos últimos 3 meses, aparece um alerta amarelo no Painel com o valor do mês.
- [ ] Categorias com pouco histórico ou valores pequenos (média abaixo de R$ 100) não geram alerta.

## Avisos de vencimento (1.8.2)
- [ ] Fatura que **vence hoje**: aparece uma **faixa vermelha** no topo, em qualquer tela, com "vence HOJE: último dia para pagar sem juros", o valor e o botão **Ver**.
- [ ] Fatura **atrasada**: a faixa vermelha avisa que venceu e que pode estar gerando juros.
- [ ] Fatura que vence **amanhã**: aviso vermelho no Painel (sem faixa). De 2 a 7 dias: aviso amarelo "vence em N dias".
- [ ] **Dispensar por hoje** esconde a faixa e ela volta no dia seguinte (ou se aparecer outro aviso urgente).
- [ ] Depois de **pagar a fatura**, o aviso some.
- [ ] Uma conta comum com vencimento hoje também aparece na faixa ("1 conta vence HOJE").

## Do aviso para a fatura (1.8.3)
- [ ] Na faixa vermelha, clicar em **Ver** de uma fatura leva à tela **Contas**, rola até o cartão certo e o destaca com um **anel azul** por alguns segundos.
- [ ] Estando **já na tela Contas**, clicar em **Ver** também rola e destaca o cartão.
- [ ] Se a fatura do aviso for de **outro mês**, o painel do cartão abre nesse mês.
- [ ] Na tela Contas, o cartão com fatura **atrasada / vencendo hoje** tem contorno vermelho e uma faixa no topo com o valor e o botão **Pagar fatura**; com vencimento em até 7 dias, contorno e faixa **laranja**.
- [ ] Cartão sem urgência não ganha destaque.
- [ ] Na **Agenda**, a conta que vence hoje fica em vermelho; **Ver** do aviso "conta vence HOJE" rola até ela.

## Teclado e acessibilidade
- [ ] Dá para navegar pelo calendário do seletor com a tecla Tab e escolher dias com Enter.
- [ ] Com o sistema configurado para "reduzir movimento", o app não anima.
