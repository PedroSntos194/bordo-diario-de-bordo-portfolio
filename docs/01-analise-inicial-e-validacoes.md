# 01 · Análise inicial e pontos de validação

Base: `Questionário de Levantamento de Requisitos - respondido.docx` (respondido pelo cliente).

---

## 1. Qual problema o sistema precisa resolver

O controle operacional das vans hoje é feito em **planilha de papel** preenchida pelo motorista.
Na prática, **os motoristas deixam de preencher o diário de bordo** — ou preenchem de forma
incompleta, ilegível ou depois do fato, "de cabeça".

Consequências diretas desse cenário (inferidas do contexto, a confirmar):

- a empresa não sabe com precisão **onde a van esteve, quando e por qual rota**;
- não há base confiável de **quilometragem**, o que compromete custo por rota, manutenção e combustível;
- a consolidação para o administrador é **manual, retrabalhada e atrasada** (alguém redigita o papel em Excel);
- não há **prova documental** em caso de incidente, reclamação de passageiro ou questionamento trabalhista;
- não há **responsabilização**: sem registro, não se sabe quem deixou de anotar.

O problema real, portanto, não é "não existe planilha" — é **falta de adesão ao registro**. Isso
tem uma consequência de projeto decisiva: *o sistema só resolve o problema se registrar for mais
fácil e mais rápido do que não registrar*. Toda a solução do motorista precisa ser desenhada para
o celular, em poucos toques, com o máximo de dados capturados automaticamente (data, hora, GPS).

## 2. Objetivo principal

Digitalizar e automatizar o diário de bordo diário do motorista, gerando de forma automática a
consolidação ("planilhar o dia a dia do motorista") e entregando-a ao administrador sem redigitação.

## 3. Tipos de usuários identificados

| Perfil | Origem na resposta | Descrição |
|---|---|---|
| **Motorista** | "Motorista e Administrador" | Funcionário que dirige a van. Usa quase exclusivamente o celular, em movimento, muitas vezes com pressa e conectividade instável. Acesso limitado: só enxerga e edita os próprios registros. |
| **Administrador** | "administrador pode visualizar e editar tudo" | Gestor da operação. Cadastra usuários, veículos e rotas, acompanha o dia, consulta histórico, gera e exporta relatórios, audita alterações. |

> 💡 **Sugestão (não solicitada explicitamente):** um terceiro perfil **Supervisor / Operação** — vê
> tudo e gera relatórios, mas **não** cria/remove usuários nem altera registros já encerrados. Em
> operações com 60 usuários é comum não querer dar poder total de administração a quem só acompanha.
> Classificado como **Could Have** e fora do MVP até validação.

## 4. Principais funcionalidades identificadas

Extraídas diretamente das respostas:

1. Login por **CPF e senha** + recuperação de senha.
2. Cadastro/edição/consulta/exclusão ("todas essas") de informações.
3. Registro de **rotas**, **destinos**, **dia** e **localização** das vans.
4. **Encerramento da corrida** pelo motorista.
5. **Envio da planilha com as informações para o administrador** (via WhatsApp).
6. **Dashboard**.
7. **Relatório: resumo do dia**.
8. **Exportação para Excel**.
9. **Criação automática de planilhas Excel** (automação citada explicitamente).
10. **Upload de planilhas**.
11. **Integração com mapas/localização**.
12. **Painel administrativo**: gerenciar informações, criar/remover usuários, bloquear/desativar usuários.
13. **Log/histórico de atividades** e **histórico de alterações** com quem alterou, quando e qual era o valor anterior.
14. **Pesquisas e filtros**.
15. **Confirmação em ações que não podem ser desfeitas**.
16. Funcionamento em **celular, tablet e computador**.

## 5. Regras de negócio percebidas nas respostas

- Administrador visualiza e edita tudo; funcionário tem acesso limitado (→ RN008, RN009).
- Toda alteração relevante precisa guardar autor, data/hora e valor anterior (→ RN026).
- Existem ações irreversíveis que exigem confirmação explícita (→ RN024).
- Usuários podem ser bloqueados/desativados, e isso deve impedir o acesso (→ RN006).
- O fluxo do motorista termina no **encerramento da corrida** e no **envio ao administrador** (→ RN014, RN017).
- Existem dados **confidenciais/sensíveis** no sistema — CPF, localização de pessoas (→ RN029).

Detalhamento completo em [`06-regras-de-negocio.md`](06-regras-de-negocio.md).

## 6. Integrações externas identificadas

