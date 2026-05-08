import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { House, ListTodo, SlidersHorizontal } from 'lucide-react';

const TABS = [
  { key: '/mobile', title: '首页', icon: House },
  { key: '/mobile/tasks', title: '任务', icon: ListTodo },
  { key: '/mobile/manage', title: '管理', icon: SlidersHorizontal },
];

type Props = { children: React.ReactNode };

export default function MobileLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const hideNav = /^\/mobile\/tasks\/[^/]+$/.test(location.pathname);

  const activeKey = TABS.find(t =>
    location.pathname === t.key || (t.key !== '/mobile' && location.pathname.startsWith(t.key))
  )?.key || '/mobile';

  return (
    <div className={`mobile-shell ${hideNav ? 'mobile-shell--detail' : ''}`.trim()}>
      <div className="mobile-shell__inner">
        {children}
      </div>

      {!hideNav ? (
        <nav className="mobile-nav">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeKey === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                className={`mobile-nav__item ${isActive ? 'is-active' : ''}`.trim()}
                onClick={() => navigate(tab.key)}
              >
                <Icon />
                <span>{tab.title}</span>
              </button>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
