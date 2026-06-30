import { Layout } from '../components/Layout';
import { RoomList } from '../components/RoomList';

export const Rooms = () => {
  return (
    <Layout>
      <div className="mx-auto max-w-lg px-4 py-2 pb-8">
        <RoomList />
      </div>
    </Layout>
  );
};
