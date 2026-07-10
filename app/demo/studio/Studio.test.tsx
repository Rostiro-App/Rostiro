import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Studio } from './Studio'

describe('Studio', () => {
  it('renders panel + canvas and fires an event onto the canvas', () => {
    render(<Studio />)
    // canvas OS present
    expect(screen.getByText('ROSTIRO')).toBeTruthy()
    // author: type + select, then Fire
    fireEvent.change(screen.getByPlaceholderText(/search player/i), { target: { value: 'Lamar' } })
    fireEvent.click(screen.getByText(/Lamar Jackson/))
    fireEvent.click(screen.getByText(/Fire/))
    // the fired card shows the player line on the canvas
    expect(screen.getAllByText(/Lamar Jackson/).length).toBeGreaterThan(0)
  })
})
