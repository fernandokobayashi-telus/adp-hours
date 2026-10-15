# ADP Hours — extensão Chrome para acompanhar o ponto

> Ferramenta pessoal e não oficial. Não tem vínculo com a ADP nem com a empresa.

## O que é

Extensão do Chrome que lê a tabela de batidas de ponto da página da ADP e responde duas perguntas sem você precisar fazer conta:

- Quanto já trabalhei hoje?
- Que horas eu preciso bater o ponto para fechar 8h?

A resposta aparece em três lugares: um banner acima da tabela de ponto, um popup ao clicar no ícone da extensão e um contador direto no ícone, na barra do Chrome.

## O que você precisa

- Google Chrome
- Acesso ao repositório privado: https://github.com/fernandokobayashi-telus/adp-hours
- Node.js apenas se for rodar os testes (a extensão em si não precisa)

## Instalação

1. Clone o repositório.
2. Abra `chrome://extensions` e ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione a pasta do projeto.
4. Abra a página de ponto da ADP: `https://expert.cloud.brasil.adp.com/expert/v5/`.

A extensão só atua nesse endereço e fica inativa em qualquer outro site.

Depois de atualizar o código, clique em **Recarregar** na extensão e dê um refresh na aba da ADP.

## Como usar

### Banner

Aparece acima da tabela de batidas:

- **Trabalhado hoje:** tempo trabalhado até agora.
- **Saia às HH:MM para 8h:** horário de saída para completar 8h.
- **Volte às HH:MM · Saia às HH:MM:** quando você está no almoço.
- **✓ extras:** quanto passou das 8h.

### Ícone na barra do Chrome

O ícone mostra uma contagem regressiva até a próxima batida:

| Exemplo | Significado |
|---|---|
| `2h15` (verde) | faltam 2h15 para a próxima batida |
| `45m` (verde) | faltam 45 minutos |
| `-7m` (vermelho) | a batida já está atrasada em 7 minutos |
| `-2h` (vermelho) | atrasada em mais de 99 minutos |
| vazio | nada a sugerir (sem batidas hoje ou dia encerrado) |

A contagem continua atualizando a cada minuto mesmo com a aba da ADP fechada, e sobrevive ao reinício do navegador. O valor de um dia anterior é descartado automaticamente.

### Popup

Ao clicar no ícone, o popup mostra as mesmas informações do banner. Quando você bateu apenas a entrada, ele também mostra um lembrete amarelo para não esquecer de bater o ponto do almoço.

## Regras de cálculo

A meta é 8h trabalhadas por dia, com 1h de almoço (CLT). Só entram as batidas do dia de hoje.

| Batidas hoje | Situação | Próxima batida (contagem do ícone) |
|---|---|---|
| 0 | Não começou | nenhuma |
| 1 | Trabalhando (manhã) | saída final = entrada + 8h + 1h de almoço |
| 2 | No almoço | volta = saída do almoço + 1h |
| 3 | Trabalhando (tarde) | saída final = última entrada + (8h − tempo da manhã) |
| 4 ou mais, par | Dia encerrado | nenhuma |

O horário do almoço não é previsto, porque varia de dia para dia. O que importa é bater o ponto quando você sair e voltar: a saída sugerida é recalculada a cada batida.

Se o turno aberto já passou da hora prevista, o contador do ícone fica vermelho (atrasado) em vez de sumir.

## Limitações

- **Depende da página da ADP.** A extensão lê a tabela `data-testid="ctn_table-punchin"`. Se a ADP mudar esse HTML, a leitura para de funcionar sem aviso (aparece só um `console.warn`).
- **Precisa abrir a página de ponto.** Só a página da ADP conhece suas batidas. Se você bater o ponto e não abrir a página, o contador do ícone continua com o último valor conhecido.
- **Jornada fora do padrão.** Almoço de 30 minutos ou pausas longas que não são almoço geram uma sugestão errada até a próxima batida corrigir.
- **Fuso horário.** Usa o fuso do navegador.
- **Sem opções.** Meta de 8h e almoço de 1h são fixos no código.

## Privacidade e permissões

- Nenhum dado sai do navegador. Não há servidor, telemetria nem requisições externas.
- Permissões usadas:
  - acesso ao endereço da ADP (`host_permissions`), para ler a tabela;
  - `storage`, para guardar o horário da próxima batida;
  - `alarms`, para atualizar a contagem do ícone a cada minuto.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Banner não aparece | Abra a página de ponto (a que mostra a tabela de batidas) e dê refresh. |
| Popup diz "Abra a página de ponto da ADP" | A aba ativa não é a da ADP. |
| Popup diz "Página ainda carregando" | Dê refresh na aba da ADP. |
| `Extension context invalidated` no console | Você recarregou a extensão com a aba aberta. Dê refresh na aba. |
| Ícone mostra horário de ontem ou fica vazio | Abra a página de ponto da ADP uma vez para atualizar. |

## Desenvolvimento

```bash
npm install
npm test
```

Estrutura:

- `src/lib/` — módulos puros e testados (leitura da tabela, cálculo, formatação, banner, contador do ícone)
- `src/content.js` — observa a página da ADP, injeta o banner e avisa o service worker
- `src/background.js` — service worker que guarda a próxima batida e atualiza o ícone
- `src/popup.html` e `src/popup.js` — popup da barra do Chrome
- `docs/superpowers/` — especificação e plano da versão inicial
