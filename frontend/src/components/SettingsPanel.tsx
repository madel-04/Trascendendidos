import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SettingsPanelProps {
  currentSettings: { targetScore: number; difficulty: string };
  onSave: (settings: { targetScore: number; difficulty: string }) => void;
  onCancel: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ currentSettings, onSave, onCancel }) => {
  const { t } = useTranslation();
  const [targetScore, setTargetScore] = useState(currentSettings.targetScore);
  const [difficulty, setDifficulty] = useState(currentSettings.difficulty);

  return (
    <div className="glass-panel settings-panel">
      <h2 className="title-glow" style={{ textAlign: 'center', marginBottom: '1rem' }}>{t('SETTINGS')}</h2>
      
      <div className="settings-fields">
        <label>
          <h3 style={{ margin: '0 0 10px 0' }}>{t('TARGET SCORE')}</h3>
          <div className="settings-stepper">
            <button 
              type="button"
              className="btn-premium secondary settings-stepper-btn"
              onClick={() => setTargetScore(s => Math.max(3, s - 1))}
            >-</button>
            <input 
              type="number" 
              value={targetScore} 
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) setTargetScore(Math.min(25, Math.max(3, val)));
              }}
              min={3} max={25}
              className="settings-input"
            />
            <button 
              className="btn-premium secondary settings-stepper-btn"
              type="button"
              onClick={() => setTargetScore(s => Math.min(25, s + 1))}
            >+</button>
          </div>
        </label>

        <label>
          <h3 style={{ margin: '0 0 10px 0' }}>{t('LOCAL DIFFICULTY')}</h3>
          <select 
            value={difficulty} 
            onChange={(e) => setDifficulty(e.target.value)}
            className="settings-select"
          >
            <option value="Beginner">{t('BEGINNER')}</option>
            <option value="Intermediate">{t('INTERMEDIATE')}</option>
            <option value="Expert">{t('EXPERT')}</option>
          </select>
        </label>
      </div>

      <div className="settings-actions">
        <button className="btn-premium secondary" style={{ flex: 1 }} onClick={onCancel}>{t('CANCEL')}</button>
        <button className="btn-premium" style={{ flex: 1 }} onClick={() => onSave({ targetScore, difficulty })}>{t('SAVE')}</button>
      </div>
    </div>
  );
};

export default SettingsPanel;
