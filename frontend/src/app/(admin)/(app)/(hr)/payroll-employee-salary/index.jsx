import PageBreadcrumb from '@/components/PageBreadcrumb';
import EmployeeTotalSalary from './components/EmployeeTotalSalary';
import PageMeta from '@/components/PageMeta';
const Index = () => {
  return <>
      <PageMeta title="Employee Salary" />
      <main>
        <PageBreadcrumb title="Employee Salary" subtitle="Menu" />
        <EmployeeTotalSalary />
      </main>
    </>;
};
export default Index;
