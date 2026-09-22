import React, { useState, useEffect } from 'react';
import { ShieldCheck, DownloadCloud, X, CheckCircle2, Laptop, HelpCircle, Sun, Moon, Activity } from 'lucide-react';
import styles from './Header.module.css';

export function Header({ excelConnected, excelFileName, nextNir, nextCod, onOpenHelp, theme, onToggleTheme, activeView, onToggleDevOps }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    // Verifică dacă rulează deja ca aplicație standalone instalată
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowGuide(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowGuide(true);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <div className={styles.logoIcon}>
            <img src="/app-icon.png" alt="Bocas Project Logo" className={styles.logoImg} />
          </div>
          <div>
            <h1 className={styles.title}>Gestiune e-Factură & NIR</h1>
            <p className={styles.subtitle}>S.C. BOCAS PROJECT SRL • Automatizare Contabilitate</p>
          </div>
        </div>

        <div className={styles.rightActions}>
          {/* Buton comutare Temă Dark / Light */}
          <button
            type="button"
            className={styles.themeToggleBtn}
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Comută pe Mod Luminos (Light Mode)' : 'Comută pe Mod Întunecat (Dark Mode)'}
            aria-label="Comută Tema"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Buton rotund discret cu semnul ? pentru instructiuni */}
          <button
            type="button"
            className={styles.helpRoundBtn}
            onClick={onOpenHelp}
            title="Ghid & Instrucțiuni de utilizare"
            aria-label="Instrucțiuni"
          >
            <HelpCircle size={18} />
          </button>

          {/* Buton DevOps & Monitor Erori */}
          <button
            type="button"
            className={`${styles.devOpsBtn} ${activeView === 'devops' ? styles.devOpsBtnActive : ''}`}
            onClick={onToggleDevOps}
            title={activeView === 'devops' ? 'Revenire la Gestiune e-Factură & NIR' : 'Panou DevOps, Diagnoză & Monitor Erori Live'}
            aria-label="DevOps & Monitor Erori"
          >
            <Activity size={16} />
            <span>{activeView === 'devops' ? 'Gestiune NIR' : 'DevOps Monitor'}</span>
          </button>

          {/* Buton instalare pe Desktop ca aplicație normală */}
          {!isInstalled ? (
            <button
              type="button"
              className={styles.installBtn}
              onClick={handleInstallClick}
              title="Instalează aplicația pe Desktop"
            >
              <DownloadCloud size={16} />
              <span>Instalează pe Desktop</span>
            </button>
          ) : (
            <div className={styles.installedBadge} title="Aplicația rulează ca program de sine stătător">
              <CheckCircle2 size={15} color="#16a34a" />
              <span>Aplicație Desktop</span>
            </div>
          )}

          <div className={styles.statusBox}>
            {excelConnected ? (
              <div className={styles.statusConnected}>
                <ShieldCheck size={18} color="#16a34a" />
                <div>
                  <span className={styles.statusLabel}>Excel Conectat:</span>
                  <strong className={styles.fileName}>{excelFileName}</strong>
                  <span className={styles.badge}>Următorul NIR: {nextNir}</span>
                  <span className={styles.badge}>Următorul Cod: {nextCod}</span>
                </div>
              </div>
            ) : (
              <div className={styles.statusDisconnected}>
                <span className={styles.dot}></span>
                <span>Fișierul Excel nu este conectat</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ghid ghidat pentru instalare Desktop dacă browserul nu permite prompt direct */}
      {showGuide && (
        <div className={styles.guideOverlay} onClick={() => setShowGuide(false)}>
          <div className={styles.guideCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.guideHeader}>
              <div className={styles.guideTitleGroup}>
                <div className={styles.guideLogoBox}>
                  <img src="/app-icon.png" alt="Bocas Logo" className={styles.guideLogoImg} />
                </div>
                <div>
                  <h3>Instalează ca Aplicație pe Desktop</h3>
                  <p>Adaugă aplicația direct pe ecran cu iconița Bocas Project</p>
                </div>
              </div>
              <button className={styles.guideCloseBtn} onClick={() => setShowGuide(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.guideBody}>
              <div className={styles.stepBox}>
                <span className={styles.stepNum}>1</span>
                <div>
                  <strong>În Google Chrome sau Microsoft Edge (Windows & Mac):</strong>
                  <p>
                    Apasă pe iconița de instalare <strong>📥</strong> (sau <strong>+</strong>) din partea dreaptă a barei de adrese a browserului (lângă steaua de favorite) și apasă <strong>„Instalează”</strong>.
                  </p>
                </div>
              </div>

              <div className={styles.stepBox}>
                <span className={styles.stepNum}>2</span>
                <div>
                  <strong>În Safari (macOS Sonoma sau mai nou):</strong>
                  <p>
                    Mergi sus în meniul <strong>Fișier (File)</strong> &rarr; <strong>„Adăugați la Dock...” (Add to Dock...)</strong>.
                  </p>
                </div>
              </div>

              <div className={styles.benefitNotice}>
                <Laptop size={18} color="var(--primary)" />
                <span>
                  Aplicația va avea propria iconiță pe Desktop / Taskbar și se va deschide într-o fereastră curată de program, fără browser!
                </span>
              </div>
            </div>

            <div className={styles.guideFooter}>
              <button className={styles.guideOkBtn} onClick={() => setShowGuide(false)}>
                Am înțeles
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

