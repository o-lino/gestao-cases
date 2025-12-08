
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders login page by default (redirects)', () => {
    render(<App />)
    expect(screen.getByText(/Sign in to your account/i)).toBeInTheDocument()
  })
})
