import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import NetworkGraph from './components/NetworkGraph';
import InvestigationPanel from './components/InvestigationPanel';
import Timeline from './components/Timeline';
import SendPage from './components/SendPage';
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
          <Route path="/network" element={<NetworkGraph />} />
          <Route path="/investigation" element={<InvestigationPanel />} />
          <Route path="/timeline" element={<Timeline />} />
        </Route>
        {/* Mobile send page — no layout wrapper */}
        <Route path="/send" element={<SendPage />} />
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
