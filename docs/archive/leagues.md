# Ligas: registro de produto

> Arquivo. O domínio de ligas foi descontinuado por decisão de 25/09/2026 (deletar de vez, não congelar). Este é o registro do que a liga era e de como funcionava, escrito para ser relido depois que o código não existir mais. Daqui para baixo não há referência a código: há produto.

## 1. O que era a liga e onde ela vivia

A liga era a competição contínua do app: sem data de fim, sem chave e sem inscrição por categoria. O jogo era o desafio entre membros, e o resultado mexia numa lista ordenada por posição, o ranking. O torneio é o oposto: começa, tem chave, termina e coroa alguém. Uma decisão de origem: a liga pertence à organização (o ator organizador do app), não a uma pessoa. Quem gerencia a organização ativa cria e administra, e a liga vive ou morre com ela.

Onde a liga aparecia:

- **Minhas Competições**, a aba que listava o que o jogador participa (liga e torneio na mesma lista) e oferecia o card "Nova liga" para o organizador.
- **Busca**: liga pública aparecia para qualquer um; a privada só para o organizador. A busca cruzava nome, cidade, UF, descrição e categorias, sem acento.
- **Casa da liga**, com as abas Overview, Ranking, Desafios e, só para o organizador, Solicitações. Regras, Agenda e Editar ficavam no menu de opções. O Overview mudava por papel: visitante via descrição com vagas e preço, jogador via as pendências e os números dele, organizador via os números da liga.
- **Assistente de criação e edição**, com seis abas (Detalhes, Local, Categorias, Quadras, Regras, Ajustes) e um único salvar no fim. Erro de validação levava à aba com problema. Capa em 16:9 e avatar em 1:1 eram recortados no app e enviados no salvar. A mesma casa servia para editar, inclusive as regras, e para excluir a liga com confirmação.

## 2. Papéis e permissões

Três papéis: **organizador**, **jogador** (vínculo ativo) e **visitante**. Quem gerencia a organização e é dono da liga é organizador, mesmo que também jogue nela.

**O organizador podia:**

- Criar, editar e excluir a liga, trocar capa e avatar e mudar qualquer regra depois de criada.
- Configurar quadras, com nome único e disponibilidade semanal.
- Ver a aba Solicitações e aprovar, recusar ou remover membros.
- Reordenar o ranking manualmente, arrastando a lista.
- Com validação manual, validar o desafio e validar o resultado.
- Cancelar, invalidar e reabrir desafio, pedir correção de placar e lembrar alguém de lançar o resultado.
- Corrigir um resultado já publicado (placar, vencedor ou W.O.), com registro da ação.
- Ver sempre Regras e Agenda, além de receita, inscritos e partidas do mês.

**O jogador (membro ativo) podia:**

- Ver ranking, desafios, regras e agenda (esta conforme a visibilidade escolhida).
- Desafiar quem estava acima dele na lista, respeitando a distância máxima, o limite de desafios ativos (dele e do adversário) e o limite mensal de desafios criados.
- Propor data, hora e quadra; aceitar, recusar ou contrapropor; pedir cancelamento, que dependia do aceite do outro lado.
- Lançar o placar, inclusive como W.O., e confirmar o placar lançado pelo adversário.
- Aparecer no ranking com posição e receber a última posição ao entrar.
- Ver posição, partidas do mês, vitórias, derrotas e aproveitamento, além das pendências que precisavam dele.
- **Não** podia sair da liga por conta própria. Só cancelava um pedido que ainda não tinha virado vínculo.

**O visitante podia:**

- Ver a página da liga pública, com descrição, vagas e preço.
- Solicitar entrada ou pagar a inscrição quando a liga era paga, e cancelar a própria solicitação enquanto ela estava pendente ou aguardando pagamento.
- Ver a agenda só quando ela era pública. Ranking, desafios e solicitações ficavam fora.

## 3. Ciclo de vida

