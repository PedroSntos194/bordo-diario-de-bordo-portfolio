'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Check, X } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { CampoSenha } from '@/componentes/formulario/campo-senha';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import type { ErrosDeCampo } from '@/lib/erros';
import { trocarSenha } from '@/modulos/autenticacao/autenticacao.acoes';
import { POLITICA_SENHA } from '@/modulos/usuario/usuario.regras';

/**
 * Formulário de troca de senha (T02 · US002).
 *
 * Os requisitos aparecem **antes** do erro, marcados em tempo real: o usuário
 * descobre o que falta enquanto digita, em vez de a cada envio recusado. As
 * mesmas regras são reaplicadas no servidor (RN004) — isto aqui é conveniência,
 * não validação.
 */
interface Propriedades {
  primeiroAcesso: boolean;
  destino: string;
}

export function FormularioTrocaSenha({ primeiroAcesso, destino }: Propriedades) {
  const router = useRouter();
  const [enviando, iniciarEnvio] = useTransition();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});

  const requisitos = [
    {
      texto: `Mínimo de ${POLITICA_SENHA.tamanhoMinimo} caracteres`,
      atendido: novaSenha.length >= POLITICA_SENHA.tamanhoMinimo,
    },
    { texto: 'Ao menos uma letra', atendido: /[a-zA-Z]/.test(novaSenha) },
    { texto: 'Ao menos um número', atendido: /\d/.test(novaSenha) },
  ];

  function tratarEnvio(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    setErroGeral(null);
    setErrosDeCampo({});

    iniciarEnvio(async () => {
      const resultado = await trocarSenha({
        ...(primeiroAcesso ? {} : { senhaAtual }),
        novaSenha,
        confirmacao,
      });

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        if (!resultado.erro.campos) setErroGeral(resultado.erro.mensagem);
        return;
      }

      router.replace(destino);
      router.refresh();
    });
  }

  const podeEnviar =
    novaSenha.length > 0 && confirmacao.length > 0 && (primeiroAcesso || senhaAtual.length > 0);

  return (
    <form onSubmit={tratarEnvio} className="flex flex-col gap-4" noValidate>
      {erroGeral ? <MensagemErro mensagem={erroGeral} /> : null}

      {!primeiroAcesso ? (
        <CampoSenha
          nome="senhaAtual"
          rotulo="Senha atual"
          valor={senhaAtual}
          aoAlterar={setSenhaAtual}
          erro={errosDeCampo.senhaAtual}
          desabilitado={enviando}
          autoComplete="current-password"
          autoFocus
        />
      ) : null}

      <CampoSenha
        nome="novaSenha"
        rotulo="Nova senha"
        valor={novaSenha}
        aoAlterar={setNovaSenha}
        erro={errosDeCampo.novaSenha}
        desabilitado={enviando}
        autoComplete="new-password"
        autoFocus={primeiroAcesso}
      />

      <ul className="flex flex-col gap-1" aria-label="Requisitos da senha">
        {requisitos.map((requisito) => (
          <li
            key={requisito.texto}
            className={`flex items-center gap-2 text-xs ${
              requisito.atendido ? 'text-sucesso' : 'text-texto-suave'
            }`}
          >
            {requisito.atendido ? (
              <Check aria-hidden className="size-3.5" />
            ) : (
              <X aria-hidden className="size-3.5" />
            )}
            <span>{requisito.texto}</span>
            <span className="sr-only">{requisito.atendido ? '— atendido' : '— pendente'}</span>
          </li>
        ))}
      </ul>

      <CampoSenha
        nome="confirmacao"
        rotulo="Confirme a nova senha"
        valor={confirmacao}
        aoAlterar={setConfirmacao}
        erro={errosDeCampo.confirmacao}
        desabilitado={enviando}
        autoComplete="new-password"
      />

      <Botao
        type="submit"
        tamanho="grande"
        disabled={!podeEnviar}
        carregando={enviando}
        rotuloCarregando="Salvando…"
      >
        Salvar e continuar
      </Botao>
    </form>
  );
}
