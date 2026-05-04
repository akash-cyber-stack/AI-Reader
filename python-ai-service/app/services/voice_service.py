"""
Voice Verification Service using SpeechBrain
Handles speaker verification and voice profile management
"""

import numpy as np
import logging
from typing import List, Tuple
import os

logger = logging.getLogger(__name__)

class VoiceVerificationService:
    """Speaker verification using embeddings"""
    
    def __init__(self):
        """Initialize voice verification service"""
        self.similarity_threshold = max(float(os.getenv('VOICE_CONFIDENCE_THRESHOLD', 0.85)), 0.88)
        logger.info("Voice Verification Service initialized")
    
    async def enroll_voice(self, audio_samples: List[bytes], sample_rate: int = 16000) -> List[List[float]]:
        """
        Generate voice embeddings for enrollment
        
        Args:
            audio_samples: List of audio byte buffers
            sample_rate: Audio sample rate (default 16000 Hz)
        
        Returns:
            List of embedding vectors
        """
        try:
            embeddings = []
            for audio_data in audio_samples:
                # In production, use SpeechBrain or similar model
                # For now, we'll use a placeholder that generates deterministic embeddings
                embedding = self._generate_embedding(audio_data, sample_rate)
                embeddings.append(embedding)
            
            logger.info(f"Generated {len(embeddings)} voice embeddings for enrollment")
            return embeddings
        except Exception as e:
            logger.error(f"Error in voice enrollment: {e}")
            raise
    
    async def verify_voice(self, audio_data: bytes, stored_embeddings: List[List[float]], 
                          sample_rate: int = 16000) -> Tuple[bool, float]:
        """
        Verify voice against stored embeddings
        
        Args:
            audio_data: Input audio bytes
            stored_embeddings: List of reference embeddings from enrollment
            sample_rate: Audio sample rate
        
        Returns:
            Tuple of (verified: bool, similarity: float)
        """
        try:
            input_embedding = self._generate_embedding(audio_data, sample_rate)
            if input_embedding[0] < 0.003:
                logger.info("Voice verification rejected: audio energy too low")
                return False, 0.0
            
            # Calculate similarity with stored embeddings
            similarities = []
            for stored_emb in stored_embeddings:
                similarity = self._cosine_similarity(input_embedding, stored_emb)
                similarities.append(similarity)
            
            avg_similarity = np.mean(similarities) if similarities else 0.0
            verified = avg_similarity >= self.similarity_threshold
            
            logger.info(f"Voice verification result: verified={verified}, similarity={avg_similarity:.4f}")
            return verified, float(avg_similarity)
        except Exception as e:
            logger.error(f"Error in voice verification: {e}")
            raise
    
    def _generate_embedding(self, audio_data: bytes, sample_rate: int) -> List[float]:
        """
        Generate a voice embedding from audio data
        
        In production, this would use SpeechBrain or similar model:
        from speechbrain.pretrained import SpeakerRecognition
        
        For now, using a deterministic placeholder
        """
        audio_payload = self._extract_pcm_payload(audio_data)

        if len(audio_payload) < 2:
            audio_array = np.array([0.0], dtype=np.float32)
        else:
            safe_length = len(audio_payload) - (len(audio_payload) % 2)
            audio_array = np.frombuffer(audio_payload[:safe_length], dtype=np.int16).astype(np.float32) / 32768.0

        if audio_array.size == 0:
            audio_array = np.array([0.0], dtype=np.float32)

        audio_array = audio_array - float(np.mean(audio_array))
        abs_audio = np.abs(audio_array)
        zero_crossing_rate = float(np.mean(np.abs(np.diff(np.signbit(audio_array)))))
        segment_count = 24
        segments = np.array_split(audio_array, segment_count)
        segment_energy = [
            float(np.sqrt(np.mean(segment ** 2))) if segment.size else 0.0
            for segment in segments
        ]

        embedding = [
            float(np.sqrt(np.mean(audio_array ** 2))),
            float(np.std(audio_array)),
            float(np.max(abs_audio)),
            float(np.mean(abs_audio)),
            float(np.median(abs_audio)),
            zero_crossing_rate,
            float(np.percentile(abs_audio, 25)),
            float(np.percentile(abs_audio, 75)),
            float(np.percentile(abs_audio, 95)),
            *segment_energy,
        ]
        
        # Pad to consistent size
        while len(embedding) < 512:
            embedding.append(0.0)
        
        return embedding[:512]

    def _extract_pcm_payload(self, audio_data: bytes) -> bytes:
        """Extract PCM data from a WAV file, otherwise return raw bytes."""
        if audio_data[:4] != b'RIFF' or audio_data[8:12] != b'WAVE':
            return audio_data

        offset = 12
        while offset + 8 <= len(audio_data):
            chunk_id = audio_data[offset:offset + 4]
            chunk_size = int.from_bytes(audio_data[offset + 4:offset + 8], 'little', signed=False)
            chunk_start = offset + 8
            chunk_end = chunk_start + chunk_size

            if chunk_id == b'data':
                return audio_data[chunk_start:chunk_end]

            offset = chunk_end + (chunk_size % 2)

        return audio_data[44:] if len(audio_data) > 44 else audio_data
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors
        """
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        
        dot_product = np.dot(v1, v2)
        magnitude1 = np.linalg.norm(v1)
        magnitude2 = np.linalg.norm(v2)
        
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        
        return float(dot_product / (magnitude1 * magnitude2))
