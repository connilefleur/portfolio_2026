import { useSearchParams } from 'react-router-dom';
import { Layout, Clock } from '../components/Layout';
import PhysarumCanvas from '../components/PhysarumCanvas';
import { PROJECTS } from '../data/projects';

export function Scope() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewerOpen = !!searchParams.get('project');

  function openViewer(id: string) {
    setSearchParams({ project: id });
  }

  const meta = (
    <>
      <span className="dot" />
      <span>{PROJECTS.length} projects</span>
      <span>·</span>
      <span>HAM · 53.55 N</span>
      <span>·</span>
      <Clock />
    </>
  );

  return (
    <Layout page="scope" meta={meta} shellClass="shell--locked">
      <section className="map">
        <PhysarumCanvas projects={PROJECTS} onNodeClick={openViewer} paused={viewerOpen} />
      </section>
    </Layout>
  );
}
