import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Admin } from './pages/Admin';
import { Automatizari } from './pages/Automatizari';
import { Confidentialitate } from './pages/Confidentialitate';
import { Home } from './pages/Home';
import { Programare } from './pages/Programare';
import { Status } from './pages/Status';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/programare" element={<Programare />} />
        <Route path="/status/:token" element={<Status />} />
        <Route path="/automatizari" element={<Automatizari />} />
        <Route path="/confidentialitate" element={<Confidentialitate />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
