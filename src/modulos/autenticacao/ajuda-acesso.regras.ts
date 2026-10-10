import { CodigoErro } from '@/lib/erros';

interface OrientacaoDeAcesso {
  explicacao: string;
  caminho: string;
  rotulo: string;
}

/**
 * A ajuda usa apenas o código já devolvido pelo login. Nunca consulta cadastro
 * nem leva CPF, senha ou mensagem do servidor para uma URL pública.
 */
export function orientacaoParaErroDeLogin(codigo: CodigoErro): OrientacaoDeAcesso {
  switch (codigo) {
    case CodigoErro.CONTA_BLOQUEADA:
      return {
        explicacao:
          'Aguarde o prazo indicado antes de tentar novamente. Confira a senha antes de reenviar.',
        caminho: '/ajuda-acesso#bloqueio',
        rotulo: 'Entender o bloqueio temporário',
      };
    case CodigoErro.SENHA_TEMPORARIA_EXPIRADA:
      return {
        explicacao:
          'Peça uma nova senha temporária à administração pelo contato fornecido pela empresa.',
        caminho: '/ajuda-acesso#senha-vencida',
        rotulo: 'Como pedir uma nova senha',
      };
    case CodigoErro.CONTA_INATIVA:
      return {
        explicacao:
          'A administração precisa conferir a liberação do acesso. Repetir a senha não resolve esse aviso.',
        caminho: '/ajuda-acesso#acesso-indisponivel',
        rotulo: 'Como solicitar a conferência do acesso',
      };
    case CodigoErro.CREDENCIAIS_INVALIDAS:
      return {
        explicacao:
          'Confira seu CPF completo e a senha atual. Se já trocou a senha temporária, use a nova.',
        caminho: '/ajuda-acesso#primeiro-acesso',
        rotulo: 'Conferir como entrar',
      };
    case CodigoErro.LIMITE_EXCEDIDO:
      return {
        explicacao:
          'Espere antes de reenviar. Se continuar, informe o texto do aviso à administração sem enviar sua senha.',
        caminho: '/ajuda-acesso#suporte',
        rotulo: 'Preparar um pedido de ajuda',
      };
    default:
      return {
        explicacao:
          'Confira a internet e tente novamente. Se continuar, informe o aviso à administração sem enviar sua senha.',
        caminho: '/ajuda-acesso#aparelho',
        rotulo: 'Ver ajuda para entrar',
      };
  }
}
