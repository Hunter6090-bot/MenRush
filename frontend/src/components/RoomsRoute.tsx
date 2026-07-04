import { useParams } from 'react-router-dom';
import { useIsDesktopLayout } from '../hooks/useMediaQuery';
import { Rooms } from '../pages/Rooms';
import { RoomChat } from '../pages/RoomChat';
import { RoomsHub } from './RoomsHub';

export const RoomsRoute = () => {
  const isDesktop = useIsDesktopLayout();
  const { roomId } = useParams<{ roomId?: string }>();

  if (isDesktop) {
    return <RoomsHub />;
  }

  if (roomId) {
    return <RoomChat />;
  }

  return <Rooms />;
};
