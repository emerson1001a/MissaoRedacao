# Missão Redação

Aplicação simples para ajudar crianças a treinar redação em etapas, com uma área separada para pai ou professor.

## Estado atual

- Fluxo infantil em missões, mostrando uma coisa por vez.
- Balões de ajuda ligados à missão atual.
- Explicação de tema e título.
- Personalização por idade.
- Painel do pai/professor com orientação, frase sugerida, o que evitar e atividade rápida.
- Modo de teste local sem IA, com feedback simples e histórico salvo no navegador.
- Estrutura pronta para Vercel, Supabase e OpenAI.

## Como testar localmente

No CMD:

```cmd
cd C:\Users\Emerson\Documents\Codex\RedacaoMiguelGPT
npm run static
```

Depois abra:

```text
http://localhost:4177
```

Esse modo serve para testar a tela, o fluxo, os balões, o rascunho e o painel do adulto. Ele não precisa de Supabase nem OpenAI.

## Como rodar com as APIs

Para testar com IA e banco, use:

```cmd
cd C:\Users\Emerson\Documents\Codex\RedacaoMiguelGPT
npm run dev
```

Antes disso, configure as variáveis abaixo em um arquivo `.env.local` ou na Vercel:

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

O arquivo `.env.example` mostra o modelo dessas variáveis.

## Banco de dados

Execute o conteúdo de `supabase-schema.sql` no SQL Editor do Supabase.

As tabelas principais são:

- `alunos`
- `redacoes`
- `leituras`
- `leitura_respostas`

## Publicação

O projeto está preparado para Vercel, mas ainda não foi publicado por aqui.

Antes de publicar:

1. Criar ou escolher um projeto no Supabase.
2. Executar `supabase-schema.sql`.
3. Configurar as variáveis de ambiente na Vercel.
4. Fazer deploy.
5. Testar o envio de redação e o painel do adulto.

## Observação

Esta versão foi criada separada do projeto antigo em `C:\RedacaoMiguelGPT`, para evoluir com segurança sem mexer na aplicação original.