**Entrada e inscrição.** Liga gratuita mandava o pedido para uma fila pendente e avisava o organizador, que aprovava ou recusava. Liga paga mandava direto para o checkout PIX (aguardando pagamento) e só avisava a organização depois do pagamento; com aprovação automática o vínculo ativava na hora, com aprovação manual ele ficava pendente para o organizador decidir. A capacidade era conferida na solicitação e de novo no pagamento: se a liga lotou enquanto o jogador pagava, a cobrança era estornada e o vínculo caía. Aprovar ou recusar só valia para solicitação ainda pendente, para que botão velho de notificação não reativasse nem derrubasse vínculo já resolvido.

**Mensalidade.** A cobrança era PIX com divisão entre organizador e BR Open. O organizador escolhia valor e intervalo (único, semanal, mensal, trimestral ou anual); valor zero significava liga gratuita, sem ciclo. Antes do vencimento o jogador recebia um lembrete, que era uma notificação viva por ciclo: o aviso do dia reescrevia o anterior em vez de criar outro. Passado o vencimento entrava a carência e, depois dela, a suspensão. Renovação antecipada era liberada dentro da janela de lembrete, e o período novo empilhava a partir do vencimento atual, sem perder dias. O suspenso perdia o acesso (voltava a ser visitante) mas mantinha a vaga: renovar não disputava vaga com quem estava entrando. Estorno, feito no painel do provedor ou disparado pelo guarda de lotação, deixava o vínculo como "saiu" e limpava a posição no ranking.

**Desafios.** O jogador escolhia um adversário acima dele e propunha data, hora e quadra. Horários já ocupados apareciam desabilitados, e o servidor recusava conflito na mesma quadra e data calculando a janela pela duração padrão da partida, não pelo horário de fim enviado pelo app. O adversário aceitava, recusava ou contrapropunha; a contraproposta reiniciava o prazo e substituía a proposta ativa, deixando as anteriores no histórico. O aceite travava data e quadra e, com validação automática, o desafio já ficava confirmado; com validação manual, ia para a validação do organizador. Depois da partida, um lado lançava o placar e o outro confirmava; no modo manual o organizador validava em seguida. Cancelamento era negociado, com pedido e aceite. O organizador podia cancelar, invalidar, reabrir e editar. Sem resposta no prazo, o desafio ia para decisão do organizador; sem resultado depois do fim do jogo, ia para aguardando resultado.

**Ranking.** Lista de posições, sem escada. Todo resultado decidido mexia nas posições: vitória tomava a posição do adversário ou subia uma, derrota ficava parado ou caía uma, conforme a regra escolhida. Novo jogador entrava no fim. W.O. tinha três variações: derrota normal, derrota com ida ao fim da lista, ou W.O. recusado como resultado (o app mandava cancelar). O organizador podia reordenar à mão, e a lista enviada tinha de ser exatamente o conjunto de membros ativos. Cada resultado guardava a posição antes e depois, e reabrir o desafio revertia o efeito.

**Agenda e quadras.** A agenda listava os desafios confirmados e encerrados a partir do dia, com status (Agendado, Encerrado, W.O., A definir) e placar, e podia ser pública ou só para membros. As quadras tinham disponibilidade semanal por dia, em faixas de 30 minutos, sem sobreposição, e o diálogo de adicionar horário aceitava vários dias na mesma ação.

**Saída e remoção.** O jogador não tinha botão de sair. O organizador podia remover um membro: o vínculo virava "removido", a posição era limpa, o ranking era renumerado e o jogador era notificado. Suspensão por falta de pagamento e estorno também tiravam o acesso. Excluir a liga apagava tudo em cascata, com confirmação e sem volta.

## 4. Regras que decidiam o comportamento

