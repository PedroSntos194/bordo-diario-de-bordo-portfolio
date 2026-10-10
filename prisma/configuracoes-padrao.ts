import type { PrismaClient } from '@prisma/client';

/**
 * Configurações gravadas no banco por qualquer seed — o inicial (`seed.ts`) e o
 * de demonstração (`seed-demo.ts`). Ficam aqui para os dois não divergirem.
 */
export const CONFIGURACOES_PADRAO = [
  {
    chave: 'janela_edicao_horas',
    valor: 12,
    descricao: 'Prazo, em horas, para o motorista corrigir um registro encerrado (RN019).',
  },
  {
    chave: 'horario_consolidado',
    valor: '23:00',
    descricao: 'Horário de geração automática da planilha consolidada do dia (RF033).',
  },
  {
    chave: 'horario_alerta_pendencia',
    valor: '20:00',
    descricao: 'Horário do alerta de jornadas não encerradas e motoristas sem registro (RF026).',
  },
  {
    chave: 'tolerancia_odometro_km',
    valor: 500,
    descricao: 'Diferença de odômetro, em km, que passa a exigir confirmação (RN015).',
  },
  {
    chave: 'destinatarios_resumo',
    valor: [] as string[],
    descricao: 'Telefones que recebem o resumo do dia por WhatsApp (RF025).',
  },
  {
    chave: 'versao_aviso_privacidade',
    valor: '1.0',
    descricao: 'Versão vigente do aviso de privacidade. Alterar exige novo aceite (RF042).',
  },
  {
    chave: 'retencao_localizacao_meses',
    valor: 12,
    descricao: 'Prazo de retenção dos pontos de localização (RNF007).',
  },
  {
    chave: 'retencao_arquivos_meses',
    valor: 60,
    descricao: 'Prazo de retenção do conteúdo das planilhas geradas (RNF007).',
  },
];

/** Cria o que falta e atualiza só a descrição: valor já ajustado não é sobrescrito. */
export async function semearConfiguracoes(prisma: PrismaClient): Promise<void> {
  console.log('Semeando configurações padrão…');

  for (const configuracao of CONFIGURACOES_PADRAO) {
    await prisma.configuracao.upsert({
      where: { chave: configuracao.chave },
      update: { descricao: configuracao.descricao },
      create: configuracao,
    });
  }
  console.log(`  ${CONFIGURACOES_PADRAO.length} configurações prontas.`);
}
