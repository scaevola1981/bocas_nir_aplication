import React from 'react';
import { HelpCircle, X, ShieldCheck, FolderCheck, FileText, CheckSquare, Save } from 'lucide-react';
import styles from './InstructionsModal.module.css';

export function InstructionsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <div className={styles.iconBox}>
              <HelpCircle size={22} />
            </div>
            <div>
              <h3 className={styles.title}>Ghid de Utilizare & Instrucțiuni</h3>
              <p className={styles.subtitle}>Cum funcționează automatizarea facturilor și NIR-urilor</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Închide">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepContent}>
              <h4>Conectează Registrul Excel</h4>
              <p>
                Apasă pe <strong>„Alege Fișierul Excel (.xlsx)”</strong> și selectează registrul tău de lucru din calculator. Aplicația citește automat ultimul NIR emis și ultimele coduri alocate.
              </p>
            </div>
          </div>

          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepContent}>
              <h4>Încarcă Factura (Drag & Drop)</h4>
              <p>
                Trage fișierul facturii (<strong>PDF</strong> SmartBill/SPV sau <strong>XML</strong> e-Factura) direct în zona punctată. Datele sunt extrase instantaneu cu precizie 100%.
              </p>
            </div>
          </div>

          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepContent}>
              <h4>Verificare & Filtrare Contabilitate</h4>
              <p>
                În fereastra de verificare, poți edita denumiri sau debifa consumabilele (pungi, pietre de polizor, taxe) care nu merg în fișa de stoc. Sistemul detectează automat și blochează facturile deja înregistrate.
              </p>
            </div>
          </div>

          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>4</div>
            <div className={styles.stepContent}>
              <h4>Salvare Directă în Excel</h4>
              <p>
                Apasă <strong>„Trimite în Excel”</strong>. Aplicația generează automat noua filă <code>Nir XX</code> și adaugă intrările în foaia <code>Gestiune</code>, salvând modificările direct în fișierul de pe calculatorul tău.
              </p>
            </div>
          </div>

          <div className={styles.securityNote}>
            <ShieldCheck size={20} />
            <span>
              <strong>Confidențialitate 100%:</strong> Toate datele sunt procesate exclusiv în memoria calculatorului tău. Nicio factură și niciun fișier Excel nu se trimite pe servere externe.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.primaryBtn} onClick={onClose}>
            Am înțeles, închide ghidul
          </button>
        </div>
      </div>
    </div>
  );
}
