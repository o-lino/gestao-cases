import { useState, useEffect } from 'react'
import { breakpoints } from '@/lib/breakpoints'

export function useResponsive() {
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mobileQuery = window.matchMedia(breakpoints.mobile)
    const tabletQuery = window.matchMedia(breakpoints.tablet)
    const desktopQuery = window.matchMedia(breakpoints.desktop)

    const updateMatches = () => {
      setIsMobile(mobileQuery.matches)
      setIsTablet(tabletQuery.matches)
      setIsDesktop(desktopQuery.matches)
    }

    // Initial check
    updateMatches()
    
    // Add listeners
    mobileQuery.addEventListener('change', updateMatches)
    tabletQuery.addEventListener('change', updateMatches)
    desktopQuery.addEventListener('change', updateMatches)

    // Cleanup
    return () => {
      mobileQuery.removeEventListener('change', updateMatches)
      tabletQuery.removeEventListener('change', updateMatches)
      desktopQuery.removeEventListener('change', updateMatches)
    }
  }, [])

  return { isMobile, isTablet, isDesktop }
}
