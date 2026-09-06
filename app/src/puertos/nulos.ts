// Implementaciones nulas de los puertos aún no integrados en v0.1.
// Ninguna hace red ni IO; todas declaran disponible() === false.

import type {
  AIProvider,
  ClasificacionSugerida,
  ProtectedDataProvider,
  Pronostico,
  Sitio,
  Ventana,
  WeatherProvider,
} from './index'

export class AIProviderNulo implements AIProvider {
  disponible(): boolean {
    return false
  }
  async clasificarCaptura(_texto: string): Promise<ClasificacionSugerida | null> {
    return null
  }
}

export class WeatherProviderNulo implements WeatherProvider {
  disponible(): boolean {
    return false
  }
  async pronostico(_sitio: Sitio, _ventana: Ventana): Promise<Pronostico | null> {
    return null
  }
}

export class ProtectedDataProviderNulo implements ProtectedDataProvider {
  disponible(): boolean {
    return false
  }
  async tokenizar(_valor: string): Promise<string> {
    throw new Error('ProtectedDataProviderNulo no está disponible')
  }
  async resolver(_token: string): Promise<string | null> {
    return null
  }
}