| Integração | Resposta do cliente | Leitura técnica |
|---|---|---|
| **Microsoft** | "precisará se comunicar com algum outro sistema? → Microsoft" | Ambíguo. Pode significar (a) apenas arquivos `.xlsx`, (b) OneDrive/SharePoint como destino das planilhas, (c) login corporativo Microsoft 365 / Entra ID, (d) Power BI. **⚠️ V-04** |
| **WhatsApp** | "sim" | Envio do resumo do dia / planilha ao administrador e alertas. Duas abordagens possíveis, com custo e prazo muito diferentes. **⚠️ V-05** |
| **Mapas / localização** | "sim" | Captura de GPS no início/fim/paradas da corrida e visualização do trajeto em mapa. Definir provedor (custo). **⚠️ V-06** |
| **E-mail** | "nao" | Fora do escopo — **porém** recuperação de senha e envio de relatórios normalmente dependem de e-mail. **⚠️ V-07** |
| **Pagamentos** | "nao" | Fora do escopo. Nenhum impacto. |
| **API/documentação existente** | "nao" | Não há sistema legado a consumir. Reduz risco. |

## 7. Riscos técnicos identificados

| # | Risco | Por quê |
|---|---|---|
| RT-1 | **Contradição "uso interno" × operação em campo** | O cliente respondeu que o sistema será usado **"internamente"**, mas o usuário principal é um motorista *na rua*, com celular, precisando de GPS e enviando WhatsApp. Um sistema restrito à rede local **não atende** esse fluxo. Definição estrutural de infraestrutura. **⚠️ V-01** |
| RT-2 | **Conectividade instável** | Vans circulam por regiões com sinal ruim. Sem estratégia de offline, o motorista perde o registro e volta ao papel — o problema original retorna. **⚠️ V-08** |
| RT-3 | **Precisão e consumo de GPS** | Rastreamento contínuo drena bateria e exige app nativo/background. Captura pontual (início, paradas, fim) é viável em navegador. Escopos radicalmente diferentes. **⚠️ V-06** |
| RT-4 | **WhatsApp oficial exige processo** | A API oficial (Meta Cloud API) exige conta Meta Business verificada, número dedicado, aprovação de templates e tem custo por conversa. Soluções não oficiais violam os Termos de Uso e podem derrubar o número da empresa — **não recomendadas**. **⚠️ V-05** |
| RT-5 | **Ausência de domínio e servidor** | "A empresa já possui domínio? nao / hospedagem? nao". Não há infraestrutura; será preciso provisionar, com custo recorrente e responsável definido. **⚠️ V-02** |
| RT-6 | **Adesão do usuário** | Risco de produto, não de código: se a interface do motorista exigir mais de ~5 toques por corrida, a adesão cai e o projeto falha mesmo funcionando. Mitigação: PWA mobile-first, campos pré-preenchidos, GPS automático. |
| RT-7 | **Dado pessoal sensível + LGPD** | CPF de funcionários e **geolocalização de pessoas físicas** são dados pessoais. Monitoramento de empregado exige base legal, transparência e política de retenção. **⚠️ V-09** |
| RT-8 | **"Upload de planilhas" sem formato definido** | Importar arquivo sem layout conhecido é fonte clássica de retrabalho. Precisa de modelo fixo. **⚠️ V-10** |

## 8. Funcionalidades implícitas (sugeridas, não pedidas explicitamente)

Marcadas como **sugestão** — não entram no escopo sem aprovação:

| # | Sugestão | Motivo |
|---|---|---|
| S-01 | **Cadastro de veículos (vans)** | O cliente fala em "vans" o tempo todo, mas não pediu cadastro de veículo. Sem ele não há como relacionar corrida ↔ van, nem calcular km por veículo. **Proposto como essencial no MVP** — ver V-03. |
| S-02 | **Odômetro inicial/final por jornada** | É o campo central de qualquer diário de bordo e a base de qualquer relatório de km. Proposto no MVP. |
| S-03 | **Cadastro de rotas com pontos de parada** | "cadastra as rotas" foi citado; os pontos de parada tornam o registro rápido (o motorista só confirma). Proposto no MVP. |
| S-04 | **Registro de ocorrências/incidentes** | Diário de bordo em papel costuma ter campo de observação/ocorrência. Should Have. |
| S-05 | **Alerta de jornada não encerrada** | Ataca diretamente o problema declarado ("motoristas não anotam"): o sistema cobra quem esqueceu. Should Have — alto valor. |
| S-06 | **Funcionamento offline com sincronização** | Ver RT-2. Should Have. |
| S-07 | **Registro de abastecimento** | Complemento natural do controle de km/custo. Could Have. |
| S-08 | **Escala/atribuição motorista → van → rota** | Permite pré-preencher a tela do motorista. Could Have. |
| S-09 | **Perfil Supervisor** | Ver seção 3. Could Have. |
| S-10 | **Assinatura/confirmação digital do resumo do dia** | Valor probatório do registro. Won't Have Now. |

