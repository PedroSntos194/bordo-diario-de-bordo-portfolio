# 22 · Riscos e dependências externas

## Matriz de riscos

Probabilidade e impacto em **Baixa / Média / Alta**. Severidade = combinação dos dois.

### 🔴 Severidade alta

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R-01 | **Baixa adesão dos motoristas.** O problema declarado é comportamental: as pessoas não anotam. Um sistema digital mal desenhado herda o mesmo destino do papel. | Alta | Alto | Interface do motorista em no máximo 3 toques por ação; GPS, data e hora automáticos; piloto com 5 motoristas na Sprint 7 antes de estender a todos; alerta de pendência (US038); treinamento presencial curto; acompanhar a taxa de registro semanalmente como indicador de produto |
| R-02 | **Contradição "uso interno" × operação em campo** (V-01). Se o cliente insistir em sistema sem acesso externo, o fluxo principal fica inviável. | Média | Muito alto | **Resolver antes da Sprint 0.** Apresentar ao cliente o que cada opção implica; se a exigência de rede interna se mantiver, o escopo do produto precisa ser repensado por completo, não adaptado |
| R-03 | **Requisitos incompletos.** 18 pontos de validação em aberto, incluindo o significado de "integração com Microsoft" e o layout de importação. | Alta | Alto | Reunião de validação antes da Sprint 0; premissas documentadas e assumidas explicitamente; nenhuma sprint inicia com ⚠️ pendente que a afete; controle de mudanças ativo desde o primeiro dia |
| R-04 | **Aprovação da Meta para WhatsApp Cloud API** (V-05). Prazo fora do controle do time; pode levar semanas e exige verificação de empresa. | Média | Alto | MVP com link `wa.me` (sem dependência externa); iniciar o processo na Meta em paralelo, já na Sprint 1, se o cliente optar pela API oficial; arquitetura com canal intercambiável |
| R-05 | **Ausência de infraestrutura** (V-02). Sem domínio, sem servidor e sem definição de quem contrata e paga. | Alta | Alto | Levantar na primeira reunião; provisionar já na Sprint 0; homologação no ar desde o início evita a descoberta tardia de problemas de ambiente |
| R-06 | **Conectividade em campo** (V-08). Área sem sinal derruba o registro e devolve o motorista ao papel. | Alta | Alto | Rascunho local desde a Sprint 4 (mesmo antes da US025 completa), com indicador de sincronização; mapear as regiões críticas durante o piloto |

### 🟠 Severidade média

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R-07 | **Ampliação de escopo.** O questionário deixou a pergunta "descreva tudo que gostaria" em branco — sinal de que há demanda não verbalizada. | Alta | Médio | Escopo e MVP aprovados por escrito; processo de mudança do doc 20 aplicado desde a Sprint 1; revisão de backlog a cada sprint |
| R-08 | **LGPD e monitoramento de empregados** (V-09). Rastrear localização sem base legal e transparência gera risco jurídico ao cliente. | Média | Alto | Aviso de privacidade com aceite registrado (US043); retenção definida; recomendação formal de validação jurídica antes do go-live; coleta apenas com jornada aberta |
| R-09 | **Dependência de provedor de mapas.** Limite de uso do Nominatim ou mudança de política do OSM. | Média | Médio | Geocodificação com cache e sob demanda; camada de mapa isolada em um componente; alternativa paga precificada previamente |
| R-10 | **Qualidade dos dados de odômetro.** O motorista digita; erro de digitação contamina todo o relatório de km. | Alta | Médio | Validação contra o último valor (RN015, RN020); confirmação de divergência; sinalização de inconsistência no relatório; correção com justificativa auditada |
| R-11 | **Precisão do GPS em celular.** Aparelho antigo, sinal urbano ruim ou permissão negada. | Alta | Baixo | Registro nunca bloqueia por falta de GPS (RN022); precisão gravada e sinalizada; relatório distingue "sem localização" de "localização imprecisa" |
| R-12 | **Prazo indefinido** (V-11). Sem data-alvo, expectativas divergentes aparecem só no fim. | Média | Médio | Roadmap com marcos claros; entregas em homologação a cada sprint; go-live do MVP como marco contratual explícito |
| R-13 | **Time reduzido.** Uma única pessoa desenvolvedora dobra o cronograma e concentra o conhecimento. | Média | Médio | Documentação viva (este conjunto); revisão de código obrigatória; nada de conhecimento exclusivo de uma pessoa |
| R-14 | **Importação de planilhas fora do padrão** (V-10). Arquivos reais quase nunca seguem o modelo. | Alta | Baixo | Modelo fornecido pelo sistema; validação linha a linha com relatório de erros; rejeição integral quando a estrutura difere |

