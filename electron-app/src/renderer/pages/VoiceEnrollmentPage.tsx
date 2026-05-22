/**
 * Voice Enrollment Page Component
 * Saves the owner's voice with three fixed sentences.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from '../components/ThemeToggle';
import '../styles/VoiceEnrollment.css';
import '../styles/global.d.ts';
import { blobToWav } from '../utils/audio';
import { PYTHON_API } from '../config/api';

interface VoiceEnrollmentPageProps {
  token: any;
  onComplete: () => void;
}

const OWNER_SENTENCES = [
  'My voice is the owner key for this assistant.',
  'Only I can approve private system commands.',
  'AI Assistant, remember this voice as the owner.'
];

export const VoiceEnrollmentPage: React.FC<VoiceEnrollmentPageProps> = ({
  token,
  onComplete
}) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Ready to save the owner voice');
  const samplesRequired = OWNER_SENTENCES.length;
  const currentSentence = OWNER_SENTENCES[samples] || OWNER_SENTENCES[samplesRequired - 1];

  useEffect(() => {
    const loadEnrollmentStatus = async () => {
      try {
        const response = await fetch(`${PYTHON_API}/api/voice/status`, {
          headers: {
            'Authorization': `Bearer ${token.token}`
          }
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const savedSamples = Math.min(Number(data.samples || 0), samplesRequired);
        setSamples(savedSamples);

        if (data.enrolled) {
          setStatus('Owner voice already saved.');
          setTimeout(onComplete, 800);
        } else if (savedSamples > 0) {
          setStatus(`Sentence ${savedSamples}/${samplesRequired} saved. Continue with the next sentence.`);
        }
      } catch (err) {
        console.error('Unable to load voice enrollment status:', err);
      }
    };

    loadEnrollmentStatus();
  }, [token.token, onComplete, samplesRequired]);

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = MediaRecorder.isTypeSupported('audio/webm')
        ? { mimeType: 'audio/webm' }
        : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const wavBlob = await blobToWav(audioBlob);
        await uploadSample(wavBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus(`Recording sentence ${samples + 1}/${samplesRequired}...`);
    } catch (err: any) {
      setError('Microphone access denied: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadSample = async (audioBlob: Blob) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', audioBlob, `owner-sentence-${samples + 1}.wav`);
      formData.append('sampleNumber', String(samples + 1));
      formData.append('phrase', currentSentence);

      const response = await fetch(`${PYTHON_API}/api/voice/enroll`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed');
      }

      const newSamples = Math.min(Number(data.totalSamples || samples + 1), samplesRequired);
      setSamples(newSamples);

      if (newSamples >= samplesRequired) {
        setStatus('Owner voice saved.');
        setTimeout(onComplete, 1200);
      } else {
        setStatus(`Sentence ${newSamples}/${samplesRequired} saved. Continue with the next sentence.`);
      }
    } catch (err: any) {
      setError('Upload failed: ' + err.message);
      setStatus('Ready to save the owner voice');
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = (samples / samplesRequired) * 100;

  return (
    <div className="enrollment-container">
      <div className="enrollment-top-bar">
        <ThemeToggle />
      </div>
      <div className="enrollment-card">
        <h1>🎙️ Voice Enrollment</h1>
        <p className="subtitle">Save the owner's voice with three fixed sentences</p>

        <div className="enrollment-info">
          <p>Read each sentence aloud once. These three recordings become the owner's voice profile.</p>
        </div>

        {samples < samplesRequired && (
          <div className="sentence-card">
            <span>Sentence {samples + 1}</span>
            <p>{currentSentence}</p>
          </div>
        )}

        <div className="progress-section">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="progress-text">
            {samples}/{samplesRequired} owner sentences saved
          </p>
        </div>

        <div className="status-box">
          <p>{status}</p>
        </div>

        {samples < samplesRequired && (
          <div className="button-group">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={loading}
                className="primary-button"
              >
                Start Recording Sentence {samples + 1}
              </button>
            ) : (
              <button
                onClick={stopRecording}
                disabled={loading}
                className="primary-button recording"
              >
                Stop and Save
              </button>
            )}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="enrollment-tips">
          <h3>Recording Tips:</h3>
          <ul>
            <li>Read the sentence exactly as shown</li>
            <li>Record in a quiet environment</li>
            <li>Use the same voice and tone each time</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
