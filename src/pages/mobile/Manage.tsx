import React from 'react';
import { ChevronRight, LogOut, Package2, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SectionHeading } from '@/components/mobile/shared';

type Props = {
  user: { displayName: string } | null;
  onLogout: () => void;
};

const SHORTCUTS = [
  {
    title: '商户管理',
    icon: Store,
    path: '/mobile/manage/merchants',
  },
  {
    title: '商品管理',
    icon: Package2,
    path: '/mobile/manage/products',
  },
] as const;

export default function MobileManage({ user, onLogout }: Props) {
  const navigate = useNavigate();

  return (
    <div className="mobile-page">
      <section className="mobile-hero mobile-rise">
        <div className="mobile-hero__title">{user?.displayName || '配货员'}</div>
      </section>

      <SectionHeading title="管理" />

      <div className="mobile-shortcut-grid">
        {SHORTCUTS.map((item, index) => {
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              type="button"
              className="mobile-shortcut-card mobile-rise"
              style={{ animationDelay: `${90 + index * 60}ms` }}
              onClick={() => navigate(item.path)}
            >
              <div className="mobile-shortcut-card__icon">
                <Icon size={20} />
              </div>
              <div className="mobile-shortcut-card__title">{item.title}</div>
            </button>
          );
        })}
      </div>

      <SectionHeading title="账号" />

      <div className="mobile-surface mobile-menu-card mobile-rise" style={{ animationDelay: '220ms' }}>
        <button type="button" className="mobile-menu-row" onClick={onLogout}>
          <div className="mobile-menu-row__left">
            <div className="mobile-menu-row__icon">
              <LogOut size={18} />
            </div>
            <div>
              <div className="mobile-menu-row__title">退出登录</div>
            </div>
          </div>
          <ChevronRight size={18} color="#637166" />
        </button>
      </div>
    </div>
  );
}
