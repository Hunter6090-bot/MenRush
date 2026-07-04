import { useParams } from 'react-router-dom';
import { useIsDesktopLayout } from '../hooks/useMediaQuery';
import { Conversations } from '../pages/Conversations';
import { Messages } from '../pages/Messaging';
import { MessagingHub } from './MessagingHub';

/** Routes mobile full-screen chat vs desktop split inbox. */
export const MessagingRoute = () => {
  const isDesktop = useIsDesktopLayout();
  const { otherId } = useParams<{ otherId?: string }>();

  if (isDesktop) {
    return <MessagingHub />;
  }

  if (otherId) {
    return <Messages />;
  }

  return <Conversations />;
};
