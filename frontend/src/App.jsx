import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import InvestigationPanel from './components/InvestigationPanel';
import Timeline from './components/Timeline';
import SendPage from './components/SendPage';
import DemoWallet from './components/DemoWallet';
import GlobeNetwork from './components/GlobeNetwork';
import LiveToast from './components/LiveToast';
import useWebSocket from './hooks/useWebSocket';

function AppContent() {
  const { lastUpdate } = useWebSocket();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (lastUpdate && lastUpdate.type === 'transaction_injected') {
      setToast(lastUpdate);
    }
  }, [lastUpdate]);

  return (
    <>
      <Routes>
        {/* Main dashboard routes */}
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/globe" element={<GlobeNetwork />} />
          <Route path="/investigation" element={<InvestigationPanel />} />
          <Route path="/timeline" element={<Timeline />} />
        </Route>
        {/* Mobile send page — no layout wrapper */}
        <Route path="/send" element={<SendPage />} />
        {/* Demo wallet — mobile bank app for live presentations */}
        <Route path="/demo" element={<DemoWallet />} />
      </Routes>

      {/* Live transaction toast — shows on all pages */}
      <LiveToast update={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