- **Partida:** melhor de 1, 3 ou 5 sets; games por set (padrão 6); duração padrão (padrão 90 minutos) que definia a janela ocupada da quadra; pontuação com vantagem tradicional ou sem vantagem; vencer o set por dois games; tie-break ligado ou desligado; pontos do tie-break em 7 ou 10; vencer o tie-break por dois pontos. O gatilho do tie-break acompanhava os games do set, e o último set tinha o mesmo formato dos demais.
- **Placar:** lista livre de linhas, com tie-break avulso opcional. Mais games vencia a linha; empate ia ao tie-break anexo. O botão de anexar tie-break só aparecia com a linha empatada e além de 0 a 0. Se a partida ficava indefinida, quem lançava escolhia o vencedor. W.O. era uma linha de 0 a 0 com marca própria.
- **Desafio:** distância máxima em posições (padrão 4, desligável); máximo de desafios ativos por jogador (padrão 1, valendo para os dois lados); máximo de desafios criados por mês (padrão 4); prazo de resposta em horas (padrão 48, desligável, e sem prazo o desafio nunca expirava); validação do desafio e do resultado em automática ou manual.
- **Ranking:** as opções de vitória, derrota e W.O. descritas acima; entrada de novo jogador só no fim da lista.
- **Inatividade:** o organizador configurava penalidade e prazo, mas nada no app aplicava (ver bloco 6).
- **Quadras:** nome único ignorando maiúsculas, faixas de 30 minutos por dia da semana, sem sobreposição.
- **Capacidade:** limite de vagas opcional. Sem lista de espera.
- **Visibilidade:** liga pública ou privada; agenda pública ou só para membros.
- **Cobrança:** valor, intervalo, aprovação automática ou manual, carência de 0 a 90 dias (padrão 7) e antecedência do lembrete de 0 a 60 dias (padrão 3). A taxa da plataforma tinha padrão de 10% com piso operacional e só era ajustável fora do app.

## 5. Decisões de produto que valem se a liga voltar

- A liga é da organização, não de uma pessoa.
- Um modo só: desafios. Temporadas, templates e versionamento de regras nunca existiram e nunca foram retomados.
- Regras são editáveis depois da criação. Travar regras foi abandonado.
- O vocabulário é organizador, não admin, e os papéis são organizador, jogador e visitante.
- A configuração da partida é congelada no desafio: mudar as regras da liga não altera partida já marcada.
- Cancelamento é negociado, com pedido e aceite do outro lado.
- Toda ação do organizador sobre desafio e resultado deixa auditoria.
- Placar manual é livre: as regras valem para o formato da partida, não para conferir o que foi digitado. A validação só cobra sanidade (números inteiros, ao menos uma linha, exatamente um vencedor).
- O gatilho do tie-break deriva dos games; os pontos são 7 ou 10; o botão de anexar é contextual ao empate.
- O último set tem o mesmo formato dos demais.
- Status e placar da agenda usam o mesmo vocabulário do card padrão do app.
- W.O. espelha o torneio: mesmo formato de dados, sem estado novo no ciclo, com confirmação da contraparte ou do organizador.
- O organizador é o editor único de resultado já publicado.
- Alerta de pagamento em tela vem do servidor, não de regra montada na tela. Pagar e renovar são a mesma ação interna, só muda o rótulo.
- O calendário oficial das séries e dos textos de vencimento é o do Brasil. A agenda da liga ficou em UTC, divergência assumida.
- Componentes de partida, placar, agenda, regras e rodapé de inscrição nasceram na liga e foram reutilizados pelo torneio.

## 6. O que ficou estranho, incompleto ou duvidoso

