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
    desc: '看资料、看历史、调状态',
    icon: Store,
    path: '/mobile/manage/merchants',
  },
  {
    title: '商品管理',
    desc: '改品项、改规格、控上架',
    icon: Package2,
    path: '/mobile/manage/products',
  },
] as const;

export default function MobileManage({ user, onLogout }: Props) {
  const navigate = useNavigate();

  return (
    <div className="mobile-page">
      <section className="mobile-hero mobile-rise">
        <div className="mobile-hero__eyebrow">账号与配置</div>
        <div className="mobile-hero__title">{user?.displayName || '配货员'}</div>
        <div className="mobile-hero__meta">
          <span>当前入口是移动端工作台</span>
        </div>
        <div className="mobile-inline-chips">
          <span className="mobile-chip mobile-chip--light">商户和商品都改成移动页</span>
          <span className="mobile-chip mobile-chip--dark">常用操作直接在这里做</span>
        </div>
      </section>

      <SectionHeading eyebrow="常用入口" title="管理捷径" />

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
              <div className="mobile-shortcut-card__desc">{item.desc}</div>
            </button>
          );
        })}
      </div>

      <SectionHeading eyebrow="账号动作" title="个人设置" />

      <div className="mobile-surface mobile-menu-card mobile-rise" style={{ animationDelay: '220ms' }}>
        <button type="button" className="mobile-menu-row" onClick={onLogout}>
          <div className="mobile-menu-row__left">
            <div className="mobile-menu-row__icon">
              <LogOut size={18} />
            </div>
            <div>
              <div className="mobile-menu-row__title">退出登录</div>
              <div className="mobile-menu-row__desc">清掉当前账号，回到登录页</div>
            </div>
          </div>
          <ChevronRight size={18} color="#637166" />
        </button>
      </div>
    </div>
  );
}
