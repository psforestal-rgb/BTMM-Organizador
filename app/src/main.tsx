import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { obtenerDb } from './config/contexto'
import { asegurarConfiguracionInicial } from './datos/configuracion'
import './styles.css'

registerSW({ immediate: true })
void asegurarConfiguracionInicial(obtenerDb())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
