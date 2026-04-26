import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', gap: '1rem',
        fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <h2 style={{ margin: 0 }}>Une erreur inattendue est survenue</h2>
        <p style={{ color: '#666', maxWidth: '480px' }}>
          {this.state.error?.message || 'Erreur inconnue'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={this.reset}
            style={{
              padding: '0.5rem 1.25rem', cursor: 'pointer',
              background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: '6px', fontSize: '0.9rem'
            }}
          >
            Réessayer
          </button>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '0.5rem 1.25rem', cursor: 'pointer',
              background: 'transparent', color: '#2563eb',
              border: '1px solid #2563eb', borderRadius: '6px', fontSize: '0.9rem'
            }}
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }
}