- **A penalidade por inatividade era decorativa.** O organizador configurava penalidade e prazo e nada acontecia. Também não havia rotina automática que expirasse desafio sem resposta, marcasse partida atrasada como W.O. ou resetasse os contadores do mês. Quem confiasse na configuração acreditava numa autorregulação que não existia.
- **Aprovação manual em liga paga cobrava antes de decidir.** O jogador pagava e só depois podia ser recusado, e recusar não estornava. O dinheiro ficava com a organização até alguém estornar manualmente no painel do provedor. Era a aresta mais afiada do desenho.
- **As categorias da liga quase não faziam nada.** Serviam à busca e à descrição. Não havia ranking, desafio nem inscrição por categoria (isso é do torneio), e mesmo assim a criação exigia pelo menos uma categoria.
- **Não existia saída do jogador.** Só dava para cancelar pedido antes de entrar. Sair de liga ativa não existia, nem a política de dinheiro do ciclo já pago.
- **Reembolso automático nunca chegou à liga.** O estorno nasceu no torneio e ficou lá.
- **Não havia aba Financeiro da liga.** A receita da liga era um número montado na tela, somando a origem de mensalidade numa janela de 12 meses. A tela por liga e o extrato nunca existiram. A taxa da plataforma por liga também não tinha tela, só o valor no banco.
- **O ranking não tinha trilha.** Reordenação manual e mudanças por aprovação ou remoção de membro não deixavam registro persistente. Só os resultados guardavam posição antes e depois.
- **A lista de horários ocupados podia enganar.** Para desafios criados antes de o servidor passar a derivar a janela da partida, ela desabilitava menos horários do que devia até a proposta ser renovada. A proteção real era o servidor, que recalculava na hora de aceitar.
- **O push não tinha botão.** Os eventos de desafio chegavam ao sistema sem ação; a ação existia dentro do app, na central.
- **Duas noções de "hoje".** A agenda da liga usava o dia UTC e o dashboard do jogador usava o dia do Brasil. Entre 21h e 23h59 os dois discordavam sobre qual jogo era o de hoje.
- **W.O. sem vencedor pintado na agenda da liga**, embora o card já mostrasse o chip de W.O.
- **Um rótulo que nunca aparecia:** "Entrar como jogador" existia para o organizador, mas o rodapé de entrada só montava para visitante.
- **Nomenclatura vazando:** quando o produto já dizia organizador, nomes internos e comentários ainda diziam admin.
- **Liga cheia não tinha espera.** Sem lista de espera nem fila por ordem de chegada: quem pagava depois de lotar levava estorno em vez de uma posição na fila.
- **Cadastros antigos ficavam com chaves inertes** de regras que saíram do formato (por exemplo o grupo do último set). A leitura ignorava, sem migração destrutiva.

## 7. Ganchos com o resto do produto

- **Pagamento.** A mensalidade era uma origem entre outras do mesmo sistema polimórfico de cobrança: a origem diz de quem é a cobrança e quem pode pagá-la. O checkout é rota própria, reexibe o PIX de uma cobrança existente e deixou de ser beco sem saída (cobrança paga ou expirada podia gerar novo PIX). A entrada na liga e a renovação usam a mesma ação.
- **Pendências e notificações.** A liga alimentava itens do servidor com recorte próprio: pagamento vencendo, pagamento atrasado, inscrição suspensa, desafios precisando de atenção, risco de inatividade, conta de pagamento faltando na organização, solicitações de entrada e validações esperando o organizador. Os mesmos itens apareciam na home e na casa da liga, e a ação de pagar ou renovar é a mesma nos itens e nas notificações. Os eventos de desafio e de vínculo, cerca de duas dezenas, percorriam a mesma central e o mesmo push do resto do app.
- **Dashboard do jogador.** Posição por liga com série histórica de posições e vitórias e derrotas consolidadas. A casa da liga mostrava uma fatia disso: posição, partidas do mês e desempenho.
- **Painel do organizador.** A receita da organização quebrava por competição, com a compra de torneio entrando na mesma série.
- **Organização.** Quem gerencia a organização ativa cria ligas e é dono delas; as capacidades do ator ativo (criar, gerenciar, participar) decidem o que aparece na tela.
- **Torneio.** Herdou primitivas que nasceram na liga: seções de regras de partida, diálogo de placar, card de agenda, rodapé de inscrição e a fila de aprovação de entrada. A lição registrada na decisão de remoção foi exatamente essa: extrair antes de apagar.
