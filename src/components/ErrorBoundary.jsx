import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught:', error.message)
    console.error('[ErrorBoundary] component stack:', info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="max-w-md w-full px-6">
            <h1 className="text-lg font-semibold text-[#0F0F12] mb-2">Something went wrong</h1>
            <p className="text-sm text-[#999] font-mono bg-[#FAFAFA] border border-[#F0F0F4] rounded-lg px-3 py-2 mb-4 break-all">
              {this.state.error.message}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="text-sm text-[#5E6AD2] hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
