/**
 * Voice Enrollment Page Component
 * Collects voice samples for speaker verification
 */

import React, { useState, useRef } from 'react';
import '../styles/VoiceEnrollment.css';
// @ts-ignore: Importing CSS module types
import '../styles/global.d.ts';

interface VoiceEnrollmentPageProps {
  token: any;
  onComplete: () => void;
}

export const VoiceEnrollmentPage: React.FC<VoiceEnrollmentPageProps> = ({
  token,
  onComplete
}) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Ready to enroll your voice');
  const SAMPLES_REQUIRED = 3;

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await uploadSample(audioBlob);
        
        // Stop the stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus(`Recording sample ${samples + 1}/${SAMPLES_REQUIRED}...`);
    } catch (err: any) {
      setError('Microphone access denied: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadSample = async (audioBlob: Blob) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', audioBlob, 'sample.wav');
      formData.append('sampleNumber', String(samples + 1));

      const response = await fetch('http://localhost:8000/api/voice/enroll', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`
        },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Upload failed');
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const data = await response.json();
      const newSamples = samples + 1;
      setSamples(newSamples);

      if (newSamples >= SAMPLES_REQUIRED) {
        setStatus('✓ Voice enrollment complete!');
        setTimeout(onComplete, 2000);
      } else {
        setStatus(`Sample ${newSamples}/${SAMPLES_REQUIRED} recorded. Ready for next sample.`);
      }
    } catch (err: any) {
      setError('Upload failed: ' + err.message);
      setStatus('Ready to enroll your voice');
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = (samples / SAMPLES_REQUIRED) * 100;

  return (
    <div className="enrollment-container">
      <div className="enrollment-card">
        <h1>🎤 Voice Enrollment</h1>
        <p className="subtitle">Record your voice for speaker verification</p>

        <div className="enrollment-info">
          <p>This system requires voice authentication for owner-only control.</p>
          <p>Please provide {SAMPLES_REQUIRED} voice samples to complete enrollment.</p>
        </div>

        <div className="progress-section">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="progress-text">
            {samples}/{SAMPLES_REQUIRED} samples recorded
          </p>
        </div>

        <div className="status-box">
          <p>{status}</p>
        </div>

        {samples < SAMPLES_REQUIRED && (
          <div className="button-group">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={loading}
                className="primary-button"
              >
                🎙️ Start Recording Sample {samples + 1}
              </button>
            ) : (
              <button
                onClick={stopRecording}
                disabled={loading}
                className="primary-button recording"
              >
                ⏹️ Stop Recording
              </button>
            )}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="enrollment-tips">
          <h3>Recording Tips:</h3>
          <ul>
            <li>Speak clearly and naturally</li>
            <li>Record in a quiet environment</li>
            <li>Each sample should be 5-10 seconds</li>
            <li>Use the same voice/tone for consistency</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
