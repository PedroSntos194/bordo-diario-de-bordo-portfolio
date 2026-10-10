/**
 * Coordenadas geográficas (RF016, RF034).
 *
 * A distância calculada aqui **não** substitui o odômetro: ela é a linha reta
 * entre dois pontos, não o caminho percorrido. Serve para validação grosseira e
 * para exibição no mapa — a quilometragem oficial vem do odômetro (RN018).
 */

export interface Coordenada {
  latitude: number;
  longitude: number;
}

const RAIO_DA_TERRA_KM = 6371;

/** Precisão pior que isto é sinalizada ao usuário e no relatório (US020). */
export const PRECISAO_RUIM_METROS = 100;

export function coordenadaEhValida(coordenada: Coordenada): boolean {
  const { latitude, longitude } = coordenada;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    // (0,0) fica no Atlântico: na prática é leitura falha, não posição real.
    !(latitude === 0 && longitude === 0)
  );
}

export function precisaoEhRuim(precisaoMetros: number | null | undefined): boolean {
  return (
    precisaoMetros !== null && precisaoMetros !== undefined && precisaoMetros > PRECISAO_RUIM_METROS
  );
}

/** Distância em linha reta, em quilômetros (fórmula de Haversine). */
export function distanciaEmKm(origem: Coordenada, destino: Coordenada): number {
  const paraRadianos = (grau: number): number => (grau * Math.PI) / 180;

  const deltaLatitude = paraRadianos(destino.latitude - origem.latitude);
  const deltaLongitude = paraRadianos(destino.longitude - origem.longitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(paraRadianos(origem.latitude)) *
      Math.cos(paraRadianos(destino.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * RAIO_DA_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** `-23,550500 / -46,633300` */
export function formatarCoordenada(coordenada: Coordenada): string {
  const formatar = (valor: number): string => valor.toFixed(6).replace('.', ',');
  return `${formatar(coordenada.latitude)} / ${formatar(coordenada.longitude)}`;
}

/**
 * Arredonda a coordenada para servir de chave de cache da geocodificação
 * reversa. Quatro casas ≈ 11 metros: suficiente para reaproveitar o endereço de
 * um mesmo ponto de parada sem repetir a consulta ao provedor externo.
 */
export function chaveDeCacheGeografica(coordenada: Coordenada): string {
  return `${coordenada.latitude.toFixed(4)},${coordenada.longitude.toFixed(4)}`;
}
