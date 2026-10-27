'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapaMapLibre, Marker } from 'maplibre-gl';
import { MapPin } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * Seleção de coordenada em mapa (US013 · RF012).
 *
 * Duas decisões deliberadas:
 *
 * **O mapa é carregado sob demanda** (`import()` dentro do efeito). A biblioteca
 * é grande e só interessa a esta tela administrativa; carregá-la no pacote
 * principal pesaria no celular do motorista, que nunca a usa (RNF011).
 *
 * **Falha do mapa não bloqueia o cadastro** (RNF015). Se a biblioteca ou os
 * tiles não carregarem, os campos de latitude e longitude continuam editáveis à
 * mão e o ponto pode ser salvo do mesmo jeito.
 */

/** Centro inicial quando não há coordenada: São Paulo. ⚠️ V-17 — ajustar à cidade da operação. */
const CENTRO_PADRAO: [number, number] = [-46.6333, -23.5505];

interface Propriedades {
  latitude: number | null;
  longitude: number | null;
  aoSelecionar: (coordenada: { latitude: number; longitude: number }) => void;
}

export function SeletorCoordenada({ latitude, longitude, aoSelecionar }: Propriedades) {
  const container = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaMapLibre | null>(null);
  const marcador = useRef<Marker | null>(null);
  const aoSelecionarRef = useRef(aoSelecionar);

  const [falhou, setFalhou] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // Mantém o callback atual sem recriar o mapa a cada renderização.
  useEffect(() => {
    aoSelecionarRef.current = aoSelecionar;
  }, [aoSelecionar]);

  useEffect(() => {
    let cancelado = false;

    async function montar(): Promise<void> {
      if (!container.current) return;

      try {
        const maplibre = await import('maplibre-gl');
        if (cancelado || !container.current) return;

        const instancia = new maplibre.Map({
          container: container.current,
          // Estilo raster declarado em linha: sem isto, o MapLibre buscaria um
          // JSON de estilo em servidor externo, que a CSP bloqueia.
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
          center: latitude !== null && longitude !== null ? [longitude, latitude] : CENTRO_PADRAO,
          zoom: latitude !== null && longitude !== null ? 15 : 11,
          attributionControl: { compact: true },
        });

        instancia.addControl(new maplibre.NavigationControl(), 'top-right');

        instancia.on('load', () => {
          if (!cancelado) setCarregando(false);
        });

        instancia.on('click', (evento) => {
          const { lat, lng } = evento.lngLat;
          aoSelecionarRef.current({
            latitude: Number(lat.toFixed(7)),
            longitude: Number(lng.toFixed(7)),
          });
        });

        instancia.on('error', () => {
          if (!cancelado) setFalhou(true);
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
      marcador.current = null;
    };
    // Monta uma única vez: a coordenada inicial só define a posição de partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reposiciona o marcador e a câmera quando a coordenada muda por fora
  // (clique no mapa, busca por endereço ou digitação manual).
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;

    async function atualizarMarcador(): Promise<void> {
      if (latitude === null || longitude === null) {
        marcador.current?.remove();
        marcador.current = null;
        return;
      }

      const maplibre = await import('maplibre-gl');
      if (!mapa.current) return;

      if (!marcador.current) {
        marcador.current = new maplibre.Marker({ color: '#7c3aed' });
      }

      marcador.current.setLngLat([longitude, latitude]).addTo(mapa.current);
      mapa.current.easeTo({ center: [longitude, latitude], duration: 400 });
    }

    void atualizarMarcador();
  }, [latitude, longitude]);

  if (falhou) {
    return (
      <div className="border-borda bg-superficie text-texto-suave flex flex-col items-center gap-2 rounded-[--radius-padrao] border border-dashed p-6 text-center text-sm">
        <MapPin aria-hidden className="size-6" />
        <p>Não foi possível carregar o mapa.</p>
        <p className="text-xs">
          Informe a latitude e a longitude nos campos abaixo, ou salve o ponto sem coordenadas.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Altura reservada antes de carregar, para o layout não saltar (doc 11). */}
      <div
        ref={container}
        role="application"
        aria-label="Mapa para selecionar a coordenada do ponto de parada"
        className="border-borda h-64 w-full overflow-hidden rounded-[--radius-padrao] border"
      />
      {carregando ? (
        <div className="bg-superficie/80 text-texto-suave absolute inset-0 flex items-center justify-center rounded-[--radius-padrao] text-sm">
          Carregando mapa…
        </div>
      ) : null}
      <p className="text-texto-suave mt-1 text-xs">
        Toque no mapa para marcar o local exato do ponto.
      </p>
    </div>
  );
}