## 9. Lacunas do questionário

- As seções **11 e 12** não existem no documento (a numeração salta de 10 para 13). Se correspondiam a
  **prazo** e **orçamento**, essas informações **não foram coletadas**. **⚠️ V-11**
- A pergunta *"Descreva tudo que gostaria que fosse possível fazer dentro da plataforma"* ficou **em branco**.
- *"O administrador deverá conseguir gerenciar quais informações?"* foi respondida apenas com "sim" — não diz **quais**.
- *"Existe alguma ação que não pode ser desfeita...? sim"* — não diz **quais** ações.
- *"Existem informações confidenciais ou sensíveis...? sim"* — não diz **quais**.
- A última pergunta (materiais de apoio) ficou **sem resposta**.

---

# Pontos que precisam de validação com o cliente

> Cada item abaixo pode alterar **escopo, prazo ou custo** de forma relevante. Enquanto não houver
> definição, adotamos a **premissa** indicada — que é o que está refletido no restante da documentação.

## ✅ Respondidos pelo cliente em 29/08/2026

Quatro pontos saíram do aberto, e **os quatro confirmaram a premissa já adotada** —
nenhum retrabalho.

| ID | Resposta do cliente | Efeito |
|---|---|---|
| **V-01** | Acessado **pela internet** | Confirma a premissa (a). A infraestrutura construída — domínio próprio, Caddy com TLS automático, HTTPS obrigatório em produção — é a certa. Sem mudança |
| **V-02** | **Rogerio Alves dos Santos** contrata e paga | Confirma a premissa (b): contas em nome do cliente. O ponto deixa de ser "quem decide" e passa a ser uma compra pendente com dono |
| **V-05** | **Link que o motorista toca** para enviar | Confirma a premissa (a), que é o que a Sprint 6 entregou e o padrão do `.env.producao.example` (`WHATSAPP_CANAL=link`). **Elimina o processo na Meta e as semanas de espera** |
| **V-06** | **Captura pontual** — início, paradas e fim | Confirma a premissa (a). As duas sprints construídas sobre isso estão corretas; o rastreamento contínuo, que exigiria refazer como aplicativo nativo, está descartado |

> **O que essas respostas fecham.** V-05 era risco de **cronograma** — a Cloud API
> exige conta verificada, número dedicado e template aprovado, e o processo é do
> cliente. V-06 era risco de **escopo**, o único capaz de invalidar trabalho já
> entregue. Os dois saíram sem custo.
>
> V-06 também **reforça a análise de base legal** (V-09): captura pontual, só com
> jornada aberta e com recusa aceita é o cenário de menor intrusão, e é isso que
> pesa no balanceamento do legítimo interesse. Ver
> [`26-lgpd-base-legal.md`](26-lgpd-base-legal.md).

---

