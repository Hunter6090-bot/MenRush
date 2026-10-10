import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from './Layout';
import { ConversationList } from './ConversationList';
import { Messages } from '../pages/Messaging';
import { IconChat } from './icons';
import { ThemeToggle } from './ThemeToggle';
import { ROUTE_LABELS } from '../lib/routeLabels';

/** Desktop Chat inbox only — Video rooms live in RoomsHub, not nested here. */
export const MessagingHub = () => {
  const { otherId } = useParams<{ otherId?: string }>();

  return (
    <Layout>
      <div className="flex h-[calc(100dvh-var(--desktop-workspace-header))] min-h-0 min-w-0 max-w-full overflow-hidden bg-[var(--bg-primary)]">
        <aside className="flex w-[320px] shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-primary)]">
          <div className="shrink-0 border-b border-[var(--border-default)] px-4 py-4">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--cream-muted)]">
                  Inbox
                </p>
                <p className="truncate text-sm font-semibold text-[var(--cream)]">{ROUTE_LABELS.messages}</p>
              </div>
              <ThemeToggle variant="header" />
            </div>
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <ConversationList
              activeUserId={otherId}
              variant="sidebar"
              showHeader={false}
              className="h-full min-w-0"
            />
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-clip bg-[var(--bg-primary)]">
          {otherId ? (
            <Messages embedded />
          ) : (
            <HubEmpty
              icon={<IconChat size={36} className="text-[var(--copper)]/50" />}
              title="Select a conversation"
              body="Pick someone from your inbox to read and reply, or start a chat from Nearby."
            />
          )}
        </section>
      </div>
    </Layout>
  );
};

function HubEmpty({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]/60">
        {icon}
      </div>
      <h2 className="text-lg font-bold text-[var(--cream)]">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--cream-muted)]">{body}</p>
    </div>
  );
}
