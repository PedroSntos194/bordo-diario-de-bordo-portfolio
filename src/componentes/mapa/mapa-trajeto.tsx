'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapaMapLibre } from 'maplibre-gl';
import { MapPinOff } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * Trajeto da corrida no mapa (US029 · RF034 · RN022, RN029).
 *
 * Herda as duas decisões do `SeletorCoordenada`, pelos mesmos motivos:
 * **carregamento sob demanda** (a biblioteca é grande e não deve pesar no
 * pacote do motorista) e **falha isolada** — se o mapa não subir, o restante do
 * detalhe da corrida continua acessível, que é critério de aceitação explícito.
 *
 * A rolagem por scroll fica **desligada**. Num celular, um mapa que captura o
 * gesto de rolagem prende a página: o dedo tenta descer e o mapa dá zoom. O
 * usuário aproxima com dois dedos, ou pelos controles.
 */

interface PontoDoTrajeto {
  id: string;
  latitude: number;
  longitude: number;
  precisaoMetros: number | null;
  capturadoEm: string;
  /** "Início", "Chegada · Terminal Norte", "Encerramento"… */
  rotulo: string;
}

interface Propriedades {
  pontos: PontoDoTrajeto[];
}

/** Cor por posição: o primeiro e o último ponto ancoram a leitura. */
function corDoPonto(indice: number, total: number): string {
  if (indice === 0) return '#15803d';
  if (indice === total - 1) return '#b91c1c';
  return '#1e3a5f';
}

