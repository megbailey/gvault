import React, { lazy } from 'react'
import ReactDOM from 'react-dom/client'

const App = lazy(() => import('./components/Popup'));

const rootElement = document.getElementById('root');
if ( !rootElement ) {
    throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);
root.render( <App /> );