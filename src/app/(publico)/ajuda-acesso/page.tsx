import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CircleHelp, MessageCircle } from 'lucide-react';
import { POLITICA_BLOQUEIO, POLITICA_SENHA } from '@/modulos/usuario/usuario.regras';

export const metadata: Metadata = { title: 'Ajuda para entrar' };

const topicos = [
  {
    id: 'primeiro-acesso',
    titulo: 'Primeiro acesso ou senha incorreta',
    passos: [
      'Entre com seu CPF completo e a senha temporária entregue pela administração. Confira letras maiúsculas e minúsculas e evite espaços antes ou depois da senha.',
      `A senha temporária vale por ${POLITICA_SENHA.horasValidadeSenhaTemporaria} horas a partir da emissão. Ao entrar, crie sua própria senha com pelo menos ${POLITICA_SENHA.tamanhoMinimo} caracteres, uma letra e um número. Ela deve ser diferente do CPF, da matrícula e da senha anterior.`,
      'Se já criou sua própria senha, use essa senha atual nos próximos acessos. A temporária anterior não funciona mais.',
      'Use Mostrar senha para conferir o que digitou, com cuidado para ninguém ver. Se não lembrar a senha atual, peça uma nova temporária à administração.',
    ],
  },
  {
    id: 'senha-vencida',
    titulo: 'A senha temporária venceu',
    passos: [
      'Peça à administração uma nova senha temporária pelo contato fornecido pela empresa. Não envie a senha antiga nem a atual na conversa.',
      `Quando receber a nova senha, entre e faça a troca dentro de ${POLITICA_SENHA.horasValidadeSenhaTemporaria} horas. Conte o prazo a partir da emissão da nova senha.`,
    ],
  },
  {
    id: 'bloqueio',
    titulo: 'Muitas tentativas de acesso',
    passos: [
      `Depois de ${POLITICA_BLOQUEIO.tentativasMaximas} tentativas seguidas com senha incorreta, o acesso fica bloqueado por ${POLITICA_BLOQUEIO.minutosDeBloqueio} minutos.`,
      'Aguarde o tempo informado na tela. Antes de tentar de novo, confira CPF e senha atual. Uma nova tentativa com senha incorreta pode bloquear novamente.',
      'Se esqueceu a senha, peça ajuda à administração em vez de testar várias senhas. Não é necessário reinstalar o aplicativo para esperar o bloqueio terminar.',
    ],
  },
  {
    id: 'acesso-indisponivel',
    titulo: 'O acesso está indisponível',
    passos: [
      'Se a tela informa que o acesso está indisponível, avise a administração pelo contato da empresa. Ela precisa conferir a liberação do acesso.',
      'Informe seu nome e o texto do aviso. Repetir a senha ou reinstalar o aplicativo não libera um acesso desativado pela administração.',
    ],
  },
  {
    id: 'aparelho',
    titulo: 'Internet, navegador e localização',
    passos: [
      'O login precisa de internet. Confira Wi-Fi ou dados móveis e abra novamente o mesmo endereço do Bordo fornecido pela empresa.',
      'Se abriu o link dentro do WhatsApp, use a opção de abrir no navegador: Chrome no Android ou Safari no iPhone. Se já instalou o aplicativo, prefira o mesmo navegador e o mesmo aparelho usados na instalação.',
      'Recusar a localização não impede o login. A permissão de localização é usada para guardar posições durante a corrida.',
      'Não desinstale, não limpe os dados e não mude de aparelho antes de conferir os registros pendentes de envio. Registros feitos sem conexão podem estar somente no aparelho usado.',
      'Se voltar a entrar, confira Pendências de envio e aguarde Sincronizado. Se continuar sem acesso, avise a administração que há registros sem conexão neste aparelho.',
    ],
  },
] as const;

const mensagemDeAjuda =
  'Olá! Preciso de ajuda para entrar no Bordo. Meu nome é: ____. O aviso que aparece é: ____. Estou usando Android / iPhone / computador: ____. Tenho registros sem conexão pendentes neste aparelho: sim / não / não sei. Não vou enviar minha senha.';

/** Conteúdo público: não consulta usuários, sessões nem telefones de administradores. */
export default function PaginaAjudaDeAcesso() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <Link
        href="/login"
        className="text-primaria inline-flex min-h-[--spacing-toque] items-center gap-2 self-start underline"
      >
        <ArrowLeft aria-hidden className="size-5" />
        Voltar para Entrar
      </Link>

      <header className="flex flex-col gap-2">
        <div className="text-primaria flex items-center gap-2">
          <CircleHelp aria-hidden className="size-6 shrink-0" />
          <h1 className="text-texto text-2xl font-semibold">Ajuda para entrar no Bordo</h1>
        </div>
        <p className="text-texto-suave">
          Escolha o aviso que aparece ou confira o primeiro acesso. Use o celular com a van parada.
        </p>
      </header>

      <nav aria-label="Assuntos da ajuda de acesso" className="flex flex-col gap-1">
        {topicos.map((topico) => (
          <a
            key={topico.id}
            href={`#${topico.id}`}
            className="text-primaria inline-flex min-h-[--spacing-toque] items-center underline"
          >
            {topico.titulo}
          </a>
        ))}
        <a
          href="#suporte"
          className="text-primaria inline-flex min-h-[--spacing-toque] items-center underline"
        >
          Pedir ajuda à administração
        </a>
      </nav>

      {topicos.map((topico) => (
        <section
          key={topico.id}
          id={topico.id}
          aria-labelledby={`${topico.id}-titulo`}
          className="border-borda bg-superficie scroll-mt-4 rounded-[--radius-padrao] border p-4"
        >
          <h2 id={`${topico.id}-titulo`} className="text-texto text-lg font-semibold">
            {topico.titulo}
          </h2>
          <ol className="text-texto mt-3 list-decimal space-y-3 pl-5">
            {topico.passos.map((passo) => (
              <li key={passo}>{passo}</li>
            ))}
          </ol>
        </section>
      ))}

      <section
        id="suporte"
        aria-labelledby="suporte-titulo"
        className="border-primaria/30 bg-primaria-suave scroll-mt-4 rounded-[--radius-padrao] border p-4"
      >
        <h2 id="suporte-titulo" className="text-texto text-lg font-semibold">
          Pedir ajuda à administração
        </h2>
        <p className="text-texto mt-3">
          Use o contato fornecido pela empresa. Informe seu nome, o texto do aviso, o aparelho usado
          e se há registros pendentes de envio. Nunca envie sua senha; se mandar uma foto, esconda a
          senha e o CPF.
        </p>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensagemDeAjuda)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="border-borda bg-superficie text-primaria mt-4 inline-flex min-h-[--spacing-toque] w-full items-center justify-center gap-2 rounded-[--radius-padrao] border px-3 py-2 text-center underline"
        >
          <MessageCircle aria-hidden className="size-5 shrink-0" />
          Preparar pedido de ajuda no WhatsApp
        </a>
        <p className="text-texto-suave mt-2 text-sm">
          Escolha o contato da administração, complete os espaços e confira a mensagem antes de
          enviar. O envio é feito por você no WhatsApp.
        </p>
      </section>

      <Link
        href="/login"
        className="bg-primaria inline-flex min-h-[--spacing-toque] items-center justify-center rounded-[--radius-padrao] px-4 text-lg font-medium text-white hover:opacity-90"
      >
        Voltar para Entrar
      </Link>
    </main>
  );
}
