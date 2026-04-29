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
    <div className="glass-panel" style={{ padding: '2rem', maxWidth: '500px', width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem', margin: 'auto' }}>
      <h2 className="title-glow" style={{ textAlign: 'center', marginBottom: '1rem' }}>{t('SETTINGS')}</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <label>
          <h3 style={{ margin: '0 0 10px 0' }}>{t('TARGET SCORE')}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              className="btn-premium secondary" 
              style={{ width: '50px', height: '50px', fontSize: '1.5rem', padding: 0 }}
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
              style={{ flex: 1, textAlign: 'center', padding: '12px', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid var(--accent-cyan)', borderRadius: '8px', fontSize: '1.5rem' }}
            />
            <button 
              className="btn-premium secondary" 
              style={{ width: '50px', height: '50px', fontSize: '1.5rem', padding: 0 }}
              onClick={() => setTargetScore(s => Math.min(25, s + 1))}
            >+</button>
          </div>
        </label>

        <label>
          <h3 style={{ margin: '0 0 10px 0' }}>{t('LOCAL DIFFICULTY')}</h3>
          <select 
            value={difficulty} 
            onChange={(e) => setDifficulty(e.target.value)}
            style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid var(--accent)', borderRadius: '8px', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            <option value="Beginner">{t('BEGINNER')}</option>
            <option value="Intermediate">{t('INTERMEDIATE')}</option>
            <option value="Expert">{t('EXPERT')}</option>
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1rem' }}>
        <button className="btn-premium secondary" style={{ flex: 1 }} onClick={onCancel}>{t('CANCEL')}</button>
        <button className="btn-premium" style={{ flex: 1 }} onClick={() => onSave({ targetScore, difficulty })}>{t('SAVE')}</button>
      </div>
    </div>
  );
};

export default SettingsPanel;
