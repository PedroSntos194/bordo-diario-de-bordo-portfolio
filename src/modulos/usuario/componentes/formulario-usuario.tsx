'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { CampoCpf } from '@/componentes/formulario/campo-cpf';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { ModalSenhaTemporaria } from '@/modulos/usuario/componentes/modal-senha-temporaria';
import { criarUsuario, editarUsuario } from '@/modulos/usuario/usuario.acoes';
import type { ErrosDeCampo } from '@/lib/erros';
import { aplicarMascaraCpf, formatarCpf } from '@/utilitarios/cpf';
import { aplicarMascaraTelefone } from '@/utilitarios/telefone';

/**
 * Formulário de usuário (T20 · US004, US005).
 *
 * Os campos de CNH só aparecem para o perfil Motorista: administrador não
 * dirige, e campo irrelevante na tela é campo preenchido errado.
 */
export interface ValoresDoUsuario {
  id?: string;
  nome: string;
  cpf: string;
  telefone: string;
  perfil: 'ADMIN' | 'MOTORISTA';
  matricula: string;
  email: string;
  cnhNumero: string;
  cnhCategoria: string;
  cnhValidade: string;
}

interface Propriedades {
  valoresIniciais?: Partial<ValoresDoUsuario>;
  /** Falso quando o usuário já tem jornadas registradas (US005). */
  podeEditarCpf?: boolean;
}

const VAZIO: ValoresDoUsuario = {
  nome: '',
  cpf: '',
  telefone: '',
  perfil: 'MOTORISTA',
  matricula: '',
  email: '',
  cnhNumero: '',
  cnhCategoria: '',
  cnhValidade: '',
};

