import { Component, type ReactNode } from 'react'

// If WebGL is unavailable (old device, hardware acceleration off, driver
// trouble, a blocked context) three.js throws while creating its renderer.
// Without a boundary that error unmounts the whole React tree and the visitor
// gets a blank black page: no countdown, no logo, no music. Catching it here
// drops only the 3D layer; the photographed street, the countdown, the logo
// and the audio all keep working.
export default class SceneBoundary extends Component<
  { children: ReactNode; onFallback: () => void },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('3D scene disabled:', error)
    this.props.onFallback()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
