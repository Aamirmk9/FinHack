import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import NetworkGraph from './components/NetworkGraph';
import InvestigationPanel from './components/InvestigationPanel';
import Timeline from './components/Timeline';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/network" element={<NetworkGraph />} />
          <Route path="/investigation" element={<InvestigationPanel />} />
          <Route path="/timeline" element={<Timeline />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
