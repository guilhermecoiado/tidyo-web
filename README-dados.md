# Tidyo

Gestão para empresas de limpeza nos EUA (residencial e comercial). PWA em Next.js, Supabase (Postgres + Auth + Storage), Stripe, hospedagem na Netlify.

## Estrutura do projeto

```
tidyo-app/
├─ supabase/
│  ├─ migrations/
│  │  ├─ 20261015000100_schema.sql        # tabelas, tipos, índices
│  │  ├─ 20261015000200_access_rules.sql  # RLS, regras de negócio, views, funções
│  │  └─ 20261015000300_storage_and_jobs.sql  # buckets privados e cron
│  ├─ functions/                           # Edge Functions (a criar)
│  │  ├─ stripe-webhook/                   # assinatura e pagamentos → subscriptions, payments
│  │  ├─ tidy-nightly/                     # revisão das 5h → tidy_insights
│  │  ├─ translate-message/                # preenche messages.translations
│  │  └─ send-reminders/                   # e-mail, SMS, push → message_deliveries
│  └─ tests/
│     ├─ _supabase_stub.sql                # auth/storage falsos para testar fora do Supabase
│     └─ access_rules_test.sql             # cenários de acesso por perfil
├─ src/
│  ├─ app/                                 # rotas Next.js (App Router)
│  │  ├─ (site)/                           # landing, preços, política de privacidade
│  │  ├─ (auth)/                           # entrar, criar conta, 2 etapas, convite
│  │  ├─ (owner)/                          # hoje, agenda, clientes, finanças, mais
│  │  ├─ (field)/                          # meu dia, checklist, navegação (helper)
│  │  ├─ (portal)/                         # portal do cliente
│  │  └─ (admin)/                          # superadmin: assinantes, anúncios, push, suporte
│  ├─ components/                          # botões, modais, bottom sheet, skeleton, nav
│  ├─ lib/
│  │  ├─ db-errors.ts                      # erro do banco → chave de tradução para o modal
│  │  ├─ supabase/                         # clientes browser/server
│  │  └─ offline/                          # fila local (IndexedDB) para checklist, fotos e horas
│  ├─ i18n/                                # pt-BR.json · en.json · es.json (mesmas chaves)
│  └─ styles/tokens.css                    # cores, tipografia, espaços, scrollbars, loading
└─ public/                                 # manifest, ícones, service worker
```

## Modelo de dados

| Área | Tabelas |
|---|---|
| Pessoas e empresa | `profiles`, `companies`, `memberships`, `member_pay_rates`, `subscriptions` |
| Clientes | `clients`, `properties` |
| Serviços | `services`, `checklist_templates`, `checklist_template_items` |
| Agenda | `recurrences`, `jobs`, `job_assignments`, `route_plans` |
| Execução em campo | `job_checklist_items`, `job_photos`, `job_issues`, `time_entries`, `tips`, `expenses` |
| Dinheiro | `invoices`, `invoice_lines`, `payments` |
| Comercial | `contracts`, `inspections`, `supply_items` |
| Comunicação | `conversations`, `conversation_participants`, `messages`, `notifications`, `push_subscriptions`, `message_deliveries`, `broadcasts` |
| Tidy | `tidy_insights` |
| Plataforma | `platform_admins`, `ad_campaigns`, `ad_events`, `support_tickets`, `support_messages`, `audit_log` |

Valores em centavos de dólar (inteiros). Datas em `timestamptz`; cada empresa tem seu fuso.

## Quem vê o quê

- **Dona e gerente** (staff): tudo da própria empresa. Só a dona vê a assinatura, gerencia gerentes e não pode se rebaixar.
- **Helper**: não lê `jobs` nem `clients` diretamente (preços, contatos e notas internas ficam de fora). Lê o dia em `helper_jobs()`, avança o serviço com `job_progress()`, marca checklist, envia fotos, bate ponto, registra gasto como pendente e reporta problemas. Vê só o próprio pagamento, gorjetas e rota.
- **Cliente do portal**: lê `portal_me()` e `portal_jobs()`, faturas emitidas, pagamentos, checklist e fotos de antes/depois das próprias visitas, inspeções compartilhadas. Avalia com `rate_job()` em até 24h; depois disso `auto_approve_ratings()` marca como aprovada, sem nota e sem comentário.
- **Superadmin**: assinantes, anúncios, push da plataforma e suporte.
- **Visitante sem login**: nada.

Regras no banco, não só na tela:
- limites de plano: usuários (Essencial 3, Pro e Comercial 15), casas (Essencial 30), contratos ativos por faixa do Comercial (5/15/40/sob consulta), Comercial sozinho sem clientes residenciais;
- push para equipe e clientes desligado até a dona ativar;
- convite por link com token guardado só como hash, uso único e com validade;
- numeração automática de faturas e baixa quando os pagamentos cobrem o total (inclui Zelle, cheque e dinheiro);
- registro de auditoria para equipe, pagamentos, status de faturas, aprovação de gastos, valores de pagamento e edição de ponto fechado.

## Como testar

Com Postgres 15+ local:

```bash
createdb tidyo_test
cat supabase/tests/_supabase_stub.sql supabase/migrations/*.sql | psql -v ON_ERROR_STOP=1 -d tidyo_test
psql -v ON_ERROR_STOP=1 -d tidyo_test -f supabase/tests/access_rules_test.sql
```

Projeto Supabase: `tidyo` (ref `dydppwblbknosekojgwc`, us-east-1), com as três migrations aplicadas, `pg_cron` ativo e a aprovação automática das avaliações agendada a cada 15 minutos. Para um ambiente novo, `supabase db push` aplica as migrations (sem o arquivo de stub).

## Próximos passos

1. Next.js com as rotas acima, `tokens.css` e i18n; telas na ordem: entrar → primeiros passos → hoje → agenda → meu dia/checklist → faturas.
2. Edge Functions: webhook da Stripe, lembretes, tradução, revisão noturna do Tidy.
3. Fila offline do app da helper e testes de ponta a ponta.
