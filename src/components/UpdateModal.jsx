import React, { useState } from 'react';
import { Sparkles, RefreshCw, X, ShieldCheck, CheckCircle2 } from 'lucide-react';
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
          A fost publicată o actualizare pentru <strong>Gestiune e-Factură & NIR</strong> cu următoarele noutăți și optimizări:
        </p>

        <div className={styles.changesCard}>
          <div className={styles.changesHeader}>
            <Sparkles size={14} color="#0284c7" />
            <span>Noutăți în această versiune:</span>
          </div>
          <ul className={styles.changesList}>
            <li>
              <CheckCircle2 size={16} color="#16a34a" className={styles.checkIcon} />
              <span>
                <strong>Logo transparent & aliniere antet:</strong> Logo-ul Bocas Project are acum fundal 100% transparent (fără chenar negru), iar datele firmei (denumire, Reg. Com, CUI, sediu, IBAN, contact) sunt încadrate pe rândurile 1-5 exact la aceeași înălțime cu logo-ul.
              </span>
            </li>
            <li>
              <CheckCircle2 size={16} color="#16a34a" className={styles.checkIcon} />
              <span>
                <strong>Formatare strictă Arial 8:</strong> Toate rândurile NIR, chenarele subțiri și valorile aliniate la dreapta respectă 100% modelul Excel de gestiune.
              </span>
            </li>
            <li>
              <CheckCircle2 size={16} color="#16a34a" className={styles.checkIcon} />
              <span>
                <strong>Actualizare automată dintr-un click:</strong> Programul se reîncarcă instant cu noua versiune fără să mai fie nevoie de curățarea manuală a memoriei cache.
              </span>
            </li>
          </ul>
        </div>

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

