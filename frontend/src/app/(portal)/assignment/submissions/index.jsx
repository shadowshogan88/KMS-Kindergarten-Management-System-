import HomeworkSubmissions from '@/app/(portal)/homework/submissions';

const AssignmentSubmissions = () => (
  <HomeworkSubmissions
    submissionType="ASSIGNMENT"
    pageTitle="Assignment Submissions"
    breadcrumbTitle="Assignment Submissions"
    filterEntityLabel="assignment"
    metaCardLabel="Assignment"
    detailBasePath="/portal/assignment/submissions"
  />
);

export default AssignmentSubmissions;
