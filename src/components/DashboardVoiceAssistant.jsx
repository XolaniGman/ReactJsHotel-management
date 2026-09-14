import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { askDashboardAssistant } from '../services/geminiAssistant';

const SpeechRecognitionApi = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

export default function DashboardVoiceAssistant() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi, I'm your dashboard concierge. Tap the mic and ask me anything — like \"take me to book a spa\" or \"where do I pay my bill\"." },
  ]);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!SpeechRecognitionApi) return;
    const recognition = new SpeechRecognitionApi();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleUserSpeech(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      setError("Didn't catch that — try again.");
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const handleUserSpeech = async (transcript) => {
    if (!transcript?.trim()) return;
    setError('');
    const nextMessages = [...messages, { role: 'user', text: transcript }];
    setMessages(nextMessages);
    setThinking(true);
    try {
      const { speak: reply, navigateTo } = await askDashboardAssistant(transcript, nextMessages);
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
      speak(reply);
      if (navigateTo) navigate(navigateTo);
    } catch {
      const fallback = "Sorry, I couldn't reach the assistant just now. Please try again in a moment.";
      setMessages((prev) => [...prev, { role: 'assistant', text: fallback }]);
      setError(fallback);
    } finally {
      setThinking(false);
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      setError('Voice input is not supported in this browser — try Chrome.');
      return;
    }
    setError('');
    setListening(true);
    try {
      recognitionRef.current.start();
    } catch {
      setListening(false);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return (
    <div className={`dash-assistant ${open ? 'open' : ''}`}>
      {open && (
        <div className="dash-assistant-panel">
          <div className="dash-assistant-header">
            <span><i className="bi bi-stars me-2" />Dashboard Concierge</span>
            <button type="button" className="dash-assistant-close" onClick={() => setOpen(false)} aria-label="Close assistant">
              <i className="bi bi-x-lg" />
            </button>
          </div>
          <div className="dash-assistant-body">
            {messages.map((m, i) => (
              <div key={i} className={`dash-assistant-bubble ${m.role}`}>{m.text}</div>
            ))}
            {thinking && <div className="dash-assistant-bubble assistant is-thinking"><i className="bi bi-three-dots" /></div>}
            {error && <div className="dash-assistant-error"><i className="bi bi-exclamation-triangle me-1" />{error}</div>}
          </div>
          <div className="dash-assistant-footer">
            <button
              type="button"
              className={`dash-assistant-mic ${listening ? 'listening' : ''}`}
              onClick={listening ? stopListening : startListening}
              disabled={thinking}
            >
              <i className={`bi ${listening ? 'bi-mic-fill' : 'bi-mic'}`} />
            </button>
            <span className="dash-assistant-hint">
              {listening ? 'Listening…' : thinking ? 'Thinking…' : 'Tap to speak'}
            </span>
          </div>
        </div>
      )}
      <button type="button" className="dash-assistant-toggle" onClick={() => setOpen((v) => !v)} aria-label="Toggle voice assistant">
        <i className={`bi ${open ? 'bi-x-lg' : 'bi-mic'}`} />
      </button>
    </div>
  );
}