### 🟡 Severidade baixa

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R-15 | **Identidade visual atrasada** (V-18) | Média | Baixo | Paleta neutra provisória com tokens centralizados; troca de tema é ajuste de configuração, não refatoração |
| R-16 | **Crescimento além do previsto** | Baixa | Médio | Arquitetura dimensionada para 5× (RNF016); índices definidos desde a modelagem |
| R-17 | **Perda de dados** | Baixa | Muito alto | Backup diário com retenção, cópia externa e **restauração testada antes do go-live** (RNF014) |
| R-18 | **Migração de dados históricos** | Baixa | Baixo | Cliente informou que não há base existente; se surgir, entra por controle de mudanças |
| R-19 | **Dependência de ExcelJS / bibliotecas** | Baixa | Baixo | Bibliotecas maduras e livres; geração isolada em serviço próprio |
| R-20 | **Rotatividade de motoristas** | Média | Baixo | Cadastro simples, senha temporária, importação em lote |

## Riscos que exigem decisão antes da Sprint 0

**R-02** (uso interno × internet) e **R-05** (infraestrutura) são bloqueantes: sem resposta, não há
onde publicar nem para quem. **R-03** determina o quanto do backlog está realmente pronto para
desenvolvimento.

---

## Dependências externas

### Do cliente — bloqueantes para a Sprint 0

| # | Item | Para quê | Prazo desejável |
|---|---|---|---|
| D-01 | **Respostas aos pontos V-01 a V-18** de [`01-analise-inicial-e-validacoes.md`](01-analise-inicial-e-validacoes.md) | Fechar o escopo | Antes do início |
| D-02 | **Aprovação formal do escopo e do MVP** | Base do controle de mudanças | Antes do início |
| D-03 | **Decisão sobre domínio e hospedagem** (V-01, V-02) | Provisionar ambiente | Sprint 0 |
| D-04 | **Nome oficial da empresa** (V-16) | Domínio, relatórios, identidade | Sprint 0 |

### Do cliente — necessárias durante o desenvolvimento

| # | Item | Para quê | Quando |
|---|---|---|---|
| D-05 | **Logo em arquivo vetorial** (SVG, AI ou EPS) e, se houver, manual de marca com cores e fontes | Identidade visual da aplicação | Até a Sprint 2 |
| D-06 | **Modelo da planilha de papel usada hoje** | Garantir que nenhum campo em uso se perca na digitalização — insumo de alto valor que não foi anexado ao questionário | Sprint 0 |
| D-07 | **Lista de veículos** (placa, modelo, capacidade, odômetro atual) | Carga inicial | Sprint 3 |
| D-08 | **Lista de rotas com pontos de parada e endereços** | Carga inicial | Sprint 3 |
| D-09 | **Lista de usuários** (nome, CPF, telefone, perfil, matrícula) | Carga inicial | Sprint 2 |
| D-10 | **Número(s) de WhatsApp do administrador** que receberão o resumo | Notificações | Sprint 6 |
| D-11 | **Definição da base legal e do texto do aviso de privacidade** (V-09), validado juridicamente | Conformidade LGPD | Sprint 2 |
| D-12 | **Pessoa responsável pela homologação**, com disponibilidade acordada | Validação a cada sprint | Contínuo |
| D-13 | **Motoristas para o piloto** (sugestão: 5 pessoas, rotas variadas) | Validação em uso real | Sprint 7 |
| D-14 | **Janela para treinamento** da equipe | Adoção | Sprint 7 |
| D-15 | **Textos institucionais** (nome do sistema, mensagem de boas-vindas, contato de suporte) | Conteúdo da interface | Sprint 5 |

### De terceiros

| # | Item | Fornecedor | Depende de | Custo |
|---|---|---|---|---|
| D-16 | Registro de domínio | Registro.br ou equivalente | D-04 | ~R$ 40/ano |
| D-17 | Servidor / VPS | Provedor de nuvem | D-03 | R$ 60–250/mês |
| D-18 | Certificado TLS | Let's Encrypt | D-16 | Gratuito |
| D-19 | Tiles de mapa | OpenStreetMap | — | Gratuito, sujeito à política de uso |
| D-20 | Geocodificação reversa | Nominatim ou provedor pago | Volume de uso | Gratuito até certo volume |
| D-21 | **Conta Meta Business verificada + número dedicado + templates aprovados** | Meta | V-05b | Custo por conversa; **prazo de aprovação fora do controle do time** |
| D-22 | Armazenamento de backup externo | Backblaze B2, S3 ou equivalente | D-03 | ~R$ 10–30/mês |

### Do time de desenvolvimento

| # | Item | Quando |
|---|---|---|
| D-23 | Ambiente de desenvolvimento padronizado (Docker) | Sprint 0 |
| D-24 | Repositório com controle de acesso | Sprint 0 |
| D-25 | Cofre de segredos para credenciais de produção | Sprint 0 |
| D-26 | Ferramenta de acompanhamento do backlog | Sprint 0 |

> **Regra de dependência:** item não entregue no prazo bloqueia a story correspondente, que retorna
> ao backlog. A sprint não é replanejada silenciosamente para "aproveitar o tempo" — o atraso é
> registrado, comunicado e refletido no roadmap.
