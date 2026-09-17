import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

const App = lazy(() => import('./components/Popup'));

const rootElement = document.getElementById('root');
if ( !rootElement ) {
    throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <Suspense fallback={null}>
        <App />
    </Suspense>
);