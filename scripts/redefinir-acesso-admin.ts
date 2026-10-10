import { PrismaClient } from '@prisma/client';
import { gerarHashDeSenha, gerarSenhaTemporaria } from '../src/lib/senha';
import { expiracaoDaSenhaTemporaria } from '../src/modulos/usuario/usuario.regras';
import { cpfEhValido, mascararCpf, normalizarCpf } from '../src/utilitarios/cpf';

/**
 * Acesso de emergência: nova senha temporária para um administrador.
 *
 *   npx tsx --env-file=.env.producao scripts/redefinir-acesso-admin.ts <cpf>
 *   npx tsx --env-file=.env.producao scripts/redefinir-acesso-admin.ts <cpf> --confirmar
 *
 * Existe para quando **nenhum** administrador consegue entrar. O seed mostra a
 * senha temporária do administrador inicial uma única vez, e ela vence em 72 h
 * (RN005); se ninguém entrou nesse prazo, ou a senha se perdeu, não há tela
 * que resolva. Havendo um administrador com acesso, use a tela de Usuários —
 * ela faz o mesmo (`usuario.redefinir-senha`) com o autor na trilha.
 *
 * Sem `--confirmar`, só mostra em que banco e em quem mexeria. Com ele:
 * senha temporária nova, troca obrigatória no próximo acesso, tentativas
 * zeradas, sessões encerradas e um registro na auditoria — sem a senha
 * (RN026).
 */
async function main(): Promise<void> {
  const argumentos = process.argv.slice(2);
  const confirmar = argumentos.includes('--confirmar');
  const cpf = normalizarCpf(argumentos.find((a) => !a.startsWith('--')) ?? '');

  if (!cpfEhValido(cpf)) {
    console.error('Informe o CPF do administrador: scripts/redefinir-acesso-admin.ts <cpf>');
    process.exitCode = 1;
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definida. Rode com --env-file apontando para o ambiente.');
    process.exitCode = 1;
    return;
  }

  // O host é o que diz se isto é produção ou teste. Mostrado antes de tudo,
  // para ninguém redefinir o banco errado achando que está em outro.
  console.log(`Banco: ${new URL(url).host}`);

  const prisma = new PrismaClient();
  try {
    const administradores = await prisma.usuario.findMany({
      where: { perfil: 'ADMIN', status: { not: 'EXCLUIDO' } },
      select: { id: true, nome: true, cpf: true, status: true },
      orderBy: { criadoEm: 'asc' },
    });
    const alvo = administradores.find((a) => a.cpf === cpf);

    if (!alvo) {
      console.error(`Nenhum administrador com o CPF ${mascararCpf(cpf)} neste banco.`);
      for (const a of administradores) {
        console.error(`  existe: ${mascararCpf(a.cpf)} · ${a.nome} · ${a.status}`);
      }
      process.exitCode = 1;
      return;
    }

    // Reativar alguém desativado de propósito não é papel de um script de
    // recuperação de senha: isso é decisão de quem administra.
    if (alvo.status !== 'ATIVO') {
      console.error(`${alvo.nome} está ${alvo.status}. Nada foi alterado.`);
      process.exitCode = 1;
      return;
    }

    console.log(`Administrador: ${alvo.nome} · ${mascararCpf(alvo.cpf)}`);

    if (!confirmar) {
      console.log('Nada foi alterado. Rode de novo com --confirmar para gerar a senha.');
      return;
    }

    const senha = gerarSenhaTemporaria(12);
    const expiraEm = expiracaoDaSenhaTemporaria(new Date());
    const senhaHash = await gerarHashDeSenha(senha);

    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: alvo.id },
        data: {
          senhaHash,
          deveTrocarSenha: true,
          senhaTemporariaExpiraEm: expiraEm,
          tentativasLogin: 0,
          bloqueadoAte: null,
        },
      }),
      prisma.sessao.deleteMany({ where: { usuarioId: alvo.id } }),
      prisma.logAuditoria.create({
        data: {
          acao: 'ATUALIZAR',
          entidade: 'usuario',
          entidadeId: alvo.id,
          valorAnterior: { senhaRedefinidaPorScript: false },
          valorNovo: { senhaRedefinidaPorScript: true },
          justificativa: 'Acesso de emergência (scripts/redefinir-acesso-admin.ts)',
        },
      }),
    ]);

    console.log('\n─────────────────────────────────────────────');
    console.log(' Senha temporária gerada');
    console.log(`   CPF...: ${alvo.cpf}`);
    console.log(`   Senha.: ${senha}`);
    console.log(
      `   Vence.: ${expiraEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    );
    console.log(' Esta senha não será exibida novamente.');
    console.log(' A troca é obrigatória no primeiro acesso.');
    console.log('─────────────────────────────────────────────\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error('Falha ao redefinir o acesso:', erro);
  process.exitCode = 1;
});
