import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(() => {
  window.history.pushState({}, '', '/')
})

describe('App', () => {
  it('muestra HOY por defecto y navega a las otras tres superficies', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Hoy' })).toBeInTheDocument()

    for (const [etiqueta, titulo] of [
      ['Capturar', 'Capturar'],
      ['Radar', 'Radar'],
      ['Bitácora', 'Bitácora'],
    ] as const) {
      screen.getByRole('button', { name: etiqueta }).click()
      expect(await screen.findByRole('heading', { name: titulo })).toBeInTheDocument()
    }
  })
})
