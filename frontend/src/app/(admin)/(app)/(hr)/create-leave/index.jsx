import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import CreateLeave from './components/CreateLeave';
const Index = () => {
  return <>
      <PageMeta title="Add Leave (Admin)" />
      <main>
        <PageBreadcrumb title="Add Leave (Admin)" subtitle="Menu" />
        <CreateLeave />
      </main>
    </>;
};
export default Index;
