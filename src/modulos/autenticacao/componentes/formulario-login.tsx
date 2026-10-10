'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircleHelp } from 'lucide-react';
import { useState, useTransition, type FormEvent } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { CampoCpf } from '@/componentes/formulario/campo-cpf';
import { CampoSenha } from '@/componentes/formulario/campo-senha';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import type { CodigoErro, ErrosDeCampo } from '@/lib/erros';
import { entrar } from '@/modulos/autenticacao/autenticacao.acoes';
import { orientacaoParaErroDeLogin } from '@/modulos/autenticacao/ajuda-acesso.regras';

/**
 * Formulário de login (T01 · US001).
 *
 * O botão fica desabilitado enquanto os campos estiverem vazios e durante o
 * envio — num formulário de autenticação, o duplo clique consome duas das cinco
 * tentativas antes do bloqueio (RN003).
 */
export function FormularioLogin({ retorno }: { retorno?: string }) {
  const router = useRouter();
  const [enviando, iniciarEnvio] = useTransition();

  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [erroGeral, setErroGeral] = useState<{ mensagem: string; codigo: CodigoErro } | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});

  function tratarEnvio(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    setErroGeral(null);
    setErrosDeCampo({});

    iniciarEnvio(async () => {
      const resultado = await entrar({ cpf, senha, retorno });

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        // Erro de campo já aparece junto do campo; repetir no topo é ruído.
        if (!resultado.erro.campos) {
          setErroGeral({ mensagem: resultado.erro.mensagem, codigo: resultado.erro.codigo });
        }
        return;
      }

      // `refresh` antes de navegar para que os layouts do servidor releiam a
      // sessão recém-criada.
      router.replace(resultado.dados.destino);
      router.refresh();
    });
  }

  const podeEnviar = cpf.trim().length > 0 && senha.length > 0;
  const orientacao = erroGeral ? orientacaoParaErroDeLogin(erroGeral.codigo) : null;

  return (
    <form onSubmit={tratarEnvio} className="flex flex-col gap-4" noValidate>
      {erroGeral && orientacao ? (
        <MensagemErro
          mensagem={erroGeral.mensagem}
          acao={
            <div className="flex flex-col gap-1">
              <p className="text-texto text-sm">{orientacao.explicacao}</p>
              <Link
                href={orientacao.caminho}
                className="text-primaria inline-flex min-h-[--spacing-toque] items-center text-sm underline"
              >
                {orientacao.rotulo}
              </Link>
            </div>
          }
        />
      ) : null}

      <CampoCpf
        nome="cpf"
        valor={cpf}
        aoAlterar={setCpf}
        erro={errosDeCampo.cpf}
        desabilitado={enviando}
        autoFocus
      />

      <CampoSenha
        nome="senha"
        rotulo="Senha"
        valor={senha}
        aoAlterar={setSenha}
        erro={errosDeCampo.senha}
        desabilitado={enviando}
      />

      <Botao
        type="submit"
        tamanho="grande"
        disabled={!podeEnviar}
        carregando={enviando}
        rotuloCarregando="Entrando…"
      >
        Entrar
      </Botao>

      <Link
        href="/ajuda-acesso"
        className="border-borda text-primaria inline-flex min-h-[--spacing-toque] items-center justify-center gap-2 rounded-[--radius-padrao] border px-3 text-sm underline"
      >
        <CircleHelp aria-hidden className="size-5 shrink-0" />
        Preciso de ajuda para entrar
      </Link>
    </form>
  );
}
