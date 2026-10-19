import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { getFirebaseConfigError } from './lib/firebaseConfig';

const root = createRoot(document.getElementById('root')!);
const configError = getFirebaseConfigError();

if (configError) {
  root.render(
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 560, margin: '96px auto', padding: 24, lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>Firebase is not configured</h1>
      <p style={{ margin: 0, color: '#4b5563' }}>{configError}</p>
    </div>,
  );
} else {
  // Imported lazily so Firebase is only initialised once the config is valid.
  import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  });
}
