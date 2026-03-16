import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import i18n from './i18n';
import { useUiStore, type Language } from './stores/uiStore';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Restore persisted language preference
window.clawwork?.getSettings().then((settings) => {
  const lang = settings?.language as Language | undefined;
  if (lang && lang !== i18n.language) {
    i18n.changeLanguage(lang);
    useUiStore.setState({ language: lang });
  }
});

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
