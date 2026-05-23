import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { SocketProvider } from '@/contexts/SocketContext';
import AppRoutes from '@/routes/AppRoutes';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#ffffff',
                color:      '#0f172a',
                border:     '1px solid rgb(226,232,240)',
                borderRadius: '12px',
                fontSize:   '13px',
                boxShadow:  '0 4px 12px rgba(15,23,42,0.08)',
              },
              success: { iconTheme: { primary: '#00A0DC', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
            }}
          />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
