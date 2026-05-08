import React, { useState } from 'react';
import { Layout, Menu, Button, theme, Dropdown } from 'antd';
import {
  DashboardOutlined,
  ShopOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  SwapOutlined,
  AccountBookOutlined,
  PrinterOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { businessProfile } from '@/config/public';

const { Header, Sider, Content } = Layout;

const MENU_ITEMS = [
  { key: '/admin', icon: <DashboardOutlined />, label: '工作台' },
  { key: '/admin/merchants', icon: <ShopOutlined />, label: '商户管理' },
  { key: '/admin/products', icon: <AppstoreOutlined />, label: '商品管理' },
  { key: '/admin/orders', icon: <UnorderedListOutlined />, label: '订单供货' },
  { key: '/admin/allocation', icon: <SwapOutlined />, label: '配货记录' },
  { key: '/admin/settlement', icon: <AccountBookOutlined />, label: '结算管理' },
  { key: '/admin/receipt', icon: <PrinterOutlined />, label: '热敏小票' },
];

type Props = {
  children: React.ReactNode;
  user: { displayName: string; username: string } | null;
  onLogout: () => void;
};

export default function AdminLayout({ children, user, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const selectedKey = MENU_ITEMS.find(item =>
    location.pathname === item.key || (item.key !== '/admin' && location.pathname.startsWith(item.key))
  )?.key || '/admin';
  const shortBrand = businessProfile.name.slice(0, 1) || '豆';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{ background: token.colorBgContainer, borderRight: '1px solid #f0f0f0' }}
        width={220}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
        }}>
          {collapsed ? (
            <span style={{ fontSize: 20, fontWeight: 700, color: '#1d6b49' }}>{shortBrand}</span>
          ) : (
            <span style={{ fontSize: 18, fontWeight: 700, color: '#1d6b49' }}>{businessProfile.name}</span>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={MENU_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 0, marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: token.colorBgContainer,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: 'rgba(0,0,0,0.45)' }}>{new Date().toLocaleDateString('zh-CN')}</span>
            <Dropdown menu={{
              items: [
                { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: onLogout },
              ],
            }}>
              <Button type="text" icon={<UserOutlined />}>
                {user?.displayName || user?.username}
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ padding: 24, background: '#f5f5f5', minHeight: 'calc(100vh - 64px)' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
