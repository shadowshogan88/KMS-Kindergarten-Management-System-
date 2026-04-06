import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import Departments from './components/Departments';
const Index = () => {
  return <>
      <PageMeta title="Departments" />
      <main>
        <PageBreadcrumb title="Departments" subtitle="Menu" />
        <Departments />
      </main>
    </>;
};
export default Index;