export function FormularioUsuario({ valoresIniciais, podeEditarCpf = true }: Propriedades) {
  const router = useRouter();
  const [salvando, iniciarSalvamento] = useTransition();

  const edicao = Boolean(valoresIniciais?.id);

  const [valores, setValores] = useState<ValoresDoUsuario>({
    ...VAZIO,
    ...valoresIniciais,
    cpf: valoresIniciais?.cpf ? aplicarMascaraCpf(valoresIniciais.cpf) : '',
    telefone: valoresIniciais?.telefone ? aplicarMascaraTelefone(valoresIniciais.telefone) : '',
  });

  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [senhaGerada, setSenhaGerada] = useState<{ nome: string; senha: string } | null>(null);

  function alterar<C extends keyof ValoresDoUsuario>(campo: C, valor: ValoresDoUsuario[C]): void {
    setValores((atuais) => ({ ...atuais, [campo]: valor }));
  }

  function tratarEnvio(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    setErroGeral(null);
    setErrosDeCampo({});

    iniciarSalvamento(async () => {
      const carga = {
        ...(valoresIniciais?.id ? { id: valoresIniciais.id } : {}),
        nome: valores.nome,
        // Sem permissão de editar o CPF, ele nem é enviado.
        ...(edicao && !podeEditarCpf ? {} : { cpf: valores.cpf }),
        telefone: valores.telefone,
        perfil: valores.perfil,
        matricula: valores.matricula,
        email: valores.email,
        cnhNumero: valores.cnhNumero,
        cnhCategoria: valores.cnhCategoria,
        cnhValidade: valores.cnhValidade,
      };

      const resultado = edicao ? await editarUsuario(carga) : await criarUsuario(carga);

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        if (!resultado.erro.campos) setErroGeral(resultado.erro.mensagem);
        return;
      }

      if (!edicao && 'senhaTemporaria' in resultado.dados) {
        // A senha só existe agora: navegar antes de exibi-la a perderia.
        setSenhaGerada({
          nome: resultado.dados.usuario.nome,
          senha: resultado.dados.senhaTemporaria,
        });
        return;
      }

      router.push('/admin/usuarios');
      router.refresh();
    });
  }

  const ehMotorista = valores.perfil === 'MOTORISTA';

  return (
    <>
      <form onSubmit={tratarEnvio} className="flex max-w-xl flex-col gap-4" noValidate>
        {erroGeral ? <MensagemErro mensagem={erroGeral} /> : null}

        <CampoTexto
          rotulo="Nome completo"
          value={valores.nome}
          onChange={(evento) => alterar('nome', evento.target.value)}
          erro={errosDeCampo.nome}
          disabled={salvando}
          required
          autoFocus
          maxLength={120}
          autoComplete="off"
        />

        {edicao && !podeEditarCpf ? (
          <CampoTexto
            rotulo="CPF"
            value={formatarCpf(valoresIniciais?.cpf ?? '')}
            readOnly
            disabled
            ajuda="O CPF não pode ser alterado: este usuário já possui registros de jornada."
          />
        ) : (
          <CampoCpf
            nome="cpf"
            valor={valores.cpf}
            aoAlterar={(valor) => alterar('cpf', valor)}
            erro={errosDeCampo.cpf}
            desabilitado={salvando}
          />
        )}

        <CampoTexto
          rotulo="Telefone (WhatsApp)"
          value={valores.telefone}
          onChange={(evento) => alterar('telefone', aplicarMascaraTelefone(evento.target.value))}
          erro={errosDeCampo.telefone}
          disabled={salvando}
          required
          inputMode="numeric"
          placeholder="(11) 99999-8888"
          maxLength={15}
          ajuda="Usado para receber o resumo do dia."
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="campo-perfil" className="text-texto text-sm font-medium">
            Perfil de acesso
            <span className="text-erro ml-1" aria-hidden>
              *
            </span>
          </label>
          <select
            id="campo-perfil"
            value={valores.perfil}
            onChange={(evento) => alterar('perfil', evento.target.value as 'ADMIN' | 'MOTORISTA')}
            disabled={salvando}
            aria-invalid={errosDeCampo.perfil ? true : undefined}
            className={`bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base ${
              errosDeCampo.perfil ? 'border-erro' : 'border-borda'
            }`}
          >
            <option value="MOTORISTA">Motorista</option>
            <option value="ADMIN">Administrador</option>
          </select>
          {errosDeCampo.perfil ? (
            <p role="alert" className="text-erro text-xs font-medium">
              {errosDeCampo.perfil}
            </p>
          ) : null}
        </div>

        <CampoTexto
          rotulo="Matrícula"
          value={valores.matricula}
          onChange={(evento) => alterar('matricula', evento.target.value)}
          erro={errosDeCampo.matricula}
          disabled={salvando}
          maxLength={30}
          ajuda="Opcional."
        />

        <CampoTexto
          rotulo="E-mail"
          type="email"
          value={valores.email}
          onChange={(evento) => alterar('email', evento.target.value)}
          erro={errosDeCampo.email}
          disabled={salvando}
          maxLength={160}
          ajuda="Opcional. Hoje o sistema não envia e-mails."
        />

        {ehMotorista ? (
          <fieldset className="border-borda flex flex-col gap-4 rounded-[--radius-padrao] border p-4">
            <legend className="text-texto px-1 text-sm font-medium">Habilitação</legend>

            <CampoTexto
              rotulo="Número da CNH"
              value={valores.cnhNumero}
              onChange={(evento) => alterar('cnhNumero', evento.target.value)}
              erro={errosDeCampo.cnhNumero}
              disabled={salvando}
              inputMode="numeric"
              maxLength={20}
            />

            <CampoTexto
              rotulo="Categoria"
              value={valores.cnhCategoria}
              onChange={(evento) => alterar('cnhCategoria', evento.target.value.toUpperCase())}
              erro={errosDeCampo.cnhCategoria}
              disabled={salvando}
              maxLength={5}
              placeholder="D"
            />

            <CampoTexto
              rotulo="Validade"
              type="date"
              value={valores.cnhValidade}
              onChange={(evento) => alterar('cnhValidade', evento.target.value)}
              erro={errosDeCampo.cnhValidade}
              disabled={salvando}
            />
          </fieldset>
        ) : null}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
          <Botao
            type="button"
            variante="secundaria"
            onClick={() => router.push('/admin/usuarios')}
            disabled={salvando}
          >
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvando}>
            {edicao ? 'Salvar alterações' : 'Cadastrar usuário'}
          </Botao>
        </div>
      </form>

      <ModalSenhaTemporaria
        aberto={senhaGerada !== null}
        nomeDoUsuario={senhaGerada?.nome ?? ''}
        senha={senhaGerada?.senha ?? ''}
        aoFechar={() => {
          setSenhaGerada(null);
          router.push('/admin/usuarios');
          router.refresh();
        }}
      />
    </>
  );
}
