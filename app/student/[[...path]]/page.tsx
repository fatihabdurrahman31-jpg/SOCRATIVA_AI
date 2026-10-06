import { Workbench } from "../../../components/workbench";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  return <Workbench role="student" path={path} />;
}
