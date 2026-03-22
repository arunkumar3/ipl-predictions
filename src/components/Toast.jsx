import { useState, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed left-4 right-4 z-[100] flex flex-col items-center gap-2" style={{ bottom: 80 }}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="px-4 py-2.5 rounded-xl shadow-lg text-center max-w-sm w-full"
              style={{
                backgroundColor: toast.type === 'success' ? '#E8F8EE' : toast.type === 'error' ? '#FEE7E7' : '#EEF3FF',
                border: `1px solid ${toast.type === 'success' ? '#B6E8C8' : toast.type === 'error' ? '#F5B5B5' : '#D5DDF5'}`,
              }}
            >
              <span
                className="text-xs font-semibold"
                style={{ color: toast.type === 'success' ? '#16A34A' : toast.type === 'error' ? '#E24B4A' : '#1B2A6B' }}
              >
                {toast.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