export function MapaTrajeto({ pontos }: Propriedades) {
  const container = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaMapLibre | null>(null);

  const [falhou, setFalhou] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    if (pontos.length === 0) return;

    async function montar(): Promise<void> {
      if (!container.current) return;

      try {
        const maplibre = await import('maplibre-gl');
        if (cancelado || !container.current) return;

        const coordenadas = pontos.map(
          (ponto) => [ponto.longitude, ponto.latitude] as [number, number],
        );

        const instancia = new maplibre.Map({
          container: container.current,
          // Estilo raster em linha: um JSON de estilo externo é bloqueado pela
          // CSP (ver a nota no doc 14).
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap',
              },
            },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
          },
          center: coordenadas[0],
          zoom: 14,
          attributionControl: { compact: true },
          // Ver a nota no cabeçalho: mapa que captura a rolagem prende a página
          // no celular.
          scrollZoom: false,
          cooperativeGestures: true,
        });

        instancia.addControl(new maplibre.NavigationControl(), 'top-right');

        // Marcadores **fora** do evento `load`.
        //
        // `load` só dispara depois do primeiro quadro renderizado; uma aba em
        // segundo plano, ou um contêiner ainda sem altura, adiam esse quadro
        // indefinidamente e os marcadores nunca apareceriam. Marcador não
        // depende de render — só de o mapa existir —, então ele entra já.
        pontos.forEach((ponto, indice) => {
          const elemento = document.createElement('div');
          elemento.textContent = String(indice + 1);
          elemento.setAttribute('aria-label', `Ponto ${indice + 1}: ${ponto.rotulo}`);
          elemento.style.cssText = [
            `background:${corDoPonto(indice, pontos.length)}`,
            'color:#fff',
            'width:26px',
            'height:26px',
            'border-radius:50%',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'font-size:12px',
            'font-weight:600',
            'border:2px solid #fff',
            'box-shadow:0 1px 3px rgba(0,0,0,.4)',
            'cursor:pointer',
          ].join(';');

          const precisao =
            ponto.precisaoMetros === null
              ? 'precisão não informada'
              : `precisão de ${Math.round(ponto.precisaoMetros)} m`;

          new maplibre.Marker({ element: elemento })
            .setLngLat([ponto.longitude, ponto.latitude])
            .setPopup(
              new maplibre.Popup({ offset: 16, closeButton: true }).setText(
                `${indice + 1}. ${ponto.rotulo} · ${ponto.capturadoEm} · ${precisao}`,
              ),
            )
            .addTo(instancia);
        });

        // O mapa já está utilizável aqui: existe, tem tamanho e tem marcadores.
        // Prender o indicador de carregamento a um evento de estilo ou de
        // render deixava a tarja "Carregando…" por cima de um mapa pronto
        // sempre que o evento disparava antes de o ouvinte ser registrado.
        setCarregando(false);

        /**
         * A linha do trajeto depende do **estilo** carregado, não do render.
         *
         * O evento é `styledata`, não `style.load`: este último é do Mapbox GL,
         * e no MapLibre nunca dispara — um manipulador registrado nele fica
         * silenciosamente morto, e a linha jamais é desenhada.
         */
        const desenharTrajeto = (): void => {
          if (cancelado || !instancia.isStyleLoaded()) return;
          if (instancia.getSource('trajeto')) return;

          // Com um ponto só não há linha a desenhar — o marcador sozinho já
          // conta a história.
          if (coordenadas.length > 1) {
            instancia.addSource('trajeto', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: coordenadas },
              },
            });

            instancia.addLayer({
              id: 'trajeto',
              type: 'line',
              source: 'trajeto',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#1e3a5f', 'line-width': 3, 'line-opacity': 0.7 },
            });
          }

          // Enquadra o trajeto inteiro. Com um ponto só, `fitBounds` degeneraria
          // para zoom máximo — daí a condição.
          if (coordenadas.length > 1) {
            const limites = coordenadas.reduce(
              (caixa, coordenada) => caixa.extend(coordenada),
              new maplibre.LngLatBounds(coordenadas[0], coordenadas[0]),
            );
            instancia.fitBounds(limites, { padding: 48, maxZoom: 16, duration: 0 });
          }
        };

        // Dois gatilhos, e `desenharTrajeto` é idempotente: dependendo do
        // momento em que o estilo termina de ser processado, um ou outro chega
        // primeiro, e amarrar-se a um só deixa a linha sem desenhar.
        if (instancia.isStyleLoaded()) desenharTrajeto();
        instancia.on('styledata', desenharTrajeto);
        instancia.on('load', desenharTrajeto);

        /**
         * Só falha de verdade derruba o mapa.
         *
         * O MapLibre emite `error` para cada tile que não chega — e um tile
         * ausente numa borda é rotina, não defeito. Tratar todo `error` como
         * fatal fazia o aviso de falha cobrir um mapa que estava desenhado e
         * utilizável.
         */
        instancia.on('error', (evento) => {
          const mensagem = String(
            (evento as { error?: { message?: string } }).error?.message ?? '',
          );
          const ehTile = mensagem.includes('tile') || mensagem.includes('AJAXError');
          if (!cancelado && !ehTile) setFalhou(true);
        });

        mapa.current = instancia;
      } catch {
        if (!cancelado) {
          setFalhou(true);
          setCarregando(false);
        }
      }
    }

    void montar();

    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
    };
    // Monta uma vez: o trajeto de uma corrida encerrada não muda enquanto a
    // tela está aberta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Corrida sem pontos: mensagem explicativa, não um mapa vazio (RN022 — o
  // registro sem GPS continua válido, e a tela precisa dizer isso).
  if (pontos.length === 0) {
    return (
      <div className="border-borda text-texto-suave flex flex-col items-center gap-2 rounded-[--radius-padrao] border border-dashed p-6 text-center text-sm">
        <MapPinOff aria-hidden className="size-6" />
        <p className="text-texto font-medium">Sem localização registrada nesta corrida</p>
        <p>
          O GPS pode estar desligado, sem sinal ou sem permissão. O registro da corrida continua
          válido.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="border-borda relative overflow-hidden rounded-[--radius-padrao] border">
        <div ref={container} className="h-64 w-full sm:h-80" />

        {carregando && !falhou ? (
          <p className="bg-superficie/80 text-texto-suave absolute inset-0 flex items-center justify-center text-sm">
            Carregando o mapa…
          </p>
        ) : null}

        {falhou ? (
          <p
            role="status"
            className="bg-superficie text-texto-suave absolute inset-0 flex items-center justify-center p-4 text-center text-sm"
          >
            Não foi possível carregar o mapa. Os pontos continuam listados abaixo.
          </p>
        ) : null}
      </div>

      <p className="text-texto-suave text-xs">
        Aproxime com dois dedos ou pelos controles — a rolagem da página continua funcionando.
      </p>
    </div>
  );
}
