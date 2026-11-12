import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { copy } from './copy';
import { NotFound } from './pages/NotFound';
import { Placeholder } from './pages/Placeholder';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Placeholder title={copy.placeholder.home} />} />
        <Route path="/programare" element={<Placeholder title={copy.placeholder.booking} />} />
        <Route path="/status/:token" element={<Placeholder title={copy.placeholder.status} />} />
        <Route path="/automatizari" element={<Placeholder title={copy.placeholder.automations} />} />
        <Route path="/confidentialitate" element={<Placeholder title={copy.placeholder.privacy} />} />
        <Route path="/admin" element={<Placeholder title={copy.placeholder.admin} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
