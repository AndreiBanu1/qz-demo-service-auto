import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { copy } from './copy';
import { Automatizari } from './pages/Automatizari';
import { Confidentialitate } from './pages/Confidentialitate';
import { Home } from './pages/Home';
import { Programare } from './pages/Programare';
import { Status } from './pages/Status';
import { NotFound } from './pages/NotFound';
import { Placeholder } from './pages/Placeholder';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/programare" element={<Programare />} />
        <Route path="/status/:token" element={<Status />} />
        <Route path="/automatizari" element={<Automatizari />} />
        <Route path="/confidentialitate" element={<Confidentialitate />} />
        <Route path="/admin" element={<Placeholder title={copy.placeholder.admin} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
