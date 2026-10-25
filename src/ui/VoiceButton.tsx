import { useEffect, useRef, useState } from 'react'
import { finishAgent, startAgent } from './agents'

type SpeechResult = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}
type SpeechRec = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechResult) => void) | null
  onerror: ((event: { error: string }) => void) | null
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

function isField(node: unknown): node is HTMLInputElement | HTMLTextAreaElement {
  return node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
}

function writeField(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  setter?.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

function chosenField(targetId?: string, remembered?: HTMLInputElement | HTMLTextAreaElement | null) {
  const named = targetId ? document.getElementById(targetId) : null
  const chosen = isField(named) ? named : isField(remembered) ? remembered : document.getElementById('ask')
  return isField(chosen) ? chosen : null
}

function placeText(text: string, box: HTMLInputElement | HTMLTextAreaElement | null, base: string, onText?: (text: string) => void) {
  const next = base ? `${base} ${text}` : text
  if (box) writeField(box, next)
  else onText?.(next)
}

export function VoiceButton({
  targetId,
  onText,
}: {
  targetId?: string
  onText?: (text: string) => void
}) {
  const [listening, setListening] = useState(false)
  const [problem, setProblem] = useState('')
  const rec = useRef<SpeechRec | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const live = useRef(false)
  const heard = useRef(false)
  const job = useRef(0)
  const lastField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const box = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const base = useRef('')

  useEffect(() => {
    const remember = (event: FocusEvent) => {
      if (isField(event.target)) lastField.current = event.target
    }
    document.addEventListener('focusin', remember)
    return () => document.removeEventListener('focusin', remember)
  }, [])

  function stopMic() {
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
  }

  function finish(detail: string, failed = false) {
    if (!job.current) return
    finishAgent(job.current, detail, failed)
    job.current = 0
  }

  async function transcribeRecording() {
    const blob = new Blob(chunks.current, { type: recorder.current?.mimeType || 'audio/webm' })
    chunks.current = []
    stopMic()
    if (!blob.size) {
      setListening(false)
      setProblem('Nothing heard')
      finish('Nothing was heard.', true)
      return
    }
    setProblem('')
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'content-type': blob.type || 'audio/webm' },
        body: blob,
      })
      const data = await response.json().catch(() => ({}))
      const text = typeof data?.text === 'string' ? data.text.trim() : ''
      if (!response.ok || !text) throw new Error(data?.error || 'Transcription did not return words.')
      heard.current = true
      placeText(text, box.current, base.current, onText)
      finish(text)
    } catch (error) {
      setProblem('Speech failed')
      finish(error instanceof Error ? error.message : 'Transcription did not return words.', true)
    } finally {
      setListening(false)
    }
  }

  function stop() {
    live.current = false
    if (recorder.current && recorder.current.state !== 'inactive') {
      recorder.current.stop()
      return
    }
    rec.current?.stop()
    stopMic()
    setListening(false)
    if (!heard.current) finish('Nothing was heard.', true)
    else finish('Captured speech.')
  }

  async function start() {
    setProblem('')
    heard.current = false
    live.current = true
    setListening(true)
    job.current = startAgent('Listen', 'Recording')
    box.current = chosenField(targetId, lastField.current)
    base.current = box.current?.value.trim() || ''
    let mic: MediaStream
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      live.current = false
      setListening(false)
      setProblem('Microphone blocked')
      finish('The microphone was blocked.', true)
      return
    }
    const Ctor = speechCtor()
    if (!Ctor) {
      stream.current = mic
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const media = new MediaRecorder(mic, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      media.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data)
      }
      media.onstop = () => {
        void transcribeRecording()
      }
      recorder.current = media
      media.start()
      return
    }
    mic.getTracks().forEach((track) => track.stop())
    const recognition = new Ctor()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.onresult = (event) => {
      let spoken = ''
      for (let index = 0; index < event.results.length; index += 1) {
        spoken += event.results[index][0]?.transcript || ''
      }
      spoken = spoken.replace(/\s+/g, ' ').trim()
      if (!spoken) return
      heard.current = true
      placeText(spoken, box.current, base.current, onText)
    }
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      live.current = false
      setListening(false)
      setProblem(event.error === 'not-allowed' ? 'Microphone blocked' : 'Speech failed')
      finish(event.error === 'not-allowed' ? 'The microphone was blocked.' : 'Speech recognition failed.', true)
    }
    recognition.onend = () => {
      if (!live.current) return
      try {
        recognition.start()
      } catch {
        live.current = false
        setListening(false)
        finish(heard.current ? 'Captured speech.' : 'Nothing was heard.', !heard.current)
      }
    }
    rec.current = recognition
    try {
      recognition.start()
    } catch {
      live.current = false
      setListening(false)
      setProblem('Speech failed')
      finish('Speech recognition failed.', true)
    }
  }

  return (
    <button
      type="button"
      className={listening ? 'voice-button live' : 'voice-button'}
      aria-pressed={listening}
      title={problem || (listening ? 'Stop and transcribe' : 'Record and put the words in this field')}
      onClick={() => (listening ? stop() : void start())}
    >
      {listening ? 'Recording' : problem || 'Voice'}
    </button>
  )
}
