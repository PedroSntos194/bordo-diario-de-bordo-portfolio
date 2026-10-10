# 05 · Requisitos não funcionais

## Segurança

### RNF001 — Armazenamento de senha
As senhas deverão ser armazenadas exclusivamente como hash **Argon2id** (fallback bcrypt custo ≥ 12),
com salt individual. Em nenhuma hipótese a senha em texto puro poderá ser persistida, registrada em
log ou trafegada em URL.

### RNF002 — Transporte criptografado
Todo o tráfego deverá ocorrer sobre **HTTPS/TLS 1.2+**, com redirecionamento automático de HTTP,
HSTS habilitado e cookies marcados `Secure`, `HttpOnly` e `SameSite=Lax`.

### RNF003 — Proteção contra ataques comuns
A aplicação deverá mitigar OWASP Top 10: consultas parametrizadas via ORM (SQL Injection), escape
automático de saída e CSP (XSS), tokens anti-CSRF em mutações, validação de esquema em todas as
entradas e limite de tamanho de payload e de upload.

### RNF004 — Rate limiting e proteção de credenciais
O endpoint de login deverá limitar tentativas por CPF e por IP, bloqueando temporariamente a conta
após 5 falhas consecutivas (ver RN003). Endpoints de exportação e importação deverão ter limite por
usuário para evitar sobrecarga.

### RNF005 — Segredos fora do código
Nenhuma credencial, chave de API ou string de conexão poderá estar no repositório. Toda configuração
sensível virá de variáveis de ambiente, com um `.env.example` documentando as chaves sem valores.

## Privacidade e LGPD

### RNF006 — Minimização e finalidade ⚠️ *V-09*
O sistema coletará apenas os dados necessários à finalidade declarada (controle operacional da
frota). Dados de localização serão vinculados a corridas de trabalho e não serão coletados fora do
período de jornada aberta.

### RNF007 — Retenção e descarte
- Pontos de localização: **12 meses** ⚠️ *(a validar)*
- Diários de bordo e relatórios: **5 anos**
- Logs de auditoria: **5 anos**
- Logs de acesso técnico: **6 meses**
Após o prazo, os dados deverão ser anonimizados ou eliminados por rotina automatizada.

### RNF008 — Transparência e direitos do titular
O usuário deverá ter acesso aos próprios dados e poder solicitar correção. O aviso de privacidade
deverá estar acessível permanentemente no rodapé e no perfil.

### RNF009 — Exclusão lógica
Usuários e cadastros com histórico não poderão ser removidos fisicamente; a exclusão será lógica,
preservando integridade referencial e trilha de auditoria.

## Performance

### RNF010 — Tempo de resposta
Em condição normal de uso (60 usuários, até 15 simultâneos):
- Telas de listagem: **p95 < 1,5 s**
- Ações do motorista (iniciar/encerrar corrida): **p95 < 1,0 s**
- Geração de relatório em tela: **p95 < 3 s**
- Exportação Excel de até 10.000 linhas: **< 15 s** (processada em segundo plano acima disso)

### RNF011 — Consumo em rede móvel
As telas do motorista deverão carregar com **menos de 300 KB** de recursos após o primeiro acesso
(cache do service worker), pensando em rede 3G/4G instável.

### RNF012 — Paginação obrigatória
Nenhum endpoint de listagem poderá retornar coleção sem paginação; o padrão será 20 itens por
página, com máximo de 100.

## Disponibilidade e continuidade

### RNF013 — Disponibilidade
Disponibilidade-alvo de **99% no horário de operação** (05h–22h, dias úteis). Janelas de manutenção
deverão ocorrer fora desse período e ser comunicadas com antecedência.

### RNF014 — Backup e recuperação
Backup automático diário do banco de dados com retenção de 30 dias, cópia semanal com retenção de
6 meses e backup dos arquivos gerados. O procedimento de restauração deverá ser testado ao menos
uma vez antes do go-live. **RPO ≤ 24 h · RTO ≤ 4 h.**

### RNF015 — Degradação controlada
Falha em serviço externo (mapas, WhatsApp) não poderá impedir o registro operacional: o sistema
deverá continuar funcionando com o recurso indisponível sinalizado ao usuário.

## Escalabilidade e manutenção

### RNF016 — Escalabilidade
A arquitetura deverá suportar crescimento até **5× o volume previsto** (300 usuários, ~300 mil
corridas/ano) sem reescrita, apenas com ajuste de recursos e índices.

### RNF017 — Manutenibilidade
Código em TypeScript com tipagem estrita, lint e formatação automatizados, camadas separadas
(UI / serviço / acesso a dados) e migrações de banco versionadas no repositório.

### RNF018 — Observabilidade
Logs estruturados em JSON com identificador de requisição, sem dados pessoais no corpo do log;
monitoramento de erros e health check para verificação externa.

## Experiência, compatibilidade e acessibilidade

### RNF019 — Responsividade
Interface funcional e legível em **360 px (celular), 768 px (tablet) e 1280 px+ (desktop)**, sem
rolagem horizontal. A área do motorista é projetada **mobile-first**.

### RNF020 — Compatibilidade
Suporte às duas últimas versões estáveis de Chrome, Edge, Firefox e Safari, e Android 9+/iOS 15+.
Não haverá suporte a Internet Explorer.

### RNF021 — Aplicativo instalável (PWA)
A aplicação deverá expor manifesto e service worker, permitindo instalação na tela inicial e
funcionamento com cache offline dos recursos estáticos.

### RNF022 — Acessibilidade
Conformidade-alvo **WCAG 2.1 nível AA**: contraste mínimo 4,5:1, navegação por teclado, foco
visível, rótulos associados a campos, mensagens de erro associadas ao campo por `aria-describedby`
e alvos de toque de no mínimo 44×44 px nas telas do motorista.

### RNF023 — Idioma e formatos
Interface integralmente em **português do Brasil**, datas em `DD/MM/AAAA`, horas em formato 24h,
números com vírgula decimal e fuso **America/Sao_Paulo** com armazenamento em UTC.

### RNF024 — Feedback de ações
Toda ação do usuário deverá retornar feedback visível em até 300 ms (estado de carregamento,
sucesso ou erro), e ações destrutivas exigirão confirmação (RF024).
