# 08 · Perfis e permissões

## Perfis

| Perfil | Código | Descrição | Escopo de dados |
|---|---|---|---|
| **Administrador** | `ADMIN` | Gestor da operação. Acesso total de leitura e escrita. | Todos os registros |
| **Motorista** | `MOTORISTA` | Funcionário que opera a van. | Apenas os próprios registros (RN009) |
| *Supervisor* 💡 | `SUPERVISOR` | **Sugestão fora do MVP.** Vê tudo e gera relatórios, sem administrar usuários nem editar registros encerrados. | Todos os registros, somente leitura |

## Matriz de permissões

Legenda: **Sim** = permitido · **Não** = negado · **Próprio** = apenas registros do próprio usuário

### Acesso e conta

| Funcionalidade | Administrador | Motorista |
|---|---|---|
| Autenticar no sistema | Sim | Sim |
| Trocar a própria senha | Sim | Sim |
| Ver o próprio perfil | Sim | Sim |
| Aceitar aviso de privacidade | Sim | Sim |

### Usuários

| Funcionalidade | Administrador | Motorista |
|---|---|---|
| Listar usuários | Sim | Não |
| Ver detalhe de usuário | Sim | Não |
| Criar usuário | Sim | Não |
| Editar usuário | Sim | Não |
| Bloquear / desativar usuário | Sim | Não |
| Excluir usuário (lógica) | Sim | Não |
| Redefinir senha de terceiro | Sim | Não |
| Alterar o próprio perfil de acesso | Não (RN011) | Não |
| Excluir a própria conta | Não (RN011) | Não |

### Cadastros base

| Funcionalidade | Administrador | Motorista |
|---|---|---|
| Listar veículos | Sim | Sim (seleção na jornada) |
| Criar / editar / desativar veículo | Sim | Não |
| Listar rotas | Sim | Sim (seleção na corrida) |
| Criar / editar / desativar rota | Sim | Não |
| Gerenciar pontos de parada | Sim | Não |
| Gerenciar escala | Sim | Não (apenas visualiza a própria) |
| Importar cadastros por planilha | Sim | Não |

### Operação

| Funcionalidade | Administrador | Motorista |
|---|---|---|
| Abrir jornada | Sim (em nome de terceiro, com auditoria) | Próprio |
| Encerrar jornada | Sim | Próprio |
| Iniciar corrida | Sim | Próprio |
| Registrar parada / evento | Sim | Próprio |
| Encerrar corrida | Sim | Próprio |
| Cancelar corrida | Sim | Próprio (com justificativa) |
| Registrar ocorrência | Sim | Próprio |
| Registrar abastecimento | Sim | Próprio |
| Corrigir registro **dentro** da janela | Sim | Próprio |
| Corrigir registro **fora** da janela | Sim | Não (RN019) |
| Excluir jornada / corrida | Não — apenas cancelamento com justificativa | Não |

### Consultas, painel e mapa

| Funcionalidade | Administrador | Motorista |
|---|---|---|
| Dashboard administrativo | Sim | Não |
| Resumo do próprio dia | Sim | Próprio |
| Consultar jornadas e corridas | Sim (todas) | Próprio |
| Ver detalhe de jornada | Sim (todas) | Próprio |
| Ver trajeto no mapa | Sim (todas) | Próprio |
| Ver dados de outro motorista | Sim | Não — retorna 404 (RN009) |

### Relatórios e arquivos

| Funcionalidade | Administrador | Motorista |
|---|---|---|
| Gerar resumo do dia | Sim (todos) | Próprio |
| Relatórios por período / dimensão | Sim | Não |
| Exportar em Excel | Sim (todos) | Próprio |
| Gerar planilha consolidada manualmente | Sim | Não |
| Histórico de arquivos gerados | Sim | Apenas os próprios |
| Baixar arquivo de terceiro | Sim | Não |

### Notificações

| Funcionalidade | Administrador | Motorista |
|---|---|---|
| Enviar resumo do dia ao administrador | Sim | Próprio |
| Ver fila de notificações | Sim | Não |
| Reenviar notificação com falha | Sim | Não |
| Receber alerta de pendência | Sim (consolidado) | Próprio |

### Auditoria e configuração

| Funcionalidade | Administrador | Motorista |
|---|---|---|
| Consultar logs de auditoria | Sim | Não |
| Ver histórico de alterações de um registro | Sim | Próprio |
| Editar ou excluir registro de auditoria | Não (RN027) | Não |
| Alterar configurações do sistema | Sim | Não |

## Regras de aplicação

1. **A verificação é sempre no servidor.** Esconder um botão é experiência de uso, não segurança —
   toda rota e toda ação revalidam o perfil e o escopo do dado (RF041).
2. **Escopo antes de permissão.** Mesmo tendo permissão para "ver corrida", o motorista só recebe as
   corridas cujo `motorista_id` seja o dele. A restrição é aplicada na consulta, não no filtro de tela.
3. **404 em vez de 403 para dado de terceiro.** Evita que um usuário descubra a existência de
   registros alheios por tentativa (RN009).
4. **Ação administrativa sobre dado de terceiro é sempre auditada** com identificação de quem agiu
   em nome de quem.
5. **Negação é o padrão.** Rota nova sem regra declarada é inacessível até que a permissão seja
   definida explicitamente.
