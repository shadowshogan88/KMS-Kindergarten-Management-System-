import StudentTable from './components/StudentTable';
import { useSearchParams } from 'react-router';

const StudentsPage = () => {
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('tab') || '').trim().toLowerCase() === 'roll' ? 'roll' : 'list';
  return <StudentTable mode={mode} />;
};

export default StudentsPage;
