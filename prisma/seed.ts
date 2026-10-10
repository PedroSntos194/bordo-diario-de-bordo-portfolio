import { PrismaClient } from '@prisma/client';
import { gerarHashDeSenha, gerarSenhaTemporaria } from '../src/lib/senha';
import { expiracaoDaSenhaTemporaria } from '../src/modulos/usuario/usuario.regras';
import { telefoneEhValido } from '../src/utilitarios/telefone';
import { semearConfiguracoes } from './configuracoes-padrao';

/**
 * Seed — administrador inicial e configurações padrão.
 *
 * A senha do administrador é **gerada aleatoriamente** e impressa uma única vez.
 * Nenhuma senha fixa no código, nem em produção nem em desenvolvimento: uma
 * senha padrão conhecida é a porta de entrada mais comum em sistema interno.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  await semearConfiguracoes(prisma);

  const cpfAdministrador = process.env.SEED_ADMIN_CPF ?? '00000000191';
  const jaExiste = await prisma.usuario.findFirst({
    where: { cpf: cpfAdministrador, status: { not: 'EXCLUIDO' } },
  });

  if (jaExiste) {
    console.log('Administrador inicial já existe. Nada a fazer.');
    return;
  }

  const senha = gerarSenhaTemporaria(12);
  const agora = new Date();

  // Placeholder deliberado: nenhum telefone real entra no código. Ele **não é
  // discável**, e por isso o envio do resumo do dia (RF025) não encontra
  // destinatário até alguém corrigir o cadastro. O aviso ao final existe para
  // que isso seja descoberto agora, e não pelo primeiro motorista que tentar.
  const telefoneAdministrador = process.env.SEED_ADMIN_TELEFONE ?? '+5500000000000';

  await prisma.usuario.create({
    data: {
      nome: process.env.SEED_ADMIN_NOME ?? 'Administrador',
      cpf: cpfAdministrador,
      telefone: telefoneAdministrador,
      perfil: 'ADMIN',
      senhaHash: await gerarHashDeSenha(senha),
      deveTrocarSenha: true,
      senhaTemporariaExpiraEm: expiracaoDaSenhaTemporaria(agora),
      status: 'ATIVO',
    },
  });

  console.log('\n─────────────────────────────────────────────');
  console.log(' Administrador inicial criado');
  console.log(`   CPF...: ${cpfAdministrador}`);
  console.log(`   Senha.: ${senha}`);
  console.log(' Esta senha não será exibida novamente.');
  console.log(' A troca é obrigatória no primeiro acesso.');
  console.log('─────────────────────────────────────────────\n');

  if (!telefoneEhValido(telefoneAdministrador)) {
    console.warn('AVISO: o administrador ficou com o telefone de exemplo, que não é discável.');
    console.warn('  O resumo do dia por WhatsApp (RF025) não terá para quem ir enquanto isso.');
    console.warn('  Informe um número real em Usuários, ou defina SEED_ADMIN_TELEFONE e rode');
    console.warn('  o seed de novo.');
  }
}

main()
  .catch((erro) => {
    console.error('Falha no seed:', erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