| ID | Ponto em aberto | Por que importa | Opções | Premissa adotada |
|---|---|---|---|---|
| **V-01** | **Uso interno ou acessível pela internet?** O cliente respondeu "internamente", mas o motorista precisa registrar na rua. | Define toda a infraestrutura, custo, segurança e a viabilidade do fluxo principal. | (a) Publicado na internet com HTTPS e login — recomendado; (b) intranet + VPN nos celulares (inviável na prática); (c) híbrido: motorista online, painel admin só na rede interna. | **(a)** — aplicação publicada com domínio próprio, HTTPS obrigatório e acesso restrito por autenticação. |
| **V-02** | **Quem provisiona e paga a infraestrutura?** Não há domínio nem servidor. | Sem isso não há deploy nem homologação. Custo recorrente mensal. | (a) VPS gerenciada pelo fornecedor; (b) nuvem em nome do cliente; (c) servidor próprio na empresa. | **(b)** — contas em nome do cliente, configuradas pelo time de desenvolvimento. |
| **V-03** | **Cadastro de veículos entra no MVP?** Não foi pedido explicitamente. | Sem ele não existe "diário de bordo da van", apenas do motorista; relatórios por veículo ficam impossíveis. | (a) Sim, cadastro completo; (b) apenas campo texto "placa" na corrida. | **(a)** — cadastro de veículos no MVP. |
| **V-04** | **O que significa "integração com Microsoft"?** | Vai de "gerar arquivo .xlsx" (esforço baixo) a "SSO com Entra ID + OneDrive" (esforço alto). | (a) Só arquivos Excel; (b) salvar planilhas no OneDrive/SharePoint; (c) login Microsoft 365; (d) Power BI. | **(a)** — geração de arquivos `.xlsx` compatíveis com Excel. Demais opções tratadas como evolução. |
| **V-05** | **Como será a integração com WhatsApp?** | Muda custo, prazo e dependência de aprovação da Meta. | (a) **Link `wa.me` / compartilhamento nativo**: custo zero, sem aprovação, mas o envio é disparado manualmente pelo usuário; (b) **WhatsApp Cloud API oficial**: envio 100% automático, exige Meta Business verificado, número dedicado, templates aprovados e custo por conversa; (c) provedor terceiro (Twilio, 360dialog): intermediário. | **(a) no MVP**, com a arquitetura preparada para (b) — ver RF025/RF027. |
| **V-06** | **Qual o nível de rastreamento de localização?** | Diferença entre um formulário com GPS e um sistema de rastreamento veicular. | (a) **Captura pontual** (início da corrida, paradas, encerramento) — atende "localização e destinos"; (b) **trajeto contínuo** durante a corrida (app nativo, bateria, volume de dados); (c) integração com rastreador veicular já instalado nas vans. | **(a)** — captura pontual com registro de latitude/longitude e endereço aproximado. |
| **V-07** | **Recuperação de senha sem e-mail — como?** | O cliente disse que não quer integração de e-mail, mas pediu redefinição de senha. | (a) Redefinição feita pelo administrador no painel (senha temporária); (b) e-mail transacional; (c) código por WhatsApp. | **(a) no MVP**, com (b) como evolução — é a opção sem custo e sem dependência externa. |
| **V-08** | **O sistema precisa funcionar sem internet?** | Sem offline, área sem sinal = registro perdido = volta do papel. | (a) Online apenas; (b) rascunho local + sincronização quando houver sinal; (c) offline completo. | **(b)** — rascunho local e sincronização, previsto como **Should Have** (Sprint 4). |
| **V-09** | **Base legal e transparência para os dados de localização (LGPD)** | Rastrear posição de empregado exige informar e documentar. Risco jurídico, não técnico. | Definir base legal, aviso ao colaborador, prazo de retenção dos pontos de GPS e quem pode consultá-los. | Retenção de 12 meses para GPS e 5 anos para o diário de bordo; aviso de privacidade exibido no primeiro acesso. |
| **V-10** | **Upload de planilhas: qual o objetivo e o layout?** | "Será necessário realizar upload de arquivos? planilhas" não diz se é *importar dados* ou *anexar arquivo*. | (a) Importar cadastros em massa (motoristas, rotas, veículos); (b) importar diários antigos digitalizados; (c) apenas anexar arquivos a um registro. | **(a)** — importação de cadastros por modelo `.xlsx` fornecido pelo próprio sistema. |
| **V-11** | **Prazo e orçamento** | As seções 11 e 12 do questionário não existem no documento recebido; não há prazo-alvo nem teto de investimento. | — | Nenhuma. Estimativa apresentada em complexidade relativa em [`21-sprints-roadmap-estimativas.md`](21-sprints-roadmap-estimativas.md). |
| **V-12** | **Quais ações são irreversíveis?** | Define onde entram modais de confirmação e o que é exclusão lógica × física. | Proposta: encerrar corrida, encerrar jornada, excluir usuário, excluir rota/veículo, enviar resumo do dia. | Proposta acima adotada — ver RN024. |
| **V-13** | **Motorista pode editar depois de encerrar?** | Impacta a confiabilidade do dado e a auditoria. | (a) Não pode; só o administrador corrige; (b) pode dentro de uma janela (ex.: até o fim do dia) com justificativa obrigatória; (c) pode sempre. | **(b)** — janela configurável (padrão 12h) com justificativa registrada em auditoria. Ver RN019. |
| **V-14** | **Uma jornada por dia por motorista, ou várias?** | Muda a modelagem (chave única) e o relatório do dia. | (a) Uma jornada por motorista por dia, com N corridas dentro; (b) várias jornadas por dia. | **(a)** — ver RN012. |
| **V-15** | **O resumo do dia vai para quem, e quando?** | Define o gatilho da notificação. | (a) Manual, ao encerrar a jornada; (b) automático em horário fixo; (c) ambos. | **(c)** — envio ao encerrar a jornada + consolidado diário automático para o administrador. |
| **V-16** | **Nome oficial da empresa e do produto** | Aparece em logo, relatórios e domínio. | O nome do questionário e o da pasta do projeto divergiam. | Nome de produto **Bordo** até correção. |
| **V-17** | **Quantidade e perfil dos 60 usuários** | Dimensiona infraestrutura e volume de dados. | Quantos são motoristas, quantos administradores? Quantas vans? Quantas rotas? | Premissa: ~55 motoristas, ~5 administradores, ~20 vans, ~30 rotas. |
| **V-18** | **Identidade visual** | Só foi informado que existe **logo**. | Necessário arquivo vetorial do logo, cores e fontes da marca. | Paleta neutra minimalista até o recebimento — ver [`11-ux-ui.md`](11-ux-ui.md). |
