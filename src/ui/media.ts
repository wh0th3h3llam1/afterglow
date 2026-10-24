import { useEffect, useState } from 'react'

function useMatch(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export const useReducedMotion = () => useMatch('(prefers-reduced-motion: reduce)')
export const useReducedTransparency = () => useMatch('(prefers-reduced-transparency: reduce)')
export const useNarrow = () => useMatch('(max-width: 767px)')
