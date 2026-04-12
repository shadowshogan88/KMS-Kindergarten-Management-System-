import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import EmployeeDetails from './components/EmployeeDetails';
const Index = () => {
  return <>
      <PageMeta title="Staff List" />
      <main>
        <PageBreadcrumb title="Staff List" subtitle="Menu" />
        <EmployeeDetails />
      </main>
    </>;
};
export default Index;
