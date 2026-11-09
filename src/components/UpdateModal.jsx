import React, { useState } from 'react';
import { Sparkles, RefreshCw, X, ShieldCheck } from 'lucide-react';
import styles from './UpdateModal.module.css';

export function UpdateModal({ isOpen, onClose, onConfirmUpdate }) {
  const [updating, setUpdating] = useState(false);

  if (!isOpen) return null;

  const handleUpdateClick = async () => {
    setUpdating(true);
    await onConfirmUpdate();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        <button className={styles.closeBtn} onClick={onClose} disabled={updating} title="Închide">
          <X size={18} />
        </button>

        <div className={styles.iconCircle}>
          <Sparkles size={28} color="#0284c7" />
        </div>

        <h3 className={styles.title}>Versiune Nouă Disponibilă!</h3>
        <p className={styles.subtitle}>
          A fost publicată o actualizare pentru <strong>Gestiune e-Factură & NIR</strong> cu optimizări și îmbunătățiri recente (inclusiv noile modele de NIR și antetul actualizat).
        </p>

        <div className={styles.infoBox}>
          <ShieldCheck size={18} color="#16a34a" />
          <span>Toate fișierele și datele tale de pe calculator rămân 100% în siguranță și intacte.</span>
        </div>

        <div className={styles.btnRow}>
          <button className={styles.laterBtn} onClick={onClose} disabled={updating}>
            Mai târziu
          </button>
          <button className={styles.updateBtn} onClick={handleUpdateClick} disabled={updating}>
            {updating ? (
              <>
                <RefreshCw size={17} className={styles.spinner} />
                <span>Se actualizează...</span>
              </>
            ) : (
              <>
                <RefreshCw size={17} />
                <span>Actualizează Acum</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

