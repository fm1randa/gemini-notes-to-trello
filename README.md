# Gemini Notes para Trello: Guia de Configuração

Este guia orienta você na configuração do Google Apps Script que cria automaticamente cards no Trello a partir de itens de ação nas suas Anotações do Gemini do Google Meet.

---

## Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Como os Documentos de Anotações do Gemini são Identificados](#como-os-documentos-de-anotações-do-gemini-são-identificados)
3. [Obtendo Credenciais do Trello](#obtendo-credenciais-do-trello)
4. [Instalando o Script](#instalando-o-script)
5. [Instalando o Script via Clasp (Método Alternativo)](#instalando-o-script-via-clasp-método-alternativo)
6. [Configurando as Propriedades do Script](#configurando-as-propriedades-do-script)
7. [Configurando o Gatilho](#configurando-o-gatilho)
8. [Testando a Integração](#testando-a-integração)
9. [Solução de Problemas](#solução-de-problemas)

---

## Pré-requisitos

Antes de começar, certifique-se de ter:

- Uma conta Google Workspace com Anotações do Gemini habilitadas para o Google Meet
- Uma conta Trello com pelo menos um quadro
- Acesso ao Google Apps Script (script.google.com)

---

## Como os Documentos de Anotações do Gemini são Identificados

As Anotações do Gemini são Google Docs criados automaticamente pelo Google Meet após o término das reuniões. O script os identifica usando vários critérios:

### Padrões de Nomenclatura de Documentos

Os documentos de Anotações do Gemini são criados em português brasileiro e seguem esta convenção de nomenclatura:

- `[Título da Reunião] - Anotações do Gemini`

Por exemplo: "Sincronização Semanal da Equipe - Anotações do Gemini" ou "Reunião de Planejamento de Produto - Anotações do Gemini"

### Estrutura do Documento

O script valida os documentos verificando as seções padrão das Anotações do Gemini em português brasileiro:

- **Resumo** - Resumo da reunião gerado por IA
- **Detalhes** - Pontos detalhados da discussão da reunião
- **Próximas etapas sugeridas** - Próximas etapas e itens de ação sugeridos

### Local de Armazenamento

As Anotações do Gemini são salvas no seu Google Drive, normalmente na pasta raiz ou em uma pasta "Gravações do Meet". O script pesquisa todo o seu Drive em busca de documentos correspondentes.

### Lógica de Filtragem

O script evita reprocessamento ao:

1. Rastrear IDs de documentos processados nas Propriedades do Script
2. Escanear apenas documentos modificados dentro do período de retrospecção configurado (padrão: 2 horas)
3. Validar a estrutura do documento antes do processamento

---

## Obtendo Credenciais do Trello

Você precisará de quatro informações do Trello:

### Passo 1: Obtenha sua Chave de API

1. Acesse https://trello.com/power-ups/admin
2. Clique em **New** para criar um novo Power-Up (ou use um existente)
3. Preencha os campos obrigatórios (nomeie algo como "Integração Anotações do Gemini")
4. Uma vez criado, encontre sua **API Key** na página de detalhes do Power-Up
5. Copie e salve esta chave com segurança

### Passo 2: Gere um Token de Autenticação

1. Na mesma página do Power-Up, clique no link para gerar um **Token**
2. Alternativamente, visite esta URL (substitua `SUA_CHAVE_API`):
   ```
   https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=SUA_CHAVE_API
   ```
3. Clique em **Allow** para autorizar a integração
4. Copie o token exibido e salve-o com segurança

### Passo 3: Encontre o ID do seu Quadro

Opção A - A partir da URL:

1. Abra seu quadro Trello de destino em um navegador
2. A URL se parece com: `https://trello.com/b/ID_DO_QUADRO/nome-do-quadro`
3. Copie a parte `ID_DO_QUADRO` (8 caracteres, alfanumérico)

Opção B - Usando a API:

1. Visite: `https://api.trello.com/1/members/me/boards?key=SUA_CHAVE_API&token=SEU_TOKEN`
2. Encontre seu quadro na resposta JSON
3. Copie o campo `id`

### Passo 4: Encontre o ID da sua Lista

1. Visite esta URL (substitua os valores):
   ```
   https://api.trello.com/1/boards/ID_DO_SEU_QUADRO/lists?key=SUA_CHAVE_API&token=SEU_TOKEN
   ```
2. Encontre a lista onde você quer que os cards sejam criados (por exemplo, "A Fazer" ou "Itens de Ação")
3. Copie o campo `id` dessa lista

### Resumo dos Valores Necessários

| Propriedade | Valor de Exemplo | Onde Encontrar |
|-------------|------------------|----------------|
| `TRELLO_API_KEY` | `a1b2c3d4e5f6...` | Página de administração do Power-Up do Trello |
| `TRELLO_TOKEN` | `xyz789abc123...` | Gerado via URL de autorização |
| `TRELLO_BOARD_ID` | `5f4e3d2c1b0a` | Da URL do quadro ou API |
| `TRELLO_LIST_ID` | `9a8b7c6d5e4f` | Do endpoint de listas da API |

---

## Instalando o Script (Método Manual)

> **Dica**: Para uma instalação mais rápida com suporte a desenvolvimento local, controle de versão Git e sincronização automática, veja a seção [Instalando o Script via Clasp](#instalando-o-script-via-clasp-método-alternativo) abaixo.

### Passo 1: Crie um Novo Projeto no Apps Script

1. Acesse https://script.google.com
2. Clique em **Novo projeto**
3. Nomeie seu projeto (por exemplo, "Gemini Notes para Trello")

### Passo 2: Adicione os Arquivos do Script

O projeto é organizado em múltiplos arquivos para melhor manutenibilidade. Você precisará criar cada arquivo separadamente no editor do Apps Script:

1. No editor, clique em **+** ao lado de "Arquivos" para adicionar novos arquivos
2. Crie os seguintes arquivos e copie o conteúdo correspondente de cada arquivo deste repositório:

   **Arquivos principais:**
   - `main.gs` - Função principal de processamento
   - `configuration.gs` - Gerenciamento de configuração
   - `store.gs` - Gerenciamento de estado
   - `notifications.gs` - Sistema de notificações
   - `document-processing.gs` - Processamento de documentos
   - `notes-finder.gs` - Detecção de documentos de Anotações do Gemini

   **Serviços de integração (pasta `service/`):**
   - `service/gemini-service.gs` - Integração com API Gemini
   - `service/trello-service.gs` - Integração com API Trello

   **Testes (pasta `test/`):**
   - `test/test-detection.gs` - Teste de detecção de documentos
   - `test/test-gemini.gs` - Teste de conexão Gemini
   - `test/test-trello.gs` - Teste de conexão Trello

3. Após adicionar todos os arquivos, pressione **Ctrl+S** (ou Cmd+S) para salvar

### Passo 3: Habilite os Serviços Necessários

O script usa estes serviços do Google (geralmente habilitados por padrão):

- **Drive API** - Para pesquisar documentos
- **Document API** - Para ler conteúdos de documentos
- **Mail API** - Para notificações de erro

Se você encontrar erros de permissão, vá em **Serviços** (ícone +) e adicione:

- Google Drive API
- Google Docs API

---

## Instalando o Script via Clasp (Método Alternativo)

Se você prefere desenvolver localmente e usar controle de versão, o clasp (Command Line Apps Script Projects) é a ferramenta ideal.

### Passo 1: Instalar o Node.js e o Clasp

1. Certifique-se de ter o Node.js instalado (versão 18 ou superior):
   ```bash
   node --version
   ```

2. Instale o clasp globalmente:
   ```bash
   npm install -g @google/clasp
   ```

3. Verifique a instalação:
   ```bash
   clasp --version
   ```

### Passo 2: Fazer Login no Clasp

1. Faça login na sua conta Google:
   ```bash
   clasp login
   ```

2. Isso abrirá uma janela do navegador para autenticação
3. Autorize o acesso do clasp ao Google Apps Script
4. Após a autorização bem-sucedida, você verá uma mensagem de confirmação

### Passo 3: Configurar o Projeto (Nova Instalação)

**Opção A - Clonar este Repositório:**

1. Clone o repositório:
   ```bash
   git clone https://github.com/fm1randa/gemini-notes-to-trello.git
   cd gemini-notes-to-trello
   ```

2. Instale as dependências de desenvolvimento:
   ```bash
   npm install
   ```

3. Crie um novo projeto Apps Script:
   ```bash
   clasp create --type standalone --title "Gemini Notes para Trello"
   ```

4. Isso criará um arquivo `.clasp.json` localmente (já está no .gitignore)

**Opção B - Conectar a um Projeto Existente:**

1. Acesse https://script.google.com
2. Encontre o ID do seu projeto na URL: `https://script.google.com/home/projects/SEU_ID_AQUI`
3. Clone o projeto:
   ```bash
   clasp clone SEU_ID_AQUI
   ```

### Passo 4: Estrutura do Projeto

Após a configuração, seu projeto terá esta estrutura:

```
gemini-notes-to-trello/
├── .clasp.json              # Configuração do clasp (não versionado)
├── .gitignore               # Ignora .clasp.json e node_modules
├── appsscript.json          # Manifesto do Apps Script
├── package.json             # Dependências do projeto
├── main.gs                  # Função principal
├── configuration.gs         # Gerenciamento de configuração
├── store.gs                 # Gerenciamento de estado
├── notifications.gs         # Sistema de notificações
├── document-processing.gs   # Processamento de documentos
├── notes-finder.gs          # Detecção de documentos
├── service/
│   ├── gemini-service.gs    # Integração com API Gemini
│   └── trello-service.gs    # Integração com API Trello
└── test/
    ├── test-detection.gs    # Teste de detecção de documentos
    ├── test-gemini.gs       # Teste de conexão Gemini
    └── test-trello.gs       # Teste de conexão Trello
```

### Passo 5: Fazer Push do Código para o Apps Script

1. Envie todos os arquivos locais para o Google Apps Script:
   ```bash
   clasp push
   ```

2. Se houver conflitos, você pode forçar o push (cuidado, isso sobrescreverá o código remoto):
   ```bash
   clasp push --force
   ```

3. Confirme que os arquivos foram enviados:
   ```bash
   clasp status
   ```

### Passo 6: Abrir o Editor Online

Para verificar o código ou configurar propriedades, abra o editor web:

```bash
clasp open
```

Isso abrirá o projeto no editor do Google Apps Script no seu navegador.

### Passo 7: Fazer Pull de Mudanças Remotas

Se você fez alterações no editor web e quer sincronizar localmente:

```bash
clasp pull
```

### Comandos Úteis do Clasp

| Comando | Descrição |
|---------|-----------|
| `clasp create` | Cria um novo projeto Apps Script |
| `clasp clone <scriptId>` | Clona um projeto existente |
| `clasp push` | Envia código local para Apps Script |
| `clasp pull` | Baixa código do Apps Script |
| `clasp open` | Abre o projeto no editor web |
| `clasp deployments` | Lista todos os deployments |
| `clasp deploy` | Cria um novo deployment |
| `clasp logs` | Mostra logs de execução |
| `clasp run <function>` | Executa uma função específica |

### Fluxo de Trabalho Recomendado

1. **Desenvolvimento Local**:
   ```bash
   # Edite os arquivos .gs localmente
   # Teste suas alterações
   clasp push
   ```

2. **Teste no Apps Script**:
   ```bash
   clasp open
   # Execute as funções de teste no editor web
   # Verifique os logs
   ```

3. **Sincronize Mudanças**:
   ```bash
   # Se fez alterações online
   clasp pull

   # Commit no git
   git add .
   git commit -m "feat: nova funcionalidade"
   git push
   ```

### Resolução de Problemas com Clasp

#### Erro: "User has not enabled the Apps Script API"

1. Acesse https://script.google.com/home/usersettings
2. Ative "Google Apps Script API"
3. Tente fazer login novamente: `clasp login`

#### Erro: "Could not read API credentials"

1. Faça logout e login novamente:
   ```bash
   clasp logout
   clasp login
   ```

#### Erro de Permissão ao Fazer Push

1. Verifique se você tem permissão de editor no projeto
2. Verifique o ID do projeto em `.clasp.json`
3. Use `clasp open` para confirmar que está no projeto correto

#### Arquivos .gs Não Aparecem Após Push

1. Verifique se os arquivos têm a extensão `.gs`
2. Confirme que `appsscript.json` está na raiz do projeto
3. Use `clasp push --watch` para sincronização automática durante desenvolvimento

### Vantagens de Usar Clasp

- **Controle de Versão**: Use Git para rastrear todas as mudanças
- **Editor Local**: Use seu IDE favorito (VS Code, IntelliJ, etc.)
- **TypeScript**: Suporte a autocomplete com `@types/google-apps-script`
- **CI/CD**: Automatize deployments com GitHub Actions ou similar
- **Backup**: Todo o código fica versionado no Git
- **Colaboração**: Múltiplos desenvolvedores podem trabalhar no mesmo projeto

---

## Configurando as Propriedades do Script

As Propriedades do Script armazenam sua configuração de forma segura sem expor credenciais no código.

### Passo 1: Abra as Propriedades do Script

1. No editor do Apps Script, clique em **Configurações do projeto** (ícone de engrenagem)
2. Role até **Propriedades do script**
3. Clique em **Adicionar propriedade do script**

### Passo 2: Adicione as Propriedades Obrigatórias

Adicione estas quatro propriedades obrigatórias:

| Propriedade | Valor |
|-------------|-------|
| `TRELLO_API_KEY` | Sua chave de API do Trello |
| `TRELLO_TOKEN` | Seu token de autenticação do Trello |
| `TRELLO_BOARD_ID` | O ID do seu quadro de destino |
| `TRELLO_LIST_ID` | O ID da sua lista de destino |

### Passo 3: Adicione Propriedades Opcionais

| Propriedade | Padrão | Descrição |
|-------------|--------|-----------|
| `GEMINI_API_KEY` | (nenhum) | Chave de API do Gemini para reescrever itens de ação no modo imperativo |
| `NAME_PATTERN` | `Filipe` | Nome para corresponder aos itens de ação (suporta regex) |
| `NOTIFICATION_EMAIL` | Seu email | Para onde enviar alertas de erro |
| `LOOKBACK_HOURS` | `2` | Horas para retroceder em busca de novos documentos |

Para obter uma chave de API do Gemini, visite o [Google AI Studio](https://aistudio.google.com/apikey) e crie uma nova chave de API.

### Alternativa: Configuração Rápida via Código

Você também pode configurar usando a função `quickSetupTrello()`:

1. Abra o editor de scripts
2. Encontre a função `quickSetupTrello()` próximo ao final
3. Substitua os valores de espaço reservado por suas credenciais reais
4. Execute a função uma vez (Selecione-a e clique em ▶️ Executar)
5. Exclua suas credenciais do código após a execução

---

## Configurando o Gatilho

O script precisa de um gatilho baseado em tempo para executar automaticamente.

### Opção 1: Usando a Função Integrada

1. No editor de scripts, selecione `createHourlyTrigger` no menu suspenso de funções
2. Clique em **Executar** (▶️)
3. Conceda permissões quando solicitado
4. O gatilho agora está ativo

### Opção 2: Configuração Manual do Gatilho

1. Clique em **Gatilhos** (ícone de relógio) na barra lateral esquerda
2. Clique em **+ Adicionar gatilho**
3. Configure:
   - **Função a executar**: `processGeminiNotes`
   - **Origem do evento**: Baseado em tempo
   - **Tipo**: Temporizador de hora
   - **Intervalo de hora**: A cada hora
4. Clique em **Salvar**

### Configurações Recomendadas do Gatilho

| Configuração | Valor Recomendado | Observações |
|--------------|-------------------|-------------|
| Frequência | A cada 1 hora | Equilibra responsividade com uso de cota |
| Notificação de falha | Imediatamente | Seja alertado se o script quebrar |

### Concedendo Permissões

Na primeira execução, o Google solicitará que você autorize:

1. **Ver e gerenciar arquivos no Google Drive** - Para pesquisar Anotações do Gemini
2. **Ver e gerenciar Google Docs** - Para ler conteúdos de documentos
3. **Enviar e-mail como você** - Para notificações de erro
4. **Conectar-se a serviços externos** - Para chamadas à API do Trello

Clique nas etapas do fluxo de autorização. Se você ver "Este aplicativo não foi verificado":

1. Clique em **Avançado**
2. Clique em **Ir para [Nome do Projeto] (não seguro)**
3. Revise e clique em **Permitir**

---

## Testando a Integração

Antes de confiar no gatilho automatizado, teste cada componente:

### Teste 1: Verificar Configuração

```javascript
// Execute esta função no editor de scripts
showCurrentConfig()
```

Verifique os logs para garantir que todas as propriedades obrigatórias mostrem "✓ Definido".

### Teste 2: Testar Conexão com o Trello

```javascript
// Execute esta função
testTrelloConnection()
```

Você deve ver:
- ✓ Conectado com sucesso ao quadro: [Nome do Seu Quadro]
- ✓ Conectado com sucesso à lista: [Nome da Sua Lista]

### Teste 3: Testar Conexão com a API do Gemini

```javascript
// Execute esta função
testGeminiConnection()
```

Isso testa a integração da API do Gemini para reescrever itens de ação no modo imperativo. Você deve ver:

- Itens de ação originais (por exemplo, "Filipe vai enviar o relatório até sexta-feira")
- Versões reescritas no modo imperativo (por exemplo, "Enviar o relatório até sexta-feira")

Se `GEMINI_API_KEY` não estiver configurado, o teste mostrará instruções sobre como obter uma.

### Teste 4: Testar Detecção de Documentos

```javascript
// Execute esta função
testDocumentDetection()
```

Isso pesquisa os últimos 7 dias por Anotações do Gemini e mostra:

- Documentos encontrados
- Itens de ação extraídos
- Prazos detectados

### Teste 5: Teste de Integração Completo

1. Participe de um Google Meet com Anotações do Gemini habilitadas
2. Certifique-se de que alguém diga "[Seu Nome] vai [fazer algo]"
3. Aguarde a geração das Anotações do Gemini (geralmente 5-10 minutos após a reunião)
4. Execute `processGeminiNotes()` manualmente
5. Verifique seu quadro Trello para o novo card

---

## Solução de Problemas

### Nenhum Documento Encontrado

**Sintomas**: O script reporta 0 documentos encontrados

**Soluções**:

1. **Verifique os padrões de nomenclatura**: Abra um documento de Anotações do Gemini e verifique se o título corresponde aos padrões esperados
2. **Estenda o período de retrospecção**: Defina temporariamente `LOOKBACK_HOURS` para `168` (1 semana) para testes
3. **Verifique as permissões**: Certifique-se de que o script pode acessar seus arquivos do Drive
4. **Verifique se as Anotações do Gemini estão habilitadas**: Verifique as configurações de administrador do Google Workspace

### Itens de Ação Não Detectados

**Sintomas**: Documentos encontrados mas 0 itens de ação extraídos

**Soluções**:

1. **Verifique a grafia do nome**: Certifique-se de que `NAME_PATTERN` corresponde exatamente a como seu nome aparece
2. **Revise o formato do documento**: Abra as Anotações do Gemini e verifique como os itens de ação estão formatados
3. **Teste com variações**: Tente definir `NAME_PATTERN` apenas para seu primeiro nome

### Erros da API do Trello

**Sintomas**: "Erro da API do Trello" nos logs

**Soluções**:

| Erro | Causa | Solução |
|------|-------|---------|
| 401 Unauthorized | Credenciais inválidas | Regenere a chave de API e o token |
| 404 Not Found | ID de quadro/lista errado | Verifique novamente os IDs usando a API |
| 429 Rate Limited | Muitas solicitações | O script tenta novamente automaticamente; reduza a frequência do gatilho se persistir |

### Erros de Permissão

**Sintomas**: Erros "Você não tem permissão"

**Soluções**:

1. Execute novamente a autorização removendo o script de Aplicativos conectados:
   - Acesse https://myaccount.google.com/permissions
   - Encontre e remova o script
   - Execute o script novamente para reautorizar

### Cards Duplicados

**Sintomas**: O mesmo item de ação cria vários cards

**Soluções**:

1. O script rastreia documentos processados - isso não deve acontecer normalmente
2. Execute `clearProcessedHistory()` se precisar redefinir (reprocessará todos os documentos)
3. Verifique se o mesmo item de ação aparece várias vezes no documento de origem

### Notificações por Email Não Funcionam

**Sintomas**: Ocorrem erros mas nenhum email é recebido

**Soluções**:

1. Verifique se `NOTIFICATION_EMAIL` está definido corretamente
2. Verifique a pasta de spam
3. Certifique-se de que a cota do MailApp não foi excedida (100 emails/dia)

---

## Apêndice: Padrões de Detecção de Itens de Ação

O script reconhece estes formatos (sem distinção entre maiúsculas e minúsculas):

| Padrão | Exemplo |
|--------|---------|
| `[Nome] will...` | "Filipe will send the report" |
| `[Nome] to...` | "Filipe to schedule the meeting" |
| `Action: [Nome] -...` | "Action: Filipe - review PR" |
| `@[Nome]:...` | "@Filipe: update documentation" |
| `[ ] [Nome]:...` | "[ ] Filipe: fix the bug" |
| `- [Nome]:...` | "- Filipe: prepare slides" |
| `[Nome] -...` | "Filipe - follow up with client" |

O script também escaneia seções de "Action Items" ou "Next Steps" para qualquer menção do nome configurado.

---

## Apêndice: Exemplos de Personalização

### Corresponder Vários Nomes

Para capturar itens de ação para várias pessoas, use regex:

```
NAME_PATTERN: Filipe|Phil|F\. Silva
```

### Frequência Diferente do Gatilho

Para verificações mais frequentes (a cada 15 minutos):

```javascript
function createFrequentTrigger() {
  ScriptApp.newTrigger('processGeminiNotes')
    .timeBased()
    .everyMinutes(15)
    .create();
}
```

### Etiquetas Personalizadas de Card

Modifique a função `createTrelloCard()` para adicionar etiquetas:

```javascript
// Adicione ao objeto params
params.idLabels = ['ID_DA_ETIQUETA_AQUI'];
```

---

## Suporte

Se você encontrar problemas não cobertos aqui:

1. Verifique o **Log de execução** no Apps Script para mensagens de erro detalhadas
2. Execute `testDocumentDetection()` e `testTrelloConnection()` para isolar o problema
3. Verifique se suas credenciais da API do Trello não expiraram

O script registra extensivamente - a maioria dos problemas pode ser diagnosticada a partir dos logs de execução.
