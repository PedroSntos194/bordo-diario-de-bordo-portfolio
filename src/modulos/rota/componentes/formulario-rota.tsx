'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import type { ErrosDeCampo } from '@/lib/erros';
import { criarRota, editarRota } from '@/modulos/rota/rota.acoes';
import { ROTULO_TURNO, TURNOS } from '@/modulos/rota/rota.schema';

/** Formulário de rota (T24 · US012). */
interface Propriedades {
  valoresIniciais?: {
    id: string;
    codigo: string;
    nome: string;
    origem: string;
    destino: string;
    turno: (typeof TURNOS)[number];
    distanciaEstimadaKm: string;
  };
}

export function FormularioRota({ valoresIniciais }: Propriedades) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const edicao = Boolean(valoresIniciais);

  const [codigo, setCodigo] = useState(valoresIniciais?.codigo ?? '');
  const [nome, setNome] = useState(valoresIniciais?.nome ?? '');
  const [origem, setOrigem] = useState(valoresIniciais?.origem ?? '');
  const [destino, setDestino] = useState(valoresIniciais?.destino ?? '');
  const [turno, setTurno] = useState<(typeof TURNOS)[number]>(valoresIniciais?.turno ?? 'MANHA');
  const [distancia, setDistancia] = useState(valoresIniciais?.distanciaEstimadaKm ?? '');

  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});

  function tratarEnvio(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    setErroGeral(null);
    setErrosDeCampo({});

    iniciar(async () => {
      const carga = {
        ...(valoresIniciais ? { id: valoresIniciais.id } : {}),
        codigo,
        nome,
        origem,
        destino,
        turno,
        ...(distancia ? { distanciaEstimadaKm: distancia.replace(',', '.') } : {}),
      };

      const resultado = edicao ? await editarRota(carga) : await criarRota(carga);

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        if (!resultado.erro.campos) setErroGeral(resultado.erro.mensagem);
        return;
      }

      // Recém-criada, a rota segue direto para a edição: é lá que ficam os
      // pontos de parada, e cadastrar rota sem parada raramente é o que se quer.
      router.push(edicao ? '/admin/rotas' : `/admin/rotas/${resultado.dados.id}`);
      router.refresh();
    });
  }

  const podeEnviar = [codigo, nome, origem, destino].every((valor) => valor.trim() !== '');

  return (
    <form onSubmit={tratarEnvio} className="flex max-w-xl flex-col gap-4" noValidate>
      {erroGeral ? <MensagemErro mensagem={erroGeral} /> : null}

      <CampoTexto
        rotulo="Código"
        value={codigo}
        onChange={(evento) => setCodigo(evento.target.value.toUpperCase())}
        erro={errosDeCampo.codigo}
        disabled={salvando}
        required
        autoFocus
        maxLength={20}
        placeholder="R-014"
        ajuda="Identificador curto usado nos relatórios."
      />

      <CampoTexto
        rotulo="Nome da rota"
        value={nome}
        onChange={(evento) => setNome(evento.target.value)}
        erro={errosDeCampo.nome}
        disabled={salvando}
        required
        maxLength={120}
        placeholder="Centro → Fábrica"
      />

      <CampoTexto
        rotulo="Origem"
        value={origem}
        onChange={(evento) => setOrigem(evento.target.value)}
        erro={errosDeCampo.origem}
        disabled={salvando}
        required
        maxLength={160}
        placeholder="Terminal Centro"
      />

      <CampoTexto
        rotulo="Destino"
        value={destino}
        onChange={(evento) => setDestino(evento.target.value)}
        erro={errosDeCampo.destino}
        disabled={salvando}
        required
        maxLength={160}
        placeholder="Planta Industrial"
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="campo-turno" className="text-texto text-sm font-medium">
          Turno
          <span className="text-erro ml-1" aria-hidden>
            *
          </span>
        </label>
        <select
          id="campo-turno"
          value={turno}
          onChange={(evento) => setTurno(evento.target.value as (typeof TURNOS)[number])}
          disabled={salvando}
          className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
        >
          {TURNOS.map((opcao) => (
            <option key={opcao} value={opcao}>
              {ROTULO_TURNO[opcao]}
            </option>
          ))}
        </select>
      </div>

      <CampoTexto
        rotulo="Distância estimada (km)"
        value={distancia}
        onChange={(evento) => setDistancia(evento.target.value.replace(/[^\d,.]/g, ''))}
        erro={errosDeCampo.distanciaEstimadaKm}
        disabled={salvando}
        inputMode="decimal"
        placeholder="27,5"
        ajuda="Opcional. Serve para comparar o planejado com o rodado."
      />

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
        <Botao
          type="button"
          variante="secundaria"
          onClick={() => router.push('/admin/rotas')}
          disabled={salvando}
        >
          Cancelar
        </Botao>
        <Botao type="submit" carregando={salvando} disabled={!podeEnviar}>
          {edicao ? 'Salvar alterações' : 'Criar rota e definir paradas'}
        </Botao>
      </div>
    </form>
  );
}
