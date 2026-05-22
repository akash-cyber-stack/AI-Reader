import React from 'react';
import { FeatureCategory } from '../data/featureCategories';
import '../styles/FeatureModal.css';

interface FeatureModalProps {
  feature: FeatureCategory | null;
  onClose: () => void;
}

export const FeatureModal: React.FC<FeatureModalProps> = ({ feature, onClose }) => {
  if (!feature) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="modal-header">
          <span className="modal-icon">{feature.icon}</span>
          <div>
            <h2>{feature.title}</h2>
            <p>{feature.desc}</p>
          </div>
        </div>
        <section className="modal-section">
          <h3>Voice commands</h3>
          <ul className="modal-command-list">
            {feature.commands.map((cmd) => (
              <li key={cmd}>{cmd}</li>
            ))}
          </ul>
        </section>
        <section className="modal-section">
          <h3>Details</h3>
          <ul className="modal-detail-list">
            {feature.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};
