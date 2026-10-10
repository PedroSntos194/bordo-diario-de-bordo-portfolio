'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import type { ErrosDeCampo } from '@/lib/erros';
import { criarVeiculo, editarVeiculo } from '@/modulos/veiculo/veiculo.acoes';
import { formatarPlaca, normalizarPlaca } from '@/utilitarios/placa';
import { formatarOdometro } from '@/utilitarios/numero';
import { AjudaNaTela } from '@/componentes/feedback/ajuda-na-tela';

/** Formulário de veículo (T22 · US011). */
interface Propriedades {
  valoresIniciais?: {
    id: string;
    placa: string;
    modelo: string;
    marca: string | null;
    ano: number | null;
    capacidadePassageiros: number;
    odometroAtual: number;
    observacoes: string | null;
  };
}

export function FormularioVeiculo({ valoresIniciais }: Propriedades) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const edicao = Boolean(valoresIniciais);

  const [placa, setPlaca] = useState(valoresIniciais ? formatarPlaca(valoresIniciais.placa) : '');
  const [modelo, setModelo] = useState(valoresIniciais?.modelo ?? '');
  const [marca, setMarca] = useState(valoresIniciais?.marca ?? '');
  const [ano, setAno] = useState(valoresIniciais?.ano ? String(valoresIniciais.ano) : '');
  const [capacidade, setCapacidade] = useState(
    valoresIniciais ? String(valoresIniciais.capacidadePassageiros) : '',
  );
  const [odometro, setOdometro] = useState('');
  const [observacoes, setObservacoes] = useState(valoresIniciais?.observacoes ?? '');

  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});

  function tratarEnvio(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    setErroGeral(null);
    setErrosDeCampo({});

    iniciar(async () => {
      const carga = {
        ...(valoresIniciais ? { id: valoresIniciais.id } : {}),
        placa: normalizarPlaca(placa),
        modelo,
        marca,
        ...(ano ? { ano } : {}),
        capacidadePassageiros: capacidade,
        observacoes,
        // O odômetro só é informado no cadastro: depois disso quem o move é a
        // operação (RN020), não o formulário.
        ...(edicao ? {} : { odometroAtual: odometro }),
      };

      const resultado = edicao ? await editarVeiculo(carga) : await criarVeiculo(carga);

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        if (!resultado.erro.campos) setErroGeral(resultado.erro.mensagem);
        return;
      }

      const parametros = new URLSearchParams({
        salvo: resultado.dados.id,
        acao: edicao ? 'atualizado' : 'cadastrado',
        busca: resultado.dados.placa,
      });
      router.push(`/admin/veiculos?${parametros.toString()}`);
      router.refresh();
    });
  }

  const podeEnviar =
    placa.trim() !== '' && modelo.trim() !== '' && capacidade !== '' && (edicao || odometro !== '');

  return (
    <form onSubmit={tratarEnvio} className="flex max-w-xl flex-col gap-4" noValidate>
      <AjudaNaTela
        titulo={edicao ? 'Editar uma van' : 'Cadastrar uma van'}
        passos={[
          'Confira a placa e o modelo. Informe apenas os lugares para passageiros, sem contar o motorista.',
          edicao
            ? 'O odômetro acompanha os registros da operação. Para corrigir uma leitura, procure a jornada correspondente.'
            : 'Copie a quilometragem total do painel. Exemplo: 125.430 km → digite 125430.',
          'Preencha os campos com asterisco, toque no botão de salvar e espere a confirmação na lista.',
        ]}
      />
      {erroGeral ? <MensagemErro mensagem={erroGeral} /> : null}

      <CampoTexto
        rotulo="Placa"
        value={placa}
        onChange={(evento) => setPlaca(evento.target.value.toUpperCase())}
        erro={errosDeCampo.placa}
        disabled={salvando}
        required
        autoFocus
        maxLength={8}
        placeholder="ABC-1234 ou ABC1D23"
        ajuda="Aceita o formato antigo e o Mercosul."
      />

      <CampoTexto
        rotulo="Modelo"
        value={modelo}
        onChange={(evento) => setModelo(evento.target.value)}
        erro={errosDeCampo.modelo}
        disabled={salvando}
        required
        maxLength={60}
        placeholder="Sprinter 416"
      />

      <CampoTexto
        rotulo="Marca"
        value={marca}
        onChange={(evento) => setMarca(evento.target.value)}
        erro={errosDeCampo.marca}
        disabled={salvando}
        maxLength={60}
        ajuda="Opcional."
      />

      <CampoTexto
        rotulo="Ano"
        value={ano}
        onChange={(evento) => setAno(evento.target.value.replace(/\D/g, '').slice(0, 4))}
        erro={errosDeCampo.ano}
        disabled={salvando}
        inputMode="numeric"
        maxLength={4}
        ajuda="Opcional."
      />

      <CampoTexto
        rotulo="Capacidade de passageiros"
        value={capacidade}
        onChange={(evento) => setCapacidade(evento.target.value.replace(/\D/g, '').slice(0, 2))}
        erro={errosDeCampo.capacidadePassageiros}
        disabled={salvando}
        required
        inputMode="numeric"
        ajuda="Quantidade de lugares para passageiros, sem contar o motorista."
      />

      {edicao ? (
        <CampoTexto
          rotulo="Odômetro atual"
          value={`${formatarOdometro(valoresIniciais?.odometroAtual ?? 0)} km`}
          readOnly
          disabled
          ajuda="Atualizado automaticamente pelo encerramento das jornadas. Para corrigir, corrija a jornada."
        />
      ) : (
        <CampoTexto
          rotulo="Odômetro atual"
          value={odometro}
          onChange={(evento) => setOdometro(evento.target.value.replace(/\D/g, '').slice(0, 7))}
          erro={errosDeCampo.odometroAtual}
          disabled={salvando}
          required
          inputMode="numeric"
          ajuda="Leitura do painel no momento do cadastro, em quilômetros."
        />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="campo-observacoes" className="text-texto text-sm font-medium">
          Observações
        </label>
        <textarea
          id="campo-observacoes"
          value={observacoes}
          onChange={(evento) => setObservacoes(evento.target.value)}
          disabled={salvando}
          maxLength={500}
          rows={3}
          className="border-borda bg-fundo text-texto rounded-[--radius-padrao] border px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
        <Botao
          type="button"
          variante="secundaria"
          onClick={() => router.push('/admin/veiculos')}
          disabled={salvando}
        >
          Cancelar
        </Botao>
        <Botao type="submit" carregando={salvando} disabled={!podeEnviar}>
          {edicao ? 'Salvar alterações' : 'Cadastrar veículo'}
        </Botao>
      </div>
    </form>
  );
}
