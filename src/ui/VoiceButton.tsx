import { useRef, useState } from 'react'
import { finishAgent, startAgent } from './agents'

type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type SpeechRec = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechResult) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function speechCtor(): (new () => SpeechRec) | null {
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechRec
    webkitSpeechRecognition?: new () => SpeechRec
  }
  return host.SpeechRecognition || host.webkitSpeechRecognition || null
}

export function VoiceButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [listening, setListening] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const rec = useRef<SpeechRec | null>(null)
  const heard = useRef(false)
  const job = useRef(0)

  function toggle() {
    const Ctor = speechCtor()
    if (!Ctor) {
      setUnsupported(true)
      return
    }
    if (listening && rec.current) {
      rec.current.stop()
      return
    }
    const recognition = new Ctor()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.continuous = false
    heard.current = false
    job.current = startAgent('Listen', 'Listening')
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim() || ''
      heard.current = true
      finishAgent(job.current, text || 'Nothing was heard.', !text)
      if (text) onTranscript(text)
    }
    recognition.onerror = () => {
      heard.current = true
      finishAgent(job.current, 'The microphone did not capture speech.', true)
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
      if (!heard.current) finishAgent(job.current, 'Nothing was heard.', true)
    }
    rec.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      heard.current = true
      finishAgent(job.current, 'The microphone did not capture speech.', true)
    }
  }

  return (
    <button
      type="button"
      className={listening ? 'voice-button on' : 'voice-button'}
      aria-pressed={listening}
      disabled={unsupported}
      title={unsupported ? 'This browser has no speech recognition.' : listening ? 'Stop listening' : 'Speak a search, a day summary, or a follow-up'}
      onClick={toggle}
    >
      {unsupported ? 'No voice' : listening ? 'Stop' : 'Voice'}
    </button>
  )
}
